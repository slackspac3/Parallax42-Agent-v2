# CrewAI Architecture

> **Current state (2026-07-12):** Python CrewAI is optional and inactive in the hosted product. The Vercel product uses Node specialists through the named Compass gateway client with GPT-5.1; `text-embedding-3-large` powers semantic retrieval. A configured/runtime label such as `crewai_llm` is not proof that Python CrewAI executed. Node is the sole decision authority; FastAPI/Python preserves its policy fields and adds advisory output only. Full local QA is green; CI/live verification is pending. CrewAI is not required for the selected [Azure migration path](AZURE_MIGRATION_PLAN.md).

## Why CrewAI

CrewAI provides an optional Python orchestration adapter for role-specific compliance work while the Node policy engine and active Node specialists keep the hosted demo dependency-light.

Final submission boundary: CrewAI is optional and advisory. The default judge-facing product demo and Agentathon `/run` path do not require live CrewAI. Do not claim live CrewAI unless `AGENT_RUNTIME=crewai_live` / `CREWAI_ENABLE_LIVE_LLM=1` or the Vercel remote CrewAI service path has actually executed successfully.

The optional adapter follows a CrewAI Flow-first pattern:

- `Flow` state machine as the primary runtime shape
- `@start` / `@listen` stage model for orchestration
- YAML-backed `Agent` and `Task` definitions for specialist work
- deterministic fallback for CI, demos, and missing optional dependencies
- normalized trace output so CrewAI and deterministic paths share the same API contract
- opt-in live LLM calls for specialist analysis, gated by `CREWAI_ENABLE_LIVE_LLM=1`
- deterministic final ownership remains outside CrewAI

Official CrewAI documentation referenced:

- https://docs.crewai.com/en/concepts/flows
- https://docs.crewai.com/en/concepts/crews
- https://docs.crewai.com/en/concepts/tasks

## Crew Design

| CrewAI Agent | Responsibility |
| --- | --- |
| Compliance Orchestrator | Scope the work plan and checkpoints. |
| Regulatory Obligation Mapper | Map policies, obligations, and applicable domains. |
| Evidence Examiner | Validate support, missing artifacts, and evidence limits. |
| Risk And Control Analyst | Convert gaps into controls, blockers, and owners. |
| Responsible AI Reviewer | Check unsupported certainty, bias risk, and approval safety. |
| Audit Packager | Produce the final audit-ready brief. |

## Flow Design

| Flow Stage | CrewAI Agent | Trace Event |
| --- | --- | --- |
| `load_case` | Compliance Orchestrator | `case_loaded` |
| `map_obligations` | Regulatory Obligation Mapper | `domains_scanned` |
| `examine_evidence` | Evidence Examiner | `evidence_mapped` |
| `recommend_controls` | Risk And Control Analyst | `controls_recommended` |
| `review_responsible_ai` | Responsible AI Reviewer | `output_review_completed` |
| `package_audit_brief` | Audit Packager | `output_review_completed` |

## Operating Modes

| Mode | Command | Purpose |
| --- | --- | --- |
| Flow dry run | `python3 crewai_adapter/compliance_flow.py --dry-run` | Validate Flow state, stages, and crew mapping without dependencies. |
| Crew dry run | `python3 crewai_adapter/compliance_crew.py --dry-run` | Validate crew shape without dependencies. |
| Historical Flow-routing example | `AGENT_RUNTIME=crewai_flow` | Route `/api/agent/run` through CrewAI Flow dry-run orchestration plus the Node decision engine; this is not the verified hosted execution path. |
| Deterministic fallback | `AGENT_RUNTIME=deterministic` | Run the stable local decision engine directly. |
| Live Flow validation | `python crewai_adapter/compliance_flow.py --live-flow --input examples/high_risk_ai_saas_case.json` | Execute the Flow state machine when CrewAI is installed. |
| Live LLM specialists | `CREWAI_ENABLE_LIVE_LLM=1 AGENT_RUNTIME=crewai_llm npm run dev` | Run CrewAI agents against a configured LLM and attach advisory task output. |
| Live CrewAI | `python crewai_adapter/compliance_crew.py --live-crewai --input examples/high_risk_ai_saas_case.json` | Run the CrewAI crew when dependencies and LLM config are installed. |

## Guardrails

- CrewAI does not own final approval.
- CrewAI output must be packaged through output review.
- Secrets are never committed.
- CrewAI live mode is optional until an approved LLM provider configuration is available.
- The deterministic decision engine remains the baseline for CI and local reproducibility.
- Runtime metadata is included in API output and audit payloads.
- Live LLM specialist output remains advisory; the wrapper parity check compares decision, risk, gaps, controls, readiness, and approval eligibility with direct Node output.
- Compass, Qdrant retrieval, learning memory, and CrewAI provide advisory context; deterministic Node policy is the final decision owner.
- Python orchestration or response normalization must not overwrite the Node policy result. Runtime metadata must distinguish requested, attempted, and actually executed adapters.
