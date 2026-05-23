'use strict';

const { buildCouncilNarrative } = require('../../lib/councilNarrative');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  const body = await readJsonRequest(req);
  const narrative = await buildCouncilNarrative(body.result || body.run || body);
  sendJson(req, res, 200, narrative);
};
