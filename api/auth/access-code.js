'use strict';

const { exchangeAccessCode, pilotCookie } = require('../../lib/sessionService');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'accessCode')) return;
  try {
    const body = await readJsonRequest(req, { limitBytes: 8 * 1024 });
    const session = await exchangeAccessCode(body.code);
    res.setHeader('set-cookie', pilotCookie(session.token));
    sendJson(req, res, 200, {
      ok: true,
      sessionId: session.sessionId,
      workspaceId: session.workspaceId,
      expiresAt: session.expiresAt,
      roles: session.roles
    });
  } catch (error) {
    sendJsonError(req, res, error, { statusCode: 401, error: 'invalid_access_code' });
  }
};
