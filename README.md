# Parallax42 Compliance Intelligence Agent

Production-oriented submission workspace for the G42 Compliance Intelligence Agent role.

This repo is the clean build surface for packaging the existing Parallax42 work into a role-aligned agent:

- compliance-domain intake and triage
- evidence-backed obligation mapping
- human-review decision briefs
- traceable control recommendations
- enterprise integration and deployment evidence
- Responsible AI and benchmark artifacts

Hackathon positioning: this submission maps to **Use Case #21: Legal Intelligence / Compliance**. The primary workflow is enterprise agreement and vendor-evidence review: uploaded agreements, DPAs, MSAs, SOC/ISO/BCP evidence, and advisory legal-reference context are converted into a human-review decision pack. The Caselaw Access Project data path is implemented as advisory legal-reference memory, not as legal advice or automated approval.

Agent positioning: the system is intentionally **L2 governed autonomy**. It can loop through intake, evidence retrieval, obligation mapping, risk/control analysis, and review-pack generation, but it stops at missing evidence, low output-rubric score, or accountable human approval. The council is expressed as agentic pairings such as Planner + Doer, Proposer + Critic, Context-Packer + Actor, and Evidence-Weaver + Synthesizer, with deterministic decisioning as the final owner.

Memory is separated into scratchpad state, episodic audit/reviewer logs, and reusable advisory knowledge. Governed learning memory and reference intelligence can improve questions and reviewer suggestions, but they do not train a model or silently change the deterministic decision.

The implementation defaults to deterministic compliance decisions, with CrewAI-shaped dry-run manifests and optional advisory integrations kept behind explicit configuration.

## Judge Quick Start

The judge demo is intended to be run online first:

| Demo surface | Link | Purpose |
| --- | --- | --- |
| GitHub Pages cockpit | <https://slackspac3.github.io/Parallax42-Agent-v2/> | Primary browser demo for chat intake, fixture upload, evidence memory, council run, and review pack. |
| Vercel product API health | <https://parallax42-agent-v2.vercel.app/api/health> | Shows hosted runtime status, Compass gateway configuration, Qdrant feature status, parser relay status, and advisory runtime flags without exposing secrets. |
| GitHub source | <https://github.com/slackspac3/Parallax42-Agent-v2> | Root `run.py`, Dockerfile, examples, logs, docs, workflows, and source evidence for this submission clone. |
| Agentathon Preflight workflow | <https://github.com/slackspac3/Parallax42-Agent-v2/actions/workflows/agentathon-preflight.yml> | Online Docker plus `/health` and `/run` proof for the root FastAPI evaluator wrapper. |

The online product cockpit uses GitHub Pages for the static UI, Vercel for server-side product APIs, and an isolated Railway project for Postgres session/case state plus Qdrant vector storage. The public demo uses explicitly labelled deterministic hash embeddings so evidence indexing/retrieval remains testable without a model credential. Compass-powered smart intake, semantic embeddings, and advisory calls remain optional server-side capabilities and are reported as unavailable when a valid credential is not configured. Local commands are secondary reproduction tools.

Final submission positioning:

- The judge-facing product demo is online-first: GitHub Pages cockpit -> Vercel product APIs -> isolated Railway Postgres/Qdrant services, with the Compass gateway added server-side when configured.
- The root FastAPI/Docker path remains the evaluator reproduction path: `run.py` exposes `GET /health`, `GET /metadata`, `GET /logs`, `GET /compass/probe`, and `POST /run` on port `8000`.
- The FastAPI evaluator is a reproducible local/Docker/CI surface. v2 does not claim the legacy public Railway evaluator as its own deployment; GitHub Pages is static and Vercel hosts the product APIs.
- GitHub Actions Docker smoke remains the independent reproducibility proof: it builds the repo image, starts `python run.py`, and calls `/health` plus `/run` inside CI.
- Compass is used server-side. The browser never receives Compass keys, Qdrant keys, or raw embeddings.
- The deployed product path always runs the real deterministic compliance engine. Compass-backed smart intake/advisory calls and embeddings are enabled only when a rotated server-side credential is configured; their absence never becomes a fake model result. The direct `OPENAI_API_KEY` / `OPENAI_BASE_URL` path is preserved for evaluator-style FastAPI execution and strict diagnostics.
- Deterministic Decision Owner remains final authority. Compass, governed learning memory, Qdrant retrieval, and optional CrewAI outputs are advisory inputs, not autonomous approvals.

Suggested demo prompt:

```text
Assess whether we can onboard a UAE healthcare analytics vendor using patient data, Microsoft 365, and cross-border cloud processing.
```

Suggested demo steps:

1. Attach a synthetic compliance document from `test-fixtures/compliance-documents/`, for example `02_data_processing_addendum_and_cross_border_terms.pdf`.
2. Run Council.
3. Review the decision memo.
4. Export Executive Review Pack PDF.

### Secondary: Local Cockpit

Use local commands only when reproducing or extending the online demo:

```bash
npm install
npm run qa
npm run dev
```

Open:

```text
http://localhost:3000
```

The local server defaults to `http://127.0.0.1:3020`. If the judging environment expects port `3000`, start it with:

```bash
PORT=3000 npm run dev
```

## Agentathon Evaluation

Selected use case: **21 Legal Intelligence**.

The existing product runtime is still the Node/CommonJS app under `server.js`, `api/`, `lib/`, and `public/`. For Agentathon screening, the repo root also includes a Python FastAPI wrapper that starts on `0.0.0.0:8000`, exposes `GET /health`, `GET /metadata`, `GET /logs`, `GET /compass/probe`, and `POST /run`, then delegates deterministic execution to `scripts/agentathon_run.js`.

For the consolidated judge-facing architecture, see [`docs/AGENTATHON_SYSTEM_ARCHITECTURE.md`](docs/AGENTATHON_SYSTEM_ARCHITECTURE.md).

### Primary: Online GitHub Review

The intended submission review path is online-first. Reviewers should start with the GitHub repository, hosted cockpit, and GitHub Actions evidence before running anything locally:

| Online item | Link | What to verify |
| --- | --- | --- |
| Source repository | <https://github.com/slackspac3/Parallax42-Agent-v2> | Root `run.py`, `Dockerfile`, `metadata.json`, examples, logs, docs, and workflows are present on `main`. |
| GitHub Pages cockpit | <https://slackspac3.github.io/Parallax42-Agent-v2/> | Static product cockpit loads and uses hosted product routes from `public/config.js`. |
| Vercel product API | <https://parallax42-agent-v2.vercel.app/api/health> | Hosted product runtime reports Compass gateway, Qdrant, parser relay, learning memory, and advisory runtime status. |
| Agentathon Preflight workflow | <https://github.com/slackspac3/Parallax42-Agent-v2/actions/workflows/agentathon-preflight.yml> | Latest run should show `agentathon-preflight` and `docker-smoke` jobs passing. This is the online proof that Docker builds, the container starts, `GET /health` works, and `POST /run` works in CI sample mode. |
| CI workflow | <https://github.com/slackspac3/Parallax42-Agent-v2/actions/workflows/ci.yml> | Latest run should pass `npm run qa` after Node, Python, and Playwright setup. |
| Pages deployment workflow | <https://github.com/slackspac3/Parallax42-Agent-v2/actions/workflows/pages.yml> | Latest run should deploy the static cockpit to GitHub Pages when `public/` changes. |
| Architecture doc | <https://github.com/slackspac3/Parallax42-Agent-v2/blob/main/docs/AGENTATHON_SYSTEM_ARCHITECTURE.md> | Evaluator path, product path, Compass boundaries, Qdrant/local fallback, learning memory, optional CrewAI, and safe/unsafe claims are documented together. |
| Metadata | <https://github.com/slackspac3/Parallax42-Agent-v2/blob/main/metadata.json> | Use Case 21 metadata, agents, tools, and endpoint declarations are visible. |
| Input examples | <https://github.com/slackspac3/Parallax42-Agent-v2/tree/main/input_examples> | At least three valid synthetic JSON inputs are committed. |
| Output examples | <https://github.com/slackspac3/Parallax42-Agent-v2/tree/main/output_examples> | Runtime-generated outputs differ by case and include trace/log references. |
| Trace logs | <https://github.com/slackspac3/Parallax42-Agent-v2/tree/main/logs> | JSONL traces show delegation, retry/fallback, critique, validation, escalation, shared context, and final synthesis. |

Important boundary: GitHub Pages is static, so it does not run the root FastAPI `run.py` server or expose `POST /run` from the Pages URL. v2 currently proves the evaluator contract through the Agentathon Preflight workflow: CI builds the image, starts the container on port `8000`, calls `GET /health`, and posts `input_examples/example_1.json` to `/run`.

### FastAPI Evaluator Hosting Status

| Surface | Status | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Root `run.py` in repo | Implemented | The required FastAPI evaluator wrapper exists and starts on `0.0.0.0:8000`. | It is not an internet-hosted URL by itself. |
| GitHub Actions `agentathon-preflight.yml` | Active proof | Docker builds, `python run.py` starts in the container, `GET /health` works, and `POST /run` works against `input_examples/example_1.json`. | It does not make FastAPI publicly browsable outside the CI job. |
| GitHub Pages cockpit | Product demo | Browser product experience, chat intake, evidence upload, council view, review pack. | It is static and does not host FastAPI. |
| Vercel product API | Product runtime | Online Node/Vercel product APIs, isolated session/case state, Qdrant-backed deterministic retrieval, and optional Compass/CrewAI paths. | It is not the root `run.py` FastAPI evaluator API. |
| Isolated Railway services | Product persistence only | Postgres session/case lifecycle state and authenticated Qdrant storage. | They are not the Agentathon FastAPI evaluator. |

This is intentional for the v2 demo: the repository and Docker workflow prove evaluator reproducibility, while the public cockpit and Vercel API show the richer product workflow. Reproduce the evaluator locally with:

```bash
python run.py
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
```

Safe claim today: FastAPI is implemented and independently verified by CI/Docker. GitHub Pages is the product cockpit, Vercel is the product API, and the dedicated Railway v2 services provide product persistence rather than a public evaluator.

### Secondary: Local Run

Use local commands only after the online repository, workflows, and hosted cockpit have been reviewed, or when reproducing a CI result on a development machine.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install
python run.py
```

Call the evaluator path:

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
```

Docker:

```bash
docker build -t parallax42-agentathon .
docker run --rm -p 8000:8000 \
  -e SAMPLE_MODE=true \
  -e OPENAI_BASE_URL=https://compass.core42.ai/v1 \
  -e OPENAI_API_KEY=dummy \
  parallax42-agentathon
```

Successful Docker smoke means the container starts, `GET /health` returns JSON with `ok=true`, and `POST /run` with `input_examples/example_1.json` returns structured JSON. The local preflight Docker check prints `DOCKER_LOCAL=PASS`, `DOCKER_LOCAL=FAIL`, or `DOCKER_LOCAL=SKIPPED_DOCKER_CLI_MISSING`:

```bash
python scripts/agentathon_preflight.py --docker
```

GitHub Actions runs Docker verification in `.github/workflows/agentathon-preflight.yml` with `SAMPLE_MODE=true`, `OPENAI_API_KEY=dummy`, and the official Compass base URL so no real secrets are required in CI. Verify the latest remote result with:

```bash
gh run list --workflow agentathon-preflight.yml --limit 5
gh run view <run-id> --log-failed
```

## Online Product And Submission Tests

To test the online product cockpit:

1. Open <https://slackspac3.github.io/Parallax42-Agent-v2/>.
2. Confirm the status panel can reach the configured hosted product routes from `public/config.js`.
3. In chat, enter a compliance scenario such as:

```text
Review an AI accelerator import for UAE and Singapore. The supplier will ship restricted hardware, provide firmware support, and has no final end-use certificate.
```

4. If the cockpit asks for export origin, answer:

```text
from the US
```

The expected behavior is that the chat records the export-origin jurisdiction, keeps the import geography as UAE/Singapore, and advances instead of repeating the same question. If an unrelated answer is given, the chat should say it could not map the answer to the active question and ask for clarification again.

The current conversation payload carries stable active question metadata (`activeQuestionId`, `activeQuestionField`, and `questionMetadata`) so terse or natural answers are mapped by field context rather than only by matching the visible question text. Regression coverage includes answers such as `all of them` for review focus and `shared saas environment` for hosting model. For demo reliability, still use complete answers when recording:

```text
Primary use case is legal and compliance contract review.
Geography is UAE and US.
Internal employees only.
Only internal contract templates.
Shared multi-tenant SaaS environment.
Not for HR decisions or automated compliance approvals.
```

Post-council continuation behavior is intentionally stateful. After the council has run, follow-up chat turns keep the uploaded evidence, prior case facts, and prior decision result attached to the same case. If the user adds a material fact such as an additional geography, new AI user group, or changed scope, the cockpit marks the previous result as pending rerun instead of silently treating it as current. Clear additive language such as `also`, `as well`, or `in addition` appends to the prior case. Clear replacement language such as `replace`, `instead`, or `change to` replaces the prior value. Ambiguous post-council answers ask whether the new fact should be added or used as a replacement before the case is mutated.

Suggested continuation smoke after a council run:

```text
I want to deploy this in Syria as well
```

Expected behavior: the prior evidence stays attached, the right rail shows `Case updated after council`, sanctions/restricted-party screening becomes the next contextual gate, and the prior council result is marked for rerun. For a terse ambiguous answer such as `Syria`, expected behavior is an add-or-replace clarification before the case changes.

To test online Qdrant-backed evidence memory without exposing any Qdrant key, use the Vercel product API. The server holds the encrypted Qdrant credentials and returns only sanitized evidence snippets:

```bash
curl https://parallax42-agent-v2.vercel.app/api/health

curl -X POST https://parallax42-agent-v2.vercel.app/api/evidence/index \
  -H "Content-Type: application/json" \
  -d '{"caseId":"judge-online-qdrant-smoke","documents":[{"evidenceId":"judge-smoke-001","title":"Synthetic Qdrant Smoke Evidence","text":"The vendor is prohibited from using customer data for model training. The DPA lists subprocessors and a 30-day deletion SLA."}]}'

curl -X POST https://parallax42-agent-v2.vercel.app/api/evidence/search \
  -H "Content-Type: application/json" \
  -d '{"caseId":"judge-online-qdrant-smoke","query":"model training exclusion subprocessors deletion SLA","topK":3}'
```

Expected online Qdrant indicators:

```text
provider=qdrant
storage=server_side_qdrant_vector_db
collection=p42_compliance_evidence_v2
model=text-embedding-3-large
browserEmbeddingsRetained=false
matches >= 1
```

The isolated Railway Qdrant endpoint requires an API key. Judges should not need direct Qdrant credentials; the Vercel product API is the intended proof path.

To test the online Agentathon submission proof:

1. Open <https://github.com/slackspac3/Parallax42-Agent-v2/actions/workflows/agentathon-preflight.yml>.
2. Select the latest run on `main`.
3. Confirm both jobs pass:
   - `agentathon-preflight`
   - `docker-smoke`
4. In `docker-smoke`, confirm the log includes:
   - `docker build -t parallax42-agentathon .`
   - container run with `SAMPLE_MODE=true`
   - successful `curl http://127.0.0.1:8000/health`
   - successful `curl -X POST http://127.0.0.1:8000/run ... -d @input_examples/example_1.json`

CI uses sample mode and a dummy key so secrets are not exposed in GitHub Actions. Final live Compass verification still requires a deployment/runtime with:

```text
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
SAMPLE_MODE=false
REQUIRE_COMPASS=true
```

Compass/OpenAI-compatible variables are placeholders in `.env.example`:

```text
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
# Alternate if Core42/Agentathon confirms the issued key for this base:
# OPENAI_BASE_URL=https://api.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
EMBEDDING_MODEL=text-embedding-3-large
SAMPLE_MODE=false
REQUIRE_COMPASS=true
AGENT_RUNTIME=custom
CREWAI_ENABLE_LIVE_LLM=0
```

### Compass Model And Key Selection

The submitted system uses Core42 Compass as the server-side LLM and embedding runtime. `.env.example` keeps the official Agentathon template value `https://compass.core42.ai/v1` as the active placeholder. The runtime also accepts the alternate Core42 public API base `https://api.core42.ai/v1` when Core42/Agentathon confirms that base for the issued key.

Current model split:

| Purpose | Env var | Current value | Why |
| --- | --- | --- | --- |
| Fast structured intake and advisory JSON | `MODEL_FAST`, `MODEL_NAME` | `gpt-4.1` | Used for lower-latency structured tasks, JSON repair, and simple advisory checks. |
| Deeper specialist/council reasoning | `MODEL_REASONING`, `REASONING_MODEL_NAME`, `CREWAI_LLM_MODEL` | `gpt-5.1` | Used for richer privacy/security/Responsible AI/CrewAI advisory analysis where reasoning depth matters more than speed. |
| Evidence and reference retrieval | `EMBEDDING_MODEL`, `EMBEDDINGS_MODEL` | `text-embedding-3-large` | Used for server-side embeddings into Qdrant/reference memory. Raw embeddings are never returned to the browser. |

Credential boundary:

- The deployed public demo uses deterministic intake/decisioning and labelled hash embeddings; a rotated Compass credential can be added server-side for optional smart intake, semantic embeddings, and advisory output.
- The repo does not contain a real Compass key.
- The system does not depend on an Agentathon-provided key being committed or available locally.
- If evaluators provide their own Compass key, they can set `OPENAI_API_KEY` with the official template `OPENAI_BASE_URL=https://compass.core42.ai/v1`, or use `https://api.core42.ai/v1` if Core42/Agentathon confirms that base for the issued key.
- Compass is the model runtime only; official/public reference anchors remain the source context for legal, compliance, security, RAI, sanctions/export, procurement, and HSE/ESG reasoning.

No secrets are committed. `SAMPLE_MODE=true` is accepted for CI/local reproducibility, but it does not switch to canned outputs; the wrapper still runs the deterministic Node rules engine and Python council. With `SAMPLE_MODE=false`, `/run` attempts a live Compass/OpenAI-compatible advisory call when `OPENAI_API_KEY` is configured. That advisory is recorded as advisory only; the Deterministic Decision Owner remains final authority. Qdrant is verified active for the deployed Vercel product path through the isolated Railway v2 service and deterministic demo embeddings; local and FastAPI checks still require their own vector-store env. Enterprise SSO and live CrewAI remain separate claims unless their configured runtime checks pass.

Known limitations: the Agentathon path returns structured JSON and trace logs, not the browser cockpit; the decision is a human-review compliance package, not legal advice or automatic approval; Compass failures return structured `live_compass.status=unavailable`; local `python scripts/qdrant_smoke.py` reports `SKIPPED` unless local Qdrant and embedding env vars are exported; live CrewAI is not part of the default Docker dependency set.

Live Compass boundary:

- **Agentathon evaluation path:** `run.py` uses the OpenAI-compatible Compass environment contract: `OPENAI_API_KEY` plus the official template `OPENAI_BASE_URL=https://compass.core42.ai/v1`. The same runtime also accepts `https://api.core42.ai/v1` when confirmed for the issued key. This is the path used by `/run`, `/compass/probe`, `scripts/compass_doctor.py`, and optional Compass embeddings for Qdrant. It exists because the technical screening expects a reproducible root-level API that can be run in Docker without browser clicks or private hosted services.
- **Product demo path:** the existing Node/Vercel application may use `COMPASS_GATEWAY_BASE_URL` and `COMPASS_GATEWAY_TOKEN` for server-side smart intake, embeddings, and hosted-demo workflows. That Vercel gateway is product infrastructure, not the official Agentathon Compass base URL unless it is explicitly configured to expose OpenAI-compatible `/v1` routes.
- **Optional backend path:** `PARALLAX42_BACKEND_URL` can support parser/OCR relay and optional remote CrewAI services. It is not a Compass API and should not be set as `OPENAI_BASE_URL`.
- **Product persistence path:** deployed v2 uses isolated Railway Postgres plus authenticated Qdrant. Vercel stores both credentials encrypted and returns only sanitized records/snippets to the browser.
- **Why the split exists:** the product keeps its richer hosted architecture, while the Agentathon wrapper exposes judgeable equivalent behavior: deterministic final decisioning, advisory Compass hooks, multi-agent trace logs, and structured fallback when live Compass is unavailable. This avoids rewriting the Node product while satisfying the evaluator's API shape.

Compass diagnostics:

```bash
python scripts/compass_doctor.py --json
python scripts/compass_doctor.py --strict
curl http://localhost:8000/compass/probe
```

`OPENAI_BASE_URL` is normalized for the direct Compass path. The active `.env.example` placeholder is the official Agentathon template `https://compass.core42.ai/v1`. The runtime also accepts `https://api.core42.ai/v1`, which has been useful where Core42-issued keys target the public OpenAI-compatible API base. Duplicate `/v1/v1` and known frontend URLs are rejected. If `OPENAI_BASE_URL` is not exported, `compass_doctor.py` reports that the default is used only for normalization and is not live proof. The optional Parallax42 Vercel gateway uses `COMPASS_GATEWAY_BASE_URL` and `COMPASS_GATEWAY_TOKEN` in the existing Node product runtime. It is not the Agentathon direct Compass path unless explicitly configured as an OpenAI-compatible `/v1` endpoint and allowed by the rules.

The online demo is currently configured with the project owner's Compass key, not a key issued by the Agentathon organizers. This is intentional: the repo exposes the standard `OPENAI_API_KEY` / `OPENAI_BASE_URL` contract so the same code can run with the owner's key, an evaluator-provided key, or a future managed secret. The browser never receives that key.

## Fixture Contract Demo Inputs

The repo includes six synthetic, generated, text-based PDFs under `test-fixtures/compliance-documents/`. They are not real contracts and contain no confidential company or patient data:

- `01_enterprise_saas_master_services_agreement.pdf`
- `02_data_processing_addendum_and_cross_border_terms.pdf`
- `03_ai_accelerator_chip_import_export_control_agreement.pdf`
- `04_managed_platform_integration_services_agreement.pdf`
- `05_media_buying_and_audience_analytics_order_form.pdf`
- `06_cloud_ai_model_services_statement_of_work.pdf`

These fixtures can be uploaded in the product cockpit for a reliable demo, or referenced directly by Agentathon `/run` JSON through `input.documents[].filename` or `input.documents[].path`. The wrapper safely resolves only manifest-listed files under `test-fixtures/compliance-documents/`, rejects path traversal and hosted dashboard URLs, extracts text from the generated PDF text streams when possible, and falls back to fixture metadata if extraction fails. This is not a claim of arbitrary scanned-PDF OCR.

Validate the full fixture matrix:

```bash
python scripts/fixture_demo_matrix.py
python scripts/agentathon_preflight.py
npm run qa
```

`scripts/fixture_demo_matrix.py` runs all six fixture inputs through the actual council, asserts risk domains, missing evidence, required action keywords, human-review boundary, trace collaboration, and no raw embedding leakage, then writes fresh outputs under `output_examples/fixture_*_output.json` and traces under `logs/fixture_*_trace.jsonl`.

## Azure Migration Path

The current submitted version is GitHub/Vercel/Docker-oriented. It can be migrated to Azure without changing the core product architecture by moving each runtime boundary to the closest Azure service and keeping the same environment contracts.

Recommended Azure target:

| Current component | Azure target | Notes |
| --- | --- | --- |
| GitHub Pages static cockpit in `public/` | Azure Static Web Apps or Azure Storage static website + Azure Front Door | Hosts the same browser cockpit. The browser still receives no Compass, Qdrant, or backend secrets. |
| Node/Vercel APIs in `api/` and local `server.js` mirror | Azure App Service for Node.js, Azure Functions, or Azure Container Apps | Keeps the product API, conversation endpoint, evidence endpoints, review-pack endpoint, and backend relay server-side. |
| FastAPI Agentathon wrapper in `run.py` / `app/` | Azure Container Apps or Azure App Service for Containers | Uses the existing `Dockerfile`; exposes port `8000`; keeps `/health`, `/metadata`, `/logs`, `/compass/probe`, and `/run`. |
| Docker image | Azure Container Registry | Build from GitHub Actions or Azure DevOps, then deploy to Container Apps/App Service. |
| Compass and gateway secrets | Azure Key Vault + managed identity or App Service/Container App secrets | Store `OPENAI_API_KEY`, `COMPASS_GATEWAY_TOKEN`, `QDRANT_API_KEY`, and auth secrets outside code. |
| Product Compass gateway | Azure Container Apps, Azure Functions, or API Management-backed service | Preserve the server-side gateway role. Do not expose model keys to the browser. |
| Qdrant vector memory | Managed Qdrant, Qdrant on AKS/Container Apps, or Azure AI Search vector index | Qdrant remains optional unless `P42_VECTOR_STORE_PROVIDER=qdrant` and smoke tests pass. Azure AI Search would require an adapter before claiming parity. |
| Local JSONL audit and logs | Azure Blob Storage, Azure Files, or Log Analytics | Local logs are sufficient for Agentathon; production audit should use durable managed storage. |
| Parser/OCR backend or droplet | Azure Container Apps/App Service plus Azure Document Intelligence if adopted | Current repo does not claim production OCR. Add this only as a server-side boundary. |
| Auth/RBAC audit mode | Microsoft Entra ID, JWKS validation, App Service Authentication, and route policy enforcement | The repo has audit-mode/auth scaffolding; enforced RBAC should only be claimed after Entra/JWKS validation is configured and tested. |
| Observability | Application Insights + Log Analytics | Track `/run`, `/api/conversation`, gateway calls, retrieval, and audit-pack generation without logging secrets or raw embeddings. |

Minimal Azure deployment sequence:

1. Build the existing Docker image and push it to Azure Container Registry.
2. Deploy the FastAPI Agentathon wrapper to Azure Container Apps or App Service for Containers with `PORT=8000`.
3. Configure server-side secrets through Key Vault or Container App/App Service secret settings:

```text
OPENAI_API_KEY=<Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
EMBEDDING_MODEL=text-embedding-3-large
SAMPLE_MODE=false
REQUIRE_COMPASS=true
LOG_DIR=/logs
```

4. Deploy the product Node API separately to App Service/Functions/Container Apps, or keep Vercel during transition.
5. Deploy the static cockpit to Azure Static Web Apps and set its runtime config to the Azure-hosted API/gateway URLs.
6. If durable RAG is required, configure Qdrant or build an Azure AI Search adapter, then run the smoke test before claiming active vector memory.
7. Wire Entra ID/JWKS auth and route policies before claiming enforced RBAC.
8. Validate with the same online-first checks: `/health`, `/metadata`, `/compass/probe`, `/run`, Docker/container logs, no-secret scan, and generated trace logs.

Azure verification commands after deployment should mirror the existing checks:

```bash
curl https://<agentathon-api-host>/health
curl https://<agentathon-api-host>/metadata
curl https://<agentathon-api-host>/compass/probe
curl -X POST https://<agentathon-api-host>/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
```

Safe Azure claims after this migration:

- The same Agentathon FastAPI wrapper can run as an Azure containerized API.
- The same product cockpit can be hosted as an Azure static app.
- Secrets can move from Vercel/GitHub runtime settings into Azure Key Vault or Azure app secrets.
- Qdrant, Entra RBAC, production OCR, and durable audit should remain separate claims until configured and smoke-tested in Azure.

## Agentathon Preflight

Run the local submission checks:

```bash
python scripts/agentathon_preflight.py
python scripts/agentathon_preflight.py --run-api
python scripts/agentathon_preflight.py --run-api --npm-qa
python scripts/agentathon_preflight.py --compass-doctor
python scripts/agentathon_preflight.py --qdrant-smoke
python scripts/agentathon_preflight.py --docker
```

The Docker check requires a machine with Docker installed. Some local Codex environments do not include the Docker CLI; in that case `--docker` reports `SKIPPED` with the reason rather than failing the whole preflight.

Regenerate judge-facing output examples and matching logs after changing the `/run` path:

```bash
python scripts/regenerate_agentathon_artifacts.py
```

This executes the actual orchestrator for `example_1`, `example_2`, and `example_3`, writes `output_examples/example_*_output.json`, copies matching stable logs to `logs/example_*_trace.jsonl`, and updates `logs/demo_trace.jsonl`. The preflight checks that each output example's `trace_id` matches its referenced log file.

`SAMPLE_MODE=true` is a fallback/testing flag only. It must not be presented as live Compass execution, and it still runs the simplified deterministic Node rules path rather than returning canned output files. Final evaluation should provide:

```text
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
EMBEDDING_MODEL=text-embedding-3-large
SAMPLE_MODE=false
REQUIRE_COMPASS=true
AGENT_RUNTIME=custom
```

In final non-sample evaluation, the wrapper sends sanitized case facts, evidence summaries, specialist findings, and the deterministic draft to Compass for advisory critique. Compass can add reviewer questions and advisory notes, but it cannot approve, reject, or override the deterministic final decision.

Optional live CrewAI for the Agentathon `/run` path is separate from the stable custom orchestrator:

```text
AGENT_RUNTIME=crewai_live
CREWAI_ENABLE_LIVE_LLM=1
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
```

CrewAI is imported lazily and is not installed by the default Docker build. Install `requirements-crewai.txt` only when validating the optional live path. If CrewAI fails to import or execute, `/run` records `live_advisory.status=unavailable` and continues through the custom deterministic path. CrewAI specialist cards are advisory only and cannot override the Deterministic Decision Owner.

Optional Qdrant evidence memory for the Agentathon `/run` path:

```text
P42_VECTOR_STORE_PROVIDER=qdrant
QDRANT_URL=https://<cluster>.cloud.qdrant.io
QDRANT_API_KEY=<server-side-vector-db-key>
QDRANT_COLLECTION=p42_compliance_evidence_v2
QDRANT_VECTOR_SIZE=3072
RAG_CHUNK_SIZE=900
RAG_CHUNK_OVERLAP=120
```

With those values plus the official Compass embedding env vars, `/run` chunks synthetic/input evidence, embeds through Compass, stores case-scoped chunks in Qdrant, searches by `caseId`, and returns only citation-safe snippets. Raw embeddings are never returned to the browser/API caller. Without Qdrant or embeddings, the Agentathon wrapper uses `provider=local-fallback`, which is useful for CI/demo reproducibility but is not durable production RAG.

```bash
python scripts/qdrant_smoke.py
python scripts/agentathon_preflight.py --qdrant-smoke
```

Governed learning memory for the Agentathon `/run` path stores synthetic reviewer outcomes, feedback, control patterns, decision overrides, and evidence-quality notes as advisory artifacts. It is not model training, autonomous self-learning, or silent policy modification. The Deterministic Decision Owner remains final authority and can only use learning memory to surface reviewer questions or controls that are already supported by current evidence gaps.

When Qdrant and Compass embeddings are configured, learning artifacts use the same server-side Qdrant boundary with `memoryType=learning_artifact` payloads. Without Qdrant, the wrapper reads `data/sample_learning_memory.json` and optional local JSONL feedback through `provider=local-jsonl`. API responses return sanitized similar cases and controls only; raw embeddings are never returned.

Learning endpoints:

```bash
curl http://localhost:8000/learning/memory/status
curl -X POST http://localhost:8000/learning/similar-cases \
  -H "Content-Type: application/json" \
  -d '{"caseFacts":{"workflow":"healthcare analytics"},"missingEvidence":["model-training exclusion"],"domains":["privacy","ai-governance"]}'
curl -X POST http://localhost:8000/learning/control-suggestions \
  -H "Content-Type: application/json" \
  -d '{"caseFacts":{"workflow":"AI support-ticket classifier"},"missingEvidence":["model-training exclusion"],"domains":["ai-governance"]}'
```

Troubleshooting Compass:

- HTML from `/models` means `OPENAI_BASE_URL` is probably a frontend or gateway URL, not an OpenAI-compatible API base.
- HTML from `/models` can also mean the key/base URL is routing to a portal or proxy instead of the OpenAI-compatible Compass API.
- `405` from `/chat/completions` usually means the path/base URL/proxy is wrong or the gateway is not exposing the OpenAI-compatible route directly.
- `SAMPLE_MODE=true` is enough for CI shape checks, but not enough for final judging of the live Compass path.
- Use `REQUIRE_COMPASS=true` for final verification when you want `/run` to return a structured error if live Compass advisory is unavailable.

## What This Demo Does Not Claim

- The product runtime is not rewritten as Python; FastAPI is only the Agentathon evaluation wrapper.
- This repository does not include Redis, Postgres, Celery, or durable queues.
- Without the optional remote Python CrewAI service, the product runtime degrades to deterministic decisioning plus CrewAI-shaped dry run.
- Live Compass advisory output is optional outside final evaluation credentials and remains advisory only.
- Qdrant is active in the deployed Vercel product evidence API; local/FastAPI runtimes require Qdrant and embedding env vars or they fall back to local-file storage.
- Governed learning memory is advisory reviewer memory only; it is not model training, autonomous approval, or policy mutation.
- OCR/parser capability is integrated through external relay paths rather than implemented as a local parser service in this repo.
- OpenClaw is not implemented and should not be claimed.

## Current Status

Implemented in this repo:

- `POST /api/conversation` NLP case-builder endpoint that asks follow-up questions and executes the agent workflow when ready
- `POST /api/agent/run` CrewAI Flow-routed compliance-agent run with deterministic fallback
- `POST /api/evidence/index` and `POST /api/evidence/search` server-side retrieval boundary: gateway embeddings and indexed chunks stay behind the API; the browser receives case/evidence/index metadata plus safe snippets/citations needed for the reviewer UI
- `GET /api/readiness` submission-readiness inventory
- `GET /api/health` runtime and linked-platform status
- Vercel-compatible serverless API functions under `api/`
- allowlisted browser relay for an optional configured Parallax42 backend at `GET/POST /api/backend`
- GitHub Pages static cockpit with chat-first agent mode and advanced runtime controls
- browser cockpit for conversational case building, agent execution, evidence, gaps, and trace events
- CrewAI Flow adapter plus six role-specific agents and YAML task definitions
- local benchmark endpoint and audit JSONL persistence
- generated evidence capture under `evidence/`
- replayable golden demo workflow at `GET /api/demo/golden`
- unit tests and syntax checks
- initial G42 submission dossier under `docs/`

Optional prior-demo endpoints, not required for Agentathon evaluation:

- Parallax42 demo UI: `https://slackspac3.github.io/Parallax42/`
- External Parallax42 backend health: `https://api.parallax42.bhavukarora.com/health`
- Compass gateway: `https://parallax42-compass-gateway.vercel.app/api/health`
- Compliance Intelligence Agent API: `https://parallax42-agent-v2.vercel.app`

## Run Locally

For local testing that matches the hosted demo boundary, create `.env.local` from the relevant values in `.env.example`. `npm run dev` automatically loads `.env` and `.env.local`; shell-exported variables still win. Keep secrets such as `COMPASS_GATEWAY_TOKEN`, `QDRANT_API_KEY`, and `P42_CREWAI_SERVICE_TOKEN` out of git.

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3020
```

## Test

```bash
npm run qa
```

Run the live dependency check only after configuring private live-service credentials and when you intentionally want to verify external backend, gateway, Qdrant, and Compass access:

```bash
npm run qa:live
```

`npm run qa` stays deterministic and does not spend gateway tokens. `npm run qa:live` is intentionally networked and requires `.env.local` to contain the same server-side values used by Vercel.

## Evidence Capture

Capture health snapshots, benchmark output, readiness inventory, and a sample agent trace:

```bash
npm run capture:evidence
```

The generated files land in `evidence/` and are safe to include in a submission pack because secrets and raw uploads are not stored there.

## Request Size Boundaries

Evidence files can be up to 30 MB per file in the browser cockpit. Large files are not sent as raw JSON: they are hashed client-side, split into 1 MB parser-relay chunks, parsed/OCRed behind the backend boundary, and then represented in chat as sanitized metadata and snippets.

Parsed evidence index requests have a separate JSON limit of 15 MB by default. Conversation, standard run, agent run, and review-pack JSON requests default to 8 MB. These limits support complex case metadata while keeping raw document content on the chunked upload path.

The JSON limits can be overridden with `CONVERSATION_BODY_LIMIT_BYTES`, `EVIDENCE_INDEX_BODY_LIMIT_BYTES`, `EVIDENCE_SEARCH_BODY_LIMIT_BYTES`, `REVIEW_PACK_BODY_LIMIT_BYTES`, `STANDARD_RUN_BODY_LIMIT_BYTES`, and `ADMIN_BODY_LIMIT_BYTES`.

## Deployment Surfaces

- Static cockpit: `public/`, deployed by `.github/workflows/pages.yml`.
- Serverless API: `api/`, deployable to Vercel.
- Live backend proof: proxied through the allowlisted `/api/backend` relay.

Default-safe environment variables:

```text
AGENT_RUNTIME=custom
CREWAI_ENABLE_LIVE_LLM=0
CREWAI_LLM_MODEL=gpt-5.1
CREWAI_LLM_BASE_URL=
CREWAI_LLM_API_KEY=
P42_CREWAI_SERVICE_URL=
P42_CREWAI_SERVICE_TOKEN=
PARALLAX42_BACKEND_URL=
COMPASS_GATEWAY_BASE_URL=
COMPASS_GATEWAY_TOKEN=
EMBEDDINGS_MODEL=text-embedding-3-large
P42_REQUIRE_DURABLE_STORAGE=0
P42_REFERENCE_CONTEXT_DIR=
P42_VECTOR_STORE_PROVIDER=local
# Full RAG requires these Qdrant values. Without them the runtime falls back to local-file demo storage.
# QDRANT_URL=https://<cluster>.cloud.qdrant.io
# QDRANT_API_KEY=<server-side-vector-db-key>
# QDRANT_COLLECTION=p42_compliance_evidence_v2
P42_FEATURE_COMPASS_LLM_CALLS=0
P42_FEATURE_COMPASS_EMBEDDINGS=0
P42_FEATURE_QDRANT_RAG=0
P42_FEATURE_QDRANT_LEARNING_MEMORY=0
P42_FEATURE_EXTERNAL_PARSER_RELAY=0
P42_FEATURE_LIVE_ADVISORY_SPECIALISTS=0
P42_FEATURE_LIVE_CREWAI=0
P42_ALLOWED_ORIGINS=http://127.0.0.1:3020
AGENT_AUDIT_DIR=/tmp/p42-compliance-intelligence-agent
```

Advanced components can be switched on through environment variables or `GET|PATCH /api/admin/features` when the required backing service is configured. Smart chat intake requires `COMPASS_GATEWAY_TOKEN`; when it is absent or the gateway fails, the chat reports that smart intake is unavailable instead of silently pretending a live LLM result exists. The admin response distinguishes `enabled`, `configured`, and `active`, so missing Compass tokens, Qdrant URLs, parser relay configuration, or optional CrewAI Python dependencies are visible.

Full RAG and governed-learning demo setup:

```text
COMPASS_GATEWAY_BASE_URL=https://parallax42-compass-gateway.vercel.app/api
COMPASS_GATEWAY_TOKEN=<server-side gateway token>
EMBEDDINGS_MODEL=text-embedding-3-large
P42_VECTOR_STORE_PROVIDER=qdrant
QDRANT_URL=https://<cluster>.cloud.qdrant.io
QDRANT_API_KEY=<server-side qdrant key>
QDRANT_COLLECTION=p42_compliance_evidence_v2
P42_REFERENCE_CONTEXT_DIR=
AGENT_RUNTIME=crewai_live
CREWAI_ENABLE_LIVE_LLM=1
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
P42_CREWAI_SERVICE_URL=https://api.parallax42.bhavukarora.com/crewai
P42_CREWAI_SERVICE_TOKEN=<server-side-service-token>
P42_AUTH_MODE=enforced
```

For the deployed online product demo, isolated Railway Postgres and Qdrant services are configured server-side through Vercel. With `P42_DEMO_EMBEDDINGS=true`, uploaded evidence is chunked and stored using deterministic lexical hash vectors (`p42-demo-hash-embedding-v1`), so indexing and case-scoped retrieval are genuine and repeatable without claiming Compass semantics. A rotated Compass credential can replace that embedding path and enable smart intake/advisory calls. For a self-hosted, local, or separate Agentathon runtime, equivalent Qdrant and embedding variables must be exported or the runtime uses local-file demo storage. The remote Python CrewAI service is required for live CrewAI execution from Vercel because Vercel's Node runtime does not install the Python CrewAI adapter. Governed learning stores auditable reviewer memory and precedent patterns; it is not model retraining and never silently changes the deterministic council decision. Live LLM specialists are advisory only, and human approval remains required.

After configuring Qdrant and the Compass gateway, run:

```bash
npm run qdrant:smoke
npm run reference:index
npm run reference:intelligence
npm run reference:courtlistener
```

`npm run reference:index` seeds `reference_context/sanitised_enterprise_ai_governance_context.md` as sanitized governance-reference memory. It is advisory context only: it helps chat and retrieval reason about governance, assurance, SAA, ISO, Responsible AI, and risk language, but it is not official policy and never overrides the deterministic council or human review boundary.

`npm run reference:intelligence` creates safe local reference-lane artifacts without live API calls. It covers legal, compliance, procurement, security, AI governance, sanctions/export, and HSE/ESG lane directories so the demo can explain the broader ingestion strategy without pretending those corpora are already fully loaded.

`reference_context/reference_memory_manifest.json` records the current advisory-source map. It includes expanded official/public anchors for NIST, EU, OECD, ISO, Singapore, UAE, OFAC, BIS, UN/EU sanctions, CourtListener, SEC EDGAR, procurement/debarment, and HSE/ESG references. UAE-specific anchors include AI strategy and ethics, UAE data-protection references, DIFC/ADGM data protection, UAE Cyber Security Council, UAE export-control/non-proliferation references, UAE AML/CFT references, UAE Ministry of Finance, UAE Ministry of Climate Change and Environment, and UAE Ministry of Human Resources and Emiratisation.

Compass is not a legal, compliance, security, sanctions, export-control, procurement, HSE, or ESG reference source. It is the server-side LLM and embedding runtime used to analyze uploaded evidence, critique drafts, and retrieve against the reference/evidence stores. The authority for reference intelligence comes from official/public anchors and human reviewer validation.

Future roadmap: add a governed knowledge connector API for allowlisted live sources such as case-law APIs, sanctions lists, export-control lists, regulatory guidance, procurement/debarment datasets, and internal policy registers. That API should record source URL, license, schema, refresh cadence, source hash, parser version, reviewer status, and correction history before updates influence advisory memory. The current submission does not claim live regulatory monitoring.

`npm run reference:courtlistener` aligns the demo with Use Case #21's legal/compliance reference path through CourtListener / Free Law Project. It imports a small CourtListener sample when `COURTLISTENER_API_TOKEN` is configured or local JSON/JSONL is supplied, writes normalized legal-reference records under `reference_context/legal/`, and can index the resulting markdown through the same reference-memory path. CourtListener references are advisory legal intelligence only; they are not jurisdiction-specific advice and cannot approve a contract. The legacy `npm run reference:cap` command remains available for CAP API access.

See [`docs/REFERENCE_INTELLIGENCE_DATA.md`](docs/REFERENCE_INTELLIGENCE_DATA.md) for the broader legal, compliance, procurement, security, AI governance, sanctions/export, and HSE/ESG reference-lane model.

## CrewAI

Validate the CrewAI crew design without installing optional dependencies:

```bash
npm run check:crewai
```

Dry-run validation covers both CrewAI Crew and CrewAI Flow manifests. CrewAI is not part of the default Agentathon Docker dependency set. Install optional dependencies only for live CrewAI validation:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-crewai.txt
python crewai_adapter/compliance_flow.py --live-flow --input examples/high_risk_ai_saas_case.json
python crewai_adapter/compliance_crew.py --live-crewai --input examples/high_risk_ai_saas_case.json
```

Enable live LLM calls only with approved credentials:

```bash
export AGENT_RUNTIME=crewai_live
export CREWAI_ENABLE_LIVE_LLM=1
export OPENAI_API_KEY=<real Compass key>
export OPENAI_BASE_URL=https://compass.core42.ai/v1
export MODEL_FAST=gpt-4.1
python run.py
```

For the Agentathon FastAPI wrapper, live CrewAI specialist output is attached under `output.live_advisory` only when `AGENT_RUNTIME=crewai_live` and `CREWAI_ENABLE_LIVE_LLM=1` are set and CrewAI actually runs. The final decision remains guarded by the deterministic engine. The evidence boundary uses server-side `POST /api/evidence/index` and `POST /api/evidence/search`, calls the reusable Parallax42 embedding boundary using `text-embedding-3-large`, stores chunk vectors behind the API, and keeps embedding vectors out of browser state. The browser may carry sanitized document metadata, excerpts, and retrieved snippets so the chat and reviewer UI can explain what was used.

For live CrewAI multi-agent execution from Vercel, configure `P42_CREWAI_SERVICE_URL` and `P42_CREWAI_SERVICE_TOKEN`. The Node runtime delegates the six-agent CrewAI council to that service, attaches its output under `orchestration.crewaiOutput`, then still applies the deterministic council as the final decision owner.

Learning memory endpoints are advisory:

- `POST /api/learning/feedback` records reviewer feedback, outcomes, controls, rejected evidence, and missing evidence as auditable learning artifacts.
- `POST /api/learning/similar-cases` returns similar prior cases.
- `GET|POST /api/learning/control-suggestions` returns common reviewer-added controls and repeated missing evidence patterns.

`POST /api/export/review-pack` creates the server-side executive review pack with digest, evidence quality, retrieval audit, citation manifest, reviewer actions, and a PDF payload. The cockpit uses this endpoint for the Exec review pack button and falls back to a local HTML report only if the API is unavailable.

## Submission Dossier

- [Agent Resume](docs/AGENT_RESUME.md)
- [End State](docs/END_STATE.md)
- [Work-Backward Roadmap](docs/ROADMAP.md)
- [Golden Demo Workflow](docs/GOLDEN_DEMO_WORKFLOW.md)
- [Agentathon System Architecture](docs/AGENTATHON_SYSTEM_ARCHITECTURE.md)
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Milestone 1 CrewAI Flow Runtime](docs/MILESTONE_1_CREWAI_FLOW.md)
- [Benchmark Report](docs/BENCHMARK_REPORT.md)
- [Legal Intelligence Data](docs/LEGAL_INTELLIGENCE_DATA.md)
- [Responsible AI Controls](docs/RESPONSIBLE_AI_CONTROLS.md)
- [Integration Matrix](docs/INTEGRATION_MATRIX.md)
- [Requirements Traceability](docs/REQUIREMENTS_TRACEABILITY.md)
- [Security, RBAC, And Audit Plan](docs/SECURITY_RBAC_AUDIT_PLAN.md)
- [CrewAI Architecture](docs/CREWAI_ARCHITECTURE.md)
- [Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md)
- [Production Track](docs/PRODUCTION_TRACK.md)
- [Demo Script](docs/DEMO_SCRIPT.md)
- [Submission Plan](docs/SUBMISSION_PLAN.md)

## Build Direction

The next implementation milestone is evidence intake and citation discipline:

1. add document/evidence upload or relay-backed evidence intake
2. add evidence chunk IDs and citation-required output
3. make uploaded DPA/model-training/continuity evidence clear specific blockers
4. preserve redaction and audit trace boundaries
5. add citation precision and missing-evidence evals
