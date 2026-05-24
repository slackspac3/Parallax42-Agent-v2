'use strict';

const { handleAgentRun } = require('../../lib/httpHandlers');
const { STANDARD_RUN_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const body = await readJsonRequest(req, { limitBytes: STANDARD_RUN_BODY_LIMIT_BYTES });
    const result = await handleAgentRun({ req, body });
    sendJson(req, res, result.status, result.body);
  } catch (error) {
    sendJsonError(req, res, error, { error: 'agent_run_failed' });
  }
};
