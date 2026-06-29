# Project Recovery Plan

Status: paused by NS-410 user redirect
Updated: 2026-06-26

## Decision

Project recovery remains not accepted, but it is paused while `NS-410` is active by explicit user direction on 2026-06-26. The active task is `docs/tasks/NS-410.md`. NS-410/ADR-0012 supersedes this recovery document's older Markdown/YAML persistence assumptions with JSON project authority.

The next target is a small accepted product slice: a user can create a project from zero, write in a coherent hierarchy, manage basic story memory in Codex, and configure the minimum AI/provider settings without fake placeholder pages.

Anything outside that slice must either be explicitly deferred or shown as unavailable. The project should not continue accumulating broad plans, decorative UI, or half-wired pages.

## Diagnosis

The current failure is not one UI page. It is a cross-layer mismatch:

- Product flows are unclear after the frontend rewrite.
- The app shell and empty states can block basic use.
- Write hierarchy terminology and behavior are not settled.
- Codex frontend was rebuilt as a shell while old backend capability remains only partially exposed.
- Settings has partial real wiring but not a finished product path.
- Review and Workshop are still not real workflows.
- Existing M2/M3 implementation may need revision if it does not support the recovered product.
- Automated checks pass but do not prove product or visual acceptance.

## Recovery Release A

Recovery Release A is the minimum product that can be accepted as a usable baseline.

It includes:

- Library: create/open a project from an empty library, move a project to Trash, restore it, and permanently delete its directory only after exact project-name confirmation.
- Write: create/select/rename/delete hierarchy items and write/save/reload scenes.
- Codex: create/edit/save/reload/archive story-memory entries with details and research.
- Codex integration: show real scene mentions/context where it matters for Write or Plan.
- Settings: existing working draft only; Slice E is permanently skipped and is not a Release A acceptance gate.
- App shell: navigation and sidebar states do not block or distort the core workflows.
- Review and Workshop: visible honest unavailable shells for Release A; future functionality must be rebuilt from scratch.

It excludes:

- Full AI editorial team workflows.
- Full Review/Workshop implementation. Their later implementation must be made from scratch, not expanded from the current placeholder shells.
- All remaining real providers unless they are required for the settings baseline.
- Decorative dashboards, placeholder panels, and screenshot-only acceptance.

## Slice A Triage Record (2026-06-24)

| Area | Current evidence | Release A decision | Required action before deeper work |
| --- | --- | --- | --- |
| Library / project lifecycle | `LibraryWorkspace` has a project form and a top `New Project` submit button, but the user saw an empty-library dead end where the primary action was disabled or blocked. Existing tests do not prove the zero-project UI path. | Keep and repair now. | Make empty-library creation a tested UI path. New projects must create a usable first hierarchy and first scene without API/manual workarounds. |
| App shell / sidebar / top actions | Slice A found static workspace pills and counts such as Codex 128, Workshop 4, Review 18, plus global Search and `Review Draft` actions that were not product-complete. Focus state is scoped to Write. | Keep and repair now. | Slice F removes the fake counts/actions for Review and Workshop and disables unconnected search. Sidebar expanded/collapsed states must not block the core flow. |
| Write hierarchy / editor | Real series and scene APIs exist. Add menu, delete confirmation, collapse, double-click rename, and scene save exist in current code, but UI terminology maps storage `Act`/`Chapter` inconsistently against required `Volume -> Chapter -> Act -> Scene`. | Keep and repair now. | Fix hierarchy projection, labels, default names, errors, tests, selection, collapse, scroll, rename, delete, and save/reload. This is Slice B's first implementation target. |
| Overview | Mostly static status panels. `Continue Scene`, warnings, and review queues are not clearly wired as real workflows. | Keep minimal, repair only where it supports Release A. | Either wire `Continue Scene` to the active editable scene or make it unavailable. Remove fake live status. |
| Plan | `PlanWorkspace` consumes real planning-board data and has filters, sort, outline/storyboard/tracking/timeline, and reorder commands. It still needs product review but is not the first broken path. | Keep, smoke after hierarchy changes. | Do not redesign first. Verify it survives hierarchy terminology fixes and does not display fake state. |
| Codex | Backend routes cover categories, entries, mentions, relations, progressions, knowledge, effective state, context, and search. Slice C expanded the frontend wrapper for entry list/create/get/update/archive/restore and replaced the read-only detail shell with a persistent entry editor. | Keep and continue through real connections. | Slice D should connect mentions, ambiguity, relations, context, and planning surfaces through existing APIs or record backend gaps. No fake tabs. |
| Settings | Current UI uses real APIs for model profile list/create/update, service-key save, connection test, model list, and cloud policy. It lacks a fully coherent product path, including status/delete coverage in the frontend wrapper. | Keep and repair minimum only. | Finish one supported provider/profile/credential path, including safe status/replace/delete behavior where supported. Defer provider expansion. |
| Review | Current page is a placeholder dashboard without a real scoped workflow. | Mark unavailable for Release A unless explicitly pulled in. | Replace fake dashboard with an unavailable state or remove from active navigation until a real workflow is defined. |
| Workshop | Current page is a placeholder with non-functional session/composer affordances. | Mark unavailable for Release A unless explicitly pulled in. | Replace fake dashboard with an unavailable state or remove from active navigation until a real workflow is defined. |
| API / storage / contracts | `packages/storage/src/index.ts` is still very large. `apps/server/src/app.ts` still owns many series/hierarchy routes. Codex backend capability is much broader than the frontend wrapper. | Audit while repairing touched flows. | Do not grow large dumping-ground files. Split route/storage helpers when touching affected logic. Verify contracts match the UI projection. |
| i18n / copy | `uiText.ts` centralizes some hierarchy and error strings, but many feature files still hardcode user-facing English copy. Future bilingual support is required. | Repair alongside each slice. | Move changed user-facing copy into shared text structures instead of adding more hardcoded strings. |
| Validation | Current tests are shallow and command-oriented. `AppShell.test.tsx` covers only 11 flows and misses empty-library creation, Codex edit persistence, unavailable states, and hierarchy semantic correctness. | Expand with each slice. | Add tests for zero-project creation, hierarchy projection, Codex CRUD, Settings key status/delete if implemented, and Review/Workshop honesty. |

## Release A Scope Decisions (2026-06-24)

- Release A is Start-to-Write plus Codex Core plus minimum Settings plus honest navigation. Overview and Plan remain limited support surfaces. Review and Workshop are unavailable unless a later slice deliberately defines one real workflow.
- The accepted writing hierarchy is `Volume -> Chapter -> Act -> Scene`. The current durable storage remains `Series -> Book -> Act -> Chapter -> Scene` for Release A unless implementation proves the projection is more dangerous than a contract migration. The projection must be explicit in code and tests, not hidden by swapped labels.
- Codex Release A covers entry list/search, create, open/close detail, rename, edit details/canon description, edit research, save/reload, archive/restore, and visible conflict behavior. Relations, progressions, knowledge, effective state, and scene context are not allowed as fake editable tabs.
- Settings Release A no longer includes Slice E. On 2026-06-25 the user marked Slice E permanently skipped. Existing Settings code may remain as an unaccepted working draft, but it must not be used as recovery completion evidence.
- Review and Workshop remain visible in the UI, but Release A treats them as not connected to backend workflows. Their future product workflows must be designed and implemented from scratch.
- App shell actions must be truthful. Global search, draft review, workspace counts, and navigation badges must be wired to real data, disabled with clear unavailable behavior, or removed from the active path.
- Visual polish starts only after the target workflow exists. No page receives a visual acceptance pass while its primary controls are placeholders.

## Immediate Implementation Queue

1. Fix and test empty-library project creation and first editable scene creation.
2. Fix Write hierarchy projection, default names, rename, selected delete, collapse, scroll, selection, and save/reload tests.
3. Slice C has expanded the Codex frontend API wrapper for Release A entry workflows and made Codex detail editing persistent.
4. Slice D has started: Write now reads real Codex scene mentions/context preview, and Codex category create/change is real instead of read-only.
5. Replace Review and Workshop placeholder dashboards with honest retained UI shells: visible, non-operational, and clearly not backend-connected.
6. Mark Slice E permanently skipped in all active status and acceptance records.
7. Clean app-shell fake counts/actions and keep changed copy ready for bilingual adaptation.

## Execution Order

The order is strict. Later slices should not start until the earlier slice is usable enough to avoid building on broken assumptions.

### Slice A: Baseline Triage

Status: recorded on 2026-06-24.

Purpose: stop guessing and define the first accepted product slice.

Tasks:

- Make a workspace-by-workspace status table:
  - Library;
  - Overview;
  - Plan;
  - Write;
  - Codex;
  - Settings;
  - Review;
  - Workshop;
  - App shell/sidebar;
  - API/storage/contracts;
  - i18n/copy.
- For each area, classify it as:
  - keep and repair now;
  - keep but mark unavailable;
  - defer;
  - remove from active navigation for now.
- Record hard decisions:
  - hierarchy terminology and storage/API mapping;
  - Codex minimum workflow for Release A;
  - Settings minimum workflow for Release A;
  - Review/Workshop scope for Release A.
- Identify current code owners and large-file risks.

Deliverable:

- Update this file with the status table and decisions.
- Update `PROJECT_RECOVERY_ACCEPTANCE.md` with release gates.

Acceptance:

- The next implementation slice is unambiguous.
- No page remains in the plan as "maybe later but still pretending to work."

Forbidden:

- No visual redesign work before this triage is recorded.
- No Codex-only implementation before the Release A scope is fixed.

### Slice B: Start-to-Write Vertical Slice

Status: command-verified on 2026-06-24; user visual validation remains separate.

Done so far:

- Empty-library creation is now covered by `AppShell.test.tsx`; the first project can be created from the UI and opens the first editable scene.
- Project create/open calls now report success to the app shell, so failed API calls no longer close the Library page.
- Write now tracks the selected Volume in session state.
- The product hierarchy projection is explicit in the Write UI: product `Chapter` maps to current storage `Act`, and product `Act` maps to current storage `Chapter`.
- Adding a Chapter after selecting a Volume now targets that selected Volume instead of always targeting the first Volume.
- Tests now cover deleting selected Chapter, deleting selected Act, deleting selected Scene, and creating a Scene inside the selected Act.
- Tests now cover entering and exiting Focus from Write, including automatic exit when switching away from Write.
- Write structure selection is now explicit and single-target: clicking the same Volume/Chapter/Act/Scene again clears the pale-blue selection frame, selecting a parent no longer highlights child layers or a stale open Scene, and Scene creation is disabled when a selected Volume has no selected Act target.
- Scene creation now honors an explicitly supplied `bookId/actId/chapterId` target before falling back to the open scene context.

Purpose: recover the core author path before advanced work.

Tasks:

- Empty library must allow project creation from the UI.
- Project lifecycle must expose Trash, Restore, and permanent directory deletion. Permanent deletion requires typing the exact project name in a confirmation dialog and must be enforced by the backend, not only by a disabled button.
- New project must create a coherent first hierarchy and first editable scene.
- Resolve hierarchy naming:
  - if `Volume -> Chapter -> Act -> Scene` is only UI language, document the mapping to storage;
  - if storage/API must change, implement it deliberately with migration/tests.
- Implement hierarchy add menu, default names, rename, selected delete with confirmation, collapse, scroll, and stable selection.
- Keep Focus only in Write and make it exit cleanly.
- Confirm scene save/reload/conflict behavior still works after hierarchy changes.

Acceptance:

- From no data, a user can create a project, create/rename/delete hierarchy items, move the project to Trash, restore it, permanently delete it after exact project-name confirmation, write a scene, save, reload, and continue.
- This flow is covered by tests.
- User can visually inspect this slice before Codex work expands.

Forbidden:

- No three permanent large add buttons.
- No disabled primary action in empty project/library state.
- No hidden API/manual workaround for project creation.

### Slice C: Codex Core Vertical Slice

Status: command-verified on 2026-06-24; user visual validation remains separate.

Done:

- Audited existing Codex layers before UI expansion:
  - server routes already cover categories, entries, mentions, relations, progressions, knowledge, effective state/context preview, and search;
  - storage already supports entry update plus archive/restore with revision checks;
  - contracts already separate entry revision and research revision through `baseRevision` and `baseResearchRevision`.
- Expanded `apps/web/src/api/codex.ts` for Release A entry routes only: list options, create, get, update, archive, and restore.
- Replaced the read-only Codex detail shell with a persistent editor for entry name, aliases, details, canon description, research notes, mention rules, and context policy.
- Added visible save states, 409 conflict messaging, explicit reload, and archive/restore through real API calls.
- Removed fake Release A relations/progressions/knowledge tabs from the core detail area. Those remain Slice D+ connection work.
- Tightened Codex detail tab density after user screenshot review: custom Details are collapsed until needed, empty Details no longer render a large dashed blank panel, Add Detail expands the section, and Research controls no longer stretch vertically.
- Kept dense index search local over loaded entry documents for Release A. A summary endpoint or lazy aggregate tab endpoint is not required for the current small baseline, but should be revisited before large-project performance work.

Purpose: make Codex real enough to support story memory.

Tasks:

- Audit current Codex API/contract/storage against the UI before writing UI code.
- Expand `apps/web/src/api/codex.ts` only for routes used by the core workflow.
- Implement:
  - list/search entries;
  - create entry;
  - select same entry to close detail;
  - rename entry;
  - edit details/canon description;
  - edit research;
  - edit aliases/mention policy/context policy if supported;
  - save with revision protection;
  - archive/restore.
- Decide whether the dense index needs a summary endpoint instead of full document lists.
- Decide whether the detail workspace needs aggregate/lazy tab endpoints.
- Keep category-specific schemas out of Release A unless the triage proves they are required.

Acceptance:

- A user can create a Codex entry, edit it, save it, reload it, and see persisted data.
- Conflict behavior is visible and recoverable.
- API gaps are documented as backend tasks, not hidden in frontend state.

Forbidden:

- No read-only form masquerading as an editor.
- No fake relations/progressions/knowledge tabs.
- No hard delete unless archive/restore is explicitly rejected.

### Slice D: Codex Connections

Status: command-verified for the current Codex scope on 2026-06-24; user visual validation remains separate. Plan review/rework is deferred by user direction.

Done so far:

- Expanded the frontend Codex API wrapper for custom category creation/update, scene mention reads, and Codex context preview reads.
- Made Codex entry category editable in the detail form and added custom category creation in the category rail.
- Extended contracts/storage so `updateCodexEntry` accepts `categoryId`, validates the target category, writes the new frontmatter, moves the entry Markdown file to the correct category directory, deletes the old file, and rebuilds Codex indexes.
- Fixed the Codex index compact/detail-open CSS so entry names and descriptions remain visible when the detail pane is open, while nonessential columns collapse.
- Repaired the pre-detail index row spacing so `New Entry` and `No description` do not visually run together.
- Connected Write to real active Codex entries for realtime scene-body name/alias matching instead of explicit scene-link counts or frontend mock text.
- Added command tests for Write scene mention/context display, custom category creation, entry category save payloads, and storage-level category file movement.
- Reworked Codex category management so the category rail uses a compact Add menu, custom categories can be renamed by double-click, exact duplicate category names are rejected, and deleting a custom category moves its entries to `Uncategorized` instead of deleting entries.
- Added Codex entry deletion as a separate dangerous action in the entry detail lifecycle area. Category deletion remains in the category rail so the two destructive scopes are visually separate.
- Added bounded scrolling to the Codex category rail and Entry Index. Record this as an ongoing UI constraint: long lists must scroll inside their panel and must not stretch the whole page indefinitely.
- Added real Codex detail connection tabs:
  - Relations reads the relation list API for the selected entry, renders directed/undirected counterpart information plus description/evidence, and supports adding/removing active connections through the real relation APIs.
  - Mentions is its own subtab and separates manuscript mentions from other Codex-entry mentions. Manuscript mentions come from the entry mention API; Codex-entry mentions are derived from loaded entry canon description, research notes, and detail fields for the current UI view. Matched names and aliases are clickable dashed-underlined text that opens a Canon description preview instead of jumping to another entry.
  - Recognition was renamed to Tracking. The matching/context-policy behavior remains editable through the existing entry save API.
- Removed the decorative entry-frequency wave from the Codex detail header. The large mention count now counts manuscript/scene mentions only; Codex-entry mentions are counted only inside the Mentions subtab.
- Replaced the Write scene body control with an inline-markable editor surface so scene text appears only once. The editor realtime-matches active Codex entry names and aliases, renders hits as clickable dashed-underlined text without highlight fill, toggles a scroll-bounded Canon description preview from the same hit through an editor-shell overlay, and still writes pure scene content back to the draft.
- Removed the redundant Write `Codex in scene` panel; Scene Brief can now be hidden and restored through an icon-only control.
- Codex canon description editing now uses the same realtime name/alias matching for other active Codex entries, with the same clickable dashed-underlined hits and editor-shell overlay Canon description preview that is not clipped by the scrollable input area.
- Write and Codex canon-description editors now preserve blank lines and line-leading spaces by applying Enter and Space as literal text-model insertions instead of relying on browser contentEditable defaults.
- User screenshot follow-up on 2026-06-26 removed invalid Codex entry tags from contracts, storage writes, server routes, frontend API payloads, table/search UI, and the detail form. Details now use category-scoped reusable detail types persisted under `codex/detail-types/`, managed through a large modal with real list/create/update/delete APIs, protected from deletion while any same-category entry still uses the type, and edited in rows whose text values reuse the same `EditorSurface` as Canon Description and Write. Detail types can be assigned to custom categories and marked NSFW; each entry detail row has its own switch for whether that detail is sent with the entry into AI context.
- Later 2026-06-26 screenshot feedback rejected the width-only detail-open adjustment. Selecting or creating a Codex entry now defaults to Browse Entries with the category rail and Entry Index visible; `Focus Edit` explicitly hides those panels so the selected entry editor can take the whole workbench, and `Browse Entries` returns to list browsing. The Details tab typography, input sizing, Canon editor height, and per-detail row layout were enlarged for author editing instead of retaining the compact backend-form look.
- Left Plan untouched in this pass. The user identified Plan as requiring a full review and rebuild rather than incremental repair.

Purpose: connect story memory to actual writing and planning.

Tasks:

- Show scene mentions in Write through real APIs.
- Show ambiguity honestly; do not pretend unresolved names are resolved.
- Show relation/mention data in Codex if API support is sufficient.
- Defer Plan/tracking surfaces until the Plan review/rework starts; do not make another incremental Plan patch in this slice.
- Align Codex context preview with M4 `ContextBundle` preview so there are not two incompatible context concepts.
- Keep bounded scroll containers for list-heavy UI. The user explicitly flagged unbounded page growth as a recurring UI defect on 2026-06-24.
- Preserve `never` and future-information boundaries.

Acceptance:

- Codex data is visible where writing and Codex detail need it.
- Plan tracking remains explicitly deferred and must not be represented as completed.
- Context boundaries still pass tests.
- AI output still cannot directly mutate Codex, progressions, knowledge, or prose.

Forbidden:

- No frontend-only context mock.
- No silent future-information leak.

### Slice D2: Editor Foundation

Purpose: replace the current ad hoc contentEditable editor with a mature editor architecture. The current bugs (duplicate punctuation, interrupted Chinese IME composition, duplicated Codex entry text, and only one duplicate receiving an underline) come from two systems writing the same editable DOM: the browser's native contentEditable/IME flow and React's realtime re-rendered Codex marks. This slice must remove that class of bug rather than adding another keydown workaround.

Research sources:

- CodeMirror 6 System Guide and Reference Manual: https://codemirror.net/docs/guide/ and https://codemirror.net/docs/ref/
- ProseMirror Guide: https://prosemirror.net/docs/guide/
- Tiptap editor documentation: https://tiptap.dev/docs/editor/getting-started/overview
- Lexical introduction: https://lexical.dev/docs/intro
- Zettlr user manual and source as writing-product reference: https://docs.zettlr.com/en/ and https://github.com/Zettlr/Zettlr

Researched options:

- CodeMirror 6 was the preferred direction for the Release A pure-text editor surfaces. It provides immutable editor state, explicit transactions, selection mapping, extensions, keymaps/commands, view plugins, viewport-aware rendering, decorations, input/clipboard hooks, and tooltip/panel placement. NS-410 keeps CodeMirror usable as a block text-editing surface, but the old Markdown/YAML persistence reason is superseded by ADR-0012.
- ProseMirror is a strong rich-text engine with transactions, plugins, schema, history, and decorations. It is appropriate if Novel Studio later decides scene/canon content should become structured rich text beyond the NS-410 block document model.
- Tiptap is a headless ProseMirror framework with a higher-level extension ecosystem. It is useful if the product needs rich content blocks, comments, or collaboration UI, but it inherits the ProseMirror schema/serialization cost and is not the first choice for the current plain-text editor.
- Lexical has editor state, commands, transforms, listeners, and React-oriented rich-text architecture. It is viable for complex rich text, but Codex underline decorations and pure-text persistence would require more custom node/plugin work than CodeMirror.
- Zettlr is not an embeddable editor library for this app, but it is a useful writing-product reference: Markdown-first editor, status bar, autocomplete, language/style tools, writing statistics, project/workbench behavior, and a clear separation of content and presentation.

Decision for implementation:

- Adopt CodeMirror 6 for Release A editor surfaces. No blocker was found during the spike.
- Historical Release A decision: keep scenes and Codex canon descriptions as pure text. Superseded by NS-410/ADR-0012 for persistence: scene authority becomes JSON `SceneBlockDocument`; `content` may remain as a projected compatibility field.
- Treat Codex underlines, search hits, warnings, and future comments as editor decorations. They must never become saved text.
- Keep Canon previews outside the document as editor-anchored tooltips/popovers, positioned from editor coordinates and updated on scroll/resize.
- Remove the current React-rendered contentEditable mark approach in Write and Codex Canon description editors.
- Browser screenshot verification is not required for this slice unless the user or a later task explicitly asks for it.

Implementation notes on 2026-06-24:

- Added shared `EditorSurface` under `apps/web/src/features/editor/` using CodeMirror state/view/commands/lang-markdown.
- Replaced the Write scene editor and Codex Canon description editor with `EditorSurface`.
- Reused existing Codex mention matching rules for decorations; duplicate mentions are rendered as independent decoration ranges without changing the document text.
- Removed the old `editableText.ts` DOM extraction/caret helper and removed unused Milkdown runtime dependencies from `@novel-studio/web`.
- Added ADR-0010 for the CodeMirror runtime decision and dependency licenses.

Follow-up layer fix on 2026-06-25:

- Canon previews now render through a custom application-level absolute portal instead of CodeMirror's tooltip container or the editor's own low-level stacking context. The portal host and preview card use the app's highest overlay layer so the preview stays above the Codex editor border and following detail fields without using viewport-fixed positioning.
- Clicking inside the preview no longer triggers the editor outside-click close handler; clicking elsewhere still closes it.
- Focused tests cover top-layer mounting, z-index, preview self-click behavior, AppShell integration, and web typecheck.

Follow-up close/bounds fix on 2026-06-26:

- Clicking any non-mention position inside the same editor now closes the open Canon preview, matching the outside-click behavior without requiring editing text.
- Canon preview positioning now clamps to the visible editor/scroll-container bounds. When the referenced text scrolls above or below the visible editor, the preview remains at the editor top or bottom boundary instead of disappearing with the text.
- Preview card scrolling is vertical-only; horizontal overflow is hidden and long preview text wraps instead of creating a sideways scrollbar.
- Focused tests cover the non-mention editor click close behavior and the top/bottom clamping math.

Target editor capabilities:

- Chinese IME composition is not interrupted by Codex mention matching or React rerenders.
- Typing punctuation and ordinary characters does not duplicate text.
- Typing a Codex name or alias inserts the text once; realtime underline appears as a decoration over that single text range.
- Enter, Space, Tab/indent policy, paste, undo/redo, selection restoration, and scroll-to-cursor run through editor transactions/commands.
- Line-leading spaces, blank lines, and paste text are preserved according to the explicit pure-text contract.
- Word/character count, current paragraph/line focus, placeholder, read-only state, and dirty tracking are driven from the editor state rather than DOM scraping.

Tasks:

- Add the minimal CodeMirror 6 packages needed for a plain-text editor surface; record dependency purpose and license in the relevant implementation notes.
- Build a reusable `EditorSurface` under `apps/web/src/features/editor/` or an equivalent shared feature boundary. It should expose `value`, `onChange`, `readOnly`, `placeholder`, `className`, optional Codex entry inputs, and optional preview callbacks.
- Add a CodeMirror Codex decoration extension that maps active entry names/aliases to dashed underline ranges without changing the document. It must prefer longest match, avoid overlapping ranges, honor archived entries, and preserve aliases/matching rules already used by Codex.
- Add an editor-anchored Canon preview extension or bridge that opens from a decorated range, closes on second click/Escape/outside click, and stays bounded with its own scroll.
- Replace the Write scene editor first. Keep save payloads pure text and preserve existing API behavior.
- Replace the Codex canon-description editor second. It must support the same Codex decorations for other active entries and pure-text save behavior.
- Remove the old shared contentEditable extraction/restore helpers when both surfaces no longer depend on them.
- Add focused unit tests for text model behavior and React integration tests for Write and Codex save payloads. Use browser/manual validation for real IME behavior unless the user explicitly asks Codex to run browser checks.

Acceptance:

- CodeMirror 6 is either adopted with a working spike or rejected with a concrete blocker recorded here before choosing ProseMirror/Tiptap/Lexical.
- Write scene editor and Codex canon-description editor no longer use React-rendered contentEditable marks for Codex mentions.
- Chinese IME composition is not interrupted by realtime Codex matching.
- Punctuation and normal text input do not duplicate characters.
- Typing a Codex name/alias creates one text occurrence and one decoration range over that occurrence.
- Saved scene content and Codex canon descriptions remain pure text and preserve blank lines plus line-leading spaces.
- Codex underline decorations, preview UI, and any future editor overlays never enter saved manuscript or Canon text.
- Canon preview popovers stay anchored during editor scroll/resize, render above neighboring editor/detail layers, and do not use viewport-fixed positioning as a shortcut.
- Undo/redo, paste cleanup, and selection restoration have automated coverage appropriate to the chosen implementation.

Forbidden:

- Do not add more unrelated keydown patches as the long-term editor strategy.
- Do not save Codex underline markup, preview components, or UI-only spans into manuscript or Codex Canon text.
- Do not replace the editor with a heavy rich-text schema unless the JSON block-document persistence and plain-text projection contracts remain explicit.
- Do not continue with a self-built editor core unless CodeMirror, ProseMirror/Tiptap, and Lexical have all been rejected with concrete blockers.

### Slice E: Settings and AI Safety Minimum

Purpose: finish the settings path required for safe local/cloud AI use.

Tasks:

- Model profile list/create/update/delete or explicitly scoped equivalent.
- Service key save/replace/delete/reuse status.
- Provider connection test and model list where supported.
- Project cloud/provider policy is explicit.
- Secrets never enter project files, logs, console, screenshots, or Git.
- Decide whether unfinished providers stay deferred.

Acceptance:

- A user can manage the supported provider/profile path through the UI.
- No silent provider fallback exists.
- Tests cover behavior that does not require real secrets.

Status: permanently skipped by user decision on 2026-06-25.

Notes:

- Earlier command-verified Settings work remains an unaccepted working draft in the codebase unless explicitly reverted later.
- Do not claim Slice E as Recovery Release A evidence.
- Do not continue provider expansion under the skipped Slice E scope.
- Future provider work still requires official provider API documentation and a fresh task/acceptance record.

Forbidden:

- No provider expansion before the current settings path is coherent.
- Any future provider integration must start from the provider's official API entry and documentation, and the task record must cite the official URL plus endpoint, auth, streaming, request/response, and model-list behavior before implementation is accepted.
- Archive-only lifecycle is forbidden for new archive-capable data. Each design must include a user-visible cleanup/delete path and reference-blocking behavior.
- No developer explanations crowding the main UI.

### Slice F: Review, Workshop, and Navigation Honesty

Status: command-verified on 2026-06-25; user visual validation remains separate.

Purpose: remove fake completeness.

Tasks:

- Keep Review and Workshop visible in the UI.
- Mark both pages as not connected to backend workflows in the current recovery release.
- Remove fake counts, fake queue totals, and active-looking backend actions.
- Disable composer/session/review action controls that do not have real backend support.
- Record that future Review and Workshop functionality must be designed and implemented from scratch.
- Sidebar/navigation must not imply unavailable pages are complete.

Done:

- Review and Workshop remain in the sidebar and can still be opened.
- Sidebar fake counts for Overview, Plan, Codex, Workshop, and Review were removed; Write keeps the real save-state pill.
- Workshop and Review sidebar rows show `Not connected` instead of fake totals.
- The unconnected global `Review Draft` button was removed.
- Global search is shown as unavailable instead of acting like a connected command search.
- Review keeps its inbox layout but disables filters and replaces fake queue/stat cards with compact unavailable states.
- Workshop keeps sessions, conversation, composer, and context basket UI, but disables New Session, Send, Insert, and composer input.
- Changed user-facing Slice F copy is centralized in `uiText`.
- Future Review and Workshop implementation is recorded as a from-scratch build.

Acceptance:

- Review and Workshop remain visible but honest: no backend-connected workflow is implied.
- Future functionality is explicitly recorded as a from-scratch build.
- No placeholder dashboard is accepted as a product workflow.

Command evidence:

- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed: 38 tests.
- `npm.cmd run typecheck -w @novel-studio/web` passed.

Forbidden:

- No large empty boards/cards to make a page look occupied.

### Slice G: Visual System and Responsive Acceptance

Purpose: make the accepted flows feel like one product.

Tasks:

- Rework app shell/sidebar expanded/collapsed states.
- Define compact workbench layouts for operational pages.
- Define quiet writing layout for Write.
- Ensure text fits controls and responsive states.
- Keep copy centralized enough for future bilingual support.
- Apply visual pass only to flows that exist.

Acceptance:

- User accepts the visual/product direction for Recovery Release A.
- Core flows scale without broken sidebars, oversized empty regions, or mismatched density.

Forbidden:

- No visual polish pass over fake workflows.

### Slice H: Verification and Handoff

Purpose: close the recovery release safely.

Tasks:

- Run required commands.
- Update authority docs.
- Remove obsolete non-backup active guidance.
- Preserve protected backups.
- Commit coherent slices.

Required commands:

```powershell
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx
npm.cmd run build
npm.cmd run test
git diff --check
```

Acceptance:

- Commands pass.
- Worktree is clean.
- Docs match product reality.
- User accepts the recovered baseline.

## Current Next Action

Slice F is command-verified. The next implementation work is Slice G: visual system and responsive acceptance unless the user redirects. Plan still needs the separate full review/rework requested by the user; context boundary behavior must stay aligned with M4 `ContextBundle` preview. Do not start provider expansion or a new milestone before that scope is explicitly selected.
