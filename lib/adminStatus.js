'use strict';

const { runtimeHealth } = require('./agentRuntime');
const { buildFeatureStatus, isFeatureEnabled } = require('./adminFeatureFlags');
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
  const featureStatus = buildFeatureStatus();
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
      featureEnabled: isFeatureEnabled('qdrantRag'),
      qdrantConfigured: Boolean(vector.qdrantConfigured),
      collection: vector.collection || '',
      lastSmokeStatus: vector.lastSmokeStatus || null
    },
    learningMemory: {
      provider: vectorProviderName(learning.provider),
      featureEnabled: isFeatureEnabled('qdrantLearningMemory'),
      qdrantConfigured: Boolean(learning.qdrantConfigured),
      collection: learning.collection || '',
      advisoryOnly: true,
      trainingUse: 'not_model_training'
    },
    gateway: {
      configured: Boolean(gatewayToken()),
      baseUrlPresent: gatewayBaseUrlPresent,
      llmCallsEnabled: isFeatureEnabled('compassLlmCalls'),
      embeddingsEnabled: isFeatureEnabled('compassEmbeddings')
    },
    parserRelay: {
      configured: envPresent('PARALLAX42_BACKEND_URL'),
      featureEnabled: isFeatureEnabled('externalParserRelay')
    },
    runtime: {
      default: runtime.configuredRuntime || runtime.defaultRuntime || 'crewai_llm',
      deterministicDecisionOwner: true,
      liveLlmAdvisoryEnabled: Boolean(runtime.crewaiLlmCallsEnabled && isFeatureEnabled('liveAdvisorySpecialists')),
      liveCrewAIEnabled: isFeatureEnabled('liveCrewAI')
    },
    features: featureStatus.features,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  buildAdminStatus
};
