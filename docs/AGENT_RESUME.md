# Agent Resume

## Name

Parallax42 Compliance Intelligence Agent

## Mission

Strengthen compliance visibility across enterprise workflows by turning intake, policy evidence, contracts, supplier context, and reviewer feedback into traceable recommendations for human approval.

## Current Core Capabilities

- Online-first judge demo through GitHub Pages, Vercel product APIs, server-side Compass gateway/API boundary, and Ocean/DigitalOcean backend services.
- Root Agentathon evaluator wrapper: `run.py` exposes `POST /run`, `GET /health`, `GET /metadata`, `GET /logs`, and `GET /compass/probe` on port `8000`.
- FastAPI evaluator proof is currently the repository plus GitHub Actions Docker smoke, not a separate public FastAPI URL.
- Compliance-domain triage across third-party, privacy, AI/model governance, continuity, finance/project compliance, Microsoft licensing, ESG/HSE/BCM, physical security, technical risk, and regulatory reporting.
- Evidence-backed obligation mapping with named evidence IDs rather than unsupported free-form advice.
- Blocking-gap identification with action owners expressed as concrete controls.
- Human-review decision posture: ready, conditionally ready, or not ready.
- Multi-agent trace event output for intake, delegation, evidence retrieval, retry/fallback, specialist critique, validation, learning/precedent, deterministic decisioning, and audit packaging.
- Context-aware post-council continuation: follow-up chat retains uploaded evidence and the prior result, distinguishes additions from replacements for material facts, asks clarification when ambiguous, and marks stale council output for explicit rerun.
- Hash-chained audit records with integrity verification for run history and reviewer traceability.
- Route-level RBAC policy and Entra-compatible JWT validation code exist, but submitted/demo mode is audit-mode unless enterprise identity env vars are configured and verified.
- Deployed product evidence for smart intake, document/fixture analysis, Compass gateway boundary, Qdrant-backed evidence memory, admin health, and golden evals.

## Differentiators

- Starts from a working Parallax42 deployment, not a slide-only prototype.
- Keeps AI/backend boundaries server-side and avoids browser-held model keys.
- Treats deterministic fallback as a degraded mode rather than pretending fallback is live AI.
- Uses output review and blind-spot challenge concepts before presenting a decision to humans.
- Explicitly names missing evidence and escalation needs instead of forcing false precision.
- Separates hosted product AI from evaluator reproduction: the browser demo uses Vercel server-side Compass routes, while the FastAPI wrapper preserves the direct `OPENAI_API_KEY` / `OPENAI_BASE_URL` contract for `/run` diagnostics.
- Uses the documented Core42 Compass API base `https://api.core42.ai/v1` with `gpt-4.1` for fast structured work, `gpt-5.1` for deeper advisory/CrewAI specialist reasoning, and `text-embedding-3-large` for embeddings; the deployed demo uses the project owner's own server-side Compass credentials, not a committed or assumed Agentathon-issued key.
- Keeps deterministic policy as final authority; Compass, Qdrant retrieval, governed learning memory, and optional CrewAI remain advisory inputs.
- Preserves the user’s case narrative across messy follow-ups: short answers are mapped to the latest visible question, spelling mistakes are clarified, high-risk contextual gates are asked before council execution, and post-council updates are auditable amendments rather than silent overwrites.

## Current Limitations

- The judge-facing product demo is online-first; local setup is a reproduction path and not the primary demo surface.
- Public online product URLs are GitHub Pages/Vercel/remote services. They should not be described as the FastAPI evaluator wrapper unless the repo Dockerfile is deployed as a public container API and `/metadata` plus official `/run` are verified.
- Direct Compass strict verification depends on a valid Compass key and the documented `OPENAI_BASE_URL=https://api.core42.ai/v1`; the product demo uses a separate server-side gateway boundary.
- Enforced RBAC is not claimed unless production tenant, issuer, audience, and JWKS configuration are set and tested.
- Audit records are hash chained locally; production retention should use durable mounted storage or a managed database.
- The deployed product path uses Qdrant-backed evidence memory; local/FastAPI Qdrant remains environment-dependent and falls back when Qdrant or embeddings are absent.
- Fixture PDF support is for generated text-based demo PDFs only, not arbitrary scanned-PDF OCR.
- Demo video is not recorded yet.
