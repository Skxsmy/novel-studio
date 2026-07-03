# M5 Contract-Informed Figma Plan

Status: design companion, not implementation evidence  
Created: 2026-06-30  
Related task: `docs/tasks/M5.md`  
Figma UI review: `docs/design/ui-redesign/M5_FIGMA_UI_REVIEW.md`  
Implementation workflow: `docs/design/ui-redesign/FIGMA_TO_IMPLEMENTATION_WORKFLOW.md`  
Current Figma file: https://www.figma.com/design/CXclN6W9I7YfDOxUKxmKFP

2026-07-03 availability note: the previously recorded Workshop node `12:2` was unavailable through Figma MCP during the Workshop chat-layout repair, and the file currently exposed only `00 Cover`. Treat the page list and screenshots below as historical planning evidence, not current implementation-ready node evidence, until the Figma file is restored or a new accepted node-specific source is recorded.

## Purpose

This file defines how Figma should be used for M5 Workshop, Proposal, and Review.

Figma remains mandatory before implementation, but it must be contract-informed. The design cannot be accepted as a set of static pages or a button inventory. It must prove that the user can move through the Proposal/Review loop and recover from stale, conflict, failure, and permission states.

## Baseline Assumption

M5 planning starts after `NS-410` post-Slice 11 audit repair is command-verified and Project Recovery is accepted for the current stage by user decision on 2026-06-30.

That accepted recovery baseline must be preserved. It is not evidence that M5 Workshop, Proposal, Review, Tool Plan, or Council UI has been implemented or accepted.

The design must not imply any rollback of current NS-410 behavior:

- continuous Write manuscript editor;
- Codex progression insertion inside the top Insert menu;
- default-collapsed, draggable, resizable inline Codex progression components;
- scene-level atomic progression create/delete commands;
- Codex Details, Relations, Mentions, and Progressions;
- background autosave for Write/Codex editing;
- bounded Codex Canon and Detail editors;
- JSON authority for scene manuscripts, Codex, Progressions, knowledge, planning, sections, review anchors, and M4 AI/prompt files.

## Design Strategy

M5 design is not:

- a giant Workshop dashboard first;
- a list of every possible button;
- a standalone set of attractive panels detached from the current app shell;
- a screenshot-only implementation source.

M5 design is:

- Proposal/Review-first;
- object and state driven;
- aligned with the current Novel Studio shell, tokens, panels, pills, buttons, and editor grammar;
- explicit about route entry points and return paths;
- ready for Figma metadata/design-context extraction, not just visual copying.

## Required Object Model In Figma

The Figma design must visually account for these objects:

- `WorkshopSession`
- `WorkshopMessage`
- `WorkshopContextBasket`
- `WorkshopContextItemRef`
- `Proposal`
- `ProposalPatch`
- `ProposalEvidence`
- `ProposalDecision`
- `ReviewBatchPreview`
- `WorkshopToolPlan`
- `WorkshopToolGrant`
- `WorkshopToolCall`
- `WorkshopToolResult`

The design must distinguish:

- Proposal as the durable change record;
- Review as the decision workspace;
- Workshop as one Proposal source;
- Tool Plans as explicit permission-gated internal command plans;
- Audit details as secondary detail views, not main-path UI.

## Required Proposal State Design

Persistent states:

- `pending`
- `accepted`
- `rejected`
- `edited`
- `stale`
- `superseded`
- `archived`

Transient application/batch results:

- conflict
- blocked
- partial failure
- missing source
- permission denied
- expired grant

The Figma design must show recoverable next steps for each transient result.

## Product Routes And Entry Points

| Surface | Route / placement | Entry source |
| --- | --- | --- |
| Workshop Home | `/workshop` | Left navigation Workshop |
| Review Inbox | `/review` | Left navigation Review and `Open Review` |
| Review Proposal Detail | `/review/proposals/:proposalId` | Proposal card, Review row, AI chat link |
| Write Editor | `/write` | Left navigation Write and accepted text return target |
| Codex Workspace | `/codex` | Left navigation Codex and accepted Codex return target |
| Context and Plans | Inside Workshop | Basket/source/plan controls |
| Write Tool Surface | Inside Workshop or Write | Permission-gated tool result |
| Codex Tool Surface | Inside Workshop or Codex | Permission-gated tool result |
| Permission and error states | Modal/drawer/banner/state card | Triggered by parent route |
| Flow maps | Design artifact only | Not a product route |

No designed page may be left without an entry source and return target.

## Required Figma Pages

The current Figma file already contains M5-oriented pages. Before implementation, the accepted Figma set should include at minimum:

1. `02 Workshop Main`
2. `03 Workshop Context & Plans`
3. `04 Codex Management Tools`
4. `05 Write Automation Tools`
5. `06 Review Inbox`
6. `07 Review Proposal Detail`
7. `08 States & Permissions`
8. `09 Responsive & Flow Map`
9. `10 Entry Points & Routing`

Additional component/foundation pages are useful, but they are not product routes.

## User-Task Acceptance In Figma

Figma acceptance must walk through user tasks:

1. The author opens Workshop from the app shell.
2. The author selects or previews context through the Context Basket.
3. The author can see what the role is allowed to read and what is excluded.
4. A Workshop message produces a Proposal card.
5. The Proposal card opens the exact Review Proposal Detail.
6. Review shows target, diff, evidence, reason, risk, decision controls, and source link.
7. The author accepts, rejects, edits, or marks stale.
8. Review links back to the source Workshop message.
9. Workshop reflects the updated Proposal state.
10. A stale/conflict/failure/permission-denied state gives a recoverable next step.
11. Codex and Write tool actions are visually gated by Proposal or explicit Grant.

Button presence alone is not sufficient acceptance.

## Visual Requirements

- Use the current project shell: sidebar, command bar, page head, panel, list, pill, and button language.
- Do not make Workshop/Review look like unrelated dashboards.
- Do not add tutorial cards or long explanatory UI copy.
- Keep engineering/audit fields out of the main author path.
- Keep audit details available through secondary detail affordances.
- Use bounded internal scrolling for long lists or details.
- Keep text inside buttons and pills fully visible.
- Preserve one Figma structure checklist per implemented page. Agent-owned screenshot acceptance is prohibited.

## Visual Evidence

Historical temporary screenshot directory:

```text
D:\tmp\novel-studio-figma-screenshots
```

Historical Figma reference screenshots include:

- `02-workshop-main.png`
- `03-workshop-context-plans.png`
- `04-codex-management-tools.png`
- `05-write-continuous-editor.png`
- `06-review-inbox.png`
- `07-review-proposal-detail.png`
- `08-states-permissions.png`
- `09-responsive-flow-map.png`
- `10-entry-points-routing.png`

These screenshots are historical Figma reference artifacts. They are not implementation evidence and not user visual acceptance unless the user explicitly accepts them. Agents must not use screenshot capture or screenshot comparison as their own UI acceptance gate.

## Implementation-Readiness Checklist

Before M5 implementation starts:

- Figma pages are accepted by the user for the target scope.
- The Proposal v2 object and state machine are reflected in Figma.
- Review Inbox and Proposal Detail are backed by the formal M5 route/entry contract.
- Workshop Proposal cards deep-link to exact Review details.
- Review details link back to source Workshop messages.
- Tool Plan and Grant states are visually distinct from Proposal states.
- Permission, stale, conflict, failure, missing source, and narrow states are present.
- Figma components have semantic names.
- Repeated UI uses reusable Figma components where possible.
- The design can be extracted with Figma MCP metadata/design context and mapped to project components.
- Figma structure checklists are kept page-scoped. User-requested visual artifacts, if any, are not agent-owned acceptance evidence.

## Relationship To Implementation

Implementation must follow `docs/tasks/M5.md`.

The first implementation-ready slice after Figma acceptance is not "all Workshop UI." It is the Proposal/Review vertical loop:

```text
seeded Proposal
  -> Review Inbox
  -> exact Review Proposal Detail
  -> accept/reject/edit/stale decision
  -> source/status update
```

Workshop implementation follows after this loop is reliable.
