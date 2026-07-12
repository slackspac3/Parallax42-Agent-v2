#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { indexGovernanceReference, searchGovernanceReferences } = require('../lib/governanceReferenceStore');

const DEFAULT_REFERENCE_PATH = path.join(__dirname, '..', 'reference_context', 'sanitised_enterprise_ai_governance_context.md');

async function main() {
  const filePath = path.resolve(process.argv[2] || DEFAULT_REFERENCE_PATH);
  const markdown = fs.readFileSync(filePath, 'utf8');
  const result = await indexGovernanceReference({
    sourceId: 'sanitised_enterprise_ai_governance_context',
    title: 'Sanitised Enterprise AI Governance Context',
    source: path.basename(filePath),
    classification: 'sanitised_public_test',
    authority: 'context_reference_not_policy',
    publicSafe: true,
    requiresHumanReview: true,
    markdown
  }, { trustedNamespace: true });
  const smoke = await searchGovernanceReferences({
    query: 'export controls sanctions data protection responsible AI assurance',
    topK: 3
  }, { trustedNamespace: true });
  console.log(JSON.stringify({
    ok: result.ok,
    provider: result.index.provider,
    storage: result.index.storage,
    sourceId: result.context.sourceId,
    chunkCount: result.index.chunkCount,
    model: result.model,
    smokeMatchCount: smoke.references.length,
    sampleReferences: smoke.references.map((reference) => ({
      section: reference.section,
      heading: reference.heading,
      score: reference.score,
      domains: reference.domains.slice(0, 4),
      frameworks: reference.frameworks.slice(0, 4)
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
