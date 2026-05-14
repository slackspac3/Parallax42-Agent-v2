# Security, RBAC, And Audit Plan

## Current Repo Controls

- No committed secrets.
- `.env` ignored.
- Local audit records written to `logs/agent_audit.jsonl`.
- Audit payloads redact secret-looking keys and truncate large strings.
- Human approval required in the decision model.
- Output review checks for unsupported automatic approval.

## Target Enterprise Controls

### Authentication

- Microsoft Entra ID OIDC/JWT validation.
- Tenant and audience validation.
- JWKS cache with rotation handling.
- Conditional access delegated to Entra where available.

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
| Future write/apply endpoints | Explicit approver role plus expected revision |

### Audit Schema

Each record should include:

- event id
- timestamp
- actor identity
- role
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

## Production Upgrade

Move local JSONL into PostgreSQL:

```sql
create table compliance_agent_audit_events (
  id text primary key,
  occurred_at timestamptz not null,
  actor_username text not null,
  actor_role text not null,
  case_id text not null,
  event_type text not null,
  payload jsonb not null,
  redacted boolean not null default true
);
```

No raw uploaded document text, OCR body, secrets, keys, or private policy contents should be stored in the audit payload.
