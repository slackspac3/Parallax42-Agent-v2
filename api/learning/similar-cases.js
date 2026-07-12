'use strict';

const { findSimilarCases } = require('../../lib/learningMemory');
const { authorizeRequest } = require('../../lib/rbac');
const { STANDARD_RUN_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'evidenceSearch')) return;
  try {
    const auth = await authorizeRequest(req, 'learning:read');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const body = await readJsonRequest(req, { limitBytes: STANDARD_RUN_BODY_LIMIT_BYTES });
    sendJson(req, res, 200, await findSimilarCases(body, { actor: auth.actor }));
  } catch (error) {
    if (error?.statusCode) {
      sendJsonError(req, res, error, { error: 'similar_cases_failed' });
      return;
    }
    sendJson(req, res, 400, {
      error: 'similar_cases_failed',
      detail: error instanceof Error ? error.message : String(error || 'Could not retrieve similar cases.')
    });
  }
};
