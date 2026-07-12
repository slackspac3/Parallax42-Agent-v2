'use strict';

const crypto = require('node:crypto');

const { fixtureDocumentSummary } = require('./fixtureDocuments');
const { getRecord, listRecords, putRecord, updateRecord } = require('./recordStore');

const CASE_STATES = Object.freeze({
  DRAFT: 'draft',
  INTAKE_READY: 'intake_ready',
  EVIDENCE_READY: 'evidence_ready',
  COUNCIL_RUNNING: 'council_running',
  REVIEW_READY: 'review_ready',
  APPROVED: 'approved',
  REJECTED: 'rejected'
});

const TRANSITIONS = Object.freeze({
  [CASE_STATES.DRAFT]: new Set([CASE_STATES.INTAKE_READY, CASE_STATES.EVIDENCE_READY]),
  [CASE_STATES.INTAKE_READY]: new Set([CASE_STATES.EVIDENCE_READY, CASE_STATES.COUNCIL_RUNNING]),
  [CASE_STATES.EVIDENCE_READY]: new Set([CASE_STATES.COUNCIL_RUNNING]),
  [CASE_STATES.COUNCIL_RUNNING]: new Set([CASE_STATES.REVIEW_READY, CASE_STATES.INTAKE_READY, CASE_STATES.EVIDENCE_READY]),
  [CASE_STATES.REVIEW_READY]: new Set([CASE_STATES.COUNCIL_RUNNING, CASE_STATES.APPROVED, CASE_STATES.REJECTED]),
  [CASE_STATES.APPROVED]: new Set([CASE_STATES.COUNCIL_RUNNING]),
  [CASE_STATES.REJECTED]: new Set([CASE_STATES.COUNCIL_RUNNING])
});

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function requireWorkspace(actor = {}) {
  const workspaceId = cleanText(actor.workspaceId);
  if (!workspaceId) {
    const error = new Error('A session-scoped workspace is required for durable case state.');
    error.statusCode = 409;
    error.code = 'workspace_required';
    throw error;
  }
  return workspaceId;
}

function publicCase(record) {
  if (!record) return null;
  return {
    ...record.data,
    caseId: record.id,
    workspaceId: record.workspaceId,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function durableDraftFields(draft = {}) {
  const documents = Array.isArray(draft.documents) ? draft.documents.slice(0, 12).map((document = {}) => ({
    evidenceId: cleanText(document.evidenceId || document.documentId),
    title: cleanText(document.title || document.fileName),
    fileName: cleanText(document.fileName || document.filename),
    sourceType: cleanText(document.sourceType || document.metadata?.sourceType),
    extractionStatus: cleanText(document.extractionStatus || document.metadata?.extractionStatus),
    documentType: cleanText(document.documentType || document.metadata?.documentType),
    summary: cleanText(document.summary).slice(0, 900),
    excerpt: cleanText(document.excerpt || document.snippet).slice(0, 700),
    signals: Array.isArray(document.signals) ? document.signals.map(cleanText).filter(Boolean).slice(0, 24) : []
  })) : [];
  return {
    supplierName: cleanText(draft.supplierName),
    brief: cleanText(draft.brief),
    geography: cleanText(draft.geography),
    businessUnit: cleanText(draft.businessUnit),
    reviewFocus: Array.isArray(draft.reviewFocus)
      ? draft.reviewFocus.map(cleanText).filter(Boolean).slice(0, 24)
      : cleanText(draft.reviewFocus),
    knownGaps: Array.isArray(draft.knownGaps) ? draft.knownGaps.map(cleanText).filter(Boolean).slice(0, 50) : [],
    documents,
    integrations: Array.isArray(draft.integrations) ? draft.integrations.map(cleanText).filter(Boolean).slice(0, 24) : [],
    riskSignals: Array.isArray(draft.riskSignals) ? draft.riskSignals.map(cleanText).filter(Boolean).slice(0, 32) : [],
    evidenceSignals: Array.isArray(draft.evidenceSignals) ? draft.evidenceSignals.map(cleanText).filter(Boolean).slice(0, 32) : [],
    aiUsageScope: draft.aiUsageScope && typeof draft.aiUsageScope === 'object' ? draft.aiUsageScope : {},
    dataCategories: Array.isArray(draft.dataCategories) ? draft.dataCategories.map(cleanText).filter(Boolean).slice(0, 24) : [],
    sanctionsSensitiveGeographies: Array.isArray(draft.sanctionsSensitiveGeographies)
      ? draft.sanctionsSensitiveGeographies.map(cleanText).filter(Boolean).slice(0, 24)
      : [],
    exportOriginJurisdiction: cleanText(draft.exportOriginJurisdiction),
    exportEndUse: cleanText(draft.exportEndUse),
    sanctionsScreening: cleanText(draft.sanctionsScreening)
  };
}

function staleCaseVersion() {
  const error = new Error('Case changed since it was loaded. Refresh and retry.');
  error.statusCode = 409;
  error.code = 'stale_case_version';
  return error;
}

function councilAlreadyRunning() {
  const error = new Error('A council run is already in progress for this case.');
  error.statusCode = 409;
  error.code = 'council_already_running';
  return error;
}

function archivedCaseError() {
  const error = new Error('This demo case was archived when a newer case was created.');
  error.statusCode = 409;
  error.code = 'case_archived';
  return error;
}

async function saveCaseDraft(actor, draft = {}, { expectedVersion } = {}) {
  if (!actor?.authenticated || !actor.workspaceId) return null;
  const workspaceId = requireWorkspace(actor);
  const requestedCaseId = cleanText(draft.caseId);
  let caseId = requestedCaseId || crypto.randomUUID();
  const fields = durableDraftFields(draft);
  const nextState = fields.documents.length ? CASE_STATES.EVIDENCE_READY : CASE_STATES.INTAKE_READY;
  const current = await getRecord('case', caseId);
  if (!current) {
    if (requestedCaseId && (actor.sessionType || expectedVersion !== undefined)) {
      const error = new Error('Case was not found in this workspace.');
      error.statusCode = 404;
      error.code = 'case_not_found';
      throw error;
    }
    if (requestedCaseId) caseId = crypto.randomUUID();
    return publicCase(await putRecord({
      kind: 'case',
      id: caseId,
      workspaceId,
      expiresAt: actor.sessionType === 'demo' ? actor.expiresAt : null,
      data: {
        ...fields,
        state: nextState,
        projectId: actor.projectId,
        ownerId: actor.id,
        evidenceIds: fields.documents.map((document) => cleanText(document.evidenceId)).filter(Boolean),
        humanApprovalRequired: true,
        createdAt: new Date().toISOString()
      }
    }));
  }
  if (current.workspaceId !== workspaceId) {
    const error = new Error('Case identifier belongs to another workspace.');
    error.statusCode = 404;
    error.code = 'case_not_found';
    throw error;
  }
  if (actor.sessionType === 'demo' && current.data.archivedAt) throw archivedCaseError();
  let failure;
  const updated = await updateRecord('case', caseId, (record) => {
    if (record.workspaceId !== workspaceId) {
      const error = new Error('Case was not found in this workspace.');
      error.statusCode = 404;
      error.code = 'case_not_found';
      failure = error;
      return null;
    }
    if (expectedVersion !== undefined && Number(expectedVersion) !== record.version) {
      failure = staleCaseVersion();
      return null;
    }
    if (record.data.state === CASE_STATES.COUNCIL_RUNNING) {
      failure = councilAlreadyRunning();
      return null;
    }
    const fieldsChanged = Object.entries(fields)
      .some(([key, value]) => JSON.stringify(record.data[key] ?? null) !== JSON.stringify(value ?? null));
    const mutableState = [CASE_STATES.DRAFT, CASE_STATES.INTAKE_READY, CASE_STATES.EVIDENCE_READY].includes(record.data.state);
    const invalidatesDecision = fieldsChanged && !mutableState;
    return {
      data: {
        ...record.data,
        ...fields,
        state: mutableState || invalidatesDecision ? nextState : record.data.state,
        evidenceIds: fields.documents.map((document) => cleanText(document.evidenceId)).filter(Boolean),
        draftUpdatedAt: new Date().toISOString(),
        ...(invalidatesDecision ? { decisionStaleAt: new Date().toISOString() } : {})
      }
    };
  });
  if (failure) throw failure;
  if (!updated) {
    const error = new Error('Case was not found in this workspace.');
    error.statusCode = 404;
    error.code = 'case_not_found';
    throw error;
  }
  return publicCase(updated);
}

async function createDemoCase(actor, filename) {
  const workspaceId = requireWorkspace(actor);
  const fixture = fixtureDocumentSummary(filename);
  const profile = fixture.expectedProfile || {};
  const caseId = crypto.randomUUID();
  const existing = await listRecords('case', { workspaceId });
  await Promise.all(existing.filter((record) => ![CASE_STATES.APPROVED, CASE_STATES.REJECTED].includes(record.data.state))
    .map((record) => updateRecord('case', record.id, (current) => ({ data: { ...current.data, archivedAt: new Date().toISOString() } }))));
  const record = await putRecord({
    kind: 'case',
    id: caseId,
    workspaceId,
    expiresAt: actor.sessionType === 'demo' ? actor.expiresAt : null,
    data: {
      state: CASE_STATES.EVIDENCE_READY,
      projectId: actor.projectId,
      ownerId: actor.id,
      supplierName: cleanText(profile.supplier || profile.provider),
      brief: cleanText(profile.serviceSummary),
      geography: 'United Arab Emirates',
      businessUnit: 'Compliance',
      reviewFocus: Array.isArray(profile.expectedRiskDomains) ? profile.expectedRiskDomains : [],
      knownGaps: Array.isArray(profile.expectedMissingEvidence) ? profile.expectedMissingEvidence : [],
      fixtureFilename: fixture.document.filename,
      evidenceIds: [fixture.evidence.evidenceId],
      evidence: [fixture.evidence],
      humanApprovalRequired: true,
      createdAt: new Date().toISOString()
    }
  });
  return { ok: true, case: publicCase(record), fixture };
}

async function getCase(actor, caseId) {
  const workspaceId = requireWorkspace(actor);
  const record = await getRecord('case', cleanText(caseId));
  if (!record || record.workspaceId !== workspaceId) return null;
  if (actor.sessionType === 'demo' && record.data.archivedAt) return null;
  return publicCase(record);
}

function invalidTransition(current, target) {
  const error = new Error(`Case cannot move from ${current} to ${target}.`);
  error.statusCode = 409;
  error.code = 'invalid_case_transition';
  return error;
}

async function transitionCase(actor, caseId, target, { expectedVersion, patch = {} } = {}) {
  const workspaceId = requireWorkspace(actor);
  let failure;
  const updated = await updateRecord('case', cleanText(caseId), (record) => {
    if (record.workspaceId !== workspaceId) return null;
    if (actor.sessionType === 'demo' && record.data.archivedAt) {
      failure = archivedCaseError();
      return null;
    }
    if (expectedVersion !== undefined && Number(expectedVersion) !== record.version) {
      failure = staleCaseVersion();
      return null;
    }
    const current = record.data.state || CASE_STATES.DRAFT;
    if (!(TRANSITIONS[current] || new Set()).has(target)) {
      failure = invalidTransition(current, target);
      return null;
    }
    return {
      data: {
        ...record.data,
        ...patch,
        state: target,
        lifecycleUpdatedAt: new Date().toISOString()
      }
    };
  });
  if (failure) throw failure;
  if (!updated) {
    const error = new Error('Case was not found in this workspace.');
    error.statusCode = 404;
    error.code = 'case_not_found';
    throw error;
  }
  return publicCase(updated);
}

async function beginCouncil(actor, caseId, expectedVersion) {
  const current = await getCase(actor, caseId);
  if (!current) return null;
  if (current.state === CASE_STATES.COUNCIL_RUNNING) throw councilAlreadyRunning();
  return transitionCase(actor, caseId, CASE_STATES.COUNCIL_RUNNING, { expectedVersion });
}

async function completeCouncil(actor, result = {}) {
  const caseId = cleanText(result.case?.caseId || result.caseId);
  if (!caseId || !actor.workspaceId) return null;
  const current = await getCase(actor, caseId);
  if (!current) return null;
  const succeeded = result.ok === true && result.decision && typeof result.decision === 'object';
  const fallbackState = (current.evidenceIds || []).length || (current.documents || []).length || (current.evidence || []).length
    ? CASE_STATES.EVIDENCE_READY
    : CASE_STATES.INTAKE_READY;
  return transitionCase(actor, caseId, succeeded ? CASE_STATES.REVIEW_READY : fallbackState, {
    patch: {
      lastRunId: cleanText(result.runId || result.traceId || crypto.randomUUID()),
      lastRun: result,
      decision: succeeded ? result.decision : null,
      evidenceIds: Array.isArray(result.evidenceIds) ? result.evidenceIds : current.evidenceIds,
      ...(succeeded
        ? { councilCompletedAt: new Date().toISOString(), councilFailedAt: null }
        : { councilFailedAt: new Date().toISOString() })
    }
  });
}

async function failCouncil(actor, caseId, error) {
  if (!actor?.workspaceId || !cleanText(caseId)) return null;
  const current = await getCase(actor, caseId);
  if (!current || current.state !== CASE_STATES.COUNCIL_RUNNING) return current;
  return completeCouncil(actor, {
    ok: false,
    case: { caseId: cleanText(caseId) },
    message: cleanText(error instanceof Error ? error.message : error || 'Council execution failed.')
  });
}

module.exports = {
  CASE_STATES,
  beginCouncil,
  completeCouncil,
  createDemoCase,
  failCouncil,
  getCase,
  publicCase,
  saveCaseDraft,
  transitionCase
};
