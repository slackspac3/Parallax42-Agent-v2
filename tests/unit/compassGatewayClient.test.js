'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EMBEDDINGS_MODEL,
  LLM_MODEL,
  gatewayHealth,
  indexEvidence,
  searchEvidence
} = require('../../lib/compassGatewayClient');

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

test('gateway health exposes the approved model boundary', () => {
  const health = gatewayHealth();
  assert.equal(health.llmModel, LLM_MODEL);
  assert.equal(health.embeddingsModel, EMBEDDINGS_MODEL);
  assert.ok(health.reusableRoutes.includes('/api/evidence/index'));
});

test('evidence indexing calls the reusable gateway with project context', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_WORKSPACE_ID: 'workspace-one',
      P42_PROJECT_ID: 'project-one'
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(url, 'https://gateway.example/api/evidence/index');
        assert.equal(options.headers['x-parallax42-gateway-token'], 'test-token');
        assert.equal(body.workspaceId, 'workspace-one');
        assert.equal(body.projectId, 'project-one');
        assert.equal(body.purpose, 'evidence_index');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            ok: true,
            context: { workspaceId: body.workspaceId, projectId: body.projectId },
            chunking: { chunkCount: 1 },
            chunks: [{ chunkId: 'chk_1', evidenceId: 'DOC-1', embedding: [0.1, 0.2] }]
          })
        };
      };

      const result = await indexEvidence({
        documents: [{ evidenceId: 'DOC-1', text: 'Export classification and end-use evidence.' }]
      });

      assert.equal(result.ok, true);
      assert.equal(result.chunking.chunkCount, 1);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('evidence search forwards query and chunk vectors through the gateway', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token'
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(url, 'https://gateway.example/api/evidence/search');
        assert.equal(body.query, 'missing export-control evidence');
        assert.equal(body.purpose, 'evidence_search');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            ok: true,
            matches: [{ chunkId: 'chk_1', score: 0.92 }]
          })
        };
      };

      const result = await searchEvidence({
        query: 'missing export-control evidence',
        chunks: [{ chunkId: 'chk_1', embedding: [0.1, 0.2] }]
      });

      assert.equal(result.matches[0].score, 0.92);
    });
  } finally {
    global.fetch = originalFetch;
  }
});
