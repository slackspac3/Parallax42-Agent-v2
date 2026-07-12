# Parallax42 Agent v2 — Security Assessment

**Review date:** 2026-07-12

**Reviewed revision:** `a98556c` (`main`); remediation implementation reviewed in the 2026-07-12 local worktree.

**Scope:** Node/CommonJS product API, Vercel routes, FastAPI/Node-bridge evaluator, vanilla browser client, Compass/model boundary, parser relay, PostgreSQL/Qdrant/learning/audit stores, CI/CD, GitHub Pages, container, and planned Azure migration.
**Status:** current residual-risk register and remediation addendum. P42-SEC-001, P42-SEC-003, and P42-SEC-004 are remediated in the local implementation with focused tests. Full local QA is green; CI, deployment, and authenticated live verification are pending.

## Executive summary

The repository has useful security foundations: server-side AI credentials, parameterized PostgreSQL operations, actor-scoped primary evidence retrieval, strong randomized/hashed demo tokens, bounded Node request and relay sizes, prompt-injection boundary text, explicit human review, audit redaction/hashing, and no detected committed production secret or known npm advisory.

It is not ready for multi-tenant production. This remediation closes the confirmed public/global audit disclosure path, the authenticated learning-memory escape, and the matching governance scope defect. Hosted audit now uses actor-derived workspace/project PostgreSQL hash chains; detailed Node reads are role-gated/scoped and private; `/api/logs` is a non-disclosing 404; FastAPI `/logs` is role-gated and returns no trace records. Learning/governance retrieval ignores caller-selected workspace/project values.

The remaining P0 is P42-SEC-002: FastAPI production auth can still default to audit mode. Enterprise blockers also remain in P1: complete Entra/membership/RLS enforcement, immutable server-loaded artifacts, active-probe/admission controls, WORM audit export and restore proof, and atomic coupling between critical business changes and their audit event.

## Live and repository verification

- Production Vercel deployment was `Ready` at review time; separate functions run in `iad1`.
- Original live observation: anonymous `GET /api/logs` returned `200` with public caching and an instance-local `local_tmp` provider. The local remediation changes that route to `404` with `private, no-store`; live deployment verification is pending.
- Vercel supplied HSTS, `X-Content-Type-Options`, referrer, and permissions headers. A restrictive CSP and frame protection were absent.
- Environment-name inventory showed dedicated Compass gateway, PostgreSQL, Qdrant, auth, sample-mode, and durable-storage settings; values were not accessed. The remediation reuses the existing PostgreSQL connection for audit rather than adding another credential.
- `main` is not branch-protected. CI, Pages, and Agentathon preflight were green at the original review; the remediation revision has not yet been pushed/verified.
- Final remediation worktree: 269/269 Node tests, 13/13 Python security tests, full local `npm run qa`, two-turn Playwright mock, and 4/4 benchmark pass. At the original review, `npm audit --omit=dev` reported zero known advisories.
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
**Status:** Remediated locally for the reported access, scope, cache, and hosted-durability defects. Immutable retention and business/audit atomicity remain residual production controls.

**Original evidence**

- `api/logs.js:6-18` returns audit data without authentication.
- `lib/auditStore.js:81-95`, `112-139` omits tenant dimensions and exposes a global tail.
- `api/audit/recent.js:15-19` does not tenant-filter the read.
- `api/_http.js:31-40` sends JSON without an explicit private/no-store cache policy; the public cache behavior above was observed on the live Vercel response.
- `lib/httpHandlers.js:208` can write case/assessment/plan/decision metadata.
- `vercel.json` exposes `/logs`.

**Original attack scenario:** after a user action writes an event to the same function instance—or after migration centralizes the store—an anonymous caller reads case metadata, evidence IDs, decisions, or actor information. An authenticated actor can also read a global audit tail without workspace filtering.

**Why live emptiness is not a mitigation:** the inspected instance held zero entries because Vercel functions have isolated ephemeral `/tmp`. That same fragmentation means the audit is incomplete and can disappear during scale or deploy.

**Implemented remediation**

1. `api/logs.js:8-12` returns a non-disclosing 404 with `private, no-store`; the `/logs` Vercel rewrite was removed.
2. `api/audit/recent.js:10-25` requires `audit:read`, derives scope from the authorized actor, tenant-filters records and integrity verification, and returns `private, no-store`.
3. `lib/auditStore.js` persists workspace/project on each event, serializes each chain head with `SELECT ... FOR UPDATE`, commits event/head together, scopes reads/verification, cross-checks event columns and the persisted head to detect truncation, and enforces hosted/explicit durable-storage requirements without PostgreSQL.
4. `app/auth.py:139-155` and `app/main.py:178-185` role-gate FastAPI `/logs`; it returns no trace entries or filenames.

**Regression evidence:** `tests/unit/auditRoutes.test.js`, `tests/unit/auditStore.test.js`, `tests/unit/rbac.test.js`, and `tests/python/test_security_boundaries.py` cover public removal, private caching, auth/role boundaries, A/B scope, concurrent ordering, tail/head integrity, hosted fail-closed behavior, and non-disclosing FastAPI logs.

**Residual:** PostgreSQL provides durable, scoped application hash chains, not immutable/WORM retention. Add versioned migrations, sealed range export, restore drills, and same-transaction coupling between critical PostgreSQL business mutations and their audit event (or an outbox across service boundaries).

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

**Status:** Remediated locally for the reproduced learning path and sibling governance enrichment path.

**Original evidence**

- `lib/httpHandlers.js:181-190` forwards actor plus request-derived case data into enrichment.
- `lib/serverSideRetrieval.js:178-191` constructs the learning namespace from client-controlled workspace/project values and calls the learning layer without the actor.
- `lib/learningMemory.js:117-133`, `253-265`, and `302-317` return and scope reviewer notes, outcomes, and missing-evidence memory from those values.
- Direct learning routes override request scope with actor context, demonstrating the intended boundary.

**Original confirmed attack:** a record containing a confidential marker was seeded in a victim workspace. A different authenticated actor supplied the victim workspace in conversation enrichment and received the victim's reviewer feedback, outcome, notes, and missing-evidence data.

**Implemented remediation:** `lib/serverSideRetrieval.js`, `lib/learningMemory.js`, and `lib/governanceReferenceStore.js` pass the authenticated actor through the retrieval/data boundary and ignore body/draft workspace/project identifiers when building learning and governance namespaces.

**Regression evidence:** `tests/unit/learningMemory.test.js:106-165` seeds two workspaces and proves direct and conversation learning retrieval cannot return the victim marker. `tests/unit/governanceReferenceStore.test.js:92-137` proves the same rule for governance retrieval.

**Residual:** this closes the confirmed exploit, not the complete enterprise tenancy program. Add explicit memberships, composite tenant keys, PostgreSQL RLS/equivalent policy, and hostile A/B coverage for case, evidence, audit, review, export, deletion, and every write path.

## P1 — high-priority security findings

### Identity, tenancy, and authorization

| ID | Finding | Evidence | Remediation | Status |
|---|---|---|---|---|
| P42-SEC-004 | Governance enrichment accepted request-selected scope. | `lib/serverSideRetrieval.js`; `lib/governanceReferenceStore.js`; hostile-scope regression in `tests/unit/governanceReferenceStore.test.js:92-137` | Actor-derived namespace contract implemented; retain the hostile-scope test. | Remediated locally |
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
| P42-SEC-023 | Feature switches remain `/tmp` and per function. Hosted audit now uses PostgreSQL and fails closed when unavailable. | `lib/adminFeatureFlags.js`; `lib/auditStore.js` | Use durable audited feature configuration; keep strict audit readiness/fail-closed behavior. | Open for feature configuration |
| P42-SEC-024 | Python dependencies and base image are not immutable; the container runs as root with broad copy context. | `requirements.txt`; `requirements-crewai.txt`; `Dockerfile:1-29` | Lock hashes, pin image digest, remove unused `openai`, create non-root user, narrow `COPY`, generate SBOM, and scan. | Open |

## P2/P3 — defense in depth

| ID | Priority | Finding | Recommendation |
|---|---:|---|---|
| P42-SEC-025 | P2 | Restrictive CSP, `frame-ancestors`, and private API cache defaults are absent. | Add a tested nonce/hash CSP with `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; use `no-store, private` for personalized APIs. |
| P42-SEC-026 | P2 | Local evidence/learning stores use unlocked read-modify-write; local audit JSONL rereads its file. | Keep every file provider local/test-only; hosted audit already requires PostgreSQL. |
| P42-SEC-027 | P2 | PostgreSQL pool is per process and schema setup happens on the request path. | Use low pool limits/pooler, TLS verification and error handling, and out-of-band migrations. |
| P42-SEC-028 | P2 | Raw internal/provider errors can reach callers. | Return stable error codes and correlation IDs; keep detail in protected sanitized logs. |
| P42-SEC-029 | P2 | Upload byte caps exist, but in-repo magic-byte validation, malware quarantine, and archive expansion controls are not demonstrated. | Require and test these controls at the parser/object-ingest boundary. |
| P42-SEC-030 | P2 | Qdrant generation/model/purpose isolation and semantic score threshold are weak. | Version indexes, validate schema/model, prefilter tenants, replace stale points, and calibrate a threshold. |
| P42-SEC-031 | P3 | FastAPI Swagger/OpenAPI and detailed status routes are public by default. | Disable in production or restrict to internal/admin access. |
| P42-SEC-032 | P3 | CrewAI adapter uses a static token and threaded development-style server. | Keep private; if deployed, use managed identity/mTLS, ingress limits, a production server, and sanitized errors. |

## Highest-risk attack chains

### Chain A — durable-audit migration creates an immediate disclosure

**Status:** Broken by the local remediation; live deployment verification pending.

Original chain:

1. Azure or another managed store centralizes audit events.
2. Existing `/api/logs` remains unauthenticated and global.
3. Public caching permits intermediaries/browser caches to retain responses.
4. An anonymous caller reads tenant case metadata and decisions.

The remediation removes the entry route, adds actor-derived tenant dimensions/filtering, uses private no-store caching, and makes PostgreSQL the hosted provider. Preserve these tests during Azure migration.

### Chain B — authenticated tenant escape through learning enrichment

**Status:** Broken for learning and governance enrichment by the local remediation.

Original chain:

1. Attacker obtains a valid demo/pilot token.
2. Attacker supplies a victim `workspaceId`/`projectId` in conversation state.
3. Learning retrieval constructs its namespace from those client values without the actor.
4. Reviewer notes, outcomes, and gaps are returned and can influence the attacker case.

The retrieval/data layer now derives these namespaces from the authenticated actor, and hostile A/B regressions cover learning and governance. Extend the same tests and database policy to every remaining resource.

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
- Human approval is explicit; conditional is nonterminal and server approval requires `approvalEligible: true`.
- Questions/mentions/policy references cannot satisfy evidence controls; contradictory statements remain blocking.
- Python preserves authoritative Node policy fields and adds advisory output separately.
- Hosted audit uses scoped PostgreSQL chains and detailed log/audit reads no longer expose global records.

The remediation adds direct regressions for the prior evidence-promotion, contradiction, readiness, state-version, tenant-scope, Python-authority, and audit defects. It does not close the remaining P1/P2 register.

## Azure security gates

The selected design and phased runbook are in [docs/AZURE_MIGRATION_PLAN.md](docs/AZURE_MIGRATION_PLAN.md). Security approval for each phase requires:

### Before no-traffic compute shadow

- keep the remediated decision-integrity, tenant-scope, and log-route tests green; separately close the public active-probe and fail-open auth findings;
- use synthetic data only and route no user/pilot traffic until immutable audit export/business coupling and remaining security gates close;
- fail-closed runtime config and passive liveness/readiness;
- immutable/pinned container, non-root execution, OIDC deployment;
- outbound Compass/parser destinations approved and allowlisted;
- sanitized OpenTelemetry attributes tested.

### Before state migration

- close the remaining FastAPI-auth P0 and verify the two remediated P0s in CI/live before any user or pilot traffic;
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

1. Deploy/verify the protected/scoped log and memory fixes; protect active probes and make FastAPI/JWT configuration fail closed.
2. Add memberships/RLS and extend actor-derived hostile-scope coverage to every resource.
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

**Single trusted pilot:** not approved until P42-SEC-002, immutable review-pack integrity, Entra/membership scope, deployed workflow verification, immutable audit export/business coupling, and resource-admission controls are closed.

**Multi-tenant/enterprise or Azure production:** not approved until identity/membership/RLS, immutable tenant-audit export and business coupling, retention/erasure, resource admission, supply chain, and Azure phase gates above are verified.
