# Responsible AI Controls

## Current Controls

- Human approval required for all decisions.
- Output review checks that no automatic approval is implied.
- Evidence IDs are attached to recommendations.
- Missing evidence becomes a named gap rather than invented certainty.
- AI/model governance is a first-class domain, including model-training data-use checks.
- Live Compass access is routed through a gateway boundary in the linked Parallax42 deployment.

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
- The agent must mark degraded or deterministic fallback mode clearly.
