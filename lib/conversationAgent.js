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

function processConversation(input = {}, options = {}) {
  const message = cleanText(input.message || input.prompt || '');
  const existingDraft = input.caseDraft && typeof input.caseDraft === 'object' ? input.caseDraft : {};
  const intent = detectIntent(message);
  const extracted = extractCaseFields(message, existingDraft);
  const draft = mergeDraft(existingDraft, extracted);
  const conversationPlan = input.conversationPlan && typeof input.conversationPlan === 'object' ? input.conversationPlan : null;
  if (conversationPlan) draft.conversationPlan = conversationPlan;
  const requestProfile = requestProfileForDraft(draft);
  const missing = missingFields(draft);
  const executionBlockers = executionBlockersForMissing(missing);
  const runReadiness = runReadinessForDraft(draft, missing);
  const questions = filterRepeatedQuestions(questionsForDraft(draft, missing), draft, extracted);
  draft.questions = questions;
  draft.askedQuestions = unique([...(draft.askedQuestions || []), ...questions]).slice(-24);
  const retrievalMatches = Array.isArray(draft.retrievalContext?.evidenceMatches)
    ? draft.retrievalContext.evidenceMatches
    : Array.isArray(draft.retrievalContext?.matches) ? draft.retrievalContext.matches : [];
  const similarCases = Array.isArray(draft.retrievalContext?.similarCases) ? draft.retrievalContext.similarCases : [];
  const governanceReferences = Array.isArray(draft.retrievalContext?.governanceReferences) ? draft.retrievalContext.governanceReferences : [];
  const llmAssessment = input.llmAssessment && typeof input.llmAssessment === 'object' ? input.llmAssessment : null;
  const forceRun = Boolean(input.forceRun || conversationPlan?.shouldRunCouncil || /\b(run it|execute|submit|assess now|start the workflow)\b/i.test(message));
  const shouldRun = executionBlockers.length === 0 && (forceRun || intent === 'run_or_assess');
  const actions = [
    {
      id: 'conversation_planner',
      status: conversationPlan?.usedLlm ? 'complete' : conversationPlan ? 'fallback' : 'not_requested',
      detail: conversationPlan?.usedLlm
        ? `Compass planner selected ${conversationPlan.nextBestAction || 'next action'} with ${Math.round(Number(conversationPlan.confidence || 0) * 100)}% confidence after retrieval.`
        : conversationPlan?.fallbackReason || 'Conversation planner used deterministic fallback.'
    },
    {
      id: 'llm_intake_assessment',
      status: llmAssessment?.used ? 'complete' : llmAssessment ? 'not_available' : 'not_requested',
      detail: llmAssessment?.used
        ? `Compass assessed the chat turn as ${llmAssessment.intent || 'unknown'} / ${llmAssessment.requestType || requestProfile.requestType || 'unknown'} / ${llmAssessment.conversationStage || requestProfile.conversationStage || 'unknown'} with ${Math.round(Number(llmAssessment.confidence || 0) * 100)}% confidence.`
        : llmAssessment?.reason || 'Compass chat assessment was not requested for this turn.'
    },
    { id: 'conversation_state', status: 'complete', detail: 'Updated the canonical case draft, known gaps, and current phase from the chat turn.' },
    { id: 'conversation_policy', status: questions.length ? 'complete' : 'not_required', detail: questions.length ? 'Applied repeat-question and unknown-answer guardrails before selecting the next question.' : 'No clarification required before agent execution.' },
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
    reply: composeReply({ intent, draft, missing, questions, run, executionBlockers, currentKnownGaps: extracted.knownGaps || [], conversationPlan }),
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
        reviewTarget: llmAssessment.reviewTarget || '',
        reviewScope: llmAssessment.reviewScope || '',
        recommendedFirstAction: llmAssessment.recommendedFirstAction || '',
        conversationStage: llmAssessment.conversationStage || '',
        assistantSummary: llmAssessment.assistantSummary || '',
        confidence: Number(llmAssessment.confidence || 0),
        reason: llmAssessment.reason || '',
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
