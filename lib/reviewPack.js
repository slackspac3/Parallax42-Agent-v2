'use strict';

const crypto = require('node:crypto');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function humanize(value = '') {
  return cleanText(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildReviewerActions(run = {}) {
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  if (!gaps.length) {
    return ['Confirm accountable human approver and record approval decision.'];
  }
  return gaps.slice(0, 8).map((gap) => `${gap.severity || 'unrated'}: ${gap.action || gap.gap || 'Review unresolved control gap.'}`);
}

function buildReviewPack(run = {}, options = {}) {
  if (!run || run.ok === false) {
    throw new Error('A completed council run is required to build a review pack.');
  }
  const caseInfo = run.case || {};
  const decision = run.decision || {};
  const domains = Array.isArray(run.domains) ? run.domains : [];
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  const citations = Array.isArray(run.citations) ? run.citations : [];
  const trace = Array.isArray(run.trace) ? run.trace : [];
  const evidenceIds = Array.isArray(run.evidenceIds) ? run.evidenceIds : [];
  const pack = {
    packType: 'parallax42_compliance_executive_review',
    generatedAt: options.generatedAt || new Date().toISOString(),
    service: 'parallax42-compliance-intelligence-agent',
    case: {
      caseId: cleanText(caseInfo.caseId || ''),
      supplierName: cleanText(caseInfo.supplierName || ''),
      businessUnit: cleanText(caseInfo.businessUnit || ''),
      geography: cleanText(caseInfo.geography || ''),
      integrations: Array.isArray(caseInfo.integrations) ? caseInfo.integrations.map(cleanText).filter(Boolean) : []
    },
    decision: {
      status: cleanText(decision.status || ''),
      recommendation: cleanText(decision.recommendation || ''),
      readinessScore: Number(decision.readinessScore || 0),
      rationale: cleanText(decision.rationale || ''),
      humanApprovalRequired: true
    },
    decisionReadiness: run.decisionReadiness || null,
    evidenceQuality: run.evidenceQuality || null,
    retrievalAudit: run.retrievalAudit || null,
    documentEvidenceImpact: run.documentEvidenceImpact || null,
    domains: domains.map((domain) => ({
      id: domain.id,
      label: domain.label,
      status: domain.status,
      score: domain.score,
      primaryObligation: domain.obligations?.[0] || '',
      controls: domain.controls || []
    })),
    gaps: gaps.map((gap) => ({
      severity: gap.severity,
      gap: gap.gap,
      action: gap.action
    })),
    evidenceManifest: {
      evidenceIds,
      citationCount: citations.length,
      citations: citations.slice(0, 24).map((citation) => ({
        citationId: citation.citationId,
        evidenceId: citation.evidenceId,
        title: citation.title,
        sourceType: citation.sourceType,
        score: Number(citation.score || 0),
        text: cleanText(citation.text || '').slice(0, 900)
      }))
    },
    auditTrace: {
      eventCount: trace.length,
      events: trace.map((event) => ({
        timestamp: event.timestamp,
        agent: event.agent,
        eventType: event.eventType
      }))
    },
    reviewerActions: buildReviewerActions(run),
    controls: {
      deterministicGuardrail: true,
      liveLlmAdvisoryOnly: Boolean(run.orchestration?.liveLlm?.requested),
      noAutomaticApproval: true,
      browserEmbeddingsRetained: false
    }
  };
  return {
    ...pack,
    integrity: {
      algorithm: 'sha256',
      digest: sha256(stableStringify(pack))
    }
  };
}

function buildReviewPackMarkdown(pack = {}) {
  const lines = [
    '# Executive Review Pack',
    '',
    `Generated: ${pack.generatedAt || ''}`,
    `Digest: ${pack.integrity?.digest || ''}`,
    `Case ID: ${pack.case?.caseId || 'unassigned'}`,
    '',
    '## Decision',
    '',
    `Recommendation: ${pack.decision?.recommendation || 'Pending review'}`,
    `Status: ${humanize(pack.decision?.status || 'unknown')}`,
    `Readiness: ${Math.round(Number(pack.decision?.readinessScore || 0) * 100)}%`,
    `Human approval required: ${pack.decision?.humanApprovalRequired ? 'yes' : 'no'}`,
    '',
    '## Evidence Quality',
    '',
    `Status: ${humanize(pack.evidenceQuality?.status || 'unknown')}`,
    `Score: ${pack.evidenceQuality?.score ?? 'n/a'}`,
    `Citations: ${pack.evidenceManifest?.citationCount || 0}`,
    `Retrieval mode: ${humanize(pack.retrievalAudit?.mode || 'not_used')}`,
    '',
    '## Reviewer Actions',
    '',
    ...(pack.reviewerActions || []).map((action, index) => `${index + 1}. ${action}`),
    '',
    '## Blocking Gaps',
    '',
    ...(pack.gaps?.length ? pack.gaps.map((gap, index) => `${index + 1}. ${gap.gap} Required action: ${gap.action}`) : ['No blocking gaps returned by the council.']),
    '',
    '## Evidence Citations',
    '',
    ...(pack.evidenceManifest?.citations?.length
      ? pack.evidenceManifest.citations.map((citation, index) => `${index + 1}. ${citation.evidenceId || citation.citationId} - ${citation.title || 'Evidence'}: ${citation.text || 'No extract available.'}`)
      : ['No citation records returned.']),
    '',
    '## Control Boundary',
    '',
    'This pack is a reviewer artifact. It does not grant operational approval. Final approval remains with the accountable human owner.',
    ''
  ];
  return `${lines.join('\n')}\n`;
}

module.exports = {
  buildReviewPack,
  buildReviewPackMarkdown
};
