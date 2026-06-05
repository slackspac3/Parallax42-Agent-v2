'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const {
  fixtureDocumentSummary,
  getFixtureExpectedProfile,
  listSupportedFixtureDocuments,
  safeResolveFixturePath
} = require('../../lib/fixtureDocuments');

test('fixture manifest exposes six generated compliance PDFs', () => {
  const documents = listSupportedFixtureDocuments();
  assert.equal(documents.length, 6);
  assert.ok(documents.every((doc) => doc.filename.endsWith('.pdf')));
});

test('fixture path resolver accepts manifest filenames and rejects traversal or hosted URLs', () => {
  const resolved = safeResolveFixturePath('03_ai_accelerator_chip_import_export_control_agreement.pdf');
  assert.equal(path.basename(resolved), '03_ai_accelerator_chip_import_export_control_agreement.pdf');
  assert.throws(() => safeResolveFixturePath('../metadata.json'), /unsupported fixture|escaped|mismatch/i);
  assert.throws(() => safeResolveFixturePath('https://railway.com/project/example'), /hosted URL|URL/i);
  assert.throws(() => safeResolveFixturePath('https://vercel.com/example'), /hosted URL|URL/i);
});

test('fixture expected profile maps export and cloud AI domains', () => {
  const exportProfile = getFixtureExpectedProfile('03_ai_accelerator_chip_import_export_control_agreement.pdf');
  assert.equal(exportProfile.domain, 'export-control');
  assert.ok(exportProfile.expectedRiskDomains.includes('export-control'));
  assert.ok(exportProfile.expectedMissingEvidence.includes('end-use certificate'));

  const aiProfile = getFixtureExpectedProfile('06_cloud_ai_model_services_statement_of_work.pdf');
  assert.equal(aiProfile.domain, 'ai');
  assert.ok(aiProfile.expectedRiskDomains.includes('responsible-ai'));
});

test('fixture summary returns metadata fallback evidence without embeddings', () => {
  const result = fixtureDocumentSummary('05_media_buying_and_audience_analytics_order_form.pdf');
  assert.equal(result.ok, true);
  assert.equal(result.evidence.sourceType, 'fixture_pdf');
  assert.equal(result.evidence.extractionStatus, 'metadata_fallback');
  assert.ok(result.evidence.signals.includes('privacy'));
  const serialized = JSON.stringify(result).toLowerCase();
  assert.doesNotMatch(serialized, /"embedding"|"embeddings"|"vector"/);
});
