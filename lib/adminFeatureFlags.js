'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_CONFIG_DIR = path.join(os.tmpdir(), 'p42-compliance-intelligence-agent');
const DEFAULT_CONFIG_FILE = 'admin-feature-flags.json';

const FEATURE_DEFINITIONS = [
  {
    id: 'compassLlmCalls',
    label: 'Compass LLM calls',
    description: 'Allows server-side calls to the Compass chat/completions boundary.',
    env: 'P42_FEATURE_COMPASS_LLM_CALLS',
    defaultEnabled: true
  },
  {
    id: 'compassEmbeddings',
    label: 'Compass embeddings',
    description: 'Allows server-side embedding, evidence indexing, and semantic retrieval calls through Compass.',
    env: 'P42_FEATURE_COMPASS_EMBEDDINGS',
    defaultEnabled: true
  },
  {
    id: 'qdrantRag',
    label: 'Qdrant-backed RAG',
    description: 'Uses Qdrant for evidence chunk storage and retrieval when Qdrant is configured.',
    env: 'P42_FEATURE_QDRANT_RAG',
    defaultEnabled: true
  },
  {
    id: 'qdrantLearningMemory',
    label: 'Qdrant-backed learning memory',
    description: 'Stores governed reviewer feedback and precedents in Qdrant when configured.',
    env: 'P42_FEATURE_QDRANT_LEARNING_MEMORY',
    defaultEnabled: true
  },
  {
    id: 'externalParserRelay',
    label: 'External parser/OCR relay',
    description: 'Allows browser-safe forwarding to the external document parser/OCR backend relay.',
    env: 'P42_FEATURE_EXTERNAL_PARSER_RELAY',
    defaultEnabled: true
  },
  {
    id: 'liveAdvisorySpecialists',
    label: 'Live advisory specialists',
    description: 'Allows optional advisory-only specialist reviews after deterministic council output.',
    env: 'P42_FEATURE_LIVE_ADVISORY_SPECIALISTS',
    defaultEnabled: true
  },
  {
    id: 'liveCrewAI',
    label: 'Live CrewAI',
    description: 'Requests live CrewAI/CrewAI LLM execution when optional Python dependencies and credentials exist.',
    env: 'P42_FEATURE_LIVE_CREWAI',
    defaultEnabled: true
  }
];

const FEATURE_IDS = new Set(FEATURE_DEFINITIONS.map((feature) => feature.id));
let crewaiDependencyCache = null;

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseBoolean(value) {
  if (value === true || value === false) return value;
  const text = cleanText(value).toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(text)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(text)) return false;
  return null;
}

function envPresent(...names) {
  return names.some((name) => cleanText(process.env[name]).length > 0);
}

function adminConfigPath() {
  return process.env.P42_ADMIN_FEATURE_CONFIG_PATH
    || path.join(process.env.P42_ADMIN_FEATURE_CONFIG_DIR || DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_FILE);
}

function readAdminConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(adminConfigPath(), 'utf8'));
    return {
      version: 1,
      updatedAt: parsed.updatedAt || '',
      updatedBy: parsed.updatedBy || '',
      features: parsed.features && typeof parsed.features === 'object' ? parsed.features : {}
    };
  } catch {
    return { version: 1, updatedAt: '', updatedBy: '', features: {} };
  }
}

function writeAdminConfig(config) {
  const filePath = adminConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function definitionFor(id) {
  const definition = FEATURE_DEFINITIONS.find((feature) => feature.id === id);
  if (!definition) throw new Error(`Unknown admin feature flag: ${id}`);
  return definition;
}

function adminOverrideFor(id, config = readAdminConfig()) {
  const entry = config.features?.[id];
  if (entry && typeof entry === 'object') return parseBoolean(entry.enabled);
  return parseBoolean(entry);
}

function envOverrideFor(definition) {
  return parseBoolean(process.env[definition.env]);
}

function featureState(id, config = readAdminConfig()) {
  const definition = definitionFor(id);
  const adminOverride = adminOverrideFor(id, config);
  const envOverride = envOverrideFor(definition);
  const enabled = adminOverride ?? envOverride ?? definition.defaultEnabled;
  return {
    id,
    label: definition.label,
    description: definition.description,
    enabled,
    defaultEnabled: definition.defaultEnabled,
    env: definition.env,
    source: adminOverride !== null ? 'admin' : envOverride !== null ? 'env' : 'default',
    adminOverride,
    envOverride
  };
}

function isFeatureEnabled(id) {
  return featureState(id).enabled;
}

function qdrantConfigured() {
  return envPresent('QDRANT_URL', 'P42_VECTOR_DB_URL');
}

function compassGatewayConfigured() {
  return envPresent('COMPASS_GATEWAY_TOKEN', 'PARALLAX42_GATEWAY_TOKEN');
}

function compassGatewayBaseUrlPresent() {
  return true;
}

function parserRelayBaseUrlPresent() {
  return true;
}

function crewAIServiceUrlConfigured() {
  return envPresent('P42_CREWAI_SERVICE_URL', 'CREWAI_SERVICE_URL');
}

function crewAIServiceTokenConfigured() {
  return envPresent('P42_CREWAI_SERVICE_TOKEN', 'CREWAI_SERVICE_TOKEN');
}

function crewaiDependencyAvailable() {
  if (crewaiDependencyCache !== null) return crewaiDependencyCache;
  try {
    const result = spawnSync('python3', ['-c', 'import crewai'], {
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 32 * 1024
    });
    crewaiDependencyCache = result.status === 0;
  } catch {
    crewaiDependencyCache = false;
  }
  return crewaiDependencyCache;
}

function featureRequirements(id) {
  const gatewayConfigured = compassGatewayConfigured();
  const qdrantReady = qdrantConfigured();
  const base = {
    configured: true,
    active: true,
    unmet: []
  };
  if (id === 'compassLlmCalls') {
    return {
      configured: gatewayConfigured,
      active: gatewayConfigured,
      unmet: gatewayConfigured ? [] : ['COMPASS_GATEWAY_TOKEN or PARALLAX42_GATEWAY_TOKEN']
    };
  }
  if (id === 'compassEmbeddings') {
    return {
      configured: gatewayConfigured,
      active: gatewayConfigured,
      unmet: gatewayConfigured ? [] : ['COMPASS_GATEWAY_TOKEN or PARALLAX42_GATEWAY_TOKEN']
    };
  }
  if (id === 'qdrantRag') {
    const embeddings = featureState('compassEmbeddings');
    const unmet = [];
    if (!qdrantReady) unmet.push('QDRANT_URL or P42_VECTOR_DB_URL');
    if (!embeddings.enabled) unmet.push('Compass embeddings feature enabled');
    if (!gatewayConfigured) unmet.push('COMPASS_GATEWAY_TOKEN or PARALLAX42_GATEWAY_TOKEN');
    return {
      configured: qdrantReady && gatewayConfigured,
      active: qdrantReady && gatewayConfigured && embeddings.enabled,
      unmet
    };
  }
  if (id === 'qdrantLearningMemory') {
    const embeddings = featureState('compassEmbeddings');
    const unmet = [];
    if (!qdrantReady) unmet.push('QDRANT_URL or P42_VECTOR_DB_URL');
    if (!embeddings.enabled) unmet.push('Compass embeddings feature enabled');
    if (!gatewayConfigured) unmet.push('COMPASS_GATEWAY_TOKEN or PARALLAX42_GATEWAY_TOKEN');
    return {
      configured: qdrantReady && gatewayConfigured,
      active: qdrantReady && gatewayConfigured && embeddings.enabled,
      unmet
    };
  }
  if (id === 'externalParserRelay') {
    return {
      configured: envPresent('PARALLAX42_BACKEND_URL'),
      active: parserRelayBaseUrlPresent(),
      unmet: [],
      note: envPresent('PARALLAX42_BACKEND_URL')
        ? 'External parser URL configured by environment.'
        : 'Default parser relay URL is available; set PARALLAX42_BACKEND_URL to pin an approved backend.'
    };
  }
  if (id === 'liveAdvisorySpecialists') {
    const llm = featureState('compassLlmCalls');
    const unmet = [];
    if (!llm.enabled) unmet.push('Compass LLM calls feature enabled');
    if (!gatewayConfigured) unmet.push('COMPASS_GATEWAY_TOKEN or PARALLAX42_GATEWAY_TOKEN');
    return {
      configured: gatewayConfigured,
      active: gatewayConfigured && llm.enabled,
      unmet
    };
  }
  if (id === 'liveCrewAI') {
    const llm = featureState('compassLlmCalls');
    const unmet = [];
    const dependencyAvailable = crewaiDependencyAvailable();
    const remoteConfigured = crewAIServiceUrlConfigured();
    const remoteTokenConfigured = crewAIServiceTokenConfigured();
    if (!llm.enabled) unmet.push('Compass LLM calls feature enabled');
    if (remoteConfigured) {
      if (!remoteTokenConfigured) unmet.push('P42_CREWAI_SERVICE_TOKEN or CREWAI_SERVICE_TOKEN');
    } else {
      if (!gatewayConfigured && !envPresent('CREWAI_LLM_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'AZURE_API_KEY')) {
        unmet.push('CrewAI provider API key or Compass gateway token');
      }
      if (!dependencyAvailable) unmet.push('Python CrewAI package installed in runtime or P42_CREWAI_SERVICE_URL configured');
    }
    return {
      configured: unmet.length === 0,
      active: unmet.length === 0,
      unmet,
      note: remoteConfigured
        ? 'Live CrewAI is delegated to the remote Python CrewAI service.'
        : dependencyAvailable
          ? 'Optional Python CrewAI dependency is importable in this runtime.'
          : 'Live CrewAI is requested but will degrade to deterministic council until optional Python CrewAI dependencies or a remote CrewAI service are configured.'
    };
  }
  return base;
}

function buildFeatureStatus() {
  const config = readAdminConfig();
  const features = FEATURE_DEFINITIONS.map((definition) => {
    const state = featureState(definition.id, config);
    const requirements = featureRequirements(definition.id);
    return {
      ...state,
      configured: Boolean(requirements.configured),
      active: Boolean(state.enabled && requirements.active),
      unmetRequirements: state.enabled ? requirements.unmet || [] : [],
      note: requirements.note || ''
    };
  });
  return {
    ok: true,
    service: 'parallax42-compliance-intelligence-agent',
    defaultPolicy: 'all-capabilities-requested-by-default-with-safe-degradation',
    configPath: adminConfigPath(),
    updatedAt: config.updatedAt || '',
    updatedBy: config.updatedBy || '',
    gateway: {
      tokenConfigured: compassGatewayConfigured(),
      baseUrlPresent: compassGatewayBaseUrlPresent()
    },
    qdrant: {
      configured: qdrantConfigured()
    },
    parserRelay: {
      configured: envPresent('PARALLAX42_BACKEND_URL'),
      baseUrlPresent: parserRelayBaseUrlPresent()
    },
    crewai: {
      pythonDependencyAvailable: crewaiDependencyAvailable(),
      remoteServiceConfigured: crewAIServiceUrlConfigured(),
      remoteServiceAuthConfigured: crewAIServiceTokenConfigured()
    },
    features,
    timestamp: new Date().toISOString()
  };
}

function updateFeatureFlags(updates = {}, actor = {}) {
  const config = readAdminConfig();
  const now = new Date().toISOString();
  const changed = [];
  config.features = config.features && typeof config.features === 'object' ? config.features : {};
  Object.entries(updates || {}).forEach(([id, value]) => {
    if (!FEATURE_IDS.has(id)) return;
    const enabled = parseBoolean(value);
    if (enabled === null) return;
    config.features[id] = {
      enabled,
      updatedAt: now,
      updatedBy: cleanText(actor.username || actor.id || actor.email || 'admin-api')
    };
    changed.push(id);
  });
  config.updatedAt = now;
  config.updatedBy = cleanText(actor.username || actor.id || actor.email || 'admin-api');
  writeAdminConfig(config);
  return {
    ...buildFeatureStatus(),
    changed
  };
}

module.exports = {
  FEATURE_DEFINITIONS,
  adminConfigPath,
  buildFeatureStatus,
  compassGatewayConfigured,
  featureState,
  isFeatureEnabled,
  qdrantConfigured,
  readAdminConfig,
  updateFeatureFlags
};
