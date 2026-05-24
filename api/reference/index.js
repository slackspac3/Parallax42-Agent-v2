'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { indexGovernanceReference } = require('../../lib/governanceReferenceStore');
const { authorizeRequest } = require('../../lib/rbac');
const { EVIDENCE_INDEX_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }

    const body = await readJsonRequest(req, { limitBytes: EVIDENCE_INDEX_BODY_LIMIT_BYTES });
    const result = await indexGovernanceReference(body);
    appendAuditRecord({
      actor: auth.actor,
      caseId: body.caseId || result.context?.sourceId || 'governance-reference-index',
      status: 'governance_reference_indexed',
      summary: `Indexed ${result.chunking?.chunkCount || 0} governance reference chunks.`,
      payload: {
        auth: {
          policy: auth.policy,
          roles: auth.actor.roles,
          authenticated: auth.actor.authenticated
        },
        route: 'reference.index',
        model: result.model,
        context: result.context,
        chunking: result.chunking,
        index: result.index,
        advisoryOnly: true,
        authority: result.context?.authority || 'context_reference_not_policy'
      }
    });
    sendJson(req, res, 200, result);
  } catch (error) {
    if (error?.statusCode) {
      sendJsonError(req, res, error, { error: 'governance_reference_index_failed' });
      return;
    }
    sendJson(req, res, error.status || 502, error.body || {
      error: 'governance_reference_index_failed',
      detail: error instanceof Error ? error.message : 'Governance reference indexing failed.'
    });
  }
};
