'use strict';

const { readRecentAuditRecords, verifyAuditChain } = require('../../lib/auditStore');
const { authorizeRequest } = require('../../lib/rbac');
const { methodGuard, rateLimitGuard, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('vary', 'Authorization');
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'adminRead')) return;
  const auth = await authorizeRequest(req, 'audit:read');
  if (!auth.ok) {
    sendJson(req, res, auth.statusCode, auth.body);
    return;
  }
  const limit = Number(req.query?.limit || 25);
  try {
    const [integrity, records] = await Promise.all([
      verifyAuditChain({ actor: auth.actor }),
      readRecentAuditRecords(limit, { actor: auth.actor })
    ]);
    sendJson(req, res, integrity.ok ? 200 : 503, { integrity, records });
  } catch {
    sendJson(req, res, 503, {
      error: 'audit_storage_unavailable',
      integrity: { ok: false, reason: 'audit_storage_unavailable' },
      records: []
    });
  }
};
