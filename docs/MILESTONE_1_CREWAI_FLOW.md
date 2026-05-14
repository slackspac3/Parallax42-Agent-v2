# Milestone 1: CrewAI Flow Runtime

## Status

Implemented.

The agent runtime now defaults to CrewAI Flow dry-run orchestration while preserving the deterministic decision engine as a stable fallback.

## What Changed

| Capability | Implementation |
| --- | --- |
| Flow adapter | `crewai_adapter/compliance_flow.py` |
| Runtime router | `lib/agentRuntime.js` |
| API integration | `POST /api/agent/run` uses `runAgentWithRuntime` |
| Health integration | `GET /api/health` exposes runtime readiness |
| Golden workflow | `GET /api/demo/golden` returns CrewAI Flow runtime metadata |
| UI visibility | Cockpit shows runtime in the decision band |
| Evidence | `evidence/sample-agent-run.json` and `evidence/golden-demo-run.json` include runtime/orchestration |
| Tests | `tests/unit/agentRuntime.test.js` |

## Runtime Modes

| Mode | How To Select | Behavior |
| --- | --- | --- |
| `crewai_flow` | default or `AGENT_RUNTIME=crewai_flow` | Flow dry-run orchestration plus deterministic decision engine. |
| `deterministic` | `AGENT_RUNTIME=deterministic` or request runtime | Direct deterministic decision engine. |
| `crewai_live` | `AGENT_RUNTIME=crewai_live` | Attempts live CrewAI Flow validation, then degrades explicitly if optional dependencies are unavailable. |

Per request:

```http
POST /api/agent/run
X-Agent-Runtime: crewai_flow
```

or:

```json
{
  "runtime": "deterministic",
  "brief": "..."
}
```

## Response Contract

Every agent run now includes:

```json
{
  "runtime": {
    "requestedRuntime": "crewai_flow",
    "actualRuntime": "crewai_flow_dry_run",
    "actualMode": "crewai_flow_dry_run",
    "manifestSource": "python_dry_run",
    "degraded": false
  },
  "orchestration": {
    "framework": "CrewAI Flow",
    "primaryRuntime": true,
    "humanApprovalRequired": true,
    "deterministicDecisionEngine": true
  }
}
```

The first trace event is `runtime_selected`, followed by the normal compliance trace.

## Why This Matters

This moves the project beyond a deterministic demo:

- CrewAI Flow is the runtime spine.
- The six-agent CrewAI design maps into concrete Flow stages.
- CI and demos remain stable without optional Python dependencies.
- The same API contract works for deterministic, Flow dry-run, and future live Flow execution.
- Runtime choice is auditable.

## Verification

```bash
npm run qa
npm run capture:evidence
```

Acceptance evidence:

- `tests/unit/agentRuntime.test.js`
- `evidence/golden-demo-run.json`
- `evidence/sample-agent-run.json`
- `GET /api/health`
- `GET /api/demo/golden`

## Remaining For Later

Live LLM-backed CrewAI specialist outputs are still optional. The next serious upgrade is evidence intake and citation discipline, then evals/guardrails that can grade live model output.
