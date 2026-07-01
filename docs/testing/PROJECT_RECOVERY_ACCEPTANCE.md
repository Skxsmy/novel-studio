# Project Recovery Acceptance Record

Status: accepted for the current recovery stage
Updated: 2026-06-30

## Conclusion

The user accepted the current Project Recovery stage on 2026-06-30. This acceptance covers the recovery baseline reached before M5 planning: Library/Write/Codex recovery work, honest unavailable Review/Workshop shells for that stage, and the later NS-410 JSON-authority/editor repairs that must not be regressed.

This does not mean Workshop, Proposal, Review, Council, Tool Plans, or full M5 workflows are implemented or accepted. Those are governed by `docs/tasks/M5.md` and `docs/testing/M5_ACCEPTANCE.md`.

## Recovery Release A Acceptance

Release A/current-stage recovery is accepted. The following slice records remain the command evidence and historical implementation notes for that accepted stage.

### Slice A: Baseline Triage

Status: recorded on 2026-06-24 in `docs/tasks/PROJECT_RECOVERY.md`.

- Workspace-by-workspace status table exists for Library, App shell, Write, Overview, Plan, Codex, Settings, Review, Workshop, API/storage/contracts, i18n/copy, and validation.
- Each area is classified as repair now, keep minimal, unavailable for Release A, or audit while touching.
- Hard decisions exist for hierarchy, Codex minimum workflow, Settings minimum workflow, Review/Workshop scope, app-shell honesty, and visual-pass ordering.
- No implementation proceeds from vague "fix UI" direction.

### Slice B: Start-to-Write

Status: command-verified; accepted for the current recovery stage on 2026-06-30.

- Current evidence: `AppShell.test.tsx` covers empty-library project creation, opening the first scene, and adding a Chapter to the selected Volume.
- Current evidence: `AppShell.test.tsx` also covers deleting selected Chapter, deleting selected Act, deleting selected Scene, and creating a Scene inside the selected Act.
- Current evidence: `AppShell.test.tsx` covers entering and exiting Focus from Write, including automatic exit when switching away from Write.
- Current evidence: `AppShell.test.tsx` covers explicit single-item Write structure selection, second-click deselection, no child/stale-scene active frame when selecting a parent, and disabled Scene creation when a selected Volume has no selected Act target.
- Current evidence: `AppShell.test.tsx` covers moving a project to Trash, restoring it, opening the permanent-delete dialog, keeping permanent delete disabled until the exact project name is typed, and sending `confirmTitle` to `DELETE /series/:seriesId`.
- Current evidence: `packages/storage/test/repository.test.ts` and `apps/server/test/app.test.ts` cover project Trash, Restore, rejection of permanent delete before Trash, wrong-title rejection, and physical project directory deletion after exact title confirmation.
- Current evidence: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed with 23 tests after Slice C UI density test additions.
- Current evidence: `npm.cmd run build -w @novel-studio/web` passed.
- Current evidence: `npm.cmd run build` passed after one sandbox-blocked package-dist write attempt was rerun with elevated permissions.
- Current evidence: `npm.cmd run test` passed after one sandbox-blocked package-dist write attempt was rerun with elevated permissions; the passing rerun reported server 16, web 23, AI 18, and storage 43 tests.
- Current evidence: `git diff --check` passed with line-ending warnings only.
- Empty library can create a project through the UI.
- Library project lifecycle includes Trash, Restore, and permanent directory deletion after exact project-name confirmation.
- New project creates coherent first hierarchy and first editable scene.
- Hierarchy add, rename, delete with confirmation, collapse, scroll, and selection work.
- Scene write/save/reload/conflict behavior works.
- Focus exists only in Write and can be exited.
- Tests cover the flow.

### Slice C: Codex Core

Status: command-verified; accepted for the current recovery stage on 2026-06-30.

- Codex API/contract/storage gap audit is recorded in `docs/tasks/PROJECT_RECOVERY.md`.
- Current evidence: `AppShell.test.tsx` covers creating a Codex entry and opening/closing detail by clicking the same entry.
- Current evidence: `AppShell.test.tsx` covers editing entry name, canon description, a custom detail row, research notes, and sending `baseRevision` plus `baseResearchRevision` through `PUT /codex/entries/:entryId`.
- Current evidence: `AppShell.test.tsx` covers a 409 update conflict, visible conflict message, and reload from `GET /codex/entries/:entryId`.
- Current evidence: `AppShell.test.tsx` covers archive through `POST /archive` and restore through `POST /restore`.
- Current evidence: `AppShell.test.tsx` covers custom Details being collapsed until needed, expandable, hideable, and auto-expanded by Add Detail.
- Current evidence: fake Release A relations/progressions/knowledge tabs were removed from the Codex core UI and deferred to Slice D connections.
- Current evidence: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed with 23 tests.
- Current evidence: `npm.cmd run build -w @novel-studio/web` passed.
- Current evidence: `npm.cmd run build` passed after one sandbox-blocked package-dist write attempt was rerun with elevated permissions.
- Current evidence: `npm.cmd run test` passed after one sandbox-blocked package-dist write attempt was rerun with elevated permissions; the passing rerun reported server 16, web 23, AI 18, and storage 43 tests.
- Current evidence: `git diff --check` passed with line-ending warnings only.
- Browser/visual validation was not run by Codex per user instruction.

### Slice D: Codex Connections

Status: command-verified for the current Codex scope; accepted for the current recovery stage on 2026-06-30. Plan review/rework remains deferred.

- Current evidence: `AppShell.test.tsx` covers Write loading real active Codex entries for inline matching. It also covers realtime scene-body alias matching, absence of the old duplicate preview block, removal of the redundant `Codex in scene` panel, Scene Brief hide/restore through an icon-only control, and click-again toggling of the Canon description preview.
- Current evidence: `AppShell.test.tsx` covers Enter in the Write editor preserving consecutive blank lines in the saved scene content.
- Current evidence: `AppShell.test.tsx` covers Space in the Write editor preserving line-leading spaces in the saved scene content.
- Current evidence: `AppShell.test.tsx` covers custom Codex category creation and saving an entry category change through `PUT /codex/entries/:entryId`.
- Current evidence: `AppShell.test.tsx` covers compact Codex category creation, double-click category rename, duplicate category-name rejection, deleting a custom category without deleting its entries, and deleting a Codex entry from the detail lifecycle area.
- Current evidence: `AppShell.test.tsx` covers Codex Relations loading real relation-list data for the selected entry, rendering relation type/direction/description/evidence, removing an active relation through the relation archive API, and creating a new relation through `POST /codex/relations`.
- Current evidence: `AppShell.test.tsx` covers Codex Mentions with manuscript hits from `GET /codex/entries/:entryId/mentions` and other-Codex-entry hits derived from loaded entry canon/research/detail fields. It also covers clicked dashed-underlined mention text opening a Canon description preview instead of jumping to another Codex entry, and covers realtime alias matching inside Codex canon description editing with click-again preview close.
- Current evidence: `AppShell.test.tsx` covers Enter in Codex canon description preserving consecutive blank lines in the saved entry description.
- Current evidence: `AppShell.test.tsx` covers Space in Codex canon description preserving line-leading spaces in the saved entry description.
- Current evidence: the Codex detail header mention count counts manuscript/scene mentions only; Codex-entry mentions are counted inside the Mentions subtab.
- Current evidence: `AppShell.test.tsx` covers Recognition being removed as a tab, Tracking being present, and Tracking changes saving mention matching and AI context policy through `PUT /codex/entries/:entryId`.
- Current evidence: `packages/storage/test/repository.test.ts` covers moving a Codex entry file from the built-in Character directory to a custom category directory when `categoryId` changes, and verifies the old file is deleted.
- Current evidence: `packages/storage/test/repository.test.ts` covers duplicate custom category rejection, deleting a custom category by moving entries to `codex/uncategorized`, and deleting Codex entry plus research files.
- Current evidence: `npx vitest run apps/web/src/app/AppShell.test.tsx` passed with 37 tests.
- Current evidence: `npx vitest run packages/storage/test/repository.test.ts` passed with 42 tests.
- Current evidence: `npm.cmd run typecheck -w @novel-studio/web` passed.
- Current evidence: `npm.cmd run typecheck -w @novel-studio/storage` passed.
- Current evidence: `npm.cmd run typecheck -w @novel-studio/server` passed.
- Current evidence: `npm.cmd run build -w @novel-studio/web` passed.
- Current evidence: `npm.cmd run build:packages` passed after a sandbox-blocked package-dist write attempt was rerun with elevated permissions.
- Current evidence: Codex category and Entry Index scroll were implemented with bounded panel containers; browser/visual acceptance remains user-owned.
- Browser/visual validation was not run by Codex per user instruction.
- Remaining Slice D-adjacent scope: Plan needs a separate full review/rework; progressions, knowledge, effective state, search integration, and full context-boundary alignment checks remain later work.

- Write shows real scene mention/context data where scoped.
- Ambiguity is visible and not falsely resolved.
- Plan/tracking surfaces remain explicitly deferred and are not accepted as complete.
- Codex context and M4 ContextBundle boundaries are consistent.
- `never` and future-information boundaries still hold.

### Slice D2: Editor Foundation

Status: command-verified on 2026-06-24 with CodeMirror 6 adopted for the current Write scene and Codex Canon editor surfaces. The 2026-06-25 Canon preview layer follow-up was visually confirmed by the user. A 2026-06-26 follow-up closes previews from non-mention editor clicks and clamps previews to visible editor bounds. Real Chinese IME behavior still needs user/manual validation on an actual input method; browser screenshots are not a default requirement for this slice.

Evidence:

- Reusable `EditorSurface` added under `apps/web/src/features/editor/` with CodeMirror document state, selection state, transactions, history, keymaps, paste cleanup, read-only state, placeholder support, and state reporting for line/column, selection, character count, word count, and line count.
- Write scene content and Codex Canon description now use `EditorSurface`; the old shared `contentEditable` DOM extraction/caret helper was removed.
- Codex names/aliases render through CodeMirror decorations over pure text. Duplicate matches receive independent decorations; preview UI is editor-anchored and does not enter saved content.
- Saved scene content and Codex Canon descriptions remain plain text, preserving blank lines and line-leading spaces.
- CodeMirror dependencies added: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, and `@codemirror/lang-markdown`, all MIT. Unused `@milkdown/kit` and `@milkdown/react` runtime dependencies were removed from the web package.
- ADR-0010 records the editor runtime decision and supersedes the old Milkdown runtime choice. Its Markdown/YAML persistence assumption is now superseded by NS-410/ADR-0012.
- Follow-up user feedback on 2026-06-25 corrected Canon preview layer order. Canon previews now render through a custom application-level absolute portal instead of CodeMirror's tooltip container; the portal host and preview card use the app's highest overlay layer above editor/detail content, without using viewport-fixed positioning. Clicking inside the preview keeps it open; clicking elsewhere still closes it.
- Follow-up user feedback on 2026-06-26 corrected Canon preview close and scroll-bound behavior. Preview state now closes when the user clicks any non-mention position inside the editor, preview positioning is clamped to the visible editor/scroll-container top and bottom when the referenced text scrolls away, and the preview card scrolls vertically only with horizontal overflow hidden.

Commands:

- `npm.cmd run build -w @novel-studio/contracts` passed.
- `npm.cmd run typecheck -w @novel-studio/web` passed.
- `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx AppShell.test.tsx` passed: 2 files, 41 tests.
- 2026-06-25 follow-up: `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx` passed: 1 file, 6 tests.
- 2026-06-25 follow-up: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed: 1 file, 37 tests.
- 2026-06-25 follow-up: `npm.cmd run typecheck -w @novel-studio/web` passed.
- 2026-06-26 follow-up: `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx` passed: 1 file, 8 tests.
- 2026-06-26 follow-up: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed: 1 file, 38 tests.
- 2026-06-26 follow-up: `npm.cmd run typecheck -w @novel-studio/web` passed.

Acceptance mapping:

- CodeMirror adopted: covered by implementation and ADR-0010.
- No React-rendered contentEditable marks: covered by source search and replacement of Write/Codex editors.
- IME safety: architecture risk addressed by removing React-controlled editable DOM replacement; real Chinese IME manual validation remains outstanding.
- Duplicate-input and duplicate-decoration behavior: covered by `EditorSurface.test.tsx` and AppShell editor integration tests.
- Pure text save, blank lines, and leading spaces: covered by AppShell save-payload tests.
- Decorations/previews do not persist: covered by editor surface tests and save-payload tests.
- Preview layer order: covered by `EditorSurface.test.tsx`, which verifies the preview is mounted outside `.novel-editor` on `.editor-tooltip-layer`, the layer and preview card both use the top overlay z-index, and the preview remains open when the preview itself is clicked.
- Preview close/bounds behavior: covered by `EditorSurface.test.tsx`, which verifies non-mention editor clicks close the preview, `computeCodexPreviewPosition` clamps top/bottom positioning to visible editor bounds, and the preview card has vertical-only scroll styling.
- Undo/redo, paste cleanup, selection restoration/state reporting: covered by focused editor tests and typechecked integration.

### Codex Details Follow-up

Status: command-verified on 2026-06-26; accepted for the current recovery stage on 2026-06-30. Screenshot self-check for the modal follow-up was skipped by user instruction at the time and is not a separate screenshot evidence claim.

Scope covered:

- Codex entry `tags` are invalid and removed from contracts, storage writes, server routes, frontend API payloads, search/table UI, and detail form UI.
- Reusable detail types are category-scoped and persisted as YAML under `codex/detail-types/`.
- Detail types can be listed, created, updated, and permanently deleted through real APIs.
- Detail types can be created for built-in or custom Codex categories and can be marked NSFW.
- Detail type deletion requires `baseRevision` and is blocked while any same-category Codex entry still uses that type name.
- Detail type management is a large modal manager rather than an inline form inside the entry detail panel.
- Details rows select a reusable type instead of free-typing an isolated label.
- Each entry detail row has its own switch for whether that detail is sent with the entry into AI context.
- Detail value editing uses the shared editor surface used by Canon Description and Write.
- The detail-open Codex workspace defaults to Browse Entries: selecting or creating an entry keeps the category rail and Entry Index visible, `Focus Edit` explicitly hides those panels so the selected entry editor can take the whole workbench, and `Browse Entries` returns to list browsing.
- The Details tab uses enlarged author-editing typography, taller inputs, a larger Canon editor, and full-width per-detail editor rows instead of compact backend-form rows.

Evidence:

- `packages/contracts/src/codex.ts` removes Codex entry tags and adds detail type contracts.
- `packages/storage/src/index.ts` reads/writes `codex/detail-types/`, persists NSFW and per-entry `detailAiContext`, rejects duplicate type names in the same category, and blocks deletion while used.
- `apps/server/src/routes/codex.ts` exposes detail type list/create/update/delete routes.
- `apps/server/src/routes/context.ts` filters detail values whose entry-level AI switch is off when building M4 ContextBundles.
- `apps/web/src/features/codex/CodexWorkspace.tsx` removes the Tags field, adds modal detail type management, supports NSFW toggling, and renders detail values with `EditorSurface`.
- `apps/web/src/features/codex/CodexWorkspace.tsx` adds focused entry-editing state and the `Browse Entries` / `Focus Edit` switch.
- `apps/web/src/app/app-shell.css` hides the category rail and Entry Index in focused entry-editing mode and enlarges the Details tab editing layout.
- `AppShell.test.tsx` covers that a newly created Codex entry opens in Browse Entries mode and can explicitly switch into focused edit mode.
- ADR-0011 records the data-format decision, compatibility, migration, rollback, and tests.

Commands:

- `npm.cmd run build -w @novel-studio/contracts` passed.
- `npm.cmd run build -w @novel-studio/storage` passed.
- `npm.cmd run typecheck -w @novel-studio/storage` passed.
- `npm.cmd run typecheck -w @novel-studio/server` passed.
- `npm.cmd run typecheck -w @novel-studio/web` passed.
- `npm.cmd run test -w @novel-studio/storage -- repository.test.ts` passed: 1 file, 43 tests.
- `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts` passed: 2 files, 8 tests.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx` passed: 2 files, 44 tests.
- `npm.cmd run build` passed.
- `npm.cmd run test` passed: server 20 tests, web 44 tests, AI 20 tests, storage 48 tests.
- `git diff --check` passed with line-ending warnings only.

Screenshot self-check:

- Skipped for this modal follow-up by explicit user instruction on 2026-06-26.
- In-app Browser was unavailable; the available browser list only exposed a Chrome extension backend. A local Playwright fallback attempt could not launch an installed browser before the user directed this step to be skipped.
- No current screenshot evidence is claimed for the modal follow-up.

### Slice E: Settings and AI Safety

Status: permanently skipped by user decision on 2026-06-25. This slice is not Recovery Release A acceptance evidence.

Historical command evidence, not acceptance evidence:

- Settings can list, create, update, test, fetch models for, delete service keys from, and archive active model profiles through real APIs.
- Service-key status is shown as saved/missing/no key without displaying credential references or secret values.
- Anthropic and Google/Gemini were later implemented under the NS-408 provider scope, not as Project Recovery Slice E evidence.
- Provider selection and credential checks are enforced before provider access.
- Archived profiles are hidden from the active Settings list.
- Remaining lifecycle requirement: archive is not enough for long-term use. A later cleanup/permanent-delete path must let users clear unwanted archived model profiles after reference checks or immutable snapshots.

Commands:

- `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts model-calls.test.ts` passed: 2 files, 9 tests.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed: 1 file, 37 tests.
- `npm.cmd run typecheck -w @novel-studio/server` passed.
- `npm.cmd run typecheck -w @novel-studio/web` passed.

Acceptance mapping:

- Skipped: no Slice E behavior is required for Recovery Release A acceptance.
- Existing Settings/provider code remains a working draft unless a later task explicitly accepts, reworks, or removes it.
- Future provider integrations are not accepted unless the task and acceptance records cite the provider's official API entry and document the endpoint, auth, streaming, request/response, and model-list behavior used by the implementation.
- Future archive-capable objects are not accepted unless they include both archive/restore behavior and a user-visible cleanup/permanent-delete path with reference protection.

### Slice F: Review, Workshop, and Navigation Honesty

Status: command-verified on 2026-06-25; accepted for the current recovery stage on 2026-06-30.

- Review and Workshop remain visible in the UI.
- Review and Workshop are honest unavailable shells, with no implied backend-connected workflow.
- Future Review and Workshop functionality is recorded as a from-scratch build.
- Navigation does not imply incomplete pages are complete.
- No decorative placeholder dashboard is accepted.

Evidence:

- Sidebar still exposes Review and Workshop.
- Sidebar no longer shows fake workspace counts such as Review 18, Workshop 4, or Codex 128.
- Global `Review Draft` was removed.
- Global search is disabled and labeled unavailable instead of implying command-search support.
- Review keeps the inbox shape but disables unconnected filters and shows compact unavailable states.
- Workshop keeps sessions, conversation, composer, and context basket shape but disables New Session, Send, Insert, and composer input.
- Changed Slice F copy is centralized in `uiText`.

Commands:

- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed: 1 file, 38 tests.
- `npm.cmd run typecheck -w @novel-studio/web` passed.

### Slice G: Visual System and Responsive Acceptance

- Sidebar expanded/collapsed states are usable.
- Core layouts scale without broken density or empty wasteland regions.
- Text fits controls.
- Copy is centralized enough for future bilingual support.
- User accepts the visual/product direction.

### Slice H: Verification and Handoff

Required commands pass:

```powershell
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx
npm.cmd run build
npm.cmd run test
git diff --check
```

2026-06-26 current run:

- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed: 1 file, 38 tests.
- `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx` passed: 1 file, 8 tests.
- `npm.cmd run typecheck -w @novel-studio/web` passed.
- `npm.cmd run build` passed.
- `npm.cmd run test` passed: server 20, web 46, AI 20, storage 48 tests.
- `git diff --check` passed with line-ending warnings only.

Final docs are updated:

- `STATUS.md`
- `HANDOFF.md`
- `TASKS.md`
- `CHANGELOG.md`
- `docs/tasks/PROJECT_RECOVERY.md`
- `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`

Worktree is clean.

## Last Known Passing Commands Before This Reframe

- `AppShell.test.tsx`: 11 tests passed.
- `npm.cmd run build`: passed.
- `npm.cmd run test`: server 16, web 11, AI 18, storage 43 tests passed.
- `git diff --check`: passed with line-ending warnings only.

These results do not mean the product is accepted.
