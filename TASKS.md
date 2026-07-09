# Task Index

Status keys: `[ ]` todo, `[-]` in progress, `[x]` complete, `[!]` blocked or rejected.

This index keeps the original milestone/task history translated from the earlier Chinese log. Do not move routine task state into new files.

## Current Active Work

- [x] `NS-410` Block Write Editor and Unified Codex Progression. Command-verified through post-Slice 11 audit repair; user visual acceptance remains separate.
- [-] `M5` Workshop, Proposal, and Review. `M5.1-M5.5` plus post-M5.5 audit repair are command/function verified on 2026-07-01. The 2026-07-02 Workshop context-selector repair, Codex detail `Send to AI` audit, 2026-07-03 Workshop General Chat/settings/message-attachment/context-delivery/UI-interaction/provider-reasoning/chat-layout/session-naming/branch-history/streaming-session-switch/permanent-session-delete and Review diff-workspace repairs, the 2026-07-07 Workshop Agent `codex.create_entry` protocol repair, the 2026-07-07 Workshop General Chat edit/resend repair, the 2026-07-07 Workshop session export repair, the 2026-07-08 Agent authorization / `codex.update_entry` progression repair, the 2026-07-08 Workshop workbench-shell/conversation/context-panel and collapsed project-sidebar style repairs, and the 2026-07-09 Workshop shared-sidebar/floating-menu repair are command/function verified. The 2026-07-08 Workshop current-function map and functional audit are recorded in `docs/design/ui-redesign/M5_WORKSHOP_CURRENT_FUNCTION_AND_UI_MAP.md` and `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md`; these are audit records, not defect repairs. The style repairs use `docs/design/ui-redesign/M5_WORKSHOP_UI_REDESIGN_REVIEW.html` as their design reference and keep user visual acceptance pending. Session export is scoped to one requested session, defaults to readable chat history, can include saved reasoning and prompt audit only by separate explicit options, writes UTF-8 portable Markdown, and exports attachment records without extracted attachment body text. Next slice: `M5.6` Tool Plan, Grant, And Command Adapter. User visual acceptance remains pending, and agent-owned screenshot acceptance is prohibited.
- [x] `PROJECT-RECOVERY` Project-level recovery roadmap. Accepted for the current stage by user decision on 2026-06-30; future Workshop/Proposal/Review work belongs to M5.

Current decision:

- The active work is not an `NS-409` continuation.
- Project Recovery is accepted for the current stage. M5 Proposal/Review/Workshop is implemented only through M5.5 and is not visually accepted.
- The previous “do not continue to NS-410” instruction is superseded by explicit user direction on 2026-06-26 for this JSON authority / block document / field progression task.
- Implementation is active on branch `codex/ns-410-json-authority`; the user has allowed commits on this branch while earlier project data remains disposable test data.
- Do not treat old `NS-409A` through `NS-409F` assets as current guidance.
- M2/M3 completion does not make their contracts untouchable. Hierarchy, Codex API, storage, and index behavior may be revised if the rebuilt frontend requires it.
- Current source files:
  - `docs/tasks/M5.md`
  - `docs/testing/M5_ACCEPTANCE.md`
  - `docs/design/ui-redesign/M5_WORKSHOP_CURRENT_FUNCTION_AND_UI_MAP.md`
  - `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md`
  - `docs/design/ui-redesign/M5_WORKSHOP_REVIEW_FIGMA_PLAN.md`
  - `docs/design/ui-redesign/M5_FIGMA_UI_REVIEW.md`
  - `docs/design/ui-redesign/FIGMA_TO_IMPLEMENTATION_WORKFLOW.md`
  - `docs/tasks/NS-410.md`
  - `docs/testing/NS-410_ACCEPTANCE.md`
  - `docs/adr/0012-scene-block-documents-and-codex-field-progression.md`
  - `docs/tasks/PROJECT_RECOVERY.md`
  - `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`

Accepted recovery baseline and M5 guardrails:

- Project Recovery current-stage acceptance is recorded; continue from the M5 plan unless the user redirects.
- M5.0-M5.5 and post-M5.5 audit repair are recorded and command/function verified. Do not claim Tool Plans, Grants, Council, or final M5 completion before their later slice exit checks and user visual acceptance.
- Done in current M5 code slice: Proposal v2 extends the existing Proposal contract and state machine without introducing a parallel Proposal model.
- Done in current M5 code slice: Proposal JSON storage and Review/proposal APIs cover create/read/stale/accept/reject/edit/archive/supersede/batch preview/batch accept behavior with snapshot and blocker reporting. Post-M5.5 audit repair requires scene-content base revisions, validates source/context/model-call references, binds batch accept to reviewed Proposal revisions, detects same-scene intra-batch conflicts, and writes accepted scene-content snapshot/scene/Proposal status through one transaction.
- Done in current M5 code slice: Review uses real Proposal APIs for inbox, exact Proposal detail, decisions, stale marking, full patch review, API-level batch preview/result reporting, read-only non-pending Proposal details, and audit-field hiding in the main path.
- Done in current M5 code slice: Workshop persists sessions/messages/context baskets, reloads durable messages, uses neutral/automatic/manual session titles, branches by copying source message history and attachment snapshots into the new session, assembles context through the existing Context Builder, selects library-global model settings plus per-call provider model overrides, and runs single-role calls without authority mutation. The visible UI now edits selected context through a compact composer menu instead of a permanent right-side Context Basket panel, while the internal storage object remains `WorkshopContextBasket`.
- Done in current M5 code slice: Workshop context selection supports full novel text, full outline, act, chapter, multiple scene, direct Codex entry, Codex-by-type, Codex-by-detail, and Codex-by-category selection. Selecting story scopes auto-links policy-allowed Codex entries into the same persisted context data; `manual` and `never` entries are not auto-linked.
- Done in current M5 code slice: Codex detail `Send to AI` is verified as an actual context-control path. The Codex UI writes `detailAiContext`, storage persists it, and Context Builder omits disabled detail values from actual context bundle content.
- Done in current M5 code slice: Workshop General Chat is the default call mode, sends only the user-visible system prompt without a hidden fallback prompt, displays the author's message immediately after Send, appends the assistant reply or model-error message when the call resolves, optionally streams visible answer text separately from `<think>`/`<thinking>` tags and official provider-native reasoning fields, supports visible collapsed reasoning display, lets unlinked chat messages be deleted, lets successful General Chat author messages in `chat` sessions be edited/resent by replacing that message and truncating later unprotected chat history, sends on Enter while Ctrl+Enter inserts a newline, supports manual Stop for in-flight calls, and never exposes Create Proposal for General Chat replies. Mode, model setting, provider model override, system prompt, streaming, and reasoning-display controls are centralized in a settings dialog instead of scattered through the header/footer. Storage/API also reject Proposal creation from General Chat messages, reject General Chat resend for Agent sessions, and block resend when later protected history would be erased.
- Done in current M5 code slice: Workshop conversations are created as fixed `chat` or `agent` sessions. General Chat remains discussion-only and cannot create Proposals or write actions. Agent sessions use a server-side structured-step protocol; fake `Tool Call` text is suppressed and cannot execute, while valid structured Agent steps create server-owned `role: tool` JSON messages. The limited author-confirmed `codex.create_entry` tool can create new Codex entries from Agent tool messages only, matches Details to existing reusable detail type IDs or exact normalized names, prepares missing detail type creation for confirmation, creates those detail types after confirmation, and writes entry Details by stable IDs. The limited author-confirmed `codex.update_entry` tool can update one existing Codex entry's fields/research/details and create/update/delete unified Codex Progression records through the validated repository commands. Explicit author authorization in an Agent conversation is treated as sufficient source basis for drafting/calling these tools; server repair retries authorized evidence-refusal replies before saving the Agent turn. Relation/category/knowledge writes and general Codex command adapters remain future work.
- Done in current M5 code slice: Workshop session export is a session-level Markdown read path, scoped to exactly the requested session. It defaults to readable chat history, can include saved provider reasoning and reconstructed provider prompt/context audit only through separate explicit options, writes UTF-8 portable Markdown, and exports attachment file records without extracted attachment body text.
- Done in current M5 UI repair: Workshop follows `docs/design/ui-redesign/M5_WORKSHOP_UI_REDESIGN_REVIEW.html` for the current workbench-shell pass. The route now uses the shared collapsible app project sidebar plus a dedicated full-height Workshop page body, topbar New/More session actions, compact thread dock, active-session conversation header, broad left-accent message flow, message action menus, compact composer, and a tabbed Story scope / Structure / Codex / Files context selector. Workshop Context, New/Add, More/session actions, message action menus, and settings floating surfaces close on outside pointer or Escape. The existing context basket, settings, attachment, session, resend, export, and Agent tool-confirmation behavior remains backed by the existing real controls and APIs; this is a visual/structure pass, not a new Agent or Tool Plan implementation. Command/function verification passed; user visual acceptance remains separate.
- Done in current M5 UI repair: the app-level project sidebar's collapsed state now keeps the light color system but uses the redesign's narrow rail structure: project-initials brand block, icon plus short-label workspace buttons, and icon-only Switch Project/Settings footer actions. The expanded sidebar is intentionally unchanged, and Workshop no longer forces a separate route-specific project-sidebar rail.
- Done in current M5 foundation slice: shared embedding infrastructure now exists below Workshop/Agent and M6. `EmbeddingModelProfile` is separate from generation `ModelProfile`; `@novel-studio/ai` exposes use-case-routed embedding calls, local/custom/OpenAI-compatible HTTP adapter support, default local `BAAI/bge-small-zh-v1.5` profile defaults, profile-level batching/concurrency, vector normalization, and mock adapter tests. Storage persists library-global embedding profiles under `.studio/embedding-profiles/`. This does not complete M6 vector indexes, Reference Library semantic search, Settings UI, or Tool Plan execution.
- Done in current M5 code slice: Workshop user-message attachments upload as draft records, parse immediately server-side for `.txt`, `.md`, `.doc`, `.docx`, and text PDF, decode mainstream text encodings for plain text/Markdown, send only parsed attachment IDs, allow attachment-only sends when at least one draft attachment is parsed, bind to the next author message, and enter ContextBundle as `message-attachment` snapshots instead of Reference Library SourceDocuments.
- Done in current M5 code slice: OpenAI-compatible provider requests receive actual ContextBundle item text, and Workshop calls include prior same-session visible messages plus historical message-bound attachment text as `workshop-chat-history` while excluding the current author message and model reasoning content from that history.
- Done in current M5 code slice: Workshop chat messages use one broad readable column instead of left/right narrow bubbles; message body, reasoning, metadata, and attachment chips use a larger author-workspace typography scale, guarded by a focused web source test.
- Done in current M5 code slice: Workshop in-flight stream output remains attached to the session that started the call when the author switches sessions and returns before completion; Workshop sessions expose permanent delete from a compact actions menu, cascade unlinked session data, and block Proposal-linked sessions.
- Done in current M5 code slice: Review was reset from the rejected four-column management dashboard to a pending-only queue plus focused before/after diff workspace. Source/reason/evidence are collapsed details, batch/impact panels are absent from the main route, and ordinary valid Proposals expose only Reject, Edit and Accept, and Accept.
- Done in current M5 code slice: Workshop messages create durable Proposal cards with exact source-message deep links, Review source-message return links, and status sync from Proposal authority. Post-M5.5 audit repair makes message-to-Proposal creation transactional across the Proposal and Workshop message files, covers rejected/edited/stale/superseded/archived/missing card states, and targets the Workshop basket scene when creating scene-content Proposals.
- Done in current Settings repair: model settings and service keys are library-global, not project-bound; cloud/local policy has been removed; ordinary Save Setting preserves existing keys and can save a newly typed key through the credential endpoint; large provider model lists default collapsed.
- Not done in current M5 code slice: Tool Plans, Grants, internal Codex/Write command adapters, Council, and final responsive/state/user visual acceptance are not implemented.

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
- Done in current Codex Details follow-up: Codex entry tags were removed from contracts/storage/server/frontend; reusable detail types are category-scoped, stored under `codex/detail-types/`, managed through a large modal with real list/create/update/delete APIs, protected from deletion while used, support custom categories and NSFW flags, and are used by Details rows whose text values reuse the shared editor and whose per-row switch controls whether that detail is sent to AI.
- Done in current Codex UI follow-up: selecting or creating a Codex entry now defaults to Browse Entries with category rail and Entry Index visible; `Focus Edit` explicitly hides those panels so the editor can take the whole workbench, and `Browse Entries` returns to list browsing. The Details tab typography, input sizing, Canon editor height, and per-detail row layout were enlarged for author editing.
- Done in current Slice D partial slice: Codex custom categories can be created from the category rail, entry category can be changed and saved, and storage moves the entry Markdown file to the correct category directory.
- Done in current Slice D partial slice: Codex index row names/descriptions remain visible when the detail pane is open, and `New Entry` / `No description` spacing is repaired before detail open.
- Done in current Slice D partial slice: Write loads real active Codex entries instead of frontend-only linked-count copy.
- Done in current Slice D repair: Codex category creation now uses a compact Add menu, custom categories support double-click rename and delete with confirmation, exact duplicate category names are rejected, category deletion moves entries to `Uncategorized`, and Codex entry deletion is available from the entry detail lifecycle area.
- Done in current Slice D repair: Codex category and Entry Index lists now use bounded scrolling; future list-heavy UI must not stretch the whole page indefinitely.
- Done in current Slice D connection repair: Codex detail tabs now include real Relations, Mentions, and Tracking. Relations can create new connections and remove active connections through the real relation APIs. Mentions show manuscript hits from the entry mention API and other-Codex-entry hits from loaded entry content; matched names/aliases are rendered as clickable dashed-underlined text that opens a Canon description preview instead of jumping. Write scene text now realtime-matches active Codex entry names/aliases, renders those hits inline as dashed underlines without highlight fill, toggles the scroll-bounded preview from the same hit through an editor-shell overlay, and no longer duplicates the scene body in a separate preview block. The redundant Write `Codex in scene` panel was removed, and Scene Brief can be hidden/restored with an icon-only control. Codex canon descriptions use the same realtime name/alias matching for other active entries, with editor-shell overlay previews that are not clipped by the scrollable input area. The header mention count only counts manuscript/scene mentions. Recognition was renamed to Tracking and keeps the existing matching/context-policy behavior.
- Done in current Slice D editor repair: Write and Codex canon-description editors handle Enter and Space by inserting literal characters into the saved text model, so consecutive Enter presses preserve blank lines and line-leading spaces are retained.
- Deferred from current Slice D by user direction: Plan needs a full review and rework, but was not touched in this pass.
- Done in current Slice D2 editor foundation: CodeMirror 6 was adopted for Write scene content and Codex Canon descriptions through shared `EditorSurface` at that time; NS-410 Slice 7 supersedes that for Write scene content with a native block editor, while Codex Canon descriptions still use `EditorSurface`. Document/selection/transaction state, decoration-based Codex marks, paste cleanup, undo/redo, selection restoration, anchored Canon previews, and writer-facing line/column/word-count status were implemented for that editor line. Old React-rendered contentEditable mark helpers and unused Milkdown runtime dependencies were removed. Focused tests and typecheck pass; real Chinese IME behavior remains user/manual validation, not a browser-screenshot requirement.
- Done in current Slice D2 follow-up: Canon preview popovers now render through a custom application-level absolute portal with the app's highest overlay z-index, so previews render above editor borders and following detail fields without using fixed positioning. Clicking inside a preview no longer closes it; outside clicks still close it. Focused editor tests, AppShell tests, and web typecheck pass.
- Done in current Slice D2 preview follow-up: Canon previews close when a user clicks any non-mention position inside the same editor, preview positioning is clamped to the visible editor/scroll-container top and bottom so the popover sticks at the boundary when the referenced text scrolls away, and preview cards scroll vertically only with horizontal overflow hidden.
- Done in repaired NS-410 Slice 8: Write can insert embedded Codex progression blocks through a scene-level atomic create command, update linked field Progression records, collapse block UI state without persisting it to authority, save dirty scene drafts before Codex progression deletion, and delete block plus linked Progression through a scene-level atomic delete command or show blocker reasons without mutating either record. Effective-state projection remains covered by projection/API and Codex Progressions tests; the current Write author UI no longer renders a separate Scene Brief progression panel or constant before/after preview.
- Done in NS-410 Slice 9 automated scope: Codex detail has a Progressions tab that separates saved initial state from scene-effective projected state, offers a scene selector, shows hidden-future counts, and groups field Progression history without rendering Progression IDs/revisions in the author workflow. User visual acceptance remains separate.
- Done in current NS-410 Write editor refactor follow-up: Write now uses a continuous Tiptap-backed manuscript editor instead of the visible repeated block-card/textarea UI. `SceneBlockDocument` remains the saved authority, Focus remains available, the floating format panel/destructive text-type selector was removed, legacy heading/scene-break data still round-trips, Codex progression creation is hidden inside the top Insert menu, redundant paragraph/delete toolbar commands are absent, Codex progression edit/delete/collapse happens only through a resizable inline manuscript component that defaults collapsed and expands explicitly for editing, progression movement uses a vertical drag handle and release target instead of Up/Down one-slot buttons, expanded progression controls wrap instead of clipping in narrow component widths, Scene Brief no longer duplicates Codex progression state, Write/Codex progression/Codex entry editing autosaves without normal Save buttons, and automated command checks pass. User visual acceptance remains separate.
- Done in current Write width repair: manuscript content no longer uses a hard-coded 780 px shell, Codex progression no longer defaults to a hard-coded 680 px width, and progression drag sizing is clamped to the current editor container without changing prose width rules.
- Done in current project lifecycle repair: Library can move projects to Trash, restore trashed projects, and permanently delete the project directory only after the user types the exact project name. Backend/storage rejects mismatched confirmation titles before deleting files.
- Keep the Write hierarchy projection around `Volume -> Chapter -> Act -> Scene` stable while later slices touch Write/Plan/Codex connections.
- Add must open a compact menu and create default-named items.
- Delete must sit beside Add and delete the selected hierarchy item only after confirmation.
- Titles must be renameable later, including double-click rename where appropriate.
- Collapsed sections must not auto-center and waste space.
- Scroll must exist where hierarchy content can overflow.
- Codex core is a real entry workflow for Release A; Codex connections remain next.
- Codex connection work must use existing server routes/contracts or record backend gaps, not frontend-only mock state.
- Slice E Settings work is permanently skipped by user decision and must not be treated as accepted recovery behavior.
- Done in current Slice F code slice: Review and Workshop remain visible in the UI as honest unavailable shells; fake navigation counts/actions were removed, unconnected controls were disabled, and future product workflows are recorded as from-scratch builds.
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
- [x] `NS-404` Model settings, connection tests, credential storage abstraction, and explicit Provider/credential boundaries.
- [x] `NS-405` Scene-level context assembler, permission filtering, future-story isolation, and usage estimates.
- [x] `NS-406` Prompt templates, editorial roles, presets, declarative rendering, and version history.
- [x] `NS-407` Non-writing AI calls, SSE streaming, and ModelCallLog.
- [-] `NS-408` DeepSeek and OpenAI-compatible provider foundation.
  - Done: DeepSeek provider path, generic OpenAI-compatible foundation, OpenAI/OpenRouter/Ollama provider paths, Anthropic Messages API provider path, Google Gemini GenerateContent provider path, settings credential controls, connection test, model-list flow, selectable fetched provider models, and user-confirmed DeepSeek connection/model-list retrieval.
  - Not finished from original scope: real external non-writing call validation for DeepSeek/OpenAI/OpenRouter/Ollama/Anthropic/Google Gemini, broader real-provider product polish, and recorded real DeepSeek non-writing call result.
- [x] `PROJECT-RECOVERY` Project-level recovery roadmap.
  - Current-stage acceptance: accepted by user decision on 2026-06-30. This does not mark M5 Workshop, Proposal, or Review implemented.
  - Historical `NS-409A/NS-409C`: image-model-assisted UI redo and plan/write correction records. Not current acceptance.
  - Historical `NS-409D`: wide-screen review for Write, Codex, and Workshop. Not current acceptance.
  - Historical `NS-409E`: planning board/outline/matrix/timeline wide-screen transition. Not current acceptance.
  - Slice A: baseline triage recorded on 2026-06-24.
  - Slice B: Start-to-Write vertical slice, command-verified; user visual validation remains separate.
  - Slice C: Codex core vertical slice, command-verified; user visual validation remains separate.
  - Slice D: Codex connections, command-verified for current Codex scope; Plan review/rework remains deferred.
  - Slice D2: Editor Foundation, command-verified with CodeMirror 6 for that recovery line; NS-410 Slice 7 supersedes it for Write scene content with a native block editor. The 2026-06-25 Canon preview layer repair was visually confirmed by the user. Real Chinese IME validation remains user/manual.
  - Codex Details follow-up: command-verified on 2026-06-26; screenshot self-check for the modal follow-up was skipped by user instruction. Same-day UI follow-ups added focused entry editing, enlarged the Details tab layout, and fixed Canon preview close/bounds behavior. This is not user visual acceptance.
  - Slice E: permanently skipped by user decision on 2026-06-25. Existing Settings/provider changes are working draft only, not acceptance evidence.
  - Lifecycle follow-up: project/series lifecycle now has Trash, Restore, and permanent directory delete with exact-title confirmation. Other archive-capable data must still expose cleanup/permanent-delete paths with reference checks or immutable history snapshots; archive-only removal is not acceptable for long-term use.
  - Slice F: command-verified on 2026-06-25. Review and Workshop remain visible, fake counts/actions are removed, unconnected controls are disabled, and full functionality must be designed and implemented from scratch later.
  - Slice G/H current-stage disposition: superseded by 2026-06-30 user acceptance for the current recovery stage. Future visual redesign and Review/Workshop functionality belong to M5 and require their own Figma/user acceptance.
  - Current React working draft is accepted only as the current recovery-stage baseline; it is not M5 implementation evidence.
- [x] `NS-410` Block Write Editor and Unified Codex Progression.
  - Source: `docs/tasks/NS-410.md`.
  - Acceptance: `docs/testing/NS-410_ACCEPTANCE.md`.
  - ADR: `docs/adr/0012-scene-block-documents-and-codex-field-progression.md`.
  - Scope: JSON project authority, Scene block document authority, Markdown projection/export/import boundary, compatibility adapters for existing scene APIs, unified Codex Progression for Canon Description, Details, world facts, and relationship changes, scene/block-position projection, Context Builder projection, Write embedded progression blocks, Codex baseline/history/effective UI.
  - Execution control: `docs/tasks/NS-410.md` now breaks implementation into controlled vertical slices 0-11; every slice must record exit evidence in `docs/testing/NS-410_ACCEPTANCE.md` before the next slice starts.
  - Current slice state: Slice 1 passed for contracts and JSON file foundation; Slice 2 passed for scene JSON authority with legacy `content` API compatibility; Slice 3 passed for scene document API and Markdown export; Slice 4 passed for unified Progression JSON storage and CRUD API; Slice 5 passed for projection engine and effective entry API; Slice 6 passed for Context Builder and preview projection; Slice 7 passed for the native Write ordinary block editor; Slice 7A audit repair passed for backend/storage/context gaps recorded in `docs/testing/NS-410_ACCEPTANCE.md`; repaired Slice 8 passed for Write embedded progression block commands; Slice 9 passed for automated Codex baseline/history/effective-at-scene UI scope; the post-Slice 9 continuous Write editor refactor plus inline Codex progression/autosave/width/default-collapse/top-menu/drag repair has automated command checks passing and no longer renders a duplicated Scene Brief progression panel; Slice 10 remaining JSON authority migration passed on 2026-06-30; the post-Slice 10 Codex editor repair bounds Canon/Detail editor height and keeps autosave from locking active text input; Slice 11 final regression, rollback, and handoff passed on 2026-06-30; post-Slice 11 audit repair is command-verified after closing confirmed S1-S5 source/spec gaps without changing UI behavior.
  - Current JSON authority truth: scene manuscripts, story structure, planning, sections, review anchors, Codex baseline/support files, unified Progression records, character knowledge, and M4 AI/prompt files are JSON authority. Markdown/Word remain import/export/projection boundaries; remaining YAML mentions are historical docs or third-party optional peer metadata, not runtime authority paths.
  - Current status: command-verified through post-Slice 11 audit repair; user visual acceptance remains separate.

M4 detailed planning remains in `docs/tasks/M4.md`. Throughout M4 and NS-410, AI must not directly modify prose, canon, summaries, character state, Progression, or character knowledge without explicit author action/proposal flow.
