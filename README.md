# Parallax42 Compliance Intelligence Agent

Production-oriented submission workspace for the G42 Compliance Intelligence Agent role.

This repo is the clean build surface for packaging the existing Parallax42 work into a role-aligned agent:

- compliance-domain intake and triage
- evidence-backed obligation mapping
- human-review decision briefs
- traceable control recommendations
- enterprise integration and deployment evidence
- Responsible AI and benchmark artifacts

The implementation starts with a dependency-light local agent runtime so the repo is runnable immediately. The stronger Parallax42 assets remain the source of truth for the live supplier-risk backend and are referenced in the submission dossier.

## Current Status

Implemented in this repo:

- `POST /api/agent/run` deterministic compliance-agent run
- `GET /api/readiness` submission-readiness inventory
- `GET /api/health` runtime and linked-platform status
- Vercel-compatible serverless API functions under `api/`
- allowlisted browser relay to the live Parallax42 backend at `GET/POST /api/backend`
- GitHub Pages static cockpit with runtime mode controls
- browser cockpit for running the agent and reviewing evidence, gaps, and trace events
- optional CrewAI adapter with six role-specific agents and YAML task definitions
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
PARALLAX42_BACKEND_URL=https://api.parallax42.bhavukarora.com
P42_ALLOWED_ORIGINS=https://slackspac3.github.io,http://127.0.0.1:3020
AGENT_AUDIT_DIR=/tmp/p42-compliance-intelligence-agent
```

## CrewAI

Validate the CrewAI crew design without installing optional dependencies:

```bash
npm run check:crewai
```

Install and run the optional live CrewAI adapter:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-crewai.txt
python crewai_adapter/compliance_crew.py --live-crewai --input examples/high_risk_ai_saas_case.json
```

## Submission Dossier

- [Agent Resume](docs/AGENT_RESUME.md)
- [End State](docs/END_STATE.md)
- [Work-Backward Roadmap](docs/ROADMAP.md)
- [Golden Demo Workflow](docs/GOLDEN_DEMO_WORKFLOW.md)
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
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

The next implementation milestone is to replace the deterministic local evidence layer with a packaged extraction from Parallax42 and promote the Vercel API deployment:

1. connect `/api/agent/run` to the live Parallax42 workflow behind an approval-gated switch
2. move audit events from JSONL to PostgreSQL or another immutable append store
3. add Entra-ready JWT validation and role-policy middleware
4. expand benchmark coverage to upload/OCR, adversarial, latency, and fallback cases
5. record the "Watch the Agent Work" demo path
