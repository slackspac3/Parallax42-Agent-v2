'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { embed } = require('./compassGatewayClient');
const { qdrantConfig, qdrantFetch, stableUuid } = require('./evidenceVectorStore');

const DEFAULT_STORE_DIR = path.join(os.tmpdir(), 'p42-compliance-intelligence-agent');
const LOCAL_MEMORY_FILE = 'learning-memory.json';
const LEARNING_TYPES = new Set([
  'case_outcome',
  'reviewer_feedback',
  'control_pattern',
  'decision_override',
  'evidence_quality_note'
]);

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function learningProvider() {
  const requested = cleanText(process.env.P42_VECTOR_STORE_PROVIDER || '').toLowerCase();
  const qdrantConfigured = Boolean(qdrantConfig().baseUrl);
  if (requested === 'qdrant') return qdrantConfigured ? 'qdrant' : 'local_file';
  if (!requested && qdrantConfigured) return 'qdrant';
  return 'local_file';
}

function memoryStoreDir() {
  return process.env.P42_LEARNING_MEMORY_DIR || process.env.P42_VECTOR_STORE_DIR || process.env.AGENT_AUDIT_DIR || DEFAULT_STORE_DIR;
}

function memoryFile() {
  return path.join(memoryStoreDir(), LOCAL_MEMORY_FILE);
}

function readLocalMemory() {
  try {
    return JSON.parse(fs.readFileSync(memoryFile(), 'utf8'));
  } catch {
    return { version: 1, artifacts: [] };
  }
}

function writeLocalMemory(memory) {
  fs.mkdirSync(memoryStoreDir(), { recursive: true });
  fs.writeFileSync(memoryFile(), `${JSON.stringify(memory, null, 2)}\n`, { mode: 0o600 });
}

function safeActor(actor = {}) {
  return {
    id: cleanText(actor.id || actor.sub || actor.email || actor.name || ''),
    roles: Array.isArray(actor.roles) ? actor.roles.map(cleanText).filter(Boolean).slice(0, 12) : [],
    authenticated: Boolean(actor.authenticated)
  };
}

function artifactText(artifact = {}) {
  return cleanText([
    artifact.artifactType,
    artifact.caseId,
    artifact.originalDecision,
    artifact.reviewerDecision,
    artifact.reviewerNotes,
    artifact.finalOutcome,
    ...(Array.isArray(artifact.addedControls) ? artifact.addedControls : []),
    ...(Array.isArray(artifact.rejectedEvidence) ? artifact.rejectedEvidence : []),
    ...(Array.isArray(artifact.missingEvidence) ? artifact.missingEvidence : []),
    ...(Array.isArray(artifact.tags) ? artifact.tags : []),
    ...(Array.isArray(artifact.domains) ? artifact.domains : [])
  ].join(' '));
}

function normalizeArtifact(input = {}, options = {}) {
  const artifactType = LEARNING_TYPES.has(input.artifactType) ? input.artifactType : 'reviewer_feedback';
  const createdAt = input.createdAt || new Date().toISOString();
  const workspaceId = cleanText(input.workspaceId || process.env.P42_WORKSPACE_ID || 'parallax42');
  const projectId = cleanText(input.projectId || process.env.P42_PROJECT_ID || 'compliance-intelligence-agent');
  const caseId = cleanText(input.caseId || 'unassigned-case');
  const artifact = {
    memoryId: cleanText(input.memoryId || stableUuid(`${workspaceId}:${projectId}:${caseId}:${artifactType}:${createdAt}:${input.reviewerNotes || ''}`)),
    type: 'governed_learning_artifact',
    artifactType,
    caseId,
    workspaceId,
    projectId,
    originalDecision: cleanText(input.originalDecision || ''),
    reviewerDecision: cleanText(input.reviewerDecision || ''),
    reviewerNotes: cleanText(input.reviewerNotes || ''),
    addedControls: unique(input.addedControls || []),
    rejectedEvidence: unique(input.rejectedEvidence || []),
    missingEvidence: unique(input.missingEvidence || []),
    finalOutcome: cleanText(input.finalOutcome || ''),
    domains: unique(input.domains || []),
    tags: unique(input.tags || []),
    actor: safeActor(options.actor || input.actor || {}),
    createdAt,
    advisoryOnly: true,
    trainingUse: 'not_model_training'
  };
  artifact.text = artifactText(artifact);
  return artifact;
}

function safeArtifactForClient(artifact = {}, score = 1) {
  return {
    memoryId: artifact.memoryId || artifact.id || '',
    artifactType: artifact.artifactType || '',
    caseId: artifact.caseId || '',
    originalDecision: artifact.originalDecision || '',
    reviewerDecision: artifact.reviewerDecision || '',
    reviewerNotes: cleanText(artifact.reviewerNotes || '').slice(0, 420),
    addedControls: Array.isArray(artifact.addedControls) ? artifact.addedControls.slice(0, 8) : [],
    rejectedEvidence: Array.isArray(artifact.rejectedEvidence) ? artifact.rejectedEvidence.slice(0, 8) : [],
    missingEvidence: Array.isArray(artifact.missingEvidence) ? artifact.missingEvidence.slice(0, 8) : [],
    finalOutcome: artifact.finalOutcome || '',
    confidence: Number(Math.max(0, Math.min(1, score || artifact.score || 0.5)).toFixed(2)),
    sourceMemoryId: artifact.memoryId || artifact.id || '',
    createdAt: artifact.createdAt || '',
    advisoryOnly: true
  };
}

function tokenSet(value = '') {
  return new Set(cleanText(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function lexicalScore(query = '', artifact = {}) {
  const queryTokens = tokenSet(query);
  if (!queryTokens.size) return 0.1;
  const textTokens = tokenSet(artifactText(artifact));
  let hits = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) hits += 1;
  }
  return hits / Math.max(1, queryTokens.size);
}

async function embedLearningText(text, context = {}) {
  const body = await embed(text, {
    ...context,
    purpose: context.purpose || 'learning_memory_embedding'
  });
  if (Array.isArray(body.embedding)) return { vector: body.embedding, model: body.model || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large' };
  if (Array.isArray(body.vector)) return { vector: body.vector, model: body.model || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large' };
  if (Array.isArray(body.data?.[0]?.embedding)) return { vector: body.data[0].embedding, model: body.model || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large' };
  if (Array.isArray(body.embeddings?.[0]?.embedding)) return { vector: body.embeddings[0].embedding, model: body.model || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large' };
  if (Array.isArray(body.embeddings?.[0])) return { vector: body.embeddings[0], model: body.model || process.env.EMBEDDINGS_MODEL || 'text-embedding-3-large' };
  throw new Error('Embedding gateway response did not include a vector.');
}

async function ensureLearningCollection(size) {
  const { collection } = qdrantConfig();
  try {
    await qdrantFetch(`/collections/${encodeURIComponent(collection)}`, { method: 'GET' });
  } catch {
    await qdrantFetch(`/collections/${encodeURIComponent(collection)}`, {
      method: 'PUT',
      body: JSON.stringify({ vectors: { size, distance: 'Cosine' } })
    });
  }
}

async function storeLocalArtifact(artifact) {
  const memory = readLocalMemory();
  memory.artifacts = Array.isArray(memory.artifacts) ? memory.artifacts : [];
  memory.artifacts.push(artifact);
  writeLocalMemory(memory);
  return { ...artifact, provider: 'local_file' };
}

async function storeQdrantArtifact(artifact) {
  const embedded = await embedLearningText(artifact.text, {
    caseId: artifact.caseId,
    workspaceId: artifact.workspaceId,
    projectId: artifact.projectId,
    purpose: 'learning_memory_store'
  });
  await ensureLearningCollection(embedded.vector.length);
  const { collection } = qdrantConfig();
  await qdrantFetch(`/collections/${encodeURIComponent(collection)}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({
      points: [{
        id: artifact.memoryId,
        vector: embedded.vector,
        payload: {
          ...artifact,
          text: artifact.text.slice(0, 1200),
          model: embedded.model
        }
      }]
    })
  });
  return { ...artifact, provider: 'qdrant', model: embedded.model };
}

async function storeLearningArtifact(input = {}, options = {}) {
  const artifact = normalizeArtifact(input, options);
  if (learningProvider() === 'qdrant') return storeQdrantArtifact(artifact);
  return storeLocalArtifact(artifact);
}

async function recordReviewerFeedback(input = {}, options = {}) {
  const artifacts = [];
  artifacts.push(await storeLearningArtifact({ ...input, artifactType: 'reviewer_feedback' }, options));
  if (cleanText(input.finalOutcome)) {
    artifacts.push(await storeLearningArtifact({ ...input, artifactType: 'case_outcome' }, options));
  }
  if (Array.isArray(input.addedControls) && input.addedControls.length) {
    artifacts.push(await storeLearningArtifact({ ...input, artifactType: 'control_pattern' }, options));
  }
  if (Array.isArray(input.rejectedEvidence) && input.rejectedEvidence.length) {
    artifacts.push(await storeLearningArtifact({ ...input, artifactType: 'evidence_quality_note' }, options));
  }
  if (cleanText(input.originalDecision) && cleanText(input.reviewerDecision) && input.originalDecision !== input.reviewerDecision) {
    artifacts.push(await storeLearningArtifact({ ...input, artifactType: 'decision_override' }, options));
  }
  return {
    ok: true,
    provider: learningProvider(),
    artifacts: artifacts.map((artifact) => safeArtifactForClient(artifact))
  };
}

function queryFromInput(input = {}) {
  return cleanText([
    input.query,
    input.caseId,
    input.brief,
    input.supplierName,
    input.businessUnit,
    input.geography,
    ...(Array.isArray(input.riskSignals) ? input.riskSignals : []),
    ...(Array.isArray(input.evidenceSignals) ? input.evidenceSignals : []),
    ...(Array.isArray(input.missingEvidence) ? input.missingEvidence : []),
    ...(Array.isArray(input.controls) ? input.controls : [])
  ].join(' '));
}

async function searchLocalLearning(input = {}, { artifactTypes = [], limit = 5 } = {}) {
  const memory = readLocalMemory();
  const query = queryFromInput(input);
  const wanted = new Set(artifactTypes.filter(Boolean));
  return (memory.artifacts || [])
    .filter((artifact) => !wanted.size || wanted.has(artifact.artifactType))
    .filter((artifact) => !input.caseId || artifact.caseId !== input.caseId || input.includeSameCase === true)
    .map((artifact) => ({ artifact, score: lexicalScore(query, artifact) }))
    .filter((item) => item.score > 0 || !query)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => safeArtifactForClient(item.artifact, item.score || 0.35));
}

async function searchQdrantLearning(input = {}, { artifactTypes = [], limit = 5 } = {}) {
  const query = queryFromInput(input);
  const workspaceId = cleanText(input.workspaceId || process.env.P42_WORKSPACE_ID || 'parallax42');
  const projectId = cleanText(input.projectId || process.env.P42_PROJECT_ID || 'compliance-intelligence-agent');
  const embedded = await embedLearningText(query || 'compliance case reviewer feedback controls missing evidence', {
    caseId: input.caseId || '',
    workspaceId,
    projectId,
    purpose: 'learning_memory_search'
  });
  const must = [
    { key: 'type', match: { value: 'governed_learning_artifact' } },
    { key: 'workspaceId', match: { value: workspaceId } },
    { key: 'projectId', match: { value: projectId } }
  ];
  if (artifactTypes.length === 1) must.push({ key: 'artifactType', match: { value: artifactTypes[0] } });
  const body = await qdrantFetch(`/collections/${encodeURIComponent(qdrantConfig().collection)}/points/search`, {
    method: 'POST',
    body: JSON.stringify({
      vector: embedded.vector,
      limit,
      with_payload: true,
      with_vector: false,
      filter: { must }
    })
  });
  return (Array.isArray(body.result) ? body.result : [])
    .map((point) => ({ ...(point.payload || {}), score: point.score }))
    .filter((artifact) => !artifactTypes.length || artifactTypes.includes(artifact.artifactType))
    .filter((artifact) => !input.caseId || artifact.caseId !== input.caseId || input.includeSameCase === true)
    .map((artifact) => safeArtifactForClient(artifact, artifact.score || 0.5));
}

async function retrieveLearningArtifacts(input = {}, options = {}) {
  const limit = Number(options.limit || input.limit || 5);
  const artifactTypes = options.artifactTypes || input.artifactTypes || [];
  if (learningProvider() === 'qdrant') {
    try {
      return await searchQdrantLearning(input, { artifactTypes, limit });
    } catch (error) {
      return [];
    }
  }
  return searchLocalLearning(input, { artifactTypes, limit });
}

async function findSimilarCases(input = {}) {
  const matches = await retrieveLearningArtifacts(input, {
    artifactTypes: ['case_outcome', 'reviewer_feedback', 'decision_override'],
    limit: input.limit || 5
  });
  return {
    ok: true,
    provider: learningProvider(),
    advisoryOnly: true,
    similarCases: matches
  };
}

function summarizeControlSuggestions(matches = []) {
  const controls = new Map();
  const missing = new Map();
  matches.forEach((match) => {
    (match.addedControls || []).forEach((control) => controls.set(control, (controls.get(control) || 0) + 1));
    (match.missingEvidence || []).forEach((item) => missing.set(item, (missing.get(item) || 0) + 1));
  });
  return {
    commonControls: Array.from(controls.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([control, count]) => ({ control, count })),
    repeatedMissingEvidence: Array.from(missing.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([evidence, count]) => ({ evidence, count }))
  };
}

async function getControlSuggestions(input = {}) {
  const matches = await retrieveLearningArtifacts(input, {
    artifactTypes: ['control_pattern', 'reviewer_feedback', 'evidence_quality_note'],
    limit: input.limit || 8
  });
  const summary = summarizeControlSuggestions(matches);
  return {
    ok: true,
    provider: learningProvider(),
    advisoryOnly: true,
    confidence: matches.length ? Number(Math.min(0.9, 0.35 + matches.length * 0.08).toFixed(2)) : 0,
    sourceMemoryIds: matches.map((match) => match.memoryId).filter(Boolean),
    createdAt: new Date().toISOString(),
    similarPriorCases: matches.slice(0, 5),
    repeatedMissingEvidencePatterns: summary.repeatedMissingEvidence,
    commonControlsReviewersAdded: summary.commonControls
  };
}

function learningMemoryHealth() {
  return {
    provider: learningProvider(),
    qdrantConfigured: Boolean(qdrantConfig().baseUrl),
    collection: qdrantConfig().collection,
    localMemoryPath: learningProvider() === 'local_file' ? memoryFile() : undefined,
    advisoryOnly: true,
    trainingUse: 'not_model_training'
  };
}

module.exports = {
  LEARNING_TYPES,
  findSimilarCases,
  getControlSuggestions,
  learningMemoryHealth,
  normalizeArtifact,
  recordReviewerFeedback,
  retrieveLearningArtifacts,
  storeLearningArtifact
};
