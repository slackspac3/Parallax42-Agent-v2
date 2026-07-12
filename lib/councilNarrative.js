'use strict';

const { chatCompletion } = require('./compassGatewayClient');
const { cleanText } = require('./runtimeConfig');

function humanize(value = '') {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function evidenceTitle(item = {}, index = 0) {
  return cleanText(item.title || item.fileName || item.sourceTitle || item.documentTitle) || `Evidence ${index + 1}`;
}

function topEvidenceTitles(result = {}, limit = 3) {
  if (Array.isArray(result.evidenceTitles) && result.evidenceTitles.length) {
    return [...new Set(result.evidenceTitles.map(cleanText).filter(Boolean))].slice(0, limit);
  }
  const citations = Array.isArray(result.citations) ? result.citations : [];
  const docs = Array.isArray(result.case?.documents) ? result.case.documents : [];
  const source = citations.length ? citations : docs;
  return [...new Set(source.map(evidenceTitle))].slice(0, limit);
}

function deterministicSummary(result = {}) {
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const readiness = Math.round(Number(result.decision?.readinessScore || 0) * 100);
  const evidence = topEvidenceTitles(result);
  if (gaps.length) {
    return `The council found ${gaps.length} open reviewer action${gaps.length === 1 ? '' : 's'} and scored the case ${readiness}% ready. ${evidence.length ? `It used ${evidence.join(', ')} as the leading evidence.` : 'No named evidence changed the recommendation.'} A human reviewer must close the actions before operational approval.`;
  }
  return `The council did not find blocking gaps and scored the case ${readiness}% ready. ${evidence.length ? `It used ${evidence.join(', ')} as the leading evidence.` : 'The run should still be reviewed against source evidence.'} A human owner must still record final approval.`;
}

function deterministicRemediation(gap = {}) {
  const label = cleanText(gap.gap || gap.label || 'open reviewer action');
  const action = cleanText(gap.action || '');
  if (action) return action;
  return `Assign an accountable reviewer to verify and close "${label}" before approval.`;
}

function fallbackNarrative(result = {}, reason = '') {
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  return {
    ok: true,
    advisoryOnly: true,
    source: 'deterministic_fallback',
    unavailableReason: reason || '',
    summary: deterministicSummary(result),
    exportSummary: deterministicSummary(result),
    gapRemediations: gaps.slice(0, 3).map((gap, index) => ({
      index,
      label: cleanText(gap.gap || `Gap ${index + 1}`),
      suggestedAction: deterministicRemediation(gap)
    }))
  };
}

function extractAssistantText(body = {}) {
  return cleanText(body.choices?.[0]?.message?.content || body.output_text || body.text || body.raw || '');
}

function parseJsonObject(text = '') {
  const clean = cleanText(text);
  if (!clean) return {};
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function compactRunForPrompt(result = {}) {
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const domains = Array.isArray(result.domains) ? result.domains : [];
  return {
    case: {
      supplierName: result.case?.supplierName || '',
      businessUnit: result.case?.businessUnit || '',
      geography: result.case?.geography || '',
      integrations: Array.isArray(result.case?.integrations) ? result.case.integrations.slice(0, 8) : []
    },
    decision: {
      recommendation: result.decision?.recommendation || '',
      status: result.decision?.status || '',
      readinessScore: result.decision?.readinessScore || 0,
      humanApprovalRequired: result.decision?.humanApprovalRequired !== false
    },
    evidenceTitles: topEvidenceTitles(result),
    evidenceQuality: {
      status: result.evidenceQuality?.status || '',
      score: result.evidenceQuality?.score || null
    },
    gaps: gaps.slice(0, 3).map((gap) => ({
      label: gap.gap || '',
      severity: gap.severity || '',
      action: gap.action || ''
    })),
    domains: domains.slice(0, 5).map((domain) => ({
      label: domain.label || '',
      status: domain.status || '',
      score: domain.score || null
    }))
  };
}

async function buildCouncilNarrative(result = {}) {
  const fallback = fallbackNarrative(result);
  try {
    const body = await chatCompletion({
      temperature: 0.35,
      max_tokens: 650,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You write concise compliance reviewer summaries for Parallax42.',
            'Return strict JSON only with keys: summary, exportSummary, gapRemediations.',
            'summary: 2-3 plain-English sentences for the decision room.',
            'exportSummary: 3 board-ready sentences for the export pack.',
            'gapRemediations: array of objects { index, suggestedAction } for at most 3 gaps.',
            'Do not approve anything. Say human approval is required. Do not invent evidence.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify(compactRunForPrompt(result))
        }
      ]
    });
    const parsed = parseJsonObject(extractAssistantText(body));
    if (!cleanText(parsed.summary)) return fallbackNarrative(result, 'Compass returned no usable summary.');
    const gaps = Array.isArray(result.gaps) ? result.gaps : [];
    const remediations = Array.isArray(parsed.gapRemediations) ? parsed.gapRemediations : [];
    return {
      ok: true,
      advisoryOnly: true,
      source: 'compass_gateway',
      summary: cleanText(parsed.summary) || fallback.summary,
      exportSummary: cleanText(parsed.exportSummary) || cleanText(parsed.summary) || fallback.exportSummary,
      gapRemediations: gaps.slice(0, 3).map((gap, index) => {
        const provided = remediations.find((item) => Number(item.index) === index) || remediations[index] || {};
        return {
          index,
          label: cleanText(gap.gap || `Gap ${index + 1}`),
          suggestedAction: cleanText(provided.suggestedAction) || deterministicRemediation(gap)
        };
      })
    };
  } catch (error) {
    return fallbackNarrative(result, error instanceof Error ? error.message : String(error || 'Compass narrative unavailable.'));
  }
}

module.exports = {
  buildCouncilNarrative,
  deterministicSummary,
  fallbackNarrative,
  topEvidenceTitles
};
