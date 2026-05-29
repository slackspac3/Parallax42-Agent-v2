'use strict';

const { buildCouncilNarrative } = require('../../lib/councilNarrative');
const { authorizeRequest } = require('../../lib/rbac');
const { STANDARD_RUN_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const body = await readJsonRequest(req, { limitBytes: STANDARD_RUN_BODY_LIMIT_BYTES });
    const narrative = await buildCouncilNarrative(body.result || body.run || body);
    sendJson(req, res, 200, narrative);
  } catch (error) {
    sendJsonError(req, res, error, { error: 'case_narrative_failed' });
  }
};
