# End State

The target is not a compliance chatbot. The target is an enterprise-grade compliance intelligence worker that can be evaluated, operated, audited, and safely constrained in production.

## Current Submission Boundary

The final Agentathon submission is an online-first product demo plus a reproducible evaluator wrapper:

- Online product demo: GitHub Pages cockpit -> Vercel product APIs -> isolated Railway Postgres/Qdrant, with optional Compass server-side capabilities.
- Evaluator reproduction: root `run.py` / FastAPI / Docker / `POST /run` on port `8000`.
- Compass is used server-side. Browser clients never receive Compass keys, Qdrant keys, service tokens, or raw embeddings.
- Deterministic policy remains final authority; Compass, Qdrant retrieval, governed learning memory, and optional CrewAI are advisory.
- Enforced RBAC, enterprise-durable audit, arbitrary scanned-PDF OCR, and live CrewAI are not claimed unless separately configured and verified.

## North Star

Parallax42 Compliance Intelligence Agent should become a reviewer-facing agentic control plane for compliance decisions across supplier risk, AI governance, privacy, finance/project controls, Microsoft governance, regulatory compliance, ESG/HSE/BCM, and technical risk.

The agent should exceed the G42 submission ask by showing:

- a live runnable cockpit
- a deployable API layer
- CrewAI orchestration
- evidence ingestion and citation discipline
- reproducible agent traces
- human approval gates
- Responsible AI and adversarial evals
- RBAC and audit architecture
- enterprise integration contracts
- model/provider portability
- measurable reliability, latency, and decision quality

## World-Class Architecture

```text
GitHub Pages Cockpit
  -> Vercel Compliance API
      -> deterministic fallback agent
      -> optional CrewAI Flow orchestration
      -> server-side Compass gateway/API boundary
      -> optional OpenAI Responses / Agents SDK adapter
      -> evidence store and retrieval layer
      -> policy/control library
      -> audit/event store
      -> eval and telemetry exporters
      -> allowlisted Parallax42 backend relay
          -> Parallax42 FastAPI backend
          -> Compass gateway
          -> document/OCR pipeline
          -> Qdrant vector memory
```

## Agent Runtime

The target runtime is a layered agent stack:

| Layer | End-State Choice | Why |
| --- | --- | --- |
| Workflow spine | Custom deterministic orchestrator now; optional CrewAI Flow target | The submission default stays stable and deterministic. CrewAI remains an optional advisory path until dependency, credential, and eval gates are verified. |
| Specialist collaboration | Custom council now; optional CrewAI Crews target | The current trace already shows role-specific agents. CrewAI maps cleanly to orchestrator, obligation mapper, evidence examiner, risk/control analyst, RAI reviewer, and audit packager when enabled. |
| Model/tool execution | Responses API or sovereign Compass-compatible adapter | OpenAI's current tools model supports function calling, file search, remote MCP, web search, shell/computer-use patterns, and tool choice control. |
| Structured output | JSON Schema / Pydantic / Zod contracts | Structured Outputs are preferred over JSON mode where possible because schema adherence is enforceable. |
| Guardrails | Input, output, and tool guardrails | Tool guardrails matter because agent-level guardrails do not cover every specialist/tool boundary in delegated workflows. |
| Traceability | Agent traces plus OpenTelemetry GenAI conventions | Traces should cover generations, tools, handoffs, guardrails, custom events, and operational spans. |
| Durable HITL | Checkpointed workflow state | LangGraph-style checkpointing is the reference pattern for pause, inspect, approve, resume, replay, and fault tolerance. |
| Tool interoperability | MCP-compatible tool contracts | MCP tools expose schema-described capabilities to models, with human-in-the-loop confirmation for sensitive operations. |

## Reviewer Experience

The reviewer should be able to:

1. Open the live cockpit.
2. Run the golden AI SaaS compliance case.
3. Upload or reference evidence.
4. Watch the agent scan domains, identify gaps, challenge missing evidence, and produce controls.
5. Inspect the trace and audit pack.
6. See why the agent refuses automatic approval.
7. Approve, reject, or request remediation with role-aware controls.
8. Export evidence for the submission pack.

## Operating Model

| Concern | End State |
| --- | --- |
| Identity | Microsoft Entra JWT validation with audience, issuer, tenant, and group/role mapping. |
| RBAC | Reviewer, approver, auditor, domain owner, admin, and read-only roles. |
| Audit | Append-only database records with hash chaining or immutable object export. |
| Evidence | Uploaded files parsed, classified, chunked, cited, and redacted before agent use. |
| Retrieval | Hybrid semantic/keyword retrieval with metadata filters and source-level citations, using the shared Parallax42 `text-embedding-3-large` gateway as the default semantic embedding boundary. |
| Controls | Control recommendations are mapped to owner, due date, evidence requirement, and escalation path. |
| Safety | No automatic approvals, no unsupported certainty, no hidden tool calls, no unapproved write actions. |
| Observability | Trace dashboard, latency, cost, token use, tool calls, fallback rate, eval trend, and incident logs. |
| Portability | Model provider abstraction for Compass, OpenAI, Azure OpenAI, and local/deterministic fallback. |

## Evaluation Standard

The submission should include:

- golden demo replay
- deterministic benchmark suite
- live endpoint health snapshot
- prompt-injection and policy-conflict tests
- unsupported-approval prevention tests
- citation precision tests
- missing-evidence detection tests
- cross-domain obligation mapping tests
- latency and fallback reporting
- trace grading or grader-ready traces

## Current Gaps To Close

| Gap | Why It Matters |
| --- | --- |
| Live LLM-backed CrewAI specialist output is opt-in and advisory. | The wiring exists, but provider credentials, eval gates, and approval policy must be enabled before live output can influence decisions. |
| Evidence upload streams to the backend parser/OCR boundary, calls the shared embedding/index gateway, and stores chunk vectors behind the API. | The deployed product path uses Qdrant; local/FastAPI reproduction still falls back unless Qdrant and embedding env vars are exported. |
| Audit is hash-chained locally but Vercel uses ephemeral `/tmp` unless durable storage is configured. | Enterprise review needs retained records across deployments and function instances. |
| RBAC middleware and JWT validation are implemented, but live Entra config is not set. | Secure authentication must be enabled in the target enterprise environment. |
| Evals are local and deterministic only. | World-class agent delivery requires regression, adversarial, and trace-level evals. |
| Demo video is not recorded. | G42 explicitly asks for "Watch the Agent Work." |

## Source Anchors

- OpenAI tool use and Responses API tools: https://developers.openai.com/api/docs/guides/tools
- OpenAI Agents SDK tracing: https://openai.github.io/openai-agents-python/tracing/
- OpenAI Agents SDK guardrails: https://openai.github.io/openai-agents-python/guardrails/
- OpenAI agent evals: https://developers.openai.com/api/docs/guides/agent-evals
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- CrewAI production architecture: https://docs.crewai.com/en/concepts/production-architecture
- CrewAI Flows: https://docs.crewai.com/en/concepts/flows
- LangGraph persistence and HITL checkpointing: https://docs.langchain.com/oss/python/langgraph/persistence
- MCP tool specification: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- OpenTelemetry GenAI conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/
