# Logs

Runtime audit logs are written to `logs/agent_audit.jsonl` locally and to the
configured `AGENT_AUDIT_DIR` in deployed environments. Vercel currently uses
per-instance `/tmp`, which is ephemeral; Railway PostgreSQL/Qdrant durability
does not extend to these audit files. The repository includes sample JSONL
traces for submission review only; generated runtime logs remain gitignored.

Do not expose raw logs or a global audit tail publicly. The durable,
tenant-scoped target and current blockers are documented in
[`docs/DEEP_CODE_REVIEW.md`](../docs/DEEP_CODE_REVIEW.md); the future Azure
retention path is in [`docs/AZURE_MIGRATION_PLAN.md`](../docs/AZURE_MIGRATION_PLAN.md).
