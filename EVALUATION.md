# Evaluation

## How To Run QA

Run the canonical local QA suite from the repository root:

```bash
npm run qa
```

This runs syntax checks, static page checks, unit tests, local benchmarks, and CrewAI dry-run validation. The application is a Node/CommonJS Vercel/static app, so there is no React, Vite, FastAPI, Docker, Redis, Postgres, or durable queue setup required for this QA path.

## Unit Tests

Run unit tests only:

```bash
npm test
```

The unit tests cover the Node library and API-adjacent behavior under `tests/unit/`. They are the fastest check when changing `lib/`, API handlers, or export/retrieval behavior.

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

## CrewAI Dry-Run Checks

Run the CrewAI validation path:

```bash
npm run check:crewai
```

CrewAI is dry-run/orchestration-shaped by default. These checks validate the scaffolded crew and flow manifests without making CrewAI the source of final compliance decisions. The deterministic compliance engine remains authoritative.

## Golden Demo Evidence

Regenerate judge-facing evidence artifacts:

```bash
npm run capture:evidence
```

The generated snapshots are written under `evidence/`, including readiness, live health, benchmark, golden demo, and sample run artifacts. These files are useful for packaging a submission and showing that the current demo can be replayed.

## Known Limitations

- Compass gateway LLM and embedding calls are optional/advisory and require server-side environment configuration.
- Local vector storage is the default; Qdrant REST is optional only when configured.
- Governed learning memory is advisory precedent storage, not model retraining.
- Live advisory specialists require `AGENT_RUNTIME=crewai_llm`, `CREWAI_ENABLE_LIVE_LLM=1`, and server-side Compass credentials; final decisions remain deterministic.
- Local OCR/document parsing is not implemented in this repository.
- Audit is local append-only hash-chained JSONL, not managed durable storage.
- Production Redis, Postgres, Docker, FastAPI, durable queues, and OpenClaw are not implemented or claimed.
- Human approval remains required; the agent does not auto-approve operational compliance decisions.
