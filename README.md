# Novel Studio

Novel Studio is a local-first writing workspace for long-form fiction. The repository is currently in the NS-409 frontend rebuild line.

## Current State

- Current date recorded for this pass: 2026-06-23.
- The React app builds, but the current UI has failed user visual acceptance. Do not treat NS-409 as passed.
- Current working draft includes Library, Write, Plan, Codex, Workshop, Review, and Settings shells.
- Write has real project/scene API wiring and partial hierarchy controls.
- Codex is still a rough shell: it can create/open entries, but the entry editor, relations, progressions, knowledge, mentions, and effective-state workflows are not complete.
- Settings is no longer a static shell: model profile, service key, connection test, model list, and project cloud policy are API-backed, but the page still needs product-level completion.
- Workshop and Review are not complete product workflows.

## Start Here

Read these files in order. Do not start from screenshots or old NS-409 branch assets.

1. `AGENTS.md`: collaboration rules, cleanup rules, and UI implementation constraints.
2. `STATUS.md`: current truth of the repo.
3. `HANDOFF.md`: shortest handoff for the next contributor.
4. `TASKS.md`: milestone status and the only active task line.
5. `docs/README.md`: directory map and reading path.
6. `docs/tasks/NS-409.md`: current frontend rebuild scope and blockers.
7. `docs/testing/NS-409_ACCEPTANCE.md`: command validation and visual rejection record.

## Directory Map

- `apps/server`: Fastify API. Route files live in `src/routes`; avoid growing `src/app.ts`.
- `apps/web`: React/Vite frontend. Current structure is `src/app`, `src/api`, `src/features`, and `src/ui`.
- `packages/contracts`: shared Zod schemas and types. Domain files re-export through `src/index.ts`.
- `packages/storage`: Markdown/YAML file authority plus SQLite derived index. `src/index.ts` remains too large and should be split further.
- `packages/ai`: provider registry, OpenAI-compatible providers, credentials abstraction, and mock provider.
- `docs`: product, architecture, task, testing, and design records.
- `scripts`: Windows startup and development shell scripts.
- `tests/e2e`: Playwright browser acceptance harness.
- `data`: local user/project data. It is ignored and must not be committed.
- `node_modules`, `dist`, `.vite`, `.npm-cache`: generated dependency/build/cache directories. They are not project knowledge.

## Commands

```powershell
.\scripts\dev-shell.ps1
npm.cmd install
npm.cmd run dev
```

Production startup:

```powershell
.\start-novel-studio.cmd
```

Validation:

```powershell
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx
npm.cmd run build
```

Visual acceptance is currently user-owned. Do not claim UI acceptance from DOM checks or repeated browser screenshots.
