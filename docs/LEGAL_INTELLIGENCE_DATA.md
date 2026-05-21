# Legal Intelligence Data

Parallax42 maps the Agentathon submission to **Use Case #21: Legal Intelligence / Compliance**. The hackathon guidance suggests the **Caselaw Access Project** as the data source for this use case and recommends using sample clauses/cases with legal caveats.

This page is retained for the original CAP-specific path. The broader and preferred data-lane plan is now documented in [`REFERENCE_INTELLIGENCE_DATA.md`](REFERENCE_INTELLIGENCE_DATA.md), with CourtListener as the primary legal-reference importer and CAP retained as a legacy/optional source.

## Data Strategy

This repo treats Caselaw Access Project material as **advisory legal-reference context** for clause and risk comparison. Uploaded agreements, DPAs, MSAs, SOC reports, and implementation evidence remain the primary case evidence. CAP references help the system ask better reviewer questions and identify common contract-risk patterns; they do not decide the case.

## Files

- `scripts/import-cap-legal-reference.js` imports a small CAP sample through the CAP API when access is available.
- `scripts/import-courtlistener-reference.js` imports a small CourtListener legal-reference sample or local CourtListener JSON/JSONL export.
- `scripts/import-cuad-reference.js` imports CUAD-compatible contract clause records.
- `reference_context/legal_intelligence/cap_sample_queries.json` lists the clause/risk queries used for the sample import.
- `reference_context/legal_intelligence/cap_cases.jsonl` stores normalized CAP case records when imported.
- `reference_context/legal_intelligence/cap_legal_reference.md` is the markdown corpus that can be indexed into the existing reference memory.
- `reference_context/legal_intelligence/legal_caveats.md` records the legal-use boundary.
- `reference_context/legal_intelligence/sample_contract_clause_patterns.json` provides original synthetic clause-risk patterns for local demo fallback.

## Import

```bash
npm run reference:cap
```

Useful options:

```bash
CAP_API_TOKEN=<optional-token> npm run reference:cap
node scripts/import-cap-legal-reference.js --limit=2
node scripts/import-cap-legal-reference.js --queries="limitation of liability contract|indemnification agreement"
node scripts/import-cap-legal-reference.js --input-jsonl=/path/to/cap-export.jsonl --no-live
node scripts/import-cap-legal-reference.js --skip-index
```

The importer writes normalized records and, when records are available, indexes the markdown corpus through the same reference-memory path used by `npm run reference:index`. With Qdrant configured, those chunks are embedded through `text-embedding-3-large` and stored in Qdrant. Without Qdrant, they fall back to local-file demo storage.

## Legal Caveat

CAP references are advisory context only. They may be jurisdiction-specific and are not legal advice. They cannot override the deterministic council, cannot approve a contract, and must be reviewed by an accountable human legal/compliance owner.
