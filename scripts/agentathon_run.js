'use strict';

console.log = (...args) => console.error(...args);

const { runComplianceAgent } = require('../lib/complianceAgent');

const USE_CASE_ID = '21';

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,;\n]/).map(cleanText).filter(Boolean);
  }
  return [];
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function normalizeEvidenceItem(item, index) {
  if (typeof item === 'string') {
    return {
      evidenceId: `INPUT-EVIDENCE-${index + 1}`,
      title: `Input evidence ${index + 1}`,
      summary: item,
      text: item,
      source: 'agentathon_input'
    };
  }
  const evidence = asObject(item);
  const text = firstText(evidence.text, evidence.summary, evidence.description, evidence.excerpt, evidence.content);
  return {
    evidenceId: firstText(evidence.evidenceId, evidence.evidence_id, evidence.id, `INPUT-EVIDENCE-${index + 1}`),
    title: firstText(evidence.title, evidence.name, evidence.fileName, evidence.file_name, `Input evidence ${index + 1}`),
    summary: text,
    text,
    source: firstText(evidence.source, evidence.sourceType, evidence.source_type, 'agentathon_input'),
    extractionStatus: firstText(evidence.extractionStatus, evidence.extraction_status, 'text_supplied'),
    signals: asArray(evidence.signals)
  };
}

function collectEvidence(input, casePayload) {
  return [
    ...asArray(input.evidence),
    ...asArray(input.documents),
    ...asArray(casePayload.evidence),
    ...asArray(casePayload.documents)
  ].map(normalizeEvidenceItem);
}

function buildCaseDraft(body) {
  const input = typeof body.input === 'string' ? { query: body.input } : asObject(body.input);
  const casePayload = asObject(input.case);
  const query = firstText(input.query, casePayload.query, body.prompt, body.message);
  const evidence = collectEvidence(input, casePayload);
  const contextualBrief = [
    query,
    casePayload.description,
    casePayload.processing_purpose,
    casePayload.data_categories,
    casePayload.ai_use,
    casePayload.model_training,
    casePayload.cross_border,
    casePayload.retention,
    casePayload.subprocessors
  ].flatMap(asArray).concat([
    cleanText(casePayload.description),
    cleanText(casePayload.processing_purpose),
    cleanText(casePayload.ai_use),
    cleanText(casePayload.model_training),
    cleanText(casePayload.cross_border),
    cleanText(casePayload.retention),
    cleanText(casePayload.subprocessors)
  ]).filter(Boolean).join(' ');

  return {
    caseId: firstText(body.run_id, body.runId, casePayload.case_id, casePayload.caseId, input.case_id, input.caseId, `eval-${Date.now()}`),
    requester: firstText(casePayload.requester, casePayload.owner, input.requester, input.owner, 'Agentathon evaluator'),
    businessUnit: firstText(casePayload.business_unit, casePayload.businessUnit, input.business_unit, input.businessUnit, input.owner),
    geography: firstText(casePayload.geography, casePayload.region, casePayload.country, input.geography, input.region, input.country),
    supplierName: firstText(casePayload.supplier_name, casePayload.supplierName, casePayload.vendor, input.supplier_name, input.supplierName, input.vendor, 'Submitted compliance case'),
    serviceDescription: firstText(casePayload.service_description, casePayload.serviceDescription, casePayload.service, input.service_description, input.serviceDescription, input.service, query),
    brief: firstText(contextualBrief, casePayload.brief, input.brief, query, 'Evaluate the submitted compliance case.'),
    integrations: [
      ...asArray(casePayload.integrations),
      ...asArray(casePayload.systems),
      ...asArray(input.integrations),
      ...asArray(input.systems)
    ].map(cleanText).filter(Boolean).slice(0, 16),
    riskSignals: [
      ...asArray(casePayload.risk_signals),
      ...asArray(casePayload.riskSignals),
      ...asArray(input.risk_signals),
      ...asArray(input.riskSignals)
    ].map(cleanText).filter(Boolean).slice(0, 16),
    evidenceSignals: [
      ...asArray(casePayload.evidence_signals),
      ...asArray(casePayload.evidenceSignals),
      ...asArray(input.evidence_signals),
      ...asArray(input.evidenceSignals)
    ].map(cleanText).filter(Boolean).slice(0, 16),
    documents: evidence
  };
}

function summarizeTrace(trace = []) {
  return trace.slice(0, 20).map((event) => ({
    eventId: event.eventId || '',
    timestamp: event.timestamp || '',
    agent: event.agent || '',
    eventType: event.eventType || '',
    parentEventId: event.parentEventId || '',
    payload: event.payload || {}
  }));
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    const startedAt = Date.now();
    try {
      const body = raw.trim() ? JSON.parse(raw) : {};
      const caseDraft = buildCaseDraft(body);
      const result = runComplianceAgent(caseDraft, { mode: process.env.AGENT_MODE || 'agentathon_deterministic' });
      const gaps = Array.isArray(result.gaps) ? result.gaps : [];
      const decisionReadiness = result.decisionReadiness || {};
      const response = {
        ok: result.ok !== false,
        run_id: firstText(body.run_id, body.runId, caseDraft.caseId),
        use_case_id: firstText(body.use_case_id, body.useCaseId, USE_CASE_ID),
        case: result.case,
        decision: result.decision || { status: 'blocked', recommendation: result.message || 'Run did not complete.' },
        domains: Array.isArray(result.domains) ? result.domains : [],
        gaps,
        risk_level: gaps.some((gap) => gap?.severity === 'high') ? 'high' : gaps.length ? 'medium' : 'low',
        required_actions: Array.isArray(decisionReadiness.requiredControls) ? decisionReadiness.requiredControls : [],
        control_plan: Array.isArray(result.controlPlan) ? result.controlPlan : [],
        evidence_ids: Array.isArray(result.evidenceIds) ? result.evidenceIds : [],
        citations: Array.isArray(result.citations) ? result.citations : [],
        evidence_quality: result.evidenceQuality || {},
        decision_readiness: decisionReadiness,
        node_trace: summarizeTrace(result.trace),
        execution_time_seconds: Number(((Date.now() - startedAt) / 1000).toFixed(3))
      };
      process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (error) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        error: {
          type: error && error.name ? error.name : 'AgentathonNodeBridgeError',
          message: error instanceof Error ? error.message : String(error || 'Unknown bridge error.'),
          recoverable: true
        },
        execution_time_seconds: Number(((Date.now() - startedAt) / 1000).toFixed(3))
      })}\n`);
      process.exitCode = 1;
    }
  });
}

main();
