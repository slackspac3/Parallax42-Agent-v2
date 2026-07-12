# Production Track

This is the current implementation and hardening ledger, reviewed 2026-07-12. The app is a working hosted demo, not an enterprise-authorized compliance decision system. See the [deep code review](DEEP_CODE_REVIEW.md) for release blockers and the [Azure migration plan](AZURE_MIGRATION_PLAN.md) for the future hosting path.

## Already Implemented

| Capability | Evidence |
| --- | --- |
| Runnable compliance agent | `POST /api/agent/run`, local server, and Vercel function handler. |
| Agentathon evaluator wrapper | Root `run.py`, FastAPI `/run`, Dockerfile, metadata, examples, and JSONL traces. |
| Online product demo | Vercel browser app and Node APIs backed by isolated Railway PostgreSQL/Qdrant; GitHub Pages remains a static mirror. |
| Server-side Compass boundary | A named shared-gateway client provides smart intake, Node advisory specialist calls, and semantic `text-embedding-3-large` embeddings; browser receives no provider keys. |
| Qdrant-backed evidence memory | Deployed Node APIs index/search an isolated v2 collection and return sanitized snippets; deterministic demo embeddings are disabled in the verified hosted configuration. |
| Agent runtime shape | Hosted Node advisory specialists use Compass with deterministic fallback. `crewai_adapter/` provides optional Python CrewAI and CI dry-run validation; live Python CrewAI is inactive. |
| Human approval posture | The interface presents recommendations and human-review gates, but critical evidence/readiness defects must be fixed before this is treated as a reliable approval control. |
| Evidence discipline | Evidence IDs, domain scan, gap list, trace events, and audit records. |
| Deployment cockpit | GitHub Pages-ready UI with local/relay/live runtime controls. |
| Serverless API | Vercel handlers for health, readiness, benchmarks, audit, agent run, and relay. |
| Deployment proof link | Live Vercel app/status plus isolated Railway PostgreSQL/Qdrant status. This proves connectivity, not decision correctness or enterprise authorization. |
| Benchmarking | Local benchmark runner plus generated evidence artifacts. |
| Golden demo replay | `GET /api/demo/golden` plus `evidence/golden-demo-run.json`. |

## Next Hardening Steps

| Area | Implementation Target | Why It Matters |
| --- | --- | --- |
| Decision correctness | Fix evidence-question-as-proof, global negation suppression, one-medium-gap readiness, and Python/Node decision divergence; add adversarial gates. | Blocks unsafe approval recommendations at their shared decision boundaries. |
| Tenant isolation and versioning | Derive tenant context from the authenticated actor for every retrieval path and return the final authoritative case version after council runs. | Prevents cross-workspace memory disclosure and broken second interactions. |
| Durable audit | PostgreSQL/Qdrant persist product data and vectors, but Vercel audit JSONL currently lives in per-instance `/tmp`. Move tenant-scoped events to PostgreSQL plus immutable retention. | Makes traceability durable and query isolation enforceable. |
| RBAC | Demo session/auth enforcement exists and Entra-compatible JWT code is present. Configure Entra issuer, audience, tenant, JWKS, and app roles; close public/unscoped log and audit routes. | Separates a demo boundary from enterprise identity and authorization proof. |
| Live workflow switch | Keep selected `/api/agent/run` cases aligned with the deployed product workflow. | Converts the demo agent into the deployed enterprise workflow path without weakening deterministic final authority. |
| CrewAI Flow runtime | Keep CrewAI as optional advisory runtime until dependencies, credentials, and eval gates are stable. | Aligns with production-oriented CrewAI patterns without making optional dependencies a submission risk. |
| Responsible AI evals | Adversarial cases, unsupported-claim detection, bias review, and refusal checks. | Moves RAI from control design to measurable assurance. |
| Integration tests | Contract tests for ServiceNow, Coupa, SharePoint, Dynamics, and GRC payloads. | Proves integration readiness beyond documentation. |
| Demo recording | Capture intake, evidence upload, domain scan, gap challenge, recommendation, and audit. | Satisfies "Watch the Agent Work" with repeatable proof. |
| Azure migration | Execute the phased plan only after current decision/security blockers have owners and regression gates. | Avoids moving unsafe behavior unchanged to a more complex platform. |

## Submission Positioning

Position the agent as a production-track compliance intelligence worker:

- It runs a real Vercel demo with durable Railway PostgreSQL/Qdrant, named-Compass semantic retrieval, Node advisory specialists, and observable deterministic fallback.
- Its FastAPI evaluator contract is reproduced locally and in CI; there is no claimed public Railway evaluator.
- Python CrewAI remains an optional adapter rather than a hosted dependency.
- Serverless audit retention, Entra SSO, tenant isolation, and decision correctness remain explicit blockers before enterprise authorization.
