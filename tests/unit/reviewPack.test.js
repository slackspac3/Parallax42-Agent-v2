'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runComplianceAgent } = require('../../lib/complianceAgent');
const { buildReviewPack, buildReviewPackMarkdown, buildReviewPackPdf } = require('../../lib/reviewPack');

test('review pack includes digest, evidence quality, retrieval audit, and human approval boundary', () => {
  const run = runComplianceAgent({
    businessUnit: 'Trade Compliance',
    geography: 'UAE',
    supplierName: 'Zenith Compute',
    brief: 'Review restricted accelerator import with export classification and remote firmware support.',
    documents: [
      {
        evidenceId: 'DOC-01',
        title: 'Import pack',
        summary: 'Export classification, end-use certificate, import permit, MFA support access, and session logging are attached.',
        signals: ['export classification', 'end-use certificate', 'import permit', 'remote support controls']
      }
    ]
  });

  const pack = buildReviewPack(run, { generatedAt: '2026-05-15T00:00:00.000Z' });
  assert.equal(pack.packType, 'parallax42_compliance_executive_review');
  assert.equal(pack.decision.humanApprovalRequired, true);
  assert.equal(pack.controls.noAutomaticApproval, true);
  assert.ok(pack.integrity.digest.length >= 32);
  assert.equal(pack.evidenceQuality.status, run.evidenceQuality.status);
  assert.equal(pack.retrievalAudit.mode, 'not_used');

  const markdown = buildReviewPackMarkdown(pack);
  assert.match(markdown, /Executive Review Pack/);
  assert.match(markdown, /Human approval required: yes/);
  assert.match(markdown, /Executive Memo/);
  assert.match(markdown, /Specialist Validation Trace/);
  assert.match(markdown, /Governed Autonomy Model/);
  assert.match(markdown, /Agent Loop Spec/);
  assert.match(markdown, /Council Quality Rubric/);
  assert.match(markdown, /Agentic Pairings/);
  assert.match(markdown, /Final decision owner: deterministic compliance engine/);

  const pdf = buildReviewPackPdf(pack);
  assert.ok(Buffer.isBuffer(pdf));
  assert.match(pdf.subarray(0, 8).toString('latin1'), /%PDF-1\.4/);
  assert.ok(pdf.length > 1500);
  const pdfText = pdf.toString('latin1');
  assert.match(pdfText, /Compliance Mission Control/);
  assert.match(pdfText, /Decision Room/);
  assert.match(pdfText, /Evidence Intelligence/);
  assert.match(pdfText, /Council Trace/);
  assert.match(pdfText, /Governed Agent Loop/);
  assert.match(pdfText, /Quality Rubric/);
});

test('review pack can carry advisory narrative without changing decision ownership', () => {
  const run = runComplianceAgent({
    businessUnit: 'Procurement',
    geography: 'UAE',
    supplierName: 'Northstar Services',
    brief: 'Assess a service provider handling employee data with a DPA and continuity evidence.',
    documents: [
      {
        evidenceId: 'DPA-01',
        title: 'Signed DPA',
        summary: 'The DPA says no model training and includes retention commitments.',
        signals: ['signed dpa', 'model-training exclusion', 'retention schedule']
      }
    ]
  });

  const narrative = {
    advisoryOnly: true,
    source: 'compass_gateway',
    summary: 'The council found the main privacy evidence and preserved one reviewer action for accountable approval.',
    exportSummary: 'Board summary: the review is ready for human assessment with privacy evidence attached and final approval still controlled by the business owner.',
    gapRemediations: [
      { index: 0, suggestedAction: 'Ask the owner to confirm whether the DPA covers the live processing scope.' }
    ]
  };
  const pack = buildReviewPack(run, { narrative, generatedAt: '2026-05-15T00:00:00.000Z' });
  const markdown = buildReviewPackMarkdown(pack);

  assert.equal(pack.executiveNarrative.advisoryOnly, true);
  assert.equal(pack.decisionRoom.decision.finalDecisionOwner, 'deterministic compliance engine');
  assert.equal(pack.controls.noAutomaticApproval, true);
  assert.match(markdown, /Board summary: the review is ready/);
  assert.match(markdown, /Final decision owner: deterministic compliance engine/);
});

test('review pack PDF uses complete prose instead of ellipsized or raw JSON specialist text', () => {
  const run = runComplianceAgent({
    businessUnit: 'IT',
    geography: 'UAE and US',
    supplierName: 'Aster Cognitive Cloud',
    brief: 'Review an AI assistant SOW for internal policy search and compliance evidence extraction.',
    documents: [
      {
        evidenceId: 'SOW-01',
        title: 'Cloud AI Model Services Statement of Work',
        summary: 'The service supports retrieval, document intelligence, meeting summaries, and policy question answering. Data owner approval, retention approval, final RAI assessment, robustness evidence, and model rollback plan are missing.',
        signals: ['responsible-ai', 'privacy', 'retention approval missing', 'model rollback plan missing']
      }
    ]
  });
  run.orchestration = {
    llmOutput: {
      outputAvailable: true,
      specialists: [
        {
          specialist: 'Privacy Specialist',
          assessment: '{"specialist":"privacy","assessment":"DPA coverage and retention approval need reviewer confirmation before approval.","unresolvedRisks":["retention approval missing","data owner approval missing"],"recommendedActions":["Require retention approval","Confirm data owner approval"],"confidence":"medium"}',
          confidence: 0.71
        }
      ]
    }
  };

  const pack = buildReviewPack(run, { generatedAt: '2026-05-15T00:00:00.000Z' });
  const pdfText = buildReviewPackPdf(pack).toString('latin1');

  assert.match(pdfText, /DPA coverage and retention/);
  assert.match(pdfText, /approval need reviewer/);
  assert.match(pdfText, /confirmation before approval/);
  assert.doesNotMatch(pdfText, /\.\.\./);
  assert.doesNotMatch(pdfText, /"specialist"/);
  assert.doesNotMatch(pdfText, /unresolvedRisks/);
  assert.doesNotMatch(pdfText, /recommendedActions/);
});
