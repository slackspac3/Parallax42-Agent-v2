'use strict';

const { handleCaseApproval } = require('../../lib/caseApproval');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  const body = await readJsonRequest(req);
  const result = await handleCaseApproval({ req, body });
  sendJson(req, res, result.status, result.body);
};
