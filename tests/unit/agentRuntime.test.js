'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runAgentWithRuntime, runAgentWithRuntimeAsync, runtimeHealth } = require('../../lib/agentRuntime');

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

test('CrewAI Flow runtime preserves compliance agent response contract', () => {
  const result = runAgentWithRuntime({
    businessUnit: 'Group Technology Risk',
    geography: 'UAE',
    supplierName: 'Example AI SaaS',
    brief: 'Procure a critical AI SaaS supplier that processes personal data and integrates with Azure AD.',
    documents: [{ summary: 'SOC 2 available. No DPA or model-training exclusion attached.' }]
  }, { runtime: 'crewai_flow' });

  assert.equal(result.ok, true);
  assert.equal(result.runtime.actualRuntime, 'crewai_flow_dry_run');
  assert.equal(result.orchestration.framework, 'CrewAI Flow');
  assert.equal(result.orchestration.primaryRuntime, true);
  assert.ok(result.orchestration.flow.stages.length >= 6);
  assert.equal(result.trace[0].agent, 'runtime_router');
  assert.equal(result.trace[0].eventType, 'runtime_selected');
});

test('deterministic runtime remains available as explicit fallback mode', () => {
  const result = runAgentWithRuntime({
    businessUnit: 'Procurement',
    geography: 'UAE',
    brief: 'Renew a low criticality consulting supplier with no personal data.',
    documents: [{ summary: 'Signed contract and no personal data statement.' }]
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.runtime.actualRuntime, 'deterministic');
  assert.equal(result.orchestration.primaryRuntime, false);
});

test('runtime health exposes CrewAI Flow and deterministic fallback readiness', () => {
  const health = runtimeHealth();
  assert.equal(health.defaultRuntime, 'crewai_llm');
  assert.equal(health.crewaiFlowDryRunAvailable, true);
  assert.equal(health.deterministicFallbackAvailable, true);
  assert.equal(health.liveCrewAIEnabled, true);
  assert.equal(health.liveAdvisorySpecialistsEnabled, true);
});

test('live CrewAI LLM runtime is requested by default and degrades safely without optional dependencies', () => {
  const result = runAgentWithRuntime({
    businessUnit: 'Group Technology Risk',
    geography: 'UAE',
    brief: 'Review a critical AI supplier that processes personal data.',
    documents: [{ summary: 'SOC 2 only. No DPA.' }]
  }, { runtime: 'crewai_llm' });

  assert.equal(result.ok, true);
  assert.equal(result.runtime.requestedRuntime, 'crewai_llm');
  assert.equal(result.runtime.actualRuntime, 'crewai_flow_dry_run');
  assert.equal(result.runtime.degraded, true);
  assert.match(result.runtime.fallbackReason, /CREWAI_ENABLE_LIVE_LLM|CrewAI|provider API key/i);
  assert.equal(result.orchestration.liveLlm.requested, true);
  assert.equal(result.orchestration.liveLlm.outputAvailable, false);
  assert.equal(result.decision.status, 'not_ready');
});

test('async runtime can attach Compass advisory output without changing deterministic decision', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      CREWAI_ENABLE_LIVE_LLM: '1',
      CREWAI_LLM_MODEL: 'gpt-5.1',
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token'
    }, async () => {
      global.fetch = async (url, options) => {
        assert.equal(url, 'https://gateway.example/api/chat/completions');
        assert.equal(options.headers.authorization, 'Bearer test-token');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Executive summary: evidence is usable. Reviewer should confirm final approval and keep missing controls open.'
                }
              }
            ]
          })
        };
      };

      const result = await runAgentWithRuntimeAsync({
        businessUnit: 'Trade Compliance',
        geography: 'UAE',
        brief: 'Review restricted accelerator import with firmware support.',
        documents: [{ summary: 'Export classification and end-use certificate attached.' }]
      }, { runtime: 'crewai_llm' });

      assert.equal(result.ok, true);
      assert.equal(result.orchestration.llmOutput.advisoryOnly, true);
      assert.equal(result.orchestration.liveLlm.adapter, 'js_compass_gateway_advisory');
      assert.equal(result.orchestration.deterministicDecisionEngine, true);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('remote CrewAI refuses unauthenticated service calls and degrades safely', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: `/tmp/p42-runtime-features-${process.pid}-${Date.now()}.json`,
      P42_FEATURE_LIVE_CREWAI: '1',
      P42_FEATURE_COMPASS_LLM_CALLS: '1',
      P42_CREWAI_SERVICE_URL: 'https://crewai.example',
      CREWAI_SERVICE_URL: '',
      P42_CREWAI_SERVICE_TOKEN: '',
      CREWAI_SERVICE_TOKEN: '',
      COMPASS_GATEWAY_TOKEN: '',
      PARALLAX42_GATEWAY_TOKEN: '',
      CREWAI_LLM_API_KEY: '',
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      AZURE_API_KEY: ''
    }, async () => {
      global.fetch = async () => {
        throw new Error('remote fetch must not run without a CrewAI service token');
      };

      const result = await runAgentWithRuntimeAsync({
        businessUnit: 'Procurement',
        geography: 'UAE',
        brief: 'Review a low-risk consulting supplier.',
        documents: [{ summary: 'Signed contract and security assurance are attached.' }]
      }, { runtime: 'crewai_llm' });

      assert.equal(result.ok, true);
      assert.equal(result.runtime.degraded, true);
      assert.match(result.runtime.fallbackReason, /service token is required/i);
      assert.equal(result.runtime.llm.outputAvailable, false);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('successful remote CrewAI output is the single live advisory path', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  try {
    await withEnv({
      P42_ADMIN_FEATURE_CONFIG_PATH: `/tmp/p42-runtime-features-${process.pid}-${Date.now()}-remote.json`,
      P42_FEATURE_LIVE_CREWAI: '1',
      P42_FEATURE_COMPASS_LLM_CALLS: '1',
      P42_FEATURE_LIVE_ADVISORY_SPECIALISTS: '1',
      P42_CREWAI_SERVICE_URL: 'https://crewai.example',
      P42_CREWAI_SERVICE_TOKEN: 'service-token',
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'gateway-token',
      CREWAI_ENABLE_LIVE_LLM: '1'
    }, async () => {
      global.fetch = async (url, options) => {
        calls.push(url);
        assert.equal(url, 'https://crewai.example/run');
        assert.equal(options.headers.authorization, 'Bearer service-token');
        assert.ok(options.signal instanceof AbortSignal);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            ok: true,
            result: {
              mode: 'crewai_llm_live',
              framework: 'CrewAI Flow',
              crewOutput: {
                advisoryOnly: true,
                summary: 'Remote CrewAI advisory completed.'
              }
            }
          })
        };
      };

      const result = await runAgentWithRuntimeAsync({
        businessUnit: 'Procurement',
        geography: 'UAE',
        brief: 'Review a low-risk consulting supplier.',
        documents: [{ summary: 'Signed contract and security assurance are attached.' }]
      }, { runtime: 'crewai_llm' });

      assert.equal(result.ok, true);
      assert.equal(result.runtime.degraded, false);
      assert.equal(result.runtime.llm.outputAvailable, true);
      assert.equal(result.orchestration.crewaiOutput.summary, 'Remote CrewAI advisory completed.');
      assert.equal(result.orchestration.llmOutput.summary, 'Remote CrewAI advisory completed.');
      assert.deepEqual(calls, ['https://crewai.example/run']);
    });
  } finally {
    global.fetch = originalFetch;
  }
});
