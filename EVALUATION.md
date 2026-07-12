# Evaluation

## Primary Online Evaluation

Start with the online GitHub evidence rather than a local checkout:

| Online item | Link | What to verify |
| --- | --- | --- |
| Repository | <https://github.com/slackspac3/Parallax42-Agent-v2> | Root `run.py`, `Dockerfile`, `metadata.json`, examples, logs, and docs are present on `main`. |
| Vercel working demo | <https://parallax42-agent-v2.vercel.app/> | Primary browser workflow and same-origin Node product API. |
| GitHub Pages mirror | <https://slackspac3.github.io/Parallax42-Agent-v2/> | Static mirror loads and calls hosted product routes from `public/config.js`. |
| Vercel product API | <https://parallax42-agent-v2.vercel.app/api/health> | With a valid demo/session credential, hosted runtime reports safe Compass, Qdrant, parser, learning, and advisory capability state. |
| Agentathon Preflight | <https://github.com/slackspac3/Parallax42-Agent-v2/actions/workflows/agentathon-preflight.yml> | Latest `main` run passes both `agentathon-preflight` and `docker-smoke`. This is the online Docker plus `/health` and `/run` proof. |
| CI | <https://github.com/slackspac3/Parallax42-Agent-v2/actions/workflows/ci.yml> | Latest `main` run passes `npm run qa`. |
| Architecture | <https://github.com/slackspac3/Parallax42-Agent-v2/blob/main/docs/AGENTATHON_SYSTEM_ARCHITECTURE.md> | Online-first evaluator path, product path, and runtime boundaries are documented. |

State reviewed 2026-07-12: the product uses a named authenticated client on the shared Compass gateway for GPT-5.1 chat/advisory calls and `text-embedding-3-large` semantic embeddings. JavaScript advisory specialists, Railway PostgreSQL, Railway Qdrant, and demo/session RBAC are active. Python CrewAI and Microsoft Entra SSO are not active. Remediation implementation SHA `457c7c2` passes full `npm run qa` with 276/276 Node tests, 13/13 Python security tests, and a 4/4 benchmark; CI, Agentathon Preflight, and GitHub Pages succeeded for the same implementation SHA. A later documentation-only commit records this evidence but is not the implementation SHA.

Evaluation must keep the remediated P0 regressions green and account for the remaining P1/P2 findings in the [Deep Code Review](docs/DEEP_CODE_REVIEW.md). Cloud migration claims should be assessed against the selected [Azure Migration Plan](docs/AZURE_MIGRATION_PLAN.md), not against older option lists.

GitHub Pages is a static cockpit and does not host the FastAPI evaluator API. v2 does not claim the legacy public Railway evaluator as a deployment from this clone. The `docker-smoke` job in the Agentathon Preflight workflow is the evaluator reproducibility proof: it builds the Docker image, starts the container on port `8000`, calls `GET /health`, and posts `input_examples/example_1.json` to `/run`.

The online product demo uses Vercel for server-side product APIs and a dedicated Railway v2 project for PostgreSQL session/case/quota state and Qdrant vector storage. The Qdrant endpoint is authenticated and Vercel stores its key as an encrypted environment variable; the browser receives neither the key nor raw embeddings. A named gateway client is configured for live semantic embeddings and smart intake/advisory calls. The underlying Compass provider key remains only in the shared gateway.

Final submission positioning: the judge-facing product demo is online-first on Vercel, with GitHub Pages retained as a static mirror. Vercel product APIs keep database and Qdrant credentials plus the named Compass gateway client token server-side. The local Docker/FastAPI path remains the evaluator reproduction path for `run.py`, `/health`, `/metadata`, role-gated non-disclosing `/logs`, `/compass/probe`, and `/run`. Compass, retrieval, learning, and Python outputs are advisory; deterministic Node policy is the final authority.

The hosted chat supports post-council continuation. Council completion returns an authoritative completed snapshot/version, the browser replaces local state, and a new material fact retains evidence/prior output while marking the old result pending rerun. Unit and Playwright mock regressions cover follow-up plus second council, and the sequence passed on the deployed authenticated URL.

### Verified Remediation Release Evidence

Authenticated real-browser acceptance against <https://parallax42-agent-v2.vercel.app> used an actual PDF upload and proved the live Qdrant/Compass path, a Council result with approval locked, a material post-council rerun returning HTTP 200 with authoritative server state/version, and narrative generation returning HTTP 200. The production access checks returned:

| Probe | Verified result |
| --- | --- |
| Anonymous `GET /api/logs` | 404, non-disclosing |
| Audit route without authentication | 401 |
| Audit route with an insufficient role | 403 |
| Health route | 401 without the required identity; 200 for the authorized role |
| Cache policy | Every probed response was `private, no-store` |

This is demo-release evidence, not an enterprise-production approval. Hosted PostgreSQL audit is durable, tenant-scoped, hash-chained, and application append-only, but it is not immutable/WORM and does not establish `enterpriseReady`. Entra/membership/RLS, immutable server-loaded artifacts, maker-checker controls, WORM export/restore proof, business/audit transaction coupling, distributed admission controls, retention/erasure, and the other documented P1 gates remain open.

### FastAPI Evaluator Status

The submitted repository includes the required FastAPI evaluator surface, but the public browser demo is not served by FastAPI.

| Question | Current answer |
| --- | --- |
| Does the repo include root `run.py`? | Yes. |
| Does `run.py` expose the required evaluator API on port `8000`? | Yes; verified locally/preflight and by CI Docker smoke. |
| Is the FastAPI wrapper publicly hosted at the GitHub Pages URL? | No. GitHub Pages is static. |
| Is the FastAPI wrapper publicly hosted at the Vercel product API URL? | No. Vercel hosts the Node/CommonJS product APIs. |
| Is a v2 FastAPI evaluator publicly hosted? | No. The wrapper is verified through local tests and the CI Docker smoke; the isolated Railway v2 services are Postgres and Qdrant only. |
| Are the Railway Postgres/Qdrant services the Agentathon FastAPI wrapper? | No. They are product persistence only. |
| What is the online proof for FastAPI today? | The GitHub Actions `agentathon-preflight.yml` Docker smoke job on `main`. |

If a public FastAPI URL is required later, deploy this clone as a separate authenticated or tightly quota-bound service; do not reuse the legacy evaluator URL by assumption.

Online Qdrant proof path:

```bash
curl https://parallax42-agent-v2.vercel.app/api/health

curl -X POST https://parallax42-agent-v2.vercel.app/api/evidence/index \
  -H "Content-Type: application/json" \
  -d '{"caseId":"judge-online-qdrant-smoke","documents":[{"evidenceId":"judge-smoke-001","title":"Synthetic Qdrant Smoke Evidence","text":"The vendor is prohibited from using customer data for model training. The DPA lists subprocessors and a 30-day deletion SLA."}]}'

curl -X POST https://parallax42-agent-v2.vercel.app/api/evidence/search \
  -H "Content-Type: application/json" \
  -d '{"caseId":"judge-online-qdrant-smoke","query":"model training exclusion subprocessors deletion SLA","topK":3}'
```

Expected hosted-demo indicators are `provider=qdrant`, `storage=server_side_qdrant_vector_db`, `collection=p42_compliance_evidence_v2`, `model=text-embedding-3-large`, `browserEmbeddingsRetained=false`, and at least one sanitized match. A local or CI fallback must report its deterministic model explicitly and must not be presented as the hosted semantic path.

Online continuation smoke:

1. Run any case through the product council.
2. Continue the chat with `I want to deploy this in Syria as well`.
3. Confirm the right rail shows `Case updated after council`, prior evidence remains attached, sanctions/restricted-party screening becomes the next contextual gate, and the prior council result is marked for rerun.
4. Repeat with a terse ambiguous answer such as `Syria`; the expected behavior is an add-or-replace clarification rather than a silent overwrite.

## Secondary Local QA

Run the canonical local QA suite from the repository root only when reproducing or extending the online checks:

```bash
npm run qa
```

This runs syntax checks, static page checks, unit tests, local benchmarks, and CrewAI dry-run validation. The product application is a Node/CommonJS Vercel/static app, so there is no React, Vite, Redis, Postgres, or durable queue setup required for this QA path. The separate Agentathon evaluator wrapper is FastAPI/Docker-capable and is validated through the preflight commands below.

The consolidated evaluator and product architecture is documented in [`docs/AGENTATHON_SYSTEM_ARCHITECTURE.md`](docs/AGENTATHON_SYSTEM_ARCHITECTURE.md).

## Secondary Local Agentathon Preflight

Run the wrapper submission checks from the repository root when reproducing CI locally:

```bash
python scripts/agentathon_preflight.py
python scripts/agentathon_preflight.py --run-api
python scripts/agentathon_preflight.py --run-api --npm-qa
python scripts/agentathon_preflight.py --compass-doctor
python scripts/agentathon_preflight.py --qdrant-smoke
python scripts/agentathon_preflight.py --docker
```

`--run-api` starts `python run.py`, waits for `GET /health`, posts `input_examples/example_1.json` to `/run`, validates structured JSON, and stops the server. `--docker` builds and runs the container only when Docker is installed; if the Docker CLI is missing, it reports `SKIPPED` rather than failing local validation.

CI uses `SAMPLE_MODE=true`, `OPENAI_API_KEY=dummy`, and `OPENAI_BASE_URL=https://compass.core42.ai/v1` so Docker and API shape can be verified without real secrets. The workflow installs Playwright Chromium before `npm run qa` and runs Docker smoke in a separate job so container verification is not blocked by browser QA. Final evaluation should set `SAMPLE_MODE=false`, `REQUIRE_COMPASS=true`, and supply a real Compass key through `OPENAI_API_KEY`; in that mode `/run` attempts a live Compass/OpenAI-compatible advisory review of the deterministic draft and returns a structured error if Compass is unavailable. Sample mode is fallback/testing only and still executes deterministic logic; it is not a live Compass, Qdrant, CrewAI, or enforced-RBAC claim.

Compass output is advisory only. It can contribute reviewer questions and advisory notes; Node policy is the final authority and human review remains required. Evaluation fails if Python or any advisory-memory path changes Node policy fields; the wrapper parity check enforces that contract locally.

## Compass Model And Credential Boundary

The direct FastAPI evaluator configuration keeps the official Agentathon template first and allows the alternate Core42 public API base only when Core42/Agentathon confirms it for the issued key. These repo placeholders are separate from the hosted product's named gateway client:

```text
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
MODEL_REASONING=gpt-5.1
EMBEDDING_MODEL=text-embedding-3-large
CREWAI_LLM_MODEL=gpt-5.1
```

Why this split is used:

- `gpt-4.1` is the direct evaluator's optional fast model for structured JSON and lower-latency checks.
- `gpt-5.1` is the hosted gateway chat/advisory model and the direct evaluator's reasoning model.
- `text-embedding-3-large` is the embedding model for evidence chunks, reference memory, governed learning memory, and Qdrant search.

The deployed public demo uses a named authenticated shared-gateway client for GPT-5.1 chat/advisory calls and `text-embedding-3-large` semantic embeddings. Its provider key stays inside the shared gateway. The separate FastAPI evaluator can instead receive a runtime-managed direct key using `OPENAI_BASE_URL=https://compass.core42.ai/v1`, or `https://api.core42.ai/v1` when confirmed for that key. Compass is a model runtime, not a legal, compliance, or security authority; deterministic fallback keeps the workflow testable when a live advisory call fails.

Reference intelligence is separate from Compass. Compass is the server-side LLM and embedding runtime used to analyze, summarize, critique, and retrieve. It is not a legal, compliance, security, sanctions, export-control, procurement, HSE, or ESG source of truth. The current reference-source map is recorded in `reference_context/reference_memory_manifest.json` and includes expanded official/public anchors for NIST, EU, OECD, ISO, Singapore, UAE, OFAC, BIS, UN/EU sanctions, CourtListener, SEC EDGAR, procurement/debarment, and HSE/ESG references. UAE-specific anchors are included for AI strategy/ethics, data protection, DIFC/ADGM privacy, cybersecurity, export-control/non-proliferation, AML/CFT and targeted financial sanctions, procurement, environment, and workforce context.

Future roadmap: a governed knowledge connector API should allow approved live sources such as case-law APIs, sanctions lists, export-control lists, regulatory guidance, procurement/debarment datasets, and internal policy registers to refresh advisory memory with source hashes, parser versions, reviewer status, and correction history. That connector API is not claimed as complete in this submission.

## Live Compass Boundary

The repository intentionally separates three runtime boundaries:

| Boundary | Env / URL | Used for | Why |
|---|---|---|---|
| Agentathon direct Compass | `OPENAI_API_KEY`, `OPENAI_BASE_URL=https://compass.core42.ai/v1` | FastAPI `/run`, `/compass/probe`, `scripts/compass_doctor.py`, optional Compass embeddings | Uses the official Agentathon template first. Runtime also accepts `https://api.core42.ai/v1` when confirmed for the issued key. |
| Product Vercel gateway | `COMPASS_GATEWAY_BASE_URL`, named least-privilege `COMPASS_GATEWAY_TOKEN` | Hosted GPT-5.1 smart intake/advisory calls and `text-embedding-3-large` embeddings | The provider key remains only in the shared gateway. The client token and model outputs remain server-side and it is not the Agentathon direct Compass route. |
| Product backend | Optional `PARALLAX42_BACKEND_URL`, optional `P42_CREWAI_SERVICE_URL` | OCR/parser relay and optional remote CrewAI/product services | These services are not Compass APIs and must not be used as `OPENAI_BASE_URL`. |
| Product persistence | Vercel encrypted `DATABASE_URL`, `QDRANT_URL`, `QDRANT_API_KEY`; `QDRANT_COLLECTION=p42_compliance_evidence_v2` | PostgreSQL session/case/quota plus scoped audit-chain state, and product evidence/governed memory surfaces | Dedicated Railway v2 services are used server-side. Hosted audit fails closed without Postgres; JSONL is local/test-only. WORM export and business/audit coupling remain open. |

The Agentathon wrapper uses direct Compass for live advisory when available because the judging API should not depend on browser clicks, uploaded files, or Vercel routing. The Node/Vercel/Railway stack remains the product path, with active JavaScript Compass advisory specialists and optional/inactive Python CrewAI. Deterministic Node policy is the final decision owner; Python preserves decision, risk, gaps, controls, readiness, and approval eligibility unchanged.

The isolated Qdrant v2 service and collection `p42_compliance_evidence_v2` have been provisioned and authenticated. The hosted product uses live `text-embedding-3-large` vectors from the shared Compass gateway to store and search case-scoped chunks. Without local Qdrant and embedding configuration, `/run` reports `rag_evidence_memory.provider=local-fallback`; that fallback is not hosted semantic-RAG proof.

```bash
python scripts/qdrant_smoke.py
python scripts/agentathon_preflight.py --qdrant-smoke
```

Governed learning memory is enabled as an advisory Agentathon layer. It reads synthetic reviewer outcomes from `data/sample_learning_memory.json` and optional local JSONL feedback when Qdrant is not configured. If Qdrant and Compass embeddings are configured, learning artifacts are stored/retrieved as `memoryType=learning_artifact` payloads. This is not model training or autonomous self-learning. Learning/governance scope derives from the authenticated actor, and Python preserves Node policy fields unchanged; advisory memory can only surface reviewer context.

Learning endpoints:

```bash
curl http://localhost:8000/learning/memory/status
curl -X POST http://localhost:8000/learning/similar-cases -H "Content-Type: application/json" -d '{"caseFacts":{"workflow":"healthcare analytics"},"missingEvidence":["model-training exclusion"],"domains":["privacy","ai-governance"]}'
curl -X POST http://localhost:8000/learning/control-suggestions -H "Content-Type: application/json" -d '{"caseFacts":{"workflow":"AI support-ticket classifier"},"missingEvidence":["model-training exclusion"],"domains":["ai-governance"]}'
```

Verify the official direct Compass path before final judging:

```bash
export OPENAI_API_KEY=<real Compass key>
export OPENAI_BASE_URL=https://compass.core42.ai/v1
export MODEL_FAST=gpt-4.1
export MODEL_REASONING=gpt-5.1
export EMBEDDING_MODEL=text-embedding-3-large
export SAMPLE_MODE=false
export REQUIRE_COMPASS=true
python scripts/compass_doctor.py --strict
curl http://localhost:8000/compass/probe
```

If `OPENAI_BASE_URL` is not exported, `compass_doctor.py` reports that the default was used only for normalization and not as live proof. The active placeholder is `https://compass.core42.ai/v1`. The alternate `https://api.core42.ai/v1` is accepted by the runtime when Core42/Agentathon confirms it for the issued key. If `/models` returns HTML, the base URL is pointing at a frontend page, proxy, or non-OpenAI-compatible gateway. If `/chat/completions` returns `405`, the base URL/path/proxy is likely wrong or the gateway does not expose direct OpenAI-compatible routes. The optional Parallax42 gateway uses `COMPASS_GATEWAY_BASE_URL` and `COMPASS_GATEWAY_TOKEN`; it must not be confused with the Agentathon direct `OPENAI_BASE_URL`.

Regenerate Agentathon output artifacts after changing the `/run` path:

```bash
python scripts/regenerate_agentathon_artifacts.py
python scripts/agentathon_preflight.py
```

The regeneration script executes the actual orchestrator for the three canonical input examples, writes `output_examples/example_1_output.json` through `example_3_output.json`, copies stable matching traces to `logs/example_1_trace.jsonl` through `logs/example_3_trace.jsonl`, and refreshes `logs/demo_trace.jsonl`. Preflight verifies that each output example's `trace_id` exists in its referenced `log_file`.

## Fixture Contract Demo Inputs

Six synthetic text-based PDFs are available under `test-fixtures/compliance-documents/` for the cockpit and `/run` demos. They cover enterprise SaaS, DPA/cross-border terms, AI accelerator import/export controls, managed platform integration, media/audience analytics, and cloud AI model services. They are generated fixtures, not real contracts, and are safe for public demo use.

The product cockpit can recognize these fixture PDFs by filename and enrich the evidence draft with provider, service summary, detected domain, missing evidence signals, and risk domains. The Agentathon wrapper also accepts fixture references without browser upload:

```json
{
  "input": {
    "query": "Can we approve this vendor?",
    "documents": [
      { "filename": "06_cloud_ai_model_services_statement_of_work.pdf" }
    ]
  }
}
```

The fixture resolver only reads manifest-listed files below `test-fixtures/compliance-documents/`. It rejects path traversal and hosted Vercel/Railway/dashboard URLs. PDF extraction is limited to these generated text-based fixtures; this is not arbitrary scanned-PDF OCR.

Run the fixture validation matrix:

```bash
python scripts/fixture_demo_matrix.py
python scripts/agentathon_preflight.py
npm run qa
```

The matrix validates expected risk domains, missing evidence terms, required action keywords, decision band, minimum risk, human-review boundary, trace collaboration, and no raw embeddings. It regenerates `output_examples/fixture_*_output.json` and `logs/fixture_*_trace.jsonl` through the actual council path.

For UI or demo-flow changes, add a human browser check on top of `npm run qa`: verify that the chat is usable, evidence states are visible, the decision room renders a business-first memo, and technical trace details are behind progressive disclosure. The intended validation split is visual, functional, and output quality:

- Visual: no blank first-viewport states, clipped labels, or overlapping right-rail content.
- Functional: chat intake, upload, council run, and export controls still work.
- Output quality: the decision room shows decision, rationale, risks, evidence, agent pairings, human actions, stop conditions, and raw technical details only after expansion.

## Live Local/Hosted Consistency Check

Run this only when `.env.local` contains the same server-side values used by the hosted demo:

```bash
npm run qa:live
```

This starts a local `server.js` instance, verifies local `/api/health` and `/api/admin/status`, checks the local `/api/backend` relay against the DigitalOcean backend, checks the Vercel Compass gateway health route, confirms Qdrant configuration, and sends one real smart-intake request through Compass GPT-5.1. It is intentionally not part of `npm run qa` because it is networked and can spend gateway tokens.

## Unit Tests

Run unit tests only:

```bash
npm test
```

The unit tests cover the Node library and API-adjacent behavior under `tests/unit/`. They are the fastest check when changing `lib/`, API handlers, or export/retrieval behavior.

The decision-room and review-pack tests also assert the governed agent loop: L2 autonomy, agentic pairings, 0-9 quality rubric, separated memory lanes, and human stop conditions. These tests are meant to keep the hackathon story tied to real packaged artifacts rather than only UI copy.

## Benchmarks

Run the benchmark script:

```bash
npm run benchmark
```

The benchmark is a local deterministic evaluation of representative compliance cases. It is intended to prove repeatable behavior, latency envelope, decision readiness, and blocker/control generation for the current engine.

## Qdrant RAG Smoke

Run the Qdrant smoke test only after configuring the server-side Compass gateway and Qdrant variables:

```bash
npm run qdrant:smoke
```

The smoke test indexes a tiny synthetic compliance evidence text, searches it, verifies at least one match, and reports provider, collection, indexed chunk count, and match count. If Qdrant is not configured, it reports a skipped result instead of pretending full RAG is active.

## Governance Reference Index

Seed the sanitized governance-reference corpus after configuring the embedding boundary:

```bash
npm run reference:index
```

This indexes `reference_context/sanitised_enterprise_ai_governance_context.md` as advisory `governance_reference` chunks. It is separate from case evidence and governed learning memory, and search responses return safe snippets/citations only.

## CrewAI Dry-Run Checks

Run the CrewAI validation path:

```bash
npm run check:crewai
```

CrewAI is dry-run/orchestration-shaped by default. These checks validate the scaffolded crew and flow manifests. They do not prove decision authority; a separate parity gate must show that Python/CrewAI paths cannot alter immutable Node policy fields.

Optional live CrewAI for the Agentathon FastAPI wrapper is disabled by default and is not installed in the default Docker dependency set. To validate it separately, install `requirements-crewai.txt` and run `/run` with:

```text
AGENT_RUNTIME=crewai_live
CREWAI_ENABLE_LIVE_LLM=1
OPENAI_API_KEY=<real Compass key>
OPENAI_BASE_URL=https://compass.core42.ai/v1
MODEL_FAST=gpt-4.1
```

When this path actually executes, `/run` includes `output.live_advisory.runtime=crewai_live` and `output.live_advisory.status=available`. If CrewAI import or execution fails, the wrapper records `status=unavailable` and continues through the custom deterministic orchestrator. CrewAI output remains advisory; `scripts/check_agentathon_wrapper.py` compares FastAPI policy fields with direct Node output.

## Golden Demo Evidence

Regenerate judge-facing evidence artifacts:

```bash
npm run capture:evidence
```

The generated snapshots are written under `evidence/`, including readiness, live health, benchmark, golden demo, and sample run artifacts. These files are useful for packaging a submission and showing that the current demo can be replayed.

## Known Limitations

- The hosted product has a named authenticated Compass gateway client; self-hosted/local environments still require their own server-side gateway or direct-Compass configuration.
- Online product vector storage is provisioned in isolated Railway Qdrant through Vercel and uses `text-embedding-3-large` semantic vectors. Local/CI vector storage falls back unless Qdrant and embedding environment variables are exported.
- Governed learning memory is advisory precedent storage, not model retraining.
- JavaScript Compass advisory specialists are active in the hosted product. Python CrewAI remains optional/inactive and requires its separate dependencies and service configuration.
- Local OCR/document parsing is not implemented in this repository.
- Hosted audit is an actor-scoped PostgreSQL hash chain with locked heads and scoped reads; local JSONL is test/development-only. It is not immutable/WORM retention and is not yet atomically coupled to every critical business write.
- Redis, durable queues, and OpenClaw are not implemented or claimed. PostgreSQL stores hosted product session/case/quota state and scoped audit chains; filesystem JSONL is an explicit local/test fallback only.
- Demo/session RBAC is enforced; Microsoft Entra SSO is not implemented.
- The remediated P0 correctness/cross-tenant regressions and remaining enterprise findings are documented in the [Deep Code Review](docs/DEEP_CODE_REVIEW.md). CI/live verification passed for implementation SHA `457c7c2`; the residual P1 gates must still close before production-readiness claims.
- Human approval remains required; the agent does not auto-approve operational compliance decisions.
