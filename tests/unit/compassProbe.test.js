'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const compassProbeHandler = require('../../api/compass/probe');

const TOKEN_KEYS = [
  'COMPASS_GATEWAY_TOKEN',
  'PARALLAX42_GATEWAY_TOKEN',
  'CREWAI_LLM_API_KEY',
  'OPENAI_API_KEY'
];

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end(body) {
      this.body = body;
      return this;
    }
  };
}

function healthyGatewayBody() {
  return {
    ok: true,
    service: 'compass-gateway',
    config: {
      compass_api_key_configured: true,
      compass_base_url_configured: true,
      compass_model: { valid: true },
      embeddings: {
        valid: true,
        apiKeyConfigured: true,
        baseUrlConfigured: true
      }
    }
  };
}

async function withEnv(overrides, fn) {
  const keys = new Set([...TOKEN_KEYS, ...Object.keys(overrides)]);
  const snapshot = Object.fromEntries([...keys].map((key) => [key, process.env[key]]));
  for (const key of TOKEN_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  }
}

function request(ip) {
  return { method: 'GET', headers: { 'x-forwarded-for': ip } };
}

test('public gateway health is insufficient without a client token', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({ COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api' }, async () => {
      let calls = 0;
      global.fetch = async (url, options = {}) => {
        calls += 1;
        assert.equal(url, 'https://gateway.example/api/health');
        assert.equal(options.method, 'GET');
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify(healthyGatewayBody())
        };
      };

      const res = mockResponse();
      await compassProbeHandler(request('198.51.100.11'), res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.gateway_health.ok, true);
      assert.equal(res.body.configured, false);
      assert.equal(res.body.gateway_client_auth.attempted, false);
      assert.equal(res.body.gateway_auth_verified, false);
      assert.equal(res.body.ok, false);
      assert.equal(res.body.live_compass_verified, false);
      assert.equal(calls, 1);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('configured but rejected gateway token is not verified', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'wrong-token'
    }, async () => {
      global.fetch = async (url, options = {}) => {
        if (url.endsWith('/health')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            text: async () => JSON.stringify(healthyGatewayBody())
          };
        }
        assert.equal(url, 'https://gateway.example/api/embeddings');
        assert.equal(options.headers['x-parallax42-gateway-token'], 'wrong-token');
        assert.equal(options.body, '{}');
        return {
          ok: false,
          status: 401,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({ error: 'unauthorized' })
        };
      };

      const res = mockResponse();
      await compassProbeHandler(request('198.51.100.12'), res);

      assert.equal(res.body.configured, true);
      assert.equal(res.body.gateway_client_auth.attempted, true);
      assert.equal(res.body.gateway_client_auth.status_code, 401);
      assert.equal(res.body.gateway_client_auth.ok, false);
      assert.equal(res.body.gateway_auth_verified, false);
      assert.equal(res.body.ok, false);
      assert.equal(res.body.live_compass_verified, false);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('authenticated gateway sentinel verifies client policy without a model call', async () => {
  const originalFetch = global.fetch;
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token'
    }, async () => {
      let calls = 0;
      global.fetch = async (url, options = {}) => {
        calls += 1;
        if (url.endsWith('/health')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            text: async () => JSON.stringify(healthyGatewayBody())
          };
        }
        assert.equal(url, 'https://gateway.example/api/embeddings');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers['x-parallax42-gateway-token'], 'test-token');
        assert.equal(options.body, '{}');
        return {
          ok: false,
          status: 400,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({ error: 'invalid_request', service: 'compass-gateway' })
        };
      };

      const res = mockResponse();
      await compassProbeHandler(request('198.51.100.13'), res);

      assert.equal(res.body.gateway_client_auth.attempted, true);
      assert.equal(res.body.gateway_client_auth.ok, true);
      assert.equal(res.body.gateway_client_auth.status_code, 400);
      assert.equal(res.body.gateway_client_auth.response_code, 'invalid_request');
      assert.equal(res.body.gateway_auth_verified, true);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.live_compass_verified, false);
      assert.equal(res.body.chat_completion.attempted, false);
      assert.equal(calls, 2);
    });
  } finally {
    global.fetch = originalFetch;
  }
});
