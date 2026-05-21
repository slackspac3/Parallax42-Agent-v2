# Parallax42 Compliance Intelligence Agent

Production-oriented submission workspace for the G42 Compliance Intelligence Agent role.

This repo is the clean build surface for packaging the existing Parallax42 work into a role-aligned agent:

- compliance-domain intake and triage
- evidence-backed obligation mapping
- human-review decision briefs
- traceable control recommendations
- enterprise integration and deployment evidence
- Responsible AI and benchmark artifacts

The implementation now defaults agent execution through a dependency-light CrewAI Flow orchestration path with deterministic compliance decisions as the stable fallback. The stronger Parallax42 assets remain the source of truth for the live supplier-risk backend and are referenced in the submission dossier.

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

For automated evaluator compatibility, this repository also exposes a thin Python wrapper around the same Node/CommonJS runtime:

```bash
npm install
python run.py
```

Then, from another terminal:

```bash
curl -sS http://127.0.0.1:8000/health
curl -sS -X POST http://127.0.0.1:8000/run \
  -H "content-type: application/json" \
  --data @input_examples/example_1_healthcare_analytics.json
```

`run.py` does not introduce FastAPI or a second backend. It starts `server.js` on port `8000` so judges or automated screeners that expect `python run.py` and `POST /run` can exercise the same compliance engine. The same route is also available as `/api/run` in the Vercel API surface, with `/run` rewritten to it.

Compass is already supported through the Parallax42 Compass gateway. For evaluator environments that provide direct OpenAI-compatible Compass variables, the same client also accepts:

```text
OPENAI_API_KEY=<Compass API key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_NAME=gpt-4.1
REASONING_MODEL_NAME=gpt-5.1
EMBEDDING_MODEL_NAME=text-embedding-3-large
```

## What This Demo Does Not Claim

- This repository is not a FastAPI backend.
- This repository does not include Redis, Postgres, Celery, or durable queues.
- Without the optional remote Python CrewAI service, the runtime degrades to deterministic decisioning plus CrewAI-shaped dry run.
- Live LLM specialist output is optional and advisory.
- Qdrant support exists only when configured; local-file vector storage is the demo default.
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
- allowlisted browser relay to the live Parallax42 backend at `GET/POST /api/backend`
- GitHub Pages static cockpit with chat-first agent mode and advanced runtime controls
- browser cockpit for conversational case building, agent execution, evidence, gaps, and trace events
- CrewAI Flow adapter plus six role-specific agents and YAML task definitions
- local benchmark endpoint and audit JSONL persistence
- generated evidence capture under `evidence/`
- replayable golden demo workflow at `GET /api/demo/golden`
- unit tests and syntax checks
- initial G42 submission dossier under `docs/`

Linked live assets already in place:

- Parallax42 demo UI: `https://slackspac3.github.io/Parallax42/`
- External Parallax42 backend health: `https://api.parallax42.bhavukarora.com/health`
- Compass gateway: `https://parallax42-compass-gateway.vercel.app/api/health`
- Compliance Intelligence Agent API: `https://parallax42-compliance-intelligence.vercel.app`

## Run Locally

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

## Evidence Capture

Capture live health snapshots, benchmark output, readiness inventory, and a sample agent trace:

```bash
npm run capture:evidence
```

The generated files land in `evidence/` and are safe to include in a submission pack because secrets and raw uploads are not stored there.

## Deployment Surfaces

- Static cockpit: `public/`, deployed by `.github/workflows/pages.yml`.
- Serverless API: `api/`, deployable to Vercel.
- Live backend proof: proxied through the allowlisted `/api/backend` relay.

Key environment variables:

```text
AGENT_RUNTIME=crewai_llm
CREWAI_ENABLE_LIVE_LLM=1
CREWAI_LLM_MODEL=gpt-5.1
CREWAI_LLM_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
CREWAI_LLM_API_KEY=<same-value-as-COMPASS_GATEWAY_TOKEN>
P42_CREWAI_SERVICE_URL=https://api.parallax42.bhavukarora.com/crewai
P42_CREWAI_SERVICE_TOKEN=<server-side-service-token>
PARALLAX42_BACKEND_URL=https://api.parallax42.bhavukarora.com
COMPASS_GATEWAY_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
COMPASS_GATEWAY_TOKEN=<server-side gateway token>
EMBEDDINGS_MODEL=text-embedding-3-large
P42_REQUIRE_DURABLE_STORAGE=0
P42_REFERENCE_CONTEXT_DIR=
P42_VECTOR_STORE_PROVIDER=qdrant
# Full RAG requires these Qdrant values. Without them the runtime falls back to local-file demo storage.
# QDRANT_URL=https://<cluster>.cloud.qdrant.io
# QDRANT_API_KEY=<server-side-vector-db-key>
# QDRANT_COLLECTION=p42_compliance_evidence
P42_FEATURE_COMPASS_LLM_CALLS=1
P42_FEATURE_COMPASS_EMBEDDINGS=1
P42_FEATURE_QDRANT_RAG=1
P42_FEATURE_QDRANT_LEARNING_MEMORY=1
P42_FEATURE_EXTERNAL_PARSER_RELAY=1
P42_FEATURE_LIVE_ADVISORY_SPECIALISTS=1
P42_FEATURE_LIVE_CREWAI=1
P42_ALLOWED_ORIGINS=https://slackspac3.github.io,http://127.0.0.1:3020
AGENT_AUDIT_DIR=/tmp/p42-compliance-intelligence-agent
```

The advanced components are requested by default and can be switched off through `GET|PATCH /api/admin/features` or the cockpit's Advanced runtime settings panel. The admin response distinguishes `enabled`, `configured`, and `active`, so missing Compass tokens, Qdrant URLs, parser relay configuration, or optional CrewAI Python dependencies are shown as safe degradation rather than hidden failures.

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
AGENT_RUNTIME=crewai_llm
CREWAI_ENABLE_LIVE_LLM=1
CREWAI_LLM_MODEL=gpt-5.1
P42_CREWAI_SERVICE_URL=https://api.parallax42.bhavukarora.com/crewai
P42_CREWAI_SERVICE_TOKEN=<server-side-service-token>
P42_AUTH_MODE=audit
```

Qdrant is required for the full RAG and governed learning memory demo. The local-file vector store remains a demo fallback only. The remote Python CrewAI service is required for live CrewAI execution from Vercel because Vercel's Node runtime does not install the Python CrewAI adapter. Governed learning stores auditable reviewer memory and precedent patterns; it is not model retraining and never silently changes the deterministic council decision. Live LLM specialists are advisory only, and human approval remains required.

After configuring Qdrant and the Compass gateway, run:

```bash
npm run qdrant:smoke
npm run reference:index
```

`npm run reference:index` seeds `reference_context/sanitised_enterprise_ai_governance_context.md` as sanitized governance-reference memory. It is advisory context only: it helps chat and retrieval reason about governance, assurance, SAA, ISO, Responsible AI, and risk language, but it is not official policy and never overrides the deterministic council or human review boundary.

## CrewAI

Validate the CrewAI crew design without installing optional dependencies:

```bash
npm run check:crewai
```

Dry-run validation covers both CrewAI Crew and CrewAI Flow manifests. Install optional dependencies for live CrewAI validation:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-crewai.txt
python crewai_adapter/compliance_flow.py --live-flow --input examples/high_risk_ai_saas_case.json
python crewai_adapter/compliance_crew.py --live-crewai --input examples/high_risk_ai_saas_case.json
```

Enable live LLM calls only with approved credentials:

```bash
export CREWAI_ENABLE_LIVE_LLM=1
export CREWAI_LLM_MODEL=gpt-5.1
export CREWAI_LLM_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
export CREWAI_LLM_API_KEY=$COMPASS_GATEWAY_TOKEN
AGENT_RUNTIME=crewai_llm npm run dev
```

Live LLM specialist output is attached under `orchestration.llmOutput`; on Vercel this can use the Node-side Compass advisory adapter when `AGENT_RUNTIME=crewai_llm` and `CREWAI_ENABLE_LIVE_LLM=1` are set. The final decision remains guarded by the deterministic engine. The evidence boundary uses server-side `POST /api/evidence/index` and `POST /api/evidence/search`, calls the reusable Parallax42 embedding boundary using `text-embedding-3-large`, stores chunk vectors behind the API, and keeps embedding vectors out of browser state. The browser may carry sanitized document metadata, excerpts, and retrieved snippets so the chat and reviewer UI can explain what was used.

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
