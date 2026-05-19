'use strict';

const { appendAuditRecord } = require('../lib/auditStore');
const { runAgentWithRuntimeAsync } = require('../lib/agentRuntime');
const { buildEvaluatorError, buildEvaluatorResponse, normalizeEvaluatorInput } = require('../lib/evaluatorRun');
const { authorizeRequest } = require('../lib/rbac');
const { enrichConversationWithServerRetrieval } = require('../lib/serverSideRetrieval');
const { methodGuard, readJsonRequest, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  const startedAt = Date.now();
  let normalized = {};
  try {
    const body = await readJsonRequest(req);
    normalized = normalizeEvaluatorInput(body);
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const enrichedBody = await enrichConversationWithServerRetrieval({
      ...body,
      caseDraft: normalized.caseDraft,
      forceRun: true,
      message: body.message || body.prompt || body.input?.query || normalized.caseDraft.brief || 'run it'
    });
    const result = await runAgentWithRuntimeAsync(enrichedBody.caseDraft || normalized.caseDraft, {
      runtime: req.headers['x-agent-runtime'] || normalized.runtime
    });
    appendAuditRecord({
      actor: auth.actor,
      caseId: result.case?.caseId || normalized.caseDraft.caseId,
      status: result.ok ? 'completed' : 'blocked',
      summary: result.ok ? result.decision.recommendation : result.message,
      payload: {
        route: 'standard_run',
        useCaseId: normalized.useCaseId,
        decision: result.decision,
        evidenceIds: result.evidenceIds,
        gapCount: result.gaps?.length || 0,
        traceEventCount: result.trace?.length || 0,
        runtime: result.runtime
      }
    });
    sendJson(req, res, result.ok ? 200 : 400, buildEvaluatorResponse({ normalized, result, startedAt }));
  } catch (error) {
    sendJson(req, res, 500, buildEvaluatorError({ normalized, error, startedAt }));
  }
};
