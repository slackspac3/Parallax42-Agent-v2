# Submission Plan

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

- Online judge demo is primary: GitHub Pages cockpit -> Vercel product APIs -> isolated Railway Postgres/Qdrant, with optional Compass server-side capabilities.
- Evaluator reproduction path is present: root `run.py`, Dockerfile, FastAPI `/run` on port `8000`, metadata, examples, output examples, and logs.
- Multi-agent collaboration is visible in JSONL traces and the architecture docs.
- Compass is used server-side; browser clients do not receive Compass keys. Direct `OPENAI_API_KEY` / `OPENAI_BASE_URL` diagnostics remain available for evaluator-style runs.
- Qdrant is verified active in the deployed product evidence API; local/FastAPI Qdrant remains env-dependent.
- CrewAI is optional/advisory and not the default runtime.
- RBAC is audit-mode unless enforced identity env vars are configured and verified.

### Phase 1: Clean Repo And Runnable Agent

- Create repo.
- Add local agent service and cockpit.
- Add initial dossier docs.
- Add tests and CI.

### Phase 2: Extract Parallax42 Production Evidence

- Add live endpoint status capture. `Implemented: npm run capture:evidence`
- Add Parallax42 architecture appendix.
- Add golden eval output and trace samples. `Implemented locally: evidence/sample-agent-run.json`
- Add demo script for supplier AI SaaS compliance case.

### Phase 3: Harden Submission Criteria

- Add persistent audit records. `Implemented: hash-chained JSONL; production must configure durable storage or DB retention`
- Add Entra/RBAC implementation or scoped proof. `Implemented: route policy and JWT validation; live tenant env remains`
- Add benchmark report generator. `Implemented: npm run benchmark`
- Add Responsible AI evals.
- Add integration payload examples. `Implemented: examples/integrations`

### Phase 4: Demo

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
- Direct Compass strict proof requires valid Compass credentials and should be tested with `python scripts/compass_doctor.py --strict` when available.
- Enforced RBAC and enterprise-durable audit remain hardening items, not submitted claims.
- Arbitrary scanned-PDF OCR is not claimed; fixture PDFs and backend/parser relay paths are the safe demo scope.
- Broader live/adversarial/latency benchmarks remain score lifts rather than final-day feature work.
