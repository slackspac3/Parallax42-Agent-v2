'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LEGAL_CAVEAT,
  normalizeCapCase,
  recordsToMarkdown
} = require('../../lib/legalReferenceCorpus');

test('normalizes CAP case metadata into safe legal-reference records', () => {
  const record = normalizeCapCase({
    id: 123,
    name: 'Example Contract Case',
    decision_date: '2020-01-02',
    court: { name: 'Example Court' },
    jurisdiction: { name: 'Example Jurisdiction' },
    frontend_url: 'https://cite.case.law/example/1/',
    citations: [{ cite: '1 Example 2' }],
    casebody: {
      data: {
        opinions: [
          { text: 'The agreement contained a limitation of liability and indemnification clause.' }
        ]
      }
    }
  }, { query: 'limitation of liability contract' });

  assert.equal(record.source, 'Caselaw Access Project');
  assert.equal(record.sourceType, 'legal_reference_case');
  assert.equal(record.caseName, 'Example Contract Case');
  assert.equal(record.court, 'Example Court');
  assert.deepEqual(record.citations, ['1 Example 2']);
  assert.ok(record.topics.includes('limitation_of_liability'));
  assert.ok(record.topics.includes('indemnification'));
  assert.equal(record.legalCaveat, LEGAL_CAVEAT);
});

test('renders normalized CAP records as advisory reference markdown', () => {
  const markdown = recordsToMarkdown([
    normalizeCapCase({
      name: 'Example Arbitration Case',
      casebody: { data: { opinions: [{ text: 'The arbitration agreement was disputed.' }] } }
    }, { query: 'arbitration agreement' })
  ]);

  assert.match(markdown, /Use Case #21 Legal Intelligence/);
  assert.match(markdown, /Advisory Legal Caveat/);
  assert.match(markdown, /Example Arbitration Case/);
  assert.match(markdown, /not legal advice/i);
});
