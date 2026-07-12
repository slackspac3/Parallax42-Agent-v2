'use strict';

const { auditStoreHealth, verifyAuditChain } = require('../lib/auditStore');
const { buildFeatureStatus } = require('../lib/adminFeatureFlags');
const { runtimeHealth } = require('../lib/agentRuntime');
const { gatewayHealth } = require('../lib/compassGatewayClient');
const { evidenceVectorStoreHealth } = require('../lib/evidenceVectorStore');
const { governanceReferenceHealth } = require('../lib/governanceReferenceStore');
const { learningMemoryHealth } = require('../lib/learningMemory');
const { storeHealth } = require('../lib/recordStore');
const { authHealth, authorizeRequest } = require('../lib/rbac');
const { methodGuard, rateLimitGuard, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('vary', 'Authorization');
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'healthRead')) return;
  const auth = await authorizeRequest(req, 'health:read');
  if (!auth.ok) {
    sendJson(req, res, auth.statusCode, auth.body);
    return;
  }
  const auditStore = auditStoreHealth();
  let auditIntegrity;
  try {
    auditIntegrity = await verifyAuditChain({ actor: auth.actor });
  } catch {
    sendJson(req, res, 503, {
      ok: false,
      service: 'parallax42-compliance-intelligence-agent',
      error: 'audit_storage_unavailable',
      audit: { store: auditStore, integrity: { ok: false, reason: 'audit_storage_unavailable' } }
    });
    return;
  }
  const ready = !auditStore.durableRequired || (auditStore.durable && auditIntegrity.ok);
  sendJson(req, res, ready ? 200 : 503, {
    ok: ready,
    service: 'parallax42-compliance-intelligence-agent',
    runtime: 'vercel',
    mode: process.env.AGENT_MODE || 'crewai_llm',
    agentRuntime: runtimeHealth(),
    auth: authHealth(),
    adminFeatures: buildFeatureStatus(),
    audit: {
      store: auditStore,
      integrity: auditIntegrity
    },
    evidenceGateway: gatewayHealth(),
    evidenceVectorStore: evidenceVectorStoreHealth(),
    governanceReference: governanceReferenceHealth(),
    learningMemory: learningMemoryHealth(),
    sessionStore: storeHealth(),
    linkedBackend: process.env.PARALLAX42_BACKEND_URL || 'https://api.parallax42.bhavukarora.com',
    pagesOrigin: process.env.P42_PAGES_ORIGIN || 'https://slackspac3.github.io'
  });
};
