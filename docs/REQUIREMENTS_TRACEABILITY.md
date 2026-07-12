# Requirements Traceability

| G42 Requirement | Current Evidence | Status | Exceed Strategy |
| --- | --- | --- | --- |
| Live production deployment | Online GitHub Pages cockpit, Vercel product APIs, isolated Railway Postgres/Qdrant, and GitHub Actions Docker `/run` proof. | Strong | Keep CI/Agentathon Preflight green and include Vercel health/Qdrant evidence as product-demo proof. |
| Cloud-agnostic or Azure-compatible | Azure migration design exists in source Parallax42/Risk Intelligence work. | Partial | Add Azure deployment reference architecture and IaC later. |
| Secure API / sovereign LLM integration | Server-side Compass gateway/API boundary, no browser-held model keys, direct FastAPI `OPENAI_API_KEY` / `OPENAI_BASE_URL` diagnostics, and strict CI when the secret exists. | Strong | Capture official-host Compass proof after a rotated credential is configured; otherwise keep deterministic fallback and the optional boundary explicit. |
| Structured data processing/reporting | Agent outputs JSON decisions, controls, evidence IDs, trace; `npm run capture:evidence` exports JSON artifacts. | Strong | Add CSV export and signed audit pack endpoint. |
| Conversational enterprise workflow | Chat-first UI plus `/api/conversation` NLP case builder extracts fields, carries stable active-question IDs/fields, asks missing-context questions, and executes the governed council workflow. | Strong | Keep adding regression tests for high-value terse answers instead of training by one-off prompt patches. |
| Explainability and audit traceability | Trace events, evidence quality, retrieval audit, decision readiness, review-pack digest, and hash-chained append-only audit JSONL with integrity verification. | Strong locally | Back `AGENT_AUDIT_DIR` with durable managed storage or move the same event shape into PostgreSQL. |
| Exception handling and escalation | Gaps include severity and action; decision is ready/conditional/not-ready. | Strong | Add role owner mapping and SLA/due-date fields. |
| RBAC/authentication | Route policy middleware, isolated demo sessions/pilot cookies, and Entra-compatible JWT validation exist; the hosted v2 product API uses enforced mode. | Strong demo / partial enterprise | Configure production Entra tenant/audience/JWKS and record reviewer role proof before claiming enterprise SSO. |
| Responsible AI controls | Human approval, no automatic approval, evidence discipline, docs. | Partial | Add adversarial evals and RAI report generator. |
| Performance benchmarks | Local benchmark endpoint, benchmark script, Parallax42 20/20 golden eval evidence, and hardware/import regression tests. | Partial | Add load, latency, fallback-rate, and upload/OCR benchmarks. |
| Prior deployments/references | Live Parallax42 deployment and generated health evidence artifacts. | Partial | Add deployment screenshots, endpoint proofs, and reference note. |
| Technical architecture | `docs/TECHNICAL_ARCHITECTURE.md` plus visual diagram in `docs/AGENTATHON_SYSTEM_ARCHITECTURE.md`. | Strong | Add data-flow threat model later. |
| Integration capabilities | Integration matrix, Parallax42 ingestion API design, and sample payloads for Coupa, ServiceNow, SharePoint, and Dynamics. | Strong | Add live replay screenshots and integration contract tests. |
| Video demonstration | Script planned. | Gap | Record "Watch the Agent Work" using live demo route. |
| CrewAI | CrewAI Flow/runtime scaffolding, adapters, agents/tasks YAML, and dry-run checks exist; live CrewAI is optional and not default. | Partial | Add eval gates and provider proof before claiming active live CrewAI. |

## Positioning

The submission should not claim every enterprise hardening task is complete. It can claim an online-first product demo, the root `/run` wrapper verified through Docker/CI, visible multi-agent traces, isolated Postgres/Qdrant product services, deterministic retrieval, advisory governed learning, and a clear hardening path. It must not claim a public v2 FastAPI evaluator, enterprise SSO, enterprise-durable audit, arbitrary scanned-PDF OCR, semantic Compass embeddings without a rotated credential, Qdrant in every evaluator path, or live CrewAI unless those checks are separately verified.
