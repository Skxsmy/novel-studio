# Task Index

Status keys: `[ ]` todo, `[-]` in progress, `[x]` complete, `[!]` blocked or rejected.

This index keeps the original milestone/task history translated from the earlier Chinese log. Do not move routine task state into new files.

## Current Active Work

- [!] `PROJECT-RECOVERY` Project-level recovery roadmap.

Current decision:

- The active work is not an `NS-409` continuation.
- The current product is not accepted.
- Do not continue to `NS-410` or M5 entry work.
- Do not treat old `NS-409A` through `NS-409F` assets as current guidance.
- M2/M3 completion does not make their contracts untouchable. Hierarchy, Codex API, storage, and index behavior may be revised if the rebuilt frontend requires it.
- Current source files:
  - `docs/tasks/PROJECT_RECOVERY.md`
  - `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`
  - `docs/design/ui-redesign/README.md`

Immediate task requirements:

- Slice A is recorded in `docs/tasks/PROJECT_RECOVERY.md`.
- Slice B and Slice C are command-verified; browser/visual validation remains user-owned.
- Done in current Slice B code slice: empty-library creation is tested and opens the first editable scene.
- Done in current Slice B code slice: Write tracks selected Volume, and Add Chapter targets the selected Volume.
- Done in current Slice B code slice: selected Chapter, Act, and Scene deletion paths are covered by tests.
- Done in current Slice B code slice: creating a Scene inside the selected Act is covered by tests.
- Done in current Slice B code slice: Focus can be entered/exited from Write and exits when leaving Write.
- Done in current Slice B code slice: Write structure selection is explicit and single-target; selecting the same Volume/Chapter/Act/Scene again clears the pale-blue frame, and selecting a parent no longer highlights child rows or a stale open Scene.
- Done in current Slice C code slice: Codex frontend API coverage now includes entry list options, create, get, update, archive, and restore.
- Done in current Slice C code slice: Codex entries can be created, opened/closed, renamed, edited, saved with revision protection, reloaded after conflict, archived, and restored through real APIs.
- Done in current Slice C code slice: fake Release A relations/progressions/knowledge tabs were removed from Codex core and deferred to Codex connections.
- Done in current Slice C UI repair: Codex custom Details are collapsed until needed, empty Details no longer create a large blank panel, and Research controls no longer stretch into oversized whitespace.
- Done in current Slice D partial slice: Codex custom categories can be created from the category rail, entry category can be changed and saved, and storage moves the entry Markdown file to the correct category directory.
- Done in current Slice D partial slice: Codex index row names/descriptions remain visible when the detail pane is open, and `New Entry` / `No description` spacing is repaired before detail open.
- Done in current Slice D partial slice: Write loads real active Codex entries instead of frontend-only linked-count copy.
- Done in current Slice D repair: Codex category creation now uses a compact Add menu, custom categories support double-click rename and delete with confirmation, exact duplicate category names are rejected, category deletion moves entries to `Uncategorized`, and Codex entry deletion is available from the entry detail lifecycle area.
- Done in current Slice D repair: Codex category and Entry Index lists now use bounded scrolling; future list-heavy UI must not stretch the whole page indefinitely.
- Done in current Slice D connection repair: Codex detail tabs now include real Relations, Mentions, and Tracking. Relations can create new connections and remove active connections through the real relation APIs. Mentions show manuscript hits from the entry mention API and other-Codex-entry hits from loaded entry content; matched names/aliases are rendered as clickable dashed-underlined text that opens a Canon description preview instead of jumping. Write scene text now realtime-matches active Codex entry names/aliases, renders those hits inline as dashed underlines without highlight fill, toggles the fixed scroll-bounded preview from the same hit, and no longer duplicates the scene body in a separate preview block. The redundant Write `Codex in scene` panel was removed, and Scene Brief can be hidden/restored with an icon-only control. Codex canon descriptions use the same realtime name/alias matching for other active entries, with fixed previews that are not clipped by the input area. The header mention count only counts manuscript/scene mentions. Recognition was renamed to Tracking and keeps the existing matching/context-policy behavior.
- Done in current Slice D editor repair: Write and Codex canon-description editors handle Enter by inserting literal newlines into the saved text model, so consecutive Enter presses preserve blank lines.
- Deferred from current Slice D by user direction: Plan needs a full review and rework, but was not touched in this pass.
- Keep the Write hierarchy projection around `Volume -> Chapter -> Act -> Scene` stable while later slices touch Write/Plan/Codex connections.
- Add must open a compact menu and create default-named items.
- Delete must sit beside Add and delete the selected hierarchy item only after confirmation.
- Titles must be renameable later, including double-click rename where appropriate.
- Collapsed sections must not auto-center and waste space.
- Scroll must exist where hierarchy content can overflow.
- Codex core is a real entry workflow for Release A; Codex connections remain next.
- Codex connection work must use existing server routes/contracts or record backend gaps, not frontend-only mock state.
- Settings must complete scoped product behavior.
- Review and Workshop must become real scoped workflows or honest unavailable states.
- UI copy must remain adaptable for bilingual support.

## M0

- [x] `NS-001` Repository governance, product boundary, architecture, data contract, and test strategy.
- [x] `NS-002` Git initialization, dependency lockfile, base build, and CI-equivalent local check.
- [x] `NS-003` Durable product, UX, AI, data, import/export, and milestone specs.

## M1

- [x] `NS-101` React app shell and original Chinese visual system.
- [x] `NS-102` Sample project navigation and clickable Plan/Write/Codex/Workshop/Review shell.
- [x] `NS-103` Browser usability check and interface decision record.

## M2

- [x] `NS-201` Series, book, act, chapter, and scene file contracts plus atomic storage.
- [x] `NS-202` Fastify `/api/v1` series and scene APIs.
- [x] `NS-203` Frontend create/open/edit/save/reload vertical loop.
- [x] `NS-204` SQLite/FTS5 index rebuild and search.

## M3

- [x] `NS-301` Explicit Act/Chapter lists, ordering, scene movement, stable references, migration, and validation.
- [x] `NS-302` Real planning data for grid/board, outline, matrix/tracking, and dual timelines.
- [x] `NS-303` Milkdown editor, independent Sections, focus writing, revision-aware crash recovery, and anchors.
- [x] `NS-304` Codex file contracts, categories, aliases, relations, mention indexes, and readable-scope preview.
- [x] `NS-305` Story progressions, character knowledge, and scene-effective facts.
- [x] `NS-306` UI entry points for new series, book, act, and chapter.
- [x] `NS-307` Writing-page layout repair and scene creation into a specified book/act/chapter.

## M3 to M4 Preparation

- [x] `NS-400` M3 close, architecture refresh, module splits, repeatable smoke tests, launcher/browser-acceptance reliability, and M4 contract preparation.

## M4

- [x] `NS-401` M4 execution spec, API draft, file-format draft, and first vertical-slice design.
- [x] `NS-402` AI contract partition plus minimum persistence for model profiles, prompts, context bundles, and call logs.
- [x] `NS-403` ProviderAdapter core, capability descriptions, error classification, and MockProvider.
- [x] `NS-404` Model settings, connection tests, credential storage abstraction, and cloud permission boundaries.
- [x] `NS-405` Scene-level context assembler, permission filtering, future-story isolation, and usage estimates.
- [x] `NS-406` Prompt templates, editorial roles, presets, declarative rendering, and version history.
- [x] `NS-407` Non-writing AI calls, SSE streaming, and ModelCallLog.
- [-] `NS-408` DeepSeek and OpenAI-compatible provider foundation.
  - Done: DeepSeek provider path, generic OpenAI-compatible foundation, settings credential controls, connection test, model-list flow, and user-confirmed DeepSeek connection/model-list retrieval.
  - Not finished from original scope: OpenAI, OpenRouter, Anthropic, Gemini, and Ollama providers; recorded real DeepSeek non-writing call result.
- [!] `PROJECT-RECOVERY` Project-level recovery roadmap.
  - Historical `NS-409A/NS-409C`: image-model-assisted UI redo and plan/write correction records. Not current acceptance.
  - Historical `NS-409D`: wide-screen review for Write, Codex, and Workshop. Not current acceptance.
  - Historical `NS-409E`: planning board/outline/matrix/timeline wide-screen transition. Not current acceptance.
  - Slice A: baseline triage recorded on 2026-06-24.
  - Slice B: Start-to-Write vertical slice, command-verified; user visual validation remains separate.
  - Slice C: Codex core vertical slice, command-verified; user visual validation remains separate.
  - Slice D: Codex connections, command-verified for current Codex scope; Plan review/rework remains deferred.
  - Slice E: Settings and AI safety minimum.
  - Slice F: Review, Workshop, and navigation honesty.
  - Slice G: visual system and responsive acceptance.
  - Slice H: verification and handoff.
  - Current React working draft is command-verified but visually rejected.
- [ ] `NS-410` M4 closeout, security check, state handoff, and M5 entry confirmation. Do not start until project recovery is accepted.

M4 detailed planning remains in `docs/tasks/M4.md`. Throughout M4, AI must not directly modify prose, canon, summaries, character state, story progressions, or character knowledge.
