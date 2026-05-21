'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { processConversation } = require('../../lib/conversationAgent');
const {
  SMART_INTAKE_UNAVAILABLE_MESSAGE,
  assessConversationWithLlm
} = require('../../lib/conversationLlmAssessor');

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

test('conversation LLM assessor reports smart intake unavailable when Compass token is absent', async () => {
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
      assert.equal(result.llmAssessment.reason, SMART_INTAKE_UNAVAILABLE_MESSAGE);
      assert.equal(result.llmAssessment.userMessage, SMART_INTAKE_UNAVAILABLE_MESSAGE);
      assert.equal(result.llmAssessment.requiresCompass, true);
      assert.equal(result.llmAssessment.smartIntakeUnavailable, true);
      assert.equal(result.caseDraft, undefined);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor treats Compass gateway errors as visible smart intake outages', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      global.fetch = async () => ({
        ok: false,
        status: 502,
        text: async () => 'bad gateway'
      });

      const result = await assessConversationWithLlm({
        message: 'I have an agreement to review'
      });

      assert.equal(result.llmAssessment.used, false);
      assert.equal(result.llmAssessment.reason, SMART_INTAKE_UNAVAILABLE_MESSAGE);
      assert.equal(result.llmAssessment.userMessage, SMART_INTAKE_UNAVAILABLE_MESSAGE);
      assert.equal(result.llmAssessment.requiresCompass, true);
      assert.equal(result.llmAssessment.smartIntakeUnavailable, true);
      assert.match(result.llmAssessment.detail, /bad gateway|502/i);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor calls Compass even if legacy compassLlmCalls feature flag is off', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      P42_FEATURE_COMPASS_LLM_CALLS: '0',
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      let called = false;
      global.fetch = async () => {
        called = true;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                  content: JSON.stringify({
                    intent: 'case_context',
                    requestType: 'saas_agreement_review',
                    workflowType: 'saas_vendor_review',
                    documentTypes: ['saas_agreement'],
                    reviewTarget: 'SaaS agreement',
                    reviewScope: 'customer data and integration terms',
                    recommendedFirstAction: 'upload_document',
                    conversationStage: 'awaiting_document',
                    suggestedWorkflowSteps: ['classify SaaS terms', 'map data and integrations', 'check security/privacy evidence'],
                    assistantSummary: 'This is a SaaS agreement review.',
                    confidence: 0.9,
                    nextBestQuestion: 'Would you like to upload the agreement now?',
                    caseUpdate: {}
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'I have an agreement to review'
      });

      assert.equal(called, true);
      assert.equal(result.llmAssessment.used, true);
      assert.equal(result.llmAssessment.requestType, 'saas_agreement_review');
      assert.equal(result.llmAssessment.workflowType, 'saas_vendor_review');
      assert.deepEqual(result.llmAssessment.documentTypes, ['saas_agreement']);
      assert.equal(result.caseDraft.llmIntake.workflowType, 'saas_vendor_review');
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
                    conversationStage: 'asking_clarification',
                    assistantSummary: 'HR owns the payroll outsourcing review.',
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
      assert.equal(assessed.llmAssessment.conversationStage, 'asking_clarification');
      assert.equal(assessed.llmAssessment.assistantSummary, 'HR owns the payroll outsourcing review.');
      assert.equal(assessed.caseDraft.businessUnit, 'HR');
      assert.ok(assessed.caseDraft.integrations.includes('Payroll/HRIS'));
      assert.ok(assessed.caseDraft.riskSignals.includes('personal data'));
      assert.ok(assessed.caseDraft.riskSignals.includes('outsourced service'));
      assert.equal(assessed.caseDraft.llmIntake.advisoryOnly, true);
      assert.equal(assessed.caseDraft.llmIntake.requestType, 'payroll_outsourcing');
      assert.equal(assessed.caseDraft.llmIntake.conversationStage, 'asking_clarification');
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
      conversationStage: 'asking_clarification',
      assistantSummary: 'HR owns the payroll outsourcing review.',
      confidence: 0.9,
      reason: 'Terse owner answer.'
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.nlp.llmAssessment.used, true);
  assert.equal(result.nlp.llmAssessment.advisoryOnly, true);
  assert.equal(result.nlp.llmAssessment.requestType, 'payroll_outsourcing');
  assert.equal(result.nlp.llmAssessment.conversationStage, 'asking_clarification');
  assert.ok(result.actions.some((action) => action.id === 'llm_intake_assessment' && action.status === 'complete'));
});

test('conversation result surfaces Compass outage instead of asking deterministic fallback questions', () => {
  const result = processConversation({
    message: 'I have an agreement to review',
    conversationPlan: {
      usedLlm: false,
      smartIntakeUnavailable: true,
      requiresCompass: true,
      userMessage: SMART_INTAKE_UNAVAILABLE_MESSAGE,
      fallbackReason: SMART_INTAKE_UNAVAILABLE_MESSAGE
    },
    llmAssessment: {
      provider: 'compass_gateway',
      model: 'gpt-5.1',
      used: false,
      requiresCompass: true,
      smartIntakeUnavailable: true,
      userMessage: SMART_INTAKE_UNAVAILABLE_MESSAGE,
      reason: SMART_INTAKE_UNAVAILABLE_MESSAGE,
      error: true
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.reply, SMART_INTAKE_UNAVAILABLE_MESSAGE);
  assert.deepEqual(result.questions, []);
  assert.equal(result.conversationPlan.smartIntakeUnavailable, true);
  assert.ok(result.actions.some((action) => action.id === 'conversation_planner' && action.status === 'not_available'));
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
                    conversationStage: 'awaiting_document',
                    assistantSummary: 'This is a clause review; I need the clauses before metadata.',
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
      assert.equal(assessed.llmAssessment.conversationStage, 'awaiting_document');
      assert.equal(assessed.caseDraft.llmIntake.requestType, 'clause_review');
      assert.equal(assessed.caseDraft.llmIntake.reviewScope, 'termination for convenience and liability cap');
      assert.equal(assessed.caseDraft.llmIntake.assistantSummary, 'This is a clause review; I need the clauses before metadata.');
    });
  } finally {
    global.fetch = originalFetch;
  }
});
