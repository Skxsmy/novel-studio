# Project Recovery Plan

Status: active
Updated: 2026-06-23

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

## Execution Order

The order is strict. Later slices should not start until the earlier slice is usable enough to avoid building on broken assumptions.

### Slice A: Baseline Triage

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

Purpose: connect story memory to actual writing and planning.

Tasks:

- Show scene mentions in Write through real APIs.
- Show ambiguity honestly; do not pretend unresolved names are resolved.
- Show relation/mention data in Codex if API support is sufficient.
- Connect Plan/tracking surfaces to Codex names through stable IDs.
- Align Codex context preview with M4 `ContextBundle` preview so there are not two incompatible context concepts.
- Preserve `never` and future-information boundaries.

Acceptance:

- Codex data is visible where writing/planning needs it.
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

Do Slice A first.

The immediate output should be a triage table and hard scope decisions for Recovery Release A. Do not start another UI redesign, Codex implementation, or provider expansion before that table exists.
