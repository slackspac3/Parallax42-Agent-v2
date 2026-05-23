'use strict';

const {
  cleanReviewTargetLabel,
  cleanText,
  fieldFromQuestion,
  hasDocumentReviewSource,
  hasSubmittedEvidence,
  isClauseReviewCase,
  isDocumentReviewCase,
  isPayrollOutsourcingCase,
  isRecentlyAnsweredField,
  normalizeKnownGapField,
  normalizeQuestion,
  requestProfileForDraft,
  unique
} = require('./conversationState');

function executionBlockersForMissing(missing = []) {
  return missing.filter((field) => ['case_brief', 'business_owner', 'geography', 'evidence'].includes(field));
}

function documentUploadQuestion(draft = {}) {
  const profile = requestProfileForDraft(draft);
  const target = cleanReviewTargetLabel(profile.reviewTarget || 'document');
  const evidenceKnownGap = (draft.knownGaps || []).includes('evidence');
  if (isClauseReviewCase(draft)) {
    return evidenceKnownGap
      ? 'Can you paste the clauses here or upload the source document when you have it?'
      : 'Would you like to paste the clauses here or upload the source document? I can analyze them first, then ask only for missing context.';
  }
  return evidenceKnownGap
    ? `Can you upload the ${target} when you have it, or paste the relevant sections here?`
    : `Would you like to upload the ${target} now? I can classify it, analyze it first, and then ask only for missing clarifications.`;
}

function documentFocusQuestion(draft = {}) {
  const target = cleanReviewTargetLabel(requestProfileForDraft(draft).reviewTarget || 'document');
  if (isClauseReviewCase(draft)) {
    return 'If the clauses are not available yet, what topic should I focus on when they arrive: termination, liability, data processing, audit rights, or all risks?';
  }
  return `If the ${target} is not available yet, what should I focus on when it arrives: privacy/data terms, liability, termination, commercial terms, or all risks?`;
}

function uploadedDocumentScopeQuestion(draft = {}) {
  const target = cleanReviewTargetLabel(requestProfileForDraft(draft).reviewTarget || 'document');
  if (isClauseReviewCase(draft)) {
    return 'I can review the uploaded clauses first. Should I focus on termination, liability, data processing, audit rights, or all risks?';
  }
  return `I can review the uploaded ${target} first. Should I focus on privacy/data terms, access and security, liability, termination, commercial terms, or all risks?`;
}

function highConfidencePlannerQuestion(draft = {}) {
  const question = cleanText(draft.conversationPlan?.nextQuestion || draft.llmIntake?.nextBestQuestion || '');
  const confidence = Number(draft.conversationPlan?.confidence ?? draft.llmIntake?.confidence ?? 0);
  if (!question || !Number.isFinite(confidence) || confidence < 0.6) return '';
  return question;
}

function wasQuestionAlreadyAsked(question = '', draft = {}) {
  return new Set((draft.askedQuestions || []).map(normalizeQuestion)).has(normalizeQuestion(question));
}

function questionsForDraft(draft = {}, missing = []) {
  const questions = [];
  const knownGaps = new Set(draft.knownGaps || []);
  const recentlyAnswered = (field) => isRecentlyAnsweredField(draft, field);
  const profile = requestProfileForDraft(draft);
  const plannerQuestion = cleanText(draft.conversationPlan?.nextQuestion || profile.nextBestQuestion || '');

  const highConfidenceQuestion = highConfidencePlannerQuestion(draft);
  if (highConfidenceQuestion) {
    return wasQuestionAlreadyAsked(highConfidenceQuestion, draft) ? [] : [highConfidenceQuestion];
  }

  if (
    (missing.includes('evidence') || (isDocumentReviewCase(draft) && !hasDocumentReviewSource(draft)))
    && !hasDocumentReviewSource(draft)
    && isDocumentReviewCase(draft)
    && ['upload_document', 'paste_clause', 'ask_evidence', 'unknown'].includes(profile.recommendedFirstAction)
  ) {
    if (knownGaps.has('evidence') && !knownGaps.has('review_focus')) {
      questions.push(documentFocusQuestion(draft));
    } else if (!knownGaps.has('evidence')) {
      questions.push(documentUploadQuestion(draft));
    }
    return unique(questions).slice(0, 1);
  }
  if (plannerQuestion) {
    const plannerField = fieldFromQuestion(plannerQuestion);
    const alreadyAsked = new Set([...(draft.askedQuestions || []), ...(draft.questions || [])].map(normalizeQuestion));
    if (
      !alreadyAsked.has(normalizeQuestion(plannerQuestion))
      && (!plannerField || !knownGaps.has(plannerField))
      && (!plannerField || !recentlyAnswered(plannerField))
      && !(plannerField === 'business_owner' && !missing.includes('business_owner'))
      && !(plannerField === 'geography' && !missing.includes('geography'))
      && !(plannerField === 'evidence' && hasSubmittedEvidence(draft))
    ) {
      questions.push(plannerQuestion);
      return unique(questions).slice(0, 1);
    }
  }
  if (
    draft.currentEventType === 'evidence_uploaded'
    && isDocumentReviewCase(draft)
    && hasDocumentReviewSource(draft)
    && !knownGaps.has('review_focus')
    && !recentlyAnswered('review_focus')
  ) {
    questions.push(uploadedDocumentScopeQuestion(draft));
    return unique(questions).slice(0, 1);
  }
  if (missing.includes('business_owner') && !knownGaps.has('business_owner') && !recentlyAnswered('business_owner')) {
    questions.push(isPayrollOutsourcingCase(draft)
      ? 'Who will own this payroll outsourcing risk internally: HR/People, Finance/Payroll, Procurement, or another named team?'
      : 'Who is the accountable business unit or workflow owner?');
  }
  if (missing.includes('geography') && !knownGaps.has('geography') && !recentlyAnswered('geography')) {
    questions.push('Which geography or regulatory perimeter applies, for example UAE, KSA, Abu Dhabi, or global?');
  }
  if (missing.includes('evidence') && !knownGaps.has('evidence') && !recentlyAnswered('evidence') && !questions.some((question) => fieldFromQuestion(question) === 'evidence')) {
    if (draft.riskSignals?.includes('export control')) {
      questions.push('Do you have export classification, end-use or end-user certification, import permits, sanctions screening, and destination approval?');
    }
    if (draft.riskSignals?.includes('remote support access')) {
      questions.push('Is firmware or remote diagnostic access controlled with named users, MFA, session recording, time limits, and an approved support window?');
    }
    if (draft.riskSignals?.includes('AI/model use')) {
      questions.push('Do the supplier terms exclude customer data from model training, fine-tuning, and service improvement?');
    }
    if (draft.riskSignals?.includes('personal data')) {
      questions.push('Is there a signed DPA with subprocessors, retention, deletion, and transfer commitments?');
    }
    if (draft.riskSignals?.includes('critical service')) {
      questions.push('Is BCP/DR and exit-assistance evidence available for this service?');
    }
    if (!questions.length) {
      questions.push(isPayrollOutsourcingCase(draft)
        ? 'What payroll-vendor proof do you already have: contract or SOW, DPA, employee data fields, access model, SOC 2/ISO 27001, BCP/DR, or exit support?'
        : 'What evidence is available: contract terms, DPA, SOC 2, ISO 27001, BCP/DR, access approval, or policy mapping?');
    }
  }
  if (missing.includes('export_control_evidence') && !knownGaps.has('export_control_evidence') && !recentlyAnswered('export_control_evidence')) {
    questions.push('Which export-control artifacts are final: classification, license analysis, end-use certificate, import permit, denied-party screening, and delivery-site approval?');
  }
  if (missing.includes('remote_support_controls') && !knownGaps.has('remote_support_controls') && !recentlyAnswered('remote_support_controls')) {
    questions.push('What remote firmware support controls are approved: named access, MFA, session logging, customer observation, and support-window limits?');
  }
  if (draft.supplierName === 'Conversation-supplied case' && !isDocumentReviewCase(draft)) {
    questions.push('What supplier, service, or internal workflow name should be recorded on the case?');
  }
  return unique(questions).slice(0, 4);
}

function evidenceChecklist(draft = {}) {
  const requested = new Set(['business owner', 'operating geography', 'service scope']);
  if (draft.riskSignals?.includes('personal data') || /privacy|dpa|personal data/i.test(draft.brief || '')) {
    ['signed DPA', 'subprocessor register', 'retention/deletion commitments', 'transfer or data-residency terms'].forEach((item) => requested.add(item));
  }
  if (draft.riskSignals?.includes('AI/model use') || /ai|llm|model/i.test(draft.brief || '')) {
    ['model-training exclusion', 'human oversight controls', 'Responsible AI assessment'].forEach((item) => requested.add(item));
  }
  if (draft.riskSignals?.includes('export control') || /export control|import permit|sanctions|end-use|restricted hardware/i.test(draft.brief || '')) {
    ['export classification', 'license analysis', 'end-use certificate', 'import permit', 'sanctions screening', 'delivery-site approval'].forEach((item) => requested.add(item));
  }
  if (draft.riskSignals?.includes('remote support access') || /firmware|remote support|remote diagnostic/i.test(draft.brief || '')) {
    ['remote support runbook', 'named access approval', 'session recording evidence', 'firmware integrity evidence'].forEach((item) => requested.add(item));
  }
  if (draft.riskSignals?.includes('critical service') || /critical|continuity|exit/i.test(draft.brief || '')) {
    ['BCP/DR plan', 'recovery objectives', 'exit-assistance commitment'].forEach((item) => requested.add(item));
  }
  if (draft.riskSignals?.includes('finance exposure') || /payment|finance|project/i.test(draft.brief || '')) {
    ['approval authority matrix', 'payment-control ownership', 'project exception register'].forEach((item) => requested.add(item));
  }
  if (draft.integrations?.length) {
    ['integration scope', 'access model', 'security assurance report'].forEach((item) => requested.add(item));
  }
  return Array.from(requested);
}

function knownGapLabel(field = '') {
  const normalized = normalizeKnownGapField(field);
  if (normalized === 'business_owner') return 'business owner';
  if (normalized === 'geography') return 'geography';
  if (normalized === 'evidence') return 'source evidence';
  if (normalized === 'review_focus') return 'review focus';
  if (normalized === 'export_control_evidence') return 'export-control evidence';
  if (normalized === 'remote_support_controls') return 'remote-support controls';
  return cleanText(field).replace(/_/g, ' ') || 'that item';
}

function filterRepeatedQuestions(questions = [], draft = {}, extracted = {}) {
  const highConfidenceQuestion = highConfidencePlannerQuestion(draft);
  if (highConfidenceQuestion) {
    return wasQuestionAlreadyAsked(highConfidenceQuestion, draft) ? [] : [highConfidenceQuestion];
  }

  const asked = new Set((draft.askedQuestions || []).map(normalizeQuestion));
  const knownGaps = new Set(draft.knownGaps || []);
  const answeredAnotherCoreField = Boolean(
    cleanText(extracted.businessUnit)
    || cleanText(extracted.geography)
  );
  return questions.filter((question) => {
    const field = fieldFromQuestion(question);
    if (field && (knownGaps.has(field) || isRecentlyAnsweredField(draft, field))) return false;
    if (!asked.has(normalizeQuestion(question))) return true;
    if (field === 'evidence' && isDocumentReviewCase(draft) && !hasSubmittedEvidence(draft)) return true;
    return answeredAnotherCoreField && ['business_owner', 'geography', 'evidence'].includes(field);
  }).slice(0, 1);
}

module.exports = {
  documentFocusQuestion,
  documentUploadQuestion,
  uploadedDocumentScopeQuestion,
  evidenceChecklist,
  executionBlockersForMissing,
  filterRepeatedQuestions,
  knownGapLabel,
  questionsForDraft
};
