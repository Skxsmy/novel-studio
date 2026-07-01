# M5 Figma UI Review

Date: 2026-06-30

Status: design usability review only. This file does not mark M5 implementation complete and does not replace user visual acceptance.

## Purpose

This review checks whether the current M5 Figma design can be used as the implementation source for Workshop, Proposal, and Review work.

The review is intentionally not limited to whether pages exist. It checks:

- whether the Figma file contains concrete product routes and entry points;
- whether Workshop and Review are connected by exact Proposal deep links;
- whether the design preserves the current app shell and editor direction;
- whether controls are tied to the M5 permission/proposal model;
- whether the design is implementation-ready for the planned M5 slice order.

## Evidence Used

Figma file:

- `https://www.figma.com/design/CXclN6W9I7YfDOxUKxmKFP`

MCP methods used:

- `use_figma` with the Figma Plugin API to load pages and inspect page children.
- `get_design_context` for `14:2` Review Inbox and `17:2` Proposal Detail.
- `get_variable_defs` for `12:2`, which returned no variable definitions.
- `search_design_system`, which returned no published variables or styles for the queried local UI kit terms.
- Screenshot inspection for the exported local images listed below.

Local screenshot evidence:

- `D:\tmp\novel-studio-figma-screenshots\02-workshop-main.png`
- `D:\tmp\novel-studio-figma-screenshots\03-workshop-context-plans.png`
- `D:\tmp\novel-studio-figma-screenshots\04-codex-management-tools.png`
- `D:\tmp\novel-studio-figma-screenshots\05-write-continuous-editor.png`
- `D:\tmp\novel-studio-figma-screenshots\06-review-inbox.png`
- `D:\tmp\novel-studio-figma-screenshots\07-review-proposal-detail.png`
- `D:\tmp\novel-studio-figma-screenshots\08-states-permissions.png`
- `D:\tmp\novel-studio-figma-screenshots\09-responsive-flow-map.png`
- `D:\tmp\novel-studio-figma-screenshots\10-entry-points-routing.png`

Local project context checked:

- `docs/tasks/M5.md`
- `docs/testing/M5_ACCEPTANCE.md`
- `docs/design/ui-redesign/M5_WORKSHOP_REVIEW_FIGMA_PLAN.md`
- `docs/design/ui-redesign/FIGMA_TO_IMPLEMENTATION_WORKFLOW.md`
- `apps/web/src/features/review/ReviewWorkspace.tsx`
- `apps/web/src/features/workshop/WorkshopWorkspace.tsx`
- `apps/web/src/app/workspaces.ts`
- `apps/web/src/ui/*`

## Correction To Earlier Assessment

The earlier "only Cover exists" assessment was wrong.

The mistake was using top-level metadata as if it were authoritative after the Figma pages reported `childCount: 0`. Loading pages through `use_figma` showed the full file structure. For this file, page existence and child counts from a single metadata pass are not enough. The usable process is:

1. Inspect pages.
2. Load each target page through `use_figma`.
3. Inspect frame children and semantic node names.
4. Use `get_design_context` for implementation candidate frames.
5. Compare against screenshots and project UI structure.

## Overall Verdict

The current Figma design is usable as the M5 UI source with constraints.

It is strongest for:

- M5.3 Review UI First.
- M5.5 Workshop message to Proposal deep links.
- M5.4 Workshop session/context layout direction.
- M5.7 routing, responsive, permission, and screenshot QA guidance.

It is not yet sufficient to directly implement full internal tool execution. The tool surfaces are good visual planning artifacts, but M5.6 must wait for Proposal v2, Review API, Tool Plan, Grant, and command adapter contracts.

The first implementation-ready UI scope remains Review, not the full Workshop.

## Current Project UI State

The current code still has placeholder shells for Workshop and Review:

- `apps/web/src/features/review/ReviewWorkspace.tsx`
- `apps/web/src/features/workshop/WorkshopWorkspace.tsx`

The app already has route/workspace entries for Workshop and Review in:

- `apps/web/src/app/workspaces.ts`

The shared UI layer exists and should be reused instead of copying the Figma-generated React/Tailwind output:

- `Badge.tsx`
- `Button.tsx`
- `EmptyState.tsx`
- `List.tsx`
- `NavButton.tsx`
- `Panel.tsx`
- `Tabs.tsx`
- `TextArea.tsx`
- `TextInput.tsx`
- `tokens.css`
- `ui.css`

Implementation should therefore translate the Figma layout into existing React/CSS conventions, not paste the absolute-positioned MCP reference code.

## Figma Frame Inventory

| Page | Frame ID | Role | M5 Slice | Acceptance IDs | Decision |
| --- | --- | --- | --- | --- | --- |
| `01 Foundations & Components` | `2:57` | Local UI kit: palette, buttons, badges, editor sample. | M5.0, all UI slices | M5-A01, M5-A17, M5-A24, M5-A43, M5-A44 | Use as visual language reference, but no published variables/styles were exposed by MCP. Map manually into project tokens. |
| `02 Workshop Main` | `12:2` | Workshop route with sessions, conversation, Proposal card, context basket, permissions. | M5.4, M5.5 | M5-A18 - M5-A29 | Usable after Review API and Proposal link contract exist. Do not implement before Review loop is reliable. |
| `03 Workshop Context & Plans` | `23:2` | Context basket, source selection, prompt preview, permissioned tool plan, partial failure recovery. | M5.4, M5.6 | M5-A19, M5-A20, M5-A30 - M5-A37 | Usable for flow design. Tool execution must remain gated by grants and command adapters. |
| `04 Codex Management Tools` | `28:2` | Category, detail type, entry, relation, evidence, and progression management. | M5.6 | M5-A30 - M5-A37 | Use only as permission-gated internal tool surface. Several controls must not imply direct writes without Proposal or Grant. |
| `05 Write Automation Tools` | `21:2` | Continuous manuscript editor with tool tray and pending Proposal marker. | M5.0, M5.6 | M5-A01, M5-A30 - M5-A37 | Important because it rejects the bad block-editor direction. Must preserve continuous prose editing. |
| `06 Review Inbox` | `14:2` | Proposal queue, selected diff, evidence, impact, decision controls. | M5.3 | M5-A13 - M5-A17 | Implementation-ready after M5.1/M5.2 contracts and APIs. This should be the first UI implementation frame. |
| `07 Review Proposal Detail` | `17:2` | Exact Proposal detail route with source, evidence, diff tabs, impact, and decision panel. | M5.3, M5.5 | M5-A14 - M5-A17, M5-A26 - M5-A29 | Implementation-ready after M5.1/M5.2. Required for Workshop deep links. |
| `08 States & Permissions` | `37:2` | Permission gates, proposal states, recovery paths, destructive action confirmation patterns. | M5.6, M5.7 | M5-A30 - M5-A45 | Use as a state library and QA reference, not as a standalone product route. |
| `09 Responsive & Flow Map` | `39:2` | Desktop baseline, narrow-state behavior, no block editor, deep-link flow. | M5.7 | M5-A43 - M5-A45 | Use as responsive QA reference. It explicitly supports desktop-first behavior. |
| `10 Entry Points & Routing` | `42:3` | Route contract and entry map. | All M5 UI slices | M5-A14, M5-A26, M5-A27, M5-A29, M5-A43 | Use as the information architecture contract. It answers where Workshop and Review pages enter the product. |

## Route And Entry Review

The Figma routing page defines these stable user destinations:

| Route | Figma source | Product role |
| --- | --- | --- |
| `/workshop` | `42:3`, `12:2` | Main Workshop route from the sidebar. |
| `/review` | `42:3`, `14:2` | Review Inbox route from the sidebar. |
| `/review/proposals/:id` | `42:3`, `17:2` | Exact Proposal detail route from AI chat cards, inbox rows, and proposal buttons. |
| `/write` | `42:3`, `21:2` | Existing Write editor route with automation tray entry. |
| `/codex` | `42:3`, `28:2` | Existing Codex route with gated management tool entry. |
| `/settings` | `42:3` | Existing settings entry. |

This resolves the previous design gap about "where all these pages enter from." Workshop and Review are top-level sidebar destinations. Proposal Detail is not a sidebar destination; it is a deep link from Workshop cards, Review rows, and AI messages.

## Review UI Assessment

`06 Review Inbox` and `07 Review Proposal Detail` are the strongest pages in the file.

Strengths:

- The Review Inbox has a concrete queue, selected Proposal panel, diff preview, evidence panel, impact/checks panel, batch actions, and source links.
- The Proposal Detail page has the correct exact route concept: `Proposal P-1042` as a detail page, not a generic modal.
- Source traceability is visible: Workshop source message, evidence cards, diff, impact scan, and audit access are all represented.
- The flow supports accept, edit-and-accept, reject, mark stale, rebase, and unavailable-source recovery concepts.
- The main path is mostly author-facing and operational.

Implementation constraints:

- Counts such as `12 pending` must be backed by real Proposal data. No fake counts.
- Actions must call real APIs. Buttons must be disabled, hidden, or show unavailable states until M5.2 APIs exist.
- Engineering fields such as `base v18` and `proposal hash` should not be prominent on the main path. They belong in an audit tab, details drawer, or debug view.
- Duplicate accept controls must be modeled as aliases to the same state transition. They cannot diverge by panel.
- Batch Review cannot ship before batch preview and partial failure semantics are implemented.

Conclusion:

Review is suitable as the first implementation target once Proposal v2 contracts, JSON storage, stale checks, and Review APIs exist.

## Workshop UI Assessment

The Workshop pages are directionally usable and align better with the product than the earlier block-editor-like screen.

Strengths:

- Workshop is treated as a workbench for sessions, messages, context, Proposal creation, and permissioned plans.
- Proposal cards deep-link to exact Review Proposal details.
- Context basket, pinned sources, excluded sources, and permission states are represented.
- Workshop message output is not treated as an automatic authority write.
- The Write integration preserves a continuous prose editor and uses pending Proposal markers.

Implementation constraints:

- Workshop must not be implemented before the Review loop can accept, reject, stale-check, and apply real Proposals.
- Workshop message persistence and context preview must be real JSON authority records, not in-memory chat state.
- The "tool plan" areas must not execute authority writes until M5.6 grants and command adapters exist.
- Any AI output that mutates manuscript or Codex data must create a Proposal or require an explicit user Grant.
- Source selection must enforce future-story isolation and detail-level permissions.

Conclusion:

Workshop can be integrated after M5.3 Review UI and M5.2 Proposal/Review API. The design should not be used to justify implementing a broad chat dashboard first.

## Codex And Write Tool Assessment

The Codex and Write tool surfaces cover the user-requested goal: with permission, Workshop can manage Codex categories, details, entries, relations, progressions, and Write operations.

However, the UI currently includes labels that can be misread as direct mutation:

- `Create Category`
- `New`
- `Rename`
- `Merge`
- `Delete Category`
- `Create Proposal`
- `Edit`
- `Del`
- `Add Detail Type`
- `Add Relation`
- `Remove`
- `Save Draft`
- `Queue Proposal`
- `Create Progression`
- `Use`
- `Confirm Delete`

Required interpretation:

- Low-risk commands may be proposed but still require the correct Grant.
- Authority writes must go through the same command adapter layer used by accepted Proposals.
- Dangerous actions require exact target preview, impact summary, explicit confirmation, and cannot be covered by broad session grants.
- If a tool cannot safely execute, it must convert to a Proposal with source, reason, evidence, and target revisions.

Conclusion:

These pages are useful for M5.6 design, but not implementation-ready until the Tool Plan and Grant contract exists.

## State And Permission Assessment

`08 States & Permissions` is valuable as a state catalog.

It covers:

- scoped Codex edit permission;
- Write automation consent;
- source use boundaries;
- permission request modal;
- proposal states;
- stale/rebase/recovery paths;
- rollback visibility;
- destructive action confirmation.

Required implementation behavior:

- Grants must be scoped, expiring, and tied to exact plan/target revisions.
- Expired, mismatched, or stale grants must fail closed.
- The UI must separate Proposal states from Tool Plan/Grant states.
- Unavailable sources and archived Proposals must produce recoverable states, not dead links.
- Conflict is not a durable M5 Proposal state unless the contract is explicitly changed; it is an application or batch-preview result.

Conclusion:

Use this page as the state checklist during implementation and QA.

## Responsive And Screenshot QA Assessment

`09 Responsive & Flow Map` and `10 Entry Points & Routing` make the design safer to implement.

Positive signals:

- The design is desktop-first and does not fake a mobile editor.
- It explicitly states `no block editor`.
- It keeps Workshop and Review in the same app shell.
- It defines Review deep links as first-class navigation.
- It treats non-route surfaces as internal states or panels, avoiding orphan pages.

Screenshot policy:

- During implementation, each page should keep only the final accepted screenshot for that page.
- Failed intermediate screenshots should stay in scratch space or be deleted after the final page screenshot is selected.
- Command-level screenshot QA and user visual acceptance must be tracked separately.

Conclusion:

The responsive and route pages are sufficient for M5.7 planning. They do not prove implementation acceptance by themselves.

## Visual Alignment With Current Product

The Figma design aligns with the current product direction in these ways:

- Shared left project panel.
- Shared command bar.
- Quiet, dense workspace layout.
- 6px to 8px radius panels and controls.
- Off-white paper/panel palette with restrained blue, green, amber, and red state colors.
- Operational workspace design instead of marketing UI.
- Continuous Write editor direction instead of block-card text editing.

Main caveat:

- MCP exposed no Figma variables or published styles for the local UI kit. The implementation must manually map Figma colors, spacing, typography, and component states into `tokens.css`, `ui.css`, and existing shared components.

## Required Fixes Before Implementation

| ID | Problem | Impact | Required handling |
| --- | --- | --- | --- |
| FUI-01 | Earlier MCP review method was insufficient. | False conclusion that only Cover existed. | Always load target pages through `use_figma` and use `get_design_context` for implementation frames. |
| FUI-02 | No published Figma variables/styles were exposed by MCP. | Screenshot-to-code drift risk. | Create a manual token/component mapping before coding each page. |
| FUI-03 | Some Workshop/Codex/Write controls look like direct writes. | Could bypass Proposal/Grant rules. | Gate every authority-changing action through Proposal, Grant, or explicit user operation. |
| FUI-04 | Review exposes audit fields on main panels. | Violates author-facing UI constraint if copied directly. | Move `base v18`, `proposal hash`, source hashes, and internal revisions into audit/detail surfaces. |
| FUI-05 | Duplicate accept controls appear in multiple areas. | Risk of inconsistent behavior. | Bind all accept controls to one transition and one eligibility model. |
| FUI-06 | Batch Review is visible before batch semantics exist. | Could imply unsupported partial failure behavior. | Implement only after M5-A11, M5-A12, and M5-A41 are real. |
| FUI-07 | Tool plan approvals include broad-looking controls such as session approval. | Risk of overbroad grants. | Grants must be scoped by tool, target, revision, operation, and expiry. |
| FUI-08 | Destructive Codex actions are visible. | Risk of unsafe category/detail deletion. | Require impact preview, reference checks, exact confirmation, snapshot/rollback path, and audit. |
| FUI-09 | Local file/import context appears in design. | Security and data-boundary risk. | Treat import as a separate permissioned source boundary and defer if not covered by the slice. |
| FUI-10 | Large panels rely on visual overflow assumptions. | Implementation may clip long queues, diffs, and evidence. | Define scroll regions and empty/error/loading states in code before visual acceptance. |
| FUI-11 | Workshop can look broad enough to tempt implementation before Review. | M5 sequencing risk. | Implement Review first, then Workshop context and source links, then tool plans. |
| FUI-12 | Screenshots alone cannot preserve behavior. | Static-copy implementation risk. | Use node IDs, design context, component mapping, route contracts, API/control mapping, and visual QA. |

## Recommended Integration Order

1. M5.0: protect current Write, Codex, Settings, AI provider, context, and JSON authority behavior.
2. M5.1: upgrade the existing Proposal contract and state machine.
3. M5.2: implement Proposal JSON storage, Review APIs, stale checks, snapshots, and batch preview behavior.
4. M5.3: implement Review UI from `14:2` and `17:2`.
5. M5.4: implement Workshop sessions, messages, context basket, context preview, and single-role call from `12:2` and `23:2`.
6. M5.5: implement Workshop message to Proposal creation, exact `/review/proposals/:id` deep link, Review source return, and status sync.
7. M5.6: implement Tool Plan, Grant, command adapters, Codex tools, Write tools, dangerous action confirmation, and Proposal fallback from `23:2`, `28:2`, `21:2`, and `37:2`.
8. M5.7: implement Council, batch/failure/conflict recovery, responsive states, final screenshots, and user visual acceptance from `37:2`, `39:2`, and `42:3`.

## Per-Frame Implementation Intake Checklist

Before coding any Figma-backed page, collect:

- frame ID;
- latest screenshot;
- `get_design_context` output;
- semantic node list from `get_metadata` or `use_figma`;
- route and entry point;
- feature owner file under `apps/web/src/features/*`;
- shared components to reuse from `apps/web/src/ui`;
- API endpoint or command adapter for each control;
- accepted M5 acceptance IDs;
- loading, empty, unavailable, stale, failed, blocked, and permission-denied states;
- screenshot QA target and final screenshot file policy.

## Implementation Readiness By Slice

| Slice | Figma readiness | Implementation readiness |
| --- | --- | --- |
| M5.0 | Ready as regression reference. | Requires current feature protection tests first. |
| M5.1 | UI not primary. | Contract work required before Review/Workshop UI can be real. |
| M5.2 | UI not primary. | Storage/API work required before Review actions can be real. |
| M5.3 | Ready: `14:2`, `17:2`. | Ready after M5.1/M5.2. Start here for UI. |
| M5.4 | Directionally ready: `12:2`, `23:2`. | Ready after Review route and source/proposal data contracts exist. |
| M5.5 | Ready in routing/detail design: `12:2`, `17:2`, `42:3`. | Requires exact Proposal IDs and source message links. |
| M5.6 | Design present but contract-dependent. | Not ready until Tool Plan, Grant, and command adapters exist. |
| M5.7 | Ready as QA/state reference. | Depends on prior slices and user visual acceptance. |

## Final Decision

Use the current Figma file as the M5 UI design source, but do not implement it as a screenshot clone.

The correct first UI implementation target is:

```text
Proposal storage/API
  -> Review Inbox
  -> exact Review Proposal Detail
  -> Review decision actions
  -> Workshop Proposal deep links
```

Workshop, Codex tools, and Write tools should follow only after the Proposal/Review loop is real. This preserves the product rule that AI and tool outputs can assist the author but cannot silently mutate JSON authority data.
