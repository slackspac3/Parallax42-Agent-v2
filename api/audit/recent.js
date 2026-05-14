'use strict';

const { readRecentAuditRecords } = require('../../lib/auditStore');
const { methodGuard, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  const limit = Number(req.query?.limit || 25);
  sendJson(req, res, 200, {
    records: readRecentAuditRecords(limit)
  });
};
