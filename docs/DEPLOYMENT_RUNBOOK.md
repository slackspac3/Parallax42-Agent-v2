# Deployment Runbook

## Surfaces

| Surface | Path | Purpose |
| --- | --- | --- |
| GitHub Pages | `public/` | Static "Watch the Agent Work" cockpit. |
| Vercel Functions | `api/` | Health, readiness, benchmark, agent run, audit, and backend relay APIs. |
| Parallax42 backend / Ocean droplet | `PARALLAX42_BACKEND_URL` | Parser/backend relay, optional remote services, and droplet-hosted Qdrant proxy. |
| Compass gateway/API boundary | `COMPASS_GATEWAY_BASE_URL`, `COMPASS_GATEWAY_TOKEN` | Server-side smart intake, advisory LLM, and embedding calls. |
| Agentathon evaluator wrapper | `run.py`, Dockerfile, `.github/workflows/agentathon-preflight.yml` | Reproducible `/run` API on port `8000` for technical screening. |

## GitHub Pages

The workflow `.github/workflows/pages.yml` publishes `public/` on pushes to `main` when cockpit files change.

Required repository setting:

```text
Settings -> Pages -> Source -> GitHub Actions
```

Smoke check after deployment:

```text
https://slackspac3.github.io/Parallax42-Compliance-Intelligence-Agent/
```

The cockpit reads `public/config.js` and defaults to the Vercel relay outside localhost.

Current API relay:

```text
https://parallax42-compliance-intelligence.vercel.app
```

## Vercel API

Deploy the repo to Vercel with the repository root as the project root. The API functions are plain Node serverless handlers and do not require a build step.

Recommended environment:

```text
PARALLAX42_BACKEND_URL=https://api.parallax42.bhavukarora.com
AGENT_RUNTIME=custom
CREWAI_ENABLE_LIVE_LLM=0
CREWAI_LLM_MODEL=gpt-5.1
CREWAI_LLM_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
CREWAI_LLM_API_KEY=<same-value-as-COMPASS_GATEWAY_TOKEN>
COMPASS_GATEWAY_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
COMPASS_GATEWAY_TOKEN=<server-side gateway token>
EMBEDDINGS_MODEL=text-embedding-3-large
P42_REQUIRE_DURABLE_STORAGE=0
P42_VECTOR_STORE_PROVIDER=qdrant
QDRANT_URL=<server-side-qdrant-url-or-droplet-proxy>
QDRANT_API_KEY=<server-side-vector-db-key>
QDRANT_COLLECTION=p42_compliance_evidence
P42_ALLOWED_ORIGINS=https://slackspac3.github.io,http://127.0.0.1:3020,http://localhost:3020
AGENT_AUDIT_DIR=/tmp/p42-compliance-intelligence-agent
```

The deployed online product path is configured through encrypted Vercel environment variables and uses Qdrant-backed evidence memory through the Ocean/DigitalOcean droplet. A local or separate Agentathon runtime falls back unless equivalent Qdrant and embedding variables are exported.

Set `CREWAI_ENABLE_LIVE_LLM=1` only after approved provider credentials are configured in Vercel. Live LLM specialist output is advisory and remains behind deterministic decision guardrails. On Vercel, `AGENT_RUNTIME=crewai_llm` uses the Node-side Compass advisory adapter when the Python CrewAI live adapter is unavailable.

For enterprise production, set `P42_REQUIRE_DURABLE_STORAGE=1` only after managed vector and audit storage are configured. Otherwise health/readiness will correctly report that the browser boundary is safe but storage is not durable.

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

## Optional Public FastAPI Container

The current public demo is GitHub Pages + Vercel product APIs. That is not the root FastAPI evaluator wrapper. If a final reviewer requires a public `run.py` URL, deploy the existing Dockerfile to a container host and use these checks before publishing the URL:

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

Do not reuse a Railway/Ocean product-backend URL as FastAPI proof unless those checks pass against this repo's API shape.
