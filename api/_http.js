'use strict';

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

function setCors(req, res, { methods = 'GET,POST,OPTIONS', headers = 'accept,content-type,x-p42-demo-token,x-parallax42-demo-token' } = {}) {
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

async function readJsonRequest(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
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
  methodGuard,
  readJsonRequest,
  sendJson,
  setCors
};
