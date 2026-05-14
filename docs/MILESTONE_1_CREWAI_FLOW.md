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
| `crewai_llm` | `AGENT_RUNTIME=crewai_llm` plus `CREWAI_ENABLE_LIVE_LLM=1` | Runs CrewAI specialist agents against a configured LLM and attaches their output as advisory analysis. |

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

## Live LLM Wiring

Live LLM calls are implemented but disabled by default. This prevents accidental spend, secrets leakage, or unauthorized provider use.

Required environment:

```text
CREWAI_ENABLE_LIVE_LLM=1
CREWAI_LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=...
```

Optional OpenAI-compatible endpoint:

```text
CREWAI_LLM_BASE_URL=https://api.your-provider.example/v1
CREWAI_LLM_API_KEY=...
```

When enabled, `crewai_adapter/compliance_flow.py --live-llm` creates CrewAI agents with a shared `LLM` instance and runs the YAML-backed tasks sequentially. The response includes:

```json
{
  "orchestration": {
    "liveLlm": {
      "requested": true,
      "enabled": true,
      "model": "gpt-4o-mini",
      "outputAvailable": true
    },
    "llmOutput": {
      "raw": "...",
      "json": {},
      "tasks": []
    }
  }
}
```

The live LLM output is advisory. It does not directly approve the case. The deterministic decision engine remains the final guardrail until Milestone 4 adds eval gates for live model output.

## Why This Matters

This moves the project beyond a deterministic demo:

- CrewAI Flow is the runtime spine.
- The six-agent CrewAI design maps into concrete Flow stages.
- CI and demos remain stable without optional Python dependencies.
- The same API contract works for deterministic, Flow dry-run, live Flow, and live LLM execution.
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
