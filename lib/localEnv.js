'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LOCAL_ONLY_BLOCKED_PREFIXES = [
  'VERCEL',
  'TURBO_',
  'NX_'
];

function shouldSkipLocalKey(key = '') {
  if (process.env.P42_APPLY_PLATFORM_ENV === '1') return false;
  return LOCAL_ONLY_BLOCKED_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix));
}

function parseEnvLine(line = '') {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const source = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
  const equals = source.indexOf('=');
  if (equals <= 0) return null;
  const key = source.slice(0, equals).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  let value = source.slice(equals + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  } else {
    const comment = value.indexOf(' #');
    if (comment >= 0) value = value.slice(0, comment).trim();
  }
  return { key, value };
}

function parseEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  const text = fs.readFileSync(filePath, 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const parsed = parseEnvLine(line);
    if (parsed) values[parsed.key] = parsed.value;
  });
  return values;
}

function loadLocalEnv(options = {}) {
  if (process.env.P42_SKIP_LOCAL_ENV === '1') {
    return { loaded: false, files: [], skipped: 'disabled_by_P42_SKIP_LOCAL_ENV' };
  }
  if (process.env.VERCEL && process.env.P42_LOAD_LOCAL_ENV !== '1') {
    return { loaded: false, files: [], skipped: 'vercel_runtime' };
  }
  const root = options.root || path.resolve(__dirname, '..');
  const existing = new Set(Object.keys(process.env));
  const candidates = Array.isArray(options.files) && options.files.length
    ? options.files
    : ['.env', '.env.local'];
  const files = [];
  const merged = {};
  candidates.forEach((relativePath) => {
    const filePath = path.resolve(root, relativePath);
    if (!fs.existsSync(filePath)) return;
    Object.assign(merged, parseEnvFile(filePath));
    files.push(path.basename(filePath));
  });
  Object.entries(merged).forEach(([key, value]) => {
    if (shouldSkipLocalKey(key)) return;
    if (existing.has(key)) return;
    process.env[key] = value;
  });
  return {
    loaded: files.length > 0,
    files,
    applied: Object.keys(merged).filter((key) => !existing.has(key) && !shouldSkipLocalKey(key)).sort(),
    skippedPlatformKeys: Object.keys(merged).filter(shouldSkipLocalKey).sort()
  };
}

module.exports = {
  loadLocalEnv,
  parseEnvLine,
  shouldSkipLocalKey
};
