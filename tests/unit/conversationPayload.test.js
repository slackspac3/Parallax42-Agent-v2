'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadConversationPayloadModule() {
  const window = {
    P42ModuleRegistry: {
      text: {
        cleanText: (value = '') => String(value || '').replace(/\s+/g, ' ').trim(),
        unique: (values = []) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
      }
    }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'modules', 'conversationPayload.js'), 'utf8');
  vm.runInNewContext(source, { window });
  return window.P42ModuleRegistry.conversationPayload;
}

test('conversation payload sanitizer caps raw document text and drops semantic parse objects', () => {
  const payload = loadConversationPayloadModule();
  const longRawText = `RAW_DOCUMENT_START ${'x'.repeat(1800)} RAW_DOCUMENT_END`;
  const sanitized = payload.sanitizeDraftForConversationPayload({
    caseId: 'case-large-evidence',
    supplierName: 'Large Evidence Supplier',
    businessUnit: 'Technology Risk',
    geography: 'UAE',
    brief: 'Assess a supplier with server-side parsed evidence.',
    evidenceSignals: ['SOC 2'],
    riskSignals: ['personal data'],
    documents: [
      {
        evidenceId: 'DOC-LONG',
        title: 'Long parsed contract',
        documentType: 'contract',
        extractionStatus: 'backend_parsed',
        text: longRawText,
        fullText: longRawText,
        semanticParse: {
          semantic_summary: 'Contract summary from parser.',
          clause_map: { raw: `SEMANTIC_PARSE_SHOULD_NOT_SURVIVE ${'z'.repeat(2000)}` }
        },
        signals: ['SOC 2'],
        indexedChunkIds: ['chunk-1', 'chunk-2']
      }
    ]
  });
  const serialized = JSON.stringify(sanitized);

  assert.equal(sanitized.documents[0].text.length, payload.MAX_DOCUMENT_TEXT_CHARS);
  assert.equal(sanitized.documents[0].fullText.length, payload.MAX_DOCUMENT_TEXT_CHARS);
  assert.equal(sanitized.documents[0].summary, 'Contract summary from parser.');
  assert.equal(sanitized.documents[0].semanticParse, undefined);
  assert.doesNotMatch(serialized, /RAW_DOCUMENT_END/);
  assert.doesNotMatch(serialized, /SEMANTIC_PARSE_SHOULD_NOT_SURVIVE/);
  assert.deepEqual(sanitized.documents[0].indexedChunkIds, ['chunk-1', 'chunk-2']);
});

test('uploaded evidence conversation payload contains metadata only', () => {
  const payload = loadConversationPayloadModule();
  const longRawText = `UPLOAD_RAW_START ${'y'.repeat(1600)} UPLOAD_RAW_END`;
  const sanitized = payload.sanitizeUploadedEvidenceForConversationPayload([
    {
      evidenceId: 'UP-01',
      title: 'Evidence pack',
      fileName: 'evidence.pdf',
      sizeBytes: 30 * 1024 * 1024,
      extractionStatus: 'backend_parsed',
      documentType: 'dpa',
      summary: 'Signed DPA and retention terms are available.',
      excerpt: 'Retention clause excerpt.',
      text: longRawText,
      rawText: longRawText,
      semanticParse: { raw: 'UPLOAD_SEMANTIC_PARSE_SHOULD_NOT_SURVIVE' },
      signals: ['DPA'],
      indexedChunkIds: ['UP-01:1']
    }
  ]);
  const serialized = JSON.stringify(sanitized);

  assert.deepEqual(Object.keys(sanitized[0]).sort(), [
    'documentType',
    'evidenceId',
    'excerpt',
    'extractionStatus',
    'fileName',
    'indexedChunkIds',
    'signals',
    'sizeBytes',
    'summary',
    'title'
  ]);
  assert.doesNotMatch(serialized, /UPLOAD_RAW_/);
  assert.doesNotMatch(serialized, /UPLOAD_SEMANTIC_PARSE_SHOULD_NOT_SURVIVE/);
});

test('run-request payload carries only durable identity, version, and index metadata', () => {
  const payload = loadConversationPayloadModule();
  const sensitive = `SENSITIVE_PRIOR_PROSE ${'x'.repeat(4000)}`;
  const sanitized = payload.sanitizeRunRequestDraftForConversationPayload({
    caseId: 'case_compact_run_001',
    caseVersion: 7,
    currentEventType: 'user_answer',
    supplierName: 'Sensitive Supplier',
    brief: sensitive,
    llmIntake: { naturalResponse: sensitive },
    retrievalContext: { matches: [{ text: sensitive }] },
    documents: [{ evidenceId: 'DOC-01', text: sensitive }],
    indexedEvidence: {
      caseId: 'case_compact_run_001',
      model: 'text-embedding-3-large',
      storage: 'server_side_qdrant_vector_db',
      provider: 'qdrant',
      updatedAt: '2026-07-12T00:00:00.000Z',
      chunkCount: 2,
      evidenceIds: ['DOC-01'],
      chunkIds: ['chunk-1', 'chunk-2'],
      browserEmbeddingsRetained: false
    }
  });
  const serialized = JSON.stringify(sanitized);

  assert.deepEqual(Object.keys(sanitized).sort(), ['caseId', 'caseVersion', 'currentEventType', 'indexedEvidence']);
  assert.equal(sanitized.caseVersion, 7);
  assert.equal(sanitized.indexedEvidence.chunkCount, 2);
  assert.doesNotMatch(serialized, /SENSITIVE_PRIOR_PROSE|Sensitive Supplier/);
  assert.equal(serialized.length < 800, true);
});

test('council narrative request omits specialist trace and source excerpts', () => {
  const payload = loadConversationPayloadModule();
  const sensitive = `SENSITIVE_COUNCIL_TRACE ${'z'.repeat(5000)}`;
  const sanitized = payload.sanitizeCouncilNarrativeRequestPayload({
    ok: true,
    case: {
      supplierName: 'Compact Supplier',
      businessUnit: 'Procurement',
      geography: 'UAE',
      integrations: ['ServiceNow'],
      documents: [{ title: 'Signed MSA', text: sensitive }]
    },
    decision: {
      recommendation: 'Do not proceed yet',
      status: 'not_ready',
      readinessScore: 0.32,
      humanApprovalRequired: true
    },
    evidenceQuality: { status: 'strong', score: 0.8, raw: sensitive },
    gaps: [{ gap: 'signed DPA', severity: 'high', action: 'Obtain the signed DPA.', raw: sensitive }],
    domains: [{ label: 'Privacy', status: 'blocked', score: 0.4, raw: sensitive }],
    trace: [{ detail: sensitive }],
    specialistAssessments: [{ output: sensitive }]
  });
  const serialized = JSON.stringify(sanitized);

  assert.deepEqual(sanitized.evidenceTitles, ['Signed MSA']);
  assert.equal(sanitized.gaps[0].gap, 'signed DPA');
  assert.doesNotMatch(serialized, /SENSITIVE_COUNCIL_TRACE|specialistAssessments|trace/);
  assert.equal(serialized.length < 1800, true);
});
