'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEMO_EMBEDDINGS_MODEL,
  EMBEDDINGS_MODEL,
  LLM_MODEL,
  chatCompletion,
  deterministicDemoEmbedding,
  gatewayHealth,
  indexEvidence,
  isDirectOpenAICompatibleBase,
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

test('direct Compass OpenAI-compatible aliases support embedding without gateway relay', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: '',
      COMPASS_GATEWAY_URL: '',
      COMPASS_GATEWAY_TOKEN: '',
      PARALLAX42_GATEWAY_TOKEN: '',
      OPENAI_BASE_URL: 'https://compass.core42.ai/v1',
      OPENAI_API_KEY: 'direct-compass-token',
      EMBEDDINGS_MODEL: 'text-embedding-3-large'
    }, async () => {
      assert.equal(isDirectOpenAICompatibleBase(), true);
      assert.equal(gatewayHealth().directOpenAiCompatible, true);

      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(url, 'https://compass.core42.ai/v1/embeddings');
        assert.equal(options.headers.authorization, 'Bearer direct-compass-token');
        assert.equal(body.model, 'text-embedding-3-large');
        assert.deepEqual(body.input, ['Export controls and signed DPA evidence.']);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'text-embedding-3-large',
            data: [{ embedding: [0.2, 0.4, 0.6] }]
          })
        };
      };

      const result = await indexEvidence({
        documents: [{ evidenceId: 'DOC-1', text: 'Export controls and signed DPA evidence.' }]
      });

      assert.equal(result.ok, true);
      assert.equal(result.model, 'text-embedding-3-large');
      assert.deepEqual(result.chunks[0].embedding, [0.2, 0.4, 0.6]);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('explicit demo embeddings provide real deterministic retrieval without a model credential', async () => {
  await withEnv({
    P42_DEMO_EMBEDDINGS: 'true',
    QDRANT_VECTOR_SIZE: '128',
    COMPASS_GATEWAY_TOKEN: '',
    PARALLAX42_GATEWAY_TOKEN: '',
    CREWAI_LLM_API_KEY: '',
    OPENAI_API_KEY: ''
  }, async () => {
    const first = deterministicDemoEmbedding('signed DPA retention schedule', 128);
    const second = deterministicDemoEmbedding('signed DPA retention schedule', 128);
    assert.deepEqual(first, second);
    assert.equal(first.length, 128);

    const indexed = await indexEvidence({
      caseId: 'demo-case',
      documents: [
        { evidenceId: 'DPA-1', text: 'Signed DPA with a thirty day retention and deletion schedule.' },
        { evidenceId: 'BCP-1', text: 'Continuity exercise and disaster recovery plan.' }
      ]
    });
    assert.equal(indexed.model, DEMO_EMBEDDINGS_MODEL);
    assert.equal(indexed.deterministicDemo, true);
    assert.equal(indexed.chunks.length, 2);

    const searched = await searchEvidence({
      caseId: 'demo-case',
      query: 'signed DPA retention deletion',
      chunks: indexed.chunks,
      topK: 1
    });
    assert.equal(searched.model, DEMO_EMBEDDINGS_MODEL);
    assert.equal(searched.matches[0].evidenceId, 'DPA-1');
    assert.ok(searched.matches[0].score > 0);
    assert.equal(gatewayHealth().features.deterministicDemoEmbeddings, true);
  });
});

test('shared chat gateway enforces the LLM kill switch before making a request', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: `/tmp/p42-compass-features-${process.pid}-${Date.now()}.json`,
      P42_FEATURE_COMPASS_LLM_CALLS: '0',
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token'
    }, async () => {
      global.fetch = async () => {
        throw new Error('fetch must not run while the LLM kill switch is off');
      };

      await assert.rejects(
        chatCompletion({ messages: [{ role: 'user', content: 'Review this case.' }] }),
        /disabled by admin feature controls/i
      );
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('shared chat gateway applies a bounded native fetch timeout', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: `/tmp/p42-compass-features-${process.pid}-${Date.now()}-timeout.json`,
      P42_FEATURE_COMPASS_LLM_CALLS: '1',
      P42_GATEWAY_TIMEOUT_MS: '2500',
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token'
    }, async () => {
      global.fetch = async (url, options) => {
        assert.equal(url, 'https://gateway.example/api/chat/completions');
        assert.ok(options.signal instanceof AbortSignal);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ choices: [{ message: { content: 'Advisory response' } }] })
        };
      };

      const result = await chatCompletion({ messages: [{ role: 'user', content: 'Review this case.' }] });
      assert.equal(result.choices[0].message.content, 'Advisory response');
    });
  } finally {
    global.fetch = originalFetch;
  }
});
