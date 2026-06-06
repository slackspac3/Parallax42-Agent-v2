# Requirements Traceability

| G42 Requirement | Current Evidence | Status | Exceed Strategy |
| --- | --- | --- | --- |
| Live production deployment | Online GitHub Pages cockpit, Vercel product APIs, Ocean/DigitalOcean backend services, droplet-hosted Qdrant, and GitHub Actions Docker `/run` proof. | Strong for product demo; evaluator FastAPI is CI/Docker-proven rather than public-hosted. | Keep CI/Agentathon Preflight green and include Vercel health/Qdrant evidence in the demo. If the final form requires a public FastAPI URL, deploy this repo Dockerfile to a container host and verify `/health`, `/metadata`, and `/run`. |
| Cloud-agnostic or Azure-compatible | Azure migration design exists in source Parallax42/Risk Intelligence work. | Partial | Add Azure deployment reference architecture and IaC later. |
| Secure API / sovereign LLM integration | Server-side Compass gateway/API boundary, no browser-held model keys, and direct FastAPI `OPENAI_API_KEY` / `OPENAI_BASE_URL` diagnostics for evaluator reproduction. | Strong | Add live strict Compass artifact when issued credentials are available. |
| Structured data processing/reporting | Agent outputs JSON decisions, controls, evidence IDs, trace; `npm run capture:evidence` exports JSON artifacts. | Strong | Add CSV export and signed audit pack endpoint. |
| Conversational enterprise workflow | Chat-first UI plus `/api/conversation` NLP case builder extracts fields, asks missing-context questions, and executes the CrewAI-routed workflow. | Strong | Add live LLM-backed clarification planning with eval-gated tool use. |
| Explainability and audit traceability | Trace events, evidence quality, retrieval audit, decision readiness, review-pack digest, and hash-chained append-only audit JSONL with integrity verification. | Strong locally | Back `AGENT_AUDIT_DIR` with durable managed storage or move the same event shape into PostgreSQL. |
| Exception handling and escalation | Gaps include severity and action; decision is ready/conditional/not-ready. | Strong | Add role owner mapping and SLA/due-date fields. |
| RBAC/authentication | Route policy middleware and Entra-compatible JWT validation code exist; submitted demo is audit-mode unless `P42_AUTH_MODE=enforced` and tenant env are configured. | Partial | Configure production Entra tenant/audience/JWKS and record reviewer role proof before claiming enforced RBAC. |
| Responsible AI controls | Human approval, no automatic approval, evidence discipline, docs. | Partial | Add adversarial evals and RAI report generator. |
| Performance benchmarks | Local benchmark endpoint, benchmark script, Parallax42 20/20 golden eval evidence, and hardware/import regression tests. | Partial | Add load, latency, fallback-rate, and upload/OCR benchmarks. |
| Prior deployments/references | Live Parallax42 deployment and generated health evidence artifacts. | Partial | Add deployment screenshots, endpoint proofs, and reference note. |
| Technical architecture | `docs/TECHNICAL_ARCHITECTURE.md` plus visual diagram in `docs/AGENTATHON_SYSTEM_ARCHITECTURE.md`. | Strong | Add data-flow threat model later. |
| Integration capabilities | Integration matrix, Parallax42 ingestion API design, and sample payloads for Coupa, ServiceNow, SharePoint, and Dynamics. | Strong | Add live replay screenshots and integration contract tests. |
| Video demonstration | Script planned. | Gap | Record "Watch the Agent Work" using live demo route. |
| CrewAI | CrewAI Flow/runtime scaffolding, adapters, agents/tasks YAML, and dry-run checks exist; live CrewAI is optional and not default. | Partial | Add eval gates and provider proof before claiming active live CrewAI. |

## Positioning

The submission should not claim every enterprise hardening task is complete. It should claim the agent already has an online-first product demo, a standardized root FastAPI `/run` wrapper verified through Docker/CI, visible multi-agent traces, server-side Compass usage, deployed Qdrant-backed product evidence memory, advisory governed learning, and a clear hardening path that is more mature than a demonstration-only prototype. It should not claim a public hosted FastAPI URL, direct Compass strict verification, enforced RBAC, enterprise-durable audit, arbitrary scanned-PDF OCR, or live CrewAI unless those checks are separately verified.
