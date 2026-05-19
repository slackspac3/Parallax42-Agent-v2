'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { isFeatureEnabled } = require('./adminFeatureFlags');
const { embed, gatewayToken } = require('./compassGatewayClient');
const { qdrantConfig, qdrantFetch, stableUuid } = require('./evidenceVectorStore');

const DEFAULT_STORE_DIR = path.join(os.tmpdir(), 'p42-compliance-intelligence-agent');
const DEFAULT_SOURCE_ID = 'sanitised_enterprise_ai_governance_context';
const DEFAULT_TITLE = 'Sanitised Enterprise AI Governance Context';
const MAX_REFERENCE_CHARS = 1600;

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
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

function referenceStoreDir() {
  return process.env.P42_REFERENCE_CONTEXT_DIR
    || process.env.P42_VECTOR_STORE_DIR
    || process.env.AGENT_AUDIT_DIR
    || DEFAULT_STORE_DIR;
}

function referenceStoreFile() {
  return path.join(referenceStoreDir(), 'governance-reference-index.json');
}

function qdrantBaseUrlPresent() {
  return Boolean(qdrantConfig().baseUrl);
}

function referenceProvider() {
  const requested = cleanText(process.env.P42_VECTOR_STORE_PROVIDER || '').toLowerCase();
  const qdrantReady = qdrantBaseUrlPresent() && isFeatureEnabled('qdrantRag');
  if (requested === 'qdrant') return qdrantReady ? 'qdrant' : 'local_file';
  if (!requested && qdrantReady) return 'qdrant';
  return requested || 'local_file';
}

function referenceIndexKey({ workspaceId = 'parallax42', projectId = 'compliance-intelligence-agent', sourceId = DEFAULT_SOURCE_ID } = {}) {
  return [workspaceId, projectId, sourceId].map((value) => cleanText(value) || 'default').join('::');
}

function readLocalStore() {
  try {
    return JSON.parse(fs.readFileSync(referenceStoreFile(), 'utf8'));
  } catch {
    return { version: 1, references: {} };
  }
}

function writeLocalStore(store) {
  fs.mkdirSync(referenceStoreDir(), { recursive: true });
  fs.writeFileSync(referenceStoreFile(), `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

function sectionNumberFromHeading(heading = '') {
  return cleanText(heading).match(/^(\d+(?:\.\d+)*)\b/)?.[1] || '';
}

function headingTitle(heading = '') {
  return cleanText(heading).replace(/^\d+(?:\.\d+)*\.?\s*/, '').trim();
}

function splitMarkdownSections(markdown = '') {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  const stack = [];
  let current = {
    section: '',
    heading: 'Document Overview',
    headingPath: ['Document Overview'],
    textLines: []
  };

  const flush = () => {
    const text = current.textLines.join('\n').trim();
    if (!text) return;
    sections.push({
      section: current.section,
      heading: current.heading,
      headingPath: current.headingPath.join(' > '),
      text
    });
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      const rawHeading = cleanText(headingMatch[2]);
      stack[level - 1] = headingTitle(rawHeading) || rawHeading;
      stack.length = level;
      current = {
        section: sectionNumberFromHeading(rawHeading),
        heading: headingTitle(rawHeading) || rawHeading,
        headingPath: stack.filter(Boolean),
        textLines: []
      };
    } else {
      current.textLines.push(line);
    }
  }
  flush();
  return sections;
}

function splitLongSection(section = {}, maxChars = MAX_REFERENCE_CHARS) {
  const paragraphs = String(section.text || '')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks = [];
  let buffer = '';
  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      buffer = candidate;
      continue;
    }
    if (buffer) chunks.push(buffer);
    if (paragraph.length <= maxChars) {
      buffer = paragraph;
      continue;
    }
    for (let index = 0; index < paragraph.length; index += maxChars) {
      chunks.push(paragraph.slice(index, index + maxChars));
    }
    buffer = '';
  }
  if (buffer) chunks.push(buffer);
  return chunks.map((text) => ({
    ...section,
    text
  }));
}

function inferReferenceMetadata(text = '', heading = '') {
  const haystack = `${heading} ${text}`;
  const tags = [];
  const domains = [];
  const frameworks = [];

  const add = (target, value) => target.push(value);
  if (/SAA|strategic cloud|cloud partner/i.test(haystack)) {
    add(frameworks, 'SAA');
    add(domains, 'strategic_cloud_assurance');
  }
  if (/export control|sanction|end-use|end user|trade compliance|restricted/i.test(haystack)) {
    add(tags, 'export controls');
    add(tags, 'sanctions screening');
    add(domains, 'trade_compliance');
  }
  if (/data protection|privacy|personal data|sensitive data|retention|deletion|cross-border/i.test(haystack)) {
    add(tags, 'data protection');
    add(domains, 'privacy_and_data_governance');
  }
  if (/responsible AI|ethical AI|AI governance|model governance|bias|human oversight/i.test(haystack)) {
    add(tags, 'responsible ai');
    add(domains, 'ai_and_model_governance');
  }
  if (/audit|assurance|certification|evidence|control/i.test(haystack)) {
    add(tags, 'assurance');
    add(domains, 'enterprise_assurance');
  }
  if (/cyber|information security|cloud security|access|identity|incident/i.test(haystack)) {
    add(tags, 'cybersecurity');
    add(domains, 'technical_risk');
  }
  if (/committee|approval|escalation|three lines|3 lines|risk reporting/i.test(haystack)) {
    add(tags, 'governance operating model');
    add(domains, 'governance_and_reporting');
  }
  if (/ESG|sustainability|environment|social|governance/i.test(haystack)) {
    add(tags, 'esg');
    add(domains, 'esg_and_sustainability');
  }
  const isoMatches = haystack.match(/\bISO\s?\d{4,5}\b/gi) || [];
  isoMatches.forEach((item) => add(frameworks, item.toUpperCase().replace(/\s+/, ' ')));

  return {
    tags: unique(tags),
    domains: unique(domains),
    frameworks: unique(frameworks)
  };
}

function chunkGovernanceReference(payload = {}) {
  const markdown = String(payload.markdown || payload.text || payload.content || '');
  const sections = splitMarkdownSections(markdown);
  const sourceId = cleanText(payload.sourceId) || DEFAULT_SOURCE_ID;
  const title = cleanText(payload.title) || DEFAULT_TITLE;
  const now = payload.createdAt || new Date().toISOString();
  const chunks = [];

  sections.flatMap((section) => splitLongSection(section)).forEach((section, index) => {
    const metadata = inferReferenceMetadata(section.text, section.heading);
    const chunkIndex = chunks.length;
    const sectionSlug = cleanText(section.section || `section-${index + 1}`).replace(/[^\w.-]+/g, '-').toLowerCase();
    const chunkId = `${sourceId}_REF_${String(chunkIndex + 1).padStart(3, '0')}`;
    const referenceId = `${sourceId}:${sectionSlug}:${chunkIndex}`;
    chunks.push({
      type: 'governance_reference',
      referenceId,
      chunkId,
      sourceId,
      title,
      section: cleanText(section.section),
      heading: cleanText(section.heading),
      headingPath: cleanText(section.headingPath),
      chunkIndex,
      source: cleanText(payload.source) || 'curated_governance_reference',
      classification: cleanText(payload.classification) || 'sanitised_public_test',
      authority: cleanText(payload.authority) || 'context_reference_not_policy',
      publicSafe: payload.publicSafe !== false,
      requiresHumanReview: payload.requiresHumanReview !== false,
      createdAt: now,
      updatedAt: now,
      tags: metadata.tags,
      domains: metadata.domains,
      frameworks: metadata.frameworks,
      snippet: cleanText(section.text).slice(0, 700),
      text: cleanText(section.text)
    });
  });

  return chunks;
}

function safeReferenceForClient(reference = {}) {
  const payload = reference.payload || reference;
  return {
    referenceId: payload.referenceId || '',
    chunkId: payload.chunkId || '',
    sourceId: payload.sourceId || '',
    title: payload.title || '',
    section: payload.section || '',
    heading: payload.heading || '',
    score: Number(reference.score || payload.score || 0),
    snippet: cleanText(payload.snippet || payload.text || '').slice(0, 700),
    frameworks: Array.isArray(payload.frameworks) ? payload.frameworks.slice(0, 12) : [],
    domains: Array.isArray(payload.domains) ? payload.domains.slice(0, 12) : [],
    tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 16) : [],
    classification: payload.classification || 'sanitised_public_test',
    authority: payload.authority || 'context_reference_not_policy',
    publicSafe: payload.publicSafe !== false,
    requiresHumanReview: payload.requiresHumanReview !== false,
    metadata: {
      headingPath: payload.headingPath || '',
      source: payload.source || '',
      createdAt: payload.createdAt || ''
    }
  };
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

async function maybeEmbedChunks(chunks = [], context = {}) {
  const provider = context.provider || referenceProvider();
  const shouldEmbed = provider === 'qdrant' || (gatewayToken() && isFeatureEnabled('compassEmbeddings'));
  if (!shouldEmbed) return { model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large', chunks };

  const embeddedChunks = [];
  let model = process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large';
  for (const chunk of chunks) {
    const result = await embed(`${chunk.heading}\n\n${chunk.text}`, {
      workspaceId: context.workspaceId,
      projectId: context.projectId,
      sourceId: chunk.sourceId,
      purpose: 'governance_reference_index'
    });
    model = result.model || model;
    embeddedChunks.push({
      ...chunk,
      embedding: extractEmbeddingVector(result)
    });
  }
  return { model, chunks: embeddedChunks };
}

async function storeLocalReferences({ key, workspaceId, projectId, sourceId, chunks, model }) {
  const store = readLocalStore();
  const now = new Date().toISOString();
  store.references[key] = {
    workspaceId,
    projectId,
    sourceId,
    model,
    chunks,
    updatedAt: now
  };
  writeLocalStore(store);
  return {
    provider: 'local_file',
    storage: 'server_side_local_governance_reference_store',
    updatedAt: now,
    chunkCount: chunks.length
  };
}

async function storeQdrantReferences({ workspaceId, projectId, sourceId, chunks, model }) {
  const vectorSize = chunks.find((chunk) => Array.isArray(chunk.embedding))?.embedding?.length || 0;
  if (!vectorSize) throw new Error('No embeddings were returned for governance reference storage.');
  await ensureQdrantCollection(vectorSize);
  const { collection } = qdrantConfig();
  const points = chunks.map((chunk) => {
    const { embedding, ...payload } = chunk;
    return {
      id: stableUuid(`${workspaceId}:${projectId}:governance:${sourceId}:${chunk.chunkId}`),
      vector: embedding,
      payload: {
        ...payload,
        workspaceId,
        projectId,
        model
      }
    };
  });
  await qdrantFetch(`/collections/${encodeURIComponent(collection)}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({ points })
  });
  return {
    provider: 'qdrant',
    storage: 'server_side_qdrant_governance_reference_store',
    updatedAt: new Date().toISOString(),
    collection,
    chunkCount: points.length
  };
}

async function indexGovernanceReference(payload = {}) {
  const workspaceId = payload.workspaceId || process.env.P42_WORKSPACE_ID || 'parallax42';
  const projectId = payload.projectId || process.env.P42_PROJECT_ID || 'compliance-intelligence-agent';
  const sourceId = cleanText(payload.sourceId) || DEFAULT_SOURCE_ID;
  const provider = referenceProvider();
  const chunks = chunkGovernanceReference(payload);
  if (!chunks.length) throw new Error('Governance reference text is required for indexing.');

  const embedded = await maybeEmbedChunks(chunks, { provider, workspaceId, projectId });
  const stored = provider === 'qdrant'
    ? await storeQdrantReferences({ workspaceId, projectId, sourceId, chunks: embedded.chunks, model: embedded.model })
    : await storeLocalReferences({
        key: referenceIndexKey({ workspaceId, projectId, sourceId }),
        workspaceId,
        projectId,
        sourceId,
        chunks: embedded.chunks,
        model: embedded.model
      });

  return {
    ok: true,
    model: embedded.model,
    context: {
      workspaceId,
      projectId,
      sourceId,
      classification: cleanText(payload.classification) || 'sanitised_public_test',
      authority: cleanText(payload.authority) || 'context_reference_not_policy',
      publicSafe: payload.publicSafe !== false,
      requiresHumanReview: payload.requiresHumanReview !== false
    },
    chunking: { chunkCount: chunks.length },
    index: {
      ...stored,
      workspaceId,
      projectId,
      sourceId,
      browserEmbeddingsRetained: false
    },
    references: chunks.slice(0, 20).map(safeReferenceForClient)
  };
}

function tokenSet(value = '') {
  return new Set(cleanText(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function lexicalScore(query = '', chunk = {}) {
  const queryTokens = tokenSet(query);
  if (!queryTokens.size) return 0;
  const text = `${chunk.heading} ${chunk.headingPath} ${chunk.text} ${(chunk.tags || []).join(' ')} ${(chunk.domains || []).join(' ')} ${(chunk.frameworks || []).join(' ')}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (text.includes(token)) score += 1;
  }
  if (text.includes(cleanText(query).toLowerCase())) score += 4;
  return score / Math.max(queryTokens.size, 1);
}

function localReferenceChunks({ workspaceId, projectId, sourceId = '' } = {}) {
  const store = readLocalStore();
  return Object.entries(store.references || {})
    .filter(([, entry]) => {
      if (entry.workspaceId !== workspaceId || entry.projectId !== projectId) return false;
      return sourceId ? entry.sourceId === sourceId : true;
    })
    .flatMap(([, entry]) => Array.isArray(entry.chunks) ? entry.chunks : []);
}

async function searchQdrantReferences(payload = {}) {
  const embedded = await embed(cleanText(payload.query || ''), {
    workspaceId: payload.workspaceId,
    projectId: payload.projectId,
    purpose: 'governance_reference_search'
  });
  const vector = Array.isArray(embedded.embedding) ? embedded.embedding : [];
  const normalizedVector = vector.length ? vector : extractEmbeddingVector(embedded);
  if (!normalizedVector.length) throw new Error('Embedding gateway response did not include a query vector.');

  const must = [
    { key: 'type', match: { value: 'governance_reference' } },
    { key: 'workspaceId', match: { value: payload.workspaceId } },
    { key: 'projectId', match: { value: payload.projectId } }
  ];
  if (payload.sourceId) must.push({ key: 'sourceId', match: { value: payload.sourceId } });
  const { collection } = qdrantConfig();
  const body = await qdrantFetch(`/collections/${encodeURIComponent(collection)}/points/search`, {
    method: 'POST',
    body: JSON.stringify({
      vector: normalizedVector,
      limit: Number(payload.topK || payload.limit || 6),
      with_payload: true,
      with_vector: false,
      filter: { must }
    })
  });
  return {
    model: embedded.model || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
    references: (Array.isArray(body.result) ? body.result : []).map((point) => safeReferenceForClient({
      ...(point.payload || {}),
      payload: point.payload || {},
      score: point.score
    }))
  };
}

async function searchGovernanceReferences(payload = {}) {
  const query = cleanText(payload.query || '');
  const workspaceId = payload.workspaceId || process.env.P42_WORKSPACE_ID || 'parallax42';
  const projectId = payload.projectId || process.env.P42_PROJECT_ID || 'compliance-intelligence-agent';
  const sourceId = cleanText(payload.sourceId);
  const provider = referenceProvider();

  if (!query) {
    return {
      ok: true,
      model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
      context: { workspaceId, projectId, sourceId, purpose: payload.purpose || 'governance_reference_search' },
      index: {
        provider,
        storage: provider === 'qdrant' ? 'server_side_qdrant_governance_reference_store' : 'server_side_local_governance_reference_store',
        collection: provider === 'qdrant' ? qdrantConfig().collection : undefined,
        browserEmbeddingsRetained: false
      },
      references: []
    };
  }

  if (provider === 'qdrant') {
    const result = await searchQdrantReferences({ ...payload, query, workspaceId, projectId, sourceId });
    return {
      ok: true,
      model: result.model,
      context: { workspaceId, projectId, sourceId, purpose: payload.purpose || 'governance_reference_search' },
      index: {
        provider: 'qdrant',
        storage: 'server_side_qdrant_governance_reference_store',
        collection: qdrantConfig().collection,
        matchCount: result.references.length,
        browserEmbeddingsRetained: false
      },
      references: result.references
    };
  }

  const chunks = localReferenceChunks({ workspaceId, projectId, sourceId });
  const references = chunks
    .map((chunk) => ({ ...chunk, score: lexicalScore(query, chunk) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(payload.topK || payload.limit || 6))
    .map(safeReferenceForClient);

  return {
    ok: true,
    model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large',
    context: { workspaceId, projectId, sourceId, purpose: payload.purpose || 'governance_reference_search' },
    index: {
      provider: 'local_file',
      storage: 'server_side_local_governance_reference_store',
      chunkCount: chunks.length,
      matchCount: references.length,
      browserEmbeddingsRetained: false
    },
    references
  };
}

function governanceReferenceHealth() {
  const provider = referenceProvider();
  let localChunkCount = 0;
  if (provider !== 'qdrant') {
    localChunkCount = Object.values(readLocalStore().references || {})
      .reduce((total, entry) => total + (Array.isArray(entry.chunks) ? entry.chunks.length : 0), 0);
  }
  return {
    provider,
    storage: provider === 'qdrant' ? 'server_side_qdrant_governance_reference_store' : 'server_side_local_governance_reference_store',
    qdrantConfigured: qdrantBaseUrlPresent(),
    collection: qdrantConfig().collection,
    localStorePath: provider === 'local_file' ? referenceStoreFile() : undefined,
    localChunkCount,
    browserEmbeddingsRetained: false,
    classification: 'sanitised_public_test',
    authority: 'context_reference_not_policy',
    advisoryOnly: true,
    humanReviewRequired: true
  };
}

module.exports = {
  chunkGovernanceReference,
  governanceReferenceHealth,
  indexGovernanceReference,
  referenceIndexKey,
  referenceStoreFile,
  searchGovernanceReferences,
  safeReferenceForClient
};
