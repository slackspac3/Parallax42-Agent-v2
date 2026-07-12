# Architecture

## Product Overview

Parallax42 Compliance Intelligence Agent is a judge-facing Legal Intelligence / Compliance workspace for **Agentathon Use Case #21**. It helps an operator build an agreement or vendor-evidence review case through chat, attach or reference evidence, run a council-style assessment, and export a human-review pack with traceable gaps, controls, citations, and audit metadata.

The current repository is a Node/CommonJS Vercel/static application. It is intentionally lightweight: the browser cockpit runs from `public/`, API routes live under `api/`, `server.js` mirrors those APIs for local development, and reusable decision/retrieval logic lives under `lib/`.

## Verified Hosted Deployment

As verified on 2026-07-12, the hosted product uses Vercel Node APIs, Railway PostgreSQL for sessions/cases/quotas, authenticated Railway Qdrant, and a named least-privilege client on the shared Compass gateway. The gateway supplies GPT-5.1 chat/advisory calls and `text-embedding-3-large` semantic embeddings; its provider key remains inside the gateway. JavaScript advisory specialists are active. Python CrewAI is optional and inactive in the hosted product. Audit JSONL is written under serverless `/tmp` and is therefore nondurable and instance-local.

Demo/session RBAC is enforced, but Microsoft Entra SSO is not implemented. Deterministic Node policy is the intended final decision authority. The [Deep Code Review](docs/DEEP_CODE_REVIEW.md) records current paths that must be corrected to make that authority and tenant boundary invariant in practice; the [Azure Migration Plan](docs/AZURE_MIGRATION_PLAN.md) defines the selected replacement path for hosted infrastructure.

## Runtime Architecture

```text
Browser cockpit
  -> Node API route or local server.js mirror
  -> Compass-backed smart intake planner
  -> Qdrant evidence indexing and semantic retrieval boundary
  -> deterministic compliance engine
  -> active JavaScript Compass advisory specialists
  -> optional Python CrewAI adapter (inactive in hosted product)
  -> human-review decision pack
  -> hash-chained audit trail (`/tmp` in serverless deployment)
```

The intended architecture gives deterministic Node policy ownership of final decision status, blocker naming, approval readiness, and required controls. Compass gateway LLM access drives hosted smart intake and advisory specialists; if the gateway is unavailable, deterministic fallback should be explicitly labeled. Current runtime-label and Python authority-parity defects mean this is not yet an end-to-end guarantee. Python CrewAI is dry-run/optional by default and is not required for the Node product path.

The target autonomy model is L2 governed autonomy: the system can iterate through intake, retrieval, obligation mapping, risk/control critique, and pack generation, and should stop when the case lacks evidence, the 0-9 council-quality rubric is below threshold, or human approval is required. The current evidence/readiness findings make those stops open acceptance gates. The visible council is framed as deterministic specialist validation with agentic pairings:

- Planner + Doer: intake planning and case normalization.
- Proposer + Critic: obligation mapping challenged by risk/control analysis.
- Context-Packer + Actor: evidence packaging into deterministic decisioning.
- Evidence-Weaver + Synthesizer: cited findings converted into an audit-ready pack.

Each run carries an explicit loop spec: goal, plan, tools and fail modes, memory lanes, quality rubric, stop conditions, run log, and guardrails.

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
  -> named Compass gateway client creates `text-embedding-3-large` vectors in the hosted product
  -> authenticated Qdrant REST stores hosted evidence and memory vectors
  -> local deterministic storage remains a development/CI fallback
  -> API returns evidence IDs, sanitized metadata, and safe snippets/citations
  -> council retrieves evidence, governance references, and learning memory server-side
```

Request boundaries intentionally separate file upload from JSON case metadata. Browser evidence files are capped at 30 MB per file and move through the parser relay as chunks, not as raw `/api/conversation` JSON. Parsed evidence metadata can use the evidence index JSON route up to 15 MB by default, while conversation, run, and review-pack JSON routes default to 8 MB. These limits keep complex cases usable without turning the chat API into a raw document transport.

Local-file/deterministic retrieval is the development and CI fallback. The hosted product uses authenticated Qdrant REST and live `text-embedding-3-large` embeddings through the shared Compass gateway. Governance references and reference-intelligence samples are stored as `governance_reference` chunks and are advisory context only. CourtListener and CAP records are legal-reference memory for clause/risk comparison, citation verification, and reviewer questions; they are not legal advice, not jurisdiction-specific advice, and not an approval source. Local OCR/document parsing is not implemented in this repository; browser-side state may include metadata, excerpts, and retrieved snippets for the visible review experience, but not embedding vectors. Any production document extraction boundary should be added as a server-side service before storing retrievable chunks.

Memory is intentionally separated:

- Scratchpad: current case draft, active question, latest intent, and missing facts.
- Episodic log: audit trace, evidence IDs, decision events, and reviewer feedback.
- Reusable knowledge: reference intelligence, governed prior-case patterns, and control suggestions.

The target invariant is that only deterministic Node policy can change the final decision. Memory and LLM outputs must remain advisory unless encoded into grounded deterministic inputs and re-evaluated by the council; current deviations are catalogued in the deep review.

## Audit And Security Model

Audit is implemented as append-only hash-chained JSONL through the audit store. In the deployed serverless product it is written under `/tmp`, so it is instance-local, nondurable, and not a production audit ledger. Production retention must move to managed durable storage before audit-completeness claims are made.

Security boundaries in the current architecture:

- Browser never receives Compass or embedding provider secrets.
- Browser responses should contain case IDs, evidence IDs, sanitized metadata, and citations, not raw vectors.
- Deterministic Node guardrails are intended to own final decision status; current cross-runtime parity and evidence-grounding defects must be closed before this is guaranteed.
- Human approval remains required for operational use.
- Demo/session RBAC is enforced; Microsoft Entra SSO and enterprise group/role federation are not implemented.
- A named authenticated Compass gateway client is the server-side model boundary for GPT-5.1 chat/advisory calls and `text-embedding-3-large` embeddings. The provider key remains only in the shared gateway.

## Implemented Now Vs Production Hardening

Implemented now:

- Static Node/Vercel-compatible compliance cockpit.
- Local `server.js` development mirror.
- Conversation/case builder and deterministic compliance engine.
- Active JavaScript Compass advisory specialists plus optional Python CrewAI dry-run/live adapters.
- Evidence indexing/search API boundary with hosted Qdrant semantic retrieval and local deterministic fallback.
- Reference-intelligence lane import/index path for Use Case #21 legal/compliance references and adjacent compliance, security, procurement, AI governance, sanctions/export, and HSE/ESG context.
- Named authenticated Compass gateway support for hosted GPT-5.1 calls and semantic embeddings.
- Railway PostgreSQL persistence for hosted sessions, cases, and quotas.
- Authenticated Railway Qdrant REST vector persistence in the hosted product.
- Hash-chained JSONL audit, nondurable under serverless `/tmp`.
- Review pack export endpoint and generated submission evidence artifacts.
- Unit, syntax, page, benchmark, and CrewAI dry-run QA scripts.

Production hardening still required:

- Managed durable audit storage.
- Vector schema/version lifecycle, score calibration, and retention policy.
- Server-side document parsing/OCR pipeline.
- Microsoft Entra SSO, enterprise membership/role mapping, and database-level tenant isolation.
- More adversarial, latency, reliability, and citation-quality evaluations.
- Operator workflow hardening for multi-user review, approvals, and case lifecycle management.
