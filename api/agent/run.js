'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { runAgentWithRuntimeAsync } = require('../../lib/agentRuntime');
const { authorizeRequest } = require('../../lib/rbac');
const { enrichConversationWithServerRetrieval } = require('../../lib/serverSideRetrieval');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const body = await readJsonRequest(req);
    const runtime = req.headers['x-agent-runtime'] || body.runtime;
    const agentInput = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : body;
    const enrichedBody = await enrichConversationWithServerRetrieval({
      ...body,
      caseDraft: agentInput,
      forceRun: true,
      message: body.message || body.prompt || 'run it'
    });
    const result = await runAgentWithRuntimeAsync(enrichedBody.caseDraft || agentInput, { runtime });
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
    sendJson(req, res, result.ok ? 200 : 400, result);
  } catch (error) {
    sendJson(req, res, 400, {
      error: 'invalid_agent_request',
      detail: error instanceof Error ? error.message : String(error || 'Unknown error')
    });
  }
};
