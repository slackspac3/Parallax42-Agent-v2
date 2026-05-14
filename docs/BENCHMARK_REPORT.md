# Benchmark Report

## Baseline Evidence Already Available

Parallax42 deterministic golden-case evals passed:

```text
20/20 cases passed
100% pass rate
15/15 checks per case
```

Covered case themes include:

- high-risk AI SaaS missing DPA
- model-training exclusion gaps
- SOW continuity and exit gaps
- MSA liability and audit-rights gaps
- low-risk SaaS with no PII
- cross-border transfer uncertainty
- strong DPA/SOW evidence
- ambiguous contract type
- applicability decisions for AI, privacy, continuity, and low-criticality cases

## This Repo Baseline

Initial local tests cover:

- empty-case blocking
- AI/privacy/continuity/third-party detection
- ready or conditionally ready decision behavior

Run:

```bash
npm run qa
```

## Missing Before Submission

- Latency report for `POST /api/agent/run`.
- Live Parallax42 backend latency and fallback-rate report.
- Upload/OCR throughput report.
- Responsible AI test suite against prompt injection, unsupported approval language, bias-sensitive assumptions, and data minimization.
- Reliability run showing repeated executions with trace and decision consistency.

## Target Acceptance Threshold

Before submitting, the package should show:

- at least 95% pass rate on deterministic golden cases
- zero unsupported automatic approval outputs
- p95 local deterministic run latency under 500 ms
- p95 live backend no-upload run latency under an agreed operational threshold
- clear fallback labeling whenever live AI is unavailable
