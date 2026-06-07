# Benchmark Report

## Current Addendum: 2026-06-07

Latest pushed behavior update: commit `2215cf4 Harden post-council conversation updates`.

| Area | Current status | Evidence / boundary |
| --- | --- | --- |
| Post-council continuation | PASS | Chat retains uploaded evidence and last council result, classifies clear follow-up facts as additions/replacements, asks add-or-replace clarification for ambiguous material updates, and marks stale results pending rerun. |
| Active-question routing | PASS | Terse answers are mapped to the latest visible assistant question before stale hidden backend state; data-category answers such as `all of the above` are accepted when the visible question asks for data categories. |
| Contextual high-risk gates | PASS | Sanctions-sensitive geographies trigger sanctions/restricted-party screening without inventing export end-use certificate questions unless the case is actually export-control-related. |
| Validation | PASS | Local `npm run qa` passed with 204 unit tests, e2e mock, benchmark, and CrewAI dry-run checks. GitHub `Agentathon Preflight` and `CI` both passed for commit `2215cf4`; Agentathon Preflight included Docker smoke. |

## Prior Addendum: 2026-06-06

This addendum reflects the latest pushed submission state after the Compass model-boundary and FastAPI/public-demo documentation updates.

| Area | Current status | Evidence / boundary |
| --- | --- | --- |
| FastAPI evaluator wrapper | PASS for repo + CI/Docker proof; not public-hosted | Root `run.py` and Docker workflow verify `/health` and `/run` on port `8000`. GitHub Pages/Vercel/Railway product URLs should not be described as the FastAPI wrapper unless this repo Dockerfile is deployed there and `/metadata`, `/logs`, `/compass/probe`, and official `/run` are verified. |
| Online product runtime | PASS | Vercel `/api/health` reports Compass gateway, Qdrant-backed product evidence memory, governed learning memory, remote CrewAI service configuration, and audit-mode auth without exposing secrets. |
| Online CrewAI proof | PASS | Live smoke against `POST https://parallax42-compliance-intelligence.vercel.app/api/agent/run` with `X-Agent-Runtime: crewai_llm` returned `mode=crewai_llm_live`, `runtime.manifestSource=remote_crewai_service_llm`, `runtime.degraded=false`, `HTTP 200`, and about `81.8s` runtime. CrewAI output is advisory only. |
| Compass model boundary | DOCUMENTED | Current docs and `.env.example` use `OPENAI_BASE_URL=https://api.core42.ai/v1`, `MODEL_FAST=gpt-4.1`, `MODEL_REASONING=gpt-5.1`, `CREWAI_LLM_MODEL=gpt-5.1`, and `EMBEDDING_MODEL=text-embedding-3-large`, based on Core42 Compass API documentation. |
| Compass credential boundary | DOCUMENTED | The deployed demo uses the project owner's own Compass credentials configured server-side. The repo contains no real key and does not assume an Agentathon-issued key. Evaluators can provide their own key through `OPENAI_API_KEY`. |
| RBAC | PARTIAL | Route policy and Entra/JWKS-compatible code exist, with roles such as `platform_admin`, `risk_admin`, reviewers, `auditor`, and `read_only`. Online deployment reports `auth.mode=audit` and `auth.enforced=false`; do not claim enforced RBAC. |
| Workflow status at addendum time | IN PROGRESS for model-boundary commit, previous green | `Agentathon Preflight` and `CI` for commit `0666073` were running when checked; commit `88d1a9f` was green for both workflows. This report update may trigger a newer workflow run. |

Safe current claims:

- Agentathon FastAPI wrapper exists and is CI/Docker verified.
- Online product demo is live through GitHub Pages, Vercel APIs, Compass gateway, droplet-hosted Qdrant, and remote CrewAI advisory runtime.
- Live online CrewAI advisory path works and did not degrade in the latest smoke.
- Compass model choices and own-key boundary are documented.
- Deterministic Decision Owner remains final authority.

Unsafe current claims:

- A public FastAPI `/run` endpoint is live.
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
- Direct Compass strict verification through the FastAPI `/compass/probe` path requires valid runtime credentials. The product demo uses the project owner's server-side Compass credentials through the hosted gateway/API boundary.
- Public FastAPI hosting is not currently claimed. If the final form requires a public API URL, deploy this repo Dockerfile to a container host and verify `/health`, `/metadata`, and `/run`.

## Target Acceptance Threshold

Before submitting, the package should show:

- at least 95% pass rate on deterministic golden cases
- zero unsupported automatic approval outputs
- p95 local deterministic run latency under 500 ms
- p95 live backend no-upload run latency under an agreed operational threshold
- clear fallback labeling whenever live AI is unavailable
- no claim of public hosted FastAPI, enforced RBAC, enterprise-durable audit, or arbitrary scanned-PDF OCR unless separate checks pass
- live CrewAI can be claimed for the deployed Vercel product path only when referencing the latest online smoke evidence: `remote_crewai_service_llm`, `degraded=false`, advisory-only
