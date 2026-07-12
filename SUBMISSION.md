# Submission

## Live URLs

Primary demo surfaces:

- Static cockpit: `https://slackspac3.github.io/Parallax42-Agent-v2/`
- Compliance Intelligence Agent API: `https://parallax42-agent-v2.vercel.app`
- API health: `https://parallax42-agent-v2.vercel.app/api/health`
- Compass gateway health: `https://parallax42-compass-gateway.vercel.app/api/health`

Verified hosted state (2026-07-12): a named authenticated client on the shared Compass gateway supplies GPT-5.1 smart intake/advisory calls and `text-embedding-3-large` semantic embeddings. The underlying provider key remains only in the gateway. JavaScript advisory specialists are active; Python CrewAI is optional and inactive. Deterministic Node policy is the intended final decision authority and fallback.

Railway PostgreSQL persists hosted sessions, cases, and quotas, while authenticated Railway Qdrant stores vectors. Demo/session RBAC is enforced, but Microsoft Entra SSO is not implemented. Serverless audit JSONL remains under `/tmp`, so it is nondurable. Review current correctness and isolation blockers in the [Deep Code Review](docs/DEEP_CODE_REVIEW.md), and use the [Azure Migration Plan](docs/AZURE_MIGRATION_PLAN.md) for the selected cloud path.

## Selected Hackathon Use Case

- **Use Case ID:** `21`
- **Problem statement:** Legal Intelligence / Compliance
- **Suggested data source alignment:** CourtListener / Free Law Project, with legacy Caselaw Access Project support

Parallax42 applies Legal Intelligence to enterprise agreement and compliance-evidence review. The system reviews contracts, MSAs, DPAs, outsourcing arrangements, and supporting assurance evidence, then produces a human-review decision memo with risks, required actions, citations, and a deterministic specialist trace. CourtListener/CAP references are used only as advisory legal-reference memory for clause and risk comparison, citation checks, and reviewer questions; they are not legal advice and do not approve the case.

The demo should be described as a governed-L2 target, not unrestricted autonomous approval. The council can loop through intake, retrieval, obligation mapping, risk/control critique, and pack generation, and is intended to stop at human review, missing proof, or a low quality-rubric score. Current evidence/readiness defects mean those stop conditions are not yet reliable enough for production assurance. The review pack exposes the agent loop spec, agentic pairings, memory lanes, stop conditions, and 0-9 output rubric so judges can inspect the intended discipline.

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
- Embeddings remain `text-embedding-3-large`; final compliance decisions are intended to remain owned by deterministic Node policy. The Python authority-parity defect is an open release gate.

## Demo Path

1. Open the static cockpit locally or from the live URL.
2. Start in the chat-first advisor workspace.
3. Describe a compliance case with business owner, geography, service, integrations, and available evidence.
4. Attach or reference evidence where available.
5. Let the agent identify missing context, evidence IDs, obligations, and blockers.
6. Run the council.
7. Review the decision, domain coverage, gaps, controls, citations, trace, and human-approval status.
8. Continue the chat with a material update as an acceptance test. The intended behavior retains prior evidence/result, distinguishes additions from replacements, marks stale council output for rerun, and asks before ambiguous overwrites; the current stale-version defect is tracked in the deep review.
9. Generate or export the executive review pack.

## What Judges Should Evaluate

- Relevance to structured enterprise compliance workflows.
- Quality of the chat-first case-building experience.
- Deterministic decision logic, blocker naming, controls, and human-approval boundary.
- Evidence retrieval boundary and citation discipline.
- Active Compass-backed JavaScript advisory specialists, optional Python CrewAI, and intended deterministic fallback/decision ownership, with current authority defects disclosed.
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
- Deterministic Node policy as the intended final decision owner; current parity defects are tracked in the deep review.
- Named authenticated Compass gateway client for hosted GPT-5.1 calls and `text-embedding-3-large` embeddings; the provider key stays in the shared gateway.
- Root FastAPI Agentathon wrapper plus Dockerfile and GitHub Actions Docker smoke for `/health` and `/run`.
- CourtListener, CUAD-compatible, NIST, and legacy CAP import/index paths for advisory Reference Intelligence memory.
- PostgreSQL-backed demo session/case/quota lifecycle state with an in-process development fallback.
- Local deterministic vector fallback plus authenticated Railway Qdrant configured through Vercel; the hosted demo uses live `text-embedding-3-large` semantic vectors from the shared Compass gateway.
- Append-only hash-chained JSONL audit, nondurable under serverless `/tmp`.

Not implemented or not claimed:

- React, Vite, or `ui/src`.
- Redis, Celery, or durable queues.
- OpenClaw.
- Arbitrary scanned-PDF OCR without external parser/OCR configuration.
- Production durable audit persistence; session/case Postgres and vector storage are configured separately, while the append-only audit log remains filesystem-based.
- Public hosted FastAPI URL unless this repo Dockerfile is deployed to a public container host and `/metadata`, `/logs`, `/compass/probe`, and `/run` are verified.
- Microsoft Entra SSO; the demo/pilot boundary uses enforced session/pilot RBAC and remains separate from an enterprise identity provider.

## Supporting Docs

- [Deep Code Review](docs/DEEP_CODE_REVIEW.md)
- [Azure Migration Plan](docs/AZURE_MIGRATION_PLAN.md)
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
