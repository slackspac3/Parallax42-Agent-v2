'use strict';

const { chatCompletion, gatewayToken, LLM_MODEL } = require('./compassGatewayClient');
const { mergeRecentlyAnsweredFields } = require('./conversationState');

const SMART_INTAKE_UNAVAILABLE_MESSAGE = 'Compass gateway is not configured — smart intake is unavailable. Contact your administrator.';
const SMART_INTAKE_INVALID_RESPONSE_MESSAGE = 'Smart intake received an invalid Compass response. The deterministic case builder is still available, but AI intake needs administrator review.';
const DEFAULT_CONVERSATION_LLM_MAX_TOKENS = 1200;
const DEFAULT_CONVERSATION_LLM_RETRY_MAX_TOKENS = 900;

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

function assessmentMessages(message = '', draft = {}, options = {}) {
  if (options.compact) {
    return [
      {
        role: 'system',
        content: [
          'Return one valid minified JSON object only. No markdown. No prose.',
          'You classify a compliance intake chat turn and choose one next practical action.',
          'Do not decide approval. Do not invent evidence. If information is unknown, record it as a gap and move on.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          latestMessage: message,
          currentDraft: summarizeDraftForPrompt(draft),
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
        })
      }
    ];
  }

  return [
    {
      role: 'system',
      content: [
        'You assess compliance intake chat turns for Parallax42.',
        'Return strict JSON only. No markdown.',
        'You are advisory only. Do not approve, reject, or make final decisions.',
        'Extract what the user actually said. Do not invent facts.',
        'If the latest user message is terse, interpret it using previousQuestions and currentDraft.',
        'Classify the ask, not just the answer. Decide the document type, request type, and workflow for any legal, contractual, SaaS, procurement, privacy, security, AI governance, export-control, HSE/ESG, finance/project, policy, assurance, or general compliance input.',
        'If the user wants a document or clause reviewed but has not supplied it, conversationStage must be awaiting_document and recommendedFirstAction should be upload_document or paste_clause.',
        'If an uploaded or indexed document is available, use retrieval context before asking clarifying questions and choose the next workflow step from the document type.',
        'For document or clause review, do not ask owner/geography before the source document or clauses unless the user already supplied the source.',
        'If the user answers unknown/dont know to a document-upload request, keep awaiting_document and ask for upload/paste again in a calmer way.',
        'If the user asks a question rather than asking for a full case, answer the question if there is enough retrieved context; otherwise ask for the document or missing scope.',
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
      })
    }
  ];
}

async function requestConversationAssessment(message = '', draft = {}, options = {}) {
  return chatCompletion({
    model: process.env.CONVERSATION_LLM_MODEL || process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    temperature: Number(process.env.CONVERSATION_LLM_TEMPERATURE || 0),
    max_tokens: Number(process.env.CONVERSATION_LLM_MAX_TOKENS || (options.compact ? DEFAULT_CONVERSATION_LLM_RETRY_MAX_TOKENS : DEFAULT_CONVERSATION_LLM_MAX_TOKENS)),
    response_format: { type: 'json_object' },
    messages: assessmentMessages(message, draft, options)
  });
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
  const draft = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : {};
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
        detail: 'Compass gateway token is missing.'
      })
    };
  }

  try {
    let response = await requestConversationAssessment(message, draft);
    let assessment;
    try {
      assessment = parseAssessmentResponse(response);
    } catch (parseError) {
      if (!isJsonParseFailure(parseError)) throw parseError;
      response = await requestConversationAssessment(message, draft, { compact: true });
      assessment = parseAssessmentResponse(response);
      assessment.retriedAfterInvalidJson = true;
    }
    return {
      ...body,
      caseDraft: mergeAssessmentIntoDraft(draft, assessment),
      llmAssessment: assessment
    };
  } catch (error) {
    const detail = cleanText(error instanceof Error ? error.message : String(error || 'LLM assessment failed.'));
    const status = Number(error?.status || 0);
    if (isJsonParseFailure(error)) {
      return {
        ...body,
        llmAssessment: invalidResponseAssessment({ detail })
      };
    }
    return {
      ...body,
      llmAssessment: smartIntakeUnavailableAssessment({
        detail,
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
  parseJsonContent
};
