'use strict';

const { buildAdminStatus } = require('../../lib/adminStatus');
const { methodGuard, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  sendJson(req, res, 200, buildAdminStatus());
};
