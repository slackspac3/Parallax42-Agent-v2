# Architecture

## Product Overview

Parallax42 Compliance Intelligence Agent is a judge-facing Legal Intelligence / Compliance workspace for **Agentathon Use Case #21**. It helps an operator build an agreement or vendor-evidence review case through chat, attach or reference evidence, run a council-style assessment, and export a human-review pack with traceable gaps, controls, citations, and audit metadata.

The current repository is a Node/CommonJS Vercel/static application. It is intentionally lightweight: the browser cockpit runs from `public/`, API routes live under `api/`, `server.js` mirrors those APIs for local development, and reusable decision/retrieval logic lives under `lib/`.

## Runtime Architecture

```text
Browser cockpit
  -> Node API route or local server.js mirror
  -> Compass-backed smart intake planner
  -> evidence indexing and retrieval boundary
  -> deterministic compliance engine
  -> optional advisory CrewAI/Compass-shaped orchestration
  -> human-review decision pack
  -> local append-only audit trail
```

The deterministic compliance engine owns final decision status, blocker naming, approval readiness, and required controls. Compass gateway LLM access is required for the smart chat intake planner; if the gateway token is missing, the UI reports smart intake unavailable instead of silently dropping into pattern-only chat. CrewAI is dry-run/orchestration-shaped by default, and Compass advisory outputs remain non-authoritative for compliance approval.

## Frontend, API, And Library Layout

| Area | Path | Current role |
| --- | --- | --- |
| Frontend | `public/index.html`, `public/app.js`, `public/styles.css`, `public/config.js` | Static chat-first cockpit, evidence view, council output, exports, and runtime configuration. |
| Vercel APIs | `api/` | Serverless endpoints for health, readiness, conversation, agent runs, evidence indexing/search, audit, demo replay, backend relay, and export pack generation. |
| Local API mirror | `server.js` | Local development server that mirrors the Vercel API behavior closely enough for demos and QA. |
| Core logic | `lib/` | Compliance engine, conversation agent, runtime router, evidence library, vector store adapter, Compass gateway client, audit store, and review pack builder. |
| CrewAI adapter | `crewai_adapter/` | Optional Python dry-run/live validation scaffold for CrewAI-shaped orchestration; not required for the Node runtime path. |
| Evidence artifacts | `evidence/` | Generated health, readiness, benchmark, and sample-run evidence snapshots for submission packaging. |
| Supporting docs | `docs/` | Detailed architecture, controls, demo, deployment, benchmark, and traceability notes. |

## Evidence And Retrieval Flow

The browser should not be treated as a trusted evidence or vector store. The intended current flow is:

```text
Browser sends case/evidence metadata and sanitized excerpts
  -> API indexes sanitized evidence chunks and keeps embeddings server-side
  -> optional sanitized governance-reference corpus is indexed separately
  -> optional reference-intelligence corpora are indexed separately
  -> Compass gateway may create embeddings when configured
  -> local vector store persists by default
  -> Qdrant REST can be used when configured
  -> API returns evidence IDs, sanitized metadata, and safe snippets/citations
  -> council retrieves evidence, governance references, and learning memory server-side
```

The default vector provider is local-file storage for demo and development. Qdrant REST is optional when `P42_VECTOR_STORE_PROVIDER=qdrant` and the required Qdrant environment variables are configured. Governance references and reference-intelligence samples are stored as `governance_reference` chunks and are advisory context only. CourtListener and CAP records are legal-reference memory for clause/risk comparison, citation verification, and reviewer questions; they are not legal advice, not jurisdiction-specific advice, and not an approval source. Local OCR/document parsing is not implemented in this repository; browser-side state may include metadata, excerpts, and retrieved snippets for the visible review experience, but not embedding vectors. Any production document extraction boundary should be added as a server-side service before storing retrievable chunks.

## Audit And Security Model

Audit is implemented as local append-only hash-chained JSONL through the audit store. This provides tamper-evident local traces for demo and review, but production retention should move the audit directory to managed durable storage.

Security boundaries in the current architecture:

- Browser never receives Compass or embedding provider secrets.
- Browser responses should contain case IDs, evidence IDs, sanitized metadata, and citations, not raw vectors.
- Deterministic guardrails own final decision status even when advisory LLM output exists.
- Human approval remains required for operational use.
- RBAC/JWT policy support exists in code, but production identity enforcement depends on configured environment values.
- Compass gateway is a required server-side model boundary for smart chat intake and the shared embeddings/advisory model path.

## Implemented Now Vs Production Hardening

Implemented now:

- Static Node/Vercel-compatible compliance cockpit.
- Local `server.js` development mirror.
- Conversation/case builder and deterministic compliance engine.
- CrewAI-shaped dry-run orchestration checks.
- Evidence indexing/search API boundary with local vector store default.
- Reference-intelligence lane import/index path for Use Case #21 legal/compliance references and adjacent compliance, security, procurement, AI governance, sanctions/export, and HSE/ESG context.
- Optional Compass gateway support for LLM and embeddings.
- Optional Qdrant REST vector provider when configured.
- Local hash-chained JSONL audit.
- Review pack export endpoint and generated submission evidence artifacts.
- Unit, syntax, page, benchmark, and CrewAI dry-run QA scripts.

Production hardening still required:

- Managed durable audit storage.
- Managed vector database configuration and retention policy.
- Server-side document parsing/OCR pipeline.
- Production identity, RBAC, tenant, and role enforcement.
- More adversarial, latency, reliability, and citation-quality evaluations.
- Operator workflow hardening for multi-user review, approvals, and case lifecycle management.
