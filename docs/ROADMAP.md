# Work-Backward Roadmap

This roadmap starts from the submission end state and works backward into implementation milestones. The sequencing is designed to maximize reviewer proof first, then deepen production hardening.

> **Current checkpoint (2026-07-12):** the hosted product uses the named Compass gateway client with GPT-5.1 and `text-embedding-3-large`, Railway Postgres, and Railway Qdrant. The local P0 remediation adds actor-scoped PostgreSQL audit chains, evidence assertion/contradiction rules, authoritative case versions, and Node-only policy authority; full local QA is green. Demo RBAC is enforced but Entra/membership/RLS and immutable audit export remain absent. CI/live verification is pending. Azure sequencing is tracked in the [Azure migration plan](AZURE_MIGRATION_PLAN.md).

## Submission End State

By submission time, the repo should support this story:

```text
A reviewer opens the primary Vercel working demo (or the GitHub Pages static mirror), uses Vercel product APIs backed by a named Compass gateway client plus isolated Railway Postgres/Qdrant semantic retrieval, runs a high-risk compliance case or fixture PDF, sees evidence-backed gaps, inspects the agent trace, confirms human approval controls, exports the audit pack, and sees Agentathon Docker `/run` proof in GitHub Actions.
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

## Milestone 1: Optional CrewAI Flow Runtime

Status: adapter and runtime metadata implemented; hosted Python CrewAI execution is currently inactive.

Goal: keep the Node policy engine as the sole decision authority while providing an optional Python CrewAI advisory path for future/live validation. The hosted product currently uses active Node specialists through the Compass gateway.

Build:

- `crewai_adapter/flow.py` or equivalent Flow wrapper. `Implemented: crewai_adapter/compliance_flow.py`
- typed state model for case, evidence, domains, gaps, controls, decision, trace. `Implemented as Flow state schema manifest`
- crew handoff from orchestrator to specialist agents. `Implemented through Flow stages mapped to YAML agents/tasks`
- memory scope for reusable policy/control facts. `Deferred to evidence/retrieval milestone`
- API mode switch: custom/deterministic, CrewAI dry-run, CrewAI live. `Implemented via AGENT_RUNTIME and X-Agent-Runtime/body runtime`
- trace normalization so CrewAI and deterministic runs emit the same UI contract. `Implemented via runtime_router trace event`

Acceptance:

- `npm run check:crewai` remains dependency-light. `Passed`
- optional live CrewAI Flow validation works when CrewAI is installed. `Available via --live-flow`
- optional live LLM specialist output is wired and guarded. `Available via AGENT_RUNTIME=crewai_llm and CREWAI_ENABLE_LIVE_LLM=1`
- golden case produces the same acceptance status as deterministic replay. `Passed`
- missing secrets/dependencies degrade to deterministic decision fallback with explicit mode label. `Passed`
- do not claim live CrewAI unless the optional runtime actually executes with configured credentials. `Submission boundary`

## Milestone 2: Evidence Intake And Citation Discipline

Goal: move from summaries to real evidence handling.

Status: assertion state/provenance, non-proof questions/mentions/policy references, source-aware contradictions, and focused adversarial tests are implemented. Claim-level source spans, immutable canonical documents, and broader groundedness evaluation remain.

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

Status: partially implemented. Railway Postgres stores case/session/quota records and the local remediation adds actor-scoped PostgreSQL audit chains with locked heads and fail-closed hosted writes. Demo RBAC is enforced. Entra/membership/RLS, WORM export, business/audit transaction coupling, and immutable run history remain incomplete.

Build:

- hash-chained audit. `Implemented: hosted PostgreSQL tenant/project chains; JSONL local/test fallback`
- PostgreSQL-backed generic record store for case, session, and quota state. `Implemented in hosted product; managed schema migrations remain open`
- application-append-only audit events. `Implemented; WORM export remains open`
- run retrieval endpoint. `Implemented: role-gated tenant-scoped /api/audit/recent with integrity report`
- role policy middleware. `Implemented`
- Entra JWT validation design and optional implementation switch. `Code exists; hosted demo enforcement is not Entra-backed`

Acceptance:

- every agent run has an immutable, durable run ID. `Open: current case persistence retains only the latest run; audit durability does not replace immutable run records`
- audit records include actor, role, case, evidence IDs, decision, gaps, trace count, model mode. `Implemented`
- reviewer cannot approve without approver role
- auditor can read but not mutate, and can see only authorized tenant records. `Implemented for detailed audit reads; retain hostile-scope tests`

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

## Milestone 5.5: Governed Knowledge Connector API

Goal: let Parallax42 plug in live reference sources without treating the model provider as the source of truth.

Build:

- connector registry for allowlisted sources such as case-law APIs, sanctions lists, export-control lists, regulatory guidance, procurement/debarment datasets, and internal policy registers
- source contract with URL, owner, license, schema version, refresh cadence, trust tier, parser version, and last successful sync
- bounded fetch/index endpoints with source hashes, timestamps, and correction history
- reviewer validation status before new or changed source records influence advisory reference memory
- supersession model for stale or corrected records instead of silent deletion
- citation-safe retrieval response that returns source metadata and snippets only, never raw embeddings or provider keys

Acceptance:

- a connector can refresh a small allowlisted source without broad crawling
- every imported record has source provenance, hash, timestamp, parser version, and reviewer status
- corrections are auditable and previous records remain inspectable
- unavailable or malformed sources produce structured errors and do not pollute reference memory
- live source updates remain advisory and cannot override deterministic policy, human review, or evidence requirements

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
- Agentathon Preflight workflow verifies Docker plus `/health` and `/run`
- online product evidence API shows Qdrant provider without exposing keys
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

Before additional feature milestones, close the P0 gates in the [deep code review](DEEP_CODE_REVIEW.md); migration work should follow the dependency order in the [Azure migration plan](AZURE_MIGRATION_PLAN.md).
