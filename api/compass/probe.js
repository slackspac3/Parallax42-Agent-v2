'use strict';

const { gatewayHealth } = require('../../lib/compassGatewayClient');
const { runtimeHealth } = require('../../lib/agentRuntime');
const { redact } = require('../../lib/auditStore');
const { methodGuard, rateLimitGuard, sendJson } = require('../_http');

async function fetchGatewayHealth(baseUrl = '') {
  const url = `${String(baseUrl || '').replace(/\/+$/, '')}/health`;
  if (!baseUrl) {
    return {
      attempted: false,
      ok: false,
      status_code: null,
      content_type: '',
      url: ''
    };
  }
  try {
    const response = await fetch(url, { method: 'GET' });
    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { body_type: 'non_json', body_snippet: text.slice(0, 220) };
      }
    }
    return {
      attempted: true,
      ok: response.ok && (body.ok === true || body.status === 'ok' || body.status === 'healthy'),
      status_code: response.status,
      content_type: response.headers.get('content-type') || '',
      url,
      json: typeof body === 'object' && !body.body_type,
      body: redact(body)
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      status_code: null,
      content_type: '',
      url,
      error_type: error instanceof Error ? error.name : 'RequestError',
      message: 'Gateway health probe failed without exposing secrets.'
    };
  }
}

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'healthRead')) return;

  const gateway = gatewayHealth();
  const runtime = runtimeHealth();
  const gatewayProbe = await fetchGatewayHealth(gateway.baseUrl);
  const configured = Boolean(gateway.tokenConfigured || gatewayProbe.ok);
  const ok = Boolean(gatewayProbe.ok && configured);

  sendJson(req, res, 200, redact({
    ok,
    configured,
    live_compass_verified: ok,
    provider_mode: 'product_gateway',
    provider: 'core42_compass_via_server_side_gateway',
    direct_openai_compatible: gateway.directOpenAiCompatible,
    base_url: gateway.baseUrl,
    model: gateway.llmModel,
    embeddings_model: gateway.embeddingsModel,
    sample_mode: false,
    gateway_health: {
      attempted: gatewayProbe.attempted,
      ok: gatewayProbe.ok,
      status_code: gatewayProbe.status_code,
      json: gatewayProbe.json === true,
      content_type: gatewayProbe.content_type,
      url: gatewayProbe.url,
      body: gatewayProbe.body
    },
    chat_completion: {
      attempted: false,
      ok: false,
      status_code: null,
      note: 'This public product probe verifies the configured server-side Compass gateway health. Root FastAPI direct Compass diagnostics remain available through scripts/compass_doctor.py and /compass/probe when python run.py is hosted.'
    },
    runtime: {
      configuredRuntime: runtime.configuredRuntime,
      liveCrewAIEnabled: runtime.liveCrewAIEnabled,
      liveAdvisorySpecialistsEnabled: runtime.liveAdvisorySpecialistsEnabled,
      deterministicFallbackAvailable: runtime.deterministicFallbackAvailable
    },
    message: ok
      ? 'Compass product gateway is configured and reachable. Secrets are redacted and remain server-side.'
      : 'Compass product gateway is unavailable or not configured; deterministic fallback remains available.'
  }));
};
