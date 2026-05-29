'use strict';

const { buildAdminStatus } = require('../../lib/adminStatus');
const { authorizeRequest } = require('../../lib/rbac');
const { methodGuard, rateLimitGuard, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'adminRead')) return;
  const auth = await authorizeRequest(req, 'health:read');
  if (!auth.ok) {
    sendJson(req, res, auth.statusCode, auth.body);
    return;
  }
  sendJson(req, res, 200, buildAdminStatus());
};
