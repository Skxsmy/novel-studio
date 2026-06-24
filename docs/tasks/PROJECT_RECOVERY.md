# Project Recovery Plan

Status: active
Updated: 2026-06-24

## Decision

The active work is a project recovery plan, not an `NS-409` continuation and not a Codex-only cleanup.

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

- Library: create/open a project from an empty library.
- Write: create/select/rename/delete hierarchy items and write/save/reload scenes.
- Codex: create/edit/save/reload/archive story-memory entries with details and research.
- Codex integration: show real scene mentions/context where it matters for Write or Plan.
- Settings: manage the minimum provider/profile/credential flow without leaking secrets.
- App shell: navigation and sidebar states do not block or distort the core workflows.
- Review and Workshop: either real scoped workflows or honest unavailable states.

It excludes:

- Full AI editorial team workflows.
- Full Review/Workshop implementation if not needed for the baseline.
- All remaining real providers unless they are required for the settings baseline.
- Decorative dashboards, placeholder panels, and screenshot-only acceptance.

## Slice A Triage Record (2026-06-24)

| Area | Current evidence | Release A decision | Required action before deeper work |
| --- | --- | --- | --- |
| Library / project lifecycle | `LibraryWorkspace` has a project form and a top `New Project` submit button, but the user saw an empty-library dead end where the primary action was disabled or blocked. Existing tests do not prove the zero-project UI path. | Keep and repair now. | Make empty-library creation a tested UI path. New projects must create a usable first hierarchy and first scene without API/manual workarounds. |
| App shell / sidebar / top actions | `App.tsx` still shows static workspace pills and counts such as Codex 128, Workshop 4, Review 18. Search and `Review Draft` appear globally but are not product-complete. Focus state is now scoped to Write. | Keep and repair now. | Remove fake counts/actions or make them real. Navigation must not imply unavailable pages are complete. Sidebar expanded/collapsed states must not block the core flow. |
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
- Settings Release A covers one coherent supported provider/profile/credential path. Additional providers, prompt editors, call-log UI, and broader AI administration are deferred unless they are required to keep the supported path honest.
- App shell actions must be truthful. Global search, draft review, workspace counts, and navigation badges must be wired to real data, disabled with clear unavailable behavior, or removed from the active path.
- Visual polish starts only after the target workflow exists. No page receives a visual acceptance pass while its primary controls are placeholders.

## Immediate Implementation Queue

1. Fix and test empty-library project creation and first editable scene creation.
2. Fix Write hierarchy projection, default names, rename, selected delete, collapse, scroll, selection, and save/reload tests.
3. Slice C has expanded the Codex frontend API wrapper for Release A entry workflows and made Codex detail editing persistent.
4. Slice D has started: Write now reads real Codex scene mentions/context preview, and Codex category create/change is real instead of read-only.
5. Replace Review and Workshop placeholder dashboards with honest unavailable states unless real workflows are selected.
6. Finish the minimum Settings credential/profile path and remove unsupported provider illusions.
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
- New project must create a coherent first hierarchy and first editable scene.
- Resolve hierarchy naming:
  - if `Volume -> Chapter -> Act -> Scene` is only UI language, document the mapping to storage;
  - if storage/API must change, implement it deliberately with migration/tests.
- Implement hierarchy add menu, default names, rename, selected delete with confirmation, collapse, scroll, and stable selection.
- Keep Focus only in Write and make it exit cleanly.
- Confirm scene save/reload/conflict behavior still works after hierarchy changes.

Acceptance:

- From no data, a user can create a project, create/rename/delete hierarchy items, write a scene, save, reload, and continue.
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
- Replaced the read-only Codex detail shell with a persistent editor for entry name, aliases, tags, details, canon description, research notes, mention rules, and context policy.
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
  - edit aliases/tags/mention policy/context policy if supported;
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
- Replaced the Write scene body control with an inline-markable editor surface so scene text appears only once. The editor realtime-matches active Codex entry names and aliases, renders hits as clickable dashed-underlined text without highlight fill, toggles a fixed scroll-bounded Canon description preview from the same hit, and still writes pure scene content back to the draft.
- Removed the redundant Write `Codex in scene` panel; Scene Brief can now be hidden and restored through an icon-only control.
- Codex canon description editing now uses the same realtime name/alias matching for other active Codex entries, with the same clickable dashed-underlined hits and fixed scroll-bounded Canon description preview that is not clipped by the input area.
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

Forbidden:

- No provider expansion before the current settings path is coherent.
- No developer explanations crowding the main UI.

### Slice F: Review, Workshop, and Navigation Honesty

Purpose: remove fake completeness.

Tasks:

- Decide whether Review and Workshop are included in Release A.
- If included, define one real workflow each and wire it to real data.
- If excluded, show unavailable states and stop wasting layout space.
- Sidebar/navigation must not imply unavailable pages are complete.

Acceptance:

- Review and Workshop are honest.
- No placeholder dashboard is accepted as a product workflow.

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

Slice D is command-verified for the current Codex scope. Browser/visual validation was not run by Codex per user instruction.

The next implementation work should not be another incremental Plan patch. Plan needs the separate full review/rework requested by the user; context boundary behavior must stay aligned with M4 `ContextBundle` preview. Do not start provider expansion, Review/Workshop polish, or visual redesign before that scope is explicitly selected.
