'use strict';

const { appendAuditRecord } = require('./auditStore');
const { authorizeRequest } = require('./rbac');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function arrayOfText(values = []) {
  return Array.isArray(values)
    ? values.map(cleanText).filter(Boolean).slice(0, 50)
    : [];
}

async function handleCaseApproval({ req, body = {} } = {}) {
  const auth = await authorizeRequest(req, 'agent:run');
  if (!auth.ok) return { status: auth.statusCode, body: auth.body };

  const caseId = cleanText(body.caseId || body.case?.caseId || 'human-review-case');
  const reviewerDecision = cleanText(body.reviewerDecision || 'Human review recorded');
  const reviewerNotes = cleanText(body.reviewerNotes || 'Reviewer recorded inspection of the decision output.');
  const recordedAt = new Date().toISOString();
  const decision = body.decision && typeof body.decision === 'object' ? body.decision : {};
  const evidenceIds = arrayOfText(body.evidenceIds || body.evidenceManifest);

  appendAuditRecord({
    actor: auth.actor,
    caseId,
    status: 'human_review_recorded',
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
      deterministicDecisionOwner: true
    }
  });

  return {
    status: 200,
    body: {
      ok: true,
      status: 'human_review_recorded',
      caseId,
      reviewerDecision,
      recordedAt,
      humanApprovalRequired: true,
      autoApproval: false
    }
  };
}

module.exports = {
  handleCaseApproval
};
