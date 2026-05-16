'use strict';

const { runtimeHealth } = require('./agentRuntime');
const { auditStoreHealth } = require('./auditStore');
const { gatewayBaseUrl, gatewayToken } = require('./compassGatewayClient');
const { evidenceVectorStoreHealth } = require('./evidenceVectorStore');
const { learningMemoryHealth } = require('./learningMemory');
const { authHealth } = require('./rbac');

function envPresent(...names) {
  return names.some((name) => String(process.env[name] || '').trim().length > 0);
}

function vectorProviderName(provider = '') {
  return provider === 'qdrant' ? 'qdrant' : 'local-file';
}

function buildAdminStatus() {
  const auth = authHealth();
  const audit = auditStoreHealth();
  const vector = evidenceVectorStoreHealth();
  const learning = learningMemoryHealth();
  const runtime = runtimeHealth();
  const gatewayBaseUrlPresent = Boolean(
    gatewayBaseUrl()
    || envPresent('COMPASS_GATEWAY_BASE_URL', 'P42_GATEWAY_BASE_URL', 'COMPASS_GATEWAY_URL')
  );

  return {
    status: 'ok',
    service: 'parallax42-compliance-intelligence-agent',
    auth: {
      mode: auth.mode,
      enforced: auth.enforced
    },
    audit: {
      provider: 'local-jsonl',
      hashChained: Boolean(audit.hashChained)
    },
    vector: {
      provider: vectorProviderName(vector.provider),
      qdrantConfigured: Boolean(vector.qdrantConfigured),
      collection: vector.collection || '',
      lastSmokeStatus: vector.lastSmokeStatus || null
    },
    learningMemory: {
      provider: vectorProviderName(learning.provider),
      qdrantConfigured: Boolean(learning.qdrantConfigured),
      collection: learning.collection || '',
      advisoryOnly: true,
      trainingUse: 'not_model_training'
    },
    gateway: {
      configured: Boolean(gatewayToken()),
      baseUrlPresent: gatewayBaseUrlPresent
    },
    parserRelay: {
      configured: envPresent('PARALLAX42_BACKEND_URL')
    },
    runtime: {
      default: runtime.configuredRuntime || runtime.defaultRuntime || 'crewai_flow',
      deterministicDecisionOwner: true,
      liveLlmAdvisoryEnabled: Boolean(runtime.crewaiLlmCallsEnabled)
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  buildAdminStatus
};
