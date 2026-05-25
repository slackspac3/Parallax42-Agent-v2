'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const {
  ROOT,
  assertFirstViewportLayout,
  assertNonBlankWorkbench,
  assertVisibleText,
  attachBrowserDiagnostics,
  screenshotOnFailure,
  startServerIfNeeded,
  stopServer
} = require('./helpers');

const PORT = Number(process.env.PLAYWRIGHT_PORT || 3141);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const FIXTURE = path.join(ROOT, 'test-fixtures', 'compliance-documents', '04_managed_platform_integration_services_agreement.pdf');

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

function mockRunResult() {
  return {
    ok: true,
    mode: 'crewai_flow',
    case: {
      caseId: 'case-e2e-001',
      supplierName: 'Managed Platform Integration Partner',
      businessUnit: 'Finance',
      geography: 'UAE',
      integrations: ['Microsoft 365', 'Okta', 'SAP', 'Workday', 'Salesforce'],
      documents: [{ evidenceId: 'UP-MOCK-01', title: 'Managed platform integration services agreement' }]
    },
    decision: {
      status: 'conditional',
      recommendation: 'Ready for human approval with required controls',
      readinessScore: 0.88,
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
    gaps: [
      {
        gap: 'Confirm privileged implementation access owner',
        severity: 'medium',
        action: 'Reviewer must confirm named access owner and approval evidence.'
      }
    ],
    evidenceIds: ['UP-MOCK-01', 'DOC-CITE-01'],
    citations: [
      {
        evidenceId: 'UP-MOCK-01',
        citationId: 'DOC-CITE-01',
        title: 'Managed platform agreement',
        text: 'Agreement includes DPA, retention schedule, service continuity, and privileged access obligations.',
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
          evidenceId: 'UP-MOCK-01',
          title: 'Managed platform agreement',
          text: 'DPA, retention, and privileged access clauses were recovered from the uploaded service agreement.',
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
    return {
      reply: 'Council run complete. I kept the decision review-bound.',
      questions: [],
      runReadiness: { runnable: true, score: 0.88, missingFields: [] },
      caseDraft: baseDraft({
        ...body.caseDraft,
        businessUnit: body.caseDraft?.businessUnit || 'Finance',
        geography: body.caseDraft?.geography || 'UAE'
      }),
      conversationPlan: { usedLlm: true, nextBestAction: 'run_council' },
      nlp: { llmAssessment: { used: true, model: 'gpt-5.1', requestType: 'supplier_risk' } },
      run: mockRunResult()
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

  return {
    reply: 'I captured the useful facts and identified the next decision point.',
    questions: ['What do you need reviewed?'],
    runReadiness: { runnable: false, score: 0.1, missingFields: ['scope'] },
    caseDraft: baseDraft(body.caseDraft || {}),
    conversationPlan: { usedLlm: true, nextBestAction: 'ask_scope' },
    nlp: { llmAssessment: { used: true, model: 'gpt-5.1' } }
  };
}

async function installMocks(page, records) {
  await page.route('**/api/conversation', async (route) => {
    const body = route.request().postDataJSON();
    records.conversation.push(body);
    await route.fulfill(jsonResponse(conversationResponse(body)));
  });

  await page.route('**/api/agent/run', async (route) => {
    records.agentRun.push(route.request().postDataJSON());
    await route.fulfill(jsonResponse(mockRunResult()));
  });

  await page.route('**/api/evidence/index', async (route) => {
    records.evidenceIndex.push(route.request().postDataJSON());
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
  await assertVisibleText(page, '#workflow', /Executive decision room|Human approval required|Deterministic compliance engine/i);
  const specialistTextLength = await page.locator('#specialistList').evaluate((node) => (node.textContent || '').trim().length);
  assert.ok(specialistTextLength > 0, 'specialistList should contain decision output');
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
  const records = { agentRun: [], conversation: [], evidenceIndex: [], backend: [] };
  const diagnostics = attachBrowserDiagnostics(page, { baseUrl: BASE_URL });

  try {
    await installMocks(page, records);
    await screenshotOnFailure(page, 'advisor-regression-mock', async () => {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#chatInput');
      await assertNonBlankWorkbench(page);
      await assertFirstViewportLayout(page);

      await page.setViewportSize({ width: 1440, height: 900 });
      const primaryNav = page.getByRole('navigation', { name: 'Primary' });
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

      await page.locator('#chatEvidenceInput').setInputFiles(FIXTURE);
      await assertVisibleText(page, '#chatMessages', /Run council to produce|service agreement first|ready when you are|indexed citation-ready evidence/i, { timeout: 20_000 });
      assert.equal(records.conversation.at(-1).eventType, 'evidence_uploaded');
      assert.equal(records.conversation.at(-1).activeQuestion, '');
      assert.ok(records.evidenceIndex.length >= 1, 'evidence indexing API should be called after upload');
      await assertVisibleText(page, '#chatAttachmentStatus', /Evidence ready for council|citation-ready/i);
      await assertVisibleText(page, '#caseIntelDetails', /4 citation-ready|4 server-side|4 indexed/i);

      await page.locator('#chatRunNow').click();
      await page.waitForFunction(() => document.body.dataset.workspaceView === 'output', null, { timeout: 12_000 });
      await assertVisibleText(page, '#specialistList', /Human approval|Required Reviewer Actions|Evidence Quality|Specialist Collaboration/i);
      await assertVisibleText(page, '#workflow', /Executive decision room|Export review pack PDF|Deterministic compliance engine/i);
      await page.locator('#councilOutputTab').click();
      await assertCouncilOutputVisible(page);

      await primaryNav.getByRole('link', { name: 'Admin' }).click();
      await assertMainSectionVisible(page, 'admin', '#admin', /Admin Console/i);
      await primaryNav.getByRole('link', { name: 'Hardening' }).click();
      await assertMainSectionVisible(page, 'hardening', '#hardening', /Production hardening/i);
      await primaryNav.getByRole('link', { name: 'Agent' }).click();
      await assertMainSectionVisible(page, 'agent', '#run', /Compliance advisor/i);
      await page.locator('#councilOutputTab').click();
      await assertCouncilOutputVisible(page);

      await page.locator('#demoModeTab').click();
      await page.locator('[data-scenario="financeVendor"]').click();
      await page.waitForFunction(() => document.body.dataset.runComplete === 'true', null, { timeout: 12_000 });
      await page.locator('#councilOutputTab').click();
      await assertCouncilOutputVisible(page);
      assert.ok(records.agentRun.length >= 1, 'demo council run should call the agent run API');

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
