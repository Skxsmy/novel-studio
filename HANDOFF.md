# Handoff

Updated: 2026-06-29

This file is the short operational handoff. The older Chinese handoff was fully read before this rewrite; its task history, verification facts, and warnings have been translated and reorganized here.

## Current Repository State

- Branch: `codex/ns-410-json-authority`.
- Latest relevant committed baseline after Slice 7: `NS-410 feat(write): add native block editor` on this branch.
- Current active task: `NS-410` Block Write Editor and Unified Codex Progression.
- Current acceptance state: NS-410 is in progress; project recovery remains not visually/product accepted.
- Current planning decision: the prior "do not start NS-410" warning is superseded by explicit user direction on 2026-06-26. M2/M3 foundations can be modified for the JSON authority, block document, and unified Progression change. Slice 7 is implemented on the NS-410 branch; continue with Slice 8 unless the user redirects.

## Start Here

Read these files in order:

1. `README.md`
2. `STATUS.md`
3. `TASKS.md`
4. `docs/README.md`
5. `docs/tasks/NS-410.md`
6. `docs/testing/NS-410_ACCEPTANCE.md`
7. `docs/adr/0012-scene-block-documents-and-codex-field-progression.md`
8. `docs/tasks/PROJECT_RECOVERY.md`
9. `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`

Do not begin from old `NS-409A` through `NS-409F` screenshots as if they are current guidance. Current truth is the task and acceptance record above.

## Do Not Break These Rules

- Do not mark project recovery complete until the user accepts the visual/product result.
- Do not mark NS-410 complete until all NS-410 acceptance IDs are mapped to passing tests or explicit manual/user validation.
- Do not assume M2/M3 APIs are sufficient just because older tasks passed. Audit before implementation.
- Do not add new routine status or handoff files. Update the existing authority files.
- Do not delete `docs/design/**/backups/` unless the user explicitly names the backup to delete.
- Do not let `apps/web/src/app/app-shell.css`, `apps/server/src/app.ts`, or `packages/storage/src/index.ts` become larger dumping grounds.
- Do not hardcode user-facing UI text inside feature logic; later bilingual support is required.
- Do not claim browser screenshots or DOM checks as user visual acceptance.
- Do not expose developer/audit details in author-facing writing paths unless the product spec calls for them.
- Do not interpret JSON authority as permission to break all existing APIs. Preserve current frontend-used route contracts through adapters where feasible.

## Current NS-410 Work

NS-410 changes the writing and Codex foundations:

- Project authority moves from Markdown/YAML files to schema-versioned JSON files; current test data can be migrated or regenerated.
- Scene body authority becomes JSON `SceneBlockDocument`; Markdown remains a projection/export/import boundary format.
- Current frontend-used scene APIs should remain compatible during transition: reads keep projected `content`, and legacy `content` writes convert to JSON block documents.
- Codex Progression is stored under `codex/progressions/` as unified JSON authority; old `codex/progressions/*.yaml` is retired and must not be used as the runtime path.
- Field, world-fact, and relationship progression are target kinds in the new unified system; character knowledge remains separate.
- Effective Codex entry reads must support scene/block position and hide future field progression content.
- Context Builder must use projected Canon Description and Details.
- Write needs ordinary blocks, embedded progression blocks, and a scene progression panel.
- Codex needs baseline/history/effective-at-scene views for progressed fields.

Implementation order is now the controlled vertical slice plan in `docs/tasks/NS-410.md`; acceptance evidence and slice exits are in `docs/testing/NS-410_ACCEPTANCE.md`. Slice 1 passed for its scope on 2026-06-26; Slices 2, 3, 4, 5, 6, and 7 passed for their scopes on 2026-06-29. Continue with embedded Progression blocks and the scene progression panel next; do not skip to Codex history UI.

## Current Recovery Work

The current React frontend has a reorganized shell and partial API wiring, but it is not a usable accepted UI. The work has been reframed as project-level recovery.

Working draft pieces:

- Library/project creation and no-project handling exist.
- Write has real project/scene API wiring and partial hierarchy controls.
- Plan has surfaces, but the current frontend line still needs product-level validation.
- Codex core can list/search loaded entries, create/open/close entries, rename, edit canon description/research/aliases/reusable details/tracking/context policy, create custom categories, change entry category, save with revision protection, show conflict reload, and archive/restore through real APIs. Codex entry tags are no longer valid and have been removed from contracts, storage writes, server routes, frontend API payloads, table/search UI, and detail form UI. Details now use category-scoped reusable detail types stored in `codex/detail-types/`, managed in a large modal with real list/create/update/delete APIs and deletion blocked while same-category entries still use the type. Detail types can be created for built-in or custom categories and marked NSFW; each entry detail row has its own switch deciding whether that detail is sent with the entry into AI context. Detail values reuse the shared `EditorSurface` used by Canon Description and Write. Custom categories use a compact Add menu, support double-click rename, reject exact duplicate names, and delete with confirmation by moving entries to `Uncategorized` rather than deleting entries. Codex entries can be deleted from the entry detail lifecycle area. User screenshot feedback on the Codex detail tabs has been addressed by collapsing custom Details until needed, tightening Research/Tracking spacing, keeping index summaries visible when detail is open, separating `New Entry` from `No description`, and bounding category/index list scrolling. A later 2026-06-26 screenshot follow-up replaced the ineffective width-only detail-open adjustment with an explicit focused entry-editing mode: selecting or creating an entry defaults to Browse Entries with the category rail and Entry Index still visible, while `Focus Edit` hides those panels so the editor can take the whole Codex workbench. The Details tab typography, input sizing, Canon editor height, and per-detail row layout were enlarged for author editing. Codex detail now has real Relations, Mentions, and Tracking tabs; Relations can create/remove active connections through real APIs; Mentions combine manuscript hits from the entry mention API with other-Codex-entry content hits from loaded entries, and matched names/aliases are clickable dashed-underlined text that opens a Canon description preview instead of jumping. Canon description editing also realtime-matches other active Codex entry names/aliases and uses the same custom application-level absolute portal preview so it is not clipped by the input area or hidden under following fields.
- Write loads active Codex entries for scene-body name/alias matching. NS-410 Slice 7 renders Write scene content as native `SceneBlockDocument` blocks for paragraph, heading, quote, and scene break content, and saves through the scene document endpoint. The Write scene-content path no longer uses the old single-document CodeMirror/`EditorSurface` editor. Block-local mention hits render as dashed underlined buttons, and clicking a hit toggles a Canon description preview without duplicating the scene text. Codex canon-description editors still use shared CodeMirror `EditorSurface` state for document changes, selection, word/character status, paste cleanup, undo/redo, and pure-text saves. Canon previews now mount on a custom application-level absolute portal so they render above editor borders and following detail fields without fixed positioning. The 2026-06-26 preview follow-up closes an open preview when the user clicks any non-mention position inside the editor, clamps the preview to the visible editor/scroll-container top and bottom so it sticks at the boundary when the referenced text scrolls away, and keeps preview card scrolling vertical-only with horizontal overflow hidden. The redundant `Codex in scene` panel was removed; Scene Brief can be hidden and restored with an icon-only control.
- Settings has API-backed model profile, service key, connection test, model list, and project cloud policy behavior.
- Workshop and Review are incomplete.

Critical blockers:

- Visual design is rejected.
- Codex connections are complete for the current Codex scope. Existing backend routes cover relations, progressions, knowledge, mentions, effective state, context preview, and search. The current Release A frontend wrapper covers categories, entry list/create/get/update/archive/restore/delete, entry mentions, relations, scene mentions, and context preview. Plan still needs a full product review/rework before it should be connected further; progressions, knowledge, effective-state, and search-result integration remain later UI work.
- Write hierarchy must follow `Volume -> Chapter -> Act -> Scene` and support compact add menu, default names, later rename, double-click rename where appropriate, selected delete with confirmation, sane collapse, and scroll.
- Slice B has started: empty-library creation is tested, create/open only leaves Library on success, selected Volume is tracked, Add Chapter targets the selected Volume, selected Chapter/Act/Scene deletion is covered, Scene creation inside the selected Act is covered, and Focus enter/exit behavior is covered.
- Slice B covers Write structure selection: the pale-blue selection frame is explicit and single-target, second-clicking the same Volume/Chapter/Act/Scene clears it, parent selection no longer highlights child rows or a stale open Scene, and Scene creation is disabled when a selected Volume has no selected Act target.
- Settings is only partially product-complete.
- Review and Workshop need either real scoped workflows or honest unavailable states.

Current recovery order:

1. Slice A: baseline triage recorded on 2026-06-24.
2. Slice B: Start-to-Write vertical slice, command-verified; user visual validation remains separate.
3. Slice C: Codex core vertical slice, command-verified; user visual validation remains separate.
4. Slice D: Codex connections, command-verified for current Codex scope; Plan review/rework remains deferred.
5. Slice D2: Editor Foundation, command-verified on 2026-06-24. CodeMirror 6 backed Write scene content and Codex Canon descriptions through shared `EditorSurface` at that time; NS-410 Slice 7 supersedes that for Write scene content with a native block editor, while Codex Canon descriptions still use `EditorSurface`. Old contentEditable mark helpers and unused Milkdown runtime dependencies were removed. Real Chinese IME validation remains user/manual. A 2026-06-25 follow-up fixed Canon preview layer order using a custom application-level absolute portal, not fixed positioning. A 2026-06-26 follow-up closes previews from non-mention editor clicks and clamps them to visible editor bounds.
6. Codex Details follow-up: command-verified on 2026-06-26; screenshot self-check for the modal follow-up was skipped by user instruction. Same-day UI follow-ups added focused entry editing, enlarged the Details tab editing layout, and fixed Canon preview close/bounds behavior; this is still not user visual acceptance.
7. Slice E: permanently skipped by user decision on 2026-06-25. Existing Settings/provider changes are a working draft, not acceptance evidence.
8. Slice F: Review, Workshop, and navigation honesty, command-verified on 2026-06-25. Review and Workshop remain visible but are honest unavailable shells; future functionality must be rebuilt from scratch.
9. Slice G: visual system and responsive acceptance.
10. Slice H: verification and handoff.

## Historical Handoff Record

### NS-301

- Added explicit Act/Chapter lists, ordering, scene moves, stable references, hierarchy validation API, recoverable multi-file transactions, and real migration for M2 projects missing lists.
- WriteView loaded hierarchy immediately after create and displayed Act -> Chapter.
- Added adversarial tests for missing references, duplicate/omitted entries, same-chapter moves, cross-act moves, migration, and interrupted transaction recovery.

### NS-302

- Connected grid/board, outline, matrix/tracking, and dual timelines to the shared PlanningBoard.
- Added explicit TimelineEvent files, unplaced scenes, POV and other matrix filters, same/cross-chapter structure commands, and manual planning-branch decisions.
- Old projects without timeline files remained read-compatible.

### NS-303

- Added `@milkdown/kit` / React 7.21.2 Markdown scene editing over YAML frontmatter + Markdown authority.
- Implemented title/body editing, counts, autosave, 409 conflict handling, real disk reload, and revision-aware localStorage draft recovery.
- Added independent `sections/<scene-id>/<section-id>.md` section files, three AI permission levels, archive/restore, and review anchors under `review/anchors/<anchor-id>.yaml`.
- Anchor relocation covers original position, unique quote, context disambiguation, and explicit orphaning.
- ADR-0007, execution specs A01-A12, and acceptance records were completed.

### NS-304

- Added six built-in Codex categories and immutable built-ins plus custom categories in `codex/categories/<category-id>.yaml`.
- Physically separated canon entries, research notes in `codex/entry-research/<entry-id>.md`, and relations in `codex/relations/<relation-id>.yaml`.
- Added names, aliases, tags, custom fields, thumbnail references, recognition rules, and readable-scope policy.
- Added rebuildable SQLite indexes for Codex, FTS5, mentions, and ambiguity.
- Mention rules include aliases, excluded words, case, English plurals, longest-match priority, and same-scope ambiguity.
- Scene save rebuilds only current-scene mentions; Codex entry changes rebuild derived indexes without changing scene prose or explicit links.
- Added directed/undirected relations that retain original source/target/relation ID and archive instead of destructive delete.
- Added Fastify `/api/v1` routes for categories, entries, research notes, relations, mentions, readable-scope preview, and search.
- Added a three-column Codex UI and planning tracking tables that show entry names instead of internal UUIDs.
- ADR-0008, execution specs A01-A12, and acceptance records were completed.

### UI Copy Normalization Before English Rebuild

- The old Chinese UI was corrected to use author-facing Chinese terms instead of exposing Codex, Canon, Research, Section, POV, tokens, AI, or rough literal translations.
- Model scope terms moved toward "model-readable scope", "data scope", and "manual selection" equivalents instead of awkward pinning language.
- Writing side drawers used attachment/document language rather than developer section labels.

### NS-305

- Added `codex/progressions/<id>.yaml` for story progressions.
- Added `codex/knowledge/<id>.yaml` for character knowledge, including knowing, believing, and misunderstanding.
- Effective-state queries work by narrative scene and do not leak future content into earlier scenes.
- Future records expose counts only, not summaries, evidence, or internal IDs.
- Evidence can reference prose scenes, Codex entries, and relations; prose quotes must exist in scene text.
- Added `/api/v1` routes for progressions, character knowledge, and effective state.
- Codex detail pages gained progressions, character knowledge, and effective-state areas in the old UI.
- ADR-0009, data model docs, API docs, and `docs/testing/NS-305_ACCEPTANCE.md` were completed.

### Launcher Fixes

- `scripts/start.ps1` added `Local\NovelStudioStartLock`.
- Existing healthy service is reused.
- If a port is occupied but health fails, the script errors instead of launching a redundant background service.
- Later patches added identity checks, `-Wait`, `-SmokeTest`, `-Foreground`, `-Stop`, direct Node artifact launch, old process cleanup, and `%TEMP%\novel-studio` fallback for locked server state files.

### NS-306

- Nonempty library showed new-series form.
- New series opened immediately while preserving old series list.
- Added `POST /api/v1/series/:seriesId/books`; creating a new book also created first act and first chapter.
- Writing drawer displayed book/act/chapter/scene hierarchy and offered new scene/book/act/chapter entry points.
- Empty acts showed an add-first-chapter path.
- Automatic titles used Chinese ordinal naming in the old UI.
- Full check and browser acceptance passed.

### NS-400 and NS-307

- Added `docs/tasks/M4_PREP.md` and `docs/testing/NS-400_ACCEPTANCE.md`.
- Updated architecture docs beyond M0-M2.
- Moved Codex API routes from `apps/server/src/app.ts` into `apps/server/src/routes/codex.ts`; `app.ts` shrank from about 718 lines to about 363 lines.
- Split storage errors, file-system safety, atomic writes, and file transactions into separate modules.
- Split `CodexView.tsx` into top-level list view, `CodexEntryEditor.tsx`, and `CodexEntryPanels.tsx`.
- Added `packages/storage/test/smoke.test.ts` and `npm.cmd run test:smoke`.
- Added minimum M4 contracts for `ContextBundle`, `ContextItem`, `PromptTemplate`, `ModelCallLog`, `Proposal`, and `ProposalPatch`.
- `NS-307` cleaned the writing-page structure column and allowed `CreateSceneInput` to target `bookId`, `actId`, and `chapterId`.
- Typechecks, unit tests, storage tests, web tests, and full `npm.cmd run check` passed.

### Browser Acceptance Harness

- Added `@playwright/test`, `playwright.config.ts`, `tests/e2e/`, and `docs/testing/BROWSER_ACCEPTANCE.md`.
- Playwright global setup starts Fastify and uses an isolated `%TEMP%\novel-studio-browser-acceptance\library`.
- Coverage included implemented M3 paths and minimum M4 model settings, context preview, and prompt preview paths.
- Incomplete AI calls, full context logs, and proposal/candidate acceptance were recorded as pending instead of faked with skipped tests.

### NS-401 to NS-403

- `NS-401`: M4 execution spec, API draft, data-format draft, MockProvider vertical-slice plan, browser acceptance mapping. No real provider or key access.
- `NS-402`: split contracts into `common.ts`, `ai.ts`, `context.ts`, `prompts.ts`, and `proposals.ts`; added `packages/storage/src/aiFiles.ts`; exposed model profile, role, prompt, preset, context bundle, and call-log storage; added rebuildable `ai_context_bundles` and `ai_model_calls` indexes.
- `NS-403`: added `packages/ai`, `ProviderAdapter`, `ProviderRegistry`, default registry, `MockProvider`, model capabilities, streaming, structured output, embeddings, token estimates, simulated provider failures, `ProviderAdapterError`, and `classifyProviderError`.

### NS-404 and NS-405

- `NS-404`: added model config API, project cloud policy API, provider connection test routes, server policy helpers, credential storage abstraction, Windows Credential Manager implementation, credential-reference validation, and Settings model/data permission page.
- The old global cloud/local switch was later removed from the main path after `NS-408`; explicit provider selection, data-level filtering, and no silent fallback remained.
- `NS-405`: added context preview creation and lookup APIs. Context includes role, prompt template, user request, current scene, selected prose, previous scene summary, readable Codex entries, effective facts, relation changes, and character knowledge.
- `never`, hidden sections, local-only unselected data, unselected manual data, and future information are excluded with recorded reasons.

### NS-406

- Added built-in roles: chief writing partner, structure editor, character editor, continuity editor, style editor, harsh reader, and researcher.
- Roles/templates/presets are stored under `prompts/roles`, `prompts/templates`, and `prompts/presets`.
- Built-ins are read-only; copies can be edited.
- Declarative renderer only allows `{{variableName}}`.
- Missing required input returns `PROMPT_INPUT_MISSING`; expressions or unclosed placeholders return `PROMPT_TEMPLATE_INVALID`.
- Template updates create new versions instead of overwriting older versions.
- Context preview includes prompt-template items with template ID, version, and rendered result.
- Settings gained roles/prompts UI for role viewing, copying, prompt preview, and saving template versions.
- A concurrent built-in seeding race was found and fixed with per-project seeding lock and tests.

### NS-407

- Added `apps/server/src/routes/modelCalls.ts`.
- Registered `/api/v1/series/:seriesId/ai/calls`, call list, call details, and call context snapshot APIs.
- `POST /ai/calls` uses SSE events: `metadata`, `delta`, `usage`, `done`; failures emit `error` and save failed logs.
- Call logs record model, role, PromptTemplate ID/version, ContextBundle ID, request/response hashes, status, error classification, and usage; they do not store keys or auth headers.
- MockProvider analysis returns non-writing review output; rewrite-like tasks return candidate prose only.
- Writing page gained a minimal AI Review panel.
- Rewrite candidate enters the editor selected; the author must keep or discard it.
- Main writing UI does not show call source, base version, usage, or call ID.
- UI principles and screenshot rules were added to product, UX, AGENTS, and browser acceptance docs.

### NS-408

- Added `packages/ai/src/openAiCompatibleProvider.ts`.
- Added `packages/ai/src/anthropicProvider.ts`.
- Added `packages/ai/src/geminiProvider.ts`.
- Default registry registers `mock`, `openai-compatible`, `deepseek`, `openai`, `openrouter`, `ollama`, `anthropic`, and `google`.
- DeepSeek and generic OpenAI-compatible share OpenAI-format transport, but provider semantics are separate.
- Generic compatible services do not inherit DeepSeek default address, model, or provider-specific errors.
- DeepSeek, OpenAI, OpenRouter, Ollama, Anthropic, Google Gemini, and generic OpenAI-compatible paths support connection test, model list, streaming text, basic structured output, token estimate, and unified error classification where their protocol allows it.
- Anthropic uses official Messages API and Models API (`/v1/messages`, `/v1/models`, `x-api-key`, `anthropic-version: 2023-06-01`) and parses `content_block_delta` stream events; it is not routed through the OpenAI-compatible adapter.
- Google Gemini uses official GenerateContent and Models API (`/v1beta/models`, `:generateContent`, `:streamGenerateContent?alt=sse`, `x-goog-api-key`) and filters the model list to entries that support `generateContent`; it is not routed through the OpenAI-compatible adapter.
- Settings can create DeepSeek config with default base URL `https://api.deepseek.com` and default model `deepseek-v4-flash`.
- Settings includes Anthropic and Google Gemini in the provider selector, can fetch provider model lists, and lets the user select a fetched model into the current profile before saving.
- Added service-key save/status/delete endpoints. Plain keys go only into `CredentialStore`; model config stores only credential references.
- Server injects one `CredentialStore` and one `ProviderRegistry` into AI, context, and model-call routes.
- Browser screenshots use unique run IDs, unique file names, and `*-screenshot-manifest.json`.
- Settings UI removed developer fallback explanations from the main interface and folded credential refs/capability parameters into advanced info.
- User confirmed real DeepSeek connection and model list. Codex did not read or print the real secret.
- Provider follow-up: OpenAI, OpenRouter, Ollama, Anthropic, and Google Gemini have protocol paths covered by fake fetch tests but still need broader real-provider validation and product polish. A real DeepSeek, Anthropic, or Gemini non-writing result was not recorded in the handoff.
- Provider integration rule: any future provider work must start from that provider's official API entry and documentation, with the official URL and endpoint/auth/streaming/request-response/model-list behavior recorded in the task and acceptance records before the implementation is accepted.
- Data lifecycle rule: archive may remain as a reversible hiding state, but it must not be the only way to remove unwanted data. Archive-capable objects need a user-visible cleanup/permanent-delete path with reference checks or preserved immutable snapshots for historical views.

### NS-409 UI Correction History

- User rejected earlier UI because it diverged from target images and implementation kept fighting multiple style layers.
- `NS-409C` removed the untracked `apps/web/src/ui-foundation.css` second override layer and removed its `main.tsx` import.
- `NS-409B-plan-target-v2.png` and `NS-409B-write-target-v2.png` were marked not adopted.
- New target/review images were registered for plan and write.
- Planning moved toward a three-column workbench.
- Writing E2E screenshots used real Chinese prose rather than an empty editor.
- Writing title/body fonts moved toward Chinese manuscript style.
- Remaining issues after `NS-409C`: writing structure add buttons stayed too form-like; planning bottom new-scene workbench entry was not implemented; other pages did not receive equal review depth.
- `NS-409D` responded to wide-screen screenshots showing abnormal writing-page gaps and wasted space in Codex/Workshop.
- Wide-screen targets and review images were saved. Writing stopped drifting; Codex detail/progressions and Workshop moved toward controlled layouts; 1920-wide E2E screenshots were added.
- `NS-409E` handled planning wide-screen transition for board, outline, matrix, and timeline with current/target/implemented screenshots. It was explicitly not overall UI acceptance.
- Later React rebuild work was committed in `cca70e8`; current docs record that the new UI is still rejected and Codex remains rough.

## Verification Summary

- Repeated `npm.cmd run check` runs passed through M3/M4.
- `npm.cmd run test:smoke` passed 3 tests after NS-400.
- Playwright E2E passed for M3 main paths, M4 settings/context/prompt preview paths, AI review/rewrite path, DeepSeek settings path, and multiple NS-409 visual screenshot runs.
- M4 task tests progressed from server 7/7, web 14/14, storage 39/39 to server 15/15, web 14/14, AI 15/15, storage 41/41 before the later frontend rewrite.
- Current post-rewrite validation was later carried into `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`:
  - `AppShell.test.tsx`: 23 passed.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - `npm.cmd run build`: passed after rerunning a sandbox-blocked package-dist write with elevated permissions.
  - `npm.cmd run test`: server 16, web 23, AI 18, storage 43 passed after rerunning the sandbox-blocked package-dist write with elevated permissions.
  - `git diff --check`: passed with line-ending warnings only.
  - Browser/visual validation was not run by Codex per user instruction.
- Latest Slice D2 Canon preview layer repair validation:
  - `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx`: 6 passed.
  - `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: 37 passed.
  - `npm.cmd run typecheck -w @novel-studio/web`: passed.
  - User visual check on 2026-06-25 confirmed the reported Canon preview layer issue is fixed.
- Latest 2026-06-26 Codex layout / Canon preview follow-up validation:
  - `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx`: 8 passed.
  - `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: 38 passed.
  - `npm.cmd run typecheck -w @novel-studio/web`: passed.
  - `npm.cmd run build`: passed, with the existing Vite large-chunk warning.
  - `npm.cmd run test`: server 20, web 46, AI 20, storage 48 passed.
  - `git diff --check`: passed with line-ending warnings only.
  - Browser/screenshot validation was skipped by user instruction; user visual acceptance remains separate.
- Latest Slice F Review/Workshop honesty validation:
  - `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: 38 passed.
  - `npm.cmd run typecheck -w @novel-studio/web`: passed.
  - Browser/visual validation was not run by Codex; user visual acceptance remains separate.
- Skipped Slice E Settings and AI safety historical validation, not acceptance evidence:
  - `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts model-calls.test.ts`: 9 passed across 2 files.
  - `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: 37 passed.
  - `npm.cmd run typecheck -w @novel-studio/server`: passed.
  - `npm.cmd run typecheck -w @novel-studio/web`: passed.
- NS-408 Anthropic follow-up validation:
  - `npm.cmd run test -w @novel-studio/ai`: 19 passed.
  - `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts`: 7 passed.
  - `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: 38 passed.
  - `npm.cmd run check`: first sandboxed run failed with EPERM writing `packages/contracts/dist`; rerun with elevated permissions passed with Server 19, Web 44, AI 19, Storage 47 and production build.
  - Real external Anthropic calls were not run by Codex.
- NS-408 Gemini follow-up validation:
  - `npm.cmd run test -w @novel-studio/ai`: 20 passed.
  - `npm.cmd run build -w @novel-studio/ai`: passed.
  - `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts`: 8 passed.
  - `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: 38 passed.
  - `npm.cmd run check`: first sandboxed run failed with EPERM writing `packages/contracts/dist`; rerun with elevated permissions passed with Server 20, Web 44, AI 20, Storage 47 and production build. Vite still reports the existing large frontend chunk warning.
  - Real external Gemini calls were not run by Codex.
- Earlier Slice D category/delete backend validation:
  - `npx vitest run packages/storage/test/repository.test.ts`: 42 passed.
  - `npm.cmd run typecheck -w @novel-studio/storage`: passed.
  - `npm.cmd run typecheck -w @novel-studio/server`: passed.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - `npm.cmd run build:packages`: passed after rerunning a sandbox-blocked package-dist write with elevated permissions.
  - Browser/visual validation was not run by Codex per user instruction.

## Known Risks

- UI is not accepted.
- Codex is not product-complete.
- Settings Slice E is permanently skipped and must not be treated as accepted recovery work; broader call-log, preset, and role editing polish remains later work.
- Review and Workshop are not complete. Slice F keeps their UI visible as honest unavailable shells, removes fake counts/actions, and records that future product workflows must be made from scratch rather than expanded from the placeholder shells.
- Storage `src/index.ts` remains too large and should be split when touched.
- Browser visual validation is currently user-owned.
- List-heavy UI must use bounded internal scrolling; the user explicitly flagged unbounded page growth as a recurring defect on 2026-06-24.
- Local sample data may contain old manual browser validation artifacts; new tests use isolated libraries.
- Windows sandbox may reject fixed server state file writes; startup scripts have temp fallback.

## Immediate Next Step

Continue with Slice 8: Write embedded progression blocks and the scene progression panel. Each slice must leave the app buildable and record its exit checks before the next slice starts. Do not skip to Codex baseline/history UI, provider expansion, or fake Proposal integration in Slice 8, and do not create parallel handoff files.
