'use strict';

const { isFeatureEnabled } = require('./adminFeatureFlags');
const { chatCompletion, gatewayToken, LLM_MODEL } = require('./compassGatewayClient');

const ALLOWED_INTENTS = new Set([
  'case_context',
  'owner_answer',
  'geography_answer',
  'evidence_answer',
  'run_request',
  'question',
  'unknown'
]);

const ALLOWED_REQUEST_TYPES = new Set([
  'document_review',
  'contract_review',
  'msa_review',
  'dpa_review',
  'clause_review',
  'vendor_onboarding',
  'supplier_risk',
  'payroll_outsourcing',
  'export_control',
  'policy_review',
  'evidence_question',
  'general_compliance',
  'unknown'
]);

const ALLOWED_FIRST_ACTIONS = new Set([
  'upload_document',
  'paste_clause',
  'ask_owner',
  'ask_geography',
  'ask_evidence',
  'ask_scope',
  'run_council',
  'answer_question',
  'unknown'
]);

const ALLOWED_CONVERSATION_STAGES = new Set([
  'understanding_request',
  'awaiting_document',
  'document_uploaded',
  'analyzing_evidence',
  'asking_clarification',
  'ready_for_council',
  'council_complete',
  'unknown'
]);

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampText(value = '', maxLength = 240) {
  return cleanText(value).slice(0, maxLength);
}

function unique(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function safeArray(value = [], limit = 10, maxItemLength = 80) {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => clampText(item, maxItemLength))).slice(0, limit);
}

function parseJsonContent(content = '') {
  const text = cleanText(content);
  if (!text) throw new Error('Empty LLM assessment response.');
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return JSON.parse(fenced);
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1));
    throw new Error('LLM assessment response was not valid JSON.');
  }
}

function normalizeAssessment(raw = {}) {
  const caseUpdate = raw.caseUpdate && typeof raw.caseUpdate === 'object' ? raw.caseUpdate : {};
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence || 0)));
  const intent = ALLOWED_INTENTS.has(cleanText(raw.intent)) ? cleanText(raw.intent) : 'unknown';
  const rawRequestType = cleanText(raw.requestType || caseUpdate.requestType);
  const rawFirstAction = cleanText(raw.recommendedFirstAction || caseUpdate.recommendedFirstAction);
  const rawStage = cleanText(raw.conversationStage || caseUpdate.conversationStage);
  const requestType = ALLOWED_REQUEST_TYPES.has(rawRequestType) ? rawRequestType : 'unknown';
  const recommendedFirstAction = ALLOWED_FIRST_ACTIONS.has(rawFirstAction) ? rawFirstAction : 'unknown';
  const conversationStage = ALLOWED_CONVERSATION_STAGES.has(rawStage) ? rawStage : 'unknown';
  return {
    ok: true,
    provider: 'compass_gateway',
    model: cleanText(raw.model) || process.env.CONVERSATION_LLM_MODEL || process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    used: true,
    advisoryOnly: true,
    intent,
    requestType,
    reviewTarget: clampText(raw.reviewTarget || caseUpdate.reviewTarget, 120),
    reviewScope: clampText(raw.reviewScope || caseUpdate.reviewScope, 180),
    recommendedFirstAction,
    conversationStage,
    confidence: Number(confidence.toFixed(2)),
    reason: clampText(raw.reason, 240),
    nextBestQuestion: clampText(raw.nextBestQuestion, 220),
    assistantSummary: clampText(raw.assistantSummary, 260),
    caseUpdate: {
      supplierName: clampText(caseUpdate.supplierName, 120),
      businessUnit: clampText(caseUpdate.businessUnit, 120),
      geography: clampText(caseUpdate.geography, 160),
      companyLocation: clampText(caseUpdate.companyLocation, 120),
      supplierLocation: clampText(caseUpdate.supplierLocation, 120),
      dataOrAssets: safeArray(caseUpdate.dataOrAssets, 8, 80),
      integrations: safeArray(caseUpdate.integrations, 8, 80),
      evidenceSignals: safeArray(caseUpdate.evidenceSignals, 10, 80),
      riskSignals: safeArray(caseUpdate.riskSignals, 10, 80),
      knownGaps: safeArray(caseUpdate.knownGaps, 8, 80)
    }
  };
}

function summarizeDraftForPrompt(draft = {}) {
  return {
    supplierName: cleanText(draft.supplierName),
    businessUnit: cleanText(draft.businessUnit),
    geography: cleanText(draft.geography),
    brief: clampText(draft.brief, 1000),
    llmIntake: draft.llmIntake
      ? {
          intent: cleanText(draft.llmIntake.intent),
          requestType: cleanText(draft.llmIntake.requestType),
          reviewTarget: cleanText(draft.llmIntake.reviewTarget),
          reviewScope: cleanText(draft.llmIntake.reviewScope),
          recommendedFirstAction: cleanText(draft.llmIntake.recommendedFirstAction),
          conversationStage: cleanText(draft.llmIntake.conversationStage)
        }
      : null,
    integrations: safeArray(draft.integrations, 12, 80),
    evidenceSignals: safeArray(draft.evidenceSignals, 12, 80),
    riskSignals: safeArray(draft.riskSignals, 12, 80),
    knownGaps: safeArray(draft.knownGaps, 12, 80),
    previousQuestions: safeArray(draft.questions || draft.askedQuestions, 6, 220),
    indexedEvidence: draft.indexedEvidence
      ? {
          model: cleanText(draft.indexedEvidence.model),
          chunkCount: Number(draft.indexedEvidence.chunkCount || 0)
        }
      : null,
    retrievalContext: draft.retrievalContext
      ? {
          evidenceMatches: Number((draft.retrievalContext.evidenceMatches || draft.retrievalContext.matches || []).length || 0),
          governanceReferences: Number((draft.retrievalContext.governanceReferences || []).length || 0),
          governanceReferenceHeadings: safeArray((draft.retrievalContext.governanceReferences || []).map((reference) => reference.heading || reference.section), 5, 90),
          similarCases: Number((draft.retrievalContext.similarCases || []).length || 0),
          missingEvidenceSignals: safeArray(draft.retrievalContext.missingEvidenceSignals, 8, 80)
        }
      : null
  };
}

function mergeAssessmentIntoDraft(draft = {}, assessment = {}) {
  const update = assessment.caseUpdate || {};
  const confidence = Number(assessment.confidence || 0);
  if (!assessment.used || confidence < Number(process.env.CONVERSATION_LLM_MIN_CONFIDENCE || 0.35)) {
    return draft;
  }
  const nextDraft = { ...draft };
  const fill = (key, value) => {
    const clean = cleanText(value);
    if (clean) nextDraft[key] = clean;
  };

  fill('supplierName', update.supplierName);
  fill('businessUnit', update.businessUnit);
  fill('geography', update.geography);

  const riskSignals = unique([...(draft.riskSignals || []), ...(update.riskSignals || [])]);
  const dataAssets = unique(update.dataOrAssets || []);
  const evidenceSignals = unique([...(draft.evidenceSignals || []), ...(update.evidenceSignals || [])]);
  const knownGaps = unique([...(draft.knownGaps || []), ...(update.knownGaps || [])]);
  const integrations = unique([...(draft.integrations || []), ...(update.integrations || [])]);

  if (dataAssets.length) {
    if (dataAssets.some((item) => /personal|employee|payroll|patient|customer|pii/i.test(item)) && !riskSignals.includes('personal data')) {
      riskSignals.push('personal data');
    }
    if (dataAssets.some((item) => /salary|payroll|compensation|invoice|payment|financial/i.test(item)) && !riskSignals.includes('finance exposure')) {
      riskSignals.push('finance exposure');
    }
  }

  nextDraft.integrations = integrations.slice(0, 12);
  nextDraft.evidenceSignals = evidenceSignals.slice(0, 18);
  nextDraft.riskSignals = riskSignals.slice(0, 18);
  nextDraft.knownGaps = knownGaps.slice(0, 18);
  nextDraft.llmIntake = {
    provider: assessment.provider,
    model: assessment.model,
    advisoryOnly: true,
    used: true,
    confidence: assessment.confidence,
    intent: assessment.intent,
    requestType: assessment.requestType,
    reviewTarget: assessment.reviewTarget,
    reviewScope: assessment.reviewScope,
    recommendedFirstAction: assessment.recommendedFirstAction,
    conversationStage: assessment.conversationStage,
    reason: assessment.reason,
    nextBestQuestion: assessment.nextBestQuestion,
    assistantSummary: assessment.assistantSummary,
    assessedAt: new Date().toISOString()
  };
  return nextDraft;
}

function unavailableAssessment(reason = '', extra = {}) {
  return {
    ok: false,
    provider: 'compass_gateway',
    model: process.env.CONVERSATION_LLM_MODEL || process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    used: false,
    advisoryOnly: true,
    reason: cleanText(reason),
    ...extra
  };
}

async function assessConversationWithLlm(body = {}) {
  const message = cleanText(body.message || body.prompt || '');
  const draft = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : {};
  if (!message) {
    return {
      ...body,
      llmAssessment: unavailableAssessment('No message supplied for LLM assessment.')
    };
  }
  if (!isFeatureEnabled('compassLlmCalls')) {
    return {
      ...body,
      llmAssessment: unavailableAssessment('Compass LLM calls are disabled by admin feature controls.')
    };
  }
  if (!gatewayToken()) {
    return {
      ...body,
      llmAssessment: unavailableAssessment('Compass LLM token is not configured.')
    };
  }

  try {
    const response = await chatCompletion({
      model: process.env.CONVERSATION_LLM_MODEL || process.env.CREWAI_LLM_MODEL || LLM_MODEL,
      temperature: Number(process.env.CONVERSATION_LLM_TEMPERATURE || 0),
      max_tokens: Number(process.env.CONVERSATION_LLM_MAX_TOKENS || 650),
      messages: [
        {
          role: 'system',
          content: [
            'You assess compliance intake chat turns for Parallax42.',
            'Return strict JSON only. No markdown.',
            'You are advisory only. Do not approve, reject, or make final decisions.',
            'Extract what the user actually said. Do not invent facts.',
            'If the latest user message is terse, interpret it using previousQuestions and currentDraft.',
            'Classify the ask, not just the answer. Decide whether this is a contract/MSA/DPA/clause/document review, vendor onboarding, export-control case, payroll outsourcing case, evidence question, or another compliance request.',
            'If the user wants a document or clause reviewed but has not supplied it, conversationStage must be awaiting_document and recommendedFirstAction should be upload_document or paste_clause.',
            'For document or clause review, do not ask owner/geography before the source document or clauses unless the user already supplied the source.',
            'If the user answers unknown/dont know to a document-upload request, keep awaiting_document and ask for upload/paste again in a calmer way.',
            'If currentDraft includes governanceReferences, treat them as sanitized advisory context only; they are not official policy and must not replace function-owner review.',
            'Use plain business terms that a reviewer can inspect.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({
            latestMessage: message,
            currentDraft: summarizeDraftForPrompt(draft),
            requiredSchema: {
              intent: 'case_context | owner_answer | geography_answer | evidence_answer | run_request | question | unknown',
              requestType: 'document_review | contract_review | msa_review | dpa_review | clause_review | vendor_onboarding | supplier_risk | payroll_outsourcing | export_control | policy_review | evidence_question | general_compliance | unknown',
              reviewTarget: 'document/contract/MSA/DPA/specific clauses/vendor/workflow being reviewed, if clear',
              reviewScope: 'what the user wants checked, if clear',
              recommendedFirstAction: 'upload_document | paste_clause | ask_owner | ask_geography | ask_evidence | ask_scope | run_council | answer_question | unknown',
              conversationStage: 'understanding_request | awaiting_document | document_uploaded | analyzing_evidence | asking_clarification | ready_for_council | council_complete | unknown',
              confidence: '0..1',
              reason: 'short explanation of extraction',
              assistantSummary: 'one natural sentence for the chat UI, not a decision',
              nextBestQuestion: 'one practical next question, or empty if deterministic engine should decide',
              caseUpdate: {
                supplierName: 'supplier/workflow name if stated',
                businessUnit: 'internal owner if stated',
                geography: 'company/supplier/data geography if stated',
                companyLocation: 'company location if stated',
                supplierLocation: 'supplier location if stated',
                dataOrAssets: ['regulated data/assets explicitly mentioned'],
                integrations: ['systems/platforms explicitly mentioned'],
                evidenceSignals: ['documents/proof explicitly mentioned'],
                riskSignals: ['risk themes implied by the user statement'],
                knownGaps: ['items user says are unknown, pending, missing, unavailable']
              }
            }
          })
        }
      ]
    });
    const content = response.choices?.[0]?.message?.content || response.output_text || response.raw || '';
    const parsed = parseJsonContent(content);
    const assessment = normalizeAssessment({
      ...parsed,
      model: response.model || process.env.CONVERSATION_LLM_MODEL || process.env.CREWAI_LLM_MODEL || LLM_MODEL
    });
    return {
      ...body,
      caseDraft: mergeAssessmentIntoDraft(draft, assessment),
      llmAssessment: assessment
    };
  } catch (error) {
    return {
      ...body,
      llmAssessment: unavailableAssessment(error instanceof Error ? error.message : String(error || 'LLM assessment failed.'), {
        error: true
      })
    };
  }
}

module.exports = {
  assessConversationWithLlm,
  mergeAssessmentIntoDraft,
  normalizeAssessment,
  parseJsonContent
};
