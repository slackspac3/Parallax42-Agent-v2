'use strict';

const { runBenchmark } = require('../lib/benchmarkSuite');

const report = runBenchmark();
if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`benchmark: ${report.summary.passed}/${report.summary.cases} passed (${Math.round(report.summary.passRate * 100)}%)\n`);
  process.stdout.write(`p95 local duration: ${report.summary.p95DurationMs} ms\n`);
}

process.exit(report.summary.failed === 0 ? 0 : 1);
