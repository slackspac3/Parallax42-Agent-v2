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
- Railway PostgreSQL and Qdrant are verified durable/active in the deployed product; local/FastAPI storage remains environment-dependent. Vercel audit JSONL remains nondurable in `/tmp`.
- Hosted advisory specialists are implemented in Node. Live Python CrewAI is optional and inactive.
- The hosted demo uses enforced demo authentication. Microsoft Entra tenant configuration, app roles, and enterprise SSO proof remain pending.

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

- Add persistent audit records. `Partially implemented: hash-chained JSONL; Vercel /tmp is nondurable and tenant scoping must be fixed`
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
- Critical evidence/readiness, cross-tenant memory, post-council versioning, audit exposure, and review-pack integrity findings in the deep review block production assurance claims.
- Demo authentication is enforced, but enterprise Entra SSO and durable tenant-scoped audit remain hardening items, not submitted claims.
- Arbitrary scanned-PDF OCR is not claimed; fixture PDFs and backend/parser relay paths are the safe demo scope.
- The parser relay is disabled in the verified production configuration; do not present it as active without a fresh approved-data-flow test.
- Broader live/adversarial/latency benchmarks remain score lifts rather than final-day feature work.
