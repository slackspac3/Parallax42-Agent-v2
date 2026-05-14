'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runBenchmark } = require('../../lib/benchmarkSuite');

test('benchmark report exposes pass rate and timing summary', () => {
  const report = runBenchmark();
  assert.equal(report.summary.cases, 4);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.passRate, 1);
  assert.ok(report.summary.p95DurationMs >= 0);
  assert.equal(report.results.every((item) => item.passed), true);
});
