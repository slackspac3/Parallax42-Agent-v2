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

Agent positioning: the target is **L2 governed autonomy**. It can loop through intake, evidence retrieval, obligation mapping, risk/control analysis, and review-pack generation, and it stops at missing evidence, a low output-rubric score, or accountable human approval. Chat mentions/questions and policy references are non-proof assertions; only usable uploaded or server-retrieved passages can satisfy controls. Any unresolved gap is nonterminal, and only an explicit server-owned `approvalEligible: true` permits human approval. The council is expressed as agentic pairings such as Planner + Doer, Proposer + Critic, Context-Packer + Actor, and Evidence-Weaver + Synthesizer, with deterministic Node decisioning as the final owner.

Memory is separated into scratchpad state, episodic audit/reviewer logs, and reusable advisory knowledge. Governed learning memory and reference intelligence improve questions and reviewer suggestions without training a model or changing policy. Learning and governance retrieval now derive workspace/project scope from the authenticated actor, and the FastAPI/Python layer preserves Node-owned policy fields unchanged.

The hosted product uses a named, authenticated client on the shared Compass gateway for GPT-5.1 chat/advisory calls and `text-embedding-3-large` semantic embeddings. JavaScript advisory specialists are active; the Python CrewAI runtime remains optional and is not active in the hosted product. Deterministic Node policy is the final decision authority, with deterministic fallback when live advisory output is unavailable.

Current engineering status and the selected cloud path are maintained in the [Deep Code Review](docs/DEEP_CODE_REVIEW.md) and [Azure Migration Plan](docs/AZURE_MIGRATION_PLAN.md). The seven P0 review findings are remediated in the local implementation with focused regressions. Enterprise residuals remain, including Entra/membership/RLS, immutable/WORM audit export, coupling audit events to critical business transactions, retention/erasure, distributed admission controls, and production verification.

Remediation verification status (2026-07-12): final-worktree `npm run qa` is green (270/270 Node tests and 13/13 Python security tests), including upload-first lifecycle and two-turn Playwright mock coverage plus a 4/4 benchmark. CI and authenticated live-demo re-verification are pending the release run.

## Judge Quick Start

The judge demo is intended to be run online first:

| Demo surface | Link | Purpose |
| --- | --- | --- |
| Vercel working demo | <https://parallax42-agent-v2.vercel.app/> | Primary same-origin browser demo and Node product API. |
| GitHub Pages mirror | <https://slackspac3.github.io/Parallax42-Agent-v2/> | Static mirror that calls the Vercel product API; not the FastAPI evaluator. |
| Vercel product API health | <https://parallax42-agent-v2.vercel.app/api/health> | Authenticated route used by the demo to show safe runtime capability state; it is not an anonymous diagnostics endpoint. |
| GitHub source | <https://github.com/slackspac3/Parallax42-Agent-v2> | Root `run.py`, Dockerfile, examples, logs, docs, workflows, and source evidence for this submission clone. |
| Agentathon Preflight workflow | <https://github.com/slackspac3/Parallax42-Agent-v2/actions/workflows/agentathon-preflight.yml> | Online Docker plus `/health` and `/run` proof for the root FastAPI evaluator wrapper. |

The primary working demo serves the browser and Node product APIs from Vercel; GitHub Pages is a static mirror that calls those APIs. An isolated Railway project provides PostgreSQL session/case/quota state plus Qdrant vector storage. The deployed demo uses a named, least-privilege client on the shared Parallax42 Compass gateway for GPT-5.1 smart intake, `text-embedding-3-large` semantic retrieval, and advisory specialists. Deterministic Node policy is the decision owner. Runtime responses expose live/fallback metadata, but current labeling defects mean that metadata must be verified rather than assumed accurate. Local commands are secondary reproduction tools.

Final submission positioning:

- The judge-facing product demo is online-first: Vercel browser + Node APIs -> isolated Railway Postgres/Qdrant services, with a named authenticated shared-Compass-gateway client configured server-side. GitHub Pages remains a static mirror.
- The root FastAPI/Docker path remains the evaluator reproduction path: `run.py` exposes `GET /health`, `GET /metadata`, role-gated non-disclosing `GET /logs`, `GET /compass/probe`, and `POST /run` on port `8000`.
- The FastAPI evaluator is a reproducible local/Docker/CI surface. v2 does not claim the legacy public Railway evaluator as its own deployment; GitHub Pages is static and Vercel hosts the product APIs.
- GitHub Actions Docker smoke remains the independent reproducibility proof: it builds the repo image, starts `python run.py`, and calls `/health` plus `/run` inside CI.
- Compass is used server-side. The browser never receives Compass keys, Qdrant keys, or raw embeddings.
- The deployed product path runs the deterministic compliance engine and its named gateway client currently enables GPT-5.1 smart intake/advisory calls plus `text-embedding-3-large` semantic embeddings. Gateway failure is intended to fall back with an explicit degraded label; the deep review records paths where runtime/fallback labeling is not yet reliable. The direct `OPENAI_API_KEY` / `OPENAI_BASE_URL` path is preserved for evaluator-style FastAPI execution and strict diagnostics.
- Deterministic Node policy is the final authority. Compass, governed learning memory, Qdrant retrieval, and optional CrewAI outputs are advisory inputs and cannot rewrite Node policy fields.

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
http://127.0.0.1:3020
```

The local server defaults to port `3020`. If the judging environment expects port `3000`, start it with:

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
| Vercel working demo | <https://parallax42-agent-v2.vercel.app/> | Browser workflow and same-origin Node product APIs load together. |
| GitHub Pages mirror | <https://slackspac3.github.io/Parallax42-Agent-v2/> | Static mirror loads and uses hosted product routes from `public/config.js`. |
| Vercel product API | <https://parallax42-agent-v2.vercel.app/api/health> | With a valid demo/session credential, hosted runtime reports safe Compass, Qdrant, parser, learning, and advisory capability state. |
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
| Vercel working demo | Primary product demo | Browser product experience and Node product APIs on one origin. | It is not the root FastAPI evaluator API. |
| GitHub Pages mirror | Static product mirror | Browser cockpit calling Vercel product APIs. | It is static and does not host FastAPI. |
| Vercel product API | Product runtime | Online Node/Vercel product APIs, Postgres-backed sessions/cases/quotas, Qdrant-backed semantic retrieval, and active Compass-backed JavaScript advisory specialists. | It is not the root `run.py` FastAPI evaluator API, and Python CrewAI is not active there. |
| Isolated Railway services | Product persistence only | Postgres session/case lifecycle state and authenticated Qdrant storage. | They are not the Agentathon FastAPI evaluator. |

This is intentional for the v2 demo: the repository and Docker workflow prove evaluator reproducibility, while the public cockpit and Vercel API show the richer product workflow. Reproduce the evaluator locally with:

```bash
python run.py
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/run \
  -H "Content-Type: application/json" \
  -d @input_examples/example_1.json
```

Safe claim today: FastAPI is implemented and independently verified by CI/Docker. Vercel hosts the primary working product demo and Node API, GitHub Pages is a static mirror, and the dedicated Railway v2 services provide product persistence rather than a public evaluator.

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

Post-council continuation is stateful: council completion returns an authoritative case snapshot/version, the browser replaces its draft, and follow-up turns retain evidence and prior output while marking material changes for rerun. Unit and Playwright mock regressions cover a follow-up and second council; repeat the flow on the deployed authenticated URL as a release gate.

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

- The deployed public demo uses live Compass smart intake, semantic embeddings, and advisory specialists through the shared server-side gateway. Deterministic Node policy is the final decision owner and available fallback; full local P0 QA is green, while CI/live release verification and residual enterprise controls remain.
- The repo does not contain a real Compass key.
- The system does not depend on an Agentathon-provided key being committed or available locally.
- If evaluators provide their own Compass key, they can set `OPENAI_API_KEY` with the official template `OPENAI_BASE_URL=https://compass.core42.ai/v1`, or use `https://api.core42.ai/v1` if Core42/Agentathon confirms that base for the issued key.
- Compass is the model runtime only; official/public reference anchors remain the source context for legal, compliance, security, RAI, sanctions/export, procurement, and HSE/ESG reasoning.

No secrets are committed. `SAMPLE_MODE=true` is accepted for CI/local reproducibility, but it does not switch to canned outputs; the wrapper still runs the deterministic Node rules engine and Python advisory/evaluator flow. With `SAMPLE_MODE=false`, `/run` attempts a live Compass/OpenAI-compatible advisory call when `OPENAI_API_KEY` is configured. That output remains advisory, and Python preserves the authoritative Node policy fields unchanged. The deployed Vercel product uses Qdrant with live `text-embedding-3-large` semantic embeddings through the shared Compass gateway; local and FastAPI checks still require their own vector-store environment. Demo/session RBAC is enforced, while Microsoft Entra SSO and live Python CrewAI remain unimplemented or inactive claims.

Known limitations: the Agentathon path returns structured JSON and trace logs, not the browser cockpit; the decision is a human-review compliance package, not legal advice or automatic approval; Compass failures return structured `live_compass.status=unavailable`; local `python scripts/qdrant_smoke.py` reports `SKIPPED` unless local Qdrant and embedding env vars are exported; live CrewAI is not part of the default Docker dependency set.

Live Compass boundary:

- **Agentathon evaluation path:** `run.py` uses the OpenAI-compatible Compass environment contract: `OPENAI_API_KEY` plus the official template `OPENAI_BASE_URL=https://compass.core42.ai/v1`. The same runtime also accepts `https://api.core42.ai/v1` when confirmed for the issued key. This is the path used by `/run`, `/compass/probe`, `scripts/compass_doctor.py`, and optional Compass embeddings for Qdrant. It exists because the technical screening expects a reproducible root-level API that can be run in Docker without browser clicks or private hosted services.
- **Product demo path:** the deployed Node/Vercel application uses `COMPASS_GATEWAY_BASE_URL` and a named, least-privilege `COMPASS_GATEWAY_TOKEN` for GPT-5.1 smart intake/advisory calls and `text-embedding-3-large` semantic embeddings. The provider key stays in the shared gateway; it is not stored in this product deployment or sent to the browser. The gateway is product infrastructure, not the Agentathon direct Compass base URL.
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

The online product is configured with a named authenticated client token for the shared Compass gateway. The underlying provider key remains only in that gateway; neither the Vercel product nor the browser receives it. The separate FastAPI evaluator continues to expose the standard `OPENAI_API_KEY` / `OPENAI_BASE_URL` contract for local, CI, or evaluator-managed execution.

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

The selected path is phased, with parity before platform replacement:

1. Containerize the Node product API and deploy it to Azure Container Apps from Azure Container Registry, while initially retaining the proven Railway Postgres/Qdrant services and shared Compass gateway.
2. Move canonical product state and the current PostgreSQL audit chains to Azure Database for PostgreSQL Flexible Server; add versioned migrations, critical business/audit transaction coupling, restore proof, and immutable Azure Blob Storage exports.
3. Put the static `public/` cockpit in an Azure Storage static website behind Azure Front Door Premium, and route `/api/*` through API Management Standard v2 (inbound Private Link plus outbound VNet integration) to internal Container Apps.
4. Add Microsoft Entra ID roles and managed identities, store secrets in Azure Key Vault, and emit OpenTelemetry data to Application Insights/Log Analytics.
5. Dual-index Qdrant content into Azure AI Search, compare retrieval quality and tenancy filters, then cut over only after parity gates pass.
6. Migrate the external parser or shared Compass gateway only if ownership, latency, or data-residency requirements justify it.

This avoids an early rewrite and keeps rollback available at each boundary. Azure Static Web Apps and Functions are not the selected production path because the current long-running API shape and private-network target fit Container Apps plus Front Door/API Management better. See the [Azure Migration Plan](docs/AZURE_MIGRATION_PLAN.md) for component mapping, data cutover, rollback, identity, observability, recovery targets, and acceptance gates.

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

In final non-sample evaluation, the wrapper sends sanitized case facts, evidence summaries, specialist findings, and the deterministic draft to Compass for advisory critique. Compass output is limited to reviewer questions and advisory notes; Python returns Node decision, risk, gaps, controls, readiness, and approval eligibility unchanged.

Optional live CrewAI for the Agentathon `/run` path is separate from the stable custom orchestrator:

```text
AGENT_RUNTIME=crewai_live
CREWAI_ENABLE_LIVE_LLM=1
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
```

CrewAI is imported lazily and is not installed by the default Docker build. Install `requirements-crewai.txt` only when validating the optional live path. If CrewAI fails to import or execute, `/run` records `live_advisory.status=unavailable` and continues through the custom deterministic path. CrewAI specialist cards remain advisory; `scripts/check_agentathon_wrapper.py` asserts parity with the Node decision contract.

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

Governed learning memory for the Agentathon `/run` path stores synthetic reviewer outcomes, feedback, control patterns, decision overrides, and evidence-quality notes as advisory artifacts. It is not model training or autonomous self-learning. Deterministic Node policy remains authoritative; the retrieval layer ignores caller-selected workspace/project values and scopes learning/governance memory from the authenticated actor.

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
- This repository does not include Redis, Celery, or durable queues. The hosted product does use PostgreSQL for sessions, cases, and quotas.
- Python CrewAI is optional and inactive in the hosted product. Active JavaScript advisory specialists call Compass, while deterministic Node policy remains the final decision authority and fallback.
- Live Compass, retrieval, learning, precedent, and Python outputs are advisory; the Node decision contract is returned unchanged across the Python evaluator.
- Qdrant is active in the deployed Vercel product evidence API; local/FastAPI runtimes require Qdrant and embedding env vars or they fall back to local-file storage.
- Governed learning memory is reviewer context rather than model training or policy authority; actor-derived namespace regressions cover both learning and governance retrieval.
- OCR/parser capability is integrated through external relay paths rather than implemented as a local parser service in this repo.
- Hosted audit writes require the configured PostgreSQL store and use tenant/project hash chains serialized with `SELECT ... FOR UPDATE`; local JSONL is development/test-only. Immutable/WORM export, restore drills, and same-transaction coupling to critical business writes remain production requirements.
- Microsoft Entra SSO is not implemented. The current demo/session RBAC boundary is enforced but is not enterprise identity federation.
- OpenClaw is not implemented and should not be claimed.

## Current Status

Implemented in this repo:

- `POST /api/conversation` NLP case-builder endpoint that asks follow-up questions and executes the agent workflow when ready
- `POST /api/agent/run` Node compliance-agent run with active Compass-backed JavaScript advisory specialists, deterministic fallback, and an optional remote Python CrewAI adapter
- `POST /api/evidence/index` and `POST /api/evidence/search` server-side retrieval boundary: gateway embeddings and indexed chunks stay behind the API; the browser receives case/evidence/index metadata plus safe snippets/citations needed for the reviewer UI
- `GET /api/readiness` submission-readiness inventory
- `GET /api/health` runtime and linked-platform status
- Vercel-compatible serverless API functions under `api/`
- allowlisted browser relay for an optional configured Parallax42 backend at `GET/POST /api/backend`
- GitHub Pages static cockpit with chat-first agent mode and advanced runtime controls
- browser cockpit for conversational case building, agent execution, evidence, gaps, and trace events
- CrewAI Flow adapter plus six role-specific agents and YAML task definitions
- local benchmark endpoint plus tenant-scoped audit: PostgreSQL hash chains in hosted runtimes and JSONL only for explicit local/test fallback
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
# Local/test JSONL only; hosted runtimes require DATABASE_URL and fail closed without it.
AGENT_AUDIT_DIR=./logs
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

For the deployed online product demo, isolated Railway Postgres and Qdrant services are configured server-side through Vercel. `P42_DEMO_EMBEDDINGS=false` selects live `text-embedding-3-large` vectors through the shared Compass gateway; evidence is chunked and retained behind the API for case-scoped retrieval. For a self-hosted, local, or separate Agentathon runtime, equivalent Qdrant and gateway variables must be exported or the runtime uses local-file demo storage. The remote Python CrewAI service remains optional: Vercel uses the existing JavaScript advisory-council adapter for live Compass specialists, while deterministic Node policy owns the final decision. Actor-derived retrieval scope, explicit evidence assertion states, and Node/Python parity regressions protect that boundary. Human approval remains required, and only a server-returned `approvalEligible: true` permits an approval action.

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

For live CrewAI multi-agent execution from Vercel, configure `P42_CREWAI_SERVICE_URL` and `P42_CREWAI_SERVICE_TOKEN`. The Node runtime delegates the six-agent CrewAI council to that service and attaches its output under `orchestration.crewaiOutput`; the deterministic Node council is intended to remain the final owner and must be protected by immutable parity tests.

Learning memory endpoints are advisory:

- `POST /api/learning/feedback` records reviewer feedback, outcomes, controls, rejected evidence, and missing evidence as auditable learning artifacts.
- `POST /api/learning/similar-cases` returns similar prior cases.
- `GET|POST /api/learning/control-suggestions` returns common reviewer-added controls and repeated missing evidence patterns.

`POST /api/export/review-pack` creates the server-side executive review pack with digest, evidence quality, retrieval audit, citation manifest, reviewer actions, and a PDF payload. The cockpit uses this endpoint for the Exec review pack button and falls back to a local HTML report only if the API is unavailable.

## Submission Dossier

- [Deep Code Review](docs/DEEP_CODE_REVIEW.md)
- [Azure Migration Plan](docs/AZURE_MIGRATION_PLAN.md)
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

The P0 correctness/isolation milestone is implemented and passes full local QA: evidence assertion/provenance, source-aware contradictions, actor-scoped learning/governance/audit, authoritative post-council versions, nonterminal conditional status, and Node-only policy authority. Next, verify CI/live deployment and close the residual P1 gates in the [Deep Code Review](docs/DEEP_CODE_REVIEW.md). Azure work should follow the phased [Azure Migration Plan](docs/AZURE_MIGRATION_PLAN.md), beginning with compute parity rather than a platform rewrite.
