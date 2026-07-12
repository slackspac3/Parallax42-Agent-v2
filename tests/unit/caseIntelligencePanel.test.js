'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPanel() {
  const window = {
    P42ModuleRegistry: {
      text: {
        cleanText: (value = '') => String(value || '').replace(/\s+/g, ' ').trim(),
        unique: (values = []) => Array.from(new Set(values))
      }
    }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'modules', 'caseIntelligencePanel.js'), 'utf8');
  vm.runInNewContext(source, { window });
  return window.P42ModuleRegistry.caseIntelligencePanel;
}

test('case intelligence labels evidence questions as unverified and keeps proof missing', () => {
  const panel = loadPanel();
  const draft = {
    brief: 'Review a UAE supplier that provides managed operations services.',
    businessUnit: 'Operations',
    geography: 'UAE',
    documents: [{
      evidenceId: 'CHAT-01',
      provenance: 'chat_message',
      assertionState: 'requested',
      summary: 'Is SOC 2 evidence available?'
    }],
    evidenceSignals: ['SOC 2']
  };

  assert.equal(panel.usableEvidenceCount(draft), 0);
  assert.equal(panel.evidenceStatusSummary({ draft }), '1 evidence request noted · not verified');
  assert.ok(panel.missingProofItems({ draft }).includes('Evidence proof'));
});

test('case intelligence rejects trailing questions from uploaded and retrieval evidence', () => {
  const panel = loadPanel();
  const uploadedQuestion = {
    brief: 'Review supplier onboarding evidence.',
    businessUnit: 'Procurement',
    geography: 'UAE',
    documents: [{
      evidenceId: 'UPLOAD-Q-1',
      provenance: 'uploaded_document',
      assertionState: 'verified',
      extractionStatus: 'text_extracted',
      summary: 'Signed contract available?'
    }]
  };
  const retrievedQuestion = {
    ...uploadedQuestion,
    documents: [],
    retrievalContext: {
      matches: [{
        evidenceId: 'RET-Q-1',
        assertionState: 'verified',
        text: 'Signed contract available?'
      }]
    }
  };

  assert.equal(panel.usableEvidenceCount(uploadedQuestion), 0);
  assert.equal(panel.usableEvidenceCount(retrievedQuestion), 0);
  assert.match(panel.evidenceStatusSummary({ draft: uploadedQuestion }), /request.*not verified/i);
  assert.match(panel.evidenceStatusSummary({ draft: retrievedQuestion }), /request.*not verified/i);
  assert.ok(panel.missingProofItems({ draft: retrievedQuestion }).includes('Evidence proof'));
});

test('case intelligence requires evidence-bearing parsed text and rejects metadata-only files', () => {
  const panel = loadPanel();
  const parsed = {
    documents: [{
      provenance: 'uploaded_document',
      assertionState: 'parsed',
      extractionStatus: 'text_extracted',
      fileName: 'signed-dpa.pdf',
      summary: 'The signed DPA documents retention, deletion assistance, and subprocessor controls.'
    }]
  };
  const blankParsed = {
    documents: [{
      provenance: 'uploaded_document',
      assertionState: 'parsed',
      extractionStatus: 'text_extracted',
      fileName: 'blank.pdf'
    }]
  };
  const metadataOnly = {
    documents: [{
      provenance: 'uploaded_document',
      assertionState: 'provided',
      extractionStatus: 'binary_registered',
      fileName: 'supplier-agreement.pdf'
    }]
  };

  assert.equal(panel.usableEvidenceCount(parsed), 1);
  assert.equal(panel.evidenceStatusSummary({ draft: parsed }), '1 usable evidence item');
  assert.equal(panel.usableEvidenceCount(blankParsed), 0);
  assert.equal(panel.evidenceStatusSummary({ draft: blankParsed }), '1 parsed or attached item · validation pending');
  assert.equal(panel.usableEvidenceCount(metadataOnly), 0);
  assert.match(panel.evidenceStatusSummary({ draft: metadataOnly }), /not verified/);
});
