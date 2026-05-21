'use strict';

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function humanize(value = '') {
  return cleanText(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percent(value = 0) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0) * 100)));
}

function humanApprovalRequired(run = {}) {
  return run.humanApprovalRequired !== false
    && run.decision?.humanApprovalRequired !== false
    && run.controls?.noAutomaticApproval !== false;
}

function decisionHeadline(run = {}) {
  const recommendation = cleanText(run.decision?.recommendation || run.decision?.status || '');
  if (/not approve|not ready|blocked/i.test(recommendation)) return 'Do not approve yet';
  if (/conditional|human approval|ready/i.test(recommendation)) return 'Ready for human review';
  if (/approve/i.test(recommendation)) return 'Approval candidate';
  return recommendation || 'Review required';
}

function decisionMemo(run = {}) {
  const decision = run.decision || {};
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  const evidenceIds = Array.isArray(run.evidenceIds) ? run.evidenceIds : [];
  const rationale = cleanText(decision.rationale);
  if (rationale) return rationale;
  if (gaps.length) {
    return `The council found ${gaps.length} unresolved control item${gaps.length === 1 ? '' : 's'} before approval. Human review must confirm remediation and evidence sufficiency.`;
  }
  return `The supplied case is review-ready with ${evidenceIds.length} evidence identifier${evidenceIds.length === 1 ? '' : 's'} linked. Human approval remains required before operational use.`;
}

function whyItems(run = {}) {
  const items = [];
  const decision = run.decision || {};
  const domains = Array.isArray(run.domains) ? run.domains : [];
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  const citations = Array.isArray(run.citations) ? run.citations : [];
  if (cleanText(decision.rationale)) items.push(cleanText(decision.rationale));
  if (domains.length) items.push(`${domains.length} compliance domain${domains.length === 1 ? '' : 's'} were mapped from the case context.`);
  if (citations.length) items.push(`${citations.length} citation${citations.length === 1 ? '' : 's'} were available for evidence review.`);
  if (gaps.length) items.push(`${gaps.length} gap${gaps.length === 1 ? '' : 's'} require human remediation or risk acceptance.`);
  if (!items.length) items.push('The deterministic council produced a reviewer-bound decision from the available case context.');
  return items.slice(0, 5);
}

function riskSummary(run = {}) {
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  const domains = Array.isArray(run.domains) ? run.domains : [];
  if (gaps.length) {
    return gaps.slice(0, 6).map((gap) => ({
      label: cleanText(gap.gap || 'Unresolved control gap'),
      severity: cleanText(gap.severity || 'review'),
      detail: cleanText(gap.action || 'Reviewer action required.')
    }));
  }
  return domains
    .filter((domain) => /applicable|needs|confirmation/i.test(domain.status || ''))
    .slice(0, 6)
    .map((domain) => ({
      label: cleanText(domain.label || domain.id || 'Mapped domain'),
      severity: /needs|confirmation/i.test(domain.status || '') ? 'review' : 'mapped',
      detail: cleanText(domain.obligations?.[0] || 'Mapped without a blocking gap.')
    }));
}

function evidenceUsed(run = {}) {
  const citations = Array.isArray(run.citations) ? run.citations : [];
  const documents = Array.isArray(run.case?.documents) ? run.case.documents : [];
  const source = citations.length ? citations : documents;
  return source.slice(0, 10).map((doc, index) => ({
    id: cleanText(doc.evidenceId || doc.sourceEvidenceId || doc.citationId || `DOC-${String(index + 1).padStart(2, '0')}`),
    title: cleanText(doc.title || doc.fileName || `Evidence ${index + 1}`),
    snippet: cleanText(doc.text || doc.excerpt || doc.summary || '').slice(0, 700),
    status: cleanText(doc.extractionStatus || doc.sourceType || (doc.score ? `score ${Number(doc.score || 0).toFixed(2)}` : 'attached'))
  }));
}

function reviewerActions(run = {}) {
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  if (gaps.length) {
    return gaps.slice(0, 8).map((gap) => cleanText(gap.action || gap.gap || 'Review unresolved control gap.'));
  }
  return ['Confirm accountable human approver, evidence sufficiency, and final approval decision.'];
}

function agentFindings(run = {}) {
  const domains = Array.isArray(run.domains) ? run.domains : [];
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  const citations = Array.isArray(run.citations) ? run.citations : [];
  const approvalRequired = humanApprovalRequired(run);
  return [
    {
      name: 'Intake Agent',
      status: run.case?.businessUnit && run.case?.geography ? 'validated' : 'escalated',
      finding: run.case?.businessUnit && run.case?.geography
        ? 'Case scope, owner, and geography were present enough for council review.'
        : 'Owner or geography remains weak and requires reviewer confirmation.'
    },
    {
      name: 'Obligation Mapper',
      status: domains.some((domain) => /confirmation|needs/i.test(domain.status || '')) ? 'challenged' : 'validated',
      finding: `${domains.length} compliance domain${domains.length === 1 ? '' : 's'} were mapped.`
    },
    {
      name: 'Evidence Examiner',
      status: citations.length ? 'validated' : 'challenged',
      finding: citations.length
        ? `${citations.length} citation${citations.length === 1 ? '' : 's'} linked to the decision.`
        : 'No citation-ready evidence was available.'
    },
    {
      name: 'Risk & Controls Analyst',
      status: gaps.length ? 'escalated' : 'validated',
      finding: gaps.length
        ? `${gaps.length} required action${gaps.length === 1 ? '' : 's'} were produced.`
        : 'No blocking control gap remained.'
    },
    {
      name: 'Responsible AI Reviewer',
      status: approvalRequired ? 'changed' : 'challenged',
      finding: approvalRequired
        ? 'No auto-approval boundary was enforced.'
        : 'Human approval boundary needs confirmation.'
    },
    {
      name: 'Audit Packager',
      status: 'validated',
      finding: 'Decision, trace, evidence IDs, and reviewer actions are ready for export.'
    }
  ];
}

function buildDecisionRoomModel(run = {}) {
  const evidence = evidenceUsed(run);
  const risks = riskSummary(run);
  const actions = reviewerActions(run);
  return {
    decision: {
      status: cleanText(run.decision?.status || ''),
      headline: decisionHeadline(run),
      recommendation: cleanText(run.decision?.recommendation || ''),
      memo: decisionMemo(run),
      readinessPercent: percent(run.decision?.readinessScore),
      humanApprovalRequired: humanApprovalRequired(run),
      finalDecisionOwner: 'deterministic compliance engine'
    },
    case: {
      caseId: cleanText(run.case?.caseId || ''),
      supplierName: cleanText(run.case?.supplierName || ''),
      businessUnit: cleanText(run.case?.businessUnit || ''),
      geography: cleanText(run.case?.geography || ''),
      integrations: Array.isArray(run.case?.integrations) ? run.case.integrations.map(cleanText).filter(Boolean) : []
    },
    why: whyItems(run),
    risks,
    evidence,
    agentFindings: agentFindings(run),
    requiredHumanActions: actions,
    metrics: {
      domains: Array.isArray(run.domains) ? run.domains.length : 0,
      gaps: Array.isArray(run.gaps) ? run.gaps.length : 0,
      evidenceIds: Array.isArray(run.evidenceIds) ? run.evidenceIds.length : 0,
      citations: Array.isArray(run.citations) ? run.citations.length : 0,
      evidenceQuality: humanize(run.evidenceQuality?.status || 'not scored')
    }
  };
}

module.exports = {
  buildDecisionRoomModel
};
