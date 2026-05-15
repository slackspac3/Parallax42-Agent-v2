'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { processConversation } = require('../../lib/conversationAgent');

test('conversation NLP normalizes supplier names with leading articles', () => {
  const result = processConversation({
    message: 'Assess an AI SaaS supplier processing employee data with Azure AD access, SOC 2 evidence, no signed DPA, and no continuity plan.'
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.supplierName, 'AI SaaS');
  assert.ok(!result.caseDraft.supplierName.startsWith('n '));
  assert.ok(result.caseDraft.evidenceSignals.includes('SOC 2'));
  assert.ok(!result.caseDraft.evidenceSignals.includes('DPA'));
  assert.ok(!result.caseDraft.evidenceSignals.includes('BCP/DR'));
});

test('conversation NLP extracts a draft and asks contextual follow-up questions', () => {
  const result = processConversation({
    message: 'We are considering an AI SaaS vendor. It processes employee personal data and integrates with Azure AD. SOC 2 is available but no DPA yet.'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'conversation_nlp');
  assert.equal(result.caseDraft.geography, '');
  assert.equal(result.caseDraft.businessUnit, 'Group Technology Risk');
  assert.ok(result.caseDraft.integrations.includes('Azure AD'));
  assert.ok(result.caseDraft.riskSignals.includes('personal data'));
  assert.ok(result.questions.some((question) => /geography|regulatory perimeter|UAE/i.test(question)));
  assert.equal(result.run, null);
});

test('conversation executes the agent workflow when the draft is complete', () => {
  const result = processConversation({
    forceRun: true,
    message: 'run it',
    caseDraft: {
      supplierName: 'Example AI SaaS',
      businessUnit: 'Group Technology Risk',
      geography: 'UAE',
      brief: 'Procure a critical AI SaaS supplier that processes personal data, uses AI workflows, integrates with Azure AD, and supports finance reporting.',
      integrations: ['Azure AD', 'Finance reporting'],
      documents: [
        {
          evidenceId: 'CHAT-01',
          title: 'Conversational intake evidence',
          summary: 'SOC 2 available. No signed DPA, no model-training exclusion, and no continuity plan attached.',
          signals: ['SOC 2']
        }
      ],
      evidenceSignals: ['SOC 2'],
      riskSignals: ['personal data', 'AI/model use', 'critical service', 'finance exposure']
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.readyToRun, true);
  assert.equal(result.run.ok, true);
  assert.equal(result.run.decision.status, 'not_ready');
  assert.ok(result.actions.some((action) => action.id === 'agent_workflow' && action.status === 'complete'));
  assert.match(result.reply, /Decision:/i);
});
