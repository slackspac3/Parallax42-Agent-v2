'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { isFeatureEnabled } = require('./adminFeatureFlags');
const { embed, indexEvidence, searchEvidence } = require('./compassGatewayClient');

const DEFAULT_COLLECTION = 'p42_compliance_evidence';
const DEFAULT_STORE_DIR = path.join(os.tmpdir(), 'p42-compliance-intelligence-agent');
const LAST_SMOKE_FILE = 'qdrant-smoke-status.json';
const DEFAULT_QDRANT_TIMEOUT_MS = 30000;

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function configuredText(value = '') {
  const text = cleanText(value);
  return /^(undefined|null)$/i.test(text) ? '' : text;
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

function qdrantBaseUrl() {
  return cleanText(process.env.QDRANT_URL || process.env.P42_VECTOR_DB_URL).replace(/\/+$/, '');
}

function vectorProvider() {
  const requested = cleanText(process.env.P42_VECTOR_STORE_PROVIDER || '').toLowerCase();
  const qdrantConfigured = Boolean(qdrantBaseUrl());
  const qdrantEnabled = isFeatureEnabled('qdrantRag');
  if (requested === 'qdrant') return qdrantEnabled && qdrantConfigured ? 'qdrant' : 'local_file';
  if (!requested && qdrantEnabled && qdrantConfigured) return 'qdrant';
  return requested || 'local_file';
}

function vectorStoreDir() {
  return process.env.P42_VECTOR_STORE_DIR || process.env.AGENT_AUDIT_DIR || DEFAULT_STORE_DIR;
}

function vectorStoreFile() {
  return path.join(vectorStoreDir(), 'evidence-vector-index.json');
}

function qdrantSmokeStatusFile() {
  return path.join(vectorStoreDir(), LAST_SMOKE_FILE);
}

function indexKey({ workspaceId = 'parallax42', projectId = 'compliance-intelligence-agent', caseId = '' } = {}) {
  return [workspaceId, projectId, caseId].map((value) => cleanText(value) || 'default').join('::');
}

function truthy(value = '') {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function actorScopeId(actor = {}) {
  if (!actor || typeof actor !== 'object' || !actor.authenticated) return '';
  const raw = cleanText(actor.id || actor.sub || actor.username || actor.email);
  if (!raw) return '';
  return crypto.createHash('sha256').update(raw.toLowerCase()).digest('hex').slice(0, 20);
}

function vectorNamespace(payload = {}, options = {}) {
  const trustClientNamespace = truthy(process.env.P42_TRUST_CLIENT_VECTOR_NAMESPACE);
  const actor = options.actor || payload.actor || {};
  const actorWorkspaceId = configuredText(actor.workspaceId);
  const baseWorkspaceId = actorWorkspaceId || configuredText(process.env.P42_WORKSPACE_ID) || (trustClientNamespace ? configuredText(payload.workspaceId) : '') || 'parallax42';
  const projectId = configuredText(actor.projectId) || configuredText(process.env.P42_PROJECT_ID) || (trustClientNamespace ? configuredText(payload.projectId) : '') || 'compliance-intelligence-agent';
  const scope = actorWorkspaceId ? '' : actorScopeId(actor);
  return {
    workspaceId: scope ? `${baseWorkspaceId}:actor:${scope}` : baseWorkspaceId,
    projectId,
    actorScoped: Boolean(scope || actorWorkspaceId)
  };
}

function stableUuid(value = '') {
  const hex = crypto.createHash('sha256').update(cleanText(value) || crypto.randomUUID()).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

function safeChunkForClient(chunk = {}) {
  const metadata = chunk.metadata || {};
  return {
    chunkId: chunk.chunkId || '',
    evidenceId: chunk.evidenceId || '',
    documentId: chunk.documentId || metadata.documentId || chunk.evidenceId || '',
    title: chunk.title || metadata.title || '',
    fileName: chunk.fileName || metadata.fileName || '',
    chunkIndex: Number.isFinite(Number(chunk.chunkIndex)) ? Number(chunk.chunkIndex) : undefined,
    snippet: cleanText(chunk.snippet || chunk.text || chunk.summary || '').slice(0, 520),
    textLength: cleanText(chunk.text).length,
    metadata: {
      sourceType: metadata.sourceType || chunk.sourceType || '',
      extractionStatus: metadata.extractionStatus || chunk.extractionStatus || '',
      fileName: metadata.fileName || chunk.fileName || '',
      documentType: metadata.documentType || chunk.documentType || '',
      source: metadata.source || chunk.source || ''
    }
  };
}

function safeMatchForClient(match = {}) {
  const metadata = match.metadata || match.payload?.metadata || {};
  const payload = match.payload || {};
  const snippet = cleanText(
    match.snippet
    || match.text
    || payload.snippet
    || payload.text
    || match.summary
    || ''
  ).slice(0, 700);
  return {
    chunkId: match.chunkId || payload.chunkId || '',
    evidenceId: match.evidenceId || payload.evidenceId || '',
    documentId: match.documentId || payload.documentId || match.evidenceId || payload.evidenceId || '',
    title: match.title || payload.title || metadata.title || '',
    fileName: match.fileName || payload.fileName || metadata.fileName || '',
    chunkIndex: Number.isFinite(Number(match.chunkIndex ?? payload.chunkIndex)) ? Number(match.chunkIndex ?? payload.chunkIndex) : undefined,
    score: Number(match.score || 0),
    snippet,
    text: snippet,
    citation: {
      evidenceId: match.evidenceId || payload.evidenceId || '',
      chunkId: match.chunkId || payload.chunkId || '',
      title: match.title || payload.title || metadata.title || ''
    },
    metadata: {
      sourceType: metadata.sourceType || match.sourceType || payload.sourceType || '',
      extractionStatus: metadata.extractionStatus || match.extractionStatus || payload.extractionStatus || '',
      documentType: metadata.documentType || match.documentType || payload.documentType || '',
      source: metadata.source || match.source || payload.source || '',
      tags: Array.isArray(match.tags || payload.tags) ? (match.tags || payload.tags).slice(0, 12) : [],
      domains: Array.isArray(match.domains || payload.domains) ? (match.domains || payload.domains).slice(0, 12) : []
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
      browserEmbeddingsRetained: false,
      actorScoped: Boolean(stored.actorScoped)
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
  return {
    baseUrl: qdrantBaseUrl(),
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
  const configuredTimeout = Number(process.env.P42_QDRANT_TIMEOUT_MS || DEFAULT_QDRANT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? Math.max(1000, Math.min(120000, Math.round(configuredTimeout)))
    : DEFAULT_QDRANT_TIMEOUT_MS;
  const response = await fetch(`${config.baseUrl}${pathname}`, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(timeoutMs)
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

function chunkPayloadForQdrant(chunk = {}, context = {}) {
  const metadata = chunk.metadata || {};
  const now = context.now || new Date().toISOString();
  const documentId = cleanText(chunk.documentId || metadata.documentId || chunk.evidenceId || chunk.chunkId);
  const evidenceId = cleanText(chunk.evidenceId || documentId);
  const source = cleanText(chunk.source || metadata.source || chunk.sourceType || metadata.sourceType || 'server_side_evidence_index');
  const tags = Array.from(new Set([
    ...(Array.isArray(chunk.tags) ? chunk.tags : []),
    ...(Array.isArray(metadata.tags) ? metadata.tags : []),
    ...(Array.isArray(chunk.signals) ? chunk.signals : []),
    ...(Array.isArray(metadata.signals) ? metadata.signals : [])
  ].map(cleanText).filter(Boolean))).slice(0, 24);
  const domains = Array.from(new Set([
    ...(Array.isArray(chunk.domains) ? chunk.domains : []),
    ...(Array.isArray(metadata.domains) ? metadata.domains : []),
    ...(Array.isArray(context.domains) ? context.domains : [])
  ].map(cleanText).filter(Boolean))).slice(0, 24);
  const text = cleanText(chunk.text || chunk.summary || chunk.excerpt || '');
  return {
    type: 'evidence_chunk',
    caseId: context.caseId,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    documentId,
    evidenceId,
    title: cleanText(chunk.title || metadata.title || chunk.fileName || metadata.fileName || evidenceId),
    fileName: cleanText(chunk.fileName || metadata.fileName || ''),
    chunkId: cleanText(chunk.chunkId || `${evidenceId}-${chunk.chunkIndex || 0}`),
    chunkIndex: Number.isFinite(Number(chunk.chunkIndex)) ? Number(chunk.chunkIndex) : 0,
    source,
    createdAt: cleanText(chunk.createdAt || metadata.createdAt || now),
    updatedAt: now,
    tags,
    domains,
    snippet: text.slice(0, 700),
    text,
    metadata: {
      sourceType: cleanText(metadata.sourceType || chunk.sourceType || ''),
      extractionStatus: cleanText(metadata.extractionStatus || chunk.extractionStatus || ''),
      documentType: cleanText(metadata.documentType || chunk.documentType || ''),
      source,
      fileName: cleanText(chunk.fileName || metadata.fileName || '')
    },
    model: context.model
  };
}

async function storeQdrantIndex({ caseId, workspaceId, projectId, chunks, result }) {
  const vectorSize = chunks.find((chunk) => Array.isArray(chunk.embedding))?.embedding?.length || 0;
  if (!vectorSize) throw new Error('No embeddings were returned for vector storage.');
  await ensureQdrantCollection(vectorSize);
  const { collection } = qdrantConfig();
  const now = new Date().toISOString();
  const model = result.model || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large';
  const domains = result.context?.domains || result.domains || [];
  const points = chunks
    .filter((chunk) => Array.isArray(chunk.embedding))
    .map((chunk) => ({
      id: stableUuid(`${workspaceId}:${projectId}:${caseId}:${chunk.chunkId}`),
      vector: chunk.embedding,
      payload: chunkPayloadForQdrant(chunk, { caseId, workspaceId, projectId, now, model, domains })
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

function qdrantFilter({ caseId, workspaceId, projectId, type = 'evidence_chunk', includeCase = true } = {}) {
  const must = [
    { key: 'type', match: { value: type } },
    { key: 'workspaceId', match: { value: workspaceId } },
    { key: 'projectId', match: { value: projectId } }
  ];
  if (includeCase && caseId) must.push({ key: 'caseId', match: { value: caseId } });
  return { must };
}

function extractEmbeddingVector(body = {}) {
  if (Array.isArray(body.embedding)) return body.embedding;
  if (Array.isArray(body.vector)) return body.vector;
  if (Array.isArray(body.data?.[0]?.embedding)) return body.data[0].embedding;
  if (Array.isArray(body.embeddings?.[0])) return body.embeddings[0];
  if (Array.isArray(body.embeddings?.[0]?.embedding)) return body.embeddings[0].embedding;
  if (Array.isArray(body.result?.embedding)) return body.result.embedding;
  throw new Error('Embedding gateway response did not include a vector.');
}

async function embedQueryForSearch(payload = {}) {
  const body = await embed(payload.query || '', {
    caseId: payload.caseId,
    workspaceId: payload.workspaceId,
    projectId: payload.projectId,
    purpose: payload.purpose || 'qdrant_evidence_search'
  });
  return {
    model: body.model || body.embeddingModel || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
    vector: extractEmbeddingVector(body)
  };
}

async function searchQdrantPoints(payload = {}, { includeCase = true } = {}) {
  const { collection } = qdrantConfig();
  const embedded = await embedQueryForSearch(payload);
  const body = await qdrantFetch(`/collections/${encodeURIComponent(collection)}/points/query`, {
    method: 'POST',
    body: JSON.stringify({
      query: embedded.vector,
      limit: Number(payload.topK || payload.limit || 8),
      with_payload: true,
      with_vector: false,
      filter: qdrantFilter({ ...payload, includeCase })
    })
  });
  const points = Array.isArray(body.result?.points) ? body.result.points : (Array.isArray(body.result) ? body.result : []);
  const matches = points.map((point) => safeMatchForClient({
    ...(point.payload || {}),
    payload: point.payload || {},
    score: point.score
  }));
  return {
    model: embedded.model,
    matches
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

async function indexEvidenceServerSide(payload = {}, options = {}) {
  const caseId = cleanText(payload.caseId);
  if (!caseId) throw new Error('caseId is required for server-side evidence indexing.');
  const { workspaceId, projectId, actorScoped } = vectorNamespace(payload, options);
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
    actorScoped,
    context: result.context
  });
}

async function searchEvidenceServerSide(payload = {}, options = {}) {
  const caseId = cleanText(payload.caseId);
  if (!caseId) throw new Error('caseId is required for server-side evidence search.');
  const { workspaceId, projectId, actorScoped } = vectorNamespace(payload, options);
  if (vectorProvider() === 'qdrant') {
    if (!cleanText(payload.query)) {
      return {
        ok: true,
        model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
        context: { caseId, workspaceId, projectId, purpose: payload.purpose || 'evidence_search' },
        index: {
          caseId,
          workspaceId,
          projectId,
          provider: 'qdrant',
          storage: 'server_side_qdrant_vector_db',
          collection: qdrantConfig().collection,
          browserEmbeddingsRetained: false,
          fallbackScope: 'case',
          actorScoped
        },
        matches: []
      };
    }
    const primary = await searchQdrantPoints({
      ...payload,
      caseId,
      workspaceId,
      projectId,
      topK: payload.topK || 8
    }, { includeCase: true });
    let matches = primary.matches;
    const fallbackUsed = !matches.length && (options.allowWorkspaceFallback === true || truthy(process.env.P42_ALLOW_WORKSPACE_VECTOR_FALLBACK));
    if (fallbackUsed) {
      const fallback = await searchQdrantPoints({
        ...payload,
        caseId,
        workspaceId,
        projectId,
        topK: payload.topK || 8
      }, { includeCase: false });
      matches = fallback.matches;
    }
    return {
      ok: true,
      model: primary.model,
      context: { caseId, workspaceId, projectId, purpose: payload.purpose || 'evidence_search' },
      index: {
        caseId,
        workspaceId,
        projectId,
        provider: 'qdrant',
        storage: 'server_side_qdrant_vector_db',
        collection: qdrantConfig().collection,
        chunkCount: matches.length || 0,
        evidenceIds: Array.from(new Set(matches.map((match) => match.evidenceId).filter(Boolean))),
        browserEmbeddingsRetained: false,
        fallbackScope: fallbackUsed ? 'workspace_project' : 'case',
        actorScoped
      },
      matches
    };
  }
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
        browserEmbeddingsRetained: false,
        actorScoped
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
    matches: (Array.isArray(result.matches) ? result.matches : []).map(safeMatchForClient),
    index: {
      caseId,
      workspaceId,
      projectId,
      provider: index?.provider || vectorProvider(),
      storage: index?.storage || 'server_side_vector_store',
      chunkCount: chunks.length,
      evidenceIds: Array.from(new Set(chunks.map((chunk) => chunk.evidenceId).filter(Boolean))),
      browserEmbeddingsRetained: false,
      actorScoped
    }
  };
}

function readLastQdrantSmokeStatus() {
  try {
    return JSON.parse(fs.readFileSync(qdrantSmokeStatusFile(), 'utf8'));
  } catch {
    return null;
  }
}

function writeLastQdrantSmokeStatus(status) {
  fs.mkdirSync(vectorStoreDir(), { recursive: true });
  fs.writeFileSync(qdrantSmokeStatusFile(), `${JSON.stringify(status, null, 2)}\n`, { mode: 0o600 });
}

async function runQdrantSmokeTest(options = {}) {
  const provider = vectorProvider();
  const config = qdrantConfig();
  const base = {
    ok: false,
    provider,
    collection: config.collection,
    qdrantConfigured: Boolean(config.baseUrl),
    timestamp: new Date().toISOString()
  };
  if (provider !== 'qdrant' || !config.baseUrl) {
    const skipped = {
      ...base,
      skipped: true,
      reason: 'P42_VECTOR_STORE_PROVIDER=qdrant and QDRANT_URL are required for the Qdrant smoke test.'
    };
    writeLastQdrantSmokeStatus(skipped);
    return skipped;
  }
  try {
    const caseId = options.caseId || `qdrant-smoke-${Date.now()}`;
    const workspaceId = options.workspaceId || process.env.P42_WORKSPACE_ID || 'parallax42';
    const projectId = options.projectId || process.env.P42_PROJECT_ID || 'compliance-intelligence-agent';
    const indexResult = await indexEvidenceServerSide({
      caseId,
      workspaceId,
      projectId,
      documents: [{
        evidenceId: 'SMOKE-01',
        documentId: 'SMOKE-DOC-01',
        title: 'Synthetic Qdrant smoke evidence',
        source: 'qdrant_smoke_test',
        text: 'Synthetic compliance evidence: signed DPA, retention schedule, ISO 27001, SOC 2, and exit assistance are present for reviewer validation.',
        tags: ['smoke-test', 'DPA', 'ISO 27001'],
        domains: ['Privacy And Data Governance', 'Technical Risk']
      }]
    });
    const searchResult = await searchEvidenceServerSide({
      caseId,
      workspaceId,
      projectId,
      query: 'signed DPA retention ISO 27001 exit assistance',
      topK: 3
    });
    const status = {
      ...base,
      ok: (searchResult.matches || []).length > 0,
      skipped: false,
      caseId,
      workspaceId,
      projectId,
      indexedChunkCount: indexResult.index?.chunkCount || 0,
      matchCount: searchResult.matches?.length || 0,
      collection: config.collection
    };
    writeLastQdrantSmokeStatus(status);
    return status;
  } catch (error) {
    const status = {
      ...base,
      error: error instanceof Error ? error.message : String(error || 'Qdrant smoke test failed.')
    };
    writeLastQdrantSmokeStatus(status);
    return status;
  }
}

function evidenceVectorStoreHealth() {
  const provider = vectorProvider();
  const durableRequired = /^(1|true|yes|on)$/i.test(String(process.env.P42_REQUIRE_DURABLE_STORAGE || ''));
  const durable = provider === 'qdrant';
  const qdrantFeatureEnabled = isFeatureEnabled('qdrantRag');
  const demoEmbeddingsEnabled = truthy(process.env.P42_DEMO_EMBEDDINGS);
  const embeddingsFeatureEnabled = isFeatureEnabled('compassEmbeddings') || demoEmbeddingsEnabled;
  return {
    provider,
    storage: provider === 'qdrant' ? 'server_side_qdrant_vector_db' : 'server_side_local_vector_store',
    durable,
    durableRequired,
    enterpriseReady: durable && Boolean(qdrantConfig().baseUrl),
    features: {
      qdrantRagEnabled: qdrantFeatureEnabled,
      compassEmbeddingsEnabled: isFeatureEnabled('compassEmbeddings'),
      deterministicDemoEmbeddings: demoEmbeddingsEnabled,
      embeddingsEnabled: embeddingsFeatureEnabled
    },
    browserEmbeddingsRetained: false,
    localStorePath: provider === 'local_file' ? vectorStoreFile() : undefined,
    qdrantConfigured: Boolean(qdrantConfig().baseUrl),
    collection: qdrantConfig().collection,
    lastSmokeStatus: readLastQdrantSmokeStatus(),
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
  qdrantConfig,
  qdrantFetch,
  qdrantSmokeStatusFile,
  readLastQdrantSmokeStatus,
  runQdrantSmokeTest,
  sanitizeIndexResult,
  searchEvidenceServerSide,
  stableUuid,
  vectorNamespace
};
