#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { indexGovernanceReference, searchGovernanceReferences } = require('../lib/governanceReferenceStore');
const {
  COURTLISTENER_CAVEAT,
  DEFAULT_REFERENCE_QUERIES,
  normalizeCourtListenerCitationResult,
  normalizeCourtListenerSearchResult,
  recordsToMarkdown
} = require('../lib/referenceIntelligenceCorpus');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'reference_context', 'legal');
const DEFAULT_BASE_URL = 'https://www.courtlistener.com/api/rest/v4/';
const DEFAULT_LIMIT_PER_QUERY = 2;

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function splitList(value = '') {
  return String(value || '').split('|').map((item) => item.trim()).filter(Boolean);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(filePath, records = []) {
  fs.writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join('\n')}${records.length ? '\n' : ''}`);
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, `${String(value || '').trim()}\n`);
}

function authHeaders(token = '') {
  const headers = { accept: 'application/json' };
  if (token) headers.Authorization = token.startsWith('Token ') || token.startsWith('Bearer ') ? token : `Token ${token}`;
  return headers;
}

function readLocalRecords(filePath) {
  if (!filePath) return [];
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) return JSON.parse(raw);
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function extractResults(body = {}) {
  if (Array.isArray(body.results)) return body.results;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.citations)) return body.citations;
  if (Array.isArray(body)) return body;
  return [];
}

function courtlistenerUrl(baseUrl, endpoint) {
  return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    throw new Error(`CourtListener request failed with HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  if (!/json/i.test(contentType)) {
    throw new Error(`CourtListener response was not JSON. Received ${contentType || 'unknown content type'}.`);
  }
  return JSON.parse(text);
}

async function fetchSearchResults({ baseUrl, query, limit, token }) {
  const url = new URL(courtlistenerUrl(baseUrl, 'search/'));
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'o');
  url.searchParams.set('page_size', String(limit));
  const body = await fetchJson(url, { headers: authHeaders(token) });
  return extractResults(body).map((record) => normalizeCourtListenerSearchResult(record, { query }));
}

async function fetchCitationLookup({ baseUrl, citation, token }) {
  const url = courtlistenerUrl(baseUrl, 'citation-lookup/');
  const body = await fetchJson(url, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'content-type': 'application/json'
    },
    body: JSON.stringify({ text: citation })
  });
  return extractResults(body).map((record) => normalizeCourtListenerCitationResult(record, { citation }));
}

function dedupeRecords(records = []) {
  const seen = new Set();
  return records.filter((record) => {
    const key = record.id || `${record.title}:${record.source}:${record.query}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function importLiveReferences({ baseUrl, queries, citations, limit, token }) {
  const records = [];
  const failures = [];

  for (const query of queries) {
    try {
      records.push(...await fetchSearchResults({ baseUrl, query, limit, token }));
    } catch (error) {
      failures.push({ query, detail: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const citation of citations) {
    try {
      records.push(...await fetchCitationLookup({ baseUrl, citation, token }));
    } catch (error) {
      failures.push({ citation, detail: error instanceof Error ? error.message : String(error) });
    }
  }

  return { records: dedupeRecords(records), failures };
}

async function main() {
  const outputDir = path.resolve(argValue('output-dir', OUTPUT_DIR));
  const baseUrl = argValue('base-url', process.env.COURTLISTENER_API_BASE_URL || DEFAULT_BASE_URL);
  const limit = Number(argValue('limit', process.env.COURTLISTENER_IMPORT_LIMIT || DEFAULT_LIMIT_PER_QUERY));
  const token = process.env.COURTLISTENER_API_TOKEN || '';
  const queries = splitList(argValue('queries', '')).length
    ? splitList(argValue('queries', ''))
    : DEFAULT_REFERENCE_QUERIES;
  const citations = splitList(argValue('citations', argValue('citation', '')));
  const inputJsonl = argValue('input-jsonl', argValue('input-json', ''));
  const skipIndex = flag('skip-index');
  const liveRequested = flag('live');
  const noLive = flag('no-live') || (!liveRequested && !token);

  ensureDir(outputDir);

  const queryFile = path.join(outputDir, 'courtlistener_sample_queries.json');
  const caveatFile = path.join(outputDir, 'legal_caveats.md');
  const recordsFile = path.join(outputDir, 'courtlistener_cases.jsonl');
  const markdownFile = path.join(outputDir, 'courtlistener_reference.md');
  const manifestFile = path.join(outputDir, 'courtlistener_import_manifest.json');

  writeJson(queryFile, {
    source: 'CourtListener',
    sourceUrl: 'https://www.courtlistener.com/api/rest/v4/',
    advisoryOnly: true,
    tokenRecommended: true,
    authenticatedRateLimitWarning: 'CourtListener authenticated API limits are low; prefer curated samples or bulk data for larger corpora.',
    queries,
    citations
  });
  writeText(caveatFile, ['# CourtListener Legal Reference Caveats', '', COURTLISTENER_CAVEAT].join('\n'));

  const localRecords = readLocalRecords(inputJsonl).map((record) => {
    if (record.source === 'courtlistener' || record.source === 'courtlistener_citation_lookup') {
      return record.corpusType ? record : normalizeCourtListenerSearchResult(record, { query: record.query || 'local CourtListener import' });
    }
    return normalizeCourtListenerSearchResult(record, { query: record.query || 'local CourtListener import' });
  });
  const imported = noLive
    ? { records: [], failures: [] }
    : await importLiveReferences({ baseUrl, queries, citations, limit, token });
  const records = dedupeRecords([...localRecords, ...imported.records]);

  writeJsonl(recordsFile, records);
  writeText(markdownFile, recordsToMarkdown(records, {
    title: 'CourtListener Legal Reference Intelligence',
    description: 'Small, advisory CourtListener case-law and citation-verification reference context for clause/risk issue spotting.'
  }));

  let indexResult = null;
  let searchSmoke = null;
  if (!skipIndex && records.length) {
    indexResult = await indexGovernanceReference({
      sourceId: 'courtlistener_case_law_reference',
      title: 'CourtListener Legal Reference Intelligence',
      source: 'CourtListener REST API',
      corpusType: 'case_law',
      lane: 'legal',
      jurisdiction: 'US',
      documentType: 'court_opinion',
      classification: 'public_legal_reference',
      authority: 'reference_intelligence_not_legal_advice',
      advisoryOnly: true,
      publicSafe: true,
      requiresHumanReview: true,
      markdown: fs.readFileSync(markdownFile, 'utf8')
    }, { trustedNamespace: true });
    searchSmoke = await searchGovernanceReferences({
      query: 'contract limitation liability data processing agreement',
      sourceId: 'courtlistener_case_law_reference',
      topK: 3
    }, { trustedNamespace: true });
  }

  const manifest = {
    ok: true,
    source: 'CourtListener',
    sourceUrl: 'https://www.courtlistener.com/api/rest/v4/',
    apiBaseUrl: baseUrl,
    advisoryOnly: true,
    noLive,
    noLiveReason: noLive ? (token ? 'Disabled by --no-live.' : 'COURTLISTENER_API_TOKEN is not configured; pass --live to attempt unauthenticated access.') : '',
    importedRecordCount: records.length,
    localInputRecordCount: localRecords.length,
    liveImportedRecordCount: imported.records.length,
    failedRequestCount: imported.failures.length,
    failures: imported.failures,
    files: {
      queries: path.relative(ROOT, queryFile),
      caveats: path.relative(ROOT, caveatFile),
      recordsJsonl: path.relative(ROOT, recordsFile),
      markdown: path.relative(ROOT, markdownFile)
    },
    index: indexResult ? {
      provider: indexResult.index?.provider,
      storage: indexResult.index?.storage,
      sourceId: indexResult.context?.sourceId,
      chunkCount: indexResult.index?.chunkCount,
      model: indexResult.model,
      smokeMatchCount: searchSmoke?.references?.length || 0
    } : {
      skipped: true,
      reason: skipIndex
        ? 'Indexing skipped by --skip-index.'
        : 'No CourtListener records were available to index.'
    },
    createdAt: new Date().toISOString()
  };
  writeJson(manifestFile, manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
