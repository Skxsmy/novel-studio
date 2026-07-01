# M5 Acceptance Record

Status: M5.0 current feature protection lock in progress; later M5 slices not started
Created: 2026-06-30  
Task: `docs/tasks/M5.md`

## Scope

This record will verify M5 Workshop, Proposal, and Review work.

Project Recovery is accepted for the current stage by user decision on 2026-06-30. That acceptance is the baseline before M5 and is not M5 implementation evidence.

Command/browser checks do not equal user visual acceptance. Figma acceptance does not equal implementation acceptance. User visual acceptance remains a separate explicit gate.

## Acceptance IDs

| ID | Status | Evidence |
| --- | --- | --- |
| M5-A01 | in progress | M5.0 started on 2026-07-01. Protection mapping and focused commands are pending for current Write, Codex, Settings, AI provider, context, and JSON authority behavior. |
| M5-A02 | not started | Proposal v2 extends the existing Proposal contract and does not introduce a parallel Proposal model. |
| M5-A03 | not started | Proposal type/source/generator/target/decision schemas support AI, manual, tool, and import origins. |
| M5-A04 | not started | Proposal state transitions enforce pending, accepted, rejected, edited, stale, superseded, and archived semantics. |
| M5-A05 | not started | Proposal JSON storage round trips valid records and isolates corrupted records from the rest of the inbox. |
| M5-A06 | not started | Duplicate Proposal IDs are rejected or quarantined with diagnostics. |
| M5-A07 | not started | Missing source message/model/context references produce recoverable unavailable states. |
| M5-A08 | not started | Stale base revisions cannot be accepted. |
| M5-A09 | not started | Accept creates a snapshot before mutating authority data. |
| M5-A10 | not started | Edit-and-accept preserves the original candidate and stores the edited result. |
| M5-A11 | not started | Batch preview excludes stale/conflicted items and explains why. |
| M5-A12 | not started | Batch accept reports completed, skipped, failed, and blocked items if any step fails. |
| M5-A13 | not started | Review Inbox lists real Proposal data with filtering and no fake counts. |
| M5-A14 | not started | Review Proposal Detail opens by exact Proposal ID. |
| M5-A15 | not started | Review accept/reject/edit/stale actions call real APIs and update state. |
| M5-A16 | not started | Review main path hides engineering audit fields while keeping details reachable. |
| M5-A17 | not started | Review visual implementation passes Figma-based screenshot QA, with user visual acceptance tracked separately. |
| M5-A18 | not started | Workshop sessions and messages persist as schema-versioned JSON and reload after restart. |
| M5-A19 | not started | Workshop Context Basket can add/remove/pin/unpin allowed context references. |
| M5-A20 | not started | Context preview shows included/excluded items and respects permissions, future-story isolation, and per-detail switches. |
| M5-A21 | not started | Single-role Workshop call creates ContextBundle and ModelCallLog. |
| M5-A22 | not started | Model failure preserves the input and context and does not create an empty Proposal. |
| M5-A23 | not started | Workshop message UI remains author-facing and does not expose main-path audit fields. |
| M5-A24 | not started | Workshop visual implementation passes Figma-based screenshot QA, with user visual acceptance tracked separately. |
| M5-A25 | not started | Workshop message output can create a Proposal linked to that exact source message. |
| M5-A26 | not started | Proposal cards deep-link to exact Review Proposal Detail. |
| M5-A27 | not started | Review Detail links back to the source Workshop message. |
| M5-A28 | not started | Workshop Proposal cards reflect accepted, rejected, edited, stale, superseded, and unavailable states. |
| M5-A29 | not started | Archived/unavailable Proposal links show recoverable unavailable states instead of dead navigation. |
| M5-A30 | not started | Tool Plans are durable JSON records and cannot execute without a valid Grant. |
| M5-A31 | not started | Expired or mismatched Grants cannot execute tools. |
| M5-A32 | not started | Unauthorized tools cannot write authority data. |
| M5-A33 | not started | Tool adapters call existing domain/storage commands instead of direct file writes. |
| M5-A34 | not started | Dangerous actions require explicit confirmation and cannot be covered by broad low-risk grants. |
| M5-A35 | not started | Tool execution validates target revisions and refuses stale writes. |
| M5-A36 | not started | Tool partial failure reports completed, skipped, failed, and blocked steps. |
| M5-A37 | not started | Tool Plan conversion to Proposal preserves source, reason, evidence, and target revisions. |
| M5-A38 | not started | Council first-round role calls are independent and do not receive other roles' outputs. |
| M5-A39 | not started | Council summary cites first-round outputs and does not introduce unchecked new conclusions. |
| M5-A40 | not started | Council and Workshop context do not leak future Codex Progression, future scene text, or hidden sections. |
| M5-A41 | not started | Batch accept applies only eligible Proposals and preserves skipped/failed diagnostics. |
| M5-A42 | not started | Conflict and stale states are recoverable and do not silently merge. |
| M5-A43 | not started | Narrow/responsive states follow accepted Figma behavior and do not fake a mobile editor if desktop space is required. |
| M5-A44 | not started | Final screenshots are managed so each page keeps only the final accepted screenshot. |
| M5-A45 | not started | M5 is not marked complete until command tests pass and user visual acceptance is explicitly recorded. |

## Slice Exit Map

| Slice | Exit requirement | Acceptance IDs |
| --- | --- | --- |
| M5.0 Current Feature Protection Lock | Current Write/Codex/Settings/AI regressions are mapped and passing before M5 changes. | M5-A01 |
| M5.1 Proposal v2 Contract And State Machine | Existing Proposal contract is upgraded; state machine and generator/source/decision schemas are tested. | M5-A02 - M5-A04 |
| M5.2 Proposal/Review Storage And API | Seeded Proposals can be stored, read, stale-checked, accepted, rejected, edited, archived, and batch-previewed. | M5-A05 - M5-A12 |
| M5.3 Review UI First | Review Inbox and Proposal Detail use real Proposal APIs and accepted Figma design. | M5-A13 - M5-A17 |
| M5.4 Workshop Sessions, Context Basket, And Single-Role Call | Workshop persists sessions/messages, previews context, and runs single-role calls without authority mutation. | M5-A18 - M5-A24 |
| M5.5 Workshop Message To Proposal Deep Link | Workshop messages create Proposals, deep-link to Review detail, and receive status updates. | M5-A25 - M5-A29 |
| M5.6 Tool Plan, Grant, And Command Adapter | Approved Tool Plans execute only through validated command adapters or convert to Proposals. | M5-A30 - M5-A37 |
| M5.7 Council, Batch, Conflict/Failure, Responsive, And Final Visual Acceptance | Council, batch, failure/conflict states, responsive states, and final visual acceptance are complete. | M5-A38 - M5-A45 |

## Required Commands

At minimum before declaring M5 implementation complete:

```powershell
npm.cmd run build -w @novel-studio/contracts
npm.cmd run test -w @novel-studio/storage -- repository.test.ts
npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx
npm.cmd run build
npm.cmd run test
git diff --check
```

Visual slices must also produce browser/Playwright screenshots against accepted Figma baselines. Screenshot checks are evidence, not user visual acceptance.

## Results

M5 formally started on 2026-07-01 at M5.0 Current Feature Protection Lock after commit `46e5a7c` added the MCP-backed Figma UI review and reading-path links.

No M5 implementation commands have been run yet in this startup record. M5.0 still needs the protection mapping and focused regression command results before M5-A01 can pass.

## M5.0 Startup Protection Mapping

| Protected behavior | Existing or planned verification |
| --- | --- |
| Current Write app shell, continuous manuscript editor entry, Focus behavior, and no return to repeated block-card/textarea editing. | Existing web tests to run: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`; existing editor mapping tests to include if touched: `npm.cmd run test -w @novel-studio/web -- sceneBlockMapping.test.ts`. |
| Codex Canon/Detail editing, mentions, previews, bounded editor behavior, and shared editor surface behavior. | Existing web tests to run: `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx`; existing server/storage Codex coverage below must remain passing. |
| SceneBlockDocument JSON authority, Markdown projection/export boundary, scene progression-block commands, unified Progression JSON authority, and no stale YAML/Markdown runtime authority path. | Existing storage tests to run: `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts`; existing server tests to run: `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts`. |
| Context Builder and Codex context preview preserve future-story and future-progression isolation. | Existing server tests to run: `npm.cmd run test -w @novel-studio/server -- context-routes.test.ts model-calls.test.ts`; existing storage coverage in `repository.test.ts` and `smoke.test.ts` should be considered for focused runs. |
| Settings and AI provider behavior does not silently fall back across provider or local/cloud boundaries. | Existing server tests to run: `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts model-calls.test.ts`; existing AI tests to run if provider registry changes: `npm.cmd run test -w @novel-studio/ai`. |
| Whole-workspace contract and build health before M5 contract/UI changes. | Required before M5.0 exit: `npm.cmd run build -w @novel-studio/contracts`, `npm.cmd run build`, `npm.cmd run test`, and `git diff --check`. |
