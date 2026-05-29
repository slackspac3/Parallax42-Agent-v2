'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ADMIN_STATUS_MODULES = [
  '../../lib/requestLimits',
  '../../lib/conversationLlmAssessor',
  '../../lib/adminStatus'
];

function clearAdminStatusModules() {
  for (const moduleId of ADMIN_STATUS_MODULES) {
    delete require.cache[require.resolve(moduleId)];
  }
}

async function withAdminStatusEnv(overrides, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-admin-status-test-'));
  const keys = Array.from(new Set([
    ...Object.keys(overrides),
    'P42_ADMIN_FEATURE_CONFIG_PATH',
    'AGENT_AUDIT_DIR'
  ]));
  const snapshot = {};
  for (const key of keys) snapshot[key] = process.env[key];
  process.env.P42_ADMIN_FEATURE_CONFIG_PATH = path.join(dir, 'features.json');
  process.env.AGENT_AUDIT_DIR = path.join(dir, 'audit');
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  clearAdminStatusModules();
  try {
    await fn(require('../../lib/adminStatus').buildAdminStatus());
  } finally {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
    clearAdminStatusModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('buildAdminStatus exposes safe effective operational settings', async () => {
  await withAdminStatusEnv({
    COMPASS_GATEWAY_TOKEN: 'super-secret-gateway-token',
    CONVERSATION_BODY_LIMIT_BYTES: '1mb',
    EVIDENCE_INDEX_BODY_LIMIT_BYTES: '2mb',
    EVIDENCE_SEARCH_BODY_LIMIT_BYTES: '3mb',
    REVIEW_PACK_BODY_LIMIT_BYTES: '4mb',
    STANDARD_RUN_BODY_LIMIT_BYTES: '5mb',
    ADMIN_BODY_LIMIT_BYTES: '256kb',
    EVIDENCE_UPLOAD_MAX_FILE_BYTES: '31mb',
    EVIDENCE_UPLOAD_MAX_BATCH_BYTES: '93mb',
    EVIDENCE_UPLOAD_CHUNK_SIZE_BYTES: '2mb',
    CONVERSATION_LLM_MAX_ATTEMPTS: '4',
    CONVERSATION_LLM_FAST_FAIL_MS: '1234',
    CONVERSATION_LLM_BACKOFF_BASE_MS: '77',
    CONVERSATION_LLM_MAX_RETRY_DELAY_MS: '88',
    CONVERSATION_LLM_RATE_LIMIT_MAX_RETRY_DELAY_MS: '99',
    CONVERSATION_LLM_RETRY_JITTER_MS: '0',
    CONVERSATION_LLM_STRUCTURED_MAX_TOKENS: '1111',
    CONVERSATION_LLM_NATURAL_MAX_TOKENS: '1234',
    CONVERSATION_LLM_NATURAL_RESPONSE_MAX_CHARS: '4321',
    CONVERSATION_LLM_HISTORY_TURNS: '33',
    CONVERSATION_LLM_TURN_MAX_CHARS: '2222',
    CONVERSATION_LLM_RECENT_TURNS_FOR_PROMPT: '14',
    CONVERSATION_LLM_BRIEF_MAX_CHARS: '3333',
    CONVERSATION_LLM_DOCUMENT_SUMMARY_MAX_CHARS: '444',
    CONVERSATION_LLM_MEMORY_SUMMARY_MAX_CHARS: '5555'
  }, async (status) => {
    assert.equal(status.status, 'ok');
    assert.equal(status.gateway.configured, true);
    assert.deepEqual(status.settings.requestLimits, {
      conversation: 1 * 1024 * 1024,
      evidenceIndex: 2 * 1024 * 1024,
      evidenceSearch: 3 * 1024 * 1024,
      reviewPack: 4 * 1024 * 1024,
      standardRun: 5 * 1024 * 1024,
      admin: 256 * 1024
    });
    assert.deepEqual(status.settings.uploadTargetLimits, {
      maxFileBytes: 31 * 1024 * 1024,
      maxBatchBytes: 93 * 1024 * 1024,
      chunkSizeBytes: 2 * 1024 * 1024
    });
    assert.deepEqual(status.settings.llmRetry, {
      maxAttempts: 4,
      fastFailMs: 1234,
      backoffBaseMs: 77,
      maxRetryDelayMs: 88,
      rateLimitMaxRetryDelayMs: 99,
      retryJitterMs: 0
    });
    assert.deepEqual(status.settings.llmTokens, {
      structuredMaxTokens: 1111,
      retryStructuredMaxTokens: 1111,
      naturalResponseMaxTokens: 1234,
      naturalResponseMaxChars: 4321
    });
    assert.deepEqual(status.settings.context, {
      historyTurns: 33,
      turnMaxChars: 2222,
      recentTurnsForPrompt: 14,
      compactRecentTurnsForPrompt: 6,
      briefMaxChars: 3333,
      documentSummaryMaxChars: 444,
      memorySummaryMaxChars: 5555
    });
    assert.doesNotMatch(JSON.stringify(status), /super-secret-gateway-token/);
  });
});
