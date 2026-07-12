# Reference Context

This folder contains advisory reference intelligence used by Parallax42 to improve questions, risk-domain detection, evidence prompts, and reviewer control suggestions.

Reference memory was reviewed for the submission on **2026-06-06**. The review is captured in:

```text
reference_context/reference_memory_manifest.json
```

## Ownership And Review

- **Accountable owner:** Compliance Intelligence Product Owner; assign a named person or team alias before production use.
- **Review cadence:** monthly and after any material source, regulatory, standards, or licensing change.
- **Last review:** 2026-06-06. **Next scheduled review:** 2026-07-31.
- **Fail closed:** an overdue lane, failed refresh, or failed integrity check makes that lane unavailable for retrieval until its domain owner revalidates it. Stale material cannot satisfy evidence or approval gates. Automated enforcement is not yet proven, so operators must disable stale lanes manually before indexing or serving them.

## Boundaries

- Reference context is not legal advice, a sanctions result, an export-license decision, a control certification, or autonomous approval.
- Uploaded case evidence remains separate from reference context.
- Governed learning memory remains separate from reference context and is not model training.
- Deterministic Node policy and verified current evidence are intended to remain authoritative; current grounding and authority-parity defects are tracked in the [deep review](../docs/DEEP_CODE_REVIEW.md).
- Browser/API callers do not receive raw embeddings, provider keys, or secret tokens.
- Compass is a server-side LLM and embedding runtime provider. It is not treated as a legal, compliance, security, sanctions, export-control, procurement, HSE, or ESG reference authority.

## Refresh

Use bounded refresh commands only:

```bash
npm run reference:intelligence
env -u COMPASS_GATEWAY_TOKEN -u PARALLAX42_GATEWAY_TOKEN -u CREWAI_LLM_API_KEY -u OPENAI_API_KEY \
  -u QDRANT_URL -u QDRANT_API_KEY \
  P42_SKIP_LOCAL_ENV=1 P42_VECTOR_STORE_PROVIDER=local_file P42_FEATURE_COMPASS_EMBEDDINGS=0 \
  npm run reference:index
```

If Qdrant and Compass embeddings are configured for a runtime, validate that path separately:

```bash
python scripts/qdrant_smoke.py
npm run qdrant:smoke
```

Local Qdrant smoke may skip or fail when the local shell lacks credentials or cannot reach the deployed vector service. The deployed online product proof path is the Vercel evidence API described in `README.md` and `EVALUATION.md`.

## Future Knowledge Connector API

The roadmap includes a governed connector API for live reference updates from allowlisted sources such as case-law APIs, sanctions lists, export-control lists, regulatory guidance, procurement/debarment datasets, and internal policy registers.

That API should preserve the current boundaries:

- each connector declares source URL, license, schema, refresh cadence, trust tier, and last sync;
- imports write source hashes, timestamps, parser versions, reviewer status, and correction history;
- new or corrected records remain advisory until validated by configured review policy;
- stale records are superseded rather than silently deleted;
- responses return citation-safe snippets and source metadata, not raw embeddings, provider keys, or autonomous determinations.

This connector API is not part of the current submission claim. The current reference memory is a curated/static snapshot with bounded local importers and optional indexing.
