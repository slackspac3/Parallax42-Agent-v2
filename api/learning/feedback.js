'use strict';

const { appendAuditRecord } = require('../../lib/auditStore');
const { recordReviewerFeedback } = require('../../lib/learningMemory');
const { authorizeRequest } = require('../../lib/rbac');
const { STANDARD_RUN_BODY_LIMIT_BYTES } = require('../../lib/requestLimits');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!rateLimitGuard(req, res, 'standardRun')) return;
  try {
    const auth = await authorizeRequest(req, 'agent:run');
    if (!auth.ok) {
      sendJson(req, res, auth.statusCode, auth.body);
      return;
    }
    const body = await readJsonRequest(req, { limitBytes: STANDARD_RUN_BODY_LIMIT_BYTES });
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
    sendJson(req, res, 200, result);
  } catch (error) {
    if (error?.statusCode) {
      sendJsonError(req, res, error, { error: 'learning_feedback_failed' });
      return;
    }
    sendJson(req, res, 400, {
      error: 'learning_feedback_failed',
      detail: error instanceof Error ? error.message : String(error || 'Could not record learning feedback.')
    });
  }
};
