'use strict';

const { handleCaseApproval } = require('../../lib/caseApproval');
const { STANDARD_RUN_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'standardRun')) return;
  try {
    const body = await readJsonRequest(req, { limitBytes: STANDARD_RUN_BODY_LIMIT_BYTES });
    const result = await handleCaseApproval({ req, body });
    sendJson(req, res, result.status, result.body);
  } catch (error) {
    sendJsonError(req, res, error, { error: 'case_approval_failed' });
  }
};
