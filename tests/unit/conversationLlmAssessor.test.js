'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { processConversation } = require('../../lib/conversationAgent');
const {
  SMART_INTAKE_DEGRADED_MESSAGE,
  SMART_INTAKE_INVALID_RESPONSE_MESSAGE,
  SMART_INTAKE_MALFORMED_DIAGNOSTIC_MESSAGE,
  SMART_INTAKE_UNAVAILABLE_MESSAGE,
  assessConversationWithLlm,
  buildRollingConversationSummary,
  extractChatContent,
  normalizeAssessment,
  retryDelayMs
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
      assert.equal(result.llmAssessment.compassFailureType, 'missing_configuration');
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
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '3',
      CONVERSATION_LLM_MAX_RETRY_DELAY_MS: '1',
      CONVERSATION_LLM_RETRY_JITTER_MS: '0'
    }, async () => {
      let calls = 0;
      global.fetch = async () => ({
        ok: false,
        status: 502,
        text: async () => {
          calls += 1;
          return 'bad gateway';
        }
      });

      const result = await assessConversationWithLlm({
        message: 'I have an agreement to review'
      });

      assert.equal(result.llmAssessment.used, false);
      assert.equal(result.llmAssessment.reason, SMART_INTAKE_UNAVAILABLE_MESSAGE);
      assert.equal(result.llmAssessment.userMessage, SMART_INTAKE_UNAVAILABLE_MESSAGE);
      assert.equal(result.llmAssessment.requiresCompass, true);
      assert.equal(result.llmAssessment.smartIntakeUnavailable, true);
      assert.equal(result.llmAssessment.compassFailureType, 'gateway_failure');
      assert.match(result.llmAssessment.detail, /bad gateway|502/i);
      assert.equal(calls, 3);
      assert.equal(result.llmAssessment.attemptCount, 3);
      assert.equal(result.llmAssessment.attempts.length, 3);
      assert.equal(result.llmAssessment.attempts[0].retryable, true);
      assert.equal(result.llmAssessment.attempts[2].retryable, false);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor distinguishes Compass auth failures from missing configuration', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'expired-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '3'
    }, async () => {
      let calls = 0;
      global.fetch = async () => {
        calls += 1;
        return {
          ok: false,
          status: 401,
          headers: { get: () => '' },
          text: async () => JSON.stringify({ error: 'unauthorized' })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'I have an agreement to review'
      });

      assert.equal(result.llmAssessment.used, false);
      assert.equal(result.llmAssessment.smartIntakeUnavailable, true);
      assert.equal(result.llmAssessment.smartIntakeDegraded, false);
      assert.equal(result.llmAssessment.compassFailureType, 'auth_failure');
      assert.equal(result.llmAssessment.userMessage, SMART_INTAKE_UNAVAILABLE_MESSAGE);
      assert.equal(result.llmAssessment.attemptCount, 1);
      assert.equal(calls, 1);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor degrades to deterministic intake on Compass rate limit', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '2',
      CONVERSATION_LLM_RATE_LIMIT_MAX_RETRY_DELAY_MS: '1',
      CONVERSATION_LLM_RETRY_JITTER_MS: '0'
    }, async () => {
      let calls = 0;
      global.fetch = async () => ({
        ok: false,
        status: 429,
        headers: { get: () => '' },
        text: async () => {
          calls += 1;
          return JSON.stringify({ error: 'rate limit exceeded' });
        }
      });

      const result = await assessConversationWithLlm({
        message: 'Assess a payroll outsourcing supplier',
        caseDraft: {
          businessUnit: 'HR',
          geography: 'UAE',
          brief: 'Assess payroll outsourcing for employee data.'
        }
      });

      assert.equal(calls, 2);
      assert.equal(result.llmAssessment.used, false);
      assert.equal(result.llmAssessment.smartIntakeUnavailable, false);
      assert.equal(result.llmAssessment.smartIntakeDegraded, true);
      assert.equal(result.llmAssessment.compassFailureType, 'rate_limit');
      assert.equal(result.llmAssessment.userMessage, SMART_INTAKE_DEGRADED_MESSAGE);
      assert.equal(result.llmAssessment.status, 429);
      assert.equal(result.caseDraft.businessUnit, 'HR');
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor retries transient Compass failure before succeeding', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '3',
      CONVERSATION_LLM_MAX_RETRY_DELAY_MS: '1',
      CONVERSATION_LLM_RETRY_JITTER_MS: '0'
    }, async () => {
      let calls = 0;
      global.fetch = async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: false,
            status: 503,
            text: async () => 'temporarily unavailable'
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'case_context',
                  requestType: 'supplier_risk',
                  workflowType: 'supplier_risk_review',
                  reviewTarget: 'integration partner',
                  recommendedFirstAction: 'ask_geography',
                  conversationStage: 'asking_clarification',
                  assistantSummary: 'This is an integration partner review.',
                  confidence: 0.82,
                  nextBestQuestion: 'Which geography applies?',
                  caseUpdate: {
                    integrations: ['Oracle ERP'],
                    riskSignals: ['privileged access']
                  }
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'Assess an integration partner with privileged Oracle ERP access.'
      });

      assert.equal(result.llmAssessment.used, true);
      assert.equal(result.llmAssessment.attemptCount, 2);
      assert.equal(result.llmAssessment.retried, true);
      assert.equal(result.llmAssessment.attempts[0].status, 'failed');
      assert.equal(result.llmAssessment.attempts[0].httpStatus, 503);
      assert.equal(result.llmAssessment.attempts[1].status, 'success');
      assert.ok(result.caseDraft.riskSignals.includes('privileged access'));
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM retry policy caps 429 delay and records metadata', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '2',
      CONVERSATION_LLM_BACKOFF_BASE_MS: '1000',
      CONVERSATION_LLM_RATE_LIMIT_MAX_RETRY_DELAY_MS: '25',
      CONVERSATION_LLM_RETRY_JITTER_MS: '0'
    }, async () => {
      assert.equal(retryDelayMs(1, { status: 429 }), 25);
      let calls = 0;
      global.fetch = async (url, options) => {
        calls += 1;
        const body = JSON.parse(options.body);
        if (calls === 1) {
          return {
            ok: false,
            status: 429,
            text: async () => 'too many requests'
          };
        }
        if (!body.response_format) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'gpt-5.1',
              choices: [{ message: { content: 'I captured the supplier review context. Which geography applies?' } }]
            })
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'case_context',
                  requestType: 'supplier_risk',
                  workflowType: 'supplier_risk_review',
                  recommendedFirstAction: 'ask_geography',
                  conversationStage: 'asking_clarification',
                  assistantSummary: 'This is a supplier review.',
                  confidence: 0.81,
                  nextBestQuestion: 'Which geography applies?',
                  caseUpdate: { riskSignals: ['supplier risk'] }
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'Assess a supplier review.'
      });

      assert.equal(result.llmAssessment.used, true);
      assert.equal(result.llmAssessment.attemptCount, 2);
      assert.equal(result.llmAssessment.attempts[0].status, 'rate_limited');
      assert.equal(result.llmAssessment.attempts[0].delayMs, 25);
      assert.equal(result.llmAssessment.attempts[0].retryAfterUsed, false);
      assert.equal(result.llmAssessment.attempts[0].fastFailTriggered, false);
      assert.equal(result.llmAssessment.attempts[1].delayMs, 0);
      assert.equal(calls, 3);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM retry policy honors short Retry-After values only', async () => {
  await withEnv({
    CONVERSATION_LLM_BACKOFF_BASE_MS: '1000',
    CONVERSATION_LLM_RATE_LIMIT_MAX_RETRY_DELAY_MS: '2000',
    CONVERSATION_LLM_RETRY_JITTER_MS: '0'
  }, async () => {
    assert.equal(retryDelayMs(1, { status: 429, retryAfter: '1' }), 1000);
    assert.equal(retryDelayMs(1, { status: 429, retryAfter: '3' }), 1000);
  });
});

test('conversation LLM fast fail stops long retry loops', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '5',
      CONVERSATION_LLM_FAST_FAIL_MS: '10',
      CONVERSATION_LLM_MAX_RETRY_DELAY_MS: '1500',
      CONVERSATION_LLM_RETRY_JITTER_MS: '0'
    }, async () => {
      let calls = 0;
      global.fetch = async () => {
        calls += 1;
        return {
          ok: false,
          status: 503,
          text: async () => 'temporarily unavailable'
        };
      };

      const result = await assessConversationWithLlm({
        message: 'Assess a supplier review.'
      });

      assert.equal(result.llmAssessment.used, false);
      assert.equal(result.llmAssessment.smartIntakeUnavailable, false);
      assert.equal(result.llmAssessment.smartIntakeDegraded, true);
      assert.equal(result.llmAssessment.compassFailureType, 'timeout_slow');
      assert.equal(result.llmAssessment.userMessage, SMART_INTAKE_DEGRADED_MESSAGE);
      assert.equal(result.llmAssessment.attemptCount, 1);
      assert.equal(result.llmAssessment.maxAttempts, 5);
      assert.equal(result.llmAssessment.attempts[0].fastFailTriggered, true);
      assert.equal(result.llmAssessment.attempts[0].delayMs, 0);
      assert.equal(result.llmAssessment.attempts[0].retryable, false);
      assert.equal(calls, 1);
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
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_RETRY_JITTER_MS: '0'
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

test('conversation LLM assessor requests JSON mode and handles OpenAI response output arrays', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '2'
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(url, 'https://gateway.example/api/chat/completions');
        if (!body.response_format) {
          assert.equal(body.temperature, 0.4);
          assert.equal(body.max_tokens, 900);
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'gpt-5.1',
              choices: [{ message: { content: 'I understand this as a managed integration partner review. Where is the supplier operating from?' } }]
            })
          };
        }
        assert.deepEqual(body.response_format, { type: 'json_object' });
        assert.equal(body.temperature, 0);
        assert.equal(body.max_tokens, 800);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            output: [{
              content: [{
                type: 'output_text',
                text: JSON.stringify({
                  intent: 'case_context',
                  requestType: 'vendor_onboarding',
                  workflowType: 'procurement_vendor_review',
                  reviewTarget: 'managed integration partner',
                  recommendedFirstAction: 'ask_geography',
                  conversationStage: 'asking_clarification',
                  assistantSummary: 'This is a managed integration partner review.',
                  confidence: 0.88,
                  nextBestQuestion: 'Where is the supplier operating from?',
                  caseUpdate: {
                    supplierName: 'managed integration partner',
                    integrations: ['Oracle ERP', 'Workday', 'ServiceNow', 'SharePoint', 'Snowflake'],
                    riskSignals: ['privileged access']
                  }
                })
              }]
            }]
          })
        };
      };

      const assessed = await assessConversationWithLlm({
        message: 'Assess a managed integration partner connecting Oracle ERP, Workday, ServiceNow, SharePoint, and Snowflake with privileged implementation access.'
      });

      assert.equal(assessed.llmAssessment.used, true);
      assert.equal(assessed.llmAssessment.requestType, 'vendor_onboarding');
      assert.equal(assessed.llmAssessment.workflowType, 'procurement_vendor_review');
      assert.equal(assessed.caseDraft.supplierName, 'managed integration partner');
      assert.ok(assessed.caseDraft.integrations.includes('Oracle ERP'));
      assert.ok(assessed.caseDraft.riskSignals.includes('privileged access'));
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor does not accept invented owner or geography updates', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '1'
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (!body.response_format) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'gpt-5.1',
              choices: [{ message: { content: 'I can assess the supplier risk. Who owns this review internally?' } }]
            })
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'case_context',
                  requestType: 'vendor_onboarding',
                  workflowType: 'supplier_risk_review',
                  recommendedFirstAction: 'ask_owner',
                  conversationStage: 'asking_clarification',
                  confidence: 0.92,
                  nextBestQuestion: 'Who owns this review internally?',
                  caseUpdate: {
                    supplierName: 'managed integration partner',
                    businessUnit: 'Group Technology Risk',
                    geography: 'UAE',
                    integrations: ['Oracle ERP'],
                    riskSignals: ['privileged access']
                  }
                })
              }
            }]
          })
        };
      };

      const assessed = await assessConversationWithLlm({
        message: 'Assess a managed integration partner connecting Oracle ERP with privileged access.'
      });

      assert.equal(assessed.llmAssessment.used, true);
      assert.equal(assessed.caseDraft.supplierName, 'managed integration partner');
      assert.equal(assessed.caseDraft.businessUnit, undefined);
      assert.equal(assessed.caseDraft.geography, undefined);
      assert.ok(assessed.caseDraft.integrations.includes('Oracle ERP'));
      assert.ok(assessed.caseDraft.riskSignals.includes('privileged access'));
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor sends full chat context for terse answer interpretation', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '2'
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (!body.response_format) {
          assert.equal(body.temperature, 0.4);
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'gpt-5.1',
              choices: [{ message: { content: 'I’ve recorded source evidence as pending for the managed integration partner review. Is there any access-control scope we should capture while evidence is pending?' } }]
            })
          };
        }
        const prompt = JSON.parse(body.messages[1].content);
        assert.equal(prompt.latestMessage, 'we do not know at this point');
        assert.equal(prompt.eventType, 'user_answer');
        assert.equal(prompt.activeQuestion, 'What source evidence should I treat as proof for this decision?');
        assert.equal(prompt.currentDraft.activeQuestion, 'What source evidence should I treat as proof for this decision?');
        assert.equal(prompt.conversationHistory, undefined);
        assert.equal(prompt.currentDraft.conversationHistory, undefined);
        assert.equal(prompt.recentConversationTurnCount, 3);
        assert.equal(body.temperature, 0);
        assert.equal(body.messages.at(-3).role, 'user');
        assert.match(body.messages.at(-3).content, /managed integration partner/i);
        assert.equal(body.messages.at(-2).role, 'assistant');
        assert.match(body.messages.at(-2).content, /source evidence/i);
        assert.deepEqual(body.messages.at(-1), {
          role: 'user',
          content: 'we do not know at this point'
        });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'evidence_answer',
                  requestType: 'supplier_risk',
                  workflowType: 'supplier_risk_review',
                  recommendedFirstAction: 'ask_scope',
                  conversationStage: 'asking_clarification',
                  assistantSummary: 'Evidence is pending and should be tracked as a gap.',
                  confidence: 0.88,
                  nextBestQuestion: 'Is there any access-control scope we should capture while evidence is pending?',
                  caseUpdate: {
                    knownGaps: ['source evidence pending']
                  }
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'we do not know at this point',
        eventType: 'user_answer',
        activeQuestion: 'What source evidence should I treat as proof for this decision?',
        caseDraft: {
          brief: 'Assess a managed integration partner with privileged access.'
        },
        history: [
          { role: 'user', text: 'Assess a managed integration partner.' },
          { role: 'assistant', text: 'What source evidence should I treat as proof for this decision?' },
          { role: 'user', text: 'we do not know at this point' }
        ]
      });

      assert.equal(result.llmAssessment.used, true);
      assert.ok(result.caseDraft.knownGaps.includes('evidence'));
      assert.ok(result.caseDraft.recentlyAnsweredFields.evidence > 0);
      assert.equal(result.caseDraft.conversationHistory.length, 3);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor sends the configured recent chat turns with latest user message last', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      const history = [
        { role: 'user', text: 'old turn 1' },
        { role: 'assistant', text: 'old answer 1' },
        { role: 'user', text: 'old turn 2' },
        { role: 'assistant', text: 'old answer 2' },
        { role: 'user', text: 'I have a managed integration partner to review.' },
        { role: 'assistant', text: 'Which geography applies?' },
        { role: 'user', text: 'UAE' },
        { role: 'assistant', text: 'Who owns this review?' },
        { role: 'user', text: 'Platform team' },
        { role: 'assistant', text: 'What source evidence should I use?' },
        { role: 'user', text: 'DPA is uploaded' }
      ];
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        const prompt = JSON.parse(body.messages[1].content);
        const chatMessages = body.messages.slice(2);
        assert.equal(prompt.recentConversationTurnCount, 11);
        assert.equal(chatMessages.length, 11);
        assert.deepEqual(chatMessages.map((item) => item.role), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user']);
        assert.match(chatMessages[0].content, /old turn 1/i);
        assert.match(chatMessages[9].content, /source evidence/i);
        assert.deepEqual(chatMessages.at(-1), { role: 'user', content: 'DPA is uploaded' });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'evidence_answer',
                  requestType: 'vendor_onboarding',
                  workflowType: 'procurement_vendor_review',
                  recommendedFirstAction: 'run_council',
                  conversationStage: 'ready_for_council',
                  assistantSummary: 'The uploaded DPA can be used as evidence.',
                  naturalResponse: 'I’ll use the uploaded DPA as source evidence for the managed integration partner review.',
                  confidence: 0.88,
                  caseUpdate: {
                    evidenceSignals: ['DPA is uploaded']
                  }
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'DPA is uploaded',
        eventType: 'user_answer',
        activeQuestion: 'What source evidence should I use?',
        history
      });

      assert.equal(result.llmAssessment.used, true);
      assert.ok(result.caseDraft.evidenceSignals.includes('DPA is uploaded'));
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('30-turn conversation keeps early owner and geography facts via memory summary', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      const history = [
        { role: 'assistant', text: 'Who is the accountable business owner?' },
        { role: 'user', text: 'Platform team' },
        { role: 'assistant', text: 'Which geography applies?' },
        { role: 'user', text: 'UAE' }
      ];
      for (let index = 1; index <= 25; index += 1) {
        history.push({
          role: index % 2 ? 'assistant' : 'user',
          text: index % 2 ? `Follow-up ${index}: please confirm another implementation detail.` : `Implementation detail ${index} is still being checked.`
        });
      }
      history.push({ role: 'user', text: 'The SOC 2 is uploaded.' });

      assert.equal(history.length, 30);
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        const prompt = JSON.parse(body.messages[1].content);
        const chatMessages = body.messages.slice(2);

        assert.equal(prompt.recentConversationTurnCount, 12);
        assert.match(prompt.memorySummary, /Platform team/i);
        assert.match(prompt.memorySummary, /UAE/i);
        assert.match(prompt.currentDraft.memorySummary, /Platform team/i);
        assert.ok(!chatMessages.some((message) => /Platform team|Which geography applies|UAE/.test(message.content)));
        assert.equal(chatMessages.length, 12);
        assert.deepEqual(chatMessages.at(-1), { role: 'user', content: 'The SOC 2 is uploaded.' });

        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'evidence_answer',
                  requestType: 'vendor_onboarding',
                  workflowType: 'procurement_vendor_review',
                  recommendedFirstAction: 'run_council',
                  conversationStage: 'ready_for_council',
                  assistantSummary: 'SOC 2 evidence is uploaded.',
                  naturalResponse: 'I have the earlier platform owner and UAE geography in memory, and I will use the uploaded SOC 2 evidence.',
                  confidence: 0.9,
                  caseUpdate: {
                    evidenceSignals: ['SOC 2 uploaded']
                  }
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'The SOC 2 is uploaded.',
        eventType: 'user_answer',
        history
      });

      assert.equal(result.llmAssessment.used, true);
      assert.match(result.caseDraft.memorySummary, /Platform team/i);
      assert.match(result.caseDraft.memorySummary, /UAE/i);
      assert.equal(result.caseDraft.conversationHistory.length, 20);
      assert.ok(!result.caseDraft.conversationHistory.some((turn) => /Platform team|Which geography applies/.test(turn.text)));
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('terse answer after long history still resolves the active question', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      const history = [];
      for (let index = 1; index <= 28; index += 1) {
        history.push({
          role: index % 2 ? 'user' : 'assistant',
          text: index % 2 ? `Earlier case note ${index}` : `Earlier assistant follow-up ${index}?`
        });
      }
      history.push({ role: 'assistant', text: 'Who is the accountable business owner?' });
      history.push({ role: 'user', text: 'Platform team' });

      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        const prompt = JSON.parse(body.messages[1].content);
        assert.equal(prompt.latestMessage, 'Platform team');
        assert.equal(prompt.activeQuestion, 'Who is the accountable business owner?');
        assert.match(prompt.memorySummary, /Accountable owner: Platform team/i);
        assert.deepEqual(body.messages.at(-1), { role: 'user', content: 'Platform team' });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'owner_answer',
                  requestType: 'vendor_onboarding',
                  workflowType: 'procurement_vendor_review',
                  recommendedFirstAction: 'ask_geography',
                  conversationStage: 'asking_clarification',
                  assistantSummary: 'The platform team owns this review.',
                  naturalResponse: 'The platform team is now recorded as accountable owner. Which geography applies?',
                  confidence: 0.91,
                  caseUpdate: {
                    businessUnit: 'Platform team'
                  }
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'Platform team',
        eventType: 'user_answer',
        activeQuestion: 'Who is the accountable business owner?',
        history
      });

      assert.equal(result.llmAssessment.intent, 'owner_answer');
      assert.equal(result.caseDraft.businessUnit, 'Platform team');
      assert.match(result.caseDraft.memorySummary, /Platform team/i);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM prompt context does not include unbounded raw document text', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      const rawText = `${'raw document clause '.repeat(500)}RAW_DOCUMENT_SHOULD_NOT_APPEAR`;
      const longSummary = `${'Agreement summary sentence. '.repeat(100)}SUMMARY_TAIL_SHOULD_BE_CLIPPED`;
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        const promptText = body.messages[1].content;
        const prompt = JSON.parse(promptText);
        assert.ok(!promptText.includes('RAW_DOCUMENT_SHOULD_NOT_APPEAR'));
        assert.ok(!promptText.includes('SUMMARY_TAIL_SHOULD_BE_CLIPPED'));
        assert.ok(prompt.currentDraft.documents[0].summary.length <= 900);
        assert.equal(prompt.currentDraft.documents[0].title, 'Long Agreement');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'case_context',
                  requestType: 'agreement_review',
                  workflowType: 'contract_risk_review',
                  recommendedFirstAction: 'ask_scope',
                  conversationStage: 'document_uploaded',
                  assistantSummary: 'The uploaded agreement metadata is available for intake.',
                  naturalResponse: 'I can use the uploaded agreement metadata without moving raw document text through chat.',
                  confidence: 0.88,
                  caseUpdate: {
                    documentTypes: ['agreement'],
                    riskSignals: ['contractual risk']
                  }
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'Please review the uploaded agreement.',
        eventType: 'evidence_uploaded',
        caseDraft: {
          documents: [{
            title: 'Long Agreement',
            documentType: 'agreement',
            extractionStatus: 'backend_parsed',
            summary: longSummary,
            text: rawText,
            excerpt: rawText
          }]
        }
      });

      assert.equal(result.llmAssessment.used, true);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('rolling conversation summary is deterministic and bounded', () => {
  const summary = buildRollingConversationSummary([
    { role: 'assistant', text: 'Who is the accountable business owner?' },
    { role: 'user', text: 'Platform team' },
    { role: 'assistant', text: 'Which geography applies?' },
    { role: 'user', text: 'UAE' },
    { role: 'assistant', text: 'What source evidence should I use?' },
    { role: 'user', text: 'The DPA is uploaded and SOC 2 is pending for Azure AD and Workday integration with personal data.' }
  ], '');

  assert.match(summary, /Accountable owner: Platform team/i);
  assert.match(summary, /Geography: UAE/i);
  assert.match(summary, /Documents: DPA; SOC 2/i);
  assert.match(summary, /Integrations: Azure AD; Workday/i);
  assert.match(summary, /Known unknowns: evidence unknown or pending/i);
  assert.ok(summary.length <= 2500);
});

test('rolling conversation summary keeps foundational facts alongside recent facts', () => {
  const summary = buildRollingConversationSummary([
    { role: 'assistant', text: 'Who is the accountable owner?' },
    { role: 'user', text: 'The accountable owner is Group Technology Risk.' },
    { role: 'assistant', text: 'Who is the accountable owner?' },
    { role: 'user', text: 'The accountable owner is Procurement Operations.' },
    { role: 'assistant', text: 'Who is the accountable owner?' },
    { role: 'user', text: 'The accountable owner is Regional Finance.' },
    { role: 'assistant', text: 'Who is the accountable owner?' },
    { role: 'user', text: 'The accountable owner is Temporary Intake Desk.' }
  ]);

  assert.match(summary, /Accountable owner: Group Technology Risk/i);
  assert.match(summary, /Temporary Intake Desk/i);
});

test('conversation LLM assessor degrades gracefully on malformed Compass output', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '2'
    }, async () => {
      let calls = 0;
      global.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => {
          calls += 1;
          return JSON.stringify({
            model: 'gpt-5.1',
            choices: [{ message: { content: 'Not JSON.' } }]
          });
        }
      });

      const result = await assessConversationWithLlm({
        message: 'Assess a managed integration partner'
      });

      assert.equal(calls, 2);
      assert.equal(result.llmAssessment.used, false);
      assert.equal(result.llmAssessment.userMessage, '');
      assert.equal(result.llmAssessment.reason, SMART_INTAKE_MALFORMED_DIAGNOSTIC_MESSAGE);
      assert.equal(result.llmAssessment.invalidCompassResponse, true);
      assert.equal(result.llmAssessment.requiresCompass, false);
      assert.equal(result.llmAssessment.smartIntakeUnavailable, false);
      assert.equal(result.llmAssessment.smartIntakeDegraded, false);
      assert.equal(result.llmAssessment.compassFailureType, 'invalid_json');
      assert.match(result.llmAssessment.detail, /not valid JSON/i);
      assert.equal(result.llmAssessment.attemptCount, 2);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor salvages substantive Compass prose with deterministic structured fields', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1',
      CONVERSATION_LLM_MAX_ATTEMPTS: '2'
    }, async () => {
      let calls = 0;
      global.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => {
          calls += 1;
          return JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: 'This import of restricted AI accelerator hardware into the UAE and Singapore raises export-control, end-use, and firmware-support risks. The missing final end-use certificate should be treated as a reviewer gap before shipment.'
              }
            }]
          });
        }
      });

      const result = await assessConversationWithLlm({
        message: 'Review an AI accelerator import for UAE and Singapore. The supplier will ship restricted hardware, provide firmware support, and has no final end-use certificate.'
      });

      assert.equal(calls, 2);
      assert.equal(result.llmAssessment.used, true);
      assert.equal(result.llmAssessment.structuredFallbackUsed, true);
      assert.equal(result.llmAssessment.invalidCompassResponse, false);
      assert.equal(result.llmAssessment.compassFailureType, 'structured_json_salvaged_from_prose');
      assert.equal(result.llmAssessment.requestType, 'export_control');
      assert.equal(result.llmAssessment.workflowType, 'export_control_review');
      assert.match(result.llmAssessment.naturalResponse, /restricted AI accelerator hardware/i);
      assert.match(result.llmAssessment.naturalResponse, /Next question:/i);
      assert.equal(result.caseDraft.geography, 'UAE and Singapore');
      assert.ok(result.caseDraft.riskSignals.includes('export control'));
      assert.ok(result.caseDraft.llmIntake.used);
      assert.equal(result.caseDraft.llmIntake.structuredFallbackUsed, true);
      assert.equal(result.caseDraft.llmIntake.compassFailureType, undefined);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor retries malformed Compass output with compact JSON prompt then populates prose', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      const requests = [];
      global.fetch = async (url, options) => {
        requests.push(JSON.parse(options.body));
        if (requests.length === 1) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'gpt-5.1',
              choices: [{ message: { content: 'Sure, I can assess that, but this response is prose.' } }]
            })
          };
        }
        if (!requests.at(-1).response_format) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'gpt-5.1',
              choices: [{
                message: {
                  content: 'I understand this as a managed integration partner review with privileged access. Should I focus on access controls, privacy, contractual safeguards, or all of these?'
                }
              }]
            })
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'case_context',
                  requestType: 'supplier_risk',
                  workflowType: 'supplier_risk_review',
                  reviewTarget: 'managed integration partner',
                  recommendedFirstAction: 'ask_scope',
                  conversationStage: 'asking_clarification',
                  assistantSummary: 'This is a managed integration partner review.',
                  confidence: 0.84,
                  nextBestQuestion: 'Should I focus on access controls, privacy, contractual safeguards, or all of these?',
                  caseUpdate: {
                    supplierName: 'managed integration partner',
                    integrations: ['Oracle ERP', 'Workday'],
                    riskSignals: ['privileged access']
                  }
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'Assess a managed integration partner with privileged access.'
      });

      assert.equal(requests.length, 3);
      assert.deepEqual(requests[0].response_format, { type: 'json_object' });
      assert.deepEqual(requests[1].response_format, { type: 'json_object' });
      assert.match(requests[1].messages[0].content, /one valid minified JSON object only/i);
      assert.equal(requests[1].max_tokens, 800);
      assert.equal(requests[2].response_format, undefined);
      assert.equal(requests[2].temperature, 0.4);
      assert.equal(requests[2].max_tokens, 900);
      assert.equal(result.llmAssessment.used, true);
      assert.equal(result.llmAssessment.retriedAfterInvalidJson, true);
      assert.equal(result.llmAssessment.attempts[0].status, 'invalid_json');
      assert.equal(result.llmAssessment.attempts[0].delayMs, 0);
      assert.equal(result.llmAssessment.attempts[0].fastFailTriggered, false);
      assert.equal(result.llmAssessment.attempts[0].retryAfterUsed, false);
      assert.match(result.llmAssessment.naturalResponse, /managed integration partner review/i);
      assert.equal(result.llmAssessment.requestType, 'supplier_risk');
      assert.ok(result.caseDraft.integrations.includes('Oracle ERP'));
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('extractChatContent handles common gateway response wrappers', () => {
  assert.deepEqual(extractChatContent({ intent: 'case_context', caseUpdate: {} }), { intent: 'case_context', caseUpdate: {} });
  assert.equal(extractChatContent({ result: { choices: [{ message: { content: '{"intent":"case_context"}' } }] } }), '{"intent":"case_context"}');
  assert.equal(extractChatContent({ message: { content: '{"intent":"question"}' } }), '{"intent":"question"}');
  assert.equal(extractChatContent({ output: [{ content: [{ text: '{"intent":"owner_answer"}' }] }] }), '{"intent":"owner_answer"}');
  assert.deepEqual(extractChatContent({ choices: [{ message: { parsed: { intent: 'case_context', caseUpdate: {} } } }] }), { intent: 'case_context', caseUpdate: {} });
  assert.equal(extractChatContent({ body: { response: { choices: [{ message: { content: '{"intent":"geography_answer"}' } }] } } }), '{"intent":"geography_answer"}');
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
        if (!body.response_format) {
          assert.equal(body.temperature, 0.4);
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'gpt-5.1',
              choices: [{ message: { content: 'HR is now the owner for the payroll outsourcing review. Which geography applies?' } }]
            })
          };
        }
        assert.equal(body.temperature, 0);
        assert.match(body.messages[1].content, /latestMessage/);
        assert.deepEqual(body.messages.at(-1), { role: 'user', content: 'HR' });
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

test('conversation result keeps AI-supplied owner when deterministic enrichment only infers a generic owner', () => {
  const result = processConversation({
    message: 'Assess a managed integration partner connecting Oracle ERP, Workday, ServiceNow, SharePoint, and Snowflake with privileged implementation access.',
    caseDraft: {
      brief: 'Assess a managed integration partner.',
      businessUnit: 'Platform Team',
      geography: 'UAE and India',
      llmIntake: {
        used: true,
        requestType: 'vendor_onboarding',
        workflowType: 'procurement_vendor_review',
        reviewTarget: 'managed integration partner'
      }
    },
    llmAssessment: {
      provider: 'compass_gateway',
      model: 'gpt-5.1',
      used: true,
      advisoryOnly: true,
      intent: 'case_context',
      requestType: 'vendor_onboarding',
      workflowType: 'procurement_vendor_review',
      reviewTarget: 'managed integration partner',
      recommendedFirstAction: 'ask_evidence',
      conversationStage: 'asking_clarification',
      assistantSummary: 'This remains a platform-owned integration partner review.',
      confidence: 0.9,
      attemptCount: 1,
      maxAttempts: 3
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.businessUnit, 'Platform Team');
  assert.equal(result.caseDraft.geography, 'UAE and India');
  assert.ok(result.caseDraft.integrations.includes('Payroll/HRIS'));
  assert.ok(result.caseDraft.integrations.includes('ServiceNow'));
  assert.ok(result.actions.find((action) => action.id === 'llm_intake_assessment').detail.includes('Compass attempts: 1/3'));
});

test('conversation result still accepts explicit terse owner correction over previous generic owner', () => {
  const result = processConversation({
    message: 'Platform team',
    caseDraft: {
      brief: 'Assess a managed integration partner.',
      businessUnit: 'Group Technology Risk',
      questions: ['Who is the accountable business unit or workflow owner?'],
      llmIntake: {
        used: true,
        requestType: 'vendor_onboarding',
        workflowType: 'procurement_vendor_review'
      }
    },
    llmAssessment: {
      provider: 'compass_gateway',
      model: 'gpt-5.1',
      used: true,
      advisoryOnly: true,
      intent: 'owner_answer',
      requestType: 'vendor_onboarding',
      workflowType: 'procurement_vendor_review',
      recommendedFirstAction: 'ask_geography',
      conversationStage: 'asking_clarification',
      assistantSummary: 'The platform team owns this review.',
      confidence: 0.9,
      attemptCount: 1,
      maxAttempts: 3
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.businessUnit, 'Platform Team');
  assert.ok(!result.questions.some((question) => /owner/i.test(question)));
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

test('conversation LLM assessor preserves naturalResponse for chat response generation', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          model: 'gpt-5.1',
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'case_context',
                requestType: 'agreement_review',
                workflowType: 'contract_risk_review',
                reviewTarget: 'Managed Platform Integration Services Agreement',
                recommendedFirstAction: 'ask_scope',
                conversationStage: 'document_uploaded',
                assistantSummary: 'The managed platform agreement is ready for focused review.',
                nextBestQuestion: 'Should I focus first on privacy, privileged access, commercial terms, or all material risks?',
                naturalResponse: 'I’ve reviewed the uploaded Managed Platform Integration Services Agreement at intake level and can see privacy, privileged-access, and service-continuity themes. Should I focus first on privacy, privileged access, commercial terms, or all material risks?',
                confidence: 0.88,
                caseUpdate: {
                  documentTypes: ['agreement'],
                  riskSignals: ['privileged access', 'personal data']
                }
              })
            }
          }]
        })
      });

      const result = await assessConversationWithLlm({
        message: 'I uploaded the agreement.',
        eventType: 'evidence_uploaded',
        caseDraft: {
          documents: [{
            title: 'Managed Platform Integration Services Agreement',
            documentType: 'agreement',
            extractionStatus: 'backend_parsed',
            summary: 'Agreement with data processing, implementation access, and continuity obligations.'
          }]
        }
      });

      assert.equal(result.llmAssessment.used, true);
      assert.match(result.llmAssessment.naturalResponse, /Managed Platform Integration Services Agreement/);
      assert.match(result.llmAssessment.naturalResponse, /Should I focus first/);
      assert.equal(result.caseDraft.llmIntake.naturalResponse, result.llmAssessment.naturalResponse);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation LLM assessor preserves complete long follow-up questions', () => {
  const nextBestQuestion = 'Within this SaaS master services agreement, what do you most need reviewed first: the service scope and deliverables, the data/privacy and model-training terms, or the security and access controls, including subprocessors and personnel onboarding/offboarding?';

  const assessment = normalizeAssessment({
    intent: 'case_context',
    requestType: 'saas_agreement_review',
    workflowType: 'contract_risk_review',
    reviewTarget: 'Enterprise SaaS Master Services Agreement',
    recommendedFirstAction: 'ask_scope',
    conversationStage: 'document_uploaded',
    assistantSummary: 'The uploaded agreement is ready for focused review.',
    nextBestQuestion,
    confidence: 0.88
  });

  assert.equal(nextBestQuestion.length > 220, true);
  assert.equal(assessment.nextBestQuestion, nextBestQuestion);
  assert.match(assessment.nextBestQuestion, /\?$/);
  assert.doesNotMatch(assessment.nextBestQuestion, /\b(?:a|and|or|including)\?$/i);
});

test('conversation LLM assessor allows complex natural prose beyond the old short clamp', async () => {
  const originalFetch = global.fetch;
  const longNaturalResponse = Array.from({ length: 12 }, (_, index) => (
    `I captured review point ${index + 1} for the managed integration partner: Oracle ERP, Workday, ServiceNow, SharePoint, and Snowflake require privileged-access review, data-transfer checks, implementation controls, evidence mapping, and accountable owner confirmation.`
  )).join(' ');
  const requests = [];
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        requests.push(body);
        if (!body.response_format) {
          assert.equal(body.max_tokens, 900);
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'gpt-5.1',
              choices: [{ message: { content: longNaturalResponse } }]
            })
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            model: 'gpt-5.1',
            choices: [{
              message: {
                content: JSON.stringify({
                  intent: 'case_context',
                  requestType: 'supplier_risk',
                  workflowType: 'saas_vendor_review',
                  reviewTarget: 'managed integration partner',
                  recommendedFirstAction: 'ask_owner',
                  conversationStage: 'building_context',
                  assistantSummary: 'This is a managed integration partner review.',
                  nextBestQuestion: 'Who is the accountable owner?',
                  confidence: 0.86,
                  caseUpdate: {
                    integrations: ['Oracle ERP', 'Workday', 'ServiceNow', 'SharePoint', 'Snowflake'],
                    riskSignals: ['privileged access']
                  }
                })
              }
            }]
          })
        };
      };

      const result = await assessConversationWithLlm({
        message: 'Assess a managed integration partner connecting Oracle ERP, Workday, ServiceNow, SharePoint, and Snowflake with privileged implementation access.'
      });

      assert.equal(requests.length, 2);
      assert.equal(result.llmAssessment.prose.status, 'success');
      assert.ok(result.llmAssessment.naturalResponse.length > 1200);
      assert.equal(result.llmAssessment.naturalResponse, longNaturalResponse);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('conversation renderer returns Compass naturalResponse directly end-to-end', async () => {
  const originalFetch = global.fetch;
  const naturalResponse = 'I reviewed the Managed Platform Integration Services Agreement context and will focus the review on data protection, privileged access, and continuity. Which of those should I prioritize first?';
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: featureConfigPath(),
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      CONVERSATION_LLM_MODEL: 'gpt-5.1'
    }, async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          model: 'gpt-5.1',
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'case_context',
                requestType: 'agreement_review',
                workflowType: 'contract_risk_review',
                documentTypes: ['agreement'],
                reviewTarget: 'Managed Platform Integration Services Agreement',
                reviewScope: 'data protection, privileged access, and continuity',
                recommendedFirstAction: 'ask_scope',
                conversationStage: 'document_uploaded',
                assistantSummary: 'The managed platform agreement needs a focused review.',
                nextBestQuestion: 'Which review area should I prioritize first?',
                naturalResponse,
                confidence: 0.92,
                caseUpdate: {
                  documentTypes: ['agreement'],
                  evidenceSignals: ['uploaded agreement'],
                  riskSignals: ['privileged access', 'personal data', 'business continuity']
                }
              })
            }
          }]
        })
      });

      const assessed = await assessConversationWithLlm({
        message: 'I uploaded the managed platform agreement.',
        eventType: 'evidence_uploaded',
        caseDraft: {
          documents: [{
            title: 'Managed Platform Integration Services Agreement',
            documentType: 'agreement',
            extractionStatus: 'backend_parsed',
            summary: 'Agreement with data processing, implementation access, and continuity obligations.'
          }]
        }
      });

      const rendered = processConversation({
        message: 'I uploaded the managed platform agreement.',
        eventType: 'evidence_uploaded',
        caseDraft: assessed.caseDraft,
        llmAssessment: assessed.llmAssessment
      }, { runtime: 'deterministic' });

      assert.equal(assessed.llmAssessment.naturalResponse, naturalResponse);
      assert.equal(rendered.reply, naturalResponse);
      assert.ok(!/^Got it|^Next question|I captured/i.test(rendered.reply));
      assert.equal(rendered.nlp.llmAssessment.naturalResponse, naturalResponse);
    });
  } finally {
    global.fetch = originalFetch;
  }
});
