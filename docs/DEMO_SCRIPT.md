# Watch The Agent Work Demo Script

## Goal

Record a short demo that proves the agent is production-oriented and audit-aware.

## Flow

1. Open the online cockpit: <https://slackspac3.github.io/Parallax42-Agentathon-Online-Clone/>.
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

Architecturally, there are two surfaces. The product cockpit is the browser demo through GitHub Pages and hosted product APIs. Compass and evidence-memory credentials stay server-side; the browser never receives Compass keys, Qdrant keys, service tokens, or raw embeddings.

Separately, the submitted evaluator path exposes root run.py, FastAPI on port 8000, POST /run, /health, /metadata, /logs, /compass/probe, Docker smoke, examples, and JSONL traces. The public evaluator API is the Railway URL, not GitHub Pages and not Vercel.

Now I run the council. Intake structures the case. Evidence Retrieval reads the SOW signals. Privacy, Security, and Responsible AI specialists validate and challenge the evidence. Learning and Precedent adds advisory memory. The Compass advisory critic can provide server-side advisory reasoning when configured. Then the Deterministic Decision Owner applies policy and Audit Packager writes the trace.

The result is a high-risk conditional review package. The SOW has positive controls, such as limits on model training, logging controls, retention boundaries, and human oversight. But the council also identifies blockers such as missing final responsible AI assessment, missing independent robustness evidence, retention approval, and required human signoff before go-live.

This trace is the proof: agents retrieve, retry, validate, critique, escalate, and package a decision. The output is not autonomous legal advice or automatic approval. It is an auditable, human-review-ready compliance decision pack with deterministic final decision ownership.
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
5. Show the Railway evaluator URL only as evaluator API proof. Do not say GitHub Pages hosts `/run`.
6. Continue the chat after the council with a material update such as `I want to deploy this in Syria as well`; show that the uploaded evidence remains attached, the previous decision is marked pending rerun, and the next gate is sanctions/restricted-party screening. If using a terse answer such as `Syria`, show the add-or-replace clarification.
7. Open `/api/benchmarks` or the review pack output to show repeatable proof.
8. Mention CrewAI as optional/dry-run unless live CrewAI has been explicitly enabled and verified:

```bash
python3 crewai_adapter/compliance_crew.py --dry-run
```

9. Close with the architecture boundary: GitHub Pages cockpit -> Vercel product APIs -> server-side Compass gateway/API boundary -> Ocean/DigitalOcean backend services -> Qdrant product evidence memory; Railway -> FastAPI evaluator API for `/run`.

## Talk Track

This agent does not replace human approval. It standardizes the compliance review path, retrieves and names evidence, identifies missing controls, blocks unsupported approvals, and produces an audit-ready decision brief.

Compass, Qdrant retrieval, governed learning memory, and optional CrewAI are advisory inputs. The Deterministic Decision Owner remains final authority. The browser never receives Compass keys, Qdrant keys, service tokens, or raw embeddings. Qdrant-backed memory is a hosted product-path claim; the public evaluator currently reports local-fallback RAG unless Qdrant env-specific smoke passes.

When the conversation continues after a council run, the product does not silently overwrite the prior decision. It treats new high-impact facts as add/replace case amendments, retains the evidence, and asks for an explicit rerun before presenting the updated council result as current.

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
RBAC is enforced.
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
The submitted evaluator path is Railway / run.py / FastAPI / POST /run.
```
