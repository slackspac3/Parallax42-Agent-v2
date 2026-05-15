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

function wrapPdfLine(text = '', maxLength = 92) {
  const words = cleanText(text).split(' ').filter(Boolean).flatMap((word) => {
    if (word.length <= maxLength) return [word];
    const parts = [];
    for (let index = 0; index < word.length; index += maxLength) {
      parts.push(word.slice(index, index + maxLength));
    }
    return parts;
  });
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function pdfSafeText(value = '') {
  return cleanText(value)
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildReviewPackPdfLines(pack = {}) {
  const readiness = `${Math.round(Number(pack.decision?.readinessScore || 0) * 100)}%`;
  const lines = [];
  const add = (text = '', options = {}) => {
    const wrapped = options.wrap === false ? [cleanText(text)] : wrapPdfLine(text, options.maxLength || 92);
    wrapped.forEach((line, index) => {
      lines.push({
        text: line,
        size: options.size || 10,
        bold: Boolean(options.bold),
        gap: index === wrapped.length - 1 ? options.gap : undefined
      });
    });
  };
  const spacer = () => lines.push({ text: '', size: 8, gap: 10 });

  add('Parallax42 Compliance Intelligence Agent', { size: 16, bold: true, gap: 18 });
  add('Executive Review Pack', { size: 22, bold: true, gap: 22 });
  add(`Generated: ${pack.generatedAt || ''}`, { size: 9 });
  add(`Integrity digest: ${pack.integrity?.digest || ''}`, { size: 8, maxLength: 110, gap: 18 });

  add('Decision', { size: 14, bold: true, gap: 14 });
  add(`Recommendation: ${pack.decision?.recommendation || 'Pending review'}`, { bold: true });
  add(`Readiness: ${readiness}`);
  add(`Status: ${humanize(pack.decision?.status || 'unknown')}`);
  add('Human approval required: yes');
  add(`Rationale: ${pack.decision?.rationale || 'No rationale returned.'}`, { gap: 16 });

  add('Case Context', { size: 14, bold: true, gap: 14 });
  add(`Case ID: ${pack.case?.caseId || 'unassigned'}`);
  add(`Supplier or workflow: ${pack.case?.supplierName || 'Not provided'}`);
  add(`Business unit: ${pack.case?.businessUnit || 'Not provided'}`);
  add(`Geography: ${pack.case?.geography || 'Not provided'}`);
  add(`Integrations: ${(pack.case?.integrations || []).join(', ') || 'Not provided'}`, { gap: 16 });

  add('Reviewer Actions', { size: 14, bold: true, gap: 14 });
  (pack.reviewerActions?.length ? pack.reviewerActions : ['Record accountable human approval before operational use.'])
    .forEach((action, index) => add(`${index + 1}. ${action}`, { maxLength: 88 }));
  spacer();

  add('Blocking Gaps', { size: 14, bold: true, gap: 14 });
  (pack.gaps?.length ? pack.gaps : [{ gap: 'No blocking gaps returned by the council.', action: '' }])
    .slice(0, 12)
    .forEach((gap, index) => {
      add(`${index + 1}. ${gap.gap || 'Unnamed gap'}`, { bold: true, maxLength: 88 });
      if (gap.action) add(`Required action: ${gap.action}`, { maxLength: 88 });
    });
  spacer();

  add('Evidence Confidence', { size: 14, bold: true, gap: 14 });
  add(`Evidence quality: ${humanize(pack.evidenceQuality?.status || 'unknown')} (${pack.evidenceQuality?.score ?? 'n/a'})`);
  add(`Citations: ${pack.evidenceManifest?.citationCount || 0}`);
  add(`Retrieval mode: ${humanize(pack.retrievalAudit?.mode || 'not_used')}`);
  if (pack.documentEvidenceImpact?.summary) add(pack.documentEvidenceImpact.summary, { maxLength: 88 });
  spacer();

  add('Evidence Citations', { size: 14, bold: true, gap: 14 });
  (pack.evidenceManifest?.citations?.length ? pack.evidenceManifest.citations : [{ title: 'No citation records returned.', text: '' }])
    .slice(0, 14)
    .forEach((citation, index) => {
      add(`${index + 1}. ${citation.evidenceId || citation.citationId || 'Evidence'} - ${citation.title || 'Evidence'}`, { bold: true, maxLength: 88 });
      if (citation.text) add(`Extract: ${citation.text}`, { size: 9, maxLength: 92 });
    });
  spacer();

  add('Control Boundary', { size: 14, bold: true, gap: 14 });
  add('This pack is a reviewer artifact. It does not grant operational approval. Final approval remains with the accountable human owner.', { maxLength: 88 });
  add('Deterministic guardrails remain active; advisory LLM output, when available, is supporting evidence only.', { maxLength: 88 });

  return lines;
}

function buildReviewPackPdf(pack = {}) {
  const maxLinesPerPage = 48;
  const lines = buildReviewPackPdfLines(pack);
  const pages = [[]];
  lines.forEach((line) => {
    if (pages[pages.length - 1].length >= maxLinesPerPage) pages.push([]);
    pages[pages.length - 1].push(line);
  });

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };
  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageRefs = [];
  pages.forEach((pageLines) => {
    let y = 760;
    const stream = [
      'BT',
      '54 760 Td'
    ];
    pageLines.forEach((line) => {
      const size = line.size || 10;
      const gap = line.gap || Math.max(12, size + 4);
      stream.push(`${line.bold ? '/F2' : '/F1'} ${size} Tf`);
      stream.push(`1 0 0 1 54 ${y} Tm`);
      stream.push(`(${pdfSafeText(line.text)}) Tj`);
      y -= gap;
    });
    stream.push('ET');
    const content = stream.join('\n');
    const contentObject = addObject(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    const pageObject = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`);
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
