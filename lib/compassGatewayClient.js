'use strict';

const { isFeatureEnabled } = require('./adminFeatureFlags');

const DEFAULT_GATEWAY_BASE_URL = 'https://parallax42-compass-gateway.vercel.app/api';
const EMBEDDINGS_MODEL = 'text-embedding-3-large';
const LLM_MODEL = 'gpt-5.1';

function stripTrailingSlash(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

function gatewayBaseUrl() {
  const explicit = stripTrailingSlash(process.env.COMPASS_GATEWAY_BASE_URL || process.env.P42_GATEWAY_BASE_URL);
  if (explicit) return explicit;

  const compassUrl = stripTrailingSlash(process.env.COMPASS_GATEWAY_URL);
  if (compassUrl.endsWith('/compass')) return compassUrl.slice(0, -'/compass'.length);
  if (compassUrl.endsWith('/api')) return compassUrl;
  return compassUrl || DEFAULT_GATEWAY_BASE_URL;
}

function gatewayToken() {
  return String(process.env.COMPASS_GATEWAY_TOKEN || process.env.PARALLAX42_GATEWAY_TOKEN || '').trim();
}

function gatewayHealth() {
  return {
    baseUrl: gatewayBaseUrl(),
    tokenConfigured: Boolean(gatewayToken()),
    features: {
      llmCallsEnabled: isFeatureEnabled('compassLlmCalls'),
      embeddingsEnabled: isFeatureEnabled('compassEmbeddings')
    },
    llmModel: LLM_MODEL,
    embeddingsModel: process.env.EMBEDDINGS_MODEL || EMBEDDINGS_MODEL,
    reusableRoutes: [
      '/api/compass',
      '/api/chat/completions',
      '/api/embeddings',
      '/api/evidence/index',
      '/api/evidence/search'
    ]
  };
}

function assertConfigured(featureId = '') {
  if (featureId && !isFeatureEnabled(featureId)) {
    throw new Error(`${featureId} is disabled by admin feature controls.`);
  }
  if (!gatewayToken()) {
    throw new Error('COMPASS_GATEWAY_TOKEN is not configured.');
  }
}

function withContext(payload = {}) {
  return {
    workspaceId: payload.workspaceId || process.env.P42_WORKSPACE_ID || 'parallax42',
    projectId: payload.projectId || process.env.P42_PROJECT_ID || 'compliance-intelligence-agent',
    caseId: payload.caseId || '',
    purpose: payload.purpose || 'compliance_evidence',
    ...payload
  };
}

async function postGateway(path, payload) {
  assertConfigured('compassEmbeddings');
  const response = await fetch(`${gatewayBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-parallax42-gateway-token': gatewayToken()
    },
    body: JSON.stringify(withContext(payload))
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const error = new Error(body.detail || body.error || `Gateway request failed: ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function chatCompletion(payload = {}) {
  assertConfigured('compassLlmCalls');
  const response = await fetch(`${gatewayBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${gatewayToken()}`,
      'x-parallax42-gateway-token': gatewayToken()
    },
    body: JSON.stringify({
      model: payload.model || process.env.CREWAI_LLM_MODEL || LLM_MODEL,
      temperature: payload.temperature ?? 0.1,
      messages: payload.messages || []
    })
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const error = new Error(body.detail || body.error || `Gateway chat request failed: ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function embed(input, context = {}) {
  return postGateway('/embeddings', {
    ...context,
    purpose: context.purpose || 'embedding',
    input
  });
}

function indexEvidence(payload = {}) {
  return postGateway('/evidence/index', {
    ...payload,
    purpose: payload.purpose || 'evidence_index'
  });
}

function searchEvidence(payload = {}) {
  return postGateway('/evidence/search', {
    ...payload,
    purpose: payload.purpose || 'evidence_search'
  });
}

module.exports = {
  EMBEDDINGS_MODEL,
  LLM_MODEL,
  chatCompletion,
  embed,
  gatewayBaseUrl,
  gatewayHealth,
  gatewayToken,
  indexEvidence,
  searchEvidence
};
