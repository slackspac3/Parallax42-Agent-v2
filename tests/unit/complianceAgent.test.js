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
