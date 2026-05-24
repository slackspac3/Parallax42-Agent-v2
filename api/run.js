'use strict';

const { handleStandardRun } = require('../lib/httpHandlers');
const { STANDARD_RUN_BODY_LIMIT_BYTES } = require('../lib/requestLimits');
const { methodGuard, readJsonRequest, sendJson, sendJsonError } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const body = await readJsonRequest(req, { limitBytes: STANDARD_RUN_BODY_LIMIT_BYTES });
    const result = await handleStandardRun({ req, body, startedAt: Date.now() });
    sendJson(req, res, result.status, result.body);
  } catch (error) {
    sendJsonError(req, res, error, { error: 'run_failed' });
  }
};
