'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const { runAgentWithRuntimeAsync, runtimeHealth } = require('./lib/agentRuntime');
const { buildFeatureStatus, updateFeatureFlags } = require('./lib/adminFeatureFlags');
const { buildAdminStatus } = require('./lib/adminStatus');
const { appendAuditRecord, auditStoreHealth, readRecentAuditRecords, verifyAuditChain } = require('./lib/auditStore');
const { runBenchmark } = require('./lib/benchmarkSuite');
const { gatewayHealth } = require('./lib/compassGatewayClient');
const { getReadinessInventory } = require('./lib/complianceAgent');
const { casePayloadFromDraft, processConversation } = require('./lib/conversationAgent');
const { evidenceVectorStoreHealth, indexEvidenceServerSide, runQdrantSmokeTest, searchEvidenceServerSide } = require('./lib/evidenceVectorStore');
const { buildGoldenWorkflowRun } = require('./lib/goldenWorkflow');
const { readJsonBody, writeJson } = require('./lib/http');
const { findSimilarCases, getControlSuggestions, learningMemoryHealth, recordReviewerFeedback } = require('./lib/learningMemory');
const { authHealth, authorizeRequest } = require('./lib/rbac');
const { buildReviewPack, buildReviewPackPdf } = require('./lib/reviewPack');
const { enrichConversationWithServerRetrieval } = require('./lib/serverSideRetrieval');

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
        learningMemory: learningMemoryHealth(),
        linkedBackend: process.env.PARALLAX42_BACKEND_URL || 'https://api.parallax42.bhavukarora.com'
      });
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
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 5_000_000 });
      const agentInput = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : body;
      const enrichedBody = await enrichConversationWithServerRetrieval({
        ...body,
        caseDraft: agentInput,
        forceRun: true,
        message: body.message || body.prompt || 'run it'
      });
      const result = await runAgentWithRuntimeAsync(enrichedBody.caseDraft || agentInput, {
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

    if (req.method === 'POST' && url.pathname === '/api/conversation') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 2_000_000 });
      const enrichedBody = await enrichConversationWithServerRetrieval(body);
      const runtime = req.headers['x-agent-runtime'] || enrichedBody.runtime;
      const result = processConversation(enrichedBody, { runtime });
      if (result.run?.ok) {
        result.run = await runAgentWithRuntimeAsync(casePayloadFromDraft(result.caseDraft), { runtime });
        result.actions = [
          ...(Array.isArray(result.actions) ? result.actions.filter((action) => action.id !== 'agent_workflow') : []),
          {
            id: 'agent_workflow',
            status: result.run.ok ? 'complete' : 'blocked',
            detail: result.run.runtime?.manifestSource === 'remote_crewai_service_llm'
              ? 'Executed deterministic council with live CrewAI specialist work from the remote Python service.'
              : 'Executed the CrewAI-routed compliance agent workflow.'
          }
        ];
      }
      appendAuditRecord({
        actor: auth.actor,
        caseId: result.run?.case?.caseId || result.caseDraft?.supplierName || 'conversation',
        status: result.run?.ok ? 'completed' : 'conversation_waiting',
        summary: result.run?.ok ? result.run.decision.recommendation : result.reply,
        payload: {
          auth: {
            policy: auth.policy,
            roles: auth.actor.roles,
            authenticated: auth.actor.authenticated
          },
          nlp: result.nlp,
          actions: result.actions,
          missingFields: result.missingFields,
          runDecision: result.run?.decision || null,
          evidenceIds: result.run?.evidenceIds || [],
          gapCount: result.run?.gaps?.length || 0
        }
      });
      writeJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/evidence/index') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 5_000_000 });
      const result = await indexEvidenceServerSide(body);
      appendAuditRecord({
        actor: auth.actor,
        caseId: result.context?.caseId || body.caseId || 'evidence-index',
        status: 'evidence_indexed',
        summary: `Indexed ${result.chunking?.chunkCount || 0} evidence chunks through the shared gateway.`,
        payload: {
          auth: {
            policy: auth.policy,
            roles: auth.actor.roles,
            authenticated: auth.actor.authenticated
          },
          route: 'evidence.index',
          model: result.model,
          context: result.context,
          chunking: result.chunking,
          index: result.index,
          evidenceIds: result.index?.evidenceIds || []
        }
      });
      writeJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/evidence/search') {
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 2_000_000 });
      const result = await searchEvidenceServerSide(body);
      appendAuditRecord({
        actor: auth.actor,
        caseId: result.context?.caseId || body.caseId || 'evidence-search',
        status: 'evidence_searched',
        summary: `Searched shared evidence index for ${result.matches?.length || 0} matches.`,
        payload: {
          auth: {
            policy: auth.policy,
            roles: auth.actor.roles,
            authenticated: auth.actor.authenticated
          },
          route: 'evidence.search',
          model: result.model,
          context: result.context,
          index: result.index,
          queryLength: String(body.query || '').length,
          matchIds: (result.matches || []).map((match) => match.chunkId).filter(Boolean)
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
      const auth = await authorizeRequest(req, 'agent:run');
      if (!auth.ok) {
        writeJson(res, auth.statusCode, auth.body);
        return;
      }
      const body = await readJsonBody(req, { limitBytes: 3_000_000 });
      const pack = buildReviewPack(body.run || body);
      const pdf = buildReviewPackPdf(pack);
      const caseId = pack.case?.caseId || 'case';
      writeJson(res, 200, {
        ok: true,
        pack,
        fileName: `p42-exec-review-${caseId}.pdf`,
        contentType: 'application/pdf',
        pdfBase64: pdf.toString('base64')
      });
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
