'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const { runAgentWithRuntime, runtimeHealth } = require('./lib/agentRuntime');
const { appendAuditRecord, auditStoreHealth, readRecentAuditRecords, verifyAuditChain } = require('./lib/auditStore');
const { runBenchmark } = require('./lib/benchmarkSuite');
const { getReadinessInventory } = require('./lib/complianceAgent');
const { buildGoldenWorkflowRun } = require('./lib/goldenWorkflow');
const { readJsonBody, writeJson } = require('./lib/http');
const { authHealth, authorizeRequest } = require('./lib/rbac');

const PORT = Number(process.env.PORT || 3020);
const PUBLIC_ROOT = path.join(__dirname, 'public');

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function serveStatic(res, pathname) {
  const relative = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_ROOT, relative));
  if (!filePath.startsWith(PUBLIC_ROOT)) {
    writeJson(res, 403, { error: 'Forbidden' });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      writeJson(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType(filePath),
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      writeJson(res, 200, {
        ok: true,
        service: 'parallax42-compliance-intelligence-agent',
        mode: process.env.AGENT_MODE || 'crewai_flow',
        agentRuntime: runtimeHealth(),
        auth: authHealth(),
        audit: {
          store: auditStoreHealth(),
          integrity: verifyAuditChain()
        },
        linkedBackend: process.env.PARALLAX42_BACKEND_URL || 'https://api.parallax42.bhavukarora.com'
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/readiness') {
      const auth = await authorizeRequest(req, 'readiness:read');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      writeJson(res, 200, getReadinessInventory());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/benchmarks') {
      const auth = await authorizeRequest(req, 'benchmarks:read');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      writeJson(res, 200, runBenchmark());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/demo/golden') {
      const auth = await authorizeRequest(req, 'demo:read');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      writeJson(res, 200, buildGoldenWorkflowRun({ mode: 'local_golden_demo' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/audit/recent') {
      const auth = await authorizeRequest(req, 'audit:read');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      writeJson(res, 200, {
        integrity: verifyAuditChain(),
        records: readRecentAuditRecords(Number(url.searchParams.get('limit') || 25))
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/agent/run') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req);
      const result = runAgentWithRuntime(body, {
        runtime: req.headers['x-agent-runtime'] || body.runtime
      });
      appendAuditRecord({
        actor: auth.actor,
        caseId: result.case?.caseId,
        status: result.ok ? 'completed' : 'blocked',
        summary: result.ok ? result.decision.recommendation : result.message,
        payload: {
          auth: {
            policy: auth.policy,
            roles: auth.actor.roles,
            authenticated: auth.actor.authenticated
          },
          decision: result.decision,
          evidenceIds: result.evidenceIds,
          gapCount: result.gaps?.length || 0,
          traceEventCount: result.trace?.length || 0,
          runtime: result.runtime
        }
      });
      writeJson(res, result.ok ? 200 : 400, result);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(res, url.pathname);
      return;
    }

    writeJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    writeJson(res, 500, {
      error: error instanceof Error ? error.message : String(error || 'Unknown error')
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`Compliance Intelligence Agent listening on http://127.0.0.1:${PORT}\n`);
});
