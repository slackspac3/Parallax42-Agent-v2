# Production Track

This is the current implementation and hardening ledger, reviewed 2026-07-12. The app is a working demo, not an enterprise-authorized compliance decision system. Release implementation `457c7c2` passes full `npm run qa` (276/276 Node and 13/13 Python security tests), its CI, Agentathon Preflight, and Pages workflows are green, and the authenticated production workflow is verified at <https://parallax42-agent-v2.vercel.app/>. See the [deep code review](DEEP_CODE_REVIEW.md) and [Azure migration plan](AZURE_MIGRATION_PLAN.md).

## Already Implemented

| Capability | Evidence |
| --- | --- |
| Runnable compliance agent | `POST /api/agent/run`, local server, and Vercel function handler. |
| Agentathon evaluator wrapper | Root `run.py`, FastAPI `/run`, Dockerfile, metadata, examples, and JSONL traces. |
| Online product demo | Vercel browser app and Node APIs backed by isolated Railway PostgreSQL/Qdrant; GitHub Pages remains a static mirror. |
| Server-side Compass boundary | A named shared-gateway client provides smart intake, Node advisory specialist calls, and semantic `text-embedding-3-large` embeddings; browser receives no provider keys. |
| Qdrant-backed evidence memory | Deployed Node APIs index/search an isolated v2 collection and return sanitized snippets; deterministic demo embeddings are disabled in the verified hosted configuration. |
| Agent runtime shape | Hosted Node advisory specialists use Compass with deterministic fallback. `crewai_adapter/` provides optional Python CrewAI and CI dry-run validation; live Python CrewAI is inactive. |
| Human approval posture | Conditional is nonterminal. The UI and server permit approval only when the authoritative Node result contains `approvalEligible: true`; human review is always required. |
| Evidence discipline | Explicit assertion state/provenance prevents chat mentions, questions, placeholders, and policy references from satisfying controls; source-level contradictions create blocking gaps. |
| Case continuity | Council responses return the completed authoritative case snapshot/version; the browser replaces local state, and a follow-up plus second council regression covers stale-version behavior. |
| Tenant-scoped advisory memory | Learning and governance retrieval derive workspace/project from the authenticated actor and ignore caller-selected namespace fields. |
| Cross-runtime authority | Node owns policy fields. FastAPI/Python preserves decision, risk, gaps, controls, readiness, and approval eligibility; Python and Compass remain advisory. |
| Durable audit foundation | Hosted runtimes use tenant-scoped PostgreSQL hash chains serialized by a locked chain head; local JSONL is test/development-only, and hosted writes fail closed without PostgreSQL. |
| Deployment cockpit | GitHub Pages-ready UI with local/relay/live runtime controls. |
| Serverless API | Vercel handlers for health, readiness, benchmarks, audit, agent run, and relay. |
| Deployment proof link | Live Vercel app/status plus isolated Railway PostgreSQL/Qdrant status. This proves connectivity, not decision correctness or enterprise authorization. |
| Benchmarking | Local benchmark runner plus generated evidence artifacts. |
| Golden demo replay | `GET /api/demo/golden` plus `evidence/golden-demo-run.json`. |

## Verified Remediation Release

The 2026-07-12 release check exercised the production app in an authenticated real browser: a real document upload reached server-side parsing, Qdrant indexing/retrieval was active, Compass supplied live intake/advisory output, Council completed, and a material follow-up plus second Council run continued from the authoritative post-council version without a stale-version failure. The case narrative request returned HTTP `200`.

That evidence verifies the demo path at implementation revision `457c7c2`; it does not make the audit ledger immutable or WORM-retained. Enterprise Entra/membership/RLS, immutable export, atomic business/audit coupling, managed migrations, retention/erasure, distributed admission controls, and review-pack integrity remain hardening gates.

## Next Hardening Steps

| Area | Implementation Target | Why It Matters |
| --- | --- | --- |
| Decision correctness | Keep the new assertion, contradiction, readiness, two-council, and Node/Python parity fixtures in required CI; add policy-version hashes and a larger adversarial corpus. | Prevents regression at the shared decision boundaries. |
| Tenant defense in depth | Add organizations/workspaces/memberships, composite keys and PostgreSQL RLS; extend hostile-scope coverage to cases, export, deletion, and every resource. | Actor-derived application scope is fixed for learning/governance/audit, but database policy and complete resource coverage remain. |
| Audit assurance | Add immutable/WORM range exports, restore drills, schema migrations, and same-transaction audit coupling for critical PostgreSQL business writes (or an outbox across services). | Current Postgres hash chains are durable and scoped but are not immutable retention or atomic business/audit evidence. |
| RBAC | Demo session/auth enforcement exists and Entra-compatible JWT code is present. Configure Entra issuer, audience, tenant, JWKS, memberships and app roles; keep detailed audit reads role-gated. | Separates a demo boundary from enterprise identity and authorization proof. |
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
- Immutable audit retention/business-write coupling, Entra SSO/memberships/RLS, retention/erasure, distributed admission controls, and review-pack integrity remain blockers before enterprise authorization; the working-demo production path itself is verified for this release.
