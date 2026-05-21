'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_EMBEDDINGS_MODEL,
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_LLM_MODEL,
  gatewayConfig,
  parserRelayConfig,
  runtimeConfig,
  vectorConfig
} = require('../../lib/runtimeConfig');

function withEnv(overrides, fn) {
  const snapshot = {};
  for (const key of Object.keys(overrides)) {
    snapshot[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
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

test('runtime config exposes safe defaults without secrets', async () => {
  await withEnv({
    COMPASS_GATEWAY_BASE_URL: undefined,
    COMPASS_GATEWAY_TOKEN: undefined,
    CREWAI_LLM_API_KEY: undefined,
    EMBEDDINGS_MODEL: undefined,
    OPENAI_API_KEY: undefined,
    OPENAI_BASE_URL: undefined,
    QDRANT_URL: undefined,
    QDRANT_API_KEY: undefined,
    PARALLAX42_BACKEND_URL: undefined
  }, async () => {
    const gateway = gatewayConfig();
    assert.equal(gateway.baseUrl, DEFAULT_GATEWAY_BASE_URL);
    assert.equal(gateway.tokenConfigured, false);
    assert.equal(gateway.llmModel, DEFAULT_LLM_MODEL);
    assert.equal(gateway.embeddingsModel, DEFAULT_EMBEDDINGS_MODEL);
    assert.equal(gateway.token, '');

    const vector = vectorConfig();
    assert.equal(vector.provider, 'local_file');
    assert.equal(vector.qdrantConfigured, false);
    assert.equal(vector.qdrantApiKeyConfigured, false);

    const parser = parserRelayConfig();
    assert.equal(parser.configured, false);

    const runtime = runtimeConfig();
    assert.equal(runtime.authMode, 'audit');
    assert.equal(runtime.liveCrewAiRequested, false);
  });
});

test('runtime config detects gateway, qdrant, parser, and live CrewAI settings', async () => {
  await withEnv({
    COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api/',
    COMPASS_GATEWAY_TOKEN: 'secret-token',
    CREWAI_LLM_MODEL: 'gpt-5.1',
    EMBEDDINGS_MODEL: 'text-embedding-3-large',
    P42_VECTOR_STORE_PROVIDER: 'qdrant',
    QDRANT_URL: 'https://qdrant.example/',
    QDRANT_API_KEY: 'qdrant-secret',
    QDRANT_COLLECTION: 'p42_test',
    PARALLAX42_BACKEND_URL: 'https://parser.example',
    CREWAI_ENABLE_LIVE_LLM: '1',
    P42_AUTH_MODE: 'enforced'
  }, async () => {
    const gateway = gatewayConfig();
    assert.equal(gateway.baseUrl, 'https://gateway.example/api');
    assert.equal(gateway.tokenConfigured, true);
    assert.equal(gateway.llmModel, 'gpt-5.1');
    assert.equal(gateway.embeddingsModel, 'text-embedding-3-large');

    const vector = vectorConfig();
    assert.equal(vector.provider, 'qdrant');
    assert.equal(vector.qdrantConfigured, true);
    assert.equal(vector.qdrantApiKeyConfigured, true);
    assert.equal(vector.collection, 'p42_test');

    assert.equal(parserRelayConfig().configured, true);
    assert.equal(runtimeConfig().liveCrewAiRequested, true);
    assert.equal(runtimeConfig().authMode, 'enforced');
  });
});

