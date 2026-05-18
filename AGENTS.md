# AGENTS.md

## Repository Scope

This repository is the Parallax42 Compliance Intelligence Agent:
- Node/CommonJS Vercel/static app.
- Vanilla frontend under `public/`.
- API handlers under `api/`.
- Local server mirror in `server.js`.
- Core logic under `lib/`.

Do not introduce React, Vite, Tailwind, FastAPI, Redis, Postgres, Celery, OpenClaw, or new frontend build tooling unless the user explicitly asks for that architecture change.

## Required Skill For Frontend Work

For any UI, UX, frontend, visual design, interaction, layout, chat, evidence review, decision room, review pack, or responsive work in this repo, use the local Codex skill:

`parallax42-ui-polish`

Skill path:

`/Users/bhavuk.arora/.codex/skills/parallax42-ui-polish/SKILL.md`

Use it before editing:
- `public/index.html`
- `public/app.js`
- `public/styles.css`

The skill is the canonical style guide for this app. It supersedes generic frontend taste when working on this repository, while still respecting higher-priority system/developer instructions and the current user request.

For the Advisor desktop view, preserve a SaaS workbench structure:
- one stable two-column grid
- left side is the primary chat/work surface
- right side stacks council trace and live case intelligence
- no landing-page hero, dead vertical canyon, or orphaned second-row intelligence panel in the first viewport

## Product Truthfulness

Keep the UI and docs honest:
- Deterministic compliance engine owns final decisions.
- Human approval remains required.
- CrewAI/live LLM specialists are advisory or traced unless proven otherwise.
- Technical runtime details should remain available, but the main screen should be executive and business-readable.
- Do not claim unavailable production infrastructure or autonomous approval.

## Validation

After frontend changes, run:

`npm run check:syntax`

Run `npm run qa` when feasible. For material UI/layout changes, also verify in a browser and check the console.
