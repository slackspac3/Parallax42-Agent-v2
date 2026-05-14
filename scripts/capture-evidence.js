'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runBenchmark } = require('../lib/benchmarkSuite');
const { getReadinessInventory, runComplianceAgent } = require('../lib/complianceAgent');
const sampleCase = require('../examples/high_risk_ai_saas_case.json');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'evidence');
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

async function main() {
  const generatedAt = new Date().toISOString();
  const [backendHealth, gatewayHealth] = await Promise.all([
    fetchJson(`${DEFAULT_BACKEND_URL.replace(/\/+$/, '')}/health`),
    fetchJson(DEFAULT_GATEWAY_URL)
  ]);

  const benchmark = runBenchmark();
  const readiness = getReadinessInventory();
  const sampleRun = runComplianceAgent(sampleCase, { mode: 'evidence_capture' });
  const index = {
    generatedAt,
    artifacts: [
      'live-health.json',
      'benchmark-report.json',
      'readiness.json',
      'sample-agent-run.json'
    ],
    summary: {
      backendHealthOk: backendHealth.ok,
      gatewayHealthOk: gatewayHealth.ok,
      benchmarkPassRate: benchmark.summary.passRate,
      sampleDecision: sampleRun.decision?.status || 'blocked'
    }
  };

  writeJson('live-health.json', { generatedAt, backendHealth, gatewayHealth });
  writeJson('benchmark-report.json', benchmark);
  writeJson('readiness.json', readiness);
  writeJson('sample-agent-run.json', sampleRun);
  writeJson('index.json', index);
  process.stdout.write(`Evidence captured in ${path.relative(ROOT, EVIDENCE_DIR)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
