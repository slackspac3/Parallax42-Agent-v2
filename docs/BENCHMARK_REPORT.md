# Benchmark Report

> **Historical evidence snapshot.** This report preserves an earlier repository and deployment assessment; it is not current operational guidance. See the [current deep code review](DEEP_CODE_REVIEW.md) and [Azure migration plan](AZURE_MIGRATION_PLAN.md).

## Current Clone Addendum: 2026-06-07

This document is clone-specific for `https://github.com/slackspac3/Parallax42-Agentathon-Online-Clone`. The authoritative fresh benchmark snapshot is also recorded in `FRESH_BENCHMARK_REPORT.md`, and the submission checklist is in `CLONE_SUBMISSION_READINESS.md`.

| Area | Current clone status | Evidence / boundary |
| --- | --- | --- |
| Submitted repository | PASS | `https://github.com/slackspac3/Parallax42-Agentathon-Online-Clone` is the repo to submit, not the original product repository. |
| Product cockpit | PASS | `https://slackspac3.github.io/Parallax42-Agentathon-Online-Clone/` is the clone Pages cockpit. |
| Evaluator API contract | PASS | Local and CI Docker smoke verify `/health`, `/metadata`, `/logs`, `/compass/probe`, and `POST /run`; v2 does not claim a public evaluator deployment. |
| Latest validated pushed implementation commit | `f4c71bd` | `f4c71bd Add field-aware conversation question metadata`; Agentathon Preflight run `27098986398`, CI run `27098986405`, and Pages run `27098986372` passed. |
| Local validation | PASS | `npm run qa`, `python scripts/agentathon_preflight.py`, `python scripts/agentathon_preflight.py --run-api`, `python scripts/fixture_demo_matrix.py`, and `python -m json.tool metadata.json` passed for the latest implementation state; rerun after docs-only edits if needed. |
| Docker smoke | PASS | Agentathon Preflight run `27098986398` included passing `agentathon-preflight` and `docker-smoke` jobs for commit `f4c71bd`. |
| Compass | OPTIONAL / ADVISORY | `.env.example` uses the official Agentathon template `OPENAI_BASE_URL=https://compass.core42.ai/v1`; runtime also accepts `https://api.core42.ai/v1` when confirmed for the issued key. The public v2 demo does not claim live Compass until a rotated credential passes strict verification. |
| Qdrant | OPTIONAL / ENV-DEPENDENT | Deployed product evidence APIs may use server-side Qdrant. Local/FastAPI evaluator runs do not claim active Qdrant unless `python scripts/qdrant_smoke.py` passes with real env vars. |
| CrewAI | DRY-RUN BY DEFAULT | CrewAI manifests and dry-run checks pass; live CrewAI is optional and not part of the default Docker dependency set. |
| RBAC | AUDIT / NOT ENFORCED BY DEFAULT | RBAC/JWT scaffolding exists, but enforced RBAC is not a clone submission claim without configured tenant/JWKS proof. |

Safe clone claims: root `run.py` implements `/run`; deterministic policy owns the final decision; Compass, Qdrant retrieval, learning memory, and optional CrewAI are advisory; no secrets are committed.

Unsafe clone claims: the original repo is the submitted repo; GitHub Pages or Vercel is the official evaluator `/run`; live CrewAI is active by default; Qdrant is active in local/FastAPI without smoke proof; RBAC or production persistence is enforced by default; the official Compass placeholder host is live in every environment.

## Conversation Behavior Addendum: 2026-06-07

Latest pushed behavior update: commit `f4c71bd Add field-aware conversation question metadata`.

| Area | Current status | Evidence / boundary |
| --- | --- | --- |
| Post-council continuation | PASS | Chat retains uploaded evidence and last council result, classifies clear follow-up facts as additions/replacements, asks add-or-replace clarification for ambiguous material updates, and marks stale results pending rerun. |
| Active-question routing | PASS | Terse answers are mapped to stable active question IDs and fields before falling back to visible-question prose; regression coverage includes review-focus answers such as `all of them` and hosting-model answers such as `shared saas environment`. |
| Contextual high-risk gates | PASS | Sanctions-sensitive geographies trigger sanctions/restricted-party screening without inventing export end-use certificate questions unless the case is actually export-control-related. |
| Validation | PASS | Local `npm run qa` passed with 207 unit tests, e2e mock, benchmark, and CrewAI dry-run checks before this docs refresh. GitHub `Agentathon Preflight` run `27098986398` and `CI` run `27098986405` both passed for commit `f4c71bd`; Agentathon Preflight included Docker smoke. |

## Prior Addendum: 2026-06-06

This addendum reflects the latest pushed submission state after the Compass model-boundary and FastAPI/public-demo documentation updates.

| Area | Current status | Evidence / boundary |
| --- | --- | --- |
| FastAPI evaluator wrapper | PASS for repo + CI/Docker proof; not public-hosted | Root `run.py` and Docker workflow verify `/health` and `/run` on port `8000`. GitHub Pages/Vercel/Railway product URLs should not be described as the FastAPI wrapper unless this repo Dockerfile is deployed there and `/metadata`, `/logs`, `/compass/probe`, and official `/run` are verified. |
| Online product runtime | PENDING DEPLOY | Vercel `/api/health` must report enforced demo auth, isolated Postgres/Qdrant, deterministic demo embeddings, and optional capabilities without exposing secrets. |
| Online CrewAI proof | PASS | Live smoke against `POST https://parallax42-compliance-intelligence.vercel.app/api/agent/run` with `X-Agent-Runtime: crewai_llm` returned `mode=crewai_llm_live`, `runtime.manifestSource=remote_crewai_service_llm`, `runtime.degraded=false`, `HTTP 200`, and about `81.8s` runtime. CrewAI output is advisory only. |
| Compass model boundary | DOCUMENTED | Current docs and `.env.example` use the official template `OPENAI_BASE_URL=https://compass.core42.ai/v1`, while runtime also accepts `https://api.core42.ai/v1` when confirmed for the issued key. Model placeholders remain `MODEL_FAST=gpt-4.1`, `MODEL_REASONING=gpt-5.1`, `CREWAI_LLM_MODEL=gpt-5.1`, and `EMBEDDING_MODEL=text-embedding-3-large`. |
| Compass credential boundary | DOCUMENTED | The deployed public demo uses no live Compass claim. The repo contains no real key; evaluators or operators can provide a rotated key server-side through `OPENAI_API_KEY` or the gateway token. |
| RBAC | PARTIAL | Route policy and Entra/JWKS-compatible code exist, with roles such as `platform_admin`, `risk_admin`, reviewers, `auditor`, and `read_only`. Online deployment reports `auth.mode=audit` and `auth.enforced=false`; do not claim enforced RBAC. |
| Workflow status at addendum time | IN PROGRESS for model-boundary commit, previous green | `Agentathon Preflight` and `CI` for commit `0666073` were running when checked; commit `88d1a9f` was green for both workflows. This report update may trigger a newer workflow run. |

Safe current claims:

- Agentathon FastAPI wrapper exists and is CI/Docker verified.
- Online product demo targets GitHub Pages, Vercel APIs, isolated Railway Postgres/Qdrant, deterministic retrieval, and optional Compass/CrewAI advisory paths.
- CrewAI adapters pass dry-run validation; no live public CrewAI claim is made.
- Compass model choices and own-key boundary are documented.
- Deterministic Decision Owner remains final authority.

Unsafe current claims:

- A public v2 FastAPI `/run` endpoint is live.
- Railway/Ocean/Vercel product endpoints are the FastAPI evaluator wrapper.
- RBAC is enforced online.
- CrewAI or Compass can approve cases autonomously.

## Baseline Evidence Already Available

Parallax42 deterministic golden-case evals passed:

```text
20/20 cases passed
100% pass rate
15/15 checks per case
```

Covered case themes include:

- high-risk AI SaaS missing DPA
- model-training exclusion gaps
- SOW continuity and exit gaps
- MSA liability and audit-rights gaps
- low-risk SaaS with no PII
- cross-border transfer uncertainty
- strong DPA/SOW evidence
- ambiguous contract type
- applicability decisions for AI, privacy, continuity, and low-criticality cases

## This Repo Baseline

Current checks cover:

- empty-case blocking
- AI/privacy/continuity/third-party detection
- ready or conditionally ready decision behavior
- online product health/Qdrant proof through Vercel product APIs
- Agentathon wrapper shape through `scripts/agentathon_preflight.py`
- Docker `/health` and `/run` smoke through GitHub Actions
- multi-agent traces with delegation, retry/fallback, critique, validation, escalation, and deterministic final ownership

Run:

```bash
npm run qa
npm run capture:evidence
python scripts/agentathon_preflight.py
python scripts/agentathon_preflight.py --run-api
```

Generated benchmark output is written to `evidence/benchmark-report.json`.

## Missing Before Submission

- Broader latency report for `POST /api/agent/run` across local and Vercel API surfaces.
- Live Parallax42 backend latency and fallback-rate report.
- Upload/OCR throughput report.
- Responsible AI test suite against prompt injection, unsupported approval language, bias-sensitive assumptions, and data minimization.
- Reliability run showing repeated executions with trace and decision consistency.
- Demo video still needs to be recorded and linked.
- Direct Compass strict verification through the FastAPI `/compass/probe` path requires valid rotated runtime credentials. The public product demo uses labelled deterministic retrieval until those credentials are configured.
- The evaluator contract is verified locally and by CI Docker smoke. Do not substitute GitHub Pages, Vercel, or product persistence services for a public FastAPI evaluator URL.

## Target Acceptance Threshold

Before submitting, the package should show:

- at least 95% pass rate on deterministic golden cases
- zero unsupported automatic approval outputs
- p95 local deterministic run latency under 500 ms
- p95 live backend no-upload run latency under an agreed operational threshold
- clear fallback labeling whenever live AI is unavailable
- no claim of GitHub Pages/Vercel as FastAPI, enforced RBAC, enterprise-durable audit, Qdrant in every evaluator path, or arbitrary scanned-PDF OCR unless separate checks pass
- live CrewAI can be claimed for the deployed Vercel product path only when referencing the latest online smoke evidence: `remote_crewai_service_llm`, `degraded=false`, advisory-only
