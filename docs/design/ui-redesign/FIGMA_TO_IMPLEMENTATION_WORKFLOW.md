# Figma To Implementation Workflow

Status: workflow contract, not implementation evidence  
Created: 2026-06-30  
Current Figma file: https://www.figma.com/design/CXclN6W9I7YfDOxUKxmKFP  
Applies to: Workshop, Review, Write automation, Codex tool surfaces, shared shell/UI foundations

## Purpose

This document defines how a Figma design becomes a real Novel Studio page without relying on screenshots as the implementation source.

The core rule is:

> Figma metadata, variables, component mappings, design context, and a written Figma structure checklist are the implementation source. Screenshots are not an agent-owned acceptance mechanism for this project.

This workflow exists because Project Recovery is accepted only for the current stage, while M5 Workshop/Review UI is not implemented or accepted. It must prevent these recurring failures:

- Building attractive isolated panels that do not match the existing project shell.
- Treating screenshots as enough to reconstruct layout, spacing, and component behavior.
- Creating pages without clear entry points.
- Recreating Figma visuals as one-off CSS instead of project components.
- Marking command/browser checks as user visual acceptance.

## Source References

Official Figma MCP guidance:

- Figma MCP introduction: https://developers.figma.com/docs/figma-mcp-server/
- Figma MCP tools and prompts: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- Structure Figma files for better code: https://developers.figma.com/docs/figma-mcp-server/structure-figma-file/
- Code Connect integration: https://developers.figma.com/docs/figma-mcp-server/code-connect-integration/
- Add custom rules and instructions: https://developers.figma.com/docs/figma-mcp-server/add-custom-rules/
- Avoid selecting large frames: https://developers.figma.com/docs/figma-mcp-server/avoid-large-frames/
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots

Project authority:

- `docs/product/PRODUCT_SPEC.md`
- `docs/product/USER_EXPERIENCE_SPEC.md`
- `docs/product/REQUIREMENTS_TRACEABILITY.md`
- `docs/architecture/TARGET_ARCHITECTURE.md`
- `STATUS.md`
- `HANDOFF.md`
- `TASKS.md`

## Non-Negotiable Project Constraints

- Do not start implementation before the user accepts the Figma direction for the target scope.
- Do not perform agent-owned screenshot-based UI acceptance. Do not treat any screenshot, browser check, automated diff, DOM measurement, or test count as user visual acceptance.
- Do not expose internal IDs, hashes, revisions, prompt versions, or audit fields in author-facing main paths unless the product spec explicitly requires it.
- Do not create a separate visual language for Workshop or Review. They must reuse the current app shell, tokens, and component grammar unless the whole application UI is deliberately revised.
- Do not create standalone routes for state views. Permission gates, failures, stale proposals, conflicts, and delete impact previews are modal, drawer, banner, or Review-state surfaces.
- Do not implement Figma-generated React/Tailwind output directly. Translate it into this repository's component, token, feature, and API boundaries.
- Do not add routine status notes here. Status remains in the existing authority files when implementation work is approved.

## Current Product Route Contract

The Figma implementation must preserve this information architecture unless the user explicitly changes it:

| Product surface | Route / placement | Entry source |
| --- | --- | --- |
| Workshop Home | `/workshop` | Left navigation `Workshop` |
| Review Inbox | `/review` | Left navigation `Review`, `Open Review` buttons |
| Proposal Detail | `/review/proposals/:proposalId` | AI chat proposal link, inbox row, `Queue Proposal`, `Open Proposal` |
| Write Editor | `/write` | Left navigation `Write`; accepted text returns here |
| Codex Workspace | `/codex` | Left navigation `Codex`; Codex tool calls return here |
| Context and Plans | Inside Workshop | Context basket, plan approval, source picker |
| Write Automation Tools | Inside Write / Workshop flow | Write side tray or Workshop tool-call result |
| Codex Management Tools | Inside Codex / Workshop flow | Codex action or Workshop tool-call result |
| States and Permissions | Not a standalone route | Modal, drawer, banner, state card |
| Responsive and Flow Map | Design artifact only | Not exposed in product UI |

## Required Inputs Before Coding

For each page or component selected from Figma, gather these inputs before editing code:

1. Figma file key and node ID.
2. Page purpose and route/placement.
3. Entry sources and return targets.
4. Figma metadata for the node tree.
5. Figma design context for the exact logical node or component.
6. Figma variable definitions for colors, spacing, radius, typography, and effects.
7. Code Connect mappings, if available.
8. Asset exports through Figma asset tools when real assets are needed.
9. A Figma structure checklist or user-provided visual artifact when available.
10. Current project component and token mapping.

Do not start from a full-page screenshot alone.

## Figma Intake Sequence

Use this order for every Figma-driven implementation:

1. Read the product route contract for the target page.
2. Use Figma metadata to inspect the page and identify logical chunks.
3. Split large frames into smaller targets such as shell, sidebar, toolbar, inbox row, proposal detail header, diff area, permission modal, and tool card.
4. Use design context on each logical chunk, not on the whole file at once.
5. Use variable definitions to extract token intent.
6. Use Code Connect mappings where available.
7. Use screenshots only after structure and tokens are understood.
8. Record any Figma ambiguity before implementation instead of guessing.

Large frame extraction is allowed only for top-level orientation. Implementation must work from smaller logical units.

## Figma File Preparation Requirements

Before implementation, the Figma file must be structured enough for reliable extraction:

- Repeated UI must use Figma components.
- Colors, spacing, radius, typography, and effects should use variables or named styles where possible.
- Layers must have semantic names, not generic frame/group names.
- Layouts should use Auto Layout where practical.
- Buttons, tabs, pills, lists, modals, drawers, and forms should be identifiable by role.
- States must be represented explicitly: default, hover/focus when relevant, disabled, loading, error, conflict, blocked, stale, accepted, and rejected.
- Pages that are not product routes must be labeled as state/design artifacts.
- Every designed page must have a documented entry point and return path.

## Codebase Mapping

The implementation should map Figma to these project areas:

| Figma concept | Project target |
| --- | --- |
| Design tokens | `apps/web/src/ui/tokens.css` |
| Shared visual rules | `apps/web/src/ui/ui.css`, `apps/web/src/app/app-shell.css` |
| App shell and navigation | `apps/web/src/app/App.tsx`, `apps/web/src/app/workspaces.ts` |
| User-facing copy | `apps/web/src/app/uiText.ts` or feature view-model text modules |
| Shared buttons | `apps/web/src/ui/Button.tsx` |
| Shared panels | `apps/web/src/ui/Panel.tsx` |
| Shared badges/pills | `apps/web/src/ui/Badge.tsx` |
| Shared tabs | `apps/web/src/ui/Tabs.tsx` |
| Shared inputs | `apps/web/src/ui/TextInput.tsx`, `apps/web/src/ui/TextArea.tsx` |
| Workshop | `apps/web/src/features/workshop/WorkshopWorkspace.tsx` |
| Review | `apps/web/src/features/review/ReviewWorkspace.tsx` |
| Write | `apps/web/src/features/write/WriteWorkspace.tsx` |
| Write editor | `apps/web/src/features/write/editor/NovelEditor.tsx`, `editorStyles.css` |
| Codex | `apps/web/src/features/codex/CodexWorkspace.tsx` |
| API access | `apps/web/src/api/*` |
| Contracts | `packages/contracts/*` |
| Storage/API behavior | `packages/storage/*`, `apps/server/*` |

If a Figma element cannot be mapped to an existing project primitive, create or extend a shared primitive first. Do not bury new visual rules inside one feature page unless the behavior is truly local.

## Component Mapping Checklist

For each Figma component or repeated pattern, create an implementation mapping:

| Field | Required answer |
| --- | --- |
| Figma node ID | Exact Figma node |
| Figma name | Semantic layer/component name |
| Product role | What the user does with it |
| Route/surface | Where it appears |
| Existing code component | Existing React component or new component name |
| Token mapping | CSS variables used |
| State mapping | default, disabled, loading, error, selected, etc. |
| Data source | mock, current API, new API, or deferred |
| Accessibility | label, focus behavior, keyboard behavior |
| Figma checklist | Node/structure/control checklist path or section |
| User visual artifact | Optional user-provided or user-requested artifact |
| Alignment result | checklist pass/fail and unresolved deviations |

This table must exist before a page is considered ready for implementation.

## Implementation Sequence

Use this sequence after Figma acceptance:

### 1. Freeze Scope

- Confirm the exact Figma pages and node IDs.
- Confirm which pages are product routes and which are states/design artifacts.
- Confirm every route's entry source and return target.
- Confirm which controls are real now and which are disabled/deferred.

### 2. Build The Mapping Contract

- Map Figma variables to `tokens.css`.
- Map Figma components to `src/ui` primitives.
- Map Workshop and Review surfaces to `features/workshop` and `features/review`.
- Map Proposal detail deep links to route/API requirements.
- Identify API gaps before writing UI code.

### 3. Update Shared UI Primitives First

- Button, badge/pill, panel, list row, tabs, modal/drawer, toolbar, and input changes must be done in `src/ui` or app-shell styles.
- If shared style changes affect the whole app, update all affected pages consistently.
- Do not make Workshop and Review look better by making them visually unrelated to Write/Codex/Plan.

### 4. Implement One Vertical Product Path

Preferred first path:

```text
Workshop chat output
  -> visible proposal deep link
  -> Review proposal detail
  -> accept/reject decision
  -> return to Write or Codex target
```

The first implementation slice must prove navigation, entry points, data shape, and visual grammar together. Do not implement every Figma page as static UI first.

### 5. Add States

After the main path works:

- permission requested
- permission denied
- proposal stale
- proposal conflict
- evidence missing
- apply failed
- rollback available
- delete blocked
- auth/provider unavailable

States must attach to their parent route. They must not become fake product pages.

### 6. Expand Tool Surfaces

Add Codex and Write automation surfaces after Review routing is real:

- Codex category/detail management through scoped permission or proposal flow.
- Write insertion/progression creation through explicit permission and accepted proposal/application flow.
- Context and plan management inside Workshop.

### 7. Remove Placeholder Drift

- Remove unavailable fake actions.
- Disable or hide controls without backing behavior.
- Keep honest unavailable states where implementation is not ready.
- Do not replace missing behavior with static counts, fake proposals, or dead buttons.

## Visual Alignment Workflow

Agents must not run screenshot acceptance loops for this project. The implementation check for each Figma-backed page is a written checklist:

1. Target Figma node ID and route.
2. Entry and return paths.
3. Column/grid structure, region order, scroll regions, row heights, and control sizes.
4. Shared component and token mapping.
5. Real API/data backing for each enabled control.
6. Disabled/deferred behavior for controls outside the current slice.
7. Explicit deviations that need user approval.

Screenshots may be captured only when the user explicitly requests a screenshot artifact. Such artifacts are references for user review, not agent-owned acceptance evidence.

## Acceptance Gates

A Figma-driven implementation page is not complete until all gates pass:

1. Product route and entry point are documented.
2. Figma node IDs and structure checklist are recorded.
3. Figma variables are mapped to project tokens.
4. Figma components are mapped to existing or new shared components.
5. User-facing copy is centralized.
6. API data source is real or explicitly deferred.
7. Disabled/unavailable controls are honest and non-misleading.
8. Implementation is checked against the Figma structure checklist.
9. User visual review is recorded before any visual acceptance claim.
10. Automated tests pass for navigation, states, and data behavior.
11. User visual acceptance is explicitly obtained before marking the visual/product scope accepted.

## Required Tests

At minimum, the implementation plan should map pages to tests like this:

| Area | Test target |
| --- | --- |
| App shell route entry | `apps/web/src/app/AppShell.test.tsx` |
| Workshop routing and states | new focused Workshop tests |
| Review inbox/detail routing | new focused Review tests |
| Proposal deep link from chat | web route/state test plus server/API test if backed |
| Write insertion return path | Write workspace/editor tests |
| Codex tool return path | Codex workspace tests |
| Visual baseline | Figma structure checklist and user visual review |
| API contracts | server route tests and contract build |

## Visual Artifact Management Rules

- Do not create agent-owned screenshot acceptance artifacts.
- If the user explicitly requests screenshots, keep artifacts page-scoped and avoid accumulating failed intermediate captures.
- Failed intermediate artifacts do not become durable design guidance.
- If the user accepts a visual artifact as a durable baseline, record its path and checksum in an evidence manifest.

## Code Connect Plan

Code Connect should be used to reduce guesswork once shared components are stable.

Initial mapping candidates:

- Figma Button -> `apps/web/src/ui/Button.tsx`
- Figma Panel -> `apps/web/src/ui/Panel.tsx`
- Figma Badge/Pill -> `apps/web/src/ui/Badge.tsx`
- Figma Tabs -> `apps/web/src/ui/Tabs.tsx`
- Figma TextInput -> `apps/web/src/ui/TextInput.tsx`
- Figma TextArea -> `apps/web/src/ui/TextArea.tsx`
- Figma Nav item -> `apps/web/src/ui/NavButton.tsx`
- App shell/sidebar/command bar -> `apps/web/src/app/App.tsx` and `app-shell.css`

Code Connect is not a substitute for implementation review. It helps the MCP output include real imports, prop patterns, and usage examples, but the result still has to be adapted to the project architecture.

## What Not To Do

- Do not paste generated Tailwind/absolute-position code into the app.
- Do not infer missing behavior from a pretty static frame.
- Do not implement design-document pages as product routes.
- Do not make Workshop or Review independent dashboards outside the app shell.
- Do not rely on screenshots to decide spacing, state, or component behavior when Figma metadata, design context, and structure checklists are available.
- Do not add page-local button/card/input styles when a shared component exists.
- Do not leave controls without entry points, backing data, or honest disabled states.
- Do not claim a screenshot self-check, DOM check, or automated test is user visual acceptance.

## Current M5 Implication

For M5 Workshop and Review, the first implementation-ready slice should be:

1. `/workshop` renders the accepted Workshop shell and chat/session surface.
2. A Workshop AI response can show a visible proposal link.
3. The proposal link opens `/review/proposals/:proposalId`.
4. Review detail shows diff/evidence/scope/actions in the accepted visual grammar.
5. Accept/reject is wired to real or explicitly stubbed command behavior.
6. Return targets to `/write` or `/codex` are visible and tested.

Only after this path is real should Codex management tools, Write automation tools, and broader permission states be expanded.
