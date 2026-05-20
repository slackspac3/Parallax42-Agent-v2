'use strict';

const { assessConversationWithLlm } = require('./conversationLlmAssessor');
const { prepareConversationMemory, summarizeMemoryFindings } = require('./conversationMemory');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function actionFromAssessment(assessment = {}) {
  const action = cleanText(assessment.recommendedFirstAction);
  if (action && action !== 'unknown') return action;
  if (assessment.intent === 'run_request') return 'run_council';
  if (/document|contract|msa|dpa/i.test(assessment.requestType || '')) return 'upload_document';
  return 'ask_scope';
}

function buildConversationPlan(body = {}) {
  const draft = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : {};
  const assessment = body.llmAssessment && typeof body.llmAssessment === 'object' ? body.llmAssessment : null;
  const action = assessment?.used ? actionFromAssessment(assessment) : 'deterministic_fallback';
  const shouldRunCouncil = Boolean(
    body.forceRun
    || assessment?.intent === 'run_request'
    || action === 'run_council'
    || /\b(run it|run council|execute|submit)\b/i.test(cleanText(body.message || body.prompt))
  );

  return {
    ok: true,
    provider: assessment?.provider || 'deterministic_fallback',
    model: assessment?.model || '',
    usedLlm: Boolean(assessment?.used),
    advisoryOnly: true,
    retrievalBeforePlanning: true,
    deterministicDecisionOwner: true,
    humanApprovalRequired: true,
    source: assessment?.used ? 'compass_gpt5_1_planner' : 'deterministic_planner_fallback',
    userIntent: assessment?.intent || 'unknown',
    caseUpdates: assessment?.caseUpdate && typeof assessment.caseUpdate === 'object' ? assessment.caseUpdate : {},
    knownGaps: Array.isArray(assessment?.caseUpdate?.knownGaps) ? assessment.caseUpdate.knownGaps : [],
    requestType: assessment?.requestType || draft.llmIntake?.requestType || draft.intakeAssessment?.requestType || '',
    reviewTarget: assessment?.reviewTarget || draft.llmIntake?.reviewTarget || draft.intakeAssessment?.reviewTarget || '',
    reviewScope: assessment?.reviewScope || draft.llmIntake?.reviewScope || draft.intakeAssessment?.reviewScope || '',
    nextBestAction: action,
    nextQuestion: cleanText(assessment?.nextBestQuestion),
    reason: cleanText(assessment?.reason),
    assistantSummary: cleanText(assessment?.assistantSummary),
    confidence: Number(assessment?.confidence || 0),
    shouldRunCouncil,
    memoryFindings: summarizeMemoryFindings(draft),
    fallbackReason: assessment && !assessment.used ? assessment.reason || '' : '',
    createdAt: new Date().toISOString()
  };
}

async function planConversationTurn(body = {}) {
  const enrichedBody = await prepareConversationMemory(body);
  const assessedBody = await assessConversationWithLlm(enrichedBody);
  const conversationPlan = buildConversationPlan(assessedBody);
  return {
    ...assessedBody,
    conversationPlan
  };
}

module.exports = {
  buildConversationPlan,
  planConversationTurn
};
