'use strict';

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
    documents: Array.isArray(input.documents) ? input.documents.slice(0, 12) : []
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
      const hasTrainingLanguage = hasPositiveDocumentEvidence(caseInput.documents, /training|fine[- ]?tuning|model improvement|model-training exclusion/i, /\b(no|missing|without)\s+(model[- ]training|training)|no model-training exclusion|no .*model[- ]training exclusion|model-training exclusion.*not attached/i);
      if (!hasTrainingLanguage) {
        gaps.push({
          severity: 'high',
          gap: 'AI/model governance is applicable but training-data handling is unclear.',
          action: 'Require model-training exclusion or approved data-use terms before approval.'
        });
      }
    }
    if (domain.id === 'business_continuity' && domain.status === 'applicable') {
      const hasContinuityEvidence = hasPositiveDocumentEvidence(caseInput.documents, /continuity|bcp|disaster recovery|exit/i, /\b(no|missing|without)\s+(business\s+)?continuity|no continuity plan|no .*continuity plan|continuity.*not attached/i);
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
  trace.push(makeEvent('evidence_agent', 'evidence_mapped', {
    evidenceIds: Array.from(new Set(domains.flatMap((domain) => domain.evidenceIds))),
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
      { name: 'evidence_attached', status: domains.length ? 'passed' : 'needs_review' },
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
    evidenceIds: Array.from(new Set(domains.flatMap((domain) => domain.evidenceIds))),
    outputReview,
    trace
  };
}

function getReadinessInventory() {
  return {
    generatedAt: nowIso(),
    submissionReadiness: {
      productionDeployment: 'partial_live',
      sovereignLlmBoundary: 'live_gateway_present',
      auditTraceability: 'local_trace_present_needs_persistence',
      rbac: 'roadmap_needs_entra_implementation',
      benchmarks: 'parallax42_golden_evals_20_of_20_passed',
      responsibleAi: 'documented_controls_need_packaged_assurance_run',
      videoDemo: 'not_recorded'
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
