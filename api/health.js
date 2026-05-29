'use strict';

const { auditStoreHealth, verifyAuditChain } = require('../lib/auditStore');
const { buildFeatureStatus } = require('../lib/adminFeatureFlags');
const { runtimeHealth } = require('../lib/agentRuntime');
const { gatewayHealth } = require('../lib/compassGatewayClient');
const { evidenceVectorStoreHealth } = require('../lib/evidenceVectorStore');
const { governanceReferenceHealth } = require('../lib/governanceReferenceStore');
const { learningMemoryHealth } = require('../lib/learningMemory');
const { authHealth, authorizeRequest } = require('../lib/rbac');
const { methodGuard, rateLimitGuard, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'healthRead')) return;
  const auth = await authorizeRequest(req, 'health:read');
  if (!auth.ok) {
    sendJson(req, res, auth.statusCode, auth.body);
    return;
  }
  sendJson(req, res, 200, {
    ok: true,
    service: 'parallax42-compliance-intelligence-agent',
    runtime: 'vercel',
    mode: process.env.AGENT_MODE || 'crewai_llm',
    agentRuntime: runtimeHealth(),
    auth: authHealth(),
    adminFeatures: buildFeatureStatus(),
    audit: {
      store: auditStoreHealth(),
      integrity: verifyAuditChain()
    },
    evidenceGateway: gatewayHealth(),
    evidenceVectorStore: evidenceVectorStoreHealth(),
    governanceReference: governanceReferenceHealth(),
    learningMemory: learningMemoryHealth(),
    linkedBackend: process.env.PARALLAX42_BACKEND_URL || 'https://api.parallax42.bhavukarora.com',
    pagesOrigin: process.env.P42_PAGES_ORIGIN || 'https://slackspac3.github.io'
  });
};
