# AGENTS.md

## Repository Scope

This repository is the Parallax42 Compliance Intelligence Agent:
- Node/CommonJS Vercel/static app.
- Root FastAPI/Docker evaluator wrapper under `run.py` and `app/`.
- PostgreSQL-backed hosted sessions, cases, and quotas with an in-process development fallback.
- Vanilla frontend canonical source under `public/`.
- GitHub Pages mirrors exist at repo root and `docs/`.
- API handlers under `api/`.
- Local server mirror in `server.js`.
- Core logic under `lib/`.

Do not replace the current vanilla frontend/Node product, existing FastAPI evaluator, or existing PostgreSQL persistence with React, Vite, Tailwind, Redis, Celery, OpenClaw, or new build/runtime frameworks unless the user explicitly asks for that architecture change.

Current hosted truth (verified 2026-07-12):

- Vercel serves the Node product API; the local Node mirror defaults to `http://127.0.0.1:3020`.
- Railway PostgreSQL persists sessions, cases, and quotas; Railway Qdrant stores hosted vectors.
- A named authenticated shared-gateway client supplies GPT-5.1 chat/advisory calls and `text-embedding-3-large` semantic embeddings. The provider key remains only inside the shared Compass gateway.
- JavaScript advisory specialists are active. Python CrewAI is optional and inactive in the hosted product.
- Demo/session RBAC is enforced; Microsoft Entra SSO is not implemented.
- Hash-chained audit JSONL is written under serverless `/tmp` and is not durable.

Before changing claims or architecture, consult [`docs/DEEP_CODE_REVIEW.md`](docs/DEEP_CODE_REVIEW.md) and [`docs/AZURE_MIGRATION_PLAN.md`](docs/AZURE_MIGRATION_PLAN.md).

## Required Skill For Frontend Work

For any UI, UX, frontend, visual design, interaction, layout, chat, evidence review, decision room, review pack, or responsive work in this repo, use the local Codex skill:

`parallax42-ui-polish`

Skill path:

`/Users/bhavuk.arora/.codex/skills/parallax42-ui-polish/SKILL.md`

Use it before editing:
- `public/index.html`
- `public/modules/*.js`
- `public/appModules.js`
- `public/app.js`
- `public/styles.css`
- `public/styles/24-working-demo-qa.css`
- root `modules/*.js`
- root `index.html`, `app.js`, `styles.css`, `styles/24-working-demo-qa.css`, `config.js`
- `docs/modules/*.js`
- `docs/index.html`, `docs/app.js`, `docs/styles.css`, `docs/styles/24-working-demo-qa.css`, `docs/config.js`

The skill is the canonical style guide for this app. It supersedes generic frontend taste when working on this repository, while still respecting higher-priority system/developer instructions and the current user request.

Frontend source-of-truth rules:
- Treat `public/` as the canonical frontend source.
- Treat `public/modules/` as the preferred place for new browser-side helper code. `public/appModules.js` is a compatibility aggregator and `public/app.js` should stay focused on orchestration/wiring.
- Treat `public/styles.css` as the primary hand-maintained CSS source and `public/styles/24-working-demo-qa.css` as the loaded final override layer. Numbered fragments `01`-`23` are generated/reference fragments and are not loaded by `index.html`.
- Treat repo-root static files and `docs/` static files as deployment mirrors for GitHub Pages.
- Do not manually edit only one mirror. Any frontend edit must keep `public/`, repo root, and `docs/` byte-for-byte aligned for deployment assets: `index.html`, `modules/*.js`, `appModules.js`, `app.js`, `styles.css`, `styles/24-working-demo-qa.css`, and `config.js`.
- `npm run build:css` is a non-destructive validator for `public/styles.css` and the loaded override; it does not regenerate either file.
- Run `npm run sync:mirrors` after frontend edits, then `npm run check:mirrors`.
- Run `npm run qa` when feasible.

For the Advisor desktop view, preserve a SaaS workbench structure:
- one stable two-column grid
- left side is the primary chat/work surface
- right side stacks council trace and live case intelligence
- no landing-page hero, dead vertical canyon, or orphaned second-row intelligence panel in the first viewport

## Product Truthfulness

Keep the UI and docs honest:
- Deterministic Node policy is the intended final decision owner; do not claim this as a proven invariant until the parity/authority findings in the deep review are closed.
- Human approval remains required.
- Active JavaScript Compass specialists and optional Python CrewAI outputs are advisory only.
- Technical runtime details should remain available, but the main screen should be executive and business-readable.
- Do not claim unavailable production infrastructure or autonomous approval.

## Compass LLM Architecture

- The Compass gateway client is `lib/compassGatewayClient.js`.
- Conversation intake uses `lib/conversationLlmAssessor.js` for Compass-backed intent classification, case-update extraction, active-question interpretation, and structured intake planning.
- User-facing conversation prose is generated through `lib/conversationRenderer.js`, which should use the LLM-provided natural response when present and reserve deterministic templates for gateway-unavailable or invalid-response fallback paths.
- Compass is the only hosted product LLM path. There is no direct-provider fallback for conversation intelligence; when the named gateway client or gateway is unavailable, the UI must clearly label deterministic fallback rather than pretend a live AI turn succeeded.
- The provider key must remain inside the shared gateway. This product may hold only its named, least-privilege gateway client token.
- Deterministic Node policy must remain authoritative when Compass produces intake, advisory, or specialist text. Add parity tests whenever the Python evaluator path is changed.

## Module CSS Contract

`public/modules/*.js` render class names directly. These classes must exist in `public/styles.css` before module markup is shipped or synced to root/docs mirrors:

- Chat UI: `advisor-response-card`, `advisor-natural-response`, `advisor-chat-only`, `advisor-response-head`, `advisor-next-question`, `advisor-system-warning`, `advisor-welcome-response`, `advisor-history-bubble`, `assistant-next`, `thinking-loader`, `thinking-loader-head`, `thinking-loader-copy`, `thinking-orb`, `thinking-attempt-pill`, `thinking-steps`, `thinking-step`, `is-active`, `is-complete`, `eyebrow`.
- Evidence upload UI: `has-pipeline`, `evidence-pipeline`, `pipeline-head`, `pipeline-orb`, `pipeline-rail`, `pipeline-meter`, `pipeline-steps`, `pipeline-files`, `pipeline-telemetry`, `evidence-analysis-panel`, `evidence-analysis-tabs`, `evidence-analysis-list`, `evidence-analysis-head`, `evidence-analysis-chips`, plus evidence state modifiers `is-working`, `is-ready`, `is-error`, `is-warning`, `is-queued`, `is-uploading`, `is-parsing`, `is-embedding`, `is-complete`, `is-active`.
- Decision room: `business-summary`, `council-report`, `decision-room-shell`, `decision-room-hero`, `decision-room-kicker`, `decision-room-hero-grid`, `business-hero`, `decision-room-actions`, `decision-owner-card`, `human-boundary`, `decision-metrics`, `report-section`, `report-section-header`, `required-actions-panel`, `reviewer-handoff-panel`, `reviewer-action-table`, `reviewer-action-head`, `risk-summary-panel`, `risk-list`, `status-danger`, `status-warning`, `status-ready`, `evidence-used-panel`, `evidence-pill-row`, `evidence-used-list`, `agent-findings-panel`, `agent-finding-grid`, `why-decision-panel`, `learning-feedback-panel`, `learning-feedback-form`, `learning-feedback-grid`, `learning-feedback-actions`, `advanced-council-details`, `memory-panel`, `memory-card-grid`, `memory-evidence-list`, `advisory-specialists-panel`, `advisory-card-grid`, `advisory-note`, `council-timeline-panel`, `council-timeline`, `timeline-item`, `timeline-disclosure`, plus timeline/action modifiers `is-validated`, `is-challenged`, `is-escalated`, `is-changed`, `is-unavailable`.
- Admin/runtime status cards rendered from `public/app.js`: `admin-status-card`, `is-ready`, `is-warning`, `is-danger`, `is-loading`.

## Validation

After frontend changes, run:

`npm run check:syntax`

Run `npm run check:css` after CSS changes.

Run `npm run check:mirrors` after frontend changes.

Run `npm run qa` when feasible. For material UI/layout changes, also verify in a browser and check the console.
