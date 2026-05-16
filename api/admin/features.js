'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { buildFeatureStatus, updateFeatureFlags } = require('../../lib/adminFeatureFlags');
const { authorizeRequest } = require('../../lib/rbac');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'PATCH', 'POST'])) return;
  try {
    if (req.method === 'GET') {
      sendJson(req, res, 200, buildFeatureStatus());
      return;
    }

    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const body = await readJsonRequest(req);
    const updates = body.features && typeof body.features === 'object' ? body.features : body;
    const result = updateFeatureFlags(updates, auth.actor);
    appendAuditRecord({
      actor: auth.actor,
      caseId: 'admin-feature-controls',
      status: 'admin_features_updated',
      summary: `Updated admin feature controls: ${result.changed.join(', ') || 'none'}.`,
      payload: {
        changed: result.changed,
        features: result.features.map((feature) => ({
          id: feature.id,
          enabled: feature.enabled,
          active: feature.active,
          source: feature.source
        }))
      }
    });
    sendJson(req, res, 200, result);
  } catch (error) {
    sendJson(req, res, 500, {
      ok: false,
      error: 'admin_features_failed',
      detail: error instanceof Error ? error.message : String(error || 'Admin feature update failed.')
    });
  }
};
