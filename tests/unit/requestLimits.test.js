'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const { readJsonBody } = require('../../lib/http');
const {
  ADMIN_BODY_LIMIT_BYTES,
  CONVERSATION_BODY_LIMIT_BYTES,
  EVIDENCE_INDEX_BODY_LIMIT_BYTES,
  EVIDENCE_SEARCH_BODY_LIMIT_BYTES,
  REVIEW_PACK_BODY_LIMIT_BYTES,
  STANDARD_RUN_BODY_LIMIT_BYTES
} = require('../../lib/requestLimits');
const {
  readJsonRequest,
  requestBodyTooLargeError,
  sendJsonError
} = require('../../api/_http');

function streamRequest(payload, headers = {}) {
  const stream = Readable.from([payload]);
  stream.headers = headers;
  return stream;
}

function mockResponse() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('request limit defaults match documented JSON boundaries', () => {
  assert.equal(CONVERSATION_BODY_LIMIT_BYTES, 8 * 1024 * 1024);
  assert.equal(EVIDENCE_INDEX_BODY_LIMIT_BYTES, 15 * 1024 * 1024);
  assert.equal(EVIDENCE_SEARCH_BODY_LIMIT_BYTES, 4 * 1024 * 1024);
  assert.equal(REVIEW_PACK_BODY_LIMIT_BYTES, 8 * 1024 * 1024);
  assert.equal(STANDARD_RUN_BODY_LIMIT_BYTES, 8 * 1024 * 1024);
  assert.equal(ADMIN_BODY_LIMIT_BYTES, 512 * 1024);
});

test('request limit env overrides accept byte and mb values', () => {
  const modulePath = require.resolve('../../lib/requestLimits');
  const snapshot = {
    CONVERSATION_BODY_LIMIT_BYTES: process.env.CONVERSATION_BODY_LIMIT_BYTES,
    EVIDENCE_INDEX_BODY_LIMIT_BYTES: process.env.EVIDENCE_INDEX_BODY_LIMIT_BYTES
  };
  process.env.CONVERSATION_BODY_LIMIT_BYTES = '12345';
  process.env.EVIDENCE_INDEX_BODY_LIMIT_BYTES = '2mb';
  delete require.cache[modulePath];
  const reloaded = require('../../lib/requestLimits');

  assert.equal(reloaded.CONVERSATION_BODY_LIMIT_BYTES, 12345);
  assert.equal(reloaded.EVIDENCE_INDEX_BODY_LIMIT_BYTES, 2 * 1024 * 1024);

  if (snapshot.CONVERSATION_BODY_LIMIT_BYTES === undefined) delete process.env.CONVERSATION_BODY_LIMIT_BYTES;
  else process.env.CONVERSATION_BODY_LIMIT_BYTES = snapshot.CONVERSATION_BODY_LIMIT_BYTES;
  if (snapshot.EVIDENCE_INDEX_BODY_LIMIT_BYTES === undefined) delete process.env.EVIDENCE_INDEX_BODY_LIMIT_BYTES;
  else process.env.EVIDENCE_INDEX_BODY_LIMIT_BYTES = snapshot.EVIDENCE_INDEX_BODY_LIMIT_BYTES;
  delete require.cache[modulePath];
  require('../../lib/requestLimits');
});

test('local readJsonBody marks oversized requests as 413 JSON-safe errors', async () => {
  await assert.rejects(
    readJsonBody(streamRequest('{"value":"too large"}'), { limitBytes: 4 }),
    (error) => {
      assert.equal(error.code, 'request_body_too_large');
      assert.equal(error.statusCode, 413);
      assert.equal(error.limitBytes, 4);
      return true;
    }
  );
});

test('local readJsonBody marks malformed JSON as a 400 JSON-safe error', async () => {
  await assert.rejects(
    readJsonBody(streamRequest('{not-json'), { limitBytes: 100 }),
    (error) => {
      assert.equal(error.code, 'malformed_json');
      assert.equal(error.statusCode, 400);
      return true;
    }
  );
});

test('Vercel readJsonRequest enforces explicit body limits', async () => {
  await assert.rejects(
    readJsonRequest({ body: '{"value":"too large"}', headers: {} }, { limitBytes: 8 }),
    (error) => {
      assert.equal(error.code, 'request_body_too_large');
      assert.equal(error.statusCode, 413);
      assert.equal(error.limitBytes, 8);
      return true;
    }
  );
});

test('Vercel readJsonRequest reports malformed JSON safely', async () => {
  await assert.rejects(
    readJsonRequest({ body: '{not-json', headers: {} }, { limitBytes: 100 }),
    (error) => {
      assert.equal(error.code, 'malformed_json');
      assert.equal(error.statusCode, 400);
      return true;
    }
  );
});

test('sendJsonError returns structured oversized JSON responses', () => {
  const req = { headers: { origin: 'http://127.0.0.1:3020' } };
  const res = mockResponse();

  sendJsonError(req, res, requestBodyTooLargeError(16));

  assert.equal(res.statusCode, 413);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'request_body_too_large');
  assert.equal(res.body.limitBytes, 16);
});
