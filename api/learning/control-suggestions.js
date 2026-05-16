'use strict';

const { getControlSuggestions } = require('../../lib/learningMemory');
const { authorizeRequest } = require('../../lib/rbac');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const body = req.method === 'POST' ? await readJsonRequest(req) : {};
    sendJson(req, res, 200, await getControlSuggestions(body));
  } catch (error) {
    sendJson(req, res, 400, {
      error: 'control_suggestions_failed',
      detail: error instanceof Error ? error.message : String(error || 'Could not retrieve control suggestions.')
    });
  }
};
