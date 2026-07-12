# Deployment Runbook

> This runbook covers the Vercel/Railway deployment, reviewed 2026-07-12. The seven deep-review P0 remediations and upload-first lifecycle regression pass final-worktree QA (270/270 Node and 13/13 Python security tests); CI and authenticated live-workflow re-verification are pending. It does not deploy the future Azure architecture; use the separate [Azure migration plan](AZURE_MIGRATION_PLAN.md).

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
P42_REQUIRE_DURABLE_STORAGE=1
DATABASE_URL=<encrypted-railway-postgres-url>
P42_VECTOR_STORE_PROVIDER=qdrant
P42_DEMO_EMBEDDINGS=false
QDRANT_URL=<authenticated-railway-qdrant-url>
QDRANT_API_KEY=<server-side-vector-db-key>
QDRANT_COLLECTION=p42_compliance_evidence_v2
P42_AUTH_MODE=enforced
P42_ALLOWED_ORIGINS=https://slackspac3.github.io,http://127.0.0.1:3020,http://localhost:3020
```

The deployed online product uses isolated Railway PostgreSQL and Qdrant. `P42_DEMO_EMBEDDINGS=false` selects semantic `text-embedding-3-large` embeddings through the named shared-gateway client; no provider key reaches the app or browser. A local or separate Agentathon runtime uses deterministic/local fallback unless equivalent Qdrant and gateway variables are exported.

On Vercel, `AGENT_RUNTIME=crewai_llm` with approved gateway credentials enables Node-side Compass advisory specialists. It does not prove that Python CrewAI executed. Python CrewAI requires its separate runtime/service, dependencies, credentials, and eval gates; it is currently inactive. Runtime telemetry must be checked for requested, actual, and fallback modes.

`DATABASE_URL` and Qdrant make configured product records and vectors durable. Audit chain heads/events use the same PostgreSQL service and are partitioned by actor-derived workspace/project; hosted writes return a service error rather than falling back to `/tmp` when PostgreSQL is absent. PostgreSQL is not immutable retention: add WORM range exports, restore drills, versioned migrations, and critical business-write/audit transaction coupling before describing the trail as enterprise-retained. Demo auth is enforced, but Microsoft Entra tenant/app-role/membership configuration is still pending.

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

Do not expose raw logs or a global audit tail as public health proof. `GET /api/logs` now returns a private non-cacheable 404. `GET /api/audit/recent` requires `audit:read`, derives workspace/project from the authenticated actor, tenant-filters both records and integrity verification, and returns `Cache-Control: private, no-store`. Public probes should return only coarse availability and must not trigger paid model work.

After deployment, verify without printing credentials:

```bash
curl -i https://parallax42-agent-v2.vercel.app/api/logs
curl -i https://parallax42-agent-v2.vercel.app/api/audit/recent
curl -i -H "Authorization: Bearer $P42_AUDITOR_TOKEN" https://parallax42-agent-v2.vercel.app/api/audit/recent
```

Expected: `/api/logs` is `404` with `private, no-store`; anonymous detailed audit is `401`; an auditor receives only their workspace/project chain. Deployment verification: **PENDING — fill with deployment URL, revision, CI run, and authenticated workflow evidence after release.**

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
curl -H "Authorization: Bearer $P42_AUDITOR_TOKEN" https://<fastapi-host>/logs
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
/logs is auditor-only, private/no-store, and returns no trace filenames or records
```

Do not reuse a Railway product database/vector endpoint or an unrelated backend URL as FastAPI proof. FastAPI `/logs` is role-gated and intentionally non-disclosing; `/compass/probe` still requires separate authentication/non-billable hardening before a public evaluator deployment.

## Future Azure Deployment

Azure is a migration target, not an alternate set of steps in this runbook. The minimum parity phase moves product compute while retaining the current Compass gateway and, initially, existing data services. The PostgreSQL tenant-chain implementation moves with the database; immutable Blob export, business/audit transaction coupling, edge/identity, and vector search follow explicit cutover and rollback gates. Follow [the Azure migration plan](AZURE_MIGRATION_PLAN.md) rather than translating Vercel variables ad hoc.
