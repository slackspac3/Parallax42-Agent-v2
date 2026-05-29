'use strict';

const { buildGoldenWorkflowRun } = require('../../lib/goldenWorkflow');
const { authorizeRequest } = require('../../lib/rbac');
const { methodGuard, rateLimitGuard, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'healthRead')) return;
  const auth = await authorizeRequest(req, 'demo:read');
  if (!auth.ok) {
    sendJson(req, res, auth.statusCode, auth.body);
    return;
  }
  sendJson(req, res, 200, buildGoldenWorkflowRun({ mode: 'vercel_golden_demo' }));
};
