'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  governanceReferenceHealth,
  indexGovernanceReference,
  searchGovernanceReferences
} = require('../../lib/governanceReferenceStore');
const { enrichConversationWithServerRetrieval } = require('../../lib/serverSideRetrieval');

function withEnv(overrides, fn) {
  const snapshot = {};
  for (const key of Object.keys(overrides)) {
    snapshot[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        if (snapshot[key] === undefined) delete process.env[key];
        else process.env[key] = snapshot[key];
      }
    });
}

const SAMPLE_REFERENCE = [
  '# Sanitised Governance Reference',
  '',
  '## 8. SAA Compliance Architecture',
  '',
  'Strategic cloud assurance requires export controls, sanctions screening, prohibited end-use checks, and data protection review.',
  '',
  '### 8.1 Export Controls and Trade Compliance',
  '',
  'Restricted advanced compute cases require classification, end-use certificate, destination approval, denied-party screening, and human owner review.',
  '',
  '## 17. Responsible AI and Ethical Governance',
  '',
  'Responsible AI reviews require human oversight, bias assessment, and model governance controls. This context is advisory and not official policy.'
].join('\n');

test('governance reference index stores sanitized context locally without browser embeddings', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-reference-local-'));
  try {
    await withEnv({
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_REFERENCE_CONTEXT_DIR: dir,
      COMPASS_GATEWAY_TOKEN: '',
      PARALLAX42_GATEWAY_TOKEN: '',
      CREWAI_LLM_API_KEY: '',
      OPENAI_API_KEY: '',
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      const result = await indexGovernanceReference({
        markdown: SAMPLE_REFERENCE,
        sourceId: 'sanitised_enterprise_ai_governance_context',
        corpusType: 'ai_governance',
        lane: 'ai_governance',
        jurisdiction: 'global',
        documentType: 'sanitised_context',
        sourceUrl: 'https://example.invalid/reference'
      });
      const search = await searchGovernanceReferences({
        query: 'export controls sanctions end-use certificate',
        topK: 2
      });

      assert.equal(result.ok, true);
      assert.equal(result.index.provider, 'local_file');
      assert.equal(result.index.browserEmbeddingsRetained, false);
      assert.equal(search.references.length > 0, true);
      assert.equal(search.references[0].authority, 'context_reference_not_policy');
      assert.equal(search.references[0].requiresHumanReview, true);
      assert.equal(search.references[0].metadata.corpusType, 'ai_governance');
      assert.equal(search.references[0].metadata.lane, 'ai_governance');
      assert.equal(search.references[0].metadata.sourceUrl, 'https://example.invalid/reference');
      assert.equal(search.references[0].embedding, undefined);
      assert.equal(governanceReferenceHealth().localChunkCount > 0, true);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('qdrant governance reference index writes typed payloads without vectors in payload', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_VECTOR_STORE_PROVIDER: 'qdrant',
      QDRANT_URL: 'https://qdrant.example',
      QDRANT_API_KEY: 'qdrant-key',
      QDRANT_COLLECTION: 'p42_test_collection'
    }, async () => {
      global.fetch = async (url, options = {}) => {
        calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null });
        if (url === 'https://gateway.example/api/embeddings') {
          const body = JSON.parse(options.body);
          assert.equal(body.purpose, 'governance_reference_index');
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'text-embedding-3-large',
              data: [{ embedding: [0.1, 0.2, 0.3] }]
            })
          };
        }
        if (url === 'https://qdrant.example/collections/p42_test_collection' && options.method === 'GET') {
          return { ok: false, status: 404, text: async () => JSON.stringify({ status: { error: 'not found' } }) };
        }
        if (url === 'https://qdrant.example/collections/p42_test_collection' && options.method === 'PUT') {
          return { ok: true, status: 200, text: async () => JSON.stringify({ result: true }) };
        }
        if (url === 'https://qdrant.example/collections/p42_test_collection/points?wait=true') {
          assert.equal(options.headers['api-key'], 'qdrant-key');
          const point = calls.at(-1).body.points[0];
          assert.equal(point.payload.type, 'governance_reference');
          assert.equal(point.payload.workspaceId, 'parallax42');
          assert.equal(point.payload.projectId, 'compliance-intelligence-agent');
          assert.equal(point.payload.sourceId, 'sanitised_enterprise_ai_governance_context');
          assert.equal(point.payload.corpusType, 'sanctions_export');
          assert.equal(point.payload.lane, 'sanctions_export');
          assert.equal(point.payload.documentType, 'reference_manifest');
          assert.equal(point.payload.embedding, undefined);
          assert.deepEqual(point.vector, [0.1, 0.2, 0.3]);
          return { ok: true, status: 200, text: async () => JSON.stringify({ result: true }) };
        }
        throw new Error(`Unexpected fetch ${url}`);
      };

      const result = await indexGovernanceReference({
        markdown: '## 8. Export Control\n\nEnd-use and sanctions checks are required.',
        sourceId: 'sanitised_enterprise_ai_governance_context',
        corpusType: 'sanctions_export',
        lane: 'sanctions_export',
        jurisdiction: 'global',
        documentType: 'reference_manifest'
      });

      assert.equal(result.index.provider, 'qdrant');
      assert.equal(result.index.browserEmbeddingsRetained, false);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('qdrant governance reference search returns safe snippets and no vectors', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_VECTOR_STORE_PROVIDER: 'qdrant',
      QDRANT_URL: 'https://qdrant.example',
      QDRANT_COLLECTION: 'p42_test_collection'
    }, async () => {
      global.fetch = async (url, options = {}) => {
        if (url === 'https://gateway.example/api/embeddings') {
          const body = JSON.parse(options.body);
          assert.equal(body.purpose, 'governance_reference_search');
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'text-embedding-3-large',
              data: [{ embedding: [0.3, 0.2, 0.1] }]
            })
          };
        }
        if (url === 'https://qdrant.example/collections/p42_test_collection/points/query') {
          const body = JSON.parse(options.body);
          assert.deepEqual(body.query, [0.3, 0.2, 0.1]);
          assert.equal(body.vector, undefined);
          assert.equal(body.with_vector, false);
          assert.ok(body.filter.must.some((item) => item.key === 'type' && item.match.value === 'governance_reference'));
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              result: {
                points: [{
                  score: 0.88,
                  payload: {
                    type: 'governance_reference',
                    sourceId: 'sanitised_enterprise_ai_governance_context',
                    title: 'Sanitised Enterprise AI Governance Context',
                    section: '8.1',
                    heading: 'Export Controls and Trade Compliance',
                    snippet: 'Classification, end-use certificate, and sanctions screening are expected.',
                    text: 'Classification, end-use certificate, and sanctions screening are expected.',
                    frameworks: ['SAA'],
                    domains: ['trade_compliance'],
                    tags: ['export controls'],
                    authority: 'context_reference_not_policy',
                    requiresHumanReview: true
                  }
                }]
              }
            })
          };
        }
        throw new Error(`Unexpected fetch ${url}`);
      };

      const result = await searchGovernanceReferences({
        query: 'export control end-use certificate',
        topK: 3
      });

      assert.equal(result.index.provider, 'qdrant');
      assert.equal(result.index.browserEmbeddingsRetained, false);
      assert.equal(result.references.length, 1);
      assert.equal(result.references[0].heading, 'Export Controls and Trade Compliance');
      assert.equal(result.references[0].embedding, undefined);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation retrieval adds governance references before planning next question', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-reference-conversation-'));
  try {
    await withEnv({
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_REFERENCE_CONTEXT_DIR: dir,
      P42_LEARNING_MEMORY_DIR: dir,
      COMPASS_GATEWAY_TOKEN: '',
      PARALLAX42_GATEWAY_TOKEN: '',
      CREWAI_LLM_API_KEY: '',
      OPENAI_API_KEY: '',
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      await indexGovernanceReference({
        markdown: SAMPLE_REFERENCE,
        sourceId: 'sanitised_enterprise_ai_governance_context'
      });
      const enriched = await enrichConversationWithServerRetrieval({
        message: 'Review an AI accelerator import with remote firmware access and no final end-use certificate.',
        caseDraft: {
          caseId: 'case-governance-reference',
          brief: 'AI accelerator import with remote firmware access and end-use evidence pending.',
          riskSignals: ['export control', 'remote support access']
        }
      });

      assert.equal(enriched.caseDraft.retrievalContext.governanceReferences.length > 0, true);
      assert.match(enriched.caseDraft.retrievalContext.governanceReferences[0].heading, /Export|SAA|Compliance/i);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
