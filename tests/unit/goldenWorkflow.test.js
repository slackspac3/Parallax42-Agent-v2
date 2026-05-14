'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildGoldenWorkflowRun, evaluateAcceptance } = require('../../lib/goldenWorkflow');

test('golden workflow produces a submission-ready not-ready decision replay', () => {
  const replay = buildGoldenWorkflowRun({ mode: 'test_golden_demo' });

  assert.equal(replay.run.ok, true);
  assert.equal(replay.run.decision.status, 'not_ready');
  assert.equal(replay.evidenceChecklist.highSeverityGapCount >= 3, true);
  assert.equal(replay.evidenceChecklist.humanApprovalRequired, true);
  assert.equal(replay.evidenceChecklist.automaticApprovalBlocked, true);
  assert.equal(replay.evidenceChecklist.traceComplete, true);
  assert.equal(replay.evidenceChecklist.acceptanceStatus, 'passed');
  assert.equal(evaluateAcceptance(replay.run), 'passed');
});
