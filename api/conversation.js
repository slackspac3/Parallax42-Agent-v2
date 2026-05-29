'use strict';

const { handleConversation } = require('../lib/httpHandlers');
const { CONVERSATION_BODY_LIMIT_BYTES } = require('../lib/requestLimits');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'conversation')) return;
  try {
    const body = await readJsonRequest(req, { limitBytes: CONVERSATION_BODY_LIMIT_BYTES });
    const result = await handleConversation({ req, body });
    sendJson(req, res, result.status, result.body);
  } catch (error) {
    sendJsonError(req, res, error, { error: 'conversation_failed' });
  }
};
