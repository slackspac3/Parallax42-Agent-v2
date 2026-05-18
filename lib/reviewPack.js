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
  const retrievalContext = run.retrievalContext || run.case?.retrievalContext || {};
  const llmOutput = run.orchestration?.llmOutput || run.runtime?.llmOutput || null;
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
    retrievalContext: {
      evidenceMatches: (retrievalContext.evidenceMatches || retrievalContext.matches || []).slice(0, 8).map((match) => ({
        evidenceId: cleanText(match.evidenceId || ''),
        title: cleanText(match.title || ''),
        score: Number(match.score || 0),
        snippet: cleanText(match.snippet || match.text || '').slice(0, 700)
      })),
      similarCases: (retrievalContext.similarCases || []).slice(0, 6).map((item) => ({
        memoryId: cleanText(item.memoryId || ''),
        caseId: cleanText(item.caseId || ''),
        artifactType: cleanText(item.artifactType || ''),
        confidence: Number(item.confidence || item.score || 0),
        summary: cleanText(item.summary || item.text || item.reviewerNotes || '').slice(0, 700)
      })),
      learningSuggestions: retrievalContext.learningSuggestions || null,
      missingEvidenceSignals: Array.isArray(retrievalContext.missingEvidenceSignals)
        ? retrievalContext.missingEvidenceSignals.map(cleanText).filter(Boolean).slice(0, 8)
        : []
    },
    advisory: {
      requested: Boolean(run.orchestration?.liveLlm?.requested || run.runtime?.llm?.requested),
      outputAvailable: Boolean(llmOutput?.outputAvailable),
      advisoryOnly: true,
      specialists: (Array.isArray(llmOutput?.specialists) ? llmOutput.specialists : []).slice(0, 6).map((item) => ({
        specialist: cleanText(item.specialist || ''),
        assessment: cleanText(item.assessment || ''),
        confidence: Number(item.confidence || 0),
        advisoryUnavailable: Boolean(item.advisoryUnavailable),
        unresolvedRisks: Array.isArray(item.unresolvedRisks) ? item.unresolvedRisks.map(cleanText).filter(Boolean).slice(0, 5) : [],
        recommendedActions: Array.isArray(item.recommendedActions) ? item.recommendedActions.map(cleanText).filter(Boolean).slice(0, 5) : []
      }))
    },
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

function pdfSafeText(value = '') {
  return cleanText(value)
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

const PDF_PAGE = { width: 792, height: 612 };
const PDF_COLORS = {
  bg: '#061512',
  panel: '#0C211C',
  panel2: '#102C25',
  border: '#245448',
  mint: '#18E0B7',
  mintDark: '#0B8E76',
  cyan: '#8FE8F2',
  lavender: '#BFA6FF',
  amber: '#F4C95D',
  red: '#FF7A7A',
  white: '#F4FFF9',
  muted: '#A9BBB4',
  dim: '#6E827A',
  ink: '#07120F'
};

function hexRgb(hex = '#000000') {
  const clean = hex.replace('#', '');
  const number = parseInt(clean.length === 3 ? clean.split('').map((c) => `${c}${c}`).join('') : clean, 16);
  return [
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255
  ].map((value) => Number(value.toFixed(3)));
}

function fillColor(hex) {
  const [r, g, b] = hexRgb(hex);
  return `${r} ${g} ${b} rg`;
}

function strokeColor(hex) {
  const [r, g, b] = hexRgb(hex);
  return `${r} ${g} ${b} RG`;
}

function truncateText(value = '', max = 120) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function percentValue(value = 0) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0) * 100)));
}

function wrapTextForBox(text = '', maxChars = 58, maxLines = 5) {
  const words = cleanText(text).split(' ').filter(Boolean).flatMap((word) => {
    if (word.length <= maxChars) return [word];
    const parts = [];
    for (let index = 0; index < word.length; index += maxChars) parts.push(word.slice(index, index + maxChars));
    return parts;
  });
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const output = lines.slice(0, maxLines);
    output[maxLines - 1] = truncateText(output[maxLines - 1], maxChars);
    return output;
  }
  return lines.length ? lines : [''];
}

function severityColor(severity = '') {
  if (/critical|high/i.test(severity)) return PDF_COLORS.red;
  if (/medium|moderate/i.test(severity)) return PDF_COLORS.amber;
  return PDF_COLORS.mint;
}

function statusColor(status = '') {
  if (/not|block|reject|gap|fail|conditional/i.test(status)) return PDF_COLORS.amber;
  if (/ready|approve|complete|pass/i.test(status)) return PDF_COLORS.mint;
  return PDF_COLORS.cyan;
}

function createPdfCanvas() {
  const ops = [];
  const rect = (x, y, w, h, fill = PDF_COLORS.panel, stroke = '') => {
    ops.push('q');
    ops.push(fillColor(fill));
    if (stroke) ops.push(strokeColor(stroke));
    ops.push(`${x} ${y} ${w} ${h} re ${stroke ? 'B' : 'f'}`);
    ops.push('Q');
  };
  const line = (x1, y1, x2, y2, color = PDF_COLORS.border, width = 1) => {
    ops.push('q');
    ops.push(strokeColor(color));
    ops.push(`${width} w`);
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    ops.push('Q');
  };
  const text = (value, x, y, options = {}) => {
    const size = options.size || 10;
    const font = options.bold ? 'F2' : options.mono ? 'F3' : 'F1';
    ops.push('BT');
    ops.push(fillColor(options.color || PDF_COLORS.white));
    ops.push(`/${font} ${size} Tf`);
    ops.push(`1 0 0 1 ${x} ${y} Tm`);
    ops.push(`(${pdfSafeText(value)}) Tj`);
    ops.push('ET');
  };
  const wrappedText = (value, x, y, options = {}) => {
    const size = options.size || 10;
    const lineHeight = options.lineHeight || Math.max(12, size + 4);
    const lines = wrapTextForBox(value, options.maxChars || 70, options.maxLines || 5);
    lines.forEach((lineText, index) => text(lineText, x, y - (index * lineHeight), options));
    return y - (lines.length * lineHeight);
  };
  const pill = (label, x, y, w, color = PDF_COLORS.mint) => {
    rect(x, y, w, 22, PDF_COLORS.panel2, color);
    text(label, x + 10, y + 7, { size: 8, bold: true, color });
  };
  const sectionLabel = (label, x, y) => {
    text(label.toUpperCase(), x, y, { size: 8, bold: true, color: PDF_COLORS.mint });
    line(x, y - 8, x + 94, y - 8, PDF_COLORS.mint, 1.4);
  };
  const progress = (x, y, w, h, pct, color = PDF_COLORS.mint) => {
    rect(x, y, w, h, '#1A2D28');
    rect(x, y, Math.max(4, Math.round(w * Math.max(0, Math.min(100, pct)) / 100)), h, color);
  };
  const tile = (label, value, x, y, w, h, color = PDF_COLORS.mint) => {
    rect(x, y, w, h, PDF_COLORS.panel, PDF_COLORS.border);
    text(label.toUpperCase(), x + 12, y + h - 18, { size: 7, bold: true, color });
    wrappedText(String(value || '--'), x + 12, y + 18, { size: 18, bold: true, color: PDF_COLORS.white, maxChars: Math.max(8, Math.floor(w / 8)), maxLines: 2, lineHeight: 21 });
  };
  const footer = (pageNumber, title = '') => {
    line(42, 36, 750, 36, '#16352E', 0.8);
    text('Parallax42 Compliance Intelligence Agent', 42, 20, { size: 8, color: PDF_COLORS.dim });
    text(title, 315, 20, { size: 8, color: PDF_COLORS.dim });
    text(`slide ${pageNumber}`, 713, 20, { size: 8, color: PDF_COLORS.dim });
  };
  return { ops, rect, line, text, wrappedText, pill, sectionLabel, progress, tile, footer };
}

function addBackground(canvas) {
  canvas.rect(0, 0, PDF_PAGE.width, PDF_PAGE.height, PDF_COLORS.bg);
  canvas.rect(0, 548, PDF_PAGE.width, 64, '#071B16');
  canvas.line(42, 548, 750, 548, '#183D34', 1);
  canvas.rect(42, 570, 28, 22, PDF_COLORS.panel2, PDF_COLORS.mint);
  canvas.text('P42', 49, 577, { size: 8, bold: true, color: PDF_COLORS.mint });
}

function decisionMemo(pack = {}) {
  const recommendation = pack.decision?.recommendation || 'Pending human review.';
  const rationale = pack.decision?.rationale || 'The deterministic council produced this pack for accountable human review.';
  const riskCount = pack.gaps?.length || 0;
  if (!riskCount) return `${recommendation} No blocking gaps remain in the current evidence set. ${rationale}`;
  return `${recommendation} The council found ${riskCount} blocking gap${riskCount === 1 ? '' : 's'} requiring owner confirmation before approval. ${rationale}`;
}

function drawCoverSlide(canvas, pack = {}) {
  const readiness = percentValue(pack.decision?.readinessScore);
  const status = humanize(pack.decision?.status || 'review');
  const statusTone = statusColor(`${status} ${pack.decision?.recommendation || ''}`);
  addBackground(canvas);
  canvas.text('EXECUTIVE REVIEW PACK', 92, 580, { size: 9, bold: true, color: PDF_COLORS.mint });
  canvas.text('Compliance Mission Control', 42, 508, { size: 34, bold: true, color: PDF_COLORS.white });
  canvas.wrappedText(pack.case?.supplierName || 'Compliance case awaiting named workflow', 42, 474, {
    size: 15,
    color: PDF_COLORS.muted,
    maxChars: 54,
    maxLines: 2,
    lineHeight: 18
  });
  canvas.pill(status, 42, 424, 166, statusTone);
  canvas.wrappedText(decisionMemo(pack), 42, 388, {
    size: 12,
    color: PDF_COLORS.white,
    maxChars: 68,
    maxLines: 6,
    lineHeight: 16
  });
  canvas.rect(464, 402, 286, 118, PDF_COLORS.panel, PDF_COLORS.border);
  canvas.text('Decision Owner', 486, 492, { size: 8, bold: true, color: PDF_COLORS.mint });
  canvas.text('Deterministic Council', 486, 466, { size: 21, bold: true, color: PDF_COLORS.white });
  canvas.text('Human approval required', 486, 438, { size: 12, bold: true, color: PDF_COLORS.amber });
  canvas.wrappedText('This artifact supports review. It does not grant operational approval or silently apply learning memory.', 486, 419, {
    size: 9,
    color: PDF_COLORS.muted,
    maxChars: 44,
    maxLines: 2
  });

  canvas.tile('Readiness', `${readiness}%`, 42, 260, 152, 86, readiness >= 80 ? PDF_COLORS.mint : PDF_COLORS.amber);
  canvas.tile('Blocking Gaps', String(pack.gaps?.length || 0), 208, 260, 152, 86, pack.gaps?.length ? PDF_COLORS.red : PDF_COLORS.mint);
  canvas.tile('Citations', String(pack.evidenceManifest?.citationCount || 0), 374, 260, 152, 86, PDF_COLORS.cyan);
  canvas.tile('Domains', String(pack.domains?.length || 0), 540, 260, 152, 86, PDF_COLORS.lavender);
  canvas.text('Case readiness', 42, 220, { size: 8, bold: true, color: PDF_COLORS.mint });
  canvas.progress(42, 202, 650, 14, readiness, readiness >= 80 ? PDF_COLORS.mint : PDF_COLORS.amber);
  canvas.text(`${readiness}% review-ready`, 704, 202, { size: 10, bold: true, color: PDF_COLORS.white });

  const context = [
    ['Business unit', pack.case?.businessUnit || 'not provided'],
    ['Geography', pack.case?.geography || 'not provided'],
    ['Integrations', (pack.case?.integrations || []).join(', ') || 'not provided'],
    ['Digest', pack.integrity?.digest ? pack.integrity.digest.slice(0, 20) : 'pending']
  ];
  context.forEach(([label, value], index) => {
    const x = 42 + (index % 2) * 325;
    const y = 132 - Math.floor(index / 2) * 42;
    canvas.text(label.toUpperCase(), x, y + 18, { size: 7, bold: true, color: PDF_COLORS.dim });
    canvas.wrappedText(value, x, y, { size: 10, bold: true, color: PDF_COLORS.white, maxChars: 44, maxLines: 1 });
  });
  canvas.footer(1, 'decision snapshot');
}

function drawDecisionSlide(canvas, pack = {}) {
  addBackground(canvas);
  canvas.text('Decision Room', 92, 580, { size: 9, bold: true, color: PDF_COLORS.mint });
  canvas.text('Executive memo and required actions', 42, 512, { size: 27, bold: true, color: PDF_COLORS.white });
  canvas.rect(42, 314, 438, 162, PDF_COLORS.panel, PDF_COLORS.border);
  canvas.sectionLabel('Decision memo', 62, 446);
  canvas.wrappedText(decisionMemo(pack), 62, 415, { size: 12, color: PDF_COLORS.white, maxChars: 64, maxLines: 7, lineHeight: 16 });

  canvas.rect(500, 314, 250, 162, PDF_COLORS.panel, PDF_COLORS.border);
  canvas.sectionLabel('Review boundary', 520, 446);
  canvas.text('NO AUTO-APPROVAL', 520, 410, { size: 20, bold: true, color: PDF_COLORS.amber });
  canvas.wrappedText('Final approval must be recorded by the accountable human owner. Advisory LLM output and learning memory cannot override the deterministic decision.', 520, 382, {
    size: 10,
    color: PDF_COLORS.muted,
    maxChars: 34,
    maxLines: 5,
    lineHeight: 14
  });

  canvas.sectionLabel('Top risk summary', 42, 270);
  const risks = pack.gaps?.length ? pack.gaps.slice(0, 3) : [{ severity: 'none', gap: 'No blocking gaps returned by the council.', action: 'Confirm accountable human approver before operational use.' }];
  risks.forEach((gap, index) => {
    const x = 42 + (index * 238);
    canvas.rect(x, 132, 218, 112, PDF_COLORS.panel, PDF_COLORS.border);
    canvas.text(humanize(gap.severity || 'review'), x + 14, 220, { size: 8, bold: true, color: severityColor(gap.severity) });
    canvas.wrappedText(gap.gap || 'Review unresolved gap.', x + 14, 194, { size: 11, bold: true, color: PDF_COLORS.white, maxChars: 28, maxLines: 3, lineHeight: 14 });
    canvas.wrappedText(gap.action || 'Record reviewer disposition.', x + 14, 143, { size: 8.5, color: PDF_COLORS.muted, maxChars: 33, maxLines: 3, lineHeight: 11 });
  });

  canvas.sectionLabel('Reviewer action queue', 42, 94);
  (pack.reviewerActions || []).slice(0, 3).forEach((action, index) => {
    canvas.text(`0${index + 1}`, 42 + (index * 238), 65, { size: 14, bold: true, color: PDF_COLORS.mint });
    canvas.wrappedText(action, 72 + (index * 238), 68, { size: 9.5, color: PDF_COLORS.white, maxChars: 27, maxLines: 3, lineHeight: 12 });
  });
  canvas.footer(2, 'executive decision');
}

function drawEvidenceSlide(canvas, pack = {}) {
  addBackground(canvas);
  const evidenceQuality = `${humanize(pack.evidenceQuality?.status || 'unknown')} (${pack.evidenceQuality?.score ?? 'n/a'})`;
  const retrievalMatches = pack.retrievalContext?.evidenceMatches || [];
  const similarCases = pack.retrievalContext?.similarCases || [];
  canvas.text('Evidence Intelligence', 92, 580, { size: 9, bold: true, color: PDF_COLORS.mint });
  canvas.text('Citations, RAG memory, and learning signals', 42, 512, { size: 27, bold: true, color: PDF_COLORS.white });
  canvas.tile('Evidence Quality', evidenceQuality, 42, 404, 220, 78, PDF_COLORS.cyan);
  canvas.tile('RAG Matches', String(retrievalMatches.length || pack.retrievalAudit?.matchCount || 0), 286, 404, 140, 78, PDF_COLORS.mint);
  canvas.tile('Similar Cases', String(similarCases.length), 450, 404, 140, 78, PDF_COLORS.lavender);
  canvas.tile('Retrieval Mode', humanize(pack.retrievalAudit?.mode || 'not used'), 614, 404, 136, 78, PDF_COLORS.amber);

  canvas.sectionLabel('Evidence used', 42, 360);
  const citations = pack.evidenceManifest?.citations?.length ? pack.evidenceManifest.citations.slice(0, 4) : [{ title: 'No citation records returned.', text: 'Run with indexed evidence to populate citation-ready extracts.' }];
  citations.forEach((citation, index) => {
    const y = 297 - (index * 62);
    canvas.rect(42, y, 438, 50, PDF_COLORS.panel, PDF_COLORS.border);
    canvas.text(citation.evidenceId || citation.citationId || `CITE-${index + 1}`, 58, y + 31, { size: 8, bold: true, color: PDF_COLORS.mint });
    canvas.wrappedText(citation.title || 'Evidence citation', 128, y + 31, { size: 10, bold: true, color: PDF_COLORS.white, maxChars: 44, maxLines: 1 });
    canvas.wrappedText(citation.text || 'No extract available.', 58, y + 14, { size: 8.5, color: PDF_COLORS.muted, maxChars: 69, maxLines: 1 });
  });

  canvas.sectionLabel('Governed learning memory', 512, 360);
  const controls = pack.retrievalContext?.learningSuggestions?.commonControlsReviewersAdded || [];
  const missing = pack.retrievalContext?.missingEvidenceSignals || [];
  const learningRows = [
    `Similar cases: ${similarCases.length}`,
    `Reviewer patterns: ${controls.length}`,
    `Repeated missing evidence: ${missing.length ? missing.slice(0, 3).join(', ') : 'none found'}`,
    'Decision impact: advisory only'
  ];
  learningRows.forEach((row, index) => {
    canvas.rect(512, 301 - (index * 46), 238, 34, PDF_COLORS.panel, PDF_COLORS.border);
    canvas.wrappedText(row, 526, 312 - (index * 46), { size: 9.5, bold: index === 3, color: index === 3 ? PDF_COLORS.amber : PDF_COLORS.white, maxChars: 33, maxLines: 1 });
  });
  canvas.wrappedText('Learning memory supports reviewer consistency. It is not model training and does not change the deterministic council result.', 512, 94, {
    size: 9.5,
    color: PDF_COLORS.muted,
    maxChars: 36,
    maxLines: 3,
    lineHeight: 13
  });
  canvas.footer(3, 'evidence and memory');
}

function drawActionBoardSlide(canvas, pack = {}) {
  addBackground(canvas);
  const readiness = percentValue(pack.decision?.readinessScore);
  const reviewerActions = pack.reviewerActions?.length
    ? pack.reviewerActions.slice(0, 5)
    : ['Confirm accountable human approver and record approval decision.'];
  const gaps = pack.gaps?.length
    ? pack.gaps.slice(0, 4)
    : [{ severity: 'review', gap: 'No blocking gaps returned.', action: 'Confirm accountable human approval before operational use.' }];
  canvas.text('Reviewer Action Board', 92, 580, { size: 9, bold: true, color: PDF_COLORS.mint });
  canvas.text('What a human reviewer must do next', 42, 512, { size: 27, bold: true, color: PDF_COLORS.white });
  canvas.wrappedText('The council recommendation is review-ready, not approval-complete. This board separates evidence-supported findings from the decisions that must remain with a human owner.', 42, 482, {
    size: 11,
    color: PDF_COLORS.muted,
    maxChars: 90,
    maxLines: 2,
    lineHeight: 15
  });

  canvas.rect(42, 342, 244, 104, PDF_COLORS.panel, PDF_COLORS.border);
  canvas.text('Human approval boundary', 62, 414, { size: 8, bold: true, color: PDF_COLORS.amber });
  canvas.text('Locked', 62, 384, { size: 24, bold: true, color: PDF_COLORS.white });
  canvas.wrappedText('No operational approval is granted until the accountable reviewer confirms the required actions.', 62, 360, {
    size: 9,
    color: PDF_COLORS.muted,
    maxChars: 34,
    maxLines: 3
  });

  canvas.rect(310, 342, 196, 104, PDF_COLORS.panel, PDF_COLORS.border);
  canvas.text('Readiness', 330, 414, { size: 8, bold: true, color: readiness >= 80 ? PDF_COLORS.mint : PDF_COLORS.amber });
  canvas.text(`${readiness}%`, 330, 386, { size: 28, bold: true, color: PDF_COLORS.white });
  canvas.progress(330, 358, 138, 10, readiness, readiness >= 80 ? PDF_COLORS.mint : PDF_COLORS.amber);

  canvas.rect(530, 342, 220, 104, PDF_COLORS.panel, PDF_COLORS.border);
  canvas.text('Pack integrity', 550, 414, { size: 8, bold: true, color: PDF_COLORS.cyan });
  canvas.wrappedText(pack.integrity?.digest ? pack.integrity.digest.slice(0, 36) : 'digest pending', 550, 388, {
    size: 13,
    bold: true,
    color: PDF_COLORS.white,
    maxChars: 22,
    maxLines: 2,
    lineHeight: 15
  });
  canvas.text('sha256', 550, 356, { size: 9, color: PDF_COLORS.dim });

  canvas.sectionLabel('Required human actions', 42, 300);
  reviewerActions.forEach((action, index) => {
    const y = 255 - (index * 38);
    canvas.rect(42, y, 438, 28, index % 2 ? '#0E261F' : PDF_COLORS.panel, PDF_COLORS.border);
    canvas.text(String(index + 1).padStart(2, '0'), 56, y + 9, { size: 10, bold: true, color: PDF_COLORS.mint });
    canvas.wrappedText(action, 86, y + 12, { size: 9.2, color: PDF_COLORS.white, maxChars: 58, maxLines: 1 });
  });

  canvas.sectionLabel('Risk disposition', 512, 300);
  gaps.forEach((gap, index) => {
    const y = 246 - (index * 48);
    const tone = severityColor(gap.severity);
    canvas.rect(512, y, 238, 38, PDF_COLORS.panel, PDF_COLORS.border);
    canvas.text(humanize(gap.severity || 'review'), 526, y + 21, { size: 7.5, bold: true, color: tone });
    canvas.wrappedText(gap.gap || 'Review item', 526, y + 9, { size: 8.6, color: PDF_COLORS.white, maxChars: 34, maxLines: 1 });
  });

  canvas.wrappedText('Reviewer artifact only. Learning memory and advisory specialists may inform context, but final approval is not automated.', 42, 58, {
    size: 9,
    color: PDF_COLORS.dim,
    maxChars: 96,
    maxLines: 2
  });
  canvas.footer(4, 'reviewer action board');
}

function drawCouncilSlide(canvas, pack = {}) {
  addBackground(canvas);
  canvas.text('Council Trace', 92, 580, { size: 9, bold: true, color: PDF_COLORS.mint });
  canvas.text('Specialist validation and audit trail', 42, 512, { size: 27, bold: true, color: PDF_COLORS.white });
  const specialists = pack.advisory?.specialists?.length
    ? pack.advisory.specialists
    : [
      { specialist: 'Intake Agent', assessment: 'Case context normalized for deterministic review.', confidence: 1 },
      { specialist: 'Obligation Mapper', assessment: 'Domains and obligations mapped from case context.', confidence: 1 },
      { specialist: 'Evidence Examiner', assessment: 'Evidence identifiers and citation coverage inspected.', confidence: 1 },
      { specialist: 'Risk & Controls Analyst', assessment: 'Gaps converted into required reviewer actions.', confidence: 1 },
      { specialist: 'Responsible AI Reviewer', assessment: 'Human approval boundary and unsupported certainty checked.', confidence: 1 },
      { specialist: 'Audit Packager', assessment: 'Decision, trace, citations, and digest packaged for review.', confidence: 1 }
    ];
  specialists.slice(0, 6).forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 42 + col * 238;
    const y = 332 - row * 132;
    const tone = item.advisoryUnavailable ? PDF_COLORS.amber : PDF_COLORS.mint;
    canvas.rect(x, y, 218, 104, PDF_COLORS.panel, PDF_COLORS.border);
    canvas.text(String(index + 1).padStart(2, '0'), x + 14, y + 74, { size: 16, bold: true, color: tone });
    canvas.wrappedText(item.specialist || 'Specialist', x + 50, y + 78, { size: 11, bold: true, color: PDF_COLORS.white, maxChars: 24, maxLines: 2, lineHeight: 13 });
    canvas.wrappedText(item.assessment || 'Deterministic validation step completed.', x + 14, y + 45, { size: 8.5, color: PDF_COLORS.muted, maxChars: 32, maxLines: 3, lineHeight: 11 });
  });

  canvas.sectionLabel('Audit and control strip', 42, 160);
  const auditRows = [
    ['Digest', pack.integrity?.digest ? pack.integrity.digest.slice(0, 32) : 'not available'],
    ['Trace events', String(pack.auditTrace?.eventCount || 0)],
    ['No automatic approval', pack.controls?.noAutomaticApproval ? 'true' : 'false'],
    ['Browser embeddings retained', pack.controls?.browserEmbeddingsRetained ? 'true' : 'false']
  ];
  auditRows.forEach(([label, value], index) => {
    const x = 42 + (index * 176);
    canvas.rect(x, 76, 158, 58, PDF_COLORS.panel, PDF_COLORS.border);
    canvas.text(label.toUpperCase(), x + 10, 113, { size: 7, bold: true, color: PDF_COLORS.dim });
    canvas.wrappedText(value, x + 10, 92, { size: 10, bold: true, color: PDF_COLORS.white, maxChars: 22, maxLines: 2, lineHeight: 12 });
  });
  canvas.footer(5, 'specialist validation');
}

function buildReviewPackPdf(pack = {}) {
  const pageCanvases = [1, 2, 3, 4, 5].map(() => createPdfCanvas());
  drawCoverSlide(pageCanvases[0], pack);
  drawDecisionSlide(pageCanvases[1], pack);
  drawEvidenceSlide(pageCanvases[2], pack);
  drawActionBoardSlide(pageCanvases[3], pack);
  drawCouncilSlide(pageCanvases[4], pack);

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };
  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

  const pageRefs = [];
  pageCanvases.forEach((canvas) => {
    const content = canvas.ops.join('\n');
    const contentObject = addObject(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    const pageObject = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE.width} ${PDF_PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObject} 0 R >>`);
    pageRefs.push(`${pageObject} 0 R`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

module.exports = {
  buildReviewPack,
  buildReviewPackMarkdown,
  buildReviewPackPdf
};
