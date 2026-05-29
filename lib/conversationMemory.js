'use strict';

const { enrichConversationWithServerRetrieval } = require('./serverSideRetrieval');

function safeCount(value) {
  return Array.isArray(value) ? value.length : Number(value || 0) || 0;
}

function summarizeMemoryFindings(draft = {}) {
  const retrieval = draft.retrievalContext && typeof draft.retrievalContext === 'object' ? draft.retrievalContext : {};
  const evidenceMatches = retrieval.evidenceMatches || retrieval.matches || [];
  const similarCases = retrieval.similarCases || [];
  const learningSuggestions = retrieval.learningSuggestions || null;
  const governanceReferences = retrieval.governanceReferences || [];
  return {
    evidenceMatches: safeCount(evidenceMatches),
    governanceReferences: safeCount(governanceReferences),
    similarCases: safeCount(similarCases),
    controlSuggestions: safeCount(learningSuggestions?.commonControlsReviewersAdded),
    missingEvidenceSignals: safeCount(retrieval.missingEvidenceSignals)
  };
}

async function prepareConversationMemory(body = {}, options = {}) {
  return enrichConversationWithServerRetrieval({
    ...body,
    planningMode: body.planningMode || 'retrieval_before_llm_planner'
  }, {
    actor: options.actor
  });
}

module.exports = {
  prepareConversationMemory,
  summarizeMemoryFindings
};
