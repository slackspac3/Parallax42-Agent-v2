'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LOCAL_PATH = process.env.P42_RECORD_STORE_PATH
  || path.join(os.tmpdir(), 'p42-compliance-intelligence-agent', 'records.json');

let pool;
let schemaPromise;
let localMutationTail = Promise.resolve();

async function mutateLocal(action) {
  const operation = localMutationTail.catch(() => {}).then(action);
  localMutationTail = operation;
  try {
    return await operation;
  } finally {
    if (localMutationTail === operation) localMutationTail = Promise.resolve();
  }
}

function databaseUrl() {
  return String(process.env.DATABASE_URL || process.env.P42_DATABASE_URL || '').trim();
}

function postgresPool() {
  if (!databaseUrl()) return null;
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: databaseUrl(),
      max: Number(process.env.P42_DATABASE_POOL_SIZE || 4),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 8_000
    });
  }
  return pool;
}

async function ensureSchema() {
  const db = postgresPool();
  if (!db) return false;
  if (!schemaPromise) {
    schemaPromise = db.query(`
      CREATE TABLE IF NOT EXISTS p42_records (
        kind text NOT NULL,
        id text NOT NULL,
        workspace_id text NOT NULL DEFAULT '',
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        expires_at timestamptz,
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (kind, id)
      );
      CREATE INDEX IF NOT EXISTS p42_records_expiry_idx ON p42_records (expires_at);
      CREATE INDEX IF NOT EXISTS p42_records_workspace_idx ON p42_records (workspace_id, kind);
    `).then(() => true).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function localKey(kind, id) {
  return `${kind}:${id}`;
}

function readLocal() {
  try {
    const parsed = JSON.parse(fs.readFileSync(process.env.P42_RECORD_STORE_PATH || LOCAL_PATH, 'utf8'));
    return parsed && parsed.records ? parsed : { version: 1, records: {} };
  } catch {
    return { version: 1, records: {} };
  }
}

function writeLocal(store) {
  const file = process.env.P42_RECORD_STORE_PATH || LOCAL_PATH;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function normalizeRecord(record) {
  if (!record) return null;
  return {
    kind: record.kind,
    id: record.id,
    workspaceId: record.workspace_id ?? record.workspaceId ?? '',
    data: record.data || {},
    expiresAt: record.expires_at ? new Date(record.expires_at).toISOString() : record.expiresAt || null,
    version: Number(record.version || 1),
    createdAt: record.created_at ? new Date(record.created_at).toISOString() : record.createdAt,
    updatedAt: record.updated_at ? new Date(record.updated_at).toISOString() : record.updatedAt
  };
}

function isExpired(record, now = Date.now()) {
  return Boolean(record?.expiresAt && new Date(record.expiresAt).getTime() <= now);
}

async function getRecord(kind, id, { includeExpired = false } = {}) {
  if (!kind || !id) return null;
  const db = postgresPool();
  if (db) {
    await ensureSchema();
    const result = await db.query(
      'SELECT * FROM p42_records WHERE kind = $1 AND id = $2',
      [kind, id]
    );
    const record = normalizeRecord(result.rows[0]);
    return !includeExpired && isExpired(record) ? null : record;
  }
  const store = readLocal();
  const record = normalizeRecord(store.records[localKey(kind, id)]);
  return !includeExpired && isExpired(record) ? null : record;
}

async function putRecord({ kind, id, workspaceId = '', data = {}, expiresAt = null }) {
  if (!kind || !id) throw new Error('Record kind and id are required.');
  const db = postgresPool();
  if (db) {
    await ensureSchema();
    const result = await db.query(`
      INSERT INTO p42_records (kind, id, workspace_id, data, expires_at)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT (kind, id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        data = EXCLUDED.data,
        expires_at = EXCLUDED.expires_at,
        version = p42_records.version + 1,
        updated_at = now()
      RETURNING *
    `, [kind, id, workspaceId, JSON.stringify(data), expiresAt]);
    return normalizeRecord(result.rows[0]);
  }
  // ponytail: the file fallback is single-process; configure Postgres for multi-instance writes.
  return mutateLocal(() => {
    const store = readLocal();
    const key = localKey(kind, id);
    const prior = normalizeRecord(store.records[key]);
    const now = new Date().toISOString();
    const record = {
      kind,
      id,
      workspaceId,
      data,
      expiresAt,
      version: Number(prior?.version || 0) + 1,
      createdAt: prior?.createdAt || now,
      updatedAt: now
    };
    store.records[key] = record;
    writeLocal(store);
    return record;
  });
}

async function updateRecord(kind, id, update, { includeExpired = false } = {}) {
  const db = postgresPool();
  if (db) {
    await ensureSchema();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query(
        'SELECT * FROM p42_records WHERE kind = $1 AND id = $2 FOR UPDATE',
        [kind, id]
      );
      const current = normalizeRecord(currentResult.rows[0]);
      if (!current || (!includeExpired && isExpired(current))) {
        await client.query('ROLLBACK');
        return null;
      }
      const next = await update({ ...current, data: { ...current.data } });
      if (!next) {
        await client.query('ROLLBACK');
        return null;
      }
      const result = await client.query(`
        UPDATE p42_records SET workspace_id = $3, data = $4::jsonb, expires_at = $5,
          version = version + 1, updated_at = now()
        WHERE kind = $1 AND id = $2 RETURNING *
      `, [kind, id, next.workspaceId ?? current.workspaceId, JSON.stringify(next.data ?? current.data), next.expiresAt ?? current.expiresAt]);
      await client.query('COMMIT');
      return normalizeRecord(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return mutateLocal(async () => {
    const store = readLocal();
    const key = localKey(kind, id);
    const current = normalizeRecord(store.records[key]);
    if (!current || (!includeExpired && isExpired(current))) return null;
    const next = await update({ ...current, data: { ...current.data } });
    if (!next) return null;
    const record = {
      ...current,
      ...next,
      data: next.data ?? current.data,
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    store.records[key] = record;
    writeLocal(store);
    return record;
  });
}

async function deleteRecord(kind, id) {
  const db = postgresPool();
  if (db) {
    await ensureSchema();
    const result = await db.query('DELETE FROM p42_records WHERE kind = $1 AND id = $2', [kind, id]);
    return result.rowCount > 0;
  }
  return mutateLocal(() => {
    const store = readLocal();
    const key = localKey(kind, id);
    const existed = Boolean(store.records[key]);
    delete store.records[key];
    if (existed) writeLocal(store);
    return existed;
  });
}

async function listRecords(kind, { workspaceId, includeExpired = false } = {}) {
  const db = postgresPool();
  if (db) {
    await ensureSchema();
    const values = [kind];
    let query = 'SELECT * FROM p42_records WHERE kind = $1';
    if (workspaceId !== undefined) {
      values.push(workspaceId);
      query += ` AND workspace_id = $${values.length}`;
    }
    if (!includeExpired) query += ' AND (expires_at IS NULL OR expires_at > now())';
    query += ' ORDER BY updated_at DESC';
    const result = await db.query(query, values);
    return result.rows.map(normalizeRecord);
  }
  return Object.values(readLocal().records)
    .map(normalizeRecord)
    .filter((record) => record.kind === kind)
    .filter((record) => workspaceId === undefined || record.workspaceId === workspaceId)
    .filter((record) => includeExpired || !isExpired(record))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

function storeHealth() {
  return {
    provider: databaseUrl() ? 'postgres' : 'local_file',
    durable: Boolean(databaseUrl()),
    configured: Boolean(databaseUrl()),
    localPath: databaseUrl() ? undefined : (process.env.P42_RECORD_STORE_PATH || LOCAL_PATH)
  };
}

module.exports = {
  deleteRecord,
  ensureSchema,
  getRecord,
  isExpired,
  listRecords,
  putRecord,
  storeHealth,
  updateRecord
};
