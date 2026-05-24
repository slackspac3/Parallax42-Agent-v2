'use strict';

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

function readJsonBody(req, { limitBytes = 1_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    function fail(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }

    const contentLength = Number(req.headers?.['content-length'] || 0);
    if (Number.isFinite(contentLength) && contentLength > limitBytes) {
      fail(requestBodyTooLargeError(limitBytes));
      req.destroy();
      return;
    }

    req.on('data', (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > limitBytes) {
        fail(requestBodyTooLargeError(limitBytes));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      if (settled) return;
      try {
        const parsed = parseJsonText(Buffer.concat(chunks).toString('utf8'));
        settled = true;
        resolve(parsed);
      } catch (error) {
        fail(error);
      }
    });
    req.on('error', (error) => {
      if (!settled) fail(error);
    });
  });
}

function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

module.exports = {
  malformedJsonError,
  parseJsonText,
  readJsonBody,
  requestBodyTooLargeError,
  writeJson
};
