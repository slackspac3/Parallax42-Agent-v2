'use strict';

const { buildEvidenceRetrievalQuery, searchEvidenceServerSide } = require('./evidenceVectorStore');

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
  const shouldRetrieve = Boolean(body.forceRun && caseId && indexedChunkCount && !draft.retrievalContext?.matches?.length);
  if (!shouldRetrieve) return body;

  const query = cleanText(body.retrievalQuery || buildEvidenceRetrievalQuery(draft));
  if (!query) return body;

  try {
    const result = await searchEvidenceServerSide({
      caseId,
      workspaceId: body.workspaceId || 'parallax42',
      projectId: body.projectId || 'compliance-intelligence-agent',
      purpose: 'conversation_council_retrieval',
      query,
      topK: body.topK || 8
    });
    const matches = Array.isArray(result.matches) ? result.matches : [];
    const retrievedDocs = retrievalDocumentsFromMatches(matches);
    const existingDocuments = Array.isArray(draft.documents) ? draft.documents : [];
    const nonRetrieved = existingDocuments.filter((doc) => doc.extractionStatus !== 'retrieved_chunk');
    return {
      ...body,
      caseDraft: {
        ...draft,
        documents: [...nonRetrieved, ...retrievedDocs].slice(-18),
        retrievalContext: {
          query,
          model: result.model || draft.indexedEvidence?.model || 'text-embedding-3-large',
          chunkCount: result.index?.chunkCount || indexedChunkCount,
          matchCount: matches.length,
          matches: matches.map((match) => ({
            chunkId: match.chunkId,
            evidenceId: match.evidenceId,
            title: match.title,
            score: Number(match.score || 0),
            text: match.text,
            metadata: match.metadata || {}
          }))
        }
      }
    };
  } catch (error) {
    return {
      ...body,
      caseDraft: {
        ...draft,
        retrievalContext: {
          query,
          model: draft.indexedEvidence?.model || 'text-embedding-3-large',
          chunkCount: indexedChunkCount,
          matchCount: 0,
          matches: [],
          error: error instanceof Error ? error.message : 'Server-side evidence retrieval failed.'
        }
      }
    };
  }
}

module.exports = {
  enrichConversationWithServerRetrieval,
  retrievalDocumentsFromMatches
};
