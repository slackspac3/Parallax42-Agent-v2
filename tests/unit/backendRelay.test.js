'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { backendRelayHandler, isRouteAllowed, normaliseRelayPath, requestLimitForPath, relayPath, routeKey } = require('../../api/_backendRelay');
const { EVIDENCE_UPLOAD_CHUNK_SIZE_BYTES, STANDARD_RUN_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { resetRateLimiter } = require('../../lib/rateLimiter');

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
    send(body) {
      this.body = body;
      return this;
    },
    end(body) {
      this.body = body;
      return this;
    }
  };
}

async function withEnv(overrides, fn) {
  const snapshot = {};
  for (const key of Object.keys(overrides)) {
    snapshot[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    await fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  }
}

test('backend relay only allows explicit demo routes', () => {
  assert.equal(isRouteAllowed('GET', '/health'), true);
  assert.equal(isRouteAllowed('POST', '/run'), true);
  assert.equal(isRouteAllowed('GET', '/admin/config'), false);
  assert.equal(isRouteAllowed('POST', '/knowledge/private/upload'), false);
});

test('backend relay normalises paths safely', () => {
  assert.equal(normaliseRelayPath('health'), '/health');
  assert.equal(normaliseRelayPath('/run'), '/run');
  assert.equal(routeKey('post', '/run?x=1'), 'POST /run');
});

test('backend relay preserves non-path query parameters', () => {
  const req = {
    url: '/api/backend?path=/case/assist/upload/status&uploadId=abc123',
    headers: { host: 'example.test' },
    query: { path: '/case/assist/upload/status', uploadId: 'abc123' }
  };

  assert.equal(relayPath(req), '/case/assist/upload/status?uploadId=abc123');
});

test('backend relay uses tight upload chunk request limits', () => {
  assert.equal(requestLimitForPath('/run'), STANDARD_RUN_BODY_LIMIT_BYTES);
  assert.equal(requestLimitForPath('/case/assist/upload/chunk'), EVIDENCE_UPLOAD_CHUNK_SIZE_BYTES + (256 * 1024));
});

test('backend relay requires route authorization when auth is enforced', async () => {
  resetRateLimiter();
  await withEnv({ P42_AUTH_MODE: 'enforced' }, async () => {
    const res = mockResponse();
    await backendRelayHandler({
      method: 'GET',
      url: '/api/backend?path=/health',
      headers: { host: 'example.test' },
      query: { path: '/health' }
    }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'authentication_required');
  });
});

test('backend relay forwards authorized bearer token to allowlisted backend routes', async () => {
  resetRateLimiter();
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options = {}) => {
    captured = { url, options };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    await withEnv({
      P42_AUTH_MODE: 'enforced',
      P42_DEMO_BEARER_TOKEN: 'demo-token',
      PARALLAX42_BACKEND_URL: 'https://backend.example.test'
    }, async () => {
      const res = mockResponse();
      await backendRelayHandler({
        method: 'GET',
        url: '/api/backend?path=/health',
        headers: {
          host: 'example.test',
          authorization: 'Bearer demo-token'
        },
        query: { path: '/health' }
      }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(captured.url, 'https://backend.example.test/health');
      assert.equal(captured.options.headers.authorization, 'Bearer demo-token');
    });
  } finally {
    globalThis.fetch = originalFetch;
    resetRateLimiter();
  }
});

test('backend relay drops malformed optional bearer ignored by audit-mode authorization', async () => {
  resetRateLimiter();
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options = {}) => {
    captured = { url, options };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    await withEnv({
      P42_AUTH_MODE: 'audit',
      PARALLAX42_BACKEND_URL: 'https://backend.example.test'
    }, async () => {
      const res = mockResponse();
      await backendRelayHandler({
        method: 'GET',
        url: '/api/backend?path=/health',
        headers: {
          host: 'example.test',
          authorization: 'Bearer malformed-token'
        },
        query: { path: '/health' }
      }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(captured.url, 'https://backend.example.test/health');
      assert.equal(captured.options.headers.authorization, undefined);
    });
  } finally {
    globalThis.fetch = originalFetch;
    resetRateLimiter();
  }
});
