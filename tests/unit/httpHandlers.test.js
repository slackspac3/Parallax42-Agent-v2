'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { handleConversation } = require('../../lib/httpHandlers');
const { processConversation } = require('../../lib/conversationAgent');

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

function readyConversationBody() {
  return {
    forceRun: true,
    message: 'run it',
    caseDraft: {
      caseId: 'case-handler-single-run',
      supplierName: 'Example AI SaaS',
      businessUnit: 'Group Technology Risk',
      geography: 'UAE',
      brief: 'Procure a critical AI SaaS supplier that processes personal data, uses AI workflows, integrates with Azure AD, and supports finance reporting.',
      integrations: ['Azure AD', 'Finance reporting'],
      documents: [
        {
          evidenceId: 'CHAT-01',
          title: 'Conversational intake evidence',
          summary: 'SOC 2 available. Signed DPA, model-training exclusion, and continuity plan are attached.',
          signals: ['SOC 2', 'DPA', 'model training terms', 'BCP/DR']
        }
      ],
      evidenceSignals: ['SOC 2', 'DPA', 'model training terms', 'BCP/DR'],
      riskSignals: ['personal data', 'AI/model use', 'critical service', 'finance exposure']
    }
  };
}

function fakeRun(casePayload, options = {}) {
  return {
    ok: true,
    case: { caseId: casePayload.caseId },
    decision: {
      status: 'ready',
      recommendation: 'Ready for human approval',
      readinessScore: 0.91,
      rationale: 'Injected runtime result for handler execution counting.'
    },
    gaps: [],
    evidenceIds: ['CHAT-01'],
    trace: [],
    runtime: {
      requestedRuntime: options.runtime,
      actualRuntime: options.runtime || 'deterministic',
      manifestSource: 'none'
    }
  };
}

test('forced ready conversation handler executes the runtime once', async () => {
  await withEnv({ P42_AUTH_MODE: 'audit' }, async () => {
    let runtimeCalls = 0;
    let syncRuntimeCalls = 0;
    let asyncRuntimeCalls = 0;
    let asyncPayload = null;
    let asyncOptions = null;

    const response = await handleConversation({
      req: { headers: { 'x-agent-runtime': 'deterministic' } },
      body: readyConversationBody(),
      dependencies: {
        planConversationTurn: async (input) => input,
        appendAuditRecord: () => {},
        processConversation: (input, options = {}) => processConversation(input, {
          ...options,
          runAgentWithRuntime: (casePayload, runOptions) => {
            runtimeCalls += 1;
            syncRuntimeCalls += 1;
            return fakeRun(casePayload, runOptions);
          }
        }),
        runAgentWithRuntimeAsync: async (casePayload, runOptions) => {
          runtimeCalls += 1;
          asyncRuntimeCalls += 1;
          asyncPayload = casePayload;
          asyncOptions = runOptions;
          return fakeRun(casePayload, runOptions);
        }
      }
    });

    assert.equal(response.status, 200);
    assert.equal(runtimeCalls, 1);
    assert.equal(syncRuntimeCalls, 0);
    assert.equal(asyncRuntimeCalls, 1);
    assert.equal(asyncPayload.caseId, 'case-handler-single-run');
    assert.deepEqual(asyncOptions, { runtime: 'deterministic' });
    assert.equal(response.body.run.ok, true);
    assert.equal(response.body.shouldRun, true);
    assert.ok(response.body.actions.some((action) => action.id === 'agent_workflow' && action.status === 'complete'));
    assert.match(response.body.reply, /Decision: Ready for human approval/i);
  });
});
