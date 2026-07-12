'use strict';

const { runAgentWithRuntime } = require('./agentRuntime');
const { isUsableRetrievalEvidenceDocument } = require('./evidenceAssertions');
const {
  casePayloadFromDraft,
  cleanText,
  detectIntent,
  extractCaseFields,
  mergeDraft,
  missingFields,
  normalizeQuestion,
  questionMetadataForQuestion,
  requestProfileForDraft,
  runReadinessForDraft,
  unique,
  validateActiveQuestionAnswer
} = require('./conversationState');
const {
  evidenceChecklist,
  executionBlockersForMissing,
  filterRepeatedQuestions,
  questionsForDraft
} = require('./conversationPolicy');
const { composeReply } = require('./conversationRenderer');

const GENERIC_DETERMINISTIC_OWNERS = new Set([
  'Group Technology Risk',
  'Group Finance Transformation',
  'Trade Compliance And Export Controls',
  'Procurement And Third-Party Risk',
  'Legal And Privacy',
  'HSE And Business Continuity',
  'International Growth'
]);

function preserveAiDraftWhereDeterministicIsGeneric(existingDraft = {}, extracted = {}, draft = {}, aiPrimary = false) {
  if (!aiPrimary) return draft;
  const next = { ...draft };
  if (
    cleanText(existingDraft.businessUnit)
    && cleanText(extracted.businessUnit)
    && GENERIC_DETERMINISTIC_OWNERS.has(extracted.businessUnit)
  ) {
    next.businessUnit = existingDraft.businessUnit;
  }
  if (
    cleanText(existingDraft.geography)
    && cleanText(extracted.geography)
    && cleanText(extracted.updateMode) === 'unspecified'
    && /\band\b/i.test(existingDraft.geography)
    && !/\band\b/i.test(extracted.geography)
  ) {
    next.geography = existingDraft.geography;
  }
  if (cleanText(existingDraft.llmIntake?.reviewTarget) && !cleanText(next.llmIntake?.reviewTarget)) {
    next.llmIntake = existingDraft.llmIntake;
  }
  return next;
}

function llmAttemptSummary(llmAssessment = {}) {
  const count = Number(llmAssessment?.attemptCount || (Array.isArray(llmAssessment?.attempts) ? llmAssessment.attempts.length : 0) || 0);
  const max = Number(llmAssessment?.maxAttempts || 0);
  if (!count) return '';
  const suffix = llmAssessment?.retried || count > 1 ? ' after retry handling' : '';
  return ` Compass attempts: ${count}${max ? `/${max}` : ''}${suffix}.`;
}

function extractedHasUsefulContext(extracted = {}) {
  return Boolean(
    cleanText(extracted.supplierName)
    || cleanText(extracted.businessUnit)
    || cleanText(extracted.geography)
    || cleanText(extracted.exportOriginJurisdiction)
    || (Array.isArray(extracted.integrations) && extracted.integrations.length)
    || (Array.isArray(extracted.documents) && extracted.documents.length)
    || (Array.isArray(extracted.evidenceSignals) && extracted.evidenceSignals.length)
    || (Array.isArray(extracted.riskSignals) && extracted.riskSignals.length)
    || (Array.isArray(extracted.knownGaps) && extracted.knownGaps.length)
    || (Array.isArray(extracted.dataCategories) && extracted.dataCategories.length)
    || (Array.isArray(extracted.fieldClarifications) && extracted.fieldClarifications.length)
  );
}

function isEvidenceUploadEvent(input = {}, existingDraft = {}) {
  return cleanText(input.eventType || existingDraft.currentEventType).toLowerCase() === 'evidence_uploaded'
    && (
      (Array.isArray(input.uploadedEvidence) && input.uploadedEvidence.length > 0)
      || (Array.isArray(existingDraft.documents) && existingDraft.documents.length > 0)
    );
}

function stripEvidenceUploadTransportExtraction(extracted = {}) {
  return {
    ...extracted,
    supplierName: '',
    brief: '',
    intakeAssessment: null,
    businessUnit: '',
    geography: '',
    exportOriginJurisdiction: '',
    exportEndUse: '',
    integrations: [],
    documents: [],
    evidenceSignals: [],
    riskSignals: [],
    sanctionsSensitiveGeographies: [],
    knownGaps: [],
    reviewFocus: '',
    aiUsageScope: null,
    dataCategories: [],
    updateMode: 'unspecified',
    fieldClarifications: []
  };
}

function normalizeQuestionCandidate(value = '') {
  const candidate = cleanText(value)
    .replace(/^(?:next(?:\s+(?:best|key|useful|review|follow[- ]?up))*\s+(?:question|clarification|scoping point|step)(?:\s*\([^)]{0,160}\))?|next key scoping point|next key clarification|to go deeper[^:]{0,120}|before i run[^:]{0,120})\s*:?\s*/i, '')
    .replace(/^(?:question|clarification)\s*:?\s*/i, '');
  if (!candidate || candidate.length < 12) return '';
  if (candidate.endsWith('?')) return candidate;
  if (/^(who|what|which|where|when|how|can|does|do|is|are|should|will|would|could|within)\b/i.test(candidate)) {
    return `${candidate}?`;
  }
  return '';
}

function firstParagraph(value = '') {
  return cleanText(String(value || '')
    .split(/\n\s*\n/)
    .shift() || '')
    .replace(/\s+(?:Why it matters|Short answer is fine|Risks|What to check|Key areas to focus).*$/i, '');
}

function questionCandidatesFromAssistantText(text = '') {
  const raw = String(text || '').replace(/\r/g, '\n');
  if (!cleanText(raw)) return [];
  const candidates = [];
  const labeledPattern = /(?:^|\n)\s*((?:Next(?:\s+(?:best|key|useful|review|follow[- ]?up))*\s+(?:question|clarification|scoping point|step)(?:\s*\([^)]{0,160}\))?|Next key scoping point|Next key clarification|To go deeper[^:\n]{0,120}|Before I run[^:\n]{0,120})\s*:?\s*[\s\S]{0,900})/gi;
  for (const match of raw.matchAll(labeledPattern)) {
    const normalized = normalizeQuestionCandidate(firstParagraph(match[1]));
    if (normalized) candidates.push(normalized);
  }
  for (const match of raw.matchAll(/[^.!?\n]{8,900}\?/g)) {
    const normalized = normalizeQuestionCandidate(match[0]);
    if (normalized) candidates.push(normalized);
  }
  return unique(candidates).slice(-6);
}

function questionContextFromTurn(turn = {}) {
  const displayed = normalizeQuestionCandidate(turn.displayedQuestion || '');
  if (displayed) {
    const metadata = questionMetadataForQuestion(displayed, {
      id: turn.displayedQuestionId,
      field: turn.displayedQuestionField
    }) || {};
    return {
      question: displayed,
      id: cleanText(metadata.id || turn.displayedQuestionId),
      field: cleanText(metadata.field || turn.displayedQuestionField)
    };
  }
  const answering = normalizeQuestionCandidate(turn.answeringQuestion || '');
  if (answering) {
    const metadata = questionMetadataForQuestion(answering, {
      id: turn.answeringQuestionId,
      field: turn.answeringQuestionField
    }) || {};
    return {
      question: answering,
      id: cleanText(metadata.id || turn.answeringQuestionId),
      field: cleanText(metadata.field || turn.answeringQuestionField)
    };
  }
  if (turn.role === 'assistant') {
    const questions = questionCandidatesFromAssistantText(turn.text || turn.content || turn.message || '');
    const question = questions.at(-1) || '';
    if (question) {
      const metadata = questionMetadataForQuestion(question) || {};
      return {
        question,
        id: cleanText(metadata.id),
        field: cleanText(metadata.field)
      };
    }
  }
  return { question: '', id: '', field: '' };
}

function visibleQuestionContextFromHistory(history = []) {
  if (!Array.isArray(history)) return '';
  const turns = history.filter((turn) => turn && typeof turn === 'object');
  for (const turn of turns.slice().reverse()) {
    if (turn.role !== 'assistant') continue;
    const context = questionContextFromTurn(turn);
    if (context.question && !/^what do you need reviewed\??$/i.test(context.question)) {
      return context;
    }
  }
  for (const turn of turns.slice().reverse()) {
    if (turn.role !== 'user') continue;
    const context = questionContextFromTurn(turn);
    if (context.question) return context;
  }
  return { question: '', id: '', field: '' };
}

function conversationHistoryForDraft(input = {}, existingDraft = {}) {
  const source = Array.isArray(input.history)
    ? input.history
    : Array.isArray(existingDraft.conversationHistory) ? existingDraft.conversationHistory : [];
  return source.filter((turn) => turn && typeof turn === 'object').slice(-16).map((turn) => ({
    role: cleanText(turn.role),
    text: cleanText(turn.text || turn.content || turn.message || ''),
    displayedQuestion: cleanText(turn.displayedQuestion || ''),
    displayedQuestionId: cleanText(turn.displayedQuestionId || ''),
    displayedQuestionField: cleanText(turn.displayedQuestionField || ''),
    answeringQuestion: cleanText(turn.answeringQuestion || ''),
    answeringQuestionId: cleanText(turn.answeringQuestionId || ''),
    answeringQuestionField: cleanText(turn.answeringQuestionField || '')
  }));
}

function activeQuestionContextForTurn(input = {}, existingDraft = {}) {
  const eventType = cleanText(input.eventType || existingDraft.currentEventType || '');
  const visible = visibleQuestionContextFromHistory(input.history);
  const explicitQuestion = cleanText(input.activeQuestion);
  const explicit = {
    question: explicitQuestion,
    id: cleanText(input.activeQuestionId || input.questionId),
    field: cleanText(input.activeQuestionField || input.questionField)
  };
  const existing = {
    question: cleanText(existingDraft.activeQuestion || (Array.isArray(existingDraft.questions) ? existingDraft.questions[0] : '')),
    id: cleanText(existingDraft.activeQuestionId),
    field: cleanText(existingDraft.activeQuestionField)
  };
  if (eventType === 'user_answer' && visible.question) return visible;
  if (explicit.question || explicit.id || explicit.field) return explicit;
  if (existing.question || existing.id || existing.field) return existing;
  return visible;
}

function isRunRequest(input = {}, message = '', conversationPlan = null) {
  return Boolean(!conversationPlan?.smartIntakeUnavailable && (
    input.forceRun
    || conversationPlan?.shouldRunCouncil
    || /\b(run it|run council|re[- ]?run|rerun|execute|submit|assess now|start the workflow)\b/i.test(message)
  ));
}

function hasCompletedCouncilRun(draft = {}) {
  return Boolean(
    draft.lastCouncilRun
    || draft.councilStatus === 'current'
    || draft.councilStatus === 'superseded_pending_rerun'
    || draft.councilStatus === 'pending_update_clarification'
  );
}

function amendmentKey(amendment = {}) {
  return [
    amendment.field,
    amendment.updateType,
    amendment.value
  ].map((item) => cleanText(item).toLowerCase()).join('|');
}

function appendUniqueRecords(existing = [], next = [], limit = 24) {
  const byKey = new Map();
  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(next) ? next : [])].forEach((item) => {
    if (!item || typeof item !== 'object') return;
    byKey.set(amendmentKey(item) || JSON.stringify(item), item);
  });
  return Array.from(byKey.values()).slice(-limit);
}

function listAdditions(existingValue = '', nextValue = '') {
  const current = new Set(cleanText(existingValue).replace(/\s+\band\b\s+/gi, ',').split(',').map((item) => cleanText(item).toLowerCase()).filter(Boolean));
  return cleanText(nextValue)
    .replace(/\s+\band\b\s+/gi, ',')
    .split(',')
    .map(cleanText)
    .filter((item) => item && !current.has(item.toLowerCase()));
}

function resolvePendingCaseUpdate(existingDraft = {}, message = '') {
  const pending = existingDraft.pendingCaseUpdateClarification;
  if (!pending || typeof pending !== 'object') return null;
  const clean = cleanText(message);
  if (/\b(cancel|ignore|do not|don't|dont|no)\b/i.test(clean)) {
    return { action: 'cancel', pending };
  }
  const updateMode = /\b(replace|instead|change|overwrite|only)\b/i.test(clean)
    ? 'replace'
    : /\b(add|also|as well|in addition|include|yes|correct|confirm|confirmed)\b/i.test(clean)
      ? 'add'
      : '';
  if (!updateMode) return null;
  const extracted = { updateMode };
  if (pending.field === 'geography') {
    extracted.geography = pending.value;
    if (Array.isArray(pending.sanctionsSensitiveGeographies)) {
      extracted.sanctionsSensitiveGeographies = pending.sanctionsSensitiveGeographies;
      extracted.riskSignals = pending.sanctionsSensitiveGeographies.length ? ['sanctions-sensitive geography'] : [];
    }
  }
  if (pending.field === 'ai_usage_scope') {
    extracted.aiUsageScope = pending.value;
  }
  return { action: 'apply', pending, extracted };
}

function pendingPostCouncilUpdateClarification(existingDraft = {}, extracted = {}, message = '', requestedRun = false) {
  if (requestedRun || !hasCompletedCouncilRun(existingDraft)) return null;
  if (cleanText(extracted.updateMode) !== 'unspecified') return null;
  if (cleanText(existingDraft.geography) && cleanText(extracted.geography)) {
    const additions = listAdditions(existingDraft.geography, extracted.geography);
    if (additions.length) {
      return {
        field: 'geography',
        value: extracted.geography,
        currentValue: existingDraft.geography,
        sanctionsSensitiveGeographies: extracted.sanctionsSensitiveGeographies || [],
        question: `Should I add ${additions.join(' and ')} to the existing geography (${existingDraft.geography}), or replace the existing geography with ${extracted.geography}?`,
        reason: 'The previous council result already used a geography. I need to know whether this is an additional deployment location or a replacement before rerunning.'
      };
    }
  }
  if (
    existingDraft.aiUsageScope
    && typeof existingDraft.aiUsageScope === 'object'
    && extracted.aiUsageScope
    && typeof extracted.aiUsageScope === 'object'
  ) {
    return {
      field: 'ai_usage_scope',
      value: extracted.aiUsageScope,
      currentValue: JSON.stringify(existingDraft.aiUsageScope),
      question: 'Should I add this AI-use scope to the existing scope, or replace the previous AI-use boundary with this new answer?',
      reason: 'The previous council result already used an AI-use boundary. I need to know whether this is an added scope or a replacement before rerunning.'
    };
  }
  return null;
}

function suppressPendingClarificationFields(extracted = {}, pending = null) {
  if (!pending) return extracted;
  const next = { ...extracted };
  next.brief = '';
  next.intakeAssessment = null;
  if (pending.field === 'geography') {
    next.geography = '';
    next.sanctionsSensitiveGeographies = [];
    next.riskSignals = (next.riskSignals || []).filter((signal) => !/sanctions-sensitive geography/i.test(signal));
  }
  if (pending.field === 'ai_usage_scope') {
    next.aiUsageScope = null;
  }
  return next;
}

function materialAmendments(existingDraft = {}, extracted = {}, draft = {}, message = '') {
  if (!hasCompletedCouncilRun(existingDraft)) return [];
  const changes = [];
  const source = cleanText(message).slice(0, 240);
  const updateType = cleanText(extracted.updateMode) === 'replace' ? 'replacement' : 'addition';
  if (cleanText(extracted.geography)) {
    const added = updateType === 'replacement'
      ? [cleanText(extracted.geography)]
      : listAdditions(existingDraft.geography, extracted.geography);
    if (added.length || updateType === 'replacement') {
      changes.push({
        field: 'geography',
        previousValue: cleanText(existingDraft.geography),
        value: cleanText(draft.geography || extracted.geography),
        updateType,
        materiality: (extracted.sanctionsSensitiveGeographies || []).length ? 'critical' : 'high',
        reason: (extracted.sanctionsSensitiveGeographies || []).length
          ? 'A sanctions-sensitive deployment geography was added or changed after the prior council run.'
          : 'The operating geography changed after the prior council run.',
        source
      });
    }
  }
  if (cleanText(extracted.exportOriginJurisdiction) && cleanText(extracted.exportOriginJurisdiction) !== cleanText(existingDraft.exportOriginJurisdiction)) {
    changes.push({
      field: 'export_origin_jurisdiction',
      previousValue: cleanText(existingDraft.exportOriginJurisdiction),
      value: cleanText(extracted.exportOriginJurisdiction),
      updateType,
      materiality: 'high',
      reason: 'Export-control origin changed after the prior council run.',
      source
    });
  }
  if (extracted.aiUsageScope && Object.keys(extracted.aiUsageScope).length) {
    changes.push({
      field: 'ai_usage_scope',
      previousValue: existingDraft.aiUsageScope ? JSON.stringify(existingDraft.aiUsageScope) : '',
      value: JSON.stringify(extracted.aiUsageScope),
      updateType,
      materiality: extracted.aiUsageScope.highRiskWorkflowMentioned || extracted.aiUsageScope.externalUsers ? 'high' : 'medium',
      reason: 'AI use scope changed after the prior council run.',
      source
    });
  }
  if (Array.isArray(extracted.dataCategories) && extracted.dataCategories.length) {
    changes.push({
      field: 'data_categories',
      previousValue: (existingDraft.dataCategories || []).join(', '),
      value: extracted.dataCategories.join(', '),
      updateType,
      materiality: /sensitive|personal|confidential/i.test(extracted.dataCategories.join(' ')) ? 'high' : 'medium',
      reason: 'Data categories were clarified after the prior council run.',
      source
    });
  }
  return changes;
}

function markDraftWithAmendments(draft = {}, existingDraft = {}, amendments = [], requestedRun = false) {
  if (!amendments.length) return draft;
  draft.caseAmendments = appendUniqueRecords(existingDraft.caseAmendments, amendments, 32);
  draft.materialChanges = appendUniqueRecords(existingDraft.materialChanges, amendments.filter((item) => ['high', 'critical'].includes(item.materiality)), 32);
  draft.rerunRecommended = !requestedRun;
  draft.councilStatus = requestedRun ? 'rerun_requested' : 'superseded_pending_rerun';
  draft.councilStaleReason = amendments[0].reason;
  return draft;
}

function summarizeCouncilRunForDraft(run = {}, existingDraft = {}) {
  if (!run || typeof run !== 'object') return null;
  return {
    ok: Boolean(run.ok),
    runId: cleanText(run.runId || run.id || ''),
    decision: cleanText(run.decision?.decision || run.decision?.recommendation || run.output?.decision || ''),
    riskLevel: cleanText(run.decision?.riskLevel || run.output?.risk_level || ''),
    completedAt: cleanText(run.completedAt || run.timestamp || new Date().toISOString()),
    caseVersion: Number(existingDraft.caseVersion || 0) + 1,
    evidenceCount: Number((run.evidenceIds || []).length || (run.citations || []).length || 0),
    amendmentCount: Number((existingDraft.caseAmendments || []).length || 0)
  };
}

function processConversation(input = {}, options = {}) {
  const skipRun = Boolean(options.planOnly || options.skipRun);
  const runWithRuntime = typeof options.runAgentWithRuntime === 'function' ? options.runAgentWithRuntime : runAgentWithRuntime;
  const message = cleanText(input.message || input.prompt || '');
  const existingDraft = input.caseDraft && typeof input.caseDraft === 'object' ? input.caseDraft : {};
  const llmAssessment = input.llmAssessment && typeof input.llmAssessment === 'object' ? input.llmAssessment : null;
  const intent = detectIntent(message);
  let conversationPlan = input.conversationPlan && typeof input.conversationPlan === 'object' ? input.conversationPlan : null;
  const requestedRunByMessage = isRunRequest(input, message, conversationPlan);
  const activeQuestionContext = activeQuestionContextForTurn(input, existingDraft);
  const activeQuestion = cleanText(activeQuestionContext.question);
  const extractionDraft = {
    ...existingDraft,
    conversationHistory: conversationHistoryForDraft(input, existingDraft),
    activeQuestion,
    activeQuestionId: cleanText(activeQuestionContext.id),
    activeQuestionField: cleanText(activeQuestionContext.field),
    questions: activeQuestion ? [activeQuestion] : Array.isArray(existingDraft.questions) ? existingDraft.questions : []
  };
  const evidenceUploadEvent = isEvidenceUploadEvent(input, existingDraft);
  const pendingResolution = evidenceUploadEvent ? null : resolvePendingCaseUpdate(existingDraft, message);
  let extracted = extractCaseFields(message, extractionDraft);
  if (evidenceUploadEvent) extracted = stripEvidenceUploadTransportExtraction(extracted);
  if (pendingResolution?.action === 'apply') {
    extracted = {
      ...extracted,
      ...pendingResolution.extracted,
      riskSignals: unique([...(extracted.riskSignals || []), ...(pendingResolution.extracted.riskSignals || [])]),
      sanctionsSensitiveGeographies: unique([...(extracted.sanctionsSensitiveGeographies || []), ...(pendingResolution.extracted.sanctionsSensitiveGeographies || [])])
    };
  }
  const pendingUpdateClarification = pendingResolution ? null : pendingPostCouncilUpdateClarification(existingDraft, extracted, message, requestedRunByMessage);
  if (pendingUpdateClarification) {
    extracted = suppressPendingClarificationFields(extracted, pendingUpdateClarification);
  }
  const answerValidation = evidenceUploadEvent
    ? { status: 'not_applicable', field: '', question: '', message: '' }
    : pendingUpdateClarification
    ? { status: 'needs_update_clarification', field: pendingUpdateClarification.field, question: pendingUpdateClarification.question, message: pendingUpdateClarification.reason }
    : validateActiveQuestionAnswer(message, extractionDraft, extracted);
  const extractedUsefulContext = extractedHasUsefulContext(extracted);
  const fieldClarification = Array.isArray(extracted.fieldClarifications) ? extracted.fieldClarifications[0] : null;
  const clarificationOnly = answerValidation.status === 'needs_clarification' && !extractedUsefulContext;
  const draft = preserveAiDraftWhereDeterministicIsGeneric(
    extractionDraft,
    extracted,
    clarificationOnly
      ? mergeDraft(extractionDraft, {})
      : mergeDraft(extractionDraft, extracted),
    Boolean(llmAssessment?.used || conversationPlan?.usedLlm || existingDraft.llmIntake?.used)
  );
  if (fieldClarification) {
    draft.answerValidation = {
      status: 'needs_confirmation',
      field: fieldClarification.field,
      question: `Did you mean ${fieldClarification.suggestion} as the accountable owner?`,
      rawValue: fieldClarification.rawValue,
      suggestion: fieldClarification.suggestion,
      message: 'The latest reply looks like it may contain a spelling mistake.'
    };
  } else if (clarificationOnly) {
    draft.answerValidation = answerValidation;
  } else if (pendingUpdateClarification) {
    draft.answerValidation = answerValidation;
    draft.pendingCaseUpdateClarification = pendingUpdateClarification;
    draft.councilStatus = 'pending_update_clarification';
    draft.rerunRecommended = false;
    draft.councilStaleReason = pendingUpdateClarification.reason;
  } else if (pendingResolution?.action === 'cancel') {
    draft.pendingCaseUpdateClarification = null;
    draft.answerValidation = {
      status: 'not_applicable',
      field: '',
      question: '',
      message: 'The pending case update was cancelled.'
    };
  }
  if (!pendingUpdateClarification && pendingResolution?.action === 'apply') draft.pendingCaseUpdateClarification = null;
  const amendments = pendingUpdateClarification || pendingResolution?.action === 'cancel'
    ? []
    : materialAmendments(existingDraft, extracted, draft, message);
  markDraftWithAmendments(draft, existingDraft, amendments, requestedRunByMessage);
  if (conversationPlan) draft.conversationPlan = conversationPlan;
  const requestProfile = requestProfileForDraft(draft);
  const missing = missingFields(draft);
  const executionBlockers = executionBlockersForMissing(missing);
  const runReadiness = runReadinessForDraft(draft, missing);
  let questions = fieldClarification
    ? [draft.answerValidation.question]
    : clarificationOnly
    ? [answerValidation.question].filter(Boolean)
    : filterRepeatedQuestions(questionsForDraft(draft, missing), draft, extracted);
  if (
    conversationPlan?.nextQuestion
    && !questions.some((question) => normalizeQuestion(question) === normalizeQuestion(conversationPlan.nextQuestion))
  ) {
    conversationPlan = {
      ...conversationPlan,
      nextQuestion: '',
      nextBestQuestion: '',
      naturalResponse: ''
    };
    draft.conversationPlan = conversationPlan;
  }
  if (conversationPlan?.smartIntakeUnavailable) {
    questions = [];
    draft.smartIntakeUnavailable = true;
  }
  if (conversationPlan?.smartIntakeDegraded) {
    draft.smartIntakeDegraded = true;
  }
  draft.questions = questions;
  draft.activeQuestion = questions[0] || '';
  draft.questionMetadata = questions.map((question) => questionMetadataForQuestion(question)).filter(Boolean);
  draft.activeQuestionId = draft.questionMetadata[0]?.id || '';
  draft.activeQuestionField = draft.questionMetadata[0]?.field || '';
  draft.currentEventType = cleanText(input.eventType || draft.currentEventType || '');
  draft.askedQuestions = unique([...(draft.askedQuestions || []), ...questions]).slice(-24);
  const suppliedEvidenceMatches = Array.isArray(draft.retrievalContext?.evidenceMatches)
    ? draft.retrievalContext.evidenceMatches
    : [];
  const retrievalCandidates = suppliedEvidenceMatches.length
    ? suppliedEvidenceMatches
    : Array.isArray(draft.retrievalContext?.matches) ? draft.retrievalContext.matches : [];
  const retrievalMatches = retrievalCandidates.filter(isUsableRetrievalEvidenceDocument);
  if (draft.retrievalContext && typeof draft.retrievalContext === 'object') {
    draft.retrievalContext = {
      ...draft.retrievalContext,
      candidateMatchCount: retrievalCandidates.length,
      matchCount: retrievalMatches.length,
      evidenceMatches: retrievalMatches
    };
  }
  const similarCases = Array.isArray(draft.retrievalContext?.similarCases) ? draft.retrievalContext.similarCases : [];
  const governanceReferences = Array.isArray(draft.retrievalContext?.governanceReferences) ? draft.retrievalContext.governanceReferences : [];
  const forceRun = isRunRequest(input, message, conversationPlan);
  const shouldRun = executionBlockers.length === 0 && (forceRun || intent === 'run_or_assess');
  const actions = [
    {
      id: 'conversation_planner',
      status: conversationPlan?.usedLlm ? 'complete' : conversationPlan?.smartIntakeUnavailable ? 'not_available' : conversationPlan ? 'fallback' : 'not_requested',
      detail: conversationPlan?.usedLlm
        ? `Compass planner selected ${conversationPlan.nextBestAction || 'next action'} with ${Math.round(Number(conversationPlan.confidence || 0) * 100)}% confidence after retrieval.${llmAttemptSummary(llmAssessment)}`
        : conversationPlan?.userMessage || conversationPlan?.fallbackReason || 'Conversation planner used deterministic fallback.'
    },
    {
      id: 'llm_intake_assessment',
      status: llmAssessment?.used ? 'complete' : llmAssessment?.smartIntakeDegraded ? 'degraded' : llmAssessment ? 'not_available' : 'not_requested',
      detail: llmAssessment?.used
        ? `Compass assessed the chat turn as ${llmAssessment.intent || 'unknown'} / ${llmAssessment.requestType || requestProfile.requestType || 'unknown'} / ${llmAssessment.conversationStage || requestProfile.conversationStage || 'unknown'} with ${Math.round(Number(llmAssessment.confidence || 0) * 100)}% confidence.${llmAttemptSummary(llmAssessment)}`
        : `${llmAssessment?.reason || 'Compass chat assessment was not requested for this turn.'}${llmAttemptSummary(llmAssessment)}`
    },
    { id: 'conversation_state', status: 'complete', detail: 'Updated the canonical case draft, known gaps, and current phase from the chat turn.' },
    { id: 'conversation_policy', status: conversationPlan?.smartIntakeUnavailable ? 'blocked' : questions.length ? 'complete' : 'not_required', detail: conversationPlan?.smartIntakeUnavailable ? 'Smart intake is blocked until Compass gateway credentials are configured.' : questions.length ? 'Applied repeat-question and unknown-answer guardrails before selecting the next question.' : 'No clarification required before agent execution.' },
    {
      id: 'evidence_retrieval',
      status: retrievalMatches.length ? 'complete' : draft.indexedEvidence?.chunkCount ? 'queued' : 'not_required',
      detail: retrievalMatches.length
        ? `Retrieved ${retrievalMatches.length} semantic evidence match${retrievalMatches.length === 1 ? '' : 'es'} for council review.`
        : draft.indexedEvidence?.chunkCount
          ? 'Evidence index is available; retrieval will run before council execution.'
          : 'No indexed evidence is available for semantic retrieval.'
    },
    {
      id: 'learning_memory',
      status: similarCases.length || draft.retrievalContext?.learningSuggestions ? 'complete' : 'not_required',
      detail: similarCases.length
        ? `Retrieved ${similarCases.length} governed learning precedent${similarCases.length === 1 ? '' : 's'} as advisory context.`
        : 'No governed learning precedents were retrieved for this turn.'
    },
    {
      id: 'governance_reference',
      status: governanceReferences.length ? 'complete' : draft.retrievalContext?.governanceReferenceError ? 'not_available' : 'not_required',
      detail: governanceReferences.length
        ? `Retrieved ${governanceReferences.length} sanitized governance reference match${governanceReferences.length === 1 ? '' : 'es'} as advisory context.`
        : draft.retrievalContext?.governanceReferenceError || 'No governance reference context was retrieved for this turn.'
    }
  ];

  let run = null;
  if (shouldRun && !skipRun) {
    run = runWithRuntime(casePayloadFromDraft(draft), { runtime: options.runtime || input.runtime });
    actions.push({ id: 'agent_workflow', status: run.ok ? 'complete' : 'blocked', detail: 'Executed the CrewAI-routed compliance agent workflow.' });
    if (run.ok) {
      draft.lastCouncilRun = summarizeCouncilRunForDraft(run, draft);
      draft.caseVersion = draft.lastCouncilRun.caseVersion;
      draft.councilStatus = 'current';
      draft.councilStaleReason = '';
      draft.rerunRecommended = false;
      draft.pendingCaseUpdateClarification = null;
    }
  } else if (shouldRun) {
    actions.push({ id: 'agent_workflow', status: 'waiting', detail: 'Waiting for caller-managed council execution.' });
  } else {
    actions.push({ id: 'agent_workflow', status: 'waiting', detail: 'Waiting for required context before execution.' });
  }

  return {
    ok: true,
    mode: 'conversation_nlp',
    reply: composeReply({ intent, draft, missing, questions, run, executionBlockers, currentKnownGaps: extracted.knownGaps || [], conversationPlan, llmAssessment }),
    conversationPlan,
    caseDraft: draft,
    missingFields: missing,
    questions,
    questionMetadata: draft.questionMetadata,
    readyToRun: runReadiness.runnable,
    shouldRun,
    runReadiness,
    actions,
    run,
    nlp: {
      parser: 'conversation_state_policy_renderer_v2',
      intent,
      extracted: {
        supplierName: extracted.supplierName,
        businessUnit: extracted.businessUnit,
        geography: extracted.geography,
        dataCategories: extracted.dataCategories,
        updateMode: extracted.updateMode,
        integrations: extracted.integrations,
        evidenceSignals: extracted.evidenceSignals,
        riskSignals: extracted.riskSignals
      },
      requestProfile,
      retrieval: {
        indexedChunks: draft.indexedEvidence?.chunkCount || 0,
        matches: retrievalMatches.length,
        governanceReferences: governanceReferences.length,
        similarCases: similarCases.length,
        learningSuggestions: draft.retrievalContext?.learningSuggestions?.sourceMemoryIds?.length || 0,
        model: draft.retrievalContext?.model || draft.retrievalContext?.governanceReferenceModel || draft.indexedEvidence?.model || ''
      },
      confidence: Number(Math.min(0.95, 0.35 + (draft.riskSignals?.length || 0) * 0.12 + (draft.evidenceSignals?.length || 0) * 0.08).toFixed(2)),
      llmAssessment: llmAssessment ? {
        provider: llmAssessment.provider || 'compass_gateway',
        model: llmAssessment.model || '',
        used: Boolean(llmAssessment.used),
        advisoryOnly: llmAssessment.advisoryOnly !== false,
        intent: llmAssessment.intent || '',
        requestType: llmAssessment.requestType || '',
        workflowType: llmAssessment.workflowType || '',
        documentTypes: llmAssessment.documentTypes || [],
        reviewTarget: llmAssessment.reviewTarget || '',
        reviewScope: llmAssessment.reviewScope || '',
        recommendedFirstAction: llmAssessment.recommendedFirstAction || '',
        conversationStage: llmAssessment.conversationStage || '',
        suggestedWorkflowSteps: llmAssessment.suggestedWorkflowSteps || [],
        assistantSummary: llmAssessment.assistantSummary || '',
        naturalResponse: llmAssessment.naturalResponse || '',
        structuredFallbackUsed: Boolean(llmAssessment.structuredFallbackUsed),
        confidence: Number(llmAssessment.confidence || 0),
        reason: llmAssessment.reason || '',
        detail: llmAssessment.detail || '',
        attempts: Array.isArray(llmAssessment.attempts) ? llmAssessment.attempts : [],
        attemptCount: Number(llmAssessment.attemptCount || 0),
        maxAttempts: Number(llmAssessment.maxAttempts || 0),
        retried: Boolean(llmAssessment.retried),
        requiresCompass: Boolean(llmAssessment.requiresCompass),
        smartIntakeUnavailable: Boolean(llmAssessment.smartIntakeUnavailable),
        smartIntakeDegraded: Boolean(llmAssessment.smartIntakeDegraded),
        invalidCompassResponse: Boolean(llmAssessment.invalidCompassResponse),
        compassFailureType: llmAssessment.compassFailureType || '',
        userMessage: llmAssessment.userMessage || '',
        nextBestQuestion: llmAssessment.nextBestQuestion || '',
        error: Boolean(llmAssessment.error)
      } : null
    }
  };
}

module.exports = {
  casePayloadFromDraft,
  detectIntent,
  evidenceChecklist,
  executionBlockersForMissing,
  extractCaseFields,
  mergeDraft,
  missingFields,
  processConversation,
  questionsForDraft,
  runReadinessForDraft
};
