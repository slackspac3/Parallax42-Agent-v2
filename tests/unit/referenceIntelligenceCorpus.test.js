'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COURTLISTENER_CAVEAT,
  normalizeCourtListenerCitationResult,
  normalizeCourtListenerSearchResult,
  normalizeCuadClause,
  normalizeReferenceRecord,
  recordsToMarkdown
} = require('../../lib/referenceIntelligenceCorpus');

test('normalizes CourtListener search results as advisory case-law reference records', () => {
  const record = normalizeCourtListenerSearchResult({
    cluster_id: 42,
    caseNameFull: 'Example Contract Dispute v. Supplier',
    court_id: 'ca9',
    dateFiled: '2024-01-15',
    absolute_url: '/opinion/42/example-contract-dispute/',
    citation: ['42 F.4th 100'],
    opinions: [{
      snippet: '<mark>Limitation of liability</mark> and indemnification clauses were disputed.'
    }]
  }, { query: 'limitation of liability contract' });

  assert.equal(record.source, 'courtlistener');
  assert.equal(record.corpusType, 'case_law');
  assert.equal(record.lane, 'legal');
  assert.equal(record.documentType, 'court_opinion');
  assert.equal(record.sourceUrl, 'https://www.courtlistener.com/opinion/42/example-contract-dispute/');
  assert.deepEqual(record.citations, ['42 F.4th 100']);
  assert.ok(record.tags.includes('liability'));
  assert.ok(record.tags.includes('indemnification'));
  assert.equal(record.legalCaveat, COURTLISTENER_CAVEAT);
  assert.doesNotMatch(record.excerpt, /<mark>/);
});

test('normalizes CourtListener citation lookup as citation verification context', () => {
  const record = normalizeCourtListenerCitationResult({
    citation: '410 U.S. 113',
    normalized_citations: ['410 U.S. 113'],
    status: 200,
    clusters: [{ case_name: 'Roe v. Wade' }]
  });

  assert.equal(record.source, 'courtlistener_citation_lookup');
  assert.equal(record.documentType, 'citation_verification');
  assert.ok(record.tags.includes('citation verification'));
  assert.ok(record.tags.includes('valid citation'));
  assert.ok(record.summary.includes('verified citation'));
  assert.ok(record.excerpt.includes('Matched clusters: Roe v. Wade'));
});

test('normalizes CUAD-compatible clauses into contract-clause reference records', () => {
  const record = normalizeCuadClause({
    document_name: 'Sample MSA',
    clause_type: 'Data security',
    text: 'Supplier must encrypt personal data and notify customer of security incidents.'
  });

  assert.equal(record.corpusType, 'contract_clause');
  assert.equal(record.lane, 'legal');
  assert.equal(record.documentType, 'contract_clause');
  assert.ok(record.tags.includes('Data security'));
  assert.ok(record.tags.includes('privacy'));
  assert.ok(record.tags.includes('security'));
  assert.ok(record.domains.includes('privacy_and_data_governance'));
  assert.ok(record.domains.includes('technical_risk'));
});

test('normalizes broader compliance references into the correct lane', () => {
  const record = normalizeReferenceRecord({
    title: 'NIST AI Risk Management Framework',
    source: 'NIST',
    text: 'AI governance requires human oversight, transparency, model risk, and bias controls.'
  });

  assert.equal(record.corpusType, 'ai_governance');
  assert.equal(record.lane, 'ai_governance');
  assert.ok(record.tags.includes('ai governance'));
  assert.ok(record.domains.includes('ai_and_model_governance'));
  assert.equal(record.advisoryOnly, true);
  assert.equal(record.requiresHumanReview, true);
});

test('renders mixed reference records as advisory markdown', () => {
  const markdown = recordsToMarkdown([
    normalizeCuadClause({
      clause_type: 'Termination',
      text: 'Exit assistance and data deletion certificate are required.'
    })
  ], { title: 'Mixed Reference Corpus' });

  assert.match(markdown, /Mixed Reference Corpus/);
  assert.match(markdown, /reference intelligence/i);
  assert.match(markdown, /Advisory Boundary/);
  assert.match(markdown, /not legal advice|advisory/i);
});
