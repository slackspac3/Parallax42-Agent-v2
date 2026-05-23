'use strict';

const { runAgentWithRuntime } = require('./agentRuntime');
const {
  casePayloadFromDraft,
  cleanText,
  detectIntent,
  extractCaseFields,
  mergeDraft,
  missingFields,
  requestProfileForDraft,
  runReadinessForDraft,
  unique
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

function processConversation(input = {}, options = {}) {
  const message = cleanText(input.message || input.prompt || '');
  const existingDraft = input.caseDraft && typeof input.caseDraft === 'object' ? input.caseDraft : {};
  const llmAssessment = input.llmAssessment && typeof input.llmAssessment === 'object' ? input.llmAssessment : null;
  const intent = detectIntent(message);
  const extracted = extractCaseFields(message, existingDraft);
  const conversationPlan = input.conversationPlan && typeof input.conversationPlan === 'object' ? input.conversationPlan : null;
  const draft = preserveAiDraftWhereDeterministicIsGeneric(
    existingDraft,
    extracted,
    mergeDraft(existingDraft, extracted),
    Boolean(llmAssessment?.used || conversationPlan?.usedLlm || existingDraft.llmIntake?.used)
  );
  if (conversationPlan) draft.conversationPlan = conversationPlan;
  const requestProfile = requestProfileForDraft(draft);
  const missing = missingFields(draft);
  const executionBlockers = executionBlockersForMissing(missing);
  const runReadiness = runReadinessForDraft(draft, missing);
  let questions = filterRepeatedQuestions(questionsForDraft(draft, missing), draft, extracted);
  if (conversationPlan?.smartIntakeUnavailable) {
    questions = [];
    draft.smartIntakeUnavailable = true;
  }
  draft.questions = questions;
  draft.activeQuestion = questions[0] || '';
  draft.currentEventType = cleanText(input.eventType || draft.currentEventType || '');
  draft.askedQuestions = unique([...(draft.askedQuestions || []), ...questions]).slice(-24);
  const retrievalMatches = Array.isArray(draft.retrievalContext?.evidenceMatches)
    ? draft.retrievalContext.evidenceMatches
    : Array.isArray(draft.retrievalContext?.matches) ? draft.retrievalContext.matches : [];
  const similarCases = Array.isArray(draft.retrievalContext?.similarCases) ? draft.retrievalContext.similarCases : [];
  const governanceReferences = Array.isArray(draft.retrievalContext?.governanceReferences) ? draft.retrievalContext.governanceReferences : [];
  const forceRun = Boolean(!conversationPlan?.smartIntakeUnavailable && (input.forceRun || conversationPlan?.shouldRunCouncil || /\b(run it|execute|submit|assess now|start the workflow)\b/i.test(message)));
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
      status: llmAssessment?.used ? 'complete' : llmAssessment ? 'not_available' : 'not_requested',
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
  if (shouldRun) {
    run = runAgentWithRuntime(casePayloadFromDraft(draft), { runtime: options.runtime || input.runtime });
    actions.push({ id: 'agent_workflow', status: run.ok ? 'complete' : 'blocked', detail: 'Executed the CrewAI-routed compliance agent workflow.' });
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
    readyToRun: runReadiness.runnable,
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
        confidence: Number(llmAssessment.confidence || 0),
        reason: llmAssessment.reason || '',
        detail: llmAssessment.detail || '',
        attempts: Array.isArray(llmAssessment.attempts) ? llmAssessment.attempts : [],
        attemptCount: Number(llmAssessment.attemptCount || 0),
        maxAttempts: Number(llmAssessment.maxAttempts || 0),
        retried: Boolean(llmAssessment.retried),
        requiresCompass: Boolean(llmAssessment.requiresCompass),
        smartIntakeUnavailable: Boolean(llmAssessment.smartIntakeUnavailable),
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
