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

function hasCaseOwner(run = {}) {
  return Boolean(cleanText(run.case?.businessUnit || run.case?.owner || run.businessUnit));
}

function hasGeography(run = {}) {
  return Boolean(cleanText(run.case?.geography || run.geography));
}

function hasEvidence(run = {}) {
  return Boolean(
    (Array.isArray(run.evidenceIds) && run.evidenceIds.length)
    || (Array.isArray(run.citations) && run.citations.length)
    || (Array.isArray(run.case?.documents) && run.case.documents.length)
  );
}

function hasActionableControls(run = {}) {
  return Boolean(
    (Array.isArray(run.gaps) && run.gaps.some((gap) => cleanText(gap.action || gap.gap)))
    || (Array.isArray(run.decisionReadiness?.requiredControls) && run.decisionReadiness.requiredControls.length)
  );
}

function qualityRubric(run = {}) {
  const readiness = Number(run.decision?.readinessScore || 0);
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  const domains = Array.isArray(run.domains) ? run.domains : [];
  const citations = Array.isArray(run.citations) ? run.citations : [];
  const evidenceQualityScore = Number(run.evidenceQuality?.score || 0);
  const accuracyScore = [
    hasCaseOwner(run) && hasGeography(run),
    hasEvidence(run),
    citations.length > 0 || evidenceQualityScore >= 0.6
  ].filter(Boolean).length;
  const appropriatenessScore = [
    humanApprovalRequired(run),
    domains.length > 0,
    run.controls?.noAutomaticApproval !== false
  ].filter(Boolean).length;
  const actionabilityScore = [
    hasActionableControls(run),
    gaps.length === 0 || gaps.every((gap) => cleanText(gap.action || gap.gap)),
    readiness >= 0.66
  ].filter(Boolean).length;
  const dimensions = [
    {
      name: 'Accuracy',
      score: accuracyScore,
      max: 3,
      evidence: accuracyScore >= 2
        ? 'Case facts and evidence are specific enough for reviewer validation.'
        : 'The reviewer should confirm missing scope, geography, or evidence before relying on the pack.'
    },
    {
      name: 'Appropriateness',
      score: appropriatenessScore,
      max: 3,
      evidence: appropriatenessScore >= 2
        ? 'The recommendation stays inside the compliance domain and preserves human approval.'
        : 'The reviewer should check whether the mapped obligations and approval boundary are complete.'
    },
    {
      name: 'Actionability',
      score: actionabilityScore,
      max: 3,
      evidence: actionabilityScore >= 2
        ? 'The pack gives concrete reviewer actions and a usable next step.'
        : 'The pack needs clearer controls, evidence requests, or owner actions.'
    }
  ];
  const totalScore = dimensions.reduce((sum, item) => sum + item.score, 0);
  return {
    name: 'Council quality rubric',
    scale: '0-9',
    threshold: 7,
    totalScore,
    outcome: totalScore >= 7 ? 'reviewer-ready' : 'ask human before relying',
    dimensions
  };
}

function stopConditions(run = {}) {
  const rubric = qualityRubric(run);
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  const stops = [];
  if (humanApprovalRequired(run)) {
    stops.push('Human approval is required before operational use.');
  }
  if (rubric.totalScore < rubric.threshold) {
    stops.push(`Council quality score is ${rubric.totalScore}/9, below the ${rubric.threshold}/9 reviewer-ready threshold.`);
  }
  if (!hasCaseOwner(run)) stops.push('Accountable owner is missing or weak.');
  if (!hasGeography(run)) stops.push('Geography or regulatory perimeter is missing or weak.');
  if (!hasEvidence(run)) stops.push('Citation-ready evidence is missing.');
  if (gaps.length) stops.push(`${gaps.length} unresolved gap${gaps.length === 1 ? '' : 's'} require reviewer disposition.`);
  return unique(stops).slice(0, 8);
}

function unique(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function agenticPairings(run = {}) {
  const domains = Array.isArray(run.domains) ? run.domains : [];
  const gaps = Array.isArray(run.gaps) ? run.gaps : [];
  const citations = Array.isArray(run.citations) ? run.citations : [];
  return [
    {
      pairing: 'Planner + Doer',
      agents: ['Intake Agent', 'Case Builder'],
      reviewed: 'User intent, active question context, uploaded evidence metadata, and case draft fields.',
      output: hasCaseOwner(run) || hasGeography(run)
        ? 'Converted intake into structured case context for obligation mapping.'
        : 'Kept owner/geography as reviewer-visible gaps instead of guessing.',
      boundary: 'Does not infer accountable ownership without user or evidence support.'
    },
    {
      pairing: 'Proposer + Critic',
      agents: ['Obligation Mapper', 'Risk & Controls Analyst'],
      reviewed: `${domains.length} mapped domain${domains.length === 1 ? '' : 's'} and ${gaps.length} control gap${gaps.length === 1 ? '' : 's'}.`,
      output: gaps.length
        ? 'Converted weak obligations into explicit reviewer actions.'
        : 'Validated that no blocking control gap remained in the deterministic map.',
      boundary: 'Can challenge or escalate the recommendation, but cannot approve it.'
    },
    {
      pairing: 'Context-Packer + Actor',
      agents: ['Evidence Examiner', 'Deterministic Council'],
      reviewed: `${citations.length} citation${citations.length === 1 ? '' : 's'} plus attached document context.`,
      output: citations.length
        ? 'Packed cited evidence into the deterministic decision record.'
        : 'Marked the decision as context-led and evidence-limited.',
      boundary: 'Evidence snippets support review; raw indexed vectors stay server-side.'
    },
    {
      pairing: 'Evidence-Weaver + Synthesizer',
      agents: ['Evidence Examiner', 'Audit Packager'],
      reviewed: 'Evidence IDs, risk findings, reviewer actions, runtime trace, and export fields.',
      output: 'Synthesized a reviewer pack with decision memo, evidence, actions, and audit trace.',
      boundary: 'Produces reviewer artifacts only; final sign-off remains human-owned.'
    }
  ];
}

function runLog(run = {}) {
  const trace = Array.isArray(run.trace) ? run.trace : [];
  if (trace.length) {
    return trace.slice(0, 8).map((event, index) => ({
      step: index + 1,
      actor: cleanText(event.agent || event.eventType || `trace_${index + 1}`),
      action: cleanText(event.eventType || 'trace event'),
      result: cleanText(event.summary || event.message || event.status || 'recorded'),
      timestamp: cleanText(event.timestamp || '')
    }));
  }
  return agentFindings(run).map((finding, index) => ({
    step: index + 1,
    actor: finding.name,
    action: humanize(finding.status),
    result: finding.finding,
    timestamp: ''
  }));
}

function agentLoopSpec(run = {}) {
  const rubric = qualityRubric(run);
  return {
    autonomy: {
      level: 'L2 governed loop with stops',
      rationale: 'The system can loop through intake, retrieval, mapping, and packaging, but stops at evidence gaps, low rubric score, or human approval.'
    },
    goal: 'Prepare a human-review-ready compliance decision pack with cited evidence, explicit gaps, and no automated approval.',
    plan: [
      'Understand the user request and normalize the working case.',
      'Retrieve or inspect evidence and reference memory before asking for more context.',
      'Map obligations, risks, and required controls with deterministic logic.',
      'Challenge weak evidence or missing owner context before packaging.',
      'Export a reviewer pack with decision rationale, actions, citations, and audit trace.'
    ],
    tools: [
      {
        name: 'Conversation intake',
        input: 'Latest user turn, active question, case draft, and conversation history.',
        output: 'Structured case updates plus one next best question.',
        failMode: 'If smart intake is unavailable, show the fallback clearly and preserve deterministic case building.'
      },
      {
        name: 'Evidence retrieval',
        input: 'Uploaded document metadata, extracted snippets, embeddings, and case scope.',
        output: 'Safe citations and snippets for reviewer-visible reasoning.',
        failMode: 'If semantic retrieval is unavailable, continue with metadata-only evidence and disclose the limitation.'
      },
      {
        name: 'Deterministic council',
        input: 'Case facts, evidence, mapped obligations, and reviewer gaps.',
        output: 'Decision recommendation, domains, gaps, controls, and trace.',
        failMode: 'Never auto-approve; route weak or incomplete context to human review.'
      },
      {
        name: 'Governed learning memory',
        input: 'Reviewer outcomes, similar cases, and control patterns.',
        output: 'Advisory precedent suggestions only.',
        failMode: 'Do not train models or silently alter the deterministic decision.'
      },
      {
        name: 'Audit packager',
        input: 'Decision output, citations, trace, rubric, and human actions.',
        output: 'Hashable review artifact and PDF-ready pack.',
        failMode: 'If export fails, keep the visible decision room and raw JSON available.'
      }
    ],
    memory: [
      {
        lane: 'Scratchpad',
        kept: 'Current case draft, active question, latest user intent, and missing facts.',
        retention: 'Session-scoped browser/server state.'
      },
      {
        lane: 'Episodic log',
        kept: 'Audit trace, evidence IDs, decision events, and reviewer feedback.',
        retention: 'Append-only audit or configured memory store.'
      },
      {
        lane: 'Reusable knowledge',
        kept: 'Reference intelligence, prior reviewer patterns, and control suggestions.',
        retention: 'Advisory retrieval memory; not model training.'
      }
    ],
    rubric,
    stopConditions: stopConditions(run),
    runLog: runLog(run),
    guardrails: [
      'No automatic approval.',
      'Do not invent evidence or unsupported citations.',
      'Advisory LLM output cannot override deterministic decisioning.',
      'Ask a human when quality score is below 7/9 or required proof is missing.',
      'Log why a case stopped, escalated, or remained review-bound.'
    ]
  };
}

function buildDecisionRoomModel(run = {}) {
  const evidence = evidenceUsed(run);
  const risks = riskSummary(run);
  const actions = reviewerActions(run);
  const rubric = qualityRubric(run);
  const loopSpec = agentLoopSpec(run);
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
    agenticPairings: agenticPairings(run),
    agentLoopSpec: loopSpec,
    autonomyModel: loopSpec.autonomy,
    qualityRubric: rubric,
    stopConditions: loopSpec.stopConditions,
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
