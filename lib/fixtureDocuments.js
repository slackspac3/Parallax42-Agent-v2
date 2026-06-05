'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(ROOT, 'test-fixtures', 'compliance-documents');
const MANIFEST_PATH = path.join(FIXTURE_DIR, 'manifest.json');
const GOLDEN_MATRIX_PATH = path.join(FIXTURE_DIR, 'golden_matrix.json');

function clean(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function fixtureManifest() {
  return readJson(MANIFEST_PATH, { documents: [] });
}

function fixtureMatrix() {
  return readJson(GOLDEN_MATRIX_PATH, { fixtures: [] });
}

function listSupportedFixtureDocuments() {
  const docs = fixtureManifest().documents;
  return Array.isArray(docs)
    ? docs.filter((doc) => doc && doc.filename).map((doc) => ({ ...doc }))
    : [];
}

function getFixtureDocumentByFilename(filename = '') {
  const target = path.basename(String(filename || ''));
  return listSupportedFixtureDocuments().find((doc) => doc.filename === target) || null;
}

function getFixtureExpectedProfile(filename = '') {
  const target = path.basename(String(filename || ''));
  const fixtures = fixtureMatrix().fixtures;
  return Array.isArray(fixtures)
    ? fixtures.find((profile) => profile && profile.filename === target) || null
    : null;
}

function looksLikeForbiddenUrl(raw = '') {
  const lowered = String(raw || '').toLowerCase();
  return lowered.includes('://')
    || lowered.startsWith('http:')
    || lowered.startsWith('https:')
    || /(?:railway\.app|railway\.com|vercel\.app|vercel\.com|dashboard)/i.test(lowered);
}

function safeResolveFixturePath(pathOrFilename = '') {
  const raw = clean(pathOrFilename);
  if (!raw) {
    const error = new Error('fixture reference is empty');
    error.code = 'fixture_reference_empty';
    throw error;
  }
  if (looksLikeForbiddenUrl(raw)) {
    const error = new Error('fixture reference must be a local generated fixture filename, not a hosted URL');
    error.code = 'fixture_reference_url_rejected';
    throw error;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol || parsed.host) {
      const error = new Error('fixture reference must not be a URL');
      error.code = 'fixture_reference_url_rejected';
      throw error;
    }
  } catch {
    // Expected for regular filenames and relative paths.
  }

  const filename = path.basename(raw);
  const doc = getFixtureDocumentByFilename(filename);
  if (!doc) {
    const error = new Error(`unsupported fixture document: ${filename}`);
    error.code = 'unsupported_fixture_document';
    throw error;
  }
  const expected = path.resolve(ROOT, doc.path || path.join('test-fixtures', 'compliance-documents', filename));
  let resolved;
  if (path.isAbsolute(raw)) {
    resolved = path.resolve(raw);
  } else if (raw.replace(/\\/g, '/').startsWith('test-fixtures/compliance-documents/')) {
    resolved = path.resolve(ROOT, raw);
  } else if (raw === filename) {
    resolved = path.resolve(FIXTURE_DIR, filename);
  } else {
    resolved = path.resolve(FIXTURE_DIR, filename);
  }
  if (resolved !== expected) {
    const error = new Error('fixture reference did not resolve to its generated manifest path');
    error.code = 'fixture_path_mismatch';
    throw error;
  }
  const fixtureRoot = `${path.resolve(FIXTURE_DIR)}${path.sep}`;
  if (!resolved.startsWith(fixtureRoot)) {
    const error = new Error('fixture reference escaped the fixture directory');
    error.code = 'fixture_path_traversal';
    throw error;
  }
  if (!fs.existsSync(resolved)) {
    const error = new Error(`fixture file not found: ${filename}`);
    error.code = 'fixture_not_found';
    throw error;
  }
  return resolved;
}

function profileText(document = {}, profile = {}) {
  return [
    document.title,
    profile.serviceSummary,
    `Provider: ${profile.provider || profile.supplier || ''}`,
    `Domain: ${profile.domain || ''}`,
    `Risk domains: ${(profile.expectedRiskDomains || document.tags || []).join(', ')}`,
    `Missing evidence: ${(profile.expectedMissingEvidence || []).join(', ')}`,
    `Required actions: ${(profile.expectedRequiredActionKeywords || []).join(', ')}`
  ].map(clean).filter(Boolean).join('\n');
}

function fixtureDocumentSummary(pathOrFilename = '') {
  const resolved = safeResolveFixturePath(pathOrFilename);
  const filename = path.basename(resolved);
  const document = getFixtureDocumentByFilename(filename);
  const expectedProfile = getFixtureExpectedProfile(filename) || {};
  const text = profileText(document || { filename, title: filename, tags: [] }, expectedProfile);
  return {
    ok: true,
    document,
    expectedProfile,
    evidence: {
      evidenceId: `FIXTURE-${filename.split('_', 1)[0]}`,
      title: document?.title || filename,
      filename,
      fileName: filename,
      source: 'fixture_pdf',
      sourceType: 'fixture_pdf',
      extractionStatus: 'metadata_fallback',
      documentType: expectedProfile.domain || 'fixture_contract',
      summary: clean(expectedProfile.serviceSummary || text),
      excerpt: clean(text).slice(0, 700),
      text,
      signals: Array.from(new Set([...(expectedProfile.expectedRiskDomains || []), ...(document?.tags || [])])),
      fixtureProfile: expectedProfile
    }
  };
}

module.exports = {
  FIXTURE_DIR,
  fixtureDocumentSummary,
  getFixtureDocumentByFilename,
  getFixtureExpectedProfile,
  listSupportedFixtureDocuments,
  safeResolveFixturePath
};
