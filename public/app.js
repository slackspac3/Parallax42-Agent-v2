'use strict';

const runtimeDefaults = window.P42_CONFIG || {};
const storageKeys = {
  mode: 'p42:api-mode',
  relayUrl: 'p42:relay-url',
  backendUrl: 'p42:backend-url',
  evidenceIndexMeta: 'p42:evidence-index-meta'
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
  financeVendor: {
    businessUnit: 'Group Finance Transformation',
    geography: 'UAE and KSA',
    supplierName: 'Treasury Ops Platform',
    brief: 'Onboard a finance workflow vendor that handles payment approvals, exports ledger data, and requires Microsoft 365 tenant access for automated approvals.',
    documents: [
      {
        title: 'Finance controls summary',
        summary: 'Payment-control ownership is documented. Missing DPA, exit support, licensing review, and privileged access approval.'
      }
    ],
    integrations: ['Microsoft 365', 'ERP export', 'Payment approval workflow'],
    evidenceQueue: ['Payment approval matrix', 'ERP export scope', 'Tenant access request']
  },
  lowRisk: {
    businessUnit: 'Corporate Communications',
    geography: 'UAE',
    supplierName: 'Brand Asset Library',
    brief: 'Approve a low-risk brand asset library used by the communications team with no customer data, no production integration, and standard SSO access.',
    documents: [
      {
        title: 'Low-risk supplier summary',
        summary: 'DPA attached, no AI training on customer data, continuity statement attached, SSO documented, and no finance integration.'
      }
    ],
    integrations: ['SSO'],
    evidenceQueue: ['DPA', 'Continuity statement', 'SSO setup note']
  }
};

const form = document.querySelector('#agentForm');
const runtimeConfig = document.querySelector('#runtimeConfig');
const sampleRun = document.querySelector('#sampleRun');
const exportRun = document.querySelector('#exportRun');
const execReviewPack = document.querySelector('#execReviewPack');
const formRunButton = document.querySelector('#formRunButton');
const resetConfig = document.querySelector('#resetConfig');
const apiMode = document.querySelector('#apiMode');
const relayUrl = document.querySelector('#relayUrl');
const backendUrl = document.querySelector('#backendUrl');
const runModeButtons = document.querySelectorAll('[data-run-mode]');
const casePanelEyebrow = document.querySelector('#casePanelEyebrow');
const casePanelTitle = document.querySelector('#casePanelTitle');
const runwayTitle = document.querySelector('#runwayTitle');
const runwayDescription = document.querySelector('#runwayDescription');
const decisionText = document.querySelector('#decisionText');
const approvalStatus = document.querySelector('#approvalStatus');
const approvalButton = document.querySelector('#approvalButton');
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
const readinessJsonLink = document.querySelector('#readinessJsonLink');
const benchmarksJsonLink = document.querySelector('#benchmarksJsonLink');
const goldenDemoLink = document.querySelector('#goldenDemoLink');
const topHealth = document.querySelector('#topHealth');
const councilOutputTab = document.querySelector('#councilOutputTab');
const caseDraftPanel = document.querySelector('#caseDraftPanel');
const chatMessagesEl = document.querySelector('#chatMessages');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
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
let activeRunMode = 'chat';
let currentScenarioKey = 'exportControl';
let playbackTimers = [];
let uploadedEvidence = [];
let indexedEvidenceChunks = [];
let evidenceIndexMeta = {};
let chatCaseDraft = {};
let workspaceView = 'chat';
let chatMessages = [
  {
    role: 'assistant',
    text: 'Start with the supplier or workflow, geography, regulated data or assets, integrations, and evidence you already have. I will build the case, ask only for missing context, and run the workflow when ready.'
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
    runwayDescription: 'Submit the edited intake and uploaded evidence to the configured CrewAI runtime.',
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
  { id: 'intake', label: 'Intake', detail: 'listening', status: 'active' },
  { id: 'obligations', label: 'Obligations', detail: 'queued', status: 'queued' },
  { id: 'evidence', label: 'Evidence', detail: 'queued', status: 'queued' },
  { id: 'controls', label: 'Controls', detail: 'queued', status: 'queued' },
  { id: 'review', label: 'Reviewer', detail: 'queued', status: 'queued' }
];

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
    proof: 'Hash-chained append-only audit records with integrity verification',
    next: 'Back the audit path with managed durable storage for production retention.'
  },
  rbac: {
    label: 'RBAC and authentication',
    proof: 'Route policy and JWT validation are implemented with Entra-ready configuration',
    next: 'Set P42_AUTH_MODE=enforced and configure Entra issuer, audience, tenant, and JWKS.'
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
const backendParsedEvidenceExtensions = new Set(['pdf', 'docx']);
const textEvidenceSampleBytes = 180 * 1024;
const defaultUploadChunkBytes = 1024 * 1024;
const evidenceDbName = 'p42-compliance-evidence-index';
const evidenceDbVersion = 1;
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
      detail: 'Live health is captured in evidence/live-health.json; switch to relay mode for browser relay checks.'
    };
  }
  return {
    label: 'Parallax42 backend',
    url: backendHealthUrl(config),
    detail: (body) => body?.status || body?.service || body?.ok || 'Backend responded'
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const error = new Error(body?.message || body?.detail || body?.error || `Request failed: ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function apiFetch(path, options = {}) {
  return fetchJson(apiUrl(path), options);
}

function backendApiUrl(path) {
  const config = currentConfig();
  const value = path.startsWith('/') ? path : `/${path}`;
  if (config.resolvedMode === 'local') {
    return `${config.backendUrl}${value}`;
  }
  return `${config.relayUrl}/api/backend?path=${encodeURIComponent(value)}`;
}

function backendApiFetch(path, options = {}) {
  return fetchJson(backendApiUrl(path), options);
}

function statusClass(value = '') {
  if (/ready|passed|applicable|healthy|ok|configured|captured|complete/i.test(value)) return 'status-ready';
  if (/conditional|confirmation|review|partial|pending|queued/i.test(value)) return 'status-warning';
  return 'status-danger';
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

function fileExtension(fileName = '') {
  const parts = String(fileName).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanEvidenceText(value = '') {
  return String(value || '')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function yieldToBrowser() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function setAttachmentStatus(message = '', state = 'idle') {
  if (!chatAttachmentStatus) return;
  chatAttachmentStatus.textContent = message;
  chatAttachmentStatus.dataset.state = state;
}

function summarizeEvidenceText(text = '', maxLength = 720) {
  const clean = cleanEvidenceText(text);
  if (!clean) return 'No extractable text was detected.';
  return clean.length > maxLength ? `${clean.slice(0, maxLength).trim()}...` : clean;
}

function detectEvidenceSignals(text = '') {
  return evidenceSignalPatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
}

function compactJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return '{}';
  }
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

function openEvidenceDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser context.'));
      return;
    }
    const request = window.indexedDB.open(evidenceDbName, evidenceDbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('chunks')) {
        const store = db.createObjectStore('chunks', { keyPath: 'chunkId' });
        store.createIndex('caseId', 'caseId', { unique: false });
        store.createIndex('evidenceId', 'evidenceId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open evidence index.'));
  });
}

async function persistIndexedChunks(chunks = []) {
  if (!chunks.length) return;
  const db = await openEvidenceDb();
  try {
    const tx = db.transaction('chunks', 'readwrite');
    const store = tx.objectStore('chunks');
    chunks.forEach((chunk) => {
      store.put({
        ...chunk,
        caseId: chunk.metadata?.caseId || chatCaseDraft.caseId || '',
        evidenceId: chunk.evidenceId || '',
        persistedAt: new Date().toISOString()
      });
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Evidence index persistence failed.'));
      tx.onabort = () => reject(tx.error || new Error('Evidence index persistence aborted.'));
    });
  } finally {
    db.close();
  }
}

async function restoreEvidenceIndexFromStorage() {
  const meta = readJsonStorage(storageKeys.evidenceIndexMeta, {});
  if (!meta.caseId) return;
  evidenceIndexMeta = meta;
  chatCaseDraft = {
    ...chatCaseDraft,
    caseId: meta.caseId,
    indexedEvidence: meta
  };
  try {
    const db = await openEvidenceDb();
    try {
      const tx = db.transaction('chunks', 'readonly');
      const store = tx.objectStore('chunks').index('caseId');
      const request = store.getAll(meta.caseId);
      const chunks = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error('Evidence index restore failed.'));
      });
      indexedEvidenceChunks = chunks.filter((chunk) => Array.isArray(chunk.embedding)).slice(-256);
      evidenceIndexMeta = {
        ...meta,
        chunkCount: indexedEvidenceChunks.length,
        restoredAt: new Date().toISOString()
      };
      chatCaseDraft = {
        ...chatCaseDraft,
        indexedEvidence: evidenceIndexMeta
      };
    } finally {
      db.close();
    }
  } catch {
    // The active page can still index fresh evidence if persisted chunks are unavailable.
  }
}

function ensureChatCaseId() {
  if (!chatCaseDraft.caseId) {
    chatCaseDraft = {
      ...chatCaseDraft,
      caseId: `case_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    };
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
  const text = parsedDocumentText(document);
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

function mergeIndexedChunks(chunks = []) {
  const byId = new Map(indexedEvidenceChunks.map((chunk) => [chunk.chunkId, chunk]));
  chunks.forEach((chunk) => {
    if (chunk?.chunkId && Array.isArray(chunk.embedding)) {
      byId.set(chunk.chunkId, chunk);
    }
  });
  indexedEvidenceChunks = Array.from(byId.values()).slice(-256);
  evidenceIndexMeta = {
    caseId: chatCaseDraft.caseId || '',
    model: chunks[0]?.embeddingModel || evidenceIndexMeta.model || 'text-embedding-3-large',
    chunkCount: indexedEvidenceChunks.length,
    evidenceIds: unique(indexedEvidenceChunks.map((chunk) => chunk.evidenceId)),
    updatedAt: new Date().toISOString(),
    storage: 'browser_indexeddb_gateway_stateless'
  };
  writeJsonStorage(storageKeys.evidenceIndexMeta, evidenceIndexMeta);
  persistIndexedChunks(indexedEvidenceChunks).catch(() => {
    evidenceIndexMeta = {
      ...evidenceIndexMeta,
      storage: 'browser_session_gateway_stateless',
      persistenceWarning: 'IndexedDB persistence failed; retrieval remains available for this page session.'
    };
    writeJsonStorage(storageKeys.evidenceIndexMeta, evidenceIndexMeta);
  });
  chatCaseDraft = {
    ...chatCaseDraft,
    indexedEvidence: evidenceIndexMeta
  };
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
  mergeIndexedChunks(Array.isArray(result.chunks) ? result.chunks : []);
  const indexedEvidenceIds = new Set(documents.map((document) => document.evidenceId));
  items.forEach((item) => {
    if (indexedEvidenceIds.has(item.evidenceId)) {
      item.indexStatus = 'indexed';
      item.embeddingModel = result.model || evidenceIndexMeta.model;
      item.indexedAt = evidenceIndexMeta.updatedAt;
      item.indexedChunkIds = indexedEvidenceChunks
        .filter((chunk) => chunk.evidenceId === item.evidenceId)
        .map((chunk) => chunk.chunkId);
    }
  });
  return result;
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
  if (!indexedEvidenceChunks.length) return null;
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
      chunks: indexedEvidenceChunks,
      topK: 8
    })
  });
  const matches = Array.isArray(result.matches) ? result.matches : [];
  const retrievedDocs = retrievalDocumentsFromMatches(matches);
  const existingDocuments = Array.isArray(chatCaseDraft.documents) ? chatCaseDraft.documents : [];
  const nonRetrieved = existingDocuments.filter((doc) => doc.extractionStatus !== 'retrieved_chunk');
  chatCaseDraft = {
    ...chatCaseDraft,
    documents: [...nonRetrieved, ...retrievedDocs].slice(-18),
    retrievalContext: {
      query,
      model: result.model || evidenceIndexMeta.model || 'text-embedding-3-large',
      chunkCount: indexedEvidenceChunks.length,
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
  };
  return result;
}

function applyCaseAssistOutput(output = {}, offset = uploadedEvidence.length) {
  const documents = Array.isArray(output.uploaded_documents) ? output.uploaded_documents : [];
  const parsed = documents.map((document, index) => uploadedDocumentToEvidence(document, offset + index));
  if (output.extracted_case) {
    chatCaseDraft = {
      ...chatCaseDraft,
      supplierName: output.extracted_case.supplier_name || chatCaseDraft.supplierName,
      businessUnit: output.extracted_case.business_unit || chatCaseDraft.businessUnit,
      geography: output.extracted_case.geography || chatCaseDraft.geography,
      brief: output.extracted_case.service_description || output.source_summary || chatCaseDraft.brief,
      integrations: unique([
        ...(chatCaseDraft.integrations || []),
        ...(Array.isArray(output.extracted_case.integrations) ? output.extracted_case.integrations : [])
      ]),
      riskSignals: unique([
        ...(chatCaseDraft.riskSignals || []),
        ...(Array.isArray(output.evidence_checklist) ? output.evidence_checklist : []),
        ...(Array.isArray(output.missing_inputs) ? output.missing_inputs : [])
      ])
    };
  }
  return parsed;
}

async function uploadEvidenceFilesToBackend(files = []) {
  const selected = files.filter((file) => backendParsedEvidenceExtensions.has(fileExtension(file.name)));
  if (!selected.length) return [];

  const session = await backendApiFetch('/case/assist/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: chatCaseDraft.brief || 'Compliance chat evidence upload.',
      current_case: currentCaseForDocumentParser(),
      chunk_size_bytes: defaultUploadChunkBytes,
      files: selected.map((file) => ({
        file_name: file.name,
        content_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
        sha256: ''
      }))
    })
  });

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
      const response = await fetch(backendApiUrl('/case/assist/upload/chunk'), {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: form
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Chunk upload failed for ${file.name}.`);
      }
    }
  }

  await backendApiFetch('/case/assist/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_id: session.upload_id })
  });

  const startedAt = Date.now();
  let lastStatus = null;
  while (Date.now() - startedAt < 240000) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    lastStatus = await backendApiFetch(`/case/assist/upload/status?upload_id=${encodeURIComponent(session.upload_id)}`);
    if (lastStatus.status === 'failed') {
      throw new Error(lastStatus.error || 'Document parser failed.');
    }
    if (lastStatus.status === 'complete' && lastStatus.result_available) {
      const output = await backendApiFetch(`/case/assist/upload/result?upload_id=${encodeURIComponent(session.upload_id)}`);
      return applyCaseAssistOutput(output);
    }
  }
  throw new Error(lastStatus?.status ? `Document parser is still ${lastStatus.status}. Try again shortly.` : 'Document parser timed out.');
}

async function extractEvidenceFile(file, index) {
  const extension = fileExtension(file.name);
  const evidenceId = `UP-${String(index + 1).padStart(2, '0')}`;
  let extractedText = '';
  let extractionStatus = 'metadata_only';
  let sourceType = extension || file.type || 'unknown';

  if (file.type.startsWith('text/') || readableEvidenceExtensions.has(extension)) {
    extractedText = await file.slice(0, textEvidenceSampleBytes).text();
    extractionStatus = file.size > textEvidenceSampleBytes ? 'sampled_text' : 'text_extracted';
  } else {
    extractionStatus = 'binary_registered';
  }

  const summary = extractedText
    ? summarizeEvidenceText(extractedText)
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

async function ingestEvidenceFiles(files = []) {
  const selected = Array.from(files).slice(0, 8);
  if (!selected.length) return;
  const fileLabel = `${selected.length} evidence file${selected.length === 1 ? '' : 's'}`;
  evidenceIngestionStatus.textContent = `Preparing ${fileLabel}...`;
  if (activeRunMode === 'chat') {
    setAttachmentStatus(`Preparing ${fileLabel}...`, 'working');
    renderAgentActivity([
      { label: 'Evidence', detail: 'reading files', status: 'active' },
      { label: 'NLP Intake', detail: 'waiting', status: 'queued' },
      { label: 'Obligations', detail: 'queued', status: 'queued' },
      { label: 'Controls', detail: 'queued', status: 'queued' },
      { label: 'Council', detail: 'waiting', status: 'queued' }
    ]);
  }
  try {
    const offset = uploadedEvidence.length;
    const extracted = [];
    const backendFiles = selected.filter((file) => backendParsedEvidenceExtensions.has(fileExtension(file.name)));
    const browserFiles = selected.filter((file) => !backendParsedEvidenceExtensions.has(fileExtension(file.name)));

    if (backendFiles.length) {
      evidenceIngestionStatus.textContent = `Uploading ${backendFiles.length} document${backendFiles.length === 1 ? '' : 's'} to backend parser...`;
      if (activeRunMode === 'chat') {
        setAttachmentStatus('Uploading PDF/DOCX evidence to the backend document parser...', 'working');
        renderAgentActivity([
          { label: 'Evidence', detail: 'uploading', status: 'active' },
          { label: 'Parser', detail: 'queued', status: 'queued' },
          { label: 'NLP Intake', detail: 'waiting', status: 'queued' },
          { label: 'Council', detail: 'waiting', status: 'queued' }
        ]);
      }
      await yieldToBrowser();
      try {
        const parsedEvidence = await uploadEvidenceFilesToBackend(backendFiles);
        extracted.push(...parsedEvidence);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Backend parsing failed.';
        chatMessages.push({
          role: 'assistant',
          text: `I could not parse the PDF/DOCX through the backend parser: ${detail} I registered the file metadata only, so please summarize the supplier/workflow and key clauses in chat before running council.`
        });
        for (const [index, file] of backendFiles.entries()) {
          extracted.push(await extractEvidenceFile(file, offset + index));
        }
      }
    }

    for (const [index, file] of browserFiles.entries()) {
      evidenceIngestionStatus.textContent = `Reading ${index + 1}/${browserFiles.length}: ${file.name}`;
      if (activeRunMode === 'chat') {
        setAttachmentStatus(`Reading ${index + 1}/${browserFiles.length}: ${file.name}`, 'working');
      }
      await yieldToBrowser();
      extracted.push(await extractEvidenceFile(file, offset + extracted.length));
      await yieldToBrowser();
    }

    let indexResult = null;
    const indexableCount = buildEvidenceIndexDocuments(extracted).length;
    if (indexableCount) {
      evidenceIngestionStatus.textContent = `Embedding ${indexableCount} parsed evidence document${indexableCount === 1 ? '' : 's'} for retrieval...`;
      if (activeRunMode === 'chat') {
        setAttachmentStatus('Embedding parsed evidence through the shared gateway...', 'working');
        renderAgentActivity([
          { label: 'Evidence', detail: 'parsed', status: 'complete' },
          { label: 'Embeddings', detail: 'indexing', status: 'active' },
          { label: 'Retriever', detail: 'queued', status: 'queued' },
          { label: 'Council', detail: 'waiting', status: 'queued' }
        ]);
      }
      try {
        indexResult = await indexEvidenceForRetrieval(extracted);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Evidence indexing failed.';
        chatMessages.push({
          role: 'assistant',
          text: `I parsed the file, but could not index it for semantic retrieval: ${detail} I can still use the extracted summary in the case draft.`
        });
      }
    }

    uploadedEvidence = [...uploadedEvidence, ...extracted].slice(0, 12);
    evidenceIngestionStatus.textContent = `${uploadedEvidence.length} uploaded evidence file${uploadedEvidence.length === 1 ? '' : 's'} attached to next run.`;
    if (activeRunMode === 'chat') {
      syncUploadedEvidenceIntoChatDraft();
      const names = extracted.map((item) => item.title || item.fileName).join(', ');
      const parsedCount = extracted.filter((item) => item.extractionStatus !== 'binary_registered').length;
      const binaryOnlyCount = extracted.length - parsedCount;
      const signalCount = unique(extracted.flatMap((item) => item.signals || [])).length;
      const indexedCount = extracted.filter((item) => item.indexStatus === 'indexed').length;
      const chunkCount = indexResult?.chunking?.chunkCount || 0;
      chatMessages.push({
        role: 'assistant',
        text: binaryOnlyCount
          ? `Attached ${extracted.length} evidence file${extracted.length === 1 ? '' : 's'}: ${names}. ${parsedCount} parsed, ${binaryOnlyCount} registered as metadata only. Add a short description of the supplier/workflow and key clauses before running council.`
          : indexedCount
            ? `Attached, parsed, and indexed ${extracted.length} evidence file${extracted.length === 1 ? '' : 's'}: ${names}. I extracted ${signalCount} signal${signalCount === 1 ? '' : 's'} and embedded ${chunkCount || indexedEvidenceChunks.length} retrieval chunk${(chunkCount || indexedEvidenceChunks.length) === 1 ? '' : 's'} for council citations.`
            : `Attached and parsed ${extracted.length} evidence file${extracted.length === 1 ? '' : 's'}: ${names}. I extracted ${signalCount} signal${signalCount === 1 ? '' : 's'}, but semantic retrieval is not indexed yet.`
      });
      setAttachmentStatus(`${uploadedEvidence.length} file${uploadedEvidence.length === 1 ? '' : 's'} attached. ${indexedCount ? `${indexedEvidenceChunks.length} indexed chunks ready. ` : ''}${binaryOnlyCount ? 'Describe the case before running council.' : 'Continue the case or run council.'}`, 'ready');
      renderChatMessages();
      renderAgentActivity([
        { label: 'Evidence', detail: binaryOnlyCount ? 'registered' : 'parsed', status: 'complete' },
        { label: 'Embeddings', detail: indexedCount ? 'indexed' : 'not ready', status: indexedCount ? 'complete' : 'queued' },
        { label: 'Retriever', detail: indexedCount ? 'ready' : 'queued', status: indexedCount ? 'complete' : 'queued' },
        { label: 'Obligations', detail: 'queued', status: 'queued' },
        { label: 'Council', detail: 'waiting', status: 'queued' }
      ]);
    } else if (activeRunMode !== 'live') {
      setRunMode('live', { skipRender: true });
    }
    renderEvidenceQueue();
    if (activeRunMode === 'live') {
      runAgent(currentFormPayload(), { playback: true, mode: 'live' });
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

function setWorkspaceView(view = 'chat') {
  workspaceView = view === 'output' ? 'output' : 'chat';
  document.body.dataset.workspaceView = workspaceView;
  councilOutputTab?.classList.toggle('is-active', workspaceView === 'output');
  if (workspaceView === 'output' && activeRunMode !== 'chat') {
    setRunMode('chat', { skipRender: true });
  }
  if (workspaceView === 'output') {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }
}

function contextStrength(draft = chatCaseDraft) {
  const documents = Array.isArray(draft.documents) ? draft.documents : [];
  const evidenceSignals = Array.isArray(draft.evidenceSignals) ? draft.evidenceSignals : [];
  const riskSignals = Array.isArray(draft.riskSignals) ? draft.riskSignals : [];
  const integrations = Array.isArray(draft.integrations) ? draft.integrations : [];
  let score = 0;
  if (cleanEvidenceText(draft.brief).length > 32) score += 20;
  if (cleanEvidenceText(draft.businessUnit)) score += 18;
  if (cleanEvidenceText(draft.geography)) score += 16;
  if (riskSignals.length) score += Math.min(18, 8 + riskSignals.length * 4);
  if (integrations.length) score += Math.min(10, integrations.length * 5);
  if (evidenceSignals.length || documents.length) score += Math.min(28, 12 + (evidenceSignals.length + documents.length) * 4);
  if (draft.indexedEvidence?.chunkCount) score += Math.min(12, 6 + Math.round(draft.indexedEvidence.chunkCount / 8));
  if (draft.retrievalContext?.matches?.length) score += Math.min(10, 4 + draft.retrievalContext.matches.length);
  return Math.min(100, score);
}

function contextCopy(score) {
  if (score >= 82) return ['Council ready', 'Enough context is present to run the council. Extra evidence will improve citations.'];
  if (score >= 58) return ['Nearly ready', 'A few more specifics or evidence files will make the council output stronger.'];
  if (score >= 32) return ['Building context', 'The advisor has a usable case shape but still needs owner, geography, evidence, or risk detail.'];
  return ['Needs intake', 'Add scope, owner, geography, evidence, and risk signals before running council.'];
}

function renderContextStrength(draft = chatCaseDraft) {
  if (!contextStrengthBar || !contextStrengthLabel || !contextStrengthText) return;
  const score = contextStrength(draft);
  const [label, text] = contextCopy(score);
  contextStrengthLabel.textContent = `${label} · ${score}%`;
  contextStrengthText.textContent = text;
  contextStrengthBar.style.width = `${score}%`;
}

function renderAgentActivity(items = defaultAgentActivity) {
  if (!agentActivity) return;
  agentActivity.innerHTML = `
    <div class="agent-activity-header">
      <span class="eyebrow">Agent council</span>
      <strong>${items.some((item) => item.status === 'active') ? 'Working in the background' : 'Ready when context is strong'}</strong>
    </div>
    <div class="agent-orbit">
      ${items.map((item, index) => `
        <article class="agent-node is-${escapeHtml(item.status || 'queued')}" style="--node-index: ${index}">
          <span></span>
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(item.detail || item.status || 'queued')}</small>
        </article>
      `).join('')}
    </div>
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
      ${item.indexStatus === 'indexed' ? '<em>indexed</em>' : item.signals?.length ? `<em>${escapeHtml(item.signals.slice(0, 2).join(', '))}</em>` : ''}
    </span>
  `).join('');
}

function syncUploadedEvidenceIntoChatDraft() {
  if (!uploadedEvidence.length) return;
  const existingDocuments = Array.isArray(chatCaseDraft.documents) ? chatCaseDraft.documents : [];
  const byId = new Map(existingDocuments.map((doc) => [doc.evidenceId || doc.title, doc]));
  uploadedEvidence.forEach((doc) => byId.set(doc.evidenceId || doc.title, doc));
  const evidenceSignals = unique([
    ...(chatCaseDraft.evidenceSignals || []),
    ...uploadedEvidence.flatMap((doc) => doc.signals || [])
  ]);
  chatCaseDraft = {
    ...chatCaseDraft,
    documents: Array.from(byId.values()).slice(-12),
    evidenceSignals
  };
}

function renderModeIdle(mode = activeRunMode) {
  const copy = runModeCopy[mode] || runModeCopy.demo;
  lastRun = lastRuns[mode];
  if (lastRun?.ok) {
    renderRun(lastRun);
    if (mode === 'chat') renderChatMessages();
    return;
  }
  decisionText.textContent = copy.waitingDecision;
  approvalStatus.textContent = copy.waitingApproval;
  approvalButton.textContent = 'Approval locked';
  approvalButton.disabled = true;
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
  domainList.innerHTML = '<article class="empty-row">Domain coverage appears after the run starts.</article>';
  gapList.innerHTML = '<article class="empty-row">Blocking gaps appear after control analysis completes.</article>';
  traceList.innerHTML = '';
  specialistList.innerHTML = '';
  citationList.innerHTML = '<article class="empty-row">Citations appear after evidence is mapped.</article>';
  artifactPreview.innerHTML = `
    <div class="artifact-header">
      <span class="eyebrow">waiting</span>
      <strong>${escapeHtml(mode === 'chat' ? 'chat session' : mode === 'demo' ? 'demo replay' : 'live case')}</strong>
    </div>
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

function setRunMode(mode = 'demo', options = {}) {
  activeRunMode = ['demo', 'live', 'chat'].includes(mode) ? mode : 'demo';
  const copy = runModeCopy[activeRunMode];
  if (activeRunMode !== 'chat') {
    setWorkspaceView('chat');
  }
  document.body.dataset.runMode = activeRunMode;
  runModeButtons.forEach((button) => {
    const selected = button.dataset.runMode === activeRunMode;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
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
    documents: activeRunMode === 'live' ? [manualDocument, ...uploadedEvidence] : [manualDocument],
    integrations: scenario.integrations
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
  const integrations = Array.isArray(draft.integrations) ? draft.integrations : [];
  const evidenceSignals = Array.isArray(draft.evidenceSignals) ? draft.evidenceSignals : [];
  const riskSignals = Array.isArray(draft.riskSignals) ? draft.riskSignals : [];
  const pills = [...riskSignals, ...evidenceSignals, ...integrations].slice(0, 8);
  const indexedLabel = draft.indexedEvidence?.chunkCount
    ? `${draft.indexedEvidence.chunkCount} indexed chunks`
    : '';
  caseDraftPanel.innerHTML = `
    <div class="case-draft-header">
      <span class="eyebrow">working draft</span>
      <strong>${escapeHtml(draft.supplierName || 'New compliance case')}</strong>
    </div>
    <div class="draft-grid">
      <span>Owner</span><b>${escapeHtml(draft.businessUnit || 'needed')}</b>
      <span>Geography</span><b>${escapeHtml(draft.geography || 'needed')}</b>
      <span>Integrations</span><b>${escapeHtml(integrations.length ? integrations.join(', ') : 'none yet')}</b>
      <span>Evidence</span><b>${escapeHtml([evidenceSignals.length ? evidenceSignals.join(', ') : '', indexedLabel].filter(Boolean).join(' · ') || 'needed')}</b>
    </div>
    <div class="draft-pills">
      ${pills.length ? pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join('') : '<span>awaiting context</span>'}
    </div>
  `;
}

function renderChatMessages() {
  renderCaseDraft();
  renderContextStrength();
  renderChatAttachments();
  chatMessagesEl.innerHTML = chatMessages.map((message) => `
    <article class="chat-message is-${escapeHtml(message.role)} ${message.pending ? 'is-pending' : ''}">
      <strong>${message.role === 'user' ? 'You' : 'Agent'}</strong>
      <p>${escapeHtml(message.text)}</p>
    </article>
  `).join('');
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function hasChatContext() {
  return Boolean(
    cleanEvidenceText(chatCaseDraft.brief)
    || chatCaseDraft.riskSignals?.length
    || chatCaseDraft.evidenceSignals?.length
    || chatCaseDraft.integrations?.length
    || chatCaseDraft.documents?.length
    || chatCaseDraft.indexedEvidence?.chunkCount
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
  const hasIndexedEvidence = Boolean(chatCaseDraft.indexedEvidence?.chunkCount || indexedEvidenceChunks.length);
  const guidance = uploadedEvidence.length
    ? hasBinaryOnlyEvidence
      ? 'I have the file registered, but I still need the case context because the document text was not parsed. Tell me the supplier or workflow, geography, data/assets, integrations, and the key clauses or missing evidence you want reviewed.'
      : hasIndexedEvidence
        ? 'I parsed and indexed the attached evidence. Tell me the supplier or workflow, geography, data/assets, integrations, and what decision you need, then I can retrieve citations and run council.'
        : 'I parsed the attached evidence. Tell me the supplier or workflow, geography, data/assets, integrations, and what decision you need, then I can run council.'
    : 'Start with the supplier or workflow, geography, data handled, integrations, and evidence already available. I will ask only for the fields needed to run the workflow.';
  if (lastMessage !== guidance) {
    chatMessages.push({ role: 'assistant', text: guidance });
  }
  renderChatMessages();
  renderIntakePromptState();
  window.setTimeout(renderIntakePromptState, 0);
  chatInput.focus();
}

function renderConversationState(result = {}) {
  const actions = Array.isArray(result.actions) ? result.actions : [];
  const completeActions = actions.filter((action) => action.status === 'complete' || action.status === 'not_required').length;
  const progress = actions.length ? Math.min(82, 18 + Math.round((completeActions / actions.length) * 62)) : 18;
  const questions = Array.isArray(result.questions) ? result.questions : [];
  const missing = Array.isArray(result.missingFields) ? result.missingFields : [];
  const draft = result.caseDraft || chatCaseDraft || {};
  const evidenceSignals = Array.isArray(draft.evidenceSignals) ? draft.evidenceSignals : [];
  const riskSignals = Array.isArray(draft.riskSignals) ? draft.riskSignals : [];
  const retrievalMatches = Array.isArray(draft.retrievalContext?.matches) ? draft.retrievalContext.matches : [];

  decisionText.textContent = result.readyToRun ? 'Ready to execute' : 'Building case draft';
  approvalStatus.textContent = result.readyToRun
    ? 'The next chat turn can execute the CrewAI workflow under human approval.'
    : 'The agent is collecting required context before producing a decision.';
  approvalButton.textContent = 'Approval locked';
  approvalButton.disabled = true;
  runtimeText.textContent = 'NLP case builder';
  readinessScore.textContent = result.readyToRun ? 'ready' : 'draft';
  evidenceCount.textContent = String((draft.documents || []).length || evidenceSignals.length || 0);
  gapCount.textContent = String(missing.length);
  flowProgress.style.width = `${progress}%`;
  stageKicker.textContent = 'NLP intake';
  stageStatus.textContent = result.readyToRun ? 'Ready for workflow' : 'Context gathering';
  stageOutput.textContent = questions.length
    ? questions.join(' ')
    : 'The case draft has enough structure to run, or you can add more evidence first.';
  renderContextStrength(draft);
  renderAgentActivity(actions.map((action) => ({
    id: action.id,
    label: titleCase(action.id).replace(/^Nlp\b/, 'NLP'),
    detail: humanize(action.status),
    status: action.status === 'waiting' ? 'active' : action.status === 'complete' || action.status === 'not_required' ? 'complete' : 'queued'
  })));

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
    : draft.documents?.length
      ? draft.documents.map((doc) => `
      <article class="citation-row">
        <div>
          <span>${escapeHtml(doc.evidenceId || 'CHAT')} · ${escapeHtml(doc.extractionStatus || 'nlp')}</span>
          <strong>${escapeHtml(doc.title || 'Conversational evidence')}</strong>
          <p>${escapeHtml(doc.excerpt || doc.summary || 'Evidence captured from chat.')}</p>
        </div>
        <small>${escapeHtml(doc.signals?.join(', ') || 'pending signal')}</small>
      </article>
    `).join('')
      : '<article class="empty-row">Evidence citations appear as chat context is captured.</article>';
  artifactPreview.innerHTML = `
    <div class="artifact-header">
      <span class="eyebrow">conversation</span>
      <strong>${escapeHtml(draft.supplierName || 'case draft')}</strong>
    </div>
    <div class="artifact-grid">
      <span>NLP intent</span><b>${escapeHtml(result.nlp?.intent || 'case context')}</b>
      <span>Confidence</span><b>${escapeHtml(result.nlp?.confidence || '--')}</b>
      <span>Missing</span><b>${escapeHtml(missing.length ? missing.join(', ') : 'none')}</b>
      <span>Ready</span><b>${escapeHtml(result.readyToRun ? 'yes' : 'not yet')}</b>
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

function renderRun(result, options = {}) {
  const stages = getStages(result);
  const stageIndex = Number.isFinite(options.stageIndex) ? options.stageIndex : stages.length - 1;
  const activeIndex = Number.isFinite(options.activeIndex) ? options.activeIndex : null;
  const finalVisible = options.finalVisible !== false;

  if (!result.ok) {
    lastRun = result;
    lastRuns[activeRunMode] = result;
    decisionText.textContent = result.message || 'Run blocked';
    approvalStatus.textContent = 'Case could not be evaluated.';
    approvalButton.textContent = 'Approval locked';
    approvalButton.disabled = true;
    runtimeText.textContent = '--';
    readinessScore.textContent = '--';
    evidenceCount.textContent = '--';
    gapCount.textContent = '--';
    domainList.innerHTML = '';
    gapList.innerHTML = '';
    traceList.innerHTML = '';
    specialistList.innerHTML = '';
    artifactPreview.innerHTML = '';
    citationList.innerHTML = '';
    flowProgress.style.width = '0%';
    return;
  }

  if (finalVisible) {
    lastRun = result;
    lastRuns[activeRunMode] = result;
  }

  const domains = Array.isArray(result.domains) ? result.domains : [];
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const trace = Array.isArray(result.trace) ? result.trace : [];
  const evidenceIds = Array.isArray(result.evidenceIds) ? result.evidenceIds : [];
  const progress = Math.max(0, Math.min(100, Math.round(((stageIndex + 1) / stages.length) * 100)));
  const currentStage = stages[Math.max(0, Math.min(stages.length - 1, activeIndex ?? stageIndex))];

  decisionText.textContent = finalVisible ? result.decision.recommendation : 'CrewAI review in progress';
  approvalStatus.textContent = finalVisible
    ? 'Human approval remains required before operational use.'
    : 'Specialists are building the audit pack.';
  approvalButton.textContent = finalVisible ? 'Human approval required' : 'Review in progress';
  approvalButton.disabled = true;
  runtimeText.textContent = formatRuntime(result.runtime?.actualRuntime || result.mode || 'unknown');
  readinessScore.textContent = finalVisible
    ? `${Math.round(result.decision.readinessScore * 100)}%`
    : `${Math.max(8, Math.round((progress / 100) * result.decision.readinessScore * 100))}%`;
  evidenceCount.textContent = stageIndex >= 2 || finalVisible ? String(evidenceIds.length) : 'mapping';
  gapCount.textContent = stageIndex >= 3 || finalVisible ? String(gaps.length) : '--';
  flowProgress.style.width = `${progress}%`;
  stageKicker.textContent = finalVisible ? 'Audit pack ready' : `Stage ${Math.max(1, stageIndex + 1)} of ${stages.length}`;
  stageStatus.textContent = currentStage ? (agentLabels[currentStage.agent] || currentStage.role || titleCase(currentStage.id)) : 'Ready';
  stageOutput.textContent = currentStage ? stageNarrative(currentStage, result) : 'Select a scenario or run the golden compliance case.';
  renderAgentActivity(stages.slice(0, 5).map((stage, index) => ({
    id: stage.id,
    label: agentLabels[stage.agent] || stage.role || titleCase(stage.id),
    detail: finalVisible || index <= stageIndex ? 'complete' : index === activeIndex ? 'working' : 'queued',
    status: finalVisible || index <= stageIndex ? 'complete' : index === activeIndex ? 'active' : 'queued'
  })));

  renderSpecialists(result, { stageIndex, activeIndex, finalVisible });
  renderEvidence(result, { stageIndex, finalVisible });
  renderCitations(result, { stageIndex, finalVisible });
  renderTrace(trace, stages, { stageIndex, finalVisible });
  renderArtifactPreview(result, { finalVisible });
  if (finalVisible && activeRunMode === 'chat') setWorkspaceView('output');
}

function renderSpecialists(result, options = {}) {
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
        <span class="${statusClass(domain.status)}">${escapeHtml(humanize(domain.status))} · ${escapeHtml(domain.score)}</span>
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
    const signals = Array.isArray(doc.signals) && doc.signals.length
      ? doc.signals.join(', ')
      : doc.score ? `retrieval score ${Number(doc.score || 0).toFixed(2)}` : 'No strong signal detected';
    return `
      <article class="citation-row ${doc.extractionStatus === 'binary_registered' ? 'needs-extraction' : ''} ${doc.extractionStatus === 'retrieved_chunk' || doc.sourceType === 'semantic_retrieval' ? 'is-indexed' : ''}">
        <div>
          <span>${escapeHtml(evidenceId)} · ${escapeHtml(doc.citationId || doc.chunkId || doc.extractionStatus || 'attached')}</span>
          <strong>${escapeHtml(doc.title || doc.fileName || `Evidence ${index + 1}`)}</strong>
          <p>${escapeHtml(doc.text || doc.excerpt || doc.summary || 'Evidence attached without extracted text.')}</p>
        </div>
        <small>${escapeHtml(signals)}</small>
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

function renderArtifactPreview(result, options = {}) {
  const domains = Array.isArray(result.domains) ? result.domains : [];
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const evidenceIds = Array.isArray(result.evidenceIds) ? result.evidenceIds : [];
  const documents = evidenceDocuments(result);
  const citations = Array.isArray(result.citations) ? result.citations : [];
  const retrieval = result.retrievalContext || {};
  const liveUploadCount = documents.filter((doc) => /^UP-/i.test(doc.evidenceId || '')).length;
  const extractedCount = documents.filter((doc) => /text|pdf|manual/i.test(doc.extractionStatus || '')).length;
  const ready = options.finalVisible;
  artifactPreview.innerHTML = `
    <div class="artifact-header">
      <span class="eyebrow">${ready ? 'export ready' : 'assembling'}</span>
      <strong>${escapeHtml(result.case?.caseId || 'case pending')}</strong>
    </div>
    <div class="artifact-grid">
      <span>Decision</span><b>${escapeHtml(ready ? result.decision.recommendation : 'pending final review')}</b>
      <span>Domains</span><b>${escapeHtml(domains.length)}</b>
      <span>Gaps</span><b>${escapeHtml(gaps.length)}</b>
      <span>Evidence IDs</span><b>${escapeHtml(evidenceIds.length)}</b>
      <span>Evidence docs</span><b>${escapeHtml(documents.length)}</b>
      <span>Citations</span><b>${escapeHtml(citations.length)}</b>
      <span>Retrieved chunks</span><b>${escapeHtml(retrieval.matchCount || retrieval.matches?.length || 0)}</b>
      <span>Live uploads</span><b>${escapeHtml(liveUploadCount)}</b>
      <span>Extracted docs</span><b>${escapeHtml(extractedCount)}</b>
      <span>Runtime</span><b>${escapeHtml(formatRuntime(result.runtime?.actualRuntime || result.mode || 'unknown'))}</b>
    </div>
    <pre>{
  "humanApprovalRequired": true,
  "deterministicGuardrail": true,
  "exportStatus": "${ready ? 'ready' : 'building'}"
}</pre>
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
    '',
    '## Decision',
    '',
    `Recommendation: ${decision.recommendation || 'Pending review'}`,
    `Readiness: ${readiness}`,
    `Human approval required: yes`,
    `Runtime: ${formatRuntime(runtime.actualRuntime || result.mode || 'unknown')}`,
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
  lines.push(`Evidence IDs: ${evidenceIds.join(', ') || 'none'}`);
  lines.push(`Indexed retrieval chunks searched: ${retrieval.chunkCount || 0}`);
  lines.push(`Semantic matches used: ${retrieval.matchCount || retrieval.matches?.length || 0}`);
  if (documents.length) {
    documents.forEach((doc, index) => {
      lines.push(`${index + 1}. ${doc.evidenceId || `DOC-${index + 1}`} - ${doc.title || doc.fileName || 'Evidence document'}`);
      lines.push(`   Extraction: ${doc.extractionStatus || 'attached'}`);
      lines.push(`   Signals: ${(doc.signals || []).join(', ') || 'none detected'}`);
    });
  } else {
    lines.push('No source documents were attached to the run.');
  }

  lines.push('', '## Evidence Citations', '');
  if (citations.length) {
    citations.forEach((citation, index) => {
      lines.push(`${index + 1}. ${citation.evidenceId || `CITE-${index + 1}`} - ${citation.title || 'Evidence citation'}`);
      lines.push(`   Source: ${citation.citationId || citation.sourceType || 'attached evidence'}`);
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

function playResult(result) {
  clearPlaybackTimers();
  const stages = getStages(result);
  renderRun(result, { stageIndex: -1, activeIndex: 0, finalVisible: false });
  stages.forEach((stage, index) => {
    playbackTimers.push(window.setTimeout(() => {
      renderRun(result, { stageIndex: index, activeIndex: index, finalVisible: false });
    }, 420 + (index * 520)));
  });
  playbackTimers.push(window.setTimeout(() => {
    renderRun(result, { stageIndex: stages.length - 1, finalVisible: true });
  }, 620 + (stages.length * 520)));
}

async function runAgent(payload, options = {}) {
  const runMode = options.mode || activeRunMode;
  clearPlaybackTimers();
  sampleRun.disabled = true;
  sampleRun.textContent = 'Running';
  decisionText.textContent = 'CrewAI review in progress';
  approvalStatus.textContent = 'Submitting case to the agent runtime.';
  stageKicker.textContent = 'Dispatching';
  stageStatus.textContent = 'Runtime Router';
  stageOutput.textContent = 'Selecting the configured orchestration path.';
  flowProgress.style.width = '4%';
  renderAgentActivity([
    { label: 'Router', detail: 'selecting runtime', status: 'active' },
    { label: 'Intake', detail: 'queued', status: 'queued' },
    { label: 'Obligations', detail: 'queued', status: 'queued' },
    { label: 'Evidence', detail: 'queued', status: 'queued' },
    { label: 'Review', detail: 'queued', status: 'queued' }
  ]);
  try {
    const result = await apiFetch('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (runMode !== activeRunMode) {
      lastRuns[runMode] = result;
      return result;
    }
    if (options.playback) {
      playResult(result);
    } else {
      renderRun(result);
    }
    return result;
  } catch (error) {
    const failure = {
      ok: false,
      message: error instanceof Error ? error.message : 'Run failed'
    };
    if (runMode !== activeRunMode) {
      lastRuns[runMode] = failure;
      return failure;
    }
    renderRun(failure);
    return failure;
  } finally {
    sampleRun.disabled = false;
    sampleRun.textContent = runModeCopy[activeRunMode].actionButton;
  }
}

async function submitChatMessage(rawMessage = '', options = {}) {
  const message = cleanEvidenceText(rawMessage || (options.forceRun ? 'run it' : ''));
  if (!message) {
    promptForChatContext();
    return null;
  }
  if (options.forceRun && !hasChatContext() && /^run it$/i.test(message)) {
    promptForChatContext();
    return null;
  }
  setRunMode('chat', { skipRender: true });
  clearPlaybackTimers();
  syncUploadedEvidenceIntoChatDraft();
  chatMessages.push({ role: 'user', text: message });
  const pendingMessage = {
    role: 'assistant',
    text: options.forceRun
      ? 'Checking the case draft and executing the workflow if the required context is present...'
      : 'Reading the request, updating the case draft, and planning the next agent step...',
    pending: true
  };
  chatMessages.push(pendingMessage);
  renderChatMessages();
  chatInput.value = '';
  sampleRun.disabled = true;
  chatRunNow.disabled = true;
  chatForm.querySelector('button[type="submit"]').disabled = true;
  flowProgress.style.width = '12%';
  stageKicker.textContent = 'NLP intake';
  stageStatus.textContent = 'Parsing message';
  stageOutput.textContent = 'Extracting case fields, risk signals, integrations, and evidence clues.';
  renderAgentActivity([
    { label: 'NLP Intake', detail: 'reading', status: 'active' },
    { label: 'Context', detail: 'merging', status: 'active' },
    { label: 'Obligations', detail: 'queued', status: 'queued' },
    { label: 'Evidence', detail: uploadedEvidence.length ? 'attached' : 'queued', status: uploadedEvidence.length ? 'complete' : 'queued' },
    { label: 'Council', detail: options.forceRun ? 'preparing' : 'waiting', status: options.forceRun ? 'active' : 'queued' }
  ]);

  try {
    if (options.forceRun && indexedEvidenceChunks.length) {
      pendingMessage.text = 'Retrieving the most relevant evidence chunks before council execution...';
      flowProgress.style.width = '24%';
      stageKicker.textContent = 'Semantic retrieval';
      stageStatus.textContent = 'Searching indexed evidence';
      stageOutput.textContent = 'Using text-embedding-3-large through the shared gateway to select citation-ready clauses.';
      renderChatMessages();
      renderAgentActivity([
        { label: 'NLP Intake', detail: 'ready', status: 'complete' },
        { label: 'Embeddings', detail: `${indexedEvidenceChunks.length} chunks`, status: 'complete' },
        { label: 'Retriever', detail: 'searching', status: 'active' },
        { label: 'Council', detail: 'queued', status: 'queued' },
        { label: 'Reviewer', detail: 'queued', status: 'queued' }
      ]);
      try {
        const retrieval = await retrieveIndexedEvidenceForCouncil();
        const matchCount = retrieval?.matches?.length || 0;
        pendingMessage.text = matchCount
          ? `Retrieved ${matchCount} evidence match${matchCount === 1 ? '' : 'es'}. Running the council with citations now...`
          : 'No semantic evidence matches were returned. Running the council with parsed evidence summaries...';
        renderChatMessages();
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Evidence retrieval failed.';
        chatCaseDraft = {
          ...chatCaseDraft,
          retrievalContext: {
            query: retrievalQueryFromDraft(),
            model: evidenceIndexMeta.model || 'text-embedding-3-large',
            chunkCount: indexedEvidenceChunks.length,
            matchCount: 0,
            error: detail,
            matches: []
          }
        };
        pendingMessage.text = `Semantic retrieval failed: ${detail} Running the council with parsed evidence summaries.`;
        renderChatMessages();
      }
    }
    const result = await apiFetch('/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        caseDraft: chatCaseDraft,
        uploadedEvidence,
        forceRun: Boolean(options.forceRun)
      })
    });
    chatCaseDraft = result.caseDraft || chatCaseDraft;
    pendingMessage.pending = false;
    pendingMessage.text = result.reply || 'The conversation step completed.';
    renderChatMessages();
    if (result.run?.ok) {
      lastRuns.chat = result.run;
      lastRun = result.run;
      playResult(result.run);
    } else {
      renderConversationState(result);
    }
    return result;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Conversation failed.';
    pendingMessage.pending = false;
    pendingMessage.text = `I could not process that turn: ${messageText}`;
    renderChatMessages();
    renderRun({ ok: false, message: messageText });
    return null;
  } finally {
    sampleRun.disabled = false;
    chatRunNow.disabled = false;
    chatForm.querySelector('button[type="submit"]').disabled = false;
    sampleRun.textContent = runModeCopy.chat.actionButton;
  }
}

async function loadReadiness() {
  try {
    const readiness = await apiFetch('/api/readiness');
    const inventory = readiness.submissionReadiness || {};
    readinessList.innerHTML = Object.entries(inventory).map(([key, value]) => `
      <article class="hardening-item">
        <span class="${statusClass(value)}">${escapeHtml(humanize(value))}</span>
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

function renderStatusCards(results) {
  deploymentStatus.innerHTML = results.map((result) => `
    <article class="status-card">
      <strong>
        ${escapeHtml(result.label)}
        <span class="${statusClass(result.status)}">${escapeHtml(result.status)}</span>
      </strong>
      <code>${escapeHtml(result.url)}</code>
      <p>${escapeHtml(result.detail)}</p>
    </article>
  `).join('');
  const unhealthy = results.some((result) => result.status === 'unavailable');
  topHealth.textContent = unhealthy ? 'degraded' : 'live';
  topHealth.className = unhealthy ? 'status-warning' : 'status-ready';
}

async function loadDeploymentStatus() {
  const config = currentConfig();
  const backendCheck = backendStatusCheck(config);
  updateJsonLinks();
  renderStatusCards([
    { label: 'Compliance API', status: 'checking', url: apiUrl('/api/health'), detail: 'Checking runnable agent API.' },
    { label: 'Parallax42 backend', status: backendCheck.skipFetch ? backendCheck.status : 'checking', url: backendCheck.url, detail: backendCheck.skipFetch ? backendCheck.detail : 'Checking live backend proof.' },
    { label: 'Compass gateway', status: 'checking', url: config.gatewayHealthUrl, detail: 'Checking model gateway boundary.' }
  ]);

  const checks = [
    {
      label: `Compliance API (${config.resolvedMode})`,
      url: apiUrl('/api/health'),
      detail: (body) => body?.agentRuntime?.configuredRuntime
        ? `${body.service} using ${formatRuntime(body.agentRuntime.configuredRuntime)}`
        : body?.status || body?.service || 'API responded'
    },
    backendCheck,
    {
      label: 'Compass gateway',
      url: config.gatewayHealthUrl,
      detail: (body) => body?.status || body?.mode || body?.service || 'Gateway responded'
    }
  ];

  const results = await Promise.all(checks.map(async (check) => {
    if (check.skipFetch) {
      return {
        label: check.label,
        url: check.url,
        status: check.status,
        detail: check.detail
      };
    }
    try {
      const body = await fetchJson(check.url);
      return {
        label: check.label,
        url: check.url,
        status: 'healthy',
        detail: check.detail(body)
      };
    } catch (error) {
      return {
        label: check.label,
        url: check.url,
        status: 'unavailable',
        detail: error instanceof Error ? error.message : 'Request failed'
      };
    }
  }));

  renderStatusCards(results);
}

runModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.runMode === 'chat') setWorkspaceView('chat');
    setRunMode(button.dataset.runMode);
  });
});

councilOutputTab?.addEventListener('click', () => {
  setRunMode('chat', { skipRender: true });
  setWorkspaceView('output');
  if (lastRuns.chat?.ok) {
    renderRun(lastRuns.chat);
  }
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

chatRunNow.addEventListener('click', () => {
  submitChatMessage(chatInput.value || 'run it', { forceRun: true });
});

chatPromptButtons.forEach((button) => {
  button.addEventListener('click', () => {
    submitChatMessage(button.dataset.chatPrompt || '');
  });
});

runtimeConfig.addEventListener('submit', (event) => {
  event.preventDefault();
  writeStorage(storageKeys.mode, apiMode.value);
  writeStorage(storageKeys.relayUrl, stripTrailingSlash(relayUrl.value));
  writeStorage(storageKeys.backendUrl, stripTrailingSlash(backendUrl.value));
  loadDeploymentStatus();
  loadReadiness();
  loadBenchmarks();
});

resetConfig.addEventListener('click', () => {
  writeStorage(storageKeys.mode, '');
  writeStorage(storageKeys.relayUrl, '');
  writeStorage(storageKeys.backendUrl, '');
  hydrateConfigForm();
  loadDeploymentStatus();
  loadReadiness();
  loadBenchmarks();
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
    exportRun.textContent = activeRunMode === 'chat' ? 'Run workflow first' : activeRunMode === 'live' ? 'Run live first' : 'Run demo first';
    window.setTimeout(() => {
      exportRun.textContent = 'Export pack';
    }, 1400);
    return;
  }
  downloadJson(`p42-audit-pack-${lastRun.case?.caseId || 'demo'}.json`, {
    exportedAt: new Date().toISOString(),
    service: 'parallax42-compliance-intelligence-agent',
    evidenceManifest: evidenceDocuments(lastRun),
    run: lastRun
  });
});

execReviewPack?.addEventListener('click', () => {
  if (!lastRun?.ok) {
    execReviewPack.textContent = 'Run council first';
    window.setTimeout(() => {
      execReviewPack.textContent = 'Exec review pack';
    }, 1400);
    return;
  }
  downloadText(`p42-exec-review-${lastRun.case?.caseId || 'case'}.md`, buildExecReviewPack(lastRun));
});

function animateNetwork() {
  const canvas = document.querySelector('#networkCanvas');
  const context = canvas.getContext('2d');
  const nodes = Array.from({ length: 46 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    r: index % 9 === 0 ? 2.4 : 1.3,
    phase: Math.random() * Math.PI * 2
  }));

  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
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
      r: node.r * window.devicePixelRatio
    }));
    for (let index = 0; index < points.length; index += 1) {
      for (let next = index + 1; next < points.length; next += 1) {
        const left = points[index];
        const right = points[next];
        const distance = Math.hypot(left.x - right.x, left.y - right.y);
        if (distance < 170 * window.devicePixelRatio) {
          context.globalAlpha = 1 - distance / (170 * window.devicePixelRatio);
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
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
}

setRunMode('chat');
applyScenario(currentScenarioKey);
hydrateConfigForm();
restoreEvidenceIndexFromStorage().then(() => {
  renderChatMessages();
  renderContextStrength();
  renderChatAttachments();
});
loadDeploymentStatus();
loadReadiness();
loadBenchmarks();
animateNetwork();
