'use strict';

const {
  SMART_INTAKE_DEGRADED_MESSAGE,
  SMART_INTAKE_INVALID_RESPONSE_MESSAGE,
  SMART_INTAKE_UNAVAILABLE_MESSAGE,
  assessConversationWithLlm
} = require('./conversationLlmAssessor');
const { prepareConversationMemory, summarizeMemoryFindings } = require('./conversationMemory');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function actionFromAssessment(assessment = {}) {
  const action = cleanText(assessment.recommendedFirstAction);
  if (action && action !== 'unknown') return action;
  if (assessment.intent === 'run_request') return 'run_council';
  if (/document|contract|agreement|msa|dpa|saas|license|licence|data_sharing|policy|security_assurance|procurement|finance_project|hse_esg|ai_governance/i.test(assessment.requestType || '')) return 'upload_document';
  return 'ask_scope';
}

function isSmartIntakeUnavailable(assessment = {}) {
  return Boolean(assessment && !assessment.used && (assessment.requiresCompass || assessment.smartIntakeUnavailable));
}

function buildConversationPlan(body = {}) {
  const draft = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : {};
  const assessment = body.llmAssessment && typeof body.llmAssessment === 'object' ? body.llmAssessment : null;
  const smartIntakeUnavailable = isSmartIntakeUnavailable(assessment);
  const smartIntakeDegraded = Boolean(assessment && !assessment.used && assessment.smartIntakeDegraded);
  const attempts = Array.isArray(assessment?.attempts) ? assessment.attempts : [];
  const attemptCount = Number(assessment?.attemptCount || attempts.length || 0);
  const action = assessment?.used ? actionFromAssessment(assessment) : smartIntakeUnavailable ? 'contact_admin' : 'deterministic_fallback';
  const shouldRunCouncil = Boolean(
    !smartIntakeUnavailable
    && (
      body.forceRun
      || assessment?.intent === 'run_request'
      || action === 'run_council'
      || /\b(run it|run council|execute|submit)\b/i.test(cleanText(body.message || body.prompt))
    )
  );

  return {
    ok: true,
    provider: assessment?.provider || 'deterministic_fallback',
    model: assessment?.model || '',
    usedLlm: Boolean(assessment?.used),
    aiUsage: {
      provider: assessment?.provider || 'compass_gateway',
      model: assessment?.model || '',
      used: Boolean(assessment?.used),
      attempts,
      attemptCount,
      maxAttempts: Number(assessment?.maxAttempts || 0),
      retried: Boolean(assessment?.retried || attemptCount > 1),
      fallbackUsed: Boolean(assessment && !assessment.used),
      fallbackReason: assessment && !assessment.used ? assessment.userMessage || assessment.reason || '' : ''
    },
    llmAttempts: attempts,
    llmAttemptCount: attemptCount,
    llmRetried: Boolean(assessment?.retried || attemptCount > 1),
    advisoryOnly: true,
    retrievalBeforePlanning: true,
    deterministicDecisionOwner: true,
    humanApprovalRequired: true,
    source: assessment?.used ? 'compass_gpt5_1_planner' : assessment?.invalidCompassResponse ? 'compass_invalid_response' : smartIntakeUnavailable ? 'compass_required_unavailable' : smartIntakeDegraded ? 'compass_degraded_fallback' : 'deterministic_planner_fallback',
    smartIntakeUnavailable,
    smartIntakeDegraded,
    requiresCompass: Boolean(assessment?.requiresCompass),
    userMessage: smartIntakeUnavailable ? assessment?.userMessage || (assessment?.invalidCompassResponse ? SMART_INTAKE_INVALID_RESPONSE_MESSAGE : SMART_INTAKE_UNAVAILABLE_MESSAGE) : smartIntakeDegraded ? assessment?.userMessage || SMART_INTAKE_DEGRADED_MESSAGE : '',
    userIntent: assessment?.intent || 'unknown',
    caseUpdates: assessment?.caseUpdate && typeof assessment.caseUpdate === 'object' ? assessment.caseUpdate : {},
    knownGaps: Array.isArray(assessment?.caseUpdate?.knownGaps) ? assessment.caseUpdate.knownGaps : [],
    requestType: assessment?.requestType || draft.llmIntake?.requestType || draft.intakeAssessment?.requestType || '',
    workflowType: assessment?.workflowType || draft.llmIntake?.workflowType || draft.intakeAssessment?.workflowType || '',
    documentTypes: assessment?.documentTypes || draft.llmIntake?.documentTypes || draft.intakeAssessment?.documentTypes || [],
    reviewTarget: assessment?.reviewTarget || draft.llmIntake?.reviewTarget || draft.intakeAssessment?.reviewTarget || '',
    reviewScope: assessment?.reviewScope || draft.llmIntake?.reviewScope || draft.intakeAssessment?.reviewScope || '',
    suggestedWorkflowSteps: assessment?.suggestedWorkflowSteps || draft.llmIntake?.suggestedWorkflowSteps || draft.intakeAssessment?.suggestedWorkflowSteps || [],
    nextBestAction: action,
    nextQuestion: smartIntakeUnavailable ? assessment?.userMessage || (assessment?.invalidCompassResponse ? SMART_INTAKE_INVALID_RESPONSE_MESSAGE : SMART_INTAKE_UNAVAILABLE_MESSAGE) : cleanText(assessment?.nextBestQuestion),
    reason: smartIntakeUnavailable ? assessment?.userMessage || (assessment?.invalidCompassResponse ? SMART_INTAKE_INVALID_RESPONSE_MESSAGE : SMART_INTAKE_UNAVAILABLE_MESSAGE) : cleanText(assessment?.reason),
    assistantSummary: smartIntakeUnavailable ? assessment?.userMessage || (assessment?.invalidCompassResponse ? SMART_INTAKE_INVALID_RESPONSE_MESSAGE : SMART_INTAKE_UNAVAILABLE_MESSAGE) : cleanText(assessment?.assistantSummary),
    naturalResponse: smartIntakeUnavailable ? assessment?.userMessage || (assessment?.invalidCompassResponse ? SMART_INTAKE_INVALID_RESPONSE_MESSAGE : SMART_INTAKE_UNAVAILABLE_MESSAGE) : cleanText(assessment?.naturalResponse),
    confidence: Number(assessment?.confidence || 0),
    shouldRunCouncil,
    memoryFindings: summarizeMemoryFindings(draft),
    fallbackReason: assessment && !assessment.used ? assessment.userMessage || assessment.reason || '' : '',
    createdAt: new Date().toISOString()
  };
}

async function planConversationTurn(body = {}, options = {}) {
  const enrichedBody = await prepareConversationMemory(body, { actor: options.actor });
  const assessedBody = await assessConversationWithLlm(enrichedBody);
  const conversationPlan = buildConversationPlan(assessedBody);
  return {
    ...assessedBody,
    conversationPlan
  };
}

module.exports = {
  buildConversationPlan,
  isSmartIntakeUnavailable,
  planConversationTurn
};
