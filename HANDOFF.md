# Handoff

Updated: 2026-07-09

This file is the short operational handoff. The older Chinese handoff was fully read before this rewrite; its task history, verification facts, and warnings have been translated and reorganized here.

## Current Repository State

- Branch: `codex/ns-410-json-authority`.
- Latest committed baseline before Slice 11: `fb77e6d NS-410 fix(authority): complete JSON migration and codex editor` on this branch.
- Latest committed Workshop repair before the 2026-07-08 audit reports: `fedeeab NS-410 fix(workshop): repair agent tools and embedding foundation`.
- Current completed task state: `NS-410` Block Write Editor and Unified Codex Progression is command-verified through post-Slice 11 audit repair.
- Current acceptance state: Project Recovery is accepted for the current stage by user decision on 2026-06-30. NS-410 automated/command acceptance is closed through post-Slice 11 audit repair. M5 formally started on 2026-07-01; M5.1-M5.5 plus post-M5.5 audit repair are command/function verified. The 2026-07-02 Workshop context-selector repair, Codex detail `Send to AI` audit, the 2026-07-03 Workshop General Chat/settings/message-attachment/context-delivery/UI-interaction/provider-reasoning/chat-layout/session-naming/branch-history/streaming-session-switch/permanent-session-delete and Review diff-workspace repairs, the 2026-07-07 Workshop Agent `codex.create_entry` protocol, Workshop General Chat edit/resend repair, Workshop session export repair, the 2026-07-08 Agent authorization / `codex.update_entry` progression repair, and the 2026-07-09 Workshop prompt/role isolation, prompt/call boundary, and pending Codex draft follow-up repairs are also command/function verified, while user visual acceptance is still pending.
- Current Settings repair state: model settings and service keys are global at the library level, shared across all projects, and no cloud/local policy remains. Save Setting preserves existing keys, writes a newly typed key via the credential endpoint, and large fetched model lists are collapsed behind Show Models.
- Current embedding foundation: `EmbeddingModelProfile` is now separate from generation `ModelProfile`; `@novel-studio/ai` exposes an `EmbeddingRouter` with use-case routing, local/custom/OpenAI-compatible HTTP adapter support, default local `BAAI/bge-small-zh-v1.5` profile defaults, profile-level batching/concurrency, and mock adapter tests. `packages/storage` persists library-global embedding profiles under `.studio/embedding-profiles/`. No M6 SourceDocument vector index or Settings UI has been implemented yet.
- Current Workshop audit reports: `docs/design/ui-redesign/M5_WORKSHOP_CURRENT_FUNCTION_AND_UI_MAP.md` maps the current Workshop controls and frontend-backend-storage behavior for future UI redesign; `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md` lists unresolved functional defects and test gaps; `docs/testing/M5_WORKSHOP_PROMPT_AGENT_CALL_AUDIT_2026-07-09.md` records the prompt/call-chain audit and repair slices. The prompt/call repairs block public non-author message creation, filter Agent provider context, carry pending unexecuted Codex drafts forward into later Agent turns, and parse direct structured tool JSON as tool requests. Durable Tool Plans/Grants, idempotent execution records, and full multi-step tool execution remain open.
- Current Workshop UI redesign state: the 2026-07-09 UI pass uses `docs/design/ui-redesign/M5_WORKSHOP_UI_REDESIGN_REVIEW.html` and `ui-ux-pro-max-v3` guidance. Workshop now uses the shared collapsible app project sidebar instead of a Workshop-only rail override, while the Workshop page body keeps a full-height workbench layout, Workshop topbar with New/More session actions, compact thread dock, active-session conversation header, broad left-accent author/assistant/tool reading flow, message action menus, shorter composer, and a tabbed Story scope / Structure / Codex / Files context selector. Workshop floating surfaces close on outside pointer or Escape. Existing real controls and APIs are preserved. This is command/function verified only; user visual acceptance remains pending and no screenshot acceptance was run.
- Current planning decision: the prior "do not start NS-410" warning is superseded by explicit user direction on 2026-06-26. M2/M3 foundations can be modified for the JSON authority, block document, and unified Progression change. Slices 1-11, the Slice 7A/Slice 8 review repairs, the user-requested project lifecycle repair for Trash/Restore/permanent delete, the post-Slice 9 continuous Write editor refactor, and the post-Slice 10 Codex editor bounded-scroll/background-autosave repair are implemented and command-verified on the NS-410 branch. The local `docs/testing/NS-410_SLICE_1_11_AUDIT.md` file is retained but must not be committed unless the user later says otherwise. The local `docs/testing/M5_1_M5_4_CODE_UI_AUDIT.md` and `docs/testing/M5_5_CODE_UI_AUDIT.md` reports were used for post-M5.5 audit repair and should remain uncommitted unless the user explicitly says otherwise. Workshop General Chat is now default, discussion-only, custom-system-prompt-capable with no hidden fallback prompt, optionally streamed, reasoning-aware with visible collapsed state, manually stoppable while calls are in flight, deletable for unlinked messages, editable/resendable for successful author messages in `chat` sessions with durable forward-history truncation, session-exportable as requested-session UTF-8 Markdown with separate saved-reasoning and prompt-audit options, and barred from Proposal creation. Workshop session export keeps attachment file records but omits extracted attachment body text. Workshop sessions are now fixed as `chat` or `agent` at creation. Agent sessions use a server-side structured-step protocol: raw simulated `Tool Call` text is suppressed and cannot execute, while valid structured Agent steps create server-owned `role: tool` JSON messages. Agent sessions do not expose or accept General Chat edit/resend in this slice. The limited author-confirmed `codex.create_entry` tool can create new Codex entries from Agent tool messages only, matches Details to reusable detail type IDs or exact normalized names, never writes unmatched labels as free keys, and after a second confirmation creates missing detail types before writing the entry. The limited author-confirmed `codex.update_entry` tool can update one existing Codex entry's fields/research/details and can create/update/delete unified Codex Progression records through existing repository commands. Explicit author authorization in an Agent conversation is treated as sufficient source basis for these limited tools. Relation, category, character-knowledge, broad world/Write mutations, durable multi-step continuation, and full command adapters remain future Proposal or Tool Plan/Grant work. Workshop sessions do not bind a scene by default, model/system-prompt/streaming/reasoning controls are centralized in a settings dialog, Workshop user-message attachments are parsed on upload then sent as attachment IDs only, parsed attachments alone can send a request, prior same-session visible messages and historical attachment text enter calls as `workshop-chat-history`, OpenAI-compatible providers now receive actual ContextBundle item text in request bodies, official DeepSeek/OpenRouter/Ollama reasoning fields now reach Workshop reasoning display, Workshop messages use one broad readable column instead of left/right narrow bubbles, new chats use neutral/automatic/manual titles, Branch creates a populated history clone rather than an empty chat, in-flight streamed replies remain visible when switching away and back before completion, and Workshop sessions can be permanently deleted from a compact actions menu when they have no Proposal-linked messages. Next slice is M5.6 Tool Plan, Grant, And Command Adapter unless the user redirects.

## Start Here

Read these files in order:

1. `README.md`
2. `STATUS.md`
3. `TASKS.md`
4. `docs/README.md`
5. `docs/tasks/M5.md`
6. `docs/testing/M5_ACCEPTANCE.md`
7. `docs/design/ui-redesign/M5_WORKSHOP_CURRENT_FUNCTION_AND_UI_MAP.md`
8. `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md`
9. `docs/design/ui-redesign/M5_WORKSHOP_REVIEW_FIGMA_PLAN.md`
10. `docs/design/ui-redesign/M5_FIGMA_UI_REVIEW.md`
11. `docs/design/ui-redesign/FIGMA_TO_IMPLEMENTATION_WORKFLOW.md`
12. `docs/tasks/NS-410.md`
13. `docs/testing/NS-410_ACCEPTANCE.md`
14. `docs/adr/0012-scene-block-documents-and-codex-field-progression.md`
15. `docs/tasks/PROJECT_RECOVERY.md`
16. `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`

Do not begin from old `NS-409A` through `NS-409F` screenshots as if they are current guidance. Current truth is the task and acceptance record above.

## Do Not Break These Rules

- Project Recovery is accepted for the current stage as of 2026-06-30; do not reinterpret that as M5 completion.
- NS-410 is command-verified through post-Slice 11 audit repair; do not reinterpret that as M5 implementation or future UI acceptance.
- Do not assume M2/M3 APIs are sufficient just because older tasks passed. Audit before implementation.
- Do not add new routine status or handoff files. Update the existing authority files.
- Do not delete `docs/design/**/backups/` unless the user explicitly names the backup to delete.
- Do not let `apps/web/src/app/app-shell.css`, `apps/server/src/app.ts`, or `packages/storage/src/index.ts` become larger dumping grounds.
- Do not hardcode user-facing UI text inside feature logic; later bilingual support is required.
- Do not run agent-owned screenshot-based UI acceptance. Do not claim browser screenshots, DOM checks, or test counts as user visual acceptance.
- Do not expose developer/audit details in author-facing writing paths unless the product spec calls for them.
- Do not interpret JSON authority as permission to break all existing APIs. Preserve current frontend-used route contracts through adapters where feasible.
- Do not reintroduce the visible repeated block-card/textarea Write manuscript UI. The current product decision is a continuous manuscript editor with Codex progression insertion hidden in the top Insert menu and resizable inline Codex progression components. Do not add redundant paragraph/delete toolbar commands, and do not reintroduce the duplicated Scene Brief Codex progression list/read-only overview.
- Do not reintroduce the floating formatting panel or a current-text type dropdown. Heading, quote, and scene-break nodes are legacy mapping compatibility, not author-facing Scene-body format controls.
- Do not save Tiptap/ProseMirror JSON as project authority; `SceneBlockDocument` remains the saved manuscript format.

## Completed NS-410 Work

NS-410 changes the writing and Codex foundations:

- Project authority moves from Markdown/YAML files to schema-versioned JSON files; current test data can be migrated or regenerated.
- Scene body authority becomes JSON `SceneBlockDocument`; Markdown remains a projection/export/import boundary format.
- Current frontend-used scene APIs should remain compatible during transition: reads keep projected `content`, and legacy `content` writes convert to JSON block documents.
- Codex Progression is stored under `codex/progressions/` as unified JSON authority; old `codex/progressions/*.yaml` is retired and must not be used as the runtime path.
- Field, world-fact, and relationship progression are target kinds in the new unified system; character knowledge remains separate.
- Effective Codex entry reads must support scene/block position and hide future field progression content.
- Context Builder must use projected Canon Description and Details.
- Write now has a continuous Tiptap-backed manuscript editor over `SceneBlockDocument` and resizable inline Codex progression components for field Progression records. Codex progression insertion is hidden behind the top Insert menu; paragraph insertion and delete-selection toolbar commands are intentionally absent because normal prose editing should use the editor itself. Inline progression components default collapsed after creation and on scene load, expand explicitly for editing target entry/field/operation/summary/body, move by vertical drag handle to the release target position, and use wrapped controls so narrow component widths do not clip the editor fields. The duplicated Scene Brief progression panel and constant Write before/after preview are removed; effective-at-scene review belongs in the Codex Progressions tab. The floating formatting panel/current-text type selector is removed; scene-break is not exposed as a destructive conversion for active prose. Repaired Slice 8 uses scene-level atomic create/delete commands for Codex progressions and saves dirty scene drafts before deleting a Codex progression. Post-Slice 11 audit repair tightens the storage invariant so generic Progression CRUD cannot create orphan `write-block` sources; write-block sources must reference a `codexProgression` scene block pointing back to the same Progression.
- The Write manuscript shell no longer has a hard-coded 780 px max width, and Codex progression nodes no longer default to a hard-coded 680 px width. Prose follows the current Write panel; each progression's UI-only dragged width is clamped to the editor container.
- Codex now has a command-verified Progressions tab that separates saved initial state from selected-scene effective field state and field-grouped Progression history without rendering Progression IDs/revisions in the author workflow. Canon Description and Detail value editors are bounded CodeMirror surfaces with internal scrolling, not unbounded page-growth areas. Codex entry autosave runs in the background without disabling active editing fields, and in-flight save responses do not overwrite newer local draft edits. User visual acceptance is not claimed.

Implementation order is the controlled vertical slice plan in `docs/tasks/NS-410.md`; acceptance evidence and slice exits are in `docs/testing/NS-410_ACCEPTANCE.md`. Slice 1 passed for its scope on 2026-06-26; Slices 2, 3, 4, 5, 6, 7, 7A audit repair, repaired Slice 8, and Slice 9 automated UI scope passed on 2026-06-29. The post-Slice 9 Write editor refactor is a user-directed, command-verified follow-up before Slice 10. Slice 10 remaining JSON authority migration and the post-Slice 10 Codex editor repair passed on 2026-06-30. Slice 11 final regression, rollback, and handoff also passed on 2026-06-30. Post-Slice 11 audit repair is command-verified on 2026-06-30 for confirmed S1-S5 source/spec gaps without UI behavior changes.

Current JSON authority boundary:

- Completed in NS-410 so far: scene manuscripts, story structure, planning, sections, review anchors, Codex baseline/supporting files, unified Progression records, character knowledge, and M4 AI/prompt files.
- Markdown/Word remain import/export/projection boundaries. Remaining YAML mentions are historical docs or third-party optional peer metadata, not runtime authority paths.
- Proposal v2 JSON storage and Review/proposal APIs are implemented through M5.2. Workshop-generated Proposal cards and exact source-message deep links are implemented through M5.5.
- ModelCallLog currently has no Progression reference field, so model-call Progression delete blocker scanning is not implemented or claimed.

## Current Recovery Work

Project Recovery is accepted for the current stage as of 2026-06-30. The following describes the accepted baseline and remaining future-work boundaries.

Accepted baseline pieces:

- Library/project creation and no-project handling exist. Library also has Trash, Restore, and permanent project-directory deletion after exact project-name confirmation, enforced through the server/storage path.
- Write has real project/scene API wiring and partial hierarchy controls.
- Plan has surfaces, but the current frontend line still needs product-level validation.
- Codex core can list/search loaded entries, create/open/close entries, rename, edit canon description/research/aliases/reusable details/tracking/context policy, create custom categories, change entry category, save with revision protection, show conflict reload, and archive/restore through real APIs. Codex entry tags are no longer valid and have been removed from contracts, storage writes, server routes, frontend API payloads, table/search UI, and detail form UI. Details now use category-scoped reusable detail types stored in `codex/detail-types/`, managed in a large modal with real list/create/update/delete APIs and deletion blocked while same-category entries still use the type. Detail types can be created for built-in or custom categories and marked NSFW; each entry detail row has its own switch deciding whether that detail is sent with the entry into AI context. Detail values reuse the shared `EditorSurface` used by Canon Description and Write. Custom categories use a compact Add menu, support double-click rename, reject exact duplicate names, and delete with confirmation by moving entries to `Uncategorized` rather than deleting entries. Codex entries can be deleted from the entry detail lifecycle area. User screenshot feedback on the Codex detail tabs has been addressed by collapsing custom Details until needed, tightening Research/Tracking spacing, keeping index summaries visible when detail is open, separating `New Entry` from `No description`, and bounding category/index list scrolling. A later 2026-06-26 screenshot follow-up replaced the ineffective width-only detail-open adjustment with an explicit focused entry-editing mode: selecting or creating an entry defaults to Browse Entries with the category rail and Entry Index still visible, while `Focus Edit` hides those panels so the editor can take the whole Codex workbench. The Details tab typography, input sizing, Canon editor height, and per-detail row layout were enlarged for author editing; the 2026-06-30 follow-up makes Canon/Detail text editors internally scroll instead of stretching the page. Codex autosave must remain background work: do not disable active editing fields during autosave, and do not let an older save response overwrite newer local draft text. Codex detail now has real Relations, Mentions, Progressions, and Tracking tabs; Relations can create/remove active connections through real APIs; Mentions combine manuscript hits from the entry mention API with other-Codex-entry content hits from loaded entries, and matched names/aliases are clickable dashed-underlined text that opens a Canon description preview instead of jumping; Progressions shows saved initial state, selected-scene effective state, hidden-future counts, and grouped history. Canon description editing also realtime-matches other active Codex entry names/aliases and uses the same custom application-level absolute portal preview so it is not clipped by the input area or hidden under following fields.
- Write loads active Codex entries for scene-body name/alias matching. The post-Slice 9 editor refactor renders Write scene content as one continuous Tiptap-backed manuscript editor over `SceneBlockDocument` and autosaves through the scene document endpoint. Heading, quote, and scene-break nodes remain adapter compatibility only; do not expose them again as a current-line style dropdown. Repaired NS-410 Slice 8 Codex progression behavior remains available through resizable inline manuscript components for field Progression records, default-collapsed manuscript state, explicit expand-to-edit controls, and synchronized Codex-progression/Progression create/delete through scene-level transaction-backed commands with blocker reporting. The Write author UI no longer duplicates those progressions in Scene Brief and no longer renders constant before/after effective-entry previews; effective-at-scene review remains in the Codex Progressions tab. Inline Codex progression edits and Codex entry edits autosave; normal editor Save buttons/status pills are removed while failure/conflict feedback remains. The Write scene-content path no longer uses the old single-document CodeMirror/`EditorSurface` editor. Scene mention hits render as dashed underlined buttons, and clicking a hit toggles a Canon description preview without duplicating the scene text. Codex canon-description editors still use shared CodeMirror `EditorSurface` state for document changes, selection, word/character status, paste cleanup, undo/redo, and pure-text saves. Canon previews now mount on a custom application-level absolute portal so they render above editor borders and following detail fields without fixed positioning. The 2026-06-26 preview follow-up closes an open preview when the user clicks any non-mention position inside the editor, clamps the preview to the visible editor/scroll-container top and bottom so it sticks at the boundary when the referenced text scrolls away, and keeps preview card scrolling vertical-only with horizontal overflow hidden. The redundant `Codex in scene` panel was removed; Scene Brief can be hidden and restored with an icon-only control.
- Settings has API-backed global model profiles, service-key save/status/replace/delete, connection test, and bounded provider model list behavior. Model profiles are no longer project-bound, profile create/update payloads do not accept `credentialRef`, ordinary Save Setting preserves saved keys, and key/test/fetch actions work without opening a project.
- Workshop and Review are implemented only through M5.5 plus post-M5.5 audit repair and follow-up UI/model-selection/context-selector/General Chat/message-attachment/context-delivery/UI-interaction/provider-reasoning/session-naming/branch-history/streaming-session-switch/permanent-session-delete/Review diff-workspace, Agent `codex.create_entry` protocol repair, General Chat edit/resend repair, Workshop session export repair, Agent authorization / `codex.update_entry` progression repair, the 2026-07-08 collapsed project-sidebar style repair, and the 2026-07-09 Workshop shared-sidebar/floating-menu repair. Review has real Proposal inbox/detail/decision flows including stale marking, full patch review, revision-bound batch accept at the API layer, read-only non-pending Proposal details, and a pending-only queue plus focused before/after diff workspace instead of the rejected four-column dashboard. Workshop has durable sessions/messages/context baskets/context assembly, neutral new-chat titles, automatic first-message/attachment-based titles, double-click manual session renaming, Branch cloning of source message history and attachment snapshots, parsed draft/message-bound user-message attachments, attachment-only sends, a real composer attachment picker button, a compact composer context selector, full-novel/full-outline/act/chapter/multi-scene context scope support, auto-linked Codex materialization for policy-allowed entries, library-global model setting selection, per-call provider model overrides, single-role calls, fixed Chat and Agent session kinds, default General Chat with a fully visible custom system prompt, General Chat author-message edit/resend with durable forward-history truncation, session-level Markdown export scoped to the requested session with separate optional saved reasoning/prompt audit and attachment-record-only UTF-8 output, server-owned Agent tool request messages for limited `codex.create_entry` and `codex.update_entry` tools, Workshop prompt/role isolation, optional streaming with session-scoped in-flight display across session switches, separate collapsible reasoning display with visible collapsed state, immediate author-message display after Send, provider-native DeepSeek/OpenRouter/Ollama reasoning field preservation, model-error chat messages when calls fail, manual Stop for in-flight calls, deletion for unlinked chat messages, permanent session delete for sessions without Proposal-linked messages, `workshop-chat-history` context from prior same-session visible messages and historical attachment text, transactional Workshop-to-Proposal deep links for non-General replies, source-message status sync, and unavailable-state recovery. The Workshop left session dock follows `docs/design/ui-redesign/M5_WORKSHOP_UI_REDESIGN_REVIEW.html` with compact thread rows, Chat/Agent/Archived pills, and Add/More header menus for session actions and export options. The app-level project sidebar is shared across routes; Workshop must not reintroduce its own project-sidebar rail override. The shared collapsed sidebar keeps the light palette while using a narrow rail, project-initials brand block, icon plus short-label workspace buttons, and icon-only Switch Project/Settings footer actions. Workshop floating surfaces close on outside pointer or Escape. Workshop does not bind a scene by default; context must come from the user's selected context menu choices, parsed message attachments, and same-session chat history. The visible right-side Context Basket, separate Preview Context controls, mutable Codex Creation chat mode, scattered footer/header settings controls, and permanent Review Batch/Impact/Evidence side columns should not be reintroduced. General Chat and Agent replies must not expose Create Proposal and are rejected by storage/API if generic proposal creation is attempted; Agent sessions also must not expose or accept General Chat edit/resend in this slice. Full Tool Plans/Grants, relation/category/knowledge adapters, Council, and final user visual acceptance are incomplete.

Current boundaries:

- M5.1-M5.5 and post-M5.5 audit repair are command/function verified as of 2026-07-01. The 2026-07-02 Workshop context-selector repair, 2026-07-03 Workshop General Chat/settings/message-attachment/context-delivery/UI-interaction/provider-reasoning/chat-layout/session-naming/branch-history repairs, 2026-07-07 Agent `codex.create_entry`, General Chat edit/resend, session export repairs, 2026-07-08 Agent authorization / `codex.update_entry` progression repair, 2026-07-08 collapsed project-sidebar style repair, and 2026-07-09 Workshop shared-sidebar/floating-menu repair are command/function verified. M5 Workshop/Proposal/Review is not complete or visually accepted; next slice is M5.6.
- Codex connections and the NS-410 Progressions tab are complete for the current Codex scope. Existing backend routes cover relations, progressions, knowledge, mentions, effective state, context preview, and search. The current Release A frontend wrapper covers categories, entry list/create/get/update/archive/restore/delete, entry mentions, relations, progression history/effective-entry reads, scene mentions, and context preview. Plan still needs a full product review/rework before it should be connected further; knowledge UI and search-result integration remain later UI work.
- Write hierarchy must follow `Volume -> Chapter -> Act -> Scene` and support compact add menu, default names, later rename, double-click rename where appropriate, selected delete with confirmation, sane collapse, and scroll.
- Slice B has started: empty-library creation is tested, create/open only leaves Library on success, selected Volume is tracked, Add Chapter targets the selected Volume, selected Chapter/Act/Scene deletion is covered, Scene creation inside the selected Act is covered, and Focus enter/exit behavior is covered.
- Slice B covers Write structure selection: the pale-blue selection frame is explicit and single-target, second-clicking the same Volume/Chapter/Act/Scene clears it, parent selection no longer highlights child rows or a stale open Scene, and Scene creation is disabled when a selected Volume has no selected Act target.
- Settings is command-verified for global model settings, service-key lifecycle, connection testing, and collapsed provider model lists. Broader visual acceptance and polish remain user-owned.
- Review and Workshop need either real scoped workflows or honest unavailable states.

Recovery history and current-stage disposition:

1. Slice A: baseline triage recorded on 2026-06-24.
2. Slice B: Start-to-Write vertical slice, command-verified; user visual validation remains separate.
3. Slice C: Codex core vertical slice, command-verified; user visual validation remains separate.
4. Slice D: Codex connections, command-verified for current Codex scope; Plan review/rework remains deferred.
5. Slice D2: Editor Foundation, command-verified on 2026-06-24. CodeMirror 6 backed Write scene content and Codex Canon descriptions through shared `EditorSurface` at that time; NS-410 Slice 7 supersedes that for Write scene content with a native block editor, while Codex Canon descriptions still use `EditorSurface`. Old contentEditable mark helpers and unused Milkdown runtime dependencies were removed. Real Chinese IME validation remains user/manual. A 2026-06-25 follow-up fixed Canon preview layer order using a custom application-level absolute portal, not fixed positioning. A 2026-06-26 follow-up closes previews from non-mention editor clicks and clamps them to visible editor bounds.
6. Codex Details follow-up: command-verified on 2026-06-26; screenshot self-check for the modal follow-up was skipped by user instruction. Same-day UI follow-ups added focused entry editing, enlarged the Details tab editing layout, and fixed Canon preview close/bounds behavior. Current-stage recovery acceptance was later recorded by user decision on 2026-06-30.
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

- `NS-404`: added model config API, provider connection test routes, server policy helpers, credential storage abstraction, Windows Credential Manager implementation, credential-reference validation, and Settings model/data permission page.
- The current path uses explicit provider selection, credential references, data-level filtering, and no silent provider fallback.
- `NS-405`: added context preview creation and lookup APIs. Context includes role, prompt template, user request, current scene, selected prose, previous scene summary, readable Codex entries, effective facts, relation changes, and character knowledge.
- `never`, hidden sections, unselected manual data, and future information are excluded with recorded reasons.

### NS-406

- Added role/template/preset storage under `prompts/roles`, `prompts/templates`, and `prompts/presets`.
- Current prompt data is user-created or feature-specific; the earlier global built-in role/template seed path has been removed.
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
- M5.1-M5.4 validation on 2026-07-01:
  - `npm.cmd run test -w @novel-studio/contracts -- test/proposals.test.ts`: passed, 1 file / 6 tests.
  - `npm.cmd run test -w @novel-studio/storage -- test/proposals.test.ts`: passed, 1 file / 3 tests.
  - `npm.cmd run build:packages`: first sandboxed run hit EPERM while writing `packages/contracts/dist`; rerun with elevated permissions passed.
  - `npm.cmd run test -w @novel-studio/server -- test/proposal-routes.test.ts`: passed, 1 file / 2 tests.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 47 tests.
  - `npm.cmd run build`: passed.
  - `npm.cmd run test`: passed; server 7 files / 29 tests, web 3 files / 60 tests, AI 1 file / 20 tests, contracts 2 files / 9 tests, storage 6 files / 74 tests.
  - `git diff --check`: passed with Windows line-ending warnings only.
  - Agent-owned screenshot acceptance is prohibited; user visual acceptance remains pending.
- Workshop context-selector and Codex detail `Send to AI` audit validation on 2026-07-02:
  - `npm.cmd run test -w @novel-studio/server -- test/context-routes.test.ts`: passed, 1 file / 1 test; covers disabled detail text being omitted from actual ContextBundle content.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 2 tests; covers full-novel/full-outline/act/chapter/scene context kinds and auto-linked Codex materialization while excluding `manual` and `never` entries.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop context selection"`: passed, 1 selected test with 52 skipped by filter; covers the compact nested context menu.
  - `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 4 tests.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - `git diff --check`: passed with Windows line-ending warnings only.
- Workshop General Chat repair validation on 2026-07-02:
  - `npm.cmd run build -w @novel-studio/contracts`: passed.
  - Initial root-level focused test command was invalid because the same path filters were applied to unrelated workspaces and reported no matching files; workspace-relative reruns were used.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 3 tests.
  - `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 5 tests.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 54 tests.
  - `npm.cmd run build -w @novel-studio/web`: first exposed a General Chat system-prompt `useState` literal-type error; after fixing the source, passed.
  - Same-turn UI correction moved the system prompt editor out of the permanent footer into a compact popover. `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx` passed 54/54 again, and `npm.cmd run build -w @novel-studio/web` passed.
- Workshop message-attachment validation on 2026-07-03:
  - `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 6 tests.
  - `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 8 tests.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 6 tests; covers `.doc`, `.docx`, text PDF, GB18030/GBK, and UTF-16 text attachments.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 4 selected tests, 50 skipped by filter.
  - `npm.cmd run build`: passed.
  - `git diff --check`: passed with Windows line-ending warnings only.
  - Added `word-extractor` 1.0.4 (MIT) for legacy `.doc` extraction, `mammoth` 1.12.0 (BSD-2-Clause) for DOCX raw text, and `pdfjs-dist` 6.1.200 (Apache-2.0) for text-PDF extraction.
- Workshop context-delivery repair validation on 2026-07-03:
  - `npm.cmd run build -w @novel-studio/contracts`: passed.
  - `npm.cmd run build -w @novel-studio/ai`: passed.
  - `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 6 tests.
  - `npm.cmd run test -w @novel-studio/ai -- test/mockProvider.test.ts`: passed, 1 file / 20 tests.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed after rebuilding stale contracts/AI dist, 1 file / 7 tests; covers actual OpenAI-compatible request body delivery for current attachments and follow-up chat history with historical attachment text.
- Workshop UI interaction repair validation on 2026-07-03:
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "attachment-only"`: passed, 1 selected test / 54 skipped.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "shows the author message"`: passed, 1 selected test / 54 skipped.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 5 selected tests / 50 skipped.
  - `npm.cmd run build`: initially failed on optional `AbortSignal` typing under `exactOptionalPropertyTypes`; after conditionally adding `signal` only when present, rerun passed.
- Workshop provider-reasoning repair validation on 2026-07-03:
  - Official docs checked: DeepSeek `reasoning_content`, OpenRouter `reasoning` / `reasoning_content` / `reasoning_details`, Ollama `thinking`, and OpenAI Responses API reasoning behavior.
  - `npm.cmd run test -w @novel-studio/ai -- test/mockProvider.test.ts`: passed, 1 file / 21 tests.
  - `npm.cmd run build -w @novel-studio/ai`: passed.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts -t "reasoning fields"`: passed, 1 selected test / 7 skipped.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 8 tests.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 5 selected tests / 50 skipped.
  - `npm.cmd run build`: passed.
  - `git diff --check`: passed with Windows line-ending warnings only.
- Workshop chat-layout repair validation on 2026-07-03:
  - Figma MCP could not load the recorded Workshop node `12:2`; file metadata currently exposes only `00 Cover`, so no new Figma visual acceptance was claimed.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop chat messages"` initially failed twice while the new CSS regression test used an unreliable raw CSS import/helper; after switching the test to read the CSS source through Node `fs`, passed, 1 selected test / 55 skipped.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 6 selected tests / 50 skipped.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 56/56.
  - `npm.cmd run build`: passed.
  - `git diff --check`: passed with Windows line-ending warnings only.
- Workshop Agent `codex.create_entry` protocol repair validation on 2026-07-07:
  - `npm.cmd run build -w @novel-studio/contracts`: passed.
  - `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 9 tests.
  - `npm.cmd run build -w @novel-studio/storage`: passed.
  - `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 11 tests.
  - `npm.cmd run build -w @novel-studio/server`: passed.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 17 tests.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 62 tests.
- Workshop General Chat edit/resend repair validation on 2026-07-07:
  - `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 10 tests.
  - `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 13 tests.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 18 tests.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 63 tests.
  - `npm.cmd run build -w @novel-studio/contracts`: passed.
  - `npm.cmd run build -w @novel-studio/storage`: passed.
  - `npm.cmd run build -w @novel-studio/server`: passed.
  - `npm.cmd run build -w @novel-studio/web`: passed.
- Workshop session export repair validation on 2026-07-07:
  - `npm.cmd run build -w @novel-studio/contracts`: passed.
  - `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 11 tests.
  - `npm.cmd run test -w @novel-studio/server -- workshop-routes`: passed, 1 file / 19 tests.
  - `npm.cmd run test -w @novel-studio/web -- AppShell`: passed, 1 file / 64 tests.
  - `npm.cmd run build -w @novel-studio/server`: passed.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - `git diff --check`: passed with Windows line-ending warnings only.
  - Server and web regressions verify that export is scoped to the requested session, defaults to excluding saved reasoning and prompt/context audit, includes saved reasoning and prompt audit only when separately requested, emits UTF-8 portable Markdown, and keeps attachment file records while omitting attachment body text.
- Workshop Agent authorization and `codex.update_entry` progression repair validation on 2026-07-08:
  - `npm.cmd run build -w @novel-studio/contracts`: passed.
  - `npm.cmd run test -w @novel-studio/contracts -- workshop.test.ts`: passed, 1 file / 11 tests.
  - `npm.cmd run build -w @novel-studio/server`: passed.
  - `npm.cmd run test -w @novel-studio/server -- workshop-routes.test.ts`: passed, 1 file / 21 tests.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: passed, 1 file / 64 tests.
  - `git diff --check`: passed with Windows line-ending warnings only.
  - Regressions verify that explicit author authorization is prompt/runtime source material for limited Codex drafting, and that confirmed `codex.update_entry` tool messages can create, update, and delete unified Codex Progression records.
- Workshop prompt/role isolation validation on 2026-07-09:
  - Deleted the global built-in role/template seed path.
  - Added `apps/server/src/workshop/workshopPrompts.ts` as the Workshop-specific source for General Chat and Agent prompts.
  - Workshop frontend calls no longer send global `roleId`, `taskKind`, or prompt-template fields for `chat`/`agent` sessions.
  - Non-Workshop context/model-call tests create user roles/templates explicitly.
  - Validation passed: contracts build; server prompt/workshop/context/model-call tests 26/26; contracts Workshop tests 11/11; web AppShell tests 66/66; storage focused tests 64/64; AI mock-provider tests 21/21; server build; web build.
- Workshop Agent pending Codex draft follow-up validation on 2026-07-09:
  - Agent context assembly derives a `pending-codex-draft` item from the latest unexecuted Agent `codex.create_entry` / `codex.update_entry` tool message and includes it only for later Agent calls.
  - Later author turns can review or revise the current pending Codex draft in the same session; clear draft-edit turns produce a revised server-owned tool message instead of prose-only output.
  - Direct structured provider JSON such as `{ schemaVersion, tool: "codex.create_entry", draft }` is parsed as a tool request instead of being saved as raw assistant prose.
  - Real API validation used `.hermes/workshop-real-api-test.mjs`, current server source, and the existing DeepSeek credential. It created a new English 10-turn Agent session, deliberately sent stale old role/template input fields, and passed: required tool turns 3, 5, 6, 8, and 10 produced tool messages; review-only turns did not force a tool; no old prompt/role text leaked into messages/context/export; export without reasoning contained no reasoning.
  - Temporary `Real API Clean...` test sessions, messages, context bundles, and model calls were removed after validation.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 25 tests.
  - `npm.cmd run test -w @novel-studio/contracts`: passed, 3 files / 22 tests.
  - `npm.cmd run build -w @novel-studio/contracts`: passed.
  - `npm.cmd run build -w @novel-studio/server`: passed.
  - `git diff --check`: passed with Windows line-ending warnings only.
- Workshop sidebar style repair validation on 2026-07-08:
  - Design reference: `docs/design/ui-redesign/M5_WORKSHOP_UI_REDESIGN_REVIEW.html`.
  - Acceptance mapping: M5-A23 for session-area controls and M5-A24 for Figma/design-structure alignment with user visual acceptance still pending.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 13 selected tests, 51 skipped by filter.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - Screenshot/visual-diff validation was not run by Codex per project instruction; user visual acceptance remains separate.
- Workshop workbench-shell/conversation/context-panel redesign validation on 2026-07-08:
  - Skill/design basis: `ui-ux-pro-max-v3` reloaded; design-system, UX, and React stack searches run; `docs/design/ui-redesign/M5_WORKSHOP_UI_REDESIGN_REVIEW.html` used as the local reference.
  - Scope at the time: Workshop-specific full-height app body, topbar New/More session actions, compact thread dock, active conversation header, broad role-accented message flow, message action menus, compact composer, and tabbed Story scope / Structure / Codex / Files context selector. The later 2026-07-09 repair removed the Workshop-only project-sidebar rail override so the app project sidebar is shared across routes. Existing storage/server/API behavior was not changed.
  - Test note: web tests were adjusted for the moved session actions entry, the renamed Context and Call Settings controls, the topbar session creation menu, the tabbed context panel, and the message action menu.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 13 selected tests, 51 skipped by filter.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - `git diff --check`: passed with Windows line-ending warnings only.
  - Screenshot/visual-diff validation was not run by Codex per project instruction; user visual acceptance remains separate.
- Collapsed project-sidebar style validation on 2026-07-08:
  - Scope: collapsed app-level sidebar only; expanded sidebar remains on the existing light 320px layout.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "sidebar"`: passed, 1 selected test / 63 skipped.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - Screenshot/visual-diff validation was not run by Codex per project instruction; user visual acceptance remains separate.
- Workshop shared-sidebar and floating-menu repair validation on 2026-07-09:
  - Scope: remove the Workshop-only project-sidebar rail override so Workshop uses the same expandable/collapsible app project sidebar as Review and other routes; add outside-pointer and Escape dismissal for Context, New/Add, More/session actions, message actions, and Workshop settings floating surfaces.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 15 selected tests, 51 skipped by filter.
  - `npm.cmd run build -w @novel-studio/web`: passed.
  - `git diff --check`: passed with Windows line-ending warnings only.
  - Screenshot/visual-diff validation was not run by Codex per project instruction; user visual acceptance remains separate.

## Known Risks

- M5 UI is not visually accepted. Any further M5 UI work must follow a Figma structure checklist and user visual acceptance; agents must not run screenshot-based UI acceptance.
- Codex is not product-complete.
- Settings Slice E is permanently skipped and must not be treated as accepted recovery work; broader call-log, preset, and role editing polish remains later work.
- Review and Workshop are not complete beyond M5.5 plus the 2026-07-02 context-selector repair, 2026-07-03 chat/settings/message-attachment/context-delivery/UI-interaction/provider-reasoning repairs, 2026-07-07 Agent protocol / General Chat edit-resend / session export repairs, and 2026-07-08 Agent authorization / `codex.update_entry` progression repair. M5.6 must add Tool Plans/Grants/adapters; M5.7 must add Council, state sweep, and final user visual acceptance.
- Storage `src/index.ts` remains too large and should be split when touched.
- Visual validation is user-owned. Agent-owned screenshot acceptance is prohibited.
- List-heavy UI must use bounded internal scrolling; the user explicitly flagged unbounded page growth as a recurring defect on 2026-06-24.
- Local sample data may contain old manual browser validation artifacts; new tests use isolated libraries.
- Windows sandbox may reject fixed server state file writes; startup scripts have temp fallback.

## Immediate Next Step

Continue with M5.6 Tool Plan, Grant, And Command Adapter through `docs/tasks/M5.md` and `docs/testing/M5_ACCEPTANCE.md`. Do not reintroduce the visible right-side Workshop Context Basket, do not expose Create Proposal for General Chat replies, do not treat message attachments as Reference Library SourceDocuments, do not drop same-session chat history from Workshop model calls, do not expose General Chat edit/resend in Agent sessions, do not export attachment body text in Workshop session export, do not reintroduce a Workshop-specific app project sidebar rail, and do not use screenshot-based visual acceptance. Do not regress the limited Agent tool protocol: explicit author authorization is sufficient source basis for limited Codex tool drafting, and `codex.update_entry` progression create/update/delete support exists but is not full M5.6. Do not skip to Council or broad UI polish. M5.6 must add durable Tool Plan/Grant/Tool Call records and validated command adapters without giving Workshop direct authority writes outside explicit grants or Proposal conversion. NS-410 closed the runtime YAML/Markdown authority inventory; Markdown/Word remain boundary formats, and remaining YAML mentions are historical docs or third-party optional peer metadata, not runtime authority paths. Routine handoff must stay in the existing files.
