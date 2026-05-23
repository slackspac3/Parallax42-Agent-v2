'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { loadLocalEnv } = require('../lib/localEnv');
const { gatewayConfig, parserRelayConfig, vectorConfig } = require('../lib/runtimeConfig');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output', 'playwright');
const DEFAULT_PORT = Number(process.env.P42_LIVE_CHECK_PORT || 3149);
const LOCAL_BASE_URL = String(process.env.P42_LIVE_CHECK_LOCAL_URL || `http://127.0.0.1:${DEFAULT_PORT}`).replace(/\/+$/, '');
const LIVE_LLM_CHECK = /^(1|true|yes|on)$/i.test(String(process.env.P42_LIVE_CHECK_LLM || '1'));
const REQUEST_TIMEOUT_MS = Number(process.env.P42_LIVE_CHECK_TIMEOUT_MS || 30000);

loadLocalEnv({ root: ROOT });

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeUrl(value = '') {
  return String(value || '').replace(/([?&](?:token|key|api_key|authorization)=)[^&]+/gi, '$1<redacted>');
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text.slice(0, 500) };
      }
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const result = await fetchJson(url, { timeoutMs: 2000 });
      if (result.ok) return result;
      last = new Error(`HTTP ${result.status}`);
    } catch (error) {
      last = error;
    }
    await wait(250);
  }
  throw last || new Error(`Timed out waiting for ${url}`);
}

async function startLocalServer() {
  if (process.env.P42_LIVE_CHECK_LOCAL_URL) {
    await waitForHttp(`${LOCAL_BASE_URL}/api/health`);
    return null;
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(DEFAULT_PORT),
      P42_ADMIN_FEATURE_CONFIG_PATH: path.join(OUTPUT_DIR, `live-admin-feature-flags-${DEFAULT_PORT}.json`),
      P42_AUTH_MODE: process.env.P42_AUTH_MODE || 'audit'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  try {
    await waitForHttp(`${LOCAL_BASE_URL}/api/health`);
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`Unable to start local live-check server: ${error.message}\n${output}`);
  }
  return child;
}

async function stopLocalServer(child) {
  if (!child) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    wait(2000)
  ]);
}

function statusLine(check) {
  const label = check.ok ? 'PASS' : check.required === false ? 'WARN' : 'FAIL';
  const detail = check.detail ? ` - ${check.detail}` : '';
  return `[${label}] ${check.name}: ${detail}`;
}

async function runCheck(name, url, options = {}) {
  const required = options.required !== false;
  try {
    const result = await fetchJson(url, options);
    const ok = typeof options.validate === 'function'
      ? Boolean(result.ok && options.validate(result.body, result))
      : Boolean(result.ok);
    const detail = typeof options.describe === 'function'
      ? options.describe(result.body, result)
      : `HTTP ${result.status}`;
    return {
      name,
      url: safeUrl(url),
      required,
      ok,
      status: result.status,
      detail,
      body: options.includeBody ? result.body : undefined
    };
  } catch (error) {
    return {
      name,
      url: safeUrl(url),
      required,
      ok: false,
      detail: error instanceof Error ? error.message : String(error || 'request failed')
    };
  }
}

async function runSmartIntakeCheck() {
  if (!LIVE_LLM_CHECK) {
    return {
      name: 'Local smart intake via Compass GPT-5.1',
      required: false,
      ok: true,
      detail: 'Skipped because P42_LIVE_CHECK_LLM is not enabled.'
    };
  }
  if (!gatewayConfig().tokenConfigured) {
    return {
      name: 'Local smart intake via Compass GPT-5.1',
      required: true,
      ok: false,
      detail: 'Missing local COMPASS_GATEWAY_TOKEN/PARALLAX42_GATEWAY_TOKEN/CREWAI_LLM_API_KEY/OPENAI_API_KEY.'
    };
  }
  const result = await runCheck('Local smart intake via Compass GPT-5.1', `${LOCAL_BASE_URL}/api/conversation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Assess a managed integration partner connecting Oracle ERP, Workday, ServiceNow, SharePoint, and Snowflake with privileged implementation access.',
      activeQuestion: 'What do you need reviewed?',
      eventType: 'user_answer',
      caseDraft: {
        supplierName: '',
        businessUnit: '',
        geography: '',
        integrations: [],
        evidenceSignals: [],
        riskSignals: []
      },
      history: [],
      uploadedEvidence: []
    }),
    validate(body) {
      return Boolean(body?.nlp?.llmAssessment?.used || body?.conversationPlan?.usedLlm);
    },
    describe(body, response) {
      if (!response.ok) return `HTTP ${response.status}: ${body.detail || body.error || 'conversation failed'}`;
      const assessment = body?.nlp?.llmAssessment || {};
      const plan = body?.conversationPlan || {};
      return assessment.used || plan.usedLlm
        ? `Compass used ${assessment.model || plan.model || 'configured model'}; next action ${plan.nextBestAction || assessment.recommendedFirstAction || 'planned'}.`
        : `Smart intake not used: ${assessment.userMessage || plan.userMessage || body.detail || 'unknown reason'}`;
    }
  });
  return result;
}

async function main() {
  const localEnv = loadLocalEnv({ root: ROOT });
  const gateway = gatewayConfig();
  const parser = parserRelayConfig();
  const vector = vectorConfig();
  const server = await startLocalServer();
  const checks = [];

  try {
    checks.push(await runCheck('Local API health', `${LOCAL_BASE_URL}/api/health`, {
      validate: (body) => body.ok === true,
      describe: (body) => `runtime=${body.agentRuntime?.configuredRuntime || body.mode || 'unknown'} backend=${body.linkedBackend || 'unknown'}`
    }));
    checks.push(await runCheck('Local admin status', `${LOCAL_BASE_URL}/api/admin/status`, {
      validate: (body) => body.status === 'ok' && body.gateway?.required === true,
      describe: (body) => `gateway=${body.gateway?.configured ? 'configured' : 'missing'} vector=${body.vector?.provider || 'unknown'} parser=${body.parserRelay?.configured ? 'configured' : 'missing'}`
    }));
    checks.push(await runCheck('Droplet backend direct health', `${parser.backendUrl.replace(/\/+$/, '')}/health`, {
      validate: (body) => body.ok === true || body.status === 'ok' || body.healthy === true,
      describe: (body, response) => `HTTP ${response.status}; ${body.service || body.name || body.status || body.ok || 'health response'}`
    }));
    checks.push(await runCheck('Local backend relay to droplet', `${LOCAL_BASE_URL}/api/backend?path=/health`, {
      validate: (body) => body.ok === true || body.status === 'ok' || body.healthy === true,
      describe: (body, response) => `HTTP ${response.status}; relay=${body.service || body.status || body.ok || 'response'}`
    }));
    checks.push(await runCheck('Vercel Compass gateway health', `${gateway.baseUrl.replace(/\/+$/, '')}/health`, {
      validate: (body) => body.ok === true || body.status === 'ok' || body.status === 'healthy' || body.healthy === true,
      describe: (body, response) => `HTTP ${response.status}; ${body.service || body.status || body.ok || 'health response'}`
    }));
    checks.push({
      name: 'Local Compass token configured',
      required: true,
      ok: gateway.tokenConfigured,
      detail: gateway.tokenConfigured
        ? `Token present; base URL ${gateway.baseUrl}`
        : 'Missing COMPASS_GATEWAY_TOKEN/PARALLAX42_GATEWAY_TOKEN/CREWAI_LLM_API_KEY/OPENAI_API_KEY in local environment.'
    });
    checks.push({
      name: 'Local Qdrant config present',
      required: true,
      ok: vector.provider === 'qdrant' && vector.qdrantConfigured,
      detail: vector.provider === 'qdrant' && vector.qdrantConfigured
        ? `provider=qdrant collection=${vector.collection}`
        : `provider=${vector.provider || 'unknown'} qdrantConfigured=${vector.qdrantConfigured}`
    });
    checks.push(await runSmartIntakeCheck());
  } finally {
    await stopLocalServer(server);
  }

  process.stdout.write([
    'Parallax42 live dependency check',
    `localBaseUrl: ${LOCAL_BASE_URL}`,
    `localEnvFiles: ${localEnv.files?.join(', ') || 'none'}`,
    ''
  ].join('\n'));
  checks.forEach((check) => process.stdout.write(`${statusLine(check)}\n`));

  const requiredFailures = checks.filter((check) => check.required !== false && !check.ok);
  if (requiredFailures.length) {
    process.stderr.write(`\n${requiredFailures.length} required live dependency check(s) failed.\n`);
    process.exit(1);
  }

  assert.equal(requiredFailures.length, 0);
  process.stdout.write('\nLive dependency check passed.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
