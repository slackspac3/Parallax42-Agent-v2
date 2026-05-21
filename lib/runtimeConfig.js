'use strict';

const DEFAULT_GATEWAY_BASE_URL = 'https://parallax42-compass-gateway.vercel.app/api';
const DEFAULT_EMBEDDINGS_MODEL = 'text-embedding-3-large';
const DEFAULT_LLM_MODEL = 'gpt-5.1';
const DEFAULT_VECTOR_COLLECTION = 'p42_compliance_evidence';

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripTrailingSlash(value = '') {
  return cleanText(value).replace(/\/+$/, '');
}

function envPresent(...names) {
  return names.some((name) => cleanText(process.env[name]).length > 0);
}

function firstEnv(...names) {
  for (const name of names) {
    const value = cleanText(process.env[name]);
    if (value) return value;
  }
  return '';
}

function gatewayConfig() {
  const explicit = stripTrailingSlash(firstEnv('COMPASS_GATEWAY_BASE_URL', 'P42_GATEWAY_BASE_URL'));
  const compassUrl = stripTrailingSlash(firstEnv('COMPASS_GATEWAY_URL'));
  const openAiCompatibleUrl = stripTrailingSlash(firstEnv('OPENAI_BASE_URL', 'CREWAI_LLM_BASE_URL'));
  let baseUrl = explicit;
  if (!baseUrl && compassUrl.endsWith('/compass')) baseUrl = compassUrl.slice(0, -'/compass'.length);
  if (!baseUrl && compassUrl.endsWith('/api')) baseUrl = compassUrl;
  if (!baseUrl) baseUrl = compassUrl || openAiCompatibleUrl || DEFAULT_GATEWAY_BASE_URL;
  return {
    baseUrl,
    token: firstEnv('COMPASS_GATEWAY_TOKEN', 'PARALLAX42_GATEWAY_TOKEN', 'CREWAI_LLM_API_KEY', 'OPENAI_API_KEY'),
    baseUrlPresent: Boolean(baseUrl),
    tokenConfigured: envPresent('COMPASS_GATEWAY_TOKEN', 'PARALLAX42_GATEWAY_TOKEN', 'CREWAI_LLM_API_KEY', 'OPENAI_API_KEY'),
    directOpenAiCompatible: Boolean(openAiCompatibleUrl && baseUrl === openAiCompatibleUrl && !/\/api$/i.test(baseUrl)),
    llmModel: firstEnv('CONVERSATION_LLM_MODEL', 'CREWAI_LLM_MODEL') || DEFAULT_LLM_MODEL,
    embeddingsModel: firstEnv('EMBEDDINGS_MODEL', 'EMBEDDINGS_DEPLOYMENT') || DEFAULT_EMBEDDINGS_MODEL
  };
}

function vectorConfig() {
  const qdrantUrl = stripTrailingSlash(firstEnv('QDRANT_URL', 'P42_VECTOR_DB_URL'));
  const requestedProvider = cleanText(process.env.P42_VECTOR_STORE_PROVIDER || '').toLowerCase();
  return {
    requestedProvider,
    provider: requestedProvider || (qdrantUrl ? 'qdrant' : 'local_file'),
    qdrantUrl,
    qdrantApiKeyConfigured: envPresent('QDRANT_API_KEY', 'P42_VECTOR_DB_API_KEY'),
    qdrantConfigured: Boolean(qdrantUrl),
    collection: firstEnv('QDRANT_COLLECTION', 'P42_VECTOR_DB_COLLECTION') || DEFAULT_VECTOR_COLLECTION
  };
}

function parserRelayConfig() {
  return {
    configured: envPresent('PARALLAX42_BACKEND_URL'),
    backendUrl: firstEnv('PARALLAX42_BACKEND_URL') || 'https://api.parallax42.bhavukarora.com'
  };
}

function runtimeConfig() {
  return {
    defaultRuntime: firstEnv('AGENT_RUNTIME', 'AGENT_MODE') || 'crewai_llm',
    liveCrewAiRequested: /^(1|true|yes|on)$/i.test(firstEnv('CREWAI_ENABLE_LIVE_LLM', 'P42_ENABLE_LIVE_CREWAI')),
    authMode: firstEnv('P42_AUTH_MODE') || 'audit',
    workspaceId: firstEnv('P42_WORKSPACE_ID') || 'parallax42',
    projectId: firstEnv('P42_PROJECT_ID') || 'compliance-intelligence-agent'
  };
}

module.exports = {
  DEFAULT_EMBEDDINGS_MODEL,
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_LLM_MODEL,
  cleanText,
  envPresent,
  firstEnv,
  gatewayConfig,
  parserRelayConfig,
  runtimeConfig,
  stripTrailingSlash,
  vectorConfig
};
