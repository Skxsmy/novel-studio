# Novel Studio

Novel Studio is a local-first writing workspace for long-form fiction. The repository is currently in M5 startup work after the accepted current-stage project recovery baseline.

## Current State

- Current date recorded for this pass: 2026-07-01.
- Project Recovery is accepted for the current stage by user decision on 2026-06-30. This is the baseline for M5, not M5 completion.
- `NS-410` JSON authority, Block Write Editor, and Unified Codex Progression is command-verified through post-Slice 11 audit repair.
- The active plan is `M5` Workshop, Proposal, and Review. Current slice is `M5.0` Current Feature Protection Lock: tests and documentation only unless a protection test exposes a current breakage.
- Project files now use schema-versioned JSON authority for the completed NS-410 scope. Markdown/Word are import, export, mirror, and migration boundary formats; old `codex/progressions/*.yaml` is retired as a runtime authority path.
- Current working draft includes Library, Write, Plan, Codex, Workshop, Review, and Settings shells.
- Write has real project/scene API wiring and partial hierarchy controls.
- Codex has real current-scope entry, category, reusable detail type, relation, mention, progression, tracking, context preview, archive/restore, and delete workflows. Plan integration, knowledge UI, and search-result integration remain later work.
- Settings is no longer a static shell: model profile, service key, connection test, model list, and project cloud policy are API-backed, but the page still needs product-level completion.
- Workshop and Review are not complete product workflows. Do not implement their UI before the M5.0 protection lock and the planned Proposal/Review slices.

## Start Here

Read these files in order. Do not start from screenshots or old NS-409 branch assets.

1. `AGENTS.md`: collaboration rules, cleanup rules, and UI implementation constraints.
2. `STATUS.md`: current truth of the repo.
3. `HANDOFF.md`: shortest handoff for the next contributor.
4. `TASKS.md`: milestone status and active recovery plan.
5. `docs/README.md`: directory map and reading path.
6. `docs/tasks/M5.md`: active M5 task plan and slice order.
7. `docs/testing/M5_ACCEPTANCE.md`: active M5 acceptance record.
8. `docs/design/ui-redesign/M5_WORKSHOP_REVIEW_FIGMA_PLAN.md`: M5 Figma design expectations.
9. `docs/design/ui-redesign/M5_FIGMA_UI_REVIEW.md`: MCP-backed review of the current M5 Figma design.
10. `docs/design/ui-redesign/FIGMA_TO_IMPLEMENTATION_WORKFLOW.md`: Figma-to-code workflow.
11. `docs/tasks/NS-410.md`: completed JSON authority task record.
12. `docs/testing/NS-410_ACCEPTANCE.md`: completed NS-410 acceptance record.
13. `docs/adr/0012-scene-block-documents-and-codex-field-progression.md`: JSON authority and unified Progression decision.
14. `docs/tasks/PROJECT_RECOVERY.md`: accepted current-stage recovery roadmap.
15. `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`: current-stage recovery acceptance record.

## Directory Map

- `apps/server`: Fastify API. Route files live in `src/routes`; avoid growing `src/app.ts`.
- `apps/web`: React/Vite frontend. Current structure is `src/app`, `src/api`, `src/features`, and `src/ui`.
- `packages/contracts`: shared Zod schemas and types. Domain files re-export through `src/index.ts`.
- `packages/storage`: schema-versioned JSON authority files plus SQLite derived index. Markdown/YAML remain only for legacy import/export/mirror boundaries where explicitly documented. `src/index.ts` remains too large and should be split further.
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
