# CrewAI Adapter

This adapter makes CrewAI a first-class orchestration option for the Compliance Intelligence Agent while keeping the base Node demo runnable without Python dependencies.

## Agents

- Compliance Orchestrator
- Regulatory Obligation Mapper
- Evidence Examiner
- Risk And Control Analyst
- Responsible AI Reviewer
- Audit Packager

## Dry Run

Dry run validates the crew shape without importing CrewAI:

```bash
python3 crewai_adapter/compliance_crew.py --dry-run
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
python crewai_adapter/compliance_crew.py --live-crewai --input examples/high_risk_ai_saas_case.json
```

The live CrewAI path requires an LLM configuration supported by your CrewAI installation. The adapter intentionally does not commit model keys or provider secrets.
