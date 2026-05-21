'use strict';

const { indexEvidenceServerSide, searchEvidenceServerSide } = require('./evidenceVectorStore');

function evidenceIndexAuditPayload({ auth, body, result }) {
  return {
    actor: auth.actor,
    caseId: result.context?.caseId || body.caseId || 'evidence-index',
    status: 'evidence_indexed',
    summary: `Indexed ${result.chunking?.chunkCount || 0} evidence chunks through the shared gateway.`,
    payload: {
      auth: {
        policy: auth.policy,
        roles: auth.actor.roles,
        authenticated: auth.actor.authenticated
      },
      route: 'evidence.index',
      model: result.model,
      context: result.context,
      chunking: result.chunking,
      index: result.index,
      evidenceIds: result.index?.evidenceIds || []
    }
  };
}

function evidenceSearchAuditPayload({ auth, body, result }) {
  return {
    actor: auth.actor,
    caseId: result.context?.caseId || body.caseId || 'evidence-search',
    status: 'evidence_searched',
    summary: `Searched shared evidence index for ${result.matches?.length || 0} matches.`,
    payload: {
      auth: {
        policy: auth.policy,
        roles: auth.actor.roles,
        authenticated: auth.actor.authenticated
      },
      route: 'evidence.search',
      model: result.model,
      context: result.context,
      index: result.index,
      queryLength: String(body.query || '').length,
      matchIds: (result.matches || []).map((match) => match.chunkId).filter(Boolean)
    }
  };
}

async function indexEvidencePipeline(body = {}) {
  return indexEvidenceServerSide(body);
}

async function searchEvidencePipeline(body = {}) {
  return searchEvidenceServerSide(body);
}

module.exports = {
  evidenceIndexAuditPayload,
  evidenceSearchAuditPayload,
  indexEvidencePipeline,
  searchEvidencePipeline
};
