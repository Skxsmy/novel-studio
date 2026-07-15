# NS-514 Reference UI Rebuild Plan

Status: planning
Created: 2026-07-15
Owner: Codex
Binding reference: `docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html`

## 1. Objective

Rebuild the Novel Studio frontend by porting the binding reference HTML as an
exact UI implementation. The first implementation pass is a reference port,
not a merge with the existing UI and not a reinterpretation of existing
features.

The required order is:

1. Restore the pre-NS-514 UI code baseline.
2. Port the reference HTML structure, CSS, visible states, and interactions.
3. Obtain a stable reference-faithful UI before considering backend wiring.
4. Audit every reference control against the existing frontend/backend.
5. Connect only capabilities that fit an existing reference control without
   changing its placement, hierarchy, dimensions, or visual state.
6. Document every reference-only control and every existing capability absent
   from the reference.

## 2. Non-Negotiable Rules

### 2.1 Reference authority

- The reference HTML is binding for DOM region order, layout hierarchy,
  component dimensions, density, typography, colors, borders, spacing,
  responsive breakpoints, control placement, and default visible state.
- Existing UI code, tests, screenshots, and historical behavior do not
  authorize a visual or structural deviation.
- Existing product specifications remain authoritative for data safety and
  backend semantics, but they must not be used to inject extra controls into
  the reference UI during the reproduction pass.

### 2.2 No premature integration

- Do not preserve an old control by placing it beside, inside, or above a
  reference control during the reproduction pass.
- Do not add tabs, buttons, sidebars, cards, banners, filters, menus, or status
  rows that do not exist in the reference.
- Do not convert a disabled reference button into a different visible control.
- Do not create a `More` menu merely to hide old controls unless the reference
  itself defines that menu and its items.
- Do not change the reference DOM to satisfy old UI tests.

### 2.3 Data and fake behavior

- Reference fixture content may be used in isolated component fixtures and
  visual tests to prove reproduction fidelity.
- Production pages must not present fixture counts or fixture story facts as
  real project data.
- During the reproduction pass, a reference control with no runtime behavior
  remains visibly disabled or inert exactly as designed.
- No enabled control may fabricate a successful backend operation.

### 2.4 Existing capabilities absent from the reference

- They are not inserted into the reproduction UI.
- They are recorded in the final gap report with their current API path,
  current UI entry point, impact of being absent, and possible future mapping.
- A later product decision determines whether the reference is extended.

## 3. Current Recovery State

The tracked NS-514 frontend mutations were restored to the current `HEAD` on
2026-07-15 before this plan was written. The following work remains before the
new implementation starts:

- verify the tracked frontend is the pre-NS-514 UI baseline;
- delete only the untracked NS-514 generated components, styles, and tests;
- preserve unrelated user changes in `HANDOFF.md`,
  `docs/testing/NS-507_ACCEPTANCE.md`, `docs/design/ui-redesign/**`, and
  `.hermes/plans/`;
- rewrite the active NS-514 task and acceptance records so they reference this
  plan and no longer describe the rejected merge strategy.

No further production UI work may begin until this recovery boundary is
recorded in the acceptance record.

## 4. Binding Surface Inventory

| Surface | Binding reference node | Required first-pass result |
| --- | --- | --- |
| Application frame | `.prototype` | Exact outer frame, topbar/content rows, clipping, border, radius, and responsive size |
| Topbar | `.appbar` | Exact brand, workspace switcher, project switch, disabled Research, Settings icon |
| Project menu | `.library-menu` | Exact menu hierarchy, current project row, project list, New Series action |
| New Series dialog | `.series-dialog-backdrop`, `.series-dialog` | Exact header, fields, actions, dismissal behavior, and responsive layout |
| Overview | `#overview-workspace.ov7` | Exact header, resume panel, metric strip, recent Scenes, attention list, actions |
| Settings | `#settings-workspace.st7` | Exact settings navigation, connection list, editor, status and action placement |
| Plan | `#plan-workspace.pl6` | Exact toolbar, Grid/Outline/Matrix/Timeline views, cards, filters, inspector, status bar |
| Write | `#write-workspace.wr6` | Exact command bar, manuscript tree, editor, inspector, candidate and status regions |
| Codex | `#codex-workspace.workbench` | Exact category rail, entry index, hero, story-position bar, tabs, panel layouts, overlays |
| Workshop | `#workshop-workspace.wr5` | Exact session rail, header, message stream, composer, context/model popovers, review overlay |
| Review navigation | disabled reference workspace button | Remain disabled in the reproduction pass; no invented Review page |
| Research navigation | disabled reference workspace button | Remain disabled in the reproduction pass; no invented Research page |
| Detail Type overlay | reference schema backdrop/dialog nodes | Exact overlay structure and designed states |
| Workshop request review | reference review backdrop/dialog nodes | Exact overlay structure and designed states |

## 5. Implementation Phases

### Phase 0: Recover a clean old-UI baseline

Actions:

1. Compare `git status --short` against the preserved unrelated-change list.
2. Confirm tracked application files match `HEAD`.
3. Remove only untracked files introduced by the rejected NS-514 attempt.
4. Keep the reference HTML untouched.
5. Update `NS-514.md`, `NS-514_ACCEPTANCE.md`, `STATUS.md`, and `TASKS.md`
   with this recovery state.

Gate P0:

- no rejected NS-514 component or CSS remains in the runtime;
- old UI builds at the current `HEAD` baseline;
- unrelated changes are still present;
- exact status and command results are recorded.

### Phase 1: Extract the reference contract

Create a machine-checkable and human-readable reference manifest containing:

- global tokens and base element rules;
- every top-level reference node and child-region order;
- class names and IDs used by each surface;
- visible, hidden, selected, disabled, expanded, and modal states;
- reference JavaScript interactions and their triggers;
- all media queries and the state changes they cause;
- all visible controls and their default enabled/disabled state;
- all fixture-only text, counts, and story data.

Output:

- `docs/tasks/NS-514_REFERENCE_MANIFEST.md`

Gate P1:

- every top-level reference section is represented;
- no current runtime component or API is mentioned as an implementation
  requirement in the manifest;
- the manifest distinguishes structure from fixture content.

### Phase 2: Port the shared shell only

Actions:

1. Port reference tokens and base CSS without redesigning values.
2. Port `.prototype`, `.appbar`, brand, workspace switcher, project switch,
   project menu, and New Series dialog.
3. Port the reference navigation state exactly, including disabled entries.
4. Implement only reference-defined menu/dialog dismissal and keyboard states.
5. Do not render existing workspaces inside the new shell yet; use isolated
   reference fixtures for the content slot.

Gate P2:

- DOM hierarchy matches the manifest;
- computed layout at reference desktop and compact breakpoints matches the
  reference structure;
- no old sidebar or old shell control remains;
- no backend integration has changed the shell DOM.

### Phase 3: Port each reference workspace in isolation

Required order:

1. Overview
2. Settings
3. Plan
4. Write
5. Codex
6. Workshop
7. Reference overlays and dialogs

For each workspace:

1. Create the component from the reference DOM, not from the old component.
2. Port the relevant CSS block from the reference.
3. Reproduce all reference fixture states in component tests/fixtures.
4. Port only the interactions implemented by the reference JavaScript.
5. Verify responsive states before starting the next workspace.
6. Record any unavoidable technical adaptation; obtain approval before a
   visible deviation.

Gate P3 per workspace:

- region order and class structure match the manifest;
- default screenshot composition matches the reference fixture;
- controls have the same visible labels and states;
- no old UI control or API-driven extension appears;
- the workspace passes its focused structural and interaction tests.

### Phase 4: Assemble the complete reference replica

Actions:

1. Mount all reproduced surfaces in the reproduced shell.
2. Reproduce reference workspace switching and return paths.
3. Reproduce project menu, New Series dialog, Codex overlay, Workshop context,
   model, and request-review overlays.
4. Run a full structural comparison against the manifest.
5. Run diagnostic screenshots at the reference desktop size and documented
   compact breakpoints.

Hard Gate P4:

- the assembled UI contains only reference-defined visible structure;
- no production API wiring is added beyond what is necessary to render the
  static reproduction fixture;
- the author is given the replica for visual inspection;
- backend integration does not begin until this gate is explicitly accepted.

### Phase 5: Build the control and capability audit

After P4, create two inventories.

Reference control inventory fields:

- workspace and reference node;
- control label/icon;
- reference state and reference interaction;
- existing frontend callback, if any;
- existing API endpoint, if any;
- proposed status: connect in place, local-only, disabled/deferred, or fixture
  only;
- whether connection can occur without changing the reference DOM or visual
  state.

Existing capability gap inventory fields:

- capability name;
- old UI entry point;
- frontend component/callback;
- API endpoint and authority boundary;
- why no reference control represents it;
- user impact if omitted from the reproduced UI;
- options for a future reference revision;
- explicit author decision status.

Output:

- `docs/tasks/NS-514_REFERENCE_CONTROL_AND_CAPABILITY_AUDIT.md`

Gate P5:

- every visible reference control is listed exactly once;
- every real old-UI capability is listed exactly once;
- no implementation decision is hidden inside prose;
- unresolved mappings remain explicit decisions rather than improvised UI.

### Phase 6: Wire approved controls in place

Actions:

1. Replace fixture data with real runtime data only in matching reference
   fields and repeated rows.
2. Connect approved controls to existing callbacks/APIs only when the
   reference node can remain visually and structurally unchanged.
3. Keep unapproved or unsupported controls in their documented reference
   state.
4. Do not add a substitute location for capabilities absent from the
   reference.
5. Preserve Proposal, permissions, revision, atomic-write, and destructive
   confirmation boundaries in the underlying handlers.

Gate P6:

- reference DOM and CSS remain stable after wiring;
- real data replaces fixtures without fake counts or claims;
- enabled controls produce real results or real errors;
- absent capabilities match the approved audit disposition.

### Phase 7: Verification and final documentation

Verification layers:

1. Reference-manifest structural tests.
2. Focused component interaction tests.
3. Existing API and authority behavior tests for connected controls.
4. Full Web typecheck and build.
5. Documentation and link checks.
6. Diagnostic visual comparison at desktop and responsive breakpoints.
7. Explicit author visual acceptance as a separate final gate.

Final documentation must state:

- reference controls connected to backend;
- reference controls that remain fake, disabled, local-only, or deferred;
- existing old-UI capabilities not represented in the reference;
- files/routes/API methods used by each connected control;
- all approved deviations;
- all remaining visual or functional gates.

## 6. File and Ownership Boundaries

- Shared shell: `apps/web/src/app/` and shared tokens/components under
  `apps/web/src/ui/`.
- Domain pages: `apps/web/src/features/<domain>/`.
- API calls remain under `apps/web/src/api/`.
- Do not place the entire reference CSS in a new global multi-thousand-line
  stylesheet. Split it by the reference's existing surface boundaries without
  changing selector behavior.
- Do not edit backend contracts during the reproduction phases.
- Do not edit unrelated dirty files or deleted design artifacts.

## 7. Test Policy

- Old tests are evidence of old behavior, not authority for the new UI.
- Before changing an old assertion, classify it as backend behavior,
  application behavior, or old presentation detail.
- Preserve backend and safety assertions.
- Replace only presentation assertions that conflict with the binding
  reference.
- Never alter production DOM to make an obsolete old-UI selector pass.
- Do not run the full suite repeatedly while a surface is incomplete. Run one
  focused suite per phase, then one full regression at the relevant gate.

## 8. Completion Definition

NS-514 is complete only when:

- the reference replica passed P0 through P4 in order;
- the control/capability audit passed P5;
- only approved in-place integrations passed P6;
- final verification passed P7;
- the detailed final mapping document exists;
- unrelated user changes remain untouched;
- the author explicitly accepts the visual result.
