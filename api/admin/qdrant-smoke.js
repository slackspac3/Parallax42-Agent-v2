'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { runQdrantSmokeTest } = require('../../lib/evidenceVectorStore');
const { authorizeAdminMutation } = require('../../lib/rbac');
const { methodGuard, rateLimitGuard, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'adminMutation')) return;
  try {
    const auth = await authorizeAdminMutation(req);
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
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
    sendJson(req, res, result.skipped ? 200 : result.ok ? 200 : 502, result);
  } catch (error) {
    sendJson(req, res, 500, {
      ok: false,
      error: 'qdrant_smoke_failed',
      detail: error instanceof Error ? error.message : String(error || 'Qdrant smoke failed.')
    });
  }
};
