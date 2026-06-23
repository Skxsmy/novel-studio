# Handoff

Updated: 2026-06-23

## Read First

1. `README.md`
2. `STATUS.md`
3. `TASKS.md`
4. `docs/README.md`
5. `docs/tasks/NS-409.md`
6. `docs/testing/NS-409_ACCEPTANCE.md`
7. `docs/design/ui-redesign/README.md`

## Current Truth

- NS-409 is not accepted.
- The current React frontend is a working draft with passing commands and failed user visual review.
- Do not claim browser or visual acceptance for the current UI.
- Do not move to NS-409.6 as if NS-409.5 passed.
- User specifically wants later contributors to find the current state quickly, not read a pile of historical fragments.

## What Changed In This Working Tree

- Old `apps/web/src` monolithic frontend files were removed.
- New frontend directories were introduced:
  - `apps/web/src/app`
  - `apps/web/src/api`
  - `apps/web/src/features`
  - `apps/web/src/ui`
- Library, Write, Plan, Codex, Settings, Review, Workshop, and Overview now live as feature workspaces.
- Write hierarchy supports more explicit creation/deletion/rename behavior, but still needs product polish.
- Codex has minimal API-backed create/open/collapse behavior, not a complete editor.
- Settings now uses AI/model/project-policy APIs instead of being a static shell.
- Contracts were split with new `codex.ts` and `defaults.ts`.
- Storage has Windows `better-sqlite3` typing repair, but `packages/storage/src/index.ts` still needs extraction.

## Directory Responsibilities

- `apps/server`: Fastify app and route registration. Move domain routes out of `app.ts`.
- `apps/web`: React UI. Keep UI primitives in `src/ui`, API calls in `src/api`, app wiring in `src/app`, product pages in `src/features`.
- `packages/contracts`: shared schemas/types only.
- `packages/storage`: file authority, repository operations, and derived SQLite index.
- `packages/ai`: provider adapters, registry, credentials, mock provider, OpenAI-compatible support.
- `docs`: durable product/architecture/task/testing/design records.
- `scripts`: Windows startup and development helper scripts.
- `tests/e2e`: Playwright acceptance harness.
- `data`: local ignored user/project data.

## Do Not Do

- Do not delete `docs/design/**/backups/`.
- Do not add new status/handoff files.
- Do not treat old NS-409A through NS-409F assets as current guidance.
- Do not trust DOM checks as visual acceptance.
- Do not expand hardcoded mixed-language UI copy in components.
- Do not let `app-shell.css`, `src/app.ts`, or `packages/storage/src/index.ts` keep growing when touching their areas.

## Next Concrete Work

- Rework Codex from rough shell into usable entry management:
  - create entry,
  - edit details,
  - tabs/sections for research, relations, mentions, tracking,
  - click same entry to hide details,
  - no wide detail panel stealing too much space.
- Fix Write hierarchy UX:
  - `Volume -> Chapter -> Act -> Scene`,
  - Add menu instead of permanent large Add buttons,
  - default names on creation,
  - double-click rename,
  - selected-item delete with confirmation,
  - correct collapse behavior and scroll.
- Continue Settings completion after the UI baseline is accepted.

## Validation To Run Before Commit

```powershell
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx
npm.cmd run build
npm.cmd run test
git diff --check
```
