'use strict';

const { handleEvidenceSearch } = require('../../lib/httpHandlers');
const { EVIDENCE_SEARCH_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'evidenceSearch')) return;

  try {
    const body = await readJsonRequest(req, { limitBytes: EVIDENCE_SEARCH_BODY_LIMIT_BYTES });
    const result = await handleEvidenceSearch({ req, body });
    sendJson(req, res, result.status, result.body);
  } catch (error) {
    sendJsonError(req, res, error, { error: 'evidence_search_failed' });
  }
};
