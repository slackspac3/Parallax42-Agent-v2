'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evidenceVectorStoreHealth,
  indexEvidenceServerSide,
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
          indexedEvidence: index.index
        }
      });

      assert.equal(enriched.caseDraft.retrievalContext.matchCount, 1);
      assert.equal(enriched.caseDraft.documents[0].extractionStatus, 'retrieved_chunk');
      assert.equal(enriched.caseDraft.documents[0].chunkId, 'chk_dpa_1');
    });
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});
