'use strict';

const { runAgentWithRuntime } = require('./agentRuntime');

const GEOGRAPHY_PATTERNS = [
  ['UAE', /\b(uae|united arab emirates|abu dhabi|dubai)\b/i],
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
  ['Procurement And Third-Party Risk', /\b(procurement|supplier|vendor|third party|contract|sow|msa)\b/i],
  ['Legal And Privacy', /\b(privacy|legal|dpa|data processing|subprocessor|retention)\b/i],
  ['HSE And Business Continuity', /\b(hse|health and safety|continuity|bcp|dr|exit)\b/i],
  ['International Growth', /\b(market entry|international growth|new country|new market|physical security)\b/i]
];

const INTEGRATION_PATTERNS = [
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
  ['personal data', /\b(personal data|pii|employee data|customer data|sensitive data)\b/i],
  ['AI/model use', /\b(ai|llm|model|machine learning|automated decision)\b/i],
  ['critical service', /\b(critical|production|business critical|material service)\b/i],
  ['finance exposure', /\b(payment|finance|ledger|invoice|budget|project)\b/i],
  ['privileged access', /\b(privileged|admin access|tenant access|write access)\b/i],
  ['cross-border transfer', /\b(cross[- ]border|transfer|data residency|hosting region)\b/i],
  ['missing evidence', /\b(no|missing|without|not attached|unavailable)\b/i]
];

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
  const supplierName = inferSupplierName(text);
  const geography = inferFirstByPatterns(text, GEOGRAPHY_PATTERNS);
  const businessUnit = inferFirstByPatterns(text, BUSINESS_UNIT_PATTERNS);
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
    businessUnit,
    geography,
    integrations,
    documents,
    evidenceSignals,
    riskSignals
  };
}

function mergeDraft(existing = {}, extracted = {}) {
  const documents = [
    ...(Array.isArray(existing.documents) ? existing.documents : []),
    ...(Array.isArray(extracted.documents) ? extracted.documents : [])
  ].slice(-8);

  return {
    supplierName: extracted.supplierName || existing.supplierName || 'Conversation-supplied case',
    brief: cleanText([existing.brief, extracted.brief].filter(Boolean).join(' ')).slice(0, 2400),
    businessUnit: extracted.businessUnit || existing.businessUnit || '',
    geography: extracted.geography || existing.geography || '',
    integrations: unique([...(existing.integrations || []), ...(extracted.integrations || [])]).slice(0, 12),
    documents,
    evidenceSignals: unique([...(existing.evidenceSignals || []), ...(extracted.evidenceSignals || [])]),
    riskSignals: unique([...(existing.riskSignals || []), ...(extracted.riskSignals || [])])
  };
}

function missingFields(draft = {}) {
  const missing = [];
  if (!cleanText(draft.brief)) missing.push('case_brief');
  if (!cleanText(draft.businessUnit)) missing.push('business_owner');
  if (!cleanText(draft.geography)) missing.push('geography');
  if (!draft.evidenceSignals?.length && !draft.documents?.some((doc) => doc.signals?.length)) missing.push('evidence');
  if (
    draft.riskSignals?.includes('export control')
    && !draft.evidenceSignals?.some((signal) => ['export classification', 'end-use certificate', 'import permit'].includes(signal))
  ) {
    missing.push('export_control_evidence');
  }
  if (draft.riskSignals?.includes('remote support access') && !draft.evidenceSignals?.includes('firmware access runbook')) {
    missing.push('remote_support_controls');
  }
  return missing;
}

function questionsForDraft(draft = {}, missing = []) {
  const questions = [];
  if (missing.includes('business_owner')) {
    questions.push('Who is the accountable business unit or workflow owner?');
  }
  if (missing.includes('geography')) {
    questions.push('Which geography or regulatory perimeter applies, for example UAE, KSA, Abu Dhabi, or global?');
  }
  if (missing.includes('evidence')) {
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
      questions.push('What evidence is available: contract terms, DPA, SOC 2, ISO 27001, BCP/DR, access approval, or policy mapping?');
    }
  }
  if (missing.includes('export_control_evidence')) {
    questions.push('Which export-control artifacts are final: classification, license analysis, end-use certificate, import permit, denied-party screening, and delivery-site approval?');
  }
  if (missing.includes('remote_support_controls')) {
    questions.push('What remote firmware support controls are approved: named access, MFA, session logging, customer observation, and support-window limits?');
  }
  if (draft.supplierName === 'Conversation-supplied case') {
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

function casePayloadFromDraft(draft = {}) {
  return {
    supplierName: draft.supplierName || 'Conversation-supplied case',
    brief: draft.brief || '',
    businessUnit: draft.businessUnit || '',
    geography: draft.geography || '',
    integrations: draft.integrations || [],
    documents: draft.documents || []
  };
}

function summarizeRun(run) {
  const topGaps = (run.gaps || []).slice(0, 3).map((gap, index) => `${index + 1}. ${gap.gap} ${gap.action}`);
  return [
    `I ran the case through the compliance agents. Decision: ${run.decision.recommendation}.`,
    `Readiness is ${Math.round(run.decision.readinessScore * 100)}% with ${(run.gaps || []).length} blocking gap${(run.gaps || []).length === 1 ? '' : 's'}.`,
    topGaps.length ? `Top gaps:\n${topGaps.join('\n')}` : 'No blocking gaps were detected in the supplied context.',
    'Human approval remains required before operational use.'
  ].join('\n\n');
}

function composeReply({ intent, draft, missing, questions, run }) {
  if (run?.ok) return summarizeRun(run);
  if (intent === 'evidence_question') {
    return `Evidence checklist for this case:\n${evidenceChecklist(draft).map((item) => `- ${item}`).join('\n')}\n\nSend what you have, and I will update the case draft and run the agent when it is assessable.`;
  }
  if (missing.length) {
    return `I started the compliance case draft and extracted ${draft.riskSignals?.length || 0} risk signal${draft.riskSignals?.length === 1 ? '' : 's'}: ${(draft.riskSignals || []).join(', ') || 'none yet'}.\n\nNext questions:\n${questions.map((question) => `- ${question}`).join('\n')}`;
  }
  return 'I have enough context to assess this case. Say "run it" or add more evidence, and I will execute the agent workflow.';
}

function processConversation(input = {}, options = {}) {
  const message = cleanText(input.message || input.prompt || '');
  const existingDraft = input.caseDraft && typeof input.caseDraft === 'object' ? input.caseDraft : {};
  const intent = detectIntent(message);
  const extracted = extractCaseFields(message, existingDraft);
  const draft = mergeDraft(existingDraft, extracted);
  const missing = missingFields(draft);
  const questions = questionsForDraft(draft, missing);
  const forceRun = Boolean(input.forceRun || /\b(run it|execute|submit|assess now|start the workflow)\b/i.test(message));
  const shouldRun = missing.length === 0 && (forceRun || intent === 'run_or_assess');
  const actions = [
    { id: 'nlp_extract', status: 'complete', detail: 'Extracted case fields, risk signals, evidence signals, and integrations from natural language.' },
    { id: 'case_draft_update', status: 'complete', detail: 'Merged message context into the working compliance case draft.' },
    { id: 'follow_up_planning', status: questions.length ? 'complete' : 'not_required', detail: questions.length ? 'Generated contextual clarification questions.' : 'No clarification required before agent execution.' }
  ];

  let run = null;
  if (shouldRun) {
    run = runAgentWithRuntime(casePayloadFromDraft(draft), { runtime: options.runtime || input.runtime });
    actions.push({ id: 'agent_workflow', status: run.ok ? 'complete' : 'blocked', detail: 'Executed the CrewAI-routed compliance agent workflow.' });
  } else {
    actions.push({ id: 'agent_workflow', status: 'waiting', detail: 'Waiting for required context before execution.' });
  }

  return {
    ok: true,
    mode: 'conversation_nlp',
    reply: composeReply({ intent, draft, missing, questions, run }),
    caseDraft: draft,
    missingFields: missing,
    questions,
    readyToRun: missing.length === 0,
    actions,
    run,
    nlp: {
      parser: 'deterministic_compliance_nlp_v1',
      intent,
      extracted: {
        supplierName: extracted.supplierName,
        businessUnit: extracted.businessUnit,
        geography: extracted.geography,
        integrations: extracted.integrations,
        evidenceSignals: extracted.evidenceSignals,
        riskSignals: extracted.riskSignals
      },
      confidence: Number(Math.min(0.95, 0.35 + (draft.riskSignals?.length || 0) * 0.12 + (draft.evidenceSignals?.length || 0) * 0.08).toFixed(2))
    }
  };
}

module.exports = {
  casePayloadFromDraft,
  detectIntent,
  evidenceChecklist,
  extractCaseFields,
  mergeDraft,
  missingFields,
  processConversation,
  questionsForDraft
};
