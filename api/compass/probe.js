'use strict';

const { gatewayHealth } = require('../../lib/compassGatewayClient');
const { runtimeHealth } = require('../../lib/agentRuntime');
const { redact } = require('../../lib/auditStore');
const { gatewayConfig } = require('../../lib/runtimeConfig');
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
    const config = body?.config || {};
    const providerReady = config.compass_api_key_configured === true
      && config.compass_base_url_configured === true
      && config.compass_model?.valid === true
      && config.embeddings?.valid === true
      && config.embeddings?.apiKeyConfigured === true
      && config.embeddings?.baseUrlConfigured === true;
    return {
      attempted: true,
      ok: response.ok
        && (body.ok === true || body.status === 'ok' || body.status === 'healthy')
        && providerReady,
      provider_ready: providerReady,
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

async function verifyGatewayClient(baseUrl = '', token = '') {
  const url = `${String(baseUrl || '').replace(/\/+$/, '')}/embeddings`;
  if (!baseUrl || !token) {
    return {
      attempted: false,
      ok: false,
      status_code: null,
      url: ''
    };
  }
  try {
    // The shared gateway authenticates and authorizes the client before it
    // validates the embeddings payload. A recognized, route-authorized token
    // therefore returns the expected 400 without invoking the model or
    // returning an embedding. Invalid tokens return 401/403.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-parallax42-gateway-token': token
      },
      body: '{}'
    });
    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }
    return {
      attempted: true,
      ok: response.status === 400 && body.error === 'invalid_request',
      status_code: response.status,
      url,
      response_code: body.error || ''
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      status_code: null,
      url,
      error_type: error instanceof Error ? error.name : 'RequestError',
      message: 'Gateway client authentication probe failed without exposing secrets.'
    };
  }
}

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  if (!rateLimitGuard(req, res, 'healthRead')) return;

  const gateway = gatewayHealth();
  const privateGateway = gatewayConfig();
  const runtime = runtimeHealth();
  const gatewayProbe = await fetchGatewayHealth(gateway.baseUrl);
  const gatewayClientProbe = await verifyGatewayClient(gateway.baseUrl, privateGateway.token);
  const configured = Boolean(gateway.tokenConfigured);
  const ok = Boolean(configured && gatewayProbe.ok && gatewayClientProbe.ok);

  sendJson(req, res, 200, redact({
    ok,
    configured,
    live_compass_verified: false,
    gateway_auth_verified: gatewayClientProbe.ok,
    verification_scope: 'gateway_configuration_and_client_authentication',
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
      provider_ready: gatewayProbe.provider_ready === true,
      content_type: gatewayProbe.content_type,
      url: gatewayProbe.url,
      body: gatewayProbe.body
    },
    gateway_client_auth: {
      attempted: gatewayClientProbe.attempted,
      ok: gatewayClientProbe.ok,
      status_code: gatewayClientProbe.status_code,
      response_code: gatewayClientProbe.response_code,
      url: gatewayClientProbe.url
    },
    chat_completion: {
      attempted: false,
      ok: false,
      status_code: null,
      note: 'This status probe verifies provider configuration and the server-side client policy without spending a model call. Each real chat response reports whether Compass generated that interaction.'
    },
    runtime: {
      configuredRuntime: runtime.configuredRuntime,
      liveCrewAIEnabled: runtime.liveCrewAIEnabled,
      liveAdvisorySpecialistsEnabled: runtime.liveAdvisorySpecialistsEnabled,
      deterministicFallbackAvailable: runtime.deterministicFallbackAvailable
    },
    message: ok
      ? 'Compass gateway configuration and the Agent v2 client policy are verified. Live model use is reported on each real user interaction.'
      : 'Compass product gateway is unavailable or not configured; deterministic fallback remains available.'
  }));
};
