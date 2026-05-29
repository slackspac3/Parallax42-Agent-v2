'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEvidenceUploadUiModule() {
  const window = {
    P42ModuleRegistry: {
      text: {
        cleanText: (value = '') => String(value || '').replace(/\s+/g, ' ').trim(),
        humanize: (value = '') => String(value || '').replace(/[_-]+/g, ' '),
        escapeHtml: (value = '') => String(value || '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;')
      }
    }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'modules', 'evidenceUploadUi.js'), 'utf8');
  vm.runInNewContext(source, { window });
  return window.P42ModuleRegistry.evidenceUploadUi;
}

test('evidenceStatusLabel distinguishes sampled text from fully parsed evidence', () => {
  const evidenceUploadUi = loadEvidenceUploadUiModule();

  assert.equal(evidenceUploadUi.evidenceStatusLabel({ extractionStatus: 'sampled_text' }), 'sampled text');
  assert.equal(evidenceUploadUi.evidenceStatusLabel({ extractionStatus: 'backend_parsed' }), 'parsed');
  assert.equal(evidenceUploadUi.evidenceStatusLabel({ extractionStatus: 'text_extracted' }), 'parsed');
});
