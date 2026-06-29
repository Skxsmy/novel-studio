# NS-410 Acceptance Record

Status: in progress  
Started: 2026-06-26

## Scope

This record verifies the Block Write Editor and Unified Codex Progression task described in `docs/tasks/NS-410.md`.

Command/browser checks do not equal user visual acceptance. User visual acceptance remains separate because the current recovery UI is not accepted.

## Acceptance IDs

| ID | Status | Evidence |
| --- | --- | --- |
| NS-410-A01 | partial | Slice 2 regenerates current scene test data as JSON block documents; legacy `.md` scene authority is intentionally not preserved because current project data is disposable test data. Full import/migration preview remains later. |
| NS-410-A02 | passed | Slice 1 covered deterministic JSON serialization/revision and reload via `json-authority.test.ts`; Slice 2 covers scene JSON authority save/reload through `repository.test.ts`; Slice 3 covers block document get/update/reload through storage and server tests. |
| NS-410-A03 | passed | Slice 2 projects block documents back to Markdown-compatible `SceneDocument.content`; Slice 3 adds explicit Markdown export and verifies component/private progression blocks are omitted from exported manuscript text. |
| NS-410-A04 | partial | Slice 1 covered malformed JSON, schema-version mismatch, duplicate block IDs, path escape, and atomic replacement cleanup via `json-authority.test.ts`; Slice 2 keeps scene conflict/revision behavior passing; Slice 3 covers stale document revisions and duplicate block IDs through storage/server APIs; Slice 4 covers invalid Progression detail type, scene block, cross-series entry, evidence quote, stale revision, and delete blocker diagnostics. Damaged progression JSON diagnostics remain covered by the JSON authority helper shape but can be expanded later if needed. |
| NS-410-A05 | passed | Slice 4 storage/server tests cover unified JSON Progression create/list/get/update/delete, field/world/relationship targets, reference validation, cross-series rejection, and revision conflicts. |
| NS-410-A06 | partial | Slice 4 adds hard-delete blocker shape and storage coverage for character-knowledge blockers. Write block deletion synchronization remains Slice 8. |
| NS-410-A07 | passed | Slice 5 storage tests verify baseline-only effective entry projection for Canon Description and reusable Detail values. |
| NS-410-A08 | passed | Slice 5 storage tests verify `add`, repeated `add`, `replace`, replace-then-add, and empty `replace` folding per field. |
| NS-410-A09 | passed | Slice 5 storage and server tests verify same-scene block position changes effective Codex fields before/after write-block progressions. |
| NS-410-A10 | passed | Slice 5 storage and effective-entry API tests verify future field progression body, summary, and IDs are absent from earlier responses, with only hidden counts returned. Slice 6 will apply the same invariant to Context Builder payloads. |
| NS-410-A11 | passed | Slice 5 storage tests verify baseline edits update add chains before a replace boundary while projected values after a replace stay independent from earlier baseline changes. |
| NS-410-A12 | pending | Context route tests planned: projected Codex fields and AI switches. |
| NS-410-A13 | passed | Slice 4 keeps character knowledge separate from unified JSON Progression, verifies knowledge can reference JSON progression IDs, and verifies new Progression files are `.json` with no `.yaml` authority file. Slice 5 regression tests keep effective-state and character-knowledge behavior passing while adding field projection. |
| NS-410-A14 | pending | Web tests planned where feasible; user visual acceptance required for final UI. |
| NS-410-A15 | pending | Web tests planned where feasible; user visual acceptance required for final UI. |
| NS-410-A16 | partial | Slice 2 storage repository tests cover existing scene save, hierarchy, mention/index, and search-adjacent regressions while scene files are JSON authority. Context projection remains later. |
| NS-410-A17 | passed | Slice 2 keeps existing scene `content` read/write API behavior compatible by converting `content` writes to JSON blocks and returning projected `content`; Slice 3 adds block document APIs without removing legacy `content` routes, with server and web compatibility checks. |

## Slice Exit Map

Each slice must update this section with actual command output before the next slice starts.

| Slice | Exit requirement | Acceptance IDs |
| --- | --- | --- |
| Slice 0 Planning Lock | Documentation-only state; no contracts/storage/server/web implementation diff. | Precondition for all IDs |
| Slice 1 Contracts And JSON File Foundation | Contracts build and focused JSON helper tests pass; malformed JSON, duplicate block IDs, schema mismatch, revision and atomic-write failures are covered. | A02, A04, A17 partial |
| Slice 2 Scene JSON Authority Compatibility | Existing scene read/write APIs still work; JSON scene save/reload and Markdown projection pass storage/server/web regression tests. | A01, A02, A03, A04, A16, A17 |
| Slice 3 Scene Document API | New scene document get/update/export endpoints pass; stale `baseRevision` conflicts; old `content` APIs still pass. | A02, A03, A04, A17 |
| Slice 4 Unified Progression CRUD | Unified Progression JSON CRUD, validation, cross-series rejection, effective-state compatibility, and delete blocker shape pass. | A05, A06 partial, A13 |
| Slice 5 Projection Engine | Baseline/add/replace/empty replace/same-scene/future isolation/baseline edit projection tests and effective-entry API tests pass. | A07, A08, A09, A10, A11, A13 |
| Slice 6 Context Builder Projection | Context route tests prove projected Codex fields, detail AI switches, hidden empty fields, and future isolation. | A10, A12, A13, A16 |
| Slice 7 Write Ordinary Block MVP | Write loads/saves ordinary blocks; projection powers counts/search/mentions; no UI-only markup saved. | A14 partial, A16, A17 regression |
| Slice 8 Write Progression Blocks | Embedded progression block and panel create/edit/delete synchronize with field progression records. | A05, A06, A09, A14 |
| Slice 9 Codex Effective UI | Codex baseline/history/effective-at-scene UI is tested without future leakage or fake data. | A10, A13, A15 |
| Slice 10 Final Regression | Required commands pass; docs/status/handoff/changelog contain actual results; user visual acceptance remains separate. | A01-A17 |

## Required Commands

At minimum before declaring implementation complete:

```powershell
npm.cmd run build -w @novel-studio/contracts
npm.cmd run test -w @novel-studio/storage -- repository.test.ts
npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx
npm.cmd run build
npm.cmd run test
git diff --check
```

If any full command is blocked by the sandbox, rerun with the required approval and record both the failed command and the passing rerun.

## Slice Results

### Slice 1: Contracts And JSON File Foundation

Status: passed for Slice 1 scope on 2026-06-26.

Changes verified:

- Added scene block document contracts, scene document block-response/update/export DTOs, initial Codex field progression DTOs, and effective-entry DTOs. Slice 4 supersedes the field-only route with unified Progression JSON authority.
- Added `packages/storage/src/jsonAuthority.ts` with deterministic JSON serialization, SHA-256 revision calculation, schema validation, root path containment, and atomic write integration.
- Added focused JSON authority tests for deterministic revision/reload, malformed JSON, schema-version mismatch, duplicate scene block IDs, path escape, and atomic-replacement temp cleanup.
- Kept repository scene APIs untouched in Slice 1.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run test -w @novel-studio/storage -- json-authority.test.ts` | Initial parallel run failed because it raced the contracts build and loaded stale contracts dist; rerun after contracts build passed with 5/5 tests. |
| `npm.cmd run build -w @novel-studio/storage` | Passed. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts` | Passed with 43/43 tests. |

### Slice 2: Scene JSON Authority With Legacy Scene API Compatibility

Status: passed for Slice 2 scope on 2026-06-29.

Changes verified:

- `SceneDocument` now includes `document` and `plainText` while retaining projected Markdown `content`.
- New scene manuscript files are written as `.json` scene authority files containing `SceneBlockDocument`.
- Existing scene create/get/update callers that use `content` still work; `content` writes convert Markdown-like text into blocks and return projected `content`.
- Scene planning/order updates preserve the existing block document instead of rebuilding it from projected Markdown.
- Scene file scanning and hierarchy validation expect `.json` scene authority files; legacy `.md` scene files are not treated as the authority format in this slice.
- Scene-related storage errors touched by Slice 2 were converted to English so new diagnostics do not continue the old mixed/garbled Chinese strings.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run build -w @novel-studio/storage` | Passed. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts --reporter=verbose` | Passed with 49/49 tests. |
| `npm.cmd run build -w @novel-studio/server` | Passed. |
| `npm.cmd run build -w @novel-studio/web` | Passed with the existing Vite large-chunk warning. |

### Slice 3: Scene Document API And Markdown Export

Status: passed for Slice 3 scope on 2026-06-29.

Changes verified:

- Added repository methods for block-aware scene document get/update and Markdown export.
- Added `GET /api/v1/series/:seriesId/scenes/:sceneId/document`.
- Added `PUT /api/v1/series/:seriesId/scenes/:sceneId/document` with `baseRevision` conflict protection.
- Added `GET /api/v1/series/:seriesId/scenes/:sceneId/export/markdown`.
- Added web API client methods for the new document/export routes without switching current Write callers off the legacy `content` route.
- Markdown export is projected from `SceneBlockDocument` and omits `codexProgression` component state and progression IDs from ordinary manuscript text.
- Server user-visible fallback error strings touched by this slice were converted to English.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run build -w @novel-studio/storage` | Passed. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts --reporter=verbose` | Passed with 50/50 tests. |
| `npm.cmd run build -w @novel-studio/server` | Passed. |
| `npm.cmd run test -w @novel-studio/server -- app.test.ts --reporter=verbose` | Passed with 8/8 tests. |
| `npm.cmd run build -w @novel-studio/web` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx --reporter=verbose` | Passed with 46/46 tests; Vitest printed existing React `act(...)` warnings in one focus-mode test. |
| `git diff --check` | Passed with line-ending warnings only. |

### Slice 4: Unified Progression JSON Storage And CRUD API

Status: passed for Slice 4 scope on 2026-06-29.

Changes verified:

- Replaced the old `codex/progressions/*.yaml` runtime path with unified `codex/progressions/*.json` authority files.
- Replaced old `target/changeKind` progression contracts with `kind`, `operation`, `body`, `summary`, `source`, and target-specific fields.
- Unified Progression now supports `field`, `world`, and `relationship` target kinds under the existing `/codex/progressions` API path.
- Added `DELETE /api/v1/series/:seriesId/codex/progressions/:progressionId` with blocker diagnostics.
- Added web API client methods for list/create/get/update/delete/archive/restore Progression calls.
- Existing effective-state and Context Builder routes continue to consume world/relationship Progression from JSON records.
- Storage tests verify field target validation, detail type category validation, write-block source validation, cross-series rejection, stale revision rejection, JSON file path, absence of `.yaml` writes, delete success, and character-knowledge delete blockers.
- Smoke tests now assert scene JSON authority instead of old scene YAML frontmatter.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run build -w @novel-studio/storage` | Passed. |
| `npm.cmd run build -w @novel-studio/server` | Passed. |
| `npm.cmd run build -w @novel-studio/web` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts smoke.test.ts --reporter=verbose` | Passed with 54/54 tests. |
| `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts --reporter=verbose` | Passed with 10/10 tests. |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx --reporter=verbose` | Passed with 46/46 tests; Vitest printed existing React `act(...)` warnings in one focus-mode test. |
| `git diff --check` | Passed with line-ending warnings only. |
| Runtime-code non-ASCII diff scan | Passed with no added non-ASCII runtime strings in `packages/contracts/src/codex.ts`, `packages/storage/src/index.ts`, `apps/server/src/routes/codex.ts`, or `apps/web/src/api/codex.ts`. |

### Slice 5: Projection Engine And Effective Entry API

Status: passed for Slice 5 scope on 2026-06-29.

Changes verified:

- Added repository projection for effective Codex entry fields at a target scene and optional block position.
- Field projection folds baseline Canon Description and reusable Details with unified JSON field Progression records.
- Folding supports baseline-only, `add`, repeated `add`, `replace`, replace-then-add, and empty `replace`.
- Same-scene write-block Progression is ordered by block position; current-block progressions are visible at that block, later blocks are hidden.
- Future field Progression body, summary, and IDs are withheld from earlier effective-entry responses; only hidden counts are returned.
- Baseline edits dynamically affect add chains before a replace boundary and do not affect projected state after a replace.
- Added `GET /api/v1/series/:seriesId/codex/entries/:entryId/effective?sceneId=&blockId=`.
- Added web API wrapper support for effective-entry queries.
- Strengthened write-block Progression validation so `source.sceneId` must match `effectiveFromSceneId`.
- Existing world/relationship effective-state and character-knowledge tests still pass from unified JSON Progression records.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/storage` | Passed. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts smoke.test.ts --reporter=verbose` | Passed with 56/56 tests. |
| `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts --reporter=verbose` | First parallel run failed in the new server test with a transient 500 while `@novel-studio/storage` was being built concurrently; a direct `tsx` inject reproduction returned 200, and rerunning the server command alone passed with 11/11 tests. |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run build -w @novel-studio/server` | Passed. |
| `npm.cmd run build -w @novel-studio/web` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx --reporter=verbose` | Passed with 46/46 tests; Vitest printed existing React `act(...)` warnings in one focus-mode test. |
| `git diff --check` | Passed with line-ending warnings only. |
| Runtime-code non-ASCII diff scan | Passed with no added non-ASCII runtime strings in `packages/storage/src/index.ts`, `apps/server/src/routes/codex.ts`, or `apps/web/src/api/codex.ts`. |

## Invariant Checklist

- Project JSON files are durable authority; Markdown/Word are boundary formats; SQLite is rebuildable.
- AI and Proposal paths do not directly mutate authoritative scene or Codex files.
- Unified JSON Progression replaces old YAML progression for field, world-fact, and relationship changes; character knowledge remains separate.
- Same-scene block position determines visibility.
- Future progression content is not leaked.
- Empty replace hides the field from context.
- Every write remains revision-protected and uses atomic file replacement or transaction helpers.
- Current product/UI visual acceptance is not claimed by automated checks.
- JSON authority must be hidden behind compatibility adapters where possible; unrelated frontend/backend surfaces must not be rewritten solely for the storage format change.
