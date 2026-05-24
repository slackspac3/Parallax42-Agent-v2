'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEvidenceIndexRestoreModule() {
  const window = { P42ModuleRegistry: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'modules', 'evidenceIndexRestore.js'), 'utf8');
  vm.runInNewContext(source, { window });
  return window.P42ModuleRegistry.evidenceIndexRestore;
}

test('restored evidence index validation clears metadata on empty search result', () => {
  const restore = loadEvidenceIndexRestoreModule();
  const result = restore.reconcileRestoredEvidenceIndexValidation({
    meta: {
      caseId: 'case-expired',
      chunkCount: 12,
      provider: 'local_file'
    },
    draft: {
      caseId: 'case-expired',
      supplierName: 'Expired Evidence Supplier',
      indexedEvidence: {
        caseId: 'case-expired',
        chunkCount: 12
      }
    },
    response: {
      index: { caseId: 'case-expired', chunkCount: 0 },
      matches: []
    }
  });

  assert.equal(result.validation.status, 'expired');
  assert.equal(result.shouldClearStorage, true);
  assert.equal(Object.keys(result.evidenceIndexMeta).length, 0);
  assert.equal(result.chatCaseDraft.indexedEvidence, undefined);
  assert.equal(result.warning, restore.EXPIRED_INDEX_WARNING);
});

test('restored evidence index validation keeps metadata when search finds chunks', () => {
  const restore = loadEvidenceIndexRestoreModule();
  const meta = {
    caseId: 'case-valid',
    chunkCount: 8,
    provider: 'qdrant'
  };
  const draft = {
    caseId: 'case-valid',
    indexedEvidence: meta
  };
  const result = restore.reconcileRestoredEvidenceIndexValidation({
    meta,
    draft,
    response: {
      index: { caseId: 'case-valid', chunkCount: 8 },
      matches: [{ evidenceId: 'DOC-1', chunkId: 'DOC-1:1', text: 'available' }]
    }
  });

  assert.equal(result.validation.status, 'valid');
  assert.equal(result.shouldClearStorage, false);
  assert.equal(result.evidenceIndexMeta, meta);
  assert.equal(result.chatCaseDraft, draft);
});
