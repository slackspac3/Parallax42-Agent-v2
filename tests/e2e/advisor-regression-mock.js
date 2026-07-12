'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const {
  ROOT,
  assertFirstViewportLayout,
  assertNonBlankWorkbench,
  assertResponsiveWorkspace,
  assertVisibleText,
  attachBrowserDiagnostics,
  screenshotOnFailure,
  startServerIfNeeded,
  stopServer
} = require('./helpers');

const PORT = Number(process.env.PLAYWRIGHT_PORT || 3141);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const FIXTURE = path.join(ROOT, 'test-fixtures', 'compliance-documents', '04_managed_platform_integration_services_agreement.pdf');
let mockRunCounter = 0;
let mockConversationCaseId = '';
let mockConversationCaseVersion = 0;

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  };
}

function baseDraft(overrides = {}) {
  return {
    supplierName: 'Managed platform integration agreement review',
    businessUnit: '',
    geography: '',
    integrations: [],
    riskSignals: [],
    evidenceSignals: [],
    knownGaps: [],
    questions: [],
    ...overrides
  };
}

function mockRunResult(caseContext = {}) {
  mockRunCounter += 1;
  const supplierName = caseContext.supplierName || 'Managed Platform Integration Partner';
  const businessUnit = caseContext.businessUnit || 'Finance';
  const geography = caseContext.geography || 'UAE';
  const integrations = Array.isArray(caseContext.integrations) && caseContext.integrations.length
    ? caseContext.integrations
    : ['Microsoft 365', 'Okta', 'SAP', 'Workday', 'Salesforce'];
  const documents = Array.isArray(caseContext.documents) && caseContext.documents.length
    ? caseContext.documents.map((doc, index) => ({
        evidenceId: doc.evidenceId || `UP-MOCK-${String(index + 1).padStart(2, '0')}`,
        title: doc.title || doc.fileName || 'Managed platform integration services agreement',
        extractionStatus: doc.extractionStatus || 'mocked'
      }))
    : [{ evidenceId: 'UP-MOCK-01', title: 'Managed platform integration services agreement' }];
  const primaryEvidenceId = documents[0]?.evidenceId || 'UP-MOCK-01';
  const slug = supplierName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42) || 'mock';
  const approvalEligible = mockRunCounter >= 2;

  return {
    ok: true,
    runId: `run_e2e_${String(mockRunCounter).padStart(3, '0')}`,
    caseVersion: 2,
    mode: 'crewai_flow',
    case: {
      caseId: caseContext.caseId || `case-e2e-${slug}`,
      supplierName,
      businessUnit,
      geography,
      integrations,
      documents
    },
    decision: {
      status: approvalEligible ? 'ready' : 'conditionally_ready',
      recommendation: approvalEligible ? 'Ready for human approval' : 'Continue review with named controls',
      readinessScore: approvalEligible ? 0.88 : 0.72,
      approvalEligible,
      humanApprovalRequired: true
    },
    domains: [
      {
        label: 'Privacy And Data Governance',
        status: 'applicable',
        score: 1,
        obligations: ['Confirm data-processing basis, retention, deletion, and transfer evidence.']
      },
      {
        label: 'Technical Risk',
        status: 'applicable',
        score: 0.67,
        obligations: ['Review privileged implementation access and integration controls.']
      }
    ],
    gaps: approvalEligible ? [] : [
      {
        gap: 'Confirm privileged implementation access owner',
        severity: 'medium',
        action: 'Reviewer must confirm named access owner and approval evidence.'
      }
    ],
    decisionReadiness: {
      status: approvalEligible ? 'ready' : 'conditionally_ready',
      approvalEligible,
      humanApprovalRequired: true,
      blockingGaps: approvalEligible ? 0 : 1,
      mediumSeverityGaps: approvalEligible ? 0 : 1
    },
    evidenceIds: [primaryEvidenceId, 'DOC-CITE-01'],
    citations: [
      {
        evidenceId: primaryEvidenceId,
        citationId: 'DOC-CITE-01',
        title: documents[0]?.title || 'Managed platform agreement',
        text: `${supplierName} evidence includes DPA, retention schedule, service continuity, and privileged access obligations.`,
        score: 0.91,
        signals: ['DPA', 'retention', 'privileged access']
      }
    ],
    evidenceQuality: { status: 'strong', score: 0.82 },
    retrievalContext: {
      provider: 'qdrant',
      chunkCount: 4,
      matchCount: 1,
      matches: [
        {
          evidenceId: primaryEvidenceId,
          title: documents[0]?.title || 'Managed platform agreement',
          text: `DPA, retention, and privileged access clauses were recovered for ${supplierName}.`,
          score: 0.91
        }
      ]
    },
    trace: [
      { agent: 'intake_agent', eventType: 'case_loaded' },
      { agent: 'obligation_mapper', eventType: 'domains_scanned' },
      { agent: 'evidence_examiner', eventType: 'evidence_mapped' },
      { agent: 'risk_control_analyst', eventType: 'controls_recommended' },
      { agent: 'responsible_ai_reviewer', eventType: 'output_reviewed' },
      { agent: 'audit_packager', eventType: 'packaged' }
    ],
    orchestration: { humanApprovalRequired: true }
  };
}

function conversationResponse(body = {}) {
  const message = String(body.message || '').toLowerCase();
  const activeQuestion = String(body.activeQuestion || '');
  const eventType = String(body.eventType || '');

  if (body.forceRun) {
    const caseVersion = Number(body.caseDraft?.caseVersion || 0) + 3;
    const caseId = body.caseDraft?.caseId || mockConversationCaseId || 'case-e2e-managed-platform';
    const caseDraft = baseDraft({
      ...body.caseDraft,
      caseId,
      caseVersion,
      businessUnit: body.caseDraft?.businessUnit || 'Finance',
      geography: body.caseDraft?.geography || 'UAE'
    });
    const run = mockRunResult(caseDraft);
    run.case.caseId = caseId;
    run.caseVersion = caseVersion;
    mockConversationCaseId = caseId;
    mockConversationCaseVersion = caseVersion;
    return {
      reply: 'Council run complete. I kept the decision review-bound.',
      questions: [],
      runReadiness: { runnable: true, score: 0.88, missingFields: [] },
      caseVersion,
      caseDraft,
      completedCase: { ...caseDraft, version: caseVersion, state: 'review_ready' },
      conversationPlan: { usedLlm: true, nextBestAction: 'run_council' },
      nlp: { llmAssessment: { used: true, model: 'gpt-5.1', requestType: 'supplier_risk' } },
      run
    };
  }

  if (eventType === 'evidence_uploaded') {
    return {
      reply: 'I added the service agreement and indexed citation-ready evidence.',
      questions: ['I can review the uploaded service agreement first. Should I focus on access and security, data processing, commercial terms, or all risks?'],
      runReadiness: { runnable: true, score: 0.88, missingFields: [] },
      caseDraft: baseDraft({
        ...body.caseDraft,
        supplierName: 'Managed platform integration services agreement',
        businessUnit: body.caseDraft?.businessUnit || 'Finance',
        geography: body.caseDraft?.geography || 'UAE',
        integrations: ['Microsoft 365', 'Okta', 'SAP', 'Workday', 'Salesforce'],
        riskSignals: ['privileged access', 'data processing', 'continuity'],
        evidenceSignals: ['signed DPA', 'retention schedule', 'service continuity'],
        indexedEvidence: { provider: 'qdrant', chunkCount: 4, model: 'text-embedding-3-large' },
        retrievalContext: { evidenceMatches: [{ title: 'Managed platform agreement', score: 0.91 }] }
      }),
      conversationPlan: { usedLlm: true, nextBestAction: 'ask_scope' },
      nlp: { llmAssessment: { used: true, model: 'gpt-5.1', requestType: 'agreement_review' } }
    };
  }

  if (/managed integration partner|oracle erp|workday|servicenow|snowflake/.test(message)) {
    return {
      reply: 'I understand this as a managed integration partner review.',
      questions: ['Who is the accountable business owner for this case?'],
      runReadiness: { runnable: false, score: 0.35, missingFields: ['businessUnit', 'geography', 'evidence'] },
      caseDraft: baseDraft({
        supplierName: 'Managed integration partner',
        integrations: ['Oracle ERP', 'Workday', 'ServiceNow', 'SharePoint', 'Snowflake'],
        riskSignals: ['privileged implementation access']
      }),
      conversationPlan: { usedLlm: true, nextBestAction: 'ask_owner' },
      nlp: { llmAssessment: { used: true, model: 'gpt-5.1', requestType: 'supplier_risk' } }
    };
  }

  if (/^finance$/i.test(body.message || '') && /business owner|accountable/i.test(activeQuestion)) {
    return {
      reply: 'I recorded Finance as the accountable owner.',
      questions: ['Which geography or regulatory perimeter applies?'],
      runReadiness: { runnable: false, score: 0.49, missingFields: ['geography', 'evidence'] },
      caseDraft: baseDraft({
        ...body.caseDraft,
        businessUnit: 'Finance',
        integrations: body.caseDraft?.integrations || ['Oracle ERP', 'Workday', 'ServiceNow', 'SharePoint', 'Snowflake']
      }),
      conversationPlan: { usedLlm: true, nextBestAction: 'ask_geography' },
      nlp: { llmAssessment: { used: true, model: 'gpt-5.1', intent: 'owner_answer' } }
    };
  }

  if (/dont know|don't know|not sure|unknown|do not know/i.test(body.message || '') && /geography|regulatory/i.test(activeQuestion)) {
    return {
      reply: 'I marked geography as pending and will keep it as a reviewer gap. What source evidence should I treat as proof for this decision?',
      questions: ['What source evidence should I treat as proof for this decision?'],
      runReadiness: { runnable: false, score: 0.52, missingFields: ['evidence'] },
      caseDraft: baseDraft({
        ...body.caseDraft,
        knownGaps: ['geography'],
        businessUnit: body.caseDraft?.businessUnit || 'Finance'
      }),
      conversationPlan: { usedLlm: true, nextBestAction: 'ask_evidence' },
      nlp: { llmAssessment: { used: true, model: 'gpt-5.1', intent: 'unknown' } }
    };
  }

  if (/agreement|contract|msa|dpa/.test(message)) {
    return {
      reply: 'I understand this as an agreement review.',
      questions: ['Would you like to upload the agreement now, or should I work from pasted clauses first?'],
      runReadiness: { runnable: false, score: 0.22, missingFields: ['document'] },
      caseDraft: baseDraft({ supplierName: 'Agreement review', requestType: 'agreement_review' }),
      conversationPlan: { usedLlm: true, nextBestAction: 'upload_document' },
      nlp: { llmAssessment: { used: true, model: 'gpt-5.1', requestType: 'agreement_review' } }
    };
  }

  const postCouncilFollowUp = Boolean(mockConversationCaseVersion);
  const caseVersion = postCouncilFollowUp ? mockConversationCaseVersion + 1 : Number(body.caseDraft?.caseVersion || 0);
  if (postCouncilFollowUp) mockConversationCaseVersion = caseVersion;
  return {
    reply: 'I captured the useful facts and identified the next decision point.',
    questions: postCouncilFollowUp ? [] : ['What do you need reviewed?'],
    runReadiness: postCouncilFollowUp
      ? { runnable: true, score: 0.88, missingFields: [] }
      : { runnable: false, score: 0.1, missingFields: ['scope'] },
    caseDraft: baseDraft({ ...body.caseDraft, caseVersion }),
    conversationPlan: { usedLlm: true, nextBestAction: postCouncilFollowUp ? 'run_council' : 'ask_scope' },
    nlp: { llmAssessment: { used: true, model: 'gpt-5.1' } }
  };
}

async function installMocks(page, records) {
  await page.route('**/api/demo/session', async (route) => {
    records.demoSession.push({ method: route.request().method() });
    const sequence = records.demoSession.length;
    await route.fulfill(jsonResponse({
      ok: true,
      token: `p42d_mock_browser_session_${sequence}`,
      sessionId: `demo-session-e2e-${sequence}`,
      workspaceId: `demo:session-e2e-${sequence}`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString()
    }, 201));
  });

  await page.route('**/api/demo/case', async (route) => {
    const body = route.request().postDataJSON();
    records.demoCase.push(body);
    const integration = /04_managed_platform/.test(body.filename || '');
    const saas = /01_enterprise_saas/.test(body.filename || '');
    const supplierName = integration ? 'OmniBridge Services LLC' : saas ? 'VectorCloud Systems Inc.' : 'HelioChip Logistics';
    await route.fulfill(jsonResponse({
      ok: true,
      case: {
        caseId: `demo-case-${records.demoCase.length}`,
        version: 1,
        supplierName,
        brief: 'Generated fixture review case.',
        businessUnit: integration ? 'Enterprise Platforms' : 'Compliance',
        geography: 'United Arab Emirates',
        evidence: [{ evidenceId: 'FIXTURE-E2E-01', title: body.filename, extractionStatus: 'fixture' }],
        knownGaps: []
      }
    }, 201));
  });

  await page.route('**/api/case/approve', async (route) => {
    const body = route.request().postDataJSON();
    records.approval.push(body);
    await route.fulfill(jsonResponse({
      ok: true,
      status: /remediation/i.test(body.reviewerDecision || '') ? 'rejected' : 'approved',
      caseId: body.caseId,
      caseVersion: Number(body.caseVersion || 0) + 1,
      reviewerDecision: body.reviewerDecision,
      autoApproval: false,
      humanApprovalRequired: true
    }));
  });

  await page.route('**/api/case/narrative', async (route) => {
    await route.fulfill(jsonResponse({
      ok: true,
      source: 'deterministic',
      summary: 'The deterministic decision remains authoritative and the listed reviewer actions must be completed.',
      gapRemediations: []
    }));
  });

  await page.route('**/api/conversation', async (route) => {
    const body = route.request().postDataJSON();
    records.conversation.push(body);
    if (mockConversationCaseVersion && Number(body.caseDraft?.caseVersion || 0) !== mockConversationCaseVersion) {
      await route.fulfill(jsonResponse({
        error: 'stale_case_version',
        detail: 'Case changed since it was loaded. Refresh and retry.'
      }, 409));
      return;
    }
    await route.fulfill(jsonResponse(conversationResponse(body)));
  });

  await page.route('**/api/agent/run', async (route) => {
    const body = route.request().postDataJSON();
    records.agentRun.push(body);
    await route.fulfill(jsonResponse(mockRunResult(body)));
  });

  await page.route('**/api/evidence/index', async (route) => {
    records.evidenceIndex.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill(jsonResponse({
      ok: true,
      provider: 'qdrant',
      model: 'text-embedding-3-large',
      indexingProvider: 'qdrant',
      chunks: [
        { chunkId: 'UP-MOCK-01_CHUNK_01', evidenceId: 'UP-MOCK-01' },
        { chunkId: 'UP-MOCK-01_CHUNK_02', evidenceId: 'UP-MOCK-01' },
        { chunkId: 'UP-MOCK-01_CHUNK_03', evidenceId: 'UP-MOCK-01' },
        { chunkId: 'UP-MOCK-01_CHUNK_04', evidenceId: 'UP-MOCK-01' }
      ],
      index: { provider: 'qdrant', chunkCount: 4, evidenceIds: ['UP-MOCK-01'] }
    }));
  });

  await page.route('**/api/evidence/search', async (route) => {
    await route.fulfill(jsonResponse({
      ok: true,
      provider: 'qdrant',
      matches: []
    }));
  });

  await page.route('**/api/audit/recent**', async (route) => {
    await route.fulfill(jsonResponse({
      ok: true,
      records: []
    }));
  });

  await page.route('**/api/admin/status', async (route) => {
    await route.fulfill(jsonResponse({
      ok: true,
      status: 'mocked',
      runtime: { default: 'crewai_llm', liveCrewAIEnabled: false, liveLlmAdvisoryEnabled: false },
      vectorStore: { provider: 'qdrant', configured: true },
      parserRelay: { configured: true, featureEnabled: true },
      audit: { available: true },
      settings: {}
    }));
  });

  await page.route('**/api/admin/features', async (route) => {
    await route.fulfill(jsonResponse({
      ok: true,
      features: []
    }));
  });

  await page.route('**/api/health', async (route) => {
    await route.fulfill(jsonResponse({
      ok: true,
      status: 'healthy',
      service: 'mock-compliance-api',
      agentRuntime: { configuredRuntime: 'crewai_llm' }
    }));
  });

  await page.route('**/api/compass/probe', async (route) => {
    await route.fulfill(jsonResponse({
      ok: true,
      configured: true,
      gateway_auth_verified: true,
      live_compass_verified: false,
      model: 'gpt-5.1',
      message: 'Mock gateway client policy verified.'
    }));
  });

  await page.route('**/api/benchmarks', async (route) => {
    await route.fulfill(jsonResponse({
      summary: {
        passed: 4,
        cases: 4,
        passRate: 1,
        p95DurationMs: 42
      },
      results: []
    }));
  });

  await page.route('**/api/readiness', async (route) => {
    await route.fulfill(jsonResponse({
      submissionReadiness: {
        sovereignModelBoundary: 'ready',
        auditTraceability: 'ready',
        rbac: 'ready',
        evidenceRetrieval: 'ready',
        benchmarks: 'ready',
        responsibleAi: 'ready',
        videoDemo: 'ready'
      }
    }));
  });

  const handleBackendRoute = async (route) => {
    const url = new URL(route.request().url());
    const pathParam = url.searchParams.get('path') || url.pathname.replace(/.*\/api\/backend/, '') || '/health';
    records.backend.push({ method: route.request().method(), path: pathParam });
    if (/\/health$/.test(pathParam)) {
      await route.fulfill(jsonResponse({ ok: true, service: 'mock-droplet-backend' }));
      return;
    }
    if (/upload\/init/.test(pathParam)) {
      await route.fulfill(jsonResponse({ upload_id: 'upload-mock-1', chunk_size_bytes: 10_000_000, files: [{ file_id: 'file-1', total_chunks: 1 }] }));
      return;
    }
    if (/upload\/chunk/.test(pathParam)) {
      await route.fulfill(jsonResponse({ ok: true }));
      return;
    }
    if (/upload\/complete/.test(pathParam)) {
      await route.fulfill(jsonResponse({ ok: true }));
      return;
    }
    if (/upload\/status/.test(pathParam)) {
      await route.fulfill(jsonResponse({ status: 'complete', result_available: true }));
      return;
    }
    if (/upload\/result/.test(pathParam)) {
      await route.fulfill(jsonResponse({
        uploaded_documents: [{
          document_id: 'UP-MOCK-01',
          file_name: '04_managed_platform_integration_services_agreement.pdf',
          mime_type: 'application/pdf',
          document_type: 'service_agreement',
          extraction_status: 'backend_parsed',
          provider_name: 'mock_parser',
          summary: 'Managed platform integration agreement with DPA, retention, continuity, and privileged access obligations.',
          document_evidence_ids: ['DOC-CITE-01'],
          semantic_parse: { semantic_summary: 'Clause extraction completed.' }
        }],
        extracted_case: {
          supplier_name: 'Managed platform integration services agreement',
          service_description: 'Managed integration partner with privileged access.',
          integrations: ['Microsoft 365', 'Okta', 'SAP', 'Workday', 'Salesforce']
        },
        evidence_checklist: ['Signed DPA', 'Retention schedule', 'Service continuity plan']
      }));
      return;
    }
    await route.fulfill(jsonResponse({ error: 'mock_route_missing', path: pathParam }, 404));
  };

  await page.route('**/api/backend**', handleBackendRoute);
  await page.route('https://api.parallax42.bhavukarora.com/**', handleBackendRoute);
}

async function sendMessage(page, message) {
  await page.locator('#chatInput').fill(message);
  await page.locator('#chatInput').press('Enter');
}

async function assertMainSectionVisible(page, section, selector, pattern) {
  await page.waitForFunction((expected) => document.body.dataset.mainSection === expected, section, { timeout: 5000 });
  assert.equal(await page.locator(selector).isVisible(), true, `${selector} should be visible for ${section}`);
  await assertVisibleText(page, selector, pattern);
}

async function assertCouncilOutputVisible(page) {
  await page.waitForFunction(() => document.body.dataset.workspaceView === 'output', null, { timeout: 5000 });
  await page.waitForFunction(() => document.body.dataset.runComplete === 'true', null, { timeout: 5000 });
  assert.equal(await page.locator('#workflow').isVisible(), true, 'Council Output runway should be visible');
  assert.equal(await page.locator('#specialistList').isVisible(), true, 'Decision Room output should be visible');
  const workflowBox = await page.locator('#workflow').boundingBox();
  const specialistBox = await page.locator('#specialistList').boundingBox();
  assert.ok(workflowBox && workflowBox.width > 300 && workflowBox.height > 300, 'Council Output runway should have visible dimensions');
  assert.ok(specialistBox && specialistBox.width > 300 && specialistBox.height > 120, 'Decision Room output should have visible dimensions');
  await assertVisibleText(page, '#workflow', /Executive decision room|Human approval required|Deterministic compliance engine/i);
  assert.equal(await page.locator('#runHistorySelect').isEnabled(), true, 'run history selector should be enabled after a completed run');
  const selectedRunId = await page.locator('#runHistorySelect').inputValue();
  assert.match(selectedRunId, /^run_/, 'completed run should have a traceable run ID');
  await assertVisibleText(page, '#artifactPreview', new RegExp(selectedRunId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const specialistTextLength = await page.locator('#specialistList').evaluate((node) => (node.textContent || '').trim().length);
  assert.ok(specialistTextLength > 0, 'specialistList should contain decision output');
  const state = await page.evaluate(() => ({
    workspaceView: document.body.dataset.workspaceView,
    runComplete: document.body.dataset.runComplete,
    hasDecisionOutput: document.body.classList.contains('has-decision-output')
  }));
  assert.deepEqual(state, {
    workspaceView: 'output',
    runComplete: 'true',
    hasDecisionOutput: true
  });
}

async function assertCouncilOutputEmptyState(page) {
  await page.locator('#councilOutputTab').click();
  await page.waitForFunction(() => (
    document.body.dataset.workspaceView === 'output'
      && document.body.dataset.runComplete === 'false'
      && /Decision room is empty|Run the council/i.test(document.querySelector('#workflow')?.textContent || '')
  ), null, { timeout: 5000 });
  await assertVisibleText(page, '#workflow', /Decision room is empty|Run the council/i);
  await assertVisibleText(page, '#specialistList', /Run the council to generate the executive output|Back to case builder/i);
  const outputTextLength = await page.locator('#specialistList').evaluate((node) => (node.textContent || '').trim().length);
  assert.ok(outputTextLength > 0, 'empty Council Output state should not be blank');
}

async function main() {
  const server = await startServerIfNeeded({
    port: PORT,
    baseUrl: process.env.PLAYWRIGHT_BASE_URL,
    env: {
      COMPASS_GATEWAY_TOKEN: 'mock-token',
      P42_VECTOR_STORE_PROVIDER: 'qdrant',
      QDRANT_URL: 'https://qdrant.example.test',
      QDRANT_COLLECTION: 'p42_compliance_evidence',
      PARALLAX42_BACKEND_URL: 'https://api.parallax42.bhavukarora.com'
    }
  });
  const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS !== '0' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const records = { agentRun: [], approval: [], backend: [], conversation: [], demoCase: [], demoSession: [], evidenceIndex: [] };
  const diagnostics = attachBrowserDiagnostics(page, { baseUrl: BASE_URL });

  try {
    await installMocks(page, records);
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem('p42:test-legacy-history-seeded')) return;
      window.sessionStorage.setItem('p42:test-legacy-history-seeded', 'true');
      window.localStorage.setItem('p42:run-history', JSON.stringify([{
        runId: 'run_legacy_cross_session',
        result: {
          ok: true,
          case: { supplierName: 'Prior private tenant' },
          citations: [{ text: 'prior-session-confidential-evidence' }]
        }
      }]));
    });
    await screenshotOnFailure(page, 'advisor-regression-mock', async () => {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#chatInput');
      assert.equal(await page.evaluate(() => window.localStorage.getItem('p42:run-history')), null, 'legacy full run history must be purged from localStorage');
      assert.doesNotMatch(await page.locator('#runHistorySelect').textContent(), /Prior private tenant/i, 'legacy cross-session results must not be restored');
      await assertNonBlankWorkbench(page);
      await assertFirstViewportLayout(page);

      const primaryNav = page.getByRole('navigation', { name: 'Primary' });
      await page.locator('#chatModeTab').focus();
      await page.keyboard.press('End');
      assert.equal(await page.locator('#councilOutputTab').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#workflow').isVisible(), true, 'End should move the workspace tab to Council Output');
      await page.keyboard.press('Home');
      assert.equal(await page.locator('#chatModeTab').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#caseWorkspacePanel').isVisible(), true, 'Home should return the workspace tab to Advisor');

      await page.locator('#caseIntelTab').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#councilIntelTab').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#agentActivity').isVisible(), true, 'ArrowRight should reveal the council trace tabpanel');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('#caseIntelTab').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#caseIntelligencePanel').isVisible(), true, 'ArrowLeft should restore case intelligence');

      await assertResponsiveWorkspace(page, { width: 390, height: 844 });
      await primaryNav.getByRole('link', { name: 'Evidence' }).click();
      await assertMainSectionVisible(page, 'evidence', '#evidence', /Evidence graph/i);
      await assertResponsiveWorkspace(page, { width: 390, height: 844 });
      await primaryNav.getByRole('link', { name: 'Agent' }).click();
      await assertMainSectionVisible(page, 'agent', '#run', /Compliance advisor/i);
      await assertResponsiveWorkspace(page, { width: 768, height: 900 });

      await page.setViewportSize({ width: 1440, height: 900 });
      await assertCouncilOutputEmptyState(page);
      await primaryNav.getByRole('link', { name: 'Admin' }).click();
      await assertMainSectionVisible(page, 'admin', '#admin', /Admin Console/i);
      await primaryNav.getByRole('link', { name: 'Audit Pack' }).click();
      await assertMainSectionVisible(page, 'audit', '#audit', /Artifacts a reviewer can inspect/i);
      await primaryNav.getByRole('link', { name: 'Hardening' }).click();
      await assertMainSectionVisible(page, 'hardening', '#hardening', /Production hardening/i);
      await primaryNav.getByRole('link', { name: 'Evidence' }).click();
      await assertMainSectionVisible(page, 'evidence', '#evidence', /Evidence graph/i);
      await primaryNav.getByRole('link', { name: 'Agent' }).click();
      await assertMainSectionVisible(page, 'agent', '#run', /Compliance advisor/i);
      assert.equal(await page.locator('#chatInput').isVisible(), true, 'Advisor chat input should be visible after returning to Agent');
      await page.setViewportSize({ width: 1440, height: 1000 });

      await page.evaluate(() => {
        window.localStorage.setItem('p42:evidence-index-meta', JSON.stringify({
          caseId: 'stale-evidence-only-case',
          provider: 'qdrant',
          chunkCount: 4,
          evidenceIds: ['UP-STAGED-01']
        }));
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#chatInput');
      await page.waitForFunction(() => (document.querySelector('#caseIntelReadiness')?.textContent || '').trim() === '0%');
      await assertVisibleText(page, '#caseIntelDetails', /Evidence staged|Waiting for request|Describe what decision/i);
      assert.doesNotMatch(await page.locator('#caseDraftPanel').textContent(), /New compliance case/i);
      await page.locator('#startNewCase').click();

      await page.locator('#chatInput').fill('First line');
      await page.locator('#chatInput').press('Shift+Enter');
      await page.keyboard.type('second line');
      assert.match(await page.locator('#chatInput').inputValue(), /First line\nsecond line/);
      await page.locator('#chatInput').fill('');

      await page.locator('#chatInput').fill('Assess a managed integration partner connecting Oracle ERP, Workday, ServiceNow, SharePoint, and Snowflake with privileged implementation access.');
      await assertVisibleText(page, '#caseIntelDetails', /Oracle ERP|Workday|Snowflake|privileged/i);
      await page.locator('#chatInput').press('Enter');
      await assertVisibleText(page, '#chatMessages', /accountable business owner/i);
      assert.equal(records.conversation.at(-1).activeQuestion, 'What do you need reviewed?');

      await sendMessage(page, 'Finance');
      await assertVisibleText(page, '#chatMessages', /Which geography/i);
      assert.match(records.conversation.at(-1).activeQuestion, /business owner|accountable/i);
      await assertVisibleText(page, '#caseIntelDetails', /Finance/i);
      assert.doesNotMatch(await page.locator('#caseIntelDetails').textContent(), /Group Technology Risk/i);

      await sendMessage(page, 'dont know');
      await assertVisibleText(page, '#chatMessages', /source evidence|proof/i);
      assert.match(records.conversation.at(-1).activeQuestion, /geography|regulatory/i);
      assert.doesNotMatch(await page.locator('#chatMessages .chat-message.is-assistant').last().textContent(), /Which geography/i);

      await page.locator('#startNewCase').click();
      await assertVisibleText(page, '#chatMessages', /What do you need reviewed/i);
      await sendMessage(page, 'I have an agreement that I need reviewed');
      await assertVisibleText(page, '#chatMessages', /upload the agreement/i);

      const conversationCountBeforeUpload = records.conversation.length;
      await page.locator('#chatEvidenceInput').setInputFiles(FIXTURE);
      await page.locator('#chatInput').press('Control+Enter');
      await assertVisibleText(page, '#chatMessages', /Run council to produce|service agreement first|ready when you are|indexed citation-ready evidence/i, { timeout: 20_000 });
      await page.waitForFunction(() => document.body.dataset.workspaceView === 'output', null, { timeout: 12_000 });
      const uploadConversationIndex = records.conversation.findIndex((item, index) => index >= conversationCountBeforeUpload && item.eventType === 'evidence_uploaded');
      const runConversationIndex = records.conversation.findIndex((item, index) => index >= conversationCountBeforeUpload && item.forceRun === true);
      assert.ok(uploadConversationIndex >= conversationCountBeforeUpload, 'upload completion should trigger evidence intake');
      assert.ok(runConversationIndex > uploadConversationIndex, 'queued Run council should wait until evidence ingestion and intake complete');
      assert.equal(records.conversation[uploadConversationIndex].activeQuestion, '');
      assert.ok(records.evidenceIndex.length >= 1, 'evidence indexing API should be called after upload');
      await assertVisibleText(page, '#chatAttachmentStatus', /Evidence ready for council|citation-ready/i);
      await assertVisibleText(page, '#caseIntelDetails', /4 citation-ready|4 server-side|4 indexed/i);

      await assertVisibleText(page, '#specialistList', /Human approval|Required Reviewer Actions|Evidence Quality|Specialist Collaboration/i);
      await assertVisibleText(page, '#workflow', /Executive decision room|Export review pack PDF|Deterministic compliance engine/i);
      await page.locator('#councilOutputTab').click();
      await assertCouncilOutputVisible(page);
      await assertVisibleText(page, '#specialistList', /Managed platform integration services/i);
      assert.equal(await page.locator('#approvalButton').isDisabled(), true, 'one medium gap must keep terminal approval disabled');
      assert.equal(await page.locator('#remediationButton').isEnabled(), true, 'conditional cases must still allow remediation');

      const firstCompletedCaseVersion = mockConversationCaseVersion;
      await page.locator('#chatModeTab').click();
      await sendMessage(page, 'Add a reviewer note that implementation access remains time-bound.');
      await assertVisibleText(page, '#chatMessages', /captured the useful facts/i);
      assert.equal(records.conversation.at(-1).caseDraft.caseVersion, firstCompletedCaseVersion, 'follow-up must submit the completed council version');
      const followUpCaseVersion = mockConversationCaseVersion;
      await page.locator('#chatRunNow').click();
      await assertCouncilOutputVisible(page);
      const councilRequests = records.conversation.filter((request) => request.forceRun === true);
      assert.equal(councilRequests.length, 2, 'two council interactions should complete without reload');
      assert.equal(councilRequests.at(-1).caseDraft.caseVersion, followUpCaseVersion, 'second council must submit the follow-up version');
      assert.ok(mockConversationCaseVersion > followUpCaseVersion, 'second council must return a newer authoritative version');

      await assertResponsiveWorkspace(page, { width: 390, height: 844 });
      assert.equal(await page.locator('#workflow').isVisible(), true, 'completed decision room should remain visible at 390px');
      const mobileWorkflow = await page.locator('#workflow').evaluate((node) => ({
        width: node.getBoundingClientRect().width,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        parentColumns: getComputedStyle(node.parentElement).gridTemplateColumns
      }));
      assert.ok(mobileWorkflow.width >= 340, `completed decision room should use the mobile viewport, got ${mobileWorkflow.width}px`);
      assert.ok(mobileWorkflow.scrollWidth <= mobileWorkflow.clientWidth + 1, 'completed decision room should not overflow horizontally');
      assert.equal(mobileWorkflow.parentColumns.split(' ').length, 1, 'mobile output workspace should use one explicit grid column');
      await assertResponsiveWorkspace(page, { width: 768, height: 900 });
      assert.equal(await page.locator('#workflow').isVisible(), true, 'completed decision room should remain visible at 768px');
      await page.setViewportSize({ width: 1440, height: 1000 });

      assert.equal(await page.locator('#approvalButton').isEnabled(), true, 'explicit approval eligibility should unlock after a completed run');
      assert.equal(await page.locator('#remediationButton').isEnabled(), true, 'remediation request should unlock after a completed run');
      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('#approvalButton').click();
      await assertVisibleText(page, '#approvalActionStatus', /Human approval recorded/i);
      assert.equal(records.approval.at(-1).reviewerDecision, 'Approve');
      assert.equal(records.approval.at(-1).caseVersion, mockConversationCaseVersion);
      assert.equal(records.approval.at(-1).decision.status, 'ready');

      await primaryNav.getByRole('link', { name: 'Admin' }).click();
      await assertMainSectionVisible(page, 'admin', '#admin', /Admin Console/i);
      await primaryNav.getByRole('link', { name: 'Hardening' }).click();
      await assertMainSectionVisible(page, 'hardening', '#hardening', /Production hardening/i);
      await primaryNav.getByRole('link', { name: 'Agent' }).click();
      await assertMainSectionVisible(page, 'agent', '#run', /Compliance advisor/i);
      await page.locator('#councilOutputTab').click();
      await assertCouncilOutputVisible(page);
      await assertVisibleText(page, '#specialistList', /Managed platform integration services/i);

      const demoRunCountBefore = records.agentRun.length;
      await page.locator('#demoModeTab').click();
      await page.locator('[data-scenario="integrationVendor"]').click();
      await page.waitForFunction(() => document.body.dataset.runComplete === 'true', null, { timeout: 12_000 });
      await page.locator('#councilOutputTab').click();
      await assertCouncilOutputVisible(page);
      await assertVisibleText(page, '#specialistList', /OmniBridge Services LLC/i);
      assert.ok(records.agentRun.length > demoRunCountBefore, 'demo council run should call the agent run API');
      assert.match(records.demoCase.at(-1).filename, /^04_managed_platform_integration_services_agreement\.pdf$/);
      assert.match(records.agentRun.at(-1).caseId, /^demo-case-/);
      assert.equal(records.agentRun.at(-1).caseVersion, 1);
      assert.ok(await page.locator('#runHistorySelect option').count() >= 2, 'recent run history should keep previous completed runs');
      const persistedHistory = await page.evaluate(() => ({
        legacyLocalHistory: window.localStorage.getItem('p42:run-history'),
        browserSession: JSON.parse(window.sessionStorage.getItem('p42:browser-session') || 'null'),
        history: JSON.parse(window.sessionStorage.getItem('p42:run-history') || 'null')
      }));
      assert.equal(persistedHistory.legacyLocalHistory, null, 'full run results must never remain in browser-wide localStorage');
      assert.equal(persistedHistory.browserSession.sessionId, 'demo-session-e2e-1');
      assert.equal(persistedHistory.browserSession.workspaceId, 'demo:session-e2e-1');
      assert.equal(persistedHistory.history.version, 2);
      assert.match(persistedHistory.history.scopeId, /^demo:demo:session-e2e-1:demo-session-e2e-1$/);
      assert.ok(persistedHistory.history.records.every((record) => record.scopeId === persistedHistory.history.scopeId), 'each persisted history record must carry the active scope');
      const chatRunId = await page.locator('#runHistorySelect option')
        .filter({ hasText: 'Managed platform integration services agreement' })
        .first()
        .getAttribute('value');
      assert.match(chatRunId || '', /^run_/, 'chat run should remain selectable from run history');
      await page.locator('#runHistorySelect').selectOption(chatRunId);
      await assertCouncilOutputVisible(page);
      await assertVisibleText(page, '#specialistList', /Managed platform integration services agreement/i);

      await page.waitForLoadState('networkidle');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#councilOutputTab');
      assert.equal(records.demoSession.length, 1, 'same-tab refresh must reuse the same demo session');
      await page.locator('#councilOutputTab').click();
      await assertCouncilOutputVisible(page);
      await assertVisibleText(page, '#specialistList', /Managed platform integration services agreement/i);
      assert.equal(await page.locator('#approvalButton').isDisabled(), true, 'restored history must not mutate a prior ephemeral session');
      assert.equal(await page.locator('#remediationButton').isDisabled(), true, 'restored history remediation must stay read-only');

      await page.waitForLoadState('networkidle');
      await page.evaluate(() => window.sessionStorage.removeItem('p42:browser-session'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#councilOutputTab');
      await page.waitForFunction(() => document.querySelector('#runHistorySelect')?.disabled === true);
      assert.equal(records.demoSession.length, 2, 'missing session context must rotate to a fresh demo workspace');
      assert.equal(await page.evaluate(() => window.sessionStorage.getItem('p42:run-history')), null, 'scope rotation must purge the prior full history envelope');
      assert.equal(await page.evaluate(() => window.localStorage.getItem('p42:run-history')), null, 'scope rotation must not recreate legacy local history');
      await page.locator('#councilOutputTab').click();
      await assertCouncilOutputEmptyState(page);
      assert.doesNotMatch(await page.locator('#specialistList').textContent(), /Managed platform integration services agreement/i, 'prior session output must not remain visible after rotation');

      diagnostics.assertClean();
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  process.stdout.write('Playwright advisor regression mock test passed.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
