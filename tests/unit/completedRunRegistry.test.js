'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCompletedRunRegistry() {
  const window = { P42ModuleRegistry: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'modules', 'completedRunRegistry.js'), 'utf8');
  vm.runInNewContext(source, { window });
  return window.P42ModuleRegistry.completedRunRegistry;
}

test('selectLatestCompletedRun prefers requested mode before global latest', () => {
  const registry = loadCompletedRunRegistry();
  const demo = { ok: true, mode: 'demo' };
  const live = { ok: true, mode: 'live' };
  const chat = { ok: true, mode: 'chat' };

  const selected = registry.selectLatestCompletedRun({
    lastRuns: { demo, live, chat },
    latestCompletedRun: live,
    lastRun: demo
  }, 'demo');

  assert.equal(selected, demo);
});

test('selectLatestCompletedRun falls back through latest, chat, live, demo, then lastRun', () => {
  const registry = loadCompletedRunRegistry();
  const demo = { ok: true, mode: 'demo' };
  const live = { ok: true, mode: 'live' };
  const chat = { ok: true, mode: 'chat' };
  const lastRun = { ok: true, mode: 'last' };

  assert.equal(registry.selectLatestCompletedRun({
    lastRuns: { demo, live, chat },
    latestCompletedRun: live,
    lastRun
  }, 'missing'), live);

  assert.equal(registry.selectLatestCompletedRun({
    lastRuns: { demo, live, chat },
    latestCompletedRun: null,
    lastRun
  }, 'missing'), chat);

  assert.equal(registry.selectLatestCompletedRun({
    lastRuns: { demo, live: { ok: false }, chat: null },
    latestCompletedRun: null,
    lastRun
  }, 'missing'), demo);

  assert.equal(registry.selectLatestCompletedRun({
    lastRuns: { demo: null, live: null, chat: null },
    latestCompletedRun: null,
    lastRun
  }, 'missing'), lastRun);
});

test('selectLatestCompletedRun ignores failed or missing runs', () => {
  const registry = loadCompletedRunRegistry();

  assert.equal(registry.selectLatestCompletedRun({
    lastRuns: { demo: { ok: false }, live: null, chat: null },
    latestCompletedRun: { ok: false },
    lastRun: { ok: false }
  }, 'demo'), null);
});
