# Security, RBAC, And Audit Plan

> Current-state/target split, reviewed 2026-07-12. Open vulnerabilities and exact code evidence are tracked in the [deep code review](DEEP_CODE_REVIEW.md) and `../security_best_practices_report.md`. Azure controls belong to the future [Azure migration plan](AZURE_MIGRATION_PLAN.md), not the current Vercel runbook.

## Current Repo Controls

- No committed secrets.
- `.env` ignored.
- PostgreSQL and Qdrant are durable for configured product records/vector data; hosted audit uses the PostgreSQL connection and fails closed without it.
- Local/test audit records may use `logs/agent_audit.jsonl`; hosted runtimes do not fall back to `/tmp`.
- Audit records use SHA-256 workspace/project chains. PostgreSQL chain heads are locked with `SELECT ... FOR UPDATE`, event/head commit together, and `/api/audit/recent` verifies only the authenticated actor's scope.
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

- Resource-wide membership/RLS coverage remains incomplete even though learning, governance, evidence, and audit paths now use actor-derived scope.
- Audit lacks immutable/WORM range export, restore proof, versioned migrations, and same-transaction coupling to critical business writes.
- Vercel rate limits and feature switches are instance-local; they are not distributed controls.
- JWT issuer/audience/tenant checks are configurable rather than mandatory in every production mode, and Entra app roles are not deployed.
- Review-pack export accepts client-supplied run content instead of loading an immutable server-side run.

These are release blockers, not accepted residual risks. The remediated audit/RBAC paths support the demo but are not evidence of enterprise authorization or immutable retention.

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

Each current record includes or should preserve:

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

The current implementation creates `p42_audit_chain_heads` and `p42_audit_events` in PostgreSQL. For a final enterprise deployment, move that runtime DDL into a reviewed migration, preserve the per-workspace/project chain key and unique chain-local sequence, and add typed/indexed columns where reporting requires them. Do not treat `AGENT_AUDIT_DIR` as hosted durability.

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

Apply database migrations outside request handling, enforce tenant filters (and PostgreSQL row-level security where appropriate), and export periodic hash-chain checkpoints to immutable object retention. Couple critical case/review mutations and their audit event in one transaction, or use an outbox across service boundaries. No raw uploaded document text, OCR body, secrets, keys, or private policy contents should be stored in the audit payload.
