'use strict';

const { runtimeHealth } = require('./agentRuntime');
const { buildFeatureStatus, isFeatureEnabled } = require('./adminFeatureFlags');
const { auditStoreHealth } = require('./auditStore');
const { gatewayToken } = require('./compassGatewayClient');
const { evidenceVectorStoreHealth } = require('./evidenceVectorStore');
const { governanceReferenceHealth } = require('./governanceReferenceStore');
const { learningMemoryHealth } = require('./learningMemory');
const { authHealth } = require('./rbac');
const { operationalRequestSettings } = require('./requestLimits');
const { gatewayConfig, parserRelayConfig } = require('./runtimeConfig');
const { conversationLlmOperationalSettings } = require('./conversationLlmAssessor');

function vectorProviderName(provider = '') {
  return provider === 'qdrant' ? 'qdrant' : 'local-file';
}

function buildAdminStatus() {
  const auth = authHealth();
  const audit = auditStoreHealth();
  const vector = evidenceVectorStoreHealth();
  const governanceReference = governanceReferenceHealth();
  const learning = learningMemoryHealth();
  const runtime = runtimeHealth();
  const featureStatus = buildFeatureStatus();
  const gateway = gatewayConfig();
  const parserRelay = parserRelayConfig();
  const requestSettings = operationalRequestSettings();
  const llmSettings = conversationLlmOperationalSettings();

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
    governanceReference: {
      provider: vectorProviderName(governanceReference.provider),
      qdrantConfigured: Boolean(governanceReference.qdrantConfigured),
      collection: governanceReference.collection || '',
      classification: governanceReference.classification,
      authority: governanceReference.authority,
      advisoryOnly: true,
      humanReviewRequired: true
    },
    gateway: {
      required: true,
      configured: Boolean(gatewayToken()),
      baseUrlPresent: gateway.baseUrlPresent,
      llmCallsEnabled: Boolean(gatewayToken()),
      smartIntakeRequired: true,
      smartIntakeAvailable: Boolean(gatewayToken()),
      embeddingsEnabled: isFeatureEnabled('compassEmbeddings')
    },
    parserRelay: {
      configured: parserRelay.configured,
      featureEnabled: isFeatureEnabled('externalParserRelay')
    },
    runtime: {
      default: runtime.configuredRuntime || runtime.defaultRuntime || 'crewai_llm',
      deterministicDecisionOwner: true,
      liveLlmAdvisoryEnabled: Boolean(runtime.crewaiLlmCallsEnabled && isFeatureEnabled('liveAdvisorySpecialists')),
      liveCrewAIEnabled: isFeatureEnabled('liveCrewAI')
    },
    settings: {
      requestLimits: requestSettings.requestLimits,
      uploadTargetLimits: requestSettings.uploadTargetLimits,
      llmRetry: llmSettings.llmRetry,
      context: llmSettings.context
    },
    features: featureStatus.features,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  buildAdminStatus
};
