# Parallax42 Agent v2 — Security Assessment

**Review date:** 2026-07-12

**Reviewed revision:** `a98556c` (`main`)

**Scope:** Node/CommonJS product API, Vercel routes, FastAPI/Node-bridge evaluator, vanilla browser client, Compass/model boundary, parser relay, PostgreSQL/Qdrant/learning/audit stores, CI/CD, GitHub Pages, container, and planned Azure migration.
**Status:** current residual-risk register. Findings marked Open are not fixed by this documentation update.

## Executive summary

The repository has useful security foundations: server-side AI credentials, parameterized PostgreSQL operations, actor-scoped primary evidence retrieval, strong randomized/hashed demo tokens, bounded Node request and relay sizes, prompt-injection boundary text, explicit human review, audit redaction/hashing, and no detected committed production secret or known npm advisory.

It is not ready for multi-tenant production. Three security issues are Azure/pilot release blockers:

1. Audit entries are globally readable through an unauthenticated, publicly cacheable endpoint and the live Vercel audit provider is nondurable `/tmp`.
2. The FastAPI deployment defaults to permissive audit authentication, so a missing production setting can fail open.
3. An authenticated actor can retrieve another workspace's learning memory by supplying that workspace in conversation state.

The broader [deep code review](docs/DEEP_CODE_REVIEW.md) also confirms decision-integrity defects. Security approval should be withheld until tenant scope is derived exclusively from authenticated membership, all audit/log/probe routes fail closed, immutable artifacts are server-loaded, and the adversarial release gates pass.

## Live and repository verification

- Production Vercel deployment was `Ready` at review time; separate functions run in `iad1`.
- Anonymous `GET /api/logs` returned `200`. The inspected instance had `entry_count: 0`, `storage_provider: local_tmp`, `durable: false`, and `enterpriseReady: false`; no current record disclosure was observed, but another instance can hold entries.
- HTML and `/api/logs` used `Cache-Control: public, max-age=0, must-revalidate`.
- Vercel supplied HSTS, `X-Content-Type-Options`, referrer, and permissions headers. A restrictive CSP and frame protection were absent.
- Environment-name inventory showed dedicated Compass gateway, PostgreSQL, Qdrant, auth, sample-mode, and durable-storage settings; values were not accessed. No managed audit-store implementation variable was evident.
- `main` is not branch-protected. Latest CI, Pages, and Agentathon preflight runs were green.
- Node tests: 240/240. Python security tests: 11/11. `npm audit --omit=dev`: zero known advisories.
- No committed raw Compass token, provider key, or private key was found.

Point-in-time live checks do not replace an authenticated penetration test, cloud control review, or data-protection assessment.

## Assets and trust boundaries

### Highest-value assets

- uploaded contracts, security evidence, DPA/PII descriptions, and extracted chunks;
- case facts, gaps, decisions, reviewer notes, approvals, and branded review packs;
- tenant/workspace/project membership and role assignments;
- Compass gateway client token and model budget;
- PostgreSQL/Qdrant/learning-memory contents;
- audit records and artifact hashes;
- deployment identity, GitHub workflows, and Azure/Vercel/Railway configuration.

### Boundaries that must be explicit

```text
Untrusted browser / uploaded evidence
  -> public edge and API authorization
  -> tenant-scoped Node product authority
       -> PostgreSQL / Qdrant / learning / audit
       -> Compass gateway (external processor)
       -> parser relay (external processor when enabled)

FastAPI evaluator
  -> separate deployment and auth posture
  -> Node subprocess / model / retrieval dependencies

GitHub Actions
  -> deployment identity
  -> Vercel/Pages now; Azure OIDC/ACR/Container Apps planned
```

Data supplied in chat, documents, retrieved chunks, or model output is untrusted content. Identity scope must come from verified claims plus application membership, never from those payloads.

## P0 — release blockers

### P42-SEC-001 — Audit entries are unauthenticated, global, publicly cacheable, and nondurable

**Severity:** Critical
**Status:** Open

**Evidence**

- `api/logs.js:6-18` returns audit data without authentication.
- `lib/auditStore.js:81-95`, `112-139` omits tenant dimensions and exposes a global tail.
- `api/audit/recent.js:15-19` does not tenant-filter the read.
- `api/_http.js:31-40` sends JSON without an explicit private/no-store cache policy; the public cache behavior above was observed on the live Vercel response.
- `lib/httpHandlers.js:208` can write case/assessment/plan/decision metadata.
- `vercel.json` exposes `/logs`.

**Attack scenario:** after a user action writes an event to the same function instance—or after migration centralizes the store—an anonymous caller reads case metadata, evidence IDs, decisions, or actor information. An authenticated actor can also read a global audit tail without workspace filtering.

**Why live emptiness is not a mitigation:** the inspected instance held zero entries because Vercel functions have isolated ephemeral `/tmp`. That same fragmentation means the audit is incomplete and can disappear during scale or deploy.

**Remediation**

1. Remove the public full-entry route or require an audit-specific permission.
2. Return `Cache-Control: no-store, private` on every personalized/diagnostic response.
3. Persist tenant/workspace/project on each event; derive them from the actor.
4. Tenant-filter all normal reads; reserve cross-tenant reads for a separately audited platform administrator.
5. Append events transactionally to a durable ledger and seal ranges to immutable storage.

**Acceptance:** anonymous calls return 401/403 or a deliberately minimal aggregate; A/B tenant tests pass; restart/scale/restore preserves an ordered, verifiable chain.

### P42-SEC-002 — FastAPI production authentication fails open by default

**Severity:** Critical
**Status:** Open

**Evidence**

- `app/auth.py:48-50` defaults to `audit` mode.
- `app/auth.py:86` creates an anonymous demo actor for a missing bearer.
- `app/main.py:205-213` exposes the `/run` path under that posture.
- `run.py:24` and `Dockerfile:5` bind the container service without enforcing production auth.
- `.github/workflows/agentathon-preflight.yml:103` exercises the container without proving enforced auth.

**Attack scenario:** the evaluator is exposed in a new environment with the auth variable missing. Anonymous callers run long Node/model/retrieval work and receive case output.

**Remediation:** production startup must fail unless issuer, audience, tenant, signing/JWKS, and required role configuration are valid. Keep audit mode explicit and local-only. If deployed on Azure, use private Container Apps ingress/APIM and validate identity again in the application.

**Acceptance:** a production-mode container cannot start with incomplete auth; missing/invalid/expired/wrong-audience/wrong-tenant tokens fail; its OpenAPI, logs, status, run, and probe routes follow the same policy.

### P42-SEC-003 — Authenticated cross-workspace learning-memory disclosure

**Severity:** Critical

**Status:** Open; exploit reproduced

**Evidence**

- `lib/httpHandlers.js:181-190` forwards actor plus request-derived case data into enrichment.
- `lib/serverSideRetrieval.js:178-191` constructs the learning namespace from client-controlled workspace/project values and calls the learning layer without the actor.
- `lib/learningMemory.js:117-133`, `253-265`, and `302-317` return and scope reviewer notes, outcomes, and missing-evidence memory from those values.
- Direct learning routes override request scope with actor context, demonstrating the intended boundary.

**Confirmed attack:** a record containing a confidential marker was seeded in a victim workspace. A different authenticated actor supplied the victim workspace in conversation enrichment and received the victim's reviewer feedback, outcome, notes, and missing-evidence data.

**Remediation:** derive organization/workspace/project once from authenticated membership inside the retrieval/data layer. Reject or ignore all body/draft tenant identifiers. Apply the same rule to governance, evidence, cases, audit, learning, export, and deletion, backed by composite tenant keys and database policy where practical.

**Acceptance:** hostile tenant A/B tests cover every resource and operation; a valid token plus a guessed/supplied victim identifier cannot affect query scope; logs prove denial without exposing the target.

## P1 — high-priority security findings

### Identity, tenancy, and authorization

| ID | Finding | Evidence | Remediation | Status |
|---|---|---|---|---|
| P42-SEC-004 | Governance enrichment has the same request-scope trust smell. | `lib/serverSideRetrieval.js:130-138` | Apply the identical actor-derived namespace contract and hostile-scope tests. | Open |
| P42-SEC-005 | Node issuer/audience/tenant checks are optional and delegated scopes/groups can become app roles. | `lib/rbac.js:130-193` | Use a maintained OIDC verifier or platform auth; fail startup without claim constraints; map only explicit application roles. Bound HTTPS JWKS fetch/cache. | Open |
| P42-SEC-006 | Global workspace configuration can override derived user scope; tenant model lacks memberships/RLS. | `lib/rbac.js:119-123`; `lib/recordStore.js:43-60`, `108-190` | Add organization/workspace/membership records, composite tenant keys, and PostgreSQL RLS or equivalent database policy. | Open |
| P42-SEC-007 | No maker-checker separation: broad reviewer/demo roles can approve and approval does not compare reviewer with owner/runner. | `lib/rbac.js:30`; `lib/caseLifecycle.js:128`; `lib/caseApproval.js:80-104` | Require explicit approver role and `approver != owner/last runner`; use two-person review for high risk. | Open |
| P42-SEC-008 | GitHub Pages shares an origin with every owner project while the UI can store a bearer and send it to a user-selected API origin. | `.github/workflows/pages.yml:27-31`; `public/index.html:392`; `public/app.js:473`, `501`, `623` | Pages must be an unprivileged synthetic demo; use a dedicated origin for authenticated use and exact-allowlist API destinations. | Open |

### Public, cost-bearing, and resource-abuse surfaces

| ID | Finding | Evidence | Remediation | Status |
|---|---|---|---|---|
| P42-SEC-009 | FastAPI `/compass/probe` is public and performs a real chat completion. | `app/main.py:200-202`; `app/compass_client.py:402`, `458`, `507` | Public health must be passive; admin-gate/cache active diagnostics and charge a durable quota. | Open |
| P42-SEC-010 | FastAPI has unbounded flexible bodies, no route quota/concurrency cap, synchronous dependency work in async routes, and a Node subprocess per run. | `app/schemas.py:10-20`; `app/main.py:131`, `200`, `205-213`; `app/node_bridge.py:39-118` | Enforce ingress/body/schema/concurrency/deadline limits; use async isolation or a persistent service/queue. | Open |
| P42-SEC-011 | Request `options.sample_mode` bypasses live Compass requirements. | `app/schemas.py:19`; `app/agentathon_orchestrator.py:121-123`, `479-493`, `1275-1390` | Make sample mode server-controlled, reject in production, and watermark simulation artifacts. | Open |
| P42-SEC-012 | Clients can request expensive runtimes; council/chat/export amplify into many model calls. | `lib/httpHandlers.js:81-83`, `114-130`, `188-201`; `lib/conversationLlmAssessor.js:821-891`, `1222-1380`; `lib/advisoryCouncil.js:110-170` | Pin runtime server-side; enforce per-tenant operation/token/cost/concurrency budgets and an end-to-end deadline. | Open |
| P42-SEC-013 | Rate limits are process-local and not comprehensive; demo sessions can be minted anonymously. | `lib/rateLimiter.js:5`, `21`, `67-84`; `api/demo/session.js:8` | Use edge plus PostgreSQL/Redis-backed quotas keyed to actor/workspace/operation; retain local limit only as defense in depth. | Open |
| P42-SEC-014 | Health can report `ok` while dependencies degrade and may spawn Python or perform costly checks. | `api/health.js:22-40`; `app/main.py:92-109`; `lib/agentRuntime.js:106`, `408-430` | Split process-only `/livez` from strict, cached, authenticated `/readyz`; never make model calls in load-balancer probes. | Open |

### Data egress, integrity, and lifecycle

| ID | Finding | Evidence | Remediation | Status |
|---|---|---|---|---|
| P42-SEC-015 | Parser relay forwards the caller's bearer and trusts upstream content type on the application origin. | `api/_backendRelay.js:143-155`, `249` | Use a service/OBO credential with correct audience; accept only expected JSON/binary contract and force a safe response type. | Open; production flag observed off |
| P42-SEC-016 | Parser can receive raw documents through a configured external default without a complete in-repo residency/retention/consent contract. | `lib/runtimeConfig.js:65-69`; `public/app.js:2289-2316` | Default off, exact-allowlist the service, show processing boundary, enforce upload entitlement, and approve DPA/region/retention/deletion. | Open; production flag observed off |
| P42-SEC-017 | Authorized callers can forge a branded review pack from client-supplied run JSON. | `lib/httpHandlers.js:289-307`; `lib/reviewPack.js:212-220` | Accept case/run/version only; load an immutable server record and include hash/version/watermark. | Open |
| P42-SEC-018 | Evidence, learning, cases, and vectors lack a complete retention/erasure cascade; expired records are not purged. | `lib/evidenceVectorStore.js:192`, `280`; `lib/learningMemory.js:85`; `lib/caseLifecycle.js:285`; `lib/recordStore.js:220-257` | Define retention classes, purge jobs, legal hold, and verified workspace/case deletion across SQL/vector/learning/object stores. | Open |
| P42-SEC-019 | Learning feedback can insert fabricated precedent without a finalized case/reviewer decision. | `api/learning/feedback.js:9-33`; `lib/learningMemory.js:85` | Bind to an immutable finalized run and authorized reviewer; retain provenance/trust score and reversible deletion. | Open |
| P42-SEC-020 | Chat, evidence summaries/chunks, and embeddings leave the product boundary; execution is in `iad1`, but processor region/residency controls are not explicit. | `lib/conversationLlmAssessor.js:960`, `1162`; `lib/compassGatewayClient.js:225`; parser relay | Publish a data-flow/processor register; apply DLP/redaction/sensitivity denial; approve regions and contractual controls. | Open |
| P42-SEC-021 | Dedicated gateway-token configuration can fall back to provider/CrewAI API keys. | `lib/runtimeConfig.js:33`; `lib/compassGatewayClient.js:123` | In production require a dedicated audience-scoped gateway credential and fail closed. | Open configuration hazard |

### Release and platform controls

| ID | Finding | Evidence | Remediation | Status |
|---|---|---|---|---|
| P42-SEC-022 | `main` is unprotected; Actions use tags rather than commit SHAs; full Python security suite is not a required CI check. | GitHub API; `.github/workflows/ci.yml`; `.github/workflows/agentathon-preflight.yml` | Require PR/review/checks, least-privilege workflow permissions, SHA pins, Python tests, dependency/container scans, and approval-gated production. | Open |
| P42-SEC-023 | Feature switches are `/tmp` and per function; audit provider labeling does not create durable storage. | `lib/adminFeatureFlags.js:15`, `81-104`; `lib/auditStore.js:175-194` | Use durable audited configuration and make readiness fail when required durable providers are absent. | Open |
| P42-SEC-024 | Python dependencies and base image are not immutable; the container runs as root with broad copy context. | `requirements.txt`; `requirements-crewai.txt`; `Dockerfile:1-29` | Lock hashes, pin image digest, remove unused `openai`, create non-root user, narrow `COPY`, generate SBOM, and scan. | Open |

## P2/P3 — defense in depth

| ID | Priority | Finding | Recommendation |
|---|---:|---|---|
| P42-SEC-025 | P2 | Restrictive CSP, `frame-ancestors`, and private API cache defaults are absent. | Add a tested nonce/hash CSP with `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; use `no-store, private` for personalized APIs. |
| P42-SEC-026 | P2 | Local evidence/learning stores use unlocked read-modify-write; audit rereads the full file for append. | Keep them demo-only; require managed stores for production. |
| P42-SEC-027 | P2 | PostgreSQL pool is per process and schema setup happens on the request path. | Use low pool limits/pooler, TLS verification and error handling, and out-of-band migrations. |
| P42-SEC-028 | P2 | Raw internal/provider errors can reach callers. | Return stable error codes and correlation IDs; keep detail in protected sanitized logs. |
| P42-SEC-029 | P2 | Upload byte caps exist, but in-repo magic-byte validation, malware quarantine, and archive expansion controls are not demonstrated. | Require and test these controls at the parser/object-ingest boundary. |
| P42-SEC-030 | P2 | Qdrant generation/model/purpose isolation and semantic score threshold are weak. | Version indexes, validate schema/model, prefilter tenants, replace stale points, and calibrate a threshold. |
| P42-SEC-031 | P3 | FastAPI Swagger/OpenAPI and detailed status routes are public by default. | Disable in production or restrict to internal/admin access. |
| P42-SEC-032 | P3 | CrewAI adapter uses a static token and threaded development-style server. | Keep private; if deployed, use managed identity/mTLS, ingress limits, a production server, and sanitized errors. |

## Highest-risk attack chains

### Chain A — durable-audit migration creates an immediate disclosure

1. Azure or another managed store centralizes audit events.
2. Existing `/api/logs` remains unauthenticated and global.
3. Public caching permits intermediaries/browser caches to retain responses.
4. An anonymous caller reads tenant case metadata and decisions.

Break this chain before migrating audit: remove/protect the route, add tenant dimensions and filtering, and set private no-store caching.

### Chain B — authenticated tenant escape through learning enrichment

1. Attacker obtains a valid demo/pilot token.
2. Attacker supplies a victim `workspaceId`/`projectId` in conversation state.
3. Learning retrieval constructs its namespace from those client values without the actor.
4. Reviewer notes, outcomes, and gaps are returned and can influence the attacker case.

Break this chain by deriving tenant scope once from membership inside the data layer and testing malicious identifiers everywhere.

### Chain C — unprivileged cost/resource exhaustion

1. FastAPI runs in default audit mode or exposes its public model probe.
2. Flexible bodies and missing distributed quotas admit repeated long calls.
3. Each run can spawn Node and fan out to model/retrieval operations.
4. Synchronous work occupies workers while tokens and compute are consumed.

Break this chain with fail-closed auth, passive public health, ingress limits, durable budgets, concurrency caps, and true deadlines.

### Chain D — bearer exposure through configurable origins

1. User enters a privileged token on the shared GitHub Pages origin.
2. A malicious same-origin project or configured backend gains access to/request receipt of it.
3. Token is replayed against product APIs.

Break this chain by keeping Pages synthetic and token-free, hosting authenticated use on a unique origin, and exact-allowlisting credentialed destinations.

## Existing controls worth preserving

- No concrete SQL injection was found; PostgreSQL calls reviewed are parameterized.
- Relay routes are allowlisted and have request/response byte caps, timeouts, and authorization; it is not an open proxy.
- Hosted URL and fixture path traversal protections have passing tests.
- The primary evidence Qdrant path applies actor workspace/project/case filters.
- No concrete DOM-XSS was found in reviewed render paths; sensitive content generally uses `escapeHtml` or `textContent`.
- Subprocess execution uses fixed argument arrays without a shell; no command injection path was found.
- Session tokens use strong randomness, are stored hashed, and pilot cookies are HttpOnly, SameSite=Lax, and Secure in production.
- Model calls remain server-side and prompt-injection boundary instructions are present.
- Node request limits, parser response caps, and gateway/Qdrant timeouts provide useful baseline controls.
- Human approval is explicit; no direct autonomous approval action was found.

These controls do not mitigate the decision-integrity findings in the deep review, especially promotion of questions into evidence and conditional approval semantics.

## Azure security gates

The selected design and phased runbook are in [docs/AZURE_MIGRATION_PLAN.md](docs/AZURE_MIGRATION_PLAN.md). Security approval for each phase requires:

### Before no-traffic compute shadow

- close decision-integrity, tenant-escape, and anonymous log/probe exposure defects;
- use synthetic data only and route no user/pilot traffic while durable audit remains open;
- fail-closed runtime config and passive liveness/readiness;
- immutable/pinned container, non-root execution, OIDC deployment;
- outbound Compass/parser destinations approved and allowlisted;
- sanitized OpenTelemetry attributes tested.

### Before state migration

- close all three security P0s before any user or pilot traffic;
- versioned schema migrations and explicit memberships;
- private PostgreSQL/Blob endpoints, least-privilege identities;
- canonical evidence objects and hashes;
- transactional tenant-scoped audit plus immutable export;
- backup/restore and erasure/retention drills.

### Before enterprise identity/edge

- separate Entra SPA/API registrations and explicit app roles;
- APIM and Node validate issuer/audience/tenant/roles;
- maker-checker separation and privileged access review;
- Front Door WAF, private origins, CSP, private cache policy;
- hostile tenant and credential-routing browser tests.

### Before vector cutover

- canonical source store, versioned model/index generations, mandatory tenant prefilter;
- search-delete/erasure propagation;
- adversarial retrieval/grounding corpus and calibrated thresholds;
- Qdrant rollback retained through acceptance.

## Priority remediation order

1. Protect/remove logs and active probes; make FastAPI and JWT configuration fail closed.
2. Fix the confirmed learning tenant escape and audit/global namespace model.
3. Remove public Pages token handling and client-selected credential destinations.
4. Add immutable server-side runs/reviews/exports and maker-checker approval.
5. Enforce distributed operation/model/parser budgets and resource admission.
6. Add retention/erasure, processor/residency controls, and canonical document storage.
7. Protect `main`, pin supply-chain inputs, and require the full security/parity/E2E suite.
8. Add CSP/private caching, sanitized errors/telemetry, and container/database hardening.

## Required security regression suite

- unauthenticated/unauthorized matrix for every route in Node and FastAPI;
- wrong issuer/audience/tenant/role plus JWKS timeout/rotation tests;
- tenant A/B hostile identifiers for case, evidence, governance, learning, audit, review, export, and deletion;
- maker-checker and conditional-review workflow tests;
- forged/stale review-pack and policy-hash tests;
- sample/runtime override rejection in production;
- budget, concurrency, body limit, abort, and model-call-count tests;
- parser credential audience/content-type/malware/size/deletion tests;
- audit multi-replica ordering, tamper, retention, restore, and tenant filtering;
- CSP/cache/header and shared/custom-origin browser tests;
- dependency/container/IaC scans and restore/canary/rollback evidence in required CI.

## Final security disposition

**Public synthetic demo:** acceptable only with clear demo labeling, synthetic data, strict quotas, no privileged token on GitHub Pages, and protected logs/probes.

**Single trusted pilot:** not approved until all three security P0 findings, immutable review-pack integrity, and the primary workflow version defect are closed.

**Multi-tenant/enterprise or Azure production:** not approved until identity/membership, durable tenant audit, retention/erasure, resource admission, supply chain, and Azure phase gates above are verified.
