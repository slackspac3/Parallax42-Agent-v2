'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkRateLimit, resetRateLimiter } = require('../../lib/rateLimiter');

function req(ip = '203.0.113.10') {
  return {
    headers: { 'x-forwarded-for': ip },
    socket: { remoteAddress: '127.0.0.1' }
  };
}

test('rate limiter blocks after policy max within a window', () => {
  resetRateLimiter();
  const first = checkRateLimit(req(), 'conversation', { max: 2, windowMs: 60_000 });
  const second = checkRateLimit(req(), 'conversation', { max: 2, windowMs: 60_000 });
  const third = checkRateLimit(req(), 'conversation', { max: 2, windowMs: 60_000 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);
  assert.equal(third.statusCode, 429);
  assert.equal(third.body.error, 'rate_limited');
  resetRateLimiter();
});

test('rate limiter isolates clients by forwarded address', () => {
  resetRateLimiter();
  assert.equal(checkRateLimit(req('203.0.113.10'), 'evidenceIndex', { max: 1, windowMs: 60_000 }).ok, true);
  assert.equal(checkRateLimit(req('203.0.113.10'), 'evidenceIndex', { max: 1, windowMs: 60_000 }).ok, false);
  assert.equal(checkRateLimit(req('203.0.113.11'), 'evidenceIndex', { max: 1, windowMs: 60_000 }).ok, true);
  resetRateLimiter();
});
