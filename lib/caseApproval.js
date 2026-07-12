'use strict';

const { appendAuditRecord } = require('./auditStore');
const { CASE_STATES, getCase, transitionCase } = require('./caseLifecycle');
const { authorizeRequest } = require('./rbac');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function arrayOfText(values = []) {
  return Array.isArray(values)
    ? values.map(cleanText).filter(Boolean).slice(0, 50)
    : [];
}

function reviewerDecisionTarget(value = '') {
  const decision = cleanText(value).toLowerCase();
  if (/^(?:reject(?:ed)?|request remediation|remediation (?:required|requested)|decline(?:d)?|block(?:ed)?)$/.test(decision)) {
    return CASE_STATES.REJECTED;
  }
  if (/^(?:approve(?:d)?|approve after controls|approve with conditions|conditional approval|accept(?:ed)?)$/.test(decision)) {
    return CASE_STATES.APPROVED;
  }
  return '';
}

async function handleCaseApproval({ req, body = {} } = {}) {
  const auth = await authorizeRequest(req, 'case:approve');
  if (!auth.ok) return { status: auth.statusCode, body: auth.body };

  const caseId = cleanText(body.caseId || body.case?.caseId);
  const reviewerDecision = cleanText(body.reviewerDecision);
  const reviewerNotes = cleanText(body.reviewerNotes);
  const caseVersion = Number(body.caseVersion);
  if (!caseId || !reviewerDecision || !reviewerNotes || !Number.isInteger(caseVersion) || caseVersion < 1) {
    return {
      status: 400,
      body: { ok: false, error: 'approval_fields_required', detail: 'caseId, caseVersion, reviewerDecision, and reviewerNotes are required.' }
    };
  }
  const target = reviewerDecisionTarget(reviewerDecision);
  if (!target) {
    return {
      status: 400,
      body: { ok: false, error: 'invalid_reviewer_decision', detail: 'Reviewer decision must explicitly approve or reject/request remediation.' }
    };
  }
  const current = await getCase(auth.actor, caseId);
  if (!current) {
    return { status: 404, body: { ok: false, error: 'case_not_found', detail: 'Case was not found in this workspace.' } };
  }
  if (current.state !== CASE_STATES.REVIEW_READY && current.state !== target) {
    return { status: 409, body: { ok: false, error: 'case_not_review_ready', detail: 'Run the council successfully before recording the final human decision.' } };
  }
  if (current.state === target) {
    const sameDecision = cleanText(current.reviewerDecision).toLowerCase() === reviewerDecision.toLowerCase();
    const sameNotes = cleanText(current.reviewerNotes) === reviewerNotes;
    if (!sameDecision || !sameNotes) {
      return {
        status: 409,
        body: { ok: false, error: 'case_already_decided', detail: 'This case already has a different final human decision.' }
      };
    }
    return {
      status: 200,
      body: {
        ok: true,
        status: target,
        caseId,
        reviewerDecision: current.reviewerDecision,
        recordedAt: current.reviewedAt,
        caseVersion: current.version,
        humanApprovalRequired: true,
        autoApproval: false,
        idempotent: true
      }
    };
  }
  const councilDecision = current.lastRun?.decision && typeof current.lastRun.decision === 'object'
    ? current.lastRun.decision
    : current.decision && typeof current.decision === 'object' ? current.decision : {};
  if (target === CASE_STATES.APPROVED && cleanText(councilDecision.status).toLowerCase() === 'not_ready') {
    return {
      status: 409,
      body: {
        ok: false,
        error: 'case_not_approval_eligible',
        detail: 'The council marked this case not ready. Record remediation and rerun the council before approval.'
      }
    };
  }
  const approvedCase = await transitionCase(auth.actor, caseId, target, {
    expectedVersion: caseVersion,
    patch: {
      reviewerDecision,
      reviewerNotes,
      reviewerId: auth.actor.id,
      reviewedAt: new Date().toISOString()
    }
  });
  const recordedAt = approvedCase.reviewedAt;
  const decision = current.decision && typeof current.decision === 'object' ? current.decision : {};
  const evidenceIds = arrayOfText(current.evidenceIds);

  appendAuditRecord({
    actor: auth.actor,
    caseId,
    status: target,
    summary: `${reviewerDecision} for ${caseId}.`,
    payload: {
      route: 'case.approve',
      reviewerDecision,
      reviewerNotes,
      evidenceIds,
      decision,
      recordedAt,
      autoApproval: false,
      humanApprovalRequired: true,
      recommendationOwner: 'deterministic_engine',
      approvalOwner: 'accountable_human_reviewer',
      caseVersion: approvedCase.version
    }
  });

  return {
    status: 200,
    body: {
      ok: true,
      status: target,
      caseId,
      reviewerDecision,
      recordedAt,
      caseVersion: approvedCase.version,
      humanApprovalRequired: true,
      autoApproval: false
    }
  };
}

module.exports = {
  handleCaseApproval
};
