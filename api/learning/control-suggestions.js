'use strict';

const { getControlSuggestions } = require('../../lib/learningMemory');
const { authorizeRequest } = require('../../lib/rbac');
const { STANDARD_RUN_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  if (!rateLimitGuard(req, res, 'evidenceSearch')) return;
  try {
    const auth = await authorizeRequest(req, 'learning:read');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const body = req.method === 'POST' ? await readJsonRequest(req, { limitBytes: STANDARD_RUN_BODY_LIMIT_BYTES }) : {};
    sendJson(req, res, 200, await getControlSuggestions({
      ...body,
      workspaceId: auth.actor.workspaceId || process.env.P42_WORKSPACE_ID || 'parallax42',
      projectId: auth.actor.projectId || process.env.P42_PROJECT_ID || 'compliance-intelligence-agent'
    }));
  } catch (error) {
    if (error?.statusCode) {
      sendJsonError(req, res, error, { error: 'control_suggestions_failed' });
      return;
    }
    sendJson(req, res, 400, {
      error: 'control_suggestions_failed',
      detail: error instanceof Error ? error.message : String(error || 'Could not retrieve control suggestions.')
    });
  }
};
