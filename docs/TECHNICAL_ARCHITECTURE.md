# Technical Architecture

> **Verified remediation release, 2026-07-12:** implementation SHA `457c7c2` passed 276 Node tests and 13 Python security tests. GitHub Actions CI, Agentathon Preflight (including Docker smoke), and GitHub Pages deployment are green. The authenticated production workflow was verified at <https://parallax42-agent-v2.vercel.app>. The Vercel product uses the named Parallax42 Compass gateway client with GPT-5.1 advisory/smart-intake calls and `text-embedding-3-large` semantic retrieval. Railway Postgres durably stores case, session, quota, and tenant-scoped audit-chain records; Railway Qdrant is the active vector store. Hosted audit writes fail closed without PostgreSQL, while JSONL is local/test-only. Demo RBAC is enforced, but Microsoft Entra is not configured. Node specialists are active; Python CrewAI is optional and currently inactive. Node is the sole policy authority.

For the selected production target and staged transition, see the [Azure migration plan](AZURE_MIGRATION_PLAN.md).

## Runtime Shape

```text
Browser cockpit
  -> NLP conversation case builder
  -> Vercel product API, or local Node API for reproduction
  -> named server-side Compass gateway client
  -> active Node advisory specialists; optional Python CrewAI adapter
  -> compliance agent loop
  -> Qdrant-backed evidence memory in deployed product, local fallback when unconfigured
  -> evidence/domain library and governed learning memory
  -> authoritative Node decision + control plan + trace
  -> tenant-scoped PostgreSQL audit chain
```

Linked online product evidence:

```text
Vercel working demo (primary) or GitHub Pages static mirror
  -> Vercel Node product APIs
  -> named Compass gateway client (GPT-5.1 + text-embedding-3-large)
  -> isolated Railway Postgres (case/session/quota records + scoped audit chains)
  -> authenticated Qdrant collection p42_compliance_evidence_v2 (semantic retrieval)
```

Agentathon evaluator reproduction:

```text
GitHub Actions / Docker
  -> python run.py
  -> FastAPI 0.0.0.0:8000
  -> POST /run
  -> Python multi-agent advisory/evaluator
  -> Node bridge scripts/agentathon_run.js
  -> authoritative deterministic Node rules engine
  -> JSON response + logs/*.jsonl
```

Evidence ingestion and retrieval:

```text
Browser
  -> chunked evidence upload only
  -> optional backend parser/OCR relay (disabled in the verified hosted configuration)
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
| Runtime router | `lib/agentRuntime.js` | Routes the Node policy run and reports requested versus actual runtime metadata; Python CrewAI remains optional. |
| Agent runtime | `lib/complianceAgent.js` | Intake normalization, domain scan, gaps, decision, controls, trace. |
| Advisory council | `lib/advisoryCouncil.js` | Active GPT-5.1 Privacy, Security, Responsible AI, and Learning/Precedent specialists through the named Compass gateway client; advisory only. |
| Agentathon evaluator wrapper | `run.py`, `app/`, `scripts/agentathon_run.js` | Standardized FastAPI `/run` path that preserves Node policy fields and adds only advisory/evaluator output. |
| RBAC policy | `lib/rbac.js` | Route policy, role normalization, bearer JWT validation, and Entra-compatible RS256/JWKS support. |
| CrewAI Flow adapter | `crewai_adapter/compliance_flow.py` | Flow state/stage mapping and optional live Flow validation. |
| Evidence assertions | `lib/evidenceAssertions.js`, `lib/evidenceLibrary.js` | Normalizes provenance/assertion state, admits only usable supplied/retrieved passages as proof, and retains source-level positive/negative assertions and contradictions. |
| Shared evidence gateway client | `lib/compassGatewayClient.js` | Server-side bridge to the reusable Parallax42 gateway for GPT-5.1, `text-embedding-3-large`, evidence chunking, and semantic search. |
| Server-side evidence vector store | `lib/evidenceVectorStore.js` | Stores chunk embeddings behind the API, supports Qdrant-compatible production storage, strips vectors from browser responses, and retrieves evidence by `caseId`. |
| Governed learning memory | `lib/learningMemory.js`, `lib/serverSideRetrieval.js` | Stores advisory reviewer context and derives learning/governance namespaces from the authenticated actor, ignoring caller-selected workspace/project values. This is not model training. |
| Reference intelligence corpus | `lib/referenceIntelligenceCorpus.js`, `scripts/import-courtlistener-reference.js`, `scripts/import-cuad-reference.js`, `scripts/import-nist-reference.js`, `reference_context/` | Normalizes legal, contract, compliance, security, procurement, AI governance, sanctions/export, and HSE/ESG reference context for advisory retrieval. |
| Audit store | `lib/auditStore.js` | Tenant/project-scoped PostgreSQL hash chains for hosted runtimes, serialized with `SELECT ... FOR UPDATE`; role-gated/scoped reads and fail-closed hosted writes. Records are append-only through the application API, while JSONL is local/test fallback only. This is not immutable/WORM storage and does not make the system `enterpriseReady`; export, restore proof, database policy, and business/audit transaction coupling remain future work. |
| Review pack builder | `lib/reviewPack.js` | Generates digest-backed executive review packs with evidence quality, retrieval audit, citations, and reviewer actions. |
| Cockpit UI | `public/` | Chat-first operator workspace with advanced demo/live run modes. |
| Evidence capture | `scripts/capture-evidence.js` | Generates health, benchmark, readiness, and sample trace artifacts. |
| Dossier | `docs/` | Role-aligned submission evidence. |

## Production Target

The selected Azure target and migration gates are defined in [Azure Migration Plan](AZURE_MIGRATION_PLAN.md). At a high level:

- Container Apps for the Node product API; retain FastAPI only for evaluator/parser capabilities that are actually required.
- PostgreSQL for case, run, audit, reviewer, and configuration state.
- Blob/object storage for uploaded evidence and exports.
- Keep Qdrant during parity migration, then move derived vector indexes to Azure AI Search only after shadow validation.
- Shared Parallax42 gateway for Compass GPT-5.1 and `text-embedding-3-large`, reusable by other repositories through `workspaceId` and `projectId`.
- Entra ID/JWT validation for production identity and role-scoped access.
- Compass gateway for sovereign LLM calls, with no browser-held production keys.

## Trust Boundaries

- Browser is not trusted for model calls or authoritative compliance decisions.
- Browser is not an evidence vector store: it keeps case IDs, evidence IDs, and sanitized metadata only.
- Model access stays behind server-side gateway controls.
- Embedding calls are token-protected server-to-server calls; the browser never receives Compass, Vercel AI Gateway, or embedding provider credentials.
- Chunk embeddings are stored behind `/api/evidence/index` and retrieved behind `/api/evidence/search`; browser responses strip vectors and raw chunk payloads.
- Qdrant is the hosted vector provider and currently uses `text-embedding-3-large` semantic embeddings through the named Compass gateway client. Labelled deterministic hash vectors and local-file storage are fallback/reproduction modes.
- In hosted runtimes, Postgres durably stores case/session/quota records and scoped audit chains; audit writes fail closed if PostgreSQL is unavailable. The chain is append-only at the application layer, not immutable/WORM storage. Local/FastAPI reproduction remains environment-dependent and uses explicit local fallbacks.
- Governed learning and governance retrieval use the authenticated actor's workspace/project. They return advisory context only and never rewrite deterministic output.
- Only evidence-bearing uploaded or server-retrieved passages satisfy controls. A question, mention, placeholder, or policy reference cannot do so; contradictory assertions remain visible and blocking.
- Output is never automatic approval. Conditional status is nonterminal, and approval requires the server-owned `approvalEligible: true` plus a human decision.
- Live Node specialists, Compass, learning, precedent, and Python are advisory. Node exclusively owns decision status, risk, gaps, controls, readiness, approval eligibility, and blocker naming.
- Council completion returns one authoritative final case snapshot/version; browser state is replaced from that snapshot before the next interaction.
- Detailed audit is role-gated and tenant-scoped with `private, no-store`; `/api/logs` is a non-disclosing 404 and FastAPI `/logs` returns no trace entries.
- Raw private documents and secrets must not appear in admin or trace outputs.
- Any write-capable future tool must use explicit approval and audit logging.
- The Vercel backend relay forwards only explicit demo routes and blocks arbitrary backend access.
