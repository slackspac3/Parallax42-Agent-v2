'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { searchGovernanceReferences } = require('../../lib/governanceReferenceStore');
const { authorizeRequest } = require('../../lib/rbac');
const { EVIDENCE_SEARCH_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'evidenceSearch')) return;

  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }

    const body = await readJsonRequest(req, { limitBytes: EVIDENCE_SEARCH_BODY_LIMIT_BYTES });
    const result = await searchGovernanceReferences(body);
    appendAuditRecord({
      actor: auth.actor,
      caseId: body.caseId || body.sourceId || 'governance-reference-search',
      status: 'governance_reference_searched',
      summary: `Searched governance reference memory for ${result.references?.length || 0} matches.`,
      payload: {
        auth: {
          policy: auth.policy,
          roles: auth.actor.roles,
          authenticated: auth.actor.authenticated
        },
        route: 'reference.search',
        model: result.model,
        context: result.context,
        index: result.index,
        queryLength: String(body.query || '').length,
        referenceIds: (result.references || []).map((reference) => reference.referenceId).filter(Boolean)
      }
    });
    sendJson(req, res, 200, result);
  } catch (error) {
    if (error?.statusCode) {
      sendJsonError(req, res, error, { error: 'governance_reference_search_failed' });
      return;
    }
    sendJson(req, res, error.status || 502, error.body || {
      error: 'governance_reference_search_failed',
      detail: error instanceof Error ? error.message : 'Governance reference search failed.'
    });
  }
};
