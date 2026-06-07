# Requirements Traceability

| G42 Requirement | Current Evidence | Status | Exceed Strategy |
| --- | --- | --- | --- |
| Live production deployment | Online GitHub Pages cockpit, Vercel product APIs, Railway public evaluator API, Ocean/DigitalOcean backend services, droplet-hosted product Qdrant, and GitHub Actions Docker `/run` proof. | Strong | Keep CI/Agentathon Preflight green, recheck Railway `/health`, `/metadata`, `/logs`, `/compass/probe`, and `/run` before submission, and include Vercel health/Qdrant evidence only as product-demo proof. |
| Cloud-agnostic or Azure-compatible | Azure migration design exists in source Parallax42/Risk Intelligence work. | Partial | Add Azure deployment reference architecture and IaC later. |
| Secure API / sovereign LLM integration | Server-side Compass gateway/API boundary, no browser-held model keys, direct FastAPI `OPENAI_API_KEY` / `OPENAI_BASE_URL` diagnostics, public Railway `/compass/probe`, and strict CI when the secret exists. | Strong | Capture official-host Compass proof if the issued key supports `https://compass.core42.ai/v1`; otherwise keep the alternate Core42 base clearly documented. |
| Structured data processing/reporting | Agent outputs JSON decisions, controls, evidence IDs, trace; `npm run capture:evidence` exports JSON artifacts. | Strong | Add CSV export and signed audit pack endpoint. |
| Conversational enterprise workflow | Chat-first UI plus `/api/conversation` NLP case builder extracts fields, carries stable active-question IDs/fields, asks missing-context questions, and executes the governed council workflow. | Strong | Keep adding regression tests for high-value terse answers instead of training by one-off prompt patches. |
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

The submission should not claim every enterprise hardening task is complete. It should claim the agent already has an online-first product demo, a public Railway FastAPI evaluator API, the same root `/run` wrapper verified through Docker/CI, visible multi-agent traces, server-side Compass usage, deployed Qdrant-backed product evidence memory, advisory governed learning, and a clear hardening path that is more mature than a demonstration-only prototype. It should not claim GitHub Pages or Vercel as the evaluator `/run` host, enforced RBAC, enterprise-durable audit, arbitrary scanned-PDF OCR, Qdrant in every evaluator path, official-host Compass proof in every environment, or live CrewAI unless those checks are separately verified.
