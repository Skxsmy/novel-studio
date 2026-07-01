# M5 Acceptance Record

Status: M5.1-M5.4 command/function verified; M5.5 not started; user visual acceptance pending
Created: 2026-06-30  
Task: `docs/tasks/M5.md`

## Scope

This record will verify M5 Workshop, Proposal, and Review work.

Project Recovery is accepted for the current stage by user decision on 2026-06-30. That acceptance is the baseline before M5 and is not M5 implementation evidence.

Command checks do not equal user visual acceptance. Figma acceptance does not equal implementation acceptance. Agents must not perform screenshot-based UI acceptance for this project. User visual acceptance remains a separate explicit gate.

## Acceptance IDs

| ID | Status | Evidence |
| --- | --- | --- |
| M5-A01 | passed | Added targeted protection tests and ran focused/full verification on 2026-07-01. Current Write, Codex, Settings, AI provider, context, and JSON authority behavior is protected before M5.1 changes. |
| M5-A02 | passed | Proposal v2 extends the existing Proposal contract; no parallel Proposal model was introduced. Covered by contract tests. |
| M5-A03 | passed | Proposal type/source/generator/target/decision schemas cover AI, manual, tool, and import origins. Covered by contract tests. |
| M5-A04 | passed | Proposal state transitions enforce pending, accepted, rejected, edited, stale, superseded, and archived semantics. Covered by contract tests. |
| M5-A05 | passed | Proposal JSON storage round trips valid records and isolates corrupted records from the rest of the inbox. Covered by storage tests. |
| M5-A06 | passed | Duplicate Proposal IDs are rejected or quarantined with diagnostics. Covered by storage tests. |
| M5-A07 | passed | Missing source message/model/context references produce recoverable unavailable states. Covered by storage/server/UI tests. |
| M5-A08 | passed | Stale base revisions cannot be accepted. Covered by storage/server tests. |
| M5-A09 | passed | Accept creates a snapshot before mutating authority data. Covered by storage/server tests. |
| M5-A10 | passed | Edit-and-accept preserves the original candidate and stores the edited result. Covered by storage/server tests. |
| M5-A11 | passed | Batch preview excludes stale/conflicted items and explains why. Covered by storage/server tests. |
| M5-A12 | passed | Batch accept reports completed, skipped, failed, and blocked items if any step fails. Covered by contract/storage/server tests. |
| M5-A13 | passed | Review Inbox lists real Proposal data with filtering and no fake counts. Covered by web tests. |
| M5-A14 | passed | Review Proposal Detail opens by exact Proposal ID. Covered by web tests. |
| M5-A15 | passed | Review accept/reject/edit/stale actions call real APIs and update state. Covered by web/API tests. |
| M5-A16 | passed | Review main path hides engineering audit fields while keeping details reachable. Covered by web tests and source review. |
| M5-A17 | function passed; visual pending | Review implementation must be checked against the Figma structure checklist. Agent-owned screenshot acceptance is prohibited; user visual acceptance remains pending. |
| M5-A18 | passed | Workshop sessions and messages persist as schema-versioned JSON and reload after restart. Covered by storage/server/web tests. |
| M5-A19 | passed | Workshop Context Basket can add/remove/pin/unpin allowed context references. Covered by storage/server/web tests. |
| M5-A20 | passed | Context preview shows included/excluded items and respects permissions, future-story isolation, and per-detail switches. Covered by Workshop route/context tests. |
| M5-A21 | passed | Single-role Workshop call creates ContextBundle and ModelCallLog. Covered by server tests. |
| M5-A22 | passed | Model failure preserves the input and context and does not create an empty Proposal. Covered by server/web tests. |
| M5-A23 | passed | Workshop message UI remains author-facing and does not expose main-path audit fields. Covered by web tests and source review. |
| M5-A24 | function passed; visual pending | Workshop implementation must be checked against the Figma structure checklist. Agent-owned screenshot acceptance is prohibited; user visual acceptance remains pending. |
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
| M5-A44 | not started | User-requested visual artifacts, if any, are page-scoped and do not become agent-owned screenshot acceptance. |
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

Visual slices must not use agent-owned screenshot acceptance. They must use Figma structure checklists, component/data mapping, focused functional tests, and explicit user visual review.

## Results

M5 formally started on 2026-07-01 at M5.0 Current Feature Protection Lock after commit `46e5a7c` added the MCP-backed Figma UI review and reading-path links.

M5.0 added real regression coverage rather than relying only on pre-existing test counts:

- `apps/web/src/app/AppShell.test.tsx`: strengthened the honest Review/Workshop unavailable-shell test so M5 cannot expose Proposal action controls, `/review/proposals/` deep links, proposal API calls, or Workshop session API calls before the backing workflows exist.
- `packages/storage/test/repository.test.ts`: strengthened unified Progression coverage by creating a stale peer `.yaml` file and proving runtime listing still reads the JSON authority record.

One first run of `npm.cmd run test -w @novel-studio/storage -- repository.test.ts` failed because the new assertion used a mojibake literal instead of the created Progression summary. The source behavior was checked, the test assertion was corrected, and the command then passed.

Command results after the added protection tests:

- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: passed, 1 file / 46 tests.
- `npm.cmd run test -w @novel-studio/storage -- repository.test.ts`: passed after correcting the new assertion, 1 file / 57 tests.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx sceneBlockMapping.test.ts`: passed, 3 files / 59 tests.
- `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts smoke.test.ts`: passed, 3 files / 66 tests.
- `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts ai-routes.test.ts model-calls.test.ts`: passed, 4 files / 24 tests.
- `npm.cmd run test -w @novel-studio/ai`: passed, 1 file / 20 tests.
- `npm.cmd run build`: passed.
- `npm.cmd run test`: passed; server 5 files / 25 tests, web 3 files / 59 tests, AI 1 file / 20 tests, storage 4 files / 68 tests.
- `git diff --check`: passed with Windows line-ending warnings only.

M5.1-M5.4 implementation continued on 2026-07-01.

Implemented scope:

- M5.1 upgraded the existing Proposal contract and state machine in `packages/contracts/src/proposals.ts`; it did not create a parallel Proposal model.
- M5.2 added Proposal JSON storage, Review/proposal API routes, stale/decision behavior, snapshot creation, batch preview, and batch accept reporting.
- M5.3 replaced the unavailable Review shell with a real Proposal inbox/detail/decision UI backed by Proposal APIs.
- M5.4 added Workshop session/message/context-basket storage and APIs, Context Builder preview integration, and single-role call handling without authority mutation.

Important boundary:

- M5.5 is not implemented. Workshop messages do not yet create durable Proposal cards with exact source-message deep links and Review status sync.
- M5.6 is not implemented. Tool Plans, Grants, internal command adapters, Codex tools, and Write tools are not available.
- M5.7 is not implemented. Council, final responsive/state sweep, and final user visual acceptance are not complete.
- Agent-owned screenshot acceptance is now prohibited by `AGENTS.md`. Review and Workshop visual acceptance remains a user gate, not a command result.

Focused command results during M5.1-M5.4:

- `npm.cmd run test -w @novel-studio/contracts -- test/proposals.test.ts`: passed, 1 file / 6 tests.
- `npm.cmd run test -w @novel-studio/storage -- test/proposals.test.ts`: passed, 1 file / 3 tests.
- `npm.cmd run build:packages`: first sandboxed run hit EPERM while writing `packages/contracts/dist`; rerun with elevated permissions passed.
- `npm.cmd run test -w @novel-studio/server -- test/proposal-routes.test.ts`: passed, 1 file / 2 tests.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 47 tests after the Review/Workshop assertions were updated for real M5.3-M5.4 surfaces.

Full M5.4 close command results before documentation-only updates:

- `npm.cmd run build`: passed.
- `npm.cmd run test`: passed; server 7 files / 29 tests, web 3 files / 60 tests, AI 1 file / 20 tests, contracts 2 files / 9 tests, storage 6 files / 74 tests.
- `git diff --check`: passed with Windows line-ending warnings only.

## M5.0 Startup Protection Mapping

| Protected behavior | Existing or planned verification |
| --- | --- |
| Current Write app shell, continuous manuscript editor entry, Focus behavior, and no return to repeated block-card/textarea editing. | Existing web tests to run: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`; existing editor mapping tests to include if touched: `npm.cmd run test -w @novel-studio/web -- sceneBlockMapping.test.ts`. |
| Codex Canon/Detail editing, mentions, previews, bounded editor behavior, and shared editor surface behavior. | Existing web tests to run: `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx`; existing server/storage Codex coverage below must remain passing. |
| SceneBlockDocument JSON authority, Markdown projection/export boundary, scene progression-block commands, unified Progression JSON authority, and no stale YAML/Markdown runtime authority path. | Existing storage tests to run: `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts`; existing server tests to run: `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts`. |
| Context Builder and Codex context preview preserve future-story and future-progression isolation. | Existing server tests to run: `npm.cmd run test -w @novel-studio/server -- context-routes.test.ts model-calls.test.ts`; existing storage coverage in `repository.test.ts` and `smoke.test.ts` should be considered for focused runs. |
| Settings and AI provider behavior does not silently fall back across provider or local/cloud boundaries. | Existing server tests to run: `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts model-calls.test.ts`; existing AI tests to run if provider registry changes: `npm.cmd run test -w @novel-studio/ai`. |
| Whole-workspace contract and build health before M5 contract/UI changes. | Required before M5.0 exit: `npm.cmd run build -w @novel-studio/contracts`, `npm.cmd run build`, `npm.cmd run test`, and `git diff --check`. |
