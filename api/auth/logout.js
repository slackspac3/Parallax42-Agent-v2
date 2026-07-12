'use strict';

const { authorizeRequest } = require('../../lib/rbac');
const { pilotCookie, revokeSession } = require('../../lib/sessionService');
const { methodGuard, rateLimitGuard, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'default')) return;
  try {
    const auth = await authorizeRequest(req, 'demo:read');
    if (auth.ok) await revokeSession(auth.actor);
    res.setHeader('set-cookie', pilotCookie('', { clear: true }));
    sendJson(req, res, 200, { ok: true, status: 'signed_out' });
  } catch (error) {
    sendJsonError(req, res, error, { statusCode: 500, error: 'logout_failed' });
  }
};
