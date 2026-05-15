'use strict';

const { appendAuditRecord } = require('../lib/auditStore');
const { attachGatewayAdvisoryIfEnabled } = require('../lib/agentRuntime');
const { processConversation } = require('../lib/conversationAgent');
const { authorizeRequest } = require('../lib/rbac');
const { enrichConversationWithServerRetrieval } = require('../lib/serverSideRetrieval');
const { methodGuard, readJsonRequest, sendJson } = require('./_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const body = await readJsonRequest(req);
    const enrichedBody = await enrichConversationWithServerRetrieval(body);
    const runtime = req.headers['x-agent-runtime'] || enrichedBody.runtime;
    const result = processConversation(enrichedBody, { runtime });
    if (result.run?.ok) {
      result.run = await attachGatewayAdvisoryIfEnabled(result.run, { runtime });
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
    sendJson(req, res, 200, result);
  } catch (error) {
    sendJson(req, res, 400, {
      error: 'invalid_conversation_request',
      detail: error instanceof Error ? error.message : String(error || 'Unknown error')
    });
  }
};
