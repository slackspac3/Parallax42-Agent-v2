# Watch The Agent Work Demo Script

> Current-state script, reviewed 2026-07-12. Read the [deep code review](DEEP_CODE_REVIEW.md) before treating a demo result as assurance evidence. The [Azure migration plan](AZURE_MIGRATION_PLAN.md) describes a future hosting target; it is not the current run path.

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
6. Show the decision: `Do not approve yet` or conditional approval depending on evidence.
7. Show the agent trace, evidence gaps, human-review boundary, and audit pack.

## Suggested 2:30-3:00 Voiceover

```text
Hi, this is Parallax42 Compliance Intelligence Agent for Use Case 21, Legal Intelligence and Compliance.

Legal, procurement, security, and responsible AI teams often receive vendor contracts and SOWs that mix privacy, security, AI governance, retention, and human approval requirements. The hard part is turning messy evidence into a consistent, auditable decision.

I am uploading a synthetic Cloud AI Model Services Statement of Work. It describes a private enterprise assistant for retrieval, policy question answering, document triage, meeting summaries, and compliance evidence extraction.

I can ask in plain English whether this SOW can be approved. The intake flow asks only for missing context, and the current implementation carries stable active question IDs and fields so short answers are mapped by context instead of only by question wording. For the recording, I am using complete answers: legal and compliance contract review, UAE and US, internal employees only, internal templates only, shared multi-tenant SaaS, and no HR decisions or automated compliance approvals.

Architecturally, there are two surfaces. The current product demo is the browser app and Node API on Vercel, backed by Railway PostgreSQL and Qdrant. A named client of the shared Compass gateway supplies smart intake, advisory specialist responses, and semantic embeddings. Those credentials stay server-side; the browser never receives Compass keys, Qdrant keys, service tokens, or raw embeddings. If the live advisory response is unavailable or invalid, the product records the fallback and continues through deterministic intake and policy logic.

Separately, the submitted evaluator path exposes root run.py, FastAPI on port 8000, POST /run, /health, /metadata, /logs, /compass/probe, Docker smoke, examples, and JSONL traces. That contract is reproduced locally and in CI; it is not hosted by GitHub Pages or Vercel.

Now I run the council. Intake structures the case. Evidence Retrieval reads the SOW signals. Node-based Privacy, Security, and Responsible AI specialists request advisory analysis through Compass. Learning and Precedent adds advisory memory. The deterministic policy path packages the decision and trace. The separate Python CrewAI adapter is optional and is not active in the hosted product path.

The result is a high-risk conditional review package. The SOW has positive controls, such as limits on model training, logging controls, retention boundaries, and human oversight. But the council also identifies blockers such as missing final responsible AI assessment, missing independent robustness evidence, retention approval, and required human signoff before go-live.

This trace shows the attempted retrieval, specialist calls, fallbacks, policy evaluation, and packaging. The output is not autonomous legal advice or automatic approval. It is a demo decision pack for human review. Critical evidence/readiness and tenant-isolation findings in the deep review must be fixed before this output is used as production assurance.
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
6. After the post-council version-hand-off defect in the deep review is fixed and covered by an end-to-end test, continue the chat with a material update such as `I want to deploy this in Syria as well`; show retained evidence, a pending rerun, and the sanctions/restricted-party gate. Until then, keep this shot out of the assurance claim.
7. Open `/api/benchmarks` or the review pack output to show repeatable proof.
8. Mention CrewAI as optional/dry-run unless live CrewAI has been explicitly enabled and verified:

```bash
python3 crewai_adapter/compliance_crew.py --dry-run
```

9. Close with the current boundary: Vercel browser app and Node APIs -> Railway PostgreSQL/Qdrant plus the named shared-Compass client. The separate FastAPI `/run` contract is reproduced locally and in CI; Python CrewAI remains optional.

## Talk Track

This agent does not replace human approval. It is intended to standardize the compliance review path, retrieve and name evidence, identify missing controls, and produce a review brief. Do not claim that unsupported approvals are reliably blocked until the evidence/readiness defects in the deep review are closed.

Compass, Qdrant retrieval, governed learning memory, and optional Python CrewAI are advisory inputs. The hosted product currently uses semantic `text-embedding-3-large` vectors through a named shared-gateway client and stores them in Qdrant; deterministic demo embeddings are disabled. Deterministic intake/policy behavior remains available when live advisory output cannot be used. The browser never receives Compass keys, Qdrant keys, service tokens, or raw embeddings. The local FastAPI evaluator falls back unless equivalent gateway and Qdrant variables are configured.

The intended continuation behavior is to treat new high-impact facts as case amendments, retain evidence, and require an explicit rerun. A stale-version defect currently breaks the next interaction after some council runs; use the tested single-run path until that review finding is fixed.

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
```

Use instead:

```text
Compass provides advisory intelligence.
The Deterministic Decision Owner makes the final policy decision.
Human review is required.
This demo uses a supported synthetic text-based SOW.
The evaluator contract is reproduced locally and in GitHub Actions through run.py / FastAPI / POST /run; no public evaluator host is currently claimed.
```
