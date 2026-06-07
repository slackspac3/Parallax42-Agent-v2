# FRESH_BENCHMARK_REPORT

Generated from `/Users/bhavuk.arora/Parallax42-Agentathon-Online-Clone` on 2026-06-07.

This report is clone-specific. It treats `slackspac3/Parallax42-Agentathon-Online-Clone` as the submitted Agentathon repository and does not rely on the original `Parallax42-Compliance-Intelligence-Agent` repository for evaluator claims.

## 1. Repository And CI Snapshot

| Item | Status | Evidence |
|---|---|---|
| Submitted clone repo | PASS | `https://github.com/slackspac3/Parallax42-Agentathon-Online-Clone` |
| Product cockpit | PASS | `https://slackspac3.github.io/Parallax42-Agentathon-Online-Clone/` returned HTTP 200. |
| Latest visible pushed commit before this update | `bd274fd` | `bd274fd Add strict Compass proof to preflight`; the submitted-state commit is the commit containing this clone-readiness update after push. |
| Working tree before this update is pushed | MODIFIED | This report, readiness docs, clone links, `.env.example`, workflow, Compass diagnostics, and preflight checks are part of the clone-readiness update. Use the CI run created after this commit is pushed as submitted-state proof. |
| Agentathon Preflight workflow | PASS on latest visible pushed commit before this update | Run `27093401770`, conclusion `success`, head SHA `bd274fd52913da645c69b7d182a773f871325f06`. |
| Docker smoke in workflow | PASS | Job `docker-smoke` succeeded: metadata validation, Docker build, container `/health`, and `/run` smoke. |
| CI workflow | PASS on latest visible pushed commit before this update | Run `27093401771`, conclusion `success`; job `test` ran `npm run qa`. |

Note: the latest remote CI status listed here is for the latest pushed commit visible before this clone-readiness update. After pushing this update, use the next clone workflow run as the exact submitted-state proof.

## 2. Commands Run

```bash
git status --short --branch
git log -1 --oneline
npm run qa
python scripts/agentathon_preflight.py
python scripts/agentathon_preflight.py --run-api
python scripts/fixture_demo_matrix.py
python scripts/compass_doctor.py --json
python scripts/qdrant_smoke.py
python -m json.tool metadata.json
gh run list --repo slackspac3/Parallax42-Agentathon-Online-Clone --workflow agentathon-preflight.yml --limit 3
gh run list --repo slackspac3/Parallax42-Agentathon-Online-Clone --workflow ci.yml --limit 3
```

## 3. Local Validation Results

| Check | Result | Evidence |
|---|---|---|
| `npm run qa` | PASS | Syntax check passed for 169 JS files; static checks passed; submission check passed; 204 unit tests passed; Playwright advisor regression mock passed; benchmark `4/4 passed`; CrewAI dry-run passed. |
| `python scripts/agentathon_preflight.py` | PASS | Required files, metadata, `.env.example`, examples, logs, secret scan, and static data size all passed. |
| `python scripts/agentathon_preflight.py --run-api` | PASS | `/health` and `/run` passed in 0.65s; `/run` returned `status=success`. |
| `python scripts/fixture_demo_matrix.py` | PASS | Six synthetic fixture PDFs produced domain-appropriate outputs; `FIXTURE_DEMO_MATRIX=PASS`. |
| `python -m json.tool metadata.json` | PASS | Metadata is valid JSON and declares Use Case 21. |
| `python scripts/compass_doctor.py --json` | SKIPPED locally | `OPENAI_BASE_URL` was not exported in the local shell; no live Compass proof is claimed from local env. |
| `python scripts/qdrant_smoke.py` | SKIPPED locally | Live Qdrant/Compass embedding env vars were not exported; local FastAPI path remains `local-fallback`. |

## 4. Current Compass Status

Safe claim:

```text
The clone includes the official Agentathon Compass environment contract and runtime code that accepts both `https://compass.core42.ai/v1` and the alternate `https://api.core42.ai/v1` when Core42/Agentathon confirms it for the issued key. Live Compass is advisory only; deterministic policy remains final decision authority.
```

Local command status:

```text
COMPASS_DOCTOR=SKIPPED
Reason: OPENAI_BASE_URL not exported locally.
```

CI status:

- The latest pushed clone workflow `27093401770` passed strict Compass doctor because a secret was available at that time.
- The workflow is now changed so strict Compass runs only when `OPENAI_API_KEY` secret exists. If the secret is absent, CI prints `Strict Compass skipped because OPENAI_API_KEY secret is not configured.`

Public evaluator status from Railway, validated separately on 2026-06-07:

```text
https://agentathon-evaluator-api-production.up.railway.app/compass/probe
ok=true
live_compass_verified=true
model=gpt-4.1
reasoning_model=gpt-4.1
```

This is a live deployment claim, not a committed-secret claim. No API key is committed to this repository.

## 5. Current Qdrant Status

Safe claim:

```text
Qdrant is optional and environment-dependent for the clone evaluator path. Without Qdrant env vars, `/run` uses local-fallback evidence memory and returns sanitized evidence snippets. The product path may use hosted Qdrant only when server-side credentials are configured.
```

Local command status:

```text
QDRANT_SMOKE=SKIPPED
Reason: Missing P42_VECTOR_STORE_PROVIDER=qdrant, QDRANT_URL, and OPENAI_BASE_URL.
```

Unsafe claim:

```text
Do not claim durable Qdrant persistence is active in this clone's local/FastAPI evaluator path unless `python scripts/qdrant_smoke.py` passes with real Qdrant and embedding env vars.
```

## 6. Safe Claims

- This clone is the submitted repository: `https://github.com/slackspac3/Parallax42-Agentathon-Online-Clone`.
- The clone Pages cockpit is deployed: `https://slackspac3.github.io/Parallax42-Agentathon-Online-Clone/`.
- Root `run.py` exposes the evaluator API on port `8000`.
- `POST /run` accepts JSON and returns structured JSON with `status`, `output`, `agents`, `agent_trace`, `trace_id`, `log_file`, and execution time.
- Docker smoke passes in GitHub Actions on the latest pushed clone commit.
- Local preflight, API preflight, fixture matrix, metadata parse, and `npm run qa` passed after the clone-readiness edits.
- Multi-agent traces show delegation, retry/refinement, critique, validation, escalation, shared context, deterministic decision ownership, and audit packaging.
- Compass is advisory only.
- CrewAI live execution is optional and not claimed by default; dry-run manifests pass.
- RBAC enforcement is not claimed unless explicitly configured and verified.
- Qdrant is not claimed active for local/FastAPI evaluator runs without env-backed smoke proof.

## 7. Unsafe Claims To Avoid

- The original `Parallax42-Compliance-Intelligence-Agent` repo is the submitted repo.
- GitHub Pages is the FastAPI evaluator API.
- Vercel product APIs are the official evaluator `/run` endpoint.
- Compass/CrewAI autonomously approve cases.
- Live CrewAI is active in the default Docker build.
- RBAC is enforced online by default.
- Qdrant persistence is active in the clone evaluator path without passing live Qdrant smoke.
- Production persistence, durable queues, Postgres, Redis, or automatic legal approval are implemented.
- Secrets are committed or required at build time.

## 8. Score Estimate

| Category | Estimate | Basis |
|---|---:|---|
| Required repo structure | 10/10 | Required files, examples, logs, metadata, Dockerfile, and scripts are present. |
| Standard evaluator API | 10/10 | Local API preflight passed; Docker smoke passes in clone CI. |
| Docker reproducibility | 9/10 | CI Docker build and smoke pass; local Docker was not rerun in this environment. |
| Multi-agent evidence | 9/10 | Traces show non-linear collaboration patterns and distinct agent roles. |
| Compass integration | 8/10 | Runtime and public Railway proof pass; local command skipped without exported env; strict CI is now optional unless secret exists. |
| Secrets hygiene | 10/10 | No real secrets committed; `.env.example` uses placeholders only. |
| Qdrant / persistence honesty | 8/10 | Optional path is documented and skipped locally without env; no unsupported persistence claim. |
| Submission clarity | 9/10 | Clone links and readiness docs now distinguish clone submission from original product lineage. |

Estimated automated-readiness range: **88-92%** after this clone-readiness commit is pushed, assuming the next clone CI run remains green.
