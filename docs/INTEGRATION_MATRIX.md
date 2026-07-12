# Integration Matrix

Current-state verification and open defects are in the [deep code review](DEEP_CODE_REVIEW.md). The selected infrastructure transition is in the [Azure migration plan](AZURE_MIGRATION_PLAN.md).

| Integration | Current State | Target For Submission |
| --- | --- | --- |
| Vercel working demo | Primary browser app and product API handlers for health, readiness, benchmark, conversation, evidence, council, audit, export, and relay. | Use as the working-demo entry point; verify the authenticated true-user workflow, not just `/api/health`. |
| GitHub Pages UI | Static mirror that calls the Vercel API; it does not host product or FastAPI routes. | Keep as rollback/submission mirror without privileged browser tokens. |
| Parallax42 backend / Ocean services | Parser/backend relay code is allowlisted, but the verified production feature flag is disabled. | Enable only after the data-flow and credential boundary is approved; it is not Compass or Agentathon FastAPI proof. |
| Agentathon FastAPI wrapper | Root `run.py`, `Dockerfile`, and GitHub Actions `docker-smoke` verify `/health` and `/run` on port `8000`. | Treat CI/Docker as the current proof. Add a public container deployment only if final submission instructions require a browsable FastAPI URL. |
| Compass gateway/API boundary | Hosted product uses the named Parallax42 gateway client for GPT-5.1 smart intake/advisory work and `text-embedding-3-large`; credentials remain server-side. | Keep health/status proof and explain that the browser receives no Compass keys. |
| Qdrant/vector memory | Hosted product uses isolated Railway Qdrant with live semantic embeddings. Deterministic hash vectors and local storage are fallback/reproduction modes. | Demonstrate Vercel `/api/evidence/index` and `/api/evidence/search` returning `provider=qdrant` and sanitized snippets. |
| OCR/document parsing | Product path can use backend parser relay; fixture PDFs are generated text-based demo inputs. | Demonstrate supported fixture PDF evidence intake; do not claim arbitrary scanned-PDF OCR. |
| Coupa/ServiceNow/Dynamics/GRC/SharePoint/SAP/Ariba/Oracle/Workday | Normalization API documented in Parallax42, with local sample payloads under `examples/integrations/`. | Add screenshots and live replay evidence. |
| Microsoft Entra ID | Demo RBAC is enforced with the current demo identity model; Entra tenant/issuer/audience integration is not configured. | Add Entra and verify app roles, issuer, audience, tenant, and JWKS before enterprise identity claims. |
| PostgreSQL | Isolated Railway Postgres durably stores case, session, and quota records. | Migrate with rehearsed backup/restore and rollback gates described in the Azure plan. |
| Audit persistence | Hash-chained JSONL exists, but the hosted Vercel path writes to ephemeral `/tmp` and the read surface is not tenant-safe. | Move audit events to durable tenant-scoped Postgres records with immutable Blob retention before enterprise claims. |
| AI assurance portal | Separate repo. | Use for Responsible AI benchmark evidence. |

## Priority Order

1. Keep the primary Vercel working demo plus its GitHub Pages mirror and Railway persistence proof green.
2. Preserve the Agentathon Docker `/run` workflow proof.
3. Do not label Railway/Ocean/Vercel product endpoints as the FastAPI evaluator unless they expose this repo's `/metadata`, `/logs`, `/compass/probe`, and official `/run` schema.
4. Record the 2-3 minute demo video from the online cockpit.
5. Close the decision/evidence/tenant-isolation blockers in the deep review before treating the demo as decision-safe.
6. Add durable tenant-scoped audit persistence.
7. Add live Entra tenant proof before enterprise identity claims.
