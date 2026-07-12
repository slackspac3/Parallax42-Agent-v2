'use strict';

const DOMAIN_LIBRARY = [
  {
    id: 'third_party_compliance',
    label: 'Third-Party Compliance',
    triggers: ['supplier', 'vendor', 'third party', 'outsourcer', 'procurement', 'contract', 'sow', 'msa'],
    obligations: [
      'Confirm ownership, scope, and service criticality before approval.',
      'Require evidence of baseline control posture and contractual control commitments.',
      'Track unresolved findings as open risks with owner, due date, and closure evidence.'
    ],
    controls: ['supplier due diligence', 'contract clause review', 'risk acceptance workflow'],
    evidenceIds: ['p42:vendor-risk-sop', 'p42:approval-matrix', 'p42:contract-clause-pack']
  },
  {
    id: 'privacy_data_governance',
    label: 'Privacy And Data Governance',
    triggers: ['personal data', 'pii', 'dpa', 'retention', 'subprocessor', 'transfer', 'data residency', 'privacy'],
    obligations: [
      'Validate lawful data-processing basis, retention commitments, and deletion assistance.',
      'Confirm subprocessors, hosting region, and cross-border transfer mechanism.',
      'Escalate to privacy/legal review when personal data or uncertain transfer paths are present.'
    ],
    controls: ['signed dpa', 'subprocessor register', 'retention and deletion evidence'],
    evidenceIds: ['p42:dpa-review-checklist', 'p42:model-training-data-use-policy']
  },
  {
    id: 'ai_model_governance',
    label: 'AI And Model Governance',
    triggers: ['ai', 'model', 'llm', 'machine learning', 'training', 'inference', 'automated decision'],
    obligations: [
      'Determine whether customer data is used for training, fine-tuning, or service improvement.',
      'Require model-use limitations, human oversight, and explainability controls for AI services.',
      'Run Responsible AI checks before production reliance.'
    ],
    controls: ['model-training exclusion', 'human oversight', 'rai assessment'],
    evidenceIds: ['p42:ai-supplier-review-playbook', 'p42:responsible-ai-control-pack']
  },
  {
    id: 'business_continuity',
    label: 'Business Continuity',
    triggers: ['critical', 'continuity', 'bcp', 'dr', 'outage', 'availability', 'exit', 'recovery'],
    obligations: [
      'Confirm recovery objectives, continuity evidence, and exit support for critical services.',
      'Treat missing continuity evidence as a blocking gap for operationally critical suppliers.',
      'Require remediation milestones before unconditional approval.'
    ],
    controls: ['business continuity plan', 'disaster recovery evidence', 'exit assistance'],
    evidenceIds: ['p42:continuity-exit-requirements']
  },
  {
    id: 'financial_project_compliance',
    label: 'Finance And Project Compliance',
    triggers: ['finance', 'payment', 'invoice', 'budget', 'project', 'capital', 'procure to pay'],
    obligations: [
      'Check approval authority, payment-control exposure, and project-governance accountability.',
      'Separate commercial approval from compliance readiness.',
      'Escalate material exceptions to the accountable finance or project governance owner.'
    ],
    controls: ['approval authority check', 'payment control review', 'project exception register'],
    evidenceIds: ['p42:finance-project-control-baseline']
  },
  {
    id: 'licensing_microsoft_governance',
    label: 'Licensing And Microsoft Governance',
    triggers: ['microsoft', 'license', 'licensing', 'tenant', 'office 365', 'azure', 'power platform', 'dynamics'],
    obligations: [
      'Validate licensing terms, tenant access, data residency, and administrative ownership.',
      'Confirm that automation and analytics use complies with platform licensing limits.',
      'Route tenant-wide privilege or integration risks to technical review.'
    ],
    controls: ['license entitlement review', 'tenant access review', 'admin privilege review'],
    evidenceIds: ['p42:microsoft-governance-baseline']
  },
  {
    id: 'esg_hse_bcm',
    label: 'ESG, HSE And BCM',
    triggers: ['esg', 'hse', 'health and safety', 'environment', 'human rights', 'bcm', 'sustainability'],
    obligations: [
      'Identify ESG, health and safety, and business continuity obligations in the operating context.',
      'Require evidence proportionate to location, workforce, and critical-service exposure.',
      'Escalate severe or unverifiable claims to domain owners.'
    ],
    controls: ['hse evidence', 'esg attestation', 'business continuity mapping'],
    evidenceIds: ['p42:esg-hse-bcm-baseline']
  },
  {
    id: 'physical_security_international_growth',
    label: 'Physical Security And International Growth',
    triggers: ['physical security', 'site security', 'facility', 'market entry', 'international growth', 'new country', 'new market'],
    obligations: [
      'Assess jurisdiction, site-security, and market-entry compliance constraints.',
      'Check sanctions, licensing, local regulatory, and operational-security dependencies.',
      'Escalate high-risk geographies for specialist review.'
    ],
    controls: ['jurisdiction screening', 'site security review', 'market-entry compliance check'],
    evidenceIds: ['p42:international-growth-control-pack']
  },
  {
    id: 'technical_risk',
    label: 'Technical Risk',
    triggers: ['api', 'integration', 'security', 'access', 'encryption', 'logging', 'soc 2', 'iso', 'vulnerability'],
    obligations: [
      'Review identity, access, encryption, logging, vulnerability, and integration control evidence.',
      'Require technical assurance artifacts before connecting material systems.',
      'Capture residual technical risk and required compensating controls.'
    ],
    controls: ['security assurance review', 'identity and access controls', 'integration risk assessment'],
    evidenceIds: ['p42:technical-risk-control-pack', 'p42:soc2-iso-evidence-map']
  },
  {
    id: 'regulatory_reporting',
    label: 'Regulatory Compliance',
    triggers: ['regulatory', 'ccp', 'iccp', 'compliance', 'license', 'audit', 'policy', 'obligation'],
    obligations: [
      'Map the request to applicable regulatory obligations and internal policies.',
      'Require evidence for any claim used to support approval.',
      'Create exception records where obligations are unknown, disputed, or unmet.'
    ],
    controls: ['obligation mapping', 'policy exception workflow', 'audit-ready decision record'],
    evidenceIds: ['p42:regulatory-obligation-register', 'p42:audit-ready-decision-schema']
  }
];

const NEGATIVE_PATTERNS_BY_DOMAIN = {
  privacy_data_governance: [
    /\b(?:service|system|supplier|vendor|application|solution|platform|product|workflow|we|it)\s+(?:does|do|will|would)\s+not\s+(?:process|collect|store|access|share|transfer|use|handle)\s+(?:any\s+)?(?:personal data|pii)(?:\s+(?:in|within|for)\s+(?:this|the|our|its)\s+(?:service|system|workflow|product|solution|platform|engagement))?[\s,.:;!?]*$/i,
    /\b(?:no|zero)\s+(?:personal data|pii)\s+(?:is|are|will be|would be)\s+(?:processed|collected|stored|accessed|shared|transferred|used|handled)[\s,.:;!?]*$/i,
    /\b(?:processes?|collects?|stores?|accesses|shares?|transfers?|uses?|handles?)\s+no\s+(?:personal data|pii)[\s,.:;!?]*$/i,
    /\bno\s+(?:personal data|pii)\s+(?:processing|collection|storage|access|sharing|transfer|use|handling)[\s,.:;!?]*$/i,
    /\bwithout\s+(?:processing|collecting|storing|accessing|sharing|transferring|using|handling)\s+(?:any\s+)?(?:personal data|pii)[\s,.:;!?]*$/i
  ],
  ai_model_governance: [
    /\bnon[- ]ai\s+(?:service|system|supplier|vendor|application|solution|platform|product|workflow)[\s,.:;!?]*$/i,
    /\b(?:service|system|supplier|vendor|application|solution|platform|product|workflow|we|it)\s+(?:does|do|will|would)\s+not\s+(?:use|include|deploy|invoke|contain|provide)\s+(?:any\s+)?(?:ai|artificial intelligence|machine learning|models?)(?:\s+(?:in|within|for)\s+(?:this|the|our|its)\s+(?:service|system|workflow|product|solution|platform|engagement))?[\s,.:;!?]*$/i,
    /\bno\s+(?:ai|artificial intelligence|machine learning)\s+(?:is|will be|would be)\s+(?:used|deployed|invoked|included)[\s,.:;!?]*$/i,
    /\bno\s+ai\s+(?:functionality|features?|models?|inference|decisioning|use|processing)[\s,.:;!?]*$/i,
    /\bwithout\s+ai\s+(?:functionality|features?|models?|inference|decisioning|use|processing)[\s,.:;!?]*$/i
  ],
  business_continuity: [
    /\blow criticality(?:\s+(?:service|system|supplier|workflow|workload))?[\s,.:;!?]*$/i,
    /\b(?:service|system|supplier|vendor|application|solution|platform|product|workflow|workload)\s+(?:is|was|will be|would be)\s+not\s+(?:business[- ]?)?critical[\s,.:;!?]*$/i,
    /\bno critical (?:service|system|workflow|workload)[\s,.:;!?]*$/i
  ]
};

// Applicability negation must describe the service boundary, not the absence of
// a required control or artifact. For example, "no personal data is processed"
// may be a non-applicability assertion, while "no personal data inventory or
// DPA is available" is a blocking evidence gap.
const MISSING_CONTROL_OR_EVIDENCE_PATTERNS = [
  /\b(?:no|without|missing|lacks?|lacking)\s+(?:[a-z][a-z0-9-]*\s+){0,4}(?:controls?|framework|safeguards?|testing|evidence|documentation|policy|procedure|plan|inventory|register|assessment|dpa|agreement|clause|schedule|certificate|report|attestation|assurance|approval|permit|licen[cs]e|screening|classification|runbook|soc\s*2|iso\s*27001|bcp)\b/i,
  /\b(?:controls?|evidence|documentation|policy|procedure|plan|inventory|register|assessment|dpa|agreement|clause|schedule|certificate|report|attestation|assurance|approval|permit|licen[cs]e|screening|classification|runbook|soc\s*2|iso\s*27001|bcp|framework|safeguards?|testing)\s+(?:is|are|was|were|has|have)\s+(?:never\s+|not\s+)(?:available|provided|documented|implemented|attached|completed|approved|performed|occurred|established|in place)\b/i,
  /\b(?:never|not)\s+(?:documented|implemented|provided|performed|tested|validated|completed|approved|established)\b/i,
  /\b(?:does not|do not|did not)\s+(?:exist|have|include|provide|document|implement|test|validate)\b/i
];

const SINGLE_HIT_APPLIES = new Set([
  'privacy_data_governance',
  'ai_model_governance',
  'third_party_compliance',
  'technical_risk',
  'licensing_microsoft_governance'
]);

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitStatements(value = '') {
  return cleanText(value)
    .split(/(?:[.!?;]+\s+|\s+(?:but|however|although|yet|whereas)\s+)/i)
    .map(cleanText)
    .filter(Boolean);
}

function sourceStatements(input = {}) {
  const sources = [];
  const add = (sourceId, value, provenance = 'case_context', assertionState = '') => {
    splitStatements(value).slice(0, 40).forEach((text, index) => sources.push({
      sourceId: `${sourceId}:${index + 1}`,
      provenance,
      assertionState: cleanText(assertionState).toLowerCase(),
      text: text.toLowerCase().slice(0, 4000)
    }));
  };
  [
    ['brief', input.brief || input.request],
    ['business_unit', input.businessUnit],
    ['geography', input.geography],
    ['export_origin', input.exportOriginJurisdiction],
    ['export_end_use', input.exportEndUse],
    ['service', input.serviceDescription],
    ['supplier', input.supplierName],
    ['review_focus', input.reviewFocus],
    ['ai_scope', JSON.stringify(input.aiUsageScope || {})]
  ].forEach(([id, value]) => add(id, value));
  for (const [field, values] of [
    ['data_category', input.dataCategories],
    ['risk_signal', input.riskSignals],
    ['evidence_signal', input.evidenceSignals],
    ['known_gap', input.knownGaps],
    ['sanctions_geography', input.sanctionsSensitiveGeographies],
    ['integration', input.integrations]
  ]) {
    (Array.isArray(values) ? values : []).forEach((value, index) => add(`${field}_${index + 1}`, value));
  }
  (Array.isArray(input.documents) ? input.documents : []).forEach((item, index) => {
    const document = typeof item === 'string' ? { text: item } : item || {};
    const id = cleanText(document.sourceEvidenceId || document.evidenceId || document.title || `document_${index + 1}`);
    add(
      id,
      [document.summary, document.text, document.excerpt, ...(Array.isArray(document.signals) ? document.signals : [])].filter(Boolean).join('. '),
      document.provenance || document.sourceType || 'submitted_document',
      document.assertionState
    );
  });
  (Array.isArray(input.retrievalContext?.matches) ? input.retrievalContext.matches : []).forEach((match, index) => {
    add(
      cleanText(match.evidenceId || match.chunkId || `retrieval_${index + 1}`),
      match.text || match.snippet,
      'semantic_retrieval',
      match.assertionState
    );
  });
  return sources;
}

function sourceBlob(input = {}) {
  return sourceStatements(input).map((statement) => statement.text).join(' ');
}

function isHardwareOnlyAiContext(blob = '') {
  const hardware = /\b(ai accelerator|accelerator cards?|restricted hardware|chip|semiconductor|firmware|gpu|compute cluster)\b/i.test(blob);
  const modelUse = /\b(ai saas|ai service|llm|foundation model|model training|fine[- ]?tuning|automated decision|inference output|machine learning model|customer data|personal data|employee data|training exclusion|service improvement)\b/i.test(blob);
  return hardware && !modelUse;
}

function isNegativeApplicabilityAssertion(text = '', negativePatterns = [], assertionState = '') {
  if (['requested', 'mentioned'].includes(cleanText(assertionState).toLowerCase())) return false;
  if (MISSING_CONTROL_OR_EVIDENCE_PATTERNS.some((pattern) => pattern.test(text))) return false;
  return negativePatterns.some((pattern) => pattern.test(text));
}

function scoreDomain(domain, statements) {
  const negativePatterns = NEGATIVE_PATTERNS_BY_DOMAIN[domain.id] || [];
  const negativeAssertions = statements.filter((statement) => isNegativeApplicabilityAssertion(statement.text, negativePatterns, statement.assertionState));
  const positiveAssertions = statements
    .map((statement) => ({
      ...statement,
      hits: domain.triggers.filter((trigger) => triggerMatches(statement.text, trigger))
    }))
    .filter((statement) => statement.hits.length && !isNegativeApplicabilityAssertion(statement.text, negativePatterns, statement.assertionState));
  const positiveBlob = positiveAssertions.map((statement) => statement.text).join(' ');
  if (domain.id === 'ai_model_governance' && isHardwareOnlyAiContext(positiveBlob)) {
    return {
      ...domain,
      hits: [],
      score: 0,
      status: 'not_detected',
      contradiction: false,
      applicabilityAssertions: { positive: [], negative: [] }
    };
  }
  if (negativeAssertions.length && !positiveAssertions.length) {
    return {
      ...domain,
      hits: [],
      score: 0,
      status: 'not_detected',
      contradiction: false,
      applicabilityAssertions: {
        positive: [],
        negative: negativeAssertions.slice(0, 6).map(({ sourceId, provenance, text }) => ({ sourceId, provenance, text: text.slice(0, 320) }))
      }
    };
  }
  const hits = Array.from(new Set(positiveAssertions.flatMap((statement) => statement.hits)));
  const score = Math.min(1, hits.length / Math.max(2, Math.ceil(domain.triggers.length / 3)));
  const applicable = hits.length >= 2 || (hits.length === 1 && SINGLE_HIT_APPLIES.has(domain.id));
  return {
    ...domain,
    hits,
    score: Number(score.toFixed(2)),
    status: applicable ? 'applicable' : hits.length === 1 ? 'needs_confirmation' : 'not_detected',
    contradiction: Boolean(positiveAssertions.length && negativeAssertions.length),
    applicabilityAssertions: {
      positive: positiveAssertions.slice(0, 6).map(({ sourceId, provenance, text }) => ({ sourceId, provenance, text: text.slice(0, 320) })),
      negative: negativeAssertions.slice(0, 6).map(({ sourceId, provenance, text }) => ({ sourceId, provenance, text: text.slice(0, 320) }))
    }
  };
}

function triggerMatches(blob, trigger) {
  const safeTrigger = String(trigger || '').toLowerCase().trim();
  if (!safeTrigger) return false;
  if (/^[a-z0-9]{1,3}$/.test(safeTrigger)) {
    return new RegExp(`\\b${safeTrigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(blob);
  }
  return blob.includes(safeTrigger);
}

function retrieveEvidence(input = {}) {
  const statements = sourceStatements(input);
  const results = DOMAIN_LIBRARY
    .map((domain) => scoreDomain(domain, statements))
    .filter((domain) => domain.status !== 'not_detected')
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));

  if (!results.length && cleanText(input.brief)) {
    const regulatory = DOMAIN_LIBRARY.find((domain) => domain.id === 'regulatory_reporting');
    return [{
      ...regulatory,
      hits: [],
      score: 0.35,
      status: 'needs_confirmation'
    }];
  }

  return results;
}

function getDomainLibrary() {
  return DOMAIN_LIBRARY.map((domain) => ({
    id: domain.id,
    label: domain.label,
    controls: domain.controls,
    policyReferenceIds: domain.evidenceIds
  }));
}

module.exports = {
  DOMAIN_LIBRARY,
  getDomainLibrary,
  retrieveEvidence,
  sourceBlob
};
