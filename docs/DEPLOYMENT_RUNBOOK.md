# Deployment Runbook

> This runbook covers the current Vercel/Railway deployment, reviewed 2026-07-12. It does not deploy the future Azure architecture; use the separate [Azure migration plan](AZURE_MIGRATION_PLAN.md). Review [current release blockers](DEEP_CODE_REVIEW.md) before promoting beyond a demo.

## Surfaces

| Surface | Path | Purpose |
| --- | --- | --- |
| Vercel | `public/`, `api/` | Primary hosted browser app plus Node health, readiness, benchmark, agent, evidence, export, and relay APIs. |
| GitHub Pages | `public/` | Optional static mirror; it is not an API or FastAPI evaluator host. |
| Railway Postgres and Qdrant | `DATABASE_URL`, `QDRANT_URL`, `QDRANT_API_KEY` | Isolated v2 session/case persistence and authenticated vector storage. |
| Optional Parallax42 backend | `PARALLAX42_BACKEND_URL` | Parser/backend relay; disabled in the verified production configuration and enabled only after data-flow approval. |
| Named Compass gateway client | `COMPASS_GATEWAY_BASE_URL`, `COMPASS_GATEWAY_TOKEN` | Server-side smart intake, Node advisory specialists, and semantic embedding calls. |
| Agentathon evaluator wrapper | `run.py`, Dockerfile, `.github/workflows/agentathon-preflight.yml` | Reproducible `/run` API on port `8000` for technical screening. |

## GitHub Pages

The workflow `.github/workflows/pages.yml` publishes `public/` on pushes to `main` when cockpit files change.

Required repository setting:

```text
Settings -> Pages -> Source -> GitHub Actions
```

Smoke check after deployment:

```text
https://slackspac3.github.io/Parallax42-Agent-v2/
```

The mirror reads `public/config.js` and targets the Vercel API outside localhost. Treat GitHub Pages as a separate shared-origin static surface; do not place privileged bearer tokens in browser storage or forward them to configurable origins.

Current API relay:

```text
https://parallax42-agent-v2.vercel.app
```

## Current Vercel App And API

Deploy the repo to Vercel with the repository root as the project root. The API functions are plain Node serverless handlers and do not require a build step.

Current deployment shape (store values only in encrypted Vercel environment settings):

```text
AGENT_RUNTIME=crewai_llm
CREWAI_ENABLE_LIVE_LLM=1
CREWAI_LLM_MODEL=gpt-5.1
CREWAI_LLM_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
CREWAI_LLM_API_KEY=<same-value-as-COMPASS_GATEWAY_TOKEN>
COMPASS_GATEWAY_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
COMPASS_GATEWAY_TOKEN=<server-side gateway token>
EMBEDDINGS_MODEL=text-embedding-3-large
P42_REQUIRE_DURABLE_STORAGE=0
DATABASE_URL=<encrypted-railway-postgres-url>
P42_VECTOR_STORE_PROVIDER=qdrant
P42_DEMO_EMBEDDINGS=false
QDRANT_URL=<authenticated-railway-qdrant-url>
QDRANT_API_KEY=<server-side-vector-db-key>
QDRANT_COLLECTION=p42_compliance_evidence_v2
P42_AUTH_MODE=enforced
P42_ALLOWED_ORIGINS=https://slackspac3.github.io,http://127.0.0.1:3020,http://localhost:3020
AGENT_AUDIT_DIR=/tmp/p42-compliance-intelligence-agent
```

The deployed online product uses isolated Railway PostgreSQL and Qdrant. `P42_DEMO_EMBEDDINGS=false` selects semantic `text-embedding-3-large` embeddings through the named shared-gateway client; no provider key reaches the app or browser. A local or separate Agentathon runtime uses deterministic/local fallback unless equivalent Qdrant and gateway variables are exported.

On Vercel, `AGENT_RUNTIME=crewai_llm` with approved gateway credentials enables Node-side Compass advisory specialists. It does not prove that Python CrewAI executed. Python CrewAI requires its separate runtime/service, dependencies, credentials, and eval gates; it is currently inactive. Runtime telemetry must be checked for requested, actual, and fallback modes.

`DATABASE_URL` and Qdrant make configured product records and vectors durable. `AGENT_AUDIT_DIR=/tmp/...` remains per-instance and nondurable, so leave `P42_REQUIRE_DURABLE_STORAGE=0` for the demo and do not describe the audit trail as enterprise-retained. Move tenant-scoped audit events to PostgreSQL plus immutable retention before setting the durable-storage requirement. Demo auth is enforced, but Microsoft Entra tenant/app-role configuration is still pending.

Expected endpoints:

```text
GET  /api/health
GET  /api/readiness
GET  /api/benchmarks
GET  /api/audit/recent
GET  /api/demo/golden
POST /api/agent/run
POST /api/evidence/index
POST /api/evidence/search
POST /api/export/review-pack
GET  /api/backend?path=/health
```

Do not expose raw logs or a global audit tail as public health proof. The current `/api/logs` and audit-scoping findings are documented release blockers; require the right role and authenticated workspace on every detailed read. Public probes should return only coarse availability and must not trigger paid model work.

`/api/evidence/index` returns only sanitized index metadata to the cockpit. Chunk embeddings are kept in the server-side vector store. The deployed product path uses Qdrant; local-file storage is only a fallback for development or unconfigured runtimes.

The backend relay only forwards allowlisted demo routes. Private admin, knowledge, and arbitrary backend paths are intentionally blocked.

## Evidence Refresh

Run this before packaging a submission:

```bash
npm run qa
npm run capture:evidence
```

Attach the generated `evidence/index.json`, `evidence/live-health.json`, `evidence/benchmark-report.json`, and `evidence/sample-agent-run.json` to the submission dossier.

## Agentathon Docker / `/run` Proof

The online Docker proof is GitHub Actions, not GitHub Pages:

```text
.github/workflows/agentathon-preflight.yml
```

The workflow builds the Docker image, runs `python run.py` in sample mode, calls `GET /health`, and posts `input_examples/example_1.json` to `POST /run`. Local reproduction:

```bash
python scripts/agentathon_preflight.py
python scripts/agentathon_preflight.py --run-api
python scripts/agentathon_preflight.py --docker
```

`--docker` reports `SKIPPED_DOCKER_CLI_MISSING` when the local Docker CLI is unavailable; that is not a claim that Docker was locally verified.

## Optional FastAPI Evaluator Container

The current public demo is Vercel; Railway supplies PostgreSQL/Qdrant and is not a public FastAPI evaluator. The root FastAPI wrapper is reproduced locally and in CI. If a reviewer explicitly requires a public `run.py` URL, first close its authentication, request-size, rate/concurrency, diagnostic-probe, dependency-pinning, and container-hardening findings, then deploy the existing Dockerfile to an approved container host and run these checks:

```bash
curl https://<fastapi-host>/health
curl https://<fastapi-host>/metadata
curl https://<fastapi-host>/logs
curl https://<fastapi-host>/compass/probe
curl -X POST https://<fastapi-host>/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
```

Required signal:

```text
service identifies Parallax42 Compliance Intelligence Agent
/metadata returns Use Case 21 metadata
/run accepts the Agentathon wrapper payload
logs are written under /logs/ or the configured container log directory
```

Do not reuse a Railway product database/vector endpoint or an unrelated backend URL as FastAPI proof. Do not publish `/logs` or `/compass/probe` without authentication and safe, non-billable probe behavior.

## Future Azure Deployment

Azure is a migration target, not an alternate set of steps in this runbook. The minimum parity phase moves the product compute while retaining the current Compass gateway and, initially, existing data services; later phases move durable data, tenant-scoped audit, edge/identity, and vector search behind explicit cutover and rollback gates. Follow [the Azure migration plan](AZURE_MIGRATION_PLAN.md) rather than translating Vercel variables ad hoc.
