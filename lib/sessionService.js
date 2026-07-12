'use strict';

const crypto = require('node:crypto');

const { fixtureDocumentSummary, getFixtureDocumentByFilename } = require('./fixtureDocuments');
const { deleteRecord, getRecord, putRecord, storeHealth, updateRecord } = require('./recordStore');

const DEMO_TTL_MS = 2 * 60 * 60 * 1000;
const PILOT_TTL_MS = 8 * 60 * 60 * 1000;
const ACCESS_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEMO_LIMITS = Object.freeze({ chatTurns: 20, sampleDocuments: 3, councilRuns: 3, exports: 3 });

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function randomToken(prefix) {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

function hashToken(value = '') {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function expiry(milliseconds) {
  return new Date(Date.now() + milliseconds).toISOString();
}

function normalizeSessionRole(value = '') {
  return cleanText(value)
    .replace(/^appRole:|^role:/i, '')
    .replace(/[-:]+/g, ' ')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

function sessionActor(record, authSource) {
  const data = record.data || {};
  return {
    authenticated: true,
    authSource,
    id: data.actorId || data.sessionId,
    username: data.username || (authSource === 'demo_session' ? 'demo-visitor' : 'pilot-user'),
    roles: Array.isArray(data.roles) ? data.roles.map(normalizeSessionRole).filter(Boolean) : [],
    workspaceId: record.workspaceId,
    projectId: data.projectId || 'parallax42-agent-v2',
    sessionId: data.sessionId,
    sessionType: data.sessionType,
    recordKind: record.kind,
    recordId: record.id,
    expiresAt: record.expiresAt,
    quotas: data.limits || null,
    usage: data.usage || null
  };
}

async function createDemoSession() {
  const token = randomToken('p42d');
  const sessionId = crypto.randomUUID();
  const expiresAt = expiry(DEMO_TTL_MS);
  const workspaceId = `demo:${sessionId}`;
  const data = {
    sessionId,
    sessionType: 'demo',
    actorId: `demo:${sessionId}`,
    username: 'demo-visitor',
    roles: ['demo_user'],
    projectId: 'parallax42-agent-v2-demo',
    limits: { ...DEMO_LIMITS },
    usage: { chatTurns: 0, sampleDocuments: 0, councilRuns: 0, exports: 0 },
    createdAt: new Date().toISOString()
  };
  await putRecord({ kind: 'demo_session', id: hashToken(token), workspaceId, data, expiresAt });
  return {
    ok: true,
    token,
    sessionId,
    workspaceId,
    expiresAt,
    limits: data.limits,
    usage: data.usage,
    capabilities: {
      liveCompassRequired: true,
      sampleEvidence: true,
      ownEvidenceUpload: false,
      humanReviewSimulation: true,
      durable: storeHealth().durable
    }
  };
}

async function seedConfiguredAccessCodes() {
  const codes = String(process.env.P42_PILOT_ACCESS_CODES || '')
    .split(',')
    .map(cleanText)
    .filter((code) => code.length >= 12);
  for (const code of codes) {
    const id = hashToken(code);
    if (await getRecord('access_code', id, { includeExpired: true })) continue;
    const workspaceId = `pilot:${id.slice(0, 20)}`;
    await putRecord({
      kind: 'access_code',
      id,
      workspaceId,
      expiresAt: expiry(ACCESS_CODE_TTL_MS),
      data: {
        workspaceId,
        roles: String(process.env.P42_PILOT_ROLES || 'compliance_reviewer,business_approver')
          .split(',').map(cleanText).filter(Boolean),
        createdAt: new Date().toISOString(),
        usedAt: null
      }
    });
  }
}

function invalidAccessCode(message = 'Access code is invalid, expired, or already used.') {
  const error = new Error(message);
  error.statusCode = 401;
  error.code = 'invalid_access_code';
  return error;
}

async function exchangeAccessCode(code = '') {
  const normalized = cleanText(code);
  if (normalized.length < 12 || normalized.length > 256) throw invalidAccessCode();
  await seedConfiguredAccessCodes();
  const id = hashToken(normalized);
  const consumed = await updateRecord('access_code', id, (record) => {
    if (record.data.usedAt) return null;
    return { data: { ...record.data, usedAt: new Date().toISOString() } };
  });
  if (!consumed) throw invalidAccessCode();

  const token = randomToken('p42p');
  const sessionId = crypto.randomUUID();
  const expiresAt = expiry(PILOT_TTL_MS);
  await putRecord({
    kind: 'pilot_session',
    id: hashToken(token),
    workspaceId: consumed.workspaceId,
    expiresAt,
    data: {
      sessionId,
      sessionType: 'pilot',
      actorId: `pilot:${consumed.workspaceId.slice(6)}`,
      username: 'pilot-user',
      roles: consumed.data.roles,
      projectId: 'parallax42-agent-v2-pilot',
      createdAt: new Date().toISOString()
    }
  });
  return { token, sessionId, workspaceId: consumed.workspaceId, expiresAt, roles: consumed.data.roles };
}

function parseCookies(req = {}) {
  return Object.fromEntries(String(req.headers?.cookie || '')
    .split(';')
    .map((part) => part.trim().split('='))
    .filter(([key, value]) => key && value)
    .map(([key, ...value]) => [key, decodeURIComponent(value.join('='))]));
}

function pilotCookie(token, { clear = false } = {}) {
  const production = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
  return [
    `p42_pilot_session=${clear ? '' : encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    production ? 'Secure' : '',
    `Max-Age=${clear ? 0 : Math.floor(PILOT_TTL_MS / 1000)}`
  ].filter(Boolean).join('; ');
}

async function authenticateSessionToken(token = '') {
  const raw = cleanText(token);
  const kind = raw.startsWith('p42d_') ? 'demo_session' : raw.startsWith('p42p_') ? 'pilot_session' : '';
  if (!kind) return null;
  const record = await getRecord(kind, hashToken(raw));
  return record ? sessionActor(record, kind === 'demo_session' ? 'demo_session' : 'pilot_session') : null;
}

async function authenticatePilotCookie(req = {}) {
  const token = parseCookies(req).p42_pilot_session || '';
  return token ? authenticateSessionToken(token) : null;
}

async function revokeSession(actor = {}) {
  if (!actor.recordKind || !actor.recordId) return false;
  return deleteRecord(actor.recordKind, actor.recordId);
}

function quotaError(name, limit) {
  const error = new Error(`Demo ${name} limit reached. Start a new demo session to continue.`);
  error.statusCode = 429;
  error.code = 'demo_quota_exhausted';
  error.quota = name;
  error.limit = limit;
  return error;
}

async function consumeQuota(actor = {}, name, amount = 1) {
  if (actor.sessionType !== 'demo' || !actor.recordId) return null;
  let exceeded = false;
  let limit = 0;
  const updated = await updateRecord(actor.recordKind, actor.recordId, (record) => {
    const limits = record.data.limits || {};
    const usage = record.data.usage || {};
    limit = Number(limits[name] || 0);
    const next = Number(usage[name] || 0) + amount;
    if (!limit || next > limit) {
      exceeded = true;
      return null;
    }
    return { data: { ...record.data, usage: { ...usage, [name]: next } } };
  });
  if (exceeded) throw quotaError(name, limit);
  if (!updated) {
    const error = new Error('Demo session expired. Start a new demo session.');
    error.statusCode = 401;
    error.code = 'demo_session_expired';
    throw error;
  }
  return { limits: updated.data.limits, usage: updated.data.usage };
}

function isDemoFixtureEvidence(body = {}) {
  const documents = Array.isArray(body.documents) ? body.documents : [];
  return documents.length > 0 && documents.every((document) => {
    const metadata = document?.metadata || {};
    const fileName = cleanText(document?.fileName || document?.filename || metadata.fileName);
    const evidenceId = cleanText(document?.evidenceId || metadata.evidenceId);
    const fixture = getFixtureDocumentByFilename(fileName);
    if (!fixture || fixture.filename !== fileName) return false;
    return evidenceId === `FIXTURE-${fixture.filename.split('_', 1)[0]}`;
  });
}

function canonicalDemoFixtureDocuments(body = {}) {
  if (!isDemoFixtureEvidence(body)) return [];
  return body.documents.map((document) => {
    const fileName = cleanText(document?.fileName || document?.filename || document?.metadata?.fileName);
    return fixtureDocumentSummary(fileName).evidence;
  });
}

module.exports = {
  DEMO_LIMITS,
  authenticatePilotCookie,
  authenticateSessionToken,
  canonicalDemoFixtureDocuments,
  consumeQuota,
  createDemoSession,
  exchangeAccessCode,
  hashToken,
  isDemoFixtureEvidence,
  parseCookies,
  pilotCookie,
  revokeSession,
  seedConfiguredAccessCodes
};
