'use strict';

const { auditStoreHealth, readRecentAuditRecords, verifyAuditChain } = require('../lib/auditStore');
const { methodGuard, rateLimitGuard, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'healthRead')) return;
  const limit = Number(req.query?.limit || 25);
  const records = readRecentAuditRecords(limit);
  sendJson(req, res, 200, {
    ok: true,
    service: 'parallax42-compliance-intelligence-agent',
    endpoint: 'GET /logs',
    storage: auditStoreHealth(),
    integrity: verifyAuditChain(),
    entries: records,
    note: 'Public evaluator-style log endpoint. Records are redacted and hash-chained; Vercel /tmp audit storage is not enterprise-durable unless durable storage is configured.'
  });
};
