'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { redact } = require('../../lib/auditStore');

test('audit redaction removes secret-looking values recursively', () => {
  const result = redact({
    token: 'abc',
    nested: {
      compassApiKey: 'secret',
      safe: 'visible'
    },
    rows: [{ password: 'pw' }]
  });
  assert.equal(result.token, '[redacted]');
  assert.equal(result.nested.compassApiKey, '[redacted]');
  assert.equal(result.nested.safe, 'visible');
  assert.equal(result.rows[0].password, '[redacted]');
});
