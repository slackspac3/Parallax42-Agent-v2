'use strict';

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
const sampleRun = document.querySelector('#sampleRun');
const decisionText = document.querySelector('#decisionText');
const readinessScore = document.querySelector('#readinessScore');
const evidenceCount = document.querySelector('#evidenceCount');
const domainList = document.querySelector('#domainList');
const gapList = document.querySelector('#gapList');
const traceList = document.querySelector('#traceList');
const readinessList = document.querySelector('#readinessList');
const benchmarkSummary = document.querySelector('#benchmarkSummary');

function statusClass(value = '') {
  if (/ready|passed|applicable/i.test(value)) return 'status-ready';
  if (/conditional|confirmation|review/i.test(value)) return 'status-warning';
  return 'status-danger';
}

function renderRun(result) {
  if (!result.ok) {
    decisionText.textContent = result.message || 'Run blocked';
    readinessScore.textContent = '--';
    evidenceCount.textContent = '--';
    return;
  }

  decisionText.textContent = result.decision.recommendation;
  readinessScore.textContent = `${Math.round(result.decision.readinessScore * 100)}%`;
  evidenceCount.textContent = String(result.evidenceIds.length);

  domainList.innerHTML = result.domains.map((domain) => `
    <article class="item">
      <strong>${domain.label}</strong>
      <span class="${statusClass(domain.status)}">${domain.status.replaceAll('_', ' ')} - score ${domain.score}</span>
      <p>${domain.obligations[0]}</p>
    </article>
  `).join('');

  gapList.innerHTML = result.gaps.length
    ? result.gaps.map((gap) => `
      <article class="item">
        <strong>${gap.gap}</strong>
        <span class="${gap.severity === 'high' ? 'status-danger' : 'status-warning'}">${gap.severity}</span>
        <p>${gap.action}</p>
      </article>
    `).join('')
    : '<article class="item"><strong>No blocking gaps detected.</strong><p>Human approval is still required before relying on the decision.</p></article>';

  traceList.innerHTML = result.trace.map((event) => `
    <li>
      <div>
        <strong>${event.agent}</strong>
        <p>${event.eventType.replaceAll('_', ' ')}</p>
      </div>
    </li>
  `).join('');
}

async function runAgent(payload) {
  decisionText.textContent = 'Running...';
  const response = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  renderRun(result);
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

sampleRun.addEventListener('click', () => runAgent(sample));

async function loadReadiness() {
  const response = await fetch('/api/readiness');
  const readiness = await response.json();
  readinessList.innerHTML = Object.entries(readiness.submissionReadiness).map(([key, value]) => `
    <dt>${key.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
    <dd>${String(value).replaceAll('_', ' ')}</dd>
  `).join('');
}

async function loadBenchmarks() {
  const response = await fetch('/api/benchmarks');
  const report = await response.json();
  benchmarkSummary.innerHTML = `
    <article class="item">
      <strong>${report.summary.passed}/${report.summary.cases} cases passed</strong>
      <span class="${report.summary.failed ? 'status-danger' : 'status-ready'}">${Math.round(report.summary.passRate * 100)}% pass rate</span>
      <p>p95 local deterministic duration: ${report.summary.p95DurationMs} ms</p>
    </article>
  `;
}

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

loadReadiness();
loadBenchmarks();
runAgent(sample);
animateNetwork();
