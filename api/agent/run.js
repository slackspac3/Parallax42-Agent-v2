'use strict';

const { handleAgentRun } = require('../../lib/httpHandlers');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  const body = await readJsonRequest(req);
  const result = await handleAgentRun({ req, body });
  sendJson(req, res, result.status, result.body);
};
