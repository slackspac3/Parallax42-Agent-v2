'use strict';

const USE_CASE_ID = '21';
const AGENT_ROLES = [
  { name: 'Compliance Orchestrator', role: 'Scopes the case and decides which compliance domains apply.' },
  { name: 'Regulatory Obligation Mapper', role: 'Maps the request to policy, privacy, AI, continuity, technical, finance, and third-party obligations.' },
  { name: 'Evidence Examiner', role: 'Reviews supplied evidence, citations, retrieval matches, and missing proof.' },
  { name: 'Risk And Control Analyst', role: 'Turns obligations and evidence gaps into controls, blockers, owners, and remediation actions.' },
  { name: 'Responsible AI Reviewer', role: 'Checks unsupported certainty, automation boundaries, bias-sensitive assumptions, and human approval requirements.' },
  { name: 'Audit Packager', role: 'Packages the final decision, trace, evidence IDs, gaps, and reviewer actions.' }
];

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,;\n]/).map(cleanText).filter(Boolean);
  }
  return [];
}

function normalizeDocuments(input = {}) {
  const documents = input.documents || input.evidence || input.files || input.artifacts || [];
  if (Array.isArray(documents)) {
    return documents.map((document, index) => {
      if (typeof document === 'string') {
        return {
          evidenceId: `INPUT-DOC-${index + 1}`,
          title: `Input evidence ${index + 1}`,
          summary: document
        };
      }
      return {
        evidenceId: document.evidenceId || document.id || document.documentId || `INPUT-DOC-${index + 1}`,
        title: document.title || document.fileName || document.name || `Input evidence ${index + 1}`,
        summary: document.summary || document.text || document.description || document.excerpt || '',
        text: document.text || document.summary || document.description || document.excerpt || '',
        source: document.source || document.sourceType || 'input_example'
      };
    });
  }
  if (typeof documents === 'string' && documents.trim()) {
    return [{ evidenceId: 'INPUT-DOC-1', title: 'Input evidence', summary: documents }];
  }
  return [];
}

function normalizeEvaluatorInput(body = {}) {
  const input = body.input && typeof body.input === 'object' ? body.input : body;
  const query = typeof body.input === 'string' ? body.input : input.query || input.prompt || body.prompt || body.message || '';
  const caseDraft = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : {
    caseId: cleanText(body.run_id || body.runId || input.caseId || input.case_id || `eval-${Date.now()}`),
    requester: cleanText(input.requester || input.owner || input.business_owner || input.businessUnit || input.business_unit || 'Evaluator'),
    businessUnit: cleanText(input.businessUnit || input.business_unit || input.owner || input.business_owner || input.workflow_owner || ''),
    geography: cleanText(input.geography || input.region || input.country || ''),
    supplierName: cleanText(input.supplierName || input.supplier_name || input.vendor || input.supplier || input.workflow || 'Submitted compliance case'),
    serviceDescription: cleanText(input.serviceDescription || input.service_description || input.service || input.workflow || query),
    brief: cleanText(input.brief || input.scenario || input.description || query || 'Evaluate the submitted compliance case.'),
    integrations: asArray(input.integrations || input.systems || input.platforms),
    riskSignals: asArray(input.riskSignals || input.risk_signals || input.risks),
    evidenceSignals: asArray(input.evidenceSignals || input.evidence_signals || input.evidence_summary),
    documents: normalizeDocuments(input)
  };
  return {
    runId: cleanText(body.run_id || body.runId || caseDraft.caseId || `eval-${Date.now()}`),
    useCaseId: cleanText(body.use_case_id || body.useCaseId || input.use_case_id || input.useCaseId || USE_CASE_ID),
    runtime: body.runtime || input.runtime || body.options?.runtime,
    caseDraft
  };
}

function reviewerActions(result = {}) {
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  if (gaps.length) {
    return gaps.slice(0, 8).map((gap) => cleanText(gap.action || gap.gap || gap.label || 'Reviewer confirmation required.'));
  }
  return ['Confirm accountable human reviewer before operational approval.'];
}

function buildEvaluatorResponse({ normalized = {}, result = {}, startedAt = Date.now() } = {}) {
  const ok = result.ok !== false;
  const traceId = cleanText(result.traceId || result.case?.caseId || normalized.runId || `trace-${Date.now()}`);
  const decision = result.decision || {};
  return {
    run_id: normalized.runId,
    status: ok ? 'success' : 'error',
    use_case_id: normalized.useCaseId || USE_CASE_ID,
    result: {
      summary: cleanText(decision.recommendation || result.message || 'Compliance council run completed.'),
      decision: {
        status: cleanText(decision.status || (ok ? 'review_ready' : 'blocked')),
        recommendation: cleanText(decision.recommendation || result.message || ''),
        readinessScore: Number(decision.readinessScore || result.readinessScore || 0),
        humanApprovalRequired: result.humanApprovalRequired !== false
      },
      topRisks: (result.gaps || []).slice(0, 5).map((gap) => ({
        severity: cleanText(gap.severity || 'review'),
        risk: cleanText(gap.gap || gap.label || gap.action || 'Reviewer action required.'),
        action: cleanText(gap.action || 'Confirm with accountable owner.')
      })),
      evidenceIds: Array.isArray(result.evidenceIds) ? result.evidenceIds.slice(0, 20) : [],
      requiredActions: reviewerActions(result),
      artifacts: [
        'decision_memo',
        'specialist_validation_trace',
        'audit_record',
        'executive_review_pack'
      ]
    },
    agents_used: AGENT_ROLES.map((agent) => agent.name),
    agents: AGENT_ROLES,
    trace_id: traceId,
    log_file: 'logs/agent_audit.jsonl',
    execution_time_seconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
    raw: result
  };
}

function buildEvaluatorError({ normalized = {}, error, startedAt = Date.now() } = {}) {
  return {
    run_id: normalized.runId || `eval-${Date.now()}`,
    status: 'error',
    use_case_id: normalized.useCaseId || USE_CASE_ID,
    error: {
      type: error?.name || 'AgentRunError',
      message: error instanceof Error ? error.message : String(error || 'Unknown evaluator run failure.'),
      recoverable: true
    },
    trace_id: normalized.runId || `trace-${Date.now()}`,
    log_file: 'logs/agent_audit.jsonl',
    execution_time_seconds: Number(((Date.now() - startedAt) / 1000).toFixed(3))
  };
}

module.exports = {
  AGENT_ROLES,
  USE_CASE_ID,
  buildEvaluatorError,
  buildEvaluatorResponse,
  normalizeEvaluatorInput
};
