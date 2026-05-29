'use strict';

const { runAgentWithRuntimeAsync } = require('./agentRuntime');
const { appendAuditRecord } = require('./auditStore');
const { casePayloadFromDraft, processConversation } = require('./conversationAgent');
const { planConversationTurn } = require('./conversationPlanner');
const { buildEvaluatorError, buildEvaluatorResponse, normalizeEvaluatorInput } = require('./evaluatorRun');
const {
  evidenceIndexAuditPayload,
  evidenceSearchAuditPayload,
  indexEvidencePipeline,
  searchEvidencePipeline
} = require('./evidencePipeline');
const { buildCouncilNarrative } = require('./councilNarrative');
const { authorizeRequest } = require('./rbac');
const { buildReviewPack, buildReviewPackPdf } = require('./reviewPack');
const { enrichConversationWithServerRetrieval } = require('./serverSideRetrieval');
const { summarizeRun } = require('./conversationRenderer');

function authBody(auth) {
  return {
    policy: auth.policy,
    roles: auth.actor.roles,
    authenticated: auth.actor.authenticated
  };
}

async function requireAuth(req, permission = 'agent:run') {
  const auth = await authorizeRequest(req, permission);
  if (!auth.ok) {
    return { ok: false, response: { status: auth.statusCode, body: auth.body } };
  }
  return { ok: true, auth };
}

async function handleStandardRun({ req, body = {}, startedAt = Date.now() } = {}) {
  let normalized = {};
  try {
    normalized = normalizeEvaluatorInput(body);
    const authorized = await requireAuth(req, 'agent:run');
    if (!authorized.ok) return authorized.response;
    const enrichedBody = await enrichConversationWithServerRetrieval({
      ...body,
      caseDraft: normalized.caseDraft,
      forceRun: true,
      message: body.message || body.prompt || body.input?.query || normalized.caseDraft.brief || 'run it'
    }, {
      actor: authorized.auth.actor
    });
    const result = await runAgentWithRuntimeAsync(enrichedBody.caseDraft || normalized.caseDraft, {
      runtime: req.headers['x-agent-runtime'] || normalized.runtime
    });
    appendAuditRecord({
      actor: authorized.auth.actor,
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
    return { status: result.ok ? 200 : 400, body: buildEvaluatorResponse({ normalized, result, startedAt }) };
  } catch (error) {
    return { status: 500, body: buildEvaluatorError({ normalized, error, startedAt }) };
  }
}

async function handleAgentRun({ req, body = {} } = {}) {
  try {
    const authorized = await requireAuth(req, 'agent:run');
    if (!authorized.ok) return authorized.response;
    const runtime = req.headers['x-agent-runtime'] || body.runtime;
    const agentInput = body.caseDraft && typeof body.caseDraft === 'object' ? body.caseDraft : body;
    const enrichedBody = await enrichConversationWithServerRetrieval({
      ...body,
      caseDraft: agentInput,
      forceRun: true,
      message: body.message || body.prompt || 'run it'
    }, {
      actor: authorized.auth.actor
    });
    const result = await runAgentWithRuntimeAsync(enrichedBody.caseDraft || agentInput, { runtime });
    appendAuditRecord({
      actor: authorized.auth.actor,
      caseId: result.case?.caseId,
      status: result.ok ? 'completed' : 'blocked',
      summary: result.ok ? result.decision.recommendation : result.message,
      payload: {
        auth: authBody(authorized.auth),
        decision: result.decision,
        evidenceIds: result.evidenceIds,
        gapCount: result.gaps?.length || 0,
        traceEventCount: result.trace?.length || 0,
        runtime: result.runtime
      }
    });
    return { status: result.ok ? 200 : 400, body: result };
  } catch (error) {
    return {
      status: 400,
      body: {
        error: 'invalid_agent_request',
        detail: error instanceof Error ? error.message : String(error || 'Unknown error')
      }
    };
  }
}

function agentWorkflowActionFromRun(run = {}) {
  return {
    id: 'agent_workflow',
    status: run.ok ? 'complete' : 'blocked',
    detail: run.runtime?.manifestSource === 'remote_crewai_service_llm'
      ? 'Executed deterministic council with live CrewAI specialist work from the remote Python service.'
      : 'Executed the CrewAI-routed compliance agent workflow.'
  };
}

function replaceAgentWorkflowAction(actions = [], action) {
  return [
    ...(Array.isArray(actions) ? actions.filter((item) => item.id !== 'agent_workflow') : []),
    action
  ];
}

async function handleConversation({ req, body = {}, dependencies = {} } = {}) {
  try {
    const authorized = await requireAuth(req, 'agent:run');
    if (!authorized.ok) return authorized.response;
    const planTurn = dependencies.planConversationTurn || planConversationTurn;
    const processTurn = dependencies.processConversation || processConversation;
    const runCouncil = dependencies.runAgentWithRuntimeAsync || runAgentWithRuntimeAsync;
    const appendAudit = dependencies.appendAuditRecord || appendAuditRecord;
    const assessedBody = await planTurn(body, { actor: authorized.auth.actor });
    const runtime = req.headers['x-agent-runtime'] || assessedBody.runtime;
    const result = processTurn(assessedBody, { runtime, planOnly: true });
    if (result.shouldRun) {
      result.run = await runCouncil(casePayloadFromDraft(result.caseDraft), { runtime });
      if (result.run?.ok) result.reply = summarizeRun(result.run);
      result.actions = replaceAgentWorkflowAction(result.actions, agentWorkflowActionFromRun(result.run));
    }
    appendAudit({
      actor: authorized.auth.actor,
      caseId: result.run?.case?.caseId || result.caseDraft?.supplierName || 'conversation',
      status: result.run?.ok ? 'completed' : 'conversation_waiting',
      summary: result.run?.ok ? result.run.decision.recommendation : result.reply,
      payload: {
        auth: authBody(authorized.auth),
        llmAssessment: result.nlp?.llmAssessment || assessedBody.llmAssessment || null,
        conversationPlan: result.conversationPlan || assessedBody.conversationPlan || null,
        nlp: result.nlp,
        actions: result.actions,
        missingFields: result.missingFields,
        runDecision: result.run?.decision || null,
        evidenceIds: result.run?.evidenceIds || [],
        gapCount: result.run?.gaps?.length || 0
      }
    });
    return { status: 200, body: result };
  } catch (error) {
    return {
      status: 400,
      body: {
        error: 'invalid_conversation_request',
        detail: error instanceof Error ? error.message : String(error || 'Unknown error')
      }
    };
  }
}

async function handleEvidenceIndex({ req, body = {} } = {}) {
  try {
    const authorized = await requireAuth(req, 'agent:run');
    if (!authorized.ok) return authorized.response;
    const result = await indexEvidencePipeline(body, { auth: authorized.auth });
    appendAuditRecord(evidenceIndexAuditPayload({ auth: authorized.auth, body, result }));
    return { status: 200, body: result };
  } catch (error) {
    return {
      status: error.status || 502,
      body: error.body || {
        error: 'evidence_index_failed',
        detail: error instanceof Error ? error.message : 'Evidence indexing failed.'
      }
    };
  }
}

async function handleEvidenceSearch({ req, body = {} } = {}) {
  try {
    const authorized = await requireAuth(req, 'agent:run');
    if (!authorized.ok) return authorized.response;
    const result = await searchEvidencePipeline(body, { auth: authorized.auth });
    appendAuditRecord(evidenceSearchAuditPayload({ auth: authorized.auth, body, result }));
    return { status: 200, body: result };
  } catch (error) {
    return {
      status: error.status || 502,
      body: error.body || {
        error: 'evidence_search_failed',
        detail: error instanceof Error ? error.message : 'Evidence search failed.'
      }
    };
  }
}

async function handleReviewPack({ req, body = {} } = {}) {
  try {
    const authorized = await requireAuth(req, 'agent:run');
    if (!authorized.ok) return authorized.response;
    const run = body.run || body;
    const narrative = body.narrative || await buildCouncilNarrative(run);
    const pack = buildReviewPack(run, { narrative });
    const pdf = buildReviewPackPdf(pack);
    const caseId = pack.case?.caseId || 'case';
    return {
      status: 200,
      body: {
        ok: true,
        pack,
        fileName: `p42-exec-review-${caseId}.pdf`,
        contentType: 'application/pdf',
        pdfBase64: pdf.toString('base64')
      }
    };
  } catch (error) {
    return {
      status: 400,
      body: {
        error: 'invalid_review_pack_request',
        detail: error instanceof Error ? error.message : String(error || 'Unknown error')
      }
    };
  }
}

module.exports = {
  handleAgentRun,
  handleConversation,
  handleEvidenceIndex,
  handleEvidenceSearch,
  handleReviewPack,
  handleStandardRun
};
