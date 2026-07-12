# Integration Matrix

| Integration | Current State | Target For Submission |
| --- | --- | --- |
| GitHub Pages UI | Static cockpit is the primary online judge demo surface. | Use as "Watch the Agent Work" entry point and record from it. |
| Vercel Functions | Product API handlers exist for health, readiness, benchmark, conversation, evidence index/search, agent run, audit, export, and backend relay. | Keep Pages `public/config.js` pointed at the Vercel URL and verify `/api/health`. |
| Parallax42 backend / Ocean services | Live endpoint exists and Vercel relay is allowlisted for browser-safe demo calls. | Use as product backend/parser/service evidence, not as Compass API and not as Agentathon FastAPI proof unless this repo Dockerfile is deployed there. |
| Agentathon FastAPI wrapper | Root `run.py`, `Dockerfile`, and GitHub Actions `docker-smoke` verify `/health` and `/run` on port `8000`. | Treat CI/Docker as the current proof. Add a public container deployment only if final submission instructions require a browsable FastAPI URL. |
| Compass gateway/API boundary | Product path keeps model and embedding calls server-side through Vercel/gateway configuration. | Show health/status and explain browser receives no Compass keys. |
| Qdrant/vector memory | Deployed product API uses isolated Railway Qdrant with labelled deterministic demo embeddings; local/FastAPI runs remain env-dependent. | Demonstrate Vercel `/api/evidence/index` and `/api/evidence/search` returning `provider=qdrant` and sanitized snippets. |
| OCR/document parsing | Product path can use backend parser relay; fixture PDFs are generated text-based demo inputs. | Demonstrate supported fixture PDF evidence intake; do not claim arbitrary scanned-PDF OCR. |
| Coupa/ServiceNow/Dynamics/GRC/SharePoint/SAP/Ariba/Oracle/Workday | Normalization API documented in Parallax42, with local sample payloads under `examples/integrations/`. | Add screenshots and live replay evidence. |
| Microsoft Entra ID | RBAC/JWT validation code exists, but submitted demo remains audit-mode unless tenant env is configured. | Clearly mark enforced RBAC as enterprise hardening unless live tenant proof exists. |
| PostgreSQL | Optional/scaffolded in Parallax42; this repo uses JSONL plus Vercel `/tmp` fallback. | Enable for durable run/audit records. |
| AI assurance portal | Separate repo. | Use for Responsible AI benchmark evidence. |

## Priority Order

1. Keep the online GitHub Pages + Vercel + Railway persistence demo proof green.
2. Preserve the Agentathon Docker `/run` workflow proof.
3. Do not label Railway/Ocean/Vercel product endpoints as the FastAPI evaluator unless they expose this repo's `/metadata`, `/logs`, `/compass/probe`, and official `/run` schema.
4. Record the 2-3 minute demo video from the online cockpit.
5. Add durable run/audit persistence for enterprise claims.
6. Add live tenant proof for enforced RBAC only when ready.
