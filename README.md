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

## Current Status

Implemented in this repo:

- `POST /api/conversation` NLP case-builder endpoint that asks follow-up questions and executes the agent workflow when ready
- `POST /api/agent/run` CrewAI Flow-routed compliance-agent run with deterministic fallback
- `POST /api/evidence/index` and `POST /api/evidence/search` server-side retrieval boundary: gateway embeddings are stored behind the API, and the browser receives only case/evidence/index metadata
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
- Parallax42 FastAPI backend: `https://api.parallax42.bhavukarora.com/health`
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
AGENT_RUNTIME=crewai_flow
CREWAI_ENABLE_LIVE_LLM=0
CREWAI_LLM_MODEL=gpt-5.1
CREWAI_LLM_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
CREWAI_LLM_API_KEY=<same-value-as-COMPASS_GATEWAY_TOKEN>
PARALLAX42_BACKEND_URL=https://api.parallax42.bhavukarora.com
COMPASS_GATEWAY_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
COMPASS_GATEWAY_TOKEN=<server-side gateway token>
EMBEDDINGS_MODEL=text-embedding-3-large
P42_REQUIRE_DURABLE_STORAGE=0
P42_VECTOR_STORE_PROVIDER=local_file
# Production option:
# P42_VECTOR_STORE_PROVIDER=qdrant
# QDRANT_URL=https://<cluster>.cloud.qdrant.io
# QDRANT_API_KEY=<server-side-vector-db-key>
# QDRANT_COLLECTION=p42_compliance_evidence
P42_ALLOWED_ORIGINS=https://slackspac3.github.io,http://127.0.0.1:3020
AGENT_AUDIT_DIR=/tmp/p42-compliance-intelligence-agent
```

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

Live LLM specialist output is attached under `orchestration.llmOutput`; on Vercel this can use the Node-side Compass advisory adapter when `AGENT_RUNTIME=crewai_llm` and `CREWAI_ENABLE_LIVE_LLM=1` are set. The final decision remains guarded by the deterministic engine until eval gates are added. The evidence boundary uses server-side `POST /api/evidence/index` and `POST /api/evidence/search`, calls the reusable Parallax42 embedding boundary using `text-embedding-3-large`, stores chunk vectors behind the API, and keeps browser state limited to case IDs, evidence IDs, and sanitized index metadata.

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
