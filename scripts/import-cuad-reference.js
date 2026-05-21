#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { indexGovernanceReference, searchGovernanceReferences } = require('../lib/governanceReferenceStore');
const { normalizeCuadClause, recordsToMarkdown } = require('../lib/referenceIntelligenceCorpus');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'reference_context', 'legal');
const DEFAULT_SAMPLE = path.join(ROOT, 'reference_context', 'legal_intelligence', 'sample_contract_clause_patterns.json');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
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

function readRecords(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8').trim();
  if (!raw) return [];
  const parsed = raw.startsWith('[') || raw.startsWith('{') ? JSON.parse(raw) : null;
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.patterns) return parsed.patterns.map((pattern) => ({
    id: pattern.id,
    clauseType: pattern.name,
    title: `${pattern.name} clause pattern`,
    summary: [
      ...(pattern.reviewQuestions || []).map((item) => `Review question: ${item}`),
      ...(pattern.riskSignals || []).map((item) => `Risk signal: ${item}`)
    ].join('\n'),
    tags: pattern.riskSignals || []
  }));
  if (parsed?.data && Array.isArray(parsed.data)) return parsed.data;
  if (parsed) return [parsed];
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

async function main() {
  const outputDir = path.resolve(argValue('output-dir', OUTPUT_DIR));
  const input = argValue('input-jsonl', argValue('input-json', '')) || DEFAULT_SAMPLE;
  const skipIndex = flag('skip-index');
  ensureDir(outputDir);

  const recordsFile = path.join(outputDir, 'cuad_clause_reference.jsonl');
  const markdownFile = path.join(outputDir, 'cuad_clause_reference.md');
  const manifestFile = path.join(outputDir, 'cuad_import_manifest.json');

  const rawRecords = readRecords(input);
  const records = rawRecords.map((record) => normalizeCuadClause(record, {
    source: input === DEFAULT_SAMPLE ? 'curated_clause_pattern_reference' : 'cuad_compatible_clause_import',
    jurisdiction: 'global'
  }));

  writeJsonl(recordsFile, records);
  writeText(markdownFile, recordsToMarkdown(records, {
    title: 'CUAD-Compatible Contract Clause Reference',
    description: 'Advisory contract clause-pattern reference context for agreement, MSA, DPA, SOW, and outsourcing review.'
  }));

  let indexResult = null;
  let searchSmoke = null;
  if (!skipIndex && records.length) {
    indexResult = await indexGovernanceReference({
      sourceId: 'cuad_contract_clause_reference',
      title: 'CUAD-Compatible Contract Clause Reference',
      source: input === DEFAULT_SAMPLE ? 'curated_clause_pattern_reference' : 'CUAD-compatible local import',
      corpusType: 'contract_clause',
      lane: 'legal',
      jurisdiction: 'global',
      documentType: 'contract_clause',
      classification: input === DEFAULT_SAMPLE ? 'synthetic_clause_reference' : 'public_or_local_clause_reference',
      authority: 'reference_intelligence_not_legal_advice',
      advisoryOnly: true,
      publicSafe: true,
      requiresHumanReview: true,
      markdown: fs.readFileSync(markdownFile, 'utf8')
    });
    searchSmoke = await searchGovernanceReferences({
      query: 'limitation of liability indemnification termination data security',
      sourceId: 'cuad_contract_clause_reference',
      topK: 3
    });
  }

  const manifest = {
    ok: true,
    source: input === DEFAULT_SAMPLE ? 'curated_clause_pattern_reference' : 'CUAD-compatible local import',
    sourcePath: path.relative(ROOT, path.resolve(input)),
    advisoryOnly: true,
    sample: input === DEFAULT_SAMPLE,
    importedRecordCount: records.length,
    files: {
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
      reason: skipIndex ? 'Indexing skipped by --skip-index.' : 'No CUAD-compatible records were available.'
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
