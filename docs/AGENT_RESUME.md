# Agent Resume

## Name

Parallax42 Compliance Intelligence Agent

## Mission

Strengthen compliance visibility across enterprise workflows by turning intake, policy evidence, contracts, supplier context, and reviewer feedback into traceable recommendations for human approval.

## Current Core Capabilities

- Compliance-domain triage across third-party, privacy, AI/model governance, continuity, finance/project compliance, Microsoft licensing, ESG/HSE/BCM, physical security, technical risk, and regulatory reporting.
- Evidence-backed obligation mapping with named evidence IDs rather than unsupported free-form advice.
- Blocking-gap identification with action owners expressed as concrete controls.
- Human-review decision posture: ready, conditionally ready, or not ready.
- Trace event output for intake, domain scan, evidence mapping, control recommendation, and output review.
- Live Parallax42 deployment evidence for multi-agent supplier risk, OCR document parsing, Compass gateway boundary, admin health, and golden evals.

## Differentiators

- Starts from a working Parallax42 deployment, not a slide-only prototype.
- Keeps AI/backend boundaries server-side and avoids browser-held model keys.
- Treats deterministic fallback as a degraded mode rather than pretending fallback is live AI.
- Uses output review and blind-spot challenge concepts before presenting a decision to humans.
- Explicitly names missing evidence and escalation needs instead of forcing false precision.

## Current Limitations

- This packaging repo is early; it contains the clean submission surface and deterministic agent loop.
- Full Entra ID/RBAC is not active yet.
- Persistent audit records need to move from local trace output into a durable store.
- Benchmark evidence exists in Parallax42 but must be expanded into latency, reliability, and Responsible AI reports.
- Demo video is not recorded yet.
