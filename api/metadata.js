'use strict';

const metadata = require('../metadata.json');
const { methodGuard, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  sendJson(req, res, 200, metadata);
};
