'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const logsHandler = require('../../api/logs');
const recentHandler = require('../../api/audit/recent');
const { appendAuditRecord } = require('../../lib/auditStore');

function response() {
  return {
    body: null,
    headers: {},
    statusCode: 0,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

async function withEnv(overrides, action) {
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await action();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('legacy logs endpoint is a private non-cacheable 404', async () => {
  const res = response();
  await logsHandler({ method: 'GET', headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'not_found');
  assert.equal(res.headers['cache-control'], 'private, no-store');
  assert.equal(res.body.entries, undefined);
});

test('recent audit route requires audit role and returns only actor tenant', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-audit-route-'));
  try {
    await withEnv({
      AGENT_AUDIT_DIR: dir,
      DATABASE_URL: null,
      P42_DATABASE_URL: null,
      VERCEL: null,
      NODE_ENV: 'test',
      P42_AUTH_MODE: 'enforced',
      P42_DEMO_BEARER_TOKEN: 'audit-route-token',
      P42_DEMO_ROLES: 'auditor',
      P42_WORKSPACE_ID: 'workspace-a',
      P42_PROJECT_ID: 'project-a'
    }, async () => {
      await appendAuditRecord({
        actor: { id: 'auditor-a', workspaceId: 'workspace-a', projectId: 'project-a' },
        summary: 'workspace A event'
      });
      await appendAuditRecord({
        actor: { id: 'auditor-b', workspaceId: 'workspace-b', projectId: 'project-b' },
        summary: 'workspace B confidential event'
      });

      const anonymous = response();
      await recentHandler({ method: 'GET', headers: {}, query: {} }, anonymous);
      assert.equal(anonymous.statusCode, 401);
      assert.equal(anonymous.headers['cache-control'], 'private, no-store');
      assert.equal(anonymous.headers.vary, 'Authorization');

      const authorized = response();
      await recentHandler({
        method: 'GET',
        headers: { authorization: 'Bearer audit-route-token' },
        query: { limit: '25' }
      }, authorized);
      assert.equal(authorized.statusCode, 200);
      assert.equal(authorized.body.records.length, 1);
      assert.match(authorized.body.records[0].summary, /workspace A/);
      assert.doesNotMatch(JSON.stringify(authorized.body), /workspace B confidential/);
      assert.equal(authorized.headers['cache-control'], 'private, no-store');
      assert.equal(authorized.body.integrity.ok, true);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
