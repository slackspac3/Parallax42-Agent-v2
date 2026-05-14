# CrewAI Architecture

## Why CrewAI

CrewAI gives the submission a recognizable multi-agent orchestration layer for role-specific compliance work while the deterministic Node runtime keeps the demo fast and dependency-light.

The adapter follows the current CrewAI concepts of `Agent`, `Task`, `Crew`, and `Process.sequential`, with YAML-backed agent and task definitions.

Official CrewAI documentation referenced:

- https://docs.crewai.com/en/concepts/tasks
- https://docs.crewai.com/en/concepts/crews
- https://docs.crewai.com/en/introduction

## Crew Design

| CrewAI Agent | Responsibility |
| --- | --- |
| Compliance Orchestrator | Scope the work plan and checkpoints. |
| Regulatory Obligation Mapper | Map policies, obligations, and applicable domains. |
| Evidence Examiner | Validate support, missing artifacts, and evidence limits. |
| Risk And Control Analyst | Convert gaps into controls, blockers, and owners. |
| Responsible AI Reviewer | Check unsupported certainty, bias risk, and approval safety. |
| Audit Packager | Produce the final audit-ready brief. |

## Operating Modes

| Mode | Command | Purpose |
| --- | --- | --- |
| Dry run | `python3 crewai_adapter/compliance_crew.py --dry-run` | Validate crew shape without dependencies. |
| Live CrewAI | `python crewai_adapter/compliance_crew.py --live-crewai --input examples/high_risk_ai_saas_case.json` | Run the CrewAI crew when dependencies and LLM config are installed. |

## Guardrails

- CrewAI does not own final approval.
- CrewAI output must be packaged through output review.
- Secrets are never committed.
- CrewAI live mode is optional until an approved LLM provider configuration is available.
- The deterministic runtime remains the baseline for CI and local reproducibility.
