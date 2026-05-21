'use strict';

const { handleConversation } = require('../lib/httpHandlers');
const { methodGuard, readJsonRequest, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  const body = await readJsonRequest(req);
  const result = await handleConversation({ req, body });
  sendJson(req, res, result.status, result.body);
};
