# CrewAI Adapter

This is an optional Python CrewAI adapter. The hosted Vercel product currently uses Node advisory specialists through the named shared-Compass client with deterministic fallback; live Python CrewAI is inactive. See the [deep code review](../docs/DEEP_CODE_REVIEW.md) for runtime-parity findings and the [Azure migration plan](../docs/AZURE_MIGRATION_PLAN.md) for the future deployment boundary.

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

The live Python result is advisory analysis and must preserve the Node response contract. Do not enable it until Node/Python decision ownership, telemetry, tenant context, timeouts, and eval parity gates in the deep review are resolved.

## Hosted Node Runtime

The product runtime name `crewai_llm` selects the Node Compass advisory path in the hosted deployment; it is not proof that the Python CrewAI package ran:

```bash
AGENT_RUNTIME=crewai_llm npm run dev
```

Use deterministic mode explicitly for local fallback:

```bash
AGENT_RUNTIME=deterministic npm run dev
```

Enable the Python adapter only with `AGENT_RUNTIME=crewai_live` (or the adapter commands above), approved credentials, installed optional dependencies, and passing parity/evaluation gates. Record requested, attempted, actual, and fallback runtimes separately in evidence.
