# Deployment Runbook

## Surfaces

| Surface | Path | Purpose |
| --- | --- | --- |
| GitHub Pages | `public/` | Static "Watch the Agent Work" cockpit. |
| Vercel Functions | `api/` | Health, readiness, benchmark, agent run, audit, and backend relay APIs. |
| Parallax42 backend | `PARALLAX42_BACKEND_URL` | Live deployment proof and advanced workflow boundary. |
| Compass gateway | `P42_GATEWAY_HEALTH_URL` | Model gateway health evidence. |

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
P42_ALLOWED_ORIGINS=https://slackspac3.github.io,http://127.0.0.1:3020,http://localhost:3020
AGENT_AUDIT_DIR=/tmp/p42-compliance-intelligence-agent
```

Expected endpoints:

```text
GET  /api/health
GET  /api/readiness
GET  /api/benchmarks
GET  /api/audit/recent
GET  /api/demo/golden
POST /api/agent/run
GET  /api/backend?path=/health
```

The backend relay only forwards allowlisted demo routes. Private admin, knowledge, and arbitrary backend paths are intentionally blocked.

## Evidence Refresh

Run this before packaging a submission:

```bash
npm run qa
npm run capture:evidence
```

Attach the generated `evidence/index.json`, `evidence/live-health.json`, `evidence/benchmark-report.json`, and `evidence/sample-agent-run.json` to the submission dossier.
