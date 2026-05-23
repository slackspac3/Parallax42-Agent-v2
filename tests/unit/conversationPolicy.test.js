'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  filterRepeatedQuestions,
  questionsForDraft
} = require('../../lib/conversationPolicy');

test('high-confidence LLM nextBestQuestion passes through policy unchanged', () => {
  const llmQuestion = 'For this Managed Platform Integration Services Agreement, should I focus first on privacy, privileged access, commercial terms, or all material risks?';
  const draft = {
    conversationPlan: {
      usedLlm: true,
      confidence: 0.86,
      nextQuestion: llmQuestion
    },
    llmIntake: {
      used: true,
      requestType: 'agreement_review',
      workflowType: 'contract_risk_review',
      confidence: 0.86,
      nextBestQuestion: llmQuestion
    },
    currentEventType: 'evidence_uploaded',
    supplierName: 'Managed Platform Integration Services Agreement',
    knownGaps: [],
    askedQuestions: [],
    documents: [{
      title: 'Managed Platform Integration Services Agreement',
      documentType: 'agreement',
      extractionStatus: 'backend_parsed'
    }]
  };
  const deterministicSequence = [
    'Who is the accountable business unit or workflow owner?',
    'Which geography or regulatory perimeter applies, for example UAE, KSA, Abu Dhabi, or global?'
  ];

  assert.deepEqual(questionsForDraft(draft, ['business_owner', 'geography']), [llmQuestion]);
  assert.deepEqual(filterRepeatedQuestions(deterministicSequence, draft, {}), [llmQuestion]);
});

test('high-confidence LLM nextBestQuestion is only deduplicated against askedQuestions', () => {
  const llmQuestion = 'Should I focus first on privacy, privileged access, commercial terms, or all material risks?';
  const draft = {
    conversationPlan: {
      usedLlm: true,
      confidence: 0.91,
      nextQuestion: llmQuestion
    },
    askedQuestions: [llmQuestion]
  };

  assert.deepEqual(questionsForDraft(draft, ['business_owner', 'geography']), []);
  assert.deepEqual(filterRepeatedQuestions(['Who is the accountable business unit or workflow owner?'], draft, {}), []);
});
