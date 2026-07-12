# CODEX_REPO_AUDIT

> **Historical evidence snapshot.** This report preserves an earlier repository and deployment assessment; it is not current operational guidance. See the [current deep code review](docs/DEEP_CODE_REVIEW.md) and [Azure migration plan](docs/AZURE_MIGRATION_PLAN.md).

> **2026-07-12 remediation addendum:** the current worktree uses actor-scoped PostgreSQL audit chains for hosted runtimes, removes public `/api/logs`, scopes detailed reads, and fails hosted writes closed without Postgres. Node is authoritative across Python, and evidence/readiness/state/tenant P0 regressions pass full local QA. CI/live verification, WORM audit export, business/audit transaction coupling, Entra/membership/RLS, and other residuals remain.

## 1. Executive Summary

This repository is a Node/CommonJS Vercel/static demo application for a chat-first Compliance Intelligence Agent. It is not a Python FastAPI application. The browser UI is vanilla HTML/CSS/JS in `public/`, Vercel API handlers live in `api/`, the local development server mirror is `server.js`, and the core decision/runtime logic is in `lib/`.

What genuinely works today is the deterministic compliance case workflow: a user can describe a case in chat, attach or register evidence metadata, build a case draft, run the council, receive a human-review-ready decision package, export a PDF review pack, and see audit/evidence/readiness metadata. The deterministic compliance engine in `lib/complianceAgent.js` owns the final decision. Unit tests, benchmark tests, CrewAI dry-run checks, and static page checks exist and are wired through `npm run qa`.

What is partial is the enterprise architecture around the demo. There is a server-side evidence boundary and a local-file vector store fallback in `lib/evidenceVectorStore.js`; Qdrant is supported by code paths but is not active unless configured with env vars. Compass gateway integration exists through `lib/compassGatewayClient.js` and is used for embeddings/evidence indexing/search when the gateway token is present. The deployed Compass gateway appears configured, but the application must still be treated as a demo-grade workflow until durable storage, auth enforcement, production parser status, operational monitoring, and deployment parity are hardened.

What is not ready or must not be claimed: Redis, Postgres, Celery, durable queues, OpenClaw, implemented local OCR/parser service inside this repo, active Qdrant, enforced RBAC by default, enterprise-durable audit, live CrewAI specialists by default, and production-grade persistence. CrewAI is present as a dry-run/orchestration-shaped adapter under `crewai_adapter/` and `lib/agentRuntime.js`; by default it is not a live multi-agent debate or live specialist execution system.

The current repo is best positioned as: a working, auditable, deterministic compliance council demo with a strong chat-first UI direction, optional gateway intelligence, optional vector-provider expansion, and a truthful path toward enterprise hardening.

## 2. Architecture Map

| Area | Status | Exact files | Notes |
|---|---:|---|---|
| Root entry points | working | `server.js`, `package.json`, `vercel.json` | `server.js` serves static assets and mirrors API routes locally. `package.json` defines Node/CommonJS scripts. |
| Local dev server | working | `server.js` | Implements `/api/health`, `/api/admin/status`, `/api/readiness`, `/api/benchmarks`, `/api/demo/golden`, `/api/audit/recent`, `/api/agent/run`, `/api/conversation`, `/api/evidence/index`, `/api/evidence/search`, `/api/export/review-pack`, and static file serving. |
| Vercel API handlers | working / partial | `api/*.js`, `api/*/*.js`, `api/backend/[...path].js` | API route files exist locally. The live deployment may lag uncommitted files such as `api/admin/status.js`. |
| Frontend shell | working | `public/index.html`, `public/styles.css`, `public/app.js`, `public/config.js`, `public/.nojekyll` | Vanilla JS chat-first UI. No React/Vite. |
| Core compliance engine | working | `lib/complianceAgent.js`, `lib/conversationAgent.js`, `lib/goldenWorkflow.js`, `lib/benchmarkSuite.js` | Deterministic case extraction, gap detection, domain scoring, decisioning, trace, golden demo, and benchmarks. |
| Runtime orchestration | partial | `lib/agentRuntime.js`, `crewai_adapter/compliance_flow.py`, `crewai_adapter/compliance_crew.py`, `crewai_adapter/config/agents.yaml`, `crewai_adapter/config/tasks.yaml` | CrewAI-shaped dry-run adapter exists. Live LLM/CrewAI mode is optional, env-gated, and not the default. |
| Advisory LLM path | partial | `lib/advisoryCouncil.js`, `lib/compassGatewayClient.js` | Optional advisory output via Compass gateway; deterministic engine still owns final decisions. |
| Evidence gateway client | partial / working when configured | `lib/compassGatewayClient.js`, `api/evidence/index.js`, `api/evidence/search.js` | Requires `COMPASS_GATEWAY_TOKEN` or `PARALLAX42_GATEWAY_TOKEN`. No secret is embedded in repo. |
| Local vector store | demo-grade working | `lib/evidenceVectorStore.js` | Stores vectors/chunks in a server-side local file, defaulting to OS temp unless configured. Not durable on Vercel. |
| Qdrant vector store | wired but inactive | `lib/evidenceVectorStore.js` | Qdrant REST code exists and activates when `QDRANT_URL` or `P42_VECTOR_DB_URL` is configured. Not proven active in current app. |
| Parser relay | partial | `api/_backendRelay.js`, `api/backend.js`, `api/backend/[...path].js`, `public/app.js` | Browser uploads can be relayed to an external backend. Local OCR/parser is not implemented in this repo. |
| Audit logging | durable/scoped foundation | `lib/auditStore.js`, `api/audit/recent.js`, `logs/agent_audit.jsonl` | Hosted PostgreSQL hash chains; JSONL is explicit local/test fallback. WORM retention remains open. |
| RBAC/auth | partial | `lib/rbac.js`, `.env.example`, `tests/unit/rbac.test.js` | Audit/default demo mode allows anonymous demo actor. Enforced JWT/role mode exists but is not default and requires env configuration. |
| PDF review pack | working | `lib/reviewPack.js`, `api/export/review-pack.js`, `tests/unit/reviewPack.test.js`, `output_examples/review_pack_sample.pdf` | Generates review-pack PDF from run output. Current UX around review pack can improve. |
| Tests | working | `tests/unit/*.test.js` | Node test runner covers compliance, runtime, gateway client, backend relay, vector store, RBAC, audit, review pack, benchmark, golden workflow. |
| Scripts | working / partial | `scripts/syntax-check.js`, `scripts/check-pages.js`, `scripts/benchmark.js`, `scripts/capture-evidence.js`, `scripts/generate_test_contract_pdfs.py` | QA scripts exist. `capture-evidence.js` depends on live service availability. PDF generation script is Python utility. |
| Generated/output folders | partial | `evidence/`, `output_examples/`, `logs/`, `output/playwright/`, `.playwright-cli/`, `audits/` | `output_examples/` is curated submission proof. `logs/`, `.playwright-cli/`, `output/playwright/`, and `audits/` are generated/local. |
| Documentation | working / partial | `README.md`, `ARCHITECTURE.md`, `EVALUATION.md`, `SUBMISSION.md`, `docs/*.md` | Root docs are concise entry points. Some older docs may be more aspirational than the current code. |
| Environment variables | partial | `.env.example`, `lib/*`, `api/*`, `server.js` | Good coverage for demo mode and optional integrations. Some fallback env names used in code are not all listed in `.env.example`. |
| External services | partial | Compass gateway, external parser backend, Vercel deployment | Gateway and backend health are external to this repo. Their status can change independently of this codebase. |

## 3. Working vs Partial vs Stubbed vs Documented-Only

### A) production-real and working

1. Deterministic compliance decision engine
   - Files: `lib/complianceAgent.js`, `tests/unit/complianceAgent.test.js`, `lib/benchmarkSuite.js`, `tests/unit/benchmarkSuite.test.js`.
   - Evidence: `runComplianceAgent()` builds domain scans, gaps, controls, evidence IDs, trace, readiness, and final decision status without external services.
   - How to verify: `npm test -- tests/unit/complianceAgent.test.js` or `npm run benchmark`.
   - Do not claim yet: autonomous production approval. The engine explicitly preserves a human review boundary.

2. Review-pack PDF generation
   - Files: `lib/reviewPack.js`, `api/export/review-pack.js`, `tests/unit/reviewPack.test.js`, `output_examples/review_pack_sample.pdf`.
   - Evidence: `buildReviewPackPdf()` creates a PDF buffer; the API returns `pdfBase64`.
   - How to verify: run `npm test -- tests/unit/reviewPack.test.js` or POST a valid run object to `/api/export/review-pack`.
   - Do not claim yet: polished board-ready reporting. The PDF is functional, but design/content quality still needs improvement.

3. Tenant-scoped hash-chained audit records
   - Files: `lib/auditStore.js`, `api/audit/recent.js`, `tests/unit/auditStore.test.js`.
   - Evidence: hosted `appendAuditRecord()` writes actor-scoped PostgreSQL chains with locked heads; explicit local/test mode can use JSONL. `verifyAuditChain()` verifies the selected tenant chain.
   - How to verify: run `npm test -- tests/unit/auditStore.test.js` or call `/api/audit/recent`.
   - Do not claim yet: immutable/WORM retention, restore proof, or atomic coupling to every critical business write.

### B) demo-grade but working

1. Chat-first case builder
   - Files: `public/index.html`, `public/app.js`, `public/styles.css`, `api/conversation.js`, `lib/conversationAgent.js`.
   - Evidence: UI has chat workspace, context strength meter, attachment controls, Run Council flow, and Start New Case control. `/api/conversation` processes chat messages and can trigger the deterministic runtime.
   - How to verify: run `npm run dev`, open `http://localhost:3020`, enter a compliance scenario, answer follow-up questions, then Run Council.
   - Do not claim yet: fully natural LLM conversation. The default NLP extraction is deterministic pattern/rule based.

2. Local-file vector storage fallback
   - Files: `lib/evidenceVectorStore.js`, `tests/unit/evidenceVectorStore.test.js`.
   - Evidence: local store writes `evidence-vector-index.json` under temp/audit dir and strips embeddings before returning data to browser.
   - How to verify: configure gateway token, POST `/api/evidence/index`, then POST `/api/evidence/search`; or run unit tests for local behavior.
   - Do not claim yet: production-grade vector persistence. Local-file fallback is a demo convenience.

3. CrewAI dry-run orchestration shape
   - Files: `lib/agentRuntime.js`, `crewai_adapter/compliance_flow.py`, `crewai_adapter/compliance_crew.py`, `crewai_adapter/config/agents.yaml`, `crewai_adapter/config/tasks.yaml`.
   - Evidence: `runtimeHealth()` attempts Python dry-run and otherwise returns a JS static flow manifest. `npm run check:crewai` runs Python dry-run scripts.
   - How to verify: `npm run check:crewai`; inspect `/api/health` `agentRuntime.crewaiManifestSource`.
   - Do not claim yet: live multi-agent CrewAI execution by default. On Vercel, health has shown `js_static` because the Node runtime does not run the Python CrewAI adapter.

4. Vercel/static deployment
   - Files: `vercel.json`, `api/*.js`, `public/*`.
   - Evidence: Vercel API files exist and static UI is framework-free. Live health has returned service metadata for the deployed app.
   - How to verify: `curl https://parallax42-compliance-intelligence.vercel.app/api/health`.
   - Do not claim yet: latest uncommitted routes are live. For example, the currently live deployment returned `NOT_FOUND` for `/api/admin/status` before these local changes are deployed.

### C) wired but inactive

1. Qdrant provider
   - Files: `lib/evidenceVectorStore.js`, `.env.example`.
   - Evidence: Qdrant collection creation, point upsert, and point scroll code exist behind `QDRANT_URL` / `P42_VECTOR_DB_URL`.
   - How to verify: set Qdrant env vars, run evidence index/search route tests manually against a real cluster.
   - What not to claim yet: active Qdrant-backed retrieval in the default demo.

2. Enforced RBAC/auth
   - Files: `lib/rbac.js`, `.env.example`, `tests/unit/rbac.test.js`.
   - Evidence: HS256/RS256 JWT verification, JWKS fetch, audience/issuer/tenant checks, and route policies exist.
   - How to verify: set `P42_AUTH_MODE=enforced` plus JWT env, call protected routes with and without tokens.
   - What not to claim yet: enterprise SSO is active in the public demo.

3. Live LLM advisory
   - Files: `lib/advisoryCouncil.js`, `lib/agentRuntime.js`, `lib/compassGatewayClient.js`.
   - Evidence: `attachGatewayAdvisoryIfEnabled()` only runs when runtime requests a live LLM mode and `CREWAI_ENABLE_LIVE_LLM=1`.
   - How to verify: configure gateway token, `CREWAI_ENABLE_LIVE_LLM=1`, and use `AGENT_RUNTIME=crewai_llm`.
   - What not to claim yet: live specialists are active by default or control final decisions.

4. Parser relay
   - Files: `api/_backendRelay.js`, `api/backend.js`, `api/backend/[...path].js`, `public/app.js`.
   - Evidence: allowlisted relay paths include upload init/chunk/complete/status/result and case assist endpoints.
   - How to verify: use the UI file upload path or call `/api/backend?path=/health`.
   - What not to claim yet: local OCR/parser implementation in this repository.

### D) placeholder/stub

1. Durable production storage
   - Files: `.env.example`, `lib/auditStore.js`, `lib/evidenceVectorStore.js`, `docs/DEPLOYMENT_RUNBOOK.md`.
   - Evidence: env flags and readiness text mention durable storage, but there is no Redis/Postgres/object-store implementation in this repo.
   - How to verify: inspect `lib/` and `package.json`; no Redis/Postgres/Celery/RQ dependencies or routes exist.
   - What not to claim yet: durable enterprise persistence.

2. Live CrewAI specialist execution in deployed app
   - Files: `lib/agentRuntime.js`, `crewai_adapter/*`.
   - Evidence: Python adapter exists, but Vercel Node runtime reports JS static manifest in live health. Live modes are env-gated.
   - How to verify: `/api/health` and `npm run check:crewai`.
   - What not to claim yet: live CrewAI council is active on Vercel.

### E) documented but not implemented

1. Redis/Postgres/Celery/durable workers
   - Files: none implementing them. Some docs may mention production hardening directions.
   - Evidence: no runtime modules or package dependencies implement these.
   - How to verify: search `redis`, `postgres`, `celery`, `worker`, `queue`.
   - What not to claim yet: background jobs or durable queueing.

2. OpenClaw
   - Files: none.
   - Evidence: repo has no `openclaw/` implementation.
   - How to verify: `find . -iname '*openclaw*'`.
   - What not to claim yet: OpenClaw integration.

3. Local OCR/parser service
   - Files: no local OCR parser implementation in repo. `scripts/generate_test_contract_pdfs.py` generates synthetic PDFs only.
   - Evidence: parser is reached through external relay paths, not local code.
   - How to verify: inspect `api/_backendRelay.js` and `public/app.js`.
   - What not to claim yet: local OCR/parser is implemented by this repo.

## 4. Feature Readiness Matrix

| Feature | Files involved | Current status | How to test | Known gaps | Safe improvement ideas | Risk level |
|---|---|---|---|---|---|---:|
| Chat-first case builder | `public/index.html`, `public/app.js`, `public/styles.css`, `api/conversation.js`, `lib/conversationAgent.js` | demo-grade working | `npm run dev`, open local UI, chat a case, answer questions | Rule-based NLP can loop/repeat and can feel non-human | Add clearer state transitions, compact replies, and better question memory | Medium |
| NLP-style case draft generation | `lib/conversationAgent.js` | working but deterministic | `npm test -- tests/unit/conversationAgent.test.js` | Not LLM semantic parsing; relies on regex/patterns | Add optional LLM extraction as advisory with fallback, keep deterministic canonical schema | Medium |
| Start New Case UI | `public/index.html`, `public/app.js`, `public/styles.css` | working locally, uncommitted | Search for `startNewCase`; manual click in UI | Needs browser/E2E assertion | Add lightweight unitless DOM smoke or Playwright check | Low |
| Deterministic compliance decision engine | `lib/complianceAgent.js` | working | `npm test -- tests/unit/complianceAgent.test.js`; `npm run benchmark` | Domain logic is handcrafted; may miss nuanced obligations | Add more golden cases and negative tests | Low |
| Evidence upload/index/search | `public/app.js`, `api/evidence/index.js`, `api/evidence/search.js`, `lib/evidenceVectorStore.js`, `lib/compassGatewayClient.js` | partial | Upload file with gateway configured; call index/search APIs | Depends on external parser/gateway; local fallback may only store metadata | Add clearer UI progress, retry, status, and explicit parsed/indexed counts | Medium |
| Server-side evidence boundary | `public/app.js`, `lib/evidenceVectorStore.js`, `lib/serverSideRetrieval.js` | partial but directionally correct | Confirm browser receives evidence IDs/sanitized chunks only | Browser still holds uploaded file metadata and may hold excerpts depending path | Keep raw parsed text server-side; show only citations/snippets | Medium |
| Local vector store fallback | `lib/evidenceVectorStore.js`, `tests/unit/evidenceVectorStore.test.js` | demo-grade working | Unit tests; inspect temp store after index | Temp/local-file storage not durable | Add admin visible provider/storage location and cleanup controls | Low |
| Qdrant provider | `lib/evidenceVectorStore.js`, `.env.example` | wired but inactive | Configure Qdrant env and index/search | No CI coverage against real Qdrant; no live proof | Add mock fetch tests and one smoke script for configured Qdrant | Medium |
| Compass gateway integration | `lib/compassGatewayClient.js`, `api/evidence/*`, `lib/advisoryCouncil.js` | partial/working when token present | Gateway health plus POST index/search/chat | Missing token fails routes; local env often absent | UI/admin show configured vs unavailable clearly | Low |
| Compass embeddings | `lib/compassGatewayClient.js`, `lib/evidenceVectorStore.js` | wired when gateway token present | POST `/api/evidence/index` with text and caseId | Not called without token; no local embedding fallback | Add deterministic no-token demo path that states "not indexed" rather than appearing stalled | Low |
| Compass chat/LLM advisory | `lib/advisoryCouncil.js`, `lib/agentRuntime.js` | optional/inactive by default | Enable `CREWAI_ENABLE_LIVE_LLM=1` and live runtime | Advisory does not drive agent collaboration or final decision | Add an "advisory only" panel with exact model/runtime metadata | Medium |
| Parser relay / external parser backend | `api/_backendRelay.js`, `api/backend*.js`, `public/app.js` | partial | `/api/backend?path=/health`; upload through UI | External service has its own status and disabled persistence; not local | Show parser relay health and upload job stages in UI | Medium |
| Review pack PDF generation | `lib/reviewPack.js`, `api/export/review-pack.js` | working | Export after council run | PDF content is functional but not executive-grade | Improve layout, memo sections, risk register, evidence appendix | Low |
| Audit logging | `lib/auditStore.js`, `api/audit/recent.js` | durable/scoped foundation | Run case then authenticated GET `/api/audit/recent` as auditor | No WORM export or business-write coupling | Add range sealing/export and restore drills | Medium |
| Hash-chained audit | `lib/auditStore.js`, `tests/unit/auditStore.test.js` | working in PostgreSQL and local fallback | Unit test or scoped verification via `/api/audit/recent` | Not backed by WORM/managed immutable storage | Add exportable audit verification report | Medium |
| Admin status | `api/admin/status.js`, `lib/adminStatus.js`, `server.js` | implemented locally, not yet deployed until commit/deploy | Local GET `/api/admin/status`; live currently may be 404 until deployed | Not wired into UI admin panel yet | Add UI Admin/Readiness panel showing these booleans | Low |
| Readiness endpoint | `api/readiness.js`, `server.js`, `lib/complianceAgent.js` | working | GET `/api/readiness` | Inventory is static-ish and not a full production readiness scanner | Separate demo readiness vs production hardening explicitly | Low |
| Benchmarks | `lib/benchmarkSuite.js`, `scripts/benchmark.js`, `tests/unit/benchmarkSuite.test.js` | working | `npm run benchmark` | Only four deterministic cases; no latency under real uploads/LLM | Add browser + upload + gateway benchmark scenarios | Low |
| CrewAI dry-run | `crewai_adapter/*`, `lib/agentRuntime.js` | working locally | `npm run check:crewai`; `/api/health` | Vercel fallback is JS static, not Python dry-run | Make UI label "CrewAI-shaped dry run" explicit | Low |
| CrewAI live execution | `lib/agentRuntime.js`, `crewai_adapter/*` | wired but inactive | Set live env and dependencies locally | Not validated as stable live production flow | Defer or restrict to optional demo toggle with clear fallback | High |
| RBAC/auth | `lib/rbac.js`, `tests/unit/rbac.test.js` | strong demo / partial enterprise | Unit tests; call protected routes with/without roles | Production is enforced, audit reads are always role-gated; no Entra membership/RLS or login UI | Add Entra/membership/RLS and preserve scoped audit tests | Medium |
| Vercel deployment behavior | `api/*`, `public/*`, `vercel.json` | working but deployment can lag local | `curl /api/health`; Vercel logs | Python CrewAI adapter unavailable; local tmp storage ephemeral | Add deployment checklist and live route verification script | Low |
| Local server behavior | `server.js` | working | `npm run dev`; curl local routes | Local differs from Vercel for Python dry-run availability and filesystem persistence | Keep route parity tests between `server.js` and `api/` handlers | Medium |

## 5. Endpoint Inventory

| Path | Method | Local implementation | Vercel implementation | Request schema | Response schema | Env vars required | UI uses it | Tests cover it | Safe to demo | Drift |
|---|---|---|---|---|---|---|---:|---:|---:|---|
| `/api/health` | GET | `server.js` | `api/health.js` | none | health object with runtime/auth/audit/gateway/vector/backend metadata | optional `AGENT_MODE`, `PARALLAX42_BACKEND_URL`, gateway/vector/auth envs | yes | indirectly through syntax/unit modules | yes | Vercel adds `runtime: vercel` and `pagesOrigin`; live deployment may reflect older commit. |
| `/api/admin/status` | GET | `server.js`, `lib/adminStatus.js` | `api/admin/status.js` | none | safe status object: auth, audit, vector, gateway, parserRelay, runtime, timestamp | optional auth/vector/gateway/parser envs | not yet clearly surfaced | not yet directly covered | yes locally | File exists locally; live Vercel returned `NOT_FOUND` before deployment. |
| `/api/readiness` | GET | `server.js` | `api/readiness.js` | none | readiness inventory from `getReadinessInventory()` | auth env optional unless enforced | yes/readiness links | indirectly via syntax; no direct route test seen | yes | Same logic, but auth/env can differ. |
| `/api/benchmarks` | GET | `server.js` | `api/benchmarks.js` | none | benchmark summary/cases | auth env optional unless enforced | yes | `tests/unit/benchmarkSuite.test.js` | yes | Same logic. |
| `/api/demo/golden` | GET | `server.js` | `api/demo/golden.js` | none | golden workflow run and acceptance checks | auth env optional unless enforced | yes | `tests/unit/goldenWorkflow.test.js` | yes | Local mode label `local_golden_demo`; Vercel mode label `vercel_golden_demo`. |
| `/api/audit/recent` | GET | `server.js` | `api/audit/recent.js` | optional `limit` query | `{ integrity, records }` | auditor/platform-admin bearer; hosted `DATABASE_URL` | protected admin evidence area | audit store/route/RBAC tests | yes for authorized synthetic demo | Tenant-scoped PostgreSQL chain; no WORM export yet. |
| `/api/agent/run` | POST | `server.js` | `api/agent/run.js` | compliance case JSON; optional `runtime`; optional `x-agent-runtime` header | agent run result with decision, gaps, trace, runtime/orchestration | auth optional unless enforced; runtime/env optional | older/direct run paths | `tests/unit/agentRuntime.test.js`, `complianceAgent.test.js` | yes | Same logic; Python dry-run availability differs. |
| `/api/conversation` | POST | `server.js` | `api/conversation.js` | `{ message, caseDraft, uploadedEvidence, retrievalQuery, forceRun, runtime? }` | conversation result with reply, nlp, caseDraft, missingFields, actions, optional run | auth optional; gateway optional for advisory only | yes, primary chat | `tests/unit/conversationAgent.test.js`; route not directly tested | yes | Same logic; optional advisory depends on env. |
| `/api/evidence/index` | POST | `server.js` | `api/evidence/index.js`, alias `api/evidence/index/index.js` | `{ caseId, documents/chunks/text, workspaceId?, projectId? }` | sanitized index result with chunk/evidence IDs and no browser-retained embeddings | `COMPASS_GATEWAY_TOKEN` or `PARALLAX42_GATEWAY_TOKEN` required for real gateway call; Qdrant optional | yes after upload | `tests/unit/evidenceVectorStore.test.js`, `compassGatewayClient.test.js` | yes only when token/service configured | Vercel token may be configured while local may not be. |
| `/api/evidence/search` | POST | `server.js` | `api/evidence/search.js`, alias `api/evidence/search/index.js` | `{ caseId, query, workspaceId?, projectId?, topK? }` | matches, context, index metadata | gateway token required for gateway search; local/Qdrant chunks must exist | yes via server-side retrieval | unit modules cover store/client; route not direct | yes only when token/index exists | Same env drift as index. |
| `/api/export/review-pack` | POST | `server.js` | `api/export/review-pack.js` | `{ run }` or run object | `{ ok, pack, fileName, contentType: application/pdf, pdfBase64 }` | auth optional unless enforced | yes | `tests/unit/reviewPack.test.js` | yes | Same logic. |
| `/api/backend` | GET/POST | not implemented directly in `server.js`; static fallback may serve 404 locally unless path handling maps elsewhere | `api/backend.js` | relay query `path`, or body for allowlisted backend routes | proxied external backend response or relay error | optional `PARALLAX42_BACKEND_URL` | yes via UI health/upload | `tests/unit/backendRelay.test.js` | yes for health; uploads depend on external backend | Local mirror does not expose this exact handler in `server.js`; Vercel does. |
| `/api/backend/[...path]` | GET/POST | no direct catch-all in `server.js` | `api/backend/[...path].js` | allowlisted backend subpath | proxied external backend response | optional `PARALLAX42_BACKEND_URL` | yes | `tests/unit/backendRelay.test.js` | yes with external dependency | Vercel-specific catch-all. |

Allowlisted backend relay targets are defined in `api/_backendRelay.js`: `GET /health`, `GET /demo/replay`, `POST /run`, `POST /case/assist`, upload init/chunk/complete/status/result, and feedback routes. Those are external-backend routes, not native local app routes.

## 6. Environment Variable Inventory

| Name | Required or optional | Local behavior if missing | Vercel behavior if missing | Sensitive | Files that read it | Belongs in `.env.example` | Graceful absent behavior |
|---|---|---|---|---:|---|---:|---:|
| `PORT` | optional | defaults to `3020` | not relevant to Vercel functions | no | `server.js` | yes | yes |
| `AGENT_MODE` | optional | defaults to `crewai_flow` or `local_deterministic` depending path | defaults similarly | no | `server.js`, `api/health.js`, `lib/complianceAgent.js` | yes | yes |
| `AGENT_RUNTIME` | optional | defaults to `crewai_flow` | defaults to `crewai_flow` | no | `lib/agentRuntime.js` | should be listed | yes |
| `VERCEL` | platform | switches audit default to tmp | set by Vercel | no | `lib/auditStore.js` | no | yes |
| `PARALLAX42_BACKEND_URL` | optional | defaults to `https://api.parallax42.bhavukarora.com` | same default | no | `server.js`, `api/health.js`, `api/_backendRelay.js`, `lib/complianceAgent.js`, `scripts/capture-evidence.js` | yes | yes |
| `PARALLAX42_DEMO_UI_URL` | optional | default GitHub Pages URL in readiness | same | no | `lib/complianceAgent.js` | yes | yes |
| `P42_GATEWAY_HEALTH_URL` | optional | used by evidence capture script | same if script run | no | `scripts/capture-evidence.js` | should be listed | yes |
| `P42_PAGES_ORIGIN` | optional | not used locally | default `https://slackspac3.github.io` in Vercel health | no | `api/health.js` | optional | yes |
| `P42_ALLOWED_ORIGINS` | optional | permissive/default CORS behavior from `_http.js` | same | no | `api/_http.js` | should be listed for production | yes |
| `COMPASS_GATEWAY_BASE_URL` | optional but needed for custom gateway | defaults to shared gateway base | defaults to shared gateway base | no | `lib/compassGatewayClient.js` | yes | yes |
| `P42_GATEWAY_BASE_URL` | optional alias | default used if absent | default used if absent | no | `lib/compassGatewayClient.js` | should be listed | yes |
| `COMPASS_GATEWAY_URL` | optional legacy/direct URL | derives base if set | derives base if set | no | `lib/compassGatewayClient.js`, `lib/complianceAgent.js` | yes | yes |
| `COMPASS_GATEWAY_TOKEN` | required for gateway calls | evidence/LLM gateway calls fail with clear error | same | yes | `lib/compassGatewayClient.js` | yes | yes for health, no for gateway operation |
| `PARALLAX42_GATEWAY_TOKEN` | optional alias | same as above | same | yes | `lib/compassGatewayClient.js`, `lib/agentRuntime.js` | should be listed | yes for health, no for gateway operation |
| `EMBEDDINGS_MODEL` | optional | defaults to `text-embedding-3-large` | same | no | `lib/compassGatewayClient.js`, `lib/evidenceVectorStore.js` | yes | yes |
| `P42_WORKSPACE_ID` | optional | defaults to `parallax42` | same | no | `lib/compassGatewayClient.js`, `lib/evidenceVectorStore.js` | yes | yes |
| `P42_PROJECT_ID` | optional | defaults to `compliance-intelligence-agent` | same | no | `lib/compassGatewayClient.js`, `lib/evidenceVectorStore.js` | yes | yes |
| `CREWAI_ENABLE_LIVE_LLM` | optional | defaults disabled | defaults disabled | no | `lib/agentRuntime.js` | yes | yes |
| `CREWAI_LLM_MODEL` | optional | defaults to `gpt-5.1` | same | no | `lib/agentRuntime.js`, `lib/advisoryCouncil.js`, `lib/compassGatewayClient.js` | yes | yes |
| `CREWAI_LLM_BASE_URL` | optional | counted for live LLM config | same | no | `lib/agentRuntime.js` | yes | yes |
| `CREWAI_LLM_API_KEY` | optional live provider key | detected for live LLM readiness | same | yes | `lib/agentRuntime.js` | yes/commented | yes |
| `CREWAI_LLM_TEMPERATURE` | optional | defaults to `0.1` | same | no | `lib/advisoryCouncil.js` | should be listed | yes |
| `OPENAI_API_KEY` | optional fallback provider key | detected for live LLM readiness | same | yes | `lib/agentRuntime.js` | not currently in `.env.example`; consider adding as fallback with caveat | yes |
| `OPENAI_API_BASE` | optional fallback base | counted for live LLM config | same | no | `lib/agentRuntime.js` | optional | yes |
| `OPENAI_BASE_URL` | optional fallback base | counted for live LLM config | same | no | `lib/agentRuntime.js` | optional | yes |
| `OPENAI_MODEL_NAME` | optional fallback model | used in live LLM config | same | no | `lib/agentRuntime.js` | optional | yes |
| `MODEL` | optional fallback model | used in live LLM config | same | no | `lib/agentRuntime.js` | no | yes |
| `ANTHROPIC_API_KEY` | optional detection only | marks provider configured | same | yes | `lib/agentRuntime.js` | no unless supported in docs | yes |
| `GEMINI_API_KEY` | optional detection only | marks provider configured | same | yes | `lib/agentRuntime.js` | no unless supported in docs | yes |
| `GOOGLE_API_KEY` | optional detection only | marks provider configured | same | yes | `lib/agentRuntime.js` | no unless supported in docs | yes |
| `AZURE_API_KEY` | optional detection only | marks provider configured | same | yes | `lib/agentRuntime.js` | no unless supported in docs | yes |
| `P42_VECTOR_STORE_PROVIDER` | optional | defaults `local_file`; can set `qdrant` | same | no | `lib/evidenceVectorStore.js` | yes | yes |
| `P42_VECTOR_STORE_DIR` | optional | local file vector store path | on Vercel must be writable/durable to be persistent | no | `lib/evidenceVectorStore.js` | should be listed | yes |
| `P42_REQUIRE_DURABLE_STORAGE` | optional | flags readiness if durable not configured | same | no | `lib/auditStore.js`, `lib/evidenceVectorStore.js` | yes | yes |
| `QDRANT_URL` | optional | enables Qdrant provider | same | no | `lib/evidenceVectorStore.js` | yes/commented | yes if absent; qdrant inactive |
| `P42_VECTOR_DB_URL` | optional alias | enables Qdrant provider | same | no | `lib/evidenceVectorStore.js` | should be listed | yes |
| `QDRANT_API_KEY` | optional for Qdrant | sent as `api-key` if present | same | yes | `lib/evidenceVectorStore.js` | yes/commented | yes |
| `P42_VECTOR_DB_API_KEY` | optional alias | same | same | yes | `lib/evidenceVectorStore.js` | should be listed | yes |
| `QDRANT_COLLECTION` | optional | defaults `p42_compliance_evidence` | same | no | `lib/evidenceVectorStore.js` | yes/commented | yes |
| `P42_VECTOR_DB_COLLECTION` | optional alias | defaults collection | same | no | `lib/evidenceVectorStore.js` | should be listed | yes |
| `AGENT_AUDIT_DIR` | optional | audit and vector local storage path | without durable mounted storage, Vercel uses tmp | no | `lib/auditStore.js`, `lib/evidenceVectorStore.js` | yes/commented | yes |
| `P42_AUDIT_STORE_PROVIDER` | optional | readiness metadata only | same | no | `lib/auditStore.js` | yes/commented | yes |
| `P42_AUTH_MODE` | optional | defaults `audit` | defaults `audit` | no | `lib/rbac.js` | yes | yes |
| `AUTH_MODE` | optional alias | defaults `audit` | same | no | `lib/rbac.js` | optional | yes |
| `P42_JWT_HS256_SECRET` | required for HS256 enforced JWT | HS256 tokens fail if missing | same | yes | `lib/rbac.js` | should be listed/commented | yes with useful error |
| `P42_ENTRA_JWKS_URL` | required for RS256/JWKS enforced auth | RS256 tokens fail if missing | same | no/URL | `lib/rbac.js` | yes/commented | yes with useful error |
| `ENTRA_JWKS_URL` | optional alias | same | same | no | `lib/rbac.js` | optional | yes |
| `OIDC_JWKS_URL` | optional alias | same | same | no | `lib/rbac.js` | optional | yes |
| `P42_AUTH_AUDIENCE` | optional claim check | if set, validates `aud` | same | no | `lib/rbac.js` | yes/commented | yes |
| `ENTRA_CLIENT_ID` | optional alias/audience | if set, validates `aud` | same | no | `lib/rbac.js` | optional | yes |
| `AZURE_CLIENT_ID` | optional alias/audience | if set, validates `aud` | same | no | `lib/rbac.js` | optional | yes |
| `P42_AUTH_ISSUER` | optional claim check | if set, validates `iss` | same | no | `lib/rbac.js` | yes/commented | yes |
| `ENTRA_ISSUER` | optional alias | same | same | no | `lib/rbac.js` | optional | yes |
| `P42_ENTRA_TENANT_ID` | optional claim check | if set, validates `tid` | same | no | `lib/rbac.js` | yes/commented | yes |
| `ENTRA_TENANT_ID` | optional alias | same | same | no | `lib/rbac.js` | optional | yes |
| `AZURE_TENANT_ID` | optional alias | same | same | no | `lib/rbac.js` | optional | yes |
| `P42_DEMO_BEARER_TOKEN` | optional demo/private token | accepts matching bearer token | same | yes | `lib/rbac.js` | yes/commented | yes |
| `P42_DEMO_ACTOR_ID` | optional | default `demo-operator` | same | no | `lib/rbac.js` | optional | yes |
| `P42_DEMO_ACTOR` | optional | default `demo-operator` | same | no | `lib/rbac.js` | yes/commented | yes |
| `P42_DEMO_ROLES` | optional | default `compliance_reviewer,auditor` for demo token | same | no | `lib/rbac.js` | yes/commented | yes |

## 7. QA, Tests, and Benchmarks

| Command | What it validates | What it does not validate | Current result if known | Files/scripts involved | Common failure modes | Before every commit |
|---|---|---|---|---|---|---:|
| `npm run qa` | Runs syntax check, pages asset check, unit tests, benchmark, CrewAI dry-run checks | Does not run a browser E2E test, live Vercel check, Qdrant smoke, gateway token smoke, or parser upload smoke | Last known local run passed in this working state | `package.json`, scripts below, `tests/unit/*`, `crewai_adapter/*` | Python not available for CrewAI dry-run; stale asset references; failing unit tests | yes |
| `npm run check:syntax` | CommonJS syntax/load safety for JS files | Runtime route behavior, external services | Known passed in QA | `scripts/syntax-check.js` | Syntax error, bad CommonJS import | yes |
| `npm run check:pages` | Static Pages/public asset expectations | API behavior, UI interactions | Known passed after README wording cleanup | `scripts/check-pages.js`, `public/*`, docs | Missing static file, disallowed text/claim | yes |
| `npm test` | Unit test suite under `tests/unit` | Browser UX, live gateway, live backend parser, Vercel deployment | Known passed in QA | `tests/unit/*.test.js` | Module behavior regressions | yes |
| `npm run benchmark` | Deterministic benchmark cases and latency summary | Real-world latency, upload/OCR/LLM latency | Known passed 4/4 in QA | `scripts/benchmark.js`, `lib/benchmarkSuite.js` | Decision/gap drift, latency regression | yes |
| `npm run check:crewai` | Python dry-run scripts execute | Live CrewAI on Vercel, live LLM specialists | Known passed locally in QA | `crewai_adapter/compliance_crew.py`, `crewai_adapter/compliance_flow.py` | Missing Python or incompatible adapter changes | yes while claiming CrewAI dry-run |
| `npm run dev` | Local server starts and static/API routes are available | Automated correctness unless manually tested | Not a test by itself | `server.js`, `public/*`, `lib/*` | Port conflict, route regression | yes before demo |
| `node scripts/capture-evidence.js` or `npm run capture:evidence` | Captures health/readiness/demo/benchmark evidence from configured URLs | Does not validate source code; may mutate evidence artifacts | Available, not necessarily safe for every edit | `scripts/capture-evidence.js`, `evidence/*` | Network failure, live deployment lag, artifact churn | no, use intentionally |
| `python3 scripts/generate_test_contract_pdfs.py` | Regenerates synthetic PDF fixtures | App runtime behavior | Available utility | `scripts/generate_test_contract_pdfs.py`, `test-fixtures/compliance-documents/*` | Python/reportlab availability; fixture churn | no |

Current unit coverage is useful but not sufficient. Missing validation areas include: route parity tests between `server.js` and Vercel handlers, UI E2E for Start New Case/upload/run/export, configured gateway smoke tests, Qdrant integration smoke tests, parser relay upload job tests, and live deployment route checks.

## 8. Multi-Agent Collaboration Evidence

The current repo shows agent collaboration primarily as deterministic staged orchestration and CrewAI-shaped dry-run metadata. It is not yet a live multi-agent conversation where independent agents debate, critique, retry, and revise each other's outputs by default.

| Agent/component | Role | File path | Input | Output | Delegates/critiques/validates/retries/escalates? | Runtime/dry-run/static/docs | Visible to judges | Strengthening idea |
|---|---|---|---|---|---|---|---|---|
| Compliance Orchestrator | Loads case and scopes workflow | `lib/agentRuntime.js`, `crewai_adapter/config/agents.yaml` | Case draft | Flow stage metadata; trace label | Mostly delegates by stage name only | Dry-run/static manifest | Visible in council/audit UI | Make it produce explicit scope memo and pass it to downstream specialists. |
| Regulatory Obligation Mapper | Maps applicable domains/obligations | `lib/complianceAgent.js`, `lib/agentRuntime.js`, `crewai_adapter/config/tasks.yaml` | Case/risk/evidence | Domain scan and applicability scores | Deterministic validation through scoring | Runtime deterministic plus dry-run label | Visible in Evidence Graph | Add per-domain rationale and "challenged by evidence examiner" state. |
| Evidence Examiner | Maps evidence and missing proof | `lib/complianceAgent.js`, `lib/evidenceLibrary.js`, `lib/evidenceVectorStore.js` | Documents/evidence signals/retrieved chunks | Evidence IDs, citations, evidence quality | Validates presence/absence of evidence deterministically | Runtime deterministic | Visible through evidence citations | Add retrieved-clause confidence and source page references when parser supports them. |
| Risk And Control Analyst | Converts gaps into controls | `lib/complianceAgent.js` | Domain gaps and risk signals | Required controls/actions | Deterministic control recommendation | Runtime deterministic | Visible after council run | Add owner/action/severity table for business users. |
| Responsible AI Reviewer | Human approval boundary and safety review | `lib/complianceAgent.js`, `lib/agentRuntime.js`, docs | Run output | Human approval required, no auto-approval | Validates no unsupported auto-approval through deterministic output shaping | Runtime deterministic/dry-run metadata | Visible in decision panel | Add explicit critique section: unsupported claims removed, confidence limits, escalation reason. |
| Audit Packager | Packages decision/trace/evidence IDs | `lib/reviewPack.js`, `lib/agentRuntime.js` | Run output | Review pack JSON/PDF and audit trace | Packages but does not independently challenge | Runtime deterministic | Visible via export | Improve PDF and show trace as judge-readable story. |
| NLP Case Builder | Extracts case fields from chat | `lib/conversationAgent.js` | User message + previous draft | Case draft, missing fields, questions | Updates draft and asks follow-up questions; limited memory | Runtime deterministic | Very visible in UI | Add memory of answered questions to avoid repeated loops. |
| Compass Advisory Council | Optional LLM advisory layer | `lib/advisoryCouncil.js`, `lib/compassGatewayClient.js` | Deterministic run result | Advisory summary/concerns/actions | Advisory only; does not change final decision | Runtime optional/live env-gated | Not visible unless configured and runtime selected | Add "advisory reviewed deterministic output" section when enabled. |
| CrewAI Python adapter | CrewAI-shaped crew/flow scaffold | `crewai_adapter/compliance_crew.py`, `crewai_adapter/compliance_flow.py` | Case JSON/dry-run input | Manifest/dry-run output | Dry-run task chain; no live default debate | Local dry-run; Vercel falls back to JS static | Partially visible in health/runtime metadata | Keep truthful label, or wire one small live specialist critique path behind explicit toggle. |

Blunt assessment: the hackathon "multi-agent collaboration" story is present but thin. The repo currently demonstrates a named specialist workflow and traceable deterministic council, not a robust live society of agents. The safest near-term improvement is not to pretend it is live; instead, make the specialist handoffs, validations, and human review boundary more visible and add one or two real critique/validation passes that are deterministic and testable.

## 9. Demo Route

Best supported judge demo route today:

1. Start locally: `npm install`, `npm run qa`, `npm run dev`.
2. Open `http://localhost:3020`.
3. Click `Start New Case` if any previous state is present.
4. In the chat prompt, use:

   `Assess whether we can onboard a UAE healthcare analytics vendor using patient data, Microsoft 365, and cross-border cloud processing. The accountable owner is Group Technology Risk. Evidence includes SOC 2, ISO 27001, signed DPA, retention schedule, model-training exclusion, subprocessor register, BCP/DR plan, exit assistance, SSO/MFA, audit logs, and security testing.`

5. Optionally attach a synthetic PDF from `test-fixtures/compliance-documents/`.
6. Watch the context strength meter move from intake/building toward council-ready.
7. Click `Run council`.
8. Review the Council Output tab/decision memo, domain coverage, gaps/controls, evidence citations, runtime metadata, and human approval status.
9. Click `Exec review pack` or export pack and verify a PDF downloads/opens.

Expected intermediate states:
- Chat starts with initial agent prompt from `public/app.js`.
- `lib/conversationAgent.js` extracts supplier/workflow, owner, geography, integrations, evidence signals, and risk signals.
- Context strength in `public/app.js` updates from missing context to council-ready.
- When `forceRun` is sent to `/api/conversation`, the deterministic engine runs through `lib/agentRuntime.js` and `lib/complianceAgent.js`.

Expected final output:
- Decision status should usually be conditional/human-review-ready depending evidence completeness.
- The system should show domains, gaps, controls, evidence IDs, trace stages, runtime metadata, and explicit human approval boundary.
- Review pack export should return a PDF from `/api/export/review-pack`.

API routes touched:
- `/api/conversation`
- `/api/evidence/index` if evidence upload/indexing is performed and gateway token exists
- `/api/evidence/search` if server-side retrieval is triggered for a case
- `/api/export/review-pack`
- `/api/health`, `/api/readiness`, `/api/benchmarks` depending UI panels
- `/api/backend...` if external parser relay is used for file upload

Files/logs generated:
- `logs/agent_audit.jsonl` locally unless `AGENT_AUDIT_DIR` redirects it.
- Local vector file under temp/audit dir if indexing succeeds with local-file provider.
- Browser-side UI state in local storage/session state depending current code path.
- PDF download generated client-side from API response.

Where agent collaboration is visible:
- Stage labels in the council/trace UI from `lib/agentRuntime.js`.
- Domain/evidence/control sections from `lib/complianceAgent.js`.
- CrewAI dry-run metadata in `/api/health` and runtime panels.

Where deterministic decisioning is visible:
- Decision/gap/control output from `lib/complianceAgent.js`.
- Benchmark/golden evidence from `lib/benchmarkSuite.js` and `lib/goldenWorkflow.js`.
- Human approval required fields in decision/review pack.

Where the human review boundary is visible:
- Decision panel text and `humanApprovalRequired` values in the run output/review pack.
- Runtime orchestration metadata in `lib/agentRuntime.js` sets `humanApprovalRequired: true`.

Where Compass integration is visible or disabled:
- `/api/health` exposes `evidenceGateway.tokenConfigured`, base URL, embeddings model, and LLM model.
- Gateway routes are called by `lib/compassGatewayClient.js`.
- If token is absent, evidence indexing/search and advisory calls fail or stay disabled; the deterministic flow still runs.

What can fail during the demo:
- External parser backend unavailable or slow.
- Gateway token absent locally, causing evidence index/search to fail.
- Live deployment lag: new local route `/api/admin/status` may not exist on deployed Vercel until committed/deployed.
- Chat loop/repeated question behavior if the deterministic extractor does not recognize a terse answer.
- Vercel filesystem volatility can still affect local-file vector fallback; hosted audit now requires PostgreSQL and does not fall back to the filesystem.

Fallback demo path if external services fail:
- Do not upload a file.
- Paste a complete prompt with explicit owner, geography, integrations, and evidence signals.
- Run Council through `/api/conversation`.
- Export PDF from the deterministic run.
- Show `/api/health`, `/api/readiness`, `output_examples/*.json`, and `output_examples/review_pack_sample.pdf`.

## 10. Local vs Vercel Drift

| Drift area | Local behavior | Vercel behavior | Risk |
|---|---|---|---|
| CrewAI manifest source | Local can run Python dry-run if Python scripts are available; otherwise JS fallback | Vercel Node runtime does not provide the Python CrewAI adapter, so health has shown `js_static` | Judges may think CrewAI is broken unless label is explicit. |
| `/api/admin/status` | Implemented in `server.js` and `api/admin/status.js` locally | Live deployment returned `NOT_FOUND` before deploying latest local code | Route exists in repo but not live until commit/deploy. |
| Backend relay catch-all | `server.js` does not implement the same catch-all `/api/backend/[...path]` as Vercel | Vercel has `api/backend.js` and `api/backend/[...path].js` | Some local UI upload paths may behave differently than deployed paths. |
| Gateway token | Local may not have `COMPASS_GATEWAY_TOKEN`; health can report token false | Vercel has previously reported gateway token true | Evidence indexing may work deployed but fail locally. |
| Audit provider | Local/test can write JSONL | Hosted runtime requires PostgreSQL and fails closed without it | PostgreSQL is durable/scoped but not immutable retention. |
| Vector filesystem | Local-file vector store can persist for a local process/machine path | Vercel local-file provider is ephemeral unless durable storage is configured | Evidence retrieval may not persist across serverless invocations. |
| Static assets | Local served by `server.js` | Vercel serves static `public/` and API functions | Usually okay; check `npm run check:pages`. |
| External parser backend | Default points to `https://api.parallax42.bhavukarora.com` | Same default unless env overrides | External service status is independent of this repo. |
| Auth mode | Explicit local audit mode remains available | Production defaults/environments enforce auth; detailed audit always requires an audit role | Entra/membership/RLS are still absent. |
| Live LLM advisory | Requires local env and runtime | Requires Vercel env and runtime | Disabled by default; do not claim active unless verified. |

Routes implemented locally but missing or different on Vercel:
- `/api/admin/status` exists in local source but was not live at the checked deployed URL before deployment.
- `/api/backend/[...path]` exists as Vercel catch-all but not as a direct `server.js` route.

Features that work locally but not necessarily after deploy:
- Python CrewAI dry-run adapter.
- Stable local vector files; local audit JSONL is development/test evidence only.
- Any local-only file paths under `logs/`, temp, or generated outputs.

Features that only work or are more likely to work on Vercel:
- Gateway-backed evidence indexing if the token is configured only in Vercel.
- Vercel catch-all backend relay routes.

Deployment risks:
- Uncommitted docs/API/UI changes will not be present on live Vercel.
- Serverless functions with local-file vector/audit storage can lose state.
- Route parity is not fully tested across `server.js` and `api/`.

## 11. UX / Judge Experience Review

Current front-end strengths:
- The app is visibly chat-first and more aligned with the user's desired direction than the earlier form-heavy screen.
- `Start New Case` is visible in `public/index.html`.
- Context strength, agent stage animation, evidence attachment, Run Council, and Council Output are all present.
- The dark agentic visual language is consistent in `public/styles.css`.

Confusing labels:
- `Run council` is strong, but the distinction between "chat", "council", "replay", and "evidence" can still feel internal.
- Runtime labels like `CrewAI Flow dry run`, `NLP case builder`, or `js_static` are technically honest but business users may not understand them.
- "Evidence IDs", "retrieved chunks", and "readiness" are reviewer-facing, not business-user-friendly.

Missing explanations:
- The UI should explain in one concise place that the system does not auto-approve and that final decisions require human review.
- When gateway/parser is unavailable, the UI should say exactly what still works: deterministic council from typed context.
- It should distinguish uploaded, parsed, embedded, indexed, retrieved, and cited states.

Hidden agent collaboration:
- Named agents exist in trace/stage UI, but judges may not see how they collaborate.
- There is no visible "agent A challenged agent B" or "reviewer downgraded decision due to missing proof" moment.

Hidden audit/deterministic behavior:
- Hash-chain audit is real but mostly invisible.
- Deterministic final decision ownership is important but not visually obvious.

Weak empty states:
- Empty evidence/citation/output panels still feel like system internals rather than a guided workflow.
- The first-run chat could show a more polished "what I need from you" checklist.

Weak loading states:
- Upload parsing/indexing status has improved but can still look static.
- Long file operations need animated progress stages: upload, parse, extract, embed, index, cite.

Weak error states:
- Gateway-token absence, parser relay errors, and backend timeouts should be actionable in the UI.
- Current errors can feel like a hang if the browser is waiting for file/backend work.

Places where UI feels too technical:
- Post-council output screen shows raw runtime/evidence IDs too prominently for a business user.
- The export/review pack area should read like an executive memo first, technical JSON second.

Low-risk improvements limited to `public/index.html`, `public/app.js`, `public/styles.css`:
1. Add a business-user "Decision Memo" first in Council Output, with technical trace collapsed.
2. Add a compact agent-collaboration timeline: Intake -> Obligations -> Evidence -> Controls -> Responsible AI -> Packager, with "what changed" text.
3. Add upload progress chips and clear status: Uploaded, Parsed, Embedded, Indexed, Retrieved.
4. Add error banners with recovery actions.
5. Rename/reorder panels so "Decision", "Why", "Required Actions", "Evidence" come before raw runtime metadata.
6. Add a small "Deterministic decision owner; LLM advisory only if enabled" disclosure.
7. Add empty-state suggestions that are not vendor-specific or repetitive.

## 12. Top 10 Improvement Opportunities

1. Business-first Council Output
   - Why it matters: The current post-run screen is too technical for judges/business users.
   - Files likely changed: `public/index.html`, `public/app.js`, `public/styles.css`.
   - Implementation sketch: Render decision memo, approval boundary, top risks, required owner actions, and evidence confidence before trace/JSON.
   - Risk level: Low.
   - Test command: `npm run qa`; manual council run.
   - Rollback plan: Revert only UI render functions/styles.
   - Rubric impact: Demo, impact, problem relevance.

2. Visible specialist handoff narrative
   - Why it matters: Multi-agent collaboration is currently too hidden and too dry-run-looking.
   - Files likely changed: `public/app.js`, `public/styles.css`, maybe `lib/complianceAgent.js` for richer trace labels.
   - Implementation sketch: Show each specialist's input, output, and validation in a timeline.
   - Risk level: Low/Medium.
   - Test command: `npm run qa`.
   - Rollback plan: Remove timeline rendering, keep raw trace.
   - Rubric impact: Agent Design & Architecture.

3. Conversation loop guard
   - Why it matters: The agent can repeat the same question after a user answers tersely.
   - Files likely changed: `lib/conversationAgent.js`, `tests/unit/conversationAgent.test.js`.
   - Implementation sketch: Track asked questions and recognized answers; do not ask the same missing-field question if a plausible answer was just merged.
   - Risk level: Medium.
   - Test command: `npm test -- tests/unit/conversationAgent.test.js`.
   - Rollback plan: Revert conversation merge/question planner changes.
   - Rubric impact: Demo, robustness.

4. Upload/indexing status model
   - Why it matters: File attachment feels slow/static and can appear hung.
   - Files likely changed: `public/app.js`, `public/styles.css`.
   - Implementation sketch: Add a state machine for upload -> backend parse -> gateway embed -> vector store -> citation-ready.
   - Risk level: Medium.
   - Test command: `npm run qa`; manual upload with fixture.
   - Rollback plan: Revert UI status state only.
   - Rubric impact: Technical implementation, demo.

5. Route parity tests for `server.js` and Vercel handlers
   - Why it matters: Local/Vercel drift is real.
   - Files likely changed: `tests/unit/*`, maybe small helper module extraction.
   - Implementation sketch: Assert expected route inventory and key response shape for both local route modules and API handlers where feasible.
   - Risk level: Medium.
   - Test command: `npm test`.
   - Rollback plan: Remove tests if too brittle.
   - Rubric impact: Robustness.

6. Admin/Readiness UI panel
   - Why it matters: The app has truthful status metadata but it is not visible enough.
   - Files likely changed: `public/app.js`, `public/index.html`, `public/styles.css`.
   - Implementation sketch: Surface `/api/admin/status` as green/yellow/red readiness cards with no secrets.
   - Risk level: Low.
   - Test command: `npm run qa`; curl local `/api/admin/status`.
   - Rollback plan: Hide panel; leave endpoint.
   - Rubric impact: Robustness, technical credibility.

7. Review pack PDF polish
   - Why it matters: Current PDF is functional but not submission-grade.
   - Files likely changed: `lib/reviewPack.js`, `tests/unit/reviewPack.test.js`, `output_examples/review_pack_sample.pdf`.
   - Implementation sketch: Add executive summary, decision table, risk register, required actions, evidence appendix, audit hash summary.
   - Risk level: Low/Medium.
   - Test command: `npm test -- tests/unit/reviewPack.test.js`.
   - Rollback plan: Revert PDF renderer changes.
   - Rubric impact: Demo, impact.

8. Gateway unavailable graceful mode
   - Why it matters: Missing token/external services should not look broken.
   - Files likely changed: `public/app.js`, `api/evidence/index.js`, `api/evidence/search.js`.
   - Implementation sketch: Convert gateway failures into explicit "metadata-only evidence, not embedded" UI state where safe.
   - Risk level: Medium.
   - Test command: `npm run qa`; manual no-token run.
   - Rollback plan: Revert error handling changes.
   - Rubric impact: Robustness.

9. More golden cases
   - Why it matters: Four benchmark cases are thin for the breadth of compliance domains.
   - Files likely changed: `lib/benchmarkSuite.js`, `tests/unit/benchmarkSuite.test.js`, `output_examples/eval_report.json`.
   - Implementation sketch: Add export-control, healthcare data, media/audience analytics, finance workflow, platform integrator cases.
   - Risk level: Low.
   - Test command: `npm run benchmark`.
   - Rollback plan: Remove new cases.
   - Rubric impact: Technical implementation, problem relevance.

10. Truthful live deployment verification script
   - Why it matters: Submission should prove the deployed app matches local claims.
   - Files likely changed: `scripts/capture-evidence.js` or new small script, docs.
   - Implementation sketch: Curl health/admin/readiness/benchmarks/demo and write curated evidence without mutating generated runtime artifacts unexpectedly.
   - Risk level: Low.
   - Test command: run script manually.
   - Rollback plan: Remove script.
   - Rubric impact: Robustness, demo confidence.

## 13. Hackathon Rubric Alignment

| Judging area | Likely current strength | Evidence in repo | Gaps | Best improvement before submission |
|---|---|---|---|---|
| Problem Relevance | Strong | Compliance domains and requirements reflected in `lib/complianceAgent.js`, docs, synthetic fixtures, evidence graph | UI still sometimes speaks in technical internals | Business-first decision memo and required action view |
| Agent Design & Architecture | Medium | `lib/agentRuntime.js`, CrewAI dry-run scaffold, specialist stage names, deterministic engine | Collaboration is mostly staged deterministic orchestration, not true live multi-agent critique | Make handoffs/validation visible and add a real deterministic critique pass |
| Technical Implementation | Medium/Strong | Node/Vercel APIs, local mirror, unit tests, benchmark, audit, vector fallback, gateway client | External parser/gateway dependencies, local/Vercel drift, no durable persistence | Route parity tests and graceful gateway/parser status |
| Innovation & Creativity | Medium | Chat-first compliance council, human approval boundary, gateway embeddings path, audit trace | Needs stronger differentiated UX and evidence intelligence | Agent collaboration timeline plus polished review pack |
| Impact & Usefulness | Medium | Practical onboarding/risk use cases, PDF export, traceable gaps/controls | Business output is not yet executive-grade | Redesign council result for business users |
| Demo & Presentation | Medium | Static app is runnable; fixtures and output examples exist | UI can feel confusing post-run; upload status can look stuck | Guided demo mode and fallback path |
| Robustness & Reliability | Medium | `npm run qa`, unit tests, deterministic fallback | No E2E, no live route parity, no durable storage | Add smoke checks for local/deployed critical routes |
| Bonus | Low/Medium | Optional Compass gateway and CrewAI scaffold | No active live multi-agent specialists by default; no video | Document truthfully and show optional gateway status rather than overclaiming |

## 14. No-Claim List

Do not claim any of the following in README, demo, pitch, or submission unless additional implementation and verification are completed:

1. Production Redis, Postgres, Celery, RQ, or durable background queues.
2. Durable enterprise audit storage by default.
3. Tamper-proof/WORM audit storage.
4. Enforced enterprise RBAC/SSO in the public demo.
5. Active Qdrant retrieval in the default deployed demo.
6. Local OCR/parser service implemented inside this repository.
7. Parser/OCR reliability as a property of this repo; it is an external relay dependency.
8. Active live LLM specialists by default.
9. Live CrewAI multi-agent council on Vercel by default.
10. OpenClaw integration.
11. Autonomous approval or production auto-approval.
12. Production enterprise deployment readiness.
13. Guaranteed data residency or sovereign deployment.
14. Browser never touches file contents in every path; validate exact upload path before making that claim.
15. Compass gateway always available; it is optional/advisory and env-dependent.
16. Qdrant, Redis, Postgres, or managed object storage unless corresponding env and smoke evidence exist.
17. Security guarantees beyond implemented RBAC/audit controls.
18. Complete regulatory coverage for all G42 domains.
19. Live model benchmarking under production load.
20. Client references/testimonials.

## 15. Recommended Commit Plan

| Commit | Files | Commit message | Purpose | Validation before commit | Risk |
|---|---|---|---|---|---:|
| 1 | `ARCHITECTURE.md`, `EVALUATION.md`, `SUBMISSION.md`, `README.md` | `docs: add judge-facing submission entry points` | Canonical docs and truthful quick start | `npm run check:pages` | Low |
| 2 | `output_examples/*`, `.gitignore` if needed | `docs: add curated submission evidence artifacts` | Stable proof artifacts without mutating generated evidence | JSON validation plus `npm run check:pages` | Low |
| 3 | `public/index.html`, `public/app.js`, `public/styles.css` | `ui: add start new case session reset` | Reset chat/case state without touching runtime config | `npm run qa`; manual UI click | Low/Medium |
| 4 | `api/admin/status.js`, `lib/adminStatus.js`, `server.js` | `api: add truthful admin readiness status endpoint` | Safe status endpoint for demo/admin readiness | `node -e "const { buildAdminStatus } = require('./lib/adminStatus'); console.log(buildAdminStatus().status)"`; `npm run qa` | Low |
| 5 | `CODEX_REPO_AUDIT.md` | `docs: add repository audit for next implementation phase` | Planning artifact for hackathon improvements | Markdown review; optionally `npm run check:pages` | Low |
| 6 | Future UI polish files | `ui: make council output business-readable` | Improve judge experience | `npm run qa`; manual run/export | Medium |
| 7 | Future conversation tests/logic | `agent: reduce repeated chat follow-up loops` | Improve chat reliability | `npm test -- tests/unit/conversationAgent.test.js` | Medium |

Do not commit generated runtime noise from `logs/`, `.playwright-cli/`, `output/playwright/`, or `audits/` unless a specific artifact is curated into `output_examples/` or docs.

## 16. Final Recommendation

Improve next:
1. Make Council Output business-readable before touching deeper architecture. This has the highest demo impact with lowest risk.
2. Add visible specialist collaboration and validation in the UI using existing trace data.
3. Fix conversation loop behavior so short answers like "Head of IT" are accepted and not repeatedly questioned.
4. Add clear upload/indexing progress and failure states.
5. Add route parity and smoke checks for local vs Vercel.

Defer:
1. Production Redis/Postgres/queues.
2. Full live CrewAI specialist execution.
3. Qdrant production rollout unless there is time for real smoke evidence.
4. Enforced enterprise auth in the public demo.
5. Major frontend rewrite or framework migration.

Delete or hide:
1. Any UI/docs copy that implies production durability.
2. Any OpenClaw references if they appear in future edits.
3. Any raw generated audit/playwright clutter from submission scope.
4. Raw JSON-first output for business users; keep it available but behind an advanced/details view.

Document truthfully:
1. Deterministic decision engine owns final decisions.
2. CrewAI is dry-run/orchestration-shaped by default.
3. Compass gateway is optional and advisory for LLM; embeddings/index/search require token/config.
4. Local-file vector store is the default demo path.
5. Audit is hash-chained local JSONL and not enterprise-durable unless storage is configured.
6. Parser/OCR is external relay-backed, not implemented locally in this repo.

Demo:
1. Use the chat-first workflow.
2. Start from a fresh case.
3. Use a complete, realistic compliance prompt.
4. Attach a synthetic document only if parser/gateway health is confirmed.
5. Run Council.
6. Show business decision, required actions, evidence, audit trace, human approval boundary.
7. Export the executive review pack PDF.
8. If external services fail, use the no-upload deterministic fallback and explain that gateway/parser paths are optional integrations.
