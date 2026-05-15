'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { searchEvidenceServerSide } = require('../../lib/evidenceVectorStore');
const { authorizeRequest } = require('../../lib/rbac');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }

    const body = await readJsonRequest(req);
    const result = await searchEvidenceServerSide(body);
    appendAuditRecord({
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
    });
    sendJson(req, res, 200, result);
  } catch (error) {
    sendJson(req, res, error.status || 502, error.body || {
      error: 'evidence_search_failed',
      detail: error instanceof Error ? error.message : 'Evidence search failed.'
    });
  }
};
