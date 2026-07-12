# Responsible AI Controls

## Current Controls

- Human approval required for all decisions.
- Output review checks that no automatic approval is implied.
- Evidence IDs are attached to recommendations.
- Evidence assertion state/provenance keeps questions, mentions, placeholders, and policy references from satisfying controls.
- Positive/negative applicability conflicts remain explicit blocking contradictions.
- Missing evidence becomes a named gap rather than invented certainty.
- AI/model governance is a first-class domain, including model-training data-use checks.
- Compass access is routed server-side through the product gateway/API boundary; the browser receives no Compass keys.
- The Agentathon FastAPI wrapper preserves direct `OPENAI_API_KEY` / `OPENAI_BASE_URL` diagnostics for evaluator-style runs.
- Qdrant retrieval and governed learning memory are actor-scoped advisory context only; they do not override deterministic policy.
- Optional CrewAI/Python output is advisory and not active by default; Python preserves Node policy fields unchanged.
- Conditional status is nonterminal. Only explicit Node `approvalEligible: true` permits a human approval action.

## Controls To Implement Next

- Prompt-injection and hostile-document tests.
- Sensitive-attribute handling policy for workforce, geography, and vendor context.
- Bias and disparate-impact review for supplier and jurisdiction scoring.
- Redaction policy for private uploads, raw OCR, and trace output.
- Reviewer override capture with curated learning, not raw production-click training.
- Responsible AI report endpoint for latest eval status and known residual risk.

## Non-Negotiable Behaviors

- The agent must not present itself as a legal approver.
- The agent must not approve a compliance case automatically.
- The agent must not infer sensitive facts without evidence.
- The agent must not expose secrets, raw private documents, or gateway tokens.
- The agent must not expose Qdrant keys or raw embedding vectors.
- The agent must mark degraded or deterministic fallback mode clearly.
- The agent must keep deterministic policy and human review as the final decision boundary.
