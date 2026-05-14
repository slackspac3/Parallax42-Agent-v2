'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { runComplianceAgent } = require('../../lib/complianceAgent');
const { methodGuard, readJsonRequest, sendJson } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const body = await readJsonRequest(req);
    const result = runComplianceAgent(body);
    appendAuditRecord({
      actor: result.case?.requester || 'browser_operator',
      caseId: result.case?.caseId,
      status: result.ok ? 'completed' : 'blocked',
      summary: result.ok ? result.decision.recommendation : result.message,
      payload: {
        decision: result.decision,
        evidenceIds: result.evidenceIds,
        gapCount: result.gaps?.length || 0,
        traceEventCount: result.trace?.length || 0
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
