'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { processConversation } = require('../../lib/conversationAgent');
const { assessConversationWithLlm } = require('../../lib/conversationLlmAssessor');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-chat-llm-test-'));
  return path.join(dir, 'features.json');
}

test('conversation LLM assessor skips safely when Compass token is absent', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => {
      throw new Error('fetch should not be called without a token');
    };

    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_TOKEN: '',
      PARALLAX42_GATEWAY_TOKEN: '',
      CREWAI_LLM_API_KEY: '',
      OPENAI_API_KEY: ''
    }, async () => {
      const result = await assessConversationWithLlm({
        message: 'I have a request to outsource payroll'
      });

      assert.equal(result.llmAssessment.used, false);
      assert.match(result.llmAssessment.reason, /token is not configured/i);
      assert.equal(result.caseDraft, undefined);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor merges strict Compass JSON into the case draft', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(url, 'https://gateway.example/api/chat/completions');
        assert.equal(options.headers['x-parallax42-gateway-token'], 'test-token');
        assert.equal(body.model, 'gpt-5.1');
        assert.match(body.messages[1].content, /latestMessage/);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: 'owner_answer',
                    requestType: 'payroll_outsourcing',
                    reviewTarget: 'payroll outsourcing vendor',
                    reviewScope: 'third-party payroll processing',
                    recommendedFirstAction: 'ask_geography',
                    confidence: 0.92,
                    reason: 'The terse response answers the previous owner question.',
                    nextBestQuestion: 'Which geography applies?',
                    caseUpdate: {
                      businessUnit: 'HR',
                      integrations: ['Payroll/HRIS'],
                      dataOrAssets: ['employee payroll data'],
                      riskSignals: ['outsourced service']
                    }
                  })
                }
              }
            ]
          })
        };
      };

      const assessed = await assessConversationWithLlm({
        message: 'HR',
        caseDraft: {
          brief: 'I have a request to outsource payroll',
          questions: ['Who will own this payroll outsourcing risk internally: HR/People, Finance/Payroll, Procurement, or another named team?']
        }
      });

      assert.equal(assessed.llmAssessment.used, true);
      assert.equal(assessed.llmAssessment.intent, 'owner_answer');
      assert.equal(assessed.llmAssessment.requestType, 'payroll_outsourcing');
      assert.equal(assessed.llmAssessment.reviewTarget, 'payroll outsourcing vendor');
      assert.equal(assessed.llmAssessment.recommendedFirstAction, 'ask_geography');
      assert.equal(assessed.caseDraft.businessUnit, 'HR');
      assert.ok(assessed.caseDraft.integrations.includes('Payroll/HRIS'));
      assert.ok(assessed.caseDraft.riskSignals.includes('personal data'));
      assert.ok(assessed.caseDraft.riskSignals.includes('outsourced service'));
      assert.equal(assessed.caseDraft.llmIntake.advisoryOnly, true);
      assert.equal(assessed.caseDraft.llmIntake.requestType, 'payroll_outsourcing');
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation result exposes Compass assessment as advisory intake metadata', () => {
  const result = processConversation({
    message: 'HR',
    caseDraft: {
      brief: 'I have a request to outsource payroll',
      questions: ['Who will own this payroll outsourcing risk internally: HR/People, Finance/Payroll, Procurement, or another named team?']
    },
    llmAssessment: {
      provider: 'compass_gateway',
      model: 'gpt-5.1',
      used: true,
      advisoryOnly: true,
      intent: 'owner_answer',
      requestType: 'payroll_outsourcing',
      reviewTarget: 'payroll outsourcing vendor',
      recommendedFirstAction: 'ask_geography',
      confidence: 0.9,
      reason: 'Terse owner answer.'
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.nlp.llmAssessment.used, true);
  assert.equal(result.nlp.llmAssessment.advisoryOnly, true);
  assert.equal(result.nlp.llmAssessment.requestType, 'payroll_outsourcing');
  assert.ok(result.actions.some((action) => action.id === 'llm_intake_assessment' && action.status === 'complete'));
});

test('conversation LLM assessor classifies document and clause review requests', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(url, 'https://gateway.example/api/chat/completions');
        assert.match(body.messages[1].content, /requestType/);
        assert.match(body.messages[1].content, /recommendedFirstAction/);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: 'case_context',
                    requestType: 'clause_review',
                    reviewTarget: 'termination clauses',
                    reviewScope: 'termination for convenience and liability cap',
                    recommendedFirstAction: 'paste_clause',
                    confidence: 0.94,
                    reason: 'The user asked for specific clauses to be reviewed.',
                    nextBestQuestion: 'Please paste the clauses or upload the source agreement.',
                    caseUpdate: {
                      riskSignals: ['contractual risk']
                    }
                  })
                }
              }
            ]
          })
        };
      };

      const assessed = await assessConversationWithLlm({
        message: 'Can you review these termination clauses?'
      });

      assert.equal(assessed.llmAssessment.used, true);
      assert.equal(assessed.llmAssessment.requestType, 'clause_review');
      assert.equal(assessed.llmAssessment.reviewTarget, 'termination clauses');
      assert.equal(assessed.llmAssessment.recommendedFirstAction, 'paste_clause');
      assert.equal(assessed.caseDraft.llmIntake.requestType, 'clause_review');
      assert.equal(assessed.caseDraft.llmIntake.reviewScope, 'termination for convenience and liability cap');
    });
  } finally {
    global.fetch = originalFetch;
  }
});
