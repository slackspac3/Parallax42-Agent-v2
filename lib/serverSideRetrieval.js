'use strict';

const { buildEvidenceRetrievalQuery, searchEvidenceServerSide, vectorNamespace } = require('./evidenceVectorStore');
const { searchGovernanceReferences } = require('./governanceReferenceStore');
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

function evidenceIndexVersion(index = {}, caseId = '') {
  const explicitVersion = cleanText(index.indexVersion || index.version || index.updatedAt);
  if (explicitVersion) return explicitVersion;
  const chunkCount = Number(index.chunkCount || 0);
  return cleanText(`${caseId}:${index.provider || 'unknown'}:${chunkCount}`);
}

async function enrichConversationWithServerRetrieval(body = {}, options = {}) {
  const draft = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : {};
  const namespace = vectorNamespace({}, { actor: options.actor });
  const caseId = cleanText(draft.caseId || body.caseId);
  const indexedChunkCount = Number(draft.indexedEvidence?.chunkCount || 0);
  const indexedVersion = evidenceIndexVersion(draft.indexedEvidence, caseId);
  const message = cleanText(body.message || body.prompt || '');
  const evidenceLikelyNeeded = /evidence|proof|document|contract|dpa|soc|iso|policy|control|citation|run|assess|review|approve/i.test(`${message} ${draft.brief || ''}`);
  const shouldRetrieve = Boolean(caseId && indexedChunkCount && (body.forceRun || evidenceLikelyNeeded));
  const governanceLikelyUseful = /governance|policy|assurance|risk|compliance|control|SAA|ISO|responsible AI|AI governance|export|sanction|data protection|privacy|audit|committee|review|assess|approve|vendor|supplier|contract|agreement|payroll/i.test(`${message} ${draft.brief || ''}`);
  const shouldRetrieveGovernance = Boolean(body.forceRun || governanceLikelyUseful);
  const shouldRetrieveLearning = Boolean(body.forceRun || /similar|precedent|previous|control|reviewer|run|assess|review|approve/i.test(`${message} ${draft.brief || ''}`));

  const query = cleanText(body.retrievalQuery || buildEvidenceRetrievalQuery(draft));
  const existingDocuments = Array.isArray(draft.documents) ? draft.documents : [];
  const nonRetrievedDocuments = existingDocuments.filter((doc) => doc.extractionStatus !== 'retrieved_chunk');
  let enrichedDraft = {
    ...draft,
    documents: nonRetrievedDocuments,
    retrievalContext: {
      serverAuthoritative: true,
      indexVersion: indexedVersion,
      indexUpdatedAt: cleanText(draft.indexedEvidence?.updatedAt),
      chunkCount: indexedChunkCount,
      matchCount: 0,
      evidenceMatches: [],
      matches: []
    }
  };

  if (shouldRetrieve && query) {
    try {
      const result = await searchEvidenceServerSide({
        caseId,
        purpose: body.forceRun ? 'conversation_council_retrieval' : 'conversation_pre_question_retrieval',
        query,
        topK: body.topK || 8
      }, {
        actor: options.actor,
        allowWorkspaceFallback: options.allowWorkspaceFallback === true
      });
      const matches = Array.isArray(result.matches) ? result.matches : [];
      const retrievedDocs = retrievalDocumentsFromMatches(matches);
      const resultIndex = result.index && typeof result.index === 'object' ? result.index : {};
      enrichedDraft = {
        ...enrichedDraft,
        documents: [...nonRetrievedDocuments, ...retrievedDocs].slice(-18),
        retrievalContext: {
          ...(enrichedDraft.retrievalContext || {}),
          query,
          model: result.model || draft.indexedEvidence?.model || 'text-embedding-3-large',
          indexVersion: evidenceIndexVersion({ ...draft.indexedEvidence, ...resultIndex }, caseId),
          indexUpdatedAt: cleanText(resultIndex.updatedAt || draft.indexedEvidence?.updatedAt),
          retrievedAt: new Date().toISOString(),
          chunkCount: resultIndex.chunkCount || indexedChunkCount,
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
          ...(enrichedDraft.retrievalContext || {}),
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

  if (shouldRetrieveGovernance && query) {
    try {
      const result = await searchGovernanceReferences({
        purpose: body.forceRun ? 'conversation_council_governance_reference' : 'conversation_pre_question_governance_reference',
        query,
        topK: body.governanceTopK || 5
      }, { actor: options.actor });
      const references = Array.isArray(result.references) ? result.references : [];
      enrichedDraft = {
        ...enrichedDraft,
        retrievalContext: {
          ...(enrichedDraft.retrievalContext || {}),
          governanceReferenceQuery: query,
          governanceReferenceModel: result.model || 'text-embedding-3-large',
          governanceReferenceCount: references.length,
          governanceReferences: references.map((reference) => ({
            referenceId: reference.referenceId,
            chunkId: reference.chunkId,
            sourceId: reference.sourceId,
            title: reference.title,
            section: reference.section,
            heading: reference.heading,
            score: Number(reference.score || 0),
            snippet: reference.snippet,
            frameworks: reference.frameworks || [],
            domains: reference.domains || [],
            tags: reference.tags || [],
            authority: reference.authority,
            requiresHumanReview: reference.requiresHumanReview,
            publicSafe: reference.publicSafe
          }))
        }
      };
    } catch (error) {
      enrichedDraft = {
        ...enrichedDraft,
        retrievalContext: {
          ...(enrichedDraft.retrievalContext || {}),
          governanceReferenceQuery: query,
          governanceReferenceCount: 0,
          governanceReferenceError: error instanceof Error ? error.message : 'Governance reference retrieval failed.'
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
        workspaceId: namespace.workspaceId,
        projectId: namespace.projectId,
        limit: body.learningLimit || 5
      };
      const [similar, controls] = await Promise.all([
        findSimilarCases(learningQuery, { actor: options.actor }),
        getControlSuggestions(learningQuery, { actor: options.actor })
      ]);
      const missingEvidenceSignals = (controls.repeatedMissingEvidencePatterns || []).map((item) => item.evidence);
      enrichedDraft = {
        ...enrichedDraft,
        retrievalContext: {
          ...(enrichedDraft.retrievalContext || {}),
          similarCases: similar.similarCases || [],
          learningSuggestions: controls,
          missingEvidenceSignals
        }
      };
    } catch (error) {
      enrichedDraft = {
        ...enrichedDraft,
        retrievalContext: {
          ...(enrichedDraft.retrievalContext || {}),
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
  evidenceIndexVersion,
  enrichConversationWithServerRetrieval,
  retrievalDocumentsFromMatches
};
