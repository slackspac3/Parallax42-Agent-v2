'use strict';

const { isFeatureEnabled } = require('../lib/adminFeatureFlags');
const { authorizeRequest } = require('../lib/rbac');
const {
  EVIDENCE_INDEX_BODY_LIMIT_BYTES,
  EVIDENCE_UPLOAD_CHUNK_SIZE_BYTES,
  STANDARD_RUN_BODY_LIMIT_BYTES,
  parseByteLimit
} = require('../lib/requestLimits');
const { rateLimitGuard, sendJson, setCors } = require('./_http');

const REQUEST_TIMEOUT_MS = 120000;
const RELAY_RESPONSE_LIMIT_BYTES = parseByteLimit('BACKEND_RELAY_RESPONSE_LIMIT_BYTES', EVIDENCE_INDEX_BODY_LIMIT_BYTES);
const DEFAULT_BACKEND_URL = 'https://api.parallax42.bhavukarora.com';
const RELAY_PREFIX = '/api/backend';

const ALLOWED_ROUTES = new Set([
  'GET /health',
  'GET /demo/replay',
  'POST /run',
  'POST /case/assist',
  'POST /case/assist/upload',
  'POST /case/assist/upload/init',
  'POST /case/assist/upload/chunk',
  'POST /case/assist/upload/complete',
  'GET /case/assist/upload/status',
  'GET /case/assist/upload/result',
  'POST /feedback',
  'POST /feedback/applicability'
]);

function backendBaseUrl() {
  return String(process.env.PARALLAX42_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
}

function normaliseRelayPath(rawPath = '') {
  const value = String(rawPath || '').trim();
  if (!value || value === '/') return '/health';
  return value.startsWith('/') ? value : `/${value}`;
}

function relayPath(req) {
  if (req.query?.path) {
    const parsed = new URL(req.url, `https://${req.headers.host || 'relay.local'}`);
    parsed.searchParams.delete('path');
    const extraQuery = parsed.searchParams.toString();
    const path = normaliseRelayPath(Array.isArray(req.query.path) ? req.query.path[0] : req.query.path);
    return `${path}${extraQuery ? `?${extraQuery}` : ''}`;
  }

  const parsed = new URL(req.url, `https://${req.headers.host || 'relay.local'}`);
  let path = parsed.pathname;
  if (path.startsWith(RELAY_PREFIX)) {
    path = path.slice(RELAY_PREFIX.length) || '/';
  }
  return `${normaliseRelayPath(path)}${parsed.search || ''}`;
}

function routeKey(method = 'GET', pathWithSearch = '/') {
  const pathOnly = String(pathWithSearch || '/').split('?')[0];
  return `${String(method || 'GET').toUpperCase()} ${pathOnly}`;
}

function isRouteAllowed(method = 'GET', pathWithSearch = '/') {
  return ALLOWED_ROUTES.has(routeKey(method, pathWithSearch));
}

function requestLimitForPath(pathWithSearch = '/') {
  const pathOnly = String(pathWithSearch || '/').split('?')[0];
  if (pathOnly === '/case/assist/upload/chunk') {
    return EVIDENCE_UPLOAD_CHUNK_SIZE_BYTES + (256 * 1024);
  }
  if (pathOnly.startsWith('/case/assist/upload')) {
    return EVIDENCE_INDEX_BODY_LIMIT_BYTES;
  }
  return STANDARD_RUN_BODY_LIMIT_BYTES;
}

function relayBodyTooLargeError(limitBytes, target = 'request') {
  const error = new Error(`Backend relay ${target} exceeds the ${limitBytes} byte limit.`);
  error.code = 'backend_relay_body_too_large';
  error.statusCode = 413;
  error.limitBytes = limitBytes;
  return error;
}

function assertRelayBodyLimit(size, limitBytes, target = 'request') {
  if (Number.isFinite(size) && size > limitBytes) {
    throw relayBodyTooLargeError(limitBytes, target);
  }
}

async function requestBody(req, { limitBytes = STANDARD_RUN_BODY_LIMIT_BYTES } = {}) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const contentLength = Number(req.headers?.['content-length'] || 0);
  assertRelayBodyLimit(contentLength, limitBytes);
  if (Buffer.isBuffer(req.body)) {
    assertRelayBodyLimit(req.body.length, limitBytes);
    return req.body;
  }
  if (typeof req.body === 'string') {
    const body = Buffer.from(req.body);
    assertRelayBodyLimit(body.length, limitBytes);
    return body;
  }
  if (req.body && typeof req.body === 'object') {
    const body = Buffer.from(JSON.stringify(req.body));
    assertRelayBodyLimit(body.length, limitBytes);
    return body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    assertRelayBodyLimit(size, limitBytes);
    chunks.push(buffer);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function readResponseBody(response, { limitBytes = RELAY_RESPONSE_LIMIT_BYTES } = {}) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const body = Buffer.from(await response.arrayBuffer());
    assertRelayBodyLimit(body.length, limitBytes, 'response');
    return body;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const buffer = Buffer.from(value);
    size += buffer.length;
    assertRelayBodyLimit(size, limitBytes, 'response');
    chunks.push(buffer);
  }
  return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
}

function forwardedHeaders(req) {
  const headers = {
    accept: req.headers.accept || 'application/json',
    'x-p42-relay': 'vercel-browser-relay'
  };
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  if (req.headers['x-parallax42-demo-token']) headers['x-parallax42-demo-token'] = req.headers['x-parallax42-demo-token'];
  if (req.headers['x-p42-demo-token']) headers['x-parallax42-demo-token'] = req.headers['x-p42-demo-token'];
  return headers;
}

async function forward(req, pathWithSearch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const body = await requestBody(req, { limitBytes: requestLimitForPath(pathWithSearch) });
    const response = await fetch(`${backendBaseUrl()}${pathWithSearch}`, {
      method: req.method,
      headers: forwardedHeaders(req),
      body,
      signal: controller.signal
    });
    const responseBody = await readResponseBody(response);
    return {
      ok: true,
      status: response.status,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      body: responseBody
    };
  } catch (error) {
    if (error?.statusCode === 413) {
      return {
        ok: false,
        status: 413,
        body: {
          error: error.code,
          detail: error.message,
          limitBytes: error.limitBytes,
          service: 'p42-compliance-backend-relay'
        }
      };
    }
    if (error && error.name === 'AbortError') {
      return {
        ok: false,
        status: 504,
        body: {
          error: 'backend_timeout',
          detail: 'Parallax42 backend relay timed out.',
          service: 'p42-compliance-backend-relay'
        }
      };
    }
    return {
      ok: false,
      status: 502,
      body: {
        error: 'backend_unavailable',
        detail: 'Parallax42 backend is unavailable from the relay.',
        service: 'p42-compliance-backend-relay'
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function backendRelayHandler(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(req, res, { methods: 'GET,POST,OPTIONS' });
    res.status(204).end();
    return;
  }

  const pathWithSearch = relayPath(req);
  if (!rateLimitGuard(req, res, 'backendRelay', { cors: { methods: 'GET,POST,OPTIONS' } })) return;
  const auth = await authorizeRequest(req, 'agent:run');
  if (!auth.ok) {
    sendJson(req, res, auth.statusCode, auth.body);
    return;
  }
  if (!isFeatureEnabled('externalParserRelay')) {
    sendJson(req, res, 503, {
      error: 'parser_relay_disabled',
      detail: 'External parser/OCR relay is disabled by admin feature controls.',
      service: 'p42-compliance-backend-relay',
      fallback: 'Typed case context, deterministic council execution, local metadata registration, audit trace, and PDF export remain available.'
    });
    return;
  }
  if (!isRouteAllowed(req.method, pathWithSearch)) {
    sendJson(req, res, 404, {
      error: 'route_not_allowed',
      detail: 'This relay only forwards allowlisted Parallax42 demo endpoints.',
      service: 'p42-compliance-backend-relay'
    });
    return;
  }

  const result = await forward(req, pathWithSearch);
  if (!result.ok) {
    sendJson(req, res, result.status, result.body);
    return;
  }

  setCors(req, res, { methods: 'GET,POST,OPTIONS' });
  res.setHeader('content-type', result.contentType);
  res.setHeader('x-p42-relay', 'vercel-browser-relay');
  res.status(result.status).send(result.body);
}

module.exports = {
  ALLOWED_ROUTES,
  backendRelayHandler,
  isRouteAllowed,
  normaliseRelayPath,
  requestLimitForPath,
  relayPath,
  routeKey
};
