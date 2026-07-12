'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evidenceVectorStoreHealth,
  indexEvidenceServerSide,
  runQdrantSmokeTest,
  searchEvidenceServerSide
} = require('../../lib/evidenceVectorStore');
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
        if (snapshot[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = snapshot[key];
        }
      }
    });
}

test('server-side evidence index stores embeddings without returning them to the browser', async () => {
  const originalFetch = global.fetch;
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-vector-store-'));
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_VECTOR_STORE_DIR: storeDir,
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(url, 'https://gateway.example/api/evidence/index');
        assert.equal(body.caseId, 'case-123');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            ok: true,
            model: 'text-embedding-3-large',
            context: { caseId: body.caseId, workspaceId: body.workspaceId, projectId: body.projectId },
            chunking: { chunkCount: 1 },
            chunks: [{
              chunkId: 'chk_1',
              evidenceId: 'DOC-1',
              title: 'DPA',
              text: 'Signed DPA and retention schedule.',
              embedding: [0.1, 0.2, 0.3],
              metadata: { sourceType: 'backend_parsed' }
            }]
          })
        };
      };

      const result = await indexEvidenceServerSide({
        caseId: 'case-123',
        documents: [{ evidenceId: 'DOC-1', text: 'Signed DPA and retention schedule.' }]
      });

      assert.equal(result.ok, true);
      assert.equal(result.index.browserEmbeddingsRetained, false);
      assert.equal(result.index.chunkCount, 1);
      assert.deepEqual(result.chunks[0].embedding, undefined);
      assert.equal(result.chunks[0].text, undefined);

      const store = JSON.parse(fs.readFileSync(path.join(storeDir, 'evidence-vector-index.json'), 'utf8'));
      const storedChunk = Object.values(store.indexes)[0].chunks[0];
      assert.deepEqual(storedChunk.embedding, [0.1, 0.2, 0.3]);
    });
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});

test('server-side evidence search retrieves stored chunks by case id before gateway search', async () => {
  const originalFetch = global.fetch;
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-vector-search-'));
  const seen = [];
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_VECTOR_STORE_DIR: storeDir,
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        seen.push({ url, body });
        if (url.endsWith('/evidence/index')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              ok: true,
              context: { caseId: body.caseId, workspaceId: body.workspaceId, projectId: body.projectId },
              chunking: { chunkCount: 1 },
              chunks: [{
                chunkId: 'chk_1',
                evidenceId: 'DOC-1',
                text: 'Continuity and exit plan are attached.',
                embedding: [0.4, 0.5]
              }]
            })
          };
        }
        assert.equal(url, 'https://gateway.example/api/evidence/search');
        assert.equal(body.caseId, 'case-abc');
        assert.equal(body.query, 'continuity evidence');
        assert.equal(body.chunks.length, 1);
        assert.deepEqual(body.chunks[0].embedding, [0.4, 0.5]);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            ok: true,
            matches: [{ chunkId: 'chk_1', evidenceId: 'DOC-1', score: 0.91 }]
          })
        };
      };

      await indexEvidenceServerSide({
        caseId: 'case-abc',
        documents: [{ evidenceId: 'DOC-1', text: 'Continuity and exit plan are attached.' }]
      });
      const result = await searchEvidenceServerSide({
        caseId: 'case-abc',
        query: 'continuity evidence'
      });

      assert.equal(result.matches[0].score, 0.91);
      assert.equal(result.index.browserEmbeddingsRetained, false);
      assert.equal(seen.length, 2);
      assert.equal(evidenceVectorStoreHealth().browserEmbeddingsRetained, false);
    });
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});

test('authenticated evidence indexes are scoped by actor to prevent cross-user case id access', async () => {
  const originalFetch = global.fetch;
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-vector-actor-scope-'));
  const seen = [];
  const actorA = { authenticated: true, id: 'user-a', username: 'user-a@example.com' };
  const actorB = { authenticated: true, id: 'user-b', username: 'user-b@example.com' };
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_VECTOR_STORE_DIR: storeDir,
      P42_WORKSPACE_ID: undefined,
      P42_PROJECT_ID: undefined,
      P42_TRUST_CLIENT_VECTOR_NAMESPACE: undefined,
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        seen.push({ url, body });
        if (url.endsWith('/evidence/index')) {
          assert.match(body.workspaceId, /^parallax42:actor:/);
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              ok: true,
              context: { caseId: body.caseId, workspaceId: body.workspaceId, projectId: body.projectId },
              chunking: { chunkCount: 1 },
              chunks: [{
                chunkId: 'chk_actor_1',
                evidenceId: 'DOC-A',
                text: 'Actor A confidential evidence.',
                embedding: [0.4, 0.5]
              }]
            })
          };
        }
        assert.equal(url, 'https://gateway.example/api/evidence/search');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            ok: true,
            matches: [{ chunkId: 'chk_actor_1', evidenceId: 'DOC-A', score: 0.9 }]
          })
        };
      };

      const index = await indexEvidenceServerSide({
        caseId: 'shared-case-id',
        workspaceId: 'attacker-selected-workspace',
        documents: [{ evidenceId: 'DOC-A', text: 'Actor A confidential evidence.' }]
      }, { actor: actorA });
      assert.equal(index.index.actorScoped, true);

      const actorAResult = await searchEvidenceServerSide({
        caseId: 'shared-case-id',
        query: 'confidential evidence'
      }, { actor: actorA });
      assert.equal(actorAResult.matches.length, 1);
      assert.equal(actorAResult.index.actorScoped, true);

      const actorBResult = await searchEvidenceServerSide({
        caseId: 'shared-case-id',
        query: 'confidential evidence'
      }, { actor: actorB });
      assert.equal(actorBResult.matches.length, 0);
      assert.equal(actorBResult.index.actorScoped, true);
      assert.equal(seen.filter((call) => call.url.endsWith('/evidence/search')).length, 1);
    });
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});

test('client request cannot trigger qdrant workspace fallback search', async () => {
  const originalFetch = global.fetch;
  const qdrantSearchBodies = [];
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_VECTOR_STORE_PROVIDER: 'qdrant',
      QDRANT_URL: 'https://qdrant.example',
      QDRANT_COLLECTION: 'p42_test_collection',
      P42_ALLOW_WORKSPACE_VECTOR_FALLBACK: undefined
    }, async () => {
      global.fetch = async (url, options = {}) => {
        if (url === 'https://gateway.example/api/embeddings') {
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
          qdrantSearchBodies.push(body);
          assert.ok(options.signal instanceof AbortSignal);
          assert.deepEqual(body.query, [0.3, 0.2, 0.1]);
          assert.equal(body.vector, undefined);
          assert.ok(body.filter.must.some((item) => item.key === 'caseId' && item.match.value === 'case-qdrant'));
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ result: [] })
          };
        }
        throw new Error(`Unexpected fetch ${url}`);
      };

      const result = await searchEvidenceServerSide({
        caseId: 'case-qdrant',
        query: 'DPA retention',
        allowWorkspaceFallback: true
      });

      assert.equal(result.matches.length, 0);
      assert.equal(result.index.fallbackScope, 'case');
      assert.equal(qdrantSearchBodies.length, 1);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation force-run enrichment performs retrieval server-side by case id', async () => {
  const originalFetch = global.fetch;
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-conversation-retrieval-'));
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_VECTOR_STORE_DIR: storeDir,
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (url.endsWith('/evidence/index')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              ok: true,
              context: { caseId: body.caseId, workspaceId: body.workspaceId, projectId: body.projectId },
              chunking: { chunkCount: 1 },
              chunks: [{
                chunkId: 'chk_dpa_1',
                evidenceId: 'DOC-DPA',
                title: 'DPA clause',
                text: 'The agreement includes signed DPA, retention, and deletion assistance.',
                embedding: [0.7, 0.8]
              }]
            })
          };
        }
        assert.equal(url, 'https://gateway.example/api/evidence/search');
        assert.equal(body.caseId, 'case-force-run');
        assert.equal(body.chunks.length, 1);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            ok: true,
            model: 'text-embedding-3-large',
            matches: [{
              chunkId: 'chk_dpa_1',
              evidenceId: 'DOC-DPA',
              title: 'DPA clause',
              text: 'The agreement includes signed DPA, retention, and deletion assistance.',
              score: 0.94
            }]
          })
        };
      };

      const index = await indexEvidenceServerSide({
        caseId: 'case-force-run',
        documents: [{ evidenceId: 'DOC-DPA', text: 'The agreement includes signed DPA, retention, and deletion assistance.' }]
      });
      const enriched = await enrichConversationWithServerRetrieval({
        forceRun: true,
        message: 'run it',
        caseDraft: {
          caseId: 'case-force-run',
          supplierName: 'Aster Cloud',
          businessUnit: 'Head of IT',
          geography: 'UAE',
          brief: 'Review employee data platform evidence.',
          indexedEvidence: index.index,
          documents: [{
            evidenceId: 'RET-OLD',
            title: 'Stale retrieved evidence',
            extractionStatus: 'retrieved_chunk',
            chunkId: 'chk_stale_1',
            text: 'An older agreement version.'
          }],
          retrievalContext: {
            query: 'older agreement version',
            indexVersion: 'stale-index-version',
            matchCount: 1,
            matches: [{
              chunkId: 'chk_stale_1',
              evidenceId: 'DOC-OLD',
              text: 'An older agreement version.'
            }]
          }
        }
      });

      assert.equal(enriched.caseDraft.retrievalContext.matchCount, 1);
      assert.equal(enriched.caseDraft.retrievalContext.serverAuthoritative, true);
      assert.equal(enriched.caseDraft.retrievalContext.indexVersion, index.index.updatedAt);
      assert.notEqual(enriched.caseDraft.retrievalContext.query, 'older agreement version');
      assert.ok(enriched.caseDraft.retrievalContext.retrievedAt);
      assert.equal(enriched.caseDraft.documents[0].extractionStatus, 'retrieved_chunk');
      assert.equal(enriched.caseDraft.documents[0].chunkId, 'chk_dpa_1');
      assert.equal(enriched.caseDraft.documents.some((doc) => doc.chunkId === 'chk_stale_1'), false);
      assert.equal(enriched.caseDraft.retrievalContext.matches.some((match) => match.chunkId === 'chk_stale_1'), false);
    });
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});

test('qdrant provider stores governed evidence payloads without returning vectors', async () => {
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
        if (url === 'https://gateway.example/api/evidence/index') {
          const body = JSON.parse(options.body);
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              ok: true,
              model: 'text-embedding-3-large',
              context: { caseId: body.caseId, workspaceId: body.workspaceId, projectId: body.projectId },
              chunking: { chunkCount: 1 },
              chunks: [{
                chunkId: 'chk_dpa_1',
                chunkIndex: 0,
                evidenceId: 'DOC-DPA',
                documentId: 'DPA-001',
                title: 'DPA Clause',
                fileName: 'dpa.pdf',
                text: 'Signed DPA and retention schedule are present.',
                embedding: [0.1, 0.2, 0.3],
                metadata: { sourceType: 'backend_parsed', documentType: 'dpa' },
                tags: ['DPA'],
                domains: ['Privacy And Data Governance']
              }]
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
          assert.equal(calls.at(-1).body.points[0].payload.type, 'evidence_chunk');
          assert.equal(calls.at(-1).body.points[0].payload.caseId, 'case-qdrant');
          assert.equal(calls.at(-1).body.points[0].payload.workspaceId, 'parallax42');
          assert.equal(calls.at(-1).body.points[0].payload.projectId, 'compliance-intelligence-agent');
          assert.equal(calls.at(-1).body.points[0].payload.documentId, 'DPA-001');
          assert.equal(calls.at(-1).body.points[0].payload.evidenceId, 'DOC-DPA');
          assert.equal(calls.at(-1).body.points[0].payload.embedding, undefined);
          return { ok: true, status: 200, text: async () => JSON.stringify({ result: true }) };
        }
        throw new Error(`Unexpected fetch ${url}`);
      };

      const result = await indexEvidenceServerSide({
        caseId: 'case-qdrant',
        documents: [{ evidenceId: 'DOC-DPA', text: 'Signed DPA and retention schedule are present.' }]
      });

      assert.equal(result.index.provider, 'qdrant');
      assert.equal(result.index.browserEmbeddingsRetained, false);
      assert.equal(result.chunks[0].embedding, undefined);
      assert.equal(result.chunks[0].snippet, 'Signed DPA and retention schedule are present.');
      assert.equal(evidenceVectorStoreHealth().collection, 'p42_test_collection');
      assert.equal(evidenceVectorStoreHealth().qdrantConfigured, true);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('qdrant search embeds the query and returns sanitized citations only', async () => {
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
          assert.equal(body.purpose, 'qdrant_evidence_search');
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
          assert.ok(body.filter.must.some((item) => item.key === 'caseId' && item.match.value === 'case-qdrant'));
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              result: {
                points: [{
                  score: 0.93,
                  payload: {
                    type: 'evidence_chunk',
                    caseId: 'case-qdrant',
                    evidenceId: 'DOC-DPA',
                    chunkId: 'chk_dpa_1',
                    title: 'DPA Clause',
                    text: 'Signed DPA, retention, and deletion assistance are present.',
                    metadata: { sourceType: 'backend_parsed' }
                  }
                }]
              }
            })
          };
        }
        throw new Error(`Unexpected fetch ${url}`);
      };

      const result = await searchEvidenceServerSide({
        caseId: 'case-qdrant',
        query: 'DPA retention',
        topK: 3
      });

      assert.equal(result.index.provider, 'qdrant');
      assert.equal(result.index.browserEmbeddingsRetained, false);
      assert.equal(result.matches.length, 1);
      assert.equal(result.matches[0].text, 'Signed DPA, retention, and deletion assistance are present.');
      assert.equal(result.matches[0].embedding, undefined);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('qdrant smoke script reports skipped when qdrant is not configured', async () => {
  await withEnv({
    P42_VECTOR_STORE_PROVIDER: 'local_file',
    QDRANT_URL: '',
    P42_VECTOR_DB_URL: ''
  }, async () => {
    const result = await runQdrantSmokeTest();
    assert.equal(result.skipped, true);
    assert.equal(result.ok, false);
  });
});
