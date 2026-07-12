'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { appendAuditRecord, readRecentAuditRecords, redact, verifyAuditChain } = require('../../lib/auditStore');

test('audit redaction removes secret-looking values recursively', () => {
  const result = redact({
    token: 'abc',
    nested: {
      compassApiKey: 'secret',
      safe: 'visible'
    },
    rows: [{ password: 'pw' }]
  });
  assert.equal(result.token, '[redacted]');
  assert.equal(result.nested.compassApiKey, '[redacted]');
  assert.equal(result.nested.safe, 'visible');
  assert.equal(result.rows[0].password, '[redacted]');
});

test('audit redaction removes diagnostic stack details and local paths', () => {
  const result = redact({
    runtime: {
      fallbackReason: 'Traceback (most recent call last):\n  File "/Users/example/app/crewai_adapter/compliance_flow.py", line 1, in <module>\nModuleNotFoundError: No module named crewai'
    },
    note: 'See /Users/example/app/private/file.txt for local debug output.'
  });

  assert.equal(result.runtime.fallbackReason, '[diagnostic details redacted]');
  assert.equal(result.note, 'See [local-path] for local debug output.');
});

test('audit redaction removes credentials embedded in ordinary text', () => {
  const bearerPrefix = ['Author', 'ization: Bea', 'rer '].join('');
  const openAiLike = ['s', 'k-proj-', 'abcdefghijklmnop'].join('');
  const githubLike = ['gh', 'p_', 'abcdefghijklmnopqrstuvwxyz'].join('');
  const result = redact({
    authorization: 'This key name is safe because the whole field is redacted',
    note: `${bearerPrefix}eyJhbGciOiJIUzI1NiJ9.payload.signature`,
    providerKeys: `OpenAI ${openAiLike} GitHub ${githubLike}`,
    certificateText: '-----BEGIN PRIVATE KEY-----\nsecret-material\n-----END PRIVATE KEY-----'
  });

  assert.equal(result.authorization, '[redacted]');
  assert.equal(result.note, `${bearerPrefix}[redacted]`);
  assert.equal(result.providerKeys, 'OpenAI [redacted] GitHub [redacted]');
  assert.equal(result.certificateText, '[private key redacted]');
});

test('audit records are append-only and hash chained', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-audit-test-'));
  const auditPath = path.join(dir, 'agent_audit.jsonl');
  const first = await appendAuditRecord({
    actor: { username: 'auditor@example.com', roles: ['auditor'], authMode: 'test' },
    caseId: 'case-a',
    summary: 'first',
    payload: { status: 'created' }
  }, { auditPath });
  const second = await appendAuditRecord({
    actor: { username: 'auditor@example.com', roles: ['auditor'], authMode: 'test' },
    caseId: 'case-a',
    summary: 'second',
    payload: { status: 'updated' }
  }, { auditPath });

  assert.equal(first.integrity.sequence, 1);
  assert.equal(first.integrity.previousHash, 'GENESIS');
  assert.equal(second.integrity.sequence, 2);
  assert.equal(second.integrity.previousHash, first.integrity.recordHash);
  assert.equal((await verifyAuditChain({ auditPath })).ok, true);
  assert.equal((await readRecentAuditRecords(10, { auditPath })).length, 2);
});

test('audit chain verification fails after tampering', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-audit-tamper-test-'));
  const auditPath = path.join(dir, 'agent_audit.jsonl');
  await appendAuditRecord({ caseId: 'case-b', summary: 'before tamper' }, { auditPath });
  const record = JSON.parse(fs.readFileSync(auditPath, 'utf8').trim());
  record.summary = 'tampered';
  fs.writeFileSync(auditPath, `${JSON.stringify(record)}\n`);

  const verification = await verifyAuditChain({ auditPath });
  assert.equal(verification.ok, false);
  assert.equal(verification.reason, 'record_hash_mismatch');
});

test('local audit verification fails closed on malformed JSONL', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-audit-malformed-test-'));
  const auditPath = path.join(dir, 'agent_audit.jsonl');
  try {
    await appendAuditRecord({ caseId: 'case-malformed', summary: 'before malformed row' }, { auditPath });
    fs.appendFileSync(auditPath, '{not-valid-json}\n', 'utf8');
    const verification = await verifyAuditChain({ auditPath });
    assert.equal(verification.ok, false);
    assert.equal(verification.reason, 'malformed_record');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function memoryPostgres() {
  const heads = new Map();
  const events = [];
  const statements = [];
  let transactionTail = Promise.resolve();

  function key(workspaceId, projectId) {
    return `${workspaceId}\u0000${projectId}`;
  }

  function selectEntries(sql, params) {
    const [workspaceId, projectId] = params;
    const rows = events
      .filter((event) => event.workspaceId === workspaceId && event.projectId === projectId)
      .sort((left, right) => left.sequence - right.sequence);
    if (/DESC/i.test(sql)) rows.reverse();
    return {
      rows: rows.slice(0, params[2] || rows.length).map((event) => ({
        sequence: event.sequence,
        previous_hash: event.previousHash,
        record_hash: event.recordHash,
        entry: event.entry
      }))
    };
  }

  const db = {
    statements,
    events,
    heads,
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (/CREATE TABLE/i.test(sql)) return { rows: [] };
      if (/FROM p42_audit_events/i.test(sql)) return selectEntries(sql, params);
      if (/SELECT last_sequence, last_hash[\s\S]+FROM p42_audit_chain_heads/i.test(sql)) {
        const head = heads.get(key(params[0], params[1]));
        return { rows: head ? [{ ...head }] : [] };
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    },
    async connect() {
      let releaseTransaction;
      return {
        async query(sql, params = []) {
          statements.push({ sql, params });
          if (sql === 'BEGIN') {
            const previous = transactionTail;
            transactionTail = new Promise((resolve) => { releaseTransaction = resolve; });
            await previous;
            return { rows: [] };
          }
          if (sql === 'COMMIT' || sql === 'ROLLBACK') {
            releaseTransaction?.();
            return { rows: [] };
          }
          if (/INSERT INTO p42_audit_chain_heads/i.test(sql)) {
            const scopeKey = key(params[0], params[1]);
            if (!heads.has(scopeKey)) heads.set(scopeKey, { last_sequence: 0, last_hash: 'GENESIS' });
            return { rows: [] };
          }
          if (/SELECT last_sequence, last_hash/i.test(sql)) {
            return { rows: [{ ...heads.get(key(params[0], params[1])) }] };
          }
          if (/INSERT INTO p42_audit_events/i.test(sql)) {
            events.push({
              workspaceId: params[1],
              projectId: params[2],
              sequence: params[3],
              previousHash: params[4],
              recordHash: params[5],
              entry: JSON.parse(params[6])
            });
            return { rows: [] };
          }
          if (/UPDATE p42_audit_chain_heads/i.test(sql)) {
            heads.set(key(params[0], params[1]), { last_sequence: params[2], last_hash: params[3] });
            return { rows: [] };
          }
          throw new Error(`Unexpected client query: ${sql}`);
        },
        release() {}
      };
    }
  };
  return db;
}

test('postgres audit serializes concurrent tenant chains and persists scoped reads', async () => {
  const db = memoryPostgres();
  const actorA = { id: 'auditor-a', workspaceId: 'workspace-a', projectId: 'project-a' };
  const actorB = { id: 'auditor-b', workspaceId: 'workspace-b', projectId: 'project-b' };

  await Promise.all(Array.from({ length: 12 }, (_, index) => appendAuditRecord({
    actor: actorA,
    caseId: `case-a-${index}`,
    summary: `event ${index}`
  }, { db })));
  await appendAuditRecord({ actor: actorB, caseId: 'case-b', summary: 'tenant B secret' }, { db });

  const records = await readRecentAuditRecords(100, { db, actor: actorA });
  assert.deepEqual(records.map((entry) => entry.integrity.sequence), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.equal(records.every((entry) => entry.workspaceId === actorA.workspaceId), true);
  assert.doesNotMatch(JSON.stringify(records), /tenant B secret/);
  assert.equal((await verifyAuditChain({ db, actor: actorA })).ok, true);
  assert.ok(db.statements.some(({ sql }) => /FOR UPDATE/i.test(sql)));
  assert.ok(db.statements.some(({ sql, params }) => /INSERT INTO p42_audit_events/i.test(sql) && /\$1/.test(sql) && params.length === 8));
});

test('postgres audit verification detects tail truncation and duplicated-column tampering', async () => {
  const db = memoryPostgres();
  const actor = { id: 'auditor-a', workspaceId: 'workspace-a', projectId: 'project-a' };
  await appendAuditRecord({ actor, caseId: 'case-1', summary: 'first' }, { db });
  await appendAuditRecord({ actor, caseId: 'case-2', summary: 'second' }, { db });
  assert.equal((await verifyAuditChain({ db, actor })).ok, true);

  const removed = db.events.pop();
  const truncated = await verifyAuditChain({ db, actor });
  assert.equal(truncated.ok, false);
  assert.equal(truncated.reason, 'chain_head_mismatch');

  db.events.push(removed);
  db.events[0].recordHash = 'tampered-column';
  const tampered = await verifyAuditChain({ db, actor });
  assert.equal(tampered.ok, false);
  assert.equal(tampered.reason, 'database_integrity_columns_mismatch');
});

test('hosted audit fails closed without PostgreSQL', async () => {
  const previous = {
    VERCEL: process.env.VERCEL,
    DATABASE_URL: process.env.DATABASE_URL,
    P42_DATABASE_URL: process.env.P42_DATABASE_URL
  };
  process.env.VERCEL = '1';
  delete process.env.DATABASE_URL;
  delete process.env.P42_DATABASE_URL;
  try {
    await assert.rejects(
      appendAuditRecord({ summary: 'must not reach tmp' }),
      (error) => error.code === 'audit_durable_storage_required' && error.statusCode === 503
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
