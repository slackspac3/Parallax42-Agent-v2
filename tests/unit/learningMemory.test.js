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
const { enrichConversationWithServerRetrieval } = require('../../lib/serverSideRetrieval');

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

test('learning retrieval ignores caller-selected tenant scope', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-learning-tenant-'));
  const actorA = { id: 'reviewer-a', authenticated: true, workspaceId: 'workspace-a', projectId: 'project-a' };
  const actorB = { id: 'reviewer-b', authenticated: true, workspaceId: 'workspace-b', projectId: 'project-b' };
  try {
    await withEnv({
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_LEARNING_MEMORY_DIR: dir,
      P42_REFERENCE_CONTEXT_DIR: dir,
      P42_WORKSPACE_ID: '',
      P42_PROJECT_ID: '',
      P42_TRUST_CLIENT_VECTOR_NAMESPACE: '',
      COMPASS_GATEWAY_TOKEN: '',
      PARALLAX42_GATEWAY_TOKEN: '',
      CREWAI_LLM_API_KEY: '',
      OPENAI_API_KEY: '',
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      await recordReviewerFeedback({
        caseId: 'case-a',
        reviewerNotes: 'WORKSPACE A evidence note',
        finalOutcome: 'Workspace A outcome'
      }, { actor: actorA });
      await recordReviewerFeedback({
        caseId: 'case-b',
        reviewerNotes: 'WORKSPACE B CONFIDENTIAL NOTE',
        finalOutcome: 'Workspace B outcome'
      }, { actor: actorB });

      const result = await findSimilarCases({
        caseId: 'new-case',
        brief: 'workspace evidence outcome',
        workspaceId: actorB.workspaceId,
        projectId: actorB.projectId
      }, { actor: actorA });
      const serialized = JSON.stringify(result);

      assert.match(serialized, /WORKSPACE A/);
      assert.doesNotMatch(serialized, /WORKSPACE B CONFIDENTIAL/);

      const enriched = await enrichConversationWithServerRetrieval({
        forceRun: true,
        workspaceId: actorB.workspaceId,
        projectId: actorB.projectId,
        message: 'Review similar workspace evidence outcome controls.',
        caseDraft: {
          caseId: 'conversation-case',
          workspaceId: actorB.workspaceId,
          projectId: actorB.projectId,
          brief: 'Review similar workspace evidence outcome controls.'
        }
      }, { actor: actorA });
      assert.doesNotMatch(JSON.stringify(enriched.caseDraft.retrievalContext), /WORKSPACE B CONFIDENTIAL/);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('qdrant learning search uses query points API and parses result.points', async () => {
  const originalFetch = global.fetch;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-learning-qdrant-query-'));
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_VECTOR_STORE_PROVIDER: 'qdrant',
      QDRANT_URL: 'https://qdrant.example',
      QDRANT_COLLECTION: 'p42_test_collection',
      P42_WORKSPACE_ID: 'workspace-a',
      P42_PROJECT_ID: 'project-a',
      P42_FEATURE_COMPASS_EMBEDDINGS: '1',
      P42_FEATURE_QDRANT_LEARNING_MEMORY: '1',
      P42_ADMIN_FEATURE_CONFIG_DIR: dir
    }, async () => {
      global.fetch = async (url, options = {}) => {
        if (url === 'https://gateway.example/api/embeddings') {
          const body = JSON.parse(options.body);
          assert.equal(body.purpose, 'learning_memory_search');
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'text-embedding-3-large',
              data: [{ embedding: [0.3, 0.2, 0.1] }]
            })
          };
        }
        if (url === 'https://qdrant.example/collections/p42_test_collection/points/query') {
          const body = JSON.parse(options.body);
          assert.deepEqual(body.query, [0.3, 0.2, 0.1]);
          assert.equal(body.vector, undefined);
          assert.equal(body.with_vector, false);
          assert.ok(body.filter.must.some((item) => item.key === 'workspaceId' && item.match.value === 'workspace-a'));
          assert.ok(body.filter.must.some((item) => item.key === 'projectId' && item.match.value === 'project-a'));
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              result: {
                points: [{
                  score: 0.91,
                  payload: {
                    memoryId: 'memory-1',
                    type: 'governed_learning_artifact',
                    artifactType: 'reviewer_feedback',
                    caseId: 'prior-case',
                    workspaceId: 'workspace-a',
                    projectId: 'project-a',
                    reviewerNotes: 'Signed DPA and retention evidence were required.',
                    addedControls: ['Named retention owner'],
                    missingEvidence: ['Signed DPA'],
                    advisoryOnly: true
                  }
                }]
              }
            })
          };
        }
        throw new Error(`Unexpected fetch ${url}`);
      };

      const result = await findSimilarCases({
        caseId: 'new-case',
        brief: 'Review DPA and retention evidence.'
      });

      assert.equal(result.provider, 'qdrant');
      assert.equal(result.similarCases.length, 1);
      assert.equal(result.similarCases[0].memoryId, 'memory-1');
      assert.equal(result.similarCases[0].reviewerNotes, 'Signed DPA and retention evidence were required.');
    });
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
