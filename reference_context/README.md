# Reference Context

This folder contains advisory reference intelligence used by Parallax42 to improve questions, risk-domain detection, evidence prompts, and reviewer control suggestions.

Reference memory was reviewed for the submission on **2026-06-06**. The review is captured in:

```text
reference_context/reference_memory_manifest.json
```

## Boundaries

- Reference context is not legal advice, a sanctions result, an export-license decision, a control certification, or autonomous approval.
- Uploaded case evidence remains separate from reference context.
- Governed learning memory remains separate from reference context and is not model training.
- Deterministic policy and current evidence remain authoritative.
- Browser/API callers do not receive raw embeddings, provider keys, or secret tokens.

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
