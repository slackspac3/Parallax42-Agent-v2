'use strict';

const runtimeDefaults = window.P42_CONFIG || {};
const storageKeys = {
  mode: 'p42:api-mode',
  relayUrl: 'p42:relay-url',
  backendUrl: 'p42:backend-url'
};

const sample = {
  businessUnit: 'Group Technology Risk',
  geography: 'UAE',
  supplierName: 'Example AI SaaS',
  brief: 'Procure a critical AI SaaS supplier that processes personal data, integrates with Azure AD and ServiceNow, and supports finance reporting across the UAE.',
  documents: [
    {
      title: 'Supplier assurance summary',
      summary: 'SOC 2 summary available. No signed DPA, model-training exclusion, or continuity plan attached.'
    }
  ],
  integrations: ['Azure AD', 'ServiceNow', 'Finance reporting']
};

const form = document.querySelector('#agentForm');
const runtimeConfig = document.querySelector('#runtimeConfig');
const sampleRun = document.querySelector('#sampleRun');
const resetConfig = document.querySelector('#resetConfig');
const apiMode = document.querySelector('#apiMode');
const relayUrl = document.querySelector('#relayUrl');
const backendUrl = document.querySelector('#backendUrl');
const decisionText = document.querySelector('#decisionText');
const readinessScore = document.querySelector('#readinessScore');
const evidenceCount = document.querySelector('#evidenceCount');
const domainList = document.querySelector('#domainList');
const gapList = document.querySelector('#gapList');
const traceList = document.querySelector('#traceList');
const readinessList = document.querySelector('#readinessList');
const benchmarkSummary = document.querySelector('#benchmarkSummary');
const deploymentStatus = document.querySelector('#deploymentStatus');
const readinessJsonLink = document.querySelector('#readinessJsonLink');
const benchmarksJsonLink = document.querySelector('#benchmarksJsonLink');
const goldenDemoLink = document.querySelector('#goldenDemoLink');

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

function statusClass(value = '') {
  if (/ready|passed|applicable|healthy|ok|configured|captured/i.test(value)) return 'status-ready';
  if (/conditional|confirmation|review|partial|pending/i.test(value)) return 'status-warning';
  return 'status-danger';
}

function humanize(value = '') {
  return String(value || '').replaceAll('_', ' ');
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

function renderRun(result) {
  if (!result.ok) {
    decisionText.textContent = result.message || 'Run blocked';
    readinessScore.textContent = '--';
    evidenceCount.textContent = '--';
    domainList.innerHTML = '';
    gapList.innerHTML = '';
    traceList.innerHTML = '';
    return;
  }

  const domains = Array.isArray(result.domains) ? result.domains : [];
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const trace = Array.isArray(result.trace) ? result.trace : [];
  const evidenceIds = Array.isArray(result.evidenceIds) ? result.evidenceIds : [];

  decisionText.textContent = result.decision.recommendation;
  readinessScore.textContent = `${Math.round(result.decision.readinessScore * 100)}%`;
  evidenceCount.textContent = String(evidenceIds.length);

  domainList.innerHTML = domains.map((domain) => `
    <article class="item">
      <strong>${escapeHtml(domain.label)}</strong>
      <span class="${statusClass(domain.status)}">${escapeHtml(humanize(domain.status))} - score ${escapeHtml(domain.score)}</span>
      <p>${escapeHtml(domain.obligations?.[0] || 'Mapped obligation pending evidence review.')}</p>
    </article>
  `).join('');

  gapList.innerHTML = gaps.length
    ? gaps.map((gap) => `
      <article class="item">
        <strong>${escapeHtml(gap.gap)}</strong>
        <span class="${gap.severity === 'high' ? 'status-danger' : 'status-warning'}">${escapeHtml(gap.severity)}</span>
        <p>${escapeHtml(gap.action)}</p>
      </article>
    `).join('')
    : '<article class="item"><strong>No blocking gaps detected.</strong><p>Human approval is still required before relying on the decision.</p></article>';

  traceList.innerHTML = trace.map((event) => `
    <li>
      <div>
        <strong>${escapeHtml(event.agent)}</strong>
        <p>${escapeHtml(humanize(event.eventType))}</p>
      </div>
    </li>
  `).join('');
}

async function runAgent(payload) {
  decisionText.textContent = 'Running...';
  try {
    const result = await apiFetch('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    renderRun(result);
  } catch (error) {
    renderRun({
      ok: false,
      message: error instanceof Error ? error.message : 'Run failed'
    });
  }
}

async function loadReadiness() {
  try {
    const readiness = await apiFetch('/api/readiness');
    const inventory = readiness.submissionReadiness || {};
    readinessList.innerHTML = Object.entries(inventory).map(([key, value]) => `
      <dt>${escapeHtml(key.replace(/([A-Z])/g, ' $1').toLowerCase())}</dt>
      <dd>${escapeHtml(humanize(value))}</dd>
    `).join('');
  } catch (error) {
    readinessList.innerHTML = `
      <dt>readiness api</dt>
      <dd>${escapeHtml(error instanceof Error ? error.message : 'unavailable')}</dd>
    `;
  }
}

async function loadBenchmarks() {
  try {
    const report = await apiFetch('/api/benchmarks');
    benchmarkSummary.innerHTML = `
      <article class="item">
        <strong>${escapeHtml(report.summary.passed)}/${escapeHtml(report.summary.cases)} cases passed</strong>
        <span class="${report.summary.failed ? 'status-danger' : 'status-ready'}">${Math.round(report.summary.passRate * 100)}% pass rate</span>
        <p>p95 local deterministic duration: ${escapeHtml(report.summary.p95DurationMs)} ms</p>
      </article>
    `;
  } catch (error) {
    benchmarkSummary.innerHTML = `
      <article class="item">
        <strong>Benchmark API unavailable</strong>
        <span class="status-danger">${escapeHtml(error instanceof Error ? error.message : 'unavailable')}</span>
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
      detail: (body) => body?.status || body?.service || 'API responded'
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  runAgent({
    brief: data.get('brief'),
    businessUnit: data.get('businessUnit'),
    geography: data.get('geography'),
    documents: [{
      title: 'User supplied evidence summary',
      summary: data.get('documentSummary')
    }]
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

sampleRun.addEventListener('click', () => runAgent(sample));

function animateNetwork() {
  const canvas = document.querySelector('#networkCanvas');
  const context = canvas.getContext('2d');
  const nodes = Array.from({ length: 38 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    r: index % 7 === 0 ? 2.8 : 1.6,
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
    context.strokeStyle = 'rgba(18, 214, 161, 0.12)';
    context.fillStyle = 'rgba(18, 214, 161, 0.42)';
    const points = nodes.map((node) => ({
      x: (node.x + Math.sin(time / 9000 + node.phase) * 0.018) * width,
      y: (node.y + Math.cos(time / 11000 + node.phase) * 0.018) * height,
      r: node.r * window.devicePixelRatio
    }));
    for (let index = 0; index < points.length; index += 1) {
      for (let next = index + 1; next < points.length; next += 1) {
        const left = points[index];
        const right = points[next];
        const distance = Math.hypot(left.x - right.x, left.y - right.y);
        if (distance < 190 * window.devicePixelRatio) {
          context.globalAlpha = 1 - distance / (190 * window.devicePixelRatio);
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

hydrateConfigForm();
loadDeploymentStatus();
loadReadiness();
loadBenchmarks();
runAgent(sample);
animateNetwork();
