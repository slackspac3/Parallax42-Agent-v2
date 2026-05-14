'use strict';

const { runBenchmark } = require('../lib/benchmarkSuite');
const { methodGuard, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  sendJson(req, res, 200, runBenchmark());
};
