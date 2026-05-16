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

  const pdf = buildReviewPackPdf(pack);
  assert.ok(Buffer.isBuffer(pdf));
  assert.match(pdf.subarray(0, 8).toString('latin1'), /%PDF-1\.4/);
  assert.ok(pdf.length > 1500);
  const pdfText = pdf.toString('latin1');
  assert.match(pdfText, /Compliance Mission Control/);
  assert.match(pdfText, /Decision Room/);
  assert.match(pdfText, /Evidence Intelligence/);
  assert.match(pdfText, /Council Trace/);
});
