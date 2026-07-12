# Parallax42 Agent v2 — Deep Code Review

**Review date:** 2026-07-12

**Reviewed revision:** `a98556c` (`main`)

**Scope:** product architecture, agent behavior, policy logic, evidence handling, tenant isolation, security, reliability, performance, code quality, testing, accessibility, UI/UX, deployment, and operations.
**Status:** current review and improvement backlog. This report records findings; it does not claim that the open findings have been remediated.

## Executive verdict

Parallax42 Agent v2 is a credible and unusually complete demo foundation. It has real server-side model access, semantic retrieval, durable case/session state, explicit human review, broad deterministic tests, and a polished workflow. It is not yet safe to describe as an evidence-grounded or tenant-safe compliance decision system.

Seven release blockers affect the truthfulness or integrity of a real user test:

1. A question or generic sentence mentioning evidence can become the evidence that makes a case approval-ready.
2. One negated phrase can suppress an entire risk domain even when stronger text contradicts it.
3. One medium gap can produce both `blockingGaps: 1` and a `ready`/approval-eligible decision.
4. The conversation enrichment path can retrieve another authenticated workspace's learning memory.
5. A council run returns a stale draft version, so the next interaction can fail with `409 stale_case_version`.
6. The Python evaluator can override the supposedly authoritative Node policy decision.
7. Audit reads are not tenant-scoped; `/api/logs` is public, and Vercel audit storage is instance-local `/tmp`.

The live Compass service is not the root cause of these defects. A production probe on the reviewed deployment reported an authenticated named client, GPT-5.1 chat, `text-embedding-3-large` embeddings, active semantic retrieval, durable PostgreSQL and Qdrant, and enforced demo authentication. The highest-risk failures occur after or around those integrations—in evidence classification, state authority, tenancy, and presentation.

**Release recommendation:** keep the site available as a clearly labeled demo, but do not use approval status or exported review packs for a real compliance decision until P0 acceptance gates are met. Do not onboard multiple real customer workspaces until tenant isolation and audit scoping are fixed.

## Verified current state

| Area | Verified state on 2026-07-12 |
|---|---|
| Product | Static vanilla JavaScript cockpit with Node/CommonJS product APIs on Vercel |
| Live AI | Shared Compass gateway, named client token, GPT-5.1 chat, `text-embedding-3-large` |
| Policy owner | Node deterministic engine in the main product path; Python can currently reinterpret it in the evaluator path |
| Advisory runtime | Node gateway specialists active; Python CrewAI unavailable/optional in the probed deployment |
| Business persistence | PostgreSQL active and durable for records such as sessions, cases, and quotas |
| Retrieval | Qdrant active and durable; semantic embeddings active; deterministic embeddings are a fallback |
| Authentication | Demo/session authorization enforced; enterprise Entra identity is not implemented |
| Parser relay | Disabled in the probed production deployment; the code path still needs hardening before enablement |
| Audit | Hash-chained local JSONL; Vercel provider reports `local_tmp`, `durable: false`, `enterpriseReady: false` |
| GitHub | Latest CI, Pages, and preflight runs green; `main` has no branch protection |
| Tests | 240/240 Node tests and 11/11 Python security tests pass; `npm audit` reports zero known vulnerabilities |

This state is a point-in-time observation, not a permanent service guarantee. Environment-specific capability labels should always come from the server response for the current interaction.

## Method

The review combined:

- full repository inventory and line-level inspection of product, evaluator, UI, deployment, workflows, and documentation;
- adversarial execution of the deterministic policy and conversation paths;
- an authenticated cross-workspace retrieval reproduction;
- production-safe status and anonymous endpoint probes;
- Node and Python test execution, experimental coverage, dependency audit, and secret-pattern review;
- accessibility and interaction review against the current Web Interface Guidelines;
- comparison of Vercel, GitHub Actions, Pages, PostgreSQL, Qdrant, Compass, and planned Azure boundaries;
- a duplication/YAGNI pass to identify code that can be removed rather than abstracted further.

No destructive production mutations were made. The production probe used an ephemeral demo session and did not print credentials.

## Severity model

- **P0 — release blocker:** can create a materially false decision, cross a tenant boundary, break the primary test flow, or expose compliance data.
- **P1 — high:** can undermine decision provenance, authorization, artifact integrity, reliability, or operational cost under realistic use.
- **P2 — medium:** important maintainability, resilience, accessibility, or performance debt.
- **P3 — low:** hygiene or simplification work with limited immediate user impact.

## P0 findings

### P42-REV-001 — Evidence questions and mentions become proof

**Evidence**

- `lib/conversationState.js:379-382`, `796-802`, and `1202-1214`
- `lib/complianceAgent.js:115-117`, `267-273`, `423-486`, and `590-592`

The intake pipeline recognizes evidence-flavored words without reliably distinguishing a question, denial, placeholder, request, policy reference, or uploaded/parsed proof. Static domain-library identifiers can also be returned as evidence IDs even when those references were never retrieved as case evidence.

**Reproduced behavior**

> Review a UAE vendor. The owner is Operations. Is SOC 2 evidence available?

The question produced a `CHAT-01` evidence record, `evidenceQuality.usable: true`, no evidence gaps, and “Ready for human approval.” A long placeholder explicitly providing no control proof also became usable evidence.

**Impact:** the core evidence-grounded claim is false for common conversational phrasing, and the UI presents that false confidence prominently.

**Required change:** model evidence assertions with explicit states such as `mentioned`, `requested`, `provided`, `parsed`, and `verified`; retain source spans and provenance; require control-level entailment before satisfying a requirement; keep policy references separate from customer evidence.

**Acceptance gate:** interrogative, negative, speculative, unavailable-document, placeholder, and policy-reference-only fixtures never satisfy a control. Only a server-retrieved or uploaded passage with provenance can do so.

### P42-REV-002 — Global negation suppresses contradictory risk

**Evidence:** `lib/evidenceLibrary.js:126-143` and `158-205` flatten the case into one string and use broad phrase checks.

**Reproduced behavior**

- “Vendor says no AI, but terms permit model training and automated decisions using customer data” suppresses the AI domain.
- “Vendor says no personal data, but the DPA states it processes PII” suppresses privacy.
- “Not critical, but it operates critical payment processing and has no continuity plan” suppresses business continuity.

**Impact:** an untrusted supplier assertion can neutralize a stronger or more authoritative contradiction and make a case appear ready.

**Required change:** retain statement and source identity, assign source authority, represent contradictions explicitly, and make unresolved material contradictions blocking.

**Acceptance gate:** the three adversarial examples above produce explicit contradictions and cannot return `ready` until a human resolves them.

### P42-REV-003 — One medium gap produces inconsistent approval readiness

**Evidence:** `lib/complianceAgent.js:379-411` treats one medium gap as ready, while `lib/complianceAgent.js:489-504` counts all gaps as blocking.

**Impact:** a response can simultaneously say `blockingGaps: 1`, `approvalEligible: true`, and “No blocking gaps.” Consumers cannot know which field is authoritative.

**Required change:** define one canonical decision table and derive status, rationale, blocking count, approval eligibility, and UI actions from that single result.

**Acceptance gate:** every gap combination passes a table-driven invariant test; an unresolved medium applicability gap is at least conditional, never unconditional ready.

### P42-REV-004 — Authenticated cross-workspace learning-memory retrieval

**Evidence**

- `lib/httpHandlers.js:181-190`
- `lib/serverSideRetrieval.js:178-191`
- `lib/learningMemory.js:117-133`, `253-265`, and `302-317`

Evidence retrieval passes the authenticated actor, but conversation learning enrichment creates a namespace from request/draft workspace and project values and calls the learning layer without actor enforcement. Direct learning routes correctly override those values, showing the intended pattern. Governance enrichment at `lib/serverSideRetrieval.js:130-138` has the same trust-boundary smell.

**Confirmed reproduction:** an authenticated actor supplied a victim workspace identifier and received a seeded confidential reviewer note, outcome, and missing-evidence information from that workspace.

**Impact:** cross-tenant disclosure of reviewer feedback and decision memory.

**Required change:** derive organization/workspace/project exactly once from the authenticated actor in the retrieval layer. Never accept tenant scope from a draft or request body. Apply the same rule to evidence, governance, learning, audit, exports, and cases.

**Acceptance gate:** malicious-workspace tests cover every read and write path; database policies or equivalent server-enforced membership checks prevent cross-tenant access independently of UI input.

### P42-REV-005 — Council completion leaves the next interaction stale

**Evidence**

- `lib/httpHandlers.js:191-205`
- `public/app.js:2679-2712`

The handler saves a pre-run draft version, council begin/complete increments it again, and only `result.run.caseVersion` receives the final value. The client ignores that field and merges the stale pre-run draft into local state.

**Reproduction:** a case moved from v1 to draft v2 and stored council v4; the following chat turn used v2 and failed with `409 stale_case_version`.

**Impact:** the advertised “interact, run council, continue testing” demo path is not reliable.

**Required change:** return one authoritative final case snapshot after council completion. The browser must replace, not reconstruct, server version state.

**Acceptance gate:** a deployed E2E test completes intake → council → follow-up chat → second council without reload or version conflict.

### P42-REV-006 — Python can override the authoritative Node decision

**Evidence**

- `app/node_bridge.py:39-118`
- `app/agentathon_orchestrator.py:150-166`, `1219-1257`, and `1491-1504`

Python spawns Node for a result and then recomputes the decision. An advisory precedent can change `reject_or_escalate` into `reject`, despite documentation describing precedent as advisory.

**Impact:** decision semantics depend on runtime/route, and an advisory subsystem silently becomes a policy authority.

**Required change:** choose one decision owner. The simplest boundary is Node for policy/cases/evidence, with Python limited to specialist or evaluation output that cannot alter the decision.

**Acceptance gate:** parity fixtures across Node, FastAPI, dry-run, fallback, and live modes have identical immutable policy fields and hashes.

### P42-REV-007 — Audit is global, partly public, and nondurable

**Evidence**

- `lib/auditStore.js:81-95` and `112-136` omit tenant dimensions and expose a global tail.
- `api/audit/recent.js:15-19` does not tenant-filter reads.
- `api/logs.js:6-18` has no authentication and can return full entries.
- `vercel.json` exposes `/logs`.
- `app/main.py:186-197` exposes unauthenticated log filenames.

The production `/api/logs` endpoint returned HTTP 200 with public caching. At the moment of review it contained zero entries and reported `local_tmp`, but entries are instance-local and can appear on a different function instance.

**Impact:** potential cross-tenant metadata disclosure, misleading audit completeness, and loss of audit history during scaling/redeployment.

**Required change:** store workspace/project/actor dimensions with every event, require `audit:read`, tenant-filter by default, reserve cross-tenant access for platform administrators, remove public caching, and move the ledger to transactional durable storage with immutable retention exports.

**Acceptance gate:** public log routes expose only a deliberately minimal aggregate or return 401/403; tenant A cannot read tenant B; multi-replica append order and hash integrity survive redeploy and restore.

## P1 findings

| ID | Finding and evidence | Impact | Minimum practical remediation |
|---|---|---|---|
| P42-REV-008 | Model-derived fields alter policy at confidence as low as 0.35 (`lib/conversationLlmAssessor.js:1464-1516`; `lib/complianceAgent.js:231-240`). | Ungrounded model suggestions can satisfy deterministic requirements. | Require a trusted source span/document ID per accepted fact; keep ungrounded output advisory. |
| P42-REV-009 | Conditional approval becomes terminal `APPROVED` (`public/app.js:4876-4877`, `5860-5901`; `lib/caseApproval.js:18-24`, `80-104`). | Conditions lose owners, due dates, expiry, and enforcement. | Block approval until resolved, or add a structured `APPROVED_WITH_CONDITIONS` state. |
| P42-REV-010 | Review-pack export trusts an arbitrary client-supplied run (`lib/httpHandlers.js:289-307`; `lib/reviewPack.js:212-220`). | Authorized users can mint branded PDFs containing fabricated decisions and citations. | Accept only case/run/version identifiers; load and hash an immutable server run; watermark unverified/demo output. |
| P42-REV-011 | Request `options.sample_mode` bypasses live dependencies and `REQUIRE_COMPASS` (`app/schemas.py:15-20`; orchestrator `121-123`, `479-493`, `1275-1390`). | A caller can make a supposedly live evaluation use fixtures. | Make sample mode server-environment-only or privileged and reject it in production. |
| P42-REV-012 | Clients control runtime selection (`lib/httpHandlers.js:81-83`, `114-130`, `188-201`; `api/_http.js:20`). | Callers can choose expensive or misleading execution paths with long timeouts. | Pin runtime server-side; allow a small admin-only development override; add operation budgets. |
| P42-REV-013 | Runtime/CrewAI labels describe planned or fallback work as executed (`lib/agentRuntime.js:39-72`, `106-129`, `248`, `281-314`, `337-405`; `lib/httpHandlers.js:161-168`). | Reviewers cannot tell what actually ran. | Emit requested/planned/attempted/executed/fallback status, call IDs, model, latency, and error per operation. |
| P42-REV-014 | Qdrant reindex does not remove stale points, validates existence only, mixes purposes/models, and has no minimum score (`lib/evidenceVectorStore.js:263-277`, `323-345`, `391-446`). | Stale or incompatible chunks can be promoted into evidence. | Version collections/index generations by purpose/provider/model/dimension, replace atomically, validate schema, and calibrate thresholds. |
| P42-REV-015 | Parser relay can send raw documents and the inbound bearer to an external default (`lib/runtimeConfig.js:65-69`; `api/_backendRelay.js:13-35`, `143-151`; `public/app.js:2289-2316`). | Data residency, token forwarding, and external processing risk when enabled. | Default off; require approved allowlisted service config and user notice; enforce upload capability; use a service/OBO credential. |
| P42-REV-016 | A single chat/council/export flow can amplify into many sequential model calls (`lib/conversationLlmAssessor.js:821-891`, `1222-1380`; `lib/advisoryCouncil.js:48-65`, `137-170`). | Cost, latency, cascading retries, and denial-of-wallet risk. | Combine structured facts and prose, allow one repair, enforce true deadlines/circuit breakers, and track distributed token/cost budgets. |
| P42-REV-017 | Only `lastRun` is persisted (`lib/caseLifecycle.js:285-304`); history lives in browser `sessionStorage` (`public/app.js:2499-2604`). | No immutable review history or reliable artifact provenance. | Add append-only case runs and reviewer decisions with versions, hashes, and supersession links. |
| P42-REV-018 | Conversation facts are permanently unioned and the brief keeps the first 2,400 characters (`lib/conversationState.js:1263-1280`). | Corrections cannot reliably retract old facts; newer facts are eventually dropped. | Store sourced assertions/events with active, retracted, and superseded states; derive a bounded current summary. |
| P42-REV-019 | Flags, rate limits, and audit are per-process or `/tmp`; health performs expensive checks (`lib/adminFeatureFlags.js:15-18`, `81-180`; `lib/rateLimiter.js:21`, `67-84`; `lib/auditStore.js:98-136`). | Replicas disagree and protection resets on cold start. | Use durable configuration/audit and distributed edge quotas; split cheap liveness from cached readiness. |
| P42-REV-020 | FastAPI has no meaningful body/concurrency admission control and spawns Node per request (`app/schemas.py:10-20`; `app/main.py:205-213`; `app/node_bridge.py:39-118`). | Resource exhaustion and very long request occupancy. | Enforce ingress/body/concurrency limits; use a queue for long work or call one persistent Node service. |
| P42-REV-021 | PostgreSQL tenant isolation is application-only; generic records use `(kind,id)` and runtime DDL (`lib/recordStore.js:43-60`, `108-190`). | Weak team membership model and no database defense in depth. | Add organizations/workspaces/memberships and versioned migrations; enforce tenant policies/RLS where practical. |

## Security and operational findings not already captured above

| ID | Priority | Finding | Recommendation |
|---|---:|---|---|
| P42-REV-022 | P1 | FastAPI auth defaults to audit unless explicitly configured (`app/auth.py:48-50`). | Fail closed in every production runtime; require issuer, audience, tenant, and role claims. |
| P42-REV-023 | P1 | FastAPI `/compass/probe` is public, performs a real model call, and uses synchronous HTTP work inside an async endpoint. | Admin-gate and cache it; make readiness probes cheap and non-billable. |
| P42-REV-024 | P1 | GitHub `main` has no branch protection; workflow actions are not pinned to commit SHAs. | Require PR/checks/review and pin third-party actions. |
| P42-REV-025 | P1 | GitHub Pages shares the `slackspac3.github.io` origin with every project owned by the account while the app can hold a session bearer and user-selected backend URL. | Prefer a unique custom origin/Vercel origin, allowlist every backend, and never place privileged tokens on the shared Pages origin. |
| P42-REV-026 | P1 | JWT audience, issuer, and tenant validation are optional in some configurations. | Production startup should fail if required claim constraints are missing. |
| P42-REV-027 | P2 | Vercel security headers lack a restrictive CSP and `frame-ancestors`; many UI sinks make defense in depth valuable. | Add a tested nonce/hash CSP and frame protection without weakening existing escape helpers. |
| P42-REV-028 | P2 | Python dependencies and container base are not immutably pinned; container runs as root and copies a broad context. | Lock hashes, pin base image digest, remove unused `openai`, use non-root, and narrow `COPY`. |
| P42-REV-029 | P2 | Records are filtered on expiry but not purged; pilot cases can have no expiry. | Add retention policies and scheduled deletion with audit evidence. |
| P42-REV-030 | P2 | Learning feedback can store arbitrary case/outcome data without verifying a real case/reviewer decision. | Bind feedback to an immutable run and authorized review to prevent memory poisoning. |

See [the current security assessment](../security_best_practices_report.md) for the security-focused register and threat chains.

## Reliability, performance, and maintainability

### State and concurrency

- No-op saves increment case versions (`lib/caseLifecycle.js:168-181`), increasing conflict frequency.
- Council, export, and evidence quotas are consumed before success (`lib/httpHandlers.js:38-49`, `256-258`, `289-297`), so failed/stale calls can exhaust a demo session.
- Local evidence, governance, and learning stores use synchronous read-modify-write without a shared lock. Reuse the small serialization pattern already present in `lib/recordStore.js`.
- `completeCouncil` stores the entire result JSON inside the mutable case. Large traces and output should move to immutable run records.
- Qdrant smoke checks can leave points in the configured collection. Use a dedicated smoke collection and delete test data.

### Model cost and latency

A normal chat makes structured and prose calls. Parsing can retry three times and recovery can make another prose call. A council can add four JavaScript specialists or six sequential CrewAI tasks, and review-pack narrative can add another call. With current demo quotas, one session permits roughly 52 normal calls and about 95–101 calls in retry-heavy failure scenarios, excluding embeddings.

The improvement is simplification, not another orchestration layer:

1. Return structured facts and user prose in one response schema.
2. Permit at most one bounded repair attempt.
3. Enforce an end-to-end deadline with abort propagation.
4. Record provider call count, tokens, latency, and budget consumption per user action.
5. Cache or reuse successful case analysis by immutable input hash.

### Code structure

`public/app.js` is 6,929 lines with roughly 90 DOM references and about 40 mutable globals. Split it into plain ES modules for API/session, chat state, evidence upload, council playback, approval, and export. A framework rewrite is not required.

The larger duplication is architectural:

- Node evidence storage and Python evidence memory implement the same responsibility.
- Node learning memory and Python learning memory overlap.
- Product and evaluator have separate CrewAI adapters.
- The Python orchestrator reinterprets the Node engine.

Keep Node as the product authority. Reduce Python to a CI evaluator or a narrow, non-authoritative specialist adapter. This removes drift and subprocess overhead without inventing a new shared framework.

## Agentification assessment

| Dimension | Current strength | Current weakness | Target |
|---|---|---|---|
| Goal decomposition | Intake, evidence, council, decision, review, and export are visible stages. | Runtime manifests can claim work that was simulated or fell back. | Trace only real operations and state why a step was skipped. |
| Tool use | Retrieval, parser relay, Compass, persistence, and export are bounded server tools. | Client can influence runtime/sample mode; parser can forward identity/data externally. | Server-owned allowlisted tool plan with per-tool authorization and budget. |
| Grounding | Server-side retrieval and citations exist. | Mentions/questions can become proof; model fields can satisfy policy without provenance. | Claim-level source span, retrieval ID, control mapping, and verification state. |
| Memory | Case, governance, evidence, and learning layers exist. | Learning tenant leak, poisoning risk, permanent fact union, no immutable run history. | Tenant-enforced episodic memory plus sourced assertions and immutable runs. |
| Determinism | A deterministic Node policy engine and fixtures provide repeatability. | Python and UI reinterpret its output; readiness invariants conflict. | One immutable decision object consumed unchanged by every channel. |
| Human oversight | Human approval is explicit and no direct auto-approval was found. | Conditional approval collapses to terminal approval; exports can be forged. | Structured conditions, reviewer identity, reason, expiry, and artifact hash. |
| Recovery | Fallbacks keep the demo usable. | Fallbacks are sometimes labeled as live success and can conceal dependency failure. | Honest degraded-state UX with retry, reason, and capability-level status. |
| Evaluation | Broad deterministic tests and benchmarks exist. | Few adversarial semantic/tenancy/parity tests; historical benchmark docs are mixed with current guidance. | Versioned eval corpus, invariant tests, groundedness/recall metrics, and dated evidence snapshots. |

## UI/UX and accessibility review

### What works

- Semantic labels, a skip link, real buttons, focus-visible styling, and reduced-motion handling are present.
- Tabs use roles, roving keyboard behavior, and Home/End navigation.
- Dynamic output is generally escaped before insertion.
- The chat composer is bounded, responsive layouts exist, and incremental rendering avoids full-page replacement.
- Agent stages, evidence, and human review are made legible rather than hidden behind a chat bubble.

### Improvements

1. **Truth before polish:** the right-side “Live Case Intelligence” panel confidently visualizes evidence/readiness produced by the P0 logic defects. Add `mentioned`, `unverified`, `contradicted`, and `verified` badges and never show approval readiness for unsupported proof.
2. **Make degraded AI explicit:** replace “Smart intake fallback” ambiguity with `Live model unavailable — deterministic intake used` plus timestamp, failed capability, and retry. Never imply Compass or CrewAI executed when it did not.
3. **Preserve the next action:** after council completion, show a single server-confirmed case state and keep follow-up chat usable; this is blocked by P42-REV-005.
4. **Do not clip missing proof:** `public/styles/22-desktop-app-shell-v7-stitch-inspired-operational-console.css:732-740` constrains the missing-proof list with hidden overflow. Provide expansion or scrolling and an accessible count.
5. **Increase small type:** several council/draft labels are 8–10px (`public/styles/22-desktop-app-shell-v7-stitch-inspired-operational-console.css:796-815`; `public/styles/23-desktop-chat-ux-tightening.css:281-309`). Use at least the design-system small-text token and validate 200% zoom.
6. **Reduce scroll competition:** the fixed `100svh` desktop shell creates multiple independently scrolling panes. Preserve context with one primary scroll owner at narrower/zoomed viewports.
7. **Secure configuration UX:** do not invite arbitrary relay/backend URLs beside a bearer token. Use server-provided allowlisted destinations and display the data-processing boundary.
8. **Explain approval conditions:** require reviewer-authored structured conditions rather than fixed boilerplate; show owner and due date in the case and PDF.
9. **Expose provenance near claims:** clicking a readiness fact should open the exact source passage, document, retrieval score, and verification status.
10. **Regression-test the supplied desktop state:** verify the live badge, top navigation, right rail, composer, and evidence controls at common widths, 200% zoom, keyboard-only, and high contrast.

## Test and quality assessment

### Results

- Node: **240/240 passing**.
- Python security: **11/11 passing**.
- npm dependency audit: **0 known vulnerabilities**.
- Experimental Node coverage: **89.13% lines, 68.44% branches, 91.92% functions**.

Important low-line-coverage modules include `councilNarrative` (12.57%), `evaluatorRun` (18.06%), `evidencePipeline` (22.58%), `recordStore` (57.55%), and `httpHandlers` (58.41%). API wrappers and the deployed browser/server integration are not fully represented by the unit aggregate.

### Missing high-value tests

1. Evidence interrogative/negation/speculation/unavailable-document table tests.
2. Contradictory source-authority and retraction tests.
3. Tenant A/B malicious scope tests for every store and audit/export route.
4. Intake → council → follow-up → second council deployed E2E.
5. Node/FastAPI/live/fallback decision parity fixtures.
6. Immutable review-pack load/hash/tamper tests.
7. Qdrant stale-delete, model/dimension mismatch, purpose isolation, and score-threshold tests.
8. Model call-count, abort/deadline, retry, and budget tests.
9. Multi-replica audit/flag/rate-limit behavior.
10. Keyboard, 200% zoom, high contrast, reduced motion, and long-content browser tests.

Python security tests are not currently part of the JavaScript QA/CI entry point. Both CI workflows also repeat much of the same full suite on each push. Run one reusable QA workflow and invoke it from the required checks.

## Simplification opportunities

The fastest route to a safer demo includes deletion:

| Opportunity | Approximate reduction | Condition |
|---|---:|---|
| Remove root and `docs/` static mirrors; keep `public/` as the deployment source | 33,082 lines / ~1.21 MB | Confirm all consumers use the Pages artifact or `public/`, then remove mirror scripts/checks. |
| Remove unloaded generated/reference CSS fragments `01`–`23` | 5,622 lines / ~133 KB | Confirm no external design tooling consumes `public/styles/manifest.json`; retain `styles.css` and loaded override `24`. |
| Remove the unused Python `openai` dependency | 1 dependency | Confirm no dynamic import in the evaluator image. |
| Deduplicate CI jobs | ~20–30 YAML lines plus compute | Preserve one required reusable QA job. |
| Reduce Python to a thin evaluator/specialist adapter | ~1,200–2,000 lines | First lock Node as the sole decision authority and add parity tests. |
| Keep one CrewAI adapter | ~300–500 lines | Retain only the runtime that is actually deployed/evaluated. |
| Collapse structured/prose/retry machinery | ~400–700 lines and about half normal chat calls | Introduce one validated response schema and one repair. |

`public/styles.css` is the primary hand-maintained runtime stylesheet and `24-working-demo-qa.css` is the loaded final override. `index.html` does not load fragments `01`–`23`, `scripts/build-css.js` does not consume them, and `manifest.json` identifies `public/styles.css` as their source. They can be removed after confirming no external design tooling depends on that reference split.

## Strengths to preserve

- Small Node production dependency footprint and no detected committed secrets.
- Server-side model calls; no direct browser Compass credential use found.
- PostgreSQL transactions, `FOR UPDATE`, and optimistic version checks in the record store.
- Actor-scoped evidence routes and demo tokens with randomized hashes, isolated workspaces, and quotas.
- Explicit human review and a deterministic policy layer.
- Bounded Node requests/uploads/chunks/timeouts and graceful fallbacks.
- Audit hashing/redaction, fixture canonicalization, runtime metadata, benchmarks, and E2E mock coverage.
- A thoughtful dark UI with strong keyboard/focus foundations and visible agent stages.

## Remediation plan and release gates

### Phase 0 — label and contain (1–2 days)

- Mark approval and exported artifacts as demo/unverified.
- Protect `/api/logs`, FastAPI logs/probes, and expensive diagnostics.
- Disable client runtime/sample overrides in production.
- Keep parser relay disabled.
- Protect `main` and pin workflow actions.

**Gate:** no anonymous sensitive/cost-bearing route; no production claim that all output is evidence-grounded.

### Phase 1 — restore decision integrity (3–7 days)

- Implement evidence assertion states and contradiction handling.
- Centralize the gap/decision table.
- Fix final council case-version authority.
- Make Node the sole decision owner.
- Correct conditional approval semantics.

**Gate:** adversarial evidence tests and the two-council E2E pass; every channel produces the same policy hash.

### Phase 2 — tenant and artifact integrity (1–2 weeks)

- Derive tenant scope from authenticated membership in every layer.
- Add immutable runs/reviews and server-loaded review packs.
- Move audit to a durable tenant-scoped ledger with immutable export.
- Add migrations, retention, and tenant defense in depth.

**Gate:** hostile A/B tests pass for every resource; forged/stale artifact attempts fail; restore preserves the audit chain.

### Phase 3 — retrieval and model economics (1–2 weeks)

- Version vector indexes and enforce score/model/purpose constraints.
- Add grounded source spans for accepted model facts.
- Collapse redundant model calls and enforce distributed budgets/deadlines.
- Move long parser/evaluator work behind an asynchronous boundary where needed.

**Gate:** retrieval regression corpus meets agreed precision/recall, all citations resolve, and load tests stay inside latency/cost budgets.

### Phase 4 — simplify and harden operations (1–2 weeks)

- Remove static/runtime duplication and unused dependencies.
- Split the frontend into plain modules.
- Add cheap `/livez` and strict cached `/readyz`.
- Consolidate CI and include Python security/browser accessibility tests.
- Start the Azure shadow migration described in [AZURE_MIGRATION_PLAN.md](AZURE_MIGRATION_PLAN.md).

**Gate:** an immutable build deploys through required checks, canary/smoke passes, and rollback/restore drills are documented.

## Definition of a working demo

The demo is ready for a true user test when all of the following are demonstrable on the deployed URL:

- every displayed evidence fact links to a real source and verification state;
- contradictory/negative/question phrasing cannot create an approval-ready case;
- a user can chat, upload, run council, continue chatting, rerun, approve/reject, and export without reload or stale conflict;
- model/runtime/fallback labels describe what actually executed for that interaction;
- tenant A cannot enumerate or retrieve tenant B through any identifier supplied by the browser;
- approval conditions are structured and remain nonterminal until resolved;
- the exported pack is loaded from an immutable server run and includes a verifiable hash/version;
- audit events survive deployment/restart and are tenant-scoped;
- keyboard, 200% zoom, long content, and common desktop/mobile layouts pass browser QA;
- CI protects `main` with the adversarial, parity, security, and deployed-flow tests above.

## Related documents

- [Security assessment](../security_best_practices_report.md)
- [Azure migration plan](AZURE_MIGRATION_PLAN.md)
- [Current architecture](../ARCHITECTURE.md)
- [Deployment runbook](DEPLOYMENT_RUNBOOK.md)
- [Documentation map](README.md)
