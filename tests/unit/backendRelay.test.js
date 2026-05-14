'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { isRouteAllowed, normaliseRelayPath, relayPath, routeKey } = require('../../api/_backendRelay');

test('backend relay only allows explicit demo routes', () => {
  assert.equal(isRouteAllowed('GET', '/health'), true);
  assert.equal(isRouteAllowed('POST', '/run'), true);
  assert.equal(isRouteAllowed('GET', '/admin/config'), false);
  assert.equal(isRouteAllowed('POST', '/knowledge/private/upload'), false);
});

test('backend relay normalises paths safely', () => {
  assert.equal(normaliseRelayPath('health'), '/health');
  assert.equal(normaliseRelayPath('/run'), '/run');
  assert.equal(routeKey('post', '/run?x=1'), 'POST /run');
});

test('backend relay preserves non-path query parameters', () => {
  const req = {
    url: '/api/backend?path=/case/assist/upload/status&uploadId=abc123',
    headers: { host: 'example.test' },
    query: { path: '/case/assist/upload/status', uploadId: 'abc123' }
  };

  assert.equal(relayPath(req), '/case/assist/upload/status?uploadId=abc123');
});
