'use strict';

const GEOGRAPHY_PATTERNS = [
  ['UAE', /\b(uae|united arab emirates|abu dhabi|dubai)\b/i],
  ['India', /\b(india|mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|pune)\b/i],
  ['KSA', /\b(ksa|saudi|saudi arabia|riyadh)\b/i],
  ['Singapore', /\b(singapore)\b/i],
  ['Qatar', /\b(qatar|doha)\b/i],
  ['Egypt', /\b(egypt|cairo)\b/i],
  ['Global', /\b(global|multi[- ]?country|international|cross[- ]border)\b/i]
];

const BUSINESS_UNIT_PATTERNS = [
  ['Trade Compliance And Export Controls', /\b(export control|import permit|customs|sanctions|restricted party|end[- ]use|end user|freight forwarder|ai accelerator|chip|hardware)\b/i],
  ['Group Finance Transformation', /\b(finance|payment|invoice|ledger|treasury|erp|budget)\b/i],
  ['Group Technology Risk', /\b(technology|security|ai|llm|azure|microsoft|serviceNow|api|integration|platform)\b/i],
  ['Procurement And Third-Party Risk', /\b(procurement owner|procurement team|sourcing team|third[- ]party risk|vendor management|supplier management)\b/i],
  ['Legal And Privacy', /\b(privacy|legal|dpa|data processing|subprocessor|retention)\b/i],
  ['HSE And Business Continuity', /\b(hse|health and safety|continuity|bcp|dr|exit)\b/i],
  ['International Growth', /\b(market entry|international growth|new country|new market|physical security)\b/i]
];

const INTEGRATION_PATTERNS = [
  ['Payroll/HRIS', /\b(payroll|salary|wage|compensation|hris|workday|successfactors|oracle hcm)\b/i],
  ['Freight forwarder portal', /\b(freight forwarder|customs broker|shipping portal|logistics portal)\b/i],
  ['Asset inventory', /\b(asset inventory|serial number|chain[- ]of[- ]custody|warehouse|rack location)\b/i],
  ['Firmware support channel', /\b(firmware|remote diagnostic|remote support|support channel)\b/i],
  ['Azure AD', /\b(azure ad|entra|sso|single sign[- ]on|mfa)\b/i],
  ['Microsoft 365', /\b(microsoft 365|office 365|sharepoint|teams|power platform|dynamics)\b/i],
  ['ServiceNow', /\b(servicenow)\b/i],
  ['Finance reporting', /\b(finance reporting|ledger|erp export|payment approval|invoice)\b/i],
  ['CRM', /\b(crm|salesforce|dynamics crm)\b/i],
  ['Analytics platform', /\b(analytics|dashboard|bi|power bi|reporting)\b/i],
  ['Content management', /\b(cms|content management|asset library|sharepoint)\b/i],
  ['Media buying', /\b(media buying|campaign|audience|ad platform)\b/i]
];

const EVIDENCE_PATTERNS = [
  ['export classification', /\b(export classification|eccn|classification number|harmonized tariff|hs code)\b/i],
  ['end-use certificate', /\b(end[- ]use certificate|end user certificate|end[- ]user statement|end[- ]use statement)\b/i],
  ['import permit', /\b(import permit|strategic goods approval|customs approval|import license)\b/i],
  ['sanctions screening', /\b(sanctions screening|restricted party screening|denied party screening|screened clean|screening hit)\b/i],
  ['chain of custody', /\b(chain[- ]of[- ]custody|tamper evidence|serial number reconciliation|bonded warehouse)\b/i],
  ['firmware access runbook', /\b(firmware support runbook|remote access runbook|support window|session recording)\b/i],
  ['remote support controls', /\b(named users?|mfa|multi[- ]factor|session logging|session recording|customer observation|support window|time limits?|remote access approval|remote diagnostic approval)\b/i],
  ['SOC 2', /\bsoc\s*2\b/i],
  ['ISO 27001', /\biso\s*27001\b/i],
  ['DPA', /\b(dpa|data processing agreement)\b/i],
  ['subprocessor register', /\bsubprocessor\b/i],
  ['retention and deletion', /\b(retention|deletion|delete assistance)\b/i],
  ['model training terms', /\b(model[- ]?training|fine[- ]?tuning|training exclusion|service improvement)\b/i],
  ['BCP/DR', /\b(bcp|business continuity|disaster recovery|dr plan|recovery objective)\b/i],
  ['exit assistance', /\b(exit assistance|exit support|termination support)\b/i],
  ['identity and access', /\b(rbac|mfa|sso|privileged access|azure ad|entra)\b/i],
  ['security testing', /\b(pentest|penetration test|vulnerability|security test)\b/i],
  ['audit logs', /\b(audit log|logging|monitoring)\b/i],
  ['approval matrix', /\b(approval matrix|approval authority|segregation of duties)\b/i]
];

const NEGATED_EVIDENCE_PATTERNS = {
  'export classification': /\b(no|missing|without|pending|not final)\s+(manufacturer\s+)?(export\s+)?classification\b|classification[^.]{0,70}\b(pending|missing|not final|not attached|unavailable)\b/i,
  'end-use certificate': /\b(no|missing|without|not final)\s+(final\s+)?end[- ]use\s+(certificate|statement)\b|end[- ]use certificate[^.]{0,70}\b(missing|pending|not final|not attached|unavailable)\b/i,
  'import permit': /\b(no|missing|without|not final)\s+(final\s+)?import\s+(permit|license)\b|import permit[^.]{0,70}\b(missing|pending|not final|not attached|unavailable)\b/i,
  'firmware access runbook': /\b(no|missing|without|not final)\s+(firmware|remote access|remote diagnostic)[^.]{0,40}\b(runbook|approval|window)\b|firmware[^.]{0,70}\b(runbook|support)[^.]{0,50}\b(missing|pending|not final|not attached|unavailable)\b/i,
  DPA: /\b(no|missing|without|unsigned)\s+(signed\s+)?dpa\b|no signed dpa|dpa[^.]{0,60}\b(missing|not attached|unavailable|not available)\b/i,
  'model training terms': /\b(no|missing|without)\s+(model[- ]?training|training)\s+(exclusion|terms|language|evidence)\b|model[- ]?training[^.]{0,70}\b(missing|not attached|unavailable)\b/i,
  'BCP/DR': /\b(no|missing|without)\s+(bcp|business continuity|continuity|disaster recovery|dr plan)\b|continuity plan[^.]{0,70}\b(missing|not attached|unavailable)\b/i,
  'exit assistance': /\b(no|missing|without)\s+exit\s+(assistance|support)\b|exit support[^.]{0,70}\b(missing|not attached|unavailable)\b/i
};

const RISK_PATTERNS = [
  ['export control', /\b(export control|restricted hardware|ai accelerator|chip import|import permit|sanctions|restricted party|end[- ]use|customs|freight forwarder)\b/i],
  ['remote support access', /\b(firmware|remote diagnostic|remote support|support access|session recording)\b/i],
  ['personal data', /\b(personal data|pii|employee data|employee records?|payroll|payroll data|salary data|compensation data|customer data|sensitive data)\b/i],
  ['AI/model use', /\b(ai|llm|model|machine learning|automated decision)\b/i],
  ['critical service', /\b(critical|production|business critical|material service)\b/i],
  ['finance exposure', /\b(payment|finance|ledger|invoice|budget|project|payroll|salary|wage|compensation)\b/i],
  ['privileged access', /\b(privileged|admin access|tenant access|write access)\b/i],
  ['cross-border transfer', /\b(cross[- ]border|transfer|data residency|hosting region)\b/i],
  ['outsourced service', /\b(outsourc|managed service|vendor|supplier|third party|third-party)\b/i],
  ['missing evidence', /\b(no|missing|without|not attached|unavailable)\b/i]
];

const DOCUMENT_REVIEW_TYPES = new Set([
  'document_review',
  'contract_review',
  'msa_review',
  'dpa_review',
  'clause_review',
  'policy_review'
]);

const DOCUMENT_REVIEW_PATTERN = /\b(review|assess|check|analyse|analyze|look at|redline)\b[^.?!]{0,90}\b(agreement|contract|msa|master service agreement|master services agreement|sow|statement of work|dpa|data processing agreement|license|addendum|terms|clause|clauses|policy|document)\b|\b(agreement|contract|msa|master service agreement|master services agreement|sow|statement of work|dpa|data processing agreement|license|addendum|terms|clause|clauses|policy|document)\b[^.?!]{0,90}\b(review|assess|check|analyse|analyze|redline)\b/i;
const CLAUSE_REVIEW_PATTERN = /\b(clause|clauses|section|sections|article|articles|termination|liability|indemnity|data processing|subprocessor|governing law|audit right|service level|sla|confidentiality)\b/i;

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isUnknownOrPending(value = '') {
  return /^(unknown|not sure|unsure|pending|tbd|to be confirmed|not available|not yet|i don't know|dont know|don't know|no idea)$/i.test(cleanText(value));
}

function normalizeQuestion(value = '') {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fieldFromQuestion(question = '') {
  const text = normalizeQuestion(question);
  if (/owner|business unit|accountable|\bown\b|internally/.test(text)) return 'business_owner';
  if (/geography|jurisdiction|regulatory perimeter|country/.test(text)) return 'geography';
  if (/upload.*(agreement|contract|document|msa|dpa)|paste.*clause|clause.*paste|agreement.*upload|what evidence|evidence available|source evidence|proof|contract|dpa|soc|iso|bcp|document|clause/.test(text)) return 'evidence';
  if (/focus|privacy|liability|termination|commercial|all risks|risk area/.test(text)) return 'review_focus';
  if (/export|classification|end use|permit|sanctions|delivery site/.test(text)) return 'export_control_evidence';
  if (/remote|firmware|support|session|mfa|access/.test(text)) return 'remote_support_controls';
  if (/evidence|document|proof/.test(text)) return 'evidence';
  return '';
}

function normalizeKnownGapField(value = '') {
  const text = normalizeQuestion(value);
  if (!text) return '';
  if (/business owner|business unit|workflow owner|accountable|owner/.test(text)) return 'business_owner';
  if (/geography|jurisdiction|country|regulatory perimeter/.test(text)) return 'geography';
  if (/review focus|focus|privacy|liability|termination|commercial|all risks|risk area/.test(text)) return 'review_focus';
  if (/export|classification|end use|permit|sanctions/.test(text)) return 'export_control_evidence';
  if (/remote|firmware|support|session|mfa|access/.test(text)) return 'remote_support_controls';
  if (/evidence|proof|agreement|contract|msa|dpa|soc|iso|bcp|document|clause/.test(text)) return 'evidence';
  return text.replace(/\s+/g, '_');
}

function inferKnownGapAnswer(text = '', previousDraft = {}) {
  if (!isUnknownOrPending(text)) return '';
  const previousQuestions = Array.isArray(previousDraft.questions) ? previousDraft.questions : [];
  const previousAsked = Array.isArray(previousDraft.askedQuestions) ? previousDraft.askedQuestions : [];
  const field = [...previousQuestions, ...previousAsked.slice().reverse()].map(fieldFromQuestion).find(Boolean);
  return field || 'user_confirmed_unknown';
}

function unique(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function extractByPatterns(text, patterns) {
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function extractEvidenceSignals(text) {
  return EVIDENCE_PATTERNS
    .filter(([label, pattern]) => pattern.test(text) && !(NEGATED_EVIDENCE_PATTERNS[label]?.test(text)))
    .map(([label]) => label);
}

function inferFirstByPatterns(text, patterns) {
  const match = patterns.find(([, pattern]) => pattern.test(text));
  return match ? match[0] : '';
}

function inferGeography(text = '') {
  const hits = unique(extractByPatterns(text, GEOGRAPHY_PATTERNS));
  if (!hits.length) return '';
  const specific = hits.filter((item) => item !== 'Global');
  if (specific.length > 1) return specific.join(' and ');
  return specific[0] || hits[0];
}

function isPayrollOutsourcingCase(draft = {}) {
  return /\b(payroll|salary|wage|compensation|hris|outsourc)\b/i.test([
    draft.brief,
    draft.supplierName,
    ...(draft.integrations || []),
    ...(draft.riskSignals || [])
  ].filter(Boolean).join(' '));
}

function inferReviewTargetFromText(text = '') {
  const clean = cleanText(text);
  const targets = [
    ['specific clauses', /\b(clause|clauses|section|sections|article|articles|termination clause|liability clause|indemnity clause)\b/i],
    ['MSA', /\b(msa|master service agreement|master services agreement)\b/i],
    ['DPA', /\b(dpa|data processing agreement)\b/i],
    ['SOW', /\b(sow|statement of work)\b/i],
    ['contract', /\b(contract)\b/i],
    ['agreement', /\b(agreement)\b/i],
    ['license terms', /\b(license|licence|subscription terms)\b/i],
    ['policy document', /\b(policy|procedure|standard)\b/i],
    ['document', /\b(document|file)\b/i]
  ];
  return targets.find(([, pattern]) => pattern.test(clean))?.[0] || '';
}

function inferRequestProfileFromText(text = '') {
  const clean = cleanText(text);
  const reviewTarget = inferReviewTargetFromText(clean);
  if (/\b(payroll|salary|wage|compensation|hris)\b/i.test(clean) && /\b(outsource|outsourcing|vendor|supplier|third party|third-party)\b/i.test(clean)) {
    return {
      requestType: 'payroll_outsourcing',
      reviewTarget: reviewTarget || 'payroll outsourcing vendor',
      recommendedFirstAction: 'ask_owner',
      conversationStage: 'asking_clarification'
    };
  }
  if (/\b(export control|import permit|customs|restricted hardware|ai accelerator|chip|semiconductor|sanctions|end[- ]use)\b/i.test(clean)) {
    return {
      requestType: 'export_control',
      reviewTarget: reviewTarget || 'export-control workflow',
      recommendedFirstAction: reviewTarget ? 'upload_document' : 'ask_scope',
      conversationStage: reviewTarget ? 'awaiting_document' : 'understanding_request'
    };
  }
  if (reviewTarget && (DOCUMENT_REVIEW_PATTERN.test(clean) || /\b(review|assess|check|analyse|analyze|redline)\b/i.test(clean))) {
    let requestType = 'document_review';
    if (/^MSA$/i.test(reviewTarget)) requestType = 'msa_review';
    else if (/^DPA$/i.test(reviewTarget)) requestType = 'dpa_review';
    else if (/contract/i.test(reviewTarget)) requestType = 'contract_review';
    else if (/clause/i.test(reviewTarget)) requestType = 'clause_review';
    else if (/policy/i.test(reviewTarget)) requestType = 'policy_review';
    return {
      requestType,
      reviewTarget,
      recommendedFirstAction: /clause/i.test(reviewTarget) ? 'paste_clause' : 'upload_document',
      conversationStage: 'awaiting_document'
    };
  }
  if (/\b(onboard|onboarding|approve|procure|supplier|vendor|third party|third-party)\b/i.test(clean)) {
    return {
      requestType: 'vendor_onboarding',
      reviewTarget: reviewTarget || 'vendor onboarding request',
      recommendedFirstAction: 'ask_owner',
      conversationStage: 'asking_clarification'
    };
  }
  return {
    requestType: 'general_compliance',
    reviewTarget,
    recommendedFirstAction: reviewTarget ? 'upload_document' : 'ask_scope',
    conversationStage: reviewTarget ? 'awaiting_document' : 'understanding_request'
  };
}

function requestProfileForDraft(draft = {}) {
  const llm = draft.llmIntake && typeof draft.llmIntake === 'object' ? draft.llmIntake : {};
  const deterministic = draft.intakeAssessment && typeof draft.intakeAssessment === 'object' ? draft.intakeAssessment : {};
  const fallback = inferRequestProfileFromText([
    draft.brief,
    draft.supplierName,
    ...(draft.evidenceSignals || []),
    ...(draft.riskSignals || [])
  ].filter(Boolean).join(' '));
  const requestType = cleanText(llm.requestType && llm.requestType !== 'unknown' ? llm.requestType : deterministic.requestType || fallback.requestType);
  const recommendedFirstAction = cleanText(llm.recommendedFirstAction && llm.recommendedFirstAction !== 'unknown'
    ? llm.recommendedFirstAction
    : deterministic.recommendedFirstAction || fallback.recommendedFirstAction);
  return {
    requestType: requestType || 'general_compliance',
    reviewTarget: cleanText(llm.reviewTarget || deterministic.reviewTarget || fallback.reviewTarget),
    reviewScope: cleanText(llm.reviewScope || deterministic.reviewScope || fallback.reviewScope),
    recommendedFirstAction: recommendedFirstAction || 'ask_scope',
    conversationStage: cleanText(llm.conversationStage || deterministic.conversationStage || fallback.conversationStage || 'understanding_request'),
    assistantSummary: cleanText(llm.assistantSummary),
    nextBestQuestion: cleanText(llm.nextBestQuestion),
    source: llm.requestType && llm.requestType !== 'unknown' ? 'compass' : deterministic.requestType ? 'deterministic_intake' : 'deterministic_fallback'
  };
}

function isDocumentReviewCase(draft = {}) {
  const profile = requestProfileForDraft(draft);
  return DOCUMENT_REVIEW_TYPES.has(profile.requestType)
    || Boolean(profile.reviewTarget && DOCUMENT_REVIEW_PATTERN.test(`review ${profile.reviewTarget}`));
}

function isClauseReviewCase(draft = {}) {
  const profile = requestProfileForDraft(draft);
  return profile.requestType === 'clause_review' || /clause/i.test(profile.reviewTarget) || CLAUSE_REVIEW_PATTERN.test(profile.reviewScope);
}

function cleanReviewTargetLabel(value = '') {
  const clean = cleanText(value)
    .replace(/\s*\([^)]*(?:not yet provided|not provided|pending|unknown)[^)]*\)\s*/gi, ' ')
    .replace(/\bsource material\b/gi, 'document')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'document';
  if (/^agreement document$/i.test(clean)) return 'agreement';
  if (/^contract document$/i.test(clean)) return 'contract';
  if (/^dpa document$/i.test(clean)) return 'DPA';
  if (/^msa document$/i.test(clean)) return 'MSA';
  return clean;
}

function reviewTargetWithArticle(value = '') {
  const target = cleanReviewTargetLabel(value || 'document');
  if (/^(MSA|DPA|SOW)$/i.test(target)) return `an ${target.toUpperCase()}`;
  if (/^(agreement|addendum)$/i.test(target)) return `an ${target}`;
  if (/^(specific clauses|license terms)$/i.test(target)) return target;
  if (/^(a|an|the)\s+/i.test(target)) return target;
  return /^[aeiou]/i.test(target) ? `an ${target}` : `a ${target}`;
}

function hasSubmittedEvidence(draft = {}) {
  return Boolean(
    draft.evidenceSignals?.length
    || draft.documents?.some((doc) => doc.signals?.length || doc.indexStatus === 'indexed' || doc.extractionStatus === 'retrieved_chunk' || doc.extractionStatus === 'backend_parsed')
    || draft.retrievalContext?.matches?.length
    || draft.retrievalContext?.evidenceMatches?.length
  );
}

function hasDocumentReviewSource(draft = {}) {
  return Boolean(draft.documents?.some((doc = {}) => {
    const sourceType = cleanText(doc.sourceType);
    const extractionStatus = cleanText(doc.extractionStatus);
    const title = cleanText([doc.title, doc.fileName, doc.name].filter(Boolean).join(' '));
    if (sourceType === 'chat_message') {
      const body = cleanText([doc.summary, doc.excerpt].filter(Boolean).join(' '));
      return Boolean(
        doc.signals?.length
        || /\b(attached|provided|pasted|here are|agreement says|contract says|clause\s+\d+|section\s+\d+|article\s+\d+)\b/i.test(body)
      );
    }
    return Boolean(
      title
      || doc.indexStatus === 'indexed'
      || ['retrieved_chunk', 'backend_parsed', 'nlp_extracted', 'text_extracted'].includes(extractionStatus)
      || doc.signals?.length
    );
  }));
}

function normalizeOwnerValue(value = '') {
  let clean = cleanText(value)
    .replace(/\b(?:geography|jurisdiction|regulatory perimeter|integrations?|evidence|risk signals?|shipment|service|supplier)\b.*$/i, '')
    .replace(/\s+\b(?:owns|own|will own|should own)\b\s+(?:it|this|the case|the request)?\.?$/i, '')
    .replace(/[.?!,;:]+$/g, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s+\b(?:is|are|was|were|will be|should be)\b.*$/i, '')
    .trim();
  if (!clean) return '';
  clean = clean
    .replace(/\bhead\s+of\s+it\b/i, 'Head of IT')
    .replace(/\bhuman resources\b/i, 'HR')
    .replace(/\bhr\b/i, 'HR')
    .replace(/\bit\b/g, 'IT')
    .replace(/\bIt\b/g, 'IT');
  if (/^HR$/i.test(clean)) return 'HR';
  if (/^IT$/i.test(clean)) return 'IT';
  if (/^head of IT$/i.test(clean)) return 'Head of IT';
  return clean
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bHr\b/g, 'HR')
    .replace(/\bIt\b/g, 'IT')
    .replace(/\bAi\b/g, 'AI');
}

function inferBusinessOwnerAnswer(text = '', previousDraft = {}) {
  const pendingOwner = !cleanText(previousDraft.businessUnit);
  const previousQuestions = Array.isArray(previousDraft.questions) ? previousDraft.questions.join(' ') : '';
  const likelyAnsweringOwner = pendingOwner && /business unit|workflow owner|case owner|accountable|\bown\b|internally|payroll outsourcing risk/i.test(previousQuestions);
  const shortOwnerPattern = likelyAnsweringOwner
    ? /\b(hr|human resources|people|payroll|it|legal|finance|procurement|security|compliance|risk|privacy|technology|operations|head|director|manager|owner)\b/i
    : /\b(it|legal|finance|procurement|security|compliance|risk|privacy|technology|operations|head|director|manager|owner)\b/i;
  const roleMatch = text.match(/\b((?:head|director|vp|manager|lead)\s+of\s+(?:it|[A-Z]{2,}|[A-Za-z][A-Za-z&/.-]+(?:\s+[A-Za-z&/.-]+){0,3}))\b/i);
  if (roleMatch?.[1]) return normalizeOwnerValue(roleMatch[1]);

  const explicitPatterns = [
    /\b(?:business\s+unit|workflow\s+owner|case\s+owner|accountable\s+(?:team|owner|business\s+unit)|responsible\s+(?:team|owner|unit)|owner)\s*(?:is|:|=|will be|should be)?\s+(?:the\s+)?([A-Za-z][A-Za-z0-9&/ '-]{1,80})(?=\.|,|;|\band\b|\bgeography\b|\bjurisdiction\b|$)/i,
    /\b(?:responsibility|accountability)\s+(?:sits with|belongs to|is with)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9&/ '-]{1,80})(?=\.|,|;|\band\b|\bgeography\b|\bjurisdiction\b|$)/i
  ];
  for (const pattern of explicitPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return normalizeOwnerValue(match[1]);
  }

  if (
    pendingOwner
    && text.length <= 90
    && !/\?$/.test(text)
    && (likelyAnsweringOwner || !inferFirstByPatterns(text, GEOGRAPHY_PATTERNS))
    && shortOwnerPattern.test(text)
  ) {
    return normalizeOwnerValue(text);
  }
  return '';
}

function inferSupplierName(text = '') {
  const patterns = [
    /\b(?:supplier|vendor|platform|tool|service)\s+(?:named|called)\s+([A-Z][A-Za-z0-9&.\- ]{2,48})/i,
    /\b(?:onboard|approve|procure|review|assess)\s+(?:(?:an|a|the)\s+)?([A-Z][A-Za-z0-9&.\- ]{2,48}?)(?:\s+(?:supplier|vendor|platform|tool|service)|\s+that|\s+with|\s+for|[,.]|$)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return cleanText(match[1]).replace(/^(?:an?|the)\s+/i, '').replace(/\s+(?:an?|the)$/i, '').trim();
    }
  }
  return '';
}

function detectIntent(message = '') {
  if (/\b(what evidence|which evidence|clear.*blocker|what do you need|checklist|requirements?)\b/i.test(message)) {
    return 'evidence_question';
  }
  if (/\b(run|execute|start|submit|assess|review|approve|procure|onboard)\b/i.test(message)) {
    return 'run_or_assess';
  }
  if (/\?$/.test(cleanText(message))) {
    return 'question';
  }
  return 'case_context';
}

function extractCaseFields(message = '', previousDraft = {}) {
  const text = cleanText(message);
  const intakeAssessment = inferRequestProfileFromText(text);
  const knownGap = inferKnownGapAnswer(text, previousDraft);
  const supplierName = inferSupplierName(text);
  const geography = inferGeography(text);
  const ownerAnswer = inferBusinessOwnerAnswer(text, previousDraft);
  const businessUnit = ownerAnswer || inferFirstByPatterns(text, BUSINESS_UNIT_PATTERNS);
  const integrations = extractByPatterns(text, INTEGRATION_PATTERNS);
  const evidenceSignals = extractEvidenceSignals(text);
  let riskSignals = extractByPatterns(text, RISK_PATTERNS);
  if (
    riskSignals.includes('export control')
    && /\b(ai accelerator|restricted hardware|chip|semiconductor|firmware)\b/i.test(text)
    && !/\b(llm|foundation model|model training|fine[- ]?tuning|automated decision|inference output|customer data|personal data|employee data)\b/i.test(text)
  ) {
    riskSignals = riskSignals.filter((signal) => signal !== 'AI/model use');
  }
  const hasEvidenceLanguage = evidenceSignals.length > 0 || /\b(attached|available|provided|evidence|summary|report|policy|contract|terms)\b/i.test(text);
  const documents = hasEvidenceLanguage
    ? [{
      evidenceId: `CHAT-${String((previousDraft.documents?.length || 0) + 1).padStart(2, '0')}`,
      title: 'Conversational intake evidence',
      sourceType: 'chat_message',
      extractionStatus: 'nlp_extracted',
      summary: text,
      excerpt: text.length > 260 ? `${text.slice(0, 260).trim()}...` : text,
      signals: unique(evidenceSignals)
    }]
    : [];

  return {
    supplierName,
    brief: text,
    intakeAssessment,
    businessUnit,
    geography,
    integrations,
    documents,
    evidenceSignals,
    riskSignals,
    knownGaps: knownGap ? [knownGap] : []
  };
}

function mergeDraft(existing = {}, extracted = {}) {
  const documents = [
    ...(Array.isArray(existing.documents) ? existing.documents : []),
    ...(Array.isArray(extracted.documents) ? extracted.documents : [])
  ].slice(-18);

  return {
    caseId: existing.caseId || extracted.caseId || '',
    supplierName: extracted.supplierName || existing.supplierName || 'Conversation-supplied case',
    brief: cleanText([existing.brief, extracted.brief].filter(Boolean).join(' ')).slice(0, 2400),
    businessUnit: extracted.businessUnit || existing.businessUnit || '',
    geography: extracted.geography || existing.geography || '',
    integrations: unique([...(existing.integrations || []), ...(extracted.integrations || [])]).slice(0, 12),
    documents,
    evidenceSignals: unique([...(existing.evidenceSignals || []), ...(extracted.evidenceSignals || [])]),
    riskSignals: unique([...(existing.riskSignals || []), ...(extracted.riskSignals || [])]),
    indexedEvidence: existing.indexedEvidence || extracted.indexedEvidence || null,
    retrievalContext: existing.retrievalContext || extracted.retrievalContext || null,
    llmIntake: existing.llmIntake || extracted.llmIntake || null,
    intakeAssessment: existing.intakeAssessment || extracted.intakeAssessment || null,
    knownGaps: unique([...(existing.knownGaps || []), ...(extracted.knownGaps || [])].map(normalizeKnownGapField)),
    askedQuestions: unique([...(existing.askedQuestions || []), ...(existing.questions || [])])
  };
}

function missingFields(draft = {}) {
  const missing = [];
  if (!cleanText(draft.brief)) missing.push('case_brief');
  if (!cleanText(draft.businessUnit)) missing.push('business_owner');
  if (!cleanText(draft.geography)) missing.push('geography');
  if (!hasSubmittedEvidence(draft)) missing.push('evidence');
  if (
    draft.riskSignals?.includes('export control')
    && !draft.evidenceSignals?.some((signal) => ['export classification', 'end-use certificate', 'import permit'].includes(signal))
  ) {
    missing.push('export_control_evidence');
  }
  if (
    draft.riskSignals?.includes('remote support access')
    && !draft.evidenceSignals?.some((signal) => ['firmware access runbook', 'remote support controls', 'identity and access'].includes(signal))
  ) {
    missing.push('remote_support_controls');
  }
  return missing;
}

function runReadinessForDraft(draft = {}, missing = []) {
  const executionBlockers = missing.filter((field) => ['case_brief', 'business_owner', 'geography', 'evidence'].includes(field));
  const advisoryGaps = missing.filter((field) => !executionBlockers.includes(field));
  const contextItems = [
    cleanText(draft.brief),
    cleanText(draft.businessUnit),
    cleanText(draft.geography),
    ...(draft.integrations || []),
    ...(draft.evidenceSignals || []),
    ...(draft.riskSignals || [])
  ].filter(Boolean);
  const score = Math.min(100, Math.round(
    (cleanText(draft.brief).length > 32 ? 22 : 0)
    + (cleanText(draft.businessUnit) ? 18 : 0)
    + (cleanText(draft.geography) ? 16 : 0)
    + Math.min(16, (draft.riskSignals?.length || 0) * 4)
    + Math.min(12, (draft.integrations?.length || 0) * 4)
    + Math.min(24, ((draft.evidenceSignals?.length || 0) + (draft.documents?.length || 0)) * 4)
    + Math.min(12, Number(draft.indexedEvidence?.chunkCount || 0) ? 10 : 0)
  ));
  let status = 'needs_intake';
  if (!executionBlockers.length) status = advisoryGaps.length ? 'runnable_with_open_gaps' : 'runnable';
  else if (contextItems.length >= 3) status = 'building_context';
  return {
    status,
    score,
    runnable: executionBlockers.length === 0,
    executionBlockers,
    advisoryGaps,
    missingFields: missing
  };
}

function casePayloadFromDraft(draft = {}) {
  return {
    caseId: draft.caseId || '',
    supplierName: draft.supplierName || 'Conversation-supplied case',
    brief: draft.brief || '',
    businessUnit: draft.businessUnit || '',
    geography: draft.geography || '',
    integrations: draft.integrations || [],
    documents: draft.documents || [],
    retrievalContext: draft.retrievalContext || null
  };
}

module.exports = {
  BUSINESS_UNIT_PATTERNS,
  DOCUMENT_REVIEW_PATTERN,
  DOCUMENT_REVIEW_TYPES,
  GEOGRAPHY_PATTERNS,
  cleanReviewTargetLabel,
  cleanText,
  detectIntent,
  extractCaseFields,
  fieldFromQuestion,
  hasDocumentReviewSource,
  hasSubmittedEvidence,
  inferRequestProfileFromText,
  isClauseReviewCase,
  isDocumentReviewCase,
  isPayrollOutsourcingCase,
  isUnknownOrPending,
  mergeDraft,
  missingFields,
  normalizeKnownGapField,
  normalizeQuestion,
  requestProfileForDraft,
  reviewTargetWithArticle,
  runReadinessForDraft,
  unique,
  casePayloadFromDraft
};
