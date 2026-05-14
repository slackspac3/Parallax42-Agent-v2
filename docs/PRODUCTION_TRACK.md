# Production Track

This repo is designed to exceed the G42 brief by packaging a runnable agent, an orchestration design, a deployment cockpit, and a hardening path instead of only a static prototype.

## Already Implemented

| Capability | Evidence |
| --- | --- |
| Runnable compliance agent | `POST /api/agent/run`, local server, and Vercel function handler. |
| CrewAI orchestration | `crewai_adapter/` with six specialized agents and CI dry-run validation. |
| Human approval posture | Decisions are recommendations with explicit gaps and no auto-approval path. |
| Evidence discipline | Evidence IDs, domain scan, gap list, trace events, and audit records. |
| Deployment cockpit | GitHub Pages-ready UI with local/relay/live runtime controls. |
| Serverless API | Vercel handlers for health, readiness, benchmarks, audit, agent run, and relay. |
| Production proof link | Live Parallax42 backend and Compass gateway health capture. |
| Benchmarking | Local benchmark runner plus generated evidence artifacts. |

## Next Hardening Steps

| Area | Implementation Target | Why It Matters |
| --- | --- | --- |
| Durable audit | PostgreSQL append-only run/audit tables with hash chaining. | Makes traceability enterprise-grade instead of local JSONL. |
| RBAC | Microsoft Entra JWT validation plus role-policy middleware. | Satisfies secure authentication and reviewer/operator separation. |
| Live workflow switch | Route selected `/api/agent/run` cases to the Parallax42 workflow. | Converts the demo agent into the deployed enterprise workflow path. |
| Responsible AI evals | Adversarial cases, unsupported-claim detection, bias review, and refusal checks. | Moves RAI from control design to measurable assurance. |
| Integration tests | Contract tests for ServiceNow, Coupa, SharePoint, Dynamics, and GRC payloads. | Proves integration readiness beyond documentation. |
| Demo recording | Capture intake, evidence upload, domain scan, gap challenge, recommendation, and audit. | Satisfies "Watch the Agent Work" with repeatable proof. |

## Submission Positioning

Position the agent as a production-track compliance intelligence worker:

- It already runs, audits, benchmarks, and explains decisions.
- It is connected to existing Parallax42 production assets.
- It includes CrewAI design without making optional dependencies block execution.
- It is explicit about what remains before enterprise authorization.
