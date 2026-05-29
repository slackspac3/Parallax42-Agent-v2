'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const adminStatusHandler = require('../../api/admin/status');
const adminFeaturesHandler = require('../../api/admin/features');

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

async function withAdminEnv(overrides, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-admin-routes-test-'));
  const snapshot = {};
  const keys = [
    'P42_ADMIN_FEATURE_CONFIG_PATH',
    'AGENT_AUDIT_DIR',
    'P42_AUTH_MODE',
    'NODE_ENV',
    'VERCEL',
    'P42_ALLOW_INSECURE_AUTH_MODE',
    'P42_DEMO_BEARER_TOKEN',
    'P42_DEMO_ROLES',
    'P42_DEMO_ACTOR'
  ];
  for (const key of keys) snapshot[key] = process.env[key];
  process.env.P42_ADMIN_FEATURE_CONFIG_PATH = path.join(dir, 'features.json');
  process.env.AGENT_AUDIT_DIR = path.join(dir, 'audit');
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
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('audit mode anonymous GET admin status succeeds', async () => {
  await withAdminEnv({ P42_AUTH_MODE: 'audit' }, async () => {
    const res = mockResponse();
    await adminStatusHandler({ method: 'GET', headers: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.auth.mode, 'audit');
  });
});

test('enforced mode missing token cannot read admin status or feature inventory', async () => {
  await withAdminEnv({ P42_AUTH_MODE: 'enforced' }, async () => {
    const statusRes = mockResponse();
    await adminStatusHandler({ method: 'GET', headers: {} }, statusRes);
    assert.equal(statusRes.statusCode, 401);
    assert.equal(statusRes.body.error, 'authentication_required');

    const featuresRes = mockResponse();
    await adminFeaturesHandler({ method: 'GET', headers: {} }, featuresRes);
    assert.equal(featuresRes.statusCode, 401);
    assert.equal(featuresRes.body.error, 'authentication_required');
  });
});

test('audit mode anonymous PATCH admin features fails', async () => {
  await withAdminEnv({ P42_AUTH_MODE: 'audit', P42_DEMO_BEARER_TOKEN: 'demo-admin' }, async () => {
    const res = mockResponse();
    await adminFeaturesHandler({
      method: 'PATCH',
      headers: {},
      body: { features: { compassLlmCalls: false } }
    }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'admin_authorization_required');
  });
});

test('audit mode demo bearer token with platform admin role updates features', async () => {
  await withAdminEnv({
    P42_AUTH_MODE: 'audit',
    P42_DEMO_BEARER_TOKEN: 'demo-admin',
    P42_DEMO_ROLES: 'platform_admin',
    P42_DEMO_ACTOR: 'demo-admin@example.com'
  }, async () => {
    const res = mockResponse();
    await adminFeaturesHandler({
      method: 'PATCH',
      headers: { authorization: 'Bearer demo-admin' },
      body: { features: { compassLlmCalls: false } }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.changed.includes('compassLlmCalls'));
  });
});

test('enforced mode missing token cannot mutate admin features', async () => {
  await withAdminEnv({ P42_AUTH_MODE: 'enforced', P42_DEMO_BEARER_TOKEN: 'demo-admin' }, async () => {
    const res = mockResponse();
    await adminFeaturesHandler({
      method: 'PATCH',
      headers: {},
      body: { features: { compassLlmCalls: false } }
    }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'authentication_required');
  });
});
