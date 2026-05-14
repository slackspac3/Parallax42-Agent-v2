'use strict';

const { readRecentAuditRecords, verifyAuditChain } = require('../../lib/auditStore');
const { authorizeRequest } = require('../../lib/rbac');
const { methodGuard, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  const auth = await authorizeRequest(req, 'audit:read');
  if (!auth.ok) {
    sendJson(req, res, auth.statusCode, auth.body);
    return;
  }
  const limit = Number(req.query?.limit || 25);
  sendJson(req, res, 200, {
    integrity: verifyAuditChain(),
    records: readRecentAuditRecords(limit)
  });
};
