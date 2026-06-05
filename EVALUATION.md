# Evaluation

## How To Run QA

Run the canonical local QA suite from the repository root:

```bash
npm run qa
```

This runs syntax checks, static page checks, unit tests, local benchmarks, and CrewAI dry-run validation. The product application is a Node/CommonJS Vercel/static app, so there is no React, Vite, Redis, Postgres, or durable queue setup required for this QA path. The separate Agentathon evaluator wrapper is FastAPI/Docker-capable and is validated through the preflight commands below.

The consolidated evaluator and product architecture is documented in [`docs/AGENTATHON_SYSTEM_ARCHITECTURE.md`](docs/AGENTATHON_SYSTEM_ARCHITECTURE.md).

## Agentathon Preflight

Run the wrapper submission checks from the repository root:

```bash
python scripts/agentathon_preflight.py
python scripts/agentathon_preflight.py --run-api
python scripts/agentathon_preflight.py --run-api --npm-qa
python scripts/agentathon_preflight.py --compass-doctor
python scripts/agentathon_preflight.py --qdrant-smoke
python scripts/agentathon_preflight.py --docker
```

`--run-api` starts `python run.py`, waits for `GET /health`, posts `input_examples/example_1.json` to `/run`, validates structured JSON, and stops the server. `--docker` builds and runs the container only when Docker is installed; if the Docker CLI is missing, it reports `SKIPPED` rather than failing local validation.

CI uses `SAMPLE_MODE=true`, `OPENAI_API_KEY=dummy`, and `OPENAI_BASE_URL=https://compass.core42.ai/v1` so Docker and API shape can be verified without real secrets. The workflow installs Playwright Chromium before `npm run qa` and runs Docker smoke in a separate job so container verification is not blocked by browser QA. Final evaluation should set `SAMPLE_MODE=false`, `REQUIRE_COMPASS=true`, and supply a real Compass key through `OPENAI_API_KEY`; in that mode `/run` attempts a live Compass/OpenAI-compatible advisory review of the deterministic draft and returns a structured error if Compass is unavailable. Sample mode is fallback/testing only and still executes deterministic logic; it is not a live Compass, Qdrant, CrewAI, or enforced-RBAC claim.

Compass output is advisory only. It can contribute reviewer questions and advisory notes, but the Deterministic Decision Owner remains the final decision authority and human review remains required.

## Live Compass Boundary

The repository intentionally separates three runtime boundaries:

| Boundary | Env / URL | Used for | Why |
|---|---|---|---|
| Agentathon direct Compass | `OPENAI_API_KEY`, `OPENAI_BASE_URL=https://compass.core42.ai/v1` | FastAPI `/run`, `/compass/probe`, `scripts/compass_doctor.py`, optional Compass embeddings | Matches the evaluator-facing OpenAI-compatible contract and keeps the root `run.py` execution reproducible in Docker. |
| Product Vercel gateway | `COMPASS_GATEWAY_BASE_URL`, `COMPASS_GATEWAY_TOKEN` | Existing Node/Vercel smart intake, embeddings, hosted demo support | Keeps server-side tokens out of the browser and preserves the product runtime. It is not the Agentathon direct Compass base URL unless it exposes OpenAI-compatible `/v1` routes. |
| Product backend/droplet | `PARALLAX42_BACKEND_URL=https://api.parallax42.bhavukarora.com`, optional `P42_CREWAI_SERVICE_URL` | OCR/parser, backend relay, optional remote CrewAI/product services | Supports the richer product demo. It is not a Compass API and should not be used as `OPENAI_BASE_URL`. |

The Agentathon wrapper uses direct Compass for live advisory when available because the judging API should not depend on browser clicks, uploaded files, Vercel routing, or the droplet backend. The Node/Vercel/droplet stack remains the product vision and can demonstrate richer functionality, but the submitted `/run` path provides equivalent judgeable evidence: multi-agent collaboration, deterministic final decision ownership, advisory live-LLM boundary, RAG/learning status, and JSONL traces.

Optional Qdrant RAG evidence memory is active only when `P42_VECTOR_STORE_PROVIDER=qdrant`, `QDRANT_URL`, and the Compass embedding env vars are configured. The Agentathon `/run` path then chunks synthetic/input evidence, embeds through Compass, stores case-scoped evidence chunks in Qdrant, searches by `caseId`, and returns citation-safe snippets only. Raw embeddings are never returned. Without that configuration, `/run` reports `rag_evidence_memory.provider=local-fallback`; this fallback is not durable production RAG.

```bash
python scripts/qdrant_smoke.py
python scripts/agentathon_preflight.py --qdrant-smoke
```

Governed learning memory is enabled as an advisory Agentathon layer. It reads synthetic reviewer outcomes from `data/sample_learning_memory.json` and optional local JSONL feedback when Qdrant is not configured. If Qdrant and Compass embeddings are configured, learning artifacts are stored/retrieved as `memoryType=learning_artifact` payloads. This is not model training, not autonomous self-learning, and not policy mutation. The Deterministic Decision Owner remains final authority; learning memory can only suggest reviewer questions or controls when current evidence gaps support them.

Learning endpoints:

```bash
curl http://localhost:8000/learning/memory/status
curl -X POST http://localhost:8000/learning/similar-cases -H "Content-Type: application/json" -d '{"caseFacts":{"workflow":"healthcare analytics"},"missingEvidence":["model-training exclusion"],"domains":["privacy","ai-governance"]}'
curl -X POST http://localhost:8000/learning/control-suggestions -H "Content-Type: application/json" -d '{"caseFacts":{"workflow":"AI support-ticket classifier"},"missingEvidence":["model-training exclusion"],"domains":["ai-governance"]}'
```

Verify the official direct Compass path before final judging:

```bash
export OPENAI_API_KEY=<real Compass key>
export OPENAI_BASE_URL=https://compass.core42.ai/v1
export MODEL_FAST=gpt-4.1
export MODEL_REASONING=gpt-5.1
export EMBEDDING_MODEL=text-embedding-3-large
export SAMPLE_MODE=false
export REQUIRE_COMPASS=true
python scripts/compass_doctor.py --strict
curl http://localhost:8000/compass/probe
```

If `OPENAI_BASE_URL` is not exported, `compass_doctor.py` reports that the official default was used only for normalization and not as live proof. If `/models` returns HTML, the base URL is pointing at a frontend page, proxy, or non-OpenAI-compatible gateway. If `/chat/completions` returns `405`, the base URL/path/proxy is likely wrong or the gateway does not expose direct OpenAI-compatible routes. The optional Parallax42 gateway uses `COMPASS_GATEWAY_BASE_URL` and `COMPASS_GATEWAY_TOKEN`; it must not be confused with the official Agentathon `OPENAI_BASE_URL=https://compass.core42.ai/v1`.

Regenerate Agentathon output artifacts after changing the `/run` path:

```bash
python scripts/regenerate_agentathon_artifacts.py
python scripts/agentathon_preflight.py
```

The regeneration script executes the actual orchestrator for the three canonical input examples, writes `output_examples/example_1_output.json` through `example_3_output.json`, copies stable matching traces to `logs/example_1_trace.jsonl` through `logs/example_3_trace.jsonl`, and refreshes `logs/demo_trace.jsonl`. Preflight verifies that each output example's `trace_id` exists in its referenced `log_file`.

For UI or demo-flow changes, add a human browser check on top of `npm run qa`: verify that the chat is usable, evidence states are visible, the decision room renders a business-first memo, and technical trace details are behind progressive disclosure. The intended validation split is visual, functional, and output quality:

- Visual: no blank first-viewport states, clipped labels, or overlapping right-rail content.
- Functional: chat intake, upload, council run, and export controls still work.
- Output quality: the decision room shows decision, rationale, risks, evidence, agent pairings, human actions, stop conditions, and raw technical details only after expansion.

## Live Local/Hosted Consistency Check

Run this only when `.env.local` contains the same server-side values used by the hosted demo:

```bash
npm run qa:live
```

This starts a local `server.js` instance, verifies local `/api/health` and `/api/admin/status`, checks the local `/api/backend` relay against the DigitalOcean backend, checks the Vercel Compass gateway health route, confirms Qdrant configuration, and sends one real smart-intake request through Compass GPT-5.1. It is intentionally not part of `npm run qa` because it is networked and can spend gateway tokens.

## Unit Tests

Run unit tests only:

```bash
npm test
```

The unit tests cover the Node library and API-adjacent behavior under `tests/unit/`. They are the fastest check when changing `lib/`, API handlers, or export/retrieval behavior.

The decision-room and review-pack tests also assert the governed agent loop: L2 autonomy, agentic pairings, 0-9 quality rubric, separated memory lanes, and human stop conditions. These tests are meant to keep the hackathon story tied to real packaged artifacts rather than only UI copy.

## Benchmarks

Run the benchmark script:

```bash
npm run benchmark
```

The benchmark is a local deterministic evaluation of representative compliance cases. It is intended to prove repeatable behavior, latency envelope, decision readiness, and blocker/control generation for the current engine.

## Qdrant RAG Smoke

Run the Qdrant smoke test only after configuring the server-side Compass gateway and Qdrant variables:

```bash
npm run qdrant:smoke
```

The smoke test indexes a tiny synthetic compliance evidence text, searches it, verifies at least one match, and reports provider, collection, indexed chunk count, and match count. If Qdrant is not configured, it reports a skipped result instead of pretending full RAG is active.

## Governance Reference Index

Seed the sanitized governance-reference corpus after configuring the embedding boundary:

```bash
npm run reference:index
```

This indexes `reference_context/sanitised_enterprise_ai_governance_context.md` as advisory `governance_reference` chunks. It is separate from case evidence and governed learning memory, and search responses return safe snippets/citations only.

## CrewAI Dry-Run Checks

Run the CrewAI validation path:

```bash
npm run check:crewai
```

CrewAI is dry-run/orchestration-shaped by default. These checks validate the scaffolded crew and flow manifests without making CrewAI the source of final compliance decisions. The deterministic compliance engine remains authoritative.

Optional live CrewAI for the Agentathon FastAPI wrapper is disabled by default and is not installed in the default Docker dependency set. To validate it separately, install `requirements-crewai.txt` and run `/run` with:

```text
AGENT_RUNTIME=crewai_live
CREWAI_ENABLE_LIVE_LLM=1
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
```

When this path actually executes, `/run` includes `output.live_advisory.runtime=crewai_live` and `output.live_advisory.status=available`. If CrewAI import or execution fails, the wrapper records `status=unavailable` and continues through the custom deterministic orchestrator. CrewAI output is advisory only and cannot override the Deterministic Decision Owner.

## Golden Demo Evidence

Regenerate judge-facing evidence artifacts:

```bash
npm run capture:evidence
```

The generated snapshots are written under `evidence/`, including readiness, live health, benchmark, golden demo, and sample run artifacts. These files are useful for packaging a submission and showing that the current demo can be replayed.

## Known Limitations

- Compass gateway LLM and embedding calls require server-side environment configuration; the Agentathon non-sample path attempts a live advisory call when credentials are present.
- Local vector storage is the default; Qdrant REST is optional only when configured.
- Governed learning memory is advisory precedent storage, not model retraining.
- Optional live CrewAI advisory specialists for the Agentathon wrapper require `AGENT_RUNTIME=crewai_live`, `CREWAI_ENABLE_LIVE_LLM=1`, optional CrewAI dependencies, and server-side Compass credentials; final decisions remain deterministic.
- Local OCR/document parsing is not implemented in this repository.
- Audit is local append-only hash-chained JSONL, not managed durable storage.
- Production Redis, Postgres, durable queues, and OpenClaw are not implemented or claimed; FastAPI and Docker are limited to the Agentathon evaluator wrapper.
- Human approval remains required; the agent does not auto-approve operational compliance decisions.
