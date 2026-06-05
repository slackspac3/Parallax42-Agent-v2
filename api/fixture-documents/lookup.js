'use strict';

const { fixtureDocumentSummary, listSupportedFixtureDocuments } = require('../../lib/fixtureDocuments');
const { methodGuard, rateLimitGuard, readJsonRequest, sendJson, sendJsonError } = require('../_http');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  if (!rateLimitGuard(req, res, 'healthRead')) return;

  try {
    if (req.method === 'GET' && !req.query?.filename && !req.query?.path) {
      sendJson(req, res, 200, { ok: true, documents: listSupportedFixtureDocuments() });
      return;
    }
    const body = req.method === 'POST' ? await readJsonRequest(req, { limitBytes: 128 * 1024 }) : {};
    const reference = req.query?.filename || req.query?.path || body.filename || body.path || body.fileName;
    const result = fixtureDocumentSummary(reference);
    sendJson(req, res, 200, result);
  } catch (error) {
    sendJsonError(req, res, error, {
      statusCode: 400,
      error: error.code || 'fixture_lookup_failed',
      detail: error.message
    });
  }
};
