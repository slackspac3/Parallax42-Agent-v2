'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { runAgentWithRuntime } = require('../../lib/agentRuntime');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const body = await readJsonRequest(req);
    const runtime = req.headers['x-agent-runtime'] || body.runtime;
    const result = runAgentWithRuntime(body, { runtime });
    appendAuditRecord({
      actor: result.case?.requester || 'browser_operator',
      caseId: result.case?.caseId,
      status: result.ok ? 'completed' : 'blocked',
      summary: result.ok ? result.decision.recommendation : result.message,
      payload: {
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
