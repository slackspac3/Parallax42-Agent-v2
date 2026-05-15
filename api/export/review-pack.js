'use strict';

const { authorizeRequest } = require('../../lib/rbac');
const { buildReviewPack, buildReviewPackMarkdown } = require('../../lib/reviewPack');
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
    const pack = buildReviewPack(body.run || body);
    sendJson(req, res, 200, {
      ok: true,
      pack,
      markdown: buildReviewPackMarkdown(pack)
    });
  } catch (error) {
    sendJson(req, res, 400, {
      error: 'invalid_review_pack_request',
      detail: error instanceof Error ? error.message : String(error || 'Unknown error')
    });
  }
};
