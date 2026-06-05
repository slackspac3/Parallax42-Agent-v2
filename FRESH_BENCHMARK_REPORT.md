# FRESH_BENCHMARK_REPORT

Generated from a fresh local benchmark of `/Users/bhavuk.arora/Parallax42-Compliance-Intelligence-Agent` on 2026-06-05. This is an evidence report, not a product-change log.

> Supersession note: this report captured the earlier `https://compass.core42.ai/v1` probe failure. Current implementation/docs now default to `OPENAI_BASE_URL=https://api.core42.ai/v1` based on Core42's Compass API documentation, while keeping `https://compass.core42.ai/v1` only as a legacy diagnostic alias. Treat any `compass.core42.ai/v1` references below as historical evidence, not current setup guidance.

## 1. Current Git and CI Status

Commands run:

```bash
git status --short --branch
git log -1 --oneline
gh run list --workflow agentathon-preflight.yml --limit 3
gh run list --workflow ci.yml --limit 3
gh run view 26999603489 --json jobs,status,conclusion,headSha,displayTitle
gh run view 26999603477 --json jobs,status,conclusion,headSha,displayTitle
```

Observed output:

```text
git status --short --branch
## main...origin/main

git log -1 --oneline
53c935b Add fixture contract demo matrix
```

Latest visible GitHub Actions status:

| Workflow | Latest visible run | Status | Evidence |
|---|---:|---|---|
| `agentathon-preflight.yml` | `26999603489` | PASS | Run title `Add fixture contract demo matrix`; conclusion `success`; jobs `agentathon-preflight` and `docker-smoke` both succeeded. |
| `ci.yml` | `26999603477` | PASS | Run title `Add fixture contract demo matrix`; conclusion `success`; job `test` succeeded, including `npm run qa`. |

Working tree status before writing this report was clean. This report itself is a new uncommitted file after generation.

## 2. Required Submission Gate Benchmark

Commands run:

```bash
python -m json.tool metadata.json
python scripts/agentathon_preflight.py
python scripts/agentathon_preflight.py --run-api
python scripts/agentathon_preflight.py --json
python scripts/agentathon_preflight.py --docker
npm run qa
```

Results:

| Gate | Status | Runtime / Count | Evidence |
|---|---|---:|---|
| `metadata.json` parses | PASS | not timed | `METADATA_JSON=PASS`. |
| Preflight | PASS | not timed | `AGENTATHON_PREFLIGHT=PASS`; 8/8 checks passed. |
| API preflight | PASS | 1.73s | `/health` and `/run` passed; response status `success`. |
| JSON preflight | PASS | not timed | JSON summary status `PASS`; 8 checks returned `PASS`. |
| Local Docker preflight | SKIPPED | not applicable | `DOCKER_LOCAL=SKIPPED_DOCKER_CLI_MISSING`; Docker CLI not installed locally. |
| Node QA | PASS | unit duration about 8.98s | 188 unit tests passed; benchmark `4/4 passed`; Playwright advisor mock passed; submission check passed. |
| No-secrets scan | PASS | 343 files scanned | Preflight reported no obvious secrets. |
| Trace/output match | PASS | 3 canonical outputs | Preflight verified `output_examples/example_1_output.json` through `example_3_output.json` reference existing logs with matching `trace_id`. |

Preflight output summary:

```text
Required files PASS
metadata.json PASS use_case_id=21, agents=10, tools=9
.env.example PASS Compass placeholders, model variables, SAMPLE_MODE, REQUIRE_COMPASS, and .env ignore rules are present.
input_examples PASS 12 JSON examples parse and include accepted input shapes.
output_examples PASS 3 JSON outputs parse, are not identical, and trace/log references match.
logs PASS 36 JSONL file(s) parse; 15 distinct trace agents found.
Secret scan PASS Scanned 343 source/example files; no obvious secrets found.
Static data size PASS data/ size is 0.0 MB; limit is 500 MB.
AGENTATHON_PREFLIGHT=PASS
```

`npm run qa` output summary:

```text
Syntax check: 167 JS files passed.
Unit tests: 188 passed, 0 failed.
Agentathon submission check: passed.
Agentathon benchmark: 4/4 passed (100%).
CrewAI dry-run checks: passed; live_crewai=false.
```

## 3. Direct API Smoke Benchmark

Started the API with:

```bash
PORT=8000 LOG_DIR=./logs python run.py
```

Server started on `0.0.0.0:8000` and was stopped cleanly after the smoke test.

Endpoint results:

| Endpoint | HTTP | Runtime seconds | Response status | Key fields present | Trace/log | Error |
|---|---:|---:|---|---|---|---|
| `GET /health` | 200 | 0.001685 | `ok=true` | `service`, `evidence_memory`, `learning_memory`, `auth`, `rbac_enforced=false` | n/a | none |
| `GET /metadata` | 200 | 0.008775 | success | `use_case_id=21`, `entrypoint=run.py`, API routes | n/a | none |
| `GET /logs` | 200 | 0.001994 | `ok=true` | `entries` returned | n/a | none |
| `GET /compass/probe` | 200 | 0.946812 | `ok=false` | `configured=true`, `live_compass_verified=false`, `base_url=https://compass.core42.ai/v1` | n/a | Compass returned HTML/405; see section 8. |
| `POST /run example_1` | 200 | 1.438635 | `success` | `output`, `agents`, `agent_trace`, `trace_id`, `log_file` | `trace-eval-001-5964ae72`, `logs/trace-eval-001.jsonl` | none |
| `POST /run example_2` | 200 | 1.483920 | `success` | `output`, `agents`, `agent_trace`, `trace_id`, `log_file` | `trace-eval-002-7e85fa7d`, `logs/trace-eval-002.jsonl` | none |
| `POST /run example_3` | 200 | 1.428901 | `success` | `output`, `agents`, `agent_trace`, `trace_id`, `log_file` | `trace-eval-003-f47c03ff`, `logs/trace-eval-003.jsonl` | none |

`/run` output summaries:

| Example | Decision | Risk | Required actions | Evidence used | Missing evidence | Human review | Final owner | RAG provider | Learning provider | Live Compass | Trace events | Distinct agents | Execution seconds |
|---|---|---|---:|---:|---:|---|---|---|---|---|---:|---:|---:|
| `example_1` | `conditional_approval` | `high` | 6 | 3 | 2 | true | Deterministic Decision Owner | `local-fallback` | `local-jsonl` | `unavailable` | 15 | 9 | 1.394 |
| `example_2` | `reject` | `critical` | 11 | 3 | 6 | true | Deterministic Decision Owner | `local-fallback` | `local-jsonl` | `unavailable` | 15 | 9 | 1.45 |
| `example_3` | `conditional_approval` | `high` | 10 | 2 | 7 | true | Deterministic Decision Owner | `local-fallback` | `local-jsonl` | `unavailable` | 15 | 9 | 1.387 |

## 4. Multi-Agent Collaboration Benchmark

Traces inspected:

```text
logs/example_1_trace.jsonl
logs/example_2_trace.jsonl
logs/example_3_trace.jsonl
```

Scoring rule used: PASS requires at least 5 agents, at least 10 events, and at least 4 collaboration patterns.

| Trace | Status | Distinct agents | Events | Delegation | Retrieval | Retry/refinement | Validation | Critique/challenge | Learning/precedent | Escalation | Deterministic policy | Audit/finalize | `target_agent >= 3` | Output changed by specialist or learning |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| `example_1` | PASS | 9 | 15 | 1 | 1 | 2 | 2 | 1 | 1 | 1 | 2 | 2 | yes, 14 events | yes |
| `example_2` | PASS | 9 | 15 | 1 | 1 | 2 | 1 | 2 | 1 | 1 | 2 | 2 | yes, 14 events | yes |
| `example_3` | PASS | 9 | 15 | 1 | 1 | 2 | 1 | 2 | 1 | 1 | 2 | 2 | yes, 14 events | yes |

This is more than a linear pipeline. The trace shows intake delegation, evidence retrieval with retry, specialist validation and critique, advisory learning/precedent retrieval, human escalation, deterministic policy application, required-control revision, and audit packaging. The traces are input-dependent: `example_2` produces `reject` and `critical` risk, while `example_1` and `example_3` produce high-risk conditional approvals with different evidence gaps and required actions.

Risk: the trace is still generated by a custom orchestrator, not live CrewAI by default. That is acceptable if described honestly, but unsafe to market as live CrewAI collaboration unless `AGENT_RUNTIME=crewai_live` is actually tested.

## 5. Fixture Contract/SOW Benchmark

Command run:

```bash
python scripts/fixture_demo_matrix.py
```

Result:

```text
01_enterprise_saas_master_services_agreement.pdf: decision=conditional_approval risk=high actions=14 trace_events=16
02_data_processing_addendum_and_cross_border_terms.pdf: decision=conditional_approval risk=high actions=14 trace_events=16
03_ai_accelerator_chip_import_export_control_agreement.pdf: decision=needs_more_information risk=critical actions=14 trace_events=16
04_managed_platform_integration_services_agreement.pdf: decision=conditional_approval risk=high actions=14 trace_events=16
05_media_buying_and_audience_analytics_order_form.pdf: decision=needs_more_information risk=high actions=14 trace_events=16
06_cloud_ai_model_services_statement_of_work.pdf: decision=conditional_approval risk=high actions=14 trace_events=16
FIXTURE_DEMO_MATRIX=PASS
```

Fixture manifest:

| Filename | Pages | Tags/domains |
|---|---:|---|
| `01_enterprise_saas_master_services_agreement.pdf` | 29 | `saas`, `msa`, `privacy`, `ai`, `azure-ad`, `salesforce`, `servicenow`, `snowflake` |
| `02_data_processing_addendum_and_cross_border_terms.pdf` | 28 | `dpa`, `privacy`, `subprocessors`, `retention`, `transfer` |
| `03_ai_accelerator_chip_import_export_control_agreement.pdf` | 29 | `export-control`, `ai-chip`, `import`, `sanctions`, `third-party-risk`, `technical-risk` |
| `04_managed_platform_integration_services_agreement.pdf` | 29 | `service-provider`, `integrations`, `erp`, `workday`, `servicenow`, `sharepoint`, `privileged-access` |
| `05_media_buying_and_audience_analytics_order_form.pdf` | 29 | `marketing`, `audience-data`, `crm`, `media-buying`, `consent`, `analytics` |
| `06_cloud_ai_model_services_statement_of_work.pdf` | 29 | `ai-service`, `llm`, `model-governance`, `document-intelligence`, `responsible-ai`, `azure` |

Fixture support status:

| Capability | Status | Evidence |
|---|---|---|
| Manifest exists | PASS | `test-fixtures/compliance-documents/manifest.json` has six synthetic PDFs. |
| Golden matrix exists | PASS | `test-fixtures/compliance-documents/golden_matrix.json`. |
| Matrix script exists | PASS | `scripts/fixture_demo_matrix.py`. |
| `/run` supports fixture filename/path | PASS | Fixture inputs under `input_examples/fixture_*.json` pass through the actual council. |
| Product cockpit fixture upload support | PASS for generated fixtures | `lib/fixtureDocuments.js`, `/api/fixture-documents/lookup`, and `public/app.js` recognize manifest-listed generated fixture PDFs. |
| Arbitrary scanned OCR | NOT CLAIMED | Docs and code limit extraction to generated text-based synthetic fixtures; metadata fallback is used if extraction fails. |

Fixture input examples all exist:

```text
input_examples/fixture_saas_msa.json
input_examples/fixture_dpa_cross_border.json
input_examples/fixture_ai_accelerator_export.json
input_examples/fixture_managed_integration.json
input_examples/fixture_media_analytics.json
input_examples/fixture_cloud_ai_sow.json
```

## 6. Chat-Intake Robustness Benchmark

Command run:

```bash
npm test -- tests/unit/conversationAgent.test.js
```

Result summary:

```text
Unit tests: 188 passed, 0 failed.
Duration: 5704.690916ms.
```

Because the `npm test` script expands the full unit-test list, this command ran the full unit suite plus the requested conversation file. Relevant passing coverage included:

| Behavior | Status | Evidence |
|---|---|---|
| Active-question validation | PASS | Test names include re-asking active clarification when reply is unrelated. |
| Unrelated answer handling | PASS | `conversation re-asks active clarification when the reply is unrelated`. |
| Useful-but-different answer handling | PASS | Conversation tests cover contextual answers without looping. |
| Unknown/pending handling | PASS | Tests record pending/unknown as known gaps without repeating the same question. |
| Export origin handling | PASS | Tests cover export-control hardware import cases. |
| `"from the US"` preserves UAE/Singapore import geography | PASS | `conversation records export origin follow-up without overwriting import geography or repeating the question`. |
| Conversation tests passed | PASS | Full unit suite passed with 188/188. |

## 7. RAG and Learning Benchmark

Commands run:

```bash
python scripts/qdrant_smoke.py
python scripts/agentathon_preflight.py --qdrant-smoke
```

Observed output:

```text
Provider: local
Collection: p42_compliance_evidence
Reason: Missing required env for live Qdrant/Compass embedding smoke: P42_VECTOR_STORE_PROVIDER=qdrant, QDRANT_URL, OPENAI_BASE_URL
QDRANT_SMOKE=SKIPPED
```

Preflight with Qdrant smoke:

```text
Qdrant smoke SKIP Missing required env for live Qdrant/Compass embedding smoke: P42_VECTOR_STORE_PROVIDER=qdrant, QDRANT_URL, OPENAI_BASE_URL
AGENTATHON_PREFLIGHT=PASS
```

RAG/learning status from `/run` examples:

| Field | Status | Evidence |
|---|---|---|
| Qdrant smoke | SKIPPED | Required Qdrant/OpenAI env was not exported for the smoke command. |
| RAG provider in examples | `local-fallback` | Canonical `/run` examples returned `output.rag_evidence_memory.provider=local-fallback`. |
| `qdrantConfigured` | Mixed | Server health showed Qdrant env present through local app env, but examples still used local fallback and smoke was not live-verified. Do not claim active Qdrant. |
| `browserEmbeddingsRetained` | false | Present in health and output memory metadata. |
| Raw embeddings exposed | false | Output JSON checked for `embedding`, `embeddings`, `vector`, `vectors`, and `query_vector`; none found. |
| Learning provider | `local-jsonl` | Canonical examples returned local governed learning memory. |
| Similar cases found | 5 | Canonical examples returned `similar_cases_found=5`. |
| Learning advisory-only | true | Output marks learning memory advisory only. |
| Model training | false | Governed learning memory is not model training. |
| Policy mutation | false | Deterministic policy remains authoritative; learning does not silently change policy. |

Safe claim: RAG and governed learning memory are implemented with local fallback and no embedding exposure. Unsafe claim: Qdrant-backed durable RAG is active or Compass embeddings are live verified.

## 8. Compass Benchmark

Command run:

```bash
python scripts/compass_doctor.py --json
```

Observed result:

```text
COMPASS_DOCTOR=SKIPPED
status=SKIPPED
configured=false
normalized_base_url=https://compass.core42.ai/v1
base_url_official=true
openai_base_url_raw_present=false
error_type=missing_env
message=OPENAI_API_KEY and OPENAI_BASE_URL are required for live Compass diagnostics.
```

Additional API probe from the running server:

```text
GET /compass/probe
HTTP 200
ok=false
configured=true
live_compass_verified=false
base_url=https://compass.core42.ai/v1
models_endpoint.status_code=200
models_endpoint.json=false
chat_completion.status_code=405
chat_completion.ok=false
chat_json=false
error_type=html_chat_response
message=Received HTML from /chat/completions. The path/base URL/proxy may not expose the OpenAI-compatible Compass chat route.
```

Interpretation:

| Item | Status |
|---|---|
| Direct Compass verified | false |
| `/models` JSON | false in server probe; doctor skipped because env was not exported |
| `/chat/completions` JSON | false in server probe |
| Selected default chat model | `gpt-4.1` |
| Selected reasoning model | `gpt-5.1` |
| Selected embedding model | `text-embedding-3-large` |
| Safe claim | Code is wired for direct Compass through `OPENAI_API_KEY` and `OPENAI_BASE_URL=https://compass.core42.ai/v1`; diagnostics exist. |
| Unsafe claim | Live direct Compass has been verified. |

The server-side probe found local configuration and attempted direct Compass, but the response was HTML/405, not a valid OpenAI-compatible JSON response. The CLI doctor did not run a live proof because `OPENAI_BASE_URL` was not exported in the shell. A strict live proof remains a P0 blocker if the final screen requires confirmed direct Compass.

## 9. Runtime Variability / Hardcoding Benchmark

Command run:

```bash
rg -n "output_examples|precomputed|canned|static response|if input_id|example_1" app lib scripts tests README.md EVALUATION.md docs || true
```

Findings:

| Check | Status | Evidence |
|---|---|---|
| Runtime loads `output_examples` | PASS / not found | No `app/` or `lib/` runtime path was found loading output examples as responses. |
| Dangerous canned response path | PASS / not found | Search did not find a runtime `precomputed`, `canned`, `static response`, or `if input_id` response path. |
| References in docs/tests/preflight | Expected | `README.md`, `EVALUATION.md`, `docs/`, `scripts/regenerate_agentathon_artifacts.py`, `scripts/agentathon_preflight.py`, and tests reference examples for validation and artifact generation. |
| Test-only saved-output check | Safe | `scripts/check_agentathon_wrapper.py` loads `output_examples/example_1_output.json` in a static-output regression check, not as runtime behavior. |
| Outputs differ materially | PASS | Canonical examples return different decisions/actions: conditional approval/high, reject/critical, conditional approval/high with different evidence gaps. Fixture matrix outputs also vary by document. |

## 10. Judge-Rubric Benchmark

Estimated score assumes no automatic disqualification. Direct Compass remains the main DQ risk.

| Category | Current score | Evidence | Remaining gap | Fastest lift |
|---|---:|---|---|---|
| Problem Relevance /15 | 14 | Clear legal/compliance Use Case 21 fit; vendor/privacy/export-control workflows are realistic. | Quantified time/risk impact in demo. | Add crisp demo narrative with measurable review-time reduction. |
| Agent Design & Architecture /20 | 18 | 9-agent trace, delegation, retry, critique, validation, learning memory, deterministic final owner. | Live Compass specialist not verified; live CrewAI not default. | Verify live Compass; keep CrewAI optional and truthful. |
| Technical Implementation /20 | 16 | Root `run.py`, FastAPI on port 8000, `/run`, Docker CI green, preflight green, fixture matrix green. | Direct Compass failed/unverified; Qdrant smoke skipped. | Pass strict Compass doctor; optionally pass Qdrant smoke. |
| Innovation & Creativity /15 | 13 | Deterministic decision owner plus advisory council, RAG memory, governed learning, fixture contract intelligence. | Qdrant/live embedding not demonstrated. | Smoke-test Qdrant + Compass embeddings. |
| Impact & Usefulness /15 | 13 | Outputs are review-ready with required actions, missing evidence, human review boundary. | Demo proof and adoption story. | Record a 2-3 minute judge-focused demo. |
| Demo & Presentation /5 | 3 | Online docs and fixture demos are ready; no final video verified here. | Final recorded demo. | Record live workflow with fixture upload, `/run`, and trace. |
| Robustness & Reliability /5 | 4 | QA/preflight/CI pass; structured fallback; no-secrets scan; Docker CI green. | Compass strict proof missing. | Pass `python scripts/compass_doctor.py --strict`. |
| Bonus /5 | 3 | RAG/learning abstractions, human-in-loop, fixture PDFs, CI Docker smoke. | Qdrant not smoke-tested; no OCR/multimodal claim. | Enable Qdrant smoke if credentials are available. |

Score estimates:

| Scenario | Estimated score |
|---|---:|
| Current non-DQ total | 81 / 100 |
| If final demo is recorded well | 84 / 100 |
| If direct Compass verifies | 86 / 100 |
| If fixture matrix passes | 81 / 100, already realized; without it this would be closer to 76 |
| If Qdrant smoke passes | 84 / 100 |

DQ risk: medium while direct Compass remains unverified. Docker CI risk is now low because the online `docker-smoke` job passed.

## 11. Final Recommendation

P0 blockers:

| Blocker | Why it matters | Exact command | Current status |
|---|---|---|---|
| Direct Compass strict verification | Official screening may treat live Compass as a hard gate. | `OPENAI_API_KEY=... OPENAI_BASE_URL=https://compass.core42.ai/v1 python scripts/compass_doctor.py --strict` | Not verified; API probe returned HTML/405. |

P1 score lifts:

| Lift | Why it matters | Exact command |
|---|---|---|
| Record final demo | Highest presentation lift; shows judge-visible value. | Use online GitHub links, CI Docker proof, product cockpit fixture upload, and `/run` trace. |
| Qdrant smoke | Converts RAG from implemented fallback to live durable evidence memory. | `P42_VECTOR_STORE_PROVIDER=qdrant QDRANT_URL=... OPENAI_API_KEY=... OPENAI_BASE_URL=https://compass.core42.ai/v1 python scripts/qdrant_smoke.py` |
| Strict Compass in `/run` | Shows non-sample advisory path is truly live. | `REQUIRE_COMPASS=true python scripts/agentathon_preflight.py --run-api --strict-compass` |

P2 nice-to-have:

| Item | Why |
|---|---|
| Live CrewAI demo | Could raise architecture score, but only if stable and explicitly tested. |
| Enforced RBAC | Not required for evaluator path; unsafe to rush. |
| Arbitrary OCR/parser | Not needed for generated text-based fixtures and risky to overclaim. |

Ready to record demo: yes. The repo has enough stable evidence: green QA, green preflight, green Docker CI, passing fixture matrix, strong traces, and output variability.

Ready to submit: partial. Technically much stronger and likely acceptable if Compass is not strictly live-checked by the evaluator, but not fully winner-safe until direct Compass strict verification passes.

Do not claim:

```text
Live direct Compass verified.
Active Qdrant-backed RAG.
Live CrewAI execution by default.
RBAC enforcement.
Production persistence or enterprise-durable audit.
Arbitrary scanned-PDF OCR.
Autonomous approval.
```

Next exact command to run if a real Compass key is available:

```bash
OPENAI_API_KEY=<Compass key> \
OPENAI_BASE_URL=https://compass.core42.ai/v1 \
MODEL_FAST=gpt-4.1 \
MODEL_REASONING=gpt-5.1 \
python scripts/compass_doctor.py --strict
```

```text
SUMMARY_FOR_CHATGPT
GIT: clean main at 53c935b Add fixture contract demo matrix before this report file was created
CI_AGENTATHON: PASS, GitHub run 26999603489 succeeded
CI_DOCKER: PASS, docker-smoke job in run 26999603489 succeeded
QA: PASS, npm run qa passed with 188 unit tests and benchmark 4/4
PREFLIGHT: PASS, python scripts/agentathon_preflight.py returned AGENTATHON_PREFLIGHT=PASS
RUN_API: PASS, --run-api passed in 1.73s; direct curl smoke returned 200 for /health, /metadata, /logs, /compass/probe, and three /run examples
BENCHMARK: PASS for mandatory local gates except local Docker skipped due missing Docker CLI and direct Compass unverified
CONVERSATION_TESTS: PASS, conversation robustness tests passed inside 188/188 unit suite
FIXTURE_MATRIX: PASS, six synthetic fixture PDFs produced expected risk/decision/trace invariants
DIRECT_COMPASS: FAIL/UNVERIFIED, /compass/probe returned HTML/405 and compass_doctor --json skipped because env was not exported
QDRANT: SKIPPED, qdrant_smoke skipped because required live Qdrant/Compass env was not exported
RAG_PROVIDER: local-fallback in canonical /run examples
LEARNING_MEMORY: PASS local-jsonl advisory memory, similar_cases_found=5, advisoryOnly=true
MULTI_AGENT_TRACE: PASS, each canonical trace has 9 agents, 15 events, delegation/retry/validation/critique/learning/escalation/policy/audit
OUTPUT_VARIABILITY: PASS, examples differ materially; example_2 rejects at critical risk
NO_SECRETS: PASS, preflight scanned 343 files and found no obvious secrets
CURRENT_SCORE: about 81/100 non-DQ
SCORE_WITH_DEMO: about 84/100
SCORE_WITH_COMPASS: about 86/100
SCORE_WITH_FIXTURE_MATRIX: 81/100 because fixture matrix already passes; without it about 76/100
SCORE_WITH_QDRANT: about 84/100
READY_TO_RECORD_DEMO: yes
READY_TO_SUBMIT: partial/risky until direct Compass strict verification passes
P0_BLOCKERS: direct Compass strict verification
NEXT_STEP: run python scripts/compass_doctor.py --strict with real OPENAI_API_KEY and OPENAI_BASE_URL=https://compass.core42.ai/v1
END_SUMMARY
```
