# Golden Demo Workflow

The golden demo is the canonical path for the G42 submission. It is intentionally high-risk enough to prove the agent can say no, name gaps, require evidence, and preserve human approval.

The judge-facing walkthrough is online-first: GitHub Pages cockpit -> Vercel product APIs -> isolated Railway Postgres/Qdrant, with optional Compass server-side capabilities. The root FastAPI/Docker path remains the evaluator reproduction surface for `run.py` and `POST /run`.

## Replay Endpoint

```text
GET /api/demo/golden
```

The endpoint returns:

- workflow metadata
- sample input case
- agent run output
- evidence checklist
- acceptance status

## Evidence Artifact

Run:

```bash
npm run capture:evidence
```

Generated artifact:

```text
evidence/golden-demo-run.json
```

## Demo Scenario

An internal team wants to procure a critical AI SaaS supplier that:

- processes personal data
- integrates with Azure AD
- connects to ServiceNow
- supports finance reporting in the UAE
- has a SOC 2 summary
- does not provide a signed DPA
- does not provide model-training exclusion terms
- does not provide continuity or exit evidence

## Required Agent Behavior

The agent must:

1. Normalize the case.
2. Scan compliance domains.
3. Map evidence IDs.
4. Name blocking gaps.
5. Recommend controls and remediation.
6. Refuse automatic approval.
7. Preserve human approval.
8. Emit trace and audit-ready output.

## Acceptance Criteria

| Criterion | Expected |
| --- | --- |
| Decision | `not_ready` |
| High-severity gaps | At least 3 |
| Applicable domains | Privacy, AI governance, business continuity |
| Human approval | Required |
| Automatic approval | Blocked |
| Trace | Intake, domain scan, evidence map, control plan, output review |

## What This Proves

- The agent does not rubber-stamp high-risk requests.
- The agent ties decisions to evidence and named gaps.
- The agent can be evaluated repeatedly.
- The same path can power the video, benchmark, evidence pack, and regression suite.
- Compass, Qdrant retrieval, governed learning memory, and optional CrewAI stay advisory; deterministic policy owns the final decision.
- The browser does not receive Compass keys, Qdrant keys, service tokens, or raw embeddings.

## Next Upgrade

The next implementation should increase measured live-eval coverage without changing the final authority boundary. Live CrewAI may be enabled only when dependencies, Compass credentials, and eval gates are configured; it remains advisory and must preserve the same API response contract.
