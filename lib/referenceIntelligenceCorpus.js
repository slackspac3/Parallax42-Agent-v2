'use strict';

const REFERENCE_LANES = {
  legal: {
    corpusTypes: ['case_law', 'contract_clause'],
    defaultDirectory: 'legal',
    caveat: 'Legal and contract references are advisory issue-spotting context only. They are not legal advice and do not approve, reject, or modify any contract.'
  },
  compliance: {
    corpusTypes: ['privacy_guidance', 'regulatory_guidance'],
    defaultDirectory: 'compliance',
    caveat: 'Compliance references are public guidance context only. Applicability must be confirmed by accountable legal, privacy, and compliance owners.'
  },
  procurement: {
    corpusTypes: ['procurement_risk', 'supplier_risk'],
    defaultDirectory: 'procurement',
    caveat: 'Procurement references support supplier-risk questions and do not replace sourcing, sanctions, finance, legal, or risk approvals.'
  },
  security: {
    corpusTypes: ['security_control', 'technical_risk'],
    defaultDirectory: 'security',
    caveat: 'Security references support control mapping and evidence requests. They are not a certification decision.'
  },
  ai_governance: {
    corpusTypes: ['ai_governance', 'responsible_ai'],
    defaultDirectory: 'ai_governance',
    caveat: 'AI governance references support model-risk and Responsible AI review. They do not grant production authorization.'
  },
  sanctions_export: {
    corpusTypes: ['sanctions_export', 'trade_compliance'],
    defaultDirectory: 'sanctions_export',
    caveat: 'Sanctions and export-control references support screening and escalation. They are not a license determination.'
  },
  hse_esg: {
    corpusTypes: ['hse_esg', 'operational_compliance'],
    defaultDirectory: 'hse_esg',
    caveat: 'HSE and ESG references support obligation discovery and evidence requests. They do not replace accountable function review.'
  }
};

const DEFAULT_REFERENCE_QUERIES = [
  'limitation of liability contract',
  'indemnification agreement',
  'data processing agreement subprocessor retention',
  'service agreement breach outsourcing',
  'confidentiality agreement trade secrets',
  'software license audit rights',
  'cloud services data breach contract',
  'forum selection clause',
  'choice of law clause',
  'arbitration agreement'
];

const COURTLISTENER_CAVEAT = [
  'CourtListener and Free Law Project references are advisory legal-reference context only.',
  'They are primarily U.S. legal materials unless the imported record states otherwise.',
  'Use them for issue spotting, citation verification, and reviewer questions; do not treat them as jurisdiction-specific advice.',
  'The deterministic council remains the decision owner and accountable human reviewers must approve final use.'
].join(' ');

function cleanText(value = '') {
  return String(value || '')
    .replace(/<mark>/gi, '')
    .replace(/<\/mark>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function safeArray(value = [], limit = 20) {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => typeof item === 'string' ? item : String(item || ''))).slice(0, limit);
}

function pickSourceUrl(record = {}, baseUrl = 'https://www.courtlistener.com') {
  const url = record.sourceUrl || record.absolute_url || record.url || record.resource_uri || record.api_url || '';
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl.replace(/\/$/, '')}/${String(url).replace(/^\//, '')}`;
}

function inferCorpusType(input = {}) {
  const haystack = `${input.corpusType || ''} ${input.source || ''} ${input.documentType || ''} ${input.title || ''} ${(input.tags || []).join(' ')} ${input.text || ''}`.toLowerCase();
  if (/courtlistener|case law|opinion|citation|precedent|court/.test(haystack)) return 'case_law';
  if (/cuad|clause|indemnif|liability|termination|agreement|contract|msa|dpa|sow/.test(haystack)) return 'contract_clause';
  if (/privacy|gdpr|dpa|data protection|subprocessor|retention|transfer/.test(haystack)) return 'privacy_guidance';
  if (/ai governance|responsible ai|model risk|eu ai act|algorithm|human oversight|bias|automated decision/.test(haystack)) return 'ai_governance';
  if (/nist|security|cyber|soc|iso|control|incident|vulnerability/.test(haystack)) return 'security_control';
  if (/procurement|supplier|vendor|debar|tender|contracting/.test(haystack)) return 'procurement_risk';
  if (/sanction|export|ofac|end-use|restricted party|trade/.test(haystack)) return 'sanctions_export';
  if (/hse|esg|sustainability|environment|safety/.test(haystack)) return 'hse_esg';
  return 'regulatory_guidance';
}

function inferLane(input = {}) {
  const type = inferCorpusType(input);
  const lane = Object.entries(REFERENCE_LANES).find(([, config]) => config.corpusTypes.includes(type));
  return lane ? lane[0] : 'compliance';
}

function inferTags(input = {}) {
  const haystack = `${input.title || ''} ${input.text || ''} ${(input.tags || []).join(' ')}`.toLowerCase();
  const tags = [];
  if (/liability|damages|warranty/.test(haystack)) tags.push('liability');
  if (/indemnif|hold harmless/.test(haystack)) tags.push('indemnification');
  if (/termination|exit|transition/.test(haystack)) tags.push('termination');
  if (/privacy|personal data|dpa|subprocessor|retention|deletion|transfer/.test(haystack)) tags.push('privacy');
  if (/security|soc|iso|incident|vulnerability|access|encryption/.test(haystack)) tags.push('security');
  if (/\bai\b|artificial intelligence|model risk|model training|automated decision|human oversight/.test(haystack)) tags.push('ai governance');
  if (/export|sanction|end-use|restricted party|ofac/.test(haystack)) tags.push('trade compliance');
  if (/supplier|vendor|procurement|outsourcing/.test(haystack)) tags.push('third-party risk');
  if (/business continuity|disaster recovery|bcp|dr plan/.test(haystack)) tags.push('business continuity');
  return unique([...(input.tags || []), ...tags]);
}

function inferDomains(input = {}) {
  const tags = inferTags(input).join(' ').toLowerCase();
  const domains = [];
  if (/privacy|data/.test(tags)) domains.push('privacy_and_data_governance');
  if (/security/.test(tags)) domains.push('technical_risk');
  if (/ai/.test(tags)) domains.push('ai_and_model_governance');
  if (/trade|export|sanction/.test(tags)) domains.push('trade_compliance');
  if (/third-party|supplier|vendor|procurement/.test(tags)) domains.push('third_party_compliance');
  if (/continuity/.test(tags)) domains.push('business_continuity');
  if (/liability|indemnification|termination|contract/.test(tags)) domains.push('contract_risk');
  return unique([...(input.domains || []), ...domains]);
}

function normalizeReferenceRecord(record = {}, defaults = {}) {
  const title = cleanText(record.title || record.caseNameFull || record.caseName || record.name || defaults.title || 'Reference record');
  const text = cleanText(record.text || record.excerpt || record.snippet || record.summary || record.syllabus || '');
  const corpusType = cleanText(record.corpusType || defaults.corpusType || inferCorpusType({ ...defaults, ...record, title, text }));
  const lane = cleanText(record.lane || defaults.lane || inferLane({ ...defaults, ...record, corpusType, title, text }));
  const advisoryOnly = record.advisoryOnly !== false && defaults.advisoryOnly !== false;
  return {
    id: cleanText(record.id || record.referenceId || record.cluster_id || record.clusterId || record.opinionId || ''),
    title,
    corpusType,
    lane,
    source: cleanText(record.source || defaults.source || 'reference_intelligence'),
    sourceUrl: pickSourceUrl(record, defaults.baseUrl),
    jurisdiction: cleanText(record.jurisdiction || defaults.jurisdiction || ''),
    documentType: cleanText(record.documentType || defaults.documentType || ''),
    authority: cleanText(record.authority || defaults.authority || 'public_reference_not_policy'),
    classification: cleanText(record.classification || defaults.classification || 'public_reference'),
    advisoryOnly,
    requiresHumanReview: record.requiresHumanReview !== false && defaults.requiresHumanReview !== false,
    legalCaveat: cleanText(record.legalCaveat || defaults.legalCaveat || REFERENCE_LANES[lane]?.caveat || 'Reference context is advisory only.'),
    citations: safeArray(record.citations || record.citation || record.normalized_citations || []),
    court: cleanText(record.court || record.courtName || record.court_id || ''),
    decisionDate: cleanText(record.decisionDate || record.dateFiled || record.date_filed || record.decision_date || ''),
    query: cleanText(record.query || defaults.query || ''),
    tags: inferTags({ ...defaults, ...record, title, text }),
    domains: inferDomains({ ...defaults, ...record, title, text }),
    frameworks: safeArray(record.frameworks || defaults.frameworks || []),
    summary: cleanText(record.summary || defaults.summary || `Reference normalized for ${lane} advisory review.`),
    excerpt: text.slice(0, Number(defaults.maxExcerptChars || 3500)),
    importedAt: cleanText(record.importedAt || defaults.importedAt || new Date().toISOString())
  };
}

function normalizeCourtListenerSearchResult(record = {}, context = {}) {
  const opinions = Array.isArray(record.opinions) ? record.opinions : [];
  const opinionText = cleanText(opinions.map((opinion) => opinion.snippet || opinion.text || '').join('\n\n'));
  return normalizeReferenceRecord({
    ...record,
    id: record.cluster_id || record.id,
    title: record.caseNameFull || record.caseName || record.name,
    source: 'courtlistener',
    corpusType: 'case_law',
    lane: 'legal',
    jurisdiction: record.court_citation_string || record.court_id || 'US',
    documentType: 'court_opinion',
    sourceUrl: pickSourceUrl(record),
    citations: record.citation || [],
    decisionDate: record.dateFiled || record.date_filed,
    excerpt: opinionText || record.snippet || record.syllabus || '',
    text: opinionText || record.snippet || record.syllabus || '',
    summary: `CourtListener case-law search result for "${context.query || record.query || 'legal reference'}".`,
    legalCaveat: COURTLISTENER_CAVEAT,
    query: context.query || record.query || ''
  }, {
    source: 'courtlistener',
    corpusType: 'case_law',
    lane: 'legal',
    jurisdiction: 'US',
    documentType: 'court_opinion',
    legalCaveat: COURTLISTENER_CAVEAT
  });
}

function normalizeCourtListenerCitationResult(record = {}, context = {}) {
  const clusters = Array.isArray(record.clusters) ? record.clusters : [];
  const clusterNames = clusters.map((cluster) => cluster.case_name || cluster.caseName || cluster.name).filter(Boolean);
  const normalizedCitations = safeArray(record.normalized_citations || []);
  const citation = cleanText(record.citation || context.citation || '');
  return normalizeReferenceRecord({
    id: citation,
    title: `Citation lookup: ${citation || 'unknown citation'}`,
    source: 'courtlistener_citation_lookup',
    corpusType: 'case_law',
    lane: 'legal',
    jurisdiction: 'US',
    documentType: 'citation_verification',
    citations: citation ? [citation].concat(normalizedCitations) : normalizedCitations,
    tags: ['citation verification', record.status === 200 ? 'valid citation' : 'citation issue'],
    summary: record.status === 200
      ? `CourtListener verified citation ${citation}.`
      : `CourtListener citation lookup returned status ${record.status || 'unknown'} for ${citation || 'citation'}.`,
    text: [
      `Citation: ${citation}`,
      `Status: ${record.status || ''}`,
      record.error_message ? `Error: ${record.error_message}` : '',
      clusterNames.length ? `Matched clusters: ${clusterNames.join('; ')}` : ''
    ].filter(Boolean).join('\n'),
    legalCaveat: COURTLISTENER_CAVEAT,
    query: context.query || context.citation || ''
  }, {
    source: 'courtlistener_citation_lookup',
    corpusType: 'case_law',
    lane: 'legal',
    jurisdiction: 'US',
    documentType: 'citation_verification',
    legalCaveat: COURTLISTENER_CAVEAT
  });
}

function normalizeCuadClause(record = {}, context = {}) {
  const clauseType = cleanText(record.clause_type || record.clauseType || record.label || record.category || 'contract clause');
  const clauseText = cleanText(record.text || record.clause || record.answer || record.context || '');
  return normalizeReferenceRecord({
    id: record.id || `${record.document_name || record.documentName || 'cuad'}:${clauseType}`,
    title: cleanText(record.title || `${clauseType} clause pattern`),
    source: context.source || 'cuad_compatible_clause_import',
    corpusType: 'contract_clause',
    lane: 'legal',
    documentType: cleanText(record.documentType || record.document_type || 'contract_clause'),
    tags: [clauseType, ...(record.tags || [])],
    summary: `Contract clause pattern normalized for ${clauseType} issue spotting.`,
    text: clauseText || cleanText(record.summary || ''),
    excerpt: clauseText || cleanText(record.summary || '')
  }, {
    source: context.source || 'cuad_compatible_clause_import',
    corpusType: 'contract_clause',
    lane: 'legal',
    jurisdiction: context.jurisdiction || 'global',
    documentType: 'contract_clause'
  });
}

function recordToMarkdown(record = {}) {
  const normalized = normalizeReferenceRecord(record);
  const lines = [
    `## ${normalized.title}`,
    '',
    `Corpus type: ${normalized.corpusType}`,
    `Lane: ${normalized.lane}`,
    `Source: ${normalized.source}`,
    normalized.sourceUrl ? `Source URL: ${normalized.sourceUrl}` : '',
    normalized.jurisdiction ? `Jurisdiction: ${normalized.jurisdiction}` : '',
    normalized.documentType ? `Document type: ${normalized.documentType}` : '',
    normalized.court ? `Court: ${normalized.court}` : '',
    normalized.decisionDate ? `Decision date: ${normalized.decisionDate}` : '',
    normalized.citations.length ? `Citations: ${normalized.citations.join('; ')}` : '',
    normalized.tags.length ? `Tags: ${normalized.tags.join(', ')}` : '',
    normalized.domains.length ? `Domains: ${normalized.domains.join(', ')}` : '',
    normalized.frameworks.length ? `Frameworks: ${normalized.frameworks.join(', ')}` : '',
    '',
    '### Advisory Boundary',
    normalized.legalCaveat,
    '',
    '### Summary',
    normalized.summary,
    '',
    '### Reference Excerpt',
    normalized.excerpt || 'No excerpt was available for this reference record.'
  ].filter((line) => line !== '');
  return lines.join('\n');
}

function recordsToMarkdown(records = [], options = {}) {
  const title = cleanText(options.title) || 'Reference Intelligence Corpus';
  const description = cleanText(options.description) || 'Advisory public-reference context for legal, compliance, procurement, security, AI governance, sanctions/export, and HSE/ESG review.';
  return [
    `# ${title}`,
    '',
    description,
    '',
    'This reference intelligence is advisory only. Uploaded evidence, deterministic council logic, and accountable human approval remain separate.',
    '',
    ...records.map(recordToMarkdown)
  ].join('\n');
}

module.exports = {
  COURTLISTENER_CAVEAT,
  DEFAULT_REFERENCE_QUERIES,
  REFERENCE_LANES,
  cleanText,
  normalizeCourtListenerCitationResult,
  normalizeCourtListenerSearchResult,
  normalizeCuadClause,
  normalizeReferenceRecord,
  recordToMarkdown,
  recordsToMarkdown,
  safeArray,
  unique
};
