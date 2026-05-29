'use strict';

const { handleReviewPack } = require('../../lib/httpHandlers');
const { REVIEW_PACK_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'reviewPack')) return;
  try {
    const body = await readJsonRequest(req, { limitBytes: REVIEW_PACK_BODY_LIMIT_BYTES });
    const result = await handleReviewPack({ req, body });
    sendJson(req, res, result.status, result.body);
  } catch (error) {
    sendJsonError(req, res, error, { error: 'review_pack_failed' });
  }
};
