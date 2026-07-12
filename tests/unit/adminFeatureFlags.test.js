'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildFeatureStatus,
  isFeatureEnabled,
  updateFeatureFlags
} = require('../../lib/adminFeatureFlags');

async function withFeatureConfig(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-feature-flags-test-'));
  const snapshot = process.env.P42_ADMIN_FEATURE_CONFIG_PATH;
  process.env.P42_ADMIN_FEATURE_CONFIG_PATH = path.join(dir, 'features.json');
  try {
    await fn();
  } finally {
    if (snapshot === undefined) delete process.env.P42_ADMIN_FEATURE_CONFIG_PATH;
    else process.env.P42_ADMIN_FEATURE_CONFIG_PATH = snapshot;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('advanced capabilities are requested by default with explicit active/configured status', async () => {
  await withFeatureConfig(async () => {
    const status = buildFeatureStatus();
    assert.equal(status.ok, true);
    assert.ok(status.features.length >= 7);
    assert.equal(status.features.every((feature) => feature.enabled === true), true);

    const qdrant = status.features.find((feature) => feature.id === 'qdrantRag');
    assert.equal(qdrant.enabled, true);
    assert.equal(qdrant.active, false);
    assert.ok(qdrant.unmetRequirements.length >= 1);
  });
});

test('admin feature updates can switch advanced components off without changing env', async () => {
  await withFeatureConfig(async () => {
    const status = updateFeatureFlags({
      compassLlmCalls: false,
      externalParserRelay: false
    }, { username: 'unit-test-admin' });

    assert.deepEqual(status.changed.sort(), ['compassLlmCalls', 'externalParserRelay'].sort());
    assert.equal(isFeatureEnabled('compassLlmCalls'), false);
    assert.equal(isFeatureEnabled('externalParserRelay'), false);

    const refreshed = buildFeatureStatus();
    assert.equal(refreshed.features.find((feature) => feature.id === 'compassLlmCalls').source, 'admin');
    assert.equal(refreshed.features.find((feature) => feature.id === 'externalParserRelay').enabled, false);
  });
});

test('explicit deterministic demo embeddings make configured Qdrant capabilities active without Compass', async () => {
  await withFeatureConfig(async () => {
    const snapshot = {
      P42_DEMO_EMBEDDINGS: process.env.P42_DEMO_EMBEDDINGS,
      QDRANT_URL: process.env.QDRANT_URL,
      COMPASS_GATEWAY_TOKEN: process.env.COMPASS_GATEWAY_TOKEN,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };
    process.env.P42_DEMO_EMBEDDINGS = 'true';
    process.env.QDRANT_URL = 'https://qdrant.example';
    delete process.env.COMPASS_GATEWAY_TOKEN;
    delete process.env.OPENAI_API_KEY;
    try {
      const status = buildFeatureStatus();
      const qdrant = status.features.find((feature) => feature.id === 'qdrantRag');
      const learning = status.features.find((feature) => feature.id === 'qdrantLearningMemory');
      assert.equal(qdrant.active, true);
      assert.equal(qdrant.configured, true);
      assert.match(qdrant.note, /deterministic demo hash/i);
      assert.equal(learning.active, true);
    } finally {
      for (const [key, value] of Object.entries(snapshot)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
