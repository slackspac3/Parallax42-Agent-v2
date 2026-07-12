'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { authMode, authorizeRequest, normalizeRole, rolesFromClaims } = require('../../lib/rbac');

function base64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signHs256(payload, secret = 'test-secret') {
  const header = base64Url({ alg: 'HS256', typ: 'JWT' });
  const body = base64Url(payload);
  const signature = crypto.createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('P42_AUTH') || key.startsWith('P42_JWT') || key.startsWith('P42_ENTRA') || key === 'ENTRA_CLIENT_ID' || key === 'AUTH_MODE' || key === 'NODE_ENV' || key === 'VERCEL' || key === 'P42_ALLOW_INSECURE_AUTH_MODE' || key === 'P42_ALLOW_AUDIT_AUTH_IN_PRODUCTION') {
      delete process.env[key];
    }
  }
  Object.assign(process.env, snapshot);
}

test('role normalization accepts human-readable enterprise roles', () => {
  assert.equal(normalizeRole('Compliance Reviewer'), 'compliance_reviewer');
  assert.equal(normalizeRole('appRole:Platform Admin'), 'platform_admin');
  assert.deepEqual(rolesFromClaims({ roles: ['Auditor', 'Risk Admin'] }), ['auditor', 'risk_admin']);
});

test('enforced RBAC accepts signed JWT with permitted role', async () => {
  const snapshot = { ...process.env };
  try {
    process.env.P42_AUTH_MODE = 'enforced';
    process.env.P42_JWT_HS256_SECRET = 'test-secret';
    process.env.P42_AUTH_AUDIENCE = 'p42-test-api';
    const token = signHs256({
      sub: 'user-1',
      preferred_username: 'reviewer@example.com',
      aud: 'p42-test-api',
      exp: Math.floor(Date.now() / 1000) + 300,
      roles: ['Compliance Reviewer']
    });
    const result = await authorizeRequest({ headers: { authorization: `Bearer ${token}` } }, 'agent:run');

    assert.equal(result.ok, true);
    assert.equal(result.actor.username, 'reviewer@example.com');
    assert.deepEqual(result.actor.roles, ['compliance_reviewer']);
  } finally {
    restoreEnv(snapshot);
  }
});

test('enforced RBAC blocks valid JWT without permitted role', async () => {
  const snapshot = { ...process.env };
  try {
    process.env.P42_AUTH_MODE = 'enforced';
    process.env.P42_JWT_HS256_SECRET = 'test-secret';
    const token = signHs256({
      sub: 'user-2',
      exp: Math.floor(Date.now() / 1000) + 300,
      roles: ['Read Only']
    });
    const result = await authorizeRequest({ headers: { authorization: `Bearer ${token}` } }, 'audit:read');

    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.error, 'insufficient_role');
  } finally {
    restoreEnv(snapshot);
  }
});

test('production defaults to enforced auth unless explicitly allowed', async () => {
  const snapshot = { ...process.env };
  try {
    delete process.env.P42_AUTH_MODE;
    delete process.env.AUTH_MODE;
    delete process.env.P42_ALLOW_INSECURE_AUTH_MODE;
    process.env.NODE_ENV = 'production';

    assert.equal(authMode(), 'enforced');
    const result = await authorizeRequest({ headers: {} }, 'audit:read');
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 401);

    process.env.P42_AUTH_MODE = 'audit';
    assert.equal(authMode(), 'enforced');

    process.env.P42_ALLOW_INSECURE_AUTH_MODE = '1';
    assert.equal(authMode(), 'audit');
  } finally {
    restoreEnv(snapshot);
  }
});

test('audit mode ignores malformed optional bearer tokens on normal routes', async () => {
  const snapshot = { ...process.env };
  try {
    process.env.P42_AUTH_MODE = 'audit';

    const result = await authorizeRequest({ headers: { authorization: 'Bearer malformed-token' } }, 'agent:run');

    assert.equal(result.ok, true);
    assert.equal(result.actor.authenticated, false);
    assert.equal(result.actor.authSource, 'invalid_bearer_ignored');
    assert.deepEqual(result.actor.roles, ['demo_user']);
  } finally {
    restoreEnv(snapshot);
  }
});

test('audit reads remain authenticated and role-gated in audit mode', async () => {
  const snapshot = { ...process.env };
  try {
    process.env.P42_AUTH_MODE = 'audit';
    const result = await authorizeRequest({ headers: {} }, 'audit:read');
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 401);
  } finally {
    restoreEnv(snapshot);
  }
});
