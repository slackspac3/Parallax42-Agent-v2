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

test('conversation preserves indexed retrieval context through council execution', () => {
  const result = processConversation({
    forceRun: true,
    message: 'run it',
    caseDraft: {
      caseId: 'case-retrieval-1',
      supplierName: 'HelioChip Logistics',
      businessUnit: 'Trade Compliance And Export Controls',
      geography: 'UAE',
      brief: 'Review restricted AI accelerator import with freight forwarding and remote firmware support.',
      integrations: ['Firmware support channel'],
      documents: [
        {
          evidenceId: 'DOC-IMPORT-01',
          title: 'Chip import agreement',
          extractionStatus: 'backend_parsed',
          indexStatus: 'indexed',
          summary: 'Classification pending and no final end-use certificate.'
        }
      ],
      indexedEvidence: {
        model: 'text-embedding-3-large',
        chunkCount: 9
      },
      retrievalContext: {
        query: 'export classification end-use certificate import permit firmware access',
        model: 'text-embedding-3-large',
        chunkCount: 9,
        matchCount: 1,
        matches: [
          {
            chunkId: 'chk_export_1',
            evidenceId: 'DOC-IMPORT-01',
            title: 'Chip import agreement',
            score: 0.9,
            text: 'End-use certificate is pending and import permit is not attached.'
          }
        ]
      },
      evidenceSignals: ['export classification'],
      riskSignals: ['export control', 'remote support access']
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.run.ok, true);
  assert.equal(result.nlp.retrieval.matches, 1);
  assert.ok(result.actions.some((action) => action.id === 'evidence_retrieval' && action.status === 'complete'));
  assert.ok(result.run.citations.some((citation) => citation.citationId === 'chk_export_1'));
});

test('conversation NLP resolves short owner and geography follow-up answers', () => {
  const result = processConversation({
    message: 'The head of it is responsible. Its geography is UAE',
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      brief: 'Review uploaded MSA, SOW, DPA, SaaS license, and service contract evidence for an enterprise platform.',
      documents: [
        {
          evidenceId: 'UP-01',
          title: 'Enterprise SaaS master services agreement',
          extractionStatus: 'backend_parsed',
          summary: 'Signed DPA, retention schedule, model-training exclusion, continuity and exit plan, and least-privilege access approval are available.',
          signals: ['DPA', 'retention and deletion', 'model training terms', 'BCP/DR', 'identity and access']
        }
      ],
      evidenceSignals: ['DPA', 'retention and deletion', 'model training terms', 'BCP/DR', 'identity and access'],
      riskSignals: ['personal data', 'AI/model use', 'critical service', 'privileged access']
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.businessUnit, 'Head of IT');
  assert.equal(result.caseDraft.geography, 'UAE');
  assert.ok(!result.missingFields.includes('business_owner'));
  assert.ok(!result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
  assert.match(result.reply, /Owner: Head of IT/i);
});

test('conversation NLP handles export-control hardware import cases', () => {
  const result = processConversation({
    message: 'Review an AI accelerator import for UAE and Singapore. The supplier will ship restricted hardware, provide firmware support, and has no final end-use certificate.'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.businessUnit, 'Trade Compliance And Export Controls');
  assert.equal(result.caseDraft.geography, 'UAE');
  assert.ok(result.caseDraft.integrations.includes('Firmware support channel'));
  assert.ok(result.caseDraft.riskSignals.includes('export control'));
  assert.ok(result.caseDraft.riskSignals.includes('remote support access'));
  assert.ok(!result.caseDraft.riskSignals.includes('AI/model use'));
  assert.ok(!result.caseDraft.evidenceSignals.includes('end-use certificate'));
  assert.ok(result.missingFields.includes('export_control_evidence'));
  assert.ok(result.questions.some((question) => /classification|end-use|import permit|denied-party/i.test(question)));
});
