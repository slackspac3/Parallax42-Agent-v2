# Parallax42 Compliance Intelligence Agent

Production-oriented submission workspace for the G42 Compliance Intelligence Agent role.

This repo is the clean build surface for packaging the existing Parallax42 work into a role-aligned agent:

- compliance-domain intake and triage
- evidence-backed obligation mapping
- human-review decision briefs
- traceable control recommendations
- enterprise integration and deployment evidence
- Responsible AI and benchmark artifacts

Hackathon positioning: this submission maps to **Use Case #21: Legal Intelligence / Compliance**. The primary workflow is enterprise agreement and vendor-evidence review: uploaded agreements, DPAs, MSAs, SOC/ISO/BCP evidence, and advisory legal-reference context are converted into a human-review decision pack. The Caselaw Access Project data path is implemented as advisory legal-reference memory, not as legal advice or automated approval.

Agent positioning: the system is intentionally **L2 governed autonomy**. It can loop through intake, evidence retrieval, obligation mapping, risk/control analysis, and review-pack generation, but it stops at missing evidence, low output-rubric score, or accountable human approval. The council is expressed as agentic pairings such as Planner + Doer, Proposer + Critic, Context-Packer + Actor, and Evidence-Weaver + Synthesizer, with deterministic decisioning as the final owner.

Memory is separated into scratchpad state, episodic audit/reviewer logs, and reusable advisory knowledge. Governed learning memory and reference intelligence can improve questions and reviewer suggestions, but they do not train a model or silently change the deterministic decision.

The implementation defaults to deterministic compliance decisions, with CrewAI-shaped dry-run manifests and optional advisory integrations kept behind explicit configuration.

## Judge Quick Start

For the normal cockpit demo:

```bash
npm install
npm run qa
npm run dev
```

Open:

```text
http://localhost:3000
```

The local server defaults to `http://127.0.0.1:3020`. If the judging environment expects port `3000`, start it with:

```bash
PORT=3000 npm run dev
```

Suggested demo prompt:

```text
Assess whether we can onboard a UAE healthcare analytics vendor using patient data, Microsoft 365, and cross-border cloud processing.
```

Suggested demo steps:

1. Attach a synthetic compliance document from `test-fixtures/compliance-documents/`, for example `02_data_processing_addendum_and_cross_border_terms.pdf`.
2. Run Council.
3. Review the decision memo.
4. Export Executive Review Pack PDF.

## Agentathon Evaluation

Selected use case: **21 Legal Intelligence**.

The existing product runtime is still the Node/CommonJS app under `server.js`, `api/`, `lib/`, and `public/`. For Agentathon screening, the repo root also includes a Python FastAPI wrapper that starts on `0.0.0.0:8000`, exposes `GET /health`, `GET /metadata`, `GET /logs`, `GET /compass/probe`, and `POST /run`, then delegates deterministic execution to `scripts/agentathon_run.js`.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install
python run.py
```

Call the evaluator path:

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
```

Docker:

```bash
docker build -t parallax42-agentathon .
docker run --rm -p 8000:8000 \
  -e SAMPLE_MODE=true \
  -e OPENAI_BASE_URL=https://compass.core42.ai/v1 \
  -e OPENAI_API_KEY=dummy \
  parallax42-agentathon
```

Successful Docker smoke means the container starts, `GET /health` returns JSON with `ok=true`, and `POST /run` with `input_examples/example_1.json` returns structured JSON. The local preflight Docker check prints `DOCKER_LOCAL=PASS`, `DOCKER_LOCAL=FAIL`, or `DOCKER_LOCAL=SKIPPED_DOCKER_CLI_MISSING`:

```bash
python scripts/agentathon_preflight.py --docker
```

GitHub Actions runs Docker verification in `.github/workflows/agentathon-preflight.yml` with `SAMPLE_MODE=true`, `OPENAI_API_KEY=dummy`, and the official Compass base URL so no real secrets are required in CI. Verify the latest remote result with:

```bash
gh run list --workflow agentathon-preflight.yml --limit 5
gh run view <run-id> --log-failed
```

Compass/OpenAI-compatible variables are placeholders in `.env.example`:

```text
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
EMBEDDING_MODEL=text-embedding-3-large
SAMPLE_MODE=false
REQUIRE_COMPASS=true
AGENT_RUNTIME=custom
CREWAI_ENABLE_LIVE_LLM=0
```

No secrets are committed. `SAMPLE_MODE=true` is accepted for CI/local reproducibility, but it does not switch to canned outputs; the wrapper still runs the deterministic Node rules engine and Python council. With `SAMPLE_MODE=false`, `/run` attempts a live Compass/OpenAI-compatible advisory call when `OPENAI_API_KEY` is configured. That advisory is recorded as advisory only; the Deterministic Decision Owner remains final authority. Qdrant, enforced RBAC, and live CrewAI are optional/configurable paths and are not claimed active unless those environment variables are set and separately verified.

Known limitations: the Agentathon path returns structured JSON and trace logs, not the browser cockpit; the decision is a human-review compliance package, not legal advice or automatic approval; Compass failures return structured `live_compass.status=unavailable`; Qdrant is inactive unless Qdrant and Compass embedding env vars are configured and smoke-tested; live CrewAI is not active by default.

Compass diagnostics:

```bash
python scripts/compass_doctor.py --json
python scripts/compass_doctor.py --strict
curl http://localhost:8000/compass/probe
```

`OPENAI_BASE_URL` is normalized for the official direct Agentathon Compass path. `https://compass.core42.ai` is corrected to `https://compass.core42.ai/v1`; duplicate `/v1/v1` and known frontend URLs are rejected. If `OPENAI_BASE_URL` is not exported, `compass_doctor.py` reports that the default is used only for normalization and is not live proof. The optional Parallax42 Vercel gateway uses `COMPASS_GATEWAY_BASE_URL` and `COMPASS_GATEWAY_TOKEN` in the existing Node product runtime. It is not the official Agentathon Compass direct path unless explicitly configured as an OpenAI-compatible `/v1` endpoint.

## Agentathon Preflight

Run the local submission checks:

```bash
python scripts/agentathon_preflight.py
python scripts/agentathon_preflight.py --run-api
python scripts/agentathon_preflight.py --run-api --npm-qa
python scripts/agentathon_preflight.py --compass-doctor
python scripts/agentathon_preflight.py --qdrant-smoke
python scripts/agentathon_preflight.py --docker
```

The Docker check requires a machine with Docker installed. Some local Codex environments do not include the Docker CLI; in that case `--docker` reports `SKIPPED` with the reason rather than failing the whole preflight.

Regenerate judge-facing output examples and matching logs after changing the `/run` path:

```bash
python scripts/regenerate_agentathon_artifacts.py
```

This executes the actual orchestrator for `example_1`, `example_2`, and `example_3`, writes `output_examples/example_*_output.json`, copies matching stable logs to `logs/example_*_trace.jsonl`, and updates `logs/demo_trace.jsonl`. The preflight checks that each output example's `trace_id` matches its referenced log file.

`SAMPLE_MODE=true` is a fallback/testing flag only. It must not be presented as live Compass execution, and it still runs the simplified deterministic Node rules path rather than returning canned output files. Final evaluation should provide:

```text
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
EMBEDDING_MODEL=text-embedding-3-large
SAMPLE_MODE=false
REQUIRE_COMPASS=true
AGENT_RUNTIME=custom
```

In final non-sample evaluation, the wrapper sends sanitized case facts, evidence summaries, specialist findings, and the deterministic draft to Compass for advisory critique. Compass can add reviewer questions and advisory notes, but it cannot approve, reject, or override the deterministic final decision.

Optional live CrewAI for the Agentathon `/run` path is separate from the stable custom orchestrator:

```text
AGENT_RUNTIME=crewai_live
CREWAI_ENABLE_LIVE_LLM=1
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
```

CrewAI is imported lazily and is not installed by the default Docker build. Install `requirements-crewai.txt` only when validating the optional live path. If CrewAI fails to import or execute, `/run` records `live_advisory.status=unavailable` and continues through the custom deterministic path. CrewAI specialist cards are advisory only and cannot override the Deterministic Decision Owner.

Optional Qdrant evidence memory for the Agentathon `/run` path:

```text
P42_VECTOR_STORE_PROVIDER=qdrant
QDRANT_URL=https://<cluster>.cloud.qdrant.io
QDRANT_API_KEY=<server-side-vector-db-key>
QDRANT_COLLECTION=p42_compliance_evidence
QDRANT_VECTOR_SIZE=3072
RAG_CHUNK_SIZE=900
RAG_CHUNK_OVERLAP=120
```

With those values plus the official Compass embedding env vars, `/run` chunks synthetic/input evidence, embeds through Compass, stores case-scoped chunks in Qdrant, searches by `caseId`, and returns only citation-safe snippets. Raw embeddings are never returned to the browser/API caller. Without Qdrant or embeddings, the Agentathon wrapper uses `provider=local-fallback`, which is useful for CI/demo reproducibility but is not durable production RAG.

```bash
python scripts/qdrant_smoke.py
python scripts/agentathon_preflight.py --qdrant-smoke
```

Governed learning memory for the Agentathon `/run` path stores synthetic reviewer outcomes, feedback, control patterns, decision overrides, and evidence-quality notes as advisory artifacts. It is not model training, autonomous self-learning, or silent policy modification. The Deterministic Decision Owner remains final authority and can only use learning memory to surface reviewer questions or controls that are already supported by current evidence gaps.

When Qdrant and Compass embeddings are configured, learning artifacts use the same server-side Qdrant boundary with `memoryType=learning_artifact` payloads. Without Qdrant, the wrapper reads `data/sample_learning_memory.json` and optional local JSONL feedback through `provider=local-jsonl`. API responses return sanitized similar cases and controls only; raw embeddings are never returned.

Learning endpoints:

```bash
curl http://localhost:8000/learning/memory/status
curl -X POST http://localhost:8000/learning/similar-cases \
  -H "Content-Type: application/json" \
  -d '{"caseFacts":{"workflow":"healthcare analytics"},"missingEvidence":["model-training exclusion"],"domains":["privacy","ai-governance"]}'
curl -X POST http://localhost:8000/learning/control-suggestions \
  -H "Content-Type: application/json" \
  -d '{"caseFacts":{"workflow":"AI support-ticket classifier"},"missingEvidence":["model-training exclusion"],"domains":["ai-governance"]}'
```

Troubleshooting Compass:

- HTML from `/models` means `OPENAI_BASE_URL` is probably a frontend or gateway URL, not an OpenAI-compatible API base.
- HTML from `/models` can also mean the key/base URL is routing to a portal or proxy instead of the OpenAI-compatible Compass API.
- `405` from `/chat/completions` usually means the path/base URL/proxy is wrong or the gateway is not exposing the OpenAI-compatible route directly.
- `SAMPLE_MODE=true` is enough for CI shape checks, but not enough for final judging of the live Compass path.
- Use `REQUIRE_COMPASS=true` for final verification when you want `/run` to return a structured error if live Compass advisory is unavailable.

## What This Demo Does Not Claim

- The product runtime is not rewritten as Python; FastAPI is only the Agentathon evaluation wrapper.
- This repository does not include Redis, Postgres, Celery, or durable queues.
- Without the optional remote Python CrewAI service, the product runtime degrades to deterministic decisioning plus CrewAI-shaped dry run.
- Live Compass advisory output is optional outside final evaluation credentials and remains advisory only.
- Qdrant support exists only when configured; local-file vector storage is the demo default.
- Governed learning memory is advisory reviewer memory only; it is not model training, autonomous approval, or policy mutation.
- OCR/parser capability is integrated through external relay paths rather than implemented as a local parser service in this repo.
- OpenClaw is not implemented and should not be claimed.

## Current Status

Implemented in this repo:

- `POST /api/conversation` NLP case-builder endpoint that asks follow-up questions and executes the agent workflow when ready
- `POST /api/agent/run` CrewAI Flow-routed compliance-agent run with deterministic fallback
- `POST /api/evidence/index` and `POST /api/evidence/search` server-side retrieval boundary: gateway embeddings and indexed chunks stay behind the API; the browser receives case/evidence/index metadata plus safe snippets/citations needed for the reviewer UI
- `GET /api/readiness` submission-readiness inventory
- `GET /api/health` runtime and linked-platform status
- Vercel-compatible serverless API functions under `api/`
- allowlisted browser relay for an optional configured Parallax42 backend at `GET/POST /api/backend`
- GitHub Pages static cockpit with chat-first agent mode and advanced runtime controls
- browser cockpit for conversational case building, agent execution, evidence, gaps, and trace events
- CrewAI Flow adapter plus six role-specific agents and YAML task definitions
- local benchmark endpoint and audit JSONL persistence
- generated evidence capture under `evidence/`
- replayable golden demo workflow at `GET /api/demo/golden`
- unit tests and syntax checks
- initial G42 submission dossier under `docs/`

Optional prior-demo endpoints, not required for Agentathon evaluation:

- Parallax42 demo UI: `https://slackspac3.github.io/Parallax42/`
- External Parallax42 backend health: `https://api.parallax42.bhavukarora.com/health`
- Compass gateway: `https://parallax42-compass-gateway.vercel.app/api/health`
- Compliance Intelligence Agent API: `https://parallax42-compliance-intelligence.vercel.app`

## Run Locally

For local testing that matches the hosted demo boundary, create `.env.local` from the relevant values in `.env.example`. `npm run dev` automatically loads `.env` and `.env.local`; shell-exported variables still win. Keep secrets such as `COMPASS_GATEWAY_TOKEN`, `QDRANT_API_KEY`, and `P42_CREWAI_SERVICE_TOKEN` out of git.

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3020
```

## Test

```bash
npm run qa
```

Run the live dependency check only after configuring private live-service credentials and when you intentionally want to verify external backend, gateway, Qdrant, and Compass access:

```bash
npm run qa:live
```

`npm run qa` stays deterministic and does not spend gateway tokens. `npm run qa:live` is intentionally networked and requires `.env.local` to contain the same server-side values used by Vercel.

## Evidence Capture

Capture health snapshots, benchmark output, readiness inventory, and a sample agent trace:

```bash
npm run capture:evidence
```

The generated files land in `evidence/` and are safe to include in a submission pack because secrets and raw uploads are not stored there.

## Request Size Boundaries

Evidence files can be up to 30 MB per file in the browser cockpit. Large files are not sent as raw JSON: they are hashed client-side, split into 1 MB parser-relay chunks, parsed/OCRed behind the backend boundary, and then represented in chat as sanitized metadata and snippets.

Parsed evidence index requests have a separate JSON limit of 15 MB by default. Conversation, standard run, agent run, and review-pack JSON requests default to 8 MB. These limits support complex case metadata while keeping raw document content on the chunked upload path.

The JSON limits can be overridden with `CONVERSATION_BODY_LIMIT_BYTES`, `EVIDENCE_INDEX_BODY_LIMIT_BYTES`, `EVIDENCE_SEARCH_BODY_LIMIT_BYTES`, `REVIEW_PACK_BODY_LIMIT_BYTES`, `STANDARD_RUN_BODY_LIMIT_BYTES`, and `ADMIN_BODY_LIMIT_BYTES`.

## Deployment Surfaces

- Static cockpit: `public/`, deployed by `.github/workflows/pages.yml`.
- Serverless API: `api/`, deployable to Vercel.
- Live backend proof: proxied through the allowlisted `/api/backend` relay.

Default-safe environment variables:

```text
AGENT_RUNTIME=custom
CREWAI_ENABLE_LIVE_LLM=0
CREWAI_LLM_MODEL=gpt-5.1
CREWAI_LLM_BASE_URL=
CREWAI_LLM_API_KEY=
P42_CREWAI_SERVICE_URL=
P42_CREWAI_SERVICE_TOKEN=
PARALLAX42_BACKEND_URL=
COMPASS_GATEWAY_BASE_URL=
COMPASS_GATEWAY_TOKEN=
EMBEDDINGS_MODEL=text-embedding-3-large
P42_REQUIRE_DURABLE_STORAGE=0
P42_REFERENCE_CONTEXT_DIR=
P42_VECTOR_STORE_PROVIDER=local
# Full RAG requires these Qdrant values. Without them the runtime falls back to local-file demo storage.
# QDRANT_URL=https://<cluster>.cloud.qdrant.io
# QDRANT_API_KEY=<server-side-vector-db-key>
# QDRANT_COLLECTION=p42_compliance_evidence
P42_FEATURE_COMPASS_LLM_CALLS=0
P42_FEATURE_COMPASS_EMBEDDINGS=0
P42_FEATURE_QDRANT_RAG=0
P42_FEATURE_QDRANT_LEARNING_MEMORY=0
P42_FEATURE_EXTERNAL_PARSER_RELAY=0
P42_FEATURE_LIVE_ADVISORY_SPECIALISTS=0
P42_FEATURE_LIVE_CREWAI=0
P42_ALLOWED_ORIGINS=http://127.0.0.1:3020
AGENT_AUDIT_DIR=/tmp/p42-compliance-intelligence-agent
```

Advanced components can be switched on through environment variables or `GET|PATCH /api/admin/features` when the required backing service is configured. Smart chat intake requires `COMPASS_GATEWAY_TOKEN`; when it is absent or the gateway fails, the chat reports that smart intake is unavailable instead of silently pretending a live LLM result exists. The admin response distinguishes `enabled`, `configured`, and `active`, so missing Compass tokens, Qdrant URLs, parser relay configuration, or optional CrewAI Python dependencies are visible.

Full RAG and governed-learning demo setup:

```text
COMPASS_GATEWAY_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
COMPASS_GATEWAY_TOKEN=<server-side gateway token>
EMBEDDINGS_MODEL=text-embedding-3-large
P42_VECTOR_STORE_PROVIDER=qdrant
QDRANT_URL=https://<cluster>.cloud.qdrant.io
QDRANT_API_KEY=<server-side qdrant key>
QDRANT_COLLECTION=p42_compliance_evidence
P42_REFERENCE_CONTEXT_DIR=
AGENT_RUNTIME=crewai_live
CREWAI_ENABLE_LIVE_LLM=1
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
P42_CREWAI_SERVICE_URL=https://api.parallax42.bhavukarora.com/crewai
P42_CREWAI_SERVICE_TOKEN=<server-side-service-token>
P42_AUTH_MODE=audit
```

Qdrant is required for the full RAG and governed learning memory demo. The local-file vector store remains a demo fallback only. The remote Python CrewAI service is required for live CrewAI execution from Vercel because Vercel's Node runtime does not install the Python CrewAI adapter. Governed learning stores auditable reviewer memory and precedent patterns; it is not model retraining and never silently changes the deterministic council decision. Live LLM specialists are advisory only, and human approval remains required.

After configuring Qdrant and the Compass gateway, run:

```bash
npm run qdrant:smoke
npm run reference:index
npm run reference:intelligence
npm run reference:courtlistener
```

`npm run reference:index` seeds `reference_context/sanitised_enterprise_ai_governance_context.md` as sanitized governance-reference memory. It is advisory context only: it helps chat and retrieval reason about governance, assurance, SAA, ISO, Responsible AI, and risk language, but it is not official policy and never overrides the deterministic council or human review boundary.

`npm run reference:intelligence` creates safe local reference-lane artifacts without live API calls. It covers legal, compliance, procurement, security, AI governance, sanctions/export, and HSE/ESG lane directories so the demo can explain the broader ingestion strategy without pretending those corpora are already fully loaded.

`npm run reference:courtlistener` aligns the demo with Use Case #21's legal/compliance reference path through CourtListener / Free Law Project. It imports a small CourtListener sample when `COURTLISTENER_API_TOKEN` is configured or local JSON/JSONL is supplied, writes normalized legal-reference records under `reference_context/legal/`, and can index the resulting markdown through the same reference-memory path. CourtListener references are advisory legal intelligence only; they are not jurisdiction-specific advice and cannot approve a contract. The legacy `npm run reference:cap` command remains available for CAP API access.

See [`docs/REFERENCE_INTELLIGENCE_DATA.md`](docs/REFERENCE_INTELLIGENCE_DATA.md) for the broader legal, compliance, procurement, security, AI governance, sanctions/export, and HSE/ESG reference-lane model.

## CrewAI

Validate the CrewAI crew design without installing optional dependencies:

```bash
npm run check:crewai
```

Dry-run validation covers both CrewAI Crew and CrewAI Flow manifests. CrewAI is not part of the default Agentathon Docker dependency set. Install optional dependencies only for live CrewAI validation:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-crewai.txt
python crewai_adapter/compliance_flow.py --live-flow --input examples/high_risk_ai_saas_case.json
python crewai_adapter/compliance_crew.py --live-crewai --input examples/high_risk_ai_saas_case.json
```

Enable live LLM calls only with approved credentials:

```bash
export AGENT_RUNTIME=crewai_live
export CREWAI_ENABLE_LIVE_LLM=1
export OPENAI_API_KEY=<real Compass key>
export OPENAI_BASE_URL=https://compass.core42.ai/v1
export MODEL_FAST=gpt-4.1
python run.py
```

For the Agentathon FastAPI wrapper, live CrewAI specialist output is attached under `output.live_advisory` only when `AGENT_RUNTIME=crewai_live` and `CREWAI_ENABLE_LIVE_LLM=1` are set and CrewAI actually runs. The final decision remains guarded by the deterministic engine. The evidence boundary uses server-side `POST /api/evidence/index` and `POST /api/evidence/search`, calls the reusable Parallax42 embedding boundary using `text-embedding-3-large`, stores chunk vectors behind the API, and keeps embedding vectors out of browser state. The browser may carry sanitized document metadata, excerpts, and retrieved snippets so the chat and reviewer UI can explain what was used.

For live CrewAI multi-agent execution from Vercel, configure `P42_CREWAI_SERVICE_URL` and `P42_CREWAI_SERVICE_TOKEN`. The Node runtime delegates the six-agent CrewAI council to that service, attaches its output under `orchestration.crewaiOutput`, then still applies the deterministic council as the final decision owner.

Learning memory endpoints are advisory:

- `POST /api/learning/feedback` records reviewer feedback, outcomes, controls, rejected evidence, and missing evidence as auditable learning artifacts.
- `POST /api/learning/similar-cases` returns similar prior cases.
- `GET|POST /api/learning/control-suggestions` returns common reviewer-added controls and repeated missing evidence patterns.

`POST /api/export/review-pack` creates the server-side executive review pack with digest, evidence quality, retrieval audit, citation manifest, reviewer actions, and a PDF payload. The cockpit uses this endpoint for the Exec review pack button and falls back to a local HTML report only if the API is unavailable.

## Submission Dossier

- [Agent Resume](docs/AGENT_RESUME.md)
- [End State](docs/END_STATE.md)
- [Work-Backward Roadmap](docs/ROADMAP.md)
- [Golden Demo Workflow](docs/GOLDEN_DEMO_WORKFLOW.md)
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Milestone 1 CrewAI Flow Runtime](docs/MILESTONE_1_CREWAI_FLOW.md)
- [Benchmark Report](docs/BENCHMARK_REPORT.md)
- [Legal Intelligence Data](docs/LEGAL_INTELLIGENCE_DATA.md)
- [Responsible AI Controls](docs/RESPONSIBLE_AI_CONTROLS.md)
- [Integration Matrix](docs/INTEGRATION_MATRIX.md)
- [Requirements Traceability](docs/REQUIREMENTS_TRACEABILITY.md)
- [Security, RBAC, And Audit Plan](docs/SECURITY_RBAC_AUDIT_PLAN.md)
- [CrewAI Architecture](docs/CREWAI_ARCHITECTURE.md)
- [Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md)
- [Production Track](docs/PRODUCTION_TRACK.md)
- [Demo Script](docs/DEMO_SCRIPT.md)
- [Submission Plan](docs/SUBMISSION_PLAN.md)

## Build Direction

The next implementation milestone is evidence intake and citation discipline:

1. add document/evidence upload or relay-backed evidence intake
2. add evidence chunk IDs and citation-required output
3. make uploaded DPA/model-training/continuity evidence clear specific blockers
4. preserve redaction and audit trace boundaries
5. add citation precision and missing-evidence evals
