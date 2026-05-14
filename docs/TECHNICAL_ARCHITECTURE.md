# Technical Architecture

## Runtime Shape

```text
Browser cockpit
  -> local Node API
  -> compliance agent loop
  -> evidence/domain library
  -> decision + control plan + trace
```

Linked production evidence:

```text
Parallax42 GitHub Pages UI
  -> FastAPI backend
  -> SupplierRiskFlow
  -> Compass gateway
  -> Core42 Compass GPT-5.1
```

## Components In This Repo

| Component | Path | Responsibility |
| --- | --- | --- |
| Node API | `server.js` | Static cockpit, health, readiness, and agent-run endpoint. |
| Agent runtime | `lib/complianceAgent.js` | Intake normalization, domain scan, gaps, decision, controls, trace. |
| Evidence layer | `lib/evidenceLibrary.js` | Initial compliance domain library and evidence IDs. |
| Cockpit UI | `public/` | Operator-facing run surface for the submission package. |
| Dossier | `docs/` | Role-aligned submission evidence. |

## Production Target

The production target should be extracted from Parallax42 rather than rewritten:

- FastAPI backend for document parsing, OCR, live Compass boundary, and admin checks.
- PostgreSQL for case, run, audit, reviewer, and configuration state.
- Blob/object storage for uploaded evidence and exports.
- Azure AI Search or approved retrieval service for indexed evidence.
- Entra ID/JWT validation for identity and role-scoped access.
- Compass gateway for sovereign LLM calls, with no browser-held production keys.

## Trust Boundaries

- Browser is not trusted for model calls or authoritative compliance decisions.
- Model access stays behind server-side gateway controls.
- Output is never automatic approval; it is a human-review decision brief.
- Raw private documents and secrets must not appear in admin or trace outputs.
- Any write-capable future tool must use explicit approval and audit logging.
