# Reference Intelligence Data

Parallax42 separates reference intelligence from uploaded evidence, governed learning memory, and deterministic decisions.

## Current Reference Memory Snapshot

Reference memory was reviewed for the submission on **2026-06-06**. The review is captured in:

```text
reference_context/reference_memory_manifest.json
```

The manifest records the official/advisory anchors used for the current submission. The expanded snapshot now includes:

- AI governance: NIST AI RMF, NIST AI RMF Generative AI Profile, EU AI Act Regulation (EU) 2024/1689, OECD AI Principles, ISO/IEC 42001, ISO/IEC 23894, UAE National Strategy for Artificial Intelligence 2031, and Dubai AI Ethics references.
- Security: NIST CSF 2.0, NIST SP 800-53, NIST SP 800-171, NIST SSDF SP 800-218, CISA Cybersecurity Performance Goals, OWASP ASVS / Top 10, ISO/IEC 27001, and UAE Cyber Security Council references.
- Privacy and compliance: NIST Privacy Framework, GDPR Regulation (EU) 2016/679, EDPB guidance, UK ICO AI/data-protection guidance, Singapore PDPA, UAE data-protection portal references, DIFC Data Protection Law, and ADGM Office of Data Protection references.
- Sanctions and export controls: Trade.gov Consolidated Screening List, OFAC Sanctions List Service, eCFR EAR, BIS Entity List, BIS Denied Persons List, UN Security Council Consolidated List, EU Sanctions Map, Singapore Customs Strategic Goods Control, UAE Executive Office for Control and Non-Proliferation, and UAE AML/CFT references.
- Legal and contract: CourtListener, Free Law Project, CUAD-compatible clause patterns, and SEC EDGAR APIs.
- Procurement and vendor risk: Open Contracting Data Standard, World Bank debarment data, SAM.gov exclusions, USAspending.gov, EU TED, and UAE Ministry of Finance references.
- HSE and ESG: OSHA, EPA ECHO, EU CSRD, ESRS, UN Global Compact, IFRS Sustainability Standards, GRI Standards, UAE Ministry of Climate Change and Environment, and UAE Ministry of Human Resources and Emiratisation references.

Core42 Compass is intentionally recorded separately as a **runtime anchor**, not as a legal, compliance, security, procurement, sanctions, export-control, HSE, or ESG knowledge source. Compass is the server-side LLM and embedding provider used to analyze, summarize, critique, and retrieve against the reference and evidence memory. The authority for reference intelligence comes from the public/official anchors and from human reviewer validation, not from the model provider.

This is a curated/static reference snapshot, not live regulatory monitoring. It is safe for judge review because it uses public or synthetic context, does not include secrets, does not contain raw embeddings, and does not claim legal advice or compliance certification.

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

## UAE-Specific Coverage

The reference manifest now includes UAE-specific anchors for:

- AI governance and ethics: UAE National Strategy for Artificial Intelligence 2031 and Dubai AI Ethics references.
- Privacy and data protection: UAE data-protection portal, DIFC Data Protection Law, and ADGM Office of Data Protection.
- Cybersecurity: UAE Cyber Security Council.
- Export and sanctions escalation: UAE Executive Office for Control and Non-Proliferation and UAE AML/CFT / targeted-financial-sanctions references.
- Procurement and local operating context: UAE Ministry of Finance.
- HSE and ESG: UAE Ministry of Climate Change and Environment and UAE Ministry of Human Resources and Emiratisation.

These anchors help the system ask UAE-relevant questions for geography, regulator perimeter, cross-border processing, AI use, import/export, sanctions, workforce, environment, and procurement context. They are advisory references only. The system does not make UAE legal determinations or replace accountable counsel, compliance, export-control, cybersecurity, HSE, procurement, or privacy review.

## Future Knowledge Connector API

The near-term roadmap should add a governed knowledge connector API so approved live sources can be plugged into reference memory without changing the council architecture.

Target behavior:

- Connectors can pull bounded updates from allowlisted sources such as case-law APIs, sanctions lists, export-control lists, regulatory guidance, procurement/debarment datasets, and internal policy registers.
- Each connector declares its source URL, data license, refresh cadence, schema, trust tier, and last successful sync.
- Updates create auditable import records with source hash, fetched timestamp, parser version, reviewer status, and correction history.
- New or changed records remain advisory until validated by configured review policy.
- Corrections can supersede stale records without deleting the audit trail.
- Runtime responses expose source names, timestamps, and citation-safe snippets, never provider keys or raw embeddings.

This API is a roadmap item. The current submission uses curated/static reference snapshots, local importers, and optional Qdrant indexing. It does not claim live regulatory monitoring or automatic sanctions/export determination.

## Freshness And Refresh Policy

The submission does not rely on broad live crawling. Refreshes should be explicit, auditable, and bounded:

1. Review the official source anchors in `reference_context/reference_memory_manifest.json`.
2. Run local/safe importers:

```bash
npm run reference:intelligence
npm run reference:index
```

3. If Qdrant and embeddings are configured, run:

```bash
npm run qdrant:smoke
```

4. Verify that all generated records remain advisory-only and that no raw embeddings or keys appear in output.

Do not claim that reference memory is current legal advice, a live sanctions screen, a license determination, an OCR system, or a production certification. Use it to improve questions, detect likely domains, and suggest reviewer controls.

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
