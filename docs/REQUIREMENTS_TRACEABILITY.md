# Requirements Traceability

| G42 Requirement | Current Evidence | Status | Exceed Strategy |
| --- | --- | --- | --- |
| Live production deployment | Parallax42 UI, FastAPI backend, Railway backend, Vercel Compass gateway, plus Vercel-ready APIs in this repo. | Partial | Deploy this repo's Vercel API and attach generated evidence snapshots. |
| Cloud-agnostic or Azure-compatible | Azure migration design exists in source Parallax42/Risk Intelligence work. | Partial | Add Azure deployment reference architecture and IaC later. |
| Secure API / sovereign LLM integration | Compass gateway boundary and no browser-held model keys. | Strong | Add live smoke-test artifact and gateway threat model. |
| Structured data processing/reporting | Agent outputs JSON decisions, controls, evidence IDs, trace; `npm run capture:evidence` exports JSON artifacts. | Strong | Add CSV export and signed audit pack endpoint. |
| Conversational enterprise workflow | Chat-first UI plus `/api/conversation` NLP case builder extracts fields, asks missing-context questions, and executes the CrewAI-routed workflow. | Strong | Add live LLM-backed clarification planning with eval-gated tool use. |
| Explainability and audit traceability | Trace events, evidence quality, retrieval audit, decision readiness, review-pack digest, and hash-chained append-only audit JSONL with integrity verification. | Strong locally | Back `AGENT_AUDIT_DIR` with durable managed storage or move the same event shape into PostgreSQL. |
| Exception handling and escalation | Gaps include severity and action; decision is ready/conditional/not-ready. | Strong | Add role owner mapping and SLA/due-date fields. |
| RBAC/authentication | Route policy middleware, Entra-compatible JWT validation, and enforced mode via `P42_AUTH_MODE=enforced`. | Partial | Configure production Entra tenant/audience/JWKS and record reviewer role proof. |
| Responsible AI controls | Human approval, no automatic approval, evidence discipline, docs. | Partial | Add adversarial evals and RAI report generator. |
| Performance benchmarks | Local benchmark endpoint, benchmark script, Parallax42 20/20 golden eval evidence, and hardware/import regression tests. | Partial | Add load, latency, fallback-rate, and upload/OCR benchmarks. |
| Prior deployments/references | Live Parallax42 deployment and generated health evidence artifacts. | Partial | Add deployment screenshots, endpoint proofs, and reference note. |
| Technical architecture | `docs/TECHNICAL_ARCHITECTURE.md`. | Strong | Add diagrams and data-flow threat model. |
| Integration capabilities | Integration matrix, Parallax42 ingestion API design, and sample payloads for Coupa, ServiceNow, SharePoint, and Dynamics. | Strong | Add live replay screenshots and integration contract tests. |
| Video demonstration | Script planned. | Gap | Record "Watch the Agent Work" using live demo route. |
| CrewAI | CrewAI Flow runtime router, Flow adapter, agents/tasks YAML, dry-run CI check, live Flow validation path, and Node-side Compass GPT-5.1 advisory adapter for Vercel. | Strong | Add eval gates before live LLM output can influence any non-advisory workflow. |

## Positioning

The submission should not claim every enterprise hardening task is complete. It should claim the agent already has a runnable core, a live adjacent Parallax42 deployment, CrewAI Flow orchestration, and a clear hardening path that is more mature than a demonstration-only prototype.
