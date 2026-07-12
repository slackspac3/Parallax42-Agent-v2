'use strict';

const DEFAULT_DOCUMENT_TITLE = document.title || 'Parallax42 Compliance Intelligence Agent';
const runtimeDefaults = window.P42_CONFIG || {};
const storageKeys = {
  mode: 'p42:api-mode',
  relayUrl: 'p42:relay-url',
  backendUrl: 'p42:backend-url',
  adminBearerToken: 'p42:admin-bearer-token',
  evidenceIndexMeta: 'p42:evidence-index-meta',
  browserSession: 'p42:browser-session',
  runHistory: 'p42:run-history',
  chatSession: 'p42:chat-session'
};

const scenarios = {
  exportControl: {
    businessUnit: 'Research Compute Operations',
    geography: 'UAE and Singapore',
    supplierName: 'HelioChip Logistics',
    brief: 'Import restricted AI accelerator hardware for an internal research compute cluster, with freight forwarding, firmware support, chain-of-custody evidence, and remote diagnostic access.',
    documents: [
      {
        title: 'Export-control intake summary',
        summary: 'Freight forwarder screened clean. Manufacturer classification, end-use certificate, import permit, and firmware support runbook are not final.'
      }
    ],
    integrations: ['Freight forwarder portal', 'Asset inventory', 'Firmware support channel'],
    evidenceQueue: ['Denied-party screening', 'Draft end-use certificate', 'Chain-of-custody plan']
  },
  modelOpsVendor: {
    businessUnit: 'Group Technology Risk',
    geography: 'UAE',
    supplierName: 'ModelOps Review Platform',
    brief: 'Procure a model operations platform that processes employee support data, integrates with identity and ticketing systems, and supports finance reporting across the UAE.',
    documents: [
      {
        title: 'Supplier assurance summary',
        summary: 'SOC 2 summary available. No signed DPA, model-training exclusion, or continuity plan attached.'
      }
    ],
    integrations: ['Azure AD', 'ServiceNow', 'Finance reporting'],
    evidenceQueue: ['SOC 2 summary', 'Azure AD integration note', 'Finance reporting scope']
  },
  integrationVendor: {
    businessUnit: 'Enterprise Platforms',
    geography: 'UAE',
    supplierName: 'OmniBridge Services LLC',
    brief: 'Review a managed integration partner connecting ERP, HRIS, CRM, ITSM, collaboration, warehouse, and reporting platforms with privileged implementation access.',
    documents: [
      {
        title: 'Managed integration assurance summary',
        summary: 'Privileged access approval, the DPA, continuity evidence, release-control signoff, and the secrets rotation plan are incomplete.'
      }
    ],
    integrations: ['ERP', 'HRIS', 'ServiceNow', 'SharePoint', 'Data warehouse'],
    evidenceQueue: ['Managed services agreement', 'Integration scope', 'Privileged access matrix']
  },
  saasVendor: {
    businessUnit: 'Group Technology Risk',
    geography: 'UAE',
    supplierName: 'VectorCloud Systems Inc.',
    brief: 'Review an enterprise SaaS platform for workflow automation, supplier analytics, CRM reporting, case management, and AI-assisted summaries.',
    documents: [
      {
        title: 'Enterprise SaaS assurance summary',
        summary: 'SOC 2 summary is available, but the signed DPA, model-training exclusion, continuity plan, subprocessor schedule, and production access approval are incomplete.'
      }
    ],
    integrations: ['CRM', 'Case management', 'SSO'],
    evidenceQueue: ['Master services agreement', 'SOC 2 summary', 'AI summaries clause']
  }
};

const demoFixtureFilenames = Object.freeze({
  exportControl: '03_ai_accelerator_chip_import_export_control_agreement.pdf',
  integrationVendor: '04_managed_platform_integration_services_agreement.pdf',
  saasVendor: '01_enterprise_saas_master_services_agreement.pdf'
});

const form = document.querySelector('#agentForm');
const runtimeConfig = document.querySelector('#runtimeConfig');
const sampleRun = document.querySelector('#sampleRun');
const exportRun = document.querySelector('#exportRun');
const execReviewPack = document.querySelector('#execReviewPack');
const runHistorySelect = document.querySelector('#runHistorySelect');
const formRunButton = document.querySelector('#formRunButton');
const resetConfig = document.querySelector('#resetConfig');
const apiMode = document.querySelector('#apiMode');
const relayUrl = document.querySelector('#relayUrl');
const backendUrl = document.querySelector('#backendUrl');
const adminBearerToken = document.querySelector('#adminBearerToken');
const pilotAccessForm = document.querySelector('#pilotAccessForm');
const pilotAccessCode = document.querySelector('#pilotAccessCode');
const pilotAccessSubmit = document.querySelector('#pilotAccessSubmit');
const pilotLogout = document.querySelector('#pilotLogout');
const pilotAccessStatus = document.querySelector('#pilotAccessStatus');
const pilotAppLink = document.querySelector('#pilotAppLink');
const topbarSectionLinks = document.querySelectorAll('.topbar nav a[data-main-section]');
const runModeButtons = document.querySelectorAll('.mode-tab[data-run-mode]');
const workspaceTabButtons = document.querySelectorAll('.mode-tab[role="tab"]');
const caseWorkspacePanel = document.querySelector('#caseWorkspacePanel');
const workflowPanel = document.querySelector('#workflow');
const casePanelEyebrow = document.querySelector('#casePanelEyebrow');
const casePanelTitle = document.querySelector('#casePanelTitle');
const startNewCase = document.querySelector('#startNewCase');
const runwayTitle = document.querySelector('#runwayTitle');
const runwayDescription = document.querySelector('#runwayDescription');
const decisionText = document.querySelector('#decisionText');
const approvalStatus = document.querySelector('#approvalStatus');
const approvalButton = document.querySelector('#approvalButton');
const remediationButton = document.querySelector('#remediationButton');
const approvalActionStatus = document.querySelector('#approvalActionStatus');
const exportActionStatus = document.querySelector('#exportActionStatus');
const runtimeText = document.querySelector('#runtimeText');
const readinessScore = document.querySelector('#readinessScore');
const evidenceCount = document.querySelector('#evidenceCount');
const gapCount = document.querySelector('#gapCount');
const flowProgress = document.querySelector('#flowProgress');
const stageKicker = document.querySelector('#stageKicker');
const stageStatus = document.querySelector('#stageStatus');
const stageOutput = document.querySelector('#stageOutput');
const domainList = document.querySelector('#domainList');
const gapList = document.querySelector('#gapList');
const traceList = document.querySelector('#traceList');
const rawRunDetails = document.querySelector('#rawRunDetails');
const rawRunJson = document.querySelector('#rawRunJson');
const readinessList = document.querySelector('#readinessList');
const specialistList = document.querySelector('#specialistList');
const artifactPreview = document.querySelector('#artifactPreview');
const evidenceQueue = document.querySelector('#evidenceQueue');
const evidenceInput = document.querySelector('#evidenceInput');
const evidenceDropzone = document.querySelector('#evidenceDropzone');
const evidenceIngestionStatus = document.querySelector('#evidenceIngestionStatus');
const citationList = document.querySelector('#citationList');
const benchmarkSummary = document.querySelector('#benchmarkSummary');
const deploymentStatus = document.querySelector('#deploymentStatus');
const capabilityFallbacks = document.querySelector('#capabilityFallbacks');
const adminStatusDashboard = document.querySelector('#adminStatusDashboard');
const copyAdminDiagnostics = document.querySelector('#copyAdminDiagnostics');
const adminDiagnosticsCopyStatus = document.querySelector('#adminDiagnosticsCopyStatus');
const adminFeatureControls = document.querySelector('#adminFeatureControls');
const adminAuditLog = document.querySelector('#adminAuditLog');
const refreshAdminAuditLog = document.querySelector('#refreshAdminAuditLog');
const readinessJsonLink = document.querySelector('#readinessJsonLink');
const benchmarksJsonLink = document.querySelector('#benchmarksJsonLink');
const goldenDemoLink = document.querySelector('#goldenDemoLink');
const topHealth = document.querySelector('#topHealth');
const councilOutputTab = document.querySelector('#councilOutputTab');
const decisionRail = document.querySelector('.decision-rail');
const intelRailTabs = document.querySelectorAll('[data-intel-rail-tab]');
const missionWelcome = document.querySelector('#missionWelcome');
const caseIntelligencePanel = document.querySelector('#caseIntelligencePanel');
const caseDraftPanel = document.querySelector('#caseDraftPanel');
const caseIntelReadiness = document.querySelector('#caseIntelReadiness');
const caseIntelDetails = document.querySelector('#caseIntelDetails');
const chatMessagesEl = document.querySelector('#chatMessages');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const chatInputCounter = document.querySelector('#chatInputCounter');
const chatSubmit = document.querySelector('#chatSubmit');
const chatRunNow = document.querySelector('#chatRunNow');
const chatEvidenceInput = document.querySelector('#chatEvidenceInput');
const chatEvidencePicker = document.querySelector('.chat-evidence-picker');
const chatAttachmentStatus = document.querySelector('#chatAttachmentStatus');
const chatAttachmentList = document.querySelector('#chatAttachmentList');
const agentActivity = document.querySelector('#agentActivity');
const contextStrengthLabel = document.querySelector('#contextStrengthLabel');
const contextStrengthBar = document.querySelector('#contextStrengthBar');
const contextStrengthText = document.querySelector('#contextStrengthText');
const chatPromptButtons = document.querySelectorAll('[data-chat-prompt]');
let lastRun = null;
const lastRuns = {
  demo: null,
  live: null,
  chat: null
};
let latestCompletedRunMode = null;
let latestCompletedRun = null;
let completedRunHistory = [];
const currentSessionRunIds = new Set();
let activeRunMode = 'chat';
let currentScenarioKey = 'exportControl';
let demoSessionToken = '';
let demoSessionPromise = null;
let pilotSessionActive = false;
let activeBrowserSession = null;
let playbackTimers = [];
let uploadedEvidence = [];
let evidenceIndexMeta = {};
let evidenceUploadPromise = null;
let evidenceUploadActive = false;
let conversationRequestActive = false;
let agentRunActive = false;
let decisionActionMode = 'idle';
let evidenceIndexValidation = {
  status: 'not_checked',
  detail: 'No restored evidence index metadata has been checked.'
};
let adminFeatureState = null;
let adminStatusState = null;
let humanReviewRecord = null;
let chatCaseDraft = {};
let activeMainSection = 'agent';
document.body.dataset.mainSection = activeMainSection;
let chatRunReadiness = null;
let chatMissingFields = [];
let workspaceView = 'chat';
let activeIntelRailTab = 'case';
let activeQuestion = 'What do you need reviewed?';
let activeQuestionId = '';
let activeQuestionField = '';
let lastCouncilNarrative = null;
let liveCasePreviewTimer = null;
let chatSessionSaveTimer = null;
let renderedChatMessageSignatures = [];
let chatMessages = [
  {
    role: 'assistant',
    text: 'What do you need reviewed?',
    displayedQuestion: 'What do you need reviewed?',
    displayedQuestionId: '',
    displayedQuestionField: ''
  }
];

const runModeCopy = {
  demo: {
    caseEyebrow: 'Demo workspace',
    caseTitle: 'Golden review file',
    runwayTitle: 'Watch the agent work',
    runwayDescription: 'Preset scenarios replay the submission workflow with deterministic evidence and trace output.',
    runButton: 'Run demo',
    actionButton: 'Watch demo',
    waitingDecision: 'Demo not started',
    waitingApproval: 'Choose a preset case and run the guided replay.'
  },
  live: {
    caseEyebrow: 'Live workspace',
    caseTitle: 'Compliance intake',
    runwayTitle: 'Run a live case',
    runwayDescription: 'Submit the edited intake and uploaded evidence to the configured governed agent runtime.',
    runButton: 'Run live case',
    actionButton: 'Run live',
    waitingDecision: 'Live run not started',
    waitingApproval: 'Attach evidence or edit the intake, then run the live case.'
  },
  chat: {
    caseEyebrow: 'Conversation',
    caseTitle: 'Compliance advisor',
    runwayTitle: 'Case command',
    runwayDescription: 'The advisor turns intake into a traceable agent run with explicit blockers and evidence IDs.',
    runButton: 'Ask agent',
    actionButton: 'Run council',
    waitingDecision: 'Conversation ready',
    waitingApproval: 'Ask a question to produce a traceable compliance answer.'
  }
};

const defaultAgentActivity = [
  { id: 'intake', label: 'Intake Agent', detail: 'listening', status: 'active' },
  { id: 'obligations', label: 'Obligation Mapper', detail: 'queued', status: 'queued' },
  { id: 'evidence', label: 'Evidence Examiner', detail: 'queued', status: 'queued' },
  { id: 'controls', label: 'Risk & Controls', detail: 'queued', status: 'queued' },
  { id: 'review', label: 'Responsible AI', detail: 'queued', status: 'queued' },
  { id: 'packager', label: 'Audit Packager', detail: 'queued', status: 'queued' }
];

const councilVisualAgents = [
  { id: 'intake', label: 'Intake Agent', short: 'Intake', x: 18, y: 31, svgX: 88, svgY: 82, handoff: 'Normalizes the case draft for obligation mapping.' },
  { id: 'obligations', label: 'Obligation Mapper', short: 'Obligations', x: 36, y: 15, svgX: 286, svgY: 54, handoff: 'Routes applicable domains to evidence review.' },
  { id: 'evidence', label: 'Evidence Examiner', short: 'Evidence', x: 79, y: 30, svgX: 536, svgY: 86, handoff: 'Promotes citation-ready proof into controls.' },
  { id: 'controls', label: 'Risk & Controls Analyst', short: 'Controls', x: 79, y: 72, svgX: 542, svgY: 306, handoff: 'Converts gaps into reviewer actions.' },
  { id: 'review', label: 'Responsible AI Reviewer', short: 'RAI', x: 50, y: 84, svgX: 296, svgY: 354, handoff: 'Locks the human approval boundary.' },
  { id: 'packager', label: 'Audit Packager', short: 'Audit', x: 21, y: 70, svgX: 88, svgY: 300, handoff: 'Packages decision, trace, evidence IDs, and exports.' }
];

const councilRunAnimationFrames = [
  { id: 'intake', detail: 'extracting facts', handoff: 'Case facts -> obligation mapping' },
  { id: 'obligations', detail: 'mapping domains', handoff: 'Applicable domains -> evidence retrieval' },
  { id: 'evidence', detail: 'retrieving proof', handoff: 'Citation-ready evidence -> control review' },
  { id: 'controls', detail: 'challenging gaps', handoff: 'Unresolved gaps -> reviewer actions' },
  { id: 'review', detail: 'validating boundary', handoff: 'Human-review boundary -> audit packaging' },
  { id: 'packager', detail: 'sealing trace', handoff: 'Decision, trace, and evidence IDs -> review pack' }
];

let councilFocusAgent = 'intake';
let lastCouncilActivity = defaultAgentActivity;
let councilRunAnimationTimer = null;
let councilRunAnimationActive = false;
let councilRunAnimationFrameIndex = 0;

const agentLabels = {
  runtime_router: 'Runtime Router',
  intake_agent: 'Compliance Orchestrator',
  compliance_orchestrator: 'Compliance Orchestrator',
  domain_scanner_agent: 'Regulatory Obligation Mapper',
  regulatory_obligation_mapper: 'Regulatory Obligation Mapper',
  evidence_agent: 'Evidence Examiner',
  evidence_examiner: 'Evidence Examiner',
  control_agent: 'Risk And Control Analyst',
  risk_control_analyst: 'Risk And Control Analyst',
  output_review_agent: 'Responsible AI Reviewer',
  responsible_ai_reviewer: 'Responsible AI Reviewer',
  audit_packager: 'Audit Packager'
};

const readinessCopy = {
  productionDeployment: {
    label: 'Live deployment',
    proof: 'GitHub Pages cockpit, Vercel API, Parallax42 backend, Compass gateway',
    next: 'Keep endpoint evidence fresh for final submission.'
  },
  sovereignLlmBoundary: {
    label: 'Sovereign model boundary',
    proof: 'Compass gateway is live and server-side; no browser model keys',
    next: 'Add gateway smoke-test artifact and threat model.'
  },
  auditTraceability: {
    label: 'Audit traceability',
    proof: 'Tenant-scoped PostgreSQL hash chains use transactional sequencing and integrity verification',
    next: 'Add immutable/WORM exports before claiming enterprise retention.'
  },
  rbac: {
    label: 'RBAC and authentication',
    proof: 'Route policy and JWT validation are implemented with Entra-ready configuration',
    next: 'Set P42_AUTH_MODE=enforced and configure Entra issuer, audience, tenant, and JWKS.'
  },
  evidenceRetrieval: {
    label: 'Evidence retrieval',
    proof: 'Browser keeps case/evidence IDs while embeddings and chunks stay behind server-side APIs',
    next: 'Configure Qdrant or approved managed vector DB for durable enterprise retention.'
  },
  benchmarks: {
    label: 'Benchmarks',
    proof: 'Golden evals and local benchmark suite pass',
    next: 'Add live latency, upload/OCR, adversarial, and fallback benchmarks.'
  },
  responsibleAi: {
    label: 'Responsible AI',
    proof: 'Human approval, no auto-approval, and output review checks are active',
    next: 'Add adversarial evals and live LLM output graders.'
  },
  videoDemo: {
    label: 'Video demo',
    proof: 'Golden workflow and demo script are ready',
    next: 'Record the Watch the Agent Work walkthrough.'
  }
};

const fallbackStages = [
  { role: 'Compliance Orchestrator', agent: 'compliance_orchestrator', method: 'load_case', expectedTraceEvent: 'case_loaded' },
  { role: 'Regulatory Obligation Mapper', agent: 'regulatory_obligation_mapper', method: 'map_obligations', expectedTraceEvent: 'domains_scanned' },
  { role: 'Evidence Examiner', agent: 'evidence_examiner', method: 'examine_evidence', expectedTraceEvent: 'evidence_mapped' },
  { role: 'Risk And Control Analyst', agent: 'risk_control_analyst', method: 'recommend_controls', expectedTraceEvent: 'controls_recommended' },
  { role: 'Responsible AI Reviewer', agent: 'responsible_ai_reviewer', method: 'review_responsible_ai', expectedTraceEvent: 'output_review_completed' },
  { role: 'Audit Packager', agent: 'audit_packager', method: 'package_audit_brief', expectedTraceEvent: 'output_review_completed' }
];

const readableEvidenceExtensions = new Set(['txt', 'md', 'markdown', 'json', 'csv', 'log']);
const backendParsedEvidenceExtensions = new Set(['pdf', 'docx', 'txt', 'md', 'markdown', 'json', 'csv', 'log']);
const maxEvidenceFileBytes = 30 * 1024 * 1024;
const maxEvidenceBatchBytes = 90 * 1024 * 1024;
const textEvidenceSampleBytes = 180 * 1024;
const defaultUploadChunkBytes = 1024 * 1024;
const chatInputMaxChars = 64000;
const chatMessageLimit = 80;
const conversationPayloadHistoryTurns = 12;
const uploadChunkMaxAttempts = 3;
const fallbackRequestLimitBytes = {
  conversation: 8 * 1024 * 1024,
  evidenceIndex: 15 * 1024 * 1024,
  evidenceSearch: 4 * 1024 * 1024,
  reviewPack: 8 * 1024 * 1024,
  standardRun: 8 * 1024 * 1024,
  admin: 512 * 1024
};
const fallbackLlmRetrySettings = {
  maxAttempts: 3,
  fastFailMs: 6500,
  backoffBaseMs: 600,
  maxRetryDelayMs: 1500,
  rateLimitMaxRetryDelayMs: 2000,
  retryJitterMs: 150
};
const fallbackLlmTokenSettings = {
  structuredMaxTokens: 1600,
  retryStructuredMaxTokens: 1600,
  naturalResponseMaxTokens: 900,
  naturalResponseMaxChars: 3600
};
const fallbackContextSettings = {
  historyTurns: 20,
  turnMaxChars: 1200,
  recentTurnsForPrompt: conversationPayloadHistoryTurns,
  compactRecentTurnsForPrompt: 6,
  briefMaxChars: 2500,
  documentSummaryMaxChars: 900,
  memorySummaryMaxChars: 2500
};
const evidencePipelineSteps = [
  { id: 'queue', label: 'Hashing evidence' },
  { id: 'session', label: 'Opening parser session' },
  { id: 'upload', label: 'Uploading chunks' },
  { id: 'parse', label: 'Parser/OCR running' },
  { id: 'embed', label: 'Embedding/indexing' },
  { id: 'ready', label: 'Citation-ready' }
];
const evidenceSignalPatterns = [
  ['export control', /export control|classification|end[- ]use|end user|import permit|sanctions|restricted party|freight forwarder/i],
  ['chain of custody', /chain[- ]of[- ]custody|serial number|asset inventory|firmware|remote access|warehouse|customs/i],
  ['DPA', /dpa|data processing agreement|subprocessor|retention|deletion|transfer/i],
  ['model training exclusion', /no\s+(customer\s+)?data\s+(is\s+)?used\s+for\s+(model\s+)?training|model[- ]training exclusion|training exclusion|no training/i],
  ['continuity', /continuity|business continuity|bcp|disaster recovery|dr plan|exit assistance|exit support/i],
  ['identity access', /azure ad|entra|sso|single sign[- ]on|privileged access|rbac|mfa/i],
  ['finance controls', /payment|finance|ledger|invoice|approval authority|project governance/i],
  ['security assurance', /soc\s*2|iso\s*27001|encryption|vulnerability|logging|audit/i]
];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readStorage(key, fallback = '') {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Local storage is optional for embedded/browser privacy modes.
  }
}

function readSessionStorage(key, fallback = '') {
  try {
    return window.sessionStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeSessionStorage(key, value) {
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Session storage is optional for embedded/browser privacy modes.
  }
}

function readAdminBearerToken() {
  const sessionToken = readSessionStorage(storageKeys.adminBearerToken);
  if (sessionToken) return sessionToken;
  const persistedToken = readStorage(storageKeys.adminBearerToken);
  if (persistedToken) {
    writeStorage(storageKeys.adminBearerToken, '');
    writeSessionStorage(storageKeys.adminBearerToken, persistedToken);
  }
  return persistedToken;
}

function writeAdminBearerToken(value = '') {
  const previous = readSessionStorage(storageKeys.adminBearerToken).trim();
  const next = String(value || '').trim();
  writeStorage(storageKeys.adminBearerToken, '');
  writeSessionStorage(storageKeys.adminBearerToken, next);
  if (previous !== next) purgeBrowserSessionArtifacts({ resetView: true });
}

function privilegedDiagnosticsRequested() {
  return Boolean(readAdminBearerToken().trim() || pilotSessionActive);
}

function authorizationHeaderPresent(headers = {}) {
  if (headers instanceof Headers) return headers.has('authorization');
  return Object.keys(headers || {}).some((key) => key.toLowerCase() === 'authorization');
}

function sessionAuthHeaders(headers = {}) {
  const token = readAdminBearerToken().trim() || (pilotSessionActive ? '' : demoSessionToken);
  if (!token) return headers;
  if (headers instanceof Headers) {
    const next = new Headers(headers);
    if (!next.has('authorization')) next.set('Authorization', `Bearer ${token}`);
    return next;
  }
  const next = { ...(headers || {}) };
  if (!authorizationHeaderPresent(next)) next.Authorization = `Bearer ${token}`;
  return next;
}

function withSessionAuth(options = {}) {
  return {
    ...options,
    headers: sessionAuthHeaders(options.headers || {})
  };
}

async function ensureDemoSession() {
  if (readAdminBearerToken().trim()) return '';
  if (pilotSessionActive && activeBrowserSession?.sessionType === 'pilot') return '';
  if (demoSessionToken && activeBrowserSession?.sessionType === 'demo') return demoSessionToken;
  if (demoSessionPromise) return demoSessionPromise;
  demoSessionPromise = fetchJson(apiUrl('/api/demo/session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  }).then((session) => {
    const token = cleanText(session?.token);
    if (!token) throw new Error('Demo session did not return an access token.');
    activateBrowserSession(session, { sessionType: 'demo', token });
    return token;
  }).finally(() => {
    demoSessionPromise = null;
  });
  return demoSessionPromise;
}

function isPilotCookieOrigin() {
  try {
    const configuredOrigin = new URL(runtimeDefaults.defaultRelayUrl || '').origin;
    return window.location.origin === configuredOrigin || /\.vercel\.app$/i.test(window.location.hostname);
  } catch {
    return /\.vercel\.app$/i.test(window.location.hostname);
  }
}

function renderPilotAccessState(message = '', state = 'idle') {
  if (!pilotAccessForm || !pilotAccessStatus) return;
  const available = isPilotCookieOrigin();
  const working = state === 'working';
  pilotAccessCode.disabled = !available || pilotSessionActive || working;
  pilotAccessSubmit.disabled = !available || pilotSessionActive || working;
  pilotLogout.hidden = !available || !pilotSessionActive;
  pilotAppLink.hidden = available;
  pilotAccessStatus.dataset.state = state;
  pilotAccessStatus.textContent = message || (available
    ? pilotSessionActive
      ? 'Pilot session active. Requests use the secure same-origin cookie.'
      : 'Public demo session active. Enter an approved code to use a private pilot workspace.'
    : 'Access-code pilot sessions require the same-origin Vercel app. Open the Vercel pilot to continue.');
}

async function startPilotSession(code = '') {
  if (!isPilotCookieOrigin()) {
    renderPilotAccessState('', 'warning');
    return null;
  }
  pilotAccessSubmit.disabled = true;
  renderPilotAccessState('Starting the private pilot session…', 'working');
  try {
    const session = await fetchJson('/api/auth/access-code', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanText(code) })
    });
    activateBrowserSession(session, { sessionType: 'pilot' });
    if (pilotAccessCode) pilotAccessCode.value = '';
    renderPilotAccessState(`Pilot workspace active until ${new Date(session.expiresAt).toLocaleString()}.`, 'ready');
    await Promise.all([loadDeploymentStatus(), loadAdminStatus(), loadAuditLog()]);
    return session;
  } catch (error) {
    renderPilotAccessState(error instanceof Error ? error.message : 'The access code could not be exchanged.', 'danger');
    return null;
  } finally {
    if (!pilotSessionActive && pilotAccessSubmit) pilotAccessSubmit.disabled = false;
  }
}

async function endPilotSession() {
  if (!isPilotCookieOrigin()) return;
  pilotLogout.disabled = true;
  renderPilotAccessState('Signing out of the pilot workspace…', 'working');
  try {
    await fetchJson('/api/auth/logout', { method: 'POST', credentials: 'include' });
    deactivateBrowserSession({ resetView: true });
    await ensureDemoSession();
    renderPilotAccessState('Pilot session ended. Public demo access is active.', 'ready');
    await Promise.all([loadDeploymentStatus(), loadAdminStatus(), loadAuditLog()]);
  } catch (error) {
    renderPilotAccessState(error instanceof Error ? error.message : 'The pilot session could not be ended.', 'danger');
  } finally {
    pilotLogout.disabled = false;
  }
}

function stripTrailingSlash(value, fallback = '') {
  return String(value || fallback || '').trim().replace(/\/+$/, '');
}

function isLocalOrigin() {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

function resolveMode(mode) {
  if (mode === 'local' || mode === 'relay' || mode === 'live') return mode;
  return isLocalOrigin() ? 'local' : 'relay';
}

function currentConfig() {
  const configuredMode = readStorage(storageKeys.mode, runtimeDefaults.defaultMode || 'auto');
  const resolvedMode = resolveMode(configuredMode);
  return {
    configuredMode,
    resolvedMode,
    relayUrl: stripTrailingSlash(readStorage(storageKeys.relayUrl), runtimeDefaults.defaultRelayUrl || window.location.origin),
    backendEnabled: runtimeDefaults.backendEnabled !== false,
    gatewayEnabled: runtimeDefaults.gatewayEnabled !== false,
    backendUrl: stripTrailingSlash(readStorage(storageKeys.backendUrl), runtimeDefaults.defaultBackendUrl || 'https://api.parallax42.bhavukarora.com'),
    gatewayHealthUrl: String(runtimeDefaults.defaultGatewayHealthUrl || 'https://parallax42-compass-gateway.vercel.app/api/health').trim()
  };
}

function apiBaseUrl() {
  const config = currentConfig();
  return config.resolvedMode === 'local' ? '' : config.relayUrl;
}

function apiUrl(path) {
  const value = path.startsWith('/') ? path : `/${path}`;
  const base = apiBaseUrl();
  return base ? `${base}${value}` : value;
}

function backendHealthUrl(config) {
  if (config.resolvedMode === 'relay') {
    return `${config.relayUrl}/api/backend?path=${encodeURIComponent('/health')}`;
  }
  return `${config.backendUrl}/health`;
}

function backendStatusCheck(config) {
  if (config.resolvedMode === 'local') {
    return {
      label: 'Parallax42 backend',
      url: config.backendUrl,
      skipFetch: true,
      status: 'captured',
      tone: 'warning',
      detail: 'Live health is captured in evidence/live-health.json; switch to relay mode for browser relay checks.'
    };
  }
  if (!config.backendEnabled) {
    return {
      label: 'Optional parser relay',
      url: backendHealthUrl(config),
      skipFetch: true,
      status: 'disabled',
      tone: 'ready',
      detail: 'External parser/OCR is intentionally disabled. Replay fixtures, typed evidence, deterministic council execution, Qdrant retrieval, and PDF export remain available.'
    };
  }
  return {
    label: 'Parallax42 backend',
    url: backendHealthUrl(config),
    sessionAuth: true,
    detail: (body) => body?.status || body?.service || body?.ok || 'Backend responded'
  };
}

function gatewayStatusCheck(config) {
  if (!config.gatewayEnabled) {
    return {
      label: 'Optional Compass gateway',
      url: config.gatewayHealthUrl,
      skipFetch: true,
      status: 'not configured',
      tone: 'ready',
      detail: 'Compass smart intake and semantic embeddings are optional. This public demo uses deterministic intake, policy logic, and labelled hash-vector retrieval.'
    };
  }
  return {
    label: 'Compass gateway',
    url: apiUrl('/api/compass/probe'),
    detail: (body) => body?.gateway_auth_verified
      ? `${body.model || 'Compass'} gateway authenticated; live model use is reported per interaction.`
      : body?.message || 'Gateway authentication could not be verified.'
  };
}

async function fetchJson(url, options = {}) {
  if (window.P42AppModules?.apiClient?.fetchJson) {
    return window.P42AppModules.apiClient.fetchJson(url, options);
  }
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function apiFetch(path, options = {}) {
  await ensureDemoSession();
  return fetchJson(apiUrl(path), withSessionAuth(options));
}

function backendApiUrl(path) {
  const config = currentConfig();
  const value = path.startsWith('/') ? path : `/${path}`;
  if (config.resolvedMode === 'local') {
    return `${config.backendUrl}${value}`;
  }
  return `${config.relayUrl}/api/backend?path=${encodeURIComponent(value)}`;
}

async function backendApiFetch(path, options = {}) {
  await ensureDemoSession();
  return fetchJson(backendApiUrl(path), withSessionAuth(options));
}

function adminMutationHeaders(headers = {}) {
  return sessionAuthHeaders(headers);
}

function isAuthorizationError(error) {
  const status = Number(error?.status || error?.body?.statusCode || 0);
  const code = cleanText(error?.body?.error || error?.body?.code || '');
  const detail = cleanText(error?.body?.detail || error?.message || '');
  return status === 401
    || code === 'authentication_required'
    || code === 'invalid_token'
    || /bearer jwt|demo bearer token|authorization required|authentication required/i.test(detail);
}

function authorizationRecoveryMessage(target = 'API') {
  const label = cleanText(target) || 'API';
  return `${label} authorization is required. Add the private demo/JWT bearer token in Admin > Runtime settings, save runtime, and retry.`;
}

const statusTones = Object.freeze({
  active: 'info',
  applicable: 'ready',
  captured: 'warning',
  checking: 'checking',
  complete: 'ready',
  conditional: 'warning',
  conditionally_ready: 'warning',
  configured: 'ready',
  error: 'danger',
  escalated: 'warning',
  fallback_used: 'warning',
  healthy: 'ready',
  human_review_recorded: 'ready',
  missing: 'danger',
  needs_confirmation: 'warning',
  needs_review: 'warning',
  needs_revision: 'warning',
  not_applicable: 'info',
  not_checked: 'warning',
  not_ready: 'danger',
  ok: 'ready',
  partial: 'warning',
  passed: 'ready',
  pending: 'warning',
  queued: 'warning',
  ready: 'ready',
  retry: 'warning',
  satisfied: 'ready',
  success: 'ready',
  unavailable: 'danger',
  validated: 'ready',
  weak: 'warning'
});

function normalizedStatusKey(value = '') {
  return cleanText(value).toLowerCase().replace(/[\s-]+/g, '_');
}

function statusTone(value = '', fallback = 'danger') {
  return statusTones[normalizedStatusKey(value)] || fallback;
}

function statusClass(tone = 'danger') {
  return `status-${['ready', 'warning', 'danger', 'info', 'checking'].includes(tone) ? tone : 'danger'}`;
}

function uiComponentAttributes(slot, state) {
  return window.P42AppModules.appState.componentAttributes(slot, state);
}

function setUiComponentState(node, slot, state) {
  window.P42AppModules.appState.setComponentState(node, slot, state);
}

function setTabSelection(button, selected) {
  window.P42AppModules.appState.setTabSelection(button, selected);
}

function humanize(value = '') {
  return String(value || '').replaceAll('_', ' ');
}

function unique(values = []) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function titleCase(value = '') {
  return humanize(value)
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bRbac\b/g, 'RBAC');
}

function formatRuntime(value = '') {
  const runtimes = {
    crewai_flow: 'CrewAI Flow',
    crewai_flow_dry_run: 'CrewAI Flow dry run',
    crewai_llm: 'CrewAI live LLM',
    deterministic: 'Deterministic guardrail',
    js_static: 'JavaScript static manifest',
    python_dry_run: 'Python dry-run manifest'
  };
  return runtimes[value] || titleCase(value || 'runtime');
}

function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename, text, type = 'text/markdown') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64(filename, base64, type = 'application/pdf') {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileExtension(fileName = '') {
  return window.P42AppModules.evidenceUploadUi.fileExtension(fileName);
}

function formatBytes(bytes = 0) {
  return window.P42AppModules.evidenceUploadUi.formatBytes(bytes);
}

function formatInteger(value = 0) {
  const number = Math.max(0, Math.round(Number(value || 0)));
  return number.toLocaleString();
}

function updateChatInputCounter() {
  if (!chatInput || !chatInputCounter) return;
  if (!chatInput.maxLength || chatInput.maxLength < 0) chatInput.maxLength = chatInputMaxChars;
  const max = chatInput.maxLength > 0 ? chatInput.maxLength : chatInputMaxChars;
  const length = chatInput.value.length;
  const remaining = max - length;
  chatInputCounter.textContent = `${formatInteger(length)} / ${formatInteger(max)} chars`;
  chatInputCounter.dataset.state = remaining < 0 ? 'over' : length >= Math.floor(max * 0.9) ? 'near' : 'ok';
}

function numericSetting(value, fallback, options = {}) {
  const raw = value && typeof value === 'object'
    ? value.bytes || value.limitBytes || value.value || value.sizeBytes
    : value;
  const number = Number(raw);
  const minimum = options.allowZero ? 0 : 1;
  return Number.isFinite(number) && number >= minimum ? Math.round(number) : fallback;
}

function clientFallbackOperationalSettings() {
  return {
    requestLimits: { ...fallbackRequestLimitBytes },
    uploadTargetLimits: {
      maxFileBytes: maxEvidenceFileBytes,
      maxBatchBytes: maxEvidenceBatchBytes,
      chunkSizeBytes: defaultUploadChunkBytes
    },
    llmRetry: { ...fallbackLlmRetrySettings },
    llmTokens: { ...fallbackLlmTokenSettings },
    context: { ...fallbackContextSettings }
  };
}

function adminOperationalSettings(status = adminStatusState) {
  const fallback = clientFallbackOperationalSettings();
  const settings = status?.settings || status?.operationalSettings || {};
  const requestLimits = settings.requestLimits || {};
  const uploadTargetLimits = settings.uploadTargetLimits || {};
  const llmRetry = settings.llmRetry || {};
  const llmTokens = settings.llmTokens || {};
  const context = settings.context || {};
  return {
    requestLimits: {
      conversation: numericSetting(requestLimits.conversation, fallback.requestLimits.conversation),
      evidenceIndex: numericSetting(requestLimits.evidenceIndex, fallback.requestLimits.evidenceIndex),
      evidenceSearch: numericSetting(requestLimits.evidenceSearch, fallback.requestLimits.evidenceSearch),
      reviewPack: numericSetting(requestLimits.reviewPack, fallback.requestLimits.reviewPack),
      standardRun: numericSetting(requestLimits.standardRun, fallback.requestLimits.standardRun),
      admin: numericSetting(requestLimits.admin, fallback.requestLimits.admin)
    },
    uploadTargetLimits: {
      maxFileBytes: numericSetting(uploadTargetLimits.maxFileBytes, fallback.uploadTargetLimits.maxFileBytes),
      maxBatchBytes: numericSetting(uploadTargetLimits.maxBatchBytes, fallback.uploadTargetLimits.maxBatchBytes),
      chunkSizeBytes: numericSetting(uploadTargetLimits.chunkSizeBytes, fallback.uploadTargetLimits.chunkSizeBytes)
    },
    llmRetry: {
      maxAttempts: numericSetting(llmRetry.maxAttempts, fallback.llmRetry.maxAttempts),
      fastFailMs: numericSetting(llmRetry.fastFailMs, fallback.llmRetry.fastFailMs, { allowZero: true }),
      backoffBaseMs: numericSetting(llmRetry.backoffBaseMs, fallback.llmRetry.backoffBaseMs, { allowZero: true }),
      maxRetryDelayMs: numericSetting(llmRetry.maxRetryDelayMs, fallback.llmRetry.maxRetryDelayMs, { allowZero: true }),
      rateLimitMaxRetryDelayMs: numericSetting(llmRetry.rateLimitMaxRetryDelayMs, fallback.llmRetry.rateLimitMaxRetryDelayMs, { allowZero: true }),
      retryJitterMs: numericSetting(llmRetry.retryJitterMs, fallback.llmRetry.retryJitterMs, { allowZero: true })
    },
    llmTokens: {
      structuredMaxTokens: numericSetting(llmTokens.structuredMaxTokens, fallback.llmTokens.structuredMaxTokens),
      retryStructuredMaxTokens: numericSetting(llmTokens.retryStructuredMaxTokens, fallback.llmTokens.retryStructuredMaxTokens),
      naturalResponseMaxTokens: numericSetting(llmTokens.naturalResponseMaxTokens, fallback.llmTokens.naturalResponseMaxTokens),
      naturalResponseMaxChars: numericSetting(llmTokens.naturalResponseMaxChars, fallback.llmTokens.naturalResponseMaxChars)
    },
    context: {
      historyTurns: numericSetting(context.historyTurns, fallback.context.historyTurns),
      turnMaxChars: numericSetting(context.turnMaxChars, fallback.context.turnMaxChars),
      recentTurnsForPrompt: numericSetting(context.recentTurnsForPrompt, fallback.context.recentTurnsForPrompt),
      compactRecentTurnsForPrompt: numericSetting(context.compactRecentTurnsForPrompt, fallback.context.compactRecentTurnsForPrompt),
      briefMaxChars: numericSetting(context.briefMaxChars, fallback.context.briefMaxChars),
      documentSummaryMaxChars: numericSetting(context.documentSummaryMaxChars, fallback.context.documentSummaryMaxChars),
      memorySummaryMaxChars: numericSetting(context.memorySummaryMaxChars, fallback.context.memorySummaryMaxChars)
    }
  };
}

function uploadTargetLimitsForClient() {
  return adminOperationalSettings(adminStatusState).uploadTargetLimits;
}

function cleanEvidenceText(value = '') {
  return window.P42AppModules.evidenceUploadUi.cleanEvidenceText(value);
}

function yieldToBrowser() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function delay(ms = 0) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableUploadFailure(status = 0) {
  return status === 429 || status === 408 || status >= 500;
}

async function uploadChunkWithRetry(url, options = {}, context = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= uploadChunkMaxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      const detail = await response.text();
      lastError = new Error(detail || `Chunk upload failed for ${context.fileName || 'evidence file'}.`);
      if (!isRetryableUploadFailure(response.status) || attempt >= uploadChunkMaxAttempts) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || 'Chunk upload failed.'));
      if (attempt >= uploadChunkMaxAttempts) throw lastError;
    }
    await delay(350 * attempt);
  }
  throw lastError || new Error(`Chunk upload failed for ${context.fileName || 'evidence file'}.`);
}

function setAttachmentStatus(message = '', state = 'idle') {
  if (!chatAttachmentStatus) return;
  chatAttachmentStatus.classList.remove('has-pipeline');
  chatAttachmentStatus.textContent = message;
  chatAttachmentStatus.dataset.state = state;
}

function syncPrimaryActionState() {
  const busy = evidenceUploadActive || conversationRequestActive || agentRunActive;
  if (evidenceInput) evidenceInput.disabled = busy;
  if (chatEvidenceInput) chatEvidenceInput.disabled = busy;
  if (chatSubmit) chatSubmit.disabled = busy;
  if (formRunButton) formRunButton.disabled = busy;
  if (sampleRun) sampleRun.disabled = busy || decisionActionMode === 'running' || decisionActionMode === 'exporting';
  if (chatRunNow) chatRunNow.disabled = busy || Boolean(chatRunReadiness && !chatRunReadiness.runnable);
  [chatSubmit, formRunButton, sampleRun, chatRunNow].filter(Boolean).forEach((button) => {
    setUiComponentState(button, button.dataset.slot || 'primary-action', busy ? 'loading' : button.disabled ? 'disabled' : 'ready');
    button.setAttribute('aria-busy', String(busy));
  });
  document.body.dataset.evidenceState = evidenceUploadActive ? 'loading' : 'idle';
  if (execReviewPack) {
    execReviewPack.disabled = busy || decisionActionMode !== 'ready';
    setUiComponentState(execReviewPack, 'decision-action', busy ? 'loading' : execReviewPack.disabled ? 'disabled' : 'ready');
  }
  if (exportRun) {
    exportRun.disabled = busy || decisionActionMode !== 'ready';
    setUiComponentState(exportRun, 'decision-action', busy ? 'loading' : exportRun.disabled ? 'disabled' : 'ready');
  }
}

function updateDecisionActionBar(mode = 'idle') {
  decisionActionMode = ['idle', 'running', 'ready', 'exporting'].includes(mode) ? mode : 'idle';
  const ready = decisionActionMode === 'ready' || decisionActionMode === 'exporting';
  sampleRun.classList.toggle('primary-action', !ready);
  sampleRun.classList.toggle('secondary-button', ready);
  execReviewPack.classList.toggle('primary-action', ready);
  execReviewPack.classList.toggle('secondary-button', !ready);
  sampleRun.textContent = decisionActionMode === 'running'
    ? 'Running council…'
    : ready ? 'Rerun council' : runModeCopy[activeRunMode].actionButton;
  execReviewPack.textContent = decisionActionMode === 'exporting' ? 'Packaging review pack…' : 'Export review pack';
  exportRun.textContent = 'Export audit JSON';
  setUiComponentState(sampleRun, 'decision-action', decisionActionMode === 'running' ? 'loading' : 'ready');
  setUiComponentState(execReviewPack, 'decision-action', decisionActionMode === 'exporting' ? 'loading' : ready ? 'ready' : 'disabled');
  setUiComponentState(exportRun, 'decision-action', ready ? 'ready' : 'disabled');
  syncPrimaryActionState();
}

function setApprovalActionStatus(message = '', state = 'idle') {
  if (!approvalActionStatus) return;
  approvalActionStatus.textContent = message;
  approvalActionStatus.dataset.state = state;
}

function setApprovalActions({ enabled = false, recorded = null, busyAction = '', allowApproval = true } = {}) {
  const recordedDecision = cleanEvidenceText(recorded?.reviewerDecision || recorded?.status || '').toLowerCase();
  const approved = Boolean(recorded && /^(?:approve(?:d)?|accept(?:ed)?)$/.test(recordedDecision));
  const rejected = Boolean(recorded && /reject|remediation/i.test(recorded.reviewerDecision || recorded.status || ''));
  const busy = Boolean(busyAction);
  approvalButton.textContent = busyAction === 'approve'
    ? 'Recording approval…'
    : approved ? 'Approval recorded' : 'Record approval';
  remediationButton.textContent = busyAction === 'remediation'
    ? 'Recording remediation…'
    : rejected ? 'Remediation requested' : 'Request remediation';
  [approvalButton, remediationButton].forEach((button) => {
    button.disabled = !enabled || Boolean(recorded) || busy || (button === approvalButton && !allowApproval);
    setUiComponentState(button, 'review-action', busy ? 'loading' : button.disabled ? 'disabled' : 'ready');
    button.setAttribute('aria-busy', String(busy));
  });
  if (enabled && !recorded && !busy) {
    if (allowApproval) approvalButton.dataset.reviewAction = 'approval';
    else approvalButton.removeAttribute('data-review-action');
    remediationButton.dataset.reviewAction = 'request-remediation';
  } else {
    approvalButton.removeAttribute('data-review-action');
    remediationButton.removeAttribute('data-review-action');
  }
}

function setEvidenceUploadBusy(active) {
  evidenceUploadActive = Boolean(active);
  syncPrimaryActionState();
}

async function waitForEvidenceUpload() {
  const pending = evidenceUploadPromise;
  if (!pending) return;
  await pending;
}

function pipelineStepStatus(stepId, phase) {
  return window.P42AppModules.evidenceUploadUi.pipelineStepStatus(stepId, phase, evidencePipelineSteps);
}

function renderEvidencePipelineStatus({
  title = 'Evidence pipeline',
  detail = 'Preparing evidence.',
  phase = 'queue',
  progress = 4,
  files = [],
  metric = '',
  state = 'working',
  startedAt = null
} = {}) {
  window.P42AppModules.evidenceUploadUi.renderEvidencePipelineStatus(chatAttachmentStatus, {
    title,
    detail,
    phase,
    progress,
    files,
    metric,
    state,
    startedAt,
    steps: evidencePipelineSteps
  });
}

function summarizeEvidenceText(text = '', maxLength = 720) {
  return window.P42AppModules.evidenceUploadUi.summarizeEvidenceText(text, maxLength);
}

function detectEvidenceSignals(text = '') {
  return window.P42AppModules.evidenceUploadUi.detectEvidenceSignals(text, evidenceSignalPatterns);
}

function compactJson(value) {
  return window.P42AppModules.text.compactJson(value);
}

function evidenceUploadPolicy() {
  return window.P42AppModules.evidenceUploadPolicy || {};
}

function evidenceIndexRestorePolicy() {
  return window.P42AppModules.evidenceIndexRestore || {};
}

async function sha256File(file) {
  if (typeof evidenceUploadPolicy().sha256File === 'function') {
    return evidenceUploadPolicy().sha256File(file);
  }
  if (!window.crypto?.subtle?.digest) {
    throw new Error('SHA-256 hashing is unavailable in this browser.');
  }
  const hash = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validateEvidenceFiles(files = []) {
  const uploadLimits = uploadTargetLimitsForClient();
  if (typeof evidenceUploadPolicy().validateEvidenceFileSelection === 'function') {
    return evidenceUploadPolicy().validateEvidenceFileSelection(files, {
      maxFileBytes: uploadLimits.maxFileBytes,
      maxBatchBytes: uploadLimits.maxBatchBytes
    });
  }
  const selected = Array.from(files || []);
  const oversized = selected.find((file) => Number(file.size || 0) > uploadLimits.maxFileBytes);
  if (oversized) {
    return { ok: false, message: `${oversized.name || 'Selected file'} exceeds the ${formatBytes(uploadLimits.maxFileBytes)} per file max.` };
  }
  const totalBytes = selected.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (totalBytes > uploadLimits.maxBatchBytes) {
    return { ok: false, message: `Selected evidence exceeds the ${formatBytes(uploadLimits.maxBatchBytes)} batch limit.` };
  }
  return { ok: true, files: selected, totalBytes };
}

function readJsonStorage(key, fallback = {}) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Retrieval metadata is useful but not required in private browsing modes.
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Session cleanup should not fail when storage is unavailable.
  }
}

function readSessionJsonStorage(key, fallback = {}) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionJsonStorage(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session-scoped recovery state is helpful, not required.
  }
}

function removeSessionStorage(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures in privacy modes.
  }
}

function normalizeBrowserSession(session = {}, { sessionType = '', token = '' } = {}) {
  const normalizedType = cleanText(sessionType || session.sessionType).toLowerCase();
  const sessionId = cleanText(session.sessionId);
  const workspaceId = cleanText(session.workspaceId);
  const expiresAt = cleanText(session.expiresAt);
  const expiresAtMs = Date.parse(expiresAt);
  const normalizedToken = cleanText(token || session.token);
  if (!['demo', 'pilot'].includes(normalizedType) || !sessionId || !workspaceId) return null;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;
  if (normalizedType === 'demo' && !normalizedToken) return null;
  return {
    sessionType: normalizedType,
    sessionId,
    workspaceId,
    expiresAt,
    token: normalizedType === 'demo' ? normalizedToken : ''
  };
}

function browserSessionScopeId(session = activeBrowserSession) {
  if (!session) return '';
  const sessionType = cleanText(session.sessionType);
  const sessionId = cleanText(session.sessionId);
  const workspaceId = cleanText(session.workspaceId);
  return sessionType && sessionId && workspaceId
    ? `${sessionType}:${workspaceId}:${sessionId}`
    : '';
}

function restoreBrowserSession() {
  const stored = readSessionJsonStorage(storageKeys.browserSession, null);
  if (!stored) return null;
  const restored = normalizeBrowserSession(stored, stored);
  if (restored) return restored;
  removeSessionStorage(storageKeys.browserSession);
  return null;
}

function persistBrowserSession(session = activeBrowserSession) {
  if (!session) {
    removeSessionStorage(storageKeys.browserSession);
    return;
  }
  writeSessionJsonStorage(storageKeys.browserSession, session);
}

function runHistoryScope() {
  if (readAdminBearerToken().trim()) return null;
  const scopeId = browserSessionScopeId();
  if (!scopeId) return null;
  return {
    id: scopeId,
    sessionType: activeBrowserSession.sessionType,
    sessionId: activeBrowserSession.sessionId,
    workspaceId: activeBrowserSession.workspaceId
  };
}

function purgeBrowserSessionArtifacts({ resetView = false } = {}) {
  // `p42:run-history` used to contain full results in localStorage. Always remove
  // that legacy copy, even when sessionStorage is unavailable.
  removeStorage(storageKeys.runHistory);
  removeSessionStorage(storageKeys.runHistory);
  completedRunHistory = [];
  currentSessionRunIds.clear();
  lastRun = null;
  lastRuns.chat = null;
  lastRuns.demo = null;
  lastRuns.live = null;
  latestCompletedRunMode = null;
  latestCompletedRun = null;
  if (resetView) {
    resetChatCaseSession({ skipConfirm: true });
  } else {
    clearChatSessionStorage();
    removeStorage(storageKeys.evidenceIndexMeta);
  }
  renderRunHistorySelect();
}

function activateBrowserSession(session = {}, options = {}) {
  const next = normalizeBrowserSession(session, options);
  if (!next) throw new Error('Session did not return a valid browser scope.');
  const previousScopeId = browserSessionScopeId();
  const nextScopeId = browserSessionScopeId(next);
  if (previousScopeId && previousScopeId !== nextScopeId) {
    purgeBrowserSessionArtifacts({ resetView: true });
  }
  activeBrowserSession = next;
  demoSessionToken = next.sessionType === 'demo' ? next.token : '';
  pilotSessionActive = next.sessionType === 'pilot';
  persistBrowserSession(next);
  completedRunHistory = loadCompletedRunHistory();
  hydrateLatestCompletedRunFromHistory();
  renderRunHistorySelect();
  return next;
}

function deactivateBrowserSession({ resetView = false } = {}) {
  activeBrowserSession = null;
  demoSessionToken = '';
  pilotSessionActive = false;
  removeSessionStorage(storageKeys.browserSession);
  purgeBrowserSessionArtifacts({ resetView });
}

function chatSessionPayload() {
  return {
    savedAt: new Date().toISOString(),
    chatCaseDraft: sanitizeDraftForConversationPayload(chatCaseDraft),
    chatMessages: chatMessages
      .filter((message) => message && !message.pending)
      .slice(-chatMessageLimit)
      .map((message) => ({
        role: message.role,
        text: message.text || '',
        displayedQuestion: message.displayedQuestion || '',
        displayedQuestionId: message.displayedQuestionId || '',
        displayedQuestionField: message.displayedQuestionField || '',
        answeringQuestion: message.answeringQuestion || '',
        answeringQuestionId: message.answeringQuestionId || '',
        answeringQuestionField: message.answeringQuestionField || '',
        generatedByCompass: Boolean(message.generatedByCompass),
        compassNaturalResponse: Boolean(message.compassNaturalResponse),
        nextBestQuestion: message.nextBestQuestion || '',
        smartIntakeUnavailable: Boolean(message.smartIntakeUnavailable),
        smartIntakeDegraded: Boolean(message.smartIntakeDegraded),
        smartIntakeDiagnostic: Boolean(message.smartIntakeDiagnostic),
        degradedMessage: message.degradedMessage || '',
        unavailableMessage: message.unavailableMessage || ''
      })),
    uploadedEvidence: uploadedEvidenceForConversation(),
    evidenceIndexMeta,
    evidenceIndexValidation,
    activeQuestion,
    activeQuestionId,
    activeQuestionField,
    chatRunReadiness,
    chatMissingFields
  };
}

function saveChatSession() {
  const hasSessionState = chatMessages.length > 1
    || hasChatContext()
    || uploadedEvidence.length
    || Object.keys(evidenceIndexMeta || {}).length;
  if (!hasSessionState) {
    removeSessionStorage(storageKeys.chatSession);
    return;
  }
  writeSessionJsonStorage(storageKeys.chatSession, chatSessionPayload());
}

function scheduleChatSessionSave() {
  if (chatSessionSaveTimer) window.clearTimeout(chatSessionSaveTimer);
  chatSessionSaveTimer = window.setTimeout(() => {
    chatSessionSaveTimer = null;
    saveChatSession();
  }, 150);
}

function restoreChatSession() {
  const session = readSessionJsonStorage(storageKeys.chatSession, null);
  if (!session || typeof session !== 'object') return false;
  if (Array.isArray(session.chatMessages) && session.chatMessages.length) {
    chatMessages = session.chatMessages
      .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
      .slice(-chatMessageLimit);
  }
  if (session.chatCaseDraft && typeof session.chatCaseDraft === 'object') {
    chatCaseDraft = session.chatCaseDraft;
  }
  uploadedEvidence = Array.isArray(session.uploadedEvidence)
    ? session.uploadedEvidence.map((item) => stripEvidencePayloadForBrowser({ ...item })).slice(-12)
    : uploadedEvidence;
  evidenceIndexMeta = session.evidenceIndexMeta && typeof session.evidenceIndexMeta === 'object'
    ? session.evidenceIndexMeta
    : evidenceIndexMeta;
  evidenceIndexValidation = session.evidenceIndexValidation && typeof session.evidenceIndexValidation === 'object'
    ? session.evidenceIndexValidation
    : evidenceIndexValidation;
  activeQuestion = cleanEvidenceText(session.activeQuestion || activeQuestion);
  activeQuestionId = cleanEvidenceText(session.activeQuestionId || activeQuestionId);
  activeQuestionField = cleanEvidenceText(session.activeQuestionField || activeQuestionField);
  chatRunReadiness = session.chatRunReadiness || chatRunReadiness;
  chatMissingFields = Array.isArray(session.chatMissingFields) ? session.chatMissingFields : chatMissingFields;
  return true;
}

function clearChatSessionStorage() {
  if (chatSessionSaveTimer) {
    window.clearTimeout(chatSessionSaveTimer);
    chatSessionSaveTimer = null;
  }
  removeSessionStorage(storageKeys.chatSession);
}

async function restoreEvidenceIndexFromStorage() {
  const meta = readJsonStorage(storageKeys.evidenceIndexMeta, {});
  if (!meta.caseId) return;
  evidenceIndexMeta = meta;
  evidenceIndexValidation = {
    status: 'not_checked',
    detail: 'Restored evidence metadata has not been validated yet.'
  };
  mergeChatCaseDraft({
    caseId: meta.caseId,
    indexedEvidence: meta
  });
  validateRestoredEvidenceIndex(meta);
}

function applyEvidenceIndexValidationResult(result = {}) {
  evidenceIndexValidation = result.validation || evidenceIndexValidation;
  evidenceIndexMeta = result.evidenceIndexMeta || {};
  if (result.chatCaseDraft) mergeChatCaseDraft(result.chatCaseDraft);
  if (result.shouldClearStorage) {
    removeStorage(storageKeys.evidenceIndexMeta);
    setAttachmentStatus(result.warning || 'Previous evidence index expired; re-upload evidence for semantic retrieval.', 'warning');
    if (evidenceIngestionStatus) {
      evidenceIngestionStatus.textContent = result.warning || 'Previous evidence index expired; re-upload evidence for semantic retrieval.';
    }
  }
  renderChatMessages();
  renderContextStrength();
  renderChatAttachments();
  renderAdminStatus(adminStatusState);
}

async function validateRestoredEvidenceIndex(meta = evidenceIndexMeta) {
  if (!meta?.caseId) return null;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? window.setTimeout(() => controller.abort(), 2500) : null;
  try {
    const response = await apiFetch('/api/evidence/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(controller ? { signal: controller.signal } : {}),
      body: JSON.stringify({
        caseId: meta.caseId,
        purpose: 'restore_index_validation',
        query: 'evidence availability check',
        topK: 1
      })
    });
    const reconcile = evidenceIndexRestorePolicy().reconcileRestoredEvidenceIndexValidation;
    const result = typeof reconcile === 'function'
      ? reconcile({ meta, draft: chatCaseDraft, response })
      : {
          validation: { status: 'valid', detail: 'Restored evidence metadata was validated.' },
          evidenceIndexMeta: meta,
          chatCaseDraft,
          shouldClearStorage: false
        };
    applyEvidenceIndexValidationResult(result);
    return result.validation;
  } catch (error) {
    evidenceIndexValidation = {
      status: 'not_checked',
      detail: error?.name === 'AbortError'
        ? 'Restored evidence index validation timed out; semantic retrieval will be checked again when needed.'
        : 'Restored evidence index validation could not complete.'
    };
    renderAdminStatus(adminStatusState);
    return evidenceIndexValidation;
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function ensureChatCaseId() {
  if (!chatCaseDraft.caseId) {
    mergeChatCaseDraft({ caseId: `case_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` });
  }
  return chatCaseDraft.caseId;
}

function currentCaseForDocumentParser() {
  return {
    case_id: ensureChatCaseId(),
    supplier_name: chatCaseDraft.supplierName || '',
    business_unit: chatCaseDraft.businessUnit || '',
    geography: chatCaseDraft.geography || '',
    service_description: chatCaseDraft.brief || ''
  };
}

function parsedDocumentText(document = {}) {
  const semantic = document.semantic_parse || {};
  return cleanEvidenceText([
    document.summary,
    semantic.semantic_summary,
    compactJson(semantic.extracted_entities),
    compactJson(semantic.clause_map),
    compactJson(semantic.obligations),
    compactJson(semantic.risks),
    Array.isArray(semantic.missing_context) ? semantic.missing_context.join(' ') : '',
    Array.isArray(document.signals) ? document.signals.join(' ') : '',
    Array.isArray(document.document_evidence_ids) ? document.document_evidence_ids.join(' ') : ''
  ].join(' '));
}

function signalsFromParsedDocument(document = {}) {
  return unique([
    ...(Array.isArray(document.signals) ? document.signals : []),
    ...(Array.isArray(document.service_domain_signals) ? document.service_domain_signals : []),
    ...detectEvidenceSignals(parsedDocumentText(document))
  ]);
}

function uploadedDocumentToEvidence(document = {}, index = 0) {
  const evidenceId = document.document_id || `UP-${String(index + 1).padStart(2, '0')}`;
  const text = parsedDocumentText(document).slice(0, textEvidenceSampleBytes);
  const signals = signalsFromParsedDocument(document);
  const summary = document.summary || document.semantic_parse?.semantic_summary || 'Document parsed by the Parallax42 backend.';
  return {
    evidenceId,
    title: document.file_name || evidenceId,
    fileName: document.file_name || evidenceId,
    sourceType: document.mime_type || document.document_type || 'backend_parsed_document',
    sizeBytes: document.file_size_bytes || 0,
    extractionStatus: document.extraction_status || 'backend_parsed',
    summary,
    text,
    excerpt: summarizeEvidenceText(text || summary, 360),
    signals,
    documentType: document.document_type || 'unknown',
    parserProvider: document.provider_name || 'backend_parser',
    documentEvidenceIds: Array.isArray(document.document_evidence_ids) ? document.document_evidence_ids : [],
    semanticParse: document.semantic_parse || null,
    uploadedAt: new Date().toISOString()
  };
}

function documentCaseTitleFromFileName(fileName = '') {
  const withoutExtension = cleanEvidenceText(fileName)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/^\d+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!withoutExtension) return '';
  const acronyms = new Map([
    ['ai', 'AI'],
    ['api', 'API'],
    ['bcp', 'BCP'],
    ['dpa', 'DPA'],
    ['dr', 'DR'],
    ['erp', 'ERP'],
    ['hris', 'HRIS'],
    ['iso', 'ISO'],
    ['msa', 'MSA'],
    ['ocr', 'OCR'],
    ['saas', 'SaaS'],
    ['soc', 'SOC'],
    ['sow', 'SOW']
  ]);
  return withoutExtension
    .toLowerCase()
    .split(/\s+/)
    .map((word) => acronyms.get(word) || word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\bOf\b/g, 'of')
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bFor\b/g, 'for')
    .replace(/\bTo\b/g, 'to')
    .replace(/\bStatement of Work\b/gi, 'Statement of Work')
    .slice(0, 120);
}

function inferredCaseTitleFromParsedEvidence(output = {}, parsed = []) {
  const documents = Array.isArray(output.uploaded_documents) ? output.uploaded_documents : [];
  const titleFromFile = [...documents, ...parsed]
    .map((document) => documentCaseTitleFromFileName(document.file_name || document.fileName || document.title || ''))
    .find((title) => meaningfulCaseNameValue(title));
  if (titleFromFile) return titleFromFile;
  const summaryTitle = cleanEvidenceText(output.extracted_case?.service_description || output.source_summary || parsed[0]?.summary || '')
    .split(/[.!?]/)[0]
    .slice(0, 120);
  return meaningfulCaseNameValue(summaryTitle) ? summaryTitle : '';
}

function stripEvidencePayloadForBrowser(item = {}) {
  if (!item || typeof item !== 'object') return item;
  delete item.text;
  delete item.semanticParse;
  item.excerpt = item.excerpt ? summarizeEvidenceText(item.excerpt, 180) : '';
  item.browserRetention = 'case_metadata_only';
  return item;
}

function conversationPayloadPolicy() {
  return window.P42AppModules.conversationPayload || {};
}

function evidenceMetadataForConversation(item = {}) {
  const policy = conversationPayloadPolicy();
  if (typeof policy.sanitizeUploadedEvidenceForConversationPayload === 'function') {
    return policy.sanitizeUploadedEvidenceForConversationPayload([item])[0] || {};
  }
  if (!item || typeof item !== 'object') return item;
  return {
    evidenceId: item.evidenceId || '',
    title: item.title || item.fileName || item.evidenceId || '',
    fileName: item.fileName || item.title || item.evidenceId || '',
    sizeBytes: item.sizeBytes || 0,
    extractionStatus: item.extractionStatus || '',
    documentType: item.documentType || '',
    summary: summarizeEvidenceText(item.summary || '', 420),
    excerpt: summarizeEvidenceText(item.excerpt || item.summary || '', 180),
    signals: item.signals || [],
    indexedChunkIds: item.indexedChunkIds || [],
    fixtureProfile: item.fixtureProfile || null,
    fixtureDocument: item.fixtureDocument || null
  };
}

function sanitizeDraftForConversationPayload(draft = chatCaseDraft) {
  const policy = conversationPayloadPolicy();
  if (typeof policy.sanitizeDraftForConversationPayload === 'function') {
    return policy.sanitizeDraftForConversationPayload(draft);
  }
  return {
    ...draft,
    documents: Array.isArray(draft.documents) ? draft.documents.map((document) => ({
      ...evidenceMetadataForConversation(document),
      text: summarizeEvidenceText(document.text || '', 1000)
    })) : []
  };
}

function chatCaseDraftForConversation(draft = chatCaseDraft, options = {}) {
  const policy = conversationPayloadPolicy();
  if (options.runRequest && typeof policy.sanitizeRunRequestDraftForConversationPayload === 'function') {
    return policy.sanitizeRunRequestDraftForConversationPayload(draft);
  }
  return sanitizeDraftForConversationPayload(draft);
}

function uploadedEvidenceForConversation(items = uploadedEvidence) {
  return Array.isArray(items) ? items.map(evidenceMetadataForConversation) : [];
}

function meaningfulDraftValue(value = '') {
  const clean = cleanEvidenceText(value);
  return Boolean(clean) && !/^(needed|unknown|not sure|pending|n\/a|none|null|undefined)$/i.test(clean);
}

function isGenericCaseName(value = '') {
  const clean = cleanEvidenceText(value).toLowerCase();
  if (!clean) return true;
  return /^(compliance evidence extraction|evidence extraction|compliance extraction|compliance intake|compliance advisor|new compliance case|case draft|current case|document review request|draft from current message|conversation-supplied case|submitted compliance case)$/i.test(clean);
}

function meaningfulCaseNameValue(value = '') {
  const clean = cleanEvidenceText(value);
  return meaningfulDraftValue(clean) && !isGenericCaseName(clean);
}

function mergeDraftText(current = '', next = '') {
  return meaningfulDraftValue(next) ? cleanEvidenceText(next) : current;
}

function mergeCaseNameText(current = '', next = '') {
  const cleanCurrent = cleanEvidenceText(current);
  const cleanNext = cleanEvidenceText(next);
  if (meaningfulCaseNameValue(cleanNext)) return cleanNext;
  return cleanCurrent;
}

function mergeDraftArray(current = [], next = [], limit = 24) {
  return unique([
    ...(Array.isArray(current) ? current : []),
    ...(Array.isArray(next) ? next : [])
  ]).slice(-limit);
}

function mergeDraftRecords(current = [], next = [], limit = 32) {
  const byKey = new Map();
  [...(Array.isArray(current) ? current : []), ...(Array.isArray(next) ? next : [])].forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const key = [
      item.field,
      item.updateType,
      item.value,
      item.reason
    ].map((value) => cleanEvidenceText(value).toLowerCase()).join('|') || JSON.stringify(item).slice(0, 160);
    byKey.set(key, { ...(byKey.get(key) || {}), ...item });
  });
  return Array.from(byKey.values()).slice(-limit);
}

function mergeDraftDocuments(current = [], next = [], limit = 18) {
  const byId = new Map();
  [...(Array.isArray(current) ? current : []), ...(Array.isArray(next) ? next : [])].forEach((doc) => {
    if (!doc || typeof doc !== 'object') return;
    const key = doc.evidenceId || doc.chunkId || doc.title || doc.fileName || JSON.stringify(doc).slice(0, 80);
    byId.set(key, { ...(byId.get(key) || {}), ...doc });
  });
  return Array.from(byId.values()).slice(-limit);
}

function mergeDocumentContext(current = {}, next = {}) {
  return {
    ...current,
    ...next,
    supplierName: mergeCaseNameText(current.supplierName, next.supplierName),
    businessUnit: mergeDraftText(current.businessUnit, next.businessUnit),
    geography: mergeDraftText(current.geography, next.geography),
    serviceDescription: mergeDraftText(current.serviceDescription, next.serviceDescription)
  };
}

function mergeChatCaseDraft(patch = {}, options = {}) {
  if (!patch || typeof patch !== 'object') return chatCaseDraft;
  const base = options.base && typeof options.base === 'object' ? options.base : chatCaseDraft || {};
  const merged = {
    ...base,
    ...patch,
    caseId: mergeDraftText(base.caseId, patch.caseId),
    supplierName: mergeCaseNameText(base.supplierName, patch.supplierName),
    businessUnit: mergeDraftText(base.businessUnit, patch.businessUnit),
    geography: mergeDraftText(base.geography, patch.geography),
    brief: mergeDraftText(base.brief, patch.brief),
    integrations: mergeDraftArray(base.integrations, patch.integrations, 18),
    dataCategories: mergeDraftArray(base.dataCategories, patch.dataCategories, 24),
    riskSignals: mergeDraftArray(base.riskSignals, patch.riskSignals, 24),
    evidenceSignals: mergeDraftArray(base.evidenceSignals, patch.evidenceSignals, 32),
    knownGaps: mergeDraftArray(base.knownGaps, patch.knownGaps, 24),
    missingFields: mergeDraftArray(base.missingFields, patch.missingFields, 18),
    documents: mergeDraftDocuments(base.documents, patch.documents, 18),
    documentContext: mergeDocumentContext(base.documentContext || {}, patch.documentContext || {}),
    questions: mergeDraftArray(base.questions, patch.questions, 24),
    questionMetadata: Array.isArray(patch.questionMetadata) ? patch.questionMetadata.slice(0, 8) : Array.isArray(base.questionMetadata) ? base.questionMetadata.slice(0, 8) : [],
    askedQuestions: mergeDraftArray(base.askedQuestions, patch.askedQuestions, 32),
    caseAmendments: mergeDraftRecords(base.caseAmendments, patch.caseAmendments, 32),
    materialChanges: mergeDraftRecords(base.materialChanges, patch.materialChanges, 32),
    lastCouncilRun: Object.prototype.hasOwnProperty.call(patch, 'lastCouncilRun') ? patch.lastCouncilRun : base.lastCouncilRun,
    pendingCaseUpdateClarification: Object.prototype.hasOwnProperty.call(patch, 'pendingCaseUpdateClarification') ? patch.pendingCaseUpdateClarification : base.pendingCaseUpdateClarification,
    councilStatus: Object.prototype.hasOwnProperty.call(patch, 'councilStatus') ? patch.councilStatus : base.councilStatus,
    councilStaleReason: Object.prototype.hasOwnProperty.call(patch, 'councilStaleReason') ? patch.councilStaleReason : base.councilStaleReason,
    rerunRecommended: Object.prototype.hasOwnProperty.call(patch, 'rerunRecommended') ? Boolean(patch.rerunRecommended) : Boolean(base.rerunRecommended),
    caseVersion: Number(Object.prototype.hasOwnProperty.call(patch, 'caseVersion') ? patch.caseVersion : base.caseVersion || 0) || 0,
    caseRequestStarted: options.forceCaseRequestStarted === false
      ? false
      : Boolean(base.caseRequestStarted || patch.caseRequestStarted)
  };
  if (!patch.indexedEvidence) merged.indexedEvidence = base.indexedEvidence;
  if (!patch.retrievalContext) merged.retrievalContext = base.retrievalContext;
  if (!Object.prototype.hasOwnProperty.call(patch, 'activeQuestion')) merged.activeQuestion = base.activeQuestion;
  if (!Object.prototype.hasOwnProperty.call(patch, 'activeQuestionId')) merged.activeQuestionId = base.activeQuestionId;
  if (!Object.prototype.hasOwnProperty.call(patch, 'activeQuestionField')) merged.activeQuestionField = base.activeQuestionField;
  chatCaseDraft = merged;
  scheduleChatSessionSave();
  return chatCaseDraft;
}

function indexableEvidenceText(item = {}) {
  return cleanEvidenceText([
    item.text,
    item.summary,
    item.excerpt,
    item.semanticParse?.semantic_summary,
    compactJson(item.semanticParse?.extracted_entities),
    compactJson(item.semanticParse?.clause_map),
    compactJson(item.semanticParse?.obligations),
    compactJson(item.semanticParse?.risks),
    Array.isArray(item.documentEvidenceIds) ? item.documentEvidenceIds.join(' ') : '',
    Array.isArray(item.signals) ? item.signals.join(' ') : ''
  ].join(' '));
}

function applyServerEvidenceIndex(result = {}) {
  const index = result.index || {};
  const safeChunks = Array.isArray(result.chunks) ? result.chunks : [];
  evidenceIndexMeta = {
    caseId: index.caseId || chatCaseDraft.caseId || '',
    model: result.model || evidenceIndexMeta.model || 'text-embedding-3-large',
    chunkCount: Number(index.chunkCount || result.chunking?.chunkCount || safeChunks.length || 0),
    evidenceIds: unique(index.evidenceIds || safeChunks.map((chunk) => chunk.evidenceId)),
    chunkIds: unique(index.chunkIds || safeChunks.map((chunk) => chunk.chunkId)).slice(0, 50),
    updatedAt: index.updatedAt || new Date().toISOString(),
    storage: index.storage || 'server_side_vector_store',
    provider: index.provider || 'server',
    browserEmbeddingsRetained: false
  };
  writeJsonStorage(storageKeys.evidenceIndexMeta, evidenceIndexMeta);
  evidenceIndexValidation = {
    status: Number(evidenceIndexMeta.chunkCount || 0) ? 'valid' : 'not_checked',
    detail: Number(evidenceIndexMeta.chunkCount || 0)
      ? `${evidenceIndexMeta.chunkCount} evidence chunk${evidenceIndexMeta.chunkCount === 1 ? '' : 's'} available for semantic retrieval.`
      : 'Evidence metadata was stored, but no semantic chunks were reported.'
  };
  mergeChatCaseDraft({
    indexedEvidence: evidenceIndexMeta
  });
  return evidenceIndexMeta;
}

function buildEvidenceIndexDocuments(items = []) {
  return items
    .filter((item) => item && item.extractionStatus !== 'binary_registered')
    .map((item) => ({
      evidenceId: item.evidenceId,
      title: item.title || item.fileName || item.evidenceId,
      text: indexableEvidenceText(item),
      metadata: {
        sourceType: item.sourceType || '',
        extractionStatus: item.extractionStatus || '',
        fileName: item.fileName || item.title || '',
        documentType: item.documentType || '',
        signals: Array.isArray(item.signals) ? item.signals : [],
        uploadedAt: item.uploadedAt || '',
        parserProvider: item.parserProvider || '',
        documentEvidenceIds: Array.isArray(item.documentEvidenceIds) ? item.documentEvidenceIds : []
      }
    }))
    .filter((item) => cleanEvidenceText(item.text).length > 24);
}

async function indexEvidenceForRetrieval(items = []) {
  const documents = buildEvidenceIndexDocuments(items);
  if (!documents.length) return null;
  const caseId = ensureChatCaseId();
  const result = await apiFetch('/api/evidence/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId,
      workspaceId: 'parallax42',
      projectId: 'compliance-intelligence-agent',
      purpose: 'chat_evidence_index',
      documents
    })
  });
  const indexMeta = applyServerEvidenceIndex(result);
  const safeChunks = Array.isArray(result.chunks) ? result.chunks : [];
  const indexedEvidenceIds = new Set(documents.map((document) => document.evidenceId));
  items.forEach((item) => {
    if (indexedEvidenceIds.has(item.evidenceId)) {
      item.indexStatus = 'indexed';
      item.embeddingModel = result.model || indexMeta.model;
      item.indexedAt = indexMeta.updatedAt;
      item.indexedChunkIds = safeChunks
        .filter((chunk) => chunk.evidenceId === item.evidenceId)
        .map((chunk) => chunk.chunkId);
    }
  });
  return result;
}

function parserWaitCopy(status = 'working', elapsedMs = 0) {
  const seconds = Math.max(0, Math.round(Number(elapsedMs || 0) / 1000));
  const statusText = status || 'working';
  if (seconds > 60) {
    return `Waiting for parser. Backend status: ${statusText}. Still processing; large files can take longer.`;
  }
  return `Waiting for parser. Backend status: ${statusText}.`;
}

function evidenceIndexProvider(result = {}) {
  return String(result.index?.provider || result.indexingProvider || result.provider || evidenceIndexMeta.provider || '').toLowerCase();
}

function evidenceIndexStorageSummary(result = {}) {
  const provider = evidenceIndexProvider(result);
  if (/qdrant/.test(provider)) return 'Stored in Qdrant-backed evidence memory for semantic retrieval.';
  if (/local/.test(provider)) return 'Stored in server-side local vector fallback. Configure Qdrant for durable evidence memory.';
  if (/none|metadata/.test(provider)) return 'Evidence metadata is registered, but semantic indexing is disabled in this runtime.';
  return 'Stored behind the API for council citation retrieval.';
}

function retrievalQueryFromDraft(draft = chatCaseDraft) {
  return cleanEvidenceText([
    draft.brief,
    draft.supplierName,
    draft.businessUnit,
    draft.geography,
    ...(Array.isArray(draft.integrations) ? draft.integrations : []),
    ...(Array.isArray(draft.riskSignals) ? draft.riskSignals : []),
    ...(Array.isArray(draft.evidenceSignals) ? draft.evidenceSignals : []),
    'compliance obligations missing evidence controls DPA continuity export control access approvals risk blockers'
  ].join(' ')).slice(0, 1800);
}

function retrievalDocumentsFromMatches(matches = []) {
  return matches.map((match, index) => ({
    evidenceId: `RET-${String(index + 1).padStart(2, '0')}`,
    sourceEvidenceId: match.evidenceId,
    title: match.title || `Retrieved evidence ${index + 1}`,
    sourceType: 'semantic_retrieval',
    extractionStatus: 'retrieved_chunk',
    summary: match.text || '',
    text: match.text || '',
    excerpt: summarizeEvidenceText(match.text || '', 360),
    signals: detectEvidenceSignals(`${match.title || ''} ${match.text || ''}`),
    chunkId: match.chunkId,
    score: Number(match.score || 0),
    metadata: match.metadata || {},
    uploadedAt: new Date().toISOString()
  }));
}

async function retrieveIndexedEvidenceForCouncil() {
  const indexedChunkCount = indexedChunkCountForRetrieval();
  if (!indexedChunkCount) return null;
  const caseId = ensureChatCaseId();
  const query = retrievalQueryFromDraft();
  if (!query) return null;
  const result = await apiFetch('/api/evidence/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId,
      workspaceId: 'parallax42',
      projectId: 'compliance-intelligence-agent',
      purpose: 'council_evidence_retrieval',
      query,
      topK: 8
    })
  });
  const matches = Array.isArray(result.matches) ? result.matches : [];
  if (result.index && Number(result.index.chunkCount || 0) === 0 && matches.length === 0) {
    const reconcile = evidenceIndexRestorePolicy().reconcileRestoredEvidenceIndexValidation;
    if (typeof reconcile === 'function') {
      applyEvidenceIndexValidationResult(reconcile({ meta: evidenceIndexMeta, draft: chatCaseDraft, response: result }));
    }
    return null;
  }
  const retrievedDocs = retrievalDocumentsFromMatches(matches);
  const existingDocuments = Array.isArray(chatCaseDraft.documents) ? chatCaseDraft.documents : [];
  const nonRetrieved = existingDocuments.filter((doc) => doc.extractionStatus !== 'retrieved_chunk');
  mergeChatCaseDraft({
    documents: [...nonRetrieved, ...retrievedDocs].slice(-18),
    retrievalContext: {
      query,
      model: result.model || evidenceIndexMeta.model || 'text-embedding-3-large',
      chunkCount: result.index?.chunkCount || indexedChunkCount,
      matchCount: matches.length,
      matches: matches.map((match) => ({
        chunkId: match.chunkId,
        evidenceId: match.evidenceId,
        title: match.title,
        score: Number(match.score || 0),
        text: match.text,
        metadata: match.metadata || {}
      }))
    }
  });
  return result;
}

function applyCaseAssistOutput(output = {}, offset = uploadedEvidence.length) {
  const documents = Array.isArray(output.uploaded_documents) ? output.uploaded_documents : [];
  const parsed = documents.map((document, index) => uploadedDocumentToEvidence(document, offset + index));
  if (output.extracted_case) {
    const caseRequestStarted = hasCaseRequestContext(chatCaseDraft);
    const extractedSupplierName = cleanEvidenceText(output.extracted_case.supplier_name || '');
    const inferredCaseTitle = inferredCaseTitleFromParsedEvidence(output, parsed);
    const supplierName = meaningfulCaseNameValue(extractedSupplierName)
      ? extractedSupplierName
      : inferredCaseTitle || chatCaseDraft.supplierName;
    mergeChatCaseDraft({
      supplierName,
      businessUnit: caseRequestStarted ? (output.extracted_case.business_unit || chatCaseDraft.businessUnit) : chatCaseDraft.businessUnit,
      geography: caseRequestStarted ? (output.extracted_case.geography || chatCaseDraft.geography) : chatCaseDraft.geography,
      brief: caseRequestStarted ? (output.extracted_case.service_description || output.source_summary || chatCaseDraft.brief) : chatCaseDraft.brief,
      documentContext: {
        ...(chatCaseDraft.documentContext || {}),
        supplierName: supplierName || chatCaseDraft.documentContext?.supplierName || '',
        businessUnit: output.extracted_case.business_unit || chatCaseDraft.documentContext?.businessUnit || '',
        geography: output.extracted_case.geography || chatCaseDraft.documentContext?.geography || '',
        serviceDescription: output.extracted_case.service_description || output.source_summary || chatCaseDraft.documentContext?.serviceDescription || ''
      },
      integrations: caseRequestStarted ? unique([
        ...(chatCaseDraft.integrations || []),
        ...(Array.isArray(output.extracted_case.integrations) ? output.extracted_case.integrations : [])
      ]) : (chatCaseDraft.integrations || []),
      riskSignals: caseRequestStarted ? unique([
        ...(chatCaseDraft.riskSignals || []),
        ...(Array.isArray(output.evidence_checklist) ? output.evidence_checklist : []),
        ...(Array.isArray(output.missing_inputs) ? output.missing_inputs : [])
      ]) : (chatCaseDraft.riskSignals || [])
    }, { forceCaseRequestStarted: caseRequestStarted });
  }
  return parsed;
}

async function uploadEvidenceFilesToBackend(files = [], onProgress = () => {}) {
  const selected = files.filter((file) => backendParsedEvidenceExtensions.has(fileExtension(file.name)));
  if (!selected.length) return [];

  onProgress({
    phase: 'queue',
    progress: 4,
    title: 'Hashing evidence',
    detail: 'Computing SHA-256 digests before opening the parser relay session.',
    files: selected
  });
  const uploadFiles = typeof evidenceUploadPolicy().buildUploadInitFiles === 'function'
    ? await evidenceUploadPolicy().buildUploadInitFiles(selected, { hashFile: sha256File })
    : await Promise.all(selected.map(async (file) => ({
        file_name: file.name,
        content_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
        sha256: await sha256File(file)
      })));

  onProgress({
    phase: 'session',
    progress: 8,
    title: 'Opening parser session',
    detail: 'Preparing secure chunked upload for backend document intelligence.',
    files: selected
  });

  const session = await backendApiFetch('/case/assist/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: chatCaseDraft.brief || 'Compliance chat evidence upload.',
      current_case: currentCaseForDocumentParser(),
      chunk_size_bytes: uploadTargetLimitsForClient().chunkSizeBytes,
      files: uploadFiles
    })
  });

  const totalChunks = (session.files || []).reduce((sum, fileSession) => sum + Number(fileSession.total_chunks || 0), 0) || selected.length;
  let uploadedChunks = 0;

  for (const [fileIndex, file] of selected.entries()) {
    const fileSession = session.files?.[fileIndex];
    if (!fileSession) {
      throw new Error(`Document parser did not return an upload handle for ${file.name}.`);
    }
    for (let chunkIndex = 0; chunkIndex < fileSession.total_chunks; chunkIndex += 1) {
      const start = chunkIndex * session.chunk_size_bytes;
      const end = Math.min(file.size, start + session.chunk_size_bytes);
      const form = new FormData();
      form.append('upload_id', session.upload_id);
      form.append('file_id', fileSession.file_id);
      form.append('chunk_index', String(chunkIndex));
      form.append('chunk', file.slice(start, end), `${file.name}.part-${chunkIndex}`);
      const response = await uploadChunkWithRetry(backendApiUrl('/case/assist/upload/chunk'), {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: form
      }, { fileName: file.name, chunkIndex });
      uploadedChunks += 1;
      onProgress({
        phase: 'upload',
        progress: 12 + (uploadedChunks / totalChunks) * 34,
        title: 'Uploading chunks',
        detail: `Uploading ${file.name} · chunk ${chunkIndex + 1} of ${fileSession.total_chunks}`,
        metric: `${uploadedChunks}/${totalChunks}`,
        files: selected
      });
    }
  }

  const parserStartedAt = Date.now();
  onProgress({
    phase: 'parse',
    progress: 52,
    title: 'Waiting for parser',
    detail: 'Chunks are uploaded. Waiting for backend parsing, OCR, and clause extraction to finish.',
    metric: 'waiting',
    startedAt: parserStartedAt,
    files: selected
  });

  await backendApiFetch('/case/assist/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_id: session.upload_id })
  });

  let lastStatus = null;
  while (Date.now() - parserStartedAt < 240000) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    lastStatus = await backendApiFetch(`/case/assist/upload/status?upload_id=${encodeURIComponent(session.upload_id)}`);
    const elapsedMs = Date.now() - parserStartedAt;
    onProgress({
      phase: 'parse',
      progress: 54,
      title: 'Waiting for parser',
      detail: parserWaitCopy(lastStatus.status || 'working', elapsedMs),
      metric: elapsedMs > 60000 ? 'still processing' : lastStatus.status || 'waiting',
      startedAt: parserStartedAt,
      files: selected
    });
    if (lastStatus.status === 'failed') {
      throw new Error(lastStatus.error || 'Document parser failed.');
    }
    if (lastStatus.status === 'complete' && lastStatus.result_available) {
      onProgress({
        phase: 'parse',
        progress: 86,
        title: 'Parser complete',
        detail: 'Parser returned structured document evidence. Preparing embedding index.',
        startedAt: parserStartedAt,
        files: selected
      });
      const output = await backendApiFetch(`/case/assist/upload/result?upload_id=${encodeURIComponent(session.upload_id)}`);
      return applyCaseAssistOutput(output);
    }
  }
  throw new Error(lastStatus?.status ? `Document parser is still ${lastStatus.status}. Try again shortly.` : 'Document parser timed out.');
}

async function extractEvidenceFile(file, index, { allowBrowserText = false } = {}) {
  const extension = fileExtension(file.name);
  const evidenceId = `UP-${String(index + 1).padStart(2, '0')}`;
  let extractedText = '';
  let extractionStatus = 'metadata_only';
  let sourceType = extension || file.type || 'unknown';

  if (allowBrowserText && (file.type.startsWith('text/') || readableEvidenceExtensions.has(extension))) {
    extractedText = await file.slice(0, textEvidenceSampleBytes).text();
    extractionStatus = file.size > textEvidenceSampleBytes ? 'sampled_text' : 'text_extracted';
  } else {
    extractionStatus = 'binary_registered';
  }

  const summary = extractedText
    ? `Sampled text only: ${summarizeEvidenceText(extractedText)}`
    : `Evidence registered without browser parsing: ${file.name}. Full text extraction is reserved for backend document processing.`;
  const signals = detectEvidenceSignals(`${file.name} ${summary} ${extractedText}`);

  return {
    evidenceId,
    title: file.name,
    fileName: file.name,
    sourceType,
    sizeBytes: file.size,
    extractionStatus,
    summary,
    excerpt: summarizeEvidenceText(extractedText || summary, 260),
    signals,
    uploadedAt: new Date().toISOString()
  };
}

async function lookupFixtureEvidenceFile(file, index) {
  if (!file?.name || fileExtension(file.name) !== 'pdf') return null;
  try {
    const result = await apiFetch(`/api/fixture-documents/lookup?filename=${encodeURIComponent(file.name)}`);
    if (!result?.ok || !result.evidence) return null;
    const evidence = result.evidence || {};
    const document = result.document || {};
    const profile = result.expectedProfile || evidence.fixtureProfile || {};
    const text = cleanEvidenceText(evidence.text || evidence.summary || evidence.excerpt || '');
    return {
      evidenceId: evidence.evidenceId || `FIXTURE-${String(index + 1).padStart(2, '0')}`,
      title: evidence.title || document.title || file.name,
      fileName: file.name,
      sourceType: 'fixture_pdf',
      sizeBytes: file.size,
      extractionStatus: evidence.extractionStatus || 'metadata_fallback',
      documentType: evidence.documentType || profile.domain || 'fixture_contract',
      summary: summarizeEvidenceText(evidence.summary || text || document.title || file.name, 720),
      excerpt: summarizeEvidenceText(evidence.excerpt || text || evidence.summary || file.name, 260),
      text,
      signals: unique([
        ...(Array.isArray(evidence.signals) ? evidence.signals : []),
        ...(Array.isArray(profile.expectedRiskDomains) ? profile.expectedRiskDomains : []),
        ...(Array.isArray(profile.expectedMissingEvidence) ? profile.expectedMissingEvidence : [])
      ]),
      fixtureProfile: profile,
      fixtureDocument: document,
      uploadedAt: new Date().toISOString()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (/unsupported_fixture_document|fixture lookup failed|unsupported fixture/i.test(message)) return null;
    return null;
  }
}

async function ingestEvidenceFiles(files = []) {
  if (evidenceUploadPromise) {
    setAttachmentStatus('Evidence processing is already in progress. This file selection was not added.', 'warning');
    return evidenceUploadPromise;
  }
  setEvidenceUploadBusy(true);
  const upload = ingestEvidenceFilesUnlocked(files);
  evidenceUploadPromise = upload;
  try {
    return await upload;
  } finally {
    if (evidenceUploadPromise === upload) evidenceUploadPromise = null;
    setEvidenceUploadBusy(false);
  }
}

async function ingestEvidenceFilesUnlocked(files = []) {
  const validation = validateEvidenceFiles(files);
  if (!validation.ok) {
    const message = validation.message || 'Evidence upload rejected.';
    evidenceIngestionStatus.textContent = message;
    if (activeRunMode === 'chat') {
      setAttachmentStatus(message, 'error');
      renderEvidencePipelineStatus({
        phase: 'error',
        progress: 0,
        title: 'Evidence upload rejected',
        detail: message,
        state: 'error',
        files: Array.from(files || [])
      });
    }
    if (evidenceInput) evidenceInput.value = '';
    if (chatEvidenceInput) chatEvidenceInput.value = '';
    return;
  }
  const selected = Array.from(files).slice(0, 8);
  if (!selected.length) return;
  const fileLabel = `${selected.length} evidence file${selected.length === 1 ? '' : 's'}`;
  evidenceIngestionStatus.textContent = `Preparing ${fileLabel}… ${formatBytes(uploadTargetLimitsForClient().maxFileBytes)} per file max.`;
  if (activeRunMode === 'chat') {
    renderEvidencePipelineStatus({
      phase: 'queue',
      progress: 6,
      title: 'Evidence intake started',
      detail: `Preparing ${fileLabel} for parser and retrieval indexing.`,
      files: selected
    });
    renderAgentActivity([
      { label: 'Intake Agent', detail: 'waiting', status: 'queued' },
      { label: 'Obligation Mapper', detail: 'queued', status: 'queued' },
      { label: 'Evidence Examiner', detail: 'reading files', status: 'active' },
      { label: 'Risk & Controls', detail: 'queued', status: 'queued' },
      { label: 'Responsible AI', detail: 'queued', status: 'queued' },
      { label: 'Audit Packager', detail: 'waiting', status: 'queued' }
    ]);
  }
  try {
    const offset = uploadedEvidence.length;
    const extracted = [];
    const fixtureFiles = [];
    const nonFixtureFiles = [];
    for (const [index, file] of selected.entries()) {
      const fixtureEvidence = await lookupFixtureEvidenceFile(file, offset + index);
      if (fixtureEvidence) {
        fixtureFiles.push(file);
        extracted.push(fixtureEvidence);
      } else {
        nonFixtureFiles.push(file);
      }
    }
    if (fixtureFiles.length && activeRunMode === 'chat') {
      renderEvidencePipelineStatus({
        phase: 'parse',
        progress: 34,
        title: 'Fixture document recognized',
        detail: `${fixtureFiles.length} generated fixture PDF${fixtureFiles.length === 1 ? '' : 's'} matched the safe manifest and will be indexed from fixture metadata/text.`,
        metric: 'fixture profile',
        files: fixtureFiles
      });
    }
    const backendFiles = nonFixtureFiles.filter((file) => backendParsedEvidenceExtensions.has(fileExtension(file.name)));
    const browserFiles = nonFixtureFiles.filter((file) => !backendParsedEvidenceExtensions.has(fileExtension(file.name)));

    if (backendFiles.length) {
      evidenceIngestionStatus.textContent = `Uploading ${backendFiles.length} document${backendFiles.length === 1 ? '' : 's'} to backend parser…`;
      if (activeRunMode === 'chat') {
        renderEvidencePipelineStatus({
          phase: 'upload',
          progress: 12,
          title: 'Opening parser session',
          detail: 'Large evidence is chunked through the parser relay; parsing, OCR, and clause extraction stay behind the backend boundary.',
          files: backendFiles
        });
        renderAgentActivity([
          { label: 'Intake Agent', detail: 'waiting', status: 'queued' },
          { label: 'Obligation Mapper', detail: 'queued', status: 'queued' },
          { label: 'Evidence Examiner', detail: 'uploading', status: 'active' },
          { label: 'Risk & Controls', detail: 'queued', status: 'queued' },
          { label: 'Responsible AI', detail: 'queued', status: 'queued' },
          { label: 'Audit Packager', detail: 'waiting', status: 'queued' }
        ]);
      }
      await yieldToBrowser();
      try {
        const parsedEvidence = await uploadEvidenceFilesToBackend(backendFiles, (progress) => {
          if (activeRunMode === 'chat') renderEvidencePipelineStatus(progress);
        });
        extracted.push(...parsedEvidence);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Backend parsing failed.';
        const authBlocked = isAuthorizationError(error);
        if (activeRunMode === 'chat') {
          renderEvidencePipelineStatus({
            phase: 'error',
            progress: 28,
            title: authBlocked ? 'Parser relay authorization required' : 'Parser relay unavailable',
            detail: authBlocked
              ? 'File metadata is preserved. Add the private demo/JWT bearer token in Runtime settings to use protected parser/OCR routes.'
              : 'File parsing/OCR did not complete. Metadata is preserved; typed summaries still let the deterministic council run.',
            metric: 'fallback',
            files: backendFiles,
            state: 'error'
          });
        }
        chatMessages.push({
          role: 'assistant',
          text: authBlocked
            ? `Parser relay authorization required: ${authorizationRecoveryMessage('Parser relay')} I registered the file metadata only, so paste the supplier/workflow and key clauses if you need to continue without parser/OCR.`
            : `Parser relay fallback: I could not parse the evidence through the backend parser (${detail}). I registered the file metadata only. Chat intake, deterministic council, audit trace, and PDF export still work; paste the supplier/workflow and key clauses before running council.`
        });
        for (const [index, file] of backendFiles.entries()) {
          extracted.push(await extractEvidenceFile(file, offset + index, { allowBrowserText: false }));
        }
      }
    }

    for (const [index, file] of browserFiles.entries()) {
      evidenceIngestionStatus.textContent = `Registering ${index + 1}/${browserFiles.length}: ${file.name}`;
      if (activeRunMode === 'chat') {
        renderEvidencePipelineStatus({
          phase: 'parse',
          progress: 36 + ((index + 1) / browserFiles.length) * 28,
          title: 'Registering evidence metadata',
          detail: `No browser parsing is performed for ${file.name}; add a backend parser adapter before indexing this file type.`,
          metric: `${index + 1}/${browserFiles.length}`,
          files: browserFiles
        });
      }
      await yieldToBrowser();
      extracted.push(await extractEvidenceFile(file, offset + extracted.length, { allowBrowserText: readableEvidenceExtensions.has(fileExtension(file.name)) }));
      await yieldToBrowser();
    }

    let indexResult = null;
    const indexableCount = buildEvidenceIndexDocuments(extracted).length;
    if (indexableCount) {
      evidenceIngestionStatus.textContent = `Embedding ${indexableCount} parsed evidence document${indexableCount === 1 ? '' : 's'} for retrieval…`;
      if (activeRunMode === 'chat') {
        renderEvidencePipelineStatus({
          phase: 'embed',
          progress: 88,
          title: 'Embedding/indexing',
          detail: 'Embedding parsed evidence with text-embedding-3-large through the shared gateway.',
          metric: 'embedding',
          files: extracted
        });
        renderAgentActivity([
          { label: 'Intake Agent', detail: 'ready', status: 'complete' },
          { label: 'Obligation Mapper', detail: 'queued', status: 'queued' },
          { label: 'Evidence Examiner', detail: 'indexing', status: 'active' },
          { label: 'Risk & Controls', detail: 'queued', status: 'queued' },
          { label: 'Responsible AI', detail: 'queued', status: 'queued' },
          { label: 'Audit Packager', detail: 'waiting', status: 'queued' }
        ]);
      }
      try {
        indexResult = await indexEvidenceForRetrieval(extracted);
        const provider = evidenceIndexProvider(indexResult);
        const localFallback = /local|none|metadata/.test(provider);
        if (activeRunMode === 'chat') {
          renderEvidencePipelineStatus({
          phase: 'ready',
          progress: 100,
          title: 'Evidence retrieval ready',
            detail: `${indexResult?.index?.chunkCount || indexResult?.chunking?.chunkCount || indexedChunkCount()} embedded chunks are ready for council citations. ${evidenceIndexStorageSummary(indexResult)}`,
            metric: localFallback ? 'local fallback' : 'indexed',
            files: extracted,
            state: localFallback ? 'warning' : 'ready'
          });
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Evidence indexing failed.';
        if (activeRunMode === 'chat') {
          renderEvidencePipelineStatus({
            phase: 'error',
            progress: 92,
            title: 'Embeddings gateway unavailable',
            detail: 'Semantic retrieval was disabled for this evidence. The extracted summary remains available to the deterministic council.',
            metric: 'fallback',
            files: extracted,
            state: 'error'
          });
        }
        chatMessages.push({
          role: 'assistant',
          text: `Gateway fallback: I parsed the file, but could not index it for semantic retrieval (${detail}). I can still use the extracted summary and typed context in the deterministic council; citation retrieval and embeddings search are disabled for this file.`
        });
      }
    }

    extracted.forEach(stripEvidencePayloadForBrowser);
    uploadedEvidence = [...uploadedEvidence, ...extracted].slice(0, 12);
    evidenceIngestionStatus.textContent = `${uploadedEvidence.length} uploaded evidence file${uploadedEvidence.length === 1 ? '' : 's'} attached to next run.`;
    if (activeRunMode === 'chat') {
      syncUploadedEvidenceIntoChatDraft();
      const names = extracted.map((item) => item.title || item.fileName).join(', ');
      const parsedCount = extracted.filter((item) => item.extractionStatus !== 'binary_registered').length;
      const binaryOnlyCount = extracted.length - parsedCount;
      const signalCount = unique(extracted.flatMap((item) => item.signals || [])).length;
      const indexedCount = extracted.filter((item) => item.indexStatus === 'indexed').length;
      const chunkCount = indexResult?.index?.chunkCount || indexResult?.chunking?.chunkCount || indexedChunkCount();
      if (indexedCount) {
        renderEvidencePipelineStatus({
          phase: 'ready',
          progress: 100,
          title: 'Evidence ready for council',
          detail: `${uploadedEvidence.length} file${uploadedEvidence.length === 1 ? '' : 's'} attached · ${indexedChunkCount()} indexed chunks ready for semantic retrieval. ${evidenceIndexStorageSummary(indexResult)}`,
          metric: /local|none|metadata/.test(evidenceIndexProvider(indexResult)) ? 'local fallback' : 'ready',
          files: extracted,
          state: /local|none|metadata/.test(evidenceIndexProvider(indexResult)) ? 'warning' : 'ready'
        });
      } else {
        setAttachmentStatus(`${uploadedEvidence.length} file${uploadedEvidence.length === 1 ? '' : 's'} attached. ${binaryOnlyCount ? 'Describe the case before running council.' : 'Continue the case or run council.'}`, 'ready');
      }
      const eventSummary = binaryOnlyCount
        ? `Evidence uploaded: ${names}. ${parsedCount} parsed, ${binaryOnlyCount} registered as metadata only. Classify what was uploaded and ask the next best question.`
        : indexedCount
          ? `Evidence uploaded: ${names}. ${signalCount} extracted signals and ${chunkCount} indexed retrieval chunks are available. Classify the uploaded document and ask the next best review question before requesting generic metadata.`
          : `Evidence uploaded: ${names}. ${signalCount} extracted signals are available, but semantic retrieval is not indexed yet. Classify the uploaded document and ask the next best question.`;
      await submitChatMessage(eventSummary, {
        eventType: 'evidence_uploaded',
        silentUser: true,
        activeQuestion: '',
        skipEvidenceWait: true
      });
      renderAgentActivity([
        { label: 'Intake Agent', detail: 'ready', status: 'complete' },
        { label: 'Obligation Mapper', detail: 'queued', status: 'queued' },
        { label: 'Evidence Examiner', detail: indexedCount ? 'citation-ready' : binaryOnlyCount ? 'metadata-only' : 'parsed', status: indexedCount || !binaryOnlyCount ? 'complete' : 'queued' },
        { label: 'Risk & Controls', detail: 'queued', status: 'queued' },
        { label: 'Responsible AI', detail: 'queued', status: 'queued' },
        { label: 'Audit Packager', detail: 'waiting', status: 'queued' }
      ]);
    } else if (activeRunMode !== 'live') {
      setRunMode('live', { skipRender: true });
    }
    renderEvidenceQueue();
    if (activeRunMode === 'live') {
      runAgent(currentFormPayload(), { playback: true, mode: 'live', skipEvidenceWait: true });
    }
  } catch (error) {
    evidenceIngestionStatus.textContent = error instanceof Error ? error.message : 'Evidence extraction failed.';
    if (activeRunMode === 'chat') {
      setAttachmentStatus(error instanceof Error ? error.message : 'Evidence extraction failed.', 'error');
    }
  } finally {
    if (evidenceInput) evidenceInput.value = '';
    if (chatEvidenceInput) chatEvidenceInput.value = '';
  }
}

function getStages(result) {
  return result?.orchestration?.flow?.stages?.length ? result.orchestration.flow.stages : fallbackStages;
}

function clearPlaybackTimers() {
  playbackTimers.forEach((timer) => window.clearTimeout(timer));
  playbackTimers = [];
}

function completedRunRegistry() {
  return window.P42AppModules.completedRunRegistry || {};
}

function isCompletedRun(run) {
  return typeof completedRunRegistry().isCompletedRun === 'function'
    ? completedRunRegistry().isCompletedRun(run)
    : Boolean(run?.ok);
}

const RUN_HISTORY_LIMIT = 12;
const RUN_HISTORY_STORAGE_VERSION = 2;

function makeClientRunId(result = {}, mode = activeRunMode) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const casePart = cleanText(result.case?.caseId || result.case?.supplierName || mode || 'case')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'case';
  const random = Math.random().toString(36).slice(2, 8);
  return `run_${stamp}_${casePart}_${random}`;
}

function ensureRunId(result = null, mode = activeRunMode) {
  if (!result || typeof result !== 'object') return result;
  if (!cleanText(result.runId)) result.runId = makeClientRunId(result, mode);
  return result;
}

function normalizeHistoryMode(mode = activeRunMode) {
  return ['demo', 'live', 'chat'].includes(mode) ? mode : activeRunMode;
}

function buildRunHistoryRecord(mode = activeRunMode, result = null) {
  const normalizedMode = normalizeHistoryMode(mode);
  const run = ensureRunId(result, normalizedMode);
  if (!isCompletedRun(run) || !cleanText(run.runId)) return null;
  const completedAt = cleanText(run.completedAt || run.timestamp || '') || new Date().toISOString();
  const supplierName = cleanText(run.case?.supplierName || run.case?.serviceDescription || run.case?.brief || '');
  const documents = Array.isArray(run.case?.documents) ? run.case.documents : [];
  const documentTitle = cleanText(documents[0]?.title || documents[0]?.fileName || '');
  const caseId = cleanText(run.case?.caseId || '');
  const decision = cleanText(run.decision?.recommendation || run.decision?.status || '');
  return {
    scopeId: runHistoryScope()?.id || '',
    runId: cleanText(run.runId),
    mode: normalizedMode,
    caseId,
    supplierName,
    documentTitle,
    decision,
    completedAt,
    gapCount: Array.isArray(run.gaps) ? run.gaps.length : 0,
    evidenceCount: Array.isArray(run.evidenceIds) ? run.evidenceIds.length : 0,
    result: run
  };
}

function loadCompletedRunHistory() {
  removeStorage(storageKeys.runHistory);
  const scope = runHistoryScope();
  if (!scope) {
    removeSessionStorage(storageKeys.runHistory);
    return [];
  }
  const envelope = readSessionJsonStorage(storageKeys.runHistory, null);
  if (!envelope
    || Number(envelope.version) !== RUN_HISTORY_STORAGE_VERSION
    || cleanText(envelope.scopeId) !== scope.id
    || !Array.isArray(envelope.records)) {
    removeSessionStorage(storageKeys.runHistory);
    return [];
  }
  return envelope.records
    .filter((record) => (
      record
      && cleanText(record.scopeId) === scope.id
      && cleanText(record.runId)
      && isCompletedRun(record.result)
    ))
    .slice(0, RUN_HISTORY_LIMIT);
}

function hydrateLatestCompletedRunFromHistory() {
  const record = completedRunHistory[0];
  if (!record?.result) return null;
  const mode = normalizeHistoryMode(record.mode);
  const result = ensureRunId(record.result, mode);
  lastRuns[mode] = result;
  lastRun = result;
  latestCompletedRunMode = mode;
  latestCompletedRun = result;
  return result;
}

function saveCompletedRunHistory() {
  removeStorage(storageKeys.runHistory);
  const scope = runHistoryScope();
  if (!scope) {
    removeSessionStorage(storageKeys.runHistory);
    return;
  }
  const records = completedRunHistory
    .filter((record) => cleanText(record?.scopeId) === scope.id)
    .slice(0, RUN_HISTORY_LIMIT);
  writeSessionJsonStorage(storageKeys.runHistory, {
    version: RUN_HISTORY_STORAGE_VERSION,
    scopeId: scope.id,
    scope: {
      sessionType: scope.sessionType,
      sessionId: scope.sessionId,
      workspaceId: scope.workspaceId
    },
    records
  });
}

function formatRunHistoryTime(value = '') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recent';
  try {
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return value.slice(0, 16) || 'recent';
  }
}

function runHistoryLabel(record = {}) {
  const supplier = cleanText(record.supplierName);
  const documentTitle = cleanText(record.documentTitle);
  const subject = supplier && documentTitle && normalizedIdentity(supplier) !== normalizedIdentity(documentTitle)
    ? `${supplier} - ${documentTitle}`
    : cleanText(supplier || documentTitle || record.caseId || 'Council run');
  const trace = cleanText(record.runId).slice(-10);
  return `${subject} | ${record.mode || 'run'} | ${formatRunHistoryTime(record.completedAt)} | ${trace}`;
}

function renderRunHistorySelect(selectedRunId = '') {
  if (!runHistorySelect) return;
  if (!completedRunHistory.length) {
    runHistorySelect.innerHTML = '<option value="">No completed runs</option>';
    runHistorySelect.disabled = true;
    return;
  }
  const selected = cleanText(selectedRunId || latestCompletedRun?.runId || completedRunHistory[0]?.runId);
  runHistorySelect.disabled = false;
  runHistorySelect.innerHTML = completedRunHistory.map((record) => `
    <option value="${escapeHtml(record.runId)}">${escapeHtml(runHistoryLabel(record))}</option>
  `).join('');
  if (selected && completedRunHistory.some((record) => record.runId === selected)) {
    runHistorySelect.value = selected;
  }
}

function rememberCompletedRun(mode = activeRunMode, result = null) {
  const record = buildRunHistoryRecord(mode, result);
  if (!record) return result;
  const existing = completedRunHistory.find((entry) => entry.runId === record.runId);
  if (existing?.completedAt && !cleanText(record.result?.completedAt || record.result?.timestamp || '')) {
    record.completedAt = existing.completedAt;
  }
  completedRunHistory = [
    record,
    ...completedRunHistory.filter((entry) => entry.runId !== record.runId)
  ].slice(0, RUN_HISTORY_LIMIT);
  saveCompletedRunHistory();
  renderRunHistorySelect(record.runId);
  return record.result;
}

function restoreRunFromHistory(runId = '') {
  const record = completedRunHistory.find((entry) => entry.runId === runId);
  if (!record?.result) return;
  const mode = normalizeHistoryMode(record.mode);
  const result = ensureRunId(record.result, mode);
  lastRuns[mode] = result;
  lastRun = result;
  latestCompletedRunMode = mode;
  latestCompletedRun = result;
  renderRunHistorySelect(result.runId);
  setRunMode(mode, { skipRender: true, preserveRunComplete: true });
  showCouncilOutput({ allowCaseMismatch: true });
}

function runSummaryForChatDraft(result = {}) {
  if (!result || typeof result !== 'object') return null;
  const existingVersion = Number(result.caseVersion || chatCaseDraft.lastCouncilRun?.caseVersion || chatCaseDraft.caseVersion || 0);
  return {
    ok: Boolean(result.ok),
    runId: cleanEvidenceText(result.runId || result.id || ''),
    decision: cleanEvidenceText(result.decision?.recommendation || result.decision?.decision || result.output?.decision || ''),
    riskLevel: cleanEvidenceText(result.decision?.riskLevel || result.output?.risk_level || ''),
    completedAt: cleanEvidenceText(result.completedAt || result.timestamp || new Date().toISOString()),
    caseVersion: existingVersion || 1,
    evidenceCount: Number((result.evidenceIds || []).length || (result.citations || []).length || chatCaseDraft.documents?.length || 0),
    amendmentCount: Number(chatCaseDraft.caseAmendments?.length || 0)
  };
}

function registerCompletedRun(runMode = activeRunMode, result = null, { currentSession = false } = {}) {
  if (!isCompletedRun(result)) return result;
  const mode = ['demo', 'live', 'chat'].includes(runMode) ? runMode : activeRunMode;
  const completed = rememberCompletedRun(mode, result);
  if (currentSession && completed?.runId) currentSessionRunIds.add(completed.runId);
  lastRuns[mode] = completed;
  lastRun = completed;
  latestCompletedRunMode = mode;
  latestCompletedRun = completed;
  if (mode === 'chat') {
    const summary = runSummaryForChatDraft(completed);
    mergeChatCaseDraft({
      lastCouncilRun: summary,
      caseVersion: summary?.caseVersion || chatCaseDraft.caseVersion || 0,
      councilStatus: 'current',
      councilStaleReason: '',
      rerunRecommended: false,
      pendingCaseUpdateClarification: null
    });
  }
  return completed;
}

function getLatestCompletedRun(preferredMode = '') {
  if (typeof completedRunRegistry().selectLatestCompletedRun === 'function') {
    return completedRunRegistry().selectLatestCompletedRun({
      lastRuns,
      latestCompletedRun,
      lastRun
    }, preferredMode);
  }
  if (preferredMode && isCompletedRun(lastRuns[preferredMode])) return lastRuns[preferredMode];
  if (isCompletedRun(latestCompletedRun)) return latestCompletedRun;
  if (isCompletedRun(lastRuns.chat)) return lastRuns.chat;
  if (isCompletedRun(lastRuns.live)) return lastRuns.live;
  if (isCompletedRun(lastRuns.demo)) return lastRuns.demo;
  if (isCompletedRun(lastRun)) return lastRun;
  return null;
}

function runCaseId(run = {}) {
  return cleanEvidenceText(run.case?.caseId || run.caseId || run.context?.caseId || '');
}

function runCaseLabel(run = {}) {
  return cleanEvidenceText(run.case?.supplierName || run.case?.brief || run.case?.caseId || run.runId || 'completed run');
}

function currentDraftCaseId() {
  return cleanEvidenceText(chatCaseDraft.caseId || '');
}

function normalizedIdentity(value = '') {
  return cleanEvidenceText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function documentIdentitySet(documents = []) {
  return new Set((Array.isArray(documents) ? documents : [])
    .flatMap((doc) => [doc.evidenceId, doc.sourceEvidenceId, doc.title, doc.fileName])
    .map(normalizedIdentity)
    .filter(Boolean));
}

function caseIdentityOverlap(run = {}) {
  const currentSupplier = normalizedIdentity(chatCaseDraft.supplierName || chatCaseDraft.documentContext?.supplierName);
  const completedSupplier = normalizedIdentity(run.case?.supplierName || run.case?.brief);
  if (currentSupplier && completedSupplier && (currentSupplier === completedSupplier || currentSupplier.includes(completedSupplier) || completedSupplier.includes(currentSupplier))) {
    return true;
  }
  const currentDocs = documentIdentitySet(chatCaseDraft.documents);
  const completedDocs = documentIdentitySet(run.case?.documents);
  for (const key of currentDocs) {
    if (completedDocs.has(key)) return true;
  }
  return false;
}

function councilRunHasCaseConflict(run = {}) {
  const currentId = currentDraftCaseId();
  const completedId = runCaseId(run);
  return Boolean(currentId && completedId && currentId !== completedId && !caseIdentityOverlap(run));
}

function uniqueCompletedRunCandidates(candidates = []) {
  const seen = new Set();
  return candidates.filter((run) => {
    if (!isCompletedRun(run)) return false;
    const key = run.runId || `${runCaseId(run)}:${runCaseLabel(run)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCouncilOutputRun() {
  const preferred = getLatestCompletedRun(activeRunMode);
  if (activeRunMode !== 'chat' && isCompletedRun(preferred)) return preferred;
  const candidates = uniqueCompletedRunCandidates([
    preferred,
    latestCompletedRun,
    lastRuns.chat,
    lastRuns.live,
    lastRuns.demo,
    lastRun
  ]);
  return candidates.find((run) => !councilRunHasCaseConflict(run)) || candidates[0] || null;
}

function getReviewPackExportRun() {
  return getCouncilOutputRun() || getLatestCompletedRun(activeRunMode) || latestCompletedRun || lastRun;
}

function councilOutputIntegrity(run = {}, options = {}) {
  if (!run || !isCompletedRun(run)) {
    return { ok: false, message: 'No completed council output is available yet.' };
  }
  if (options.allowCaseMismatch) return { ok: true };
  if (councilRunHasCaseConflict(run)) {
    const currentId = currentDraftCaseId();
    return {
      ok: false,
      message: `The latest completed council run is for ${runCaseLabel(run)}, but the active case draft is ${currentId}. Select the previous run from history or run the council again for this case.`
    };
  }
  return { ok: true };
}

function syncWorkspaceTabState() {
  workspaceTabButtons.forEach((button) => {
    const selected = workspaceView === 'output'
      ? button === councilOutputTab
      : button.dataset.runMode === activeRunMode;
    setTabSelection(button, selected);
  });
  if (caseWorkspacePanel) {
    caseWorkspacePanel.hidden = workspaceView === 'output';
    caseWorkspacePanel.setAttribute('aria-labelledby', `${activeRunMode}ModeTab`);
  }
  if (workflowPanel) workflowPanel.hidden = workspaceView !== 'output';
}

function setWorkspaceView(view = 'chat', options = {}) {
  workspaceView = view === 'output' ? 'output' : 'chat';
  document.body.dataset.workspaceView = workspaceView;
  syncWorkspaceTabState();
  if (workspaceView !== 'output' && !options.preserveRunComplete && !getLatestCompletedRun(activeRunMode)) {
    document.body.dataset.runComplete = 'false';
  }
  if (workspaceView === 'output') {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      ensureDecisionRoomVisible();
    });
  }
}

function setIntelRailTab(tab = 'case') {
  activeIntelRailTab = tab === 'council' ? 'council' : 'case';
  if (decisionRail) {
    decisionRail.dataset.intelRailView = activeIntelRailTab;
  }
  intelRailTabs.forEach((button) => {
    const selected = button.dataset.intelRailTab === activeIntelRailTab;
    setTabSelection(button, selected);
  });
  if (caseIntelligencePanel) caseIntelligencePanel.hidden = activeIntelRailTab !== 'case';
  if (agentActivity) agentActivity.hidden = activeIntelRailTab !== 'council';
}

function ensureDecisionRoomVisible(options = {}) {
  if (workspaceView !== 'output' || !specialistList) return;
  const visibleText = cleanEvidenceText(specialistList.textContent || '');
  if (visibleText) return;
  const outputRun = getCouncilOutputRun();
  const integrity = councilOutputIntegrity(outputRun, {
    ...options,
    allowCaseMismatch: options.allowCaseMismatch || activeRunMode !== 'chat'
  });
  if (outputRun && integrity.ok) {
    renderRun(outputRun, { finalVisible: true, runMode: latestCompletedRunMode || activeRunMode });
  } else {
    renderDecisionRoomEmptyState(integrity.message || 'No council output has been generated yet. Return to Advisor, describe the case, then run the council.');
  }
}

function showCouncilOutput(options = {}) {
  const outputRun = options.allowCaseMismatch ? getLatestCompletedRun(activeRunMode) : getCouncilOutputRun();
  clearPlaybackTimers();
  if (activeMainSection !== 'agent') {
    setMainSection('agent', {
      updateHash: true,
      scroll: false,
      refresh: false,
      restoreAdvisor: false
    });
  }
  setWorkspaceView('output', { preserveRunComplete: true });
  const integrity = councilOutputIntegrity(outputRun, {
    ...options,
    allowCaseMismatch: options.allowCaseMismatch || activeRunMode !== 'chat'
  });
  if (outputRun && integrity.ok) {
    lastRun = outputRun;
    renderRun(outputRun, {
      finalVisible: true,
      runMode: latestCompletedRunMode || activeRunMode
    });
    document.body.classList.add('has-decision-output');
    document.body.dataset.runComplete = 'true';
  } else {
    renderDecisionRoomEmptyState(integrity.message);
  }
}

const mainSections = new Set(['agent', 'evidence', 'audit', 'admin', 'hardening']);
const mainSectionHash = {
  agent: '#run',
  evidence: '#evidence',
  audit: '#audit',
  admin: '#admin',
  hardening: '#hardening'
};

function mainSectionFromHash(hash = window.location.hash) {
  const cleanHash = String(hash || '').toLowerCase();
  if (cleanHash === '#evidence') return 'evidence';
  if (cleanHash === '#audit') return 'audit';
  if (cleanHash === '#admin') return 'admin';
  if (cleanHash === '#hardening') return 'hardening';
  return 'agent';
}

function isCompactMainLayout() {
  return window.matchMedia('(max-width: 1180px)').matches;
}

function updateTopbarSectionState(section) {
  topbarSectionLinks.forEach((link) => {
    const selected = link.dataset.mainSection === section;
    link.classList.toggle('is-active', selected);
    if (selected) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function updateMainSectionHash(section, replace = false) {
  const hash = mainSectionHash[section] || mainSectionHash.agent;
  if (window.location.hash === hash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
  window.history[replace ? 'replaceState' : 'pushState']({ mainSection: section }, '', nextUrl);
}

function scrollMainSectionIntoView(section, behavior = 'smooth') {
  const selector = mainSectionHash[section] || mainSectionHash.agent;
  const node = document.querySelector(selector);
  if (!node) return;
  if (isCompactMainLayout()) {
    node.scrollIntoView({ behavior, block: 'start' });
    return;
  }
  if (section !== 'agent' && typeof node.scrollTo === 'function') {
    node.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function refreshMainSection(section) {
  if (section === 'admin') {
    loadDeploymentStatus();
    loadAdminStatus();
    loadAdminFeatures();
    loadAuditLog();
  } else if (section === 'hardening') {
    loadReadiness();
    loadBenchmarks();
  } else if (section === 'audit') {
    ensureDecisionRoomVisible();
  }
}

function setMainSection(section = 'agent', options = {}) {
  const nextSection = mainSections.has(section) ? section : 'agent';
  activeMainSection = nextSection;
  document.body.dataset.mainSection = activeMainSection;
  updateTopbarSectionState(activeMainSection);
  if (options.updateHash) {
    updateMainSectionHash(activeMainSection, Boolean(options.replaceHash));
  }
  if (activeMainSection === 'agent' && options.restoreAdvisor !== false) {
    setRunMode('chat', { skipRender: true });
    setWorkspaceView('chat');
    renderChatMessages();
    renderContextStrength();
    renderChatAttachments();
  }
  if (options.refresh !== false) {
    refreshMainSection(activeMainSection);
  }
  if (options.scroll !== false) {
    window.requestAnimationFrame(() => scrollMainSectionIntoView(activeMainSection, options.behavior || 'smooth'));
  }
}

function contextStrength(draft = chatCaseDraft) {
  return window.P42AppModules.caseIntelligencePanel.contextStrength(draft);
}

function contextCopy(score) {
  return window.P42AppModules.caseIntelligencePanel.contextCopy(score);
}

function reviewerMissingItemLabel(item = '') {
  const key = String(item || '').toLowerCase();
  if (/owner|business.?unit|accountable/.test(key)) return 'who owns this review internally';
  if (/geograph|jurisdiction|perimeter|region|country/.test(key)) return 'geography or regulatory perimeter';
  if (/ai.?usage|ai.?use|high.?impact|automated|hr|employment/.test(key)) return 'AI use and high-impact decision boundary';
  if (/export.?origin|origin.?jurisdiction/.test(key)) return 'export origin jurisdiction';
  if (/export.?end.?use|end.?user/.test(key)) return 'export end-use and end-user boundary';
  if (/sanctions|restricted.?party|denied.?party/.test(key)) return 'sanctions and restricted-party screening';
  if (/remote.?support|firmware/.test(key)) return 'remote support access controls';
  if (/evidence|proof|document|source/.test(key)) return 'source evidence or documents';
  if (/scope|request|review|case/.test(key)) return 'what needs to be reviewed';
  return humanize(item);
}

function readinessMissingItems(draft = chatCaseDraft, readiness = chatRunReadiness) {
  const blockers = Array.isArray(readiness?.executionBlockers) ? readiness.executionBlockers : [];
  const items = blockers.map(reviewerMissingItemLabel);
  if (!cleanEvidenceText(draft.businessUnit)) items.push('who owns this review internally');
  if (!cleanEvidenceText(draft.geography)) items.push('geography or regulatory perimeter');
  if (!hasEvidenceContext(draft)) items.push('source evidence or documents');
  if (!hasCaseRequestContext(draft)) items.push('what needs to be reviewed');
  return unique(items).filter(Boolean);
}

function renderContextStrength(draft = chatCaseDraft) {
  if (!contextStrengthBar || !contextStrengthLabel || !contextStrengthText) return;
  const readiness = draft === chatCaseDraft ? chatRunReadiness : null;
  const hasCase = hasCaseRequestContext(draft);
  const score = hasCase && Number.isFinite(readiness?.score) ? readiness.score : hasCase ? contextStrength(draft) : 0;
  const runnable = readiness?.runnable;
  const blockerCount = readiness?.executionBlockers?.length || 0;
  const missingItems = readinessMissingItems(draft, readiness).slice(0, 2);
  const [label, text] = !hasCase && hasEvidenceContext(draft)
    ? ['Evidence staged', 'Tell me what you need reviewed. Staged evidence does not count as case readiness until the request is clear.']
    : readiness
    ? runnable
      ? [
        readiness.advisoryGaps?.length ? 'Runnable with open gaps' : 'Council ready',
        readiness.advisoryGaps?.length
          ? 'The council can run now and will preserve unresolved evidence or control gaps in the decision.'
          : 'Ready - click Run council. Human approval still remains required.'
      ]
      : [
        blockerCount ? 'Blocked before council' : 'Building context',
        missingItems.length
          ? `Missing: ${missingItems.join('; ')}.`
          : 'The advisor has context, but more detail is needed before execution.'
      ]
    : contextCopy(score);
  contextStrengthLabel.textContent = `${label} · ${score}%`;
  contextStrengthText.textContent = text;
  contextStrengthBar.style.width = `${score}%`;
  contextStrengthBar.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, Math.round(score)))));
  syncPrimaryActionState();
  renderCaseIntelligence(draft, lastRuns.chat);
}

function normalizeAgentKey(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function councilOutcomeVerb(agentId, status = 'queued') {
  if (status === 'active') return 'working';
  if (status !== 'complete') return 'waiting';
  if (agentId === 'controls' && (lastRun?.gaps?.length || lastRuns.chat?.gaps?.length)) return 'challenged';
  if (agentId === 'review') return 'escalated';
  if (agentId === 'packager') return 'packaged';
  return 'validated';
}

function councilAgentNarrative(agent, item = {}) {
  const draft = chatCaseDraft || {};
  const result = lastRuns[activeRunMode] || lastRun || {};
  const missing = missingProofItems(draft, result);
  const riskSignals = unique(draft.riskSignals || []);
  const evidenceMatches = evidenceMatchesFor(result, draft);
  const chunks = indexedChunkCount();
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const domains = Array.isArray(result.domains) ? result.domains : [];
  const narratives = {
    intake: {
      reviewed: 'Plain-English intake, uploaded evidence metadata, owner, geography, and requested decision.',
      found: missing.length ? `${missing.length} context item${missing.length === 1 ? '' : 's'} still need confirmation.` : 'Enough intake context is present for council review.',
      evidenceImpact: evidenceMatches.length || chunks ? 'Evidence is already available to shape follow-up questions.' : 'No evidence has changed the case yet.',
      handoff: 'Creates the case draft and passes scoped facts to the obligation mapper.'
    },
    obligations: {
      reviewed: 'Scope, geography, integrations, regulated data/assets, and detected risk signals.',
      found: domains.length ? `${domains.length} obligation domain${domains.length === 1 ? '' : 's'} mapped into the review.` : `${riskSignals.length || 0} risk signal${riskSignals.length === 1 ? '' : 's'} ready for domain mapping.`,
      evidenceImpact: riskSignals.length ? 'Signals are being translated into domain obligations.' : 'The mapper is waiting for risk or evidence signals.',
      handoff: 'Turns applicable domains into evidence questions for the examiner.'
    },
    evidence: {
      reviewed: 'Attached documents, retrieved snippets, citation IDs, and metadata-only fallbacks.',
      found: chunks ? `${chunks} server-side retrieval chunk${chunks === 1 ? '' : 's'} available for citations.` : evidenceMatches.length ? `${evidenceMatches.length} evidence match${evidenceMatches.length === 1 ? '' : 'es'} found.` : 'No citation-ready evidence is available yet.',
      evidenceImpact: chunks || evidenceMatches.length ? 'Citation-ready proof can support or challenge the decision.' : 'The decision will stay weaker until source proof is attached.',
      handoff: 'Promotes proof and unresolved evidence gaps into the control review.'
    },
    controls: {
      reviewed: 'Obligations, missing proof, criticality, access scope, and business impact.',
      found: gaps.length ? `${gaps.length} blocking gap${gaps.length === 1 ? '' : 's'} challenged the approval path.` : 'No blocking control gap remains in the deterministic analysis.',
      evidenceImpact: gaps.length ? 'Evidence gaps are being converted into reviewer actions.' : 'Evidence did not create a blocking control issue.',
      handoff: 'Converts residual risk into required human reviewer actions.'
    },
    review: {
      reviewed: 'Decision wording, unsupported certainty, responsible AI boundary, and approval lock.',
      found: 'Human approval remains required; the system does not auto-approve.',
      evidenceImpact: 'Weak or missing evidence keeps the recommendation inside human review.',
      handoff: 'Escalates reviewer confirmations to the audit packager.'
    },
    packager: {
      reviewed: 'Decision memo, trace, evidence IDs, gaps, retrieval context, and export readiness.',
      found: result?.ok ? 'Review pack is ready to export after council completion.' : 'Waiting for a completed run before packaging.',
      evidenceImpact: result?.ok ? 'Evidence IDs, citations, and reviewer actions are packaged for inspection.' : 'No exportable evidence pack exists yet.',
      handoff: 'Packages the executive decision room and advanced trace for inspection.'
    }
  };
  return {
    ...(narratives[agent.id] || narratives.intake),
    status: item.status || 'queued',
    detail: item.detail || 'queued',
    verb: councilOutcomeVerb(agent.id, item.status || 'queued')
  };
}

function buildCouncilAgentViews(items = defaultAgentActivity) {
  const normalizedItems = (items || []).map((item, index) => ({
    ...item,
    index,
    key: normalizeAgentKey(item.id || item.label || item.agent || item.role)
  }));
  return councilVisualAgents.map((agent, index) => {
    const agentKey = normalizeAgentKey(agent.id);
    const labelKey = normalizeAgentKey(agent.label);
    const source = normalizedItems.find((item) => item.key === agentKey || item.key.includes(agentKey) || labelKey.includes(item.key))
      || normalizedItems[index]
      || {};
    const status = source.status || (index === 0 ? 'active' : 'queued');
    const narrative = councilAgentNarrative(agent, { ...source, status });
    return {
      ...agent,
      ...narrative,
      status,
      detail: source.detail || narrative.detail
    };
  });
}

function buildCouncilRunAnimationItems(activeFrameIndex = 0) {
  const boundedIndex = Math.max(0, Math.min(councilRunAnimationFrames.length - 1, activeFrameIndex));
  return councilRunAnimationFrames.map((frame, index) => {
    const agent = councilVisualAgents.find((item) => item.id === frame.id) || {};
    return {
      id: frame.id,
      label: agent.label || titleCase(frame.id),
      detail: index < boundedIndex ? 'validated' : index === boundedIndex ? frame.detail : 'queued',
      handoff: frame.handoff,
      status: index < boundedIndex ? 'complete' : index === boundedIndex ? 'active' : 'queued'
    };
  });
}

function stopCouncilRunAnimation() {
  if (councilRunAnimationTimer) {
    window.clearInterval(councilRunAnimationTimer);
    councilRunAnimationTimer = null;
  }
  councilRunAnimationActive = false;
}

function startCouncilRunAnimation(context = {}) {
  stopCouncilRunAnimation();
  councilRunAnimationActive = true;
  councilRunAnimationFrameIndex = 0;
  if (typeof setIntelRailTab === 'function') setIntelRailTab('council');
  const renderFrame = () => {
    const items = buildCouncilRunAnimationItems(councilRunAnimationFrameIndex);
    const currentFrame = councilRunAnimationFrames[councilRunAnimationFrameIndex] || councilRunAnimationFrames[0];
    renderAgentActivity(items, {
      animationSource: context.source || 'council_run',
      handoff: currentFrame?.handoff || ''
    });
    councilRunAnimationFrameIndex = (councilRunAnimationFrameIndex + 1) % councilRunAnimationFrames.length;
  };
  renderFrame();
  councilRunAnimationTimer = window.setInterval(renderFrame, 1200);
}

function renderAgentActivity(items = defaultAgentActivity, renderOptions = {}) {
  if (!agentActivity) return;
  lastCouncilActivity = items;
  const views = buildCouncilAgentViews(items);
  const active = views.find((item) => item.status === 'active') || views.find((item) => item.status === 'complete') || views[0];
  if (!views.some((item) => item.id === councilFocusAgent)) {
    councilFocusAgent = active.id;
  }
  if (active?.status === 'active') {
    councilFocusAgent = active.id;
  }
  const focus = views.find((item) => item.id === councilFocusAgent) || active;
  const completed = views.filter((item) => item.status === 'complete').length;
  const noActiveCase = !councilRunAnimationActive && activeRunMode === 'chat' && workspaceView === 'chat' && !hasChatContext() && !uploadedEvidence.length && !lastRuns.chat?.ok;
  const isRunActive = !noActiveCase && views.some((item) => item.status === 'active');
  const activeLabel = noActiveCase ? 'Council' : active?.status === 'active' ? active.label : 'Decision core';
  const activitySummary = noActiveCase ? 'queued for intake' : active?.status === 'active' ? 'is working' : 'is ready';
  const currentHandoff = renderOptions.handoff
    || (items || []).find((item) => item.id === active?.id)?.handoff
    || active?.handoff
    || 'Specialists pass only validated signals to the deterministic decision owner.';
  agentActivity.innerHTML = `
    <details class="council-trace-details">
      <summary>
        <span>Executive council view</span>
        <strong>${escapeHtml(activeLabel)} ${escapeHtml(activitySummary)}</strong>
      </summary>
    <div class="council-constellation ${noActiveCase ? 'is-idle' : ''} ${isRunActive ? 'is-running' : ''}">
      <div class="agent-activity-header">
        <div>
          <span class="eyebrow">Executive council view</span>
          <strong>${escapeHtml(activeLabel)} ${escapeHtml(activitySummary)}</strong>
        </div>
        <small>Deterministic specialist validation</small>
      </div>
      <div class="council-handoff-strip" aria-live="polite">
        <span class="council-handoff-dot ${isRunActive ? 'is-active' : ''}"></span>
        <div>
          <strong>${escapeHtml(activeLabel)}</strong>
          <small>${escapeHtml(currentHandoff)}</small>
        </div>
      </div>
      <div class="constellation-stage" aria-label="Interactive deterministic council map">
        <svg class="constellation-svg" viewBox="0 0 640 430" aria-hidden="true">
          <defs>
            <radialGradient id="decisionCoreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#19d6a5" stop-opacity="0.38"></stop>
              <stop offset="60%" stop-color="#88b9ff" stop-opacity="0.1"></stop>
              <stop offset="100%" stop-color="#06100f" stop-opacity="0"></stop>
            </radialGradient>
          </defs>
          <circle cx="320" cy="214" r="128" class="council-ring council-ring-one"></circle>
          <circle cx="320" cy="214" r="74" class="council-ring council-ring-two"></circle>
          <circle cx="320" cy="214" r="46" fill="url(#decisionCoreGlow)" class="council-core-glow"></circle>
          ${views.map((agent, index) => {
            const controlX = Math.round((agent.svgX + 320) / 2);
            const controlY = Math.round((agent.svgY + 214) / 2) + (index % 2 === 0 ? -32 : 32);
            return `
              <path id="council-path-${escapeHtml(agent.id)}" class="council-link is-${escapeHtml(agent.status)} ${isRunActive && agent.id === active.id ? 'is-current' : ''}" d="M ${agent.svgX} ${agent.svgY} C ${controlX} ${controlY}, ${controlX} ${controlY}, 320 214"></path>
              <circle class="council-packet is-${escapeHtml(agent.status)} ${isRunActive && agent.id === active.id ? 'is-current' : ''}" r="${agent.status === 'queued' ? 2.8 : 4.4}">
                <animateMotion dur="${3.2 + (index * 0.18)}s" begin="${index * 0.18}s" repeatCount="indefinite">
                  <mpath href="#council-path-${escapeHtml(agent.id)}"></mpath>
                </animateMotion>
              </circle>
            `;
          }).join('')}
        </svg>
        <div class="decision-core">
          <span>${escapeHtml(Math.round((completed / views.length) * 100))}%</span>
          <strong>Decision core</strong>
          <small>human review locked</small>
        </div>
        ${views.map((agent) => {
          const tooltip = `${agent.label} - ${titleCase(agent.verb)}. ${agent.found} Handoff: ${agent.handoff}`;
          return `
          <button type="button" class="council-agent is-${escapeHtml(agent.status)} ${agent.id === focus.id ? 'is-focused' : ''}" data-council-agent="${escapeHtml(agent.id)}" style="--agent-x: ${agent.x}%; --agent-y: ${agent.y}%;" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}">
            <span>${escapeHtml(agent.short)}</span>
            <strong>${escapeHtml(agent.label)}</strong>
            <small>${escapeHtml(agent.verb)}</small>
          </button>
        `;}).join('')}
      </div>
      <div class="council-focus-card is-${escapeHtml(focus.status)}">
        <div>
          <span class="eyebrow">${escapeHtml(focus.verb)}</span>
          <strong>${escapeHtml(focus.label)}</strong>
        </div>
        <dl>
          <div><dt>Status</dt><dd>${escapeHtml(titleCase(focus.verb))}</dd></div>
          <div><dt>Found</dt><dd>${escapeHtml(focus.found)}</dd></div>
          <div><dt>Evidence impact</dt><dd>${escapeHtml(focus.evidenceImpact)}</dd></div>
          <div><dt>Handoff</dt><dd>${escapeHtml(focus.handoff)}</dd></div>
        </dl>
      </div>
    </div>
    </details>
  `;
}

function renderChatAttachments() {
  if (!chatAttachmentList) return;
  if (!uploadedEvidence.length) {
    chatAttachmentList.innerHTML = '';
    return;
  }
  chatAttachmentList.innerHTML = uploadedEvidence.slice(-5).map((item) => `
    <span class="${item.extractionStatus === 'binary_registered' ? 'needs-extraction' : ''} ${item.indexStatus === 'indexed' ? 'is-indexed' : ''}">
      <b>${escapeHtml(item.evidenceId)}</b>
      ${escapeHtml(item.title || item.fileName || 'Attached evidence')}
      <em>${escapeHtml(evidenceStatusLabel(item))}</em>
    </span>
  `).join('');
}

function evidenceStatusLabel(item = {}) {
  if (window.P42AppModules?.evidenceUploadUi?.evidenceStatusLabel) {
    return window.P42AppModules.evidenceUploadUi.evidenceStatusLabel(item);
  }
  if (item.indexStatus === 'indexed') return 'citation-ready';
  if (item.sourceType === 'fixture_pdf' && item.extractionStatus === 'metadata_fallback') return 'fixture profile';
  if (item.extractionStatus === 'sampled_text') return 'sampled text';
  if (item.extractionStatus === 'backend_parsed' || item.extractionStatus === 'text_extracted') return 'parsed';
  if (item.extractionStatus === 'binary_registered') return 'metadata-only';
  if (item.extractionStatus) return humanize(item.extractionStatus);
  if (item.signals?.length) return item.signals.slice(0, 2).join(', ');
  return 'attached';
}

function missingProofItems(draft = chatCaseDraft, result = lastRuns.chat) {
  const readiness = draft === chatCaseDraft ? chatRunReadiness : null;
  return window.P42AppModules.caseIntelligencePanel.missingProofItems({ draft, result, readiness });
}

function nextBestAction(draft = chatCaseDraft, result = lastRuns.chat) {
  const readiness = draft === chatCaseDraft ? chatRunReadiness : null;
  return window.P42AppModules.caseIntelligencePanel.nextBestAction({ draft, result, readiness });
}

function evidenceStatusSummary(draft = chatCaseDraft) {
  return window.P42AppModules.caseIntelligencePanel.evidenceStatusSummary({
    draft,
    uploadedEvidence,
    evidenceIndexMeta,
    evidenceIndexValidation
  });
}

function compactUiLabel(value = '', maxLength = 48) {
  return window.P42AppModules.caseIntelligencePanel.compactUiLabel(value, maxLength);
}

function retrievalContextFor(result = lastRuns.chat, draft = chatCaseDraft) {
  return result?.retrievalContext || result?.case?.retrievalContext || draft?.retrievalContext || {};
}

function evidenceMatchesFor(result = lastRuns.chat, draft = chatCaseDraft) {
  const retrieval = retrievalContextFor(result, draft);
  return Array.isArray(retrieval.evidenceMatches)
    ? retrieval.evidenceMatches
    : Array.isArray(retrieval.matches) ? retrieval.matches : [];
}

function learningSuggestionsFor(result = lastRuns.chat, draft = chatCaseDraft) {
  const retrieval = retrievalContextFor(result, draft);
  return {
    similarCases: Array.isArray(retrieval.similarCases) ? retrieval.similarCases : [],
    suggestions: retrieval.learningSuggestions || null,
    missingEvidenceSignals: Array.isArray(retrieval.missingEvidenceSignals) ? retrieval.missingEvidenceSignals : []
  };
}

function advisorySpecialistsFor(result = lastRuns.chat) {
  const output = result?.orchestration?.llmOutput || result?.runtime?.llmOutput || null;
  return Array.isArray(output?.specialists) ? output.specialists : [];
}

function memoryProviderLabel(draft = chatCaseDraft) {
  return draft.indexedEvidence?.provider || evidenceIndexMeta.provider || 'local-file fallback';
}

function rollingSummaryStatus(draft = chatCaseDraft) {
  return cleanEvidenceText(draft?.memorySummary || draft?.conversationSummary) ? 'enabled' : 'disabled';
}

function contextRetainedRows(draft = chatCaseDraft, indexedChunks = 0) {
  return [
    ['Recent turns retained', `${conversationPayloadHistoryTurns}`],
    ['Rolling summary', rollingSummaryStatus(draft)],
    ['Evidence chunks indexed', `${Number(indexedChunks || draft?.indexedEvidence?.chunkCount || evidenceIndexMeta.chunkCount || 0) || 0}`]
  ];
}

function contextRetainedHtml(draft = chatCaseDraft, indexedChunks = 0) {
  const rows = contextRetainedRows(draft, indexedChunks);
  return `
    <details class="intel-detail-pack context-retained-block" open>
      <summary><span>Context retained</span><b>${escapeHtml(rows[1][1])}</b></summary>
      <div class="memory-status-grid">
        ${rows.map(([label, value]) => `<span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b>`).join('')}
      </div>
    </details>
  `;
}

function caseAmendmentNoticeHtml(draft = chatCaseDraft) {
  if (!draft || draft.councilStatus !== 'superseded_pending_rerun') return '';
  const changes = Array.isArray(draft.caseAmendments) ? draft.caseAmendments.slice(-3) : [];
  const changeText = changes.length
    ? changes.map((item) => `${cleanEvidenceText(item.field).replace(/_/g, ' ')}: ${cleanEvidenceText(item.value)}`).join(' · ')
    : cleanEvidenceText(draft.councilStaleReason || 'case facts changed');
  return `
    <div class="case-amendment-notice" role="status">
      <span class="eyebrow">Case updated after council</span>
      <strong>Previous result needs rerun</strong>
      <p>${escapeHtml(changeText)}</p>
      <button type="button" data-report-action="run-council">Rerun council</button>
    </div>
  `;
}

function addPreviewSignal(items = [], value = '') {
  const signal = cleanEvidenceText(value);
  if (!signal) return items;
  return unique([...(Array.isArray(items) ? items : []), signal]);
}

function inferLiveInputDraft(baseDraft = chatCaseDraft, inputText = '') {
  const text = cleanEvidenceText(inputText);
  if (!text) return baseDraft;
  const draft = {
    ...(baseDraft || {}),
    __previewOnly: true,
    brief: cleanEvidenceText(baseDraft?.brief) || text
  };
  let riskSignals = Array.isArray(draft.riskSignals) ? [...draft.riskSignals] : [];
  let evidenceSignals = Array.isArray(draft.evidenceSignals) ? [...draft.evidenceSignals] : [];
  let integrations = Array.isArray(draft.integrations) ? [...draft.integrations] : [];

  if (!cleanEvidenceText(draft.supplierName)) {
    if (/(agreement|contract|msa|dpa|sow|clause|document)/i.test(text)) {
      draft.supplierName = 'Document review request';
    } else if (/(vendor|supplier|third[-\s]?party|outsourc)/i.test(text)) {
      draft.supplierName = 'Third-party onboarding request';
    } else {
      draft.supplierName = 'Draft from current message';
    }
  }

  if (!cleanEvidenceText(draft.businessUnit)) {
    if (/\b(hr|people|payroll)\b/i.test(text)) draft.businessUnit = 'HR / Payroll';
    else if (/\bfinance|treasury|payment|invoice|ledger\b/i.test(text)) draft.businessUnit = 'Finance';
    else if (/\bprocurement|vendor|supplier|third[-\s]?party\b/i.test(text)) draft.businessUnit = 'Procurement / Third-Party Risk';
    else if (/\bit|technology|security|platform|integration\b/i.test(text)) draft.businessUnit = 'IT / Security';
  }

  if (!cleanEvidenceText(draft.geography)) {
    const geographies = [];
    if (/\babu dhabi\b/i.test(text)) geographies.push('Abu Dhabi');
    if (/\buae\b|emirates/i.test(text)) geographies.push('UAE');
    if (/\bindia\b/i.test(text)) geographies.push('India');
    if (/\bksa\b|saudi/i.test(text)) geographies.push('KSA');
    if (/\beu\b|emea|gdpr|europe/i.test(text)) geographies.push('EU / EMEA');
    if (/\bglobal\b|cross[-\s]?border/i.test(text)) geographies.push('Global / cross-border');
    if (geographies.length) draft.geography = unique(geographies).join(' and ');
  }

  if (/\bpayroll|hris|employee|salary|compensation\b/i.test(text)) {
    integrations = addPreviewSignal(integrations, 'Payroll / HRIS');
    riskSignals = addPreviewSignal(riskSignals, 'employee personal data');
    riskSignals = addPreviewSignal(riskSignals, 'outsourced critical process');
  }
  if (/\bpatient|healthcare|medical|clinical\b/i.test(text)) {
    riskSignals = addPreviewSignal(riskSignals, 'sensitive health data');
  }
  if (/\bai|model|training|inference|llm|chip|accelerator\b/i.test(text)) {
    riskSignals = addPreviewSignal(riskSignals, 'AI/model governance');
  }
  if (/\bexport|sanction|end[-\s]?use|import|customs\b/i.test(text)) {
    riskSignals = addPreviewSignal(riskSignals, 'export controls and sanctions');
  }
  if (/\bcross[-\s]?border|transfer|offshore|india|eu|global\b/i.test(text)) {
    riskSignals = addPreviewSignal(riskSignals, 'cross-border data transfer');
  }
  const platformMatches = Array.from(text.matchAll(/\b(oracle\s+erp|workday|sap|microsoft\s+365|m365|azure|servicenow|snowflake|salesforce|sharepoint|erp)\b/gi))
    .map((match) => match[1])
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .map((value) => {
      const lower = value.toLowerCase();
      if (lower === 'm365') return 'Microsoft 365';
      if (lower === 'oracle erp') return 'Oracle ERP';
      if (lower === 'servicenow') return 'ServiceNow';
      return value.replace(/\b\w/g, (char) => char.toUpperCase());
    });
  platformMatches.forEach((platform) => {
    integrations = addPreviewSignal(integrations, platform);
  });
  if (platformMatches.length) {
    riskSignals = addPreviewSignal(riskSignals, 'enterprise system integration');
  }
  if (/\bdpa\b|data processing agreement/i.test(text)) evidenceSignals = addPreviewSignal(evidenceSignals, 'DPA');
  if (/\bsoc\s*2\b|soc2/i.test(text)) evidenceSignals = addPreviewSignal(evidenceSignals, 'SOC 2');
  if (/\biso\s*27001\b/i.test(text)) evidenceSignals = addPreviewSignal(evidenceSignals, 'ISO 27001');
  if (/\bbcp\b|business continuity|disaster recovery|dr\b/i.test(text)) evidenceSignals = addPreviewSignal(evidenceSignals, 'BCP/DR');
  if (/\bcontract|agreement|msa|sow|clause|annex|addendum\b/i.test(text)) evidenceSignals = addPreviewSignal(evidenceSignals, 'contract document');

  draft.riskSignals = riskSignals;
  draft.evidenceSignals = evidenceSignals;
  draft.integrations = integrations;
  return draft;
}

function currentLivePreviewDraft() {
  return inferLiveInputDraft(chatCaseDraft, chatInput?.value || '');
}

function updateLiveCasePreview() {
  if (activeRunMode !== 'chat' || workspaceView !== 'chat') return;
  renderCaseIntelligence(currentLivePreviewDraft(), lastRuns.chat);
}

function scheduleLiveCasePreview() {
  if (liveCasePreviewTimer) window.clearTimeout(liveCasePreviewTimer);
  liveCasePreviewTimer = window.setTimeout(() => {
    liveCasePreviewTimer = null;
    updateLiveCasePreview();
  }, 300);
}

function updateDocumentTitle(draft = chatCaseDraft, result = lastRuns.chat) {
  const activeName = cleanEvidenceText(draft?.supplierName || result?.case?.supplierName || '');
  document.title = activeName ? `${compactUiLabel(activeName, 72)} - Parallax42 Compliance` : DEFAULT_DOCUMENT_TITLE;
}

function renderMissionWelcome() {
  if (!missionWelcome) return;
  const hasContext = hasChatContext() || chatMessages.length > 1 || lastRuns.chat?.ok;
  missionWelcome.hidden = Boolean(hasContext);
}

function renderCaseIntelligence(draft = chatCaseDraft, result = lastRuns.chat) {
  if (!caseIntelReadiness || !caseIntelDetails) return;
  if (!draft?.__previewOnly) updateDocumentTitle(draft, result);
  const isPreview = Boolean(draft?.__previewOnly);
  const useRunResult = Boolean(result?.ok && workspaceView === 'output');
  const panelResult = useRunResult ? result : null;
  const caseStarted = useRunResult || hasCaseRequestContext(draft);
  const evidenceOnly = !caseStarted && hasEvidenceContext(draft);
  const score = useRunResult
    ? Math.round(Number(result.decision?.readinessScore || 0) * 100)
    : !caseStarted ? 0 : isPreview ? contextStrength(draft) : Number.isFinite(chatRunReadiness?.score) ? chatRunReadiness.score : contextStrength(draft);
  if (!panelResult?.ok && !isPreview && !hasChatContext() && !hasEvidenceContext(draft)) {
    caseIntelReadiness.textContent = '0%';
    caseIntelDetails.innerHTML = `
      <div class="intel-meter" aria-hidden="true"><span style="width: 0%"></span></div>
      <div class="intel-empty-state">
        <strong>No active case</strong>
        <p>Describe a workflow or attach evidence. The panel will track readiness, missing proof, and council validation as the case develops.</p>
        <div class="intel-prompt-chips" aria-label="Case starters">
          <button type="button" data-intel-prompt="The supplier is ">Supplier name</button>
          <button type="button" data-intel-prompt="The accountable owner is ">Owner</button>
          <button type="button" data-intel-prompt="The company is in UAE and the supplier is in ">Geography</button>
          <button type="button" data-intel-prompt="I have a signed agreement, DPA, SOC 2, or ISO evidence for this review.">Evidence file</button>
        </div>
      </div>
    `;
    return;
  }
  if (evidenceOnly && !isPreview) {
    const evidenceSummary = evidenceStatusSummary(draft);
    const chunks = Number(draft.indexedEvidence?.chunkCount || evidenceIndexMeta.chunkCount || 0);
    caseIntelReadiness.textContent = '0%';
    caseIntelDetails.innerHTML = `
      <div class="intel-meter" aria-hidden="true"><span style="width: 0%"></span></div>
      <div class="executive-intel-list">
        <article>
          <span>Status</span>
          <strong>Evidence staged</strong>
        </article>
        <article>
          <span>Case readiness</span>
          <strong>Waiting for request</strong>
        </article>
        <article>
          <span>Evidence confidence</span>
          <strong>${escapeHtml(evidenceSummary)}</strong>
        </article>
        ${chunks ? `
          <article>
            <span>Server-side chunks</span>
            <strong>${escapeHtml(chunks)}</strong>
          </article>
        ` : ''}
      </div>
      <div class="next-action">
        <span class="eyebrow">Next best action</span>
        <strong>Describe what decision or review you need from this evidence.</strong>
      </div>
      ${contextRetainedHtml(draft, chunks)}
      <details class="intel-detail-pack human-boundary-card" open>
        <summary><span>Human review boundary</span><b>locked</b></summary>
        <strong>No council decision has started.</strong>
        <p>The file can be used as evidence, but readiness stays at 0% until a review request is supplied.</p>
      </details>
    `;
    return;
  }
  const risks = useRunResult
    ? (result.domains || []).filter((domain) => /applicable|needs|confirmation/i.test(domain.status || '')).map((domain) => domain.label)
    : unique(draft.riskSignals || []).map((item) => compactUiLabel(item, 42));
  const missing = missingProofItems(draft, panelResult);
  const supplier = useRunResult
    ? (draft.supplierName || result?.case?.supplierName || 'Completed review')
    : (draft.supplierName || 'New compliance case');
  const owner = useRunResult
    ? (draft.businessUnit || result?.case?.businessUnit || 'needed')
    : (draft.businessUnit || 'needed');
  const geography = useRunResult
    ? (draft.geography || result?.case?.geography || 'needed')
    : (draft.geography || 'needed');
  const approvalRequired = useRunResult ? humanApprovalRequired(result) : true;
  const evidenceMatches = evidenceMatchesFor(panelResult, draft);
  const learning = learningSuggestionsFor(panelResult, draft);
  const advisory = advisorySpecialistsFor(panelResult);
  const indexedChunks = Number(draft.indexedEvidence?.chunkCount || evidenceIndexMeta.chunkCount || retrievalContextFor(panelResult, draft).chunkCount || 0);
  const integrations = Array.isArray(draft.integrations) ? unique(draft.integrations).filter(Boolean) : [];
  const evidenceSummary = useRunResult
    ? `${(result.evidenceIds || []).length || result.citations?.length || 0} evidence ID${((result.evidenceIds || []).length || result.citations?.length || 0) === 1 ? '' : 's'} · ${humanize(result.evidenceQuality?.status || 'not scored')}`
    : evidenceStatusSummary(draft);
  caseIntelReadiness.textContent = `${Math.max(0, Math.min(100, Math.round(score)))}%`;
  caseIntelDetails.innerHTML = `
    <div class="intel-meter" aria-hidden="true"><span style="width: ${Math.max(0, Math.min(100, Math.round(score)))}%"></span></div>
    ${isPreview ? '<div class="intel-live-preview">Live typing preview</div>' : ''}
    <div class="executive-intel-list">
      <article>
        <span>Case</span>
        <strong>${escapeHtml(supplier)}</strong>
      </article>
      <article>
        <span>Owner</span>
        <strong>${escapeHtml(owner)}</strong>
      </article>
      <article>
        <span>Geography</span>
        <strong>${escapeHtml(geography)}</strong>
      </article>
      <article>
        <span>Evidence confidence</span>
        <strong>${escapeHtml(evidenceSummary)}</strong>
      </article>
      ${integrations.length ? `
        <article>
          <span>Integrations</span>
          <strong>${escapeHtml(compactUiLabel(integrations.join(', '), 72))}</strong>
        </article>
      ` : ''}
    </div>
    <div class="next-action">
      <span class="eyebrow">Next best action</span>
      <strong>${escapeHtml(nextBestAction(draft, result))}</strong>
    </div>
    ${caseAmendmentNoticeHtml(draft)}
    ${contextRetainedHtml(draft, indexedChunks)}
    <details class="intel-detail-pack risk-domain-block">
      <summary><span>Risk signals</span><b>${escapeHtml(risks.length || 0)}</b></summary>
      <div class="intel-chips">
        ${risks.length ? risks.slice(0, 6).map((risk) => `<span>${escapeHtml(risk)}</span>`).join('') : '<span>awaiting signals</span>'}
      </div>
    </details>
    <details class="intel-detail-pack missing-proof-block">
      <summary><span>Missing proof</span><b>${escapeHtml(missing.length || 0)}</b></summary>
      <ul>
        ${missing.length ? missing.map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>No intake blockers detected; reviewer confirmation still required.</li>'}
      </ul>
    </details>
    <details class="intel-detail-pack human-boundary-card">
      <summary><span>Human review boundary</span><b>${escapeHtml(approvalRequired ? 'locked' : 'check')}</b></summary>
      <strong>${escapeHtml(approvalRequired ? 'Approval cannot be automated' : 'Reviewer check still required')}</strong>
      <p>The system can prepare a decision memo and evidence pack, but the accountable human remains the approval owner.</p>
    </details>
    <details class="intel-detail-pack intel-advanced">
      <summary>Technical runtime details</summary>
      <div class="memory-status-grid">
        <span>Vector memory</span><b>${escapeHtml(memoryProviderLabel(draft))}</b>
        <span>Indexed chunks</span><b>${escapeHtml(indexedChunks || 0)}</b>
        <span>Retrieved matches</span><b>${escapeHtml(evidenceMatches.length)}</b>
        <span>Similar cases</span><b>${escapeHtml(learning.similarCases.length)}</b>
        <span>Reviewer patterns</span><b>${escapeHtml(learning.suggestions?.sourceMemoryIds?.length || 0)}</b>
        <span>Advisory specialists</span><b>${escapeHtml(advisory.length ? 'attached' : result?.orchestration?.liveLlm?.requested ? 'unavailable' : 'not requested')}</b>
        <span>Decision owner</span><b>deterministic engine</b>
      </div>
    </details>
  `;
}

function assistantFactsForMessage() {
  const draft = chatCaseDraft || {};
  const facts = [
    ['Owner', draft.businessUnit || 'needed'],
    ['Geography', draft.geography || 'needed'],
    ['Integrations', draft.integrations?.join(', ') || 'none yet'],
    ['Evidence', evidenceStatusSummary(draft)],
    ['Evidence matches', evidenceMatchesFor(lastRuns.chat, draft).length ? `${evidenceMatchesFor(lastRuns.chat, draft).length} found` : 'none yet'],
    ['Prior cases', learningSuggestionsFor(lastRuns.chat, draft).similarCases.length ? `${learningSuggestionsFor(lastRuns.chat, draft).similarCases.length} similar` : 'none yet']
  ].filter(([, value]) => cleanEvidenceText(value));
  return facts.slice(0, 6);
}

function activeConversationProfile() {
  return lastRuns.chat?.nlp?.requestProfile
    || chatCaseDraft?.llmIntake
    || chatCaseDraft?.intakeAssessment
    || {};
}

function isDocumentReviewProfile(profile = activeConversationProfile()) {
  return /document_review|contract_review|msa_review|dpa_review|clause_review|policy_review/i.test(profile.requestType || '')
    || /(agreement|contract|msa|dpa|clause|policy|document)/i.test(profile.reviewTarget || '');
}

function hasChatEvidenceSource() {
  return Boolean(
    chatCaseDraft?.documents?.length
    || chatCaseDraft?.evidenceSignals?.length
    || chatCaseDraft?.indexedEvidence?.chunkCount
    || evidenceIndexMeta?.chunkCount
    || uploadedEvidence.length
  );
}

function documentSourcePrompt() {
  const profile = activeConversationProfile();
  if (/clause/i.test(profile.requestType || profile.reviewTarget || profile.reviewScope || '')) {
    return 'Can you paste the clauses here or upload the source document?';
  }
  const target = profile.reviewTarget || 'agreement';
  return `Can you upload the ${target}, or paste the sections you want reviewed?`;
}

function naturalizeAssistantLead(text = '') {
  return window.P42AppModules.chatUi.naturalizeAssistantLead(text);
}

function assistantRawSummary(text = '') {
  return window.P42AppModules.chatUi.assistantRawSummary(text);
}

function assistantQuestionFromText(text = '') {
  const raw = String(text || '');
  if (/Compass gateway is not configured|Smart intake (?:received an invalid Compass response|could not get valid Compass JSON)/i.test(raw)) return '';
  const fallbackQuestion = () => {
    const missing = missingProofItems();
    if (missing.length) {
      if (isDocumentReviewProfile() && !hasChatEvidenceSource()) return documentSourcePrompt();
      const first = missing[0].toLowerCase();
      if (/owner|accountable/i.test(first)) return 'Who is the accountable business owner for this case?';
      if (/geography/i.test(first)) return 'Which geography or regulatory perimeter should I apply?';
      if (/evidence/i.test(first)) return 'What source evidence should I treat as proof for this decision?';
      return `Can you confirm the missing ${first}?`;
    }
    return chatRunReadiness?.runnable ? 'Should I run the council now?' : 'What else should I know before I run the council?';
  };
  const acceptableQuestion = (value = '') => {
    const candidate = cleanEvidenceText(value)
      .replace(/^(?:next(?:\s+(?:best|key|useful|review|follow[- ]?up))*\s+(?:question|clarification|scoping point|step)(?:\s*\([^)]{0,160}\))?|next key scoping point|next key clarification|to go deeper[^:]{0,120}|before i run[^:]{0,120})\s*:?\s*/i, '');
    if (!candidate || candidate.length < 12) return '';
    if (candidate.endsWith('?')) return normalizeAssistantQuestion(candidate);
    if (/^(who|what|which|where|when|how|can|does|do|is|are|should|within)\b/i.test(candidate)) return normalizeAssistantQuestion(`${candidate}?`);
    return '';
  };
  const nextBlock = raw.split(/Next(?:\s+(?:best|key|useful|review|follow[- ]?up))*\s+(?:questions?|clarification|scoping point|step)(?:\s*\([^)]{0,160}\))?:?/i)[1] || '';
  const bullet = nextBlock.match(/[-•]\s*([^\n]+)/);
  const bulletQuestion = acceptableQuestion(bullet?.[1]);
  if (bulletQuestion) return bulletQuestion;
  const question = raw.match(/([^.!?\n]*\?)/g)?.pop();
  const detectedQuestion = acceptableQuestion(question);
  return normalizeAssistantQuestion(detectedQuestion || fallbackQuestion());
}

function structuredAssistantQuestion(...candidates) {
  for (const value of candidates) {
    const candidate = cleanEvidenceText(value).replace(/^next question:\s*/i, '');
    if (!candidate || candidate.length < 12) continue;
    if (candidate.endsWith('?')) return normalizeAssistantQuestion(candidate);
    if (/^(who|what|which|where|when|how|can|does|do|is|are|should|within)\b/i.test(candidate)) {
      return normalizeAssistantQuestion(`${candidate}?`);
    }
  }
  return '';
}

function normalizeQuestionMetadata(metadata = {}, fallbackQuestion = '') {
  if (!metadata || typeof metadata !== 'object') return {};
  const text = cleanEvidenceText(metadata.text || fallbackQuestion);
  const id = cleanEvidenceText(metadata.id || metadata.questionId || '');
  const field = cleanEvidenceText(metadata.field || metadata.questionField || '');
  return (id || field || text) ? { id, field, text } : {};
}

function firstQuestionMetadataFromResult(result = {}, fallbackQuestion = '') {
  const serverMetadata = Array.isArray(result.questionMetadata) ? result.questionMetadata[0] : null;
  const draftMetadata = Array.isArray(result.caseDraft?.questionMetadata) ? result.caseDraft.questionMetadata[0] : null;
  return normalizeQuestionMetadata(serverMetadata || draftMetadata || {}, fallbackQuestion);
}

function isLikelyTruncatedQuestion(question = '') {
  const text = cleanEvidenceText(question);
  if (!text) return false;
  const openParens = (text.match(/\(/g) || []).length;
  const closeParens = (text.match(/\)/g) || []).length;
  if (openParens > closeParens) return true;
  if (/[,:;/-]\??$/.test(text)) return true;
  if (/\b(?:a|an|and|or|the|with|for|from|of|to|in|on|including)\??$/i.test(text)) return true;
  if (/\b[a-z]\??$/i.test(text) && !/\b(?:(?:option|choice|answer)\s+[abc]|[abc]\s+or\s+[abc])\??$/i.test(text)) return true;
  return false;
}

function normalizeAssistantQuestion(question = '') {
  const text = cleanEvidenceText(question);
  if (!text) return text;
  if (isLikelyTruncatedQuestion(text)) return '';
  const letters = text.replace(/[^a-z]/gi, '');
  const uppercase = letters.replace(/[^A-Z]/g, '');
  if (letters.length >= 8 && uppercase.length / letters.length > 0.72) {
    const lowered = text.toLowerCase();
    return `${lowered.charAt(0).toUpperCase()}${lowered.slice(1)}`.replace(/\bi\b/g, 'I');
  }
  return text;
}

function assistantAcknowledgement(text = '') {
  if (/Compass gateway is not configured|Smart intake (?:received an invalid Compass response|could not get valid Compass JSON)/i.test(text)) return 'Smart intake issue';
  if (/could not|failed|error/i.test(text)) return 'I hit a processing issue, but the case state is still safe.';
  if (lastRuns.chat?.ok) return 'Council run complete. I kept the decision review-bound.';
  const clean = cleanEvidenceText(text);
  if (/I understand this as|I’m treating this as|I'm treating this as/i.test(clean)) {
    return naturalizeAssistantLead(clean) || 'I updated the review context.';
  }
  if (window.P42AppModules.chatUi.isNaturalResponseCandidate?.(clean)) {
    return naturalizeAssistantLead(clean) || clean.slice(0, 180);
  }
  if (chatRunReadiness?.runnable) return 'I have enough context to prepare the decision room.';
  if (indexedChunkCount()) return 'I added the evidence to the case.';
  if (hasChatContext()) return 'Got it. I’m building the case.';
  return 'Tell me what needs review.';
}

function buildChatHintChips({ draft = {}, runReadiness = {}, missingFields = [], uploadedEvidence: evidence = [], smartIntakeDegraded = false } = {}) {
  const missing = new Set([
    ...(Array.isArray(missingFields) ? missingFields : []),
    ...(Array.isArray(runReadiness?.executionBlockers) ? runReadiness.executionBlockers : [])
  ].map((item) => String(item || '').toLowerCase()));
  const chips = [];
  if (smartIntakeDegraded) {
    chips.push({ label: 'Retry smart intake', action: 'retry-smart-intake' });
    chips.push({ label: 'Continue deterministic', action: 'continue-deterministic' });
  }
  if (missing.has('business_owner') || missing.has('business owner')) {
    chips.push({ label: 'Add owner', prompt: 'The accountable owner is ' });
  }
  if (missing.has('geography')) {
    chips.push({ label: 'Add geography', prompt: 'The geography is ' });
  }
  if ((missing.has('evidence') || missing.has('source evidence')) && !evidence.length) {
    chips.push({ label: 'Add evidence summary', prompt: 'Evidence includes ' });
  }
  if (runReadiness?.runnable) {
    chips.push({ label: 'Run council', action: 'run-council' });
  }
  return chips.slice(0, 3);
}

function renderThinkingLoader(message = {}) {
  return window.P42AppModules.chatUi.renderThinkingLoader(message);
}

function latestUserChatMessage() {
  return [...chatMessages].reverse().find((message) => message?.role === 'user' && message.text);
}

function renderAssistantTurn(message = {}, options = {}) {
  const canRun = Boolean(chatRunReadiness?.runnable);
  const legacyUnavailableText = !Object.prototype.hasOwnProperty.call(message, 'smartIntakeUnavailable')
    && /Compass gateway is not configured|Smart intake (?:received an invalid Compass response|could not get valid Compass JSON)/i.test(message.text || '');
  const smartIntakeUnavailable = Boolean(message.smartIntakeUnavailable) || legacyUnavailableText;
  const smartIntakeDegraded = Boolean(message.smartIntakeDegraded);
  const smartIntakeDiagnostic = Boolean(message.smartIntakeDiagnostic || message.invalidCompassResponse);
  const question = normalizeAssistantQuestion(message.displayedQuestion || message.nextBestQuestion) || assistantQuestionFromText(message.text);
  const acknowledgement = assistantAcknowledgement(message.text);
  return window.P42AppModules.chatUi.renderAssistantTurn(message, {
    acknowledgement,
    canRun,
    chatMessageCount: chatMessages.length,
    hasChatContext: hasChatContext(),
    lastRunOk: Boolean(lastRuns.chat?.ok),
    nextBestAction: nextBestAction(),
    question,
    rawText: message.text || '',
    responseText: message.text,
    source: chatCaseDraft.llmIntake?.provider || lastRuns.chat?.nlp?.llmAssessment?.provider || '',
    preferNaturalResponse: Boolean(message.generatedByCompass || message.compassNaturalResponse),
    isLatest: Boolean(options.isLatest),
    hintChips: buildChatHintChips({
      draft: chatCaseDraft,
      runReadiness: chatRunReadiness,
      missingFields: chatMissingFields,
      uploadedEvidence,
      smartIntakeDegraded: smartIntakeDegraded || smartIntakeDiagnostic
    }),
    smartIntakeUnavailable,
    smartIntakeDegraded: smartIntakeDegraded || smartIntakeDiagnostic,
    smartIntakeDiagnostic,
    degradedMessage: message.degradedMessage,
    unavailableMessage: message.unavailableMessage || message.text
  });
}

function persistActiveQuestion(question = '', metadata = {}) {
  const clean = cleanEvidenceText(question);
  const meta = normalizeQuestionMetadata(metadata, clean);
  activeQuestion = clean;
  activeQuestionId = meta.id || '';
  activeQuestionField = meta.field || '';
  const draft = mergeChatCaseDraft({
    activeQuestion: clean,
    activeQuestionId,
    activeQuestionField,
    questionMetadata: clean ? [{ ...meta, text: meta.text || clean }] : [],
    questions: clean ? [clean] : [],
    askedQuestions: unique([
      ...(chatCaseDraft.askedQuestions || []),
      ...(clean ? [clean] : [])
    ]).slice(-24)
  });
  if (!clean) draft.questions = [];
  if (!clean) draft.questionMetadata = [];
  return clean;
}

function refreshActiveQuestionFromLatestAssistant() {
  const latestAssistant = [...chatMessages].reverse().find((message) => message?.role === 'assistant' && !message.pending);
  if (!latestAssistant) {
    persistActiveQuestion('');
    return '';
  }
  const question = latestAssistant.displayedQuestion || assistantQuestionFromText(latestAssistant.text || '');
  if (question) latestAssistant.displayedQuestion = question;
  return persistActiveQuestion(question, {
    id: latestAssistant.displayedQuestionId || '',
    field: latestAssistant.displayedQuestionField || '',
    text: question
  });
}

function renderAssistantHistoryTurn(message = {}) {
  return window.P42AppModules.chatUi.renderAssistantHistoryTurn(message);
}

function syncUploadedEvidenceIntoChatDraft() {
  if (!uploadedEvidence.length) return;
  const existingDocuments = Array.isArray(chatCaseDraft.documents) ? chatCaseDraft.documents : [];
  const byId = new Map(existingDocuments.map((doc) => [doc.evidenceId || doc.title, doc]));
  uploadedEvidence.forEach((doc) => byId.set(doc.evidenceId || doc.title, doc));
  const fixtureProfiles = uploadedEvidence
    .map((doc) => doc.fixtureProfile)
    .filter((profile) => profile && typeof profile === 'object');
  const evidenceSignals = unique([
    ...(chatCaseDraft.evidenceSignals || []),
    ...uploadedEvidence.flatMap((doc) => doc.signals || [])
  ]);
  const riskSignals = unique([
    ...(chatCaseDraft.riskSignals || []),
    ...fixtureProfiles.flatMap((profile) => profile.expectedRiskDomains || []),
    ...fixtureProfiles.flatMap((profile) => profile.expectedMissingEvidence || [])
  ]).slice(0, 32);
  const knownGaps = unique([
    ...(chatCaseDraft.knownGaps || []),
    ...fixtureProfiles.flatMap((profile) => profile.expectedMissingEvidence || [])
  ]).slice(0, 24);
  const firstFixture = fixtureProfiles[0] || {};
  mergeChatCaseDraft({
    documents: Array.from(byId.values()).slice(-12),
    evidenceSignals,
    riskSignals,
    knownGaps,
    supplierName: firstFixture.provider || firstFixture.supplier || chatCaseDraft.supplierName,
    brief: firstFixture.serviceSummary || chatCaseDraft.brief,
    documentContext: firstFixture.filename ? {
      ...(chatCaseDraft.documentContext || {}),
      supplierName: firstFixture.provider || firstFixture.supplier || '',
      serviceDescription: firstFixture.serviceSummary || '',
      detectedDomain: firstFixture.domain || '',
      missingEvidence: firstFixture.expectedMissingEvidence || []
    } : chatCaseDraft.documentContext
  });
}

function indexedChunkCount() {
  return Number(chatCaseDraft.indexedEvidence?.chunkCount || evidenceIndexMeta.chunkCount || 0);
}

function indexedChunkCountForRetrieval() {
  if ((chatCaseDraft.indexedEvidence?.caseId || evidenceIndexMeta.caseId) && evidenceIndexValidation.status !== 'valid') {
    return 0;
  }
  return indexedChunkCount();
}

function renderModeIdle(mode = activeRunMode) {
  const copy = runModeCopy[mode] || runModeCopy.demo;
  lastRun = lastRuns[mode];
  if (lastRun?.ok && !(mode === 'chat' && workspaceView === 'chat')) {
    renderRun(lastRun, { runMode: mode });
    if (mode === 'chat') renderChatMessages();
    return;
  }
  document.body.classList.remove('has-decision-output');
  document.body.dataset.runComplete = 'false';
  decisionText.textContent = copy.waitingDecision;
  approvalStatus.textContent = copy.waitingApproval;
  setApprovalActions();
  setApprovalActionStatus('Human decision controls unlock after a completed council run.', 'idle');
  updateDecisionActionBar('idle');
  runtimeText.textContent = '--';
  readinessScore.textContent = '--';
  evidenceCount.textContent = mode === 'live' && uploadedEvidence.length ? String(uploadedEvidence.length) : '--';
  gapCount.textContent = '--';
  flowProgress.style.width = '0%';
  stageKicker.textContent = mode === 'chat' ? 'Chat ready' : mode === 'demo' ? 'Demo ready' : 'Live ready';
  stageStatus.textContent = mode === 'chat' ? 'Awaiting prompt' : mode === 'demo' ? 'Awaiting replay' : 'Awaiting intake run';
  stageOutput.textContent = mode === 'chat'
    ? 'Describe a compliance case; the advisor will run it through the agent and summarize blockers.'
    : mode === 'demo'
      ? 'Run a packaged scenario to inspect the agent trace and audit pack.'
      : 'Upload evidence or edit the live intake, then submit it to the configured runtime.';
  domainList.innerHTML = '<article class="empty-row">Domain coverage, gaps, and citations appear here after you run the council. Attach evidence documents in the chat to improve accuracy.</article>';
  gapList.innerHTML = '<article class="empty-row">Reviewer actions appear here after the council maps obligations and controls.</article>';
  traceList.innerHTML = '';
  if (rawRunDetails) {
    rawRunDetails.hidden = true;
    rawRunDetails.open = false;
  }
  if (rawRunJson) rawRunJson.textContent = '{}';
  specialistList.innerHTML = '';
  citationList.innerHTML = '<article class="empty-row">Citations appear after evidence is mapped. Upload or describe source documents before running the council.</article>';
  artifactPreview.innerHTML = `
    <div class="artifact-header">
      <span class="eyebrow">waiting</span>
      <strong>${escapeHtml(mode === 'chat' ? 'chat session' : mode === 'demo' ? 'demo replay' : 'live case')}</strong>
    </div>
    <p>The review pack and artifact preview populate after a council run. Click Run council in the Advisor tab to begin.</p>
    <pre>{
  "mode": "${escapeHtml(mode)}",
  "runStarted": false,
  "humanApprovalRequired": true
}</pre>
  `;
  if (mode === 'chat') {
    renderChatMessages();
    renderContextStrength();
    renderAgentActivity();
    renderChatAttachments();
  }
}

function resetChatCaseSession(options = {}) {
  const hasCompletedRun = Boolean(getLatestCompletedRun(activeRunMode));
  const hasConversation = chatMessages.length > 1 || hasChatContext() || uploadedEvidence.length;
  if (!options.skipConfirm && (hasCompletedRun || hasConversation)) {
    const shouldReset = window.confirm('Start a new case? Your current conversation and council output will be cleared.');
    if (!shouldReset) return false;
  }
  clearPlaybackTimers();
  document.body.classList.remove('has-decision-output');
  document.title = DEFAULT_DOCUMENT_TITLE;
  lastRun = null;
  lastRuns.chat = null;
  lastRuns.demo = null;
  lastRuns.live = null;
  latestCompletedRunMode = null;
  latestCompletedRun = null;
  humanReviewRecord = null;
  lastCouncilNarrative = null;
  uploadedEvidence = [];
  evidenceIndexMeta = {};
  evidenceIndexValidation = {
    status: 'not_checked',
    detail: 'No restored evidence index metadata has been checked.'
  };
  chatCaseDraft = {};
  chatRunReadiness = null;
  chatMissingFields = [];
  activeQuestion = 'What do you need reviewed?';
  activeQuestionId = '';
  activeQuestionField = '';
  chatMessages = [
    {
      role: 'assistant',
      text: 'What do you need reviewed?',
      displayedQuestion: 'What do you need reviewed?',
      displayedQuestionId: '',
      displayedQuestionField: ''
    }
  ];
  removeStorage(storageKeys.evidenceIndexMeta);
  clearChatSessionStorage();
  if (chatInput) chatInput.value = '';
  updateChatInputCounter();
  if (chatEvidenceInput) chatEvidenceInput.value = '';
  if (evidenceInput) evidenceInput.value = '';
  if (evidenceIngestionStatus) evidenceIngestionStatus.textContent = 'No uploaded evidence yet.';
  setAttachmentStatus('No files attached.', 'idle');
  setRunMode('chat', { skipRender: true });
  setWorkspaceView('chat');
  renderModeIdle('chat');
  if (sampleRun) {
    sampleRun.disabled = false;
    sampleRun.textContent = runModeCopy.chat.actionButton;
  }
  if (chatRunNow) {
    chatRunNow.disabled = false;
    chatRunNow.textContent = 'Run council';
  }
  if (chatForm) {
    const submitButton = chatForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = false;
  }
  chatInput?.focus();
  return true;
}

function setRunMode(mode = 'demo', options = {}) {
  activeRunMode = ['demo', 'live', 'chat'].includes(mode) ? mode : 'demo';
  const copy = runModeCopy[activeRunMode];
  if (activeRunMode !== 'chat') {
    setWorkspaceView('chat');
  }
  document.body.dataset.runMode = activeRunMode;
  if (!options.preserveRunComplete) {
    document.body.dataset.runComplete = 'false';
  }
  runModeButtons.forEach((button) => {
    setTabSelection(button, workspaceView !== 'output' && button.dataset.runMode === activeRunMode);
  });
  setTabSelection(councilOutputTab, workspaceView === 'output');
  if (caseWorkspacePanel) caseWorkspacePanel.setAttribute('aria-labelledby', `${activeRunMode}ModeTab`);
  casePanelEyebrow.textContent = copy.caseEyebrow;
  casePanelTitle.textContent = copy.caseTitle;
  runwayTitle.textContent = copy.runwayTitle;
  runwayDescription.textContent = copy.runwayDescription;
  formRunButton.textContent = copy.runButton;
  sampleRun.textContent = copy.actionButton;
  renderEvidenceQueue();
  if (activeRunMode === 'chat') {
    renderChatMessages();
    renderContextStrength();
    renderAgentActivity();
    renderChatAttachments();
  }
  if (!options.skipRender) {
    clearPlaybackTimers();
    renderModeIdle(activeRunMode);
  }
}

function currentFormPayload() {
  const data = new FormData(form);
  const scenario = scenarios[currentScenarioKey];
  const manualDocument = {
    evidenceId: 'INTAKE-01',
    title: 'User supplied evidence summary',
    sourceType: 'manual_summary',
    extractionStatus: 'manual',
    summary: data.get('documentSummary'),
    excerpt: summarizeEvidenceText(data.get('documentSummary'), 260),
    signals: detectEvidenceSignals(data.get('documentSummary'))
  };
  return {
    supplierName: scenario.supplierName,
    brief: data.get('brief'),
    businessUnit: data.get('businessUnit'),
    geography: data.get('geography'),
    documents: activeRunMode === 'live' ? [manualDocument, ...uploadedEvidenceForConversation()] : [manualDocument],
    integrations: scenario.integrations
  };
}

async function prepareDemoRunPayload(payload = {}) {
  if (readAdminBearerToken().trim()) return payload;
  await ensureDemoSession();
  const filename = demoFixtureFilenames[currentScenarioKey] || demoFixtureFilenames.exportControl;
  const prepared = await fetchJson(apiUrl('/api/demo/case'), withSessionAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  }));
  const storedCase = prepared?.case || {};
  const fixtureEvidence = storedCase.evidence?.length
    ? storedCase.evidence
    : prepared?.fixture?.evidence ? [prepared.fixture.evidence] : payload.documents;
  return {
    ...payload,
    caseId: storedCase.caseId,
    caseVersion: Number(storedCase.version || 1),
    supplierName: storedCase.supplierName || payload.supplierName,
    brief: storedCase.brief || payload.brief,
    businessUnit: storedCase.businessUnit || payload.businessUnit,
    geography: storedCase.geography || payload.geography,
    reviewFocus: storedCase.reviewFocus || payload.reviewFocus || [],
    knownGaps: storedCase.knownGaps || payload.knownGaps || [],
    documents: Array.isArray(fixtureEvidence) ? fixtureEvidence : []
  };
}

function applyScenario(key) {
  const scenario = scenarios[key] || scenarios.exportControl;
  currentScenarioKey = key;
  form.elements.brief.value = scenario.brief;
  form.elements.businessUnit.value = scenario.businessUnit;
  form.elements.geography.value = scenario.geography;
  form.elements.documentSummary.value = scenario.documents[0].summary;
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.scenario === key);
  });
  renderEvidenceQueue();
}

function renderEvidenceQueue(scenario = scenarios[currentScenarioKey]) {
  const scenarioItems = scenario.evidenceQueue.map((item, index) => ({
    evidenceId: `S${String(index + 1).padStart(2, '0')}`,
    title: item,
    extractionStatus: 'scenario_signal',
    signals: []
  }));
  const items = activeRunMode === 'live'
    ? uploadedEvidence
    : activeRunMode === 'chat' && uploadedEvidence.length
      ? uploadedEvidence
      : scenarioItems;
  if (!items.length) {
    evidenceQueue.innerHTML = '<span><b>UP-00</b><span>No live evidence uploaded yet.</span></span>';
    return;
  }
  evidenceQueue.innerHTML = items.map((item) => `
    <span class="${item.extractionStatus === 'binary_registered' ? 'needs-extraction' : ''} ${item.indexStatus === 'indexed' ? 'is-indexed' : ''}">
      <b>${escapeHtml(item.evidenceId)}</b>
      <span>${escapeHtml(item.title || item.fileName)}</span>
      ${item.indexStatus === 'indexed' ? '<em>indexed</em>' : item.signals?.length ? `<em>${escapeHtml(item.signals.slice(0, 2).join(', '))}</em>` : ''}
    </span>
  `).join('');
}

function renderCaseDraft() {
  const draft = chatCaseDraft || {};
  if (!hasCaseRequestContext(draft) && !lastRuns.chat?.ok) {
    caseDraftPanel.innerHTML = '';
    renderCaseIntelligence(draft, lastRuns.chat);
    renderMissionWelcome();
    return;
  }
  const integrations = Array.isArray(draft.integrations) ? draft.integrations : [];
  const evidenceSignals = Array.isArray(draft.evidenceSignals) ? draft.evidenceSignals : [];
  const riskSignals = Array.isArray(draft.riskSignals) ? draft.riskSignals : [];
  const pills = [...riskSignals, ...evidenceSignals, ...integrations].map((item) => compactUiLabel(item, 34)).slice(0, 6);
  const indexedLabel = draft.indexedEvidence?.chunkCount
    ? `${draft.indexedEvidence.chunkCount} server-side chunks`
    : '';
  const readiness = Number.isFinite(chatRunReadiness?.score) ? Math.round(chatRunReadiness.score) : contextStrength(draft);
  const status = chatRunReadiness?.runnable ? 'ready for council' : hasChatContext() || uploadedEvidence.length ? 'building case' : 'awaiting context';
  caseDraftPanel.innerHTML = `
    <div class="case-draft-header">
      <span class="eyebrow">working draft</span>
      <strong>${escapeHtml(draft.supplierName || 'New compliance case')}</strong>
    </div>
    <div class="draft-compact-strip">
      <span>${escapeHtml(status)}</span>
      <b>${escapeHtml(Math.max(0, Math.min(100, readiness)))}%</b>
    </div>
    <div class="draft-compact-meta">
      <span>Owner</span><b>${escapeHtml(draft.businessUnit || 'needed')}</b>
      <span>Geography</span><b>${escapeHtml(draft.geography || 'needed')}</b>
      <span>Evidence</span><b>${escapeHtml([evidenceStatusSummary(draft), indexedLabel].filter(Boolean).join(' · ') || 'needed')}</b>
    </div>
    <div class="draft-pills">
      ${pills.length ? pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join('') : '<span>awaiting context</span>'}
    </div>
  `;
  renderCaseIntelligence(draft, lastRuns.chat);
  renderMissionWelcome();
}

function latestAssistantMessageIndex() {
  return chatMessages
    .map((message, index) => message.role === 'assistant' ? index : -1)
    .filter((index) => index >= 0)
    .pop();
}

function chatRenderContextSignature(message = {}, index = -1, latestAssistantIndex = -1) {
  if (message.role !== 'assistant' || index !== latestAssistantIndex) return '';
  return JSON.stringify({
    canRun: Boolean(chatRunReadiness?.runnable),
    missingFields: chatMissingFields,
    uploadedEvidence: uploadedEvidence.map((item) => ({
      id: item.id || item.evidenceId || item.fileName || '',
      extractionStatus: item.extractionStatus || '',
      indexStatus: item.indexStatus || ''
    })),
    draft: {
      caseRequestStarted: Boolean(chatCaseDraft.caseRequestStarted),
      supplierName: chatCaseDraft.supplierName || '',
      businessUnit: chatCaseDraft.businessUnit || '',
      geography: chatCaseDraft.geography || '',
      riskSignals: chatCaseDraft.riskSignals || [],
      evidenceSignals: chatCaseDraft.evidenceSignals || [],
      integrations: chatCaseDraft.integrations || []
    },
    hasChatContext: hasChatContext(),
    lastRunOk: Boolean(lastRuns.chat?.ok),
    messageCount: chatMessages.length,
    nextBestAction: nextBestAction()
  });
}

function chatMessageSignature(message = {}, index = -1, latestAssistantIndex = -1) {
  return JSON.stringify({
    role: message.role || '',
    text: message.text || '',
    pending: Boolean(message.pending),
    thinkingStepIndex: Number(message.thinkingStepIndex || 0),
    elapsedSeconds: Number(message.elapsedSeconds || 0),
    retryNote: message.retryNote || '',
    displayedQuestion: message.displayedQuestion || '',
    displayedQuestionId: message.displayedQuestionId || '',
    displayedQuestionField: message.displayedQuestionField || '',
    answeringQuestion: message.answeringQuestion || '',
    answeringQuestionId: message.answeringQuestionId || '',
    answeringQuestionField: message.answeringQuestionField || '',
    smartIntakeUnavailable: Boolean(message.smartIntakeUnavailable),
    smartIntakeDegraded: Boolean(message.smartIntakeDegraded),
    smartIntakeDiagnostic: Boolean(message.smartIntakeDiagnostic || message.invalidCompassResponse),
    unavailableMessage: message.unavailableMessage || '',
    degradedMessage: message.degradedMessage || '',
    generatedByCompass: Boolean(message.generatedByCompass),
    compassNaturalResponse: Boolean(message.compassNaturalResponse),
    nextBestQuestion: message.nextBestQuestion || '',
    latestAssistant: message.role === 'assistant' && index === latestAssistantIndex,
    context: chatRenderContextSignature(message, index, latestAssistantIndex)
  });
}

function renderChatMessageArticle(message = {}, index = -1, latestAssistantIndex = -1) {
  return `
    <article class="chat-message is-${escapeHtml(message.role)} ${message.pending ? 'is-pending' : ''}">
      <strong>${message.role === 'user' ? 'You' : 'Advisor'}</strong>
      <div class="message-body">
        ${message.pending
          ? renderThinkingLoader(message)
          : message.role === 'assistant' && index === latestAssistantIndex
          ? renderAssistantTurn(message, { isLatest: true })
          : message.role === 'assistant'
            ? renderAssistantHistoryTurn(message)
            : `<p>${escapeHtml(message.text)}</p>`}
      </div>
    </article>
  `;
}

function patchChatMessageDom(latestAssistantIndex = -1) {
  if (!chatMessagesEl) return;
  const nextSignatures = chatMessages.map((message, index) => chatMessageSignature(message, index, latestAssistantIndex));
  let changed = chatMessagesEl.children.length !== chatMessages.length
    || renderedChatMessageSignatures.length !== nextSignatures.length;

  while (chatMessagesEl.children.length > chatMessages.length) {
    chatMessagesEl.lastElementChild.remove();
    changed = true;
  }

  chatMessages.forEach((message, index) => {
    if (renderedChatMessageSignatures[index] === nextSignatures[index] && chatMessagesEl.children[index]) return;
    const html = renderChatMessageArticle(message, index, latestAssistantIndex);
    if (chatMessagesEl.children[index]) {
      chatMessagesEl.children[index].outerHTML = html;
    } else {
      chatMessagesEl.insertAdjacentHTML('beforeend', html);
    }
    changed = true;
  });

  renderedChatMessageSignatures = nextSignatures;
  if (changed || chatMessages.length <= 1) {
    chatMessagesEl.scrollTop = chatMessages.length <= 1 ? 0 : chatMessagesEl.scrollHeight;
  }
}

function trimChatMessages() {
  if (chatMessages.length <= chatMessageLimit) return;
  const pinnedIntro = chatMessages[0]?.role === 'assistant' ? [chatMessages[0]] : [];
  const recent = chatMessages.slice(-(chatMessageLimit - pinnedIntro.length));
  chatMessages = [...pinnedIntro, ...recent];
}

function renderChatMessages() {
  trimChatMessages();
  refreshActiveQuestionFromLatestAssistant();
  renderCaseDraft();
  renderContextStrength();
  renderChatAttachments();
  patchChatMessageDom(latestAssistantMessageIndex());
  scheduleChatSessionSave();
}

function hasChatContext() {
  return hasCaseRequestContext(chatCaseDraft);
}

function hasSubstantiveReviewRequestText(value = '') {
  const text = cleanEvidenceText(value);
  if (!text || text.length < 8) return false;
  if (/^(unknown|dont know|don't know|do not know|not sure|pending|n\/a|na|no idea)$/i.test(text)) return false;
  if (/^(run it|run council|yes|no|ok|okay)$/i.test(text)) return false;
  return true;
}

function hasCaseRequestContext(draft = chatCaseDraft) {
  const record = draft || {};
  const hasUserRequest = Boolean(record.caseRequestStarted);
  const riskSignals = Array.isArray(record.riskSignals) ? record.riskSignals : [];
  const integrations = Array.isArray(record.integrations) ? record.integrations : [];
  return Boolean(
    hasUserRequest
    || (cleanEvidenceText(record.brief).length > 32 && !record.documentContextOnly)
    || cleanEvidenceText(record.businessUnit)
    || cleanEvidenceText(record.geography)
    || riskSignals.length
    || integrations.length
  );
}

function hasEvidenceContext(draft = chatCaseDraft) {
  const record = draft || {};
  return Boolean(
    uploadedEvidence.length
    || record.documents?.length
    || record.evidenceSignals?.length
    || record.indexedEvidence?.chunkCount
    || evidenceIndexMeta?.chunkCount
  );
}

function renderIntakePromptState() {
  decisionText.textContent = 'Waiting for intake';
  approvalStatus.textContent = 'Describe the case before running the agent workflow.';
  runtimeText.textContent = 'NLP case builder';
  readinessScore.textContent = 'intake';
  gapCount.textContent = '--';
  stageKicker.textContent = 'Chat intake';
  stageStatus.textContent = 'Describe the case';
  stageOutput.textContent = 'Add supplier, owner, geography, data, integrations, and evidence in plain English.';
}

function promptForChatContext() {
  setRunMode('chat', { skipRender: true });
  const lastMessage = chatMessages.at(-1)?.text || '';
  const hasBinaryOnlyEvidence = uploadedEvidence.some((item) => item.extractionStatus === 'binary_registered');
  const hasIndexedEvidence = Boolean(indexedChunkCountForRetrieval());
  const guidance = uploadedEvidence.length
    ? hasBinaryOnlyEvidence
      ? 'I have the file registered. What should I review it against?'
      : hasIndexedEvidence
        ? 'I parsed the evidence. What decision do you need?'
        : 'I have the evidence. What decision do you need?'
    : 'What do you need reviewed?';
  if (lastMessage !== guidance) {
    chatMessages.push({ role: 'assistant', text: guidance });
  }
  renderChatMessages();
  renderIntakePromptState();
  window.setTimeout(renderIntakePromptState, 0);
  chatInput.focus();
}

function chatCouncilActivityForDraft(draft = {}, missing = [], runReadiness = {}) {
  return window.P42AppModules.chatUi.chatCouncilActivityForDraft(draft, missing, runReadiness);
}

function renderConversationState(result = {}) {
  const actions = Array.isArray(result.actions) ? result.actions : [];
  const completeActions = actions.filter((action) => action.status === 'complete' || action.status === 'not_required').length;
  const progress = actions.length ? Math.min(82, 18 + Math.round((completeActions / actions.length) * 62)) : 18;
  const questions = Array.isArray(result.questions) ? result.questions : [];
  const questionMetadata = firstQuestionMetadataFromResult(result, questions[0] || '');
  const missing = Array.isArray(result.missingFields) ? result.missingFields : [];
  const runReadiness = result.runReadiness || {};
  chatRunReadiness = result.runReadiness || null;
  chatMissingFields = missing;
  const draft = result.caseDraft || chatCaseDraft || {};
  persistActiveQuestion(questions[0] || draft.activeQuestion || '', questionMetadata);
  const riskSignals = Array.isArray(draft.riskSignals) ? draft.riskSignals : [];
  const retrievalMatches = Array.isArray(draft.retrievalContext?.evidenceMatches)
    ? draft.retrievalContext.evidenceMatches
    : Array.isArray(draft.retrievalContext?.matches) ? draft.retrievalContext.matches : [];
  const usableDraftDocuments = (draft.documents || []).filter((document) => (
    window.P42AppModules.caseIntelligencePanel.isUsableEvidenceDocument(document)
  ));
  const unverifiedDraftDocuments = (draft.documents || []).filter((document) => (
    !window.P42AppModules.caseIntelligencePanel.isUsableEvidenceDocument(document)
  ));

  decisionText.textContent = runReadiness.runnable ? 'Ready to execute' : 'Building case draft';
  approvalStatus.textContent = runReadiness.runnable
    ? 'The council can execute now; unresolved evidence gaps will stay visible in the decision.'
    : 'The agent is collecting required context before producing a decision.';
  setApprovalActions();
  setApprovalActionStatus('Human decision controls unlock after a completed council run.', 'idle');
  updateDecisionActionBar(getLatestCompletedRun(activeRunMode)?.ok ? 'ready' : 'idle');
  runtimeText.textContent = 'NLP case builder';
  readinessScore.textContent = runReadiness.runnable ? 'runnable' : 'draft';
  evidenceCount.textContent = String(window.P42AppModules.caseIntelligencePanel.usableEvidenceCount(draft));
  gapCount.textContent = String(missing.length);
  flowProgress.style.width = `${progress}%`;
  stageKicker.textContent = 'NLP intake';
  stageStatus.textContent = runReadiness.runnable ? 'Ready for workflow' : 'Context gathering';
  stageOutput.textContent = questions.length
    ? questions.join(' ')
    : 'The case draft has enough structure to run, or you can add more evidence first.';
  renderContextStrength(draft);
  renderAgentActivity(chatCouncilActivityForDraft(draft, missing, runReadiness));

  specialistList.innerHTML = actions.map((action) => {
    const complete = action.status === 'complete' || action.status === 'not_required';
    const active = action.status === 'waiting';
    return `
      <article class="specialist ${complete ? 'is-complete' : ''} ${active ? 'is-active' : ''}">
        <span>${escapeHtml(humanize(action.status))}</span>
        <strong>${escapeHtml(titleCase(action.id))}</strong>
        <p>${escapeHtml(action.detail)}</p>
      </article>
    `;
  }).join('');

  traceList.innerHTML = `
    <li>
      <div>
        <strong>NLP Case Builder</strong>
        <p>${escapeHtml(humanize(result.nlp?.intent || 'case context'))}</p>
      </div>
    </li>
    <li>
      <div>
        <strong>Context Planner</strong>
        <p>${escapeHtml(missing.length ? `${missing.length} missing field${missing.length === 1 ? '' : 's'}` : 'case ready')}</p>
      </div>
    </li>
    ${retrievalMatches.length ? `
      <li>
        <div>
          <strong>Evidence Retriever</strong>
          <p>${escapeHtml(`${retrievalMatches.length} semantic match${retrievalMatches.length === 1 ? '' : 'es'} ready`)}</p>
        </div>
      </li>
    ` : ''}
  `;
  if (rawRunDetails) {
    rawRunDetails.hidden = true;
    rawRunDetails.open = false;
  }
  if (rawRunJson) rawRunJson.textContent = '{}';
  domainList.innerHTML = riskSignals.length
    ? riskSignals.map((signal) => `
      <article class="domain-row">
        <div>
          <strong>${escapeHtml(signal)}</strong>
          <p>Detected from natural-language intake and queued for obligation mapping.</p>
        </div>
        <span class="status-warning">draft</span>
      </article>
    `).join('')
    : '<article class="empty-row">Risk signals appear as the case draft develops.</article>';
  gapList.innerHTML = missing.length
    ? missing.map((field) => `
      <article class="gap-row">
        <span class="status-warning">needed</span>
        <strong>${escapeHtml(titleCase(field))}</strong>
        <p>Answer the next question so the agent can execute with traceable context.</p>
      </article>
    `).join('')
    : '<article class="empty-row">No intake blockers remain. The workflow can run.</article>';
  citationList.innerHTML = retrievalMatches.length
    ? retrievalMatches.map((match) => `
      <article class="citation-row is-indexed">
        <div>
          <span>${escapeHtml(match.evidenceId || 'RET')} · ${escapeHtml(match.chunkId || 'retrieved chunk')}</span>
          <strong>${escapeHtml(match.title || 'Retrieved evidence')}</strong>
          <p>${escapeHtml(summarizeEvidenceText(match.text || '', 320))}</p>
        </div>
        <small>${escapeHtml(`score ${Number(match.score || 0).toFixed(2)}`)}</small>
      </article>
    `).join('')
    : usableDraftDocuments.length
      ? usableDraftDocuments.map((doc) => `
      <article class="citation-row" data-state="${escapeHtml(doc.assertionState || 'provided')}">
        <div>
          <span>${escapeHtml(doc.evidenceId || 'CHAT')} · ${escapeHtml(doc.extractionStatus || 'nlp')}</span>
          <strong>${escapeHtml(doc.title || 'Submitted evidence')}</strong>
          <p>${escapeHtml(doc.excerpt || doc.summary || 'Evidence provided for review.')}</p>
        </div>
        <small>${escapeHtml(doc.assertionState || doc.signals?.join(', ') || 'provided')}</small>
      </article>
    `).join('')
      : unverifiedDraftDocuments.length
        ? unverifiedDraftDocuments.map((doc) => `
          <article class="citation-row is-unverified" data-state="${escapeHtml(doc.assertionState || 'mentioned')}">
            <div>
              <span>${escapeHtml(doc.evidenceId || 'CHAT')} · not evidence</span>
              <strong>${escapeHtml(doc.assertionState === 'requested' ? 'Evidence requested' : 'Evidence mentioned')}</strong>
              <p>${escapeHtml(doc.excerpt || doc.summary || 'This intake statement is not verified proof.')}</p>
            </div>
            <small>not used as proof</small>
          </article>
        `).join('')
        : '<article class="empty-row">Verified evidence citations appear after a document is parsed or retrieved.</article>';
  artifactPreview.innerHTML = `
    <div class="artifact-header">
      <span class="eyebrow">conversation</span>
      <strong>${escapeHtml(draft.supplierName || 'case draft')}</strong>
    </div>
    <div class="artifact-grid">
      <span>NLP intent</span><b>${escapeHtml(result.nlp?.intent || 'case context')}</b>
      <span>Confidence</span><b>${escapeHtml(result.nlp?.confidence || '--')}</b>
      <span>Missing</span><b>${escapeHtml(missing.length ? missing.join(', ') : 'none')}</b>
      <span>Ready</span><b>${escapeHtml(runReadiness.runnable ? 'yes' : 'not yet')}</b>
    </div>
    <pre>${escapeHtml(JSON.stringify({
      caseDraft: {
        supplierName: draft.supplierName,
        businessUnit: draft.businessUnit,
        geography: draft.geography,
        integrations: draft.integrations,
        evidenceSignals: draft.evidenceSignals,
        riskSignals: draft.riskSignals,
        indexedEvidence: draft.indexedEvidence,
        retrievalMatches: retrievalMatches.length
      },
      runReadiness,
      questions
    }, null, 2))}</pre>
  `;
}

function updateJsonLinks() {
  readinessJsonLink.href = apiUrl('/api/readiness');
  benchmarksJsonLink.href = apiUrl('/api/benchmarks');
  goldenDemoLink.href = apiUrl('/api/demo/golden');
}

function hydrateConfigForm() {
  const config = currentConfig();
  apiMode.value = config.configuredMode;
  relayUrl.value = config.relayUrl;
  backendUrl.value = config.backendUrl;
  if (adminBearerToken) adminBearerToken.value = readAdminBearerToken();
  updateJsonLinks();
}

function stageNarrative(stage, result) {
  const domains = Array.isArray(result.domains) ? result.domains : [];
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const evidenceIds = Array.isArray(result.evidenceIds) ? result.evidenceIds : [];
  const retrieval = result.retrievalContext || {};
  const role = agentLabels[stage.agent] || stage.role || titleCase(stage.id);
  const narratives = {
    'Compliance Orchestrator': `Case scoped for ${result.case?.businessUnit || 'the requesting team'} across ${result.case?.geography || 'the selected geography'}.`,
    'Regulatory Obligation Mapper': `${domains.length} obligation domains mapped with applicability and owner evidence requirements.`,
    'Evidence Examiner': retrieval.matchCount || retrieval.matches?.length
      ? `${retrieval.matchCount || retrieval.matches.length} semantic evidence chunks retrieved and ${evidenceIds.length} evidence identifiers linked.`
      : `${evidenceIds.length} evidence identifiers linked; missing documents remain explicit blockers.`,
    'Risk And Control Analyst': `${gaps.length} blocking gaps converted into required controls and owner actions.`,
    'Responsible AI Reviewer': 'Output kept inside a human approval boundary with unsupported certainty removed.',
    'Audit Packager': 'Decision, trace, evidence IDs, gaps, runtime metadata, and readiness proof packaged for export.'
  };
  return narratives[role] || `${role} completed ${humanize(stage.method || 'review')}.`;
}

function businessDecisionTone(result = {}) {
  return window.P42AppModules.decisionRoom.businessDecisionTone(result);
}

function businessDecisionHeadline(result = {}) {
  return window.P42AppModules.decisionRoom.businessDecisionHeadline(result);
}

function businessDecisionSummary(result = {}) {
  return window.P42AppModules.decisionRoom.businessDecisionSummary(result);
}

function businessWhyItems(result = {}) {
  return window.P42AppModules.decisionRoom.businessWhyItems(result);
}

function businessReviewerActions(result = {}) {
  return window.P42AppModules.decisionRoom.businessReviewerActions(result);
}

function humanApprovalRequired(result = {}) {
  return window.P42AppModules.decisionRoom.humanApprovalRequired(result);
}

function humanReviewReasons(result = {}) {
  return window.P42AppModules.decisionRoom.humanReviewReasons(result);
}

function riskSummaryItems(result = {}) {
  return window.P42AppModules.decisionRoom.riskSummaryItems(result);
}

function evidenceUsedItems(result = {}) {
  return window.P42AppModules.decisionRoom.evidenceUsedItems(result);
}

function buildSpecialistTimeline(result = {}) {
  return window.P42AppModules.decisionRoom.buildSpecialistTimeline(result);
}

function renderBusinessOutcome(result = {}) {
  specialistList.innerHTML = window.P42AppModules.decisionRoom.businessOutcomeHtml(result, {
    advisorySpecialists: advisorySpecialistsFor(result),
    evidenceMatches: evidenceMatchesFor(result, chatCaseDraft),
    indexedChunkCount: chatCaseDraft.indexedEvidence?.chunkCount || 0,
    learning: learningSuggestionsFor(result, chatCaseDraft),
    memoryProviderLabel: memoryProviderLabel(chatCaseDraft)
  });
  loadCouncilNarrative(result);
}

async function loadCouncilNarrative(result = {}) {
  if (!result?.ok || !specialistList) return;
  const summaryEl = specialistList.querySelector('[data-council-summary-text]');
  const remediationEls = Array.from(specialistList.querySelectorAll('[data-gap-remediation-index]'));
  if (!summaryEl && !remediationEls.length) return;
  try {
    const payloadPolicy = conversationPayloadPolicy();
    const narrativeResult = typeof payloadPolicy.sanitizeCouncilNarrativeRequestPayload === 'function'
      ? payloadPolicy.sanitizeCouncilNarrativeRequestPayload(result)
      : result;
    const narrative = await apiFetch('/api/case/narrative', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ result: narrativeResult })
    });
    lastCouncilNarrative = narrative;
    if (narrative?.summary && summaryEl) {
      summaryEl.textContent = narrative.summary;
      summaryEl.closest('.council-ai-summary')?.querySelector('.eyebrow')?.replaceChildren(document.createTextNode(
        narrative.source === 'compass_gateway' ? 'AI-assisted summary - advisory only' : 'Decision summary'
      ));
    }
    const remediations = Array.isArray(narrative?.gapRemediations) ? narrative.gapRemediations : [];
    remediationEls.forEach((el) => {
      const index = Number(el.dataset.gapRemediationIndex);
      const item = remediations.find((entry) => Number(entry.index) === index) || remediations[index];
      if (item?.suggestedAction) el.textContent = `Suggested action: ${item.suggestedAction}`;
    });
  } catch {
    // Narrative is advisory only; deterministic decision output remains authoritative.
  }
}

function renderDecisionRoomEmptyState(message = 'Run the council from the chat workspace, Replay, or Evidence to produce the executive decision room.') {
  document.body.classList.remove('has-decision-output');
  document.body.dataset.runComplete = 'false';
  runwayTitle.textContent = 'Decision Room';
  runwayDescription.textContent = 'Executive recommendation, risk rationale, evidence, specialist trace, and review pack will appear here after a run.';
  decisionText.textContent = 'No council output yet';
  approvalStatus.textContent = 'Run the council before recording human review.';
  setApprovalActions();
  setApprovalActionStatus('Human decision controls unlock after a completed council run.', 'idle');
  updateDecisionActionBar('idle');
  runtimeText.textContent = '--';
  readinessScore.textContent = '--';
  evidenceCount.textContent = '--';
  gapCount.textContent = '--';
  flowProgress.style.width = '0%';
  stageKicker.textContent = 'Awaiting council run';
  stageStatus.textContent = 'Decision room is empty';
  stageOutput.textContent = message;
  specialistList.innerHTML = `
    <article class="decision-room-empty">
      <span class="eyebrow">No decision memo yet</span>
      <strong>Run the council to generate the executive output.</strong>
      <p>${escapeHtml(message)}</p>
      <div class="decision-room-empty-actions">
        <button type="button" class="secondary-button" data-report-action="continue-conversation">Back to case builder</button>
      </div>
    </article>
  `;
  domainList.innerHTML = '<article class="empty-row">Domain coverage appears after the obligation mapper runs.</article>';
  gapList.innerHTML = '<article class="empty-row">Reviewer actions appear after the risk and controls analyst runs.</article>';
  citationList.innerHTML = '<article class="empty-row">Evidence citations appear after the evidence examiner runs.</article>';
  traceList.innerHTML = '';
  renderRawRunDetails({ ok: false, message }, { finalVisible: false });
  artifactPreview.innerHTML = `
    <div class="artifact-header">
      <span class="eyebrow">waiting</span>
      <strong>review pack pending</strong>
    </div>
    <p>Run the council first. The pack will include the decision memo, trace, citations, and human review boundary.</p>
  `;
  renderCaseIntelligence(chatCaseDraft, null);
}

function renderOutputRenderError(error, result = {}) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown rendering error');
  document.body.classList.remove('has-decision-output');
  document.body.dataset.runComplete = 'false';
  runwayTitle.textContent = 'Decision Room';
  runwayDescription.textContent = 'The council completed, but the decision room could not render safely.';
  decisionText.textContent = 'Output render issue';
  approvalStatus.textContent = 'The raw audit pack is still available below for diagnosis.';
  setApprovalActions();
  setApprovalActionStatus('Decision controls remain locked until the output renders successfully.', 'danger');
  updateDecisionActionBar('idle');
  flowProgress.style.width = '100%';
  stageKicker.textContent = 'Render guard';
  stageStatus.textContent = 'Decision output needs review';
  stageOutput.textContent = message;
  specialistList.innerHTML = `
    <article class="decision-room-empty is-error">
      <span class="eyebrow">Safe fallback</span>
      <strong>The app prevented a blank decision room.</strong>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
  renderRawRunDetails(result || { ok: false, message }, { finalVisible: true });
}

function renderRun(result, options = {}) {
  try {
    renderRunResult(result, options);
  } catch (error) {
    renderOutputRenderError(error, result);
  }
}

function renderRunResult(result, options = {}) {
  const stages = getStages(result);
  const stageIndex = Number.isFinite(options.stageIndex) ? options.stageIndex : stages.length - 1;
  const activeIndex = Number.isFinite(options.activeIndex) ? options.activeIndex : null;
  const finalVisible = options.finalVisible !== false;

  if (!result.ok) {
    stopCouncilRunAnimation();
    document.body.classList.remove('has-decision-output');
    document.body.dataset.runComplete = 'false';
    lastRun = result;
    lastRuns[activeRunMode] = result;
    decisionText.textContent = result.message || 'Run blocked';
    approvalStatus.textContent = 'Case could not be evaluated.';
    setApprovalActions();
    setApprovalActionStatus('Resolve the run error before recording a human decision.', 'danger');
    updateDecisionActionBar('idle');
    runtimeText.textContent = '--';
    readinessScore.textContent = '--';
    evidenceCount.textContent = '--';
    gapCount.textContent = '--';
    domainList.innerHTML = '';
    gapList.innerHTML = '';
    traceList.innerHTML = '';
    renderRawRunDetails(result, { finalVisible: false });
    specialistList.innerHTML = '';
    artifactPreview.innerHTML = '';
    citationList.innerHTML = '';
    flowProgress.style.width = '0%';
    return;
  }

  if (finalVisible) {
    stopCouncilRunAnimation();
    registerCompletedRun(options.runMode || activeRunMode, result);
  }
  document.body.classList.toggle('has-decision-output', Boolean(finalVisible && result.ok));
  document.body.dataset.runComplete = finalVisible && result.ok ? 'true' : 'false';
  if (finalVisible && result.ok) {
    runwayTitle.textContent = 'Decision Room';
    runwayDescription.textContent = 'Business-first recommendation, evidence impact, specialist validation, reviewer actions, and exportable pack.';
  }

  const domains = Array.isArray(result.domains) ? result.domains : [];
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const trace = Array.isArray(result.trace) ? result.trace : [];
  const evidenceIds = Array.isArray(result.evidenceIds) ? result.evidenceIds : [];
  const progress = Math.max(0, Math.min(100, Math.round(((stageIndex + 1) / stages.length) * 100)));
  const currentStage = stages[Math.max(0, Math.min(stages.length - 1, activeIndex ?? stageIndex))];

  decisionText.textContent = finalVisible ? businessDecisionHeadline(result) : 'Governed council review in progress';
  approvalStatus.textContent = finalVisible
    ? businessDecisionSummary(result)
    : 'Specialists are building the audit pack.';
  const recordedReview = result.humanReviewRecorded
    || (humanReviewRecord?._runId === result.runId ? humanReviewRecord : null);
  const canRecordCurrentSessionDecision = Boolean(finalVisible && currentSessionRunIds.has(result.runId));
  const approvalAllowed = result.decisionReadiness?.approvalEligible === true;
  setApprovalActions({ enabled: canRecordCurrentSessionDecision, recorded: recordedReview, allowApproval: approvalAllowed });
  if (finalVisible && recordedReview) {
    setApprovalActionStatus(
      recordedReview.status === 'rejected' ? 'Human reviewer requested remediation.' : 'Human approval recorded.',
      recordedReview.status === 'rejected' ? 'warning' : 'ready'
    );
  } else if (finalVisible && canRecordCurrentSessionDecision) {
    setApprovalActionStatus(
      approvalAllowed
        ? 'Choose a human decision. The recommendation does not auto-approve this case.'
        : 'This case is not approval-eligible. Request remediation, close the blockers, then rerun the council.',
      approvalAllowed ? 'idle' : 'warning'
    );
  } else if (finalVisible) {
    setApprovalActionStatus('Historical result loaded read-only. Rerun the council in this session before recording a human decision.', 'warning');
  } else {
    setApprovalActionStatus('Council review is still in progress.', 'idle');
  }
  updateDecisionActionBar(finalVisible ? 'ready' : 'running');
  runtimeText.textContent = formatRuntime(result.runtime?.actualRuntime || result.mode || 'unknown');
  readinessScore.textContent = finalVisible
    ? `${Math.round(result.decision.readinessScore * 100)}%`
    : `${Math.max(8, Math.round((progress / 100) * result.decision.readinessScore * 100))}%`;
  evidenceCount.textContent = stageIndex >= 2 || finalVisible ? String(evidenceIds.length) : 'mapping';
  gapCount.textContent = stageIndex >= 3 || finalVisible ? String(gaps.length) : '--';
  flowProgress.style.width = `${progress}%`;
  stageKicker.textContent = finalVisible ? 'Decision memo' : `Stage ${Math.max(1, stageIndex + 1)} of ${stages.length}`;
  stageStatus.textContent = finalVisible
    ? businessDecisionHeadline(result)
    : currentStage ? (agentLabels[currentStage.agent] || currentStage.role || titleCase(currentStage.id)) : 'Ready';
  stageOutput.textContent = finalVisible
    ? businessDecisionSummary(result)
    : currentStage ? stageNarrative(currentStage, result) : 'Select a scenario or run the golden compliance case.';
  renderAgentActivity(stages.map((stage, index) => ({
    id: stage.id,
    label: agentLabels[stage.agent] || stage.role || titleCase(stage.id),
    detail: finalVisible || index <= stageIndex ? 'complete' : index === activeIndex ? 'working' : 'queued',
    status: finalVisible || index <= stageIndex ? 'complete' : index === activeIndex ? 'active' : 'queued'
  })));

  renderSpecialists(result, { stageIndex, activeIndex, finalVisible });
  renderEvidence(result, { stageIndex, finalVisible });
  renderCitations(result, { stageIndex, finalVisible });
  renderTrace(trace, stages, { stageIndex, finalVisible });
  renderRawRunDetails(result, { finalVisible });
  renderArtifactPreview(result, { finalVisible });
  renderCaseIntelligence(chatCaseDraft, result);
  renderMissionWelcome();
  if (finalVisible && activeRunMode === 'chat') setWorkspaceView('output');
}

function renderSpecialists(result, options = {}) {
  if (options.finalVisible) {
    renderBusinessOutcome(result);
    return;
  }
  const stages = getStages(result);
  const stageIndex = Number.isFinite(options.stageIndex) ? options.stageIndex : stages.length - 1;
  const activeIndex = Number.isFinite(options.activeIndex) ? options.activeIndex : null;

  specialistList.innerHTML = stages.map((stage, index) => {
    const complete = index <= stageIndex;
    const active = index === activeIndex && !options.finalVisible;
    const status = active ? 'running' : complete ? 'complete' : 'queued';
    const role = agentLabels[stage.agent] || stage.role || titleCase(stage.agent || stage.id);
    return `
      <article class="specialist ${complete ? 'is-complete' : ''} ${active ? 'is-active' : ''}">
        <span>${escapeHtml(status)}</span>
        <strong>${escapeHtml(role)}</strong>
        <p>${escapeHtml(stageNarrative(stage, result))}</p>
      </article>
    `;
  }).join('');
}

function renderEvidence(result, options = {}) {
  const domains = Array.isArray(result.domains) ? result.domains : [];
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const showDomains = options.finalVisible || options.stageIndex >= 1;
  const showGaps = options.finalVisible || options.stageIndex >= 3;

  domainList.innerHTML = showDomains
    ? domains.map((domain) => `
      <article class="domain-row">
        <div>
          <strong>${escapeHtml(domain.label)}</strong>
          <p>${escapeHtml(domain.obligations?.[0] || 'Mapped obligation pending evidence review.')}</p>
        </div>
        <span class="${statusClass(statusTone(domain.status, 'warning'))}">${escapeHtml(humanize(domain.status))} · ${escapeHtml(domain.score)}</span>
      </article>
    `).join('')
    : '<article class="empty-row">Obligation map appears after the regulatory mapper completes.</article>';

  gapList.innerHTML = showGaps
    ? gaps.map((gap) => `
      <article class="gap-row">
        <span class="${gap.severity === 'high' ? 'status-danger' : 'status-warning'}">${escapeHtml(gap.severity)}</span>
        <strong>${escapeHtml(gap.gap)}</strong>
        <p>${escapeHtml(gap.action)}</p>
      </article>
    `).join('')
    : '<article class="empty-row">Blocking gaps appear after control analysis completes.</article>';
}

function evidenceDocuments(result = {}) {
  return Array.isArray(result.case?.documents) ? result.case.documents : [];
}

function evidenceDisplayName(doc = {}, index = 0) {
  return cleanEvidenceText(doc.title || doc.fileName || doc.sourceTitle || doc.documentTitle || '') || `Evidence ${index + 1}`;
}

function renderCitations(result, options = {}) {
  const showCitations = options.finalVisible || options.stageIndex >= 2;
  const citations = Array.isArray(result.citations) ? result.citations : [];
  const documents = citations.length ? citations : evidenceDocuments(result);
  if (!showCitations) {
    citationList.innerHTML = '<article class="empty-row">Citations appear after the evidence examiner maps uploaded documents.</article>';
    return;
  }
  if (!documents.length) {
    citationList.innerHTML = '<article class="empty-row">No uploaded or manual evidence is attached to this run.</article>';
    return;
  }
  citationList.innerHTML = documents.map((doc, index) => {
    const evidenceId = doc.evidenceId || doc.sourceEvidenceId || `DOC-${String(index + 1).padStart(2, '0')}`;
    const displayName = evidenceDisplayName(doc, index);
    const signals = Array.isArray(doc.signals) && doc.signals.length
      ? doc.signals.join(', ')
      : doc.score ? `retrieval score ${Number(doc.score || 0).toFixed(2)}` : 'No strong signal detected';
    return `
      <article class="citation-row ${doc.extractionStatus === 'binary_registered' ? 'needs-extraction' : ''} ${doc.extractionStatus === 'retrieved_chunk' || doc.sourceType === 'semantic_retrieval' ? 'is-indexed' : ''}">
        <div>
          <span>${escapeHtml(doc.citationId || doc.chunkId || doc.extractionStatus || 'attached')}</span>
          <strong>${escapeHtml(displayName)}</strong>
          <p>${escapeHtml(doc.text || doc.excerpt || doc.summary || 'Evidence attached without extracted text.')}</p>
        </div>
        <small>${escapeHtml(signals)} · ${escapeHtml(evidenceId)}</small>
      </article>
    `;
  }).join('');
}

function renderTrace(trace, stages, options = {}) {
  const visibleEventTypes = new Set(stages.slice(0, options.finalVisible ? stages.length : options.stageIndex + 1).map((stage) => stage.expectedTraceEvent));
  const visibleTrace = options.finalVisible
    ? trace
    : trace.filter((event) => event.agent === 'runtime_router' || visibleEventTypes.has(event.eventType));

  traceList.innerHTML = visibleTrace.map((event) => `
    <li>
      <div>
        <strong>${escapeHtml(agentLabels[event.agent] || titleCase(event.agent))}</strong>
        <p>${escapeHtml(humanize(event.eventType))}</p>
      </div>
    </li>
  `).join('');
}

function renderRawRunDetails(result = {}, options = {}) {
  if (!rawRunDetails || !rawRunJson) return;
  if (!result?.ok) {
    rawRunDetails.hidden = true;
    rawRunDetails.open = false;
    rawRunJson.textContent = '{}';
    return;
  }
  rawRunDetails.hidden = false;
  const summary = rawRunDetails.querySelector('summary');
  if (summary) {
    summary.textContent = options.finalVisible
      ? 'Advanced raw JSON'
      : 'Advanced raw JSON (building)';
  }
  rawRunJson.textContent = JSON.stringify(result, null, 2);
}

function renderArtifactPreview(result, options = {}) {
  const domains = Array.isArray(result.domains) ? result.domains : [];
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const evidenceIds = Array.isArray(result.evidenceIds) ? result.evidenceIds : [];
  const runId = cleanText(result.runId || '');
  const documents = evidenceDocuments(result);
  const citations = Array.isArray(result.citations) ? result.citations : [];
  const retrieval = result.retrievalContext || {};
  const evidenceQuality = result.evidenceQuality || {};
  const llmOutput = result.orchestration?.llmOutput || result.runtime?.llmOutput || null;
  const learning = learningSuggestionsFor(result, chatCaseDraft);
  const advisorySpecialists = advisorySpecialistsFor(result);
  const liveUploadCount = documents.filter((doc) => /^UP-/i.test(doc.evidenceId || '')).length;
  const extractedCount = documents.filter((doc) => /text|pdf|manual/i.test(doc.extractionStatus || '')).length;
  const ready = options.finalVisible;
  if (ready) {
    const reviewerActions = businessReviewerActions(result);
    artifactPreview.innerHTML = `
      <div class="artifact-header">
        <span class="eyebrow">review package</span>
        <strong>${escapeHtml(result.case?.caseId || 'case pending')}</strong>
        ${runId ? `<small class="run-trace-id">Run ${escapeHtml(runId)}</small>` : ''}
      </div>
      <p class="artifact-action-note">Use the command bar above to export the PDF review pack or audit JSON. The pack includes the business memo, evidence citations, specialist trace, and human approval boundary.</p>
      <div class="review-package">
        <article>
          <span>Executive PDF</span>
          <strong>Ready to generate</strong>
          <p>Decision memo, reviewer actions, evidence confidence, citations, and integrity digest packaged for sign-off.</p>
        </article>
        <article>
          <span>Audit JSON</span>
          <strong>Available</strong>
          <p>Full trace, runtime metadata, evidence IDs, document impact, and deterministic guardrail state remain exportable.</p>
        </article>
        <article>
          <span>Control boundary</span>
          <strong>Human approval required</strong>
          <p>No automatic operational approval is granted by the council output.</p>
        </article>
      </div>
      <div class="artifact-grid compact">
        <span>Decision</span><b>${escapeHtml(businessDecisionHeadline(result))}</b>
        <span>Blocking items</span><b>${escapeHtml(gaps.length)}</b>
        <span>Citations</span><b>${escapeHtml(citations.length)}</b>
        <span>RAG matches</span><b>${escapeHtml(evidenceMatchesFor(result, chatCaseDraft).length || retrieval.matchCount || retrieval.matches?.length || 0)}</b>
        <span>Similar cases</span><b>${escapeHtml(learning.similarCases.length)}</b>
        <span>Advisory specialists</span><b>${escapeHtml(advisorySpecialists.length ? `${advisorySpecialists.length} attached` : llmOutput?.outputAvailable ? 'attached' : 'not requested')}</b>
        <span>Evidence quality</span><b>${escapeHtml(humanize(evidenceQuality.status || 'not scored'))}</b>
        <span>Runtime</span><b>${escapeHtml(formatRuntime(result.runtime?.actualRuntime || result.mode || 'unknown'))}</b>
        ${runId ? `<span>Run trace</span><b>${escapeHtml(runId)}</b>` : ''}
      </div>
      <div class="reviewer-next">
        <span class="eyebrow">next reviewer steps</span>
        <ol>
          ${reviewerActions.slice(0, 4).map((action) => `<li>${escapeHtml(action)}</li>`).join('')}
        </ol>
      </div>
      ${llmOutput?.summary ? `<div class="advisory-note"><span class="eyebrow">Advisory council</span><p>${escapeHtml(llmOutput.summary)}</p></div>` : ''}
    `;
    return;
  }
  artifactPreview.innerHTML = `
    <div class="artifact-header">
      <span class="eyebrow">${ready ? 'export ready' : 'assembling'}</span>
      <strong>${escapeHtml(result.case?.caseId || 'case pending')}</strong>
      ${runId ? `<small class="run-trace-id">Run ${escapeHtml(runId)}</small>` : ''}
    </div>
    <div class="artifact-grid">
      <span>Decision</span><b>${escapeHtml(ready ? result.decision.recommendation : 'pending final review')}</b>
      <span>Domains</span><b>${escapeHtml(domains.length)}</b>
      <span>Gaps</span><b>${escapeHtml(gaps.length)}</b>
      <span>Evidence IDs</span><b>${escapeHtml(evidenceIds.length)}</b>
      <span>Evidence docs</span><b>${escapeHtml(documents.length)}</b>
      <span>Citations</span><b>${escapeHtml(citations.length)}</b>
      <span>Retrieved chunks</span><b>${escapeHtml(retrieval.matchCount || retrieval.matches?.length || 0)}</b>
      <span>Evidence quality</span><b>${escapeHtml(evidenceQuality.status || 'not scored')}</b>
      <span>Advisory LLM</span><b>${escapeHtml(llmOutput?.outputAvailable ? 'attached' : result.orchestration?.liveLlm?.requested ? 'unavailable' : 'not requested')}</b>
      <span>Live uploads</span><b>${escapeHtml(liveUploadCount)}</b>
      <span>Extracted docs</span><b>${escapeHtml(extractedCount)}</b>
      <span>Runtime</span><b>${escapeHtml(formatRuntime(result.runtime?.actualRuntime || result.mode || 'unknown'))}</b>
    </div>
    <pre>{
  "humanApprovalRequired": true,
  "deterministicGuardrail": true,
  "browserEmbeddingsRetained": false,
  "exportStatus": "${ready ? 'ready' : 'building'}"
}</pre>
    ${llmOutput?.summary ? `<div class="advisory-note"><span class="eyebrow">Advisory council</span><p>${escapeHtml(llmOutput.summary)}</p></div>` : ''}
  `;
}

function buildExecReviewPack(result = lastRun) {
  if (!result?.ok) return '';
  const domains = Array.isArray(result.domains) ? result.domains : [];
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const evidenceIds = Array.isArray(result.evidenceIds) ? result.evidenceIds : [];
  const documents = evidenceDocuments(result);
  const citations = Array.isArray(result.citations) ? result.citations : [];
  const retrieval = result.retrievalContext || {};
  const evidenceQuality = result.evidenceQuality || {};
  const decisionReadiness = result.decisionReadiness || {};
  const trace = Array.isArray(result.trace) ? result.trace : [];
  const caseInfo = result.case || {};
  const decision = result.decision || {};
  const runtime = result.runtime || {};
  const readiness = Number.isFinite(decision.readinessScore)
    ? `${Math.round(decision.readinessScore * 100)}%`
    : 'Not reported';
  const lines = [
    '# Executive Review Pack',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Case ID: ${caseInfo.caseId || 'unassigned'}`,
    `Run trace: ${result.runId || 'unassigned'}`,
    '',
    '## Decision',
    '',
    `Recommendation: ${decision.recommendation || 'Pending review'}`,
    `Readiness: ${readiness}`,
    `Human approval required: yes`,
    `Runtime: ${formatRuntime(runtime.actualRuntime || result.mode || 'unknown')}`,
    `Evidence quality: ${evidenceQuality.status || 'not scored'} (${evidenceQuality.score ?? 'n/a'})`,
    `Approval eligible: ${decisionReadiness.approvalEligible ? 'yes' : 'no'}`,
    '',
    '## Case Context',
    '',
    `Supplier or workflow: ${caseInfo.supplierName || 'Not provided'}`,
    `Business unit: ${caseInfo.businessUnit || 'Not provided'}`,
    `Geography: ${caseInfo.geography || 'Not provided'}`,
    `Integrations: ${(caseInfo.integrations || []).join(', ') || 'Not provided'}`,
    '',
    '## Blocking Gaps',
    ''
  ];

  if (gaps.length) {
    gaps.forEach((gap, index) => {
      lines.push(`${index + 1}. ${gap.gap || 'Unnamed gap'}`);
      lines.push(`   Severity: ${gap.severity || 'unrated'}`);
      lines.push(`   Required action: ${gap.action || 'Action not specified'}`);
    });
  } else {
    lines.push('No blocking gaps returned by the council.');
  }

  lines.push('', '## Obligation Domains', '');
  if (domains.length) {
    domains.forEach((domain, index) => {
      lines.push(`${index + 1}. ${domain.label || 'Unnamed domain'} - ${humanize(domain.status || 'unknown')} (${domain.score ?? 'n/a'})`);
      if (domain.obligations?.length) {
        lines.push(`   Primary obligation: ${domain.obligations[0]}`);
      }
    });
  } else {
    lines.push('No obligation domains returned.');
  }

  lines.push('', '## Evidence Manifest', '');
  lines.push(`Evidence references: ${documents.map((doc, index) => evidenceDisplayName(doc, index)).join(', ') || evidenceIds.join(', ') || 'none'}`);
  lines.push(`Indexed retrieval chunks searched: ${retrieval.chunkCount || 0}`);
  lines.push(`Semantic matches used: ${retrieval.matchCount || retrieval.matches?.length || 0}`);
  if (documents.length) {
    documents.forEach((doc, index) => {
      lines.push(`${index + 1}. ${evidenceDisplayName(doc, index)}`);
      lines.push(`   Reviewer reference: ${doc.evidenceId || `DOC-${index + 1}`}`);
      lines.push(`   Extraction: ${doc.extractionStatus || 'attached'}`);
      lines.push(`   Signals: ${(doc.signals || []).join(', ') || 'none detected'}`);
    });
  } else {
    lines.push('No source documents were attached to the run.');
  }

  lines.push('', '## Evidence Citations', '');
  if (citations.length) {
    citations.forEach((citation, index) => {
      lines.push(`${index + 1}. ${evidenceDisplayName(citation, index)}`);
      lines.push(`   Source: ${citation.citationId || citation.sourceType || 'attached evidence'} (${citation.evidenceId || `CITE-${index + 1}`})`);
      if (citation.score) lines.push(`   Retrieval score: ${Number(citation.score).toFixed(3)}`);
      lines.push(`   Extract: ${citation.text || 'No extract available.'}`);
    });
  } else {
    lines.push('No citation records returned.');
  }

  lines.push('', '## Audit Trace', '');
  if (trace.length) {
    trace.forEach((event, index) => {
      lines.push(`${index + 1}. ${agentLabels[event.agent] || titleCase(event.agent)} - ${humanize(event.eventType)}`);
    });
  } else {
    lines.push('No trace events returned.');
  }

  lines.push('', '## Reviewer Notes', '');
  lines.push('This pack is a reviewer artifact. It does not grant operational approval. Final approval remains with the accountable human owner.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildExecReviewHtml(result = lastRun) {
  if (!result?.ok) return '';
  const caseInfo = result.case || {};
  const decision = result.decision || {};
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const domains = Array.isArray(result.domains) ? result.domains : [];
  const citations = Array.isArray(result.citations) ? result.citations : [];
  const evidenceQuality = result.evidenceQuality || {};
  const retrieval = result.retrievalContext || result.retrievalAudit || {};
  const timeline = buildSpecialistTimeline(result);
  const reviewerActions = businessReviewerActions(result);
  const readiness = Number.isFinite(decision.readinessScore) ? Math.round(decision.readinessScore * 100) : 0;
  const memo = gaps.length
    ? `${decision.recommendation || 'Pending review'} The council identified ${gaps.length} blocking item${gaps.length === 1 ? '' : 's'} that must be confirmed by a human reviewer before approval.`
    : `${decision.recommendation || 'Pending review'} No blocking gaps remain in the current evidence set, but accountable human approval is still required.`;
  const exportNarrative = cleanEvidenceText(lastCouncilNarrative?.exportSummary || lastCouncilNarrative?.summary || '');

  const domainStatusColor = (s = '') => /applicable/i.test(s) && !/not/i.test(s) ? '#22e3b4' : /confirmation|needs/i.test(s) ? '#f4c95d' : /not.applicable/i.test(s) ? '#4a6080' : '#60a5fa';
  const gapCls = (s = '') => /high|critical/i.test(s) ? '' : /medium|moderate/i.test(s) ? 'medium' : 'low';
  const tlColor = (t = '') => /escalated|challenged/i.test(t) ? '#ff7a7a' : /changed/i.test(t) ? '#f4c95d' : '#22e3b4';
  const caseRows = [
    ['Business unit', caseInfo.businessUnit], ['Geography', caseInfo.geography],
    ['Integrations', (caseInfo.integrations || []).join(', ')], ['Case ID', caseInfo.caseId],
    ['Run trace', result.runId],
    ['Evidence quality', humanize(evidenceQuality.status)], ['RAG chunks searched', retrieval.chunkCount || 0],
    ['Semantic matches', retrieval.matchCount || retrieval.matches?.length || 0],
    ['Runtime', formatRuntime(result.runtime?.actualRuntime || result.mode || 'unknown')],
  ].filter(([, v]) => v);
  const generatedAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>P42 Executive Review Pack — ${escapeHtml(caseInfo.caseId || 'case')}</title>
  <style>
    :root{color-scheme:dark;--bg:#040810;--panel:#0a1628;--line:#1a2840;--ls:#243652;--mint:#22e3b4;--blue:#60a5fa;--amber:#f4c95d;--red:#ff7a7a;--text:#f0f4ff;--muted:#8ba0c4;--subtle:#4a6080}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:var(--text);background:radial-gradient(ellipse 120% 60% at 20% -10%,rgba(34,227,180,.12),transparent 45%),var(--bg);min-height:100vh}
    main{width:min(1160px,calc(100% - 48px));margin:40px auto 80px;display:grid;gap:20px}
    section{border:1px solid var(--line);background:linear-gradient(160deg,rgba(10,22,40,.96),rgba(4,8,16,.98));border-radius:20px;padding:32px}
    section.hero{border-color:rgba(34,227,180,.28);background:linear-gradient(140deg,rgba(34,227,180,.1),rgba(96,165,250,.04) 44%,rgba(4,8,16,.96))}
    section.bnd{border-color:rgba(244,201,93,.36);background:rgba(244,201,93,.06)}
    section.clear{border-color:rgba(34,227,180,.22);background:rgba(34,227,180,.04)}
    h1{font-size:clamp(28px,4vw,52px);font-weight:900;line-height:1;margin:12px 0 0}
    h2{font-size:21px;font-weight:800;line-height:1.2;margin:0 0 14px}
    h3{font-size:15px;font-weight:700;margin:8px 0 5px;line-height:1.3}
    p{color:var(--muted);line-height:1.6;margin-top:10px}
    ol{padding-left:18px;display:grid;gap:6px}
    li{color:var(--muted);font-size:13px;line-height:1.5}
    .ey{display:block;color:var(--mint);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
    .memo{font-size:17px;color:var(--text);line-height:1.55;max-width:840px;margin:14px 0 22px}
    .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px}
    .tile{border:1px solid var(--ls);background:rgba(255,255,255,.04);border-radius:14px;padding:18px 20px}
    .tile .lbl{color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
    .tile .val{display:block;margin-top:10px;font-size:32px;font-weight:900;line-height:1}
    .two{display:grid;grid-template-columns:1.2fr .8fr;gap:20px}
    .card{border:1px solid var(--ls);background:rgba(255,255,255,.03);border-radius:14px;padding:22px}
    .kv{display:grid;gap:0;margin-top:8px}
    .kv-row{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-top:1px solid var(--line);gap:16px}
    .kv-k{color:var(--subtle);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap}
    .kv-v{font-size:13px;font-weight:700;text-align:right}
    .gap-list{display:grid;gap:12px;margin-top:16px}
    .gc{border-left:3px solid var(--red);background:rgba(255,122,122,.06);border-radius:0 12px 12px 0;padding:14px 18px}
    .gc.m{border-color:var(--amber);background:rgba(244,201,93,.06)}
    .gc.l{border-color:var(--blue);background:rgba(96,165,250,.06)}
    .gbadge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;background:rgba(255,122,122,.18);color:var(--red);margin-bottom:8px}
    .gbadge.m{background:rgba(244,201,93,.18);color:var(--amber)}
    .gbadge.l{background:rgba(96,165,250,.18);color:var(--blue)}
    .domain-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-top:16px}
    .dc{border:1px solid var(--ls);border-radius:12px;padding:14px 16px}
    .ds{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}
    .dl{display:block;font-weight:700;font-size:14px;margin:6px 0 4px}
    .dsc{font-size:11px;color:var(--muted)}
    .cite-list{display:grid;gap:10px;margin-top:16px}
    .cite{border-left:3px solid var(--blue);padding:10px 0 10px 14px}
    .cite-id{color:var(--mint);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}
    .cite-title{display:block;font-weight:700;font-size:14px;margin:4px 0}
    .cite-text{color:var(--muted);font-size:13px;line-height:1.5}
    .tl{display:grid;gap:0;margin-top:16px}
    .tl-item{display:grid;grid-template-columns:40px 1fr;gap:16px;padding:16px 0;border-top:1px solid var(--line)}
    .tl-item:first-child{border-top:none}
    .tl-n{font-size:13px;font-weight:900;color:var(--mint);padding-top:2px}
    .tl-name{font-weight:700;font-size:15px;margin-bottom:8px}
    .tl-dl{display:grid;grid-template-columns:90px 1fr;gap:4px 12px}
    .tl-dt{color:var(--subtle);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;padding-top:2px}
    .tl-dd{color:var(--muted);font-size:13px;line-height:1.45}
    .tl-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px}
    .act-list{display:grid;gap:8px;margin-top:16px}
    .act{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-radius:10px;border:1px solid var(--ls);background:rgba(255,255,255,.03)}
    .act-n{color:var(--mint);font-size:11px;font-weight:900;min-width:22px;padding-top:1px}
    .ft{border-color:var(--ls);background:rgba(255,255,255,.02);text-align:center}
    .ft p{margin:0 auto;color:var(--subtle);font-size:12px;text-align:center;max-width:100%}
    .ft strong{color:var(--text)}
    @media(max-width:820px){.tiles{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}.domain-grid{grid-template-columns:repeat(2,1fr)}.tl-dl{grid-template-columns:80px 1fr}}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <span class="ey">Executive review pack · ${escapeHtml(generatedAt)}</span>
      <h1>${escapeHtml(decision.recommendation || 'Compliance Review')}</h1>
      <p class="memo">${escapeHtml(exportNarrative || memo)}</p>
      <div class="tiles">
        <div class="tile"><div class="lbl">Readiness</div><span class="val">${escapeHtml(readiness)}%</span></div>
        <div class="tile"><div class="lbl">Blocking gaps</div><span class="val">${escapeHtml(gaps.length)}</span></div>
        <div class="tile"><div class="lbl">Citations</div><span class="val">${escapeHtml(citations.length)}</span></div>
        <div class="tile"><div class="lbl">Domains</div><span class="val">${escapeHtml(domains.length)}</span></div>
      </div>
    </section>

    <div class="two">
      <section>
        <span class="ey">Case context</span>
        <h2>${escapeHtml(caseInfo.supplierName || 'Supplier pending')}</h2>
        <div class="kv">${caseRows.map(([k, v]) => `<div class="kv-row"><span class="kv-k">${escapeHtml(k)}</span><b class="kv-v">${escapeHtml(String(v))}</b></div>`).join('')}</div>
      </section>
      <section class="bnd">
        <span class="ey">Human approval required</span>
        <h2 style="margin-top:10px;">No auto-approval</h2>
        <p>Final authority remains with the accountable human owner. The deterministic council provides reviewer-ready output only.</p>
        ${reviewerActions.length ? `<div style="margin-top:18px;"><span class="ey">Next reviewer steps</span><ol style="margin-top:10px;">${reviewerActions.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ol></div>` : ''}
      </section>
    </div>

    ${gaps.length ? `
    <section>
      <span class="ey">Blocking gaps · ${gaps.length} item${gaps.length === 1 ? '' : 's'} requiring action</span>
      <h2>Reviewer must confirm before approval</h2>
      <div class="gap-list">
        ${gaps.map((gap) => {
          const c = gapCls(gap.severity);
          return `<div class="gc ${c}"><div class="gbadge ${c}">${escapeHtml(gap.severity || 'review')}</div><h3>${escapeHtml(gap.gap || 'Review item')}</h3><p style="margin-top:4px;">${escapeHtml(gap.action || 'Record reviewer disposition.')}</p></div>`;
        }).join('')}
      </div>
    </section>` : `
    <section class="clear">
      <span class="ey">Gap assessment</span>
      <h2>No blocking gaps returned</h2>
      <p>The evidence set did not produce a blocking gap. Human review and accountable approval remain required before operational use.</p>
    </section>`}

    ${domains.length ? `
    <section>
      <span class="ey">Obligation domains · ${domains.length} mapped</span>
      <h2>Compliance coverage</h2>
      <div class="domain-grid">
        ${domains.map((d) => {
          const col = domainStatusColor(d.status);
          return `<div class="dc" style="border-color:${col}30;"><span class="ds" style="color:${col};">${escapeHtml(humanize(d.status || 'unknown'))}</span><span class="dl">${escapeHtml(d.label || 'Domain')}</span><span class="dsc">Score: ${escapeHtml(String(d.score ?? 'n/a'))} · ${escapeHtml((d.obligations || []).length)} obligation${(d.obligations || []).length === 1 ? '' : 's'}</span></div>`;
        }).join('')}
      </div>
    </section>` : ''}

    <section>
      <span class="ey">Evidence intelligence · ${citations.length} citation${citations.length === 1 ? '' : 's'}</span>
      <h2>${escapeHtml(humanize(evidenceQuality.status || 'Evidence review'))}</h2>
      <p>Retrieval stays server-side. This export contains safe citations and metadata only — raw embeddings and vector chunks are not included.</p>
      <div class="cite-list">
        ${(citations.length ? citations : [{ title: 'No citation records returned.', text: 'Run with indexed evidence to populate citation-ready extracts.' }]).map((c, index) => `
          <div class="cite"><span class="cite-id">${escapeHtml(c.citationId || c.evidenceId || 'evidence')}</span><span class="cite-title">${escapeHtml(evidenceDisplayName(c, index))}</span><span class="cite-text">${escapeHtml(c.text || 'No extract available.')}</span></div>`).join('')}
      </div>
    </section>

    <section>
      <span class="ey">Agent collaboration timeline · 6 specialists</span>
      <h2>Deterministic council trace</h2>
      <p style="margin-bottom:4px;">Visible specialist validation, not live autonomous debate. Each step records what it reviewed and how it changed the handoff.</p>
      <div class="tl">
        ${timeline.map((item, i) => {
          const col = tlColor(item.action.type);
          return `<div class="tl-item"><div class="tl-n">0${i + 1}</div><div><div class="tl-badge" style="background:${col}20;color:${col};">${escapeHtml(item.action.label)}</div><div class="tl-name">${escapeHtml(item.name)}</div><div class="tl-dl"><div class="tl-dt">Reviewed</div><div class="tl-dd">${escapeHtml(item.reviewed)}</div><div class="tl-dt">Found</div><div class="tl-dd">${escapeHtml(item.found)}</div><div class="tl-dt">Action</div><div class="tl-dd">${escapeHtml(item.action.detail)}</div><div class="tl-dt">Handoff</div><div class="tl-dd">${escapeHtml(item.handoff)}</div></div></div></div>`;
        }).join('')}
      </div>
    </section>

    ${reviewerActions.length ? `
    <section>
      <span class="ey">Required human actions · ${reviewerActions.length} step${reviewerActions.length === 1 ? '' : 's'}</span>
      <h2>Reviewer must confirm before approval</h2>
      <div class="act-list">
        ${reviewerActions.map((a, i) => `<div class="act"><span class="act-n">${String(i + 1).padStart(2, '0')}</span><span>${escapeHtml(a)}</span></div>`).join('')}
      </div>
    </section>` : ''}

    <section class="ft">
      <p><strong>Parallax42 Compliance Intelligence Agent</strong> · Reviewer artifact only</p>
      <p style="margin-top:8px;">Case: <strong>${escapeHtml(caseInfo.caseId || 'unassigned')}</strong> · Generated: <strong>${escapeHtml(new Date().toISOString())}</strong></p>
      <p style="margin-top:8px;">This document does not grant operational approval. Final authority remains with the accountable human owner. Advisory specialists and learning memory are advisory only and do not alter the deterministic decision.</p>
    </section>
  </main>
</body>
</html>`;
}

function playResult(result, options = {}) {
  clearPlaybackTimers();
  stopCouncilRunAnimation();
  const stages = getStages(result);
  const runMode = options.runMode || activeRunMode;
  renderRun(result, { stageIndex: -1, activeIndex: 0, finalVisible: false, runMode });
  stages.forEach((stage, index) => {
    playbackTimers.push(window.setTimeout(() => {
      renderRun(result, { stageIndex: index, activeIndex: index, finalVisible: false, runMode });
    }, 420 + (index * 520)));
  });
  playbackTimers.push(window.setTimeout(() => {
    renderRun(result, { stageIndex: stages.length - 1, finalVisible: true, runMode });
  }, 620 + (stages.length * 520)));
}

async function runAgent(payload, options = {}) {
  if (agentRunActive || conversationRequestActive) return null;
  if (!options.skipEvidenceWait) await waitForEvidenceUpload();
  const runMode = options.mode || activeRunMode;
  agentRunActive = true;
  clearPlaybackTimers();
  startCouncilRunAnimation({ source: 'run_button' });
  updateDecisionActionBar('running');
  document.body.dataset.runComplete = 'false';
  decisionText.textContent = 'Governed council review in progress';
  approvalStatus.textContent = 'Submitting case to the agent runtime.';
  stageKicker.textContent = 'Dispatching';
  stageStatus.textContent = 'Runtime Router';
  stageOutput.textContent = 'Selecting the configured orchestration path.';
  flowProgress.style.width = '4%';
  try {
    const submittedPayload = runMode === 'demo' ? await prepareDemoRunPayload(payload) : payload;
    const result = await apiFetch('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submittedPayload)
    });
    if (result?.ok) registerCompletedRun(runMode, result, { currentSession: true });
    if (runMode !== activeRunMode) {
      stopCouncilRunAnimation();
      lastRuns[runMode] = result;
      loadAuditLog();
      return result;
    }
    if (options.playback) {
      playResult(result, { runMode });
    } else {
      renderRun(result, { runMode });
    }
    loadAuditLog();
    return result;
  } catch (error) {
    const failure = {
      ok: false,
      message: error instanceof Error ? error.message : 'Run failed'
    };
    if (runMode !== activeRunMode) {
      stopCouncilRunAnimation();
      lastRuns[runMode] = failure;
      loadAuditLog();
      return failure;
    }
    renderRun(failure);
    loadAuditLog();
    return failure;
  } finally {
    agentRunActive = false;
    syncPrimaryActionState();
  }
}

function startChatThinkingProgress(message = {}, options = {}) {
  const councilMode = Boolean(options.forceRun);
  const steps = councilMode
    ? [
        { delay: 0, title: 'Checking readiness', detail: 'Reviewing the case draft and human approval boundary.', attempt: '' },
        { delay: 1200, title: 'Retrieving evidence', detail: 'Looking up citation-ready evidence and governed memory before council execution.', attempt: '' },
        { delay: 2600, title: 'Running council', detail: 'Specialists are validating obligations, evidence, controls, and Responsible AI constraints.', attempt: '' },
        { delay: 4300, title: 'Formulating decision room', detail: 'Preparing the executive memo, required actions, and audit handoff.', attempt: '' }
      ]
    : [
        { delay: 0, title: 'Working', detail: 'Reading your message and updating the working case.', attempt: '' },
        { delay: 1200, title: 'Checking context', detail: 'Reviewing case facts, evidence metadata, and the current question.', attempt: '' },
        { delay: 2800, title: 'Still working', detail: 'Waiting for the intake response from the API.', attempt: '' },
        { delay: 5200, title: 'Preparing reply', detail: 'The request is still in progress; I will show retry details only if the API reports them.', attempt: '' }
      ];
  message.startedAt = message.startedAt || Date.now();
  message.elapsedSeconds = 0;
  message.thinkingSteps = steps.map((step) => [step.title, step.detail]);
  const timers = steps.map((step, index) => window.setTimeout(() => {
    if (!message.pending) return;
    message.thinkingStepIndex = index;
    message.phaseTitle = step.title;
    message.phaseDetail = step.detail;
    message.attemptLabel = step.attempt;
    patchChatMessageDom(latestAssistantMessageIndex());
  }, step.delay));
  const elapsedTimer = window.setInterval(() => {
    if (!message.pending) return;
    message.elapsedSeconds = Math.max(0, Math.round((Date.now() - message.startedAt) / 1000));
    patchChatMessageDom(latestAssistantMessageIndex());
  }, 1000);
  return function stopChatThinkingProgress() {
    timers.forEach((timer) => window.clearTimeout(timer));
    window.clearInterval(elapsedTimer);
  };
}

async function submitChatMessage(rawMessage = '', options = {}) {
  if (conversationRequestActive || agentRunActive) return null;
  const message = cleanEvidenceText(rawMessage || (options.forceRun ? 'run it' : ''));
  if (!message) {
    promptForChatContext();
    return null;
  }
  if (options.forceRun && !hasChatContext() && /^run it$/i.test(message)) {
    promptForChatContext();
    return null;
  }
  if (!options.skipEvidenceWait) await waitForEvidenceUpload();
  conversationRequestActive = true;
  syncPrimaryActionState();
  if (liveCasePreviewTimer) {
    window.clearTimeout(liveCasePreviewTimer);
    liveCasePreviewTimer = null;
  }
  updateChatInputCounter();
  setRunMode('chat', { skipRender: true });
  clearPlaybackTimers();
  if (options.forceRun) {
    startCouncilRunAnimation({ source: 'chat_run' });
    updateDecisionActionBar('running');
  }
  if (!options.silentUser && !options.forceRun && hasSubstantiveReviewRequestText(message)) {
    mergeChatCaseDraft({ caseRequestStarted: true });
  }
  syncUploadedEvidenceIntoChatDraft();
  const eventType = cleanEvidenceText(options.eventType || (options.forceRun ? 'run_request' : activeQuestion ? 'user_answer' : 'user_message'));
  const questionAtTurnStart = cleanEvidenceText(Object.prototype.hasOwnProperty.call(options, 'activeQuestion')
    ? options.activeQuestion
    : activeQuestion || chatCaseDraft.activeQuestion || '');
  const questionIdAtTurnStart = cleanEvidenceText(Object.prototype.hasOwnProperty.call(options, 'activeQuestionId')
    ? options.activeQuestionId
    : activeQuestionId || chatCaseDraft.activeQuestionId || '');
  const questionFieldAtTurnStart = cleanEvidenceText(Object.prototype.hasOwnProperty.call(options, 'activeQuestionField')
    ? options.activeQuestionField
    : activeQuestionField || chatCaseDraft.activeQuestionField || '');
  if (!options.silentUser) {
    chatMessages.push({
      role: 'user',
      text: message,
      answeringQuestion: questionAtTurnStart || '',
      answeringQuestionId: questionIdAtTurnStart || '',
      answeringQuestionField: questionFieldAtTurnStart || ''
    });
  }
  const pendingMessage = {
    role: 'assistant',
    text: options.forceRun
      ? 'Checking the case draft and executing the workflow if the required context is present…'
      : 'Reading the request, updating the case draft, and planning the next agent step…',
    pending: true,
    thinkingStepIndex: 0,
    phaseTitle: options.forceRun ? 'Checking readiness' : options.retrySmartIntake ? 'Checking smart intake' : 'Working',
    phaseDetail: options.forceRun
      ? 'Reviewing the case draft and human approval boundary.'
      : options.retrySmartIntake
        ? 'Sending the last user turn back through the intake API.'
      : 'Reading your message and updating the working case.',
    attemptLabel: ''
  };
  chatMessages.push(pendingMessage);
  renderChatMessages();
  const stopThinkingProgress = startChatThinkingProgress(pendingMessage, options);
  chatInput.value = '';
  updateChatInputCounter();
  flowProgress.style.width = '12%';
  stageKicker.textContent = 'NLP intake';
  stageStatus.textContent = 'Parsing message';
  stageOutput.textContent = 'Extracting case fields, risk signals, integrations, and evidence clues.';
  if (!options.forceRun) {
    renderAgentActivity([
      { label: 'Intake Agent', detail: 'reading', status: 'active' },
      { label: 'Obligation Mapper', detail: 'queued', status: 'queued' },
      { label: 'Evidence Examiner', detail: uploadedEvidence.length ? 'attached' : 'queued', status: uploadedEvidence.length ? 'complete' : 'queued' },
      { label: 'Risk & Controls', detail: 'queued', status: 'queued' },
      { label: 'Responsible AI', detail: 'queued', status: 'queued' },
      { label: 'Audit Packager', detail: 'queued', status: 'queued' }
    ]);
  }

  try {
    const compactRunRequest = Boolean(
      options.forceRun
      && activeBrowserSession?.workspaceId
      && chatCaseDraft.caseId
      && Number.isInteger(Number(chatCaseDraft.caseVersion))
    );
    const serverChunkCount = indexedChunkCountForRetrieval();
    if (options.forceRun && serverChunkCount) {
      pendingMessage.text = 'Preparing server-side evidence retrieval before council execution…';
      flowProgress.style.width = '24%';
      stageKicker.textContent = 'Semantic retrieval';
      stageStatus.textContent = 'Server retrieval queued';
      stageOutput.textContent = 'The API will retrieve citation-ready evidence from the server-side vector index during the council run.';
      renderChatMessages();
      renderAgentActivity([
        { label: 'Intake Agent', detail: 'ready', status: 'complete' },
        { label: 'Obligation Mapper', detail: 'ready', status: 'complete' },
        { label: 'Evidence Examiner', detail: 'retrieving', status: 'active' },
        { label: 'Risk & Controls', detail: 'queued', status: 'queued' },
        { label: 'Responsible AI', detail: 'queued', status: 'queued' },
        { label: 'Audit Packager', detail: 'queued', status: 'queued' }
      ]);
    }
    const result = await apiFetch('/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        caseDraft: chatCaseDraftForConversation(chatCaseDraft, { runRequest: compactRunRequest }),
        ...(compactRunRequest ? { caseVersion: Number(chatCaseDraft.caseVersion) } : {}),
        activeQuestion: questionAtTurnStart,
        activeQuestionId: questionIdAtTurnStart,
        activeQuestionField: questionFieldAtTurnStart,
        eventType,
        history: compactRunRequest ? [] : chatMessages
          .filter((item) => item && !item.pending && (item.role === 'user' || item.role === 'assistant'))
          .slice(-conversationPayloadHistoryTurns)
          .map((item) => ({
            role: item.role,
            text: item.text || '',
            displayedQuestion: item.displayedQuestion || '',
            displayedQuestionId: item.displayedQuestionId || '',
            displayedQuestionField: item.displayedQuestionField || '',
            answeringQuestion: item.answeringQuestion || '',
            answeringQuestionId: item.answeringQuestionId || '',
            answeringQuestionField: item.answeringQuestionField || ''
          })),
        uploadedEvidence: compactRunRequest ? [] : uploadedEvidenceForConversation(),
        retrievalQuery: options.forceRun && !compactRunRequest ? retrievalQueryFromDraft() : '',
        forceRun: Boolean(options.forceRun),
        retrySmartIntake: Boolean(options.retrySmartIntake)
      })
    });
    const returnedDraft = result.caseDraft || {};
    if (result.completedCase) {
      chatCaseDraft = { ...returnedDraft };
      scheduleChatSessionSave();
    } else if (eventType === 'evidence_uploaded' && !chatCaseDraft.caseRequestStarted) {
      const returnedCaseVersion = Number(returnedDraft.caseVersion);
      mergeChatCaseDraft({
        caseId: returnedDraft.caseId || chatCaseDraft.caseId,
        ...(Number.isInteger(returnedCaseVersion) && returnedCaseVersion > 0
          ? { caseVersion: returnedCaseVersion }
          : {}),
        documents: returnedDraft.documents || chatCaseDraft.documents,
        evidenceSignals: unique([...(chatCaseDraft.evidenceSignals || []), ...(returnedDraft.evidenceSignals || [])]),
        indexedEvidence: returnedDraft.indexedEvidence || chatCaseDraft.indexedEvidence,
        retrievalContext: returnedDraft.retrievalContext || chatCaseDraft.retrievalContext,
        documentContext: {
          ...(chatCaseDraft.documentContext || {}),
          supplierName: returnedDraft.supplierName || chatCaseDraft.documentContext?.supplierName || '',
          businessUnit: returnedDraft.businessUnit || chatCaseDraft.documentContext?.businessUnit || '',
          geography: returnedDraft.geography || chatCaseDraft.documentContext?.geography || '',
          serviceDescription: returnedDraft.brief || chatCaseDraft.documentContext?.serviceDescription || ''
        },
        caseRequestStarted: false
      }, { forceCaseRequestStarted: false });
    } else {
      mergeChatCaseDraft(returnedDraft);
    }
    chatRunReadiness = result.runReadiness || null;
    chatMissingFields = Array.isArray(result.missingFields) ? result.missingFields : [];
    pendingMessage.pending = false;
    pendingMessage.text = result.reply || 'The conversation step completed.';
    const llmAttempt = result.nlp?.llmAssessment || result.conversationPlan?.llmAssessment || {};
    const conversationPlan = result.conversationPlan || {};
    const llmAttempts = Array.isArray(llmAttempt.attempts) ? llmAttempt.attempts : [];
    const llmAttemptCount = Number(llmAttempt.attemptCount || llmAttempts.length || 0);
    const llmMaxAttempts = Number(llmAttempt.maxAttempts || conversationPlan.aiUsage?.maxAttempts || 0);
    const smartIntakeUnavailable = Boolean(llmAttempt.smartIntakeUnavailable || conversationPlan.smartIntakeUnavailable);
    const smartIntakeDegraded = Boolean(llmAttempt.smartIntakeDegraded || conversationPlan.smartIntakeDegraded);
    const invalidCompassResponse = Boolean(llmAttempt.invalidCompassResponse || conversationPlan.source === 'compass_invalid_response');
    const hasServerQuestionSignal = Array.isArray(result.questions)
      || Object.prototype.hasOwnProperty.call(returnedDraft, 'activeQuestion');
    const structuredQuestion = structuredAssistantQuestion(
      Array.isArray(result.questions) ? result.questions[0] : '',
      returnedDraft.activeQuestion || ''
    ) || (!hasServerQuestionSignal
      ? structuredAssistantQuestion(
        llmAttempt.nextBestQuestion,
        conversationPlan.nextQuestion,
        returnedDraft.llmIntake?.nextBestQuestion,
        returnedDraft.conversationPlan?.nextQuestion
      )
      : '');
    const questionMetadata = firstQuestionMetadataFromResult(result, structuredQuestion);
    pendingMessage.generatedByCompass = Boolean(llmAttempt.used || conversationPlan.usedLlm);
    pendingMessage.compassNaturalResponse = Boolean(llmAttempt.naturalResponse && pendingMessage.text === llmAttempt.naturalResponse);
    pendingMessage.nextBestQuestion = structuredQuestion;
    pendingMessage.displayedQuestionId = questionMetadata.id || '';
    pendingMessage.displayedQuestionField = questionMetadata.field || '';
    pendingMessage.smartIntakeUnavailable = smartIntakeUnavailable;
    pendingMessage.smartIntakeDegraded = smartIntakeDegraded;
    pendingMessage.smartIntakeDiagnostic = invalidCompassResponse;
    pendingMessage.invalidCompassResponse = invalidCompassResponse;
    pendingMessage.compassFailureType = llmAttempt.compassFailureType || conversationPlan.source || '';
    if (llmAttempt.retried) {
      pendingMessage.retryNote = `Smart intake used ${llmAttemptCount || llmAttempts.length} attempts before this response.`;
    }
    if (!llmAttempt.retried && llmAttemptCount > 1) {
      pendingMessage.retryNote = `Smart intake tried ${llmAttemptCount}${llmMaxAttempts ? ` of ${llmMaxAttempts}` : ''} attempts before falling back.`;
    }
    if (smartIntakeUnavailable) {
      pendingMessage.unavailableMessage = llmAttempt.userMessage || conversationPlan.userMessage || pendingMessage.text;
    }
    if (smartIntakeDegraded || invalidCompassResponse) {
      pendingMessage.degradedMessage = llmAttempt.userMessage
        || conversationPlan.userMessage
        || llmAttempt.reason
        || conversationPlan.reason
        || (invalidCompassResponse
          ? 'Smart intake used deterministic fallback for this turn because the live advisory response could not be parsed.'
          : 'Compass is busy, so I used deterministic intake for this turn. You can keep going or retry smart intake.');
    }
    pendingMessage.displayedQuestion = structuredQuestion
      || (!hasServerQuestionSignal ? assistantQuestionFromText(pendingMessage.text) : '');
    if (pendingMessage.displayedQuestion) {
      persistActiveQuestion(pendingMessage.displayedQuestion, questionMetadata);
    } else if (hasServerQuestionSignal) {
      persistActiveQuestion('');
    }
    renderChatMessages();
    if (result.run?.ok) {
      registerCompletedRun('chat', result.run, { currentSession: true });
      playResult(result.run, { runMode: 'chat' });
      loadAuditLog();
    } else {
      if (options.forceRun) stopCouncilRunAnimation();
      renderConversationState(result);
    }
    return result;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Conversation failed.';
    const authBlocked = isAuthorizationError(error);
    const recoveredDraft = error?.body?.caseDraft;
    if (recoveredDraft && typeof recoveredDraft === 'object' && recoveredDraft.caseId) {
      chatCaseDraft = { ...recoveredDraft };
      scheduleChatSessionSave();
    }
    pendingMessage.pending = false;
    pendingMessage.text = authBlocked
      ? `${authorizationRecoveryMessage('Agent API')} Uploaded evidence metadata stays attached in this session; save the token and retry the last message.`
      : `I could not process that turn: ${messageText}${recoveredDraft ? ' The case was restored to its authoritative server version, so you can continue or rerun.' : ''}`;
    renderChatMessages();
    if (authBlocked) {
      renderConversationState({
        caseDraft: chatCaseDraft,
        missingFields: chatMissingFields,
        runReadiness: chatRunReadiness,
        questions: [activeQuestion || chatCaseDraft.activeQuestion || 'Who is the accountable business owner for this case?']
      });
    } else {
      renderRun({ ok: false, message: messageText });
    }
    return null;
  } finally {
    stopThinkingProgress();
    conversationRequestActive = false;
    syncPrimaryActionState();
  }
}

function splitFeedbackList(value = '') {
  return cleanEvidenceText(value)
    .split(/[,;\n]+/)
    .map((item) => cleanEvidenceText(item))
    .filter(Boolean)
    .slice(0, 10);
}

async function submitLearningFeedback(form) {
  const result = lastRuns.chat?.ok ? lastRuns.chat : lastRun?.ok ? lastRun : null;
  const status = form.querySelector('[data-learning-feedback-status]');
  if (!result) {
    if (status) status.textContent = 'Run the council before saving reviewer memory.';
    return;
  }
  const data = new FormData(form);
  const reviewerDecision = cleanEvidenceText(data.get('reviewerDecision') || 'Request remediation');
  const reviewerNotes = cleanEvidenceText(data.get('reviewerNotes') || '');
  if (!reviewerNotes) {
    if (status) status.textContent = 'Add a short reviewer note before saving.';
    return;
  }
  const payload = {
    caseId: result.case?.caseId || chatCaseDraft.caseId || 'conversation-case',
    originalDecision: result.decision?.recommendation || result.decision?.status || '',
    reviewerDecision,
    reviewerNotes,
    addedControls: splitFeedbackList(data.get('addedControls') || ''),
    missingEvidence: splitFeedbackList(data.get('missingEvidence') || '').length
      ? splitFeedbackList(data.get('missingEvidence') || '')
      : (result.gaps || []).map((gap) => gap.gap).filter(Boolean).slice(0, 8),
    rejectedEvidence: [],
    finalOutcome: reviewerDecision,
    domains: (result.domains || []).map((domain) => domain.label || domain.id).filter(Boolean).slice(0, 8),
    tags: [
      ...(result.case?.integrations || []),
      ...(result.case?.documents || []).flatMap((doc) => doc.signals || [])
    ].filter(Boolean).slice(0, 12)
  };
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  if (status) status.textContent = 'Saving governed learning artifact…';
  try {
    const saved = await apiFetch('/api/learning/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (status) {
      status.textContent = `Saved ${saved.artifacts?.length || 0} advisory memory artifact${(saved.artifacts?.length || 0) === 1 ? '' : 's'} via ${saved.provider || 'learning memory'}.`;
    }
    form.reset();
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : 'Could not save reviewer memory.';
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function recordHumanReview(action = 'approval') {
  const result = lastRun?.ok ? lastRun : lastRuns[activeRunMode]?.ok ? lastRuns[activeRunMode] : null;
  if (!result || result.humanReviewRecorded || humanReviewRecord?._runId === result.runId) return;
  if (!currentSessionRunIds.has(result.runId)) {
    setApprovalActions();
    setApprovalActionStatus('Historical result loaded read-only. Rerun the council in this session before recording a human decision.', 'warning');
    return;
  }
  const requestsRemediation = action === 'request-remediation';
  const reviewerDecision = requestsRemediation ? 'Request remediation' : 'Approve';
  const confirmed = window.confirm(requestsRemediation
    ? 'Request remediation for this case? This records a final human rejection and writes an audit event.'
    : 'Approve this case? This records the accountable human decision and writes an audit event.');
  if (!confirmed) return;
  const approvalAllowed = result.decisionReadiness?.approvalEligible === true;
  setApprovalActions({ enabled: true, busyAction: requestsRemediation ? 'remediation' : 'approve', allowApproval: approvalAllowed });
  setApprovalActionStatus(`Recording ${reviewerDecision.toLowerCase()}…`, 'working');
  try {
    const recorded = await apiFetch('/api/case/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: result.case?.caseId || chatCaseDraft.caseId || 'conversation-case',
        caseVersion: Number(result.caseVersion || result.case?.version || chatCaseDraft.caseVersion || 1),
        decision: result.decision || {},
        reviewerDecision,
        reviewerNotes: requestsRemediation
          ? 'Accountable human reviewer inspected the decision room and requested remediation before approval.'
          : 'Accountable human reviewer inspected the decision room and granted approval after the council marked the case approval-eligible.',
        evidenceIds: Array.isArray(result.evidenceIds) ? result.evidenceIds : []
      })
    });
    humanReviewRecord = { ...recorded, _runId: result.runId || '' };
    result.humanReviewRecorded = humanReviewRecord;
    registerCompletedRun(latestCompletedRunMode || activeRunMode, result, { currentSession: true });
    setApprovalActions({ recorded: humanReviewRecord });
    setApprovalActionStatus(
      requestsRemediation ? 'Remediation request recorded in the audit trail.' : 'Human approval recorded in the audit trail.',
      requestsRemediation ? 'warning' : 'ready'
    );
    loadAuditLog();
  } catch (error) {
    setApprovalActions({ enabled: true, allowApproval: approvalAllowed });
    const detail = error instanceof Error ? error.message : 'The human decision could not be recorded.';
    setApprovalActionStatus(`${detail} Review the case version or authorization, then retry.`, 'danger');
  }
}

async function loadReadiness() {
  if (!privilegedDiagnosticsRequested()) {
    readinessList.innerHTML = `
      <article class="hardening-item">
        <span class="status-info">restricted</span>
        <strong>Operational readiness</strong>
        <p>Sign in with an authorized pilot or admin role to inspect deployment readiness details.</p>
      </article>
    `;
    return null;
  }
  try {
    const readiness = await apiFetch('/api/readiness');
    const inventory = readiness.submissionReadiness || {};
    readinessList.innerHTML = Object.entries(inventory).map(([key, value]) => `
      <article class="hardening-item">
        <span class="${statusClass(statusTone(value, 'warning'))}">${escapeHtml(humanize(value))}</span>
        <strong>${escapeHtml(readinessCopy[key]?.label || titleCase(key.replace(/([A-Z])/g, ' $1')))}</strong>
        <p>${escapeHtml(readinessCopy[key]?.proof || 'Current proof recorded in the readiness endpoint.')}</p>
        <small>${escapeHtml(readinessCopy[key]?.next || 'Track in the production hardening plan.')}</small>
      </article>
    `).join('');
  } catch (error) {
    readinessList.innerHTML = `
      <article class="hardening-item">
        <span class="status-danger">unavailable</span>
        <strong>Readiness API</strong>
        <p>${escapeHtml(error instanceof Error ? error.message : 'unavailable')}</p>
      </article>
    `;
  }
}

async function loadBenchmarks() {
  if (!privilegedDiagnosticsRequested()) {
    benchmarkSummary.innerHTML = `
      <article>
        <span class="status-info">restricted</span>
        <strong>Evaluation report</strong>
        <p>Authorized pilot or admin access is required to load runtime benchmarks.</p>
      </article>
    `;
    return null;
  }
  try {
    const report = await apiFetch('/api/benchmarks');
    benchmarkSummary.innerHTML = `
      <article>
        <span class="eyebrow">Eval suite</span>
        <strong>${escapeHtml(report.summary.passed)}/${escapeHtml(report.summary.cases)} passed</strong>
        <p>${Math.round(report.summary.passRate * 100)}% pass rate · p95 ${escapeHtml(report.summary.p95DurationMs)} ms</p>
      </article>
    `;
  } catch (error) {
    benchmarkSummary.innerHTML = `
      <article>
        <span class="status-danger">unavailable</span>
        <strong>Benchmark API</strong>
        <p>${escapeHtml(error instanceof Error ? error.message : 'unavailable')}</p>
      </article>
    `;
  }
}

function formatAuditTimestamp(value = '') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return cleanText(value) || 'unknown time';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function shortAuditHash(value = '') {
  const hash = cleanText(value);
  return hash ? `${hash.slice(0, 10)}…` : '';
}

function renderAuditIntegrity(integrity = {}) {
  const ok = Boolean(integrity.ok);
  const className = ok ? 'is-ok' : 'is-broken';
  const label = ok ? 'integrity ok' : 'integrity broken';
  const detail = ok
    ? `${Number(integrity.count || 0)} chained records`
    : `${cleanText(integrity.reason || 'verification failed')}${integrity.brokenAt ? ` at #${integrity.brokenAt}` : ''}`;
  return `
    <div class="audit-integrity-row">
      <span class="audit-integrity-pill ${className}">${label}</span>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function renderAuditRecord(record = {}) {
  if (record.malformed) {
    return `
      <article class="admin-log-row is-broken">
        <div>
          <strong>Malformed audit record</strong>
          <p>One audit line could not be parsed.</p>
        </div>
      </article>
    `;
  }
  const actor = record.actor?.username || record.actor?.id || 'system';
  const sequence = record.integrity?.sequence ? `#${record.integrity.sequence}` : '';
  const hash = shortAuditHash(record.integrity?.recordHash);
  return `
    <article class="admin-log-row">
      <div class="admin-log-meta">
        <span>${escapeHtml(formatAuditTimestamp(record.timestamp))}</span>
        <span>${escapeHtml(actor)}</span>
        <span>${escapeHtml(record.status || 'recorded')}</span>
      </div>
      <strong>${escapeHtml(record.caseId || 'no case id')}</strong>
      <p>${escapeHtml(record.summary || 'Audit event recorded.')}</p>
      ${(sequence || hash) ? `<small>${escapeHtml(sequence)}${sequence && hash ? ' · ' : ''}${escapeHtml(hash)}</small>` : ''}
    </article>
  `;
}

function renderAuditLog(payload = {}) {
  if (!adminAuditLog) return;
  const records = Array.isArray(payload.records) ? payload.records.slice().reverse() : [];
  if (!records.length) {
    adminAuditLog.innerHTML = `
      ${renderAuditIntegrity(payload.integrity || {})}
      <article class="admin-log-row is-empty">
        <strong>No audit records yet</strong>
        <p>Run the council or update admin controls to create audit events.</p>
      </article>
    `;
    return;
  }
  adminAuditLog.innerHTML = `
    ${renderAuditIntegrity(payload.integrity || {})}
    <div class="admin-log-list">
      ${records.map(renderAuditRecord).join('')}
    </div>
  `;
}

async function loadAuditLog() {
  if (!adminAuditLog) return null;
  if (!privilegedDiagnosticsRequested()) {
    adminAuditLog.innerHTML = `
      <article class="admin-log-row is-auth">
        <strong>Admin auth required</strong>
        <p>Sign in with an authorized pilot or admin role to view recent audit records.</p>
      </article>
    `;
    return null;
  }
  adminAuditLog.innerHTML = `
    <article class="admin-log-row is-empty">
      <strong>Loading audit log</strong>
      <p>Checking the latest hash-chained audit records…</p>
    </article>
  `;
  try {
    const payload = await apiFetch('/api/audit/recent?limit=20');
    renderAuditLog(payload);
    return payload;
  } catch (error) {
    const status = Number(error?.status || error?.body?.status || 0);
    const authRequired = status === 401 || status === 403 || /unauthorized|forbidden|auth/i.test(error?.message || '');
    adminAuditLog.innerHTML = `
      <article class="admin-log-row ${authRequired ? 'is-auth' : 'is-broken'}">
        <strong>${authRequired ? 'Admin auth required' : 'Audit log unavailable'}</strong>
        <p>${escapeHtml(authRequired ? 'Sign in with an admin or audit role to view recent audit records.' : error instanceof Error ? error.message : 'Could not load audit records.')}</p>
      </article>
    `;
    return null;
  }
}

function renderStatusCards(results) {
  deploymentStatus.innerHTML = results.map((result) => {
    const tone = result.tone || statusTone(result.status, 'danger');
    return `
    <article class="status-card" ${uiComponentAttributes('deployment-status', tone)}>
      <strong>
        ${escapeHtml(result.label)}
        <span class="${statusClass(tone)}">${escapeHtml(result.status)}</span>
      </strong>
      <code>${escapeHtml(result.url)}</code>
      <p>${escapeHtml(result.detail)}</p>
    </article>`;
  }).join('');
  const tones = results.map((result) => result.tone || statusTone(result.status, 'danger'));
  const healthTone = tones.includes('danger') ? 'danger' : tones.includes('checking') ? 'checking' : tones.includes('warning') ? 'warning' : 'ready';
  topHealth.textContent = healthTone === 'danger' ? 'degraded' : healthTone === 'checking' ? 'checking' : healthTone === 'warning' ? 'limited' : 'live';
  topHealth.className = statusClass(healthTone);
}

function renderCapabilityFallbacks(results = []) {
  if (!capabilityFallbacks) return;
  const app = results.find((result) => /Compliance API/i.test(result.label)) || {};
  const backend = results.find((result) => /backend/i.test(result.label)) || {};
  const gateway = results.find((result) => /Compass gateway/i.test(result.label)) || {};
  const appBody = app.body || {};
  const featureList = appBody.adminFeatures?.features || appBody.features || adminFeatureState?.features || [];
  const notes = [];
  const disabledFeatures = featureList.filter((feature) => feature.enabled === false);
  const inactiveRequested = featureList.filter((feature) => feature.enabled && feature.active === false && Array.isArray(feature.unmetRequirements) && feature.unmetRequirements.length);

  if (disabledFeatures.length) {
    notes.push({
      label: 'Admin capability switch off',
      detail: `${disabledFeatures.map((feature) => feature.label).join(', ')} disabled by admin controls. The deterministic council and human review boundary remain available.`
    });
  }

  if (inactiveRequested.length) {
    notes.push({
      label: 'Requested capabilities need configuration',
      detail: inactiveRequested.slice(0, 3).map((feature) => `${feature.label}: ${feature.unmetRequirements.join(', ')}`).join(' · ')
    });
  }

  if (appBody.evidenceGateway && !appBody.evidenceGateway.tokenConfigured) {
    notes.push({
      label: 'Deterministic public demo mode',
      detail: 'Compass smart intake is not configured. Structured intake, deterministic council execution, Qdrant hash-vector retrieval, audit trace, and PDF export remain fully testable.'
    });
  } else if (gateway.status === 'unavailable') {
    notes.push({
      label: 'Compass gateway unavailable',
      detail: 'Smart intake is unavailable while the Compass gateway is unreachable. Use replay or structured intake; evidence embedding/search and advisory model calls should be treated as unavailable for this demo run.'
    });
  }

  if (backend.status === 'unavailable') {
    notes.push({
      label: 'Parser relay unavailable',
      detail: 'Document OCR/parser extraction is disabled. The UI will register file metadata only; paste the key contract clauses or evidence summary into chat before running council.'
    });
  } else if (backend.status === 'captured') {
    notes.push({
      label: 'Parser relay not verified in local mode',
      detail: 'Local mode uses captured backend proof unless relay mode is selected. If upload parsing fails, typed case context and deterministic council execution remain available.'
    });
  }

  if (/local_file/i.test(appBody.evidenceVectorStore?.provider || appBody.vector?.provider || '')) {
    notes.push({
      label: 'Local vector fallback active',
      detail: 'Evidence chunks stay behind server-side APIs, but the default local-file vector store is demo-grade and not durable enterprise storage.'
    });
  }

  if (!notes.length) {
    capabilityFallbacks.innerHTML = `
      <article class="capability-note is-ready">
        <strong>Core demo path available</strong>
        <p>Chat intake, deterministic council, evidence status, audit trace, and export controls are ready for a judge walkthrough.</p>
      </article>
    `;
    return;
  }

  capabilityFallbacks.innerHTML = notes.map((note) => `
    <article class="capability-note">
      <strong>${escapeHtml(note.label)}</strong>
      <p>${escapeHtml(note.detail)}</p>
    </article>
  `).join('');
}

function adminStatusCard(label, status, detail, tone = 'danger') {
  const safeTone = ['ready', 'warning', 'danger', 'info', 'checking'].includes(tone) ? tone : 'danger';
  const className = safeTone === 'checking' ? 'is-loading' : `is-${safeTone}`;
  return `
    <article class="admin-status-card ${className}" ${uiComponentAttributes('admin-status', safeTone)}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(status)}</strong>
      <p>${escapeHtml(detail)}</p>
    </article>
  `;
}

function renderAdminStatus(status = {}) {
  if (!adminStatusDashboard) return;
  const safeStatus = status || {};
  const settings = adminOperationalSettings(safeStatus);
  const requestLimits = settings.requestLimits;
  const uploadTargetLimits = settings.uploadTargetLimits;
  const llmRetry = settings.llmRetry;
  const llmTokens = settings.llmTokens;
  const context = settings.context;
  const vector = safeStatus.vector || {};
  const gateway = safeStatus.gateway || {};
  const parserRelay = safeStatus.parserRelay || {};
  const runtime = safeStatus.runtime || {};
  const auth = safeStatus.auth || {};
  const audit = safeStatus.audit || {};
  const indexStatus = evidenceIndexValidation.status === 'not_checked' ? 'not checked' : evidenceIndexValidation.status || 'not checked';
  const evidenceProvider = evidenceIndexMeta.provider || vector.provider || 'local-file fallback';
  const cards = [
    ...(safeStatus.statusError
      ? [adminStatusCard('Runtime status', 'fallback values', safeStatus.statusError, 'danger')]
      : []),
    adminStatusCard('Auth mode', auth.enforced ? 'enforced' : auth.mode || 'audit', auth.enforced ? 'RBAC policy blocks unauthorized actions.' : 'Audit-mode records actor context without blocking the demo.', auth.enforced ? 'ready' : 'warning'),
    adminStatusCard('Audit chain', audit.hashChained ? 'hash-chained' : 'not verified', audit.provider || 'local-jsonl', audit.hashChained ? 'ready' : 'warning'),
    adminStatusCard('Request limits', `conversation ${formatBytes(requestLimits.conversation)}`, `Standard run ${formatBytes(requestLimits.standardRun)} · admin ${formatBytes(requestLimits.admin)}.`, 'ready'),
    adminStatusCard('Evidence request limits', `index ${formatBytes(requestLimits.evidenceIndex)}`, `Search ${formatBytes(requestLimits.evidenceSearch)} · review pack ${formatBytes(requestLimits.reviewPack)}.`, 'ready'),
    adminStatusCard('Vector memory', vector.provider || 'local-file', vector.qdrantConfigured ? `Qdrant collection ${vector.collection || 'configured'}` : 'Local-file fallback is demo-grade.', vector.qdrantConfigured ? 'ready' : 'warning'),
    adminStatusCard('Evidence index', indexStatus, evidenceIndexValidation.detail || 'Restored evidence index metadata has not been checked.', statusTone(indexStatus, 'warning')),
    adminStatusCard('Upload targets', `${formatBytes(uploadTargetLimits.maxFileBytes)} per file`, `Batch ${formatBytes(uploadTargetLimits.maxBatchBytes)} · chunk size ${formatBytes(uploadTargetLimits.chunkSizeBytes)}.`, 'ready'),
    adminStatusCard('LLM retry policy', `${formatInteger(llmRetry.maxAttempts)} attempts`, `Fast fail ${formatInteger(llmRetry.fastFailMs)} ms · retry cap ${formatInteger(llmRetry.maxRetryDelayMs)} ms · rate-limit cap ${formatInteger(llmRetry.rateLimitMaxRetryDelayMs)} ms · jitter ${formatInteger(llmRetry.retryJitterMs)} ms.`, 'info'),
    adminStatusCard('LLM prose budget', `${formatInteger(llmTokens.naturalResponseMaxTokens)} response tokens`, `Structured ${formatInteger(llmTokens.structuredMaxTokens)} tokens · retry structured ${formatInteger(llmTokens.retryStructuredMaxTokens)} tokens · prose clamp ${formatInteger(llmTokens.naturalResponseMaxChars)} chars.`, 'info'),
    adminStatusCard('Context caps', `${formatInteger(context.historyTurns)} history turns`, `Prompt uses ${formatInteger(context.recentTurnsForPrompt)} recent turns · ${formatInteger(context.turnMaxChars)} chars per turn.`, 'info'),
    adminStatusCard('Context summaries', `brief ${formatInteger(context.briefMaxChars)} chars`, `Document ${formatInteger(context.documentSummaryMaxChars)} chars · memory ${formatInteger(context.memorySummaryMaxChars)} chars · rolling summary ${rollingSummaryStatus(chatCaseDraft)}.`, 'info'),
    adminStatusCard('Evidence index provider', evidenceProvider, `${indexedChunkCount()} indexed chunk${indexedChunkCount() === 1 ? '' : 's'} currently referenced by the browser.`, vector.qdrantConfigured ? 'ready' : 'warning'),
    adminStatusCard('Evidence boundary', 'server-side retained', 'Full evidence text and embeddings stay server-side after parser/indexing. Conversation calls send IDs, statuses, summaries, snippets, and retrieval matches only.', 'ready'),
    adminStatusCard('Compass gateway', gateway.configured ? 'required / configured' : 'required / missing', gateway.configured ? 'Required smart intake, advisory LLM, and embeddings boundary is configured.' : 'Compass gateway is not configured — smart intake is unavailable. Contact your administrator.', gateway.configured ? 'ready' : 'danger'),
    adminStatusCard('Parser relay', parserRelay.configured ? 'configured' : 'default relay', parserRelay.featureEnabled === false ? 'Disabled by admin switch.' : 'External parser/OCR boundary is requested when available.', parserRelay.featureEnabled === false ? 'danger' : parserRelay.configured ? 'ready' : 'warning'),
    adminStatusCard('Council runtime policy', runtime.liveCrewAIEnabled ? 'live runtime requested' : runtime.default || 'crewai_llm', runtime.liveLlmAdvisoryEnabled ? 'Live advisory specialists are enabled; each run reports its actual runtime.' : 'The deterministic engine owns recommendations; each run reports its actual runtime.', runtime.liveCrewAIEnabled ? 'warning' : 'info')
  ];
  adminStatusDashboard.innerHTML = cards.join('');
}

function redactSensitiveDiagnostics(value) {
  if (Array.isArray(value)) return value.map(redactSensitiveDiagnostics);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (/token|secret|password|authorization|bearer|api[_-]?key|client[_-]?secret/i.test(key)) {
        return [key, '[redacted]'];
      }
      return [key, redactSensitiveDiagnostics(item)];
    }));
  }
  return value;
}

function adminDiagnosticPayload() {
  const status = adminStatusState && typeof adminStatusState === 'object'
    ? adminStatusState
    : { status: 'not_loaded', settings: clientFallbackOperationalSettings() };
  return redactSensitiveDiagnostics({
    copiedAt: new Date().toISOString(),
    adminStatus: {
      ...status,
      settings: adminOperationalSettings(status)
    }
  });
}

async function copyAdminDiagnosticJson() {
  if (!copyAdminDiagnostics) return;
  const originalLabel = copyAdminDiagnostics.textContent;
  const payload = `${JSON.stringify(adminDiagnosticPayload(), null, 2)}\n`;
  try {
    await navigator.clipboard.writeText(payload);
    copyAdminDiagnostics.textContent = 'Copied';
    if (adminDiagnosticsCopyStatus) {
      adminDiagnosticsCopyStatus.textContent = 'Safe diagnostic JSON copied.';
    }
  } catch (error) {
    if (adminDiagnosticsCopyStatus) {
      adminDiagnosticsCopyStatus.textContent = error instanceof Error ? error.message : 'Copy failed.';
    }
  } finally {
    window.setTimeout(() => {
      copyAdminDiagnostics.textContent = originalLabel || 'Copy diagnostic JSON';
      if (adminDiagnosticsCopyStatus) adminDiagnosticsCopyStatus.textContent = '';
    }, 1800);
  }
}

async function loadAdminStatus() {
  if (!adminStatusDashboard) return null;
  adminStatusDashboard.innerHTML = '<article class="admin-status-card is-loading"><span>Runtime status</span><strong>Checking</strong><p>Loading safe admin readiness signals…</p></article>';
  try {
    const status = await apiFetch('/api/admin/status');
    adminStatusState = status;
    renderAdminStatus(status);
    return status;
  } catch (error) {
    adminStatusState = {
      status: 'unavailable',
      statusError: error instanceof Error ? error.message : 'Could not load admin status.',
      settings: clientFallbackOperationalSettings()
    };
    renderAdminStatus(adminStatusState);
    return null;
  }
}

function adminFeatureBadge(feature = {}) {
  if (!feature.enabled) return 'off';
  if (feature.active) return 'active';
  if (feature.configured) return 'ready';
  return 'needs config';
}

function renderAdminFeatureControls(status = adminFeatureState) {
  if (!adminFeatureControls) return;
  adminFeatureState = status;
  const features = Array.isArray(status?.features) ? status.features : [];
  if (!features.length) {
    adminFeatureControls.innerHTML = '<article class="feature-toggle-row is-empty">Admin feature controls are not loaded yet.</article>';
    return;
  }
  adminFeatureControls.innerHTML = features.map((feature) => {
    const badge = adminFeatureBadge(feature);
    const unmet = Array.isArray(feature.unmetRequirements) ? feature.unmetRequirements : [];
    return `
      <article class="feature-toggle-row" data-feature-row="${escapeHtml(feature.id)}">
        <div>
          <strong>${escapeHtml(feature.label)}</strong>
          <p>${escapeHtml(feature.description || '')}</p>
          ${unmet.length ? `<small>Needs: ${escapeHtml(unmet.join(', '))}</small>` : feature.note ? `<small>${escapeHtml(feature.note)}</small>` : ''}
        </div>
        <div class="feature-toggle-actions">
          <span class="feature-state ${feature.active ? 'is-active' : feature.enabled ? 'is-waiting' : 'is-off'}">${escapeHtml(badge)}</span>
          <button
            type="button"
            class="feature-toggle-button ${feature.enabled ? 'is-on' : ''}"
            data-feature-toggle="${escapeHtml(feature.id)}"
            aria-pressed="${feature.enabled ? 'true' : 'false'}">
            ${feature.enabled ? 'On' : 'Off'}
          </button>
        </div>
      </article>
    `;
  }).join('');
}

function showAdminMutationRequired(message = 'Admin token required to change settings.') {
  if (!adminFeatureControls) return;
  adminFeatureControls.querySelectorAll('[data-feature-toggle]').forEach((button) => {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
  });
  adminFeatureControls.insertAdjacentHTML('afterbegin', `
    <article class="feature-toggle-row is-auth-required">
      <strong>Admin authorization required</strong>
      <p>${escapeHtml(message)}</p>
    </article>
  `);
}

async function loadAdminFeatures() {
  if (!adminFeatureControls) return null;
  try {
    const status = await apiFetch('/api/admin/features');
    renderAdminFeatureControls(status);
    return status;
  } catch (error) {
    adminFeatureControls.innerHTML = `
      <article class="feature-toggle-row is-empty">
        Admin feature controls unavailable: ${escapeHtml(error instanceof Error ? error.message : 'request failed')}
      </article>
    `;
    return null;
  }
}

async function setAdminFeature(featureId, enabled) {
  if (!featureId) return;
  const button = adminFeatureControls?.querySelector(`[data-feature-toggle="${CSS.escape(featureId)}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = 'Saving';
  }
  try {
    const status = await apiFetch('/api/admin/features', {
      method: 'PATCH',
      headers: adminMutationHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ features: { [featureId]: enabled } })
    });
    renderAdminFeatureControls(status);
    await loadDeploymentStatus();
    await loadAuditLog();
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = enabled ? 'Off' : 'On';
    }
    const status = Number(error?.status || error?.body?.status || 0);
    if (status === 401 || status === 403) {
      renderAdminFeatureControls(adminFeatureState);
      showAdminMutationRequired('Admin token required to change settings.');
      return;
    }
    const message = error instanceof Error ? error.message : 'feature update failed';
    adminFeatureControls.insertAdjacentHTML('afterbegin', `
      <article class="feature-toggle-row is-error">Could not update ${escapeHtml(featureId)}: ${escapeHtml(message)}</article>
    `);
  }
}

async function loadDeploymentStatus() {
  const config = currentConfig();
  const backendCheck = backendStatusCheck(config);
  const gatewayCheck = gatewayStatusCheck(config);
  updateJsonLinks();
  renderStatusCards([
    { label: 'Compliance API', status: 'checking', tone: 'checking', url: apiUrl('/api/health'), detail: 'Checking runnable agent API.' },
    { label: 'Parallax42 backend', status: backendCheck.skipFetch ? backendCheck.status : 'checking', tone: backendCheck.skipFetch ? backendCheck.tone : 'checking', url: backendCheck.url, detail: backendCheck.skipFetch ? backendCheck.detail : 'Checking live backend proof.' },
    { label: gatewayCheck.label, status: gatewayCheck.skipFetch ? gatewayCheck.status : 'checking', tone: gatewayCheck.skipFetch ? gatewayCheck.tone : 'checking', url: gatewayCheck.url, detail: gatewayCheck.skipFetch ? gatewayCheck.detail : 'Checking model gateway boundary.' }
  ]);

  const checks = [
    {
      label: `Compliance API (${config.resolvedMode})`,
      url: apiUrl('/api/health'),
      sessionAuth: true,
      detail: (body) => body?.agentRuntime?.configuredRuntime
        ? `${body.service} using ${formatRuntime(body.agentRuntime.configuredRuntime)}`
        : body?.status || body?.service || 'API responded'
    },
    backendCheck,
    gatewayCheck
  ];

  const results = await Promise.all(checks.map(async (check) => {
    if (check.skipFetch) {
      return {
        label: check.label,
        url: check.url,
        status: check.status,
        tone: check.tone || statusTone(check.status, 'warning'),
        detail: check.detail
      };
    }
    try {
      const body = await fetchJson(check.url, check.sessionAuth ? withSessionAuth() : {});
      return {
        label: check.label,
        url: check.url,
        status: 'healthy',
        tone: 'ready',
        detail: check.detail(body),
        body
      };
    } catch (error) {
      return {
        label: check.label,
        url: check.url,
        status: 'unavailable',
        tone: 'danger',
        detail: error instanceof Error ? error.message : 'Request failed'
      };
    }
  }));

  renderStatusCards(results);
  renderCapabilityFallbacks(results);
  loadAdminStatus();
  loadAdminFeatures();
}

topbarSectionLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setMainSection(link.dataset.mainSection, { updateHash: true, scroll: true, refresh: true });
  });
});

window.addEventListener('popstate', () => {
  setMainSection(mainSectionFromHash(), { updateHash: false, scroll: true, refresh: true, behavior: 'auto' });
});

window.addEventListener('hashchange', () => {
  setMainSection(mainSectionFromHash(), { updateHash: false, scroll: true, refresh: true, behavior: 'auto' });
});

runModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (activeMainSection !== 'agent') {
      setMainSection('agent', { updateHash: true, scroll: false, refresh: false });
    }
    if (button.dataset.runMode === 'chat') setWorkspaceView('chat');
    setRunMode(button.dataset.runMode);
  });
});

councilOutputTab?.addEventListener('click', () => {
  showCouncilOutput();
});

workspaceTabButtons.forEach((button) => {
  button.addEventListener('keydown', (event) => {
    window.P42AppModules.appState.handleRovingTabKey(event, workspaceTabButtons, (next) => next.click());
  });
});

runHistorySelect?.addEventListener('change', () => {
  restoreRunFromHistory(runHistorySelect.value);
});

specialistList?.addEventListener('click', (event) => {
  const action = event.target?.closest?.('[data-report-action]')?.dataset?.reportAction;
  if (action === 'export-review-pack') {
    execReviewPack?.click();
  } else if (action === 'continue-conversation') {
    setWorkspaceView('chat');
    setRunMode('chat', { skipRender: true });
    renderChatMessages();
    renderContextStrength();
    window.setTimeout(() => chatInput?.focus(), 0);
  } else if (action === 'run-council') {
    submitChatMessage(chatInput.value || 'run it', { forceRun: true });
  }
});

artifactPreview?.addEventListener('click', (event) => {
  const action = event.target?.closest?.('[data-report-action]')?.dataset?.reportAction;
  if (action === 'export-review-pack') execReviewPack?.click();
});

caseIntelDetails?.addEventListener('click', (event) => {
  const action = event.target?.closest?.('[data-report-action]')?.dataset?.reportAction;
  if (action === 'run-council') {
    submitChatMessage(chatInput.value || 'rerun council', { forceRun: true });
  }
});

specialistList?.addEventListener('submit', (event) => {
  const form = event.target?.closest?.('[data-learning-feedback-form]');
  if (!form) return;
  event.preventDefault();
  submitLearningFeedback(form);
});

approvalButton?.addEventListener('click', () => {
  if (approvalButton.dataset.reviewAction === 'approval') {
    recordHumanReview('approval');
  }
});

remediationButton?.addEventListener('click', () => {
  if (remediationButton.dataset.reviewAction === 'request-remediation') {
    recordHumanReview('request-remediation');
  }
});

agentActivity?.addEventListener('click', (event) => {
  const agentButton = event.target?.closest?.('[data-council-agent]');
  if (!agentButton) return;
  councilFocusAgent = agentButton.dataset.councilAgent;
  renderAgentActivity(lastCouncilActivity);
});

intelRailTabs.forEach((button) => {
  button.addEventListener('click', () => {
    setIntelRailTab(button.dataset.intelRailTab);
  });
  button.addEventListener('keydown', (event) => {
    window.P42AppModules.appState.handleRovingTabKey(event, intelRailTabs, (next) => setIntelRailTab(next.dataset.intelRailTab));
  });
});

document.querySelectorAll('[data-scenario]').forEach((button) => {
  button.addEventListener('click', () => {
    setRunMode('demo', { skipRender: true });
    applyScenario(button.dataset.scenario);
    runAgent(currentFormPayload(), { playback: true, mode: 'demo' });
  });
});

evidenceInput.addEventListener('change', (event) => {
  ingestEvidenceFiles(event.target.files);
});

chatEvidenceInput?.addEventListener('change', (event) => {
  ingestEvidenceFiles(event.target.files);
});

if (chatEvidencePicker) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    chatEvidencePicker.addEventListener(eventName, (event) => {
      event.preventDefault();
      chatEvidencePicker.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    chatEvidencePicker.addEventListener(eventName, (event) => {
      event.preventDefault();
      chatEvidencePicker.classList.remove('is-dragging');
    });
  });

  chatEvidencePicker.addEventListener('drop', (event) => {
    ingestEvidenceFiles(event.dataTransfer.files);
  });
}

['dragenter', 'dragover'].forEach((eventName) => {
  evidenceDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    evidenceDropzone.classList.add('is-dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  evidenceDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    evidenceDropzone.classList.remove('is-dragging');
  });
});

evidenceDropzone.addEventListener('drop', (event) => {
  ingestEvidenceFiles(event.dataTransfer.files);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  runAgent(currentFormPayload(), { playback: true, mode: activeRunMode });
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitChatMessage(chatInput.value);
});

chatInput?.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    submitChatMessage(chatInput.value || 'run it again', { forceRun: true });
    return;
  }
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  const message = cleanEvidenceText(chatInput.value);
  if (message) submitChatMessage(message);
});

chatInput?.addEventListener('input', () => {
  updateChatInputCounter();
  scheduleLiveCasePreview();
});

caseIntelDetails?.addEventListener('click', (event) => {
  const prompt = event.target?.closest?.('[data-intel-prompt]')?.dataset?.intelPrompt;
  if (!prompt || !chatInput) return;
  chatInput.value = prompt;
  updateChatInputCounter();
  updateLiveCasePreview();
  chatInput.focus();
});

chatRunNow.addEventListener('click', () => {
  submitChatMessage(chatInput.value || 'run it', { forceRun: true });
});

chatMessagesEl?.addEventListener('click', (event) => {
  const hint = event.target?.closest?.('[data-hint-chip]')?.dataset?.hintChip;
  if (hint && chatInput) {
    chatInput.value = hint;
    updateChatInputCounter();
    updateLiveCasePreview();
    chatInput.focus();
    return;
  }
  const action = event.target?.closest?.('[data-chat-action]')?.dataset?.chatAction;
  if (action === 'run-council') {
    submitChatMessage(chatInput.value || 'run it', { forceRun: true });
  } else if (action === 'retry-smart-intake') {
    const lastUser = latestUserChatMessage();
    const message = lastUser?.text || chatInput.value || '';
    if (message) {
      submitChatMessage(message, {
        retrySmartIntake: true,
        silentUser: true,
        activeQuestion: lastUser?.answeringQuestion || activeQuestion || chatCaseDraft.activeQuestion || ''
      });
    }
  } else if (action === 'continue-deterministic') {
    chatInput?.focus();
  }
});

chatPromptButtons.forEach((button) => {
  button.addEventListener('click', () => {
    submitChatMessage(button.dataset.chatPrompt || '');
  });
});

startNewCase?.addEventListener('click', () => {
  resetChatCaseSession();
});

runtimeConfig.addEventListener('submit', (event) => {
  event.preventDefault();
  writeStorage(storageKeys.mode, apiMode.value);
  writeStorage(storageKeys.relayUrl, stripTrailingSlash(relayUrl.value));
  writeStorage(storageKeys.backendUrl, stripTrailingSlash(backendUrl.value));
  writeAdminBearerToken(adminBearerToken?.value || '');
  loadDeploymentStatus();
  loadReadiness();
  loadBenchmarks();
  loadAuditLog();
});

pilotAccessForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  startPilotSession(pilotAccessCode?.value || '');
});

pilotLogout?.addEventListener('click', () => {
  endPilotSession();
});

resetConfig.addEventListener('click', () => {
  writeStorage(storageKeys.mode, '');
  writeStorage(storageKeys.relayUrl, '');
  writeStorage(storageKeys.backendUrl, '');
  writeAdminBearerToken('');
  hydrateConfigForm();
  loadDeploymentStatus();
  loadReadiness();
  loadBenchmarks();
  loadAuditLog();
});

adminFeatureControls?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-feature-toggle]');
  if (!button) return;
  const featureId = button.dataset.featureToggle;
  const current = adminFeatureState?.features?.find((feature) => feature.id === featureId);
  setAdminFeature(featureId, !(current?.enabled));
});

adminBearerToken?.addEventListener('change', () => {
  writeAdminBearerToken(adminBearerToken.value);
  renderAdminFeatureControls(adminFeatureState);
});

refreshAdminAuditLog?.addEventListener('click', () => {
  loadAuditLog();
});

copyAdminDiagnostics?.addEventListener('click', () => {
  copyAdminDiagnosticJson();
});

sampleRun.addEventListener('click', () => {
  if (activeRunMode === 'chat') {
    submitChatMessage(chatInput.value || 'run it', { forceRun: true });
    return;
  }
  runAgent(currentFormPayload(), { playback: true, mode: activeRunMode });
});
exportRun.addEventListener('click', () => {
  if (!lastRun?.ok) {
    if (exportActionStatus) {
      exportActionStatus.textContent = activeRunMode === 'chat' ? 'Run the council before exporting audit JSON.' : `Run ${activeRunMode} before exporting audit JSON.`;
      exportActionStatus.dataset.state = 'danger';
    }
    return;
  }
  downloadJson(`p42-audit-pack-${lastRun.runId || lastRun.case?.caseId || 'demo'}.json`, {
    exportedAt: new Date().toISOString(),
    service: 'parallax42-compliance-intelligence-agent',
    evidenceManifest: evidenceDocuments(lastRun),
    run: lastRun
  });
  if (exportActionStatus) {
    exportActionStatus.textContent = 'Audit JSON downloaded.';
    exportActionStatus.dataset.state = 'ready';
  }
});

execReviewPack?.addEventListener('click', async () => {
  const exportRunResult = getReviewPackExportRun();
  if (!exportRunResult?.ok) {
    if (exportActionStatus) {
      exportActionStatus.textContent = 'Run the council before exporting a review pack.';
      exportActionStatus.dataset.state = 'danger';
    }
    return;
  }
  updateDecisionActionBar('exporting');
  if (exportActionStatus) {
    exportActionStatus.textContent = 'Packaging the review pack…';
    exportActionStatus.dataset.state = 'working';
  }
  try {
    const response = await apiFetch('/api/export/review-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run: exportRunResult, narrative: lastCouncilNarrative })
    });
    if (response.pdfBase64) {
      downloadBase64(
        response.fileName || `p42-exec-review-${exportRunResult.runId || exportRunResult.case?.caseId || 'case'}.pdf`,
        response.pdfBase64,
        response.contentType || 'application/pdf'
      );
      if (exportActionStatus) {
        exportActionStatus.textContent = 'PDF review pack downloaded.';
        exportActionStatus.dataset.state = 'ready';
      }
    } else {
      downloadText(`p42-exec-review-${exportRunResult.runId || exportRunResult.case?.caseId || 'case'}.html`, buildExecReviewHtml(exportRunResult), 'text/html');
      if (exportActionStatus) {
        exportActionStatus.textContent = 'The PDF service returned no PDF. An HTML fallback was downloaded instead.';
        exportActionStatus.dataset.state = 'warning';
      }
    }
  } catch (error) {
    downloadText(`p42-exec-review-${exportRunResult.runId || exportRunResult.case?.caseId || 'case'}.html`, buildExecReviewHtml(exportRunResult), 'text/html');
    if (exportActionStatus) {
      const detail = error instanceof Error ? error.message : 'PDF generation failed';
      exportActionStatus.textContent = `PDF unavailable (${detail}). An HTML fallback was downloaded instead.`;
      exportActionStatus.dataset.state = 'warning';
    }
  } finally {
    updateDecisionActionBar('ready');
  }
});

function animateNetwork() {
  const canvas = document.querySelector('#networkCanvas');
  if (!canvas) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) {
    canvas.hidden = true;
    return;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  let animationFrame = null;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const nodes = Array.from({ length: 46 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    r: index % 9 === 0 ? 2.4 : 1.3,
    phase: Math.random() * Math.PI * 2
  }));

  function resize() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * pixelRatio;
    canvas.height = window.innerHeight * pixelRatio;
  }

  function draw(time = 0) {
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(18, 214, 161, 0.1)';
    context.fillStyle = 'rgba(18, 214, 161, 0.34)';
    const points = nodes.map((node) => ({
      x: (node.x + Math.sin(time / 9000 + node.phase) * 0.014) * width,
      y: (node.y + Math.cos(time / 11000 + node.phase) * 0.014) * height,
      r: node.r * pixelRatio
    }));
    for (let index = 0; index < points.length; index += 1) {
      for (let next = index + 1; next < points.length; next += 1) {
        const left = points[index];
        const right = points[next];
        const distance = Math.hypot(left.x - right.x, left.y - right.y);
        if (distance < 170 * pixelRatio) {
          context.globalAlpha = 1 - distance / (170 * pixelRatio);
          context.beginPath();
          context.moveTo(left.x, left.y);
          context.lineTo(right.x, right.y);
          context.stroke();
        }
      }
    }
    context.globalAlpha = 1;
    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, point.r, 0, Math.PI * 2);
      context.fill();
    }
    animationFrame = requestAnimationFrame(draw);
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      return;
    }
    if (!animationFrame) animationFrame = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', handleVisibilityChange);
  resize();
  animationFrame = requestAnimationFrame(draw);
}

activeBrowserSession = restoreBrowserSession();
demoSessionToken = activeBrowserSession?.sessionType === 'demo' ? activeBrowserSession.token : '';
pilotSessionActive = activeBrowserSession?.sessionType === 'pilot';
if (!runHistoryScope()) purgeBrowserSessionArtifacts();
completedRunHistory = loadCompletedRunHistory();
hydrateLatestCompletedRunFromHistory();
restoreChatSession();
renderRunHistorySelect();
updateChatInputCounter();
setIntelRailTab('case');
setRunMode('chat');
applyScenario(currentScenarioKey);
hydrateConfigForm();
renderPilotAccessState();
setMainSection(mainSectionFromHash(), { updateHash: false, scroll: true, refresh: false, behavior: 'auto' });
restoreEvidenceIndexFromStorage().then(() => {
  renderChatMessages();
  renderContextStrength();
  renderChatAttachments();
});
ensureDemoSession().catch(() => null).finally(() => {
  loadDeploymentStatus();
  loadReadiness();
  loadBenchmarks();
  loadAuditLog();
});
animateNetwork();
