'use strict';

const { methodGuard, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  sendJson(req, res, 200, {
    ok: true,
    service: 'parallax42-compliance-intelligence-agent',
    runtime: 'vercel',
    mode: process.env.AGENT_MODE || 'local_deterministic',
    linkedBackend: process.env.PARALLAX42_BACKEND_URL || 'https://api.parallax42.bhavukarora.com',
    pagesOrigin: process.env.P42_PAGES_ORIGIN || 'https://slackspac3.github.io'
  });
};
