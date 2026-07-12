'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { CASE_STATES, beginCouncil, completeCouncil, createDemoCase, getCase, saveCaseDraft } = require('../../lib/caseLifecycle');
const { handleCaseApproval } = require('../../lib/caseApproval');
const { handleAgentRun, handleConversation } = require('../../lib/httpHandlers');
const { fixtureDocumentSummary } = require('../../lib/fixtureDocuments');
const { authenticateRequest } = require('../../lib/rbac');
const {
  authenticateSessionToken,
  canonicalDemoFixtureDocuments,
  consumeQuota,
  createDemoSession,
  exchangeAccessCode,
  isDemoFixtureEvidence
} = require('../../lib/sessionService');

function isolatedStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-session-test-'));
  const previous = {
    P42_RECORD_STORE_PATH: process.env.P42_RECORD_STORE_PATH,
    P42_AUTH_MODE: process.env.P42_AUTH_MODE,
    P42_PILOT_ACCESS_CODES: process.env.P42_PILOT_ACCESS_CODES,
    P42_PILOT_ROLES: process.env.P42_PILOT_ROLES,
    P42_DEMO_BEARER_TOKEN: process.env.P42_DEMO_BEARER_TOKEN,
    P42_DEMO_ROLES: process.env.P42_DEMO_ROLES,
    P42_WORKSPACE_ID: process.env.P42_WORKSPACE_ID,
    DATABASE_URL: process.env.DATABASE_URL,
    P42_DATABASE_URL: process.env.P42_DATABASE_URL
  };
  process.env.P42_RECORD_STORE_PATH = path.join(root, 'records.json');
  process.env.P42_AUTH_MODE = 'enforced';
  delete process.env.DATABASE_URL;
  delete process.env.P42_DATABASE_URL;
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(root, { recursive: true, force: true });
  };
}

test('demo sessions are isolated and quota bounded', async () => {
  const cleanup = isolatedStore();
  try {
    const first = await createDemoSession();
    const second = await createDemoSession();
    assert.equal(first.capabilities.liveCompassRequired, false);
    assert.equal(typeof first.capabilities.liveCompassConfigured, 'boolean');
    assert.equal(first.capabilities.sampleEvidence, true);
    const actor = await authenticateSessionToken(first.token);
    assert.equal(actor.workspaceId, first.workspaceId);
    assert.notEqual(first.workspaceId, second.workspaceId);
    for (let index = 0; index < first.limits.councilRuns; index += 1) {
      await consumeQuota(actor, 'councilRuns');
    }
    await assert.rejects(() => consumeQuota(actor, 'councilRuns'), { code: 'demo_quota_exhausted' });

    const parallel = await createDemoSession();
    const parallelActor = await authenticateSessionToken(parallel.token);
    const attempts = await Promise.allSettled(Array.from({ length: 10 }, () => consumeQuota(parallelActor, 'councilRuns')));
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, parallel.limits.councilRuns);
    const refreshed = await authenticateSessionToken(parallel.token);
    assert.equal(refreshed.usage.councilRuns, parallel.limits.councilRuns);
  } finally {
    cleanup();
  }
});

test('configured pilot access codes are single use', async () => {
  const cleanup = isolatedStore();
  try {
    process.env.P42_PILOT_ACCESS_CODES = 'pilot-code-for-test-12345';
    process.env.P42_PILOT_ROLES = 'Business Approver,Compliance Reviewer';
    const attempts = await Promise.allSettled([
      exchangeAccessCode('pilot-code-for-test-12345'),
      exchangeAccessCode('pilot-code-for-test-12345'),
      exchangeAccessCode('pilot-code-for-test-12345')
    ]);
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    const session = attempts.find((result) => result.status === 'fulfilled').value;
    const actor = await authenticateSessionToken(session.token);
    assert.equal(actor.sessionType, 'pilot');
    assert.ok(actor.roles.includes('business_approver'));
    await assert.rejects(() => exchangeAccessCode('pilot-code-for-test-12345'), { code: 'invalid_access_code' });
  } finally {
    cleanup();
  }
});

test('case approval is a versioned workspace-scoped lifecycle transition', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const created = await createDemoCase(actor, '02_data_processing_addendum_and_cross_border_terms.pdf');
    const foreignSession = await createDemoSession();
    const foreignActor = await authenticateSessionToken(foreignSession.token);
    assert.equal(await getCase(foreignActor, created.case.caseId), null);

    await beginCouncil(actor, created.case.caseId, created.case.version);
    const ready = await completeCouncil(actor, {
      ok: true,
      runId: 'run-test-1',
      case: { caseId: created.case.caseId },
      decision: { status: 'ready', recommendation: 'Ready for human approval', approvalEligible: true },
      decisionReadiness: { approvalEligible: true },
      evidenceIds: created.case.evidenceIds
    });
    assert.equal(ready.state, CASE_STATES.REVIEW_READY);

    const response = await handleCaseApproval({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        caseId: created.case.caseId,
        caseVersion: ready.version,
        reviewerDecision: 'Approve',
        reviewerNotes: 'Approved for the demo after reviewing the council output.'
      }
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, CASE_STATES.APPROVED);
    assert.ok(response.body.caseVersion > ready.version);

    const retry = await handleCaseApproval({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        caseId: created.case.caseId,
        caseVersion: ready.version,
        reviewerDecision: 'Approve',
        reviewerNotes: 'Approved for the demo after reviewing the council output.'
      }
    });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.idempotent, true);
    assert.equal(retry.body.caseVersion, response.body.caseVersion);

    const conflictingRetry = await handleCaseApproval({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        caseId: created.case.caseId,
        caseVersion: response.body.caseVersion,
        reviewerDecision: 'Approve',
        reviewerNotes: 'Different notes must not create a conflicting audit event.'
      }
    });
    assert.equal(conflictingRetry.status, 409);
    assert.equal(conflictingRetry.body.error, 'case_already_decided');

    const ambiguousNegative = await handleCaseApproval({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        caseId: created.case.caseId,
        caseVersion: response.body.caseVersion,
        reviewerDecision: 'Not approved',
        reviewerNotes: 'This phrase must never be interpreted as an approval.'
      }
    });
    assert.equal(ambiguousNegative.status, 400);
    assert.equal(ambiguousNegative.body.error, 'invalid_reviewer_decision');
  } finally {
    cleanup();
  }
});

test('not-ready cases require remediation before human approval', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const created = await createDemoCase(actor, '03_ai_accelerator_chip_import_export_control_agreement.pdf');
    await beginCouncil(actor, created.case.caseId, created.case.version);
    const readyForReview = await completeCouncil(actor, {
      ok: true,
      runId: 'run-not-ready-approval-boundary',
      case: { caseId: created.case.caseId },
      decision: { status: 'not_ready', recommendation: 'Do not approve yet', readinessScore: 0.32 },
      decisionReadiness: { approvalEligible: false },
      evidenceIds: created.case.evidenceIds
    });

    const approval = await handleCaseApproval({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        caseId: created.case.caseId,
        caseVersion: readyForReview.version,
        reviewerDecision: 'Approve',
        reviewerNotes: 'This must be rejected because the deterministic council marked the case not ready.'
      }
    });
    assert.equal(approval.status, 409);
    assert.equal(approval.body.error, 'case_not_approval_eligible');

    const remediation = await handleCaseApproval({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        caseId: created.case.caseId,
        caseVersion: readyForReview.version,
        reviewerDecision: 'Request remediation',
        reviewerNotes: 'Close the six export-control proof gaps before rerunning the council.'
      }
    });
    assert.equal(remediation.status, 200);
    assert.equal(remediation.body.status, CASE_STATES.REJECTED);
  } finally {
    cleanup();
  }
});

test('conditionally-ready cases cannot be recorded as terminal approval', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const created = await createDemoCase(actor, '02_data_processing_addendum_and_cross_border_terms.pdf');
    await beginCouncil(actor, created.case.caseId, created.case.version);
    const review = await completeCouncil(actor, {
      ok: true,
      runId: 'run-conditional-approval-boundary',
      case: { caseId: created.case.caseId },
      decision: { status: 'conditionally_ready', recommendation: 'Continue review with named controls', approvalEligible: false },
      decisionReadiness: { approvalEligible: false },
      evidenceIds: created.case.evidenceIds
    });

    const response = await handleCaseApproval({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        caseId: created.case.caseId,
        caseVersion: review.version,
        reviewerDecision: 'Approve',
        reviewerNotes: 'A medium condition must be closed and the council rerun first.'
      }
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.error, 'case_not_approval_eligible');
  } finally {
    cleanup();
  }
});

test('decision payload cannot override a non-eligible readiness contract', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const created = await createDemoCase(actor, '02_data_processing_addendum_and_cross_border_terms.pdf');
    await beginCouncil(actor, created.case.caseId, created.case.version);
    const review = await completeCouncil(actor, {
      ok: true,
      runId: 'run-conflicting-approval-boundary',
      case: { caseId: created.case.caseId },
      decision: { status: 'ready', recommendation: 'Ready for human approval', approvalEligible: true },
      decisionReadiness: { approvalEligible: false },
      evidenceIds: created.case.evidenceIds
    });

    const response = await handleCaseApproval({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        caseId: created.case.caseId,
        caseVersion: review.version,
        reviewerDecision: 'Approve',
        reviewerNotes: 'A contradictory advisory field must not override the readiness gate.'
      }
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.error, 'case_not_approval_eligible');
  } finally {
    cleanup();
  }
});

test('a session council run persists review-ready state and returns its version', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const created = await createDemoCase(actor, '03_ai_accelerator_chip_import_export_control_agreement.pdf');
    const response = await handleAgentRun({
      req: {
        headers: {
          authorization: `Bearer ${session.token}`,
          'x-agent-runtime': 'deterministic'
        }
      },
      body: {
        caseDraft: { ...created.case, documents: [created.fixture.evidence] },
        caseVersion: created.case.version,
        runtime: 'deterministic'
      }
    });
    assert.equal(response.status, 200);
    assert.ok(Number(response.body.caseVersion) > created.case.version);
    const stored = await getCase(actor, created.case.caseId);
    assert.equal(stored.state, CASE_STATES.REVIEW_READY);
    assert.equal(stored.version, response.body.caseVersion);
  } finally {
    cleanup();
  }
});

test('council execution is exclusive and failed runs cannot become review-ready', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const created = await createDemoCase(actor, '03_ai_accelerator_chip_import_export_control_agreement.pdf');
    const attempts = await Promise.allSettled([
      beginCouncil(actor, created.case.caseId, created.case.version),
      beginCouncil(actor, created.case.caseId, created.case.version)
    ]);
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);

    const failed = await completeCouncil(actor, {
      ok: false,
      case: { caseId: created.case.caseId },
      message: 'The council was blocked before producing a decision.'
    });
    assert.equal(failed.state, CASE_STATES.EVIDENCE_READY);
    assert.equal(failed.decision, null);

    const approval = await handleCaseApproval({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        caseId: created.case.caseId,
        caseVersion: failed.version,
        reviewerDecision: 'Approve',
        reviewerNotes: 'A failed run must not be approvable.'
      }
    });
    assert.equal(approval.status, 409);
    assert.equal(approval.body.error, 'case_not_review_ready');
  } finally {
    cleanup();
  }
});

test('draft persistence enforces optimistic versions and fixture identity', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const created = await createDemoCase(actor, '02_data_processing_addendum_and_cross_border_terms.pdf');
    assert.equal(isDemoFixtureEvidence({ documents: [created.fixture.evidence] }), true);
    const alteredFixture = {
      ...created.fixture.evidence,
      summary: 'Client-altered private content must never be indexed for the public demo.',
      text: 'Client-altered private content must never be indexed for the public demo.'
    };
    assert.equal(isDemoFixtureEvidence({ documents: [alteredFixture] }), true);
    const canonical = canonicalDemoFixtureDocuments({ documents: [alteredFixture] });
    assert.equal(canonical[0].summary, created.fixture.evidence.summary);
    assert.equal(canonical[0].text, created.fixture.evidence.text);
    assert.doesNotMatch(canonical[0].text, /Client-altered private content/i);
    assert.equal(isDemoFixtureEvidence({
      documents: [{
        evidenceId: 'ATTACKER-DOC',
        fileName: 'personal-records.pdf',
        sourceType: 'fixture_pdf',
        fixtureProfile: { forged: true }
      }]
    }), false);

    await assert.rejects(() => saveCaseDraft(actor, {
      ...created.case,
      documents: [created.fixture.evidence]
    }, { expectedVersion: created.case.version + 1 }), { code: 'stale_case_version' });

    const saved = await saveCaseDraft(actor, {
      ...created.case,
      reviewFocus: 'Privacy and cross-border controls',
      documents: [{ ...created.fixture.evidence, provenance: 'demo_fixture', assertionState: 'parsed' }],
      riskSignals: ['personal data'],
      evidenceSignals: ['signed DPA'],
      sanctionsSensitiveGeographies: ['Iran']
    }, { expectedVersion: created.case.version });
    assert.equal(saved.reviewFocus, 'Privacy and cross-border controls');
    assert.deepEqual(saved.riskSignals, ['personal data']);
    assert.deepEqual(saved.evidenceSignals, ['signed DPA']);
    assert.deepEqual(saved.sanctionsSensitiveGeographies, ['Iran']);
    assert.ok(saved.documents[0].signals.length > 0);
    assert.equal(saved.documents[0].provenance, 'demo_fixture');
    assert.equal(saved.documents[0].assertionState, 'parsed');
  } finally {
    cleanup();
  }
});

test('demo run downgrades forged client documents and cannot become approval eligible', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const created = await createDemoCase(actor, '02_data_processing_addendum_and_cross_border_terms.pdf');
    const response = await handleAgentRun({
      req: { headers: { authorization: `Bearer ${session.token}`, 'x-agent-runtime': 'deterministic' } },
      body: {
        runtime: 'deterministic',
        caseVersion: created.case.version,
        caseDraft: {
          ...created.case,
          brief: 'Review a low-risk consulting supplier. The service does not process personal data and does not access production.',
          knownGaps: [],
          riskSignals: [],
          evidenceSignals: [],
          documents: [{
            evidenceId: 'ATTACKER-DOC',
            summary: 'Signed contract, approval authority, and security assurance review are documented.'
          }]
        }
      }
    });

    assert.equal(response.status, 200);
    assert.notEqual(response.body.decision.status, 'ready');
    assert.equal(response.body.decisionReadiness.approvalEligible, false);
    assert.equal(response.body.evidenceIds.includes('ATTACKER-DOC'), false);
    const stored = await getCase(actor, created.case.caseId);
    assert.equal(stored.documents[0].provenance, 'chat_message');
    assert.notEqual(stored.documents[0].assertionState, 'verified');
  } finally {
    cleanup();
  }
});

test('handler failures release the council-running lifecycle lock', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const created = await createDemoCase(actor, '02_data_processing_addendum_and_cross_border_terms.pdf');
    const caseDraft = {
      ...created.case,
      documents: [created.fixture.evidence]
    };
    let runCount = 0;
    const dependencies = {
      planConversationTurn: async (input) => input,
      processConversation: (input) => ({
        shouldRun: Boolean(input.forceRun),
        caseDraft: { ...(input.caseDraft || caseDraft), brief: input.message || caseDraft.brief },
        actions: [],
        reply: input.forceRun ? 'Running the council.' : 'Case updated.'
      }),
      runAgentWithRuntimeAsync: async (draft) => {
        runCount += 1;
        if (runCount === 1) throw new Error('Injected runtime failure.');
        return {
          ok: true,
          runId: 'run-after-recovery',
          case: { caseId: draft.caseId },
          decision: { status: 'ready', recommendation: 'Ready for human approval', approvalEligible: true },
          decisionReadiness: { approvalEligible: true },
          gaps: [],
          evidenceIds: draft.evidenceIds || [],
          trace: []
        };
      },
      appendAuditRecord: () => {}
    };
    const response = await handleConversation({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        forceRun: true,
        message: 'run it',
        caseVersion: created.case.version,
        caseDraft
      },
      dependencies
    });

    assert.equal(response.status, 400);
    const stored = await getCase(actor, created.case.caseId);
    assert.equal(stored.state, CASE_STATES.EVIDENCE_READY);
    assert.ok(stored.councilFailedAt);
    assert.equal(response.body.caseDraft.caseVersion, stored.version);

    const followUp = await handleConversation({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        message: 'Keep the case open while the runtime recovers.',
        caseDraft: response.body.caseDraft
      },
      dependencies
    });
    assert.equal(followUp.status, 200);
    assert.ok(followUp.body.caseDraft.caseVersion > response.body.caseDraft.caseVersion);

    const rerun = await handleConversation({
      req: { headers: { authorization: `Bearer ${session.token}` } },
      body: {
        forceRun: true,
        message: 'rerun council',
        caseDraft: followUp.body.caseDraft
      },
      dependencies
    });
    assert.equal(rerun.status, 200);
    assert.equal(rerun.body.run.ok, true);
    assert.equal(rerun.body.caseDraft.caseVersion, rerun.body.completedCase.version);
  } finally {
    cleanup();
  }
});

test('post-council audit failure returns the authoritative version for continuation', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const req = { headers: { authorization: `Bearer ${session.token}`, 'x-agent-runtime': 'deterministic' } };
    let runCount = 0;
    const baseDependencies = {
      planConversationTurn: async (input) => input,
      processConversation: (input) => ({
        shouldRun: Boolean(input.forceRun),
        caseDraft: {
          ...(input.caseDraft || {}),
          supplierName: 'Audit Recovery Supplier',
          businessUnit: 'Procurement',
          geography: 'UAE',
          brief: input.message || input.caseDraft?.brief || 'Review the supplier.'
        },
        actions: [],
        reply: input.forceRun ? 'Running the council.' : 'Case updated.'
      }),
      runAgentWithRuntimeAsync: async (draft) => ({
        ok: true,
        runId: `audit-recovery-${++runCount}`,
        case: { caseId: draft.caseId },
        decision: { status: 'ready', recommendation: 'Ready for human approval', approvalEligible: true },
        decisionReadiness: { approvalEligible: true },
        gaps: [],
        evidenceIds: [],
        trace: []
      })
    };
    const intake = await handleConversation({
      req,
      body: { message: 'Review the supplier.', caseDraft: {} },
      dependencies: { ...baseDependencies, appendAuditRecord: () => {} }
    });
    const failedResponse = await handleConversation({
      req,
      body: { forceRun: true, message: 'run it', caseDraft: intake.body.caseDraft },
      dependencies: {
        ...baseDependencies,
        appendAuditRecord: async () => { throw new Error('Injected audit failure.'); }
      }
    });
    assert.equal(failedResponse.status, 400);
    assert.ok(failedResponse.body.caseDraft.caseVersion > intake.body.caseDraft.caseVersion);

    const followUp = await handleConversation({
      req,
      body: { message: 'Continue from the recovered version.', caseDraft: failedResponse.body.caseDraft },
      dependencies: { ...baseDependencies, appendAuditRecord: () => {} }
    });
    assert.equal(followUp.status, 200);
    assert.ok(followUp.body.caseDraft.caseVersion > failedResponse.body.caseDraft.caseVersion);

    const rerun = await handleConversation({
      req,
      body: { forceRun: true, message: 'rerun council', caseDraft: followUp.body.caseDraft },
      dependencies: { ...baseDependencies, appendAuditRecord: () => {} }
    });
    assert.equal(rerun.status, 200);
    assert.equal(rerun.body.caseDraft.caseVersion, rerun.body.completedCase.version);
  } finally {
    cleanup();
  }
});

test('conversation keeps the completed case version through a follow-up and second council run', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const req = { headers: { authorization: `Bearer ${session.token}`, 'x-agent-runtime': 'deterministic' } };
    let runCount = 0;
    const dependencies = {
      planConversationTurn: async (input) => input,
      processConversation: (input) => ({
        shouldRun: Boolean(input.forceRun),
        caseDraft: {
          ...(input.caseDraft || {}),
          supplierName: 'Versioned Supplier',
          businessUnit: 'Procurement',
          geography: 'UAE',
          brief: input.message || input.caseDraft?.brief || 'Review the supplier.'
        },
        actions: [],
        reply: input.forceRun ? 'Running the council.' : 'Case updated.'
      }),
      runAgentWithRuntimeAsync: async (caseDraft) => ({
        ok: true,
        runId: `run-version-${++runCount}`,
        case: { caseId: caseDraft.caseId },
        decision: { status: 'ready', recommendation: 'Ready for human approval' },
        decisionReadiness: { approvalEligible: true },
        gaps: [],
        evidenceIds: [],
        trace: []
      }),
      appendAuditRecord: () => {}
    };

    const intake = await handleConversation({
      req,
      body: { message: 'Review the supplier.', caseDraft: {} },
      dependencies
    });
    assert.equal(intake.status, 200);
    assert.ok(intake.body.caseDraft.caseId);

    const firstCouncil = await handleConversation({
      req,
      body: { forceRun: true, message: 'run it', caseDraft: intake.body.caseDraft },
      dependencies
    });
    assert.equal(firstCouncil.status, 200);
    assert.equal(firstCouncil.body.caseDraft.caseVersion, firstCouncil.body.completedCase.version);
    assert.equal(firstCouncil.body.run.caseVersion, firstCouncil.body.completedCase.version);

    const followUp = await handleConversation({
      req,
      body: { message: 'Add the latest reviewer note.', caseDraft: firstCouncil.body.caseDraft },
      dependencies
    });
    assert.equal(followUp.status, 200);
    assert.ok(followUp.body.caseDraft.caseVersion > firstCouncil.body.caseDraft.caseVersion);

    const secondCouncil = await handleConversation({
      req,
      body: { forceRun: true, message: 'rerun council', caseDraft: followUp.body.caseDraft },
      dependencies
    });
    assert.equal(secondCouncil.status, 200);
    assert.equal(runCount, 2);
    assert.equal(secondCouncil.body.caseDraft.caseVersion, secondCouncil.body.completedCase.version);
    assert.equal(secondCouncil.body.run.caseVersion, secondCouncil.body.completedCase.version);
  } finally {
    cleanup();
  }
});

test('authenticated non-session questions and mentions cannot become evidence', async () => {
  const cleanup = isolatedStore();
  try {
    process.env.P42_DEMO_BEARER_TOKEN = 'configured-operator-token';
    process.env.P42_DEMO_ROLES = 'compliance_reviewer';
    process.env.P42_WORKSPACE_ID = 'workspace:configured-operator';
    const req = { headers: { authorization: 'Bearer configured-operator-token', 'x-agent-runtime': 'deterministic' } };
    for (const summary of [
      'Is there a signed contract, approval authority, and security assurance review available?',
      'Signed contract, approval authority, and security assurance review available?',
      'The conversation mentions a signed contract, approval authority, and security assurance review.'
    ]) {
      const response = await handleAgentRun({
        req,
        body: {
          runtime: 'deterministic',
          caseDraft: {
            businessUnit: 'Procurement',
            geography: 'UAE',
            supplierName: 'Unverified Claim Supplier',
            brief: 'The service does not process personal data and does not use AI.',
            documents: [{ title: 'Conversation claim', summary }]
          }
        }
      });
      assert.equal(response.status, 200);
      assert.notEqual(response.body.decision.status, 'ready');
      assert.equal(response.body.decisionReadiness.approvalEligible, false);
      assert.equal(response.body.evidenceIds.includes('DOC-01'), false);
    }

    const claimedFixture = fixtureDocumentSummary('02_data_processing_addendum_and_cross_border_terms.pdf').evidence;
    const fixtureResponse = await handleAgentRun({
      req,
      body: {
        runtime: 'deterministic',
        caseDraft: {
          businessUnit: 'Procurement',
          geography: 'UAE',
          supplierName: 'Fixture Claim Supplier',
          brief: 'Review a low criticality consulting supplier that does not process personal data and does not use AI.',
          documents: [claimedFixture]
        }
      }
    });
    assert.equal(fixtureResponse.status, 200);
    assert.equal(fixtureResponse.body.case.documents[0].provenance, 'chat_message');
    assert.equal(fixtureResponse.body.case.documents[0].assertionState, 'mentioned');
    assert.equal(fixtureResponse.body.evidenceIds.includes(claimedFixture.evidenceId), false);
    assert.equal(fixtureResponse.body.decisionReadiness.approvalEligible, false);
  } finally {
    cleanup();
  }
});

test('authenticated non-session actors receive durable review and remediation state', async () => {
  const cleanup = isolatedStore();
  try {
    process.env.P42_DEMO_BEARER_TOKEN = 'configured-operator-token';
    process.env.P42_DEMO_ROLES = 'compliance_reviewer';
    process.env.P42_WORKSPACE_ID = 'workspace:configured-operator';
    const req = { headers: { authorization: 'Bearer configured-operator-token', 'x-agent-runtime': 'deterministic' } };
    const run = await handleAgentRun({
      req,
      body: {
        runtime: 'deterministic',
        caseDraft: {
          businessUnit: 'Procurement',
          geography: 'UAE',
          supplierName: 'Durable Supplier',
          brief: 'Review a low-risk consulting supplier. The service does not process personal data and does not access production.',
          documents: [{
            evidenceId: 'DOC-DURABLE-1',
            title: 'Compliance pack',
            summary: 'Signed contract, security assurance, and no personal data processing statement are attached.'
          }]
        }
      }
    });

    assert.equal(run.status, 200);
    assert.ok(run.body.case.caseId);
    assert.ok(run.body.caseVersion > 1);
    assert.equal(run.body.decisionReadiness.approvalEligible, false);
    const approval = await handleCaseApproval({
      req,
      body: {
        caseId: run.body.case.caseId,
        caseVersion: run.body.caseVersion,
        reviewerDecision: 'Request remediation',
        reviewerNotes: 'The accountable reviewer requested source evidence and a rerun.'
      }
    });
    assert.equal(approval.status, 200);
    assert.equal(approval.body.status, CASE_STATES.REJECTED);
  } finally {
    cleanup();
  }
});

test('new demo cases archive and block prior case entry points', async () => {
  const cleanup = isolatedStore();
  try {
    const session = await createDemoSession();
    const actor = await authenticateSessionToken(session.token);
    const first = await createDemoCase(actor, '02_data_processing_addendum_and_cross_border_terms.pdf');
    const second = await createDemoCase(actor, '03_ai_accelerator_chip_import_export_control_agreement.pdf');

    assert.equal(await getCase(actor, first.case.caseId), null);
    assert.equal((await getCase(actor, second.case.caseId)).caseId, second.case.caseId);

    const response = await handleAgentRun({
      req: { headers: { authorization: `Bearer ${session.token}`, 'x-agent-runtime': 'deterministic' } },
      body: {
        caseDraft: { ...first.case, documents: [first.fixture.evidence] },
        caseVersion: first.case.version,
        runtime: 'deterministic'
      }
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.error, 'case_archived');
  } finally {
    cleanup();
  }
});

test('pilot cookie outranks an automatic demo bearer but not an explicit static bearer', async () => {
  const cleanup = isolatedStore();
  try {
    process.env.P42_PILOT_ACCESS_CODES = 'pilot-cookie-precedence-12345';
    const demo = await createDemoSession();
    const pilot = await exchangeAccessCode('pilot-cookie-precedence-12345');
    const cookie = `p42_pilot_session=${encodeURIComponent(pilot.token)}`;

    const pilotActor = await authenticateRequest({
      headers: {
        authorization: `Bearer ${demo.token}`,
        cookie
      }
    });
    assert.equal(pilotActor.authSource, 'pilot_session');
    assert.equal(pilotActor.sessionId, pilot.sessionId);

    process.env.P42_DEMO_BEARER_TOKEN = 'explicit-static-bearer';
    const staticActor = await authenticateRequest({
      headers: {
        authorization: 'Bearer explicit-static-bearer',
        cookie
      }
    });
    assert.equal(staticActor.authSource, 'demo_bearer');
  } finally {
    cleanup();
  }
});
