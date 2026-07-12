'use strict';

const { createDemoCase } = require('../../lib/caseLifecycle');
const { authorizeRequest } = require('../../lib/rbac');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'default')) return;
  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    if (auth.actor.sessionType !== 'demo') {
      sendJson(req, res, 403, { ok: false, error: 'demo_session_required' });
      return;
    }
    const body = await readJsonRequest(req, { limitBytes: 16 * 1024 });
    sendJson(req, res, 201, await createDemoCase(auth.actor, body.filename));
  } catch (error) {
    sendJsonError(req, res, error, { statusCode: error.statusCode || 400, error: error.code || 'demo_case_failed' });
  }
};
