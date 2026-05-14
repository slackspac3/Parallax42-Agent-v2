'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_LOG_DIR = process.env.VERCEL
  ? path.join('/tmp', 'p42-compliance-intelligence-agent')
  : path.join(ROOT, 'logs');
const LOG_DIR = process.env.AGENT_AUDIT_DIR || DEFAULT_LOG_DIR;
const AUDIT_PATH = path.join(LOG_DIR, 'agent_audit.jsonl');

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
  if (typeof value === 'string' && value.length > 1200) {
    return `${value.slice(0, 1200)}...`;
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

function appendAuditRecord(record = {}, options = {}) {
  const auditPath = options.auditPath || getAuditPath();
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  const previous = parseAuditLines(auditPath).filter((entry) => !entry.malformed).at(-1);
  const sequence = Number(previous?.integrity?.sequence || 0) + 1;
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    service: 'parallax42-compliance-intelligence-agent',
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
  fs.appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

function readRecentAuditRecords(limit = 25, options = {}) {
  return parseAuditLines(options.auditPath || getAuditPath())
    .slice(-Math.max(1, Math.min(Number(limit || 25), 100)));
}

function verifyAuditChain(options = {}) {
  const records = parseAuditLines(options.auditPath || getAuditPath());
  const legacyCount = records.filter((record) => !record.malformed && !record.integrity).length;
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
    latestHash: previousHash,
    storage: auditStoreHealth()
  };
}

function auditStoreHealth() {
  const auditPath = getAuditPath();
  const vercelEphemeral = Boolean(process.env.VERCEL) && !process.env.AGENT_AUDIT_DIR;
  return {
    mode: 'hash_chained_jsonl',
    path: auditPath,
    appendOnly: true,
    hashChained: true,
    durable: !vercelEphemeral,
    durabilityNote: vercelEphemeral
      ? 'Vercel runtime uses /tmp unless AGENT_AUDIT_DIR is backed by durable storage.'
      : 'Audit file is written to the configured filesystem path.'
  };
}

module.exports = {
  AUDIT_PATH,
  appendAuditRecord,
  auditStoreHealth,
  getAuditPath,
  hashAuditEntry,
  readRecentAuditRecords,
  redact,
  verifyAuditChain
};
