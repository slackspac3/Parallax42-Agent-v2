'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDecisionRoom() {
  const window = {
    P42ModuleRegistry: {
      text: {
        cleanText: (value = '') => String(value || '').replace(/\s+/g, ' ').trim(),
        escapeHtml: (value = '') => String(value || ''),
        humanize: (value = '') => String(value || '').replace(/[_-]+/g, ' '),
        unique: (values = []) => Array.from(new Set(values))
      }
    }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'modules', 'decisionRoom.js'), 'utf8');
  vm.runInNewContext(source, { window });
  return window.P42ModuleRegistry.decisionRoom;
}

function result(approvalEligible) {
  return {
    case: { supplierName: 'Example supplier', documents: [] },
    decision: {
      status: approvalEligible ? 'ready' : 'conditionally_ready',
      recommendation: approvalEligible ? 'Ready for human approval' : 'Continue review with named controls',
      readinessScore: approvalEligible ? 0.88 : 0.72,
      humanApprovalRequired: true
    },
    decisionReadiness: { approvalEligible, requiredControls: [] },
    evidenceQuality: { status: 'usable' },
    gaps: approvalEligible ? [] : [{ severity: 'medium', gap: 'DPA proof', action: 'Attach signed DPA.' }],
    evidenceIds: [],
    citations: [],
    trace: []
  };
}

test('decision room never presents conditional approval as a reviewer outcome', () => {
  const room = loadDecisionRoom();
  const html = room.businessOutcomeHtml(result(false), {});

  assert.doesNotMatch(html, /Conditional approval|Approve after controls/i);
  assert.match(html, /Continue review — not approved/);
  assert.doesNotMatch(html, /option value="Approve"/);
});

test('decision room exposes approval memory only for an explicitly eligible run', () => {
  const room = loadDecisionRoom();
  const html = room.businessOutcomeHtml(result(true), {});

  assert.match(html, /option value="Approve">Approved after human sign-off/);
});
