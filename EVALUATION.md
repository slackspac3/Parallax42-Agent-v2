# Evaluation

## Primary Online Evaluation

Start with the online GitHub evidence rather than a local checkout:

| Online item | Link | What to verify |
| --- | --- | --- |
| Repository | <https://github.com/slackspac3/Parallax42-Agentathon-Online-Clone> | Root `run.py`, `Dockerfile`, `metadata.json`, examples, logs, and docs are present on `main`. |
| GitHub Pages cockpit | <https://slackspac3.github.io/Parallax42-Agentathon-Online-Clone/> | Static product cockpit loads and uses hosted product routes from `public/config.js`. |
| Public evaluator API | <https://agentathon-evaluator-api-production.up.railway.app> | Public FastAPI wrapper from this clone exposes `/health`, `/metadata`, `/logs`, `/compass/probe`, and `/run` as JSON endpoints. |
| Vercel product API | <https://parallax42-compliance-intelligence.vercel.app/api/health> | Hosted runtime reports Compass gateway, Qdrant-backed evidence memory, parser relay, learning memory, and advisory runtime status without exposing secrets. |
| Agentathon Preflight | <https://github.com/slackspac3/Parallax42-Agentathon-Online-Clone/actions/workflows/agentathon-preflight.yml> | Latest `main` run passes both `agentathon-preflight` and `docker-smoke`. This is the online Docker plus `/health` and `/run` proof. |
| CI | <https://github.com/slackspac3/Parallax42-Agentathon-Online-Clone/actions/workflows/ci.yml> | Latest `main` run passes `npm run qa`. |
| Architecture | <https://github.com/slackspac3/Parallax42-Agentathon-Online-Clone/blob/main/docs/AGENTATHON_SYSTEM_ARCHITECTURE.md> | Online-first evaluator path, product path, and runtime boundaries are documented. |

GitHub Pages is a static cockpit and does not host the FastAPI evaluator API. The public evaluator API is the Railway deployment at `https://agentathon-evaluator-api-production.up.railway.app`. The separate `docker-smoke` job in the Agentathon Preflight workflow remains the reproducibility proof: it builds the Docker image, starts the container on port `8000`, calls `GET /health`, and posts `input_examples/example_1.json` to `/run`.

The online product demo uses Vercel for server-side product APIs and the Compass gateway, plus the DigitalOcean/Ocean droplet for backend services. Qdrant is running on the droplet behind Nginx at `https://api.parallax42.bhavukarora.com/qdrant/`; that endpoint requires an API key and returns `401 Unauthorized` without one. Vercel stores the Qdrant key as an encrypted environment variable and exposes only safe evidence index/search responses to the browser.

Final submission positioning: the judge-facing product demo is online-first. The GitHub Pages cockpit calls Vercel product APIs, which keep Compass, Qdrant, and backend service credentials server-side. The public evaluator API is Railway; the local Docker/FastAPI path remains the evaluator reproduction path for `run.py`, `/health`, `/metadata`, `/logs`, `/compass/probe`, and `/run`. Compass and retrieval outputs are advisory; the Deterministic Decision Owner remains final authority.

The hosted chat also supports post-council continuation. If a user adds new material context after a council result, the app retains the uploaded fixture/evidence and prior result, records whether the new answer is an addition or replacement, and marks the old result pending rerun when needed. Ambiguous changes such as a terse new geography ask an add-or-replace clarification before the case is mutated. This is a product demo behavior; the Agentathon `/run` evaluator path remains a single non-interactive request/response contract.

### FastAPI Evaluator Status

The submitted repository includes the required FastAPI evaluator surface, but the public browser demo is not served by FastAPI.

| Question | Current answer |
| --- | --- |
| Does the repo include root `run.py`? | Yes. |
| Does `run.py` expose the required evaluator API on port `8000`? | Yes; verified locally/preflight and by CI Docker smoke. |
| Is the FastAPI wrapper publicly hosted at the GitHub Pages URL? | No. GitHub Pages is static. |
| Is the FastAPI wrapper publicly hosted at the Vercel product API URL? | No. Vercel hosts the Node/CommonJS product APIs. |
| Is the public Railway URL the Agentathon FastAPI wrapper? | Yes. `https://agentathon-evaluator-api-production.up.railway.app` exposes this repo's `/health`, `/metadata`, `/logs`, `/compass/probe`, and `/run` JSON schema. |
| Is the Ocean/droplet backend the Agentathon FastAPI wrapper? | No. Treat Ocean/droplet URLs as product/backend services unless they expose this repo's evaluator schema. |
| What is the online proof for FastAPI today? | Railway public API plus the GitHub Actions `agentathon-preflight.yml` Docker smoke job on `main`. |

Judging risk: low, provided the form uses the Railway evaluator API URL for the API field and the GitHub Pages URL only for the product demo field. Recheck Railway immediately before submitting.

Online Qdrant proof path:

```bash
curl https://parallax42-compliance-intelligence.vercel.app/api/health

curl -X POST https://parallax42-compliance-intelligence.vercel.app/api/evidence/index \
  -H "Content-Type: application/json" \
  -d '{"caseId":"judge-online-qdrant-smoke","documents":[{"evidenceId":"judge-smoke-001","title":"Synthetic Qdrant Smoke Evidence","text":"The vendor is prohibited from using customer data for model training. The DPA lists subprocessors and a 30-day deletion SLA."}]}'

curl -X POST https://parallax42-compliance-intelligence.vercel.app/api/evidence/search \
  -H "Content-Type: application/json" \
  -d '{"caseId":"judge-online-qdrant-smoke","query":"model training exclusion subprocessors deletion SLA","topK":3}'
```

Expected indicators are `provider=qdrant`, `storage=server_side_qdrant_vector_db`, `collection=p42_compliance_evidence`, `model=text-embedding-3-large`, `browserEmbeddingsRetained=false`, and at least one sanitized match.

Online continuation smoke:

1. Run any case through the product council.
2. Continue the chat with `I want to deploy this in Syria as well`.
3. Confirm the right rail shows `Case updated after council`, prior evidence remains attached, sanctions/restricted-party screening becomes the next contextual gate, and the prior council result is marked for rerun.
4. Repeat with a terse ambiguous answer such as `Syria`; the expected behavior is an add-or-replace clarification rather than a silent overwrite.

## Secondary Local QA

Run the canonical local QA suite from the repository root only when reproducing or extending the online checks:

```bash
npm run qa
```

This runs syntax checks, static page checks, unit tests, local benchmarks, and CrewAI dry-run validation. The product application is a Node/CommonJS Vercel/static app, so there is no React, Vite, Redis, Postgres, or durable queue setup required for this QA path. The separate Agentathon evaluator wrapper is FastAPI/Docker-capable and is validated through the preflight commands below.

The consolidated evaluator and product architecture is documented in [`docs/AGENTATHON_SYSTEM_ARCHITECTURE.md`](docs/AGENTATHON_SYSTEM_ARCHITECTURE.md).

## Secondary Local Agentathon Preflight

Run the wrapper submission checks from the repository root when reproducing CI locally:

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

## Compass Model And Credential Boundary

The current Compass configuration keeps the official Agentathon template first and allows the alternate Core42 public API base only when Core42/Agentathon confirms it for the issued key. The repo placeholder defaults to:

```text
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
EMBEDDING_MODEL=text-embedding-3-large
CREWAI_LLM_MODEL=gpt-5.1
```

Why this split is used:

- `gpt-4.1` is the fast/default model for structured intake, JSON advisory tasks, and lower-latency checks.
- `gpt-5.1` is the reasoning/advisory model for deeper specialist council output, CrewAI live advisory analysis, and final advisory review.
- `text-embedding-3-large` is the embedding model for evidence chunks, reference memory, governed learning memory, and Qdrant search.

The deployed online product demo uses the project owner's own Compass credentials configured server-side in Vercel/gateway settings. It does not rely on a committed key and does not assume an Agentathon-provided key is available. If evaluators provide a Compass key, they can set `OPENAI_API_KEY` with the official template `OPENAI_BASE_URL=https://compass.core42.ai/v1`, or use `https://api.core42.ai/v1` if that base is confirmed for the issued key. Compass is the runtime provider for LLM/embedding calls, not the source of legal/compliance/security authority.

Reference intelligence is separate from Compass. Compass is the server-side LLM and embedding runtime used to analyze, summarize, critique, and retrieve. It is not a legal, compliance, security, sanctions, export-control, procurement, HSE, or ESG source of truth. The current reference-source map is recorded in `reference_context/reference_memory_manifest.json` and includes expanded official/public anchors for NIST, EU, OECD, ISO, Singapore, UAE, OFAC, BIS, UN/EU sanctions, CourtListener, SEC EDGAR, procurement/debarment, and HSE/ESG references. UAE-specific anchors are included for AI strategy/ethics, data protection, DIFC/ADGM privacy, cybersecurity, export-control/non-proliferation, AML/CFT and targeted financial sanctions, procurement, environment, and workforce context.

Future roadmap: a governed knowledge connector API should allow approved live sources such as case-law APIs, sanctions lists, export-control lists, regulatory guidance, procurement/debarment datasets, and internal policy registers to refresh advisory memory with source hashes, parser versions, reviewer status, and correction history. That connector API is not claimed as complete in this submission.

## Live Compass Boundary

The repository intentionally separates three runtime boundaries:

| Boundary | Env / URL | Used for | Why |
|---|---|---|---|
| Agentathon direct Compass | `OPENAI_API_KEY`, `OPENAI_BASE_URL=https://compass.core42.ai/v1` | FastAPI `/run`, `/compass/probe`, `scripts/compass_doctor.py`, optional Compass embeddings | Uses the official Agentathon template first. Runtime also accepts `https://api.core42.ai/v1` when confirmed for the issued key. |
| Product Vercel gateway | `COMPASS_GATEWAY_BASE_URL`, `COMPASS_GATEWAY_TOKEN` | Existing Node/Vercel smart intake, embeddings, hosted demo support | Keeps server-side tokens out of the browser and preserves the product runtime. It is not the Agentathon direct Compass base URL unless it exposes OpenAI-compatible `/v1` routes. |
| Product backend/droplet | `PARALLAX42_BACKEND_URL=https://api.parallax42.bhavukarora.com`, optional `P42_CREWAI_SERVICE_URL` | OCR/parser, backend relay, optional remote CrewAI/product services | Supports the richer product demo. It is not a Compass API and should not be used as `OPENAI_BASE_URL`. |
| Product Qdrant memory | Vercel encrypted `P42_VECTOR_STORE_PROVIDER=qdrant`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION` | Online product evidence indexing/search and governed memory surfaces | Qdrant runs on the droplet and is used by Vercel server-side product APIs. The browser never receives Qdrant keys or raw embeddings. |

The Agentathon wrapper uses direct Compass for live advisory when available because the judging API should not depend on browser clicks, uploaded files, Vercel routing, or the droplet backend. The Node/Vercel/droplet stack remains the product vision and can demonstrate richer functionality, but the submitted `/run` path provides equivalent judgeable evidence: multi-agent collaboration, deterministic final decision ownership, advisory live-LLM boundary, RAG/learning status, and JSONL traces.

Qdrant RAG evidence memory is verified active in the deployed online product path: Vercel product APIs index/search through the droplet-hosted Qdrant collection `p42_compliance_evidence` using Compass-compatible embeddings and return citation-safe snippets only. For the local FastAPI Agentathon wrapper, Qdrant remains env-dependent: when `P42_VECTOR_STORE_PROVIDER=qdrant`, `QDRANT_URL`, `QDRANT_API_KEY`, and embedding env vars are exported, `/run` chunks synthetic/input evidence, embeds it, stores case-scoped chunks in Qdrant, searches by `caseId`, and returns sanitized snippets. Without local Qdrant or embeddings, `/run` reports `rag_evidence_memory.provider=local-fallback`; this fallback is not durable production RAG.

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

If `OPENAI_BASE_URL` is not exported, `compass_doctor.py` reports that the default was used only for normalization and not as live proof. The active placeholder is `https://compass.core42.ai/v1`. The alternate `https://api.core42.ai/v1` is accepted by the runtime when Core42/Agentathon confirms it for the issued key. If `/models` returns HTML, the base URL is pointing at a frontend page, proxy, or non-OpenAI-compatible gateway. If `/chat/completions` returns `405`, the base URL/path/proxy is likely wrong or the gateway does not expose direct OpenAI-compatible routes. The optional Parallax42 gateway uses `COMPASS_GATEWAY_BASE_URL` and `COMPASS_GATEWAY_TOKEN`; it must not be confused with the Agentathon direct `OPENAI_BASE_URL`.

Regenerate Agentathon output artifacts after changing the `/run` path:

```bash
python scripts/regenerate_agentathon_artifacts.py
python scripts/agentathon_preflight.py
```

The regeneration script executes the actual orchestrator for the three canonical input examples, writes `output_examples/example_1_output.json` through `example_3_output.json`, copies stable matching traces to `logs/example_1_trace.jsonl` through `logs/example_3_trace.jsonl`, and refreshes `logs/demo_trace.jsonl`. Preflight verifies that each output example's `trace_id` exists in its referenced `log_file`.

## Fixture Contract Demo Inputs

Six synthetic text-based PDFs are available under `test-fixtures/compliance-documents/` for the cockpit and `/run` demos. They cover enterprise SaaS, DPA/cross-border terms, AI accelerator import/export controls, managed platform integration, media/audience analytics, and cloud AI model services. They are generated fixtures, not real contracts, and are safe for public demo use.

The product cockpit can recognize these fixture PDFs by filename and enrich the evidence draft with provider, service summary, detected domain, missing evidence signals, and risk domains. The Agentathon wrapper also accepts fixture references without browser upload:

```json
{
  "input": {
    "query": "Can we approve this vendor?",
    "documents": [
      { "filename": "06_cloud_ai_model_services_statement_of_work.pdf" }
    ]
  }
}
```

The fixture resolver only reads manifest-listed files below `test-fixtures/compliance-documents/`. It rejects path traversal and hosted Vercel/Railway/dashboard URLs. PDF extraction is limited to these generated text-based fixtures; this is not arbitrary scanned-PDF OCR.

Run the fixture validation matrix:

```bash
python scripts/fixture_demo_matrix.py
python scripts/agentathon_preflight.py
npm run qa
```

The matrix validates expected risk domains, missing evidence terms, required action keywords, decision band, minimum risk, human-review boundary, trace collaboration, and no raw embeddings. It regenerates `output_examples/fixture_*_output.json` and `logs/fixture_*_trace.jsonl` through the actual council path.

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
- Online product vector storage is Qdrant-backed through Vercel and the droplet; local/CI vector storage falls back unless Qdrant env vars are exported.
- Governed learning memory is advisory precedent storage, not model retraining.
- Optional live CrewAI advisory specialists for the Agentathon wrapper require `AGENT_RUNTIME=crewai_live`, `CREWAI_ENABLE_LIVE_LLM=1`, optional CrewAI dependencies, and server-side Compass credentials; final decisions remain deterministic.
- Local OCR/document parsing is not implemented in this repository.
- Audit is local append-only hash-chained JSONL, not managed durable storage.
- Production Redis, Postgres, durable queues, and OpenClaw are not implemented or claimed; FastAPI and Docker are limited to the Agentathon evaluator wrapper.
- Human approval remains required; the agent does not auto-approve operational compliance decisions.
