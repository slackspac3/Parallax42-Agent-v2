'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runComplianceAgent } = require('../../lib/complianceAgent');

test('blocks empty cases before domain work', () => {
  const result = runComplianceAgent({});
  assert.equal(result.ok, false);
  assert.match(result.message, /brief or service description/i);
  assert.equal(result.trace.at(-1).eventType, 'run_blocked');
});

test('detects privacy, AI, continuity, and third-party controls', () => {
  const result = runComplianceAgent({
    businessUnit: 'Group Technology Risk',
    geography: 'UAE',
    supplierName: 'Example AI SaaS',
    brief: 'Procure a critical AI SaaS supplier that processes personal data, integrates with Azure, and supports operational reporting.',
    documents: [
      {
        title: 'Service summary',
        summary: 'Supplier provides AI workflow automation. SOC 2 available. No DPA or business continuity plan attached.'
      }
    ],
    integrations: ['Azure AD', 'ServiceNow']
  });

  assert.equal(result.ok, true);
  assert.equal(result.decision.status, 'not_ready');
  assert.ok(result.domains.some((domain) => domain.id === 'ai_model_governance'));
  assert.ok(result.domains.some((domain) => domain.id === 'privacy_data_governance'));
  assert.ok(result.gaps.some((gap) => /DPA/i.test(gap.gap)));
  assert.ok(result.outputReview.finalOutputSafeForHumanReview);
});

test('can return a ready decision when evidence is sufficient', () => {
  const result = runComplianceAgent({
    businessUnit: 'Procurement',
    geography: 'UAE',
    supplierName: 'Low Risk Services',
    brief: 'Renew a low criticality consulting supplier with no personal data access and no system integration.',
    documents: [
      {
        title: 'Compliance pack',
        summary: 'Signed contract, approval authority, security assurance review, and no personal data processing statement.'
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.notEqual(result.decision.status, 'not_ready');
  assert.ok(result.trace.length >= 5);
});

test('uploaded positive evidence clears training and continuity blockers', () => {
  const result = runComplianceAgent({
    businessUnit: 'Group Technology Risk',
    geography: 'UAE',
    supplierName: 'Example AI SaaS',
    brief: 'Procure a critical AI SaaS supplier that processes personal data, uses AI workflows, integrates with Azure AD, and supports finance reporting.',
    documents: [
      {
        title: 'Initial summary',
        summary: 'SOC 2 summary available. No signed DPA, model-training exclusion, or continuity plan attached.'
      },
      {
        title: 'Uploaded compliance pack',
        summary: 'Signed DPA attached with subprocessors, retention, deletion, and transfer evidence. Supplier states no customer data is used for model training, fine-tuning, or service improvement. Business continuity plan and exit assistance are attached.'
      }
    ],
    integrations: ['Azure AD', 'Finance reporting']
  });

  assert.equal(result.ok, true);
  assert.ok(!result.gaps.some((gap) => /training-data handling/i.test(gap.gap)));
  assert.ok(!result.gaps.some((gap) => /continuity or exit/i.test(gap.gap)));
  assert.ok(!result.gaps.some((gap) => /DPA evidence/i.test(gap.gap)));
});

test('retrieval context becomes citation-ready evidence for the council', () => {
  const result = runComplianceAgent({
    businessUnit: 'Trade Compliance And Export Controls',
    geography: 'UAE',
    supplierName: 'HelioChip Logistics',
    brief: 'Review restricted AI accelerator import with firmware support and freight forwarding.',
    documents: [
      {
        evidenceId: 'DOC-IMPORT-01',
        title: 'Chip import agreement',
        summary: 'Import permit is pending. End-use certificate is not final.'
      }
    ],
    retrievalContext: {
      query: 'export classification end-use certificate import permit firmware access',
      model: 'text-embedding-3-large',
      chunkCount: 14,
      matchCount: 1,
      matches: [
        {
          chunkId: 'chk_export_1',
          evidenceId: 'DOC-IMPORT-01',
          title: 'Chip import agreement',
          score: 0.91,
          text: 'Manufacturer export classification remains pending and final end-use certificate is not attached.'
        }
      ]
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.retrievalContext.matchCount, 1);
  assert.ok(result.trace.some((event) => event.eventType === 'semantic_retrieval_completed'));
  assert.ok(result.citations.some((citation) => citation.citationId === 'chk_export_1'));
  assert.ok(result.evidenceIds.includes('DOC-IMPORT-01'));
  assert.ok(result.outputReview.checks.some((check) => check.name === 'retrieval_citations' && check.status === 'passed'));
});
