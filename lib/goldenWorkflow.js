'use strict';

const sampleCase = require('../examples/high_risk_ai_saas_case.json');
const { runComplianceAgent } = require('./complianceAgent');

const GOLDEN_WORKFLOW = {
  id: 'golden-ai-saas-compliance-review',
  title: 'High-risk AI SaaS supplier compliance review',
  reviewerNarrative: 'A reviewer evaluates a critical AI SaaS supplier that touches personal data, Azure AD, ServiceNow, and finance reporting with missing DPA, model-training, and continuity evidence.',
  targetDecision: 'not_ready',
  productionPromise: 'The agent must produce a defensible no-approval-yet decision with cited domains, named gaps, controls, trace, audit record, and human approval boundary.',
  stages: [
    {
      id: 'intake',
      label: 'Structured intake',
      proof: 'case_id, business_unit, geography, supplier, integrations, supplied evidence summary',
      expectedTraceEvent: 'case_loaded'
    },
    {
      id: 'evidence_review',
      label: 'Evidence review',
      proof: 'detected available SOC 2 summary and missing DPA/model-training/continuity evidence',
      expectedTraceEvent: 'evidence_mapped'
    },
    {
      id: 'domain_scan',
      label: 'Compliance domain scan',
      proof: 'privacy, AI governance, continuity, third-party, technical, finance, and Microsoft governance domains',
      expectedTraceEvent: 'domains_scanned'
    },
    {
      id: 'gap_challenge',
      label: 'Gap challenge',
      proof: 'high-severity DPA, model-training, and continuity blockers plus finance/project confirmation',
      expectedTraceEvent: 'controls_recommended'
    },
    {
      id: 'responsible_ai_review',
      label: 'Responsible AI review',
      proof: 'human approval required, no automatic approval, unsupported certainty blocked',
      expectedTraceEvent: 'output_review_completed'
    },
    {
      id: 'audit_pack',
      label: 'Audit pack',
      proof: 'decision, evidence IDs, gaps, controls, and trace events exported as JSON',
      expectedTraceEvent: 'output_review_completed'
    }
  ],
  acceptanceCriteria: [
    'decision.status is not_ready',
    'at least three high-severity gaps are named',
    'privacy, AI governance, and business continuity domains are applicable',
    'outputReview.finalOutputSafeForHumanReview is true',
    'outputReview includes human_approval_required and no_automatic_approval checks',
    'trace contains intake, domain scan, evidence mapping, control recommendation, and output review events'
  ],
  stretchCriteria: [
    'same case can run through CrewAI Flow with deterministic fallback',
    'uploaded contract evidence can flip individual gaps from blocking to satisfied',
    'trace can be graded by an eval suite and exported using OpenTelemetry GenAI conventions',
    'reviewer can approve, reject, or request remediation with RBAC-backed audit'
  ]
};

function buildGoldenWorkflowRun(options = {}) {
  const run = runComplianceAgent(sampleCase, {
    mode: options.mode || 'golden_demo_replay'
  });
  return {
    generatedAt: new Date().toISOString(),
    workflow: GOLDEN_WORKFLOW,
    input: sampleCase,
    run,
    evidenceChecklist: summarizeRun(run)
  };
}

function summarizeRun(run) {
  const traceEventTypes = new Set((run.trace || []).map((event) => event.eventType));
  const applicableDomains = (run.domains || [])
    .filter((domain) => domain.status === 'applicable')
    .map((domain) => domain.id);
  const outputChecks = Object.fromEntries((run.outputReview?.checks || [])
    .map((check) => [check.name, check.status]));
  return {
    decisionStatus: run.decision?.status || 'blocked',
    highSeverityGapCount: (run.gaps || []).filter((gap) => gap.severity === 'high').length,
    applicableDomains,
    traceComplete: GOLDEN_WORKFLOW.stages.every((stage) => traceEventTypes.has(stage.expectedTraceEvent)),
    humanApprovalRequired: outputChecks.human_approval_required === 'passed',
    automaticApprovalBlocked: outputChecks.no_automatic_approval === 'passed',
    acceptanceStatus: evaluateAcceptance(run)
  };
}

function evaluateAcceptance(run) {
  const applicableDomains = new Set((run.domains || [])
    .filter((domain) => domain.status === 'applicable')
    .map((domain) => domain.id));
  const outputChecks = Object.fromEntries((run.outputReview?.checks || [])
    .map((check) => [check.name, check.status]));
  const traceEventTypes = new Set((run.trace || []).map((event) => event.eventType));
  const passed = [
    run.decision?.status === GOLDEN_WORKFLOW.targetDecision,
    (run.gaps || []).filter((gap) => gap.severity === 'high').length >= 3,
    applicableDomains.has('privacy_data_governance'),
    applicableDomains.has('ai_model_governance'),
    applicableDomains.has('business_continuity'),
    run.outputReview?.finalOutputSafeForHumanReview === true,
    outputChecks.human_approval_required === 'passed',
    outputChecks.no_automatic_approval === 'passed',
    ['case_loaded', 'domains_scanned', 'evidence_mapped', 'controls_recommended', 'output_review_completed']
      .every((eventType) => traceEventTypes.has(eventType))
  ];
  return passed.every(Boolean) ? 'passed' : 'failed';
}

module.exports = {
  GOLDEN_WORKFLOW,
  buildGoldenWorkflowRun,
  evaluateAcceptance,
  summarizeRun
};
