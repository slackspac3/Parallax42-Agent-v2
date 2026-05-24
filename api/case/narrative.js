'use strict';

const { buildCouncilNarrative } = require('../../lib/councilNarrative');
const { STANDARD_RUN_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const body = await readJsonRequest(req, { limitBytes: STANDARD_RUN_BODY_LIMIT_BYTES });
    const narrative = await buildCouncilNarrative(body.result || body.run || body);
    sendJson(req, res, 200, narrative);
  } catch (error) {
    sendJsonError(req, res, error, { error: 'case_narrative_failed' });
  }
};
