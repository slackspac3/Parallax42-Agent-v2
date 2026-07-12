'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runAgentWithRuntime } = require('../lib/agentRuntime');
const { runBenchmark } = require('../lib/benchmarkSuite');
const { getReadinessInventory } = require('../lib/complianceAgent');
const { buildGoldenWorkflowRun } = require('../lib/goldenWorkflow');
const sampleCase = require('../examples/high_risk_ai_saas_case.json');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'evidence');
const OUTPUT_EXAMPLES_DIR = path.join(ROOT, 'output_examples');
const DEFAULT_BACKEND_URL = process.env.PARALLAX42_BACKEND_URL || 'https://api.parallax42.bhavukarora.com';
const DEFAULT_GATEWAY_URL = process.env.P42_GATEWAY_HEALTH_URL || 'https://parallax42-compass-gateway.vercel.app/api/health';

async function fetchJson(url) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      url,
      body: text ? JSON.parse(text) : null
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - startedAt,
      url,
      error: error instanceof Error ? error.message : String(error || 'Unknown error')
    };
  }
}

function writeJson(name, payload) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, name), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeOutputExample(name, payload) {
  fs.mkdirSync(OUTPUT_EXAMPLES_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_EXAMPLES_DIR, name), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [backendHealth, gatewayHealth] = await Promise.all([
    fetchJson(`${DEFAULT_BACKEND_URL.replace(/\/+$/, '')}/health`),
    fetchJson(DEFAULT_GATEWAY_URL)
  ]);

  const benchmark = runBenchmark();
  const readiness = getReadinessInventory();
  const deterministicRun = runAgentWithRuntime(sampleCase, { mode: 'parity_deterministic', runtime: 'deterministic' });
  const sampleRun = runAgentWithRuntime(sampleCase, { mode: 'evidence_capture', runtime: 'crewai_flow' });
  const goldenDemo = buildGoldenWorkflowRun({ mode: 'evidence_capture_golden_demo', runtime: 'crewai_flow' });
  const index = {
    generatedAt,
    artifacts: [
      'live-health.json',
      'benchmark-report.json',
      'readiness.json',
      'sample-agent-run.json',
      'golden-demo-run.json'
    ],
    summary: {
      backendHealthOk: backendHealth.ok,
      gatewayHealthOk: gatewayHealth.ok,
      benchmarkPassRate: benchmark.summary.passRate,
      sampleDecision: sampleRun.decision?.status || 'blocked',
      goldenDemoAcceptance: goldenDemo.evidenceChecklist.acceptanceStatus
    }
  };

  writeJson('live-health.json', { generatedAt, backendHealth, gatewayHealth });
  writeJson('benchmark-report.json', benchmark);
  writeJson('readiness.json', readiness);
  writeJson('sample-agent-run.json', sampleRun);
  writeJson('golden-demo-run.json', goldenDemo);
  writeJson('index.json', index);
  writeOutputExample('readiness_report.json', {
    artifact: 'readiness_report',
    sample: false,
    source: 'evidence/readiness.json',
    generatedAt: readiness.generatedAt,
    submissionReadiness: readiness.submissionReadiness,
    linkedSystems: readiness.linkedSystems,
    securityControls: readiness.securityControls,
    domainCount: Array.isArray(readiness.domains) ? readiness.domains.length : 0,
    caveat: 'This is a curated subset of the readiness inventory for judge review.'
  });
  writeOutputExample('eval_report.json', {
    artifact: 'eval_report',
    sample: false,
    source: 'evidence/benchmark-report.json',
    generatedAt: benchmark.generatedAt,
    scope: 'local deterministic benchmark suite',
    summary: benchmark.summary,
    results: benchmark.results,
    caveat: 'This artifact reflects the current benchmark evidence snapshot only; it does not claim live infrastructure health.'
  });
  writeOutputExample('golden_demo_run.json', {
    artifact: 'golden_demo_run',
    sample: false,
    source: 'evidence/golden-demo-run.json',
    generatedAt: goldenDemo.generatedAt,
    workflow: goldenDemo.workflow,
    input: goldenDemo.input,
    decision: goldenDemo.run.decision,
    evidenceChecklist: goldenDemo.evidenceChecklist,
    metrics: {
      domainCount: goldenDemo.run.domains.length,
      gapCount: goldenDemo.run.gaps.length,
      evidenceIdCount: goldenDemo.run.evidenceIds.length,
      policyReferenceIdCount: goldenDemo.run.policyReferenceIds.length,
      citationCount: goldenDemo.run.citations.length,
      traceEventCount: goldenDemo.run.trace.length
    },
    runtime: goldenDemo.run.runtime
  });
  writeOutputExample('crewai_parity_report.json', {
    artifact: 'crewai_parity_report',
    sample: false,
    source: 'generated from lib/agentRuntime.js using examples/high_risk_ai_saas_case.json',
    generatedAt,
    comparison: {
      deterministicStatus: deterministicRun.decision.status,
      crewaiFlowStatus: sampleRun.decision.status,
      decisionStatusMatches: deterministicRun.decision.status === sampleRun.decision.status,
      deterministicReadinessScore: deterministicRun.decision.readinessScore,
      crewaiFlowReadinessScore: sampleRun.decision.readinessScore,
      gapCountMatches: deterministicRun.gaps.length === sampleRun.gaps.length,
      evidenceIdCountMatches: deterministicRun.evidenceIds.length === sampleRun.evidenceIds.length,
      policyReferenceIdCountMatches: deterministicRun.policyReferenceIds.length === sampleRun.policyReferenceIds.length
    },
    deterministic: {
      mode: deterministicRun.mode,
      runtime: deterministicRun.runtime?.actualRuntime || 'deterministic',
      decision: deterministicRun.decision,
      gapCount: deterministicRun.gaps.length,
      evidenceIdCount: deterministicRun.evidenceIds.length,
      policyReferenceIdCount: deterministicRun.policyReferenceIds.length
    },
    crewaiFlow: {
      mode: sampleRun.mode,
      runtime: sampleRun.runtime?.actualRuntime || sampleRun.mode,
      manifestSource: sampleRun.runtime?.manifestSource || '',
      degraded: Boolean(sampleRun.runtime?.degraded),
      decision: sampleRun.decision,
      gapCount: sampleRun.gaps.length,
      evidenceIdCount: sampleRun.evidenceIds.length,
      policyReferenceIdCount: sampleRun.policyReferenceIds.length
    },
    boundary: 'CrewAI is advisory and orchestration-shaped; deterministic Node policy fields remain authoritative.'
  });
  process.stdout.write(`Evidence captured in ${path.relative(ROOT, EVIDENCE_DIR)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
