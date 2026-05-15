'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { indexEvidence } = require('../../lib/compassGatewayClient');
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
    const result = await indexEvidence(body);
    appendAuditRecord({
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
        evidenceIds: Array.from(new Set((result.chunks || []).map((chunk) => chunk.evidenceId).filter(Boolean)))
      }
    });
    sendJson(req, res, 200, result);
  } catch (error) {
    sendJson(req, res, error.status || 502, error.body || {
      error: 'evidence_index_failed',
      detail: error instanceof Error ? error.message : 'Evidence indexing failed.'
    });
  }
};
