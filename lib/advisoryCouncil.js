'use strict';

const { chatCompletion, LLM_MODEL } = require('./compassGatewayClient');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function summarizeRunForPrompt(run = {}) {
  return JSON.stringify({
    case: run.case,
    decision: run.decision,
    evidenceQuality: run.evidenceQuality,
    retrievalAudit: run.retrievalAudit,
    gaps: run.gaps,
    domains: (run.domains || []).map((domain) => ({
      id: domain.id,
      label: domain.label,
      status: domain.status,
      controls: domain.controls
    })),
    citations: (run.citations || []).slice(0, 10).map((citation) => ({
      evidenceId: citation.evidenceId,
      title: citation.title,
      sourceType: citation.sourceType,
      text: cleanText(citation.text).slice(0, 420)
    }))
  }, null, 2);
}

function parseCouncilText(content = '') {
  const text = cleanText(content);
  return {
    summary: text.slice(0, 1400),
    recommendations: text
      .split(/\n+/)
      .map((line) => cleanText(line.replace(/^[-*\d.)\s]+/, '')))
      .filter((line) => line.length > 12)
      .slice(0, 6)
  };
}

async function runGatewayAdvisoryCouncil(run = {}) {
  const response = await chatCompletion({
    model: process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    temperature: Number(process.env.CREWAI_LLM_TEMPERATURE || 0.1),
    messages: [
      {
        role: 'system',
        content: [
          'You are the advisory specialist council for an enterprise compliance agent.',
          'You must not approve the case or override deterministic controls.',
          'Produce concise reviewer guidance grounded only in supplied case, gaps, evidence quality, retrieval audit, and citations.',
          'Return: executive summary, strongest evidence, unresolved risks, reviewer questions, and recommended next actions.'
        ].join(' ')
      },
      {
        role: 'user',
        content: `Review this compliance council run and provide advisory notes only.\n\n${summarizeRunForPrompt(run)}`
      }
    ]
  });
  const content = response.choices?.[0]?.message?.content || response.output_text || response.raw || '';
  const parsed = parseCouncilText(content);
  return {
    provider: 'compass_gateway',
    model: process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    advisoryOnly: true,
    outputAvailable: Boolean(parsed.summary),
    ...parsed
  };
}

module.exports = {
  runGatewayAdvisoryCouncil
};
