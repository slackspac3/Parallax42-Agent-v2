'use strict';

const { chatCompletion, LLM_MODEL } = require('./compassGatewayClient');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function summarizeRunForPrompt(run = {}) {
  const retrieval = run.retrievalContext || run.case?.retrievalContext || {};
  return JSON.stringify({
    case: run.case,
    decision: run.decision,
    evidenceQuality: run.evidenceQuality,
    retrievalAudit: run.retrievalAudit,
    retrievalContext: {
      evidenceMatches: (retrieval.evidenceMatches || retrieval.matches || []).slice(0, 4).map((match) => ({
        evidenceId: match.evidenceId,
        title: match.title,
        score: match.score,
        snippet: cleanText(match.snippet || match.text).slice(0, 280)
      })),
      similarCases: (retrieval.similarCases || []).slice(0, 3).map((item) => ({
        caseId: item.caseId,
        artifactType: item.artifactType,
        finalOutcome: item.finalOutcome || item.reviewerDecision,
        summary: cleanText(item.summary || item.reviewerNotes || '').slice(0, 260)
      })),
      learningSuggestions: retrieval.learningSuggestions || null,
      missingEvidenceSignals: (retrieval.missingEvidenceSignals || []).slice(0, 6)
    },
    gaps: (run.gaps || []).slice(0, 6),
    domains: (run.domains || []).map((domain) => ({
      id: domain.id,
      label: domain.label,
      status: domain.status,
      controls: (domain.controls || []).slice(0, 4)
    })),
    citations: (run.citations || []).slice(0, 6).map((citation) => ({
      evidenceId: citation.evidenceId,
      title: citation.title,
      sourceType: citation.sourceType,
      text: cleanText(citation.text).slice(0, 280)
    }))
  }, null, 0).slice(0, Number(process.env.ADVISORY_PROMPT_MAX_CHARS || 6000));
}

const SPECIALISTS = [
  {
    specialist: 'Privacy Specialist',
    focus: 'privacy, data processing basis, DPA, subprocessors, retention, deletion, transfer, and patient or personal data evidence'
  },
  {
    specialist: 'Security Specialist',
    focus: 'identity, access, encryption, logging, security assurance, vulnerability management, tenant access, and critical service continuity evidence'
  },
  {
    specialist: 'Responsible AI Specialist',
    focus: 'model-training exclusion, human oversight, unsupported certainty, sensitive attributes, and responsible AI control evidence'
  },
  {
    specialist: 'Learning & Precedent Specialist',
    focus: 'similar prior cases, reviewer feedback patterns, repeated missing evidence, common controls, and decision overrides'
  }
];

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

function parseSpecialistJson(content = '', specialist = '') {
  const raw = cleanText(content);
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
    return {
      specialist: parsed.specialist || specialist,
      advisoryOnly: true,
      assessment: cleanText(parsed.assessment || parsed.summary || ''),
      strongestEvidence: Array.isArray(parsed.strongestEvidence) ? parsed.strongestEvidence.slice(0, 6) : [],
      unresolvedRisks: Array.isArray(parsed.unresolvedRisks) ? parsed.unresolvedRisks.slice(0, 6) : [],
      reviewerQuestions: Array.isArray(parsed.reviewerQuestions) ? parsed.reviewerQuestions.slice(0, 6) : [],
      recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions.slice(0, 6) : [],
      relevantPrecedents: Array.isArray(parsed.relevantPrecedents) ? parsed.relevantPrecedents.slice(0, 6) : [],
      confidence: Number(Math.max(0, Math.min(1, Number(parsed.confidence || 0.5))).toFixed(2))
    };
  } catch {
    const parsed = parseCouncilText(raw);
    return {
      specialist,
      advisoryOnly: true,
      assessment: parsed.summary,
      strongestEvidence: [],
      unresolvedRisks: [],
      reviewerQuestions: [],
      recommendedActions: parsed.recommendations,
      relevantPrecedents: [],
      confidence: parsed.summary ? 0.45 : 0
    };
  }
}

async function runSpecialistAdvisory(run = {}, specialistConfig = {}) {
  const response = await chatCompletion({
    model: process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    temperature: Number(process.env.CREWAI_LLM_TEMPERATURE || 0.1),
    messages: [
      {
        role: 'system',
        content: [
          `You are the ${specialistConfig.specialist} for an enterprise compliance agent.`,
          `Focus only on ${specialistConfig.focus}.`,
          'Advisory only. Never approve, override controls, or invent evidence.',
          'Use only supplied run output, evidence snippets, similar cases, and reviewer feedback.',
          'Return strict JSON with keys: specialist, advisoryOnly, assessment, strongestEvidence, unresolvedRisks, reviewerQuestions, recommendedActions, relevantPrecedents, confidence.',
          'Set advisoryOnly true. Keep arrays to 3 items and assessment under 80 words.'
        ].join(' ')
      },
      {
        role: 'user',
        content: `Review this deterministic council run for your focus area only:\n${summarizeRunForPrompt(run)}`
      }
    ],
    max_tokens: Number(process.env.ADVISORY_LLM_MAX_TOKENS || process.env.CREWAI_LLM_MAX_TOKENS || 700)
  });
  const content = response.choices?.[0]?.message?.content || response.output_text || response.raw || '';
  return parseSpecialistJson(content, specialistConfig.specialist);
}

async function runGatewayAdvisoryCouncil(run = {}) {
  const specialists = await Promise.all(SPECIALISTS.map(async (specialistConfig) => {
    try {
      return await runSpecialistAdvisory(run, specialistConfig);
    } catch (error) {
      return {
        specialist: specialistConfig.specialist,
        advisoryOnly: true,
        advisoryUnavailable: true,
        assessment: 'Advisory specialist unavailable; deterministic council output remains valid for human review.',
        strongestEvidence: [],
        unresolvedRisks: [],
        reviewerQuestions: [],
        recommendedActions: [],
        relevantPrecedents: [],
        confidence: 0,
        error: error instanceof Error ? error.message : String(error || 'Specialist advisory failed.')
      };
    }
  }));
  const available = specialists.filter((item) => !item.advisoryUnavailable && cleanText(item.assessment));
  const summary = available.length
    ? available.map((item) => `${item.specialist}: ${item.assessment}`).join('\n')
    : 'Advisory specialists were unavailable; deterministic council output remains the decision owner.';
  return {
    provider: 'compass_gateway',
    model: process.env.CREWAI_LLM_MODEL || LLM_MODEL,
    advisoryOnly: true,
    outputAvailable: available.length > 0,
    summary,
    specialists,
    deterministicDecisionOwner: true,
    humanApprovalRequired: true
  };
}

module.exports = {
  runGatewayAdvisoryCouncil
};
