'use strict';

const { buildGoldenWorkflowRun } = require('../../lib/goldenWorkflow');
const { methodGuard, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  sendJson(req, res, 200, buildGoldenWorkflowRun({ mode: 'vercel_golden_demo' }));
};
