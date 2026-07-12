'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { postgresPool, storeHealth } = require('./recordStore');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_LOG_DIR = process.env.VERCEL
  ? path.join('/tmp', 'p42-compliance-intelligence-agent')
  : path.join(ROOT, 'logs');
const LOG_DIR = process.env.AGENT_AUDIT_DIR || DEFAULT_LOG_DIR;
const AUDIT_PATH = path.join(LOG_DIR, 'agent_audit.jsonl');

let auditSchemaDb;
let auditSchemaPromise;

function getAuditDir() {
  return process.env.AGENT_AUDIT_DIR || DEFAULT_LOG_DIR;
}

function getAuditPath() {
  return path.join(getAuditDir(), 'agent_audit.jsonl');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSensitiveKey(key = '') {
  return /(^|[_-])(token|secret|password|authorization)$/i.test(key)
    || /(api|access|private|client)[_-]?key/i.test(key)
    || /client[_-]?secret/i.test(key);
}

function redactDiagnosticString(value = '') {
  const text = String(value || '');
  if (/Traceback \(most recent call last\)|\n\s+at\s+\S+:\d+:\d+|\bModuleNotFoundError:|\bRuntimeError:/i.test(text)) {
    return '[diagnostic details redacted]';
  }
  return text
    .replace(/-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----[\s\S]*?(?:-----END(?: [A-Z0-9]+)* PRIVATE KEY-----|$)/g, '[private key redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [redacted]')
    .replace(/(^|[^A-Za-z0-9])(?:sk-(?:ant-)?[A-Za-z0-9_-]{12,}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}|gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,})/g, '$1[redacted]')
    .replace(/\/Users\/[^/\s]+\/[^\s"')]+/g, '[local-path]')
    .replace(/\/home\/[^/\s]+\/[^\s"')]+/g, '[local-path]');
}

function hashAuditEntry(entry) {
  const clone = JSON.parse(JSON.stringify(entry));
  if (clone.integrity) {
    delete clone.integrity.recordHash;
  }
  return sha256(stableStringify(clone));
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (isSensitiveKey(key)) {
        return [key, '[redacted]'];
      }
      return [key, redact(item)];
    }));
  }
  if (typeof value === 'string') {
    const diagnosticSafe = redactDiagnosticString(value);
    if (diagnosticSafe.length > 1200) return `${diagnosticSafe.slice(0, 1200)}...`;
    return diagnosticSafe;
  }
  return value;
}

function actorRecord(actor, roles = []) {
  if (actor && typeof actor === 'object') {
    return {
      id: actor.id || actor.sub || actor.username || actor.email || 'unknown',
      username: actor.username || actor.email || actor.name || actor.id || 'unknown',
      roles: Array.isArray(actor.roles) && actor.roles.length ? actor.roles : roles,
      authMode: actor.authMode || 'unknown'
    };
  }
  return {
    id: actor || 'system',
    username: actor || 'system',
    roles: roles.length ? roles : ['system'],
    authMode: 'system'
  };
}

function cleanScope(value = '') {
  return String(value || '').replace(/[^A-Za-z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160);
}

function auditScope(actor = {}) {
  return {
    workspaceId: cleanScope(actor?.workspaceId || process.env.P42_WORKSPACE_ID) || 'parallax42',
    projectId: cleanScope(actor?.projectId || process.env.P42_PROJECT_ID) || 'compliance-intelligence-agent'
  };
}

function parseAuditLines(auditPath = getAuditPath()) {
  if (!fs.existsSync(auditPath)) return [];
  return fs.readFileSync(auditPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { malformed: true, raw: line };
      }
    });
}

function buildAuditEntry(record = {}, scope, previous = null) {
  const sequence = Number(previous?.integrity?.sequence || 0) + 1;
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    service: 'parallax42-compliance-intelligence-agent',
    workspaceId: scope.workspaceId,
    projectId: scope.projectId,
    category: record.category || 'agent_run',
    actor: actorRecord(record.actor || 'system', record.roles || []),
    caseId: record.caseId || '',
    status: record.status || 'completed',
    summary: record.summary || '',
    payload: redact(record.payload || {}),
    integrity: {
      sequence,
      previousHash: previous?.integrity?.recordHash || 'GENESIS',
      algorithm: 'sha256',
      recordHash: ''
    }
  };
  entry.integrity.recordHash = hashAuditEntry(entry);
  return entry;
}

function hostedRuntime() {
  return Boolean(
    process.env.VERCEL
    || process.env.RAILWAY_ENVIRONMENT
    || process.env.K_SERVICE
    || process.env.WEBSITE_INSTANCE_ID
    || process.env.CONTAINER_APP_NAME
    || process.env.NODE_ENV === 'production'
  );
}

function durableAuditRequired() {
  return hostedRuntime() || /^(1|true|yes|on)$/i.test(String(process.env.P42_REQUIRE_DURABLE_STORAGE || ''));
}

function auditDatabase(options = {}) {
  if (options.auditPath) return null;
  return options.db || postgresPool();
}

async function ensureAuditSchema(db = postgresPool()) {
  if (!db) return false;
  if (auditSchemaDb !== db) {
    auditSchemaDb = db;
    auditSchemaPromise = null;
  }
  if (!auditSchemaPromise) {
    auditSchemaPromise = db.query(`
      CREATE TABLE IF NOT EXISTS p42_audit_chain_heads (
        workspace_id text NOT NULL,
        project_id text NOT NULL,
        last_sequence bigint NOT NULL DEFAULT 0,
        last_hash text NOT NULL DEFAULT 'GENESIS',
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (workspace_id, project_id)
      );
      CREATE TABLE IF NOT EXISTS p42_audit_events (
        id text NOT NULL UNIQUE,
        workspace_id text NOT NULL,
        project_id text NOT NULL,
        sequence bigint NOT NULL,
        previous_hash text NOT NULL,
        record_hash text NOT NULL,
        entry jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        PRIMARY KEY (workspace_id, project_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS p42_audit_events_recent_idx
        ON p42_audit_events (workspace_id, project_id, sequence DESC);
    `).then(() => true).catch((error) => {
      auditSchemaPromise = null;
      throw error;
    });
  }
  return auditSchemaPromise;
}

function appendLocalAuditRecord(record = {}, options = {}) {
  const auditPath = options.auditPath || getAuditPath();
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  const scope = auditScope(record.actor);
  const previous = parseAuditLines(auditPath)
    .filter((entry) => !entry.malformed && entry.workspaceId === scope.workspaceId && entry.projectId === scope.projectId)
    .at(-1);
  const entry = buildAuditEntry(record, scope, previous);
  fs.appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

async function appendPostgresAuditRecord(record = {}, db) {
  await ensureAuditSchema(db);
  const scope = auditScope(record.actor);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO p42_audit_chain_heads (workspace_id, project_id)
      VALUES ($1, $2)
      ON CONFLICT (workspace_id, project_id) DO NOTHING
    `, [scope.workspaceId, scope.projectId]);
    const headResult = await client.query(`
      SELECT last_sequence, last_hash
      FROM p42_audit_chain_heads
      WHERE workspace_id = $1 AND project_id = $2
      FOR UPDATE
    `, [scope.workspaceId, scope.projectId]);
    const head = headResult.rows[0] || { last_sequence: 0, last_hash: 'GENESIS' };
    const entry = buildAuditEntry(record, scope, {
      integrity: {
        sequence: Number(head.last_sequence || 0),
        recordHash: head.last_hash || 'GENESIS'
      }
    });
    await client.query(`
      INSERT INTO p42_audit_events
        (id, workspace_id, project_id, sequence, previous_hash, record_hash, entry, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
    `, [
      entry.id,
      scope.workspaceId,
      scope.projectId,
      entry.integrity.sequence,
      entry.integrity.previousHash,
      entry.integrity.recordHash,
      JSON.stringify(entry),
      entry.timestamp
    ]);
    await client.query(`
      UPDATE p42_audit_chain_heads
      SET last_sequence = $3, last_hash = $4, updated_at = now()
      WHERE workspace_id = $1 AND project_id = $2
    `, [scope.workspaceId, scope.projectId, entry.integrity.sequence, entry.integrity.recordHash]);
    await client.query('COMMIT');
    return entry;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original durable-write failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function appendAuditRecord(record = {}, options = {}) {
  const db = auditDatabase(options);
  if (db) return appendPostgresAuditRecord(record, db);
  if (!options.auditPath && durableAuditRequired()) {
    const error = new Error('Durable PostgreSQL audit storage is required in hosted production.');
    error.code = 'audit_durable_storage_required';
    error.statusCode = 503;
    throw error;
  }
  return appendLocalAuditRecord(record, options);
}

function scopedLocalRecords(actor, auditPath = getAuditPath(), { includeMalformed = false } = {}) {
  const scope = auditScope(actor);
  return parseAuditLines(auditPath)
    .filter((entry) => entry.malformed
      ? includeMalformed
      : entry.workspaceId === scope.workspaceId && entry.projectId === scope.projectId);
}

async function readRecentAuditRecords(limit = 25, options = {}) {
  const requestedLimit = Number(limit);
  const boundedLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(Math.trunc(requestedLimit), 100))
    : 25;
  const db = auditDatabase(options);
  if (db) {
    await ensureAuditSchema(db);
    const scope = auditScope(options.actor);
    const result = await db.query(`
      SELECT entry
      FROM p42_audit_events
      WHERE workspace_id = $1 AND project_id = $2
      ORDER BY sequence DESC
      LIMIT $3
    `, [scope.workspaceId, scope.projectId, boundedLimit]);
    return result.rows.map((row) => row.entry).reverse();
  }
  if (!options.auditPath && durableAuditRequired()) {
    const error = new Error('Durable PostgreSQL audit storage is required in hosted production.');
    error.code = 'audit_durable_storage_required';
    error.statusCode = 503;
    throw error;
  }
  return scopedLocalRecords(options.actor, options.auditPath || getAuditPath()).slice(-boundedLimit);
}

function verifyRecords(records = []) {
  const legacyCount = records.filter((record) => !record.malformed && !record.integrity).length;
  if (legacyCount) {
    return { ok: false, count: records.length, legacyCount, brokenAt: 1, reason: 'unsealed_legacy_record' };
  }
  const chainedRecords = records.filter((record) => record.malformed || record.integrity);
  let previousHash = 'GENESIS';
  let expectedSequence = 1;
  for (const [index, record] of chainedRecords.entries()) {
    if (record.malformed) {
      return { ok: false, count: chainedRecords.length, legacyCount, brokenAt: index + 1, reason: 'malformed_record' };
    }
    if (record.integrity?.sequence !== expectedSequence) {
      return { ok: false, count: chainedRecords.length, legacyCount, brokenAt: index + 1, reason: 'sequence_mismatch' };
    }
    if (record.integrity?.previousHash !== previousHash) {
      return { ok: false, count: chainedRecords.length, legacyCount, brokenAt: index + 1, reason: 'previous_hash_mismatch' };
    }
    if (record.integrity?.recordHash !== hashAuditEntry(record)) {
      return { ok: false, count: chainedRecords.length, legacyCount, brokenAt: index + 1, reason: 'record_hash_mismatch' };
    }
    previousHash = record.integrity.recordHash;
    expectedSequence += 1;
  }
  return {
    ok: true,
    count: chainedRecords.length,
    legacyCount,
    latestHash: previousHash
  };
}

async function verifyAuditChain(options = {}) {
  const db = auditDatabase(options);
  let records;
  if (db) {
    await ensureAuditSchema(db);
    const scope = auditScope(options.actor);
    const result = await db.query(`
      SELECT sequence, previous_hash, record_hash, entry
      FROM p42_audit_events
      WHERE workspace_id = $1 AND project_id = $2
      ORDER BY sequence ASC
    `, [scope.workspaceId, scope.projectId]);
    records = result.rows.map((row) => row.entry);
    for (const [index, row] of result.rows.entries()) {
      const integrity = row.entry?.integrity || {};
      if (Number(row.sequence) !== Number(integrity.sequence)
        || row.previous_hash !== integrity.previousHash
        || row.record_hash !== integrity.recordHash) {
        return {
          ok: false,
          count: result.rows.length,
          legacyCount: 0,
          brokenAt: index + 1,
          reason: 'database_integrity_columns_mismatch',
          storage: auditStoreHealth()
        };
      }
    }
    const verified = verifyRecords(records);
    if (!verified.ok) return { ...verified, storage: auditStoreHealth() };
    const headResult = await db.query(`
      SELECT last_sequence, last_hash
      FROM p42_audit_chain_heads
      WHERE workspace_id = $1 AND project_id = $2
    `, [scope.workspaceId, scope.projectId]);
    const head = headResult.rows[0];
    const expectedSequence = Number(records.at(-1)?.integrity?.sequence || 0);
    const expectedHash = records.at(-1)?.integrity?.recordHash || 'GENESIS';
    if ((records.length && !head)
      || (head && (Number(head.last_sequence) !== expectedSequence || head.last_hash !== expectedHash))) {
      return {
        ...verified,
        ok: false,
        reason: 'chain_head_mismatch',
        storage: auditStoreHealth()
      };
    }
    return { ...verified, storage: auditStoreHealth() };
  } else {
    if (!options.auditPath && durableAuditRequired()) {
      const error = new Error('Durable PostgreSQL audit storage is required in hosted production.');
      error.code = 'audit_durable_storage_required';
      error.statusCode = 503;
      throw error;
    }
    records = scopedLocalRecords(options.actor, options.auditPath || getAuditPath(), { includeMalformed: true });
  }
  return { ...verifyRecords(records), storage: auditStoreHealth() };
}

function auditStoreHealth() {
  const databaseConfigured = storeHealth().configured;
  const hosted = hostedRuntime();
  const durableRequired = durableAuditRequired();
  const provider = databaseConfigured ? 'postgres' : hosted ? 'unavailable' : 'local_file';
  const durable = provider === 'postgres';
  return {
    mode: databaseConfigured ? 'postgres_hash_chain' : 'hash_chained_jsonl',
    provider,
    path: provider === 'local_file' ? getAuditPath() : undefined,
    appendOnly: false,
    applicationAppendOnly: true,
    hashChained: true,
    immutableRetention: false,
    durable,
    durableRequired,
    enterpriseReady: false,
    durabilityNote: provider === 'postgres'
      ? 'Tenant-scoped audit events and chain heads use the configured PostgreSQL store.'
      : provider === 'unavailable'
        ? 'Hosted production has no PostgreSQL audit store; audit writes fail closed.'
        : 'Local JSONL is a development/test fallback only.',
    retentionNote: 'PostgreSQL persistence is durable but not immutable/WORM; add an immutable export before claiming enterprise retention.'
  };
}

module.exports = {
  AUDIT_PATH,
  appendAuditRecord,
  auditStoreHealth,
  auditScope,
  ensureAuditSchema,
  getAuditPath,
  hashAuditEntry,
  readRecentAuditRecords,
  redact,
  verifyAuditChain
};
