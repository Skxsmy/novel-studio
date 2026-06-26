# Current Status

Updated: 2026-06-26

This file is the current project-status authority. Earlier Chinese records were fully read before this rewrite and have been translated, consolidated, and retained here as structured English history instead of being discarded.

## Read First

- Current active line: `NS-410` Block Write Editor and Codex Field Progression, started by explicit user direction on 2026-06-26.
- Current decision: the previous recovery warning not to start `NS-410` is superseded for this task. The project is still not visually/product accepted, so NS-410 command verification must not be reported as user visual acceptance.
- Do not mechanically follow the old milestone order or old `NS-409` assets. M2/M3 foundations may be revised for this block-document and field-progression change.
- Project recovery remains not accepted, but is no longer the active implementation line while NS-410 is in progress.
- Fast reading path for the next contributor:
  - `README.md`
  - `HANDOFF.md`
  - `TASKS.md`
  - `docs/README.md`
  - `docs/tasks/NS-410.md`
  - `docs/testing/NS-410_ACCEPTANCE.md`
  - `docs/adr/0012-scene-block-documents-and-codex-field-progression.md`
  - `docs/tasks/PROJECT_RECOVERY.md`
  - `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`
- Protected backups: do not delete anything under `docs/design/**/backups/` unless the user explicitly names the backup to delete.
- Routine progress must be recorded in existing authority files, not in new scattered status files: `STATUS.md`, `HANDOFF.md`, `TASKS.md`, `CHANGELOG.md`, the active task file, and the active acceptance file.

## Current Implementation Snapshot

- Local-first React/Vite + Fastify application, bound to `127.0.0.1`.
- Project JSON files are the target durable authority; Markdown/Word are boundary formats; SQLite/FTS5 remains a rebuildable derived index. Current runtime code has not yet been migrated.
- Current frontend structure:
  - `apps/web/src/app`
  - `apps/web/src/api`
  - `apps/web/src/features`
  - `apps/web/src/ui`
- Current server route structure includes domain route modules for series, Codex, AI/model settings, prompts, context, and calls.
- `packages/contracts` has split domain schemas re-exported through `src/index.ts`.
- `packages/storage` still has an oversized `src/index.ts`; domain behavior should keep moving out instead of growing it.
- `packages/ai` contains the provider registry, mock provider, OpenAI-compatible path, DeepSeek/OpenAI/OpenRouter/Ollama paths, the Anthropic Messages API path, the Google Gemini GenerateContent API path, credential abstractions, and error classification.

## Active Work: NS-410 Block Write Editor and Codex Field Progression

The active line is now NS-410 by explicit user direction. Project recovery remains not accepted and must not be described as complete.

NS-410 product decisions now recorded:

- Project authority moves from Markdown/YAML files to schema-versioned JSON files.
- Scene manuscript authority moves from Markdown-only body text to a structured JSON `SceneBlockDocument`.
- Markdown remains a projection/export/import compatibility format and mirror.
- Existing frontend-used scene APIs should remain compatible during transition: reads can keep returning projected `content`, and legacy `content` writes should convert to JSON block documents instead of forcing an immediate frontend-wide rewrite.
- Word and full Markdown re-import are later workflows, not part of this implementation.
- Codex field progression is a new field-content system under `codex/field-progressions/`, separate from old world-fact `codex/progressions/`.
- Canon Description and reusable Detail values can vary by scene and block position.
- Same-scene block order is part of visibility; future progression body, summary, and IDs must not leak backward.
- Empty `replace` clears and hides a field.
- Context Builder must use projected Codex fields at the current scene/block position.
- AI/Proposal paths may use the API shape later, but must not directly write authoritative files without explicit author action/proposal flow.

Current NS-410 implementation order:

The task now uses controlled vertical slices in `docs/tasks/NS-410.md`:

1. Slice 0 Planning Lock.
2. Slice 1 Contracts and JSON file foundation. Passed for Slice 1 scope on 2026-06-26.
3. Slice 2 Scene JSON authority with legacy scene API compatibility. Next implementation slice.
4. Slice 3 Scene document API and Markdown export.
5. Slice 4 Field progression JSON storage and CRUD API.
6. Slice 5 Projection engine and effective entry API.
7. Slice 6 Context Builder and preview projection.
8. Slice 7 Write block editor MVP for ordinary blocks.
9. Slice 8 Write embedded progression blocks and scene progression panel.
10. Slice 9 Codex baseline/history/effective-at-scene UI.
11. Slice 10 Final regression, rollback, and handoff.

Each slice must leave the app buildable and must not proceed until its exit checks are recorded in `docs/testing/NS-410_ACCEPTANCE.md`.

Current blockers:

- The visual design is rejected by the user.
- Codex core is now command-verified for Release A entry work: it can list/search loaded entries, create/open/close entries, rename, edit canon description/research/aliases/reusable details/tracking/context policy, change category, save with revision protection, recover from visible conflicts by reload, and archive/restore through real APIs. Codex entry `tags` were removed from contracts, storage, server routes, API client, and UI because they have no valid Codex product role. Details now use category-scoped reusable detail types stored under `codex/detail-types/`, exposed through real list/create/update/delete APIs, guarded from deletion while any same-category entry uses them, managed in a large modal instead of an inline form, and edited through the shared `EditorSurface` used by Canon Description and Write. Detail types can belong to built-in or custom categories and carry an NSFW flag; each entry detail row has its own switch controlling whether that detail is sent with the entry into AI context. Custom categories can be created from a compact category Add menu, renamed by double-click, rejected on exact duplicate names, and deleted without deleting their entries by moving those entries to `Uncategorized`. Codex entries can also be deleted from the entry detail lifecycle area. The Codex detail tabs were tightened after user screenshot review: custom Details are collapsed until needed, empty Details no longer create a large blank region, Tracking controls no longer stretch vertically, index row descriptions remain visible when detail is open, and the category/index lists now use bounded scrolling instead of stretching the page. A later 2026-06-26 user screenshot follow-up replaced the ineffective width-only adjustment with an explicit focused entry-editing mode: selecting or creating an entry defaults to Browse Entries with the category rail and Entry Index still visible, while `Focus Edit` hides those panels so the editor can take the whole Codex workbench. The Details tab typography, input sizing, Canon editor height, and per-detail row layout were enlarged for author editing.
- Current backend Codex routes cover categories, entries, mentions, relations, progressions, knowledge, effective state, context preview, and search. Current frontend Codex API wrapper exposes categories plus entry list/create/get/update/archive/restore/delete, entry mentions, relation list/create/remove, scene mentions, and context preview. Write loads active Codex entries for realtime scene-body name/alias matching, renders matched hits as dashed underlines without highlight fill, and toggles a scroll-bounded Canon description preview from the same hit without duplicating the scene text; the preview is positioned as an editor-anchored absolute overlay, not viewport-fixed. The Write editor and Codex canon-description editor now use CodeMirror 6 through shared `EditorSurface`; editor state drives transactions, selection, line/column, character/word status, paste cleanup, undo/redo, and pure-text saves. Enter and Space insert literal characters into the text model, preserving blank lines and line-leading spaces instead of letting browser-generated contentEditable blocks or whitespace normalization reorder text. The redundant Write `Codex in scene` panel was removed; Scene Brief can be hidden and restored through an icon-only control. Codex canon descriptions use the same realtime name/alias matching for other active Codex entries, and their previews use a custom application-level absolute portal so they render above editor borders and following detail fields without being clipped by the scrollable input area. The 2026-06-26 preview follow-up closes an open Canon preview when the user clicks any non-mention position inside the same editor, clamps preview positioning to the editor/scroll-container visible bounds so the card sticks to the editor top or bottom instead of disappearing with scrolled-away text, and keeps the preview card vertically scrollable only with horizontal overflow hidden. Codex details now include real Relations, Mentions, and Tracking tabs: Relations can create/remove active connections; Mentions separates manuscript and Codex-content hits, and clicked dashed-underlined hits open Canon description previews instead of jumping. The detail header mention count only counts manuscript/scene mentions. Progressions, knowledge, effective state, Plan rework, and search-result integration remain later work and must not be shown as fake editable tabs.
- Write hierarchy UX still needs product-level repair:
  - expected hierarchy is `Volume -> Chapter -> Act -> Scene`;
  - current Slice B code now tests empty-library project creation and first-scene opening;
  - current Slice B code now tracks selected Volume and targets Add Chapter to that Volume;
  - current Slice B code now tests selected Chapter/Act/Scene deletion and Scene creation inside the selected Act;
  - current Slice B code now tests Focus enter/exit and automatic exit when leaving Write;
  - current Slice B code now tests explicit single-item structure selection, second-click deselection, and prevention of stale child/scene selection when a parent Volume is selected;
  - Add should open a compact menu, not show multiple permanent large buttons;
  - new items should receive default names;
  - titles should be renameable later, including double-click rename where appropriate;
  - Delete should sit beside Add and delete only the selected item after confirmation;
  - collapse behavior must not auto-center content or waste space;
  - scroll must exist wherever content can exceed the panel.
- Settings has real API wiring, but it is not complete product workflow.
- Review and Workshop are incomplete.
- UI text must stay isolated for later bilingual adaptation; do not hardcode user-facing copy directly into feature logic.
- Browser screenshots and DOM checks are not user acceptance. The user currently owns visual validation.

Current recovery slices:

1. Slice A: baseline triage recorded on 2026-06-24.
2. Slice B: Start-to-Write vertical slice, command-verified; user visual validation remains separate.
3. Slice C: Codex core vertical slice, command-verified; user visual validation remains separate.
4. Slice D: Codex connections, command-verified for current Codex scope; Plan review/rework is explicitly deferred.
5. Slice D2: Editor Foundation, command-verified on 2026-06-24. CodeMirror 6 now backs Write scene content and Codex Canon descriptions through shared `EditorSurface`; old contentEditable mark helpers and unused Milkdown runtime dependencies were removed. Real Chinese IME validation remains user/manual. A 2026-06-25 follow-up fixed Canon preview layer order by moving Canon previews to a custom application-level absolute portal without using fixed positioning; the user visually confirmed the reported issue is fixed.
6. Codex Details follow-up: command-verified on 2026-06-26. Tags are removed from the Codex entry path; reusable detail types are centrally managed per category in a large modal, can be created for custom categories, can be marked NSFW, and detail values reuse `EditorSurface`; each entry detail has a switch for whether it is sent to AI. Later same-day follow-ups added focused entry editing, enlarged the Details tab editing layout, and fixed Canon preview close/bounds behavior in Write/Codex editors. Screenshot self-check for the modal follow-up was skipped by user instruction, and this is not user visual acceptance.
7. Slice E: permanently skipped by user decision on 2026-06-25. Earlier Settings/provider work remains a working draft in the codebase, but it is not Recovery Release A acceptance evidence and must not be continued as the current recovery path.
8. Slice F: Review, Workshop, and navigation honesty, command-verified on 2026-06-25. Review and Workshop remain visible but are honest unavailable shells; fake counts/actions were removed and future functionality is recorded as a from-scratch build.
9. Slice G: visual system and responsive acceptance.
10. Slice H: verification and handoff.

## Milestone State

- M0: complete. Product intent, architecture, governance, and acceptance tracing were written into the repository.
- M1: complete. Clickable interaction shell passed browser acceptance.
- M2: complete. File storage, API, conflict protection, index rebuild, and search had automated tests.
- M3: complete. `NS-301` through `NS-307` were implemented and validated.
- M3 -> M4 preparation: complete through `NS-400`. Architecture refresh, split baselines, repeatable smoke tests, and M4 minimum contracts were recorded.
- M4: partially complete. `NS-401` through `NS-407` are complete. `NS-408` now has DeepSeek, OpenAI, OpenRouter, Ollama, Anthropic, Google Gemini, and generic OpenAI-compatible protocol paths, but real external non-writing call validation remains unfinished. The old `NS-409` line is historical; active work is now project recovery.

## Historical Implementation Record

### Core Application

- React/Vite + Fastify local app.
- Windows launcher with startup mutex, workspace/commit identity checks, old-process cleanup, `-Wait`, `-SmokeTest`, `-Foreground`, `-Stop`, temp log fallback, and explicit reuse behavior.
- Startup health returns version, commit, startedAt, workspaceRoot, and libraryRoot.
- Playwright browser acceptance uses isolated temp libraries and avoids polluting real `data/library`.

### Storage, Hierarchy, and Planning

- `Series -> Book -> Act -> Chapter -> Scene` explicit parent/child lists and stable UUIDs were implemented during M3.
- Reorder and move support included same-chapter, cross-chapter, and cross-act scene moves; cross-book moves are explicitly rejected.
- Hierarchy validator reports missing references, orphan nodes, duplicate parents, ancestor problems, ordering problems, and path problems.
- Creates, reorders, and moves use recoverable multi-file transactions; interrupted transactions are rolled back when a project is accessed.
- M2 projects missing Act/Chapter lists are migrated by snapshotting first, filling lists, then running the same validator.
- New projects load acts and chapters immediately; the earlier writing drawer displayed Act -> Chapter -> Scene.
- Shared PlanningBoard powers board/grid, outline, tracking matrix/table, and dual timelines; selection and filters persist across planning views.
- TimelineEvent files, story order, unplaced scenes, accessible structure move entry points, planning branch updates, intentional divergence, and manuscript revision marking were implemented.
- `NS-306` exposed new-series, new-book, new-act, and new-chapter UI entry points; creating a new book created its first act and first chapter.
- `NS-307` let scene creation target a specific book/act/chapter instead of falling back to the first book.

### Writing, Sections, Draft Recovery, and Anchors

- Milkdown/ProseMirror Markdown editor was added for Chinese writing workflows.
- Title/body editing, character/paragraph counts, autosave, explicit save, conflict status, and real disk reload behavior were implemented.
- localStorage crash recovery stores base revision and distinguishes safe drafts from stale drafts; stale drafts never silently overwrite disk.
- Focus mode existed in earlier writing UI.
- Independent Section Markdown files exist for five section types, with `inherit`, `local-only`, and `never` AI permissions plus archive/restore behavior.
- Review anchors are stored in separate YAML files. Quote/context relocation produces explicit `attached`, `relocated`, or `orphaned` states.
- Milkdown may normalize equivalent CommonMark spelling; semantic content is preserved, but exact marker spelling is not guaranteed.

### Codex, Mentions, and Story State

- Six built-in Codex categories and custom categories were implemented.
- Canon entries, research notes, relation files, and stable revisions are physically separated.
- Mention indexing supports names, aliases, excluded words, case rules, English plurals, longest-match priority, and same-scope ambiguity.
- Scene save incrementally rebuilds mentions for the current scene; entry changes rebuild derived Codex indexes without changing scene prose or explicit scene links.
- Directed and undirected relations keep original source, target, and relation IDs; archive replaces destructive delete.
- Model-readable scope preview supports `always`, `on-mention`, `manual`, and `never`; `never` is not sent to models even when selected manually.
- Three-column Codex workspace previously supported entries, research notes, recognition rules, relations, prose mentions, archive/restore, and planning tracking tables that show names instead of UUIDs.
- Story progressions and character knowledge use separate files.
- Effective-state queries can evaluate world facts, relationship changes, and character subjective knowledge by narrative scene.
- World facts are separate from what characters know, believe, or misunderstand; subjective knowledge never overwrites canon.
- Future records return counts only for earlier scenes, not summaries, evidence, or internal IDs.
- Progressions, character knowledge, and effective state were connected to Codex detail pages in the earlier Chinese UI.

### AI and M4 Work

- `NS-401` wrote M4 execution specs, API drafts, data-format drafts, MockProvider vertical-slice design, and browser-acceptance mapping.
- `NS-402` split AI contracts into domain files and added minimal YAML persistence plus rebuildable indexes for model profiles, roles, prompt templates, presets, context bundles, and call logs.
- `NS-403` added `@novel-studio/ai`, `ProviderAdapter`, `ProviderRegistry`, `MockProvider`, capability descriptions, streaming output, structured output, embedding simulation, token estimation, and unified error classification.
- `NS-404` added model configuration APIs, credential-reference validation, Windows Credential Manager storage abstraction, provider connection tests, and the settings page for model/data permissions. After `NS-408`, the global "local models only" switch was removed from the main path while explicit provider selection, data-level permission filtering, and no silent cloud fallback remained.
- `NS-405` added scene-level `ContextBundle` assembly and preview APIs. Preview bundles record included items, excluded items, source, reason, and usage estimates. `never`, hidden sections, and future information are excluded from current-scene context.
- `NS-406` added seven built-in editorial roles, prompt templates, presets, declarative rendering, template version APIs, and a settings-page prompt preview. Context preview records real PromptTemplate ID/version. Missing required input and invalid expressions are rejected.
- `NS-407` added non-writing AI call APIs, SSE streaming, call-log persistence, and a minimal writing-page review/rewrite loop. Rewrite produces an inline prose candidate; the author must explicitly keep it before it is saved.
- `NS-408` added a dedicated DeepSeek provider, generic OpenAI-compatible provider foundation, OpenAI/OpenRouter/Ollama provider paths, an Anthropic Messages API provider path, and a Google Gemini GenerateContent provider path. Settings can create provider configs, save/replace/delete/reuse service keys, fetch model lists, select fetched provider models, test connections, and call through the shared ProviderRegistry. The user manually confirmed DeepSeek connection and model-list retrieval. Real external non-writing call validation is not fully completed in the `NS-408` scope.

### UI History Before Current Rebuild

- UI copy was previously standardized around Chinese author-facing terminology: Codex, Canon, Research, Section, POV, tokens, and similar developer words were removed from the main Chinese UI.
- Product and UX specs were updated so the main interface should be organized from the author's perspective. Audit fields such as call source, base version, call ID, and token usage must not appear in the writing main path.
- UI preview assets must be controlled; rejected exploratory images do not become project guidance.
- Historical screenshot runs used unique run IDs and manifests; current project recovery does not require browser screenshot verification unless the user or task explicitly asks for it.
- `NS-409C` recorded a UI correction pass: an untracked second `ui-foundation.css` layer was removed; plan/write targets were regenerated; the planning page moved toward a three-column workbench; writing screenshots used real prose; `NS-409B-plan-target-v2.png` and `NS-409B-write-target-v2.png` were marked not adopted.
- `NS-409D` recorded wide-screen corrections: the writing page stopped drifting across wide screens; Codex detail/progressions and Workshop moved toward controlled wide workbenches; screenshots were saved under `docs/design/ui-redesign/`.
- `NS-409E` recorded a planning-page wide-screen transition for board, outline, matrix, and timeline. It explicitly did not pass overall UI acceptance.
- `cca70e8` recorded the current working state after a later React frontend rework, documentation cleanup, protected UI backups, deletion of obsolete non-backup UI assets, command validation, and explicit record that the UI remained visually rejected.

## Verification History

### Repeated Baseline Validation

- `npm.cmd run check` passed across the M3/M4 work line multiple times.
- Server, web, AI, and storage tests passed repeatedly as their counts changed by task.
- Production server and Vite web builds passed repeatedly.
- `git diff --check` passed, with only Windows line-ending warnings where noted.
- Browser console checks reported no warnings/errors during earlier M3 browser acceptance.

### M3 and Launcher Validation

- Server 6/6, web 14/14, and storage 39/39 passed around the M3 close.
- `npm.cmd run test:smoke` passed with 3 smoke tests.
- Browser acceptance validated Codex entries, separate research notes, custom categories, directed relations, mention indexing, same-name ambiguity, readable-scope exclusion, archive/restore, and tracking-table name resolution.
- Browser acceptance validated progressions, character misunderstandings, future-information hiding, and character-knowledge archive/restore.
- Browser acceptance validated creating a new series, new second book, new second act, first chapter in an empty act, and API-level hierarchy validity.
- Old PID 52088 was stopped with user approval; a later service listened on PID 50388.
- `scripts/start.ps1 -NoBrowser -SkipBuild -SmokeTest` started a temporary service, read `/api/v1/health`, confirmed workspace/library roots, stopped the service, and left no listening process on `127.0.0.1:4317`.
- Final M3/M4-prep close showed `npm.cmd run check` passed, `npm.cmd run test:e2e` passed, and the port was left with no listener except transient `TIME_WAIT`.

### M4 Task Validation

- `NS-401`: `npm.cmd run check` passed with server 7/7, web 14/14, storage 39/39, and production build.
- `NS-402`: contracts typecheck passed; storage typecheck passed; storage tests passed 41/41; full check passed.
- `NS-403`: AI typecheck passed; AI tests passed 9/9; package lock update was required; full check passed with AI included.
- `NS-404` and `NS-405`: AI tests passed 10/10; server tests passed 10/10; web typecheck passed; web tests passed 14/14; full check passed; E2E covered adding a local acceptance model, connection test, and writing-page context preview.
- Settings UI correction after `NS-404`/`NS-405`: E2E passed and produced `m4-settings-model-profile.png` and `m4-write-context-preview.png`.
- Browser acceptance port correction moved E2E default to `127.0.0.1:4318` to avoid daily service port `4317`.
- `NS-406`: typecheck passed; tests passed server 11, web 14, AI 10, storage 41; E2E covered roles/prompts and prompt preview with `m4-prompt-template-preview.png`; full check passed.
- `NS-407`: typecheck passed; tests passed server 13, web 14, AI 10, storage 41; E2E covered AI review, selected rewrite, inline candidate, keep action, and screenshots `m4-ai-panel-ready.png`, `m4-ai-review-result.png`, `m4-ai-inline-candidate-selected.png`. Manual screenshot review confirmed the writing candidate bar did not expose call source, base version, usage, or call ID.
- `NS-408`: tests passed server 15, web 14, AI 12, storage 41; E2E covered DeepSeek/OpenAI-compatible config UI, unique screenshot manifest, context preview, AI review, and prose candidate loop. Later provider split validation passed typecheck, AI 15/15, server 15/15, full check, and E2E. User confirmed real DeepSeek connection and model-list retrieval; Codex did not read or print the real key.
- `NS-408` Anthropic follow-up: official Anthropic Messages/Models API behavior was checked before implementation. `npm.cmd run test -w @novel-studio/ai` passed 19/19; `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts` passed 7/7; `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed 38/38. Full `npm.cmd run check` initially hit a sandbox EPERM while writing `packages/contracts/dist`, then passed with elevated permissions: Server 19/19, Web 44/44, AI 19/19, Storage 47/47, production build passed. Real external Anthropic calls were not run by Codex.
- `NS-408` Gemini follow-up: official Google Gemini GenerateContent/Models/API key behavior was checked before implementation. `npm.cmd run test -w @novel-studio/ai` passed 20/20; `npm.cmd run build -w @novel-studio/ai` passed; `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts` passed 8/8; `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed 38/38. Full `npm.cmd run check` first hit sandbox EPERM while writing `packages/contracts/dist`, then passed with elevated permissions: Server 20/20, Web 44/44, AI 20/20, Storage 47/47, production build passed with the existing Vite large-chunk warning. Real external Gemini calls were not run by Codex.

### NS-409 UI Validation History

- `NS-409C`: web typecheck passed; multiple E2E runs passed; latest recorded run ID was `2026-06-21T13-07-51-086Z`; key screenshots included `NS-409C-plan-implemented-v1.png` and `NS-409C-write-implemented-v1.png`.
- `NS-409D`: web typecheck passed; E2E passed; latest run ID was `2026-06-21T13-50-37-338Z`; key screenshots included wide writing, Codex detail, Codex progressions, and Workshop screenshots.
- `NS-409E`: web typecheck passed; E2E passed; latest run ID was `2026-06-21T14-47-28-769Z`; board, outline, matrix, and timeline current/target/implemented screenshots were saved. This was recorded as only a wide-screen transition, not UI acceptance.
- Current project recovery working draft after Slice E: `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts model-calls.test.ts` passed 9 tests across 2 files; `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed 37 tests; `npm.cmd run typecheck -w @novel-studio/server` passed; `npm.cmd run typecheck -w @novel-studio/web` passed. D2 layer repair validation also passed `EditorSurface.test.tsx` with 6 tests and was visually confirmed by the user. Overall recovery visual/product acceptance remains incomplete until later recovery slices are accepted.
- Slice F Review/Workshop honesty validation: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed 38 tests; `npm.cmd run typecheck -w @novel-studio/web` passed. Overall recovery visual/product acceptance remains incomplete until later recovery slices are accepted by the user.
- 2026-06-26 Codex layout / Canon preview bounds follow-up: `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx` passed 8 tests; `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed 38 tests; `npm.cmd run typecheck -w @novel-studio/web` passed; `npm.cmd run build` passed with the existing Vite large-chunk warning; `npm.cmd run test` passed with server 20, web 46, AI 20, and storage 48 tests; `git diff --check` passed with line-ending warnings only. Screenshot validation was skipped by user instruction; user visual acceptance remains separate.

Acceptance evidence files:

- `docs/testing/M0-M2_ACCEPTANCE.md`
- `docs/testing/NS-301_ACCEPTANCE.md`
- `docs/testing/NS-302_ACCEPTANCE.md`
- `docs/testing/NS-303_ACCEPTANCE.md`
- `docs/testing/NS-304_ACCEPTANCE.md`
- `docs/testing/NS-305_ACCEPTANCE.md`
- `docs/testing/NS-306_ACCEPTANCE.md`
- `docs/testing/NS-307_ACCEPTANCE.md`
- `docs/testing/NS-400_ACCEPTANCE.md`
- `docs/testing/NS-401_ACCEPTANCE.md`
- `docs/testing/NS-402_ACCEPTANCE.md`
- `docs/testing/NS-403_ACCEPTANCE.md`
- `docs/testing/NS-404_ACCEPTANCE.md`
- `docs/testing/NS-405_ACCEPTANCE.md`
- `docs/testing/NS-406_ACCEPTANCE.md`
- `docs/testing/NS-407_ACCEPTANCE.md`
- `docs/testing/NS-408_ACCEPTANCE.md`
- `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`

## Known Limitations

- Earlier manual browser validation left test series, progressions, future-hidden records, and character-knowledge records in the local sample library. Those are local data files and are not committed.
- The Windows/Codex sandbox can reject writes to fixed `data/server.*` files; startup scripts fall back to `%TEMP%\novel-studio` for PID/log state.
- First-start library selection, in-app service stop, and tray entry are not implemented.
- Editor room, review/candidate workflows, and Workshop are not complete product workflows.
- `NS-404` through `NS-408` implemented minimum settings, context preview, prompt preview, writing AI review/rewrite entry points, DeepSeek/OpenAI/OpenRouter/Ollama/Anthropic/Google Gemini provider paths, and OpenAI-compatible foundation. Project Recovery Slice E was later marked permanently skipped by the user, so its working-draft Settings/provider changes are not Recovery Release A acceptance evidence. Full context grouping UI, call-log UI, full role/variable/preset editors, and wider browser coverage remain later work.
- Real DeepSeek connection/model list was user-validated; a real DeepSeek non-writing call result was not recorded in the old handoff.
- OpenAI, OpenRouter, Ollama, Anthropic, and Google Gemini have provider paths covered by fake fetch protocol tests but still need broader real-provider validation and product polish.
- Future provider integrations must be based on the provider's official API entry and documentation, with the official source and endpoint/auth/streaming/request-response/model-list behavior recorded in the task and acceptance records.
- Archive is allowed only as a reversible hiding state. Product design must also provide user-visible cleanup/permanent-delete paths for unwanted archived data, with reference checks or immutable history snapshots so long-term use does not accumulate unbounded archive data.
- Current UI remains rejected overall. Fonts, type hierarchy, border weight, page design language, empty states, Plan, Review, Workshop, and final Settings polish still need product-level work. Review and Workshop must remain visible for now, but their future product functionality must be designed and implemented from scratch.
- Scene save still does not update series `updatedAt`.

## Next Work

Continue NS-410 with Slice 2 from `docs/tasks/NS-410.md`: scene JSON authority with legacy scene API compatibility. Slice 1 is verified and recorded in `docs/testing/NS-410_ACCEPTANCE.md`; do not skip Slice 2's compatibility exit checks.

After NS-410, return to project recovery visual/product acceptance unless the user redirects again.
