'use strict';

const { authorizeRequest } = require('../../lib/rbac');
const { buildReviewPack, buildReviewPackPdf } = require('../../lib/reviewPack');
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
    const pdf = buildReviewPackPdf(pack);
    const caseId = pack.case?.caseId || 'case';
    sendJson(req, res, 200, {
      ok: true,
      pack,
      fileName: `p42-exec-review-${caseId}.pdf`,
      contentType: 'application/pdf',
      pdfBase64: pdf.toString('base64')
    });
  } catch (error) {
    sendJson(req, res, 400, {
      error: 'invalid_review_pack_request',
      detail: error instanceof Error ? error.message : String(error || 'Unknown error')
    });
  }
};
