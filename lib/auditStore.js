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

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (/token|secret|key|password|authorization/i.test(key)) {
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

function appendAuditRecord(record = {}) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    service: 'parallax42-compliance-intelligence-agent',
    category: record.category || 'agent_run',
    actor: record.actor || 'system',
    caseId: record.caseId || '',
    status: record.status || 'completed',
    summary: record.summary || '',
    payload: redact(record.payload || {})
  };
  fs.appendFileSync(AUDIT_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

function readRecentAuditRecords(limit = 25) {
  if (!fs.existsSync(AUDIT_PATH)) return [];
  return fs.readFileSync(AUDIT_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-Math.max(1, Math.min(Number(limit || 25), 100)))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { malformed: true };
      }
    });
}

module.exports = {
  AUDIT_PATH,
  appendAuditRecord,
  readRecentAuditRecords,
  redact
};
