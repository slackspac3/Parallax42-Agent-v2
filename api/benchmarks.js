'use strict';

const { runBenchmark } = require('../lib/benchmarkSuite');
const { authorizeRequest } = require('../lib/rbac');
const { methodGuard, rateLimitGuard, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'healthRead')) return;
  const auth = await authorizeRequest(req, 'benchmarks:read');
  if (!auth.ok) {
    sendJson(req, res, auth.statusCode, auth.body);
    return;
  }
  sendJson(req, res, 200, runBenchmark());
};
