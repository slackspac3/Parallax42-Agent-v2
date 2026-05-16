'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findSimilarCases,
  getControlSuggestions,
  learningMemoryHealth,
  recordReviewerFeedback
} = require('../../lib/learningMemory');

function withEnv(overrides, fn) {
  const snapshot = {};
  for (const key of Object.keys(overrides)) {
    snapshot[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        if (snapshot[key] === undefined) delete process.env[key];
        else process.env[key] = snapshot[key];
      }
    });
}

test('governed learning memory stores reviewer feedback locally as advisory artifacts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-learning-'));
  try {
    await withEnv({
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_LEARNING_MEMORY_DIR: dir,
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      const result = await recordReviewerFeedback({
        caseId: 'case-learning-1',
        originalDecision: 'Conditional approval',
        reviewerDecision: 'Not ready',
        reviewerNotes: 'Reviewer added a named data deletion control and rejected unsigned DPA evidence.',
        addedControls: ['Named deletion owner', 'Subprocessor approval before go-live'],
        rejectedEvidence: ['Unsigned DPA'],
        missingEvidence: ['Signed DPA', 'Retention schedule'],
        finalOutcome: 'Blocked pending signed DPA'
      }, {
        actor: { id: 'reviewer@example.com', roles: ['compliance_reviewer'], authenticated: true }
      });

      assert.equal(result.ok, true);
      assert.equal(result.provider, 'local_file');
      assert.ok(result.artifacts.length >= 4);
      assert.equal(result.artifacts[0].advisoryOnly, true);
      assert.equal(learningMemoryHealth().trainingUse, 'not_model_training');
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('governed learning returns similar cases and control suggestions without changing decisions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-learning-similar-'));
  try {
    await withEnv({
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_LEARNING_MEMORY_DIR: dir,
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      await recordReviewerFeedback({
        caseId: 'prior-healthcare-analytics',
        originalDecision: 'Conditional approval',
        reviewerDecision: 'Conditional approval',
        reviewerNotes: 'Healthcare analytics vendor with patient data required signed DPA and data residency confirmation.',
        addedControls: ['Data residency confirmation', 'Named clinical data owner'],
        missingEvidence: ['Signed DPA', 'Transfer impact assessment'],
        finalOutcome: 'Approved after DPA'
      });

      const similar = await findSimilarCases({
        caseId: 'new-healthcare-analytics',
        brief: 'Assess healthcare analytics vendor using patient data and cross-border cloud processing.',
        riskSignals: ['personal data', 'cross-border transfer']
      });
      const suggestions = await getControlSuggestions({
        caseId: 'new-healthcare-analytics',
        brief: 'Assess healthcare analytics vendor using patient data and cross-border cloud processing.'
      });

      assert.equal(similar.advisoryOnly, true);
      assert.equal(similar.similarCases.length > 0, true);
      assert.equal(suggestions.advisoryOnly, true);
      assert.ok(suggestions.commonControlsReviewersAdded.some((item) => item.control === 'Data residency confirmation'));
      assert.ok(suggestions.repeatedMissingEvidencePatterns.some((item) => item.evidence === 'Signed DPA'));
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
