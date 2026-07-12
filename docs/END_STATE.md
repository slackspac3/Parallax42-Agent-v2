# End State

The target is not a compliance chatbot. The target is an enterprise-grade compliance intelligence worker that can be evaluated, operated, audited, and safely constrained in production.

The current-state defect register is the [deep code review](DEEP_CODE_REVIEW.md). The selected infrastructure end state, migration stages, rollback gates, and recovery objectives are in the [Azure migration plan](AZURE_MIGRATION_PLAN.md).

## Current Submission Boundary

The final Agentathon submission is an online-first product demo plus a reproducible evaluator wrapper:

- Online product demo: Vercel browser + Node product APIs (with GitHub Pages as a static mirror) -> named Compass gateway client (GPT-5.1 and `text-embedding-3-large`) -> isolated Railway Postgres/Qdrant.
- Evaluator reproduction: root `run.py` / FastAPI / Docker / `POST /run` on port `8000`.
- Compass is used server-side. Browser clients never receive Compass keys, Qdrant keys, service tokens, or raw embeddings.
- Active Node specialists are advisory; Python CrewAI is optional/inactive. Node is the sole final authority and Python preserves its policy fields unchanged.
- Demo RBAC is enforced, but Entra-backed identity, immutable audit retention, arbitrary scanned-PDF OCR, and live Python CrewAI are not claimed.
- Railway Postgres stores case/session/quota records and scoped audit chains. Hosted audit fails closed without Postgres; JSONL is local/test-only. WORM export, restore proof, and business/audit transaction coupling remain open.

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

## Selected Target Architecture

The minimum Azure path keeps the existing Compass gateway and Qdrant during compute/database parity, then moves edge, identity, durable audit, and derived vector search only behind measured gates.

```text
Azure Front Door Premium + WAF
  -> static cockpit origin
  -> API Management Standard v2 (Private Link inbound + VNet-integrated outbound)
      -> internal Azure Container Apps Node API
          -> Node policy engine + active Node specialists
          -> Azure Database for PostgreSQL Flexible Server
          -> Blob Storage evidence/export/audit retention
          -> Azure AI Search derived semantic indexes after shadow validation
          -> existing named Compass gateway client during initial migration
          -> optional parser/evaluator and Python CrewAI only when justified
```

## Agent Runtime

The target runtime is a layered agent stack:

| Layer | End-State Choice | Why |
| --- | --- | --- |
| Workflow spine | Node policy engine | One authoritative decision owner is simpler to test and audit. Python adapters may transform or explain but must not change the Node result. |
| Specialist collaboration | Active Node council; optional Python CrewAI | The hosted trace already shows role-specific agents. Add Python CrewAI only when it produces measured value and passes authority-parity gates. |
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
| Python CrewAI is optional and inactive; Node specialists are live. | Runtime labels must report requested, attempted, and actually executed paths, and Python must not override the Node decision. |
| Evidence index/search APIs call the shared embedding gateway and store chunk vectors behind the API; assertion state/provenance and source-aware contradictions are implemented; the optional parser relay is disabled. | Claim-level source spans, vector-generation controls, canonical documents, and broader groundedness evaluation remain. |
| Hosted audit uses scoped PostgreSQL hash chains with locked heads; local JSONL is development/test-only. | Enterprise review still needs WORM range export, restore drills, schema migrations, and atomic business/audit evidence. |
| Demo RBAC is enforced, but live Entra config is not set. | Enterprise identity needs verified tenant, issuer, audience, app roles, JWKS, and tenant-scoped authorization. |
| P0 adversarial, tenant, parity, audit, and two-council regressions pass locally. | Add deployed authenticated E2E, resource-wide/RLS tests, signed policy hashes, restore/WORM, accessibility, load and live-provider parity. |
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
