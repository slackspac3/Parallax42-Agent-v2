'use strict';

const { performance } = require('node:perf_hooks');
const { runComplianceAgent } = require('./complianceAgent');

const CASES = [
  {
    id: 'bench-ai-privacy-critical',
    expected: 'not_ready',
    input: {
      businessUnit: 'Group Technology Risk',
      geography: 'UAE',
      brief: 'Critical AI SaaS supplier processes personal data and integrates with Azure AD.',
      documents: [{ summary: 'SOC 2 summary only. No DPA or model-training exclusion.' }]
    }
  },
  {
    id: 'bench-licensed-microsoft',
    expected: 'conditionally_ready',
    input: {
      businessUnit: 'IT',
      geography: 'UAE',
      brief: 'Deploy Microsoft Power Platform automation for finance project reporting with tenant-wide connectors.',
      documents: [{ summary: 'License entitlement review is available. Admin privilege review is pending.' }]
    }
  },
  {
    id: 'bench-hse-bcm',
    expected: 'conditionally_ready',
    input: {
      businessUnit: 'Operations',
      geography: 'KSA',
      brief: 'Onboard a facilities supplier with HSE and business continuity obligations for critical sites.',
      documents: [{ summary: 'HSE attestation provided. Continuity mapping is incomplete.' }]
    }
  },
  {
    id: 'bench-low-risk-consulting',
    expected: 'ready',
    input: {
      businessUnit: 'Procurement',
      geography: 'UAE',
      brief: 'Renew a consulting supplier. The service is low criticality. The service does not process personal data. The service does not integrate with company systems.',
      documents: [{ summary: 'Signed contract and approval authority are documented. The supplier attests that the service does not process personal data. Security assurance review is complete.' }]
    }
  }
];

function runBenchmark() {
  const startedAt = performance.now();
  const results = CASES.map((item) => {
    const caseStartedAt = performance.now();
    const output = runComplianceAgent(item.input, { mode: 'benchmark' });
    const durationMs = Number((performance.now() - caseStartedAt).toFixed(2));
    const passed = output.ok && output.decision.status === item.expected;
    return {
      id: item.id,
      expected: item.expected,
      actual: output.ok ? output.decision.status : 'blocked',
      passed,
      durationMs,
      evidenceCount: output.evidenceIds ? output.evidenceIds.length : 0,
      gapCount: output.gaps ? output.gaps.length : 0
    };
  });
  const passed = results.filter((result) => result.passed).length;
  const totalDurationMs = Number((performance.now() - startedAt).toFixed(2));
  const sortedDurations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const p95 = sortedDurations[Math.max(0, Math.ceil(sortedDurations.length * 0.95) - 1)] || 0;
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      cases: results.length,
      passed,
      failed: results.length - passed,
      passRate: Number((passed / Math.max(1, results.length)).toFixed(3)),
      totalDurationMs,
      p95DurationMs: p95
    },
    results
  };
}

module.exports = {
  CASES,
  runBenchmark
};
