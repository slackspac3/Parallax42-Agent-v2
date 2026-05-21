#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { indexGovernanceReference, searchGovernanceReferences } = require('../lib/governanceReferenceStore');
const { normalizeReferenceRecord, recordsToMarkdown } = require('../lib/referenceIntelligenceCorpus');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'reference_context', 'security');

const DEFAULT_NIST_REFERENCES = [
  {
    id: 'nist-csf-2',
    title: 'NIST Cybersecurity Framework 2.0',
    source: 'NIST',
    sourceUrl: 'https://www.nist.gov/cyberframework',
    corpusType: 'security_control',
    lane: 'security',
    jurisdiction: 'US/global',
    documentType: 'framework',
    tags: ['cybersecurity', 'govern', 'identify', 'protect', 'detect', 'respond', 'recover'],
    summary: 'Reference manifest for mapping supplier and platform controls to cybersecurity governance, risk, asset, identity, incident, and recovery questions.',
    text: 'Use as advisory reference context for security control discovery, SOC2-style evidence requests, access control checks, incident response, and recovery obligations.'
  },
  {
    id: 'nist-sp-800-53',
    title: 'NIST SP 800-53 Security and Privacy Controls',
    source: 'NIST',
    sourceUrl: 'https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final',
    corpusType: 'security_control',
    lane: 'security',
    jurisdiction: 'US/global',
    documentType: 'control_catalog',
    tags: ['security controls', 'privacy controls', 'access control', 'audit', 'risk assessment'],
    summary: 'Reference manifest for common security and privacy control families used during evidence and assurance review.',
    text: 'Use as advisory context for asking about access control, audit logging, configuration management, incident response, risk assessment, and system protection controls.'
  },
  {
    id: 'nist-sp-800-171',
    title: 'NIST SP 800-171 Protecting Controlled Unclassified Information',
    source: 'NIST',
    sourceUrl: 'https://csrc.nist.gov/publications/detail/sp/800-171/rev-3/final',
    corpusType: 'security_control',
    lane: 'security',
    jurisdiction: 'US/global',
    documentType: 'control_catalog',
    tags: ['controlled information', 'supplier security', 'access control', 'incident response'],
    summary: 'Reference manifest for supplier handling of controlled or sensitive information.',
    text: 'Use as advisory context when vendor or outsourcing cases involve sensitive information, subcontractors, identity access, encryption, incident reporting, or controlled records.'
  },
  {
    id: 'nist-ai-rmf',
    title: 'NIST AI Risk Management Framework',
    source: 'NIST',
    sourceUrl: 'https://www.nist.gov/itl/ai-risk-management-framework',
    corpusType: 'ai_governance',
    lane: 'ai_governance',
    jurisdiction: 'US/global',
    documentType: 'framework',
    tags: ['ai governance', 'model risk', 'human oversight', 'transparency', 'bias'],
    summary: 'Reference manifest for Responsible AI and model-risk questions.',
    text: 'Use as advisory context for AI workflow cases involving model training, automated decisioning, human oversight, transparency, bias testing, monitoring, and accountability.'
  },
  {
    id: 'nist-privacy-framework',
    title: 'NIST Privacy Framework',
    source: 'NIST',
    sourceUrl: 'https://www.nist.gov/privacy-framework',
    corpusType: 'privacy_guidance',
    lane: 'compliance',
    jurisdiction: 'US/global',
    documentType: 'framework',
    tags: ['privacy', 'personal data', 'data processing', 'retention', 'governance'],
    summary: 'Reference manifest for privacy-risk management questions.',
    text: 'Use as advisory context for privacy governance, personal-data inventory, data processing basis, retention, deletion, cross-border processing, and privacy-control evidence.'
  }
];

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

function readInputRecords(filePath) {
  if (!filePath) return [];
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) return JSON.parse(raw);
  if (raw.startsWith('{')) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.records)) return parsed.records;
    if (Array.isArray(parsed.data)) return parsed.data;
    return [parsed];
  }
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

async function main() {
  const outputDir = path.resolve(argValue('output-dir', OUTPUT_DIR));
  const inputJson = argValue('input-jsonl', argValue('input-json', ''));
  const skipIndex = flag('skip-index');
  ensureDir(outputDir);

  const aiGovernanceDir = path.join(ROOT, 'reference_context', 'ai_governance');
  ensureDir(aiGovernanceDir);

  const rawRecords = readInputRecords(inputJson);
  const records = (rawRecords.length ? rawRecords : DEFAULT_NIST_REFERENCES)
    .map((record) => normalizeReferenceRecord(record, {
      source: 'NIST',
      classification: 'public_reference_manifest',
      authority: 'reference_manifest_not_control_catalog',
      advisoryOnly: true,
      requiresHumanReview: true
    }));

  const securityRecords = records.filter((record) => record.lane !== 'ai_governance');
  const aiRecords = records.filter((record) => record.lane === 'ai_governance');

  const securityRecordsFile = path.join(outputDir, 'nist_reference_manifest.jsonl');
  const securityMarkdownFile = path.join(outputDir, 'nist_reference_manifest.md');
  const aiMarkdownFile = path.join(aiGovernanceDir, 'nist_ai_governance_reference.md');
  const manifestFile = path.join(outputDir, 'nist_import_manifest.json');

  writeJsonl(securityRecordsFile, records);
  writeText(securityMarkdownFile, recordsToMarkdown(securityRecords, {
    title: 'NIST Security and Privacy Reference Manifest',
    description: 'Advisory NIST public-reference manifest for security, privacy, supplier assurance, and technical-risk evidence questions.'
  }));
  writeText(aiMarkdownFile, recordsToMarkdown(aiRecords, {
    title: 'NIST AI Governance Reference Manifest',
    description: 'Advisory NIST AI Risk Management reference manifest for Responsible AI review questions.'
  }));

  let indexResult = null;
  let searchSmoke = null;
  if (!skipIndex && records.length) {
    indexResult = await indexGovernanceReference({
      sourceId: 'nist_public_reference_manifest',
      title: 'NIST Public Reference Manifest',
      source: 'NIST public reference manifest',
      corpusType: 'security_control',
      lane: 'security',
      jurisdiction: 'US/global',
      documentType: 'framework_manifest',
      classification: 'public_security_ai_reference',
      authority: 'reference_manifest_not_control_catalog',
      advisoryOnly: true,
      publicSafe: true,
      requiresHumanReview: true,
      markdown: [
        fs.readFileSync(securityMarkdownFile, 'utf8'),
        fs.readFileSync(aiMarkdownFile, 'utf8')
      ].join('\n\n')
    });
    searchSmoke = await searchGovernanceReferences({
      query: 'access control incident response privacy ai governance human oversight',
      sourceId: 'nist_public_reference_manifest',
      topK: 3
    });
  }

  const manifest = {
    ok: true,
    source: 'NIST public reference manifest',
    advisoryOnly: true,
    sample: !rawRecords.length,
    importedRecordCount: records.length,
    files: {
      recordsJsonl: path.relative(ROOT, securityRecordsFile),
      securityMarkdown: path.relative(ROOT, securityMarkdownFile),
      aiGovernanceMarkdown: path.relative(ROOT, aiMarkdownFile)
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
      reason: skipIndex ? 'Indexing skipped by --skip-index.' : 'No NIST reference records were available.'
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
