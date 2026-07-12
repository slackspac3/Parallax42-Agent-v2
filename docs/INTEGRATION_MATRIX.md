# Integration Matrix

Current-state verification, implemented P0 remediations, and remaining defects are in the [deep code review](DEEP_CODE_REVIEW.md). The selected infrastructure transition is in the [Azure migration plan](AZURE_MIGRATION_PLAN.md).

| Integration | Current State | Target For Submission |
| --- | --- | --- |
| Vercel working demo | Primary browser app and product API handlers for health, readiness, benchmark, conversation, evidence, council, scoped audit, export, and relay. | Verify the authenticated upload -> council -> follow-up -> second council -> review/export workflow after deployment, not just `/api/health`. |
| GitHub Pages UI | Static mirror that calls the Vercel API; it does not host product or FastAPI routes. | Keep as rollback/submission mirror without privileged browser tokens. |
| Parallax42 backend / Ocean services | Parser/backend relay code is allowlisted, but the verified production feature flag is disabled. | Enable only after the data-flow and credential boundary is approved; it is not Compass or Agentathon FastAPI proof. |
| Agentathon FastAPI wrapper | Root `run.py` delegates policy to Node; Python preserves decision/risk/gaps/controls/readiness/eligibility and adds advisory output. `/logs` is role-gated, non-disclosing, and `private, no-store`. | Treat CI/Docker as the current proof. Add a public container only after the remaining fail-closed auth, probe, admission, and container findings are closed. |
| Compass gateway/API boundary | Hosted product uses the named Parallax42 gateway client for GPT-5.1 smart intake/advisory work and `text-embedding-3-large`; credentials remain server-side. | Keep health/status proof and explain that the browser receives no Compass keys. |
| Qdrant/vector memory | Hosted product uses isolated Railway Qdrant with live semantic embeddings. Deterministic hash vectors and local storage are fallback/reproduction modes. | Demonstrate Vercel `/api/evidence/index` and `/api/evidence/search` returning `provider=qdrant` and sanitized snippets. |
| OCR/document parsing | Product path can use backend parser relay; fixture PDFs are generated text-based demo inputs. | Demonstrate supported fixture PDF evidence intake; do not claim arbitrary scanned-PDF OCR. |
| Coupa/ServiceNow/Dynamics/GRC/SharePoint/SAP/Ariba/Oracle/Workday | Normalization API documented in Parallax42, with local sample payloads under `examples/integrations/`. | Add screenshots and live replay evidence. |
| Microsoft Entra ID | Demo RBAC is enforced with the current demo identity model; Entra tenant/issuer/audience integration is not configured. Actor-derived app scope protects learning/governance/audit but is not a membership/RLS substitute. | Add Entra and verify app roles, issuer, audience, tenant, JWKS, memberships, and database policy before enterprise identity claims. |
| PostgreSQL | Isolated Railway Postgres durably stores case/session/quota records and tenant/project audit chain heads/events. | Migrate with versioned schema, rehearsed backup/restore and rollback gates described in the Azure plan. |
| Audit persistence | Hosted audit uses scoped PostgreSQL hash chains with locked heads; `/api/logs` is removed, detailed reads require `audit:read`, and hosted writes fail closed without Postgres. JSONL remains local/test-only. | Add immutable/WORM Blob range exports, restore verification, and same-transaction coupling to critical business changes before enterprise claims. |
| AI assurance portal | Separate repo. | Use for Responsible AI benchmark evidence. |

## Priority Order

1. Keep the primary Vercel working demo plus its GitHub Pages mirror and Railway persistence proof green.
2. Preserve the Agentathon Docker `/run` workflow proof.
3. Do not label Railway/Ocean/Vercel product endpoints as the FastAPI evaluator unless they expose this repo's `/metadata`, `/logs`, `/compass/probe`, and official `/run` schema.
4. Record the 2-3 minute demo video from the online cockpit.
5. Keep the implemented evidence, contradiction, readiness, actor-scope, version, and Node/Python parity regressions required in CI.
6. Add immutable audit export/business-write coupling and database-level tenant defense in depth.
7. Add live Entra tenant/membership proof before enterprise identity claims.
