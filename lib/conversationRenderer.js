'use strict';

const {
  cleanReviewTargetLabel,
  cleanText,
  fieldFromQuestion,
  hasDocumentReviewSource,
  isClauseReviewCase,
  isDocumentReviewCase,
  isPayrollOutsourcingCase,
  normalizeQuestion,
  requestProfileForDraft,
  reviewTargetWithArticle,
  unique
} = require('./conversationState');
const {
  documentFocusQuestion,
  documentUploadQuestion,
  evidenceChecklist,
  knownGapLabel
} = require('./conversationPolicy');

function summarizeRun(run) {
  const topGaps = (run.gaps || []).slice(0, 3).map((gap, index) => `${index + 1}. ${gap.gap} ${gap.action}`);
  return [
    `I ran the case through the compliance agents. Decision: ${run.decision.recommendation}.`,
    `Readiness is ${Math.round(run.decision.readinessScore * 100)}% with ${(run.gaps || []).length} blocking gap${(run.gaps || []).length === 1 ? '' : 's'}.`,
    topGaps.length ? `Top gaps:\n${topGaps.join('\n')}` : 'No blocking gaps were detected in the supplied context.',
    'Human approval remains required before operational use.'
  ].join('\n\n');
}

function compactList(values = [], limit = 5) {
  const items = unique(values).slice(0, limit);
  const remaining = unique(values).length - items.length;
  return remaining > 0 ? `${items.join(', ')} +${remaining} more` : items.join(', ');
}

function workflowLabel(value = '') {
  const labels = {
    contract_risk_review: 'contract risk review',
    saas_vendor_review: 'SaaS/vendor review',
    privacy_data_protection_review: 'privacy and data protection review',
    security_assurance_review: 'security assurance review',
    procurement_vendor_review: 'procurement/vendor review',
    export_control_review: 'export-control review',
    ai_governance_review: 'AI governance review',
    business_continuity_review: 'business continuity review',
    finance_project_review: 'finance/project compliance review',
    hse_esg_review: 'HSE/ESG review',
    supplier_risk_review: 'supplier risk review',
    document_intake_triage: 'document intake triage',
    general_compliance_review: 'general compliance review'
  };
  return labels[value] || cleanText(value).replace(/_/g, ' ');
}

function capturedContextSummary(draft = {}) {
  const captured = [];
  const profile = requestProfileForDraft(draft);
  if (profile.workflowType) captured.push(`Workflow: ${workflowLabel(profile.workflowType)}`);
  if (profile.reviewTarget) captured.push(`Review target: ${profile.reviewTarget}`);
  if (cleanText(draft.businessUnit)) captured.push(`Owner: ${draft.businessUnit}`);
  if (cleanText(draft.geography)) captured.push(`Geography: ${draft.geography}`);
  if (cleanText(draft.exportOriginJurisdiction)) captured.push(`Export origin: ${draft.exportOriginJurisdiction}`);
  if (draft.integrations?.length) captured.push(`Integrations: ${compactList(draft.integrations, 3)}`);
  if (draft.evidenceSignals?.length) captured.push(`Evidence: ${compactList(draft.evidenceSignals, 5)}`);
  if (draft.riskSignals?.length) captured.push(`Risks: ${compactList(draft.riskSignals, 5)}`);
  if (draft.indexedEvidence?.chunkCount) captured.push(`Indexed chunks: ${draft.indexedEvidence.chunkCount}`);
  if (draft.retrievalContext?.evidenceMatches?.length || draft.retrievalContext?.matches?.length) {
    captured.push(`Evidence memory: ${draft.retrievalContext.evidenceMatches?.length || draft.retrievalContext.matches?.length} match${(draft.retrievalContext.evidenceMatches?.length || draft.retrievalContext.matches?.length) === 1 ? '' : 'es'}`);
  }
  if (draft.retrievalContext?.similarCases?.length) {
    captured.push(`Learning memory: ${draft.retrievalContext.similarCases.length} similar case${draft.retrievalContext.similarCases.length === 1 ? '' : 's'}`);
  }
  if (draft.retrievalContext?.governanceReferences?.length) {
    captured.push(`Governance reference: ${draft.retrievalContext.governanceReferences.length} advisory match${draft.retrievalContext.governanceReferences.length === 1 ? '' : 'es'}`);
  }
  return captured;
}

function caseShapeSummary(draft = {}) {
  const profile = requestProfileForDraft(draft);
  if (isPayrollOutsourcingCase(draft)) {
    const geography = cleanText(draft.geography);
    return geography
      ? `I’m treating this as a payroll outsourcing vendor review across ${geography}.`
      : 'I’m treating this as a payroll outsourcing vendor review.';
  }
  if (isDocumentReviewCase(draft)) {
    const target = reviewTargetWithArticle(profile.reviewTarget || 'document');
    const workflow = profile.workflowType ? ` using a ${workflowLabel(profile.workflowType)} workflow` : '';
    return hasDocumentReviewSource(draft)
      ? `I’m treating this as ${target} review${workflow} and using the attached source evidence.`
      : `I’m treating this as ${target} review${workflow}. The useful next step is to upload or paste the source material.`;
  }
  if (/vendor|supplier|third party|third-party|outsourc/i.test(draft.brief || '')) {
    return 'I’m treating this as a third-party compliance review.';
  }
  return 'I’m turning this into a review-ready compliance case.';
}

function whyQuestionMatters(question = '', draft = {}) {
  if (/owner|business unit|workflow owner|internally/i.test(question)) {
    return isPayrollOutsourcingCase(draft)
      ? 'Payroll data and outsourcing risk need a named internal owner for risk acceptance, remediation, and final human approval.'
      : 'This names who owns the review internally, who accepts risk, and who will close follow-up actions.';
  }
  if (/from which country|exporting jurisdiction|export origin|supplier ship|ship.*from|export-control jurisdiction|export control jurisdiction/i.test(question)) {
    return 'Export controls differ by shipping jurisdiction, controlled-item classification, firmware scope, end use, and end-user proof.';
  }
  if (/sanctions|restricted party|denied party|party screening|screening hit/i.test(question)) {
    return 'Sanctions and restricted-party screening is a threshold control for sensitive destinations, counterparties, end users, and delivery sites.';
  }
  if (/end use|end user|end-use|end-user|intended use|ultimate consignee/i.test(question)) {
    return 'Controlled hardware, firmware, and support services often depend on final end use and end-user facts before licensing or escalation can be assessed.';
  }
  if (/remote firmware|firmware support|remote diagnostic|remote support|named access|session logging|support-window/i.test(question)) {
    return 'Remote firmware or diagnostic access can change the export-control, cybersecurity, and operational-risk profile, so access controls must be explicit before execution.';
  }
  if (/geography|regulatory perimeter|jurisdiction/i.test(question)) {
    return isPayrollOutsourcingCase(draft)
      ? 'Payroll obligations depend on where employees sit, where the company operates, and where the supplier processes the data.'
      : 'This sets the geography or regulatory perimeter so the council maps the right obligations and transfer issues.';
  }
  if (/ai use|ai capabilities|private assistant|retrieval|document intelligence|policy q|meeting summar|hr|employment|legal\/compliance|automated|semi-automated|decision affecting people|eligibility|disciplinary/i.test(question)) {
    return 'AI tools can become higher-risk if they influence HR, legal, compliance, eligibility, access, disciplinary, or other people-impacting decisions. The council needs that boundary before it can assess controls correctly.';
  }
  if (/upload|paste|agreement|payroll|contract|dpa|soc|iso|bcp|evidence|proof|clause|document/i.test(question)) {
    return isPayrollOutsourcingCase(draft)
      ? 'Payroll outsourcing usually needs privacy, access, continuity, and contract proof before a reviewer can accept the risk.'
      : isDocumentReviewCase(draft)
        ? 'The source material usually contains the parties, scope, data terms, obligations, and missing proof signals, so analyzing it first reduces unnecessary questions.'
        : 'Source evidence lets the council separate proven controls from assumptions or open reviewer actions.';
  }
  return 'This keeps the decision memo clear about what is known, what is assumed, and what a human reviewer must confirm.';
}

function documentAwaitingSourceReply({ draft, questions, foundLines }) {
  const profile = requestProfileForDraft(draft);
  const target = cleanReviewTargetLabel(profile.reviewTarget || 'document');
  const workflow = profile.workflowType ? workflowLabel(profile.workflowType) : 'document review';
  const sourceLine = isClauseReviewCase(draft)
    ? 'Paste the clauses or upload the source document and I will inspect them before I ask for owner, geography, or approval context.'
    : `Upload the ${target} and I will classify it, run the ${workflow} workflow, extract obligations and missing proof, then ask only for clarifications that remain.`;
  const foundBlock = foundLines.length ? `\n\nWhat I found already:\n${foundLines.map((line) => `- ${line}`).join('\n')}` : '';
  const question = questions[0] || documentUploadQuestion(draft);
  return [
    `I understand this as ${reviewTargetWithArticle(target)} review.`,
    `${sourceLine}${foundBlock}`,
    `Next question: ${question}`,
    `Why it matters: ${whyQuestionMatters(question, draft)}`
  ].join('\n\n');
}

function knownGapReply({ draft, questions, currentKnownGaps = [] }) {
  const currentGap = currentKnownGaps[0] || '';
  const question = questions[0] || '';
  if (isDocumentReviewCase(draft) && currentGap === 'evidence') {
    const target = cleanReviewTargetLabel(requestProfileForDraft(draft).reviewTarget || 'document');
    return [
      `No problem. I’ve marked the ${target} source as pending.`,
      `For the actual document review, upload the ${target} or paste the relevant sections when available. I won’t keep asking for the same file if it is not ready yet.`,
      `Next question: ${documentFocusQuestion(draft)}`
    ].filter(Boolean).join('\n\n');
  }
  if (currentGap) {
    return [
      `No problem. I’ve recorded ${knownGapLabel(currentGap)} as a known gap.`,
      question
        ? `Next question: ${question}\nWhy it matters: ${whyQuestionMatters(question, draft)}`
        : 'I won’t keep asking for the same missing item. Add it later if you get it, or run the council with the gap visible once the case has enough context.'
    ].join('\n\n');
  }
  return '';
}

function modelGeneratedReply({ draft = {}, conversationPlan = null, llmAssessment = null }) {
  const direct = cleanText(
    llmAssessment?.naturalResponse
    || conversationPlan?.naturalResponse
    || draft.llmIntake?.naturalResponse
  );
  if (direct) return direct;

  if (!(llmAssessment?.used || conversationPlan?.usedLlm || draft.llmIntake?.used)) return '';
  const summary = cleanText(
    llmAssessment?.assistantSummary
    || conversationPlan?.assistantSummary
    || draft.llmIntake?.assistantSummary
  );
  const question = cleanText(
    llmAssessment?.nextBestQuestion
    || conversationPlan?.nextQuestion
    || draft.llmIntake?.nextBestQuestion
  );
  return [summary, question].filter(Boolean).join('\n\n');
}

function generatedReplyCoversPolicyQuestion(reply = '', question = '') {
  const cleanReply = cleanText(reply);
  const cleanQuestion = cleanText(question);
  if (!cleanReply || !cleanQuestion) return false;
  if (normalizeQuestion(cleanReply).includes(normalizeQuestion(cleanQuestion))) return true;
  const policyField = fieldFromQuestion(cleanQuestion);
  if (!policyField) return false;
  const normalizedReply = normalizeQuestion(cleanReply);
  const fieldPatterns = {
    business_owner: /owner|business unit|accountable|\bown\b|internally/,
    geography: /geography|jurisdiction|regulatory perimeter|country|uae|ksa|abu dhabi|global/,
    evidence: /upload|paste|agreement|contract|evidence|proof|document|clause|dpa|soc|iso|bcp/,
    export_origin_jurisdiction: /from which country|exporting jurisdiction|export origin|origin jurisdiction|supplier ship|ship.*from|export control.*jurisdiction/,
    export_end_use: /end use|end user|end-use|end-user|intended use|ultimate consignee/,
    sanctions_screening: /sanctions|restricted party|denied party|party screening|screening hit/,
    remote_support_controls: /remote firmware|firmware support|remote diagnostic|remote support|named access|session logging|support window|mfa/,
    ai_usage_scope: /ai use|ai usage|ai capabilities|private assistant|retrieval|document intelligence|policy q a|meeting summaries|internal employees|external customers|regulated|high risk|compliance decisions|legal determinations|hr matters|human resources matters|employment decisions|automated decision|semi automated decision|decision affecting people|eligibility|disciplinary/,
    review_focus: /focus|privacy|liability|termination|commercial|all risks|risk area|review area|prioritize/
  };
  return Boolean(fieldPatterns[policyField]?.test(normalizedReply));
}

function composeReply({ intent, draft, missing, questions, run, executionBlockers = [], currentKnownGaps = [], conversationPlan = null, llmAssessment = null }) {
  if (conversationPlan?.smartIntakeUnavailable) {
    return conversationPlan.userMessage || conversationPlan.assistantSummary || 'Compass gateway is not configured — smart intake is unavailable. Contact your administrator.';
  }
  if (run?.ok) return summarizeRun(run);
  if (draft.answerValidation?.status === 'needs_confirmation') {
    const question = draft.answerValidation.question || questions[0] || draft.activeQuestion;
    return [
      `I spotted a possible spelling issue: “${draft.answerValidation.rawValue || 'that answer'}” looks like it may mean “${draft.answerValidation.suggestion || 'the suggested value'}”.`,
      `Next question: ${question}`,
      'Short answer is fine: say “yes” to confirm, or type the owner name exactly.'
    ].filter(Boolean).join('\n\n');
  }
  if (draft.answerValidation?.status === 'needs_clarification') {
    const question = draft.answerValidation.question || questions[0] || draft.activeQuestion;
    return [
      `I could not map that answer to the current question about ${knownGapLabel(draft.answerValidation.field)}.`,
      `Next question: ${question}`,
      `Why it matters: ${whyQuestionMatters(question, draft)}`,
      'Short answer is fine. Say “unknown” if it is pending.'
    ].filter(Boolean).join('\n\n');
  }
  const generatedReply = modelGeneratedReply({ draft, conversationPlan, llmAssessment });
  if (generatedReply) {
    const policyQuestion = questions[0] || '';
    if (!policyQuestion || generatedReplyCoversPolicyQuestion(generatedReply, policyQuestion)) return generatedReply;
    return [
      generatedReply,
      `Next question: ${policyQuestion}`,
      `Why it matters: ${whyQuestionMatters(policyQuestion, draft)}`
    ].join('\n\n');
  }

  // Deterministic text below is the explicit fallback path for local/offline use
  // or gateway failures. In normal configured chat, Compass supplies naturalResponse.
  const retrieved = draft.retrievalContext?.evidenceMatches || draft.retrievalContext?.matches || [];
  const similarCases = draft.retrievalContext?.similarCases || [];
  const governanceReferences = draft.retrievalContext?.governanceReferences || [];
  const learningSuggestions = draft.retrievalContext?.learningSuggestions || null;
  const foundLines = [
    retrieved.length ? `I found ${retrieved.length} evidence-memory match${retrieved.length === 1 ? '' : 'es'} before asking for more proof.` : '',
    governanceReferences.length ? `I found ${governanceReferences.length} governance reference match${governanceReferences.length === 1 ? '' : 'es'} as advisory context; these do not replace policy-owner review.` : '',
    similarCases.length ? `I found ${similarCases.length} governed learning precedent${similarCases.length === 1 ? '' : 's'} to keep as advisory context.` : '',
    learningSuggestions?.commonControlsReviewersAdded?.length ? `Reviewer patterns commonly add: ${learningSuggestions.commonControlsReviewersAdded.slice(0, 3).map((item) => item.control).join(', ')}.` : ''
  ].filter(Boolean);
  if (intent === 'evidence_question') {
    return [
      'Got it. I checked the case context and any available evidence memory first.',
      foundLines.length ? `What I found:\n${foundLines.map((line) => `- ${line}`).join('\n')}` : '',
      `Evidence checklist for this case:\n${evidenceChecklist(draft).map((item) => `- ${item}`).join('\n')}`,
      'Next best step: send what you have, or say if an item is pending so I can record it as a known gap.'
    ].filter(Boolean).join('\n\n');
  }
  const pendingGapReply = knownGapReply({ draft, questions, currentKnownGaps });
  if (pendingGapReply) return pendingGapReply;
  if (isDocumentReviewCase(draft) && (missing.includes('evidence') || !hasDocumentReviewSource(draft)) && !hasDocumentReviewSource(draft)) {
    return documentAwaitingSourceReply({ draft, questions, foundLines });
  }
  if (missing.length) {
    const captured = capturedContextSummary(draft);
    const capturedBlock = captured.length ? `So far I have:\n${captured.map((item) => `- ${item}`).join('\n')}\n\n` : '';
    const foundBlock = foundLines.length ? `What I found:\n${foundLines.map((line) => `- ${line}`).join('\n')}\n\n` : '';
    if (!executionBlockers.length) {
      const next = questions[0] || 'Say "run it" to execute the council, or add any detail that should strengthen the review pack.';
      const lead = cleanText(conversationPlan?.assistantSummary) || caseShapeSummary(draft);
      return `Got it — ${lead}\n\n${capturedBlock}${foundBlock}Core intake is complete. Remaining evidence/control gaps can be handled by the council if unresolved.\n\nNext question: ${next}\nWhy it matters: ${whyQuestionMatters(next, draft)}`;
    }
    if (questions.length) {
      const lead = cleanText(conversationPlan?.assistantSummary) || caseShapeSummary(draft);
      return `Got it — ${lead}\n\n${capturedBlock}${foundBlock}Next question: ${questions[0]}\nWhy it matters: ${whyQuestionMatters(questions[0], draft)}`;
    }
    return `No problem. I recorded the missing item as a known gap.\n\n${capturedBlock}${foundBlock}I won’t keep asking for the same item. Add it later if you get it, or continue with another detail that should strengthen the review.`;
  }
  const captured = capturedContextSummary(draft);
  const capturedBlock = captured.length ? `So far I have:\n${captured.map((item) => `- ${item}`).join('\n')}\n\n` : '';
  const foundBlock = foundLines.length ? `What I found:\n${foundLines.map((line) => `- ${line}`).join('\n')}\n\n` : '';
  const lead = cleanText(conversationPlan?.assistantSummary) || caseShapeSummary(draft);
  return `Got it — ${lead}\n\n${capturedBlock}${foundBlock}I have enough context to assess this case. Say "run it" or add more evidence, and I will prepare the decision room with human approval still required.`;
}

module.exports = {
  capturedContextSummary,
  caseShapeSummary,
  compactList,
  composeReply,
  summarizeRun,
  whyQuestionMatters
};
