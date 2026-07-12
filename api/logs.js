'use strict';

const { methodGuard, rateLimitGuard, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'private, no-store');
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'healthRead')) return;
  sendJson(req, res, 404, {
    ok: false,
    error: 'not_found'
  });
};
