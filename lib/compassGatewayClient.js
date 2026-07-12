'use strict';

const crypto = require('node:crypto');

const { isFeatureEnabled } = require('./adminFeatureFlags');
const {
  DEFAULT_EMBEDDINGS_MODEL,
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_LLM_MODEL,
  cleanText,
  gatewayConfig,
  stripTrailingSlash
} = require('./runtimeConfig');

const MAX_DIRECT_CHUNK_CHARS = 1400;
const DEFAULT_GATEWAY_TIMEOUT_MS = 30000;
const DEFAULT_DEMO_VECTOR_SIZE = 3072;
const DEMO_EMBEDDINGS_MODEL = 'p42-demo-hash-embedding-v1';
const EMBEDDINGS_MODEL = DEFAULT_EMBEDDINGS_MODEL;
const LLM_MODEL = DEFAULT_LLM_MODEL;

function gatewayTimeoutMs() {
  const configured = Number(process.env.P42_GATEWAY_TIMEOUT_MS || DEFAULT_GATEWAY_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_GATEWAY_TIMEOUT_MS;
  return Math.max(1000, Math.min(120000, Math.round(configured)));
}

function requestOptionsWithTimeout(options = {}) {
  if (options.signal) return options;
  return {
    ...options,
    signal: AbortSignal.timeout(gatewayTimeoutMs())
  };
}

function gatewayBaseUrl() {
  return gatewayConfig().baseUrl || DEFAULT_GATEWAY_BASE_URL;
}

function gatewayToken() {
  return gatewayConfig().token;
}

function demoEmbeddingsEnabled() {
  return /^(1|true|yes|on)$/i.test(String(process.env.P42_DEMO_EMBEDDINGS || '').trim());
}

function demoVectorSize() {
  const configured = Number(process.env.QDRANT_VECTOR_SIZE || DEFAULT_DEMO_VECTOR_SIZE);
  if (!Number.isFinite(configured)) return DEFAULT_DEMO_VECTOR_SIZE;
  return Math.max(64, Math.min(4096, Math.round(configured)));
}

function deterministicDemoEmbedding(input = '', size = demoVectorSize()) {
  const vector = new Array(size).fill(0);
  const tokens = cleanText(input).toLowerCase().match(/[a-z0-9][a-z0-9_-]+/g) || [];
  const features = tokens.concat(tokens.slice(1).map((token, index) => `${tokens[index]}::${token}`));
  for (const feature of features) {
    const digest = crypto.createHash('sha256').update(feature).digest();
    const index = digest.readUInt32BE(0) % size;
    vector[index] += (digest[4] & 1) ? 1 : -1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  return norm ? vector.map((value) => value / norm) : vector;
}

function isDirectOpenAICompatibleBase(baseUrl = gatewayBaseUrl()) {
  const config = gatewayConfig();
  return stripTrailingSlash(baseUrl) === config.baseUrl && config.directOpenAiCompatible;
}

function gatewayHealth() {
  const baseUrl = gatewayBaseUrl();
  const directOpenAiCompatible = isDirectOpenAICompatibleBase(baseUrl);
  return {
    baseUrl,
    tokenConfigured: Boolean(gatewayToken()),
    directOpenAiCompatible,
    features: {
      llmCallsEnabled: Boolean(gatewayToken()) && isFeatureEnabled('compassLlmCalls'),
      embeddingsEnabled: (Boolean(gatewayToken()) && isFeatureEnabled('compassEmbeddings')) || demoEmbeddingsEnabled(),
      deterministicDemoEmbeddings: demoEmbeddingsEnabled()
    },
    llmModel: DEFAULT_LLM_MODEL,
    embeddingsModel: demoEmbeddingsEnabled() && !gatewayToken()
      ? DEMO_EMBEDDINGS_MODEL
      : gatewayConfig().embeddingsModel || DEFAULT_EMBEDDINGS_MODEL,
    reusableRoutes: [
      '/api/compass',
      '/api/chat/completions',
      '/api/embeddings',
      '/api/evidence/index',
      '/api/evidence/search',
      '/api/reference/index',
      '/api/reference/search'
    ]
  };
}

function retryAfterHeader(response = {}) {
  return response.headers?.get?.('retry-after') || response.headers?.get?.('Retry-After') || '';
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
  const response = await fetch(`${gatewayBaseUrl()}${path}`, requestOptionsWithTimeout({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-parallax42-gateway-token': gatewayToken()
    },
    body: JSON.stringify(withContext(payload))
  }));
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
    error.retryAfter = retryAfterHeader(response);
    throw error;
  }
  return body;
}

async function postOpenAiCompatible(path, payload, featureId = '') {
  assertConfigured(featureId);
  const response = await fetch(`${gatewayBaseUrl()}${path}`, requestOptionsWithTimeout({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${gatewayToken()}`
    },
    body: JSON.stringify(payload)
  }));
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
    const error = new Error(body.detail || body.error?.message || body.error || `Compass request failed: ${response.status}`);
    error.status = response.status;
    error.body = body;
    error.retryAfter = retryAfterHeader(response);
    throw error;
  }
  return body;
}

function extractEmbeddingVector(body = {}) {
  if (Array.isArray(body.embedding)) return body.embedding;
  if (Array.isArray(body.vector)) return body.vector;
  if (Array.isArray(body.data?.[0]?.embedding)) return body.data[0].embedding;
  if (Array.isArray(body.embeddings?.[0])) return body.embeddings[0];
  if (Array.isArray(body.embeddings?.[0]?.embedding)) return body.embeddings[0].embedding;
  if (Array.isArray(body.result?.embedding)) return body.result.embedding;
  return [];
}

function normalizeEmbeddingRows(body = {}, expectedCount = 1) {
  if (Array.isArray(body.data)) {
    return body.data.map((item) => Array.isArray(item.embedding) ? item.embedding : []).slice(0, expectedCount);
  }
  if (Array.isArray(body.embeddings)) {
    return body.embeddings.map((item) => Array.isArray(item) ? item : item.embedding || []).slice(0, expectedCount);
  }
  return [extractEmbeddingVector(body)].slice(0, expectedCount);
}

function chunkText(text = '', maxChars = MAX_DIRECT_CHUNK_CHARS) {
  const clean = cleanText(text);
  if (!clean) return [];
  const chunks = [];
  for (let index = 0; index < clean.length; index += maxChars) {
    chunks.push(clean.slice(index, index + maxChars));
  }
  return chunks;
}

function normalizeDocuments(payload = {}) {
  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  if (documents.length) return documents;
  if (payload.text || payload.summary || payload.brief) {
    return [{
      evidenceId: payload.evidenceId || 'EVIDENCE-01',
      title: payload.title || payload.fileName || 'Submitted evidence',
      text: payload.text || payload.summary || payload.brief,
      source: payload.source || 'submitted_text'
    }];
  }
  return [];
}

function evidenceChunks(payload = {}, defaultSource = 'submitted_evidence') {
  const chunks = [];
  normalizeDocuments(payload).forEach((document, documentIndex) => {
    const evidenceId = cleanText(document.evidenceId || document.documentId || `DOC-${documentIndex + 1}`);
    const title = cleanText(document.title || document.fileName || evidenceId);
    chunkText(document.text || document.summary || document.excerpt || '').forEach((text, chunkIndex) => {
      chunks.push({
        chunkId: `${evidenceId}_CHUNK_${String(chunkIndex + 1).padStart(2, '0')}`,
        evidenceId,
        documentId: cleanText(document.documentId || evidenceId),
        title,
        fileName: cleanText(document.fileName || ''),
        text,
        snippet: text.slice(0, 700),
        chunkIndex,
        source: cleanText(document.source || defaultSource),
        metadata: {
          sourceType: cleanText(document.sourceType || document.source || defaultSource),
          extractionStatus: cleanText(document.extractionStatus || 'parsed_text'),
          documentType: cleanText(document.documentType || ''),
          fileName: cleanText(document.fileName || '')
        },
        tags: Array.isArray(document.tags) ? document.tags : [],
        domains: Array.isArray(document.domains) ? document.domains : []
      });
    });
  });
  return chunks;
}

function cosineSimilarity(a = [], b = []) {
  const length = Math.min(a.length, b.length);
  if (!length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index += 1) {
    const av = Number(a[index] || 0);
    const bv = Number(b[index] || 0);
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function chatCompletion(payload = {}) {
  const requestBody = {
    model: payload.model || process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    temperature: payload.temperature ?? 0.1,
    max_tokens: payload.max_tokens || payload.maxTokens || undefined,
    messages: payload.messages || [],
    ...(payload.response_format ? { response_format: payload.response_format } : {}),
    ...(payload.responseFormat ? { response_format: payload.responseFormat } : {})
  };
  if (isDirectOpenAICompatibleBase()) {
    return postOpenAiCompatible('/chat/completions', requestBody, 'compassLlmCalls');
  }
  assertConfigured('compassLlmCalls');
  const response = await fetch(`${gatewayBaseUrl()}/chat/completions`, requestOptionsWithTimeout({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${gatewayToken()}`,
      'x-parallax42-gateway-token': gatewayToken()
    },
    body: JSON.stringify(requestBody)
  }));
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
    error.retryAfter = retryAfterHeader(response);
    throw error;
  }
  return body;
}

async function embed(input, context = {}) {
  if (demoEmbeddingsEnabled() && !gatewayToken()) {
    return {
      ok: true,
      model: DEMO_EMBEDDINGS_MODEL,
      embedding: deterministicDemoEmbedding(input),
      deterministicDemo: true
    };
  }
  if (isDirectOpenAICompatibleBase()) {
    const body = await postOpenAiCompatible('/embeddings', {
      model: context.model || process.env.EMBEDDINGS_MODEL || EMBEDDINGS_MODEL,
      input
    }, 'compassEmbeddings');
    return {
      ...body,
      model: body.model || context.model || process.env.EMBEDDINGS_MODEL || EMBEDDINGS_MODEL,
      embedding: extractEmbeddingVector(body)
    };
  }
  return postGateway('/embeddings', {
    ...context,
    purpose: context.purpose || 'embedding',
    input
  });
}

async function indexEvidence(payload = {}) {
  if (demoEmbeddingsEnabled() && !gatewayToken()) {
    const context = withContext(payload);
    const chunks = evidenceChunks(payload, 'deterministic_demo_embedding');
    return {
      ok: true,
      model: DEMO_EMBEDDINGS_MODEL,
      context,
      chunking: { chunkCount: chunks.length },
      deterministicDemo: true,
      chunks: chunks.map((chunk) => ({
        ...chunk,
        embedding: deterministicDemoEmbedding(chunk.text)
      }))
    };
  }
  if (isDirectOpenAICompatibleBase()) {
    const context = withContext(payload);
    const chunks = evidenceChunks(payload, 'direct_compass_embedding');
    const inputs = chunks.map((chunk) => chunk.text);
    if (!inputs.length) {
      return {
        ok: true,
        model: process.env.EMBEDDINGS_MODEL || EMBEDDINGS_MODEL,
        context,
        chunking: { chunkCount: 0 },
        chunks: []
      };
    }
    const response = await postOpenAiCompatible('/embeddings', {
      model: process.env.EMBEDDINGS_MODEL || EMBEDDINGS_MODEL,
      input: inputs
    }, 'compassEmbeddings');
    const rows = normalizeEmbeddingRows(response, inputs.length);
    return {
      ok: true,
      model: response.model || process.env.EMBEDDINGS_MODEL || EMBEDDINGS_MODEL,
      context,
      chunking: { chunkCount: chunks.length },
      chunks: chunks.map((chunk, index) => ({
        ...chunk,
        embedding: rows[index] || []
      }))
    };
  }
  return postGateway('/evidence/index', {
    ...payload,
    purpose: payload.purpose || 'evidence_index'
  });
}

async function searchEvidence(payload = {}) {
  if ((demoEmbeddingsEnabled() && !gatewayToken()) || isDirectOpenAICompatibleBase()) {
    const chunks = Array.isArray(payload.chunks) ? payload.chunks : [];
    const embedded = await embed(payload.query || '', {
      caseId: payload.caseId,
      workspaceId: payload.workspaceId,
      projectId: payload.projectId,
      purpose: payload.purpose || 'evidence_search_query'
    });
    const queryVector = embedded.embedding || extractEmbeddingVector(embedded);
    const matches = chunks
      .filter((chunk) => Array.isArray(chunk.embedding))
      .map((chunk) => ({
        ...chunk,
        score: cosineSimilarity(queryVector, chunk.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(payload.topK || payload.limit || 8));
    return {
      ok: true,
      model: embedded.model || process.env.EMBEDDINGS_MODEL || EMBEDDINGS_MODEL,
      matches
    };
  }
  return postGateway('/evidence/search', {
    ...payload,
    purpose: payload.purpose || 'evidence_search'
  });
}

module.exports = {
  DEMO_EMBEDDINGS_MODEL,
  EMBEDDINGS_MODEL,
  LLM_MODEL,
  chatCompletion,
  deterministicDemoEmbedding,
  embed,
  gatewayBaseUrl,
  gatewayHealth,
  gatewayToken,
  indexEvidence,
  isDirectOpenAICompatibleBase,
  searchEvidence
};
