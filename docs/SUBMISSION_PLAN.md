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

- Vercel API project is live and linked to the GitHub Pages cockpit default relay URL.
- Security story now has RBAC/audit implementation, but still needs live Entra env configuration and durable audit retention before enterprise-grade claims.
- Benchmark story needs broader live, adversarial, upload/OCR, and latency tests.
