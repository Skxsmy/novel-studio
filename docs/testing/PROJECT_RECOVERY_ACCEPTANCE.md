# Project Recovery Acceptance Record

Status: active, not accepted
Updated: 2026-06-24

## Conclusion

The project recovery phase is not accepted yet.

The current React app is command-verified but failed user visual/product acceptance. The active acceptance target is Recovery Release A, not completion of an `NS-409` task.

## Recovery Release A Acceptance

Release A is accepted only when the following slices pass.

### Slice A: Baseline Triage

Status: recorded on 2026-06-24 in `docs/tasks/PROJECT_RECOVERY.md`.

- Workspace-by-workspace status table exists for Library, App shell, Write, Overview, Plan, Codex, Settings, Review, Workshop, API/storage/contracts, i18n/copy, and validation.
- Each area is classified as repair now, keep minimal, unavailable for Release A, or audit while touching.
- Hard decisions exist for hierarchy, Codex minimum workflow, Settings minimum workflow, Review/Workshop scope, app-shell honesty, and visual-pass ordering.
- No implementation proceeds from vague "fix UI" direction.

### Slice B: Start-to-Write

Status: command-verified, not visually accepted.

- Current evidence: `AppShell.test.tsx` covers empty-library project creation, opening the first scene, and adding a Chapter to the selected Volume.
- Current evidence: `AppShell.test.tsx` also covers deleting selected Chapter, deleting selected Act, deleting selected Scene, and creating a Scene inside the selected Act.
- Current evidence: `AppShell.test.tsx` covers entering and exiting Focus from Write, including automatic exit when switching away from Write.
- Current evidence: `AppShell.test.tsx` covers explicit single-item Write structure selection, second-click deselection, no child/stale-scene active frame when selecting a parent, and disabled Scene creation when a selected Volume has no selected Act target.
- Current evidence: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed with 23 tests after Slice C UI density test additions.
- Current evidence: `npm.cmd run build -w @novel-studio/web` passed.
- Current evidence: `npm.cmd run build` passed after one sandbox-blocked package-dist write attempt was rerun with elevated permissions.
- Current evidence: `npm.cmd run test` passed after one sandbox-blocked package-dist write attempt was rerun with elevated permissions; the passing rerun reported server 16, web 23, AI 18, and storage 43 tests.
- Current evidence: `git diff --check` passed with line-ending warnings only.
- Empty library can create a project through the UI.
- New project creates coherent first hierarchy and first editable scene.
- Hierarchy add, rename, delete with confirmation, collapse, scroll, and selection work.
- Scene write/save/reload/conflict behavior works.
- Focus exists only in Write and can be exited.
- Tests cover the flow.

### Slice C: Codex Core

Status: command-verified, not visually accepted.

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

Status: command-verified for the current Codex scope, not visually accepted. Plan review/rework remains deferred.

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

Status: opened from mature-editor research; CodeMirror 6 is the preferred implementation direction unless a concrete spike blocker is recorded. Not implemented yet.

- Pending evidence: CodeMirror 6 spike creates a reusable editor surface for Write scene content and proves plain-text save output.
- Pending evidence: if CodeMirror 6 is rejected, the blocker and replacement choice among ProseMirror/Tiptap/Lexical must be recorded in `docs/tasks/PROJECT_RECOVERY.md`.
- Pending evidence: tests cover scene and Codex canon-description persistence, including blank lines, line-leading spaces, paste cleanup, punctuation input, and duplicate-prevention for ordinary typed text.
- Pending evidence: tests cover decoration-based Codex mention marks that do not enter saved text and do not duplicate the underlying Codex name/alias.
- Pending evidence: tests cover anchored Canon preview popovers that reposition with editor scroll/resize and do not rely on viewport-fixed positioning.
- Pending evidence: tests cover undo/redo and selection restoration for the chosen editor approach.
- Pending evidence: real Chinese IME composition is visually/user validated or explicitly recorded as not yet visually accepted.

- Editor content remains Markdown/YAML-compatible pure text where the product contract requires it.
- Codex decorations and preview UI never become persisted manuscript or Canon description content.
- React must not rerender decorated Codex mark nodes inside a contentEditable editor surface.
- Browser/visual validation remains user-owned unless explicitly requested.

### Slice E: Settings and AI Safety

- Supported model/profile/credential workflow uses real APIs.
- Secrets are not written to project files, logs, console, screenshots, or Git.
- Provider/cloud policy is explicit.
- No silent provider fallback exists.
- Unfinished providers are explicitly deferred or completed.

### Slice F: Review, Workshop, and Navigation Honesty

- Review and Workshop are real scoped workflows or honest unavailable states.
- Navigation does not imply incomplete pages are complete.
- No decorative placeholder dashboard is accepted.

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
