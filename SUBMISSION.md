# Submission

## Live URLs

Primary demo surfaces:

- Static cockpit: `https://slackspac3.github.io/Parallax42-Compliance-Intelligence-Agent/`
- Compliance Intelligence Agent API: `https://parallax42-compliance-intelligence.vercel.app`
- API health: `https://parallax42-compliance-intelligence.vercel.app/api/health`
- Compass gateway health: `https://parallax42-compass-gateway.vercel.app/api/health`

The Compass gateway is required for smart chat intake and shared embeddings/advisory model calls. The deterministic compliance engine remains the authority for final decision status.

## Selected Hackathon Use Case

- **Use Case ID:** `21`
- **Problem statement:** Legal Intelligence / Compliance
- **Suggested data source alignment:** CourtListener / Free Law Project, with legacy Caselaw Access Project support

Parallax42 applies Legal Intelligence to enterprise agreement and compliance-evidence review. The system reviews contracts, MSAs, DPAs, outsourcing arrangements, and supporting assurance evidence, then produces a human-review decision memo with risks, required actions, citations, and a deterministic specialist trace. CourtListener/CAP references are used only as advisory legal-reference memory for clause and risk comparison, citation checks, and reviewer questions; they are not legal advice and do not approve the case.

## Local Quick Start

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3020
```

Run checks:

```bash
npm run qa
```

Automated evaluator-compatible route:

```bash
python run.py
curl -sS -X POST http://127.0.0.1:8000/run \
  -H "content-type: application/json" \
  --data @input_examples/example_1_healthcare_analytics.json
```

`run.py` is a compatibility wrapper over `server.js`, not a FastAPI rewrite. It exposes `GET /health`, `GET /metadata`, and `POST /run` on port `8000` while preserving the same Node/CommonJS compliance runtime.

Compass compatibility:

- Preferred Parallax42 path: `COMPASS_GATEWAY_BASE_URL` plus `COMPASS_GATEWAY_TOKEN`.
- Direct evaluator alias path: `OPENAI_BASE_URL=https://compass.core42.ai/v1` plus `OPENAI_API_KEY`.
- Embeddings remain `text-embedding-3-large`; final compliance decisions remain deterministic.

## Demo Path

1. Open the static cockpit locally or from the live URL.
2. Start in the chat-first advisor workspace.
3. Describe a compliance case with business owner, geography, service, integrations, and available evidence.
4. Attach or reference evidence where available.
5. Let the agent identify missing context, evidence IDs, obligations, and blockers.
6. Run the council.
7. Review the decision, domain coverage, gaps, controls, citations, trace, and human-approval status.
8. Generate or export the executive review pack.

## What Judges Should Evaluate

- Relevance to structured enterprise compliance workflows.
- Quality of the chat-first case-building experience.
- Deterministic decision logic, blocker naming, controls, and human-approval boundary.
- Evidence retrieval boundary and citation discipline.
- Optional CrewAI-shaped orchestration and Compass advisory model path.
- Audit traceability through local hash-chained JSONL.
- Generated evidence artifacts under `evidence/`.
- Use Case #21 legal-reference data path through `scripts/import-courtlistener-reference.js`, `scripts/import-cuad-reference.js`, legacy `scripts/import-cap-legal-reference.js`, and `reference_context/legal/`.
- Honest separation between implemented demo capabilities and production hardening requirements.

## Honest Implementation Status

Implemented:

- Node/CommonJS Vercel/static cockpit and API routes.
- Vanilla frontend in `public/index.html`, `public/app.js`, `public/styles.css`, and `public/config.js`.
- Local API mirror in `server.js`.
- Core compliance, conversation, evidence, runtime, audit, and export logic under `lib/`.
- Dry-run CrewAI-shaped orchestration checks.
- Deterministic compliance engine for final decisions.
- Optional Compass gateway client for LLM and embeddings.
- CourtListener, CUAD-compatible, NIST, and legacy CAP import/index paths for advisory Reference Intelligence memory.
- Local vector store default with optional Qdrant REST provider when configured.
- Local append-only hash-chained JSONL audit.

Not implemented or not claimed:

- FastAPI application in this repository.
- React, Vite, or `ui/src`.
- Redis, Postgres, Celery, durable queues, or Docker runtime.
- OpenClaw.
- Implemented local OCR/parser pipeline.
- Production durable audit or vector persistence unless separately configured.

## Supporting Docs

- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Demo Script](docs/DEMO_SCRIPT.md)
- [Requirements Traceability](docs/REQUIREMENTS_TRACEABILITY.md)
- [Responsible AI Controls](docs/RESPONSIBLE_AI_CONTROLS.md)
- [Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md)
- [Agent Resume](docs/AGENT_RESUME.md)
- [Benchmark Report](docs/BENCHMARK_REPORT.md)
- [CrewAI Architecture](docs/CREWAI_ARCHITECTURE.md)
- [Golden Demo Workflow](docs/GOLDEN_DEMO_WORKFLOW.md)
- [Integration Matrix](docs/INTEGRATION_MATRIX.md)
- [Legal Intelligence Data](docs/LEGAL_INTELLIGENCE_DATA.md)
- [Production Track](docs/PRODUCTION_TRACK.md)
- [Security, RBAC, And Audit Plan](docs/SECURITY_RBAC_AUDIT_PLAN.md)
