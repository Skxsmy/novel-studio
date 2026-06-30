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
| NS-410-A04 | passed | Slice 1 covered malformed JSON, schema-version mismatch, duplicate block IDs, path escape, atomic replacement cleanup, and post-write checksum/readback verification via `json-authority.test.ts`; Slice 2 keeps scene conflict/revision behavior passing; Slice 3 covers stale document revisions and duplicate block IDs through storage/server APIs; Slice 4 covers invalid Progression detail type, scene block, cross-series entry, evidence quote, stale revision, and delete blocker diagnostics; the audit repair adds missing/archived/wrong-scene/wrong-block/duplicate embedded Progression block rejection plus malformed transaction journal quarantine. |
| NS-410-A05 | passed | Slice 4 storage/server tests cover unified JSON Progression create/list/get/update/delete, field/world/relationship targets, reference validation, cross-series rejection, and revision conflicts. The audit repair adds proposal-sourced hard-delete blocking through `sourceId`; model-call blocker scanning is not claimed because current ModelCallLog records have no Progression reference field. |
| NS-410-A06 | passed | Storage blocks hard deletion when a Progression is referenced by character knowledge, by an embedded write block, or by proposal provenance. Slice 8 adds a dedicated scene progression-block deletion command/API that removes the embedded `codexProgression` block and linked Progression together, or returns blocker reasons without deleting either record. Model-call reference scanning remains a future contract because ModelCallLog has no Progression reference field yet. |
| NS-410-A07 | passed | Slice 5 storage tests verify baseline-only effective entry projection for Canon Description and reusable Detail values. |
| NS-410-A08 | passed | Slice 5 storage tests verify `add`, repeated `add`, `replace`, replace-then-add, and empty `replace` folding per field. |
| NS-410-A09 | passed | Slice 5 storage and server tests verify same-scene block position changes effective Codex fields before/after write-block progressions. The audit repair extends same-scene block-position isolation to world and relationship Progression effective state. |
| NS-410-A10 | passed | Slice 5 storage and effective-entry API tests verify future field progression body, summary, and IDs are absent from earlier responses, with only hidden counts returned. Slice 6 context route tests verify future field progression body, summary, and IDs are also absent from Context Bundle payloads. The audit repair adds same-scene later-block future isolation for world/relationship state and current-scene body block slicing. Slice 9 web tests verify the Codex effective-at-scene card hides later-scene field Progression content while showing only hidden-future counts for the selected earlier scene. |
| NS-410-A11 | passed | Slice 5 storage tests verify baseline edits update add chains before a replace boundary while projected values after a replace stay independent from earlier baseline changes. |
| NS-410-A12 | passed | Slice 6 `context-routes.test.ts` verifies Context Builder uses projected Codex description/details, respects per-detail AI switches, omits empty-replaced fields, and records hidden future field counts without content leakage. The audit repair adds block-aware current-scene manuscript context, world/relationship effective-state block isolation, and ContextItem `sourceRefs` for projected Progression sources. |
| NS-410-A13 | passed | Slice 4 keeps character knowledge separate from unified JSON Progression, verifies knowledge can reference JSON progression IDs, and verifies new Progression files are `.json` with no `.yaml` authority file. The audit repair moves character knowledge authority to `codex/knowledge/<id>.json` and verifies no new knowledge `.yaml` file is written. Slice 9 consumes only unified Progression APIs and effective-entry projection; it does not introduce knowledge/progression merging or an old YAML progression UI. |
| NS-410-A14 | passed for automated Write behavior | Slice 7 web tests verify ordinary paragraph/heading/scene-break editing and saving through `SceneBlockDocument`, with no saved UI-only markup and no old single-document text editor path for Write scene content. Slice 8 adds embedded progression create/edit/collapse/delete behavior and verifies saved scene documents contain `codexProgression` data only, not UI-only preview markup. The post-Slice 9 editor refactor replaces the visible repeated block-card/textarea UI with a continuous Tiptap-backed manuscript editor while keeping `SceneBlockDocument` as authority; adapter and web tests cover mapping, save, paragraph add/delete controls, absence of the formatting panel, legacy heading/scene-break persistence, story-change behavior, and Codex regressions. User visual acceptance remains separate. |
| NS-410-A15 | passed for automated Slice 9 scope | Web tests cover Codex baseline versus effective state, field-grouped Progression history, and earlier-scene future isolation. User visual acceptance remains separate and is not claimed by this automated result. |
| NS-410-A16 | passed | Slice 2 storage repository tests cover existing scene save, hierarchy, mention/index, and search-adjacent regressions while scene files are JSON authority. Slice 6 verifies Context Builder reads projected scene/Codex context at scene/block position. Slice 7 verifies Write-local counts and Codex mention marks derive from `SceneBlockDocument` projection. The audit repair switches storage search, FTS indexing, Codex mention indexing, previous-scene summaries, and current-scene Context Builder body projection to plain text derived from blocks. |
| NS-410-A17 | passed | Slice 2 keeps existing scene `content` read/write API behavior compatible by converting `content` writes to JSON blocks and returning projected `content`; Slice 3 adds block document APIs without removing legacy `content` routes, with server and web compatibility checks. Slice 7 keeps legacy route mocks/regressions available while moving the Write scene-content path to the document endpoint. |

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
| Slice 7 Write Ordinary Block MVP | Write loads/saves ordinary blocks through a native block editor, not the old single-document text editor path; projection powers counts/search/mentions; no UI-only markup saved. | A14 partial, A16, A17 regression |
| Slice 8 Write Progression Blocks | Embedded progression block and panel create/edit/delete synchronize with field progression records. | A05, A06, A09, A14 |
| Slice 9 Codex Effective UI | Codex baseline/history/effective-at-scene UI is tested without future leakage or fake data. | A10, A13, A15 |
| Write Editor Refactor Follow-up | Continuous Write manuscript editor replaces the visible repeated block-card UI while preserving old Write functions and JSON authority. | A14, A13/A15/A16/A17 regression |
| Slice 10 Remaining JSON Authority Migration | Remaining YAML/Markdown runtime authority paths migrate to schema-versioned JSON or are explicitly narrowed to import/export/migration boundaries. | A01, A04, A13, A16, A17 |
| Slice 11 Final Regression | Required commands pass; docs/status/handoff/changelog contain actual results; user visual acceptance remains separate. | A01-A17 |

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

### Slice 6: Context Builder And Preview Projection

Status: passed for Slice 6 scope on 2026-06-29.

Changes verified:

- `ContextPreviewInput` accepts an optional `blockId` so context callers can request the current scene/block position.
- Codex context preview and Context Builder now route included Codex entries through effective field projection at the requested scene/block.
- ContextBundle Codex entry content now uses projected Canon Description and reusable Detail values instead of baseline-only entry text.
- Per-detail AI switches still apply after projection.
- Empty `replace` field progressions are omitted from ContextBundle content.
- Hidden future field progression counts are recorded without exposing future body, summary, or progression ID.
- The web Codex API client can pass `blockId` to context preview/effective-entry calls.
- Runtime strings newly added or rewritten in the Slice 6 context path are English; the targeted non-ASCII diff scan found no added non-ASCII runtime strings in touched runtime files.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run build -w @novel-studio/storage` | Passed. |
| `npm.cmd run build -w @novel-studio/server` | Initial parallel run failed because server typecheck started before the updated storage declaration was available and saw the old `previewCodexContext` arity; rerun after storage build passed. |
| `npm.cmd run build -w @novel-studio/web` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run test -w @novel-studio/server -- context-routes.test.ts app.test.ts --reporter=verbose` | Passed with 11/11 tests. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts smoke.test.ts --reporter=verbose` | Passed with 51/51 tests. |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx --reporter=verbose` | Passed with 46/46 tests; Vitest printed existing React `act(...)` warnings in one focus-mode test. |
| `git diff --check` | Passed with line-ending warnings only. |
| Runtime-code non-ASCII diff scan | Passed with no added non-ASCII runtime strings in `packages/contracts/src/context.ts`, `packages/storage/src/index.ts`, `apps/server/src/routes/context.ts`, `apps/server/src/routes/codex.ts`, or `apps/web/src/api/codex.ts`. |

### Slice 7: Write Block Editor MVP For Ordinary Blocks

Status: passed for Slice 7 scope on 2026-06-29.

Changes verified:

- Write now loads the active scene through `GET /api/v1/series/:seriesId/scenes/:sceneId/document`.
- Write saves scene body changes through `PUT /api/v1/series/:seriesId/scenes/:sceneId/document` with the current `baseRevision`.
- Write scene content is rendered as native `SceneBlockDocument` blocks for paragraph, heading, quote, and scene break content.
- Write scene content no longer uses the old single-document CodeMirror/`EditorSurface` path. Codex editing surfaces can still use `EditorSurface`; this slice changes the Write scene-content path only.
- Counts and inline Codex mention marks are derived from block projection helpers, and ordinary block saves do not include editor UI text or markup.
- Legacy scene `content` compatibility remains available for older callers and tests.
- Runtime strings newly added or rewritten in the Slice 7 Write path are English; the targeted non-ASCII diff scan found no added non-ASCII runtime strings in touched runtime files.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run build -w @novel-studio/web` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx --reporter=verbose` | Passed with 46/46 tests; Vitest printed existing React `act(...)` warnings in the write selection and focus-mode tests. |
| `npm.cmd run test -w @novel-studio/server -- app.test.ts --reporter=verbose` | Passed with 10/10 tests. |
| `rg -n "EditorSurface|CodeMirror|cm-" apps/web/src/features/write apps/web/src/app/useProjectSession.ts apps/web/src/app/sceneBlocks.ts` | Passed by returning no matches for the Write scene-content path. |
| `git diff --check` | Passed with line-ending warnings only. |
| Runtime-code non-ASCII diff scan | Passed with no added non-ASCII runtime strings in `apps/web/src/app/useProjectSession.ts`, `apps/web/src/features/write/WriteWorkspace.tsx`, `apps/web/src/app/sceneBlocks.ts`, `apps/web/src/app/app-shell.css`, `apps/web/src/app/App.tsx`, or `apps/web/src/app/AppShell.test.tsx`. |

### Slice 1-7 Audit Repair Before Slice 8

Status: passed for repaired NS-410 backend/storage/context scope on 2026-06-29.

Audit findings verified and repaired:

- Scene document updates now reject dangling, archived, wrong-scene, wrong-block, and duplicate `codexProgression` block references.
- World and relationship Progression effective state now respects same-scene block position, including hidden future counts.
- Character knowledge authority now writes and reads `codex/knowledge/<knowledgeId>.json`; new YAML knowledge files are not written.
- Effective detail projection normalizes known reusable Details to detail type IDs and removes stale legacy detail-name keys from projected responses.
- Storage search, FTS indexing, Codex mention indexing, previous-scene summaries, and current-scene Context Builder body use plain text projected from blocks.
- Context Builder current-scene body is sliced to the requested block position instead of always sending the full scene.
- Context Bundle Codex items include `sourceRefs` for projected Codex/Progression/Knowledge sources; projected item `sourceRevision` is derived from those refs and content.
- Codex context preview returns hidden future field counts without exposing future Progression ID, body, or summary.
- JSON authority writes now perform post-write readback, checksum comparison, and schema validation before returning success.
- Malformed transaction journals are quarantined as `.invalid` and reported as `INVALID_DATA` instead of being silently applied or causing low-level parse errors.
- Progression deletion blocks character-knowledge references, embedded write-block references, and proposal-sourced Progressions that carry `source.sourceId`.

Audit findings intentionally not claimed as completed:

- `proposal` storage and `model-call` Progression reference scanning are not implemented because current Proposal storage is still contract-only and ModelCallLog has no Progression reference field. The delete contract is not described as fully implemented for model-call blockers until those references exist.
- Project archive/delete/restore is a project-lifecycle capability. The user explicitly pulled that lifecycle repair into the current branch after the Slice 8 review; evidence is recorded below and in `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`, but it is not counted as an NS-410 JSON-authority acceptance ID.
- Broad whole-project YAML/Markdown removal is not complete. Current NS-410 authority completion covers scene manuscript JSON, unified Progression JSON, and character knowledge JSON. Remaining YAML/Markdown authority files are inventoried below; they are open NS-410 JSON-authority work for Slice 10 unless a later product/ADR decision explicitly narrows a path to an import/export/migration boundary.
- Internal names such as `SceneFrontmatterSchema` and compatibility helpers are known cleanup debt; they are not runtime authority paths and should be renamed when the scene contract layer is next touched.

Remaining runtime authority inventory outside the completed NS-410 JSON authority set:

- Story structure: `series.yaml`, `book.yaml`, `acts/<id>.yaml`, `chapters/<id>.yaml`.
- Planning: `planning/timeline.yaml`, `planning/events/<id>.yaml`.
- Sections and review: `sections/<sceneId>/<sectionId>.md`, `review/anchors/<id>.yaml`.
- Codex baseline and supporting documents: `codex/categories/<id>.yaml`, `codex/detail-types/<id>.yaml`, `codex/*/<entryId>.md`, `codex/entry-research/<entryId>.md`, `codex/relations/<id>.yaml`.
- AI/prompt storage from earlier M4 work: `.studio/model-profiles/*.yaml`, `.studio/context-bundles/*.yaml`, `.studio/model-calls/*.yaml`, prompt role/template/preset YAML files.
- Proposal storage remains a future `.json` design in architecture docs, not a completed runtime implementation.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run build -w @novel-studio/storage` | Passed after rerunning sequentially so storage read the updated contracts dist. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts smoke.test.ts --reporter=verbose` | Passed with 62/62 tests. |
| `npm.cmd run build -w @novel-studio/server` | Passed. |
| `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts --reporter=verbose` | Passed with 11/11 tests. |
| `npm.cmd run build -w @novel-studio/web` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx --reporter=verbose` | Passed with 46/46 tests; Vitest printed existing React `act(...)` warnings in the write selection and focus-mode tests. |
| `npm.cmd run build` | Passed; package builds, server build, and web production build succeeded with the existing Vite large-chunk warning. |
| `npm.cmd run test` | Passed with server 23/23, web 46/46, AI 20/20, and storage 64/64 tests. |
| `git diff --check` | Passed with line-ending warnings only. |
| Runtime-code non-ASCII diff scan | Passed with no added non-ASCII or mojibake runtime-code lines in touched contracts/storage/server files. |
| Current-authority Markdown/YAML wording search | Passed for current product/task/status docs; remaining hits are superseded historical ADR/implementation-history records, not current authority. |

### Slice 8: Write Embedded Progression Blocks And Scene Progression Panel

Status: passed for Slice 8 scope on 2026-06-29.

Logic closure boundary verified:

- Authority source: scene `SceneBlockDocument` files and unified `codex/progressions/<id>.json` records.
- Read paths: Write block document load, Codex entry/detail type/progression list reads, effective-entry before/after preview, and current-scene progression panel.
- Write paths: scene document saves, dedicated scene progression-block create/delete commands, and Progression update saves.
- Derived paths: plain text/count/mention projection still derives from blocks; progression preview uses effective-entry projection at the previous block and local draft folding.
- User-visible entries: embedded Write progression block controls and the right-side current-scene progression panel.
- Delete path: deleting from either embedded block or panel removes the block and linked Progression record together, or returns blocker reasons while leaving both records intact.
- Out of scope for this slice: Proposal UI, direct AI generation into authority, Codex baseline/history UI, and broad remaining YAML/Markdown authority migration.

Changes verified:

- Added contract/API shapes for deleting a scene `codexProgression` block together with its linked Progression record.
- Added repository logic that checks scene revision, Progression revision, block/source alignment, and blockers before deleting; blocker responses do not mutate either scene or Progression authority.
- Added server route `DELETE /api/v1/series/:seriesId/scenes/:sceneId/progression-blocks/:blockId`.
- Added `sceneId` filtering to Progression list APIs so Write can load current-scene Progressions.
- Write can create an embedded story-change block, edit its target entry/field/operation/summary/body, preview before/after state at same-scene block position, collapse/expand UI state without writing it to authority, save the linked Progression, and delete the block from either the editor or panel.
- Slice 8 story-change-specific copy is centralized in `uiText.writeProgression`; shared action labels such as Delete use `uiText.actions`.
- Saved scene document bodies contain `codexProgression` blocks and do not persist preview markup such as `progression-preview-grid`.

Adversarial cases covered:

- Deleting a write-block-linked Progression through generic Progression delete is blocked.
- Dedicated block deletion succeeds only when the scene block and linked Progression agree on scene/block source and the supplied revisions match.
- Dedicated block deletion returns blocker reasons and leaves both the scene block and Progression intact when another authority record references the Progression.
- Web tests cover duplicate display text in draft/preview/panel by asserting the intended UI regions rather than a single global text instance.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts smoke.test.ts --reporter=verbose` | Initial run failed one new blocker fixture because the test evidence lacked the required `note`; after correcting the fixture, rerun passed with 64/64 tests. |
| `npm.cmd run build -w @novel-studio/storage` | Passed; this was required before the focused server rerun because the server test process had loaded stale storage dist. |
| `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts --reporter=verbose` | Initial run failed the new route with stale storage dist (`deleteSceneProgressionBlock` unavailable); after rebuilding storage, rerun passed with 12/12 tests. |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx --reporter=verbose` | Initial runs exposed overly broad test queries for text appearing in both draft/preview/panel. After checking and fixing runtime TypeScript issues plus narrowing assertions to the intended regions, rerun passed with 47/47 tests; Vitest printed existing React `act(...)` warnings in the write selection and focus-mode tests. |
| `npm.cmd run build` | First run failed on TypeScript issues in the new Write progression code and test mock typing; after fixing runtime type narrowing and scene block union typing, rerun passed with package builds, server build, and web production build. Vite still reports the existing large-chunk warning. |
| `npm.cmd run test` | Passed after the project lifecycle repair with server 25/25, web 49/49, AI 20/20, and storage 67/67 tests. |
| `git diff --check` | Passed with line-ending warnings only. |

Note:

- Automated DOM/build/test validation is not user visual acceptance.
- `model-call` Progression blocker scanning is still not claimed because ModelCallLog currently has no Progression reference field.

### Slice 8 Review Repair: Atomic Block Commands, Dirty Draft Safety, And First-Block Preview

Status: passed for repaired Slice 8 scope on 2026-06-29.

Review findings addressed:

- High: deleting a story-change block no longer drops unsaved scene prose. Write now saves a dirty `SceneBlockDocument` draft first, uses the saved revision for the delete command, and only then accepts the server-returned scene.
- High: story-change insertion and deletion are no longer frontend/storage best-effort multi-file sequences. Storage exposes `createSceneProgressionBlock` and `deleteSceneProgressionBlock` scene-level commands that write the scene JSON and Progression JSON in one recoverable `applyFileTransaction`.
- Medium: first-block story-change preview now reads effective entry state at the previous narrative scene instead of falling back to raw Codex baseline.
- Low: the Slice 8 copy claim is narrowed to story-change-specific `uiText.writeProgression` keys, with shared actions such as Delete coming from `uiText.actions`.

Logic closure boundary verified:

- Authority source: scene `SceneBlockDocument` JSON and unified `codex/progressions/<id>.json`.
- Read paths: scene document load, current-scene progression list, effective-entry preview at previous block or previous scene, and panel display.
- Write paths: dirty draft scene save, scene-level progression-block create/delete, and linked Progression update.
- Derived paths: scene plain text/count/mentions still derive from block projection; preview state is UI-only.
- User-visible entries: embedded story-change block controls and Scene Brief panel delete.
- Delete path: blocker responses leave scene and Progression unchanged; successful delete removes both in one transaction.
- Migration/rollback path: create/delete use `applyFileTransaction`, so interrupted multi-file writes are recovered by the existing transaction journal recovery path.
- Project/series delete is no longer absent on the branch. It remains outside the NS-410 JSON-authority acceptance IDs, but the user explicitly required the lifecycle repair in this pass; see the project lifecycle section below.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run build -w @novel-studio/storage` | Passed. |
| `npm.cmd run build -w @novel-studio/server` | Passed. |
| `npm.cmd run build -w @novel-studio/web` | Initial run failed on test mock `sceneId` type narrowing; after fixing, rerun passed with the existing Vite large-chunk warning. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts --reporter=verbose` | Passed with 55/55 tests. |
| `npm.cmd run test -w @novel-studio/server -- app.test.ts --reporter=verbose` | Passed with 11/11 tests. |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx --reporter=verbose` | Passed with 40/40 tests; Vitest printed existing React `act(...)` warnings in unrelated write-selection/focus-mode cases. |

### Project Lifecycle Repair: Trash, Restore, And Permanent Directory Delete

Status: passed for project-lifecycle scope on 2026-06-29. This was added by explicit user request after the Slice 8 review findings and is recorded as Project Recovery lifecycle evidence, not as a new NS-410 acceptance ID.

Logic closure boundary verified:

- Authority source: each project directory and its `series.yaml` manifest.
- Read paths: Library project list includes archived state and splits active projects from Trash in the UI.
- Write paths: `POST /api/v1/series/:seriesId/trash` sets `archivedAt`; `POST /api/v1/series/:seriesId/restore` clears `archivedAt`; `DELETE /api/v1/series/:seriesId` deletes the series directory.
- User-visible entries: Library active project cards expose `Move to Trash`; Trash cards expose `Restore` and `Delete permanently`.
- Delete path: permanent delete opens a dialog requiring the exact project name, sends `confirmTitle`, and the backend/storage layer rejects both active/non-Trash projects and title mismatches before file deletion.
- Safety boundary: storage constrains permanent delete to a discovered project root directly under the configured library root. Trash/restore use manifest writes; permanent delete is an intentional physical directory removal and has no rollback beyond external backups.
- Tests: storage, server, and web tests cover trash/restore, active-delete rejection before Trash, wrong-title rejection, disabled UI before exact title entry, successful permanent delete, and disappearance of project files/list entries.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run build -w @novel-studio/storage` | Passed. |
| `npm.cmd run build -w @novel-studio/server` | Passed after rebuilding storage first so the server loaded the new storage dist. |
| `npm.cmd run build -w @novel-studio/web` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run test -w @novel-studio/storage -- repository.test.ts --reporter=verbose` | Passed with 56/56 tests. |
| `npm.cmd run test -w @novel-studio/server -- app.test.ts --reporter=verbose` | Passed with 12/12 tests. |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx --reporter=verbose` | Passed with 41/41 tests; Vitest printed existing React `act(...)` warnings in unrelated write-selection/focus-mode cases. |
| `npm.cmd run build` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run test` | Passed with server 25/25, web 49/49, AI 20/20, and storage 67/67 tests. |

### Slice 9: Codex Baseline, History, And Effective-at-Scene UI

Status: passed for automated Slice 9 scope on 2026-06-29. User visual acceptance remains separate.

Logic closure boundary verified:

- Authority source: baseline `CodexEntryDocument` fields and unified `codex/progressions/<id>.json` field Progression records.
- Read paths: Codex entry list/detail type data, `GET /codex/progressions?kind=field&entryId=...`, and `GET /codex/entries/:entryId/effective?sceneId=...`.
- Write paths: no new authority write path was added in Slice 9; Codex baseline edits still use the existing entry save path, and Write-sourced Progression edits remain in the Write story-change block workflow.
- Derived paths: effective-at-scene fields come only from the existing effective-entry projection; the Codex UI does not calculate future-effective state from raw history.
- User-visible entry: Codex detail `Progressions` tab with an initial-state card, effective-at-scene card, scene selector, hidden-future count messaging, and field-grouped Progression history.
- Future isolation: the effective card for an earlier scene hides later-scene field Progression body while showing only a hidden-future count. Full history remains labelled as history and does not claim future records are current state.
- Engineering fields: Progression IDs, revisions, base revisions, and source hashes are not rendered in the author-facing Progressions tab.
- Out of scope for this slice: Codex-page editing of Codex-page-sourced Progressions, Knowledge UI, Proposal UI, direct AI writes, and broad remaining YAML/Markdown authority migration.

Changes verified:

- Added a Codex `Progressions` tab and centralized new tab/copy strings in `apps/web/src/features/codex/codexViewModel.ts`.
- The tab loads selected-entry field Progressions and selected-scene effective entry data from existing API wrappers.
- Baseline values are read from the saved Codex entry; effective values are read from the projected effective entry.
- Progression history is grouped by field and sorted by narrative scene/block order where the source block exists.
- The AppShell test mock now supports `entryId` filtering on Progression list calls and scene-order-aware effective-entry folding, so the new test covers a real future-scene branch instead of a no-op path.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` | Initial run failed because hidden Progressions tab content duplicated existing scene text queries and the new future-hidden message appeared in both summary and field state. After rendering Progressions tab content only when active and narrowing the assertion, rerun passed with 42/42 tests. |
| `npm.cmd run build -w @novel-studio/web` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run build` | Passed with the existing Vite large-chunk warning. |
| `npm.cmd run test` | Passed with server 25/25, web 50/50, AI 20/20, and storage 67/67 tests. |
| `git diff --check` | Passed with line-ending warnings only. |

### Write Editor Refactor Follow-up: Continuous Manuscript Editor

Status: automated command checks passed on 2026-06-30. User visual acceptance remains separate.

Logic closure boundary verified:

- Authority source: scene `SceneBlockDocument` JSON remains the saved manuscript authority.
- Runtime model: Tiptap/ProseMirror JSON is editor state only and is converted back to `SceneBlockDocument` before `PUT /scenes/:sceneId/document`.
- Read paths: Write scene document load, story-change progression list, effective-entry previews, Codex scene mentions, and Slice 9 Codex Progressions reads.
- Write paths: ordinary manuscript save, paragraph insert/delete, story-change create/edit/delete through the existing scene-level commands, and linked Progression update. Legacy heading/quote/scene-break blocks still round-trip, but the author-facing current-text conversion control has been removed.
- Derived paths: character/word counts, plain-text save projection, Codex mention matching, context/progression previews, and Codex Progressions tab behavior remain derived from authority APIs instead of editor runtime JSON.
- User-visible entries: continuous manuscript editor, compact editor command rail for paragraph add/story-change/delete, compact story-change anchors, Scene Brief story-change list/detail panel, Focus mode, and existing hierarchy collapse controls.
- Delete path: ordinary paragraph deletion mutates the local `SceneBlockDocument` draft; story-change deletion still saves dirty drafts first and then uses the scene-level progression-block delete command.
- Migration/rollback path: no saved file format changes were introduced by the editor runtime. Rollback would remove the Tiptap adapter and continue rendering the same `SceneBlockDocument` authority.
- Tests and fixtures: adapter tests exercise synthetic Tiptap JSON fixtures; AppShell tests exercise the Write API mocks for save, add/delete, story-change, first-block preview, and Codex Progressions regressions.

Changes verified:

- Added `@tiptap/core`, `@tiptap/react`, and `@tiptap/starter-kit` at `^3.27.1`; installed package metadata lists the MIT license.
- Added `apps/web/src/features/write/editor/sceneBlockMapping.ts` and tests for round-trip mapping, mark stripping, empty editor recovery, duplicate ID regeneration, and trailing cursor paragraph cleanup.
- Added a continuous `NovelEditor` for the Write manuscript surface and removed the old repeated block-card/textarea render path from `WriteWorkspace.tsx`.
- Added a Scene Brief story-change panel so story-change editing/collapse/delete remains available without turning each manuscript item into a form row.
- Removed the author-facing stored block count from the Write toolbar and stopped rendering the old `.scene-block` card UI.
- Removed the floating format panel and destructive current-text type selector. Scene break is no longer exposed as a conversion for active prose, so existing text is not erased by changing a style dropdown.
- Added Vite/Rolldown manual chunks for React, Tiptap/ProseMirror, CodeMirror, and other vendor modules so the current production build no longer emits the 500 kB chunk warning.

Commands:

| Command | Result |
| --- | --- |
| `npm.cmd run build -w @novel-studio/contracts` | Passed. |
| `npm.cmd run test -w @novel-studio/web -- sceneBlockMapping.test.ts AppShell.test.tsx` | Passed with 50/50 tests after removing the formatting panel and destructive text-type conversion path. |
| `npm.cmd run build -w @novel-studio/web` | Passed with no Vite large-chunk warning; largest emitted chunks were `editor-codemirror` at 494.48 kB and `editor-tiptap` at 429.21 kB. |
| `npm.cmd run build` | Passed with no Vite large-chunk warning after adding manual chunks. |
| `npm.cmd run test` | Passed with server 25/25, web 58/58, AI 20/20, and storage 67/67 tests. |
| `git diff --check` | Passed with line-ending warnings only. |

## Invariant Checklist

- Completed NS-410 authority paths are durable JSON authority for scene manuscripts, unified Progression records, and character knowledge. Markdown/Word are boundary formats for those completed paths. Remaining YAML/Markdown authority paths are inventoried above, remain open for the NS-410 JSON authority completion slice, and must not be described as migrated.
- AI and Proposal paths do not directly mutate authoritative scene or Codex files.
- Unified JSON Progression replaces old YAML progression for field, world-fact, and relationship changes; character knowledge remains separate.
- Same-scene block position determines visibility.
- Future progression content is not leaked.
- Empty replace hides the field from context.
- Every write remains revision-protected and uses atomic file replacement or transaction helpers.
- Current product/UI visual acceptance is not claimed by automated checks.
- JSON authority must be hidden behind compatibility adapters where possible; unrelated frontend/backend surfaces must not be rewritten solely for the storage format change.
