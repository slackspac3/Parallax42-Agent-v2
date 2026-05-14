# Requirements Traceability

| G42 Requirement | Current Evidence | Status | Exceed Strategy |
| --- | --- | --- | --- |
| Live production deployment | Parallax42 UI, FastAPI backend, Railway backend, Vercel Compass gateway, plus Vercel-ready APIs in this repo. | Partial | Deploy this repo's Vercel API and attach generated evidence snapshots. |
| Cloud-agnostic or Azure-compatible | Azure migration design exists in source Parallax42/Risk Intelligence work. | Partial | Add Azure deployment reference architecture and IaC later. |
| Secure API / sovereign LLM integration | Compass gateway boundary and no browser-held model keys. | Strong | Add live smoke-test artifact and gateway threat model. |
| Structured data processing/reporting | Agent outputs JSON decisions, controls, evidence IDs, trace; `npm run capture:evidence` exports JSON artifacts. | Strong | Add CSV export and signed audit pack endpoint. |
| Explainability and audit traceability | Trace events plus local audit JSONL with Vercel-safe temporary persistence. | Strong locally | Move to PostgreSQL-backed immutable audit table. |
| Exception handling and escalation | Gaps include severity and action; decision is ready/conditional/not-ready. | Strong | Add role owner mapping and SLA/due-date fields. |
| RBAC/authentication | Parallax42 has admin-token model and Entra roadmap. | Gap | Implement Entra JWT validation and role-policy middleware. |
| Responsible AI controls | Human approval, no automatic approval, evidence discipline, docs. | Partial | Add adversarial evals and RAI report generator. |
| Performance benchmarks | Local benchmark endpoint, benchmark script, and Parallax42 20/20 golden eval evidence. | Partial | Add load, latency, fallback-rate, and upload/OCR benchmarks. |
| Prior deployments/references | Live Parallax42 deployment and generated health evidence artifacts. | Partial | Add deployment screenshots, endpoint proofs, and reference note. |
| Technical architecture | `docs/TECHNICAL_ARCHITECTURE.md`. | Strong | Add diagrams and data-flow threat model. |
| Integration capabilities | Integration matrix, Parallax42 ingestion API design, and sample payloads for Coupa, ServiceNow, SharePoint, and Dynamics. | Strong | Add live replay screenshots and integration contract tests. |
| Video demonstration | Script planned. | Gap | Record "Watch the Agent Work" using live demo route. |
| CrewAI | Optional CrewAI adapter, agents/tasks YAML, dry-run CI check. | Strong scaffold | Add live CrewAI run mode with configured LLM once secrets are available. |

## Positioning

The submission should not claim every enterprise hardening task is complete. It should claim the agent already has a runnable core, a live adjacent Parallax42 deployment, CrewAI orchestration design, and a clear hardening path that is more mature than a demonstration-only prototype.
