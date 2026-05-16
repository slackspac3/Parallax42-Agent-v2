'use strict';

const { findSimilarCases } = require('../../lib/learningMemory');
const { authorizeRequest } = require('../../lib/rbac');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const body = await readJsonRequest(req);
    sendJson(req, res, 200, await findSimilarCases(body));
  } catch (error) {
    sendJson(req, res, 400, {
      error: 'similar_cases_failed',
      detail: error instanceof Error ? error.message : String(error || 'Could not retrieve similar cases.')
    });
  }
};
