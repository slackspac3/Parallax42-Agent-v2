'use strict';

const GEOGRAPHY_PATTERNS = [
  ['UAE', /\b(uae|united arab emirates|abu dhabi|dubai)\b/i],
  ['US', /\b(us|u\.s\.|usa|u\.s\.a\.|united states|america)\b/i],
  ['EU', /\b(eu|european union|europe)\b/i],
  ['UK', /\b(uk|u\.k\.|united kingdom|britain|england)\b/i],
  ['Russia', /\b(russia|russian federation)\b/i],
  ['Belarus', /\b(belarus)\b/i],
  ['Iran', /\b(iran)\b/i],
  ['North Korea', /\b(north korea|dprk)\b/i],
  ['Syria', /\b(syria)\b/i],
  ['Cuba', /\b(cuba)\b/i],
  ['Crimea', /\b(crimea)\b/i],
  ['India', /\b(india|mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|pune)\b/i],
  ['KSA', /\b(ksa|saudi|saudi arabia|riyadh)\b/i],
  ['Singapore', /\b(singapore)\b/i],
  ['Qatar', /\b(qatar|doha)\b/i],
  ['Egypt', /\b(egypt|cairo)\b/i],
  ['Global', /\b(global|multi[- ]?country|international|cross[- ]border)\b/i]
];

const EXPORT_ORIGIN_PATTERNS = [
  ['US', /\b(us|u\.s\.|usa|u\.s\.a\.|united states|america)\b/i],
  ['EU', /\b(eu|european union|europe)\b/i],
  ['UK', /\b(uk|u\.k\.|united kingdom|britain|england)\b/i],
  ['Russia', /\b(russia|russian federation)\b/i],
  ['Belarus', /\b(belarus)\b/i],
  ['Iran', /\b(iran)\b/i],
  ['North Korea', /\b(north korea|dprk)\b/i],
  ['Syria', /\b(syria)\b/i],
  ['Cuba', /\b(cuba)\b/i],
  ['China', /\b(china|prc|mainland china)\b/i],
  ['Taiwan', /\b(taiwan)\b/i],
  ['Singapore', /\b(singapore)\b/i],
  ['UAE', /\b(uae|united arab emirates)\b/i],
  ['Japan', /\b(japan)\b/i],
  ['South Korea', /\b(south korea|korea)\b/i]
];

const SANCTIONS_SENSITIVE_GEOGRAPHY_PATTERNS = [
  ['Russia', /\b(russia|russian federation)\b/i],
  ['Belarus', /\b(belarus)\b/i],
  ['Iran', /\b(iran)\b/i],
  ['North Korea', /\b(north korea|dprk)\b/i],
  ['Syria', /\b(syria)\b/i],
  ['Cuba', /\b(cuba)\b/i],
  ['Crimea', /\b(crimea)\b/i],
  ['Donetsk', /\b(donetsk|dnr)\b/i],
  ['Luhansk', /\b(luhansk|lnr)\b/i],
  ['Sevastopol', /\b(sevastopol)\b/i]
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
  ['sanctions screening', /\b(sanctions screening|restricted party screening|denied party screening|denied-party screening|party screening|screened clean|screening hit|no screening hits?|no sanctions hits?|all parties screened)\b/i],
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
  'sanctions screening': /\b(no|missing|without|pending|not final)\s+(sanctions|restricted party|denied party|party)\s+screening\b|\b(sanctions|restricted party|denied party|party)\s+screening[^.]{0,70}\b(missing|pending|not final|not attached|unavailable)\b/i,
  'firmware access runbook': /\b(no|missing|without|not final)\s+(firmware|remote access|remote diagnostic)[^.]{0,40}\b(runbook|approval|window)\b|firmware[^.]{0,70}\b(runbook|support)[^.]{0,50}\b(missing|pending|not final|not attached|unavailable)\b/i,
  DPA: /\b(no|missing|without|unsigned)\s+(signed\s+)?dpa\b|no signed dpa|dpa[^.]{0,60}\b(missing|not attached|unavailable|not available)\b/i,
  'model training terms': /\b(no|missing|without)\s+(model[- ]?training|training)\s+(exclusion|terms|language|evidence)\b|model[- ]?training[^.]{0,70}\b(missing|not attached|unavailable)\b/i,
  'BCP/DR': /\b(no|missing|without)\s+(bcp|business continuity|continuity|disaster recovery|dr plan)\b|continuity plan[^.]{0,70}\b(missing|not attached|unavailable)\b/i,
  'exit assistance': /\b(no|missing|without)\s+exit\s+(assistance|support)\b|exit support[^.]{0,70}\b(missing|not attached|unavailable)\b/i
};

const RISK_PATTERNS = [
  ['export control', /\b(export control|restricted hardware|ai accelerator|chip import|import permit|sanctions|restricted party|end[- ]use|customs|freight forwarder)\b/i],
  ['sanctions-sensitive geography', /\b(russia|russian federation|belarus|iran|north korea|dprk|syria|cuba|crimea|donetsk|luhansk|sevastopol)\b/i],
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
  'agreement_review',
  'msa_review',
  'dpa_review',
  'saas_agreement_review',
  'software_license_review',
  'data_sharing_review',
  'clause_review',
  'policy_review',
  'security_assurance_review',
  'procurement_review',
  'finance_project_review',
  'hse_esg_review',
  'ai_governance_review'
]);

const DOCUMENT_REVIEW_PATTERN = /\b(review|assess|check|analyse|analyze|look at|redline)\b[^.?!]{0,90}\b(agreement|contract|msa|master service agreement|master services agreement|sow|statement of work|dpa|data processing agreement|license|addendum|terms|clause|clauses|policy|document)\b|\b(agreement|contract|msa|master service agreement|master services agreement|sow|statement of work|dpa|data processing agreement|license|addendum|terms|clause|clauses|policy|document)\b[^.?!]{0,90}\b(review|assess|check|analyse|analyze|redline)\b/i;
const CLAUSE_REVIEW_PATTERN = /\b(clause|clauses|section|sections|article|articles|termination|liability|indemnity|data processing|subprocessor|governing law|audit right|service level|sla|confidentiality)\b/i;
const RECENT_FIELD_TURNS = 2;
const DOCUMENT_TYPE_PATTERNS = [
  ['dpa', /\b(dpa|data processing agreement|data protection addendum)\b/i],
  ['msa', /\b(msa|master service agreement|master services agreement)\b/i],
  ['sow', /\b(sow|statement of work|work order)\b/i],
  ['saas_agreement', /\b(saas|subscription|cloud service|software as a service|service terms|online services terms)\b/i],
  ['software_license', /\b(software license|software licence|license agreement|licence agreement|eula)\b/i],
  ['data_sharing_agreement', /\b(data sharing|data transfer agreement|joint controller|controller to controller)\b/i],
  ['nda', /\b(nda|non[- ]disclosure|confidentiality agreement)\b/i],
  ['purchase_order', /\b(purchase order|\bpo\b|order form|procurement package|rfp|tender|bid)\b/i],
  ['service_agreement', /\b(service agreement|managed service|outsourcing agreement|service provider agreement)\b/i],
  ['soc2_report', /\b(soc\s*2|soc ii|service organization controls)\b/i],
  ['iso_certificate', /\biso\s*27001|iso\s*22301|iso certificate|certificate of registration\b/i],
  ['security_report', /\b(pentest|penetration test|vulnerability report|security assessment|audit report)\b/i],
  ['bcp_dr_plan', /\b(bcp|business continuity|disaster recovery|dr plan|exit plan|exit assistance)\b/i],
  ['ai_governance_document', /\b(ai governance|model card|model risk|responsible ai|algorithmic impact|ai policy|llm)\b/i],
  ['export_control_pack', /\b(export classification|eccn|end[- ]use certificate|import permit|sanctions screening|restricted party|customs)\b/i],
  ['hse_esg_document', /\b(hse|health and safety|esg|environmental|sustainability|incident report)\b/i],
  ['policy_document', /\b(policy|procedure|standard|control framework|playbook|runbook)\b/i],
  ['contract', /\b(contract)\b/i],
  ['agreement', /\b(agreement|addendum|terms)\b/i],
  ['document', /\b(document|file|pdf|docx)\b/i]
];

const WORKFLOW_TYPES = new Set([
  'document_intake_triage',
  'contract_risk_review',
  'saas_vendor_review',
  'privacy_data_protection_review',
  'security_assurance_review',
  'procurement_vendor_review',
  'export_control_review',
  'ai_governance_review',
  'business_continuity_review',
  'finance_project_review',
  'hse_esg_review',
  'supplier_risk_review',
  'general_compliance_review'
]);

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isUnknownOrPending(value = '') {
  const text = cleanText(value).toLowerCase();
  if (!text) return false;
  if (/^(unknown|not sure|unsure|pending|tbd|tbc|to be confirmed|not available|unavailable|not yet|i don't know|i dont know|dont know|don't know|we don't know|we dont know|no idea|none yet|nothing yet|not right now|no documents yet|no evidence yet)$/i.test(text)) {
    return true;
  }
  if (text.length > 180) return false;
  return Boolean(
    /\b(?:i|we)\s+(?:do not|don't|dont)\s+(?:know|have|have it|have that|have this|have those)\b/i.test(text)
    || /\b(?:i|we)\s+(?:are not|aren't|am not|not)\s+sure\b/i.test(text)
    || /\b(?:not|isn't|is not|aren't|are not)\s+(?:known|available|ready|final|confirmed)\b/i.test(text)
    || /\b(?:still|currently)?\s*pending\b/i.test(text)
    || /\b(?:no|missing|without)\s+(?:evidence|documents?|contract|agreement|dpa|soc\s*2|iso|bcp|proof)\s*(?:yet|right now|at this point)?\b/i.test(text)
    || /\b(?:we|i)\s+(?:do not|don't|dont)\s+have\s+(?:the\s+)?(?:evidence|documents?|contract|agreement|dpa|soc\s*2|iso|bcp|proof)\b/i.test(text)
  );
}

function normalizeQuestion(value = '') {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fieldFromQuestion(question = '') {
  const text = normalizeQuestion(question);
  if (/owner|business unit|accountable|\bown\b|internally/.test(text)) return 'business_owner';
  if (/(from which country|exporting jurisdiction|export origin|origin jurisdiction|supplier ship|ship.*from|export control.*jurisdiction|export control.*country|export-control.*jurisdiction|export-control.*country)/.test(text)) return 'export_origin_jurisdiction';
  if (/geography|jurisdiction|regulatory perimeter|country/.test(text)) return 'geography';
  if (/(ai capabilities|ai use|ai usage|private assistant|retrieval|document intelligence|policy q a|meeting summaries|internal employees|external customers|regulated|high risk workflows|compliance decisions|legal determinations|hr matters|human resources matters|employment decisions|automated decision|semi automated decision|decision affecting people|eligibility|disciplinary|multi tenant|multi-tenant|cloud service|shared saas|shared environment|shared cloud|dedicated|private environment|single tenant|hosting model|hosted|hosting)/.test(text)) return 'ai_usage_scope';
  if (/(data categories|types of data|personal data|sensitive personal|confidential business|public or low sensitivity|public data|check all that apply|all of the above)/.test(text)) return 'data_categories';
  if (/focus|privacy|liability|termination|commercial|all risks|risk area|review area|prioritize/.test(text)) return 'review_focus';
  if (/sanctions|restricted party|denied party|party screening|screening hit/.test(text)) return 'sanctions_screening';
  if (/end use|end user|end-use|end-user|intended use|ultimate consignee/.test(text)) return 'export_end_use';
  if (/upload.*(agreement|contract|document|msa|dpa)|paste.*clause|clause.*paste|agreement.*upload|what evidence|evidence available|source evidence|proof|contract|dpa|soc|iso|bcp|document|clause/.test(text)) return 'evidence';
  if (/export|classification|end use|permit|sanctions|delivery site/.test(text)) return 'export_control_evidence';
  if (/remote|firmware|support|session|mfa|access/.test(text)) return 'remote_support_controls';
  if (/evidence|document|proof/.test(text)) return 'evidence';
  return '';
}

function fieldFromQuestionId(id = '') {
  const text = normalizeQuestion(id);
  if (!text) return '';
  if (/business owner/.test(text)) return 'business_owner';
  if (/export origin jurisdiction/.test(text)) return 'export_origin_jurisdiction';
  if (/export end use/.test(text)) return 'export_end_use';
  if (/sanctions screening/.test(text)) return 'sanctions_screening';
  if (/remote support controls/.test(text)) return 'remote_support_controls';
  if (/ai usage scope/.test(text)) return 'ai_usage_scope';
  if (/data categories/.test(text)) return 'data_categories';
  if (/review focus/.test(text)) return 'review_focus';
  if (/export control evidence/.test(text)) return 'export_control_evidence';
  if (/evidence/.test(text)) return 'evidence';
  if (/geography/.test(text)) return 'geography';
  return '';
}

function questionIdForQuestion(question = '', field = '') {
  const normalizedField = normalizeKnownGapField(field) || fieldFromQuestion(question);
  const text = normalizeQuestion(question);
  if (!normalizedField) return 'q_general_follow_up';
  if (normalizedField === 'ai_usage_scope' && /multi tenant|cloud service|shared saas|shared environment|dedicated|private environment|single tenant|hosting model|hosted|hosting/.test(text)) {
    return 'q_ai_usage_scope_hosting_model';
  }
  if (normalizedField === 'ai_usage_scope') return 'q_ai_usage_scope_decision_boundary';
  if (normalizedField === 'evidence' && /upload|paste|source document|source evidence|available/.test(text)) return 'q_evidence_source_material';
  if (normalizedField === 'review_focus') return 'q_review_focus_scope';
  return `q_${normalizedField}`;
}

function questionMetadataForQuestion(question = '', overrides = {}) {
  const text = cleanText(question);
  if (!text) return null;
  const field = normalizeKnownGapField(overrides.field || '') || fieldFromQuestionId(overrides.id || '') || fieldFromQuestion(text);
  const id = cleanText(overrides.id) || questionIdForQuestion(text, field);
  return {
    id,
    field,
    text
  };
}

function activeQuestionFieldForDraft(draft = {}) {
  return fieldFromQuestionId(draft.activeQuestionId)
    || normalizeKnownGapField(draft.activeQuestionField || '')
    || fieldFromQuestion(activeQuestionForDraft(draft));
}

function normalizeKnownGapField(value = '') {
  const text = normalizeQuestion(value);
  if (!text) return '';
  if (/business owner|business unit|workflow owner|accountable|owner/.test(text)) return 'business_owner';
  if (/export origin|origin jurisdiction|exporting jurisdiction|ship from|supplier ship|from which country|export control.*jurisdiction|export-control.*jurisdiction/.test(text)) return 'export_origin_jurisdiction';
  if (/geography|jurisdiction|country|regulatory perimeter/.test(text)) return 'geography';
  if (/ai usage|ai use|ai capabilities|internal employees|external customers|regulated workflows|high risk workflows|compliance decisions|legal determinations|hr matters|human resources matters|employment decisions|automated decision|semi automated decision|decision affecting people|eligibility|disciplinary|multi tenant|multi-tenant|cloud service|shared saas|shared environment|shared cloud|dedicated|private environment|single tenant|hosting model|hosted|hosting/.test(text)) return 'ai_usage_scope';
  if (/data categories|types of data|personal data|sensitive personal|confidential business|public or low sensitivity|public data/.test(text)) return 'data_categories';
  if (/review focus|focus|privacy|liability|termination|commercial|all risks|risk area/.test(text)) return 'review_focus';
  if (/sanctions|restricted party|denied party|party screening|screening hit/.test(text)) return 'sanctions_screening';
  if (/end use|end user|end-use|end-user|intended use|ultimate consignee/.test(text)) return 'export_end_use';
  if (/export|classification|end use|permit|sanctions/.test(text)) return 'export_control_evidence';
  if (/remote|firmware|support|session|mfa|access/.test(text)) return 'remote_support_controls';
  if (/evidence|proof|agreement|contract|msa|dpa|soc|iso|bcp|document|clause/.test(text)) return 'evidence';
  return text.replace(/\s+/g, '_');
}

function inferKnownGapAnswer(text = '', previousDraft = {}) {
  if (!isUnknownOrPending(text)) return '';
  const previousQuestions = Array.isArray(previousDraft.questions) ? previousDraft.questions : [];
  const previousAsked = Array.isArray(previousDraft.askedQuestions) ? previousDraft.askedQuestions : [];
  const activeQuestion = cleanText(previousDraft.activeQuestion);
  const historyQuestions = Array.isArray(previousDraft.conversationHistory)
    ? previousDraft.conversationHistory
      .filter((turn) => turn && turn.role === 'assistant')
      .flatMap((turn) => [turn.displayedQuestion, turn.text, turn.content, turn.message].map((value) => cleanText(value || '')).filter(Boolean))
      .filter(Boolean)
      .slice(-8)
      .reverse()
    : [];
  const explicitField = activeQuestionFieldForDraft(previousDraft);
  const field = explicitField || [activeQuestion, ...previousQuestions, ...historyQuestions, ...previousAsked.slice().reverse()].map(fieldFromQuestion).find(Boolean);
  return field || 'user_confirmed_unknown';
}

function unique(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function normalizeRecentlyAnsweredFields(value = {}) {
  if (!value || typeof value !== 'object') return {};
  const entries = Array.isArray(value)
    ? value.map((field) => [field, RECENT_FIELD_TURNS])
    : Object.entries(value);
  return entries.reduce((accumulator, [field, turns]) => {
    const normalized = normalizeKnownGapField(field);
    const count = Math.max(0, Math.min(RECENT_FIELD_TURNS, Number(turns) || 0));
    if (normalized && count > 0) accumulator[normalized] = count;
    return accumulator;
  }, {});
}

function answeredFieldsFromExtracted(extracted = {}) {
  const fields = [];
  if (cleanText(extracted.businessUnit)) fields.push('business_owner');
  if (cleanText(extracted.geography)) fields.push('geography');
  if (cleanText(extracted.exportOriginJurisdiction)) fields.push('export_origin_jurisdiction');
  if (cleanText(extracted.exportEndUse)) fields.push('export_end_use');
  if (cleanText(extracted.reviewFocus)) fields.push('review_focus');
  if (extracted.aiUsageScope && Object.keys(extracted.aiUsageScope).length) fields.push('ai_usage_scope');
  if (Array.isArray(extracted.dataCategories) && extracted.dataCategories.length) fields.push('data_categories');
  if (Array.isArray(extracted.documents) && extracted.documents.length) fields.push('evidence');
  if (Array.isArray(extracted.evidenceSignals) && extracted.evidenceSignals.length) {
    if (extracted.evidenceSignals.some((signal) => /classification|end-use|import permit|sanctions/i.test(signal))) {
      fields.push('export_control_evidence');
    }
    if (extracted.evidenceSignals.some((signal) => /firmware|remote support|identity and access|mfa|session/i.test(signal))) {
      fields.push('remote_support_controls');
    }
    if (extracted.evidenceSignals.some((signal) => /sanctions/i.test(signal))) {
      fields.push('sanctions_screening');
    }
  }
  if (Array.isArray(extracted.knownGaps)) {
    extracted.knownGaps.map(normalizeKnownGapField).filter(Boolean).forEach((field) => fields.push(field));
  }
  return unique(fields.map(normalizeKnownGapField));
}

function mergeRecentlyAnsweredFields(existing = {}, extracted = {}) {
  const next = {};
  const normalizedExisting = normalizeRecentlyAnsweredFields(existing);
  for (const [field, turns] of Object.entries(normalizedExisting)) {
    const remaining = Number(turns) - 1;
    if (remaining > 0) next[field] = remaining;
  }
  for (const field of answeredFieldsFromExtracted(extracted)) {
    next[field] = RECENT_FIELD_TURNS;
  }
  return next;
}

function isRecentlyAnsweredField(draft = {}, field = '') {
  const normalized = normalizeKnownGapField(field);
  if (!normalized) return false;
  return Number(normalizeRecentlyAnsweredFields(draft.recentlyAnsweredFields)[normalized] || 0) > 0;
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

function splitGeographyValues(value = '') {
  const clean = cleanText(value);
  if (!clean) return [];
  return unique(clean
    .replace(/\s+\band\b\s+/gi, ',')
    .replace(/\s*[+/;]\s*/g, ',')
    .split(',')
    .map((item) => cleanText(item))
    .filter(Boolean));
}

function inferUpdateMode(text = '') {
  const clean = cleanText(text);
  if (/\b(replace|instead|change(?:\s+it|\s+this|\s+the\s+\w+)?\s+to|switch(?:\s+it|\s+this)?\s+to|now only|only in|remove|drop|not\s+.+\s+anymore)\b/i.test(clean)) {
    return 'replace';
  }
  if (/\b(also|as well|in addition|add|include|including|plus|alongside|along with|and also|and some|with some|too|as another|another)\b/i.test(clean)) {
    return 'add';
  }
  return 'unspecified';
}

function mergeGeography(existing = '', next = '', updateMode = 'unspecified') {
  const current = cleanText(existing);
  const incoming = cleanText(next);
  if (!incoming) return current;
  if (!current || updateMode === 'replace') return incoming;
  const merged = unique([...splitGeographyValues(current), ...splitGeographyValues(incoming)]);
  return merged.length ? merged.join(' and ') : incoming;
}

function mergeAiUsageScope(existing = null, next = null, updateMode = 'unspecified') {
  if (!next || typeof next !== 'object' || !Object.keys(next).length) return existing || null;
  if (!existing || typeof existing !== 'object' || updateMode === 'replace') return next;
  return {
    ...existing,
    ...next,
    excludedWorkflows: unique([...(existing.excludedWorkflows || []), ...(next.excludedWorkflows || [])])
  };
}

function inferExportOriginJurisdiction(text = '', previousDraft = {}) {
  const clean = cleanText(text);
  if (!clean) return '';
  const questionContext = [
    previousDraft.activeQuestion,
    ...(Array.isArray(previousDraft.questions) ? previousDraft.questions : [])
  ].filter(Boolean).join(' ');
  const answeringOriginQuestion = activeQuestionFieldForDraft(previousDraft) === 'export_origin_jurisdiction'
    || fieldFromQuestion(questionContext) === 'export_origin_jurisdiction';
  const explicitOrigin = /\b(?:from|ships?\s+from|shipping\s+from|exporting\s+from|export\s+origin|origin\s+jurisdiction|exporting\s+jurisdiction|export-control\s+jurisdiction|export\s+control\s+jurisdiction)\b/i.test(clean);
  if (!answeringOriginQuestion && !explicitOrigin) return '';
  const hits = unique(extractByPatterns(clean, EXPORT_ORIGIN_PATTERNS));
  if (!hits.length) return '';
  return hits.slice(0, 2).join(' and ');
}

function inferExportEndUse(text = '', previousDraft = {}) {
  const clean = cleanText(text);
  if (!clean || isUnknownOrPending(clean)) return '';
  const activeField = activeQuestionFieldForDraft(previousDraft);
  const explicitEndUse = /\b(end[- ]use|end[- ]user|intended use|ultimate consignee)\b/i.test(clean);
  if (activeField !== 'export_end_use' && !explicitEndUse) return '';
  const patterns = [
    /\b(?:final\s+)?(?:end[- ]use|intended use)\s*(?:is|:|=|will be|for)?\s+([^.;?!]{3,160})/i,
    /\b(?:end[- ]user|ultimate consignee)\s*(?:is|:|=|will be)?\s+([^.;?!]{3,160})/i
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) return cleanText(match[1]).replace(/[,:;]+$/g, '').slice(0, 220);
  }
  if (activeField === 'export_end_use' && clean.length <= 220 && !/\?$/.test(clean)) {
    return clean;
  }
  return '';
}

function sanctionsSensitiveGeographiesFromText(text = '') {
  return unique(extractByPatterns(text, SANCTIONS_SENSITIVE_GEOGRAPHY_PATTERNS));
}

function inferContextualKnownGaps(text = '') {
  const clean = cleanText(text);
  const gaps = [];
  if (/\b(?:unknown|pending|not final|not confirmed|missing|without|no final)\b[^.]{0,60}\bend[- ]use\b|\bend[- ]use\b[^.]{0,80}\b(?:unknown|pending|not final|not confirmed|missing|not attached|unavailable)\b/i.test(clean)) {
    gaps.push('export_end_use');
  }
  if (/\b(?:unknown|pending|not final|missing|without|no)\b[^.]{0,60}\b(?:sanctions|restricted party|denied party|party)\s+screening\b|\b(?:sanctions|restricted party|denied party|party)\s+screening\b[^.]{0,80}\b(?:unknown|pending|not final|missing|not attached|unavailable)\b/i.test(clean)) {
    gaps.push('sanctions_screening');
  }
  return gaps;
}

function activeQuestionForDraft(draft = {}) {
  return cleanText(draft.activeQuestion || (Array.isArray(draft.questions) ? draft.questions[0] : ''));
}

function fieldSatisfiedByExtracted(field = '', extracted = {}) {
  const knownGaps = new Set((extracted.knownGaps || []).map(normalizeKnownGapField));
  if (knownGaps.has(field)) return true;
  if (field === 'business_owner') return Boolean(cleanText(extracted.businessUnit));
  if (field === 'geography') return Boolean(cleanText(extracted.geography));
  if (field === 'export_origin_jurisdiction') return Boolean(cleanText(extracted.exportOriginJurisdiction));
  if (field === 'export_end_use') return Boolean(cleanText(extracted.exportEndUse));
  if (field === 'sanctions_screening') {
    return Boolean(
      Array.isArray(extracted.evidenceSignals)
      && extracted.evidenceSignals.some((signal) => /sanctions/i.test(signal))
    );
  }
  if (field === 'ai_usage_scope') return Boolean(extracted.aiUsageScope && Object.keys(extracted.aiUsageScope).length);
  if (field === 'data_categories') return Boolean(Array.isArray(extracted.dataCategories) && extracted.dataCategories.length);
  if (field === 'review_focus') {
    return Boolean(cleanText(extracted.reviewFocus))
      || /\b(privacy|liability|termination|commercial|all risks?|all of them|all of these|all of those|all of the above|everything|access|security|data processing|dpa|business continuity|slas?|ai|model[- ]training)\b/i.test(extracted.brief || '');
  }
  if (field === 'evidence') {
    return Boolean(
      (Array.isArray(extracted.documents) && extracted.documents.length)
      || (Array.isArray(extracted.evidenceSignals) && extracted.evidenceSignals.length)
    );
  }
  if (field === 'export_control_evidence') {
    return Boolean(
      Array.isArray(extracted.evidenceSignals)
      && extracted.evidenceSignals.some((signal) => /classification|end-use|import permit|sanctions/i.test(signal))
    );
  }
  if (field === 'remote_support_controls') {
    return Boolean(
      Array.isArray(extracted.evidenceSignals)
      && extracted.evidenceSignals.some((signal) => /firmware|remote support|identity and access|mfa|session/i.test(signal))
    );
  }
  return true;
}

function validateActiveQuestionAnswer(message = '', previousDraft = {}, extracted = {}) {
  const question = activeQuestionForDraft(previousDraft);
  const field = activeQuestionFieldForDraft(previousDraft) || fieldFromQuestion(question);
  const text = cleanText(message);
  if ((!question && !field) || !text) {
    return { status: 'not_applicable', field: '', question: '' };
  }
  if (fieldSatisfiedByExtracted(field, extracted)) {
    return { status: 'satisfied', field, question };
  }
  return {
    status: 'needs_clarification',
    field,
    question,
    message: 'The latest reply did not answer the active clarification question.'
  };
}

function isPayrollOutsourcingCase(draft = {}) {
  const profile = requestProfileForDraft(draft);
  if (profile.requestType === 'payroll_outsourcing') return true;
  return /\b(payroll|salary|wage|compensation|hris|outsourc)\b/i.test([
    draft.brief,
    draft.supplierName,
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

function inferDocumentTypesFromText(text = '') {
  return DOCUMENT_TYPE_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label)
    .filter((label, index, values) => values.indexOf(label) === index);
}

function workflowStepsForType(workflowType = '') {
  const steps = {
    contract_risk_review: ['classify document', 'extract parties and scope', 'map obligations and gaps', 'prepare reviewer actions'],
    saas_vendor_review: ['classify SaaS terms', 'map data and integrations', 'check security/privacy evidence', 'prepare onboarding decision'],
    privacy_data_protection_review: ['identify roles and data categories', 'map transfer/retention/subprocessor terms', 'check DPA evidence', 'prepare privacy actions'],
    security_assurance_review: ['classify assurance artifact', 'extract controls and exceptions', 'map open security gaps', 'prepare assurance summary'],
    procurement_vendor_review: ['identify supplier and procurement scope', 'map commercial and third-party risk', 'check required proof', 'prepare approval actions'],
    export_control_review: ['classify controlled goods/services', 'map jurisdiction and end-use', 'check screening/classification proof', 'prepare escalation actions'],
    ai_governance_review: ['identify AI/model use', 'map data use and human oversight', 'check responsible AI evidence', 'prepare AI governance actions'],
    business_continuity_review: ['identify critical service', 'check BCP/DR and exit evidence', 'map continuity gaps', 'prepare resilience actions'],
    finance_project_review: ['identify financial exposure', 'check authority and payment controls', 'map project exceptions', 'prepare finance actions'],
    hse_esg_review: ['classify HSE/ESG obligation', 'map evidence and incident signals', 'check required attestations', 'prepare compliance actions'],
    supplier_risk_review: ['identify supplier/service scope', 'map risk domains', 'check due diligence evidence', 'prepare vendor review actions'],
    document_intake_triage: ['classify the ask', 'request source document or text', 'select review workflow', 'ask only missing clarifications'],
    general_compliance_review: ['understand the request', 'map relevant obligations', 'request missing proof', 'prepare reviewer actions']
  };
  return steps[workflowType] || steps.general_compliance_review;
}

function inferWorkflowTypeFromText(text = '', documentTypes = []) {
  const clean = cleanText(text);
  const docs = new Set(documentTypes);
  if (/\b(export control|import permit|customs|restricted hardware|ai accelerator|chip|semiconductor|sanctions|end[- ]use)\b/i.test(clean) || docs.has('export_control_pack')) return 'export_control_review';
  if (/\b(ai governance|responsible ai|model card|model risk|llm|training|fine[- ]?tuning|automated decision)\b/i.test(clean) || docs.has('ai_governance_document')) return 'ai_governance_review';
  if (/\b(saas|cloud service|subscription|microsoft 365|azure|entra|api|integration)\b/i.test(clean) || docs.has('saas_agreement') || docs.has('software_license')) return 'saas_vendor_review';
  if (/\b(dpa|personal data|patient data|employee data|data processing|subprocessor|retention|cross[- ]border|data transfer)\b/i.test(clean) || docs.has('dpa') || docs.has('data_sharing_agreement')) return 'privacy_data_protection_review';
  if (/\b(soc\s*2|iso\s*27001|pentest|security assessment|vulnerability|audit report)\b/i.test(clean) || docs.has('soc2_report') || docs.has('iso_certificate') || docs.has('security_report')) return 'security_assurance_review';
  if (/\b(bcp|disaster recovery|business continuity|exit assistance|critical service)\b/i.test(clean) || docs.has('bcp_dr_plan')) return 'business_continuity_review';
  if (/\b(procure|procurement|purchase order|\bpo\b|rfp|tender|sourcing|supplier|vendor)\b/i.test(clean) || docs.has('purchase_order')) return 'procurement_vendor_review';
  if (/\b(payment|invoice|ledger|treasury|budget|project compliance|capex|opex)\b/i.test(clean)) return 'finance_project_review';
  if (/\b(hse|health and safety|esg|environmental|sustainability)\b/i.test(clean) || docs.has('hse_esg_document')) return 'hse_esg_review';
  if (docs.has('contract') || docs.has('agreement') || docs.has('msa') || docs.has('sow') || docs.has('service_agreement') || docs.has('nda')) return 'contract_risk_review';
  if (docs.length) return 'document_intake_triage';
  if (/\b(onboard|onboarding|approve|third party|third-party|outsourc|supplier|vendor)\b/i.test(clean)) return 'supplier_risk_review';
  return 'general_compliance_review';
}

function requestTypeForWorkflow(workflowType = '', documentTypes = [], fallback = 'general_compliance') {
  const docs = new Set(documentTypes);
  if (docs.has('msa')) return 'msa_review';
  if (docs.has('dpa') || docs.has('data_sharing_agreement')) return 'dpa_review';
  if (docs.has('saas_agreement')) return 'saas_agreement_review';
  if (docs.has('software_license')) return 'software_license_review';
  if (docs.has('purchase_order')) return 'procurement_review';
  if (docs.has('soc2_report') || docs.has('iso_certificate') || docs.has('security_report')) return 'security_assurance_review';
  if (docs.has('ai_governance_document')) return 'ai_governance_review';
  if (docs.has('hse_esg_document')) return 'hse_esg_review';
  if (docs.has('contract')) return 'contract_review';
  if (docs.has('agreement') || docs.has('service_agreement') || docs.has('sow') || docs.has('nda')) return 'agreement_review';
  if (workflowType === 'export_control_review') return 'export_control';
  if (workflowType === 'procurement_vendor_review') return 'supplier_risk';
  if (workflowType === 'privacy_data_protection_review') return 'dpa_review';
  if (workflowType === 'finance_project_review') return 'finance_project_review';
  if (workflowType === 'business_continuity_review') return 'policy_review';
  return fallback;
}

function inferRequestProfileFromText(text = '') {
  const clean = cleanText(text);
  const reviewTarget = inferReviewTargetFromText(clean);
  const documentTypes = inferDocumentTypesFromText(clean);
  const workflowType = inferWorkflowTypeFromText(clean, documentTypes);
  const suggestedWorkflowSteps = workflowStepsForType(workflowType);
  if (/\b(payroll|salary|wage|compensation|hris)\b/i.test(clean) && /\b(outsource|outsourcing|vendor|supplier|third party|third-party)\b/i.test(clean)) {
    return {
      requestType: 'payroll_outsourcing',
      documentTypes,
      workflowType: 'privacy_data_protection_review',
      reviewTarget: reviewTarget || 'payroll outsourcing vendor',
      recommendedFirstAction: 'ask_owner',
      conversationStage: 'asking_clarification',
      suggestedWorkflowSteps: workflowStepsForType('privacy_data_protection_review')
    };
  }
  if (/\b(export control|import permit|customs|restricted hardware|ai accelerator|chip|semiconductor|sanctions|end[- ]use)\b/i.test(clean)) {
    const wantsDocumentReview = Boolean(documentTypes.length && /\b(review|assess|check|analyse|analyze|validate|verify)\b/i.test(clean));
    return {
      requestType: 'export_control',
      documentTypes,
      workflowType: 'export_control_review',
      reviewTarget: reviewTarget || (wantsDocumentReview ? documentTypes[0].replace(/_/g, ' ') : 'export-control workflow'),
      recommendedFirstAction: (reviewTarget || wantsDocumentReview) ? 'upload_document' : 'ask_scope',
      conversationStage: (reviewTarget || wantsDocumentReview) ? 'awaiting_document' : 'understanding_request',
      suggestedWorkflowSteps: workflowStepsForType('export_control_review')
    };
  }
  if (reviewTarget && (DOCUMENT_REVIEW_PATTERN.test(clean) || /\b(review|assess|check|analyse|analyze|redline)\b/i.test(clean))) {
    let requestType = requestTypeForWorkflow(workflowType, documentTypes, 'document_review');
    if (/^MSA$/i.test(reviewTarget)) requestType = 'msa_review';
    else if (/^DPA$/i.test(reviewTarget)) requestType = 'dpa_review';
    else if (/contract/i.test(reviewTarget)) requestType = 'contract_review';
    else if (/clause/i.test(reviewTarget)) requestType = 'clause_review';
    else if (/policy/i.test(reviewTarget)) requestType = 'policy_review';
    return {
      requestType,
      documentTypes,
      workflowType,
      reviewTarget,
      recommendedFirstAction: /clause/i.test(reviewTarget) ? 'paste_clause' : 'upload_document',
      conversationStage: 'awaiting_document',
      suggestedWorkflowSteps
    };
  }
  if (documentTypes.length && /\b(review|reviewed|reviewing|assess|assessed|checking|check|analyse|analyze|redline|validate|verify|map)\b/i.test(clean)) {
    return {
      requestType: requestTypeForWorkflow(workflowType, documentTypes, 'document_review'),
      documentTypes,
      workflowType,
      reviewTarget: reviewTarget || documentTypes[0].replace(/_/g, ' '),
      recommendedFirstAction: 'upload_document',
      conversationStage: 'awaiting_document',
      suggestedWorkflowSteps
    };
  }
  if (/\b(onboard|onboarding|approve|procure|supplier|vendor|third party|third-party)\b/i.test(clean)) {
    return {
      requestType: requestTypeForWorkflow(workflowType, documentTypes, 'vendor_onboarding'),
      documentTypes,
      workflowType: workflowType === 'general_compliance_review' ? 'supplier_risk_review' : workflowType,
      reviewTarget: reviewTarget || 'vendor onboarding request',
      recommendedFirstAction: 'ask_owner',
      conversationStage: 'asking_clarification',
      suggestedWorkflowSteps: workflowStepsForType(workflowType === 'general_compliance_review' ? 'supplier_risk_review' : workflowType)
    };
  }
  return {
    requestType: requestTypeForWorkflow(workflowType, documentTypes, 'general_compliance'),
    documentTypes,
    workflowType,
    reviewTarget,
    recommendedFirstAction: reviewTarget ? 'upload_document' : 'ask_scope',
    conversationStage: reviewTarget ? 'awaiting_document' : 'understanding_request',
    suggestedWorkflowSteps
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
  const workflowType = cleanText(llm.workflowType && llm.workflowType !== 'unknown' ? llm.workflowType : deterministic.workflowType || fallback.workflowType);
  const documentTypes = unique([
    ...(Array.isArray(llm.documentTypes) ? llm.documentTypes : []),
    ...(Array.isArray(deterministic.documentTypes) ? deterministic.documentTypes : []),
    ...(Array.isArray(fallback.documentTypes) ? fallback.documentTypes : [])
  ]).slice(0, 8);
  const suggestedWorkflowSteps = unique([
    ...(Array.isArray(llm.suggestedWorkflowSteps) ? llm.suggestedWorkflowSteps : []),
    ...(Array.isArray(deterministic.suggestedWorkflowSteps) ? deterministic.suggestedWorkflowSteps : []),
    ...(Array.isArray(fallback.suggestedWorkflowSteps) ? fallback.suggestedWorkflowSteps : [])
  ]).slice(0, 6);
  return {
    requestType: requestType || 'general_compliance',
    workflowType: workflowType || fallback.workflowType || 'general_compliance_review',
    documentTypes,
    reviewTarget: cleanText(llm.reviewTarget || deterministic.reviewTarget || fallback.reviewTarget),
    reviewScope: cleanText(llm.reviewScope || deterministic.reviewScope || fallback.reviewScope),
    recommendedFirstAction: recommendedFirstAction || 'ask_scope',
    conversationStage: cleanText(llm.conversationStage || deterministic.conversationStage || fallback.conversationStage || 'understanding_request'),
    suggestedWorkflowSteps: suggestedWorkflowSteps.length ? suggestedWorkflowSteps : workflowStepsForType(workflowType || fallback.workflowType),
    assistantSummary: cleanText(llm.assistantSummary),
    nextBestQuestion: cleanText(llm.nextBestQuestion),
    source: llm.requestType && llm.requestType !== 'unknown' ? 'compass' : deterministic.requestType ? 'deterministic_intake' : 'deterministic_fallback'
  };
}

function isDocumentReviewCase(draft = {}) {
  const profile = requestProfileForDraft(draft);
  return DOCUMENT_REVIEW_TYPES.has(profile.requestType)
    || Boolean(profile.documentTypes?.length && ['upload_document', 'paste_clause'].includes(profile.recommendedFirstAction))
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

function isAffirmativeAnswer(value = '') {
  return /^(yes|yep|yeah|correct|right|that'?s right|yes please|confirm|confirmed|that is correct)\.?$/i.test(cleanText(value));
}

function ownerSpellingSuggestion(value = '') {
  const clean = cleanText(value).replace(/[^a-z\s]/gi, '').toLowerCase();
  if (!clean) return null;
  const compact = clean.replace(/\s+/g, '');
  const suggestions = [
    ['Compliance', /^(complianc|complaince|complicance|compliane|compliancee|compliace)$/i],
    ['Legal And Privacy', /^(legalprivcy|legalprivacy|privcy|privacy)$/i],
    ['Technology Risk', /^(technolgy|techrisk|technologyrisk)$/i],
    ['Procurement', /^(procuremnt|procurment|procurmentrisk)$/i],
    ['Finance', /^(finace|financ)$/i]
  ];
  const match = suggestions.find(([, pattern]) => pattern.test(compact));
  if (!match) return null;
  if (normalizeOwnerValue(value) === match[0]) return null;
  return {
    field: 'business_owner',
    rawValue: normalizeOwnerValue(value),
    suggestion: match[0],
    reason: 'possible_spelling_mistake'
  };
}

function inferBusinessOwnerAnswer(text = '', previousDraft = {}) {
  if (previousDraft.pendingFieldClarification?.field === 'business_owner' && isAffirmativeAnswer(text)) {
    return normalizeOwnerValue(previousDraft.pendingFieldClarification.suggestion);
  }
  if (/^(?:run|execute|submit|start)(?:\s+(?:it|council|the\s+council|workflow|the\s+workflow|now))?\.?$/i.test(cleanText(text))) {
    return '';
  }
  const pendingOwner = !cleanText(previousDraft.businessUnit);
  const previousQuestions = [
    previousDraft.activeQuestion,
    ...(Array.isArray(previousDraft.questions) ? previousDraft.questions : [])
  ].filter(Boolean).join(' ');
  const recentAssistantQuestions = Array.isArray(previousDraft.conversationHistory)
    ? previousDraft.conversationHistory
      .filter((turn) => turn && turn.role === 'assistant')
      .flatMap((turn) => [turn.displayedQuestion, turn.text, turn.content, turn.message].map((value) => cleanText(value || '')).filter(Boolean))
      .filter(Boolean)
      .slice(-6)
      .join(' ')
    : '';
  const ownerQuestionContext = [previousQuestions, recentAssistantQuestions].filter(Boolean).join(' ');
  if (isGenericScopeAnswerContext(text, previousDraft) && !/\b(owner|owned by|owns|responsible|accountable)\b/i.test(text)) {
    return '';
  }
  const likelyAnsweringOwner = /business unit|workflow owner|case owner|accountable|\bown\b|internally|payroll outsourcing risk/i.test(ownerQuestionContext);
  if (
    !likelyAnsweringOwner
    && /\b(review|assess|check|need|want|validate|verify)\b[^.?!]{0,90}\b(report|agreement|contract|document|purchase order|\bpo\b|soc|iso|clause|policy|dpa|msa|sow)\b/i.test(text)
  ) {
    return '';
  }
  const shortOwnerPattern = likelyAnsweringOwner
    ? /\b(hr|human resources|people|payroll|it|legal|finance|procurement|security|compliance|risk|privacy|technology|operations|platform(?:\s+team)?|product|engineering|head|director|manager|owner)\b/i
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
    (pendingOwner || likelyAnsweringOwner)
    && text.length <= 90
    && !/\?$/.test(text)
    && (likelyAnsweringOwner || !inferFirstByPatterns(text, GEOGRAPHY_PATTERNS))
    && shortOwnerPattern.test(text)
  ) {
    return normalizeOwnerValue(text);
  }
  return '';
}

function inferAiUsageScope(text = '', previousDraft = {}) {
  const clean = cleanText(text);
  if (!clean) return null;
  const questionContext = [
    previousDraft.activeQuestion,
    ...(Array.isArray(previousDraft.questions) ? previousDraft.questions : [])
  ].filter(Boolean).join(' ');
  const activeField = activeQuestionFieldForDraft(previousDraft);
  const aiQuestionContext = activeField === 'ai_usage_scope'
    || /\b(ai|private assistant|retrieval|document intelligence|policy|meeting summar|compliance evidence extraction|high[- ]risk workflow|multi[- ]tenant|cloud service|shared saas|shared environment|shared cloud|dedicated|private environment|single[- ]tenant|hosting model|hosted|hosting)\b/i.test(questionContext);
  const hasScopeLanguage = /\b(internal|internel|interal|employee|employees|staff|contractor|contractors|third[- ]party|partners?|external|customer|customers|client|clients|public|hr|human resources|employment|legal|compliance|regulated|high[- ]risk|workflow|use case|decision|matter|retrieval only|document assistance|multi[- ]tenant|tenant|shared saas|shared environment|shared cloud|shared service|dedicated|private environment|private cloud|single[- ]tenant|isolated tenant|customer hosted|self[- ]hosted|on[- ]prem|hosting|hosted)\b/i.test(clean);
  if (!aiQuestionContext && !hasScopeLanguage) return null;

  const scope = {};
  if (/\b(multi[- ]tenant|shared\s+(?:saas|cloud|service|environment)|saas environment|shared tenancy|shared tenant)\b/i.test(clean)) {
    scope.hostingModel = 'multi_tenant_saas';
  }
  if (/\b(dedicated|private\s+(?:environment|cloud|deployment)|single[- ]tenant|isolated tenant|tenant dedicated)\b/i.test(clean)) {
    scope.hostingModel = 'dedicated_private_environment';
  }
  if (/\b(customer[- ]hosted|self[- ]hosted|on[- ]prem(?:ises)?|customer managed)\b/i.test(clean)) {
    scope.hostingModel = 'customer_hosted';
  }
  if (/\b(?:internal(?:ly)?|internel|interal|employee|employees|staff|workforce|company users?)\b/i.test(clean)) {
    scope.audience = /\b(?:only|solely|just)\b[^.]{0,35}\b(?:internal|internel|interal|employee|employees|staff)\b|\b(?:internal|internel|interal|employee|employees|staff)\b[^.]{0,35}\b(?:only|solely|just)\b/i.test(clean)
      ? 'internal_employees_only'
      : 'internal_employees';
  }
  if (/\b(?:retrieval only|document assistance only|search only|policy search only|reference only|summar(?:y|ies|isation|ization) only)\b/i.test(clean)) {
    scope.taskBoundary = 'retrieval_or_document_assistance_only';
  }
  if (/\b(?:external|customer|customers|client|clients|public|end users?)\b/i.test(clean)) {
    scope.externalUsers = !/\b(?:no|not|won'?t|will not|without)\b[^.]{0,50}\b(?:external|customer|customers|client|clients|public|end users?)\b/i.test(clean);
    if (scope.externalUsers) scope.audience = scope.audience || 'external_users_possible';
  }
  if (/\b(?:contractor|contractors|third[- ]party contractors?|implementation partners?|external partners?)\b/i.test(clean)) {
    scope.thirdPartyContractors = !/\b(?:no|not|won'?t|will not|without)\b[^.]{0,50}\b(?:contractor|contractors|third[- ]party contractors?|partners?)\b/i.test(clean);
    if (scope.thirdPartyContractors) scope.audience = scope.audience && scope.audience !== 'internal_employees_only'
      ? scope.audience
      : 'internal_employees_and_contractors';
  }

  const excludedWorkflows = [];
  if (/\b(?:no|not|won'?t|will not|would not|not planned|excluded|out of scope)\b[^.]{0,80}\b(?:compliance|regulatory|legal)\b|\b(?:compliance|regulatory|legal)\b[^.]{0,80}\b(?:won'?t|will not|not|excluded|out of scope)\b/i.test(clean)) {
    excludedWorkflows.push('compliance decisions');
  }
  if (/\b(?:no|not|won'?t|will not|would not|not planned|excluded|out of scope)\b[^.]{0,80}\b(?:hr|human resources|employment|employee decision)\b|\b(?:hr|human resources|employment|employee decision)\b[^.]{0,80}\b(?:won'?t|will not|not|excluded|out of scope)\b/i.test(clean)) {
    excludedWorkflows.push('HR matters');
  }
  if (/\b(?:no|not|won'?t|will not|would not|not planned|excluded|out of scope)\b[^.]{0,80}\b(?:legal determination|legal decision|legal effect)\b|\b(?:legal determination|legal decision|legal effect)\b[^.]{0,80}\b(?:won'?t|will not|not|excluded|out of scope)\b/i.test(clean)) {
    excludedWorkflows.push('legal determinations');
  }
  if (/\b(?:no|not|won'?t|will not|would not|not planned|excluded|out of scope)\b[^.]{0,100}\b(?:automated|semi[- ]automated|eligibility|access|disciplinary|decision affecting people)\b|\b(?:automated|semi[- ]automated|eligibility|access|disciplinary|decision affecting people)\b[^.]{0,100}\b(?:won'?t|will not|not|excluded|out of scope)\b/i.test(clean)) {
    excludedWorkflows.push('automated or people-impacting decisions');
  }
  if (excludedWorkflows.length) scope.excludedWorkflows = unique(excludedWorkflows);
  if (/\b(?:regulated|high[- ]risk|legal effect|significant effect|automated decision)\b/i.test(clean) && !excludedWorkflows.length) {
    scope.highRiskWorkflowMentioned = true;
  }
  return Object.keys(scope).length ? scope : null;
}

function inferReviewFocus(text = '', previousDraft = {}) {
  const clean = cleanText(text);
  if (!clean) return '';
  const activeField = activeQuestionFieldForDraft(previousDraft);
  const questionContext = [
    previousDraft.activeQuestion,
    ...(Array.isArray(previousDraft.questions) ? previousDraft.questions : [])
  ].filter(Boolean).join(' ');
  const answeringFocusQuestion = activeField === 'review_focus'
    || /\b(review focus|focus|prioriti[sz]e|risk areas?|commercial\/legal|data protection|dpa terms|model[- ]training|security and access|business continuity|slas?)\b/i.test(questionContext);
  if (!answeringFocusQuestion) return '';
  if (/\b(all of them|all of these|all of those|all of it|all of the above|all above|all listed|everything listed|everything|all material risks?|all risks?|full[- ]spectrum|end[- ]to[- ]end|all(?:\s+(?:of\s+)?(?:the\s+)?)?areas?|all(?:\s+(?:of\s+)?(?:the\s+)?)?focus areas?|all(?:\s+(?:of\s+)?(?:the\s+)?)?review areas?)\b/i.test(clean)) {
    return 'all listed review areas';
  }
  const selected = [];
  if (/\b(data protection|privacy|dpa|data processing|transfer|subprocessor|retention|deletion)\b/i.test(clean)) selected.push('data protection and DPA terms');
  if (/\b(ai|model[- ]training|training use|customer data use|responsible ai|model governance)\b/i.test(clean)) selected.push('AI/model-training use of data');
  if (/\b(security|access|sso|mfa|roles?|identity|integrations?|cloud controls?)\b/i.test(clean)) selected.push('security and access controls');
  if (/\b(business continuity|continuity|sla|slas|uptime|disaster recovery|dr|bcp)\b/i.test(clean)) selected.push('business continuity and SLAs');
  if (/\b(commercial|legal terms?|liability|indemnity|indemnities|ip|termination|fees?)\b/i.test(clean)) selected.push('commercial/legal terms');
  return selected.length ? unique(selected).join(', ') : '';
}

function inferDataCategories(text = '', previousDraft = {}) {
  const clean = cleanText(text);
  if (!clean) return [];
  const activeField = activeQuestionFieldForDraft(previousDraft);
  const questionContext = [
    previousDraft.activeQuestion,
    ...(Array.isArray(previousDraft.questions) ? previousDraft.questions : [])
  ].filter(Boolean).join(' ');
  const answeringDataQuestion = activeField === 'data_categories'
    || /\b(data categories|types of data|personal data|sensitive personal|confidential business|public or low-sensitivity|check all that apply)\b/i.test(questionContext);
  const allOptions = [
    'employee or contractor personal data',
    'sensitive personal data',
    'confidential business documents',
    'public or low-sensitivity data'
  ];
  if (answeringDataQuestion && /\b(all of the above|all above|everything listed|all listed|all)\b/i.test(clean)) {
    return allOptions;
  }
  const values = [];
  if (/\b(employee|contractor|personal data|pii|names?|contact details?|ids?|identifiers?|customer data)\b/i.test(clean)) {
    values.push('personal data');
  }
  if (/\b(sensitive personal|health|biometric|religion|political|special categor(?:y|ies)|criminal|medical)\b/i.test(clean)) {
    values.push('sensitive personal data');
  }
  if (/\b(confidential|contracts?|financials?|strategy|source code|security docs?|security documents?|trade secrets?)\b/i.test(clean)) {
    values.push('confidential business documents');
  }
  if (/\b(public|low[- ]sensitivity|non[- ]confidential)\b/i.test(clean)) {
    values.push('public or low-sensitivity data');
  }
  return unique(values);
}

function requiresAiUsageScopeValidation(draft = {}) {
  if (draft.aiUsageScope && Object.keys(draft.aiUsageScope).length) return false;
  const knownGaps = new Set((draft.knownGaps || []).map(normalizeKnownGapField));
  if (knownGaps.has('ai_usage_scope')) return false;
  const profile = requestProfileForDraft(draft);
  const documentText = (draft.documents || []).flatMap((doc = {}) => [
    doc.title,
    doc.fileName,
    doc.name,
    doc.summary,
    doc.excerpt,
    ...(Array.isArray(doc.signals) ? doc.signals : [])
  ]);
  const haystack = [
    draft.brief,
    draft.supplierName,
    profile.requestType,
    profile.workflowType,
    profile.reviewTarget,
    profile.reviewScope,
    ...(profile.documentTypes || []),
    ...(draft.riskSignals || []),
    ...(draft.evidenceSignals || []),
    ...(draft.integrations || []),
    ...documentText
  ].filter(Boolean).join(' ');
  if ((draft.riskSignals || []).includes('AI/model use')) return true;
  if (profile.workflowType === 'ai_governance_review' || (profile.documentTypes || []).includes('ai_governance_document')) return true;
  return /\b(ai assistant|private assistant|ai[- ]assisted|ai[- ]enabled|generative ai|llm|foundation model|model[- ]training|fine[- ]?tuning|cloud ai model|model services|model governance|model[- ]governance|responsible ai|responsible[- ]ai|human oversight|human[- ]oversight|retrieval quality|retrieval[- ]quality|document intelligence|policy q\s*&?\s*a|meeting summar(?:y|ies)|compliance evidence extraction|automated decision|semi[- ]automated decision)\b/i.test(haystack);
}

function hasKnownGap(draft = {}, field = '') {
  return new Set((draft.knownGaps || []).map(normalizeKnownGapField)).has(normalizeKnownGapField(field));
}

function hasEvidenceSignal(draft = {}, pattern) {
  return (draft.evidenceSignals || []).some((signal) => pattern.test(signal));
}

function isExportControlCase(draft = {}) {
  const profile = requestProfileForDraft(draft);
  const haystack = [
    draft.brief,
    profile.requestType,
    profile.workflowType,
    ...(draft.riskSignals || []),
    ...(draft.evidenceSignals || [])
  ].filter(Boolean).join(' ');
  return (draft.riskSignals || []).includes('export control')
    || profile.workflowType === 'export_control_review'
    || /\b(export control|restricted hardware|controlled item|controlled service|ai accelerator|chip import|semiconductor|eccn|license analysis|end[- ]use|end[- ]user|import permit|customs)\b/i.test(haystack);
}

function requiresExportOriginValidation(draft = {}) {
  if (!isExportControlCase(draft)) return false;
  if (cleanText(draft.exportOriginJurisdiction)) return false;
  return !hasKnownGap(draft, 'export_origin_jurisdiction');
}

function requiresExportEndUseValidation(draft = {}) {
  if (!isExportControlCase(draft)) return false;
  if (cleanText(draft.exportEndUse)) return false;
  if (hasEvidenceSignal(draft, /end-use certificate/i)) return false;
  return !hasKnownGap(draft, 'export_end_use');
}

function requiresSanctionsScreeningValidation(draft = {}) {
  const sensitiveGeo = Boolean((draft.sanctionsSensitiveGeographies || []).length || (draft.riskSignals || []).includes('sanctions-sensitive geography'));
  if (!isExportControlCase(draft) && !sensitiveGeo && !(draft.riskSignals || []).some((signal) => /sanctions|restricted party/i.test(signal))) return false;
  if (hasEvidenceSignal(draft, /sanctions screening/i)) return false;
  return !hasKnownGap(draft, 'sanctions_screening');
}

function requiresRemoteSupportControlsValidation(draft = {}) {
  if (!(draft.riskSignals || []).includes('remote support access')) return false;
  if (hasEvidenceSignal(draft, /firmware access runbook|remote support controls|identity and access/i)) return false;
  return !hasKnownGap(draft, 'remote_support_controls');
}

function isGenericScopeAnswerContext(text = '', previousDraft = {}) {
  if (cleanText(text).length > 80) return false;
  const questionContext = [
    previousDraft.activeQuestion,
    ...(Array.isArray(previousDraft.questions) ? previousDraft.questions : [])
  ].filter(Boolean).join(' ');
  return /what do you need reviewed|what should i review|what decision do you need|what needs review/i.test(questionContext)
    && !/owner|business unit|accountable|\bown\b|internally/i.test(questionContext);
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
  const updateMode = inferUpdateMode(text);
  const supplierName = inferSupplierName(text);
  const activeField = activeQuestionFieldForDraft(previousDraft);
  const geography = activeField === 'export_origin_jurisdiction' ? '' : inferGeography(text);
  const exportOriginJurisdiction = inferExportOriginJurisdiction(text, previousDraft);
  const exportEndUse = inferExportEndUse(text, previousDraft);
  const ownerAnswer = inferBusinessOwnerAnswer(text, previousDraft);
  const ownerCorrection = ownerSpellingSuggestion(ownerAnswer);
  const businessUnit = ownerCorrection ? '' : ownerAnswer;
  const aiUsageScope = inferAiUsageScope(text, previousDraft);
  const reviewFocus = inferReviewFocus(text, previousDraft);
  const dataCategories = inferDataCategories(text, previousDraft);
  const integrations = extractByPatterns(text, INTEGRATION_PATTERNS);
  const evidenceSignals = extractEvidenceSignals(text);
  const sanctionsSensitiveGeographies = sanctionsSensitiveGeographiesFromText(text);
  let riskSignals = extractByPatterns(text, RISK_PATTERNS);
  if (sanctionsSensitiveGeographies.length && !riskSignals.includes('sanctions-sensitive geography')) {
    riskSignals.push('sanctions-sensitive geography');
  }
  if (
    riskSignals.includes('export control')
    && /\b(ai accelerator|restricted hardware|chip|semiconductor|firmware)\b/i.test(text)
    && !/\b(llm|foundation model|model training|fine[- ]?tuning|automated decision|inference output|customer data|personal data|employee data)\b/i.test(text)
  ) {
    riskSignals = riskSignals.filter((signal) => signal !== 'AI/model use');
  }
  const hasEvidenceLanguage = Boolean(
    evidenceSignals.length > 0 && /\b(attached|available|provided|pasted|uploaded|we have|i have|evidence)\b/i.test(text)
  ) || /\b(attached|provided|pasted|uploaded|here is|here are|summary says|report says|policy says|contract says|terms say|agreement says|evidence available)\b/i.test(text);
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
    exportOriginJurisdiction,
    exportEndUse,
    integrations,
    documents,
    evidenceSignals,
    riskSignals,
    sanctionsSensitiveGeographies,
    knownGaps: unique([...(knownGap ? [knownGap] : []), ...inferContextualKnownGaps(text)]),
    reviewFocus,
    aiUsageScope,
    dataCategories,
    updateMode,
    fieldClarifications: ownerCorrection ? [ownerCorrection] : []
  };
}

function mergeDraft(existing = {}, extracted = {}) {
  const documents = [
    ...(Array.isArray(existing.documents) ? existing.documents : []),
    ...(Array.isArray(extracted.documents) ? extracted.documents : [])
  ].slice(-18);
  const extractedAssessment = extracted.intakeAssessment && typeof extracted.intakeAssessment === 'object' ? extracted.intakeAssessment : null;
  const existingAssessment = existing.intakeAssessment && typeof existing.intakeAssessment === 'object' ? existing.intakeAssessment : null;
  const extractedAssessmentIsSpecific = Boolean(
    extractedAssessment
    && (
      (extractedAssessment.requestType && extractedAssessment.requestType !== 'general_compliance')
      || cleanText(extractedAssessment.reviewTarget)
      || (Array.isArray(extractedAssessment.documentTypes) && extractedAssessment.documentTypes.length)
    )
  );

  const fieldClarifications = Array.isArray(extracted.fieldClarifications) ? extracted.fieldClarifications : [];
  const pendingFieldClarification = cleanText(extracted.businessUnit)
    ? null
    : fieldClarifications[0] || existing.pendingFieldClarification || null;

  return {
    caseId: existing.caseId || extracted.caseId || '',
    supplierName: extracted.supplierName || existing.supplierName || 'Conversation-supplied case',
    brief: cleanText([existing.brief, extracted.brief].filter(Boolean).join(' ')).slice(0, 2400),
    businessUnit: extracted.businessUnit || existing.businessUnit || '',
    geography: mergeGeography(existing.geography, extracted.geography, extracted.updateMode),
    exportOriginJurisdiction: extracted.exportOriginJurisdiction || existing.exportOriginJurisdiction || '',
    exportEndUse: extracted.exportEndUse || existing.exportEndUse || '',
    reviewFocus: extracted.reviewFocus || existing.reviewFocus || '',
    aiUsageScope: mergeAiUsageScope(existing.aiUsageScope, extracted.aiUsageScope, extracted.updateMode),
    dataCategories: unique([...(existing.dataCategories || []), ...(extracted.dataCategories || [])]).slice(0, 16),
    integrations: unique([...(existing.integrations || []), ...(extracted.integrations || [])]).slice(0, 12),
    documents,
    evidenceSignals: unique([...(existing.evidenceSignals || []), ...(extracted.evidenceSignals || [])]),
    riskSignals: unique([...(existing.riskSignals || []), ...(extracted.riskSignals || [])]),
    sanctionsSensitiveGeographies: unique([...(existing.sanctionsSensitiveGeographies || []), ...(extracted.sanctionsSensitiveGeographies || [])]).slice(0, 8),
    indexedEvidence: existing.indexedEvidence || extracted.indexedEvidence || null,
    retrievalContext: existing.retrievalContext || extracted.retrievalContext || null,
    llmIntake: existing.llmIntake || extracted.llmIntake || null,
    intakeAssessment: extractedAssessmentIsSpecific ? extractedAssessment : existingAssessment || extractedAssessment || null,
    knownGaps: unique([...(existing.knownGaps || []), ...(extracted.knownGaps || [])].map(normalizeKnownGapField)),
    fieldClarifications,
    pendingFieldClarification,
    recentlyAnsweredFields: mergeRecentlyAnsweredFields(existing.recentlyAnsweredFields, extracted),
    activeQuestion: cleanText(existing.activeQuestion),
    activeQuestionId: cleanText(existing.activeQuestionId),
    activeQuestionField: normalizeKnownGapField(existing.activeQuestionField || ''),
    questionMetadata: Array.isArray(existing.questionMetadata) ? existing.questionMetadata.slice(0, 8) : [],
    currentEventType: cleanText(existing.currentEventType),
    askedQuestions: unique([...(existing.askedQuestions || []), ...(existing.questions || [])]),
    conversationHistory: Array.isArray(existing.conversationHistory) ? existing.conversationHistory.slice(-16) : [],
    lastCouncilRun: existing.lastCouncilRun || null,
    caseVersion: Number(existing.caseVersion || 0) || 0,
    councilStatus: cleanText(existing.councilStatus),
    councilStaleReason: cleanText(existing.councilStaleReason),
    rerunRecommended: Boolean(existing.rerunRecommended),
    caseAmendments: Array.isArray(existing.caseAmendments) ? existing.caseAmendments.slice(-24) : [],
    materialChanges: Array.isArray(existing.materialChanges) ? existing.materialChanges.slice(-24) : [],
    pendingCaseUpdateClarification: existing.pendingCaseUpdateClarification || null
  };
}

function missingFields(draft = {}) {
  const missing = [];
  if (!cleanText(draft.brief)) missing.push('case_brief');
  if (!cleanText(draft.businessUnit)) missing.push('business_owner');
  if (!cleanText(draft.geography)) missing.push('geography');
  if (requiresAiUsageScopeValidation(draft)) missing.push('ai_usage_scope');
  if (requiresExportOriginValidation(draft)) missing.push('export_origin_jurisdiction');
  if (requiresExportEndUseValidation(draft)) missing.push('export_end_use');
  if (requiresSanctionsScreeningValidation(draft)) missing.push('sanctions_screening');
  if (requiresRemoteSupportControlsValidation(draft)) missing.push('remote_support_controls');
  if (!hasSubmittedEvidence(draft)) missing.push('evidence');
  if (
    draft.riskSignals?.includes('export control')
    && !draft.evidenceSignals?.some((signal) => ['export classification', 'end-use certificate', 'import permit'].includes(signal))
  ) {
    missing.push('export_control_evidence');
  }
  return missing;
}

function runReadinessForDraft(draft = {}, missing = []) {
  const executionBlockers = missing.filter((field) => [
    'case_brief',
    'business_owner',
    'geography',
    'evidence',
    'ai_usage_scope',
    'export_origin_jurisdiction',
    'export_end_use',
    'sanctions_screening',
    'remote_support_controls'
  ].includes(field));
  const advisoryGaps = missing.filter((field) => !executionBlockers.includes(field));
  const contextItems = [
    cleanText(draft.brief),
    cleanText(draft.businessUnit),
    cleanText(draft.geography),
    ...(draft.integrations || []),
    ...(draft.evidenceSignals || []),
    ...(draft.riskSignals || [])
  ].filter(Boolean);
  const rawScore = Math.round(
    (cleanText(draft.brief).length > 32 ? 22 : 0)
    + (cleanText(draft.businessUnit) ? 18 : 0)
    + (cleanText(draft.geography) ? 16 : 0)
    + (draft.aiUsageScope && Object.keys(draft.aiUsageScope).length ? 8 : 0)
    + Math.min(16, (draft.riskSignals?.length || 0) * 4)
    + Math.min(12, (draft.integrations?.length || 0) * 4)
    + Math.min(24, ((draft.evidenceSignals?.length || 0) + (draft.documents?.length || 0)) * 4)
    + Math.min(12, Number(draft.indexedEvidence?.chunkCount || 0) ? 10 : 0)
  );
  const score = Math.min(executionBlockers.length ? 92 : 100, rawScore);
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
    exportOriginJurisdiction: draft.exportOriginJurisdiction || '',
    exportEndUse: draft.exportEndUse || '',
    aiUsageScope: draft.aiUsageScope || null,
    dataCategories: draft.dataCategories || [],
    integrations: draft.integrations || [],
    documents: draft.documents || [],
    retrievalContext: draft.retrievalContext || null,
    knownGaps: draft.knownGaps || [],
    sanctionsSensitiveGeographies: draft.sanctionsSensitiveGeographies || []
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
  inferDocumentTypesFromText,
  extractCaseFields,
  activeQuestionFieldForDraft,
  fieldFromQuestion,
  fieldFromQuestionId,
  hasDocumentReviewSource,
  hasSubmittedEvidence,
  inferRequestProfileFromText,
  inferWorkflowTypeFromText,
  isClauseReviewCase,
  isDocumentReviewCase,
  isPayrollOutsourcingCase,
  isUnknownOrPending,
  isRecentlyAnsweredField,
  mergeDraft,
  mergeRecentlyAnsweredFields,
  missingFields,
  normalizeKnownGapField,
  normalizeRecentlyAnsweredFields,
  normalizeQuestion,
  questionMetadataForQuestion,
  requiresAiUsageScopeValidation,
  requestProfileForDraft,
  reviewTargetWithArticle,
  runReadinessForDraft,
  validateActiveQuestionAnswer,
  workflowStepsForType,
  unique,
  casePayloadFromDraft
};
