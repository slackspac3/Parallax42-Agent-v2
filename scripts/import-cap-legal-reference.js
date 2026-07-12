#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { indexGovernanceReference, searchGovernanceReferences } = require('../lib/governanceReferenceStore');
const {
  DEFAULT_CAP_QUERIES,
  LEGAL_CAVEAT,
  normalizeCapCase,
  recordsToMarkdown
} = require('../lib/legalReferenceCorpus');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'reference_context', 'legal_intelligence');
const DEFAULT_BASE_URL = 'https://api.case.law/v1/cases/';
const DEFAULT_LIMIT_PER_QUERY = 3;

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

function writeJsonl(filePath, records = []) {
  fs.writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join('\n')}${records.length ? '\n' : ''}`);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, `${String(value || '').trim()}\n`);
}

function buildUrl(baseUrl, query, limit) {
  const url = new URL(baseUrl);
  url.searchParams.set('search', query);
  url.searchParams.set('page_size', String(limit));
  url.searchParams.set('full_case', 'true');
  return url;
}

function extractResults(body = {}) {
  if (Array.isArray(body.results)) return body.results;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.cases)) return body.cases;
  if (Array.isArray(body)) return body;
  return [];
}

function readLocalCapRecords(filePath) {
  if (!filePath) return [];
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, 'utf8').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) return JSON.parse(raw);
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

async function fetchCapCases({ baseUrl, query, limit, token }) {
  const url = buildUrl(baseUrl, query, limit);
  const headers = { accept: 'application/json' };
  if (token) {
    headers.Authorization = token.startsWith('Token ') || token.startsWith('Bearer ') ? token : `Token ${token}`;
  }
  const response = await fetch(url, { headers });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`CAP request failed for "${query}" with HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  if (!/json/i.test(contentType)) {
    throw new Error(`CAP request for "${query}" did not return JSON. Received ${contentType || 'unknown content type'}.`);
  }
  return extractResults(JSON.parse(text)).map((record) => normalizeCapCase(record, { query }));
}

async function importLiveCases({ queries, baseUrl, limit, token }) {
  const records = [];
  const failures = [];
  for (const query of queries) {
    try {
      const cases = await fetchCapCases({ baseUrl, query, limit, token });
      records.push(...cases);
    } catch (error) {
      failures.push({
        query,
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }
  const seen = new Set();
  const deduped = records.filter((record) => {
    const key = record.capId || `${record.caseName}:${record.decisionDate}:${record.query}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { records: deduped, failures };
}

async function main() {
  const outputDir = path.resolve(argValue('output-dir', OUTPUT_DIR));
  const baseUrl = argValue('base-url', process.env.CAP_API_BASE_URL || DEFAULT_BASE_URL);
  const limit = Number(argValue('limit', process.env.CAP_IMPORT_LIMIT || DEFAULT_LIMIT_PER_QUERY));
  const token = process.env.CAP_API_TOKEN || process.env.CASELAW_API_TOKEN || '';
  const requestedQueries = splitList(argValue('queries', ''));
  const queries = requestedQueries.length ? requestedQueries : DEFAULT_CAP_QUERIES;
  const inputJsonl = argValue('input-jsonl', '');
  const noLive = flag('no-live');
  const skipIndex = flag('skip-index');

  ensureDir(outputDir);

  const queryFile = path.join(outputDir, 'cap_sample_queries.json');
  const caveatFile = path.join(outputDir, 'legal_caveats.md');
  const casesFile = path.join(outputDir, 'cap_cases.jsonl');
  const markdownFile = path.join(outputDir, 'cap_legal_reference.md');
  const manifestFile = path.join(outputDir, 'cap_import_manifest.json');

  writeJson(queryFile, {
    source: 'Caselaw Access Project',
    sourceUrl: 'https://case.law/',
    useCaseId: '21',
    problemStatement: 'Legal Intelligence',
    advisoryOnly: true,
    queries
  });
  writeText(caveatFile, [
    '# Legal Intelligence Caveats',
    '',
    LEGAL_CAVEAT,
    '',
    'The reference corpus is intended for clause-risk comparison, legal issue spotting, and reviewer questions. It must not be used as jurisdiction-specific legal advice or as an automated legal approval.'
  ].join('\n'));

  const localRecords = readLocalCapRecords(inputJsonl)
    .map((record) => record.sourceType === 'legal_reference_case' ? record : normalizeCapCase(record, { query: record.query || 'local CAP import' }));
  const imported = noLive
    ? { records: [], failures: [] }
    : await importLiveCases({ queries, baseUrl, limit, token });
  const mergedRecords = [...localRecords, ...imported.records];
  writeJsonl(casesFile, mergedRecords);
  writeText(markdownFile, recordsToMarkdown(mergedRecords));

  let indexResult = null;
  let searchSmoke = null;
  if (!skipIndex && mergedRecords.length) {
    indexResult = await indexGovernanceReference({
      sourceId: 'caselaw_access_project_legal_intelligence',
      title: 'Caselaw Access Project Legal Intelligence Reference',
      source: 'Caselaw Access Project API',
      classification: 'public_legal_reference',
      authority: 'legal_reference_not_advice',
      publicSafe: true,
      requiresHumanReview: true,
      markdown: fs.readFileSync(markdownFile, 'utf8')
    }, { trustedNamespace: true });
    searchSmoke = await searchGovernanceReferences({
      query: 'limitation of liability indemnification agreement legal risk',
      sourceId: 'caselaw_access_project_legal_intelligence',
      topK: 3
    }, { trustedNamespace: true });
  }

  const manifest = {
    ok: true,
    source: 'Caselaw Access Project',
    sourceUrl: 'https://case.law/',
    apiBaseUrl: baseUrl,
    useCaseId: '21',
    problemStatement: 'Legal Intelligence',
    advisoryOnly: true,
    importedCaseCount: mergedRecords.length,
    localInputCaseCount: localRecords.length,
    liveImportedCaseCount: imported.records.length,
    failedQueryCount: imported.failures.length,
    failures: imported.failures,
    files: {
      queries: path.relative(ROOT, queryFile),
      caveats: path.relative(ROOT, caveatFile),
      casesJsonl: path.relative(ROOT, casesFile),
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
      reason: imported.records.length
        ? 'Indexing skipped by --skip-index.'
        : 'No CAP case records were available. Check CAP API access, CAP_API_TOKEN, or pass --input-jsonl=<file>.'
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
