'use strict';

const { authorizeRequest } = require('../../lib/rbac');
const { createDemoSession, revokeSession } = require('../../lib/sessionService');
const { methodGuard, rateLimitGuard, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!methodGuard(req, res, ['POST', 'DELETE'])) return;
  if (!rateLimitGuard(req, res, req.method === 'POST' ? 'demoSession' : 'default')) return;
  try {
    if (req.method === 'POST') {
      sendJson(req, res, 201, await createDemoSession());
      return;
    }
    const auth = await authorizeRequest(req, 'demo:read');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    await revokeSession(auth.actor);
    sendJson(req, res, 200, { ok: true, status: 'session_destroyed' });
  } catch (error) {
    sendJsonError(req, res, error, { statusCode: 500, error: 'demo_session_failed' });
  }
};
