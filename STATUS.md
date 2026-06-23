# Current Status

Updated: 2026-06-23

## Summary

- Current line of work: `NS-409`, frontend rebuild.
- Current result: command-verified working draft, visually rejected by the user.
- Do not mark NS-409 as passed.
- Do not begin NS-409.6 as a passed next phase. Continue NS-409 remediation.
- User visual validation is the source of truth for UI acceptance.

## What Exists Now

- `apps/web` has a rebuilt React structure:
  - `src/app`: shell, session state, workspace registration, text constants.
  - `src/api`: client wrappers for series, Codex, and AI/settings APIs.
  - `src/features`: Library, Overview, Write, Plan, Codex, Workshop, Review, Settings.
  - `src/ui`: shared UI primitives and tokens.
- `apps/server` exposes the current API through route modules, but `src/app.ts` still coordinates a large surface.
- `packages/contracts` has been split into domain files, including `codex.ts` and `defaults.ts`.
- `packages/storage` builds on Windows with a local `better-sqlite3` declaration. `src/index.ts` remains too large and should be split further.
- `packages/ai` includes OpenAI-compatible providers, provider registry, credentials abstraction, and tests.

## Current UI State

- Library can show empty state and project creation form, but user found the no-project state blocked normal use before fixes.
- Write has project/scene wiring, save status, hierarchy add/delete/rename work, and Focus scoped to Write.
- Expected hierarchy is `Volume -> Chapter -> Act -> Scene`. No orphan top-level Act/Chapter/Scene rows should appear.
- Add should open a small option menu rather than forcing three large permanent buttons.
- Created hierarchy items should get default names and be renameable later, including double-click title rename.
- Delete belongs beside Add and must delete the selected Volume/Chapter/Act/Scene only after confirmation.
- Codex is a rough API-backed shell. New Entry, select, and same-entry collapse exist, but the real editor/detail workflows are incomplete.
- Settings is API-backed for model profiles, service key, connection test, model list, and project cloud policy, but it is not complete.
- Review and Workshop remain incomplete shells.

## Known Blockers

- Visual design is not accepted.
- Codex page must be redesigned and completed before it can be treated as functional.
- Settings page needs full product coverage and later bilingual adaptation.
- `apps/web/src/app/app-shell.css` is at risk of becoming another large global stylesheet and should be split when the next UI pass stabilizes.
- `packages/storage/src/index.ts` is still too large; move repository domains out when touching storage.
- Do not hardcode final UI copy in components. Use `uiText`, feature view models, or future i18n resources.

## Latest Verification

Latest passing commands:

```powershell
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx
npm.cmd run build -w @novel-studio/web
npm.cmd run build
npm.cmd run test
git diff --check
```

Results:

- `AppShell.test.tsx`: 11 passed.
- `npm.cmd run build`: contracts, AI, storage, server, and web build passed.
- `npm.cmd run test`: server 16, web 11, AI 18, storage 43 passed.
- `git diff --check`: passed with line-ending warnings only.

Browser/visual acceptance is not claimed for the current UI.

## Next Work

1. Finish documentation cleanup and commit current state.
2. Continue NS-409 UI remediation, starting with Codex and the Write hierarchy interactions.
3. Keep backups under `docs/design/**/backups/`.
4. Do not create new status files; update the canonical files listed in `docs/README.md`.
