'use strict';

const DEFAULT_CAP_QUERIES = [
  'limitation of liability contract',
  'indemnification agreement',
  'forum selection clause',
  'choice of law clause',
  'arbitration agreement',
  'confidentiality agreement',
  'trade secrets confidentiality',
  'data breach vendor contract',
  'service agreement breach',
  'employment outsourcing contract'
];

const LEGAL_CAVEAT = [
  'Caselaw Access Project references are advisory legal-intelligence context only.',
  'They are not legal advice and do not determine the outcome of any contract review.',
  'They may be U.S. jurisdiction-specific and must not be treated as UAE, GCC, EU, or other jurisdiction-specific advice.',
  'The deterministic council remains the decision owner and accountable human legal/compliance reviewers must approve final use.'
].join(' ');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function pickUrl(record = {}) {
  return record.frontend_url
    || record.url
    || record.api_url
    || record.resource_uri
    || '';
}

function normalizeCitation(citation = {}) {
  if (typeof citation === 'string') return cleanText(citation);
  return cleanText(citation.cite || citation.normalized_cite || citation.type || '');
}

function extractOpinionText(record = {}, maxChars = 3500) {
  const opinions = record.casebody?.data?.opinions || record.casebody?.opinions || [];
  if (Array.isArray(opinions) && opinions.length) {
    return cleanText(opinions.map((opinion) => opinion.text || opinion.html || '').join('\n\n')).slice(0, maxChars);
  }
  return cleanText(record.preview || record.snippet || record.summary || record.excerpt || '').slice(0, maxChars);
}

function inferTopics(query = '', record = {}) {
  const haystack = `${query} ${record.name || ''} ${record.name_abbreviation || ''} ${extractOpinionText(record, 1000)}`.toLowerCase();
  const topics = [];
  if (/liability|damages|warranty|limitation/.test(haystack)) topics.push('limitation_of_liability');
  if (/indemnif|hold harmless/.test(haystack)) topics.push('indemnification');
  if (/forum|venue|jurisdiction/.test(haystack)) topics.push('forum_selection');
  if (/choice of law|governing law/.test(haystack)) topics.push('choice_of_law');
  if (/arbitration|dispute resolution/.test(haystack)) topics.push('arbitration');
  if (/confidential|trade secret|non-disclosure|nondisclosure/.test(haystack)) topics.push('confidentiality');
  if (/data breach|security incident|privacy|personal data/.test(haystack)) topics.push('data_security_contracting');
  if (/service agreement|breach|termination|outsourcing/.test(haystack)) topics.push('service_agreement_risk');
  return unique(topics.length ? topics : ['legal_reference']);
}

function normalizeCapCase(record = {}, context = {}) {
  const query = cleanText(context.query);
  const caseName = cleanText(record.name || record.name_abbreviation || record.caseName || 'Unnamed case');
  const excerpt = extractOpinionText(record);
  return {
    source: 'Caselaw Access Project',
    sourceType: 'legal_reference_case',
    sourceDataset: 'Caselaw Access Project',
    sourceUrl: pickUrl(record),
    capId: cleanText(record.id || record.capapi_id || record.case_id || ''),
    caseName,
    jurisdiction: cleanText(record.jurisdiction?.name || record.jurisdiction?.slug || record.jurisdiction || ''),
    court: cleanText(record.court?.name || record.court?.slug || record.court || ''),
    decisionDate: cleanText(record.decision_date || record.decisionDate || ''),
    citations: Array.isArray(record.citations) ? unique(record.citations.map(normalizeCitation)) : [],
    query,
    topics: inferTopics(query, record),
    summary: excerpt
      ? `Reference case retrieved for "${query}" and normalized for clause-risk comparison.`
      : `Case metadata retrieved for "${query}" and normalized for legal-reference lookup.`,
    excerpt,
    legalCaveat: LEGAL_CAVEAT
  };
}

function capCaseToMarkdown(record = {}) {
  const title = cleanText(record.caseName || 'Unnamed CAP case');
  const sections = [
    `## ${title}`,
    '',
    `Source: ${record.source || 'Caselaw Access Project'}`,
    `Source type: ${record.sourceType || 'legal_reference_case'}`,
    record.sourceUrl ? `URL: ${record.sourceUrl}` : '',
    record.capId ? `CAP ID: ${record.capId}` : '',
    record.court ? `Court: ${record.court}` : '',
    record.jurisdiction ? `Jurisdiction: ${record.jurisdiction}` : '',
    record.decisionDate ? `Decision date: ${record.decisionDate}` : '',
    record.citations?.length ? `Citations: ${record.citations.join('; ')}` : '',
    record.query ? `Retrieval query: ${record.query}` : '',
    record.topics?.length ? `Topics: ${record.topics.join(', ')}` : '',
    '',
    '### Advisory Legal Caveat',
    record.legalCaveat || LEGAL_CAVEAT,
    '',
    '### Reference Summary',
    record.summary || 'Legal-reference case normalized for advisory clause and risk comparison.',
    '',
    '### Reference Excerpt',
    record.excerpt || 'No case text excerpt was available from the import response.'
  ].filter((line) => line !== '');
  return sections.join('\n');
}

function recordsToMarkdown(records = [], options = {}) {
  const title = cleanText(options.title) || 'Caselaw Access Project Legal Intelligence Reference';
  return [
    `# ${title}`,
    '',
    'This corpus aligns Parallax42 with Agentathon Use Case #21 Legal Intelligence. It is advisory reference context for clause/risk review and is not legal advice.',
    '',
    '## Legal Caveat',
    LEGAL_CAVEAT,
    '',
    ...records.map(capCaseToMarkdown)
  ].join('\n');
}

module.exports = {
  DEFAULT_CAP_QUERIES,
  LEGAL_CAVEAT,
  capCaseToMarkdown,
  cleanText,
  normalizeCapCase,
  recordsToMarkdown
};
