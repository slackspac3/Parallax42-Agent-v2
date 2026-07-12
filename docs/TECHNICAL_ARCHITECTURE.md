# Technical Architecture

## Runtime Shape

```text
Browser cockpit
  -> NLP conversation case builder
  -> Vercel product API, or local Node API for reproduction
  -> server-side Compass gateway/API boundary
  -> optional CrewAI/runtime router
  -> compliance agent loop
  -> Qdrant-backed evidence memory in deployed product, local fallback when unconfigured
  -> evidence/domain library and governed learning memory
  -> decision + control plan + trace
```

Linked online product evidence:

```text
GitHub Pages cockpit
  -> Vercel product APIs
  -> server-side Compass gateway/API boundary
  -> isolated Railway Postgres
  -> authenticated Qdrant collection p42_compliance_evidence_v2
```

Agentathon evaluator reproduction:

```text
GitHub Actions / Docker
  -> python run.py
  -> FastAPI 0.0.0.0:8000
  -> POST /run
  -> Python multi-agent council
  -> Node bridge scripts/agentathon_run.js
  -> deterministic rules engine
  -> JSON response + logs/*.jsonl
```

Evidence ingestion and retrieval:

```text
Browser
  -> chunked evidence upload only
  -> backend parser/OCR boundary
  -> parsed document evidence IDs and summaries
  -> Vercel /api/evidence/index
  -> Parallax42 Compass embeddings gateway
  -> server-side vector store (Qdrant in deployed product, local file fallback for unconfigured local/dev)
  -> Vercel /api/evidence/search retrieves by caseId
  -> council receives citation-ready matches
  -> Vercel /api/export/review-pack packages decision, citations, evidence quality, and retrieval audit
```

Reference-intelligence memory for Use Case #21 and adjacent compliance domains:

```text
CourtListener / CUAD-compatible / NIST / legacy CAP local imports
  -> scripts/import-courtlistener-reference.js
  -> scripts/import-cuad-reference.js
  -> scripts/import-nist-reference.js
  -> normalized advisory reference records
  -> reference_context/<lane>/*.md
  -> governance/reference indexing boundary
  -> Compass text-embedding-3-large
  -> Qdrant or local-file reference memory
  -> conversation and council receive advisory context only
```

## Components In This Repo

| Component | Path | Responsibility |
| --- | --- | --- |
| Node API | `server.js` | Static cockpit, health, readiness, and agent-run endpoint. |
| Vercel API | `api/` | Serverless equivalent of the local API plus backend relay. |
| Conversation agent | `lib/conversationAgent.js` | NLP extraction, working case draft, contextual follow-up questions, and workflow handoff. |
| Runtime router | `lib/agentRuntime.js` | Selects CrewAI Flow, deterministic fallback, and runtime metadata. |
| Agent runtime | `lib/complianceAgent.js` | Intake normalization, domain scan, gaps, decision, controls, trace. |
| Advisory council | `lib/advisoryCouncil.js` | Optional GPT-5.1 Privacy, Security, Responsible AI, and Learning/Precedent specialists through the Compass gateway; advisory only and unable to mutate final decisions. |
| Agentathon evaluator wrapper | `run.py`, `app/`, `scripts/agentathon_run.js` | Standardized FastAPI `/run` path for technical screening, Docker smoke, and JSONL trace generation. |
| RBAC policy | `lib/rbac.js` | Route policy, role normalization, bearer JWT validation, and Entra-compatible RS256/JWKS support. |
| CrewAI Flow adapter | `crewai_adapter/compliance_flow.py` | Flow state/stage mapping and optional live Flow validation. |
| Evidence layer | `lib/evidenceLibrary.js` | Initial compliance domain library and evidence IDs. |
| Shared evidence gateway client | `lib/compassGatewayClient.js` | Server-side bridge to the reusable Parallax42 gateway for GPT-5.1, `text-embedding-3-large`, evidence chunking, and semantic search. |
| Server-side evidence vector store | `lib/evidenceVectorStore.js` | Stores chunk embeddings behind the API, supports Qdrant-compatible production storage, strips vectors from browser responses, and retrieves evidence by `caseId`. |
| Governed learning memory | `lib/learningMemory.js` | Stores reviewer feedback, outcomes, control patterns, overrides, and evidence-quality notes as advisory memory. This is not model training. |
| Reference intelligence corpus | `lib/referenceIntelligenceCorpus.js`, `scripts/import-courtlistener-reference.js`, `scripts/import-cuad-reference.js`, `scripts/import-nist-reference.js`, `reference_context/` | Normalizes legal, contract, compliance, security, procurement, AI governance, sanctions/export, and HSE/ESG reference context for advisory retrieval. |
| Audit store | `lib/auditStore.js` | Hash-chained append-only JSONL audit with integrity verification; production should point `AGENT_AUDIT_DIR` at durable storage. |
| Review pack builder | `lib/reviewPack.js` | Generates digest-backed executive review packs with evidence quality, retrieval audit, citations, and reviewer actions. |
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
- Qdrant is the full demo provider when `P42_VECTOR_STORE_PROVIDER=qdrant` and its credentials are configured. It can use labelled deterministic hash vectors for the public demo or Compass semantic embeddings when a rotated credential is available; local-file storage is a development fallback.
- In the current deployed product path, Qdrant and Postgres are isolated Railway services configured server-side through Vercel. The public demo uses labelled deterministic hash vectors; local/FastAPI reproduction remains env-dependent and falls back when vector settings are missing.
- Governed learning memory returns similar cases and control suggestions as advisory reviewer context only. It never rewrites the deterministic run output.
- Output is never automatic approval; it is a human-review decision brief.
- Live LLM specialist output is advisory only; deterministic guardrails own decision status, approval eligibility, and blocker naming.
- Raw private documents and secrets must not appear in admin or trace outputs.
- Any write-capable future tool must use explicit approval and audit logging.
- The Vercel backend relay forwards only explicit demo routes and blocks arbitrary backend access.
