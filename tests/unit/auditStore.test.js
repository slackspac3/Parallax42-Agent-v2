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

test('audit records are append-only and hash chained', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-audit-test-'));
  const auditPath = path.join(dir, 'agent_audit.jsonl');
  const first = appendAuditRecord({
    actor: { username: 'auditor@example.com', roles: ['auditor'], authMode: 'test' },
    caseId: 'case-a',
    summary: 'first',
    payload: { status: 'created' }
  }, { auditPath });
  const second = appendAuditRecord({
    actor: { username: 'auditor@example.com', roles: ['auditor'], authMode: 'test' },
    caseId: 'case-a',
    summary: 'second',
    payload: { status: 'updated' }
  }, { auditPath });

  assert.equal(first.integrity.sequence, 1);
  assert.equal(first.integrity.previousHash, 'GENESIS');
  assert.equal(second.integrity.sequence, 2);
  assert.equal(second.integrity.previousHash, first.integrity.recordHash);
  assert.equal(verifyAuditChain({ auditPath }).ok, true);
  assert.equal(readRecentAuditRecords(10, { auditPath }).length, 2);
});

test('audit chain verification fails after tampering', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-audit-tamper-test-'));
  const auditPath = path.join(dir, 'agent_audit.jsonl');
  appendAuditRecord({ caseId: 'case-b', summary: 'before tamper' }, { auditPath });
  const record = JSON.parse(fs.readFileSync(auditPath, 'utf8').trim());
  record.summary = 'tampered';
  fs.writeFileSync(auditPath, `${JSON.stringify(record)}\n`);

  const verification = verifyAuditChain({ auditPath });
  assert.equal(verification.ok, false);
  assert.equal(verification.reason, 'record_hash_mismatch');
});
