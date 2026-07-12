# Agent Resume

Verified technical findings and remediation priorities are in the [deep code review](DEEP_CODE_REVIEW.md); the selected hosting transition is in the [Azure migration plan](AZURE_MIGRATION_PLAN.md).

## Name

Parallax42 Compliance Intelligence Agent

## Mission

Strengthen compliance visibility across enterprise workflows by turning intake, policy evidence, contracts, supplier context, and reviewer feedback into traceable recommendations for human approval.

## Current Core Capabilities

- Online-first judge demo through GitHub Pages and Vercel product APIs, using a named Parallax42 Compass gateway client, isolated Railway Postgres, and Railway Qdrant.
- Root Agentathon evaluator wrapper: `run.py` exposes `POST /run`, `GET /health`, `GET /metadata`, `GET /logs`, and `GET /compass/probe` on port `8000`.
- FastAPI evaluator proof is currently the repository plus GitHub Actions Docker smoke, not a separate public FastAPI URL.
- Compliance-domain triage across third-party, privacy, AI/model governance, continuity, finance/project compliance, Microsoft licensing, ESG/HSE/BCM, physical security, technical risk, and regulatory reporting.
- Obligation mapping emits named evidence IDs, but assertion/provenance validation remains an open P0 gate before those IDs can be treated as proof.
- Blocking-gap identification with action owners expressed as concrete controls.
- Human-review decision posture: ready, conditionally ready, or not ready.
- Multi-agent trace event output for intake, delegation, evidence retrieval, retry/fallback, specialist critique, validation, learning/precedent, deterministic decisioning, and audit packaging.
- A context-aware post-council continuation contract exists, but a stale case-version defect can break the next material turn and must be fixed before this is a reliable live capability.
- Hash-chained audit records with integrity verification exist, but the hosted Vercel audit path is ephemeral `/tmp` and is not durable across instances or deployments.
- Route-level RBAC is enforced for the demo identity model. Entra-compatible validation code exists, but Entra tenant, issuer, audience, and app-role integration is not configured.
- Deployed product evidence for GPT-5.1 smart intake and Node specialists, `text-embedding-3-large` semantic retrieval, document/fixture analysis, Railway Postgres/Qdrant, admin health, and golden evals.

## Differentiators

- Starts from a working Parallax42 deployment, not a slide-only prototype.
- Keeps AI/backend boundaries server-side and avoids browser-held model keys.
- Treats deterministic fallback as a degraded mode rather than pretending fallback is live AI.
- Uses output review and blind-spot challenge concepts before presenting a decision to humans.
- Explicitly names missing evidence and escalation needs instead of forcing false precision.
- Separates hosted product AI from evaluator reproduction: the browser demo uses Vercel server-side Compass routes, while the FastAPI wrapper preserves the direct `OPENAI_API_KEY` / `OPENAI_BASE_URL` contract for `/run` diagnostics.
- Keeps the direct evaluator's Compass-compatible configuration separate from the hosted product. The hosted product is verified on the named gateway client with GPT-5.1 and `text-embedding-3-large`; deterministic behavior is a labelled fallback.
- Uses active Node specialists for advisory analysis while Python CrewAI remains optional and inactive. The Node policy engine should be the sole final authority; the deep review records an open Python authority-parity defect that must be fixed before asserting that guarantee end to end.
- Preserves the user’s case narrative across messy follow-ups: short answers are mapped to the latest visible question, spelling mistakes are clarified, high-risk contextual gates are asked before council execution, and post-council updates are auditable amendments rather than silent overwrites.

## Current Limitations

- The judge-facing product demo is online-first; local setup is a reproduction path and not the primary demo surface.
- Public online product URLs are GitHub Pages/Vercel/remote services. They should not be described as the FastAPI evaluator wrapper unless the repo Dockerfile is deployed as a public container API and `/metadata` plus official `/run` are verified.
- Direct Compass strict verification depends on a valid Compass key and the official template `OPENAI_BASE_URL=https://compass.core42.ai/v1`; the runtime also accepts `https://api.core42.ai/v1` when confirmed for the issued key. The product demo uses a separate server-side gateway boundary.
- Demo RBAC is enforced, but Entra-backed enterprise identity is not claimed until tenant, issuer, audience, app roles, and JWKS configuration are set and tested.
- Audit records are hash chained, but hosted retention is ephemeral `/tmp`; production retention needs durable tenant-scoped database records and immutable export.
- The deployed product path uses Qdrant-backed semantic memory; deterministic vectors/local storage remain fallback modes, and local/FastAPI Qdrant remains environment-dependent.
- Evidence classification, tenant isolation, decision consistency, and post-council case-version defects remain open P0 blockers; see the deep code review before relying on the demo for real decisions.
- Fixture PDF support is for generated text-based demo PDFs only, not arbitrary scanned-PDF OCR.
- Demo video is not recorded yet.
