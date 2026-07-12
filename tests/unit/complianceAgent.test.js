'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { runComplianceAgent } = require('../../lib/complianceAgent');
const { fixtureDocumentSummary } = require('../../lib/fixtureDocuments');

test('blocks empty cases before domain work', () => {
  const result = runComplianceAgent({});
  assert.equal(result.ok, false);
  assert.match(result.runId, /^run_\d{14}_case-/);
  assert.equal(result.trace[0].payload.runId, result.runId);
  assert.match(result.message, /brief or service description/i);
  assert.equal(result.trace.at(-1).eventType, 'run_blocked');
});

test('assigns unique run IDs to completed council runs', () => {
  const baseCase = {
    businessUnit: 'Procurement',
    geography: 'UAE',
    supplierName: 'Traceable Supplier',
    brief: 'Renew a low criticality consulting supplier with no personal data access and no system integration.',
    documents: [
      {
        title: 'Compliance pack',
        summary: 'Signed contract, approval authority, security assurance review, and no personal data processing statement.'
      }
    ]
  };
  const first = runComplianceAgent(baseCase);
  const second = runComplianceAgent(baseCase);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.match(first.runId, /^run_\d{14}_case-/);
  assert.notEqual(first.runId, second.runId);
  assert.equal(first.trace[0].payload.runId, first.runId);
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
  assert.equal(result.decisionReadiness.humanApprovalRequired, true);
  assert.ok(result.evidenceQuality.score > 0);
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
  assert.equal(result.retrievalAudit.mode, 'server_side_semantic_retrieval');
  assert.ok(result.documentEvidenceImpact.citedEvidenceIds.includes('DOC-IMPORT-01'));
});

test('hardware import does not trigger AI model governance by the word AI alone', () => {
  const result = runComplianceAgent({
    businessUnit: 'Infrastructure Procurement',
    geography: 'UAE',
    supplierName: 'Zenith Compute',
    brief: 'Review restricted AI accelerator import with firmware support, freight forwarding, customs broker access, and final end-use certificate attached.',
    integrations: ['Firmware support channel', 'Freight forwarder portal'],
    documents: [
      {
        evidenceId: 'DOC-01',
        title: 'Import control pack',
        summary: 'Export classification, end-use certificate, sanctions screening, import permit, delivery-site approval, MFA remote firmware support, session logging, and approved support window are attached.',
        signals: ['export classification', 'end-use certificate', 'import permit', 'sanctions screening', 'remote support controls']
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.ok(!result.domains.some((domain) => domain.id === 'ai_model_governance'));
  assert.ok(!result.gaps.some((gap) => /training-data handling/i.test(gap.gap)));
  assert.ok(!result.gaps.some((gap) => /Physical Security And International Growth applicability/i.test(gap.gap)));
  assert.ok(!result.gaps.some((gap) => /classification|licen[cs]e|end-use|import permit|delivery-site|remote-support/i.test(gap.gap)));
  assert.equal(result.evidenceQuality.status, 'usable');
});

test('export-control fixture known gaps block readiness with explicit proof actions', () => {
  const fixture = fixtureDocumentSummary('03_ai_accelerator_chip_import_export_control_agreement.pdf');
  const profile = fixture.expectedProfile;
  const result = runComplianceAgent({
    businessUnit: 'Trade Compliance And Export Controls',
    geography: 'UAE and Singapore',
    supplierName: profile.supplier,
    brief: profile.serviceSummary,
    riskSignals: ['export control', 'remote support access'],
    integrations: ['Firmware support channel', 'Freight forwarder portal'],
    knownGaps: profile.expectedMissingEvidence,
    documents: [fixture.evidence]
  });

  assert.equal(result.ok, true);
  assert.notEqual(result.decision.status, 'ready');
  const blockers = result.gaps.map((gap) => `${gap.gap} ${gap.action}`).join(' ');
  for (const keyword of profile.expectedRequiredActionKeywords) {
    assert.match(blockers, new RegExp(keyword.replace(/[-\s]+/g, '[- ]'), 'i'));
  }
  assert.ok(result.gaps.some((gap) => /final export classification/i.test(gap.gap)));
  assert.ok(result.gaps.some((gap) => /export-license analysis/i.test(gap.gap)));
  assert.ok(result.gaps.some((gap) => /final end-use certificate/i.test(gap.gap)));
  assert.ok(result.gaps.some((gap) => /import permit/i.test(gap.gap)));
  assert.ok(result.gaps.some((gap) => /delivery-site approval/i.test(gap.gap)));
  assert.ok(result.gaps.some((gap) => /remote-support controls and runbook/i.test(gap.gap)));
});

test('explicitly pending export evidence is never treated as satisfied', () => {
  const result = runComplianceAgent({
    businessUnit: 'Trade Compliance',
    geography: 'UAE',
    supplierName: 'Pending Export Supplier',
    brief: 'Review a restricted accelerator import with firmware support.',
    documents: [{
      title: 'Draft export pack',
      summary: 'Export classification is pending. The end-use certificate is not final. The import permit is not attached.'
    }]
  });

  assert.notEqual(result.decision.status, 'ready');
  assert.ok(result.gaps.some((gap) => /classification evidence remains unresolved/i.test(gap.gap)));
  assert.ok(result.gaps.some((gap) => /end-use certificate remains unresolved/i.test(gap.gap)));
  assert.ok(result.gaps.some((gap) => /import permit evidence remains unresolved/i.test(gap.gap)));
});

test('title-only evidence cannot produce a ready recommendation or satisfy a DPA control', () => {
  const result = runComplianceAgent({
    businessUnit: 'Procurement',
    geography: 'UAE',
    supplierName: 'Metadata Only SaaS',
    brief: 'Review a SaaS supplier that processes personal data.',
    documents: [{ title: 'DPA' }]
  });

  assert.equal(result.ok, true);
  assert.notEqual(result.decision.status, 'ready');
  assert.equal(result.evidenceQuality.status, 'weak');
  assert.equal(result.decisionReadiness.approvalEligible, false);
  assert.ok(result.gaps.some((gap) => /usable supporting evidence/i.test(gap.gap)));
  assert.ok(result.gaps.some((gap) => /DPA evidence/i.test(gap.gap)));
  assert.equal(result.citations.every((citation) => !citation.text), true);
});

test('normalization preserves structured risk context and blocks unsupported high-risk AI use', () => {
  const aiUsageScope = {
    audience: 'external_users_possible',
    taskBoundary: 'people_impacting_decisions',
    hostingModel: 'multi_tenant_saas',
    externalUsers: true,
    thirdPartyContractors: true,
    highRiskWorkflowMentioned: true,
    retrievalOnly: false,
    excludedWorkflows: ['legal determinations']
  };
  const result = runComplianceAgent({
    businessUnit: 'People Operations',
    geography: 'UAE',
    supplierName: 'Talent AI',
    brief: 'Review an AI service used for employee eligibility decisions with personal data.',
    exportOriginJurisdiction: 'United States',
    exportEndUse: 'Internal workforce eligibility decisions',
    aiUsageScope,
    reviewFocus: 'Responsible AI and privacy controls',
    dataCategories: ['employee health data'],
    riskSignals: ['personal data', 'AI/model use'],
    evidenceSignals: ['signed DPA'],
    knownGaps: ['human_oversight'],
    sanctionsSensitiveGeographies: ['Iran'],
    documents: [{
      title: 'Supplier compliance pack',
      summary: 'Signed DPA, retention schedule, security assurance, and model training exclusion are documented.'
    }]
  });

  assert.equal(result.ok, true);
  assert.equal(result.case.exportOriginJurisdiction, 'United States');
  assert.equal(result.case.exportEndUse, 'Internal workforce eligibility decisions');
  assert.deepEqual(result.case.aiUsageScope, aiUsageScope);
  assert.equal(result.case.reviewFocus, 'Responsible AI and privacy controls');
  assert.deepEqual(result.case.dataCategories, ['employee health data']);
  assert.deepEqual(result.case.riskSignals, ['personal data', 'AI/model use']);
  assert.deepEqual(result.case.evidenceSignals, ['signed DPA']);
  assert.deepEqual(result.case.knownGaps, ['human_oversight']);
  assert.deepEqual(result.case.sanctionsSensitiveGeographies, ['Iran']);
  assert.notEqual(result.decision.status, 'ready');
  assert.ok(result.gaps.some((gap) => /High-risk AI use/i.test(gap.gap)));
});

test('chat mentions and placeholders cannot become approval evidence', () => {
  const mentioned = runComplianceAgent({
    businessUnit: 'Operations',
    geography: 'UAE',
    supplierName: 'Mention Only Vendor',
    brief: 'Review a vendor that processes personal data.',
    evidenceSignals: ['SOC 2', 'DPA'],
    documents: [{
      evidenceId: 'CHAT-01',
      sourceType: 'chat_message',
      extractionStatus: 'nlp_extracted',
      summary: 'Is SOC 2 evidence available, and is there a signed DPA?',
      signals: ['SOC 2', 'DPA']
    }]
  });
  const placeholder = runComplianceAgent({
    businessUnit: 'Operations',
    geography: 'UAE',
    supplierName: 'Placeholder Vendor',
    brief: 'Review a low criticality consulting vendor with no personal data.',
    documents: [{
      title: 'Compliance pack',
      summary: 'Weekly status meeting notes cover staffing updates and the office lunch schedule.'
    }]
  });
  const metadataOnly = runComplianceAgent({
    businessUnit: 'Operations',
    geography: 'UAE',
    supplierName: 'Metadata Only Vendor',
    brief: 'Review a vendor contract that processes personal data.',
    documents: [{
      evidenceId: 'UP-01',
      fileName: 'supplier-agreement.pdf',
      sourceType: 'pdf',
      extractionStatus: 'binary_registered',
      summary: 'Evidence registered without browser parsing: supplier-agreement.pdf.'
    }]
  });

  assert.equal(mentioned.case.documents[0].assertionState, 'requested');
  assert.equal(mentioned.case.documents[0].provenance, 'chat_message');
  assert.ok(mentioned.gaps.some((gap) => /No usable supporting evidence/i.test(gap.gap)));
  assert.ok(mentioned.gaps.some((gap) => /DPA evidence/i.test(gap.gap)));
  assert.equal(mentioned.evidenceIds.includes('CHAT-01'), false);
  assert.equal(mentioned.decisionReadiness.approvalEligible, false);
  assert.ok(placeholder.gaps.some((gap) => /No usable supporting evidence/i.test(gap.gap)));
  assert.equal(placeholder.decisionReadiness.approvalEligible, false);
  assert.ok(metadataOnly.gaps.some((gap) => /No usable supporting evidence/i.test(gap.gap)));
  assert.equal(metadataOnly.evidenceIds.length, 0);
  assert.equal(metadataOnly.decisionReadiness.approvalEligible, false);
});

test('policy references stay separate from supplied evidence', () => {
  const result = runComplianceAgent({
    businessUnit: 'Operations',
    geography: 'UAE',
    supplierName: 'Reference Only Vendor',
    brief: 'Review a vendor contract.'
  });

  assert.deepEqual(result.evidenceIds, []);
  assert.ok(result.policyReferenceIds.some((id) => id.startsWith('p42:')));
  assert.equal(result.decisionReadiness.approvalEligible, false);
});

test('Agentathon evaluator treats trailing-question evidence as requested, not proof', () => {
  const completed = spawnSync(process.execPath, ['scripts/agentathon_run.js'], {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8',
    input: JSON.stringify({
      run_id: 'unit-evaluator-question-evidence',
      input: {
        query: 'Review supplier onboarding.',
        case: {
          business_unit: 'Procurement',
          geography: 'UAE',
          supplier_name: 'Question Evidence Vendor'
        },
        evidence: [
          'Signed contract available?',
          'Approval authority documented?',
          'Security assurance review completed?'
        ]
      }
    })
  });
  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout);
  assert.notEqual(result.decision.status, 'ready');
  assert.equal(result.decision_readiness.approvalEligible, false);
  assert.deepEqual(result.evidence_ids, []);
  assert.deepEqual(result.citations, []);
});

test('semantic question matches are rejected before citations, quality, and approval', () => {
  const result = runComplianceAgent({
    businessUnit: 'Procurement',
    geography: 'UAE',
    supplierName: 'Retrieved Question Vendor',
    brief: 'Review a supplier that processes customer personal data for onboarding.',
    retrievalContext: {
      query: 'supplier evidence',
      chunkCount: 3,
      matchCount: 3,
      matches: [
        { chunkId: 'Q-1', evidenceId: 'RET-Q-1', text: 'Signed contract available?' },
        { chunkId: 'Q-2', evidenceId: 'RET-Q-2', text: 'Approval authority documented?' },
        { chunkId: 'Q-3', evidenceId: 'RET-Q-3', text: 'No personal data is processed?' }
      ]
    }
  });

  assert.notEqual(result.decision.status, 'ready');
  assert.equal(result.decisionReadiness.approvalEligible, false);
  assert.deepEqual(result.evidenceIds, []);
  assert.deepEqual(result.citations, []);
  assert.equal(result.evidenceQuality.semanticMatches, 0);
  assert.equal(result.retrievalAudit.candidateMatchCount, 3);
  assert.equal(result.retrievalAudit.matchCount, 0);
  assert.equal(result.retrievalAudit.rejectedMatchCount, 3);
  assert.equal(result.retrievalContext.evidenceMatches.length, 0);
  assert.ok(result.retrievalContext.matches.every((match) => match.assertionState === 'requested'));
  const privacy = result.domains.find((domain) => domain.id === 'privacy_data_governance');
  assert.equal(privacy.status, 'applicable');
  assert.equal(privacy.applicabilityAssertions.negative.length, 0);
  assert.ok(result.outputReview.checks.some((check) => check.name === 'retrieval_citations' && check.status === 'needs_review'));
});

test('positive and negative applicability assertions create blocking contradictions', () => {
  const cases = [
    {
      domain: 'ai_model_governance',
      brief: 'Review the vendor terms.',
      evidence: 'The vendor says no AI is used, but the contract permits model training and fine-tuning.'
    },
    {
      domain: 'privacy_data_governance',
      brief: 'The vendor says it processes no personal data.',
      evidence: 'The DPA states that customer PII is processed.'
    },
    {
      domain: 'business_continuity',
      brief: 'The vendor says the service is not critical.',
      evidence: 'The contract describes a critical payment service with recovery obligations.'
    }
  ];

  for (const item of cases) {
    const result = runComplianceAgent({
      businessUnit: 'Operations',
      geography: 'UAE',
      supplierName: 'Contradictory Vendor',
      brief: item.brief,
      documents: [{ title: 'Contract terms', summary: item.evidence }]
    });
    const domain = result.domains.find((entry) => entry.id === item.domain);
    assert.ok(domain, `${item.domain} must not be suppressed`);
    assert.equal(domain.contradiction, true);
    assert.ok(result.gaps.some((gap) => gap.code === `applicability_contradiction:${item.domain}`));
    assert.equal(result.decision.status, 'not_ready');
    assert.equal(result.decisionReadiness.approvalEligible, false);
  }
});

test('missing-control negation cannot suppress an applicable risk domain', () => {
  const cases = [
    {
      domain: 'ai_model_governance',
      brief: 'No AI governance controls are documented for model training.'
    },
    {
      domain: 'privacy_data_governance',
      brief: 'No personal data inventory or DPA is available.'
    },
    {
      domain: 'business_continuity',
      brief: 'The service is not critical and has no continuity plan.'
    },
    {
      domain: 'ai_model_governance',
      brief: 'No AI safeguards are in place for model training.'
    },
    {
      domain: 'ai_model_governance',
      brief: 'No AI risk management framework exists for the deployed model.'
    },
    {
      domain: 'privacy_data_governance',
      brief: 'No personal data governance framework exists for customer records.'
    },
    {
      domain: 'business_continuity',
      brief: 'The service is not critical because continuity testing has never occurred.'
    },
    {
      domain: 'ai_model_governance',
      brief: 'The service does not use AI safeguards for model training.'
    },
    {
      domain: 'ai_model_governance',
      brief: 'The service does not use AI governance controls for deployed models.'
    },
    {
      domain: 'privacy_data_governance',
      brief: 'The service does not process personal data controls for customer records.'
    },
    {
      domain: 'privacy_data_governance',
      brief: 'No personal data processing safeguards are in place.'
    },
    {
      domain: 'ai_model_governance',
      brief: 'No AI processing safeguards are in place.'
    },
    {
      domain: 'ai_model_governance',
      brief: 'No AI models safeguards are documented.'
    },
    {
      domain: 'privacy_data_governance',
      brief: 'No personal data processing framework exists.'
    },
    {
      domain: 'ai_model_governance',
      brief: 'No AI processing framework exists.'
    },
    {
      domain: 'ai_model_governance',
      brief: 'No AI model validation exists.'
    },
    {
      domain: 'business_continuity',
      brief: 'The service is not critical and no recovery objectives are defined.'
    }
  ];

  for (const item of cases) {
    const result = runComplianceAgent({
      businessUnit: 'Operations',
      geography: 'UAE',
      supplierName: 'Negation Boundary Vendor',
      brief: item.brief,
      documents: [{
        provenance: 'uploaded_document',
        assertionState: 'parsed',
        extractionStatus: 'text_extracted',
        title: 'Generic supplier assurance',
        summary: 'A signed supplier contract and general security assurance review are documented.'
      }]
    });

    assert.ok(result.domains.some((domain) => domain.id === item.domain), `${item.domain} must remain applicable`);
    assert.ok(result.gaps.length > 0, `${item.domain} must retain a blocking evidence or control gap`);
    assert.notEqual(result.decision.status, 'ready');
    assert.equal(result.decisionReadiness.approvalEligible, false);
  }
});

test('one unresolved medium gap is conditional and never approval eligible', () => {
  const result = runComplianceAgent({
    geography: 'UAE',
    supplierName: 'Low Risk Services',
    brief: 'Renew a consulting vendor. The service is low criticality. The service does not process personal data.',
    documents: [{
      title: 'Compliance pack',
      summary: 'Signed contract, approval authority, and security assurance review are documented.'
    }]
  });

  assert.equal(result.gaps.filter((gap) => gap.severity === 'medium').length, 1);
  assert.equal(result.decision.status, 'conditionally_ready');
  assert.equal(result.decision.approvalEligible, false);
  assert.equal(result.decisionReadiness.approvalEligible, false);
});
