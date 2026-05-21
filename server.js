'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const { runtimeHealth } = require('./lib/agentRuntime');
const { buildFeatureStatus, updateFeatureFlags } = require('./lib/adminFeatureFlags');
const { buildAdminStatus } = require('./lib/adminStatus');
const { appendAuditRecord, auditStoreHealth, readRecentAuditRecords, verifyAuditChain } = require('./lib/auditStore');
const { runBenchmark } = require('./lib/benchmarkSuite');
const { gatewayHealth } = require('./lib/compassGatewayClient');
const { getReadinessInventory } = require('./lib/complianceAgent');
const { evidenceVectorStoreHealth, runQdrantSmokeTest } = require('./lib/evidenceVectorStore');
const { buildGoldenWorkflowRun } = require('./lib/goldenWorkflow');
const { governanceReferenceHealth, indexGovernanceReference, searchGovernanceReferences } = require('./lib/governanceReferenceStore');
const { readJsonBody, writeJson } = require('./lib/http');
const {
  handleAgentRun,
  handleConversation,
  handleEvidenceIndex,
  handleEvidenceSearch,
  handleReviewPack,
  handleStandardRun
} = require('./lib/httpHandlers');
const { findSimilarCases, getControlSuggestions, learningMemoryHealth, recordReviewerFeedback } = require('./lib/learningMemory');
const { authHealth, authorizeRequest } = require('./lib/rbac');

const PORT = Number(process.env.PORT || 3020);
const PUBLIC_ROOT = path.join(__dirname, 'public');
const METADATA_PATH = path.join(__dirname, 'metadata.json');

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
    if (req.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/health')) {
      writeJson(res, 200, {
        ok: true,
        service: 'parallax42-compliance-intelligence-agent',
        mode: process.env.AGENT_MODE || 'crewai_llm',
        agentRuntime: runtimeHealth(),
        auth: authHealth(),
        adminFeatures: buildFeatureStatus(),
        audit: {
          store: auditStoreHealth(),
          integrity: verifyAuditChain()
        },
        evidenceGateway: gatewayHealth(),
        evidenceVectorStore: evidenceVectorStoreHealth(),
        governanceReference: governanceReferenceHealth(),
        learningMemory: learningMemoryHealth(),
        linkedBackend: process.env.PARALLAX42_BACKEND_URL || 'https://api.parallax42.bhavukarora.com'
      });
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/metadata' || url.pathname === '/metadata.json' || url.pathname === '/api/metadata')) {
      try {
        writeJson(res, 200, JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8')));
      } catch (error) {
        writeJson(res, 500, {
          error: 'metadata_unavailable',
          detail: error instanceof Error ? error.message : String(error || 'Unknown metadata error')
        });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/run') {
      const body = await readJsonBody(req, { limitBytes: 5_000_000 });
      const result = await handleStandardRun({ req, body, startedAt: Date.now() });
      writeJson(res, result.status, result.body);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/status') {
      writeJson(res, 200, buildAdminStatus());
      return;
    }

    if ((req.method === 'GET' || req.method === 'PATCH' || req.method === 'POST') && url.pathname === '/api/admin/features') {
      if (req.method === 'GET') {
        writeJson(res, 200, buildFeatureStatus());
        return;
      }
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 200_000 });
      const result = updateFeatureFlags(body.features && typeof body.features === 'object' ? body.features : body, auth.actor);
      appendAuditRecord({
        actor: auth.actor,
        caseId: 'admin-feature-controls',
        status: 'admin_features_updated',
        summary: `Updated admin feature controls: ${result.changed.join(', ') || 'none'}.`,
        payload: {
          changed: result.changed,
          features: result.features.map((feature) => ({
            id: feature.id,
            enabled: feature.enabled,
            active: feature.active,
            source: feature.source
          }))
        }
      });
      writeJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/qdrant-smoke') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const result = await runQdrantSmokeTest();
      appendAuditRecord({
        actor: auth.actor,
        caseId: result.caseId || 'qdrant-smoke',
        status: result.ok ? 'qdrant_smoke_passed' : result.skipped ? 'qdrant_smoke_skipped' : 'qdrant_smoke_failed',
        summary: result.ok
          ? `Qdrant smoke indexed ${result.indexedChunkCount || 0} chunks and found ${result.matchCount || 0} matches.`
          : result.reason || result.error || 'Qdrant smoke did not pass.',
        payload: {
          provider: result.provider,
          collection: result.collection,
          qdrantConfigured: result.qdrantConfigured,
          indexedChunkCount: result.indexedChunkCount || 0,
          matchCount: result.matchCount || 0
        }
      });
      writeJson(res, result.skipped ? 200 : result.ok ? 200 : 502, result);
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
      const body = await readJsonBody(req, { limitBytes: 5_000_000 });
      const result = await handleAgentRun({ req, body });
      writeJson(res, result.status, result.body);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/conversation') {
      const body = await readJsonBody(req, { limitBytes: 2_000_000 });
      const result = await handleConversation({ req, body });
      writeJson(res, result.status, result.body);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/evidence/index') {
      const body = await readJsonBody(req, { limitBytes: 5_000_000 });
      const result = await handleEvidenceIndex({ req, body });
      writeJson(res, result.status, result.body);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/evidence/search') {
      const body = await readJsonBody(req, { limitBytes: 2_000_000 });
      const result = await handleEvidenceSearch({ req, body });
      writeJson(res, result.status, result.body);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/reference/index') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 5_000_000 });
      const result = await indexGovernanceReference(body);
      appendAuditRecord({
        actor: auth.actor,
        caseId: body.caseId || result.context?.sourceId || 'governance-reference-index',
        status: 'governance_reference_indexed',
        summary: `Indexed ${result.chunking?.chunkCount || 0} governance reference chunks.`,
        payload: {
          route: 'reference.index',
          model: result.model,
          context: result.context,
          chunking: result.chunking,
          index: result.index,
          advisoryOnly: true,
          authority: result.context?.authority || 'context_reference_not_policy'
        }
      });
      writeJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/reference/search') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 1_000_000 });
      const result = await searchGovernanceReferences(body);
      appendAuditRecord({
        actor: auth.actor,
        caseId: body.caseId || body.sourceId || 'governance-reference-search',
        status: 'governance_reference_searched',
        summary: `Searched governance reference memory for ${result.references?.length || 0} matches.`,
        payload: {
          route: 'reference.search',
          model: result.model,
          context: result.context,
          index: result.index,
          queryLength: String(body.query || '').length,
          referenceIds: (result.references || []).map((reference) => reference.referenceId).filter(Boolean)
        }
      });
      writeJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/learning/feedback') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 1_000_000 });
      const result = await recordReviewerFeedback(body, { actor: auth.actor });
      appendAuditRecord({
        actor: auth.actor,
        caseId: body.caseId || 'learning-feedback',
        status: 'learning_feedback_recorded',
        summary: `Recorded ${result.artifacts.length} governed learning artifact(s).`,
        payload: {
          route: 'learning.feedback',
          provider: result.provider,
          artifactTypes: result.artifacts.map((artifact) => artifact.artifactType),
          advisoryOnly: true,
          trainingUse: 'not_model_training'
        }
      });
      writeJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/learning/similar-cases') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 1_000_000 });
      writeJson(res, 200, await findSimilarCases(body));
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/api/learning/control-suggestions') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = req.method === 'POST' ? await readJsonBody(req, { limitBytes: 1_000_000 }) : {};
      writeJson(res, 200, await getControlSuggestions(body));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/export/review-pack') {
      const body = await readJsonBody(req, { limitBytes: 3_000_000 });
      const result = await handleReviewPack({ req, body });
      writeJson(res, result.status, result.body);
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

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`Compliance Intelligence Agent listening on http://0.0.0.0:${PORT}\n`);
});
