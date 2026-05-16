'use strict';

const { buildEvidenceRetrievalQuery, searchEvidenceServerSide } = require('./evidenceVectorStore');
const { findSimilarCases, getControlSuggestions } = require('./learningMemory');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function retrievalDocumentsFromMatches(matches = []) {
  return matches.map((match, index) => ({
    evidenceId: `RET-${String(index + 1).padStart(2, '0')}`,
    sourceEvidenceId: match.evidenceId,
    title: match.title || `Retrieved evidence ${index + 1}`,
    sourceType: 'semantic_retrieval',
    extractionStatus: 'retrieved_chunk',
    summary: match.text || '',
    text: match.text || '',
    excerpt: cleanText(match.text || '').slice(0, 360),
    signals: [],
    chunkId: match.chunkId,
    score: Number(match.score || 0),
    metadata: match.metadata || {},
    uploadedAt: new Date().toISOString()
  }));
}

async function enrichConversationWithServerRetrieval(body = {}) {
  const draft = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : {};
  const caseId = cleanText(draft.caseId || body.caseId);
  const indexedChunkCount = Number(draft.indexedEvidence?.chunkCount || 0);
  const message = cleanText(body.message || body.prompt || '');
  const existingRetrieval = draft.retrievalContext && typeof draft.retrievalContext === 'object' ? draft.retrievalContext : {};
  const evidenceMatches = existingRetrieval.evidenceMatches || existingRetrieval.matches || [];
  const evidenceLikelyNeeded = /evidence|proof|document|contract|dpa|soc|iso|policy|control|citation|run|assess|review|approve/i.test(`${message} ${draft.brief || ''}`);
  const shouldRetrieve = Boolean(caseId && indexedChunkCount && !evidenceMatches.length && (body.forceRun || evidenceLikelyNeeded));
  const shouldRetrieveLearning = Boolean(body.forceRun || /similar|precedent|previous|control|reviewer|run|assess|review|approve/i.test(`${message} ${draft.brief || ''}`));

  const query = cleanText(body.retrievalQuery || buildEvidenceRetrievalQuery(draft));
  let enrichedDraft = { ...draft };

  if (shouldRetrieve && query) {
    try {
      const result = await searchEvidenceServerSide({
        caseId,
        workspaceId: body.workspaceId || draft.workspaceId || 'parallax42',
        projectId: body.projectId || draft.projectId || 'compliance-intelligence-agent',
        purpose: body.forceRun ? 'conversation_council_retrieval' : 'conversation_pre_question_retrieval',
        query,
        topK: body.topK || 8,
        allowWorkspaceFallback: body.allowWorkspaceFallback === true
      });
      const matches = Array.isArray(result.matches) ? result.matches : [];
      const retrievedDocs = retrievalDocumentsFromMatches(matches);
      const existingDocuments = Array.isArray(draft.documents) ? draft.documents : [];
      const nonRetrieved = existingDocuments.filter((doc) => doc.extractionStatus !== 'retrieved_chunk');
      enrichedDraft = {
        ...enrichedDraft,
        documents: [...nonRetrieved, ...retrievedDocs].slice(-18),
        retrievalContext: {
          ...existingRetrieval,
          query,
          model: result.model || draft.indexedEvidence?.model || 'text-embedding-3-large',
          chunkCount: result.index?.chunkCount || indexedChunkCount,
          matchCount: matches.length,
          evidenceMatches: matches.map((match) => ({
            chunkId: match.chunkId,
            evidenceId: match.evidenceId,
            documentId: match.documentId,
            title: match.title,
            score: Number(match.score || 0),
            snippet: match.snippet || match.text,
            text: match.text || match.snippet,
            metadata: match.metadata || {}
          })),
          matches: matches.map((match) => ({
            chunkId: match.chunkId,
            evidenceId: match.evidenceId,
            title: match.title,
            score: Number(match.score || 0),
            text: match.text || match.snippet,
            metadata: match.metadata || {}
          }))
        }
      };
    } catch (error) {
      enrichedDraft = {
        ...enrichedDraft,
        retrievalContext: {
          ...existingRetrieval,
          query,
          model: draft.indexedEvidence?.model || 'text-embedding-3-large',
          chunkCount: indexedChunkCount,
          matchCount: 0,
          evidenceMatches: [],
          matches: [],
          error: error instanceof Error ? error.message : 'Server-side evidence retrieval failed.'
        }
      };
    }
  }

  if (shouldRetrieveLearning) {
    try {
      const learningQuery = {
        ...enrichedDraft,
        query,
        caseId,
        workspaceId: body.workspaceId || enrichedDraft.workspaceId || 'parallax42',
        projectId: body.projectId || enrichedDraft.projectId || 'compliance-intelligence-agent',
        limit: body.learningLimit || 5
      };
      const [similar, controls] = await Promise.all([
        findSimilarCases(learningQuery),
        getControlSuggestions(learningQuery)
      ]);
      const missingEvidenceSignals = (controls.repeatedMissingEvidencePatterns || []).map((item) => item.evidence);
      enrichedDraft = {
        ...enrichedDraft,
        retrievalContext: {
          ...(enrichedDraft.retrievalContext || existingRetrieval),
          similarCases: similar.similarCases || [],
          learningSuggestions: controls,
          missingEvidenceSignals
        }
      };
    } catch (error) {
      enrichedDraft = {
        ...enrichedDraft,
        retrievalContext: {
          ...(enrichedDraft.retrievalContext || existingRetrieval),
          learningError: error instanceof Error ? error.message : 'Learning memory retrieval failed.'
        }
      };
    }
  }

  return {
    ...body,
    caseDraft: enrichedDraft
  };
}

module.exports = {
  enrichConversationWithServerRetrieval,
  retrievalDocumentsFromMatches
};
