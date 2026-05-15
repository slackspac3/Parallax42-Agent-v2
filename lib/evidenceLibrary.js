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
    /\bno personal data\b/i,
    /\bno pii\b/i,
    /\bwithout personal data\b/i,
    /\bdoes not process personal data\b/i
  ],
  ai_model_governance: [
    /\bnon[- ]ai\b/i,
    /\bno ai\b/i,
    /\bwithout ai\b/i,
    /\bdoes not use ai\b/i
  ],
  business_continuity: [
    /\blow criticality\b/i,
    /\bnot critical\b/i,
    /\bno critical service\b/i
  ]
};

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

function sourceBlob(input = {}) {
  const documents = Array.isArray(input.documents) ? input.documents : [];
  return [
    input.brief,
    input.request,
    input.businessUnit,
    input.geography,
    input.serviceDescription,
    input.supplierName,
    ...(Array.isArray(input.integrations) ? input.integrations : []),
    ...documents.map((item) => typeof item === 'string' ? item : `${item.title || ''} ${item.summary || ''} ${item.text || ''}`)
  ].map(cleanText).filter(Boolean).join(' ').toLowerCase();
}

function isHardwareOnlyAiContext(blob = '') {
  const hardware = /\b(ai accelerator|accelerator cards?|restricted hardware|chip|semiconductor|firmware|gpu|compute cluster)\b/i.test(blob);
  const modelUse = /\b(ai saas|ai service|llm|foundation model|model training|fine[- ]?tuning|automated decision|inference output|machine learning model|customer data|personal data|employee data|training exclusion|service improvement)\b/i.test(blob);
  return hardware && !modelUse;
}

function scoreDomain(domain, blob) {
  if (domain.id === 'ai_model_governance' && isHardwareOnlyAiContext(blob)) {
    return {
      ...domain,
      hits: [],
      score: 0,
      status: 'not_detected'
    };
  }
  const negativePatterns = NEGATIVE_PATTERNS_BY_DOMAIN[domain.id] || [];
  if (negativePatterns.some((pattern) => pattern.test(blob))) {
    return {
      ...domain,
      hits: [],
      score: 0,
      status: 'not_detected'
    };
  }
  const hits = domain.triggers.filter((trigger) => triggerMatches(blob, trigger));
  const score = Math.min(1, hits.length / Math.max(2, Math.ceil(domain.triggers.length / 3)));
  const applicable = hits.length >= 2 || (hits.length === 1 && SINGLE_HIT_APPLIES.has(domain.id));
  return {
    ...domain,
    hits,
    score: Number(score.toFixed(2)),
    status: applicable ? 'applicable' : hits.length === 1 ? 'needs_confirmation' : 'not_detected'
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
  const blob = sourceBlob(input);
  const results = DOMAIN_LIBRARY
    .map((domain) => scoreDomain(domain, blob))
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
    evidenceIds: domain.evidenceIds
  }));
}

module.exports = {
  DOMAIN_LIBRARY,
  getDomainLibrary,
  retrieveEvidence,
  sourceBlob
};
