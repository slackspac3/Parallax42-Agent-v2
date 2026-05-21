# Reference Intelligence Data

Parallax42 separates reference intelligence from uploaded evidence, governed learning memory, and deterministic decisions.

## Boundaries

- **Uploaded evidence** is what the council can cite for the current case: contracts, DPAs, SOWs, SOC reports, policy excerpts, approvals, and user-provided facts.
- **Reference intelligence** is public or curated advisory context used to ask better questions, identify likely obligations, compare clause patterns, and suggest reviewer checks.
- **Learning memory** is auditable reviewer feedback and prior internal outcomes. It is not model training and never silently changes a decision.
- **Deterministic council decisioning** remains the final system owner. Human approval is still required.

Reference intelligence must not be described as legal advice, a sanctions determination, a control certification, or production authorization.

## Corpus Lanes

| Lane | Corpus types | Example sources | Use in the app |
| --- | --- | --- | --- |
| Legal / contract | `case_law`, `contract_clause` | CourtListener, Free Law Project bulk data, CUAD-compatible clause records, SEC EDGAR exhibits | Clause issue spotting, citation verification, contract-risk questions |
| Compliance / privacy | `privacy_guidance`, `regulatory_guidance` | GDPR / EUR-Lex, EDPB, ICO, FTC, NIST Privacy Framework | DPA, transfer, retention, subprocessors, privacy evidence questions |
| Security / technical risk | `security_control`, `technical_risk` | NIST CSF 2.0, SP 800-53, SP 800-171, CISA, OWASP | SOC2-like evidence questions, access, logging, incident response, BCP/DR |
| AI governance | `ai_governance`, `responsible_ai` | NIST AI RMF, OECD AI principles, EU AI Act text, model-card patterns | Model training, human oversight, bias, monitoring, transparency questions |
| Procurement / vendor risk | `procurement_risk`, `supplier_risk` | Open Contracting Data Standard, World Bank debarred firms, SAM.gov, USAspending.gov, TED | Supplier onboarding, outsourcing, debarment, sourcing-control prompts |
| Sanctions / export controls | `sanctions_export`, `trade_compliance` | Trade.gov CSL, OFAC, BIS/EAR via eCFR, EU/UN sanctions lists | Restricted-party, export-control, end-use, import/export escalation prompts |
| HSE / ESG | `hse_esg`, `operational_compliance` | OSHA, EPA, CSRD/taxonomy via EUR-Lex, UN Global Compact | Safety, environmental, sustainability, incident and operational evidence prompts |

## Implemented Importers

```bash
npm run reference:index
npm run reference:courtlistener
npm run reference:cuad
npm run reference:nist
npm run reference:intelligence
```

- `reference:index` indexes `reference_context/sanitised_enterprise_ai_governance_context.md`.
- `reference:courtlistener` imports a small CourtListener legal-reference sample when `COURTLISTENER_API_TOKEN` is configured or when local JSON/JSONL is provided. Without a token it writes manifests/caveats and skips live calls unless `--live` is explicitly passed.
- `reference:cuad` indexes CUAD-compatible clause records. By default it uses the repo's curated clause-pattern fixture.
- `reference:nist` creates and optionally indexes a NIST public-reference manifest for security, privacy, and AI governance questions.
- `reference:intelligence` creates safe local artifacts without live API calls or indexing.

The legacy `reference:cap` command remains available for Caselaw Access Project API access, but CourtListener is now the preferred path for legal-reference ingestion and citation lookup.

## CourtListener Notes

CourtListener / Free Law Project exposes REST APIs, bulk data, database replication, webhooks, and an MCP server. The REST API base used by the importer is:

```text
https://www.courtlistener.com/api/rest/v4/
```

Useful endpoints include search, clusters, opinions, citation lookup, dockets, and recap documents. Token auth is recommended for programmatic access. The citation lookup endpoint is especially useful as a guardrail against hallucinated legal citations. Authenticated API limits are intentionally low, so large reference ingestion should use bulk data or a curated sample rather than broad live API crawling.

## File Layout

```text
reference_context/legal/
reference_context/compliance/
reference_context/procurement/
reference_context/security/
reference_context/ai_governance/
reference_context/sanctions_export/
reference_context/hse_esg/
```

Each lane is advisory context. Generated markdown can be indexed through `lib/governanceReferenceStore.js`, which stores chunks as `governance_reference` with safe metadata and no browser-retained embeddings.
