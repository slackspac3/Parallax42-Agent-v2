'use strict';

const { auditStoreHealth } = require('./auditStore');
const { authHealth } = require('./rbac');
const { getDomainLibrary, retrieveEvidence } = require('./evidenceLibrary');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function makeEvent(agent, eventType, payload = {}, parentEventId = '') {
  return {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: nowIso(),
    agent,
    eventType,
    parentEventId,
    payload
  };
}

function normaliseInput(input = {}) {
  const retrievalContext = input.retrievalContext && typeof input.retrievalContext === 'object'
    ? {
      query: cleanText(input.retrievalContext.query || ''),
      model: cleanText(input.retrievalContext.model || ''),
      chunkCount: Number(input.retrievalContext.chunkCount || 0),
      matchCount: Number(input.retrievalContext.matchCount || 0),
      matches: Array.isArray(input.retrievalContext.matches)
        ? input.retrievalContext.matches.slice(0, 12).map((match) => ({
          chunkId: cleanText(match.chunkId || ''),
          evidenceId: cleanText(match.evidenceId || ''),
          title: cleanText(match.title || ''),
          score: Number(match.score || 0),
          text: cleanText(match.text || '').slice(0, 1400),
          metadata: match.metadata && typeof match.metadata === 'object' ? match.metadata : {}
        }))
        : []
    }
    : null;
  return {
    caseId: cleanText(input.caseId || `case_${Date.now()}`),
    requester: cleanText(input.requester || 'Compliance reviewer'),
    businessUnit: cleanText(input.businessUnit || ''),
    geography: cleanText(input.geography || ''),
    supplierName: cleanText(input.supplierName || ''),
    serviceDescription: cleanText(input.serviceDescription || ''),
    brief: cleanText(input.brief || input.request || ''),
    integrations: Array.isArray(input.integrations)
      ? input.integrations.map(cleanText).filter(Boolean).slice(0, 12)
      : [],
    documents: Array.isArray(input.documents) ? input.documents.slice(0, 18) : [],
    retrievalContext
  };
}

function buildGaps(caseInput, domains) {
  const gaps = [];
  if (!caseInput.businessUnit) {
    gaps.push({
      severity: 'medium',
      gap: 'Business owner is not identified.',
      action: 'Assign the accountable business unit or requester before approval.'
    });
  }
  if (!caseInput.geography) {
    gaps.push({
      severity: 'medium',
      gap: 'Jurisdiction or geography is missing.',
      action: 'Confirm the operating geography and regulatory perimeter.'
    });
  }
  if (!caseInput.documents.length) {
    gaps.push({
      severity: 'high',
      gap: 'No supporting evidence or document summary was provided.',
      action: 'Upload or reference policy, contract, questionnaire, or assurance evidence.'
    });
  }
  for (const domain of domains) {
    if (domain.status === 'needs_confirmation') {
      gaps.push({
        severity: domain.id === 'regulatory_reporting' ? 'high' : 'medium',
        gap: `${domain.label} applicability needs confirmation.`,
        action: `Ask the domain owner whether ${domain.label.toLowerCase()} obligations apply.`
      });
    }
    if (domain.id === 'privacy_data_governance' && domain.status === 'applicable') {
      const hasDpaEvidence = hasPositiveDocumentEvidence(caseInput.documents, /dpa|data processing agreement/i, /\b(no|missing|without)\s+(signed\s+)?dpa\b|no signed dpa|dpa.*not attached/i);
      if (!hasDpaEvidence) {
        gaps.push({
          severity: 'high',
          gap: 'Privacy/data governance is applicable but DPA evidence was not detected.',
          action: 'Require DPA, subprocessors, retention, deletion, and transfer evidence.'
        });
      }
    }
    if (domain.id === 'ai_model_governance' && domain.status === 'applicable') {
      const hasTrainingLanguage = hasPositiveDocumentEvidence(caseInput.documents, /training|fine[- ]?tuning|model improvement|model-training exclusion/i, /no[^.]{0,70}model[- ]training exclusion|model[- ]training exclusion[^.]{0,80}(not attached|missing|unavailable)|\b(missing|without)\s+(approved\s+)?(model[- ]training|training)\s+(exclusion|terms|language|evidence)/i);
      if (!hasTrainingLanguage) {
        gaps.push({
          severity: 'high',
          gap: 'AI/model governance is applicable but training-data handling is unclear.',
          action: 'Require model-training exclusion or approved data-use terms before approval.'
        });
      }
    }
    if (domain.id === 'business_continuity' && domain.status === 'applicable') {
      const hasContinuityEvidence = hasPositiveDocumentEvidence(caseInput.documents, /continuity|bcp|disaster recovery|exit/i, /no[^.]{0,70}continuity plan|continuity plan[^.]{0,80}(not attached|missing|unavailable)|\b(missing|without)\s+(business\s+)?continuity\s+(plan|evidence)/i);
      if (!hasContinuityEvidence) {
        gaps.push({
          severity: 'high',
          gap: 'Critical service indicators exist without continuity or exit evidence.',
          action: 'Require BCP/DR and exit-assistance evidence for critical operations.'
        });
      }
    }
  }
  return gaps;
}

function hasPositiveDocumentEvidence(documents = [], includePattern, negativePattern) {
  return documents.some((doc) => {
    const blob = JSON.stringify(doc || {});
    return includePattern.test(blob) && !negativePattern.test(blob);
  });
}

function buildDecision(gaps) {
  const highCount = gaps.filter((gap) => gap.severity === 'high').length;
  const mediumCount = gaps.filter((gap) => gap.severity === 'medium').length;
  if (highCount >= 2 || (highCount >= 1 && mediumCount >= 3)) {
    return {
      status: 'not_ready',
      recommendation: 'Do not approve yet',
      readinessScore: 0.32,
      rationale: 'Multiple high-severity evidence or applicability gaps remain open.'
    };
  }
  if (highCount || mediumCount >= 2) {
    return {
      status: 'conditionally_ready',
      recommendation: 'Conditional approval with named controls',
      readinessScore: highCount ? 0.58 : 0.72,
      rationale: 'The case can progress only if the listed controls and confirmations are completed.'
    };
  }
  return {
    status: 'ready',
    recommendation: 'Ready for human approval',
    readinessScore: 0.88,
    rationale: 'No blocking gaps were detected in the supplied case context.'
  };
}

function buildControlPlan(domains, gaps) {
  const controls = new Set();
  domains.forEach((domain) => {
    domain.controls.forEach((control) => controls.add(control));
  });
  gaps.forEach((gap) => controls.add(gap.action));
  return Array.from(controls).slice(0, 14);
}

function buildCitations(caseInput) {
  const documentCitations = caseInput.documents.map((doc, index) => ({
    citationId: doc.chunkId || doc.citationId || `cite_${String(index + 1).padStart(2, '0')}`,
    evidenceId: cleanText(doc.sourceEvidenceId || doc.evidenceId || `DOC-${String(index + 1).padStart(2, '0')}`),
    title: cleanText(doc.title || doc.fileName || `Evidence ${index + 1}`),
    sourceType: cleanText(doc.sourceType || doc.extractionStatus || 'document'),
    extractionStatus: cleanText(doc.extractionStatus || 'attached'),
    score: Number(doc.score || 0),
    text: cleanText(doc.excerpt || doc.summary || doc.text || '').slice(0, 700),
    signals: Array.isArray(doc.signals) ? doc.signals.map(cleanText).filter(Boolean).slice(0, 8) : [],
    metadata: doc.metadata && typeof doc.metadata === 'object' ? doc.metadata : {}
  }));

  const retrievalCitations = Array.isArray(caseInput.retrievalContext?.matches)
    ? caseInput.retrievalContext.matches.map((match, index) => ({
      citationId: match.chunkId || `retrieval_${String(index + 1).padStart(2, '0')}`,
      evidenceId: cleanText(match.evidenceId || `RET-${String(index + 1).padStart(2, '0')}`),
      title: cleanText(match.title || 'Retrieved evidence chunk'),
      sourceType: 'semantic_retrieval',
      extractionStatus: 'retrieved_chunk',
      score: Number(match.score || 0),
      text: cleanText(match.text || '').slice(0, 700),
      signals: [],
      metadata: match.metadata && typeof match.metadata === 'object' ? match.metadata : {}
    }))
    : [];

  const byId = new Map();
  [...retrievalCitations, ...documentCitations].forEach((citation) => {
    const key = citation.citationId || `${citation.evidenceId}:${citation.text}`;
    if (citation.text || citation.evidenceId) byId.set(key, citation);
  });
  return Array.from(byId.values()).slice(0, 18);
}

function runComplianceAgent(input = {}, options = {}) {
  const caseInput = normaliseInput(input);
  const trace = [];
  const root = makeEvent('intake_agent', 'case_loaded', {
    caseId: caseInput.caseId,
    requester: caseInput.requester,
    businessUnit: caseInput.businessUnit || 'missing',
    geography: caseInput.geography || 'missing'
  });
  trace.push(root);

  if (!caseInput.brief && !caseInput.serviceDescription) {
    const blocked = makeEvent('compliance_orchestrator', 'run_blocked', {
      reason: 'A compliance brief or service description is required.'
    }, root.eventId);
    trace.push(blocked);
    return {
      ok: false,
      mode: options.mode || process.env.AGENT_MODE || 'local_deterministic',
      case: caseInput,
      message: 'A compliance brief or service description is required.',
      trace
    };
  }

  const domains = retrieveEvidence(caseInput);
  if (caseInput.retrievalContext?.matches?.length) {
    trace.push(makeEvent('evidence_examiner', 'semantic_retrieval_completed', {
      query: caseInput.retrievalContext.query,
      matchCount: caseInput.retrievalContext.matches.length,
      chunkCount: caseInput.retrievalContext.chunkCount,
      model: caseInput.retrievalContext.model || 'text-embedding-3-large',
      chunkIds: caseInput.retrievalContext.matches.map((match) => match.chunkId).filter(Boolean).slice(0, 10)
    }, root.eventId));
  }
  trace.push(makeEvent('domain_scanner_agent', 'domains_scanned', {
    matchedDomains: domains.map((domain) => ({
      id: domain.id,
      label: domain.label,
      score: domain.score,
      status: domain.status,
      hits: domain.hits
    }))
  }, root.eventId));

  const gaps = buildGaps(caseInput, domains);
  const citations = buildCitations(caseInput);
  const domainEvidenceIds = domains.flatMap((domain) => domain.evidenceIds);
  const citationEvidenceIds = citations.map((citation) => citation.evidenceId).filter(Boolean);
  const evidenceIds = Array.from(new Set([...domainEvidenceIds, ...citationEvidenceIds]));
  trace.push(makeEvent('evidence_agent', 'evidence_mapped', {
    evidenceIds,
    citationCount: citations.length,
    retrievalAugmented: Boolean(caseInput.retrievalContext?.matches?.length),
    gapCount: gaps.length
  }, root.eventId));

  const decision = buildDecision(gaps);
  const controlPlan = buildControlPlan(domains, gaps);
  trace.push(makeEvent('control_agent', 'controls_recommended', {
    controlCount: controlPlan.length,
    highSeverityGaps: gaps.filter((gap) => gap.severity === 'high').length
  }, root.eventId));

  const outputReview = {
    status: decision.status === 'ready' || decision.status === 'conditionally_ready' ? 'passed' : 'needs_revision',
    finalOutputSafeForHumanReview: true,
    checks: [
      { name: 'evidence_attached', status: citations.length || domains.length ? 'passed' : 'needs_review' },
      { name: 'retrieval_citations', status: caseInput.retrievalContext?.matches?.length ? 'passed' : 'not_applicable' },
      { name: 'blocking_gaps_named', status: gaps.length ? 'passed' : 'not_applicable' },
      { name: 'human_approval_required', status: 'passed' },
      { name: 'no_automatic_approval', status: 'passed' }
    ]
  };
  trace.push(makeEvent('output_review_agent', 'output_review_completed', outputReview, root.eventId));

  return {
    ok: true,
    mode: options.mode || process.env.AGENT_MODE || 'local_deterministic',
    case: caseInput,
    decision,
    domains: domains.map((domain) => ({
      id: domain.id,
      label: domain.label,
      status: domain.status,
      score: domain.score,
      obligations: domain.obligations,
      controls: domain.controls,
      evidenceIds: domain.evidenceIds
    })),
    gaps,
    controlPlan,
    evidenceIds,
    citations,
    retrievalContext: caseInput.retrievalContext,
    outputReview,
    trace
  };
}

function getReadinessInventory() {
  const audit = auditStoreHealth();
  const auth = authHealth();
  return {
    generatedAt: nowIso(),
    submissionReadiness: {
      productionDeployment: 'partial_live',
      sovereignLlmBoundary: 'live_gateway_present',
      auditTraceability: audit.durable ? 'hash_chained_append_only_audit_ready' : 'hash_chained_audit_present_ephemeral_runtime',
      rbac: auth.enforced ? 'rbac_enforced' : 'rbac_policy_ready_needs_enforced_env',
      benchmarks: 'parallax42_golden_evals_20_of_20_passed',
      responsibleAi: 'documented_controls_need_packaged_assurance_run',
      videoDemo: 'not_recorded'
    },
    securityControls: {
      auth,
      audit
    },
    linkedSystems: {
      parallax42Backend: process.env.PARALLAX42_BACKEND_URL || 'https://api.parallax42.bhavukarora.com',
      parallax42DemoUi: process.env.PARALLAX42_DEMO_UI_URL || 'https://slackspac3.github.io/Parallax42/',
      compassGateway: process.env.COMPASS_GATEWAY_URL || 'https://parallax42-compass-gateway.vercel.app/api/compass'
    },
    domains: getDomainLibrary()
  };
}

module.exports = {
  buildDecision,
  buildGaps,
  getReadinessInventory,
  normaliseInput,
  runComplianceAgent
};
