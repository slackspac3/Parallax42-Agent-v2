'use strict';

const { STANDARD_RUN_BODY_LIMIT_BYTES } = require('../lib/requestLimits');

const DEFAULT_ALLOWED_ORIGINS = [
  'https://slackspac3.github.io',
  'http://127.0.0.1:3020',
  'http://localhost:3020'
];

function allowedOrigins() {
  const configured = String(process.env.P42_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function setCors(req, res, { methods = 'GET,POST,OPTIONS', headers = 'accept,authorization,content-type,x-agent-runtime,x-p42-demo-token,x-parallax42-demo-token' } = {}) {
  const origin = req?.headers?.origin || '';
  if (allowedOrigins().has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
  }
  res.setHeader('access-control-allow-methods', methods);
  res.setHeader('access-control-allow-headers', headers);
  res.setHeader('access-control-max-age', '86400');
}

function sendJson(req, res, statusCode, body, cors = {}) {
  setCors(req, res, cors);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(statusCode).json(body);
}

function requestBodyTooLargeError(limitBytes) {
  const error = new Error(`Request body exceeds the ${limitBytes} byte limit.`);
  error.code = 'request_body_too_large';
  error.statusCode = 413;
  error.limitBytes = limitBytes;
  return error;
}

function malformedJsonError() {
  const error = new Error('Request body must be valid JSON.');
  error.code = 'malformed_json';
  error.statusCode = 400;
  return error;
}

function parseJsonText(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw malformedJsonError();
  }
}

function assertBodyLimit(size, limitBytes) {
  if (Number.isFinite(size) && size > limitBytes) {
    throw requestBodyTooLargeError(limitBytes);
  }
}

async function readJsonRequest(req, { limitBytes = STANDARD_RUN_BODY_LIMIT_BYTES } = {}) {
  const limit = Number(limitBytes || STANDARD_RUN_BODY_LIMIT_BYTES);
  const contentLength = Number(req.headers?.['content-length'] || 0);
  assertBodyLimit(contentLength, limit);

  if (Buffer.isBuffer(req.body)) {
    assertBodyLimit(req.body.length, limit);
    return parseJsonText(req.body.toString('utf8'));
  }
  if (typeof req.body === 'string') {
    assertBodyLimit(Buffer.byteLength(req.body, 'utf8'), limit);
    return parseJsonText(req.body);
  }
  if (req.body && typeof req.body === 'object') {
    assertBodyLimit(Buffer.byteLength(JSON.stringify(req.body), 'utf8'), limit);
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    assertBodyLimit(size, limit);
    chunks.push(buffer);
  }
  return parseJsonText(Buffer.concat(chunks).toString('utf8'));
}

function jsonRequestErrorBody(error, fallback = {}) {
  const statusCode = Number(error?.statusCode || error?.status || fallback.statusCode || 500);
  const code = error?.code || fallback.error || (statusCode === 400 ? 'bad_request' : 'request_failed');
  const body = {
    ok: false,
    error: code,
    detail: error instanceof Error ? error.message : String(error || fallback.detail || 'Request failed.')
  };
  if (error?.limitBytes) body.limitBytes = error.limitBytes;
  return { statusCode, body };
}

function sendJsonError(req, res, error, fallback = {}) {
  const { statusCode, body } = jsonRequestErrorBody(error, fallback);
  sendJson(req, res, statusCode, body, fallback.cors || {});
}

function methodGuard(req, res, methods = ['GET']) {
  if (req.method === 'OPTIONS') {
    setCors(req, res, { methods: methods.concat('OPTIONS').join(',') });
    res.status(204).end();
    return false;
  }
  if (!methods.includes(req.method)) {
    sendJson(req, res, 405, { error: 'method_not_allowed' }, { methods: methods.join(',') });
    return false;
  }
  return true;
}

module.exports = {
  allowedOrigins,
  jsonRequestErrorBody,
  malformedJsonError,
  methodGuard,
  parseJsonText,
  readJsonRequest,
  requestBodyTooLargeError,
  sendJson,
  sendJsonError,
  setCors
};
