'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { processConversation } = require('../../lib/conversationAgent');
const { SMART_INTAKE_DEGRADED_MESSAGE } = require('../../lib/conversationLlmAssessor');
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
  assert.equal(result.caseDraft.businessUnit, '');
  assert.ok(result.caseDraft.integrations.includes('Azure AD'));
  assert.ok(result.caseDraft.riskSignals.includes('personal data'));
  assert.ok(result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
  assert.ok(result.missingFields.includes('business_owner'));
  assert.ok(result.missingFields.includes('geography'));
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

test('conversation does not repeat a generic owner question after a terse owner answer', () => {
  const first = processConversation({
    message: 'Review a vendor that will process customer records and has SOC 2 evidence.',
    caseDraft: {
      documents: [{
        evidenceId: 'SOC2-01',
        extractionStatus: 'backend_parsed',
        summary: 'The uploaded SOC 2 report describes the vendor security control environment.'
      }]
    }
  }, { runtime: 'deterministic' });

  assert.ok(first.questions.some((question) => /accountable business unit|workflow owner|who.*own/i.test(question)));

  const second = processConversation({
    message: 'Head of IT',
    caseDraft: first.caseDraft
  }, { runtime: 'deterministic' });

  assert.equal(second.caseDraft.businessUnit, 'Head of IT');
  assert.ok(!second.questions.some((question) => /accountable business unit|workflow owner|who.*own/i.test(question)));
  assert.ok(second.questions.some((question) => /geography|regulatory perimeter/i.test(question)));
  assert.equal(second.caseDraft.recentlyAnsweredFields.business_owner, 2);

  const third = processConversation({
    message: 'The supplier is in India',
    caseDraft: second.caseDraft
  }, { runtime: 'deterministic' });

  assert.equal(third.caseDraft.businessUnit, 'Head of IT');
  assert.equal(third.caseDraft.geography, 'India');
  assert.ok(!third.questions.some((question) => /accountable business unit|workflow owner|who.*own/i.test(question)));
});

test('conversation uses activeQuestion to resolve a terse owner answer when rendered history is sparse', () => {
  const result = processConversation({
    message: 'Finance',
    eventType: 'user_answer',
    caseDraft: {
      brief: 'Review access reports during onboarding.',
      activeQuestion: 'Who is the accountable business owner for this case?',
      questions: [],
      askedQuestions: ['What do you need reviewed?'],
      conversationHistory: [
        { role: 'assistant', text: 'I added the evidence to the case.', displayedQuestion: 'Who is the accountable business owner for this case?' },
        { role: 'user', text: 'Finance', answeringQuestion: 'Who is the accountable business owner for this case?' }
      ]
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.businessUnit, 'Finance');
  assert.ok(!result.questions.some((question) => /business owner|accountable business unit|workflow owner/i.test(question)));
});

test('conversation reply uses Compass naturalResponse when available', () => {
  const naturalResponse = 'I’ll record Finance as the accountable owner for the access-report review. Which geography or regulatory perimeter should I apply?';
  const result = processConversation({
    message: 'Finance',
    eventType: 'user_answer',
    caseDraft: {
      brief: 'Review access reports during onboarding.',
      activeQuestion: 'Who is the accountable business owner for this case?',
      questions: ['Who is the accountable business owner for this case?']
    },
    llmAssessment: {
      provider: 'compass_gateway',
      model: 'gpt-5.1',
      used: true,
      advisoryOnly: true,
      intent: 'owner_answer',
      requestType: 'security_assurance_review',
      workflowType: 'security_assurance_review',
      recommendedFirstAction: 'ask_geography',
      conversationStage: 'asking_clarification',
      assistantSummary: 'Finance owns the access-report review.',
      nextBestQuestion: 'Which geography or regulatory perimeter should I apply?',
      naturalResponse,
      confidence: 0.91,
      caseUpdate: {
        businessUnit: 'Finance'
      }
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.reply, naturalResponse);
  assert.equal(result.nlp.llmAssessment.naturalResponse, naturalResponse);
});

test('conversation does not treat Finance as an owner when the active question is generic scope', () => {
  const result = processConversation({
    message: 'Finance',
    eventType: 'user_answer',
    caseDraft: {
      activeQuestion: 'What do you need reviewed?',
      questions: ['What do you need reviewed?'],
      askedQuestions: ['What do you need reviewed?'],
      conversationHistory: [
        { role: 'assistant', text: 'What do you need reviewed?', displayedQuestion: 'What do you need reviewed?' },
        { role: 'user', text: 'Finance', answeringQuestion: 'What do you need reviewed?' }
      ]
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.businessUnit, '');
  assert.match(result.caseDraft.brief, /Finance/i);
});

test('conversation preserves platform team as explicit owner after owner question', () => {
  const result = processConversation({
    message: 'Platform team',
    caseDraft: {
      brief: 'Assess a managed integration partner connecting Oracle ERP, Workday, ServiceNow, SharePoint, and Snowflake with privileged implementation access.',
      businessUnit: 'Group Technology Risk',
      geography: 'UAE',
      integrations: ['Oracle ERP', 'Workday', 'ServiceNow', 'SharePoint', 'Snowflake'],
      riskSignals: ['privileged access'],
      questions: ['Who is the accountable business unit or workflow owner?'],
      conversationHistory: [
        { role: 'assistant', text: 'Who is the accountable business unit or workflow owner?' },
        { role: 'user', text: 'Platform team' }
      ]
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.businessUnit, 'Platform Team');
  assert.ok(!result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
});

test('conversation resolves platform team from assistant history even after generic owner inference', () => {
  const result = processConversation({
    message: 'platform team',
    caseDraft: {
      brief: 'Review a platform integration partner with privileged implementation access.',
      businessUnit: 'Group Technology Risk',
      geography: 'UAE',
      conversationHistory: [
        { role: 'assistant', text: 'Who will own this review internally?' },
        { role: 'user', text: 'platform team' }
      ]
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.businessUnit, 'Platform Team');
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
      riskSignals: ['personal data', 'AI/model use', 'critical service', 'finance exposure'],
      aiUsageScope: {
        audience: 'internal_employees_only',
        taskBoundary: 'retrieval_or_document_assistance_only',
        excludedWorkflows: ['HR matters', 'compliance decisions', 'legal determinations', 'automated or people-impacting decisions']
      }
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.readyToRun, true);
  assert.equal(result.run.ok, true);
  assert.equal(result.run.decision.status, 'not_ready');
  assert.ok(result.actions.some((action) => action.id === 'agent_workflow' && action.status === 'complete'));
  assert.match(result.reply, /Decision:/i);
});

test('conversation blocks AI council until high-impact use boundary is validated', () => {
  let runCount = 0;
  const result = processConversation({
    forceRun: true,
    message: 'run it',
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'IT',
      geography: 'UAE and US',
      brief: 'Can we approve this AI assistant SOW for internal policy search and compliance evidence extraction?',
      documents: [
        {
          evidenceId: 'UP-01',
          title: 'Cloud AI Model Services Statement Of Work',
          extractionStatus: 'backend_parsed',
          indexStatus: 'indexed',
          summary: 'Private assistant, retrieval, document intelligence, policy Q&A, meeting summaries, and compliance evidence extraction.',
          signals: ['responsible-ai', 'model-governance', 'human-oversight']
        }
      ],
      evidenceSignals: ['model governance'],
      riskSignals: ['AI/model use', 'personal data']
    }
  }, {
    runtime: 'deterministic',
    runAgentWithRuntime: () => {
      runCount += 1;
      return { ok: true };
    }
  });

  assert.equal(runCount, 0);
  assert.equal(result.shouldRun, false);
  assert.equal(result.run, null);
  assert.equal(result.runReadiness.runnable, false);
  assert.ok(result.missingFields.includes('ai_usage_scope'));
  assert.ok(result.runReadiness.executionBlockers.includes('ai_usage_scope'));
  assert.ok(result.questions.some((question) => /HR\/employment|automated|decision affecting people/i.test(question)));
  assert.match(result.reply, /Before I run the council/i);
});

test('conversation force run is not blocked when smart intake is degraded and draft is runnable', () => {
  let runtimeCalls = 0;
  const result = processConversation({
    forceRun: true,
    message: 'run it',
    caseDraft: {
      caseId: 'case-degraded-run',
      supplierName: 'PayrollCo',
      businessUnit: 'HR',
      geography: 'UAE',
      brief: 'Payroll outsourcing supplier handling employee payroll data for UAE employees.',
      integrations: ['Payroll/HRIS'],
      documents: [
        {
          evidenceId: 'DOC-1',
          title: 'Signed DPA',
          summary: 'Signed DPA and SOC 2 report are available for review.',
          signals: ['DPA', 'SOC 2']
        }
      ],
      evidenceSignals: ['DPA', 'SOC 2'],
      riskSignals: ['personal data', 'outsourced service']
    },
    conversationPlan: {
      usedLlm: false,
      smartIntakeDegraded: true,
      userMessage: SMART_INTAKE_DEGRADED_MESSAGE,
      source: 'compass_degraded_fallback',
      shouldRunCouncil: true
    },
    llmAssessment: {
      provider: 'compass_gateway',
      used: false,
      smartIntakeDegraded: true,
      compassFailureType: 'rate_limit',
      reason: 'Compass gateway rate limited the smart intake request.',
      userMessage: SMART_INTAKE_DEGRADED_MESSAGE,
      attempts: [{ attempt: 1, status: 'rate_limited', httpStatus: 429 }],
      attemptCount: 1,
      maxAttempts: 3
    }
  }, {
    runtime: 'deterministic',
    runAgentWithRuntime: (casePayload) => {
      runtimeCalls += 1;
      return {
        ok: true,
        case: { caseId: casePayload.caseId },
        decision: {
          status: 'ready',
          recommendation: 'Ready for human approval',
          rationale: 'Injected runtime.'
        },
        gaps: [],
        evidenceIds: ['DOC-1'],
        trace: [],
        runtime: { actualRuntime: 'deterministic' }
      };
    }
  });

  assert.equal(runtimeCalls, 1);
  assert.equal(result.shouldRun, true);
  assert.equal(result.readyToRun, true);
  assert.equal(result.run.ok, true);
  assert.equal(result.caseDraft.smartIntakeDegraded, true);
  assert.ok(result.actions.some((action) => action.id === 'llm_intake_assessment' && action.status === 'degraded'));
  assert.ok(result.actions.some((action) => action.id === 'agent_workflow' && action.status === 'complete'));
});

test('conversation exposes malformed Compass output as structured advisory metadata', () => {
  const result = processConversation({
    message: 'Assess a managed integration partner with privileged implementation access.',
    conversationPlan: {
      usedLlm: false,
      source: 'compass_invalid_response',
      smartIntakeUnavailable: false,
      smartIntakeDegraded: false,
      shouldRunCouncil: false
    },
    llmAssessment: {
      provider: 'compass_gateway',
      used: false,
      invalidCompassResponse: true,
      compassFailureType: 'invalid_json',
      reason: 'Smart intake used deterministic fallback for this turn because the live advisory response could not be parsed.',
      attempts: [{ attempt: 1, status: 'invalid_json' }],
      attemptCount: 1,
      maxAttempts: 3
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.nlp.llmAssessment.invalidCompassResponse, true);
  assert.equal(result.nlp.llmAssessment.compassFailureType, 'invalid_json');
  assert.equal(result.conversationPlan.source, 'compass_invalid_response');
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
      exportOriginJurisdiction: 'US',
      exportEndUse: 'Internal research compute cluster operated by the UAE buyer',
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
      evidenceSignals: ['export classification', 'sanctions screening', 'remote support controls'],
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
  assert.equal(result.caseDraft.businessUnit, '');
  assert.equal(result.caseDraft.geography, 'UAE and Singapore');
  assert.ok(result.caseDraft.integrations.includes('Firmware support channel'));
  assert.ok(result.caseDraft.riskSignals.includes('export control'));
  assert.ok(result.caseDraft.riskSignals.includes('remote support access'));
  assert.ok(!result.caseDraft.riskSignals.includes('AI/model use'));
  assert.ok(!result.caseDraft.evidenceSignals.includes('end-use certificate'));
  assert.ok(result.missingFields.includes('business_owner'));
  assert.ok(result.missingFields.includes('export_control_evidence'));
  assert.ok(result.questions.some((question) => /upload the export control pack|classify it|analyze it first/i.test(question)));
});

test('conversation contextually gates export-control cases on end-use and sanctions screening', () => {
  let runCount = 0;
  const result = processConversation({
    forceRun: true,
    message: 'run it',
    caseDraft: {
      supplierName: 'Zenith Compute',
      businessUnit: 'Trade Compliance And Export Controls',
      geography: 'Russia',
      exportOriginJurisdiction: 'US',
      brief: 'Review a restricted AI chip export from the US to Russia for an unknown end use.',
      documents: [{
        evidenceId: 'DOC-EXPORT-01',
        title: 'Export control pack',
        extractionStatus: 'backend_parsed',
        indexStatus: 'indexed',
        summary: 'Export classification and import permit are attached. End use is unknown and sanctions screening is pending.',
        signals: ['export classification', 'import permit']
      }],
      evidenceSignals: ['export classification', 'import permit'],
      riskSignals: ['export control', 'sanctions-sensitive geography'],
      sanctionsSensitiveGeographies: ['Russia'],
      knownGaps: ['export_end_use']
    }
  }, {
    runtime: 'deterministic',
    runAgentWithRuntime: () => {
      runCount += 1;
      return { ok: true };
    }
  });

  assert.equal(runCount, 0);
  assert.equal(result.shouldRun, false);
  assert.equal(result.run, null);
  assert.equal(result.runReadiness.runnable, false);
  assert.ok(result.caseDraft.knownGaps.includes('export_end_use'));
  assert.ok(result.runReadiness.executionBlockers.includes('sanctions_screening'));
  assert.ok(!result.runReadiness.executionBlockers.includes('export_end_use'));
  assert.ok(result.questions.some((question) => /screened for sanctions|restricted-party|denied-party/i.test(question)));
  assert.match(result.reply, /Sanctions and restricted-party screening/i);
});

test('conversation records export origin follow-up without overwriting import geography or repeating the question', () => {
  const first = processConversation({
    message: 'Review an AI accelerator import for UAE and Singapore. The supplier will ship restricted hardware, provide firmware support, and has no final end-use certificate.'
  }, { runtime: 'deterministic' });
  const originQuestion = 'From which country or export-control jurisdiction will the supplier ship the AI accelerator hardware (for example, US, EU, UK, or another country)?';
  const second = processConversation({
    message: 'from the US',
    activeQuestion: originQuestion,
    caseDraft: {
      ...first.caseDraft,
      activeQuestion: originQuestion,
      questions: [originQuestion]
    },
    conversationPlan: {
      usedLlm: false,
      source: 'compass_invalid_response',
      nextQuestion: originQuestion,
      naturalResponse: `A key dependency here is the exporting jurisdiction. ${originQuestion}`
    },
    llmAssessment: {
      provider: 'compass_gateway',
      used: false,
      invalidCompassResponse: true,
      compassFailureType: 'invalid_json',
      reason: 'Smart intake used deterministic fallback for this turn because the live advisory response could not be parsed.'
    }
  }, { runtime: 'deterministic' });

  assert.equal(second.ok, true);
  assert.equal(second.caseDraft.geography, 'UAE and Singapore');
  assert.equal(second.caseDraft.exportOriginJurisdiction, 'US');
  assert.equal(second.caseDraft.recentlyAnsweredFields.export_origin_jurisdiction, 2);
  assert.equal(second.conversationPlan.nextQuestion, '');
  assert.ok(!second.reply.includes(originQuestion));
  assert.ok(!second.questions.some((question) => /export-control jurisdiction|supplier ship/i.test(question)));
});

test('conversation re-asks active clarification when the reply is unrelated', () => {
  const originQuestion = 'From which country or export-control jurisdiction will the supplier ship the AI accelerator hardware (for example, US, EU, UK, or another country)?';
  const result = processConversation({
    message: 'pizza',
    activeQuestion: originQuestion,
    caseDraft: {
      supplierName: 'Conversation-supplied case',
      brief: 'Review an AI accelerator import for UAE and Singapore with restricted hardware and firmware support.',
      geography: 'UAE and Singapore',
      riskSignals: ['export control', 'remote support access'],
      integrations: ['Firmware support channel'],
      activeQuestion: originQuestion,
      questions: [originQuestion],
      askedQuestions: [originQuestion]
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.exportOriginJurisdiction, '');
  assert.equal(result.caseDraft.activeQuestion, originQuestion);
  assert.equal(result.caseDraft.answerValidation.status, 'needs_clarification');
  assert.deepEqual(result.questions, [originQuestion]);
  assert.match(result.reply, /could not map that answer/i);
  assert.match(result.reply, /Export controls differ by shipping jurisdiction/i);
});

test('conversation spots likely owner spelling mistakes and asks for confirmation', () => {
  const geographyQuestion = 'Which geography or regulatory perimeter applies, for example UAE, KSA, Abu Dhabi, or global?';
  const result = processConversation({
    message: 'The accountable owner is complianc',
    activeQuestion: geographyQuestion,
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      brief: 'Review the Cloud AI Model Services SOW and focus on all risks.',
      riskSignals: ['AI/model use', 'personal data'],
      evidenceSignals: ['model governance'],
      activeQuestion: geographyQuestion,
      questions: [geographyQuestion],
      askedQuestions: [geographyQuestion]
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.businessUnit, '');
  assert.equal(result.caseDraft.pendingFieldClarification.suggestion, 'Compliance');
  assert.equal(result.caseDraft.answerValidation.status, 'needs_confirmation');
  assert.equal(result.caseDraft.activeQuestion, 'Did you mean Compliance as the accountable owner?');
  assert.match(result.reply, /possible spelling issue/i);
  assert.match(result.reply, /Complianc/i);
  assert.match(result.reply, /Did you mean Compliance/i);
  assert.doesNotMatch(result.reply, /could not map that answer/i);
});

test('conversation confirms corrected owner after spelling clarification then asks geography', () => {
  const geographyQuestion = 'Which geography or regulatory perimeter applies, for example UAE, KSA, Abu Dhabi, or global?';
  const result = processConversation({
    message: 'yes',
    activeQuestion: 'Did you mean Compliance as the accountable owner?',
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      brief: 'Review the Cloud AI Model Services SOW and focus on all risks.',
      riskSignals: ['AI/model use', 'personal data'],
      evidenceSignals: ['model governance'],
      documents: [{
        evidenceId: 'UP-01',
        title: 'Cloud AI Model Services Statement Of Work',
        extractionStatus: 'metadata_fallback',
        indexStatus: 'indexed',
        summary: 'Cloud AI Model Services SOW for private assistant, retrieval, document intelligence, policy Q&A, meeting summaries, and compliance evidence extraction.',
        signals: ['model governance', 'responsible-ai']
      }],
      pendingFieldClarification: {
        field: 'business_owner',
        rawValue: 'Complianc',
        suggestion: 'Compliance',
        reason: 'possible_spelling_mistake'
      },
      activeQuestion: 'Did you mean Compliance as the accountable owner?',
      questions: ['Did you mean Compliance as the accountable owner?'],
      askedQuestions: [geographyQuestion, 'Did you mean Compliance as the accountable owner?']
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.businessUnit, 'Compliance');
  assert.equal(result.caseDraft.pendingFieldClarification, null);
  assert.equal(result.caseDraft.activeQuestion, geographyQuestion);
  assert.match(result.reply, /Owner: Compliance/i);
  assert.match(result.reply, /Which geography or regulatory perimeter applies/i);
});

test('conversation records AI usage scope answers and does not repeat the answered active question', () => {
  const aiUseQuestion = 'Can you confirm whether these AI capabilities (private assistant, retrieval, document intelligence, policy Q&A, meeting summaries, and compliance evidence extraction) will be used only by internal employees, also by external customers, or for any specific regulated or high-risk workflows such as compliance decisions or HR matters?';
  const result = processConversation({
    message: 'Will be used only by internal employees and compliance and HR matters wont be a use case',
    activeQuestion: aiUseQuestion,
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      brief: 'Review the Cloud AI Model Services SOW and focus on all risks.',
      businessUnit: 'IT',
      riskSignals: ['AI/model use', 'personal data'],
      evidenceSignals: ['model governance'],
      documents: [{
        evidenceId: 'UP-01',
        title: 'Cloud AI Model Services Statement Of Work',
        extractionStatus: 'metadata_fallback',
        indexStatus: 'indexed',
        summary: 'Cloud AI Model Services SOW for private assistant, retrieval, document intelligence, policy Q&A, meeting summaries, and compliance evidence extraction.',
        signals: ['model governance', 'responsible-ai']
      }],
      llmIntake: {
        used: true,
        confidence: 0.92,
        nextBestQuestion: aiUseQuestion
      },
      activeQuestion: aiUseQuestion,
      questions: [aiUseQuestion],
      askedQuestions: [aiUseQuestion]
    },
    llmAssessment: {
      provider: 'compass_gateway',
      used: true,
      confidence: 0.9,
      nextBestQuestion: aiUseQuestion,
      naturalResponse: 'Understood: use is internal-only, and compliance and HR workflows are excluded from the planned use.'
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.aiUsageScope.audience, 'internal_employees_only');
  assert.deepEqual(result.caseDraft.aiUsageScope.excludedWorkflows, ['compliance decisions', 'HR matters']);
  assert.equal(result.caseDraft.recentlyAnsweredFields.ai_usage_scope, 2);
  assert.equal(result.caseDraft.answerValidation?.status, undefined);
  assert.ok(!result.questions.some((question) => /internal employees|external customers|compliance decisions|HR matters/i.test(question)));
  assert.ok(!result.caseDraft.activeQuestion.includes('internal employees'));
  assert.ok(result.questions.some((question) => /geography|regulatory perimeter/i.test(question)));
});

test('conversation maps shared SaaS hosting answer to visible AI hosting question', () => {
  const visibleQuestion = 'To go deeper on privacy and retention, the next useful step would be to confirm: does Aster host this as a multi-tenant cloud service, or will it run in a dedicated/private environment for your organization?';
  const staleQuestion = 'Which area do you want to prioritize in the review?';
  const result = processConversation({
    message: 'shared saas environment',
    eventType: 'user_answer',
    activeQuestion: staleQuestion,
    history: [
      { role: 'assistant', text: visibleQuestion, displayedQuestion: visibleQuestion },
      { role: 'user', text: 'shared saas environment', answeringQuestion: staleQuestion }
    ],
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'Legal And Privacy',
      geography: 'UAE and US',
      brief: 'Review the Cloud AI Model Services SOW for legal and compliance contract review.',
      activeQuestion: staleQuestion,
      questions: [staleQuestion],
      askedQuestions: [visibleQuestion],
      documents: [{
        evidenceId: 'SOW-01',
        title: 'Cloud AI Model Services Statement Of Work',
        extractionStatus: 'backend_parsed',
        indexStatus: 'indexed',
        summary: 'Cloud AI Model Services SOW for private assistant, retrieval, document intelligence, policy Q&A, meeting summaries, and compliance evidence extraction.',
        signals: ['model governance', 'responsible-ai']
      }],
      evidenceSignals: ['contract document', 'model governance'],
      riskSignals: ['AI/model use', 'personal data'],
      aiUsageScope: { audience: 'internal_employees_only' }
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.caseDraft.aiUsageScope.audience, 'internal_employees_only');
  assert.equal(result.caseDraft.aiUsageScope.hostingModel, 'multi_tenant_saas');
  assert.equal(result.caseDraft.recentlyAnsweredFields.ai_usage_scope, 2);
  assert.equal(result.caseDraft.answerValidation?.status, undefined);
  assert.doesNotMatch(result.reply, /could not map/i);
  assert.ok(!result.questions.some((question) => /multi-tenant cloud service|dedicated\/private environment/i.test(question)));
});

test('conversation uses stable active question field when question text is stale', () => {
  const first = processConversation({
    message: 'Review the Cloud AI Model Services SOW for legal and compliance contract review.',
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'Legal And Privacy',
      geography: 'UAE and US',
      documents: [{
        evidenceId: 'SOW-01',
        title: 'Cloud AI Model Services Statement Of Work',
        extractionStatus: 'backend_parsed',
        indexStatus: 'indexed',
        summary: 'Cloud AI Model Services SOW for private assistant, retrieval, document intelligence, policy Q&A, meeting summaries, and compliance evidence extraction.',
        signals: ['model governance', 'responsible-ai']
      }],
      evidenceSignals: ['contract document', 'model governance'],
      riskSignals: ['AI/model use', 'personal data']
    }
  }, { runtime: 'deterministic' });

  assert.equal(first.questionMetadata[0].field, 'ai_usage_scope');
  assert.equal(first.caseDraft.activeQuestionField, 'ai_usage_scope');
  assert.match(first.caseDraft.activeQuestionId, /^q_ai_usage_scope_/);

  const second = processConversation({
    message: 'shared saas environment',
    eventType: 'user_answer',
    activeQuestion: 'Which area do you want to prioritize in the review?',
    activeQuestionId: first.caseDraft.activeQuestionId,
    activeQuestionField: first.caseDraft.activeQuestionField,
    caseDraft: {
      ...first.caseDraft,
      activeQuestion: 'Which area do you want to prioritize in the review?',
      questions: ['Which area do you want to prioritize in the review?']
    }
  }, { runtime: 'deterministic' });

  assert.equal(second.caseDraft.aiUsageScope.hostingModel, 'multi_tenant_saas');
  assert.equal(second.caseDraft.answerValidation?.status, undefined);
  assert.doesNotMatch(second.reply, /could not map/i);
});

test('conversation records pending active clarification as a known gap instead of re-asking it', () => {
  const originQuestion = 'From which country or export-control jurisdiction will the supplier ship the AI accelerator hardware (for example, US, EU, UK, or another country)?';
  const result = processConversation({
    message: 'unknown',
    activeQuestion: originQuestion,
    caseDraft: {
      supplierName: 'Conversation-supplied case',
      brief: 'Review an AI accelerator import for UAE and Singapore with restricted hardware and firmware support.',
      geography: 'UAE and Singapore',
      riskSignals: ['export control', 'remote support access'],
      integrations: ['Firmware support channel'],
      activeQuestion: originQuestion,
      questions: [originQuestion],
      askedQuestions: [originQuestion]
    }
  }, { runtime: 'deterministic' });

  assert.ok(result.caseDraft.knownGaps.includes('export_origin_jurisdiction'));
  assert.ok(!result.questions.includes(originQuestion));
  assert.match(result.reply, /recorded export origin jurisdiction as a known gap/i);
});

test('conversation force-run does not execute when owner and geography are missing', () => {
  let runCount = 0;
  const result = processConversation({
    message: 'run it',
    forceRun: true,
    caseDraft: {
      supplierName: 'Managed Integration Partner',
      brief: 'Assess a managed integration partner connecting Oracle ERP and Workday with privileged implementation access.',
      integrations: ['Oracle ERP', 'Workday'],
      documents: [{
        evidenceId: 'UP-01',
        title: 'Integration agreement',
        extractionStatus: 'backend_parsed',
        summary: 'Agreement includes DPA, privileged access controls, and support terms.',
        signals: ['DPA', 'identity and access']
      }],
      evidenceSignals: ['DPA', 'identity and access'],
      riskSignals: ['personal data', 'privileged access']
    }
  }, {
    runtime: 'deterministic',
    runAgentWithRuntime: () => {
      runCount += 1;
      return { ok: true };
    }
  });

  assert.equal(runCount, 0);
  assert.equal(result.shouldRun, false);
  assert.equal(result.run, null);
  assert.equal(result.runReadiness.runnable, false);
  assert.ok(result.runReadiness.executionBlockers.includes('business_owner'));
  assert.ok(result.runReadiness.executionBlockers.includes('geography'));
  assert.ok(result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
});

test('conversation run readiness allows council with core intake while preserving advisory gaps', () => {
  const result = processConversation({
    message: 'Review an AI accelerator import from the US for UAE. The accountable owner is Trade Compliance. Final end use is internal research compute. Attached export classification, end-use certificate, import permit, sanctions screening, MFA, session logging, and approved support window.',
    caseDraft: {
      supplierName: 'Zenith Compute',
      documents: [{
        evidenceId: 'EXPORT-01',
        extractionStatus: 'backend_parsed',
        summary: 'The uploaded control pack includes export classification, end-use certificate, import permit, sanctions screening, MFA, session logging, and the approved support window.',
        signals: ['export classification', 'end-use certificate', 'import permit', 'sanctions screening', 'remote support controls']
      }]
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
      questions: ['Who is the accountable business unit or workflow owner?'],
      documents: [{
        evidenceId: 'SOC2-01',
        extractionStatus: 'backend_parsed',
        summary: 'The uploaded SOC 2 report describes the healthcare analytics security controls.'
      }]
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

test('conversation treats broad unknown phrases as contextual answers without looping on evidence', () => {
  const first = processConversation({
    message: 'Assess a managed integration partner connecting Oracle ERP, Workday, ServiceNow, SharePoint, and Snowflake with privileged implementation access.'
  }, { runtime: 'deterministic' });
  const second = processConversation({
    message: 'uae',
    caseDraft: first.caseDraft
  }, { runtime: 'deterministic' });

  assert.ok(second.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
  assert.ok(!second.questions.some((question) => /payroll-vendor proof/i.test(question)));

  const third = processConversation({
    message: 'we do not know at this point',
    caseDraft: second.caseDraft
  }, { runtime: 'deterministic' });
  const fourth = processConversation({
    message: 'not available yet',
    caseDraft: third.caseDraft
  }, { runtime: 'deterministic' });

  assert.ok(third.caseDraft.knownGaps.includes('business_owner'));
  assert.ok(third.questions.some((question) => /evidence is available|contract terms|DPA|SOC 2/i.test(question)));
  assert.ok(fourth.caseDraft.knownGaps.includes('evidence'));
  assert.equal(fourth.questions.length, 0);
});

test('conversation maps unknown answers from full chat history when draft questions are missing', () => {
  const result = processConversation({
    message: 'we do not know at this point',
    caseDraft: {
      brief: 'Assess a managed integration partner with privileged access.',
      businessUnit: 'Group Technology Risk',
      geography: 'UAE',
      conversationHistory: [
        { role: 'user', text: 'Assess a managed integration partner.' },
        { role: 'assistant', text: 'What source evidence should I treat as proof for this decision?' },
        { role: 'user', text: 'we do not know at this point' }
      ]
    }
  }, { runtime: 'deterministic' });

  assert.ok(result.caseDraft.knownGaps.includes('evidence'));
  assert.ok(!result.questions.some((question) => /source evidence|evidence is available|contract terms|SOC 2|DPA/i.test(question)));
  assert.match(result.reply, /source evidence as a known gap/i);
});

test('conversation maps unknown phrases to activeQuestion even when draft questions are missing', () => {
  const result = processConversation({
    message: 'we do not know at this point',
    eventType: 'user_answer',
    caseDraft: {
      brief: 'Assess a managed integration partner with privileged access.',
      businessUnit: 'Platform Team',
      geography: 'UAE',
      activeQuestion: 'What source evidence should I treat as proof for this decision?',
      conversationHistory: [
        { role: 'assistant', text: 'I added the evidence to the case.', displayedQuestion: 'What source evidence should I treat as proof for this decision?' },
        { role: 'user', text: 'we do not know at this point', answeringQuestion: 'What source evidence should I treat as proof for this decision?' }
      ]
    }
  }, { runtime: 'deterministic' });

  assert.ok(result.caseDraft.knownGaps.includes('evidence'));
  assert.ok(!result.questions.some((question) => /source evidence|evidence is available|contract terms|SOC 2|DPA/i.test(question)));
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

test('conversation uses uploaded evidence event to ask document-aware question before generic metadata', () => {
  const result = processConversation({
    message: 'Evidence uploaded: services agreement.pdf. Classify the uploaded document and ask the next best review question.',
    eventType: 'evidence_uploaded',
    caseDraft: {
      supplierName: 'Services Agreement',
      brief: 'Uploaded services agreement for review.',
      currentEventType: 'evidence_uploaded',
      documents: [{
        evidenceId: 'UP-01',
        title: 'services agreement.pdf',
        documentType: 'agreement',
        extractionStatus: 'backend_parsed',
        summary: 'Managed platform integration services agreement with implementation access, data processing, and commercial terms.',
        signals: ['agreement', 'data processing', 'privileged access']
      }],
      evidenceSignals: ['agreement', 'data processing', 'privileged access'],
      riskSignals: ['privileged access', 'personal data'],
      indexedEvidence: { chunkCount: 4, model: 'text-embedding-3-large' }
    },
    conversationPlan: {
      usedLlm: true,
      confidence: 0.86,
      nextQuestion: 'I can review the uploaded agreement first. Should I focus on access and security, data processing, commercial terms, or all risks?',
      nextBestAction: 'ask_scope',
      assistantSummary: 'I found an uploaded agreement and will triage it before asking for generic metadata.'
    },
    llmAssessment: {
      provider: 'compass_gateway',
      model: 'gpt-5.1',
      used: true,
      confidence: 0.86,
      intent: 'case_context',
      requestType: 'agreement_review',
      workflowType: 'contract_risk_review',
      documentTypes: ['agreement'],
      recommendedFirstAction: 'ask_scope',
      conversationStage: 'document_uploaded',
      nextBestQuestion: 'I can review the uploaded agreement first. Should I focus on access and security, data processing, commercial terms, or all risks?',
      assistantSummary: 'I found an uploaded agreement and will triage it before asking for generic metadata.',
      caseUpdate: {
        documentTypes: ['agreement'],
        evidenceSignals: ['agreement', 'data processing', 'privileged access'],
        riskSignals: ['privileged access', 'personal data']
      }
    }
  }, { runtime: 'deterministic' });

  assert.ok(result.questions.some((question) => /uploaded agreement|access and security|data processing|commercial terms|all risks/i.test(question)));
  assert.ok(!result.questions.some((question) => /business owner|accountable business unit|workflow owner|geography|regulatory perimeter/i.test(question)));
});

test('conversation classifies SaaS agreement review into the SaaS workflow before metadata', () => {
  const result = processConversation({
    message: 'Can you review a SaaS agreement for Microsoft 365 integration and customer data terms?'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.nlp.requestProfile.requestType, 'saas_agreement_review');
  assert.equal(result.nlp.requestProfile.workflowType, 'saas_vendor_review');
  assert.ok(result.nlp.requestProfile.documentTypes.includes('saas_agreement'));
  assert.ok(result.questions.some((question) => /upload the agreement|classify it|analyze it first/i.test(question)));
  assert.ok(!result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
  assert.match(result.reply, /SaaS\/vendor review workflow|upload the agreement/i);
});

test('conversation classifies assurance artifacts without treating them as legal contracts', () => {
  const result = processConversation({
    message: 'I need a SOC 2 report reviewed for exceptions and security gaps.'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.nlp.requestProfile.requestType, 'security_assurance_review');
  assert.equal(result.nlp.requestProfile.workflowType, 'security_assurance_review');
  assert.ok(result.nlp.requestProfile.documentTypes.includes('soc2_report'));
  assert.ok(result.questions.some((question) => /upload the .*|paste the relevant sections/i.test(question)));
  assert.ok(!result.questions.some((question) => /accountable business unit|workflow owner/i.test(question)));
});

test('conversation classifies export-control procurement asks into export workflow', () => {
  const result = processConversation({
    message: 'Please review a purchase order for restricted AI chips with sanctions screening and end-use certificate pending.'
  }, { runtime: 'deterministic' });

  assert.equal(result.ok, true);
  assert.equal(result.nlp.requestProfile.workflowType, 'export_control_review');
  assert.equal(result.nlp.requestProfile.requestType, 'export_control');
  assert.ok(result.nlp.requestProfile.documentTypes.includes('purchase_order'));
  assert.ok(result.questions.some((question) => /upload|paste/i.test(question)));
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

test('conversation maps terse answers to the latest visible question instead of stale hidden state', () => {
  const visibleQuestion = 'Could you confirm what types of data you expect to process: personal data, sensitive personal data, confidential business documents, or public/low-sensitivity data?';
  const staleQuestion = 'Have all parties, end users, destinations, and delivery sites been screened for sanctions, restricted-party, and denied-party concerns?';
  const result = processConversation({
    message: 'all of the above',
    eventType: 'user_answer',
    activeQuestion: staleQuestion,
    history: [
      { role: 'assistant', text: visibleQuestion, displayedQuestion: visibleQuestion },
      { role: 'user', text: 'all of the above', answeringQuestion: staleQuestion }
    ],
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'IT',
      geography: 'UAE and US and China',
      brief: 'Review a cloud AI model services SOW.',
      activeQuestion: staleQuestion,
      questions: [staleQuestion],
      documents: [{ evidenceId: 'SOW-01', title: 'Cloud AI SOW', extractionStatus: 'backend_parsed' }],
      evidenceSignals: ['contract document'],
      riskSignals: ['AI/model use'],
      aiUsageScope: { audience: 'internal_employees' }
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.answerValidation?.status, undefined);
  assert.ok(result.caseDraft.dataCategories.includes('sensitive personal data'));
  assert.ok(result.caseDraft.dataCategories.includes('confidential business documents'));
  assert.doesNotMatch(result.reply, /could not map/i);
});

test('conversation maps all of them to uploaded agreement review focus question', () => {
  const visibleQuestion = 'For this Enterprise SaaS MSA with VectorCloud, which area do you want to prioritize in the review: Data protection and DPA terms, AI/model-training use of your data, security and access controls, business continuity/SLAs, or commercial/legal terms?';
  const staleQuestion = 'Who is the accountable business unit or workflow owner?';
  const result = processConversation({
    message: 'all of them',
    eventType: 'user_answer',
    activeQuestion: staleQuestion,
    history: [
      { role: 'assistant', text: visibleQuestion, displayedQuestion: visibleQuestion },
      { role: 'user', text: 'all of them', answeringQuestion: staleQuestion }
    ],
    caseDraft: {
      supplierName: 'VectorCloud Systems Inc.',
      brief: 'Review Enterprise SaaS Master Services Agreement for workflow automation, supplier analytics, CRM reporting, case management, and AI-assisted summaries.',
      activeQuestion: staleQuestion,
      questions: [staleQuestion],
      askedQuestions: [visibleQuestion],
      documents: [{
        evidenceId: 'MSA-01',
        title: 'Enterprise SaaS Master Services Agreement',
        extractionStatus: 'backend_parsed',
        signals: ['agreement', 'data processing', 'AI-assisted summaries']
      }],
      evidenceSignals: ['agreement', 'data processing', 'AI-assisted summaries'],
      riskSignals: ['privacy', 'AI/model use', 'cloud security', 'business continuity', 'third-party risk']
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.answerValidation?.status, undefined);
  assert.equal(result.caseDraft.reviewFocus, 'all listed review areas');
  assert.equal(result.caseDraft.recentlyAnsweredFields.review_focus > 0, true);
  assert.doesNotMatch(result.reply, /could not map/i);
  assert.ok(!result.questions.some((question) => /which area|prioritize|focus/i.test(question)));
});

test('conversation maps focus on all the areas to active review focus question', () => {
  const focusQuestion = 'For this Cloud AI Model Services SOW, should the review focus primarily on data handling and retention, responsible AI and model governance, security and monitoring, or should all of these areas be treated as equally in-scope?';
  const result = processConversation({
    message: 'Focus on all the areas',
    eventType: 'user_answer',
    activeQuestion: focusQuestion,
    activeQuestionField: 'review_focus',
    history: [
      { role: 'assistant', text: focusQuestion, displayedQuestion: focusQuestion, displayedQuestionField: 'review_focus' },
      { role: 'user', text: 'Focus on all the areas', answeringQuestion: focusQuestion, answeringQuestionField: 'review_focus' }
    ],
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'Compliance',
      geography: '',
      brief: 'Review Cloud AI Model Services Statement of Work for private assistant, retrieval, document intelligence, policy Q&A, meeting summaries, and compliance evidence extraction.',
      activeQuestion: focusQuestion,
      activeQuestionField: 'review_focus',
      questions: [focusQuestion],
      askedQuestions: [focusQuestion],
      documents: [{
        evidenceId: 'SOW-01',
        title: 'Cloud AI Model Services Statement Of Work',
        extractionStatus: 'backend_parsed',
        signals: ['responsible-ai', 'privacy', 'security monitoring']
      }],
      evidenceSignals: ['contract document', 'responsible-ai', 'privacy', 'security monitoring'],
      riskSignals: ['AI/model use', 'personal data', 'cloud security', 'human oversight'],
      missingEvidence: ['independent robustness results', 'final RAI assessment', 'retention approval', 'data owner approval']
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.answerValidation?.status, undefined);
  assert.equal(result.caseDraft.businessUnit, 'Compliance');
  assert.equal(result.caseDraft.reviewFocus, 'all listed review areas');
  assert.equal(result.caseDraft.recentlyAnsweredFields.review_focus > 0, true);
  assert.doesNotMatch(result.reply, /could not map/i);
  assert.ok(!result.questions.some((question) => /should the review focus|focus primarily|all of these areas/i.test(question)));
});

test('conversation maps review focus from full assistant prose when active question metadata is stale', () => {
  const assistantText = [
    'Got it, Compliance is the accountable owner for this SOW.',
    '',
    'Next best review question Within this Cloud AI Model Services SOW, do you want the review to focus primarily on data handling and retention, responsible AI and model governance, security and monitoring, or should I treat all of these areas as equally in-scope?',
    '',
    'Why it matters: This keeps the decision memo clear about what is known, what is assumed, and what a human reviewer must confirm.'
  ].join('\n');
  const staleQuestion = 'Who is the accountable business unit or workflow owner?';
  const result = processConversation({
    message: 'Focus on all the areas',
    eventType: 'user_answer',
    activeQuestion: staleQuestion,
    history: [
      { role: 'assistant', text: assistantText },
      { role: 'user', text: 'Focus on all the areas', answeringQuestion: staleQuestion }
    ],
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'Compliance',
      geography: '',
      brief: 'Review Cloud AI Model Services Statement of Work for legal and compliance contract review.',
      activeQuestion: staleQuestion,
      questions: [staleQuestion],
      askedQuestions: [staleQuestion],
      documents: [{
        evidenceId: 'SOW-01',
        title: 'Cloud AI Model Services Statement Of Work',
        extractionStatus: 'backend_parsed',
        signals: ['responsible-ai', 'privacy', 'security monitoring']
      }],
      evidenceSignals: ['contract document', 'responsible-ai', 'privacy', 'security monitoring'],
      riskSignals: ['AI/model use', 'personal data', 'cloud security', 'human oversight']
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.answerValidation?.status, undefined);
  assert.equal(result.caseDraft.businessUnit, 'Compliance');
  assert.equal(result.caseDraft.reviewFocus, 'all listed review areas');
  assert.equal(result.caseDraft.recentlyAnsweredFields.review_focus > 0, true);
  assert.doesNotMatch(result.reply, /could not map/i);
  assert.ok(!result.questions.some((question) => /focus primarily|equally in-scope/i.test(question)));
});

test('conversation maps hosting answer from full assistant prose when displayed question metadata is absent', () => {
  const assistantText = 'To go deeper on privacy and retention, the next useful step would be to confirm: does Aster host this as a multi-tenant cloud service, or will it run in a dedicated/private environment for your organization?';
  const staleQuestion = 'Which area do you want to prioritize in the review?';
  const result = processConversation({
    message: 'shared saas environment',
    eventType: 'user_answer',
    activeQuestion: staleQuestion,
    history: [
      { role: 'assistant', text: assistantText },
      { role: 'user', text: 'shared saas environment', answeringQuestion: staleQuestion }
    ],
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'Compliance',
      geography: 'UAE and US',
      brief: 'Review the Cloud AI Model Services SOW for legal and compliance contract review.',
      activeQuestion: staleQuestion,
      questions: [staleQuestion],
      askedQuestions: [staleQuestion],
      documents: [{
        evidenceId: 'SOW-01',
        title: 'Cloud AI Model Services Statement Of Work',
        extractionStatus: 'backend_parsed',
        signals: ['model governance', 'responsible-ai']
      }],
      evidenceSignals: ['contract document', 'model governance'],
      riskSignals: ['AI/model use', 'personal data'],
      aiUsageScope: { audience: 'internal_employees_only' }
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.answerValidation?.status, undefined);
  assert.equal(result.caseDraft.aiUsageScope.audience, 'internal_employees_only');
  assert.equal(result.caseDraft.aiUsageScope.hostingModel, 'multi_tenant_saas');
  assert.equal(result.caseDraft.recentlyAnsweredFields.ai_usage_scope, 2);
  assert.doesNotMatch(result.reply, /could not map/i);
  assert.ok(!result.questions.some((question) => /multi-tenant cloud service|dedicated\/private environment/i.test(question)));
});

test('post-council ambiguous geography update asks add or replace before mutating case', () => {
  const result = processConversation({
    message: 'Syria',
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'IT',
      geography: 'UAE and US',
      brief: 'Review a cloud AI model services SOW.',
      documents: [{ evidenceId: 'SOW-01', title: 'Cloud AI SOW', extractionStatus: 'backend_parsed' }],
      evidenceSignals: ['contract document'],
      riskSignals: ['AI/model use'],
      aiUsageScope: { audience: 'internal_employees' },
      lastCouncilRun: { ok: true, runId: 'run-v1', decision: 'conditional_approval', caseVersion: 1 },
      councilStatus: 'current',
      caseVersion: 1
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.geography, 'UAE and US');
  assert.equal(result.caseDraft.councilStatus, 'pending_update_clarification');
  assert.equal(result.caseDraft.pendingCaseUpdateClarification.field, 'geography');
  assert.match(result.reply, /add Syria.*replace/i);
  assert.doesNotMatch(result.reply, /ran the case/i);
});

test('post-council explicit geography addition marks prior council output stale and retains evidence', () => {
  const result = processConversation({
    message: 'I want to deploy this in Syria as well',
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'IT',
      geography: 'UAE and US',
      brief: 'Review a cloud AI model services SOW.',
      documents: [{ evidenceId: 'SOW-01', title: 'Cloud AI SOW', extractionStatus: 'backend_parsed' }],
      evidenceSignals: ['contract document'],
      riskSignals: ['AI/model use'],
      aiUsageScope: { audience: 'internal_employees' },
      lastCouncilRun: { ok: true, runId: 'run-v1', decision: 'conditional_approval', caseVersion: 1 },
      councilStatus: 'current',
      caseVersion: 1
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.geography, 'UAE and US and Syria');
  assert.equal(result.caseDraft.documents.length, 1);
  assert.equal(result.caseDraft.councilStatus, 'superseded_pending_rerun');
  assert.equal(result.caseDraft.rerunRecommended, true);
  assert.ok(result.caseDraft.caseAmendments.some((item) => item.field === 'geography' && /Syria/i.test(item.value)));
  assert.ok(result.questions.some((question) => /sanctions|restricted-party|denied-party/i.test(question)));
  assert.ok(!result.questions.some((question) => /end-use certificate/i.test(question)));
  assert.match(result.reply, /updated the existing case after the prior council run/i);
});

test('post-council AI scope addition marks prior council output stale without losing existing scope', () => {
  const result = processConversation({
    message: 'It will also be used by some third party contractors',
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'IT',
      geography: 'UAE and US',
      brief: 'Review a cloud AI model services SOW.',
      documents: [{ evidenceId: 'SOW-01', title: 'Cloud AI SOW', extractionStatus: 'backend_parsed' }],
      evidenceSignals: ['contract document'],
      riskSignals: ['AI/model use'],
      aiUsageScope: { audience: 'internal_employees_only', excludedWorkflows: ['HR matters'] },
      lastCouncilRun: { ok: true, runId: 'run-v1', decision: 'conditional_approval', caseVersion: 1 },
      councilStatus: 'current',
      caseVersion: 1
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.aiUsageScope.thirdPartyContractors, true);
  assert.ok(result.caseDraft.aiUsageScope.excludedWorkflows.includes('HR matters'));
  assert.equal(result.caseDraft.councilStatus, 'superseded_pending_rerun');
  assert.ok(result.caseDraft.caseAmendments.some((item) => item.field === 'ai_usage_scope'));
});

test('post-council ambiguous AI scope update asks whether it is add or replace', () => {
  const result = processConversation({
    message: 'external customers',
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'IT',
      geography: 'UAE and US',
      brief: 'Review a cloud AI model services SOW.',
      documents: [{ evidenceId: 'SOW-01', title: 'Cloud AI SOW', extractionStatus: 'backend_parsed' }],
      evidenceSignals: ['contract document'],
      riskSignals: ['AI/model use'],
      aiUsageScope: { audience: 'internal_employees_only', excludedWorkflows: ['HR matters'] },
      lastCouncilRun: { ok: true, runId: 'run-v1', decision: 'conditional_approval', caseVersion: 1 },
      councilStatus: 'current',
      caseVersion: 1
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.aiUsageScope.audience, 'internal_employees_only');
  assert.equal(result.caseDraft.councilStatus, 'pending_update_clarification');
  assert.equal(result.caseDraft.pendingCaseUpdateClarification.field, 'ai_usage_scope');
  assert.match(result.reply, /add this AI-use scope.*replace/i);
});

test('post-council rerun keeps existing evidence and clears stale status when council executes', () => {
  let payloadSeen = null;
  const result = processConversation({
    message: 'rerun council',
    forceRun: true,
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'IT',
      geography: 'UAE and US and Singapore',
      brief: 'Review a cloud AI model services SOW for internal policy search.',
      documents: [{
        evidenceId: 'SOW-01',
        title: 'Cloud AI SOW',
        extractionStatus: 'backend_parsed',
        summary: 'The uploaded SOW defines internal policy search, contract terms, and data-processing controls.'
      }],
      evidenceSignals: ['contract document', 'DPA'],
      riskSignals: ['AI/model use'],
      aiUsageScope: { audience: 'internal_employees', excludedWorkflows: ['HR matters', 'legal determinations'] },
      lastCouncilRun: { ok: true, runId: 'run-v1', decision: 'conditional_approval', caseVersion: 1 },
      councilStatus: 'superseded_pending_rerun',
      rerunRecommended: true,
      caseAmendments: [{ field: 'geography', value: 'UAE and US and Singapore', updateType: 'addition', materiality: 'high' }],
      caseVersion: 1
    }
  }, {
    runtime: 'deterministic',
    runAgentWithRuntime: (payload) => {
      payloadSeen = payload;
      return {
        ok: true,
        runId: 'run-v2',
        decision: { recommendation: 'Conditional approval', readinessScore: 0.74 },
        gaps: [],
        evidenceIds: ['SOW-01']
      };
    }
  });

  assert.equal(result.run.ok, true);
  assert.equal(payloadSeen.documents.length, 1);
  assert.match(payloadSeen.geography, /Singapore/);
  assert.equal(result.caseDraft.councilStatus, 'current');
  assert.equal(result.caseDraft.rerunRecommended, false);
  assert.equal(result.caseDraft.lastCouncilRun.runId, 'run-v2');
});

test('sanctions-sensitive geography on a cloud AI SOW does not invent export end-use certificate questions', () => {
  const result = processConversation({
    message: 'I want to deploy this in Syria as well',
    caseDraft: {
      supplierName: 'Aster Cognitive Cloud',
      businessUnit: 'IT',
      geography: 'UAE and US and China',
      brief: 'Review a cloud AI model services SOW for private assistant, retrieval, policy Q&A, meeting summaries, and compliance evidence extraction.',
      documents: [{ evidenceId: 'SOW-01', title: 'Cloud AI Model Services Statement of Work', extractionStatus: 'backend_parsed' }],
      evidenceSignals: ['contract document'],
      riskSignals: ['AI/model use'],
      aiUsageScope: { audience: 'internal_employees', excludedWorkflows: ['HR matters', 'legal determinations'] },
      lastCouncilRun: { ok: true, runId: 'run-v1', decision: 'conditional_approval', caseVersion: 1 },
      councilStatus: 'current',
      caseVersion: 1
    }
  }, { runtime: 'deterministic' });

  assert.ok(result.missingFields.includes('sanctions_screening'));
  assert.ok(!result.missingFields.includes('export_end_use'));
  assert.ok(!result.missingFields.includes('export_origin_jurisdiction'));
  assert.ok(result.questions.some((question) => /sanctions|restricted-party|denied-party/i.test(question)));
  assert.ok(!result.questions.some((question) => /end-use certificate|controlled item/i.test(question)));
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

test('an evidence availability question stays requested and cannot make intake runnable', () => {
  const result = processConversation({
    message: 'Is SOC 2 evidence available?',
    caseDraft: {
      supplierName: 'Question Only Vendor',
      businessUnit: 'Operations',
      geography: 'UAE',
      brief: 'Review a low criticality consulting vendor with no personal data.'
    }
  }, { runtime: 'deterministic' });

  assert.equal(result.caseDraft.documents[0].assertionState, 'requested');
  assert.equal(result.caseDraft.documents[0].provenance, 'chat_message');
  assert.equal(result.readyToRun, false);
  assert.ok(result.missingFields.includes('evidence'));
});
