# Watch The Agent Work Demo Script

## Goal

Record a short demo that proves the agent is production-oriented and audit-aware.

## Flow

1. Open the online cockpit: <https://slackspac3.github.io/Parallax42-Agentathon-Online-Clone/>.
2. Upload or select one of the generated fixture PDFs from `test-fixtures/compliance-documents/`, such as `06_cloud_ai_model_services_statement_of_work.pdf`.
3. Show the decision: `Do not approve yet` or conditional approval depending on evidence.
4. Show domain scan:
   - AI and model governance
   - privacy and data governance
   - technical risk
   - third-party compliance
   - continuity if critical-service terms are present
5. Show blocking gaps:
   - missing DPA
   - unclear model-training data use
   - missing continuity/exit evidence
6. Show evidence IDs, citation-ready snippets, and trace events.
7. Show the Vercel product API health endpoint and Qdrant-backed evidence memory status without exposing keys.
8. Continue the chat after the council with a material update such as `I want to deploy this in Syria as well`; show that the uploaded evidence remains attached, the previous decision is marked pending rerun, and the next gate is sanctions/restricted-party screening. If using a terse answer such as `Syria`, show the add-or-replace clarification.
9. Open `/api/benchmarks` or the review pack output to show repeatable proof.
10. Mention CrewAI as optional/dry-run unless live CrewAI has been explicitly enabled and verified:

```bash
python3 crewai_adapter/compliance_crew.py --dry-run
```

11. Close with the architecture boundary: GitHub Pages cockpit -> Vercel product APIs -> server-side Compass gateway/API boundary -> Ocean/DigitalOcean backend services -> Qdrant evidence memory.

## Talk Track

This agent does not replace human approval. It standardizes the compliance review path, retrieves and names evidence, identifies missing controls, blocks unsupported approvals, and produces an audit-ready decision brief.

Compass, Qdrant retrieval, governed learning memory, and optional CrewAI are advisory inputs. The Deterministic Decision Owner remains final authority. The browser never receives Compass keys, Qdrant keys, service tokens, or raw embeddings.

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
