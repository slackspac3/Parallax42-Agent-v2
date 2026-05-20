'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildConversationPlan, planConversationTurn } = require('../../lib/conversationPlanner');

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

function featureConfigPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-conversation-planner-test-'));
  return path.join(dir, 'features.json');
}

test('conversation planner builds explicit deterministic fallback plan when LLM is unavailable', () => {
  const plan = buildConversationPlan({
    message: 'I need to review an agreement',
    caseDraft: {
      retrievalContext: {
        evidenceMatches: [{ evidenceId: 'DOC-1' }],
        similarCases: [{ caseId: 'prior' }],
        learningSuggestions: { commonControlsReviewersAdded: [{ control: 'Signed DPA' }] }
      }
    },
    llmAssessment: {
      used: false,
      reason: 'Compass LLM token is not configured.'
    }
  });

  assert.equal(plan.source, 'deterministic_planner_fallback');
  assert.equal(plan.retrievalBeforePlanning, true);
  assert.equal(plan.deterministicDecisionOwner, true);
  assert.equal(plan.memoryFindings.evidenceMatches, 1);
  assert.equal(plan.memoryFindings.similarCases, 1);
  assert.equal(plan.memoryFindings.controlSuggestions, 1);
  assert.equal(plan.fallbackReason, 'Compass LLM token is not configured.');
});

test('conversation planner calls Compass after retrieval context is prepared', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      global.fetch = async (url, options) => {
        assert.equal(url, 'https://gateway.example/api/chat/completions');
        const body = JSON.parse(options.body);
        assert.match(body.messages[1].content, /retrievalContext/);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'case_context',
                  requestType: 'document_review',
                  reviewTarget: 'agreement',
                  reviewScope: 'full agreement review',
                  recommendedFirstAction: 'upload_document',
                  conversationStage: 'awaiting_document',
                  confidence: 0.91,
                  reason: 'The user asked for an agreement review.',
                  assistantSummary: 'This is an agreement review; I need the source document first.',
                  nextBestQuestion: 'Would you like to upload the agreement now?',
                  caseUpdate: {}
                })
              }
            }]
          })
        };
      };

      const result = await planConversationTurn({
        message: 'I need an agreement reviewed',
        caseDraft: {
          brief: 'I need an agreement reviewed',
          retrievalContext: {
            evidenceMatches: [{ evidenceId: 'DOC-1', title: 'Prior evidence' }]
          }
        }
      });

      assert.equal(result.conversationPlan.usedLlm, true);
      assert.equal(result.conversationPlan.source, 'compass_gpt5_1_planner');
      assert.equal(result.conversationPlan.nextBestAction, 'upload_document');
      assert.equal(result.conversationPlan.nextQuestion, 'Would you like to upload the agreement now?');
      assert.equal(result.caseDraft.llmIntake.requestType, 'document_review');
    });
  } finally {
    global.fetch = originalFetch;
  }
});
