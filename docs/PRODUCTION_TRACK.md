# Production Track

This repo is designed to exceed the G42 brief by packaging a runnable agent, an orchestration design, a deployment cockpit, and a hardening path instead of only a static prototype.

## Already Implemented

| Capability | Evidence |
| --- | --- |
| Runnable compliance agent | `POST /api/agent/run`, local server, and Vercel function handler. |
| Agentathon evaluator wrapper | Root `run.py`, FastAPI `/run`, Dockerfile, metadata, examples, and JSONL traces. |
| Online product demo | GitHub Pages cockpit backed by Vercel product APIs and isolated Railway Postgres/Qdrant. |
| Server-side Compass boundary | Product smart intake/advisory/embedding calls are kept behind Vercel/gateway routes; browser receives no keys. |
| Qdrant-backed evidence memory | Deployed Vercel product APIs index/search the isolated v2 collection and return sanitized snippets only. |
| CrewAI orchestration shape | `crewai_adapter/` with specialized agents and CI dry-run validation; live CrewAI is optional and not default. |
| Human approval posture | Decisions are recommendations with explicit gaps and no auto-approval path. |
| Evidence discipline | Evidence IDs, domain scan, gap list, trace events, and audit records. |
| Deployment cockpit | GitHub Pages-ready UI with local/relay/live runtime controls. |
| Serverless API | Vercel handlers for health, readiness, benchmarks, audit, agent run, and relay. |
| Production proof link | Live GitHub Pages cockpit, Vercel health/status, and isolated Railway Qdrant proof path. |
| Benchmarking | Local benchmark runner plus generated evidence artifacts. |
| Golden demo replay | `GET /api/demo/golden` plus `evidence/golden-demo-run.json`. |

## Next Hardening Steps

| Area | Implementation Target | Why It Matters |
| --- | --- | --- |
| Durable audit | Hash-chained append-only audit is implemented; PostgreSQL or durable mounted storage remains the production retention target. | Makes traceability verifiable now and enterprise-retained when storage is configured. |
| RBAC | Microsoft Entra-compatible JWT validation plus role-policy middleware is implemented behind `P42_AUTH_MODE=enforced`. | Satisfies secure authentication and reviewer/operator separation once tenant config is supplied. |
| Live workflow switch | Keep selected `/api/agent/run` cases aligned with the deployed product workflow. | Converts the demo agent into the deployed enterprise workflow path without weakening deterministic final authority. |
| CrewAI Flow runtime | Keep CrewAI as optional advisory runtime until dependencies, credentials, and eval gates are stable. | Aligns with production-oriented CrewAI patterns without making optional dependencies a submission risk. |
| Responsible AI evals | Adversarial cases, unsupported-claim detection, bias review, and refusal checks. | Moves RAI from control design to measurable assurance. |
| Integration tests | Contract tests for ServiceNow, Coupa, SharePoint, Dynamics, and GRC payloads. | Proves integration readiness beyond documentation. |
| Demo recording | Capture intake, evidence upload, domain scan, gap challenge, recommendation, and audit. | Satisfies "Watch the Agent Work" with repeatable proof. |

## Submission Positioning

Position the agent as a production-track compliance intelligence worker:

- It already runs, audits, benchmarks, and explains decisions.
- It is connected to isolated v2 Vercel/Railway assets.
- It includes CrewAI design without making optional dependencies block execution or final decisions.
- It uses Qdrant in the deployed product evidence API while keeping local/FastAPI fallback honest.
- It is explicit about what remains before enterprise authorization.
