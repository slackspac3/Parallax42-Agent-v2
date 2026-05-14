'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runAgentWithRuntime, runtimeHealth } = require('../../lib/agentRuntime');

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
  assert.equal(health.defaultRuntime, 'crewai_flow');
  assert.equal(health.crewaiFlowDryRunAvailable, true);
  assert.equal(health.deterministicFallbackAvailable, true);
});

test('live CrewAI LLM runtime is wired but opt-in and degrades safely by default', () => {
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
