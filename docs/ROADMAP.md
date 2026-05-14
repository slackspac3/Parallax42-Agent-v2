# Work-Backward Roadmap

This roadmap starts from the submission end state and works backward into implementation milestones. The sequencing is designed to maximize reviewer proof first, then deepen production hardening.

## Submission End State

By submission time, the repo should support this story:

```text
A reviewer opens the live cockpit, runs the golden AI SaaS compliance case, sees evidence-backed gaps, inspects the agent trace, confirms human approval controls, exports the audit pack, and sees benchmark/RAI/security evidence tied to a deployed API.
```

## Milestone 0: Golden Demo Spine

Status: implemented in this roadmap pass.

Deliverables:

- `GET /api/demo/golden`
- `lib/goldenWorkflow.js`
- `evidence/golden-demo-run.json`
- golden workflow unit test
- cockpit link to the golden replay JSON
- documentation in `docs/GOLDEN_DEMO_WORKFLOW.md`

Acceptance:

- decision is `not_ready`
- at least three high-severity gaps are named
- privacy, AI governance, and continuity domains are applicable
- human approval required check passes
- automatic approval prevention check passes
- trace includes intake, domain scan, evidence mapping, control recommendation, and output review

## Milestone 1: CrewAI Flow Runtime

Goal: make CrewAI the primary orchestration path while keeping deterministic fallback for demos and CI.

Build:

- `crewai_adapter/flow.py` or equivalent Flow wrapper
- typed state model for case, evidence, domains, gaps, controls, decision, trace
- crew handoff from orchestrator to specialist agents
- memory scope for reusable policy/control facts
- API mode switch: deterministic, CrewAI dry-run, CrewAI live
- trace normalization so CrewAI and deterministic runs emit the same UI contract

Acceptance:

- `npm run check:crewai` remains dependency-light
- optional live CrewAI run works when secrets are present
- golden case produces the same acceptance status as deterministic replay
- missing secrets degrade to deterministic fallback with explicit mode label

## Milestone 2: Evidence Intake And Citation Discipline

Goal: move from summaries to real evidence handling.

Build:

- upload endpoint or reuse Parallax42 upload relay
- document metadata model
- extracted text summary with redaction
- evidence chunk IDs
- citation-required gap/control output
- evidence status transitions: supplied, missing, stale, contradictory, accepted

Acceptance:

- uploaded DPA evidence can clear the DPA blocker
- uploaded model-training exclusion can clear the AI governance blocker
- uploaded BCP/DR evidence can clear the continuity blocker
- unsupported recommendations fail output review

## Milestone 3: Durable Audit And RBAC

Goal: make the agent enterprise-operable.

Build:

- SQLite local audit prototype
- PostgreSQL-ready schema and migration
- append-only audit events
- run retrieval endpoint
- role policy middleware
- Entra JWT validation design and optional implementation switch

Acceptance:

- every agent run has a durable run ID
- audit records include actor, role, case, evidence IDs, decision, gaps, controls, trace count, model mode
- reviewer cannot approve without approver role
- auditor can read but not mutate

## Milestone 4: Evals, Guardrails, And Observability

Goal: prove quality and safety systematically.

Build:

- golden regression dataset
- adversarial prompt-injection dataset
- unsupported-approval grader
- missing-evidence grader
- citation precision grader
- trace grading export
- OpenTelemetry GenAI-compatible span naming
- benchmark trend artifact

Acceptance:

- deterministic golden suite stays above 95%
- no automatic approval outputs pass
- prompt injection cannot override human approval or missing evidence controls
- trace grading produces machine-readable pass/fail results
- latency and fallback rate are exported

## Milestone 5: Enterprise Integrations

Goal: show the agent fits real enterprise workflows.

Build:

- ServiceNow GRC case contract
- Coupa supplier onboarding contract
- SharePoint policy register ingestion contract
- Dynamics project compliance contract
- SAP/Ariba/Oracle/Workday supplier master sync contract
- MCP-compatible tool descriptors for read-only integrations

Acceptance:

- each example payload maps into the agent case model
- tool descriptions are allowlisted and read-only by default
- write-capable actions require explicit human confirmation

## Milestone 6: Demo Recording And Submission Freeze

Goal: package the proof.

Build:

- record "Watch the Agent Work"
- refresh `npm run capture:evidence`
- export screenshots
- freeze README links
- write final submission note

Acceptance:

- live cockpit works
- Vercel API works
- evidence artifacts are current
- CI and Pages workflows are green
- submission packet has no unsupported production claims

## Priority Rule

When choosing work, prefer changes that improve at least one of:

- reviewer demo clarity
- evidence quality
- safety posture
- production deployability
- measurable evaluation

Avoid building generic AI features that do not strengthen the submission proof.
