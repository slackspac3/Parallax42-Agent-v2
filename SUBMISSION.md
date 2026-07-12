# Submission

## Live URLs

Primary demo surfaces:

- Static cockpit: `https://slackspac3.github.io/Parallax42-Agent-v2/`
- Compliance Intelligence Agent API: `https://parallax42-agent-v2.vercel.app`
- API health: `https://parallax42-agent-v2.vercel.app/api/health`
- Compass gateway health: `https://parallax42-compass-gateway.vercel.app/api/health`

The Compass gateway is required for smart chat intake and shared embeddings/advisory model calls. The deterministic compliance engine remains the authority for final decision status.

## Selected Hackathon Use Case

- **Use Case ID:** `21`
- **Problem statement:** Legal Intelligence / Compliance
- **Suggested data source alignment:** CourtListener / Free Law Project, with legacy Caselaw Access Project support

Parallax42 applies Legal Intelligence to enterprise agreement and compliance-evidence review. The system reviews contracts, MSAs, DPAs, outsourcing arrangements, and supporting assurance evidence, then produces a human-review decision memo with risks, required actions, citations, and a deterministic specialist trace. CourtListener/CAP references are used only as advisory legal-reference memory for clause and risk comparison, citation checks, and reviewer questions; they are not legal advice and do not approve the case.

The demo should be described as governed L2 autonomy, not unrestricted autonomous approval. The council can loop through intake, retrieval, obligation mapping, risk/control critique, and pack generation, then stops at human review, missing proof, or a low quality-rubric score. The review pack exposes the agent loop spec, agentic pairings, memory lanes, stop conditions, and 0-9 output rubric so judges can inspect the actual operating discipline.

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
  --data @input_examples/example_1.json
```

`run.py` is the root FastAPI Agentathon evaluator wrapper. It exposes `GET /health`, `GET /metadata`, `GET /logs`, `GET /compass/probe`, and `POST /run` on `0.0.0.0:8000`, then delegates deterministic execution to the existing Node/CommonJS compliance runtime through the Agentathon bridge.

Compass compatibility:

- Preferred Parallax42 path: `COMPASS_GATEWAY_BASE_URL` plus `COMPASS_GATEWAY_TOKEN`.
- Direct evaluator path: `OPENAI_BASE_URL=https://compass.core42.ai/v1` plus `OPENAI_API_KEY`, following the official Agentathon template. Runtime also accepts `https://api.core42.ai/v1` when Core42/Agentathon confirms that base for the issued key.
- Embeddings remain `text-embedding-3-large`; final compliance decisions remain deterministic.

## Demo Path

1. Open the static cockpit locally or from the live URL.
2. Start in the chat-first advisor workspace.
3. Describe a compliance case with business owner, geography, service, integrations, and available evidence.
4. Attach or reference evidence where available.
5. Let the agent identify missing context, evidence IDs, obligations, and blockers.
6. Run the council.
7. Review the decision, domain coverage, gaps, controls, citations, trace, and human-approval status.
8. Continue the chat with a material update if useful. The product retains the prior evidence/result, distinguishes additions from replacements, marks stale council output for rerun, and asks clarification before ambiguous overwrites.
9. Generate or export the executive review pack.

## What Judges Should Evaluate

- Relevance to structured enterprise compliance workflows.
- Quality of the chat-first case-building experience.
- Deterministic decision logic, blocker naming, controls, and human-approval boundary.
- Evidence retrieval boundary and citation discipline.
- Optional CrewAI-shaped orchestration and Compass advisory model path.
- Governed agent-loop design: Planner + Doer, Proposer + Critic, Context-Packer + Actor, and Evidence-Weaver + Synthesizer pairings.
- Council quality rubric across accuracy, appropriateness, and actionability.
- Separated memory model: scratchpad, episodic log, and reusable advisory knowledge.
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
- Root FastAPI Agentathon wrapper plus Dockerfile and GitHub Actions Docker smoke for `/health` and `/run`.
- CourtListener, CUAD-compatible, NIST, and legacy CAP import/index paths for advisory Reference Intelligence memory.
- Postgres-backed demo session/case lifecycle state with an in-process development fallback.
- Local vector store fallback with an isolated Railway Qdrant REST provider configured server-side through Vercel; the public demo uses labelled deterministic hash vectors and semantic indexing requires an approved Compass credential.
- Local append-only hash-chained JSONL audit.

Not implemented or not claimed:

- React, Vite, or `ui/src`.
- Redis, Celery, or durable queues.
- OpenClaw.
- Arbitrary scanned-PDF OCR without external parser/OCR configuration.
- Production durable audit persistence; session/case Postgres and vector storage are configured separately, while the append-only audit log remains filesystem-based.
- Public hosted FastAPI URL unless this repo Dockerfile is deployed to a public container host and `/metadata`, `/logs`, `/compass/probe`, and `/run` are verified.
- Enterprise SSO; the demo/pilot boundary uses enforced session/pilot RBAC and remains separate from a production identity provider.

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
