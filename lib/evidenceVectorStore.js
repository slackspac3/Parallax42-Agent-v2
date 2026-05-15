'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { indexEvidence, searchEvidence } = require('./compassGatewayClient');

const DEFAULT_COLLECTION = 'p42_compliance_evidence';
const DEFAULT_STORE_DIR = path.join(os.tmpdir(), 'p42-compliance-intelligence-agent');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildEvidenceRetrievalQuery(draft = {}) {
  return cleanText([
    draft.brief,
    draft.supplierName,
    draft.businessUnit,
    draft.geography,
    ...(Array.isArray(draft.integrations) ? draft.integrations : []),
    ...(Array.isArray(draft.riskSignals) ? draft.riskSignals : []),
    ...(Array.isArray(draft.evidenceSignals) ? draft.evidenceSignals : []),
    'compliance obligations missing evidence controls DPA continuity export control access approvals risk blockers'
  ].join(' ')).slice(0, 1800);
}

function vectorProvider() {
  if (cleanText(process.env.QDRANT_URL || process.env.P42_VECTOR_DB_URL)) return 'qdrant';
  return cleanText(process.env.P42_VECTOR_STORE_PROVIDER || 'local_file');
}

function vectorStoreDir() {
  return process.env.P42_VECTOR_STORE_DIR || process.env.AGENT_AUDIT_DIR || DEFAULT_STORE_DIR;
}

function vectorStoreFile() {
  return path.join(vectorStoreDir(), 'evidence-vector-index.json');
}

function indexKey({ workspaceId = 'parallax42', projectId = 'compliance-intelligence-agent', caseId = '' } = {}) {
  return [workspaceId, projectId, caseId].map((value) => cleanText(value) || 'default').join('::');
}

function stableUuid(value = '') {
  const hex = crypto.createHash('sha256').update(cleanText(value) || crypto.randomUUID()).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

function safeChunkForClient(chunk = {}) {
  return {
    chunkId: chunk.chunkId || '',
    evidenceId: chunk.evidenceId || '',
    title: chunk.title || chunk.metadata?.title || '',
    textLength: cleanText(chunk.text).length,
    metadata: {
      sourceType: chunk.metadata?.sourceType || '',
      extractionStatus: chunk.metadata?.extractionStatus || '',
      fileName: chunk.metadata?.fileName || '',
      documentType: chunk.metadata?.documentType || ''
    }
  };
}

function sanitizeIndexResult(result = {}, stored = {}) {
  const chunks = Array.isArray(result.chunks) ? result.chunks : [];
  return {
    ok: result.ok !== false,
    model: result.model || result.embeddingModel || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
    context: result.context || stored.context || {},
    chunking: result.chunking || { chunkCount: chunks.length },
    index: {
      caseId: stored.caseId || result.context?.caseId || '',
      workspaceId: stored.workspaceId || result.context?.workspaceId || '',
      projectId: stored.projectId || result.context?.projectId || '',
      provider: stored.provider || vectorProvider(),
      storage: stored.storage || 'server_side_vector_store',
      chunkCount: stored.chunkCount ?? chunks.length,
      evidenceIds: stored.evidenceIds || Array.from(new Set(chunks.map((chunk) => chunk.evidenceId).filter(Boolean))),
      chunkIds: chunks.map((chunk) => chunk.chunkId).filter(Boolean).slice(0, 50),
      updatedAt: stored.updatedAt || new Date().toISOString(),
      browserEmbeddingsRetained: false
    },
    chunks: chunks.map(safeChunkForClient)
  };
}

function readLocalStore() {
  try {
    return JSON.parse(fs.readFileSync(vectorStoreFile(), 'utf8'));
  } catch {
    return { version: 1, indexes: {} };
  }
}

function writeLocalStore(store) {
  fs.mkdirSync(vectorStoreDir(), { recursive: true });
  fs.writeFileSync(vectorStoreFile(), `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

async function storeLocalIndex({ key, caseId, workspaceId, projectId, chunks, result }) {
  const store = readLocalStore();
  const now = new Date().toISOString();
  store.indexes[key] = {
    caseId,
    workspaceId,
    projectId,
    model: result.model || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
    chunking: result.chunking || { chunkCount: chunks.length },
    context: result.context || {},
    chunks,
    evidenceIds: Array.from(new Set(chunks.map((chunk) => chunk.evidenceId).filter(Boolean))),
    updatedAt: now
  };
  writeLocalStore(store);
  return {
    provider: 'local_file',
    storage: 'server_side_local_vector_store',
    updatedAt: now,
    chunkCount: chunks.length,
    evidenceIds: store.indexes[key].evidenceIds
  };
}

async function loadLocalChunks({ key }) {
  const store = readLocalStore();
  const index = store.indexes?.[key];
  if (!index) return { chunks: [], index: null };
  return { chunks: Array.isArray(index.chunks) ? index.chunks : [], index };
}

function qdrantConfig() {
  const baseUrl = cleanText(process.env.QDRANT_URL || process.env.P42_VECTOR_DB_URL).replace(/\/+$/, '');
  return {
    baseUrl,
    apiKey: cleanText(process.env.QDRANT_API_KEY || process.env.P42_VECTOR_DB_API_KEY),
    collection: cleanText(process.env.QDRANT_COLLECTION || process.env.P42_VECTOR_DB_COLLECTION || DEFAULT_COLLECTION)
  };
}

async function qdrantFetch(pathname, options = {}) {
  const config = qdrantConfig();
  if (!config.baseUrl) throw new Error('QDRANT_URL or P42_VECTOR_DB_URL is not configured.');
  const headers = {
    'content-type': 'application/json',
    ...(options.headers || {})
  };
  if (config.apiKey) headers['api-key'] = config.apiKey;
  const response = await fetch(`${config.baseUrl}${pathname}`, {
    ...options,
    headers
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
    throw new Error(body.status?.error || body.error || `Qdrant request failed: ${response.status}`);
  }
  return body;
}

async function ensureQdrantCollection(size) {
  const { collection } = qdrantConfig();
  try {
    await qdrantFetch(`/collections/${encodeURIComponent(collection)}`, { method: 'GET' });
  } catch {
    await qdrantFetch(`/collections/${encodeURIComponent(collection)}`, {
      method: 'PUT',
      body: JSON.stringify({
        vectors: {
          size,
          distance: 'Cosine'
        }
      })
    });
  }
}

async function storeQdrantIndex({ caseId, workspaceId, projectId, chunks, result }) {
  const vectorSize = chunks.find((chunk) => Array.isArray(chunk.embedding))?.embedding?.length || 0;
  if (!vectorSize) throw new Error('No embeddings were returned for vector storage.');
  await ensureQdrantCollection(vectorSize);
  const { collection } = qdrantConfig();
  const now = new Date().toISOString();
  const points = chunks
    .filter((chunk) => Array.isArray(chunk.embedding))
    .map((chunk) => ({
      id: stableUuid(`${workspaceId}:${projectId}:${caseId}:${chunk.chunkId}`),
      vector: chunk.embedding,
      payload: {
        ...chunk,
        embedding: undefined,
        caseId,
        workspaceId,
        projectId,
        model: result.model || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
        updatedAt: now
      }
    }));
  await qdrantFetch(`/collections/${encodeURIComponent(collection)}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({ points })
  });
  return {
    provider: 'qdrant',
    storage: 'server_side_qdrant_vector_db',
    updatedAt: now,
    chunkCount: points.length,
    evidenceIds: Array.from(new Set(points.map((point) => point.payload.evidenceId).filter(Boolean)))
  };
}

async function loadQdrantChunks({ caseId, workspaceId, projectId, limit = 512 }) {
  const { collection } = qdrantConfig();
  const body = await qdrantFetch(`/collections/${encodeURIComponent(collection)}/points/scroll`, {
    method: 'POST',
    body: JSON.stringify({
      limit,
      with_payload: true,
      with_vector: true,
      filter: {
        must: [
          { key: 'caseId', match: { value: caseId } },
          { key: 'workspaceId', match: { value: workspaceId } },
          { key: 'projectId', match: { value: projectId } }
        ]
      }
    })
  });
  const points = Array.isArray(body.result?.points) ? body.result.points : [];
  const chunks = points.map((point) => ({
    ...(point.payload || {}),
    embedding: point.vector
  }));
  return {
    chunks,
    index: {
      caseId,
      workspaceId,
      projectId,
      provider: 'qdrant',
      storage: 'server_side_qdrant_vector_db',
      chunkCount: chunks.length,
      evidenceIds: Array.from(new Set(chunks.map((chunk) => chunk.evidenceId).filter(Boolean)))
    }
  };
}

async function storeChunks(args) {
  if (vectorProvider() === 'qdrant') return storeQdrantIndex(args);
  return storeLocalIndex(args);
}

async function loadChunks(args) {
  if (vectorProvider() === 'qdrant') return loadQdrantChunks(args);
  return loadLocalChunks(args);
}

async function indexEvidenceServerSide(payload = {}) {
  const caseId = cleanText(payload.caseId);
  if (!caseId) throw new Error('caseId is required for server-side evidence indexing.');
  const workspaceId = payload.workspaceId || process.env.P42_WORKSPACE_ID || 'parallax42';
  const projectId = payload.projectId || process.env.P42_PROJECT_ID || 'compliance-intelligence-agent';
  const result = await indexEvidence({
    ...payload,
    caseId,
    workspaceId,
    projectId
  });
  const chunks = Array.isArray(result.chunks) ? result.chunks : [];
  const stored = await storeChunks({
    key: indexKey({ workspaceId, projectId, caseId }),
    caseId,
    workspaceId,
    projectId,
    chunks,
    result
  });
  return sanitizeIndexResult(result, {
    ...stored,
    caseId,
    workspaceId,
    projectId,
    context: result.context
  });
}

async function searchEvidenceServerSide(payload = {}) {
  const caseId = cleanText(payload.caseId);
  if (!caseId) throw new Error('caseId is required for server-side evidence search.');
  const workspaceId = payload.workspaceId || process.env.P42_WORKSPACE_ID || 'parallax42';
  const projectId = payload.projectId || process.env.P42_PROJECT_ID || 'compliance-intelligence-agent';
  const { chunks, index } = await loadChunks({
    key: indexKey({ workspaceId, projectId, caseId }),
    caseId,
    workspaceId,
    projectId,
    limit: Number(payload.limit || 512)
  });
  if (!chunks.length) {
    return {
      ok: true,
      model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
      context: { caseId, workspaceId, projectId, purpose: payload.purpose || 'evidence_search' },
      index: {
        caseId,
        workspaceId,
        projectId,
        provider: vectorProvider(),
        storage: index?.storage || 'server_side_vector_store',
        chunkCount: 0,
        evidenceIds: [],
        browserEmbeddingsRetained: false
      },
      matches: []
    };
  }
  const result = await searchEvidence({
    ...payload,
    caseId,
    workspaceId,
    projectId,
    chunks,
    topK: payload.topK || 8
  });
  return {
    ...result,
    index: {
      caseId,
      workspaceId,
      projectId,
      provider: index?.provider || vectorProvider(),
      storage: index?.storage || 'server_side_vector_store',
      chunkCount: chunks.length,
      evidenceIds: Array.from(new Set(chunks.map((chunk) => chunk.evidenceId).filter(Boolean))),
      browserEmbeddingsRetained: false
    }
  };
}

function evidenceVectorStoreHealth() {
  const provider = vectorProvider();
  const durableRequired = /^(1|true|yes|on)$/i.test(String(process.env.P42_REQUIRE_DURABLE_STORAGE || ''));
  const durable = provider === 'qdrant';
  return {
    provider,
    storage: provider === 'qdrant' ? 'server_side_qdrant_vector_db' : 'server_side_local_vector_store',
    durable,
    durableRequired,
    enterpriseReady: durable && Boolean(qdrantConfig().baseUrl),
    browserEmbeddingsRetained: false,
    localStorePath: provider === 'local_file' ? vectorStoreFile() : undefined,
    qdrantConfigured: Boolean(qdrantConfig().baseUrl),
    durabilityNote: durable
      ? 'Evidence chunks and embeddings are configured for managed server-side vector storage.'
      : durableRequired
        ? 'Durable vector storage is required but no managed vector DB is configured.'
        : 'Server-side local vector storage is acceptable for demos only; configure Qdrant or an approved managed store for production.'
  };
}

module.exports = {
  buildEvidenceRetrievalQuery,
  evidenceVectorStoreHealth,
  indexEvidenceServerSide,
  sanitizeIndexResult,
  searchEvidenceServerSide
};
