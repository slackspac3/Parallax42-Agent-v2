'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runComplianceAgent } = require('../../lib/complianceAgent');
const { buildDecisionRoomModel } = require('../../lib/decisionRoomModel');
const { buildReviewPack } = require('../../lib/reviewPack');

test('decision room model presents business-first reviewer output', () => {
  const run = runComplianceAgent({
    businessUnit: 'HR and Payroll',
    geography: 'UAE and India',
    supplierName: 'Payroll Services Vendor',
    brief: 'Review payroll outsourcing agreement involving employee personal data and cross-border processing.',
    documents: [
      {
        evidenceId: 'DPA-01',
        title: 'Data processing addendum',
        summary: 'DPA includes retention commitments, subprocessor disclosure, breach notice, and India processing terms.',
        signals: ['signed DPA', 'retention schedule', 'subprocessor disclosure']
      }
    ]
  });

  const model = buildDecisionRoomModel(run);
  assert.equal(model.decision.humanApprovalRequired, true);
  assert.equal(model.decision.finalDecisionOwner, 'deterministic compliance engine');
  assert.ok(model.decision.memo.length > 20);
  assert.ok(model.why.length >= 1);
  assert.equal(model.agentFindings.length, 6);
  assert.ok(model.agentFindings.some((finding) => finding.name === 'Evidence Examiner'));
  assert.equal(model.agenticPairings.length, 4);
  assert.equal(model.autonomyModel.level, 'L2 governed loop with stops');
  assert.ok(model.agentLoopSpec.plan.length <= 5);
  assert.ok(model.agentLoopSpec.memory.some((lane) => lane.lane === 'Episodic log'));
  assert.ok(model.qualityRubric.totalScore >= 0);
  assert.equal(model.qualityRubric.threshold, 7);
  assert.ok(model.stopConditions.some((condition) => /Human approval/i.test(condition)));
  assert.ok(model.requiredHumanActions.length >= 1);
  assert.equal(model.metrics.evidenceIds, run.evidenceIds.length);
});

test('review pack embeds the decision room model for export consumers', () => {
  const run = runComplianceAgent({
    businessUnit: 'Trade Compliance',
    geography: 'UAE',
    supplierName: 'Import Vendor',
    brief: 'Review import agreement for restricted AI accelerator hardware.',
    documents: [
      {
        evidenceId: 'IMPORT-01',
        title: 'Import evidence pack',
        summary: 'End-use certificate, export classification, and freight forwarder screening are present.',
        signals: ['end-use certificate', 'export classification']
      }
    ]
  });

  const pack = buildReviewPack(run, { generatedAt: '2026-05-20T00:00:00.000Z' });
  assert.equal(pack.decisionRoom.decision.finalDecisionOwner, 'deterministic compliance engine');
  assert.equal(pack.decisionRoom.decision.humanApprovalRequired, true);
  assert.equal(pack.decisionRoom.agentFindings.length, 6);
  assert.equal(pack.agenticPairings.length, 4);
  assert.equal(pack.agentLoopSpec.autonomy.level, 'L2 governed loop with stops');
  assert.equal(pack.qualityRubric.scale, '0-9');
});
