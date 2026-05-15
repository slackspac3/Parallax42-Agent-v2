# Technical Architecture

## Runtime Shape

```text
Browser cockpit
  -> NLP conversation case builder
  -> local Node API or Vercel API
  -> CrewAI Flow runtime router
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

Submission deployment:

```text
GitHub Pages cockpit
  -> Vercel /api/health, /api/readiness, /api/benchmarks, /api/conversation, /api/agent/run
  -> Vercel /api/evidence/index and /api/evidence/search
  -> Server-side vector store boundary
  -> Vercel /api/backend allowlisted relay
  -> Parallax42 backend health/demo endpoints
```

Evidence ingestion and retrieval:

```text
Browser
  -> chunked evidence upload only
  -> backend parser/OCR boundary
  -> parsed document evidence IDs and summaries
  -> Vercel /api/evidence/index
  -> Parallax42 Compass embeddings gateway
  -> server-side vector store (Qdrant in production, local file fallback for demo/dev)
  -> Vercel /api/evidence/search retrieves by caseId
  -> council receives citation-ready matches
```

## Components In This Repo

| Component | Path | Responsibility |
| --- | --- | --- |
| Node API | `server.js` | Static cockpit, health, readiness, and agent-run endpoint. |
| Vercel API | `api/` | Serverless equivalent of the local API plus backend relay. |
| Conversation agent | `lib/conversationAgent.js` | NLP extraction, working case draft, contextual follow-up questions, and workflow handoff. |
| Runtime router | `lib/agentRuntime.js` | Selects CrewAI Flow, deterministic fallback, and runtime metadata. |
| Agent runtime | `lib/complianceAgent.js` | Intake normalization, domain scan, gaps, decision, controls, trace. |
| RBAC policy | `lib/rbac.js` | Route policy, role normalization, bearer JWT validation, and Entra-compatible RS256/JWKS support. |
| CrewAI Flow adapter | `crewai_adapter/compliance_flow.py` | Flow state/stage mapping and optional live Flow validation. |
| Evidence layer | `lib/evidenceLibrary.js` | Initial compliance domain library and evidence IDs. |
| Shared evidence gateway client | `lib/compassGatewayClient.js` | Server-side bridge to the reusable Parallax42 gateway for GPT-5.1, `text-embedding-3-large`, evidence chunking, and semantic search. |
| Server-side evidence vector store | `lib/evidenceVectorStore.js` | Stores chunk embeddings behind the API, supports Qdrant-compatible production storage, strips vectors from browser responses, and retrieves evidence by `caseId`. |
| Audit store | `lib/auditStore.js` | Hash-chained append-only JSONL audit with integrity verification; production should point `AGENT_AUDIT_DIR` at durable storage. |
| Cockpit UI | `public/` | Chat-first operator workspace with advanced demo/live run modes. |
| Evidence capture | `scripts/capture-evidence.js` | Generates health, benchmark, readiness, and sample trace artifacts. |
| Dossier | `docs/` | Role-aligned submission evidence. |

## Production Target

The production target should be extracted from Parallax42 rather than rewritten:

- FastAPI backend for document parsing, OCR, live Compass boundary, and admin checks.
- PostgreSQL for case, run, audit, reviewer, and configuration state.
- Blob/object storage for uploaded evidence and exports.
- Qdrant, Azure AI Search, or approved retrieval service for indexed evidence.
- Shared Parallax42 gateway for Compass GPT-5.1 and `text-embedding-3-large`, reusable by other repositories through `workspaceId` and `projectId`.
- Entra ID/JWT validation for identity and role-scoped access.
- Compass gateway for sovereign LLM calls, with no browser-held production keys.

## Trust Boundaries

- Browser is not trusted for model calls or authoritative compliance decisions.
- Browser is not an evidence vector store: it keeps case IDs, evidence IDs, and sanitized metadata only.
- Model access stays behind server-side gateway controls.
- Embedding calls are token-protected server-to-server calls; the browser never receives Compass, Vercel AI Gateway, or embedding provider credentials.
- Chunk embeddings are stored behind `/api/evidence/index` and retrieved behind `/api/evidence/search`; browser responses strip vectors and raw chunk payloads.
- Output is never automatic approval; it is a human-review decision brief.
- Raw private documents and secrets must not appear in admin or trace outputs.
- Any write-capable future tool must use explicit approval and audit logging.
- The Vercel backend relay forwards only explicit demo routes and blocks arbitrary backend access.
