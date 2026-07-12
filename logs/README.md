# Logs

Runtime audit logs may be written to `logs/agent_audit.jsonl` only in explicit
local/test mode. Hosted runtimes use actor-scoped PostgreSQL hash chains and
fail writes closed when PostgreSQL is unavailable; `AGENT_AUDIT_DIR` is not a
hosted durability mechanism. The repository includes sample JSONL traces for
submission review only; generated runtime logs remain gitignored.

Do not expose raw logs or a global audit tail publicly. Detailed Node audit is
role-gated and tenant-scoped, `/api/logs` is removed, and FastAPI `/logs` is
non-disclosing. WORM export, restore proof, and business/audit transaction
coupling are documented in
[`docs/DEEP_CODE_REVIEW.md`](../docs/DEEP_CODE_REVIEW.md); the future Azure
retention path is in [`docs/AZURE_MIGRATION_PLAN.md`](../docs/AZURE_MIGRATION_PLAN.md).
