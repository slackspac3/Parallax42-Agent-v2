# Watch The Agent Work Demo Script

> Current-state script, reviewed 2026-07-12. Release implementation `457c7c2` passes full `npm run qa` (276/276 Node and 13/13 Python security tests), its CI, Agentathon Preflight, and Pages workflows are green, and this production flow has been rehearsed in an authenticated real browser. The [Azure migration plan](AZURE_MIGRATION_PLAN.md) describes a future hosting target; it is not the current run path.

## Goal

Record a short demo that proves the agent is production-oriented and audit-aware.

## Flow

1. Open the current Vercel demo: <https://parallax42-agent-v2.vercel.app/>. The GitHub Pages build remains a static mirror.
2. Upload or select one of the generated fixture PDFs from `test-fixtures/compliance-documents/`, such as `06_cloud_ai_model_services_statement_of_work.pdf`.
3. Ask: `Can we approve this AI assistant SOW for internal policy search and compliance evidence extraction?`
4. If the chat asks follow-ups, answer with complete phrases:

```text
Primary use case is legal and compliance contract review.
Geography is UAE and US.
Internal employees only.
Only internal contract templates.
Shared multi-tenant SaaS environment.
Not for HR decisions or automated compliance approvals.
```

5. Run Council.
6. Show the decision: `Do not approve yet` or `Continue review with named controls`. Explain that conditional is nonterminal and the Approve action remains disabled until the server returns `approvalEligible: true` after remediation and rerun.
7. Show assertion provenance, evidence gaps/contradictions, the human-review boundary, the case narrative, and the audit pack.
8. Continue with a material case amendment, then run Council a second time without reloading. Show that the server-confirmed case version is retained and the narrative request returns HTTP `200`.

Verified rehearsal baseline: <https://parallax42-agent-v2.vercel.app/> accepted a real PDF upload, indexed and retrieved it through Qdrant, used live Compass intake/advisory output, completed Council, and completed the post-council continuation/rerun from the authoritative server version. This proves the working demo flow; it does not prove immutable or WORM-retained audit.

## Suggested 2:30-3:00 Voiceover

```text
Hi, this is Parallax42 Compliance Intelligence Agent for Use Case 21, Legal Intelligence and Compliance.

Legal, procurement, security, and responsible AI teams often receive vendor contracts and SOWs that mix privacy, security, AI governance, retention, and human approval requirements. The hard part is turning messy evidence into a consistent, auditable decision.

I am uploading a synthetic Cloud AI Model Services Statement of Work. It describes a private enterprise assistant for retrieval, policy question answering, document triage, meeting summaries, and compliance evidence extraction.

I can ask in plain English whether this SOW can be approved. The intake flow asks only for missing context, and the current implementation carries stable active question IDs and fields so short answers are mapped by context instead of only by question wording. For the recording, I am using complete answers: legal and compliance contract review, UAE and US, internal employees only, internal templates only, shared multi-tenant SaaS, and no HR decisions or automated compliance approvals.

Architecturally, there are two surfaces. The current product demo is the browser app and Node API on Vercel, backed by Railway PostgreSQL and Qdrant. A named client of the shared Compass gateway supplies smart intake, advisory specialist responses, and semantic embeddings. Those credentials stay server-side; the browser never receives Compass keys, Qdrant keys, service tokens, or raw embeddings. If the live advisory response is unavailable or invalid, the product records the fallback and continues through deterministic intake and policy logic.

Separately, the submitted evaluator path exposes root run.py, FastAPI on port 8000, POST /run, /health, /metadata, role-gated non-disclosing /logs, /compass/probe, Docker smoke, examples, and local JSONL traces. Node remains the policy owner; Python preserves its decision fields and adds advisory output. That contract is reproduced locally and in CI; it is not hosted by GitHub Pages or Vercel.

Now I run the council. Intake structures the case. Evidence Retrieval reads the SOW signals. Node-based Privacy, Security, and Responsible AI specialists request advisory analysis through Compass. Learning and Precedent adds advisory memory. The deterministic policy path packages the decision and trace. The separate Python CrewAI adapter is optional and is not active in the hosted product path.

The result is a high-risk conditional review package. The SOW has positive controls, such as limits on model training, logging controls, retention boundaries, and human oversight. But the council also identifies blockers such as missing final responsible AI assessment, missing independent robustness evidence, retention approval, and required human signoff before go-live. Because conditions remain, approval eligibility is false and the only final action available is remediation.

This trace shows attempted retrieval, specialist calls, fallbacks, policy evaluation, and packaging. Questions and mentions stay marked as requested or mentioned; only uploaded or server-retrieved passages with provenance can satisfy controls. Contradictory assertions remain visible as blockers. The output is not autonomous legal advice or automatic approval. It is a demo decision pack for human review.

After the first council I add a material fact and rerun. The API returns the authoritative completed snapshot and version, so the follow-up and second council continue without a stale-version failure. Detailed audit is role-gated and tenant-scoped; the removed public logs route returns no records.
```

## Detail Shots To Capture

1. Show domain scan:
   - AI and model governance
   - privacy and data governance
   - technical risk
   - third-party compliance
   - continuity if critical-service terms are present
2. Show blocking gaps:
   - missing DPA
   - unclear model-training data use
   - missing continuity/exit evidence
3. Show evidence IDs, citation-ready snippets, and trace events.
4. Show the Vercel product API health endpoint and Qdrant-backed product evidence memory status without exposing keys.
5. Show the passing Agentathon Preflight Docker job as local/CI evaluator-contract proof. Do not claim a public Railway evaluator or say that GitHub Pages or Vercel hosts the FastAPI `/run` wrapper.
6. Continue the chat with a material update such as `I want to deploy this in Syria as well`; show retained evidence, a pending rerun, the updated authoritative version, and the sanctions/restricted-party gate. Run Council again to prove the two-council path.
7. Open `/api/benchmarks` or the review pack output to show repeatable proof.
8. Mention CrewAI as optional/dry-run unless live CrewAI has been explicitly enabled and verified:

```bash
python3 crewai_adapter/compliance_crew.py --dry-run
```

9. Close with the current boundary: Vercel browser app and Node APIs -> Railway PostgreSQL/Qdrant plus the named shared-Compass client. The separate FastAPI `/run` contract is reproduced locally and in CI; Python CrewAI remains optional.

## Talk Track

This agent does not replace human approval. It standardizes the compliance review path, retrieves and names evidence, identifies missing controls, and produces a review brief. Unsupported proof cannot satisfy controls, conditional is nonterminal, and the server rejects approval unless the Node result explicitly marks the case approval-eligible.

Compass, Qdrant retrieval, governed learning memory, and optional Python CrewAI are advisory inputs. The hosted product currently uses semantic `text-embedding-3-large` vectors through a named shared-gateway client and stores them in Qdrant; deterministic demo embeddings are disabled. Deterministic intake/policy behavior remains available when live advisory output cannot be used. The browser never receives Compass keys, Qdrant keys, service tokens, or raw embeddings. The local FastAPI evaluator falls back unless equivalent gateway and Qdrant variables are configured.

Continuation treats new high-impact facts as case amendments, retains evidence, and requires an explicit rerun. Council completion returns one authoritative case snapshot/version, and the browser replaces local state from it before the next interaction.

## Agentathon Reproduction Path

The product demo is online-first. The root FastAPI path remains the standardized evaluator reproduction surface:

```bash
python run.py
curl http://localhost:8000/health
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
```

GitHub Actions `agentathon-preflight.yml` is the online Docker proof for that path.

## Words To Avoid

Do not say:

```text
Compass approves the case.
The AI makes the legal decision.
This is legal advice.
This supports any scanned PDF.
Enterprise Entra RBAC is enforced.
Qdrant is active everywhere.
Live CrewAI is the default evaluator path.
GitHub Pages hosts /run.
Vercel is the evaluator API.
The self-score is guaranteed.
Conditional approval is an approval.
The audit ledger is immutable/WORM retained.
```

Use instead:

```text
Compass provides advisory intelligence.
The Deterministic Decision Owner makes the final policy decision.
Human review is required.
This demo uses a supported synthetic text-based SOW.
The evaluator contract is reproduced locally and in GitHub Actions through run.py / FastAPI / POST /run; no public evaluator host is currently claimed.
Conditional means remediation and rerun; only explicit approval eligibility permits a human approval action.
PostgreSQL audit is durable and tenant-scoped, while immutable export and enterprise retention remain future gates.
```
