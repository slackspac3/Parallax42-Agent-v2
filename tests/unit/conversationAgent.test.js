'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { processConversation } = require('../../lib/conversationAgent');
const { indexEvidenceServerSide } = require('../../lib/evidenceVectorStore');
const { recordReviewerFeedback } = require('../../lib/learningMemory');
const { enrichConversationWithServerRetrieval } = require('../../lib/serverSideRetrieval');

function withEnv(overrides, fn) {
  const snapshot = {};
  for (const key of Object.keys(overrides)) {
    snapshot[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        if (snapshot[key] === undefined) delete process.env[key];
        else process.env[key] = snapshot[key];
      }
    });
}

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

test('conversation handles payroll outsourcing without inventing an owner', () => {
  const first = processConversation({
    message: 'I have a request to omboard a vendor for payroll outsource'
  }, { runtime: 'deterministic' });

  assert.equal(first.ok, true);
  assert.equal(first.caseDraft.businessUnit, '');
  assert.ok(first.caseDraft.integrations.includes('Payroll/HRIS'));
  assert.ok(first.caseDraft.riskSignals.includes('personal data'));
  assert.ok(first.caseDraft.riskSignals.includes('finance exposure'));
  assert.ok(!/Procurement And Third-Party Risk/i.test(first.reply));
  assert.ok(first.questions.some((question) => /HR\/People|Finance\/Payroll|Procurement/i.test(question)));

  const second = processConversation({
    message: 'Its for a Abu Dhabi based company but the supplier is in India',
    caseDraft: first.caseDraft
  }, { runtime: 'deterministic' });

  assert.equal(second.caseDraft.businessUnit, '');
  assert.equal(second.caseDraft.geography, 'UAE and India');
  assert.ok(second.questions.some((question) => /HR\/People|Finance\/Payroll|Procurement/i.test(question)));
  assert.ok(!second.questions.some((question) => /What payroll-vendor proof/i.test(question)));
});

test('conversation handles plain payroll outsourcing intake with a practical owner question', () => {
  const result = processConversation({
    message: 'I have a request to outsource payroll to a third party'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.businessUnit, '');
  assert.ok(result.caseDraft.integrations.includes('Payroll/HRIS'));
  assert.ok(result.caseDraft.riskSignals.includes('personal data'));
  assert.ok(result.caseDraft.riskSignals.includes('finance exposure'));
  assert.ok(result.caseDraft.riskSignals.includes('outsourced service'));
  assert.ok(result.questions.some((question) => /payroll outsourcing risk internally|HR\/People|Finance\/Payroll/i.test(question)));
  assert.ok(!/Procurement And Third-Party Risk/i.test(result.reply));
});

test('conversation does not repeat payroll owner question after terse HR answer', () => {
  const first = processConversation({
    message: 'I have a request to outsource payroll'
  }, { runtime: 'deterministic' });

  assert.ok(first.questions.some((question) => /payroll outsourcing risk internally|HR\/People/i.test(question)));

  const second = processConversation({
    message: 'HR',
    caseDraft: first.caseDraft
  }, { runtime: 'deterministic' });

  assert.equal(second.caseDraft.businessUnit, 'HR');
  assert.ok(!second.questions.some((question) => /payroll outsourcing risk internally|HR\/People/i.test(question)));
  assert.ok(second.questions.some((question) => /geography|regulatory perimeter/i.test(question)));

  const third = processConversation({
    message: 'UAE, the vendor is based in India',
    caseDraft: second.caseDraft
  }, { runtime: 'deterministic' });

  assert.equal(third.caseDraft.businessUnit, 'HR');
  assert.equal(third.caseDraft.geography, 'UAE and India');
  assert.ok(!third.questions.some((question) => /payroll outsourcing risk internally|HR\/People/i.test(question)));
  assert.ok(third.questions.some((question) => /DPA|payroll-vendor proof|contract|SOC 2|ISO 27001/i.test(question)));
});

test('conversation asks payroll-specific evidence after owner and geography are known', () => {
  const result = processConversation({
    message: 'Finance Payroll owns it',
    caseDraft: {
      supplierName: 'Payroll outsourcing vendor',
      brief: 'Review payroll outsourcing vendor for employee payroll data processed by a supplier in India for an Abu Dhabi company.',
      geography: 'UAE and India',
      integrations: ['Payroll/HRIS'],
      riskSignals: ['personal data', 'finance exposure', 'outsourced service'],
      questions: ['Who will own this payroll outsourcing risk internally: HR/People, Finance/Payroll, Procurement, or another named team?']
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.businessUnit, 'Finance Payroll');
  assert.ok(result.questions.some((question) => /payroll-vendor proof|contract or SOW|DPA/i.test(question)));
  assert.match(result.reply, /payroll outsourcing/i);
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

test('conversation NLP does not swallow geography label into accountable owner', () => {
  const result = processConversation({
    message: 'Review an AI chip import for Zenith Compute. The accountable owner is Infrastructure Procurement. Geography is UAE and KSA. The shipment includes accelerator cards, remote firmware support, freight forwarding, and no final end-use certificate yet.'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.businessUnit, 'Infrastructure Procurement');
  assert.equal(result.caseDraft.geography, 'UAE and KSA');
  assert.ok(result.caseDraft.riskSignals.includes('export control'));
  assert.ok(!result.caseDraft.riskSignals.includes('AI/model use'));
  assert.equal(result.runReadiness.runnable, false);
  assert.ok(result.runReadiness.executionBlockers.includes('evidence'));
});

test('conversation NLP handles export-control hardware import cases', () => {
  const result = processConversation({
    message: 'Review an AI accelerator import for UAE and Singapore. The supplier will ship restricted hardware, provide firmware support, and has no final end-use certificate.'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.businessUnit, 'Trade Compliance And Export Controls');
  assert.equal(result.caseDraft.geography, 'UAE and Singapore');
  assert.ok(result.caseDraft.integrations.includes('Firmware support channel'));
  assert.ok(result.caseDraft.riskSignals.includes('export control'));
  assert.ok(result.caseDraft.riskSignals.includes('remote support access'));
  assert.ok(!result.caseDraft.riskSignals.includes('AI/model use'));
  assert.ok(!result.caseDraft.evidenceSignals.includes('end-use certificate'));
  assert.ok(result.missingFields.includes('export_control_evidence'));
  assert.ok(result.questions.some((question) => /classification|end-use|import permit|denied-party/i.test(question)));
});

test('conversation run readiness allows council with core intake while preserving advisory gaps', () => {
  const result = processConversation({
    message: 'Review an AI accelerator import for UAE. The accountable owner is Trade Compliance. Attached export classification, end-use certificate, import permit, MFA, session logging, and approved support window.',
    caseDraft: {
      supplierName: 'Zenith Compute'
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.runReadiness.runnable, true);
  assert.deepEqual(result.runReadiness.executionBlockers, []);
  assert.ok(!result.missingFields.includes('remote_support_controls'));
});

test('conversation records unknown terse answers as known gaps without repeating the same question', () => {
  const first = processConversation({
    message: 'Review a healthcare analytics workflow in UAE that processes patient data. SOC 2 is available.',
    caseDraft: {
      askedQuestions: ['Who is the accountable business unit or workflow owner?'],
      questions: ['Who is the accountable business unit or workflow owner?']
    }
  }, { runtime: 'deterministic' });
  const second = processConversation({
    message: 'not sure',
    caseDraft: first.caseDraft
  }, { runtime: 'deterministic' });

  assert.ok(second.caseDraft.knownGaps.includes('business_owner'));
  assert.ok(!second.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
  assert.match(second.reply, /known gap|recorded/i);
});

test('conversation asks to upload a generic agreement before demanding owner metadata', () => {
  const result = processConversation({
    message: 'I want to review an agreement'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.ok(result.questions.some((question) => /upload the agreement|analyze it first/i.test(question)));
  assert.ok(!result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
  assert.match(result.reply, /agreement review|analyze the agreement first/i);
  assert.equal(result.nlp.requestProfile.conversationStage, 'awaiting_document');
});

test('conversation classifies MSA review and asks for source upload before metadata', () => {
  const result = processConversation({
    message: 'Can you review an MSA for risky data processing obligations?'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.nlp.requestProfile.requestType, 'msa_review');
  assert.equal(result.nlp.requestProfile.reviewTarget, 'MSA');
  assert.ok(result.questions.some((question) => /upload the MSA|analyze it first/i.test(question)));
  assert.ok(!result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
});

test('conversation classifies clause review and asks for pasted clauses or document upload', () => {
  const result = processConversation({
    message: 'Can you review these termination and liability clauses?'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.nlp.requestProfile.requestType, 'clause_review');
  assert.ok(result.questions.some((question) => /paste the clauses|upload the source document/i.test(question)));
  assert.ok(!result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
  assert.match(result.reply, /specific clauses review|source material/i);
});

test('conversation uses Compass request type to plan clause review intake', () => {
  const result = processConversation({
    message: 'Please look at this.',
    caseDraft: {
      brief: 'Please look at this.',
      llmIntake: {
        provider: 'compass_gateway',
        model: 'gpt-5.1',
        advisoryOnly: true,
        used: true,
        confidence: 0.88,
        intent: 'case_context',
        requestType: 'clause_review',
        reviewTarget: 'termination clauses',
        reviewScope: 'contract termination rights',
        recommendedFirstAction: 'paste_clause',
        conversationStage: 'awaiting_document',
        assistantSummary: 'This is a clause review and I need the clauses first.'
      }
    },
    llmAssessment: {
      provider: 'compass_gateway',
      model: 'gpt-5.1',
      used: true,
      advisoryOnly: true,
      intent: 'case_context',
      requestType: 'clause_review',
      reviewTarget: 'termination clauses',
        reviewScope: 'contract termination rights',
        recommendedFirstAction: 'paste_clause',
        conversationStage: 'awaiting_document',
        assistantSummary: 'This is a clause review and I need the clauses first.',
        confidence: 0.88,
        reason: 'The user wants specific clauses reviewed.'
      }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.nlp.requestProfile.source, 'compass');
  assert.equal(result.nlp.requestProfile.requestType, 'clause_review');
  assert.equal(result.nlp.requestProfile.conversationStage, 'awaiting_document');
  assert.equal(result.nlp.llmAssessment.requestType, 'clause_review');
  assert.ok(result.questions.some((question) => /paste the clauses|upload the source document/i.test(question)));
});

test('conversation does not force document upload for plain vendor onboarding without document intent', () => {
  const result = processConversation({
    message: 'I want to onboard a payroll vendor'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.nlp.requestProfile.requestType, 'payroll_outsourcing');
  assert.ok(!result.questions.some((question) => /upload|paste the clauses|source document/i.test(question)));
  assert.ok(result.questions.some((question) => /payroll outsourcing risk internally|HR\/People|Finance\/Payroll/i.test(question)));
});

test('conversation keeps document reviews focused on source upload through repeated unknown answers', () => {
  const first = processConversation({
    message: 'I want to review an agreement'
  }, { runtime: 'deterministic' });

  assert.ok(first.questions.some((question) => /upload the agreement/i.test(question)));

  const second = processConversation({
    message: 'Dont know',
    caseDraft: first.caseDraft
  }, { runtime: 'deterministic' });

  assert.ok(second.caseDraft.knownGaps.includes('evidence'));
  assert.ok(second.questions.some((question) => /what should I focus on|privacy\/data terms|liability|all risks/i.test(question)));
  assert.ok(!second.questions.some((question) => /accountable business unit|workflow owner|business owner/i.test(question)));
  assert.match(second.reply, /agreement source as pending|upload the agreement|source document/i);

  const third = processConversation({
    message: 'dont know',
    caseDraft: second.caseDraft
  }, { runtime: 'deterministic' });

  assert.ok(third.caseDraft.knownGaps.includes('evidence'));
  assert.ok(third.caseDraft.knownGaps.includes('review_focus'));
  assert.ok(!third.caseDraft.knownGaps.includes('business_owner'));
  assert.equal(third.questions.length, 0);
  assert.ok(!third.questions.some((question) => /accountable business unit|workflow owner|business owner|geography|regulatory perimeter/i.test(question)));
  assert.doesNotMatch(third.reply, /agreement document .* using the supplied document evidence/i);

  const fourth = processConversation({
    message: 'dont know',
    caseDraft: third.caseDraft
  }, { runtime: 'deterministic' });

  assert.ok(fourth.caseDraft.knownGaps.includes('evidence'));
  assert.ok(!fourth.caseDraft.knownGaps.includes('business_owner'));
  assert.ok(!fourth.caseDraft.knownGaps.includes('geography'));
  assert.equal(fourth.questions.length, 0);
});

test('conversation does not repeat stale document evidence summary after unknown agreement answers', () => {
  const first = processConversation({
    message: 'I want an agreement reviewed',
    caseDraft: {
      indexedEvidence: { chunkCount: 4 },
      retrievalContext: {
        evidenceMatches: [{ title: 'Previously indexed evidence', score: 0.82 }]
      },
      documents: [{
        evidenceId: 'UP-01',
        title: 'Previously uploaded agreement.pdf',
        indexStatus: 'indexed',
        extractionStatus: 'backend_parsed'
      }]
    }
  }, { runtime: 'deterministic' });

  assert.match(first.reply, /attached source evidence/i);

  const second = processConversation({
    message: 'dont know',
    caseDraft: first.caseDraft
  }, { runtime: 'deterministic' });
  const third = processConversation({
    message: 'dont know',
    caseDraft: second.caseDraft
  }, { runtime: 'deterministic' });

  assert.match(second.reply, /recorded business owner as a known gap/i);
  assert.match(third.reply, /recorded geography as a known gap/i);
  assert.doesNotMatch(second.reply, /using the supplied document evidence/i);
  assert.doesNotMatch(third.reply, /using the supplied document evidence/i);
});

test('conversation normalizes AI-provided known-gap labels before planning questions', () => {
  const result = processConversation({
    message: 'dont know',
    caseDraft: {
      supplierName: 'agreement',
      brief: 'I want to review an agreement',
      knownGaps: ['business owner'],
      questions: ['Which geography or regulatory perimeter applies, for example UAE, KSA, Abu Dhabi, or global?']
    },
    llmAssessment: {
      provider: 'compass_gateway',
      model: 'gpt-5.1',
      used: true,
      advisoryOnly: true,
      intent: 'unknown',
      confidence: 0.8,
      reason: 'User does not know the answer.'
    }
  }, { runtime: 'deterministic' });

  assert.ok(result.caseDraft.knownGaps.includes('business_owner'));
  assert.ok(result.caseDraft.knownGaps.includes('geography'));
  assert.ok(!result.questions.some((question) => /business owner|accountable business unit|workflow owner|geography|regulatory perimeter/i.test(question)));
});

test('conversation prevents repeated questions and asks one next best question at a time', () => {
  const result = processConversation({
    message: 'Assess a vendor with patient data and SOC 2 evidence.',
    caseDraft: {
      askedQuestions: ['Who is the accountable business unit or workflow owner?']
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.questions.length <= 1, true);
  assert.ok(!result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
});

test('server-side conversation enrichment searches indexed evidence before evidence follow-up', async () => {
  const originalFetch = global.fetch;
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-conversation-pre-question-'));
  try {
    await withEnv({
      COMPASS_GATEWAY_BASE_URL: 'https://gateway.example/api',
      COMPASS_GATEWAY_TOKEN: 'test-token',
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_VECTOR_STORE_DIR: storeDir,
      P42_LEARNING_MEMORY_DIR: storeDir,
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      global.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (url.endsWith('/evidence/index')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              ok: true,
              context: { caseId: body.caseId, workspaceId: body.workspaceId, projectId: body.projectId },
              chunking: { chunkCount: 1 },
              chunks: [{
                chunkId: 'chk_patient_dpa',
                evidenceId: 'DOC-DPA',
                title: 'Healthcare DPA',
                text: 'Signed DPA covers patient data, retention, subprocessors, and deletion assistance.',
                embedding: [0.1, 0.2]
              }]
            })
          };
        }
        if (url.endsWith('/evidence/search')) {
          assert.equal(body.purpose, 'conversation_pre_question_retrieval');
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              ok: true,
              matches: [{
                chunkId: 'chk_patient_dpa',
                evidenceId: 'DOC-DPA',
                title: 'Healthcare DPA',
                text: 'Signed DPA covers patient data, retention, subprocessors, and deletion assistance.',
                score: 0.91
              }]
            })
          };
        }
        throw new Error(`Unexpected fetch ${url}`);
      };

      const index = await indexEvidenceServerSide({
        caseId: 'case-pre-question',
        documents: [{ evidenceId: 'DOC-DPA', text: 'Signed DPA covers patient data.' }]
      });
      const enriched = await enrichConversationWithServerRetrieval({
        message: 'what evidence do you need?',
        caseDraft: {
          caseId: 'case-pre-question',
          supplierName: 'Healthcare Analytics Vendor',
          businessUnit: 'Clinical Data Office',
          geography: 'UAE',
          brief: 'Assess patient data analytics vendor.',
          indexedEvidence: index.index
        }
      });

      assert.equal(enriched.caseDraft.retrievalContext.evidenceMatches.length, 1);
      const result = processConversation(enriched, { runtime: 'deterministic' });
      assert.match(result.reply, /evidence-memory match/i);
    });
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});

test('server-side conversation enrichment retrieves similar cases before council run', async () => {
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p42-conversation-learning-'));
  try {
    await withEnv({
      P42_VECTOR_STORE_PROVIDER: 'local_file',
      P42_LEARNING_MEMORY_DIR: storeDir,
      QDRANT_URL: '',
      P42_VECTOR_DB_URL: ''
    }, async () => {
      await recordReviewerFeedback({
        caseId: 'prior-case',
        reviewerNotes: 'Patient analytics vendor required signed DPA and data residency confirmation.',
        addedControls: ['Data residency confirmation'],
        missingEvidence: ['Signed DPA'],
        finalOutcome: 'Approved after controls'
      });
      const enriched = await enrichConversationWithServerRetrieval({
        forceRun: true,
        message: 'run it',
        caseDraft: {
          caseId: 'new-case',
          supplierName: 'Health Data Cloud',
          businessUnit: 'Clinical Data Office',
          geography: 'UAE',
          brief: 'Assess patient analytics vendor using cross-border cloud processing.',
          documents: [{ evidenceId: 'CHAT-01', summary: 'SOC 2 and DPA available.', signals: ['SOC 2', 'DPA'] }],
          evidenceSignals: ['SOC 2', 'DPA'],
          riskSignals: ['personal data', 'cross-border transfer']
        }
      });

      assert.equal(enriched.caseDraft.retrievalContext.similarCases.length > 0, true);
      assert.equal(enriched.caseDraft.retrievalContext.learningSuggestions.commonControlsReviewersAdded.length > 0, true);
    });
  } finally {
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});
