# Golden Demo Workflow

> Current demo contract, reviewed 2026-07-12. It is a regression target, not evidence that every decision path is safe. See the [deep code review](DEEP_CODE_REVIEW.md) and the separate [Azure migration plan](AZURE_MIGRATION_PLAN.md).

The golden demo is the canonical path for the G42 submission. It is intentionally high-risk enough to prove the agent can say no, name gaps, require evidence, and preserve human approval.

The judge-facing walkthrough is online-first: Vercel browser app and Node APIs -> isolated Railway PostgreSQL/Qdrant, with a named client of the shared Compass gateway for smart intake, Node advisory specialists, and semantic embeddings. Deterministic fallback remains available when advisory output cannot be used. The root FastAPI/Docker path remains a local/CI evaluator reproduction surface for `run.py` and `POST /run`; no public Railway evaluator is claimed.

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
- integrates with Microsoft Entra ID (formerly Azure AD)
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
| Decision | `not_ready`; fail the regression if this changes without an approved policy update |
| High-severity gaps | At least 3 |
| Applicable domains | Privacy, AI governance, business continuity |
| Human approval | Required |
| Automatic approval | Blocked |
| Trace | Intake, domain scan, evidence map, control plan, output review |

## What This Proves

- This fixture is expected not to rubber-stamp the high-risk request. Dedicated regressions—not this single fixture—cover hostile evidence questions/mentions, forged documents, contradiction and negation variants, approval eligibility, tenant scope, and version recovery.
- The agent ties decisions to evidence and named gaps.
- The agent can be evaluated repeatedly.
- The same path can power the video, benchmark, evidence pack, and regression suite.
- The hosted path uses Node specialist calls through Compass and semantic Qdrant retrieval; deterministic Node policy is the implemented final decision authority.
- Python CrewAI is optional and inactive in the hosted demo.
- The browser does not receive Compass keys, Qdrant keys, service tokens, or raw embeddings.

## Next Upgrade

Keep the implemented adversarial, tenant-isolation, failure-recovery, bridge-parity, and two-council regressions green. Next verify the authenticated deployed two-council flow and close the residual P1 gates, including immutable review-pack input, identity/membership/RLS, WORM audit export/business coupling, and admission controls. Python CrewAI may be enabled only after dependency, credential, parity, and eval gates pass; it remains advisory and must preserve the same API response contract.
