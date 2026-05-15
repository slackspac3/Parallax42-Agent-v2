# CrewAI Adapter

This adapter makes CrewAI Flow the primary orchestration shape for the Compliance Intelligence Agent while keeping the base Node demo runnable without Python dependencies.

## Agents

- Compliance Orchestrator
- Regulatory Obligation Mapper
- Evidence Examiner
- Risk And Control Analyst
- Responsible AI Reviewer
- Audit Packager

## Dry Run

Dry run validates the crew and Flow shape without importing CrewAI:

```bash
npm run check:crewai
```

## CrewAI Runtime

Install optional dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-crewai.txt
```

Then run:

```bash
python crewai_adapter/compliance_flow.py --live-flow --input examples/high_risk_ai_saas_case.json
python crewai_adapter/compliance_crew.py --live-crewai --input examples/high_risk_ai_saas_case.json
```

The live CrewAI path requires an LLM configuration supported by your CrewAI installation. The adapter intentionally does not commit model keys or provider secrets.

Run live specialist LLM calls only after configuring approved credentials:

```bash
export CREWAI_ENABLE_LIVE_LLM=1
export CREWAI_LLM_MODEL=gpt-5.1
export CREWAI_LLM_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
export CREWAI_LLM_API_KEY=$COMPASS_GATEWAY_TOKEN
python crewai_adapter/compliance_flow.py --live-llm --input examples/high_risk_ai_saas_case.json
```

The live LLM result is advisory analysis. The Node API still applies deterministic decision guardrails.

## API Runtime

The Node API defaults to the CrewAI Flow dry-run orchestration path:

```bash
AGENT_RUNTIME=crewai_flow npm run dev
```

Use deterministic fallback explicitly:

```bash
AGENT_RUNTIME=deterministic npm run dev
```
