# Security, RBAC, And Audit Plan

> Current-state/target split, reviewed 2026-07-12. Open vulnerabilities and exact code evidence are tracked in the [deep code review](DEEP_CODE_REVIEW.md) and `../security_best_practices_report.md`. Azure controls belong to the future [Azure migration plan](AZURE_MIGRATION_PLAN.md), not the current Vercel runbook.

## Current Repo Controls

- No committed secrets.
- `.env` ignored.
- PostgreSQL and Qdrant are durable for configured product records and vector data. They do not currently make the audit trail durable.
- Local audit records are written to `logs/agent_audit.jsonl`; Vercel writes to per-instance `/tmp/p42-compliance-intelligence-agent`. `/tmp` is ephemeral and is not a supported enterprise audit store.
- Audit records are append-only JSONL with SHA-256 hash chaining, sequence numbers, previous-hash pointers, and `/api/audit/recent` integrity verification.
- Audit payloads redact secret-looking keys and truncate large strings.
- Route-level RBAC policy exists for agent run, readiness, benchmarks, audit, health, and demo endpoints.
- The hosted demo uses enforced demo session/auth boundaries. This is not Microsoft Entra SSO proof.
- `P42_AUTH_MODE=enforced` requires a permitted authenticated actor on protected Node routes; the separate FastAPI wrapper defaults to audit mode unless explicitly configured.
- JWT validation supports HS256 for private smoke tests and RS256/JWKS for Entra-compatible OIDC deployments.
- Human approval required in the decision model.
- Output review checks for unsupported automatic approval.
- Browser/backend relay routes are allowlisted, but any configurable destination must remain operator-controlled; browser-held credentials must never be forwarded to user-selected origins.
- CORS is restricted to configured origins.

## Open Security Blockers

- Conversation-side learning retrieval accepts request-supplied workspace/project context without consistently replacing it with the authenticated actor's tenant, enabling cross-workspace memory disclosure.
- Audit records lack workspace/project fields, `/api/audit/recent` reads a global tail, and `/api/logs` is reachable without authentication in the current deployment shape.
- Vercel rate limits and feature switches are instance-local; they are not distributed controls.
- JWT issuer/audience/tenant checks are configurable rather than mandatory in every production mode, and Entra app roles are not deployed.
- Review-pack export accepts client-supplied run content instead of loading an immutable server-side run.

These are release blockers, not accepted residual risks. Do not use the current audit or RBAC implementation as evidence of enterprise authorization.

## Target Enterprise Controls

### Authentication

- Microsoft Entra ID OIDC/JWT validation.
- Tenant and audience validation.
- JWKS cache with rotation handling.
- Conditional access delegated to Entra where available.
- Workspace membership and role assignment derived server-side; request bodies cannot select their own tenant.
- Production env:

```bash
P42_AUTH_MODE=enforced
P42_AUTH_AUDIENCE=api://parallax42-compliance-agent
P42_AUTH_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
P42_ENTRA_TENANT_ID=<tenant-id>
P42_ENTRA_JWKS_URL=https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys
```

### RBAC

Initial roles:

- Platform Admin
- Risk Admin
- Compliance Reviewer
- Legal / Privacy Reviewer
- Security Reviewer
- Finance / Project Reviewer
- HSE / BCM Reviewer
- Business Approver
- Auditor / Read Only

### Route Policy

| Route | Roles |
| --- | --- |
| `/api/agent/run` | Compliance Reviewer, Risk Admin, domain reviewers |
| `/api/readiness` | Platform Admin, Risk Admin, Auditor |
| `/api/benchmarks` | Platform Admin, Risk Admin, Auditor |
| `/api/audit/recent` | Platform Admin, Auditor |
| `/api/backend?path=/health` | Demo users, reviewers |
| Future write/apply endpoints | Explicit approver role plus expected revision |

Every non-platform-admin read must also be constrained to the authenticated workspace/project. Platform-wide reads require a separate, auditable platform-admin permission.

### Audit Schema

Each record should include:

- event id
- timestamp
- actor identity
- role set
- workspace id
- project id
- case id
- event type
- decision status
- evidence IDs
- controls recommended
- blocking gaps
- model mode
- fallback status
- trace event count
- redaction flags
- integrity sequence
- previous record hash
- current record hash

## Production Upgrade

For a final enterprise deployment, back `AGENT_AUDIT_DIR` with durable storage or move the same event shape into PostgreSQL:

```sql
create table compliance_agent_audit_events (
  id text primary key,
  occurred_at timestamptz not null,
  actor_username text not null,
  actor_role text not null,
  workspace_id text not null,
  project_id text not null,
  case_id text not null,
  event_type text not null,
  payload jsonb not null,
  redacted boolean not null default true,
  sequence bigint not null,
  previous_hash text not null,
  record_hash text not null,
  algorithm text not null default 'sha256'
);
```

Apply database migrations outside request handling, enforce tenant filters (and PostgreSQL row-level security where appropriate), and export periodic hash-chain checkpoints to immutable object retention. No raw uploaded document text, OCR body, secrets, keys, or private policy contents should be stored in the audit payload.
