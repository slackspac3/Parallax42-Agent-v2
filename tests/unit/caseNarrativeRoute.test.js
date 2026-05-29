'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const caseNarrativeHandler = require('../../api/case/narrative');

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
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
    },
    end(body) {
      this.body = body;
      return this;
    }
  };
}

async function withEnv(overrides, fn) {
  const snapshot = {};
  for (const key of Object.keys(overrides)) {
    snapshot[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    await fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  }
}

test('case narrative endpoint requires agent authorization when auth is enforced', async () => {
  await withEnv({ P42_AUTH_MODE: 'enforced' }, async () => {
    const res = mockResponse();
    await caseNarrativeHandler({
      method: 'POST',
      headers: {},
      body: { run: { ok: true } }
    }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'authentication_required');
  });
});
