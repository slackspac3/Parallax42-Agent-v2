# Submission Plan

> Current submission status, reviewed 2026-07-12. Earlier phase checklists below are retained as implementation history. Use the [deep code review](DEEP_CODE_REVIEW.md) for current blockers and the [Azure migration plan](AZURE_MIGRATION_PLAN.md) for future hosting.

## Package Required By G42 Role

- detailed agent profile
- technical architecture
- performance metrics and demonstration outcomes
- prior deployments and reference organizations where applicable
- resume of the agent and developer
- key differentiator features
- integration capabilities
- video demonstration
- Responsible AI and security evidence

## Work Plan

### Final Submission Status

- Online judge demo is primary: Vercel browser app and Node APIs -> isolated Railway PostgreSQL/Qdrant. GitHub Pages is a static mirror, not an API host.
- Evaluator reproduction path is present: root `run.py`, Dockerfile, FastAPI `/run` on port `8000`, metadata, examples, output examples, and logs.
- Multi-agent collaboration is visible in JSONL traces and the architecture docs.
- A named shared-Compass client is active server-side for smart intake, Node advisory specialists, and semantic embeddings; browser clients do not receive provider keys. Deterministic fallback is reported when live output cannot be used.
- Railway PostgreSQL and Qdrant are durable/active in the verified deployment; the remediation stores tenant/project audit chains in Postgres and fails hosted writes closed without it. WORM export remains absent and is not a submission claim.
- Hosted advisory specialists are implemented in Node. Live Python CrewAI is optional and inactive.
- The hosted demo uses enforced demo authentication. Microsoft Entra tenant configuration, app roles, and enterprise SSO proof remain pending.
- Release proof for implementation `457c7c2`: full `npm run qa` passed with 276/276 Node tests and 13/13 Python security tests; CI, Agentathon Preflight, and Pages are green; <https://parallax42-agent-v2.vercel.app/> passed an authenticated real-browser flow covering real upload, Qdrant, Compass, Council, an authoritative post-council rerun, and an HTTP `200` case narrative.

### Historical Phase 1: Clean Repo And Runnable Agent

- Create repo.
- Add local agent service and cockpit.
- Add initial dossier docs.
- Add tests and CI.

### Historical Phase 2: Extract Parallax42 Production Evidence

- Add live endpoint status capture. `Implemented: npm run capture:evidence`
- Add Parallax42 architecture appendix.
- Add golden eval output and trace samples. `Implemented locally: evidence/sample-agent-run.json`
- Add demo script for supplier AI SaaS compliance case.

### Historical Phase 3: Harden Submission Criteria

- Add persistent audit records. `Implemented foundation: actor-scoped PostgreSQL hash chains, role/scoped reads, public logs removed; WORM export/business coupling still open`
- Add Entra/RBAC implementation or scoped proof. `Partially implemented: route policy and JWT validation exist; live Entra tenant/app-role proof remains`
- Add benchmark report generator. `Implemented: npm run benchmark`
- Add Responsible AI evals.
- Add integration payload examples. `Implemented: examples/integrations`

### Historical Phase 4: Demo

- Record "Watch the Agent Work":
  1. intake
  2. evidence upload
  3. domain scan
  4. blind-spot/gap challenge
  5. revised recommendation
  6. audit trace
  7. human approval gate

## Current Open Risks

- Demo video still needs to be recorded and linked before final submission.
- The named Compass gateway and semantic retrieval are active in the current product path; keep a credential-safe live smoke and deterministic-fallback test in release evidence.
- Evidence/readiness, learning/governance scope, post-council versioning, Node/Python authority, and audit exposure/durability P0s pass local QA, CI, and the authenticated production workflow. Review-pack integrity remains open.
- Demo authentication is enforced, but enterprise Entra/membership/RLS and immutable audit export/business coupling remain hardening items, not submitted claims.
- Arbitrary scanned-PDF OCR is not claimed; fixture PDFs and backend/parser relay paths are the safe demo scope.
- The parser relay is disabled in the verified production configuration; do not present it as active without a fresh approved-data-flow test.
- Broader live/adversarial/latency benchmarks remain score lifts rather than final-day feature work.
