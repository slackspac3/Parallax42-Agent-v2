# Parallax42 Documentation Map

**Last reconciled:** 2026-07-12
**Rule:** use the current-state documents below for implementation and deployment decisions. Dated benchmark, submission, milestone, and remediation reports are evidence snapshots, not current operating guidance.

## Start here

| Need | Authoritative document |
|---|---|
| Product overview and local start | [README](../README.md) |
| Current deep review and ranked backlog | [Deep code review](DEEP_CODE_REVIEW.md) |
| Current security risk register | [Security assessment](../security_best_practices_report.md) |
| Azure target, cutover, rollback, and recovery | [Azure migration plan](AZURE_MIGRATION_PLAN.md) |
| Current component/data flow | [Architecture](../ARCHITECTURE.md) |
| Current Vercel operations | [Deployment runbook](DEPLOYMENT_RUNBOOK.md) |
| Evaluation contract | [Evaluation](../EVALUATION.md) |
| Submission narrative | [Submission](../SUBMISSION.md) |

If two documents disagree, prefer the newest dated current-state document, then verify the code and deployed server capability response. Runtime labels describe a particular interaction; they must not be inferred from a static architecture diagram.

## Current product and architecture

- [Technical architecture](TECHNICAL_ARCHITECTURE.md)
- [Agentathon system architecture](AGENTATHON_SYSTEM_ARCHITECTURE.md)
- [Integration matrix](INTEGRATION_MATRIX.md)
- [Agent resume](AGENT_RESUME.md)
- [CrewAI architecture](CREWAI_ARCHITECTURE.md)
- [End state](END_STATE.md)
- [Requirements traceability](REQUIREMENTS_TRACEABILITY.md)
- [Production track](PRODUCTION_TRACK.md)
- [Roadmap](ROADMAP.md)

Current hosted-state shorthand:

- Node/Vercel is the product API; the FastAPI/Node-bridge evaluator is separate.
- PostgreSQL durably stores business records; Qdrant is the active vector provider.
- The shared Compass gateway uses a named client, GPT-5.1 chat, and `text-embedding-3-large`; deterministic behavior is a fallback.
- Node advisory specialists are active in the reviewed deployment; Python CrewAI is optional/inactive there.
- Demo/session authorization is enforced; enterprise Entra identity is not implemented.
- Hosted audit uses actor-scoped PostgreSQL hash chains; it is durable but not immutable/WORM or atomically coupled to every business write.

Release implementation `457c7c2` passed full `npm run qa` (276/276 Node and 13/13 Python security tests), with CI, Agentathon Preflight, and Pages green. The authenticated production flow at <https://parallax42-agent-v2.vercel.app/> was verified in a real browser through real upload, Qdrant, Compass, Council, an authoritative post-council rerun, and an HTTP `200` narrative response. This is working-demo proof, not immutable/WORM audit or enterprise authorization; see the [deep review](DEEP_CODE_REVIEW.md) before relying on approval, enterprise tenancy, audit retention, or review-pack output.

## Demo and delivery

- [Demo script](DEMO_SCRIPT.md)
- [Golden demo workflow](GOLDEN_DEMO_WORKFLOW.md)
- [Submission plan](SUBMISSION_PLAN.md)
- [Deployment runbook](DEPLOYMENT_RUNBOOK.md)
- [Security/RBAC/audit plan](SECURITY_RBAC_AUDIT_PLAN.md)
- [CrewAI adapter notes](../crewai_adapter/README.md)
- [Evidence directory](../evidence/README.md)
- [Audit/log directory](../logs/README.md)

The current Vercel/Pages deployment and the future Azure migration are intentionally separate runbooks. Do not apply Azure steps to the existing production origin until the migration phase explicitly calls for it.

## Reference intelligence and responsible AI

- [Reference intelligence data](REFERENCE_INTELLIGENCE_DATA.md)
- [Legal intelligence data](LEGAL_INTELLIGENCE_DATA.md)
- [Responsible AI controls](RESPONSIBLE_AI_CONTROLS.md)
- [Reference-context registry](../reference_context/README.md)
- [AI governance lane](../reference_context/ai_governance/README.md)
- [Compliance lane](../reference_context/compliance/README.md)
- [HSE/ESG lane](../reference_context/hse_esg/README.md)
- [Legal lane](../reference_context/legal/README.md)
- [Procurement lane](../reference_context/procurement/README.md)
- [Sanctions/export lane](../reference_context/sanctions_export/README.md)
- [Security lane](../reference_context/security/README.md)

Reference sources are guidance, not customer evidence. A library reference must never satisfy a case control unless an actual case source passage is provided, retrieved, and verified. Review owners and cadence are recorded in the registry/lane files; stale lanes are fail-closed for enterprise use.

## Supporting reference notes

- [NIST AI governance reference](../reference_context/ai_governance/nist_ai_governance_reference.md)
- [NIST security reference manifest](../reference_context/security/nist_reference_manifest.md)
- [CourtListener reference](../reference_context/legal/courtlistener_reference.md)
- [CUAD clause reference](../reference_context/legal/cuad_clause_reference.md)
- [Legal caveats](../reference_context/legal/legal_caveats.md)
- [CAP legal reference](../reference_context/legal_intelligence/cap_legal_reference.md)
- [Legal-intelligence caveats](../reference_context/legal_intelligence/legal_caveats.md)
- [Sanitised enterprise AI-governance context](../reference_context/sanitised_enterprise_ai_governance_context.md)
- [Compliance test fixtures](../test-fixtures/compliance-documents/README.md)

## Historical evidence snapshots

These documents preserve the state, score, commit, test count, or remediation claim made at their own date. They now carry a historical banner and should not override current guidance:

- [Clone submission readiness](../CLONE_SUBMISSION_READINESS.md)
- [Fresh benchmark report](../FRESH_BENCHMARK_REPORT.md)
- [Final automated eligibility and score](../FINAL_AUTOMATED_ELIGIBILITY_AND_SCORE.md)
- [Benchmark report](BENCHMARK_REPORT.md)
- [Prior Codex repository audit](../CODEX_REPO_AUDIT.md)
- [P0 remediation report](../P0_REMEDIATION_REPORT.md)
- [Post-prompt execution report](../POST_PROMPT_EXECUTION_REPORT.md)
- [Milestone 1 CrewAI flow](MILESTONE_1_CREWAI_FLOW.md)

Historical findings described as fixed must be revalidated against the current revision before being relied on.

## Documentation maintenance

When behavior changes:

1. Update code and tests.
2. Update `README.md`, `ARCHITECTURE.md`, and the relevant current plan/runbook in the same change.
3. Record the deployed capability from the server, including actual runtime/fallback state.
4. Keep benchmark hashes, run IDs, test counts, and screenshots in a dated snapshot rather than a living document.
5. Run link/drift checks and verify the deployed URL after merge.
6. Never describe a planned Azure component as deployed until IaC and production verification prove it.

## Review record

The 2026-07-12 reconciliation inventoried every tracked Markdown file, corrected material current-state drift in living documents, labeled dated reports as historical, added reference-data review ownership, and introduced the current review/security/Azure documents. The release record was then updated for implementation `457c7c2`, its green QA/CI/Preflight/Pages gates, and its authenticated production-browser verification. Remaining inconsistencies should be reported against this map and resolved from code plus deployed evidence.
