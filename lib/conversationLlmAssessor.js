'use strict';

const { chatCompletion, gatewayToken, LLM_MODEL } = require('./compassGatewayClient');
const { mergeRecentlyAnsweredFields, normalizeKnownGapField } = require('./conversationState');

const SMART_INTAKE_UNAVAILABLE_MESSAGE = 'Compass gateway is not configured — smart intake is unavailable. Contact your administrator.';
const SMART_INTAKE_INVALID_RESPONSE_MESSAGE = 'Smart intake could not get valid Compass JSON after multiple attempts. The deterministic case builder is still available, but AI intake needs administrator review.';
const DEFAULT_CONVERSATION_LLM_MAX_TOKENS = 2200;
const DEFAULT_CONVERSATION_LLM_RETRY_MAX_TOKENS = 1600;
const DEFAULT_CONVERSATION_LLM_STRUCTURED_MAX_TOKENS = 800;
const DEFAULT_CONVERSATION_LLM_NATURAL_MAX_TOKENS = 400;
const DEFAULT_CONVERSATION_LLM_MAX_ATTEMPTS = 3;
const DEFAULT_CONVERSATION_LLM_BACKOFF_BASE_MS = 600;
const RETRYABLE_LLM_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const AUTH_FAILURE_STATUSES = new Set([401, 403]);

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
  'agreement_review',
  'msa_review',
  'dpa_review',
  'saas_agreement_review',
  'software_license_review',
  'data_sharing_review',
  'clause_review',
  'vendor_onboarding',
  'supplier_risk',
  'payroll_outsourcing',
  'export_control',
  'policy_review',
  'security_assurance_review',
  'procurement_review',
  'finance_project_review',
  'hse_esg_review',
  'ai_governance_review',
  'evidence_question',
  'general_compliance',
  'unknown'
]);

const ALLOWED_WORKFLOW_TYPES = new Set([
  'document_intake_triage',
  'contract_risk_review',
  'saas_vendor_review',
  'privacy_data_protection_review',
  'security_assurance_review',
  'procurement_vendor_review',
  'export_control_review',
  'ai_governance_review',
  'business_continuity_review',
  'finance_project_review',
  'hse_esg_review',
  'supplier_risk_review',
  'general_compliance_review',
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

function normalizeConversationHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .map((turn = {}) => ({
      role: /^(assistant|user)$/i.test(cleanText(turn.role)) ? cleanText(turn.role).toLowerCase() : '',
      text: clampText(turn.text || turn.content || turn.message, 500),
      displayedQuestion: clampText(turn.displayedQuestion, 220),
      answeringQuestion: clampText(turn.answeringQuestion, 220)
    }))
    .filter((turn) => turn.role && turn.text)
    .slice(-12);
}

function parseJsonContent(content = '') {
  if (content && typeof content === 'object') return content;
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

function isJsonParseFailure(error = {}) {
  const detail = cleanText(error instanceof Error ? error.message : String(error || ''));
  return /not valid JSON|Empty LLM assessment response|Unexpected token|Unexpected end|JSON/i.test(detail)
    || error.code === 'LLM_ASSESSMENT_INVALID_JSON';
}

function llmMaxAttempts() {
  const configured = Number(process.env.CONVERSATION_LLM_MAX_ATTEMPTS || DEFAULT_CONVERSATION_LLM_MAX_ATTEMPTS);
  if (!Number.isFinite(configured)) return DEFAULT_CONVERSATION_LLM_MAX_ATTEMPTS;
  return Math.max(1, Math.min(5, Math.round(configured)));
}

function structuredMaxTokens(compact = false) {
  const configured = Number(process.env.CONVERSATION_LLM_STRUCTURED_MAX_TOKENS);
  if (Number.isFinite(configured) && configured > 0) return Math.round(configured);
  return Math.min(
    DEFAULT_CONVERSATION_LLM_STRUCTURED_MAX_TOKENS,
    compact ? DEFAULT_CONVERSATION_LLM_RETRY_MAX_TOKENS : DEFAULT_CONVERSATION_LLM_MAX_TOKENS
  );
}

function naturalResponseMaxTokens() {
  const configured = Number(process.env.CONVERSATION_LLM_NATURAL_MAX_TOKENS);
  if (Number.isFinite(configured) && configured > 0) return Math.round(configured);
  return DEFAULT_CONVERSATION_LLM_NATURAL_MAX_TOKENS;
}

function retryBackoffBaseMs() {
  const configured = Number(process.env.CONVERSATION_LLM_BACKOFF_BASE_MS || DEFAULT_CONVERSATION_LLM_BACKOFF_BASE_MS);
  if (!Number.isFinite(configured) || configured < 0) return DEFAULT_CONVERSATION_LLM_BACKOFF_BASE_MS;
  return Math.round(configured);
}

function sleep(ms = 0) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorStatus(error = {}) {
  return Number(error?.status || error?.body?.status || 0);
}

function errorDetail(error = {}) {
  if (error instanceof Error) return cleanText(error.message);
  if (typeof error === 'string') return cleanText(error);
  return cleanText(error?.message || error?.detail || error?.error || 'LLM assessment failed.');
}

function isRetryableLlmError(error = {}) {
  if (isJsonParseFailure(error)) return true;
  const status = errorStatus(error);
  if (AUTH_FAILURE_STATUSES.has(status)) return false;
  if (RETRYABLE_LLM_STATUSES.has(status)) return true;
  const detail = errorDetail(error);
  return /fetch failed|network|timeout|timed out|temporar|rate limit|too many requests|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|bad gateway|gateway|unavailable/i.test(detail);
}

function attemptRecord({ attempt, compact, status, error }) {
  const httpStatus = errorStatus(error);
  return {
    attempt,
    prompt: compact ? 'compact_json' : 'full_context_json',
    status,
    retryable: status === 'success' ? false : isRetryableLlmError(error),
    ...(httpStatus ? { httpStatus } : {}),
    ...(error ? { detail: clampText(errorDetail(error), 180) } : {})
  };
}

function isRateLimitedAttempt(record = {}) {
  return record.status === 'rate_limited' || Number(record.httpStatus || 0) === 429;
}

function contentPartText(part = {}) {
  if (typeof part === 'string') return part;
  if (!part || typeof part !== 'object') return '';
  if (typeof part.text === 'string') return part.text;
  if (typeof part.output_text === 'string') return part.output_text;
  if (typeof part.content === 'string') return part.content;
  if (typeof part.value === 'string') return part.value;
  return '';
}

function extractChatContent(response = {}) {
  if (!response || typeof response !== 'object') return response || '';
  if (response.intent || response.requestType || response.caseUpdate) return response;
  const choices = Array.isArray(response.choices) ? response.choices : [];
  const firstChoice = choices[0] || {};
  const message = firstChoice.message || {};
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    const text = message.content.map(contentPartText).filter(Boolean).join('\n');
    if (text) return text;
  }
  if (typeof firstChoice.text === 'string') return firstChoice.text;
  if (typeof response.output_text === 'string') return response.output_text;
  if (typeof response.outputText === 'string') return response.outputText;
  if (typeof response.text === 'string') return response.text;
  if (typeof response.content === 'string') return response.content;
  if (typeof response.message === 'string') return response.message;
  if (response.message && typeof response.message.content === 'string') return response.message.content;
  if (Array.isArray(response.output)) {
    const text = response.output.flatMap((item) => {
      if (typeof item === 'string') return [item];
      if (Array.isArray(item?.content)) return item.content.map(contentPartText);
      return [contentPartText(item)];
    }).filter(Boolean).join('\n');
    if (text) return text;
  }
  if (response.result && typeof response.result === 'object') {
    if (response.result.intent || response.result.requestType || response.result.caseUpdate) return response.result;
    const nested = extractChatContent(response.result);
    if (nested) return nested;
  }
  if (response.raw && typeof response.raw === 'object') {
    const nested = extractChatContent(response.raw);
    if (nested) return nested;
  }
  if (typeof response.raw === 'string') return response.raw;
  return '';
}

function invalidResponseAssessment(extra = {}) {
  return unavailableAssessment(SMART_INTAKE_INVALID_RESPONSE_MESSAGE, {
    error: true,
    requiresCompass: false,
    smartIntakeUnavailable: true,
    invalidCompassResponse: true,
    userMessage: SMART_INTAKE_INVALID_RESPONSE_MESSAGE,
    ...extra
  });
}

function parseAssessmentResponse(response = {}) {
  const content = extractChatContent(response);
  let parsed;
  try {
    parsed = parseJsonContent(content);
  } catch (error) {
    const detail = cleanText(error instanceof Error ? error.message : String(error || 'LLM assessment response was not valid JSON.'));
    const wrapped = new Error(detail || 'LLM assessment response was not valid JSON.');
    wrapped.code = 'LLM_ASSESSMENT_INVALID_JSON';
    wrapped.rawPreview = clampText(content, 500);
    throw wrapped;
  }
  return normalizeAssessment({
    ...parsed,
    model: response.model || process.env.CONVERSATION_LLM_MODEL || process.env.CREWAI_LLM_MODEL || LLM_MODEL
  });
}

function normalizeAssessment(raw = {}) {
  const caseUpdate = raw.caseUpdate && typeof raw.caseUpdate === 'object' ? raw.caseUpdate : {};
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence || 0)));
  const intent = ALLOWED_INTENTS.has(cleanText(raw.intent)) ? cleanText(raw.intent) : 'unknown';
  const rawRequestType = cleanText(raw.requestType || caseUpdate.requestType);
  const rawWorkflowType = cleanText(raw.workflowType || caseUpdate.workflowType);
  const rawFirstAction = cleanText(raw.recommendedFirstAction || caseUpdate.recommendedFirstAction);
  const rawStage = cleanText(raw.conversationStage || caseUpdate.conversationStage);
  const requestType = ALLOWED_REQUEST_TYPES.has(rawRequestType) ? rawRequestType : 'unknown';
  const workflowType = ALLOWED_WORKFLOW_TYPES.has(rawWorkflowType) ? rawWorkflowType : 'unknown';
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
    workflowType,
    documentTypes: safeArray(raw.documentTypes || caseUpdate.documentTypes, 8, 80),
    reviewTarget: clampText(raw.reviewTarget || caseUpdate.reviewTarget, 120),
    reviewScope: clampText(raw.reviewScope || caseUpdate.reviewScope, 180),
    recommendedFirstAction,
    conversationStage,
    suggestedWorkflowSteps: safeArray(raw.suggestedWorkflowSteps || caseUpdate.suggestedWorkflowSteps, 6, 120),
    confidence: Number(confidence.toFixed(2)),
    reason: clampText(raw.reason, 240),
    nextBestQuestion: clampText(raw.nextBestQuestion, 220),
    assistantSummary: clampText(raw.assistantSummary, 260),
    naturalResponse: clampText(raw.naturalResponse, 1200),
    caseUpdate: {
      supplierName: clampText(caseUpdate.supplierName, 120),
      businessUnit: clampText(caseUpdate.businessUnit, 120),
      geography: clampText(caseUpdate.geography, 160),
      companyLocation: clampText(caseUpdate.companyLocation, 120),
      supplierLocation: clampText(caseUpdate.supplierLocation, 120),
      documentTypes: safeArray(caseUpdate.documentTypes || raw.documentTypes, 8, 80),
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
    activeQuestion: clampText(draft.activeQuestion, 220),
    currentEventType: cleanText(draft.currentEventType),
    llmIntake: draft.llmIntake
        ? {
          intent: cleanText(draft.llmIntake.intent),
          requestType: cleanText(draft.llmIntake.requestType),
          workflowType: cleanText(draft.llmIntake.workflowType),
          documentTypes: safeArray(draft.llmIntake.documentTypes, 8, 80),
          reviewTarget: cleanText(draft.llmIntake.reviewTarget),
          reviewScope: cleanText(draft.llmIntake.reviewScope),
          recommendedFirstAction: cleanText(draft.llmIntake.recommendedFirstAction),
          conversationStage: cleanText(draft.llmIntake.conversationStage),
          suggestedWorkflowSteps: safeArray(draft.llmIntake.suggestedWorkflowSteps, 6, 120)
        }
      : null,
    integrations: safeArray(draft.integrations, 12, 80),
    evidenceSignals: safeArray(draft.evidenceSignals, 12, 80),
    riskSignals: safeArray(draft.riskSignals, 12, 80),
    knownGaps: safeArray(draft.knownGaps, 12, 80),
    previousQuestions: safeArray(draft.questions || draft.askedQuestions, 6, 220),
    documents: Array.isArray(draft.documents)
      ? draft.documents.slice(-6).map((document) => ({
          title: clampText(document.title || document.fileName || document.evidenceId, 120),
          documentType: cleanText(document.documentType || document.sourceType),
          extractionStatus: cleanText(document.extractionStatus || document.indexStatus),
          summary: clampText(document.summary || document.excerpt, 420),
          signals: safeArray(document.signals, 8, 80)
        }))
      : [],
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

function recentConversationMessages(draft = {}, latestMessage = '') {
  const latest = cleanText(latestMessage);
  const history = normalizeConversationHistory(draft.conversationHistory);
  const withoutTrailingLatest = history.length
    && history.at(-1).role === 'user'
    && cleanText(history.at(-1).text) === latest
      ? history.slice(0, -1)
      : history;
  const recentLimit = latest ? 5 : 6;
  const recentTurns = withoutTrailingLatest.slice(-recentLimit).map((turn) => ({
    role: turn.role,
    content: turn.text
  }));
  return latest
    ? [...recentTurns, { role: 'user', content: latest }]
    : recentTurns;
}

function includeFullSchema(draft = {}, options = {}) {
  if (options.compact) return false;
  const attempt = Number(options.attempt || 1);
  if (attempt > 1) return false;
  const historyCount = normalizeConversationHistory(draft.conversationHistory).length;
  const messageCount = Number(draft.messageCount || historyCount || 0);
  return messageCount <= 1;
}

function assessmentContext(message = '', draft = {}, options = {}) {
  const base = {
    latestMessage: message,
    eventType: cleanText(draft.currentEventType || 'user_message'),
    activeQuestion: cleanText(draft.activeQuestion),
    currentDraft: summarizeDraftForPrompt(draft),
    recentConversationTurnCount: recentConversationMessages(draft, message).length
  };
  if (options.compact) {
    return {
      ...base,
      allowedValues: {
        intent: Array.from(ALLOWED_INTENTS),
        requestType: Array.from(ALLOWED_REQUEST_TYPES),
        workflowType: Array.from(ALLOWED_WORKFLOW_TYPES),
        recommendedFirstAction: Array.from(ALLOWED_FIRST_ACTIONS),
        conversationStage: Array.from(ALLOWED_CONVERSATION_STAGES)
      },
      requiredShape: {
        intent: 'case_context',
        requestType: 'general_compliance',
        workflowType: 'general_compliance_review',
        documentTypes: [],
        reviewTarget: '',
        reviewScope: '',
        recommendedFirstAction: 'ask_scope',
        conversationStage: 'understanding_request',
        suggestedWorkflowSteps: [],
        confidence: 0.7,
        reason: '',
        assistantSummary: '',
        nextBestQuestion: '',
        naturalResponse: '',
        caseUpdate: {
          supplierName: '',
          businessUnit: '',
          geography: '',
          companyLocation: '',
          supplierLocation: '',
          documentTypes: [],
          dataOrAssets: [],
          integrations: [],
          evidenceSignals: [],
          riskSignals: [],
          knownGaps: []
        }
      }
    };
  }
  if (!includeFullSchema(draft, options)) {
    return {
      ...base,
      responseContract: {
        format: 'Return strict JSON only, no prose and no markdown.',
        requiredKeys: [
          'intent',
          'requestType',
          'workflowType',
          'documentTypes',
          'reviewTarget',
          'reviewScope',
          'recommendedFirstAction',
          'conversationStage',
          'suggestedWorkflowSteps',
          'confidence',
          'reason',
          'assistantSummary',
          'nextBestQuestion',
          'caseUpdate'
        ],
        note: 'Use the same schema established in the first turn. Do not include naturalResponse in this structured call.'
      }
    };
  }
  return {
    ...base,
    requiredSchema: {
      intent: 'case_context | owner_answer | geography_answer | evidence_answer | run_request | question | unknown',
      requestType: 'document_review | contract_review | agreement_review | msa_review | dpa_review | saas_agreement_review | software_license_review | data_sharing_review | clause_review | vendor_onboarding | supplier_risk | payroll_outsourcing | export_control | policy_review | security_assurance_review | procurement_review | finance_project_review | hse_esg_review | ai_governance_review | evidence_question | general_compliance | unknown',
      workflowType: 'document_intake_triage | contract_risk_review | saas_vendor_review | privacy_data_protection_review | security_assurance_review | procurement_vendor_review | export_control_review | ai_governance_review | business_continuity_review | finance_project_review | hse_esg_review | supplier_risk_review | general_compliance_review | unknown',
      documentTypes: ['agreement | contract | msa | dpa | sow | saas_agreement | software_license | data_sharing_agreement | nda | purchase_order | service_agreement | soc2_report | iso_certificate | security_report | bcp_dr_plan | ai_governance_document | export_control_pack | hse_esg_document | policy_document | document'],
      reviewTarget: 'document/contract/MSA/DPA/specific clauses/vendor/workflow being reviewed, if clear',
      reviewScope: 'what the user wants checked, if clear',
      recommendedFirstAction: 'upload_document | paste_clause | ask_owner | ask_geography | ask_evidence | ask_scope | run_council | answer_question | unknown',
      conversationStage: 'understanding_request | awaiting_document | document_uploaded | analyzing_evidence | asking_clarification | ready_for_council | council_complete | unknown',
      suggestedWorkflowSteps: ['short workflow steps selected for this request/document type'],
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
        documentTypes: ['document types explicitly indicated by user or retrieval metadata'],
        dataOrAssets: ['regulated data/assets explicitly mentioned'],
        integrations: ['systems/platforms explicitly mentioned'],
        evidenceSignals: ['documents/proof explicitly mentioned'],
        riskSignals: ['risk themes implied by the user statement'],
        knownGaps: ['items user says are unknown, pending, missing, unavailable']
      }
    }
  };
}

function assessmentMessages(message = '', draft = {}, options = {}) {
  const contextMessage = {
    role: 'user',
    content: JSON.stringify(assessmentContext(message, draft, options))
  };
  const conversationMessages = recentConversationMessages(draft, message);
  if (options.compact) {
    return [
      {
        role: 'system',
        content: [
          'Return one valid minified JSON object only. No markdown. No prose.',
          'You assess a compliance intake chat turn. This call is structured extraction only.',
          'Do not include naturalResponse. A separate prose call will write the user-facing response.',
          'If you have already acknowledged a piece of information in a prior turn, do not re-acknowledge it; move forward.',
          'Never ask for something the user has already provided, even if it is not yet in currentDraft. Track what you have already understood from the conversation history.',
          'If the user\'s last message is a direct answer to your last question, update the structured fields and move to the next topic. Never repeat or rephrase the same question.',
          'Use activeQuestion, currentEventType, currentDraft, and the following real chat messages to interpret terse replies.',
          'The final user message in the messages array is the latest user input.',
          'If currentEventType is evidence_uploaded, classify the uploaded/indexed document first and ask a document-specific next question. Do not restart with generic intake.',
          'If retrievalContext shows evidence, governance, or similar-case matches, include one brief natural sentence such as "I checked 3 references before asking this" only when it helps the user understand why the question changed.',
          'Do not decide approval. Do not invent evidence. If information is unknown, record it as a gap and move on.'
        ].join(' ')
      },
      contextMessage,
      ...conversationMessages
    ];
  }

  return [
    {
      role: 'system',
      content: [
        'You assess compliance intake chat turns for Parallax42.',
        'Return strict JSON only. No markdown.',
        'You are advisory only. Do not approve, reject, or make final decisions.',
        'This call is structured extraction and planning only. Do not include naturalResponse.',
        'If you have already acknowledged a piece of information in a prior turn, do not re-acknowledge it; move forward.',
        'Never ask for something the user has already provided, even if it is not yet in currentDraft. Track what you have already understood from the conversation history.',
        'If the user\'s last message is a direct answer to your last question, update the structured fields and move to the next topic. Never repeat or rephrase the same question.',
        'Do not use generic filler such as "I captured the useful facts" when you can say the specific thing you understood.',
        'Do not include internal JSON, field dumps, evidence IDs, markdown headings, or more than one follow-up question inside naturalResponse.',
        'Extract what the user actually said. Do not invent facts.',
        'If the latest user message is terse, interpret it using activeQuestion, currentEventType, previousQuestions, currentDraft, and the following real chat messages.',
        'The final user message in the messages array is the latest user input and should anchor your response.',
        'If activeQuestion is present, treat a terse latestMessage as the answer to activeQuestion unless the answer is clearly unrelated.',
        'If currentEventType is evidence_uploaded, classify the uploaded/indexed document from currentDraft.documents, evidenceSignals, indexedEvidence, and retrievalContext before asking more questions. Do not ask "What do you need reviewed?" after evidence exists.',
        'If the user says unknown, dont know, not sure, not available, pending, we do not know at this point, or similar, map that answer to the most recent assistant question and add the normalized missing item to caseUpdate.knownGaps. Then move to the next useful action instead of repeating the same question.',
        'Classify the ask, not just the answer. Decide the document type, request type, and workflow for any legal, contractual, SaaS, procurement, privacy, security, AI governance, export-control, HSE/ESG, finance/project, policy, assurance, or general compliance input.',
        'If the user wants a document or clause reviewed but has not supplied it, conversationStage must be awaiting_document and recommendedFirstAction should be upload_document or paste_clause.',
        'If an uploaded or indexed document is available, use retrieval context before asking clarifying questions and choose the next workflow step from the document type.',
        'If retrievalContext includes evidenceMatches, governanceReferences, similarCases, or learningSuggestions, naturalResponse may include one brief line explaining that you checked them before answering. Do not list them unless the user asks.',
        'For document or clause review, do not ask owner/geography before the source document or clauses unless the user already supplied the source.',
        'If the user answers unknown/dont know to a document-upload request, keep awaiting_document and ask for upload/paste again in a calmer way.',
        'If the user asks a question rather than asking for a full case, answer the question if there is enough retrieved context; otherwise ask for the document or missing scope.',
        'If currentDraft includes governanceReferences, treat them as sanitized advisory context only; they are not official policy and must not replace function-owner review.',
        'Use plain business terms that a reviewer can inspect.'
      ].join(' ')
    },
    contextMessage,
    ...conversationMessages
  ];
}

async function requestConversationAssessment(message = '', draft = {}, options = {}) {
  return chatCompletion({
    model: process.env.CONVERSATION_LLM_MODEL || process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    temperature: 0,
    max_tokens: structuredMaxTokens(options.compact),
    response_format: { type: 'json_object' },
    messages: assessmentMessages(message, draft, options)
  });
}

function naturalResponseContext(message = '', draft = {}, assessment = {}) {
  return {
    latestMessage: message,
    eventType: cleanText(draft.currentEventType || 'user_message'),
    activeQuestion: cleanText(draft.activeQuestion),
    currentDraft: summarizeDraftForPrompt(draft),
    assessment: {
      intent: cleanText(assessment.intent),
      requestType: cleanText(assessment.requestType),
      workflowType: cleanText(assessment.workflowType),
      reviewTarget: cleanText(assessment.reviewTarget),
      reviewScope: cleanText(assessment.reviewScope),
      recommendedFirstAction: cleanText(assessment.recommendedFirstAction),
      conversationStage: cleanText(assessment.conversationStage),
      assistantSummary: cleanText(assessment.assistantSummary),
      nextBestQuestion: cleanText(assessment.nextBestQuestion),
      confidence: Number(assessment.confidence || 0),
      caseUpdate: assessment.caseUpdate || {}
    }
  };
}

function naturalResponseMessages(message = '', draft = {}, assessment = {}) {
  return [
    {
      role: 'system',
      content: [
        'You are the Parallax42 compliance advisor writing the actual chat response to the user.',
        'Write concise natural prose only. No JSON, markdown headings, field dumps, or evidence IDs.',
        'Acknowledge what you understood from the latest user message and reference named prior context when useful, such as supplier, document, geography, systems, owner, uploaded file, or retrieved reference.',
        'Ask at most one practical follow-up question. If the next step is document upload or evidence review, say that directly.',
        'If the user directly answered the prior question, confirm that answer and move to the next topic. Never repeat or rephrase the same question.',
        'If the user said unknown, dont know, not sure, pending, not available, or similar, record that calmly as a gap and move forward.',
        'If retrieval context was used, include at most one brief sentence explaining what was checked.',
        'Do not approve or reject. Keep the human review boundary implicit unless the user asks for a decision.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify(naturalResponseContext(message, draft, assessment))
    },
    ...recentConversationMessages(draft, message)
  ];
}

function parseNaturalResponseContent(content = '') {
  const clean = cleanText(content);
  if (!clean) return '';
  try {
    const parsed = parseJsonContent(clean);
    if (parsed && typeof parsed === 'object') {
      return clampText(parsed.naturalResponse || parsed.response || parsed.message || '', 1200);
    }
  } catch {
    // Plain prose is expected for this call.
  }
  return clampText(clean, 1200);
}

async function requestNaturalResponse(message = '', draft = {}, assessment = {}) {
  return chatCompletion({
    model: process.env.CONVERSATION_LLM_MODEL || process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    temperature: 0.4,
    max_tokens: naturalResponseMaxTokens(),
    messages: naturalResponseMessages(message, draft, assessment)
  });
}

async function attachNaturalResponse(message = '', draft = {}, assessment = {}) {
  if (assessment.naturalResponse) {
    assessment.prose = { status: 'provided_in_structured_response' };
    return assessment;
  }
  try {
    const response = await requestNaturalResponse(message, draft, assessment);
    const naturalResponse = parseNaturalResponseContent(extractChatContent(response));
    if (naturalResponse) {
      assessment.naturalResponse = naturalResponse;
      assessment.prose = { status: 'success' };
    } else {
      assessment.prose = { status: 'fallback_template', detail: 'Compass prose call returned an empty response.' };
    }
  } catch (error) {
    assessment.prose = {
      status: 'fallback_template',
      detail: clampText(errorDetail(error), 180)
    };
  }
  return assessment;
}

async function requestConversationAssessmentWithRetries(message = '', draft = {}) {
  const maxAttempts = llmMaxAttempts();
  const attempts = [];
  let lastError = null;

  for (let index = 0; index < maxAttempts; index += 1) {
    const attempt = index + 1;
    const compact = index > 0;
    try {
      const response = await requestConversationAssessment(message, draft, { compact, attempt });
      const assessment = parseAssessmentResponse(response);
      attempts.push(attemptRecord({ attempt, compact, status: 'success' }));
      await attachNaturalResponse(message, draft, assessment);
      assessment.attempts = attempts;
      assessment.attemptCount = attempts.length;
      assessment.maxAttempts = maxAttempts;
      assessment.retried = attempts.length > 1;
      assessment.retriedAfterInvalidJson = attempts.some((item) => item.status === 'invalid_json');
      return assessment;
    } catch (error) {
      lastError = error;
      const status = errorStatus(error) === 429 ? 'rate_limited' : isJsonParseFailure(error) ? 'invalid_json' : 'failed';
      const record = attemptRecord({ attempt, compact, status, error });
      const retryable = record.retryable && attempt < maxAttempts;
      attempts.push({ ...record, retryable });
      if (!retryable) break;
      if (isRateLimitedAttempt(record)) {
        await sleep(Math.pow(2, index) * retryBackoffBaseMs());
      }
    }
  }

  const wrapped = lastError instanceof Error ? lastError : new Error(errorDetail(lastError));
  wrapped.attempts = attempts;
  wrapped.attemptCount = attempts.length;
  wrapped.maxAttempts = maxAttempts;
  throw wrapped;
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
  const knownGaps = unique([...(draft.knownGaps || []), ...(update.knownGaps || [])].map(normalizeKnownGapField));
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
  nextDraft.recentlyAnsweredFields = mergeRecentlyAnsweredFields(draft.recentlyAnsweredFields, {
    businessUnit: update.businessUnit,
    geography: update.geography,
    evidenceSignals: update.evidenceSignals || [],
    knownGaps: update.knownGaps || []
  });
  nextDraft.llmIntake = {
    provider: assessment.provider,
    model: assessment.model,
    advisoryOnly: true,
    used: true,
    confidence: assessment.confidence,
    intent: assessment.intent,
    requestType: assessment.requestType,
    workflowType: assessment.workflowType,
    documentTypes: assessment.documentTypes || [],
    reviewTarget: assessment.reviewTarget,
    reviewScope: assessment.reviewScope,
    recommendedFirstAction: assessment.recommendedFirstAction,
    conversationStage: assessment.conversationStage,
    suggestedWorkflowSteps: assessment.suggestedWorkflowSteps || [],
    reason: assessment.reason,
    nextBestQuestion: assessment.nextBestQuestion,
    assistantSummary: assessment.assistantSummary,
    naturalResponse: assessment.naturalResponse,
    attemptCount: assessment.attemptCount || 0,
    retried: Boolean(assessment.retried),
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
    attempts: [],
    attemptCount: 0,
    maxAttempts: llmMaxAttempts(),
    reason: cleanText(reason),
    ...extra
  };
}

function smartIntakeUnavailableAssessment(extra = {}) {
  return unavailableAssessment(SMART_INTAKE_UNAVAILABLE_MESSAGE, {
    error: true,
    requiresCompass: true,
    smartIntakeUnavailable: true,
    userMessage: SMART_INTAKE_UNAVAILABLE_MESSAGE,
    ...extra
  });
}

async function assessConversationWithLlm(body = {}) {
  const message = cleanText(body.message || body.prompt || '');
  const baseDraft = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : {};
  const incomingHistory = normalizeConversationHistory(body.history);
  const existingHistory = normalizeConversationHistory(baseDraft.conversationHistory);
  const activeQuestion = cleanText(body.activeQuestion || baseDraft.activeQuestion || (Array.isArray(baseDraft.questions) ? baseDraft.questions[0] : ''));
  const eventType = cleanText(body.eventType || baseDraft.currentEventType || 'user_message');
  const draft = {
    ...baseDraft,
    activeQuestion,
    currentEventType: eventType,
    questions: activeQuestion ? [activeQuestion] : Array.isArray(baseDraft.questions) ? baseDraft.questions : [],
    conversationHistory: incomingHistory.length ? incomingHistory : existingHistory
  };
  if (!message) {
    return {
      ...body,
      llmAssessment: unavailableAssessment('No message supplied for LLM assessment.')
    };
  }
  if (!gatewayToken()) {
    return {
      ...body,
      llmAssessment: smartIntakeUnavailableAssessment({
        detail: 'Compass gateway token is missing.',
        attempts: [],
        attemptCount: 0
      })
    };
  }

  try {
    const assessment = await requestConversationAssessmentWithRetries(message, draft);
    return {
      ...body,
      caseDraft: mergeAssessmentIntoDraft(draft, assessment),
      llmAssessment: assessment
    };
  } catch (error) {
    const detail = errorDetail(error);
    const status = errorStatus(error);
    const attempts = Array.isArray(error?.attempts) ? error.attempts : [];
    const attemptCount = Number(error?.attemptCount || attempts.length || 0);
    const maxAttempts = Number(error?.maxAttempts || llmMaxAttempts());
    if (isJsonParseFailure(error)) {
      return {
        ...body,
        llmAssessment: invalidResponseAssessment({
          detail,
          attempts,
          attemptCount,
          maxAttempts
        })
      };
    }
    return {
      ...body,
      llmAssessment: smartIntakeUnavailableAssessment({
        detail,
        attempts,
        attemptCount,
        maxAttempts,
        ...(status ? { status } : {})
      })
    };
  }
}

module.exports = {
  SMART_INTAKE_INVALID_RESPONSE_MESSAGE,
  SMART_INTAKE_UNAVAILABLE_MESSAGE,
  assessConversationWithLlm,
  extractChatContent,
  mergeAssessmentIntoDraft,
  normalizeAssessment,
  normalizeConversationHistory,
  parseJsonContent
};
