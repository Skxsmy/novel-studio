# M5 Acceptance Record

Status: M5.1-M5.5 command/function verified with post-M5.5 Workshop chat/settings, message-attachment, context-delivery, UI-interaction, provider-reasoning, chat-layout, session-lifecycle, streaming-session-switch, session-export, shared-sidebar/floating-menu/conversation style, and Review diff-workspace repairs; M5.6A command/function verified; M5.6B next; user visual acceptance pending
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
| M5-A07 | passed | Missing source message/model/context references produce recoverable unavailable states. Covered by storage/server/UI tests, including missing workshop messages, missing context bundles, missing AI model calls, and mismatched model-call context bundles. |
| M5-A08 | passed | Stale base revisions cannot be accepted, and scene-content Proposal patches must carry base revisions. Covered by contract/storage/server tests. |
| M5-A09 | passed | Accept writes snapshot, scene authority, and Proposal status through one transaction before reindexing. Covered by storage/server tests. |
| M5-A10 | passed | Edit-and-accept preserves the original candidate and stores the edited result. Covered by storage/server tests. |
| M5-A11 | passed | Batch preview excludes stale/conflicted items, same-scene intra-batch conflicts, and explains why. Covered by storage/server tests. |
| M5-A12 | passed | Batch accept is bound to previewed Proposal revisions and reports completed, skipped, failed, and blocked items if any step fails. Covered by contract/storage/server/web tests. |
| M5-A13 | passed | Review pending queue lists real Proposal data and no fake counts; accepted/rejected/edited/stale Proposals are not kept in the pending working queue. Covered by web tests. |
| M5-A14 | passed | Review Proposal Detail opens by exact Proposal ID. Covered by web tests. |
| M5-A15 | passed | Review accept/reject/edit/stale actions call real APIs and update state. Review displays all patches before accepting, focuses the main path on before/after diff review, and keeps batch/impact dashboard controls out of the main review surface. Covered by web/API tests and source review. |
| M5-A16 | passed | Review main path hides engineering audit fields while keeping details reachable. Covered by web tests and source review. |
| M5-A17 | function passed; visual pending | Review implementation was reset to the Figma-aligned pending queue plus before/after workspace direction and checked by component/source review plus web tests. Agent-owned screenshot acceptance is prohibited; user visual acceptance remains pending. |
| M5-A18 | passed | Workshop sessions, messages, branches, and message attachments persist as schema-versioned JSON and reload after restart. Branch copies source message history through the branch point plus attachment snapshots into the new session instead of opening an empty chat. Unlinked messages can be deleted through storage/API/UI, while Proposal-linked messages remain protected. General Chat author-message resend updates the selected durable author message, truncates later unprotected General Chat history, deletes later message-bound attachments, and clears deleted-message branch records/pointers; Agent sessions and protected later records are rejected. Whole Workshop sessions can now be permanently deleted through the session route/UI when no message is Proposal-linked; deletion cascades messages, attachments, context baskets, and branch records, and blocks Proposal-linked sessions. Draft attachment reload/delete, message binding, branch cloning, message-delete cascade, resend truncation, and session-delete cascade/blocking are covered by storage/server/web tests. |
| M5-A19 | passed | Workshop selected context can add/remove/toggle allowed references through the compact composer menu, including full novel text, full outline, act, chapter, multiple scenes, direct Codex entries, and Codex grouped by type/detail/category. The internal storage object is still `WorkshopContextBasket`; the visible right-side basket panel has been removed. Covered by storage/server/web tests. |
| M5-A20 | passed | Context assembly shows included/excluded items and respects permissions, future-story isolation, auto-linked Codex policy, per-detail Send to AI switches, parsed `message-attachment` ContextBundle snapshots, and prior same-session `workshop-chat-history`. Attachments do not create SourceDocuments or retrieval index records. Covered by contract/server/storage tests and source review. |
| M5-A21 | passed | Single-role Workshop call creates ContextBundle and ModelCallLog from IDs rather than raw files, and provider request bodies receive ContextBundle item text. Workshop can choose a library-global model setting and send a provider model override for that call. Call input accepts `attachmentIds` plus `draftToken`, rejects raw file content, and rejects invalid attachment references. General Chat resend creates a new ContextBundle and ModelCallLog from the revised author message/history after truncating old forward history. Session export defaults to readable chat history without saved reasoning or prompt/context audit, reconstructs provider prompt/context records from persisted ContextBundle and ModelCallLog links only when `includePromptAudit=true`, includes saved reasoning only when `includeReasoning=true`, and omits extracted attachment body text while retaining attachment records. Workshop sessions are now created as fixed `chat` or `agent` conversations. Public Workshop message creation is author-only; `assistant`, `tool`, `system`, and `result` records are server-owned and are saved through internal call/tool-result paths. Agent calls use a server-side structured-step protocol: raw provider output is buffered, fake `Tool Call` text is suppressed from streaming, and only a valid structured Agent step can create a server-owned `role: tool` request message. Agent and General Chat provider-bound context filters prompt audit items (`role-instruction`, `prompt-template`, `user-request`) so the prompt and user request are not duplicated in the actual provider payload; saved ContextBundles may still retain those items for audit/export reconstruction. The limited `codex.create_entry` and `codex.update_entry` execution routes accept only structured JSON tool request messages from Agent sessions; plain assistant prose, fake `Tool Call` text, and plain `Codex Draft` text cannot execute. Detail-type matching still uses stable IDs or exact normalized names; unmatched draft labels first return `CODEX_DETAIL_TYPE_CREATION_REQUIRED` without writing entries, and a second confirmed request creates the missing detail types before writing the entry/update. Confirmed `codex.update_entry` tool messages can update one existing Codex entry and create/update/delete unified Codex Progression records through existing repository commands. This does not complete relation, category, character knowledge, broad Write mutation, durable multi-step Agent continuation, or general Tool Plan behavior. Covered by contract/server/storage/web tests and source review. |
| M5-A22 | passed | Model failure preserves the input, parsed attachments, bound author message, and context, then appends a failed assistant message instead of creating an empty Proposal. Covered by server/web tests and the storage binding invariants. |
| M5-A23 | passed | Workshop message UI remains author-facing and does not expose main-path audit fields. Mode/model controls remain centralized, while conversation kind is fixed at session creation through the New session menu (`Chat` or `Agent`) instead of a mutable mode selector. General Chat still exposes the editable system prompt and no Proposal/write actions. Successful General Chat author messages in chat sessions expose Edit/Resend through a message action menu; resending shows the revised author message and new assistant reply while removing old forward history and old attachment chips. Agent sessions do not show Edit/Resend controls in this slice. Session export is exposed as one session-level topbar More control with separate `Include reasoning` and `Include prompt audit` checkboxes, not as per-message actions. The downloaded Markdown defaults to visible chat history, can include saved reasoning only when the reasoning checkbox is enabled, and can include provider prompt/context audit only when the prompt-audit checkbox is enabled; attachment body text is omitted and represented only by attachment records. Exported Markdown includes UTF-8 BOM handling so local Windows tools do not show mojibake. Agent tool confirmation appears only for server-owned `role: tool` JSON messages such as `codex.create_entry` / `codex.update_entry`; it is not rendered under every assistant reply and is not triggered by scanning assistant prose. If draft Details do not match existing reusable detail types, the UI shows a confirmation surface listing the missing detail types that will be created and sends `createMissingDetailTypes: true` only after the author confirms. Reasoning is distinct and collapsible; Enter sends and Ctrl+Enter inserts a newline. The composer has one attachment icon, removable parse-state chips, send blocking for parsing/failed chips, and attachment names on sent user messages. New sessions use a neutral title, empty chats auto-name from the first request or attachment file names after sending starts, and authors can double-click session titles to persist manual renames. In-flight streamed replies stay attached to the session that started the call when authors switch sessions and return before completion. The 2026-07-09 workbench-shell repair keeps New/More session actions in the Workshop topbar, keeps the left thread dock as a dense list, renders author/assistant/tool messages in a broad left-accent flow, shortens the composer, uses a tabbed Story scope / Structure / Codex / Files context panel, and closes Context/New/More/message/settings floating surfaces on outside pointer or Escape without exposing audit fields or fake actions. Covered by web tests and source review. |
| M5-A24 | function passed; visual pending | Workshop implementation must be checked against the Figma structure checklist. The 2026-07-03 chat-layout repair could not use the previously recorded Figma Workshop node because `12:2` was unavailable and the Figma file exposed only `00 Cover`; this is recorded as a Figma evidence gap, not visual acceptance. The 2026-07-09 workbench-shell/conversation/context-panel style repair used `docs/design/ui-redesign/M5_WORKSHOP_UI_REDESIGN_REVIEW.html` as the concrete design reference, keeps Workshop on the shared collapsible app project sidebar instead of a Workshop-specific rail override, and keeps the Workshop page body as a full-height workbench with Workshop topbar, topbar New/More session actions, compact thread dock, active conversation header, broad message flow, message action menu, compact composer, and tabbed context panel. It was verified by source review, `ui-ux-pro-max-v3` design-system/UX/React guidance, focused Workshop tests, web build, and `git diff --check` only. Agent-owned screenshot acceptance is prohibited; user visual acceptance remains pending. |
| M5-A25 | passed | Workshop message output can create a Proposal linked to that exact source message. Proposal creation and message `proposalIds` update are written transactionally. Covered by storage/server/web tests. |
| M5-A26 | passed | Proposal cards deep-link to exact Review Proposal Detail by Proposal ID. Covered by web tests. |
| M5-A27 | passed | Review Detail links back to the source Workshop message. Covered by server/web tests. |
| M5-A28 | function passed; visual pending | Workshop Proposal cards read Proposal authority state and reflect accepted, rejected, edited, stale, superseded, and unavailable states. Covered by web state-sync tests and source review; user visual acceptance remains pending. |
| M5-A29 | passed | Archived/unavailable Proposal links and unavailable source-message returns show recoverable states instead of dead navigation. Covered by storage/server tests and Workshop/Review unavailable UI behavior. |
| M5-A30 | not started for Tool Plans; partial M5.6A evidence only | Tool Plans are durable JSON records and cannot execute without a valid Grant. M5.6A added execution identity for the current limited Agent Codex tool messages, but no Tool Plan/Grant storage exists yet. |
| M5-A31 | not started | Expired or mismatched Grants cannot execute tools. |
| M5-A32 | not started for Tool Plans; partial M5.6A evidence only | Unauthorized tools cannot write authority data. M5.6A still uses the current limited Agent tool routes, not a durable Grant validator. |
| M5-A33 | not started for command adapters; partial M5.6A evidence only | Tool adapters call existing domain/storage commands instead of direct file writes. M5.6A contains current execute routes but does not add atomic adapters. |
| M5-A34 | not started | Dangerous actions require explicit confirmation and cannot be covered by broad low-risk grants. |
| M5-A35 | not started | Tool execution validates target revisions and refuses stale writes. |
| M5-A36 | not started for Tool Plans; partial M5.6A evidence only | Tool partial failure reports completed, skipped, failed, and blocked steps. M5.6A records current limited tool execution status but does not implement full partial-failure reporting. |
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
| M5.4 Workshop Sessions, Context Selection, And Single-Role Call | Workshop persists sessions/messages, edits selected context through the compact menu backed by `WorkshopContextBasket`, assembles context through Context Builder, and runs single-role calls without authority mutation. | M5-A18 - M5-A24 |
| M5.5 Workshop Message To Proposal Deep Link | Workshop messages create Proposals, deep-link to Review detail, and receive status updates. | M5-A25 - M5-A29 |
| M5.6A Tool Execution Containment | Passed for the current limited Agent Codex tool path. Current Agent tool messages have durable execution identity, serialized single-process claim, concurrent/repeat-execute rejection, active-session precheck, running-execution lifecycle guards, terminal failure state, and no repeated authority writes. | Partial evidence for M5-A30 - M5-A36; does not pass Tool Plan/Grant IDs |
| M5.6B Atomic Codex Command Adapters | Per-series file transactions are serialized before limited Codex create/update tools move behind stale-safe, approval-bound, transactionally auditable adapters with Progression target/scene binding. | M5-A33 - M5-A37 |
| M5.6C Detail Schema Planner | Draft detail labels receive semantic mapping suggestions before any reusable detail type is created. | M5-A33, M5-A37 |
| M5.6D Durable Agent Runner | Agent steps, tool requests, confirmation pauses, result continuation, structured-output repair, and malformed-output handling are durable. | M5-A30 - M5-A37 |
| M5.6E Workshop Capability Cleanup | Branch, prompt scope, context kinds, legacy modes, deletion semantics, and module boundaries are reconciled with current product behavior. | M5-A18 - M5-A24, M5-A30 - M5-A37 |
| M5.6F Workshop Prompt Customization Foundation | Workshop-specific prompt records, versioned call logging, and future user-editable prompt surfaces are separated from global non-Workshop roles/templates. | M5-A21 - M5-A24, M5-A30 - M5-A37 |
| M5.6G Tool Plan, Grant, And Command Adapter Layer | The original M5.6 Tool Plan/Grant target is implemented after the existing Agent tool path is contained: durable plans, grants, tool calls, approved tool definitions, validated adapters, permission/result UI, Proposal fallback, stale-target refusal, and partial-failure reporting. | M5-A30 - M5-A37 |
| M5.7 Council, Batch, Conflict/Failure, Responsive, Copy, And Final Visual Acceptance | Council, batch, failure/conflict states, responsive/copy states, and final visual acceptance are complete. | M5-A38 - M5-A45 |

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

M5.1-M5.5 implementation continued on 2026-07-01.

Implemented scope:

- M5.1 upgraded the existing Proposal contract and state machine in `packages/contracts/src/proposals.ts`; it did not create a parallel Proposal model.
- M5.2 added Proposal JSON storage, Review/proposal API routes, stale/decision behavior, snapshot creation, batch preview, and batch accept reporting.
- M5.3 replaced the unavailable Review shell with a real Proposal inbox/detail/decision UI backed by Proposal APIs.
- M5.4 added Workshop session/message/context-basket storage and APIs, Context Builder preview integration, and single-role call handling without authority mutation.
- M5.5 added durable Workshop-message-to-Proposal creation, Workshop Proposal cards, exact Review Proposal Detail links, Review source-message return links, Proposal authority status sync back into Workshop cards, and recoverable source unavailable states for missing messages or archived source sessions.

Important boundary:

- M5.6 is replanned as M5.6A-G from the verified current-source audit while preserving the original Tool Plan/Grant target as M5.6G. The old M5.6 product invariants and acceptance IDs remain active unless explicitly marked replaced in `docs/tasks/M5.md`; the only replaced part is the old monolithic order that would build generic Tool Plan/Grant before containing the existing write-capable Agent Codex path. M5.6A contains current limited Agent Codex tool execution with request-hash execution records, serialized claims in the specified single local server process, concurrent/repeat-execute rejection, result-message links, terminal failure state, UI completion state, archived-session pre-write refusal, and running-execution archive/delete guards. Stale baselines, atomic command adapters, Progression binding, structured-output repair, prompt customization, durable Tool Plans/Grants, and broad Write/Codex adapters remain unfinished.
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

Focused command results during M5.5:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- workshop.test.ts`: passed, 1 file / 12 tests; legacy messages without `toolExecution`, valid running execution defaults, and malformed request hashes are covered.
- `npm.cmd run build -w @novel-studio/storage`: passed.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: first parallel run raced with the contracts build and saw the new schema as undefined; after the contracts build completed, passed, 1 file / 4 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: first run failed because server used stale storage dist; after `npm.cmd run build -w @novel-studio/storage`, passed, 1 file / 2 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: first run exposed an over-specific assertion for repeated Review text; after correcting the assertion, passed, 1 file / 47 tests.
- `npm.cmd run build -w @novel-studio/web`: first run exposed a test mock type narrowing issue; after typing the updated message record, passed.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run test -w @novel-studio/storage -- test/proposals.test.ts`: passed, 1 file / 3 tests.
- `npm.cmd run test -w @novel-studio/server -- test/proposal-routes.test.ts`: passed, 1 file / 2 tests.

Focused command results during post-M5.5 audit repair:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run build -w @novel-studio/storage`: passed.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- test/proposals.test.ts`: passed, 1 file / 7 tests.
- `npm.cmd run test -w @novel-studio/storage -- test/proposals.test.ts test/workshop.test.ts`: passed, 2 files / 8 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts test/proposal-routes.test.ts`: passed, 2 files / 4 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 49 tests.
- `git diff --check`: passed with Windows line-ending warnings only.

Post-M5.5 audit repair closed the retained local M5.1-M5.4 and M5.5 audit findings without advancing into M5.6:

- Review exposes stale marking through the real API, displays every Proposal patch before accept/edit, and the Proposal API reports batch accept completed/skipped/blocked/failed results. The later 2026-07-03 Review diff-workspace reset removes permanent batch controls from the main Review UI.
- Scene-content Proposal patches now require base revisions; batch preview/accept is bound to reviewed Proposal revisions and detects same-scene intra-batch conflicts.
- Proposal acceptance writes snapshot, target scene, and Proposal status through one file transaction before index refresh.
- Proposal source availability validates workshop-message, context-bundle, and AI model-call references.
- Workshop message-to-Proposal creation writes the Proposal and source message link through one transaction.
- Workshop context preview renders excluded items and reasons, and Workshop can add currently exposed Codex/Proposal-source context references.
- Workshop-created scene-content Proposals target the Workshop basket scene when present instead of blindly using the selected app scene.
- Review and Workshop feature CSS has been moved to feature-local stylesheets, leaving shared app shell layout rules in `app-shell.css`.
- Review non-pending Proposal details now render as read-only review records instead of showing edit textareas and disabled decision controls.
- Workshop can switch among saved library-global model settings, fetch provider model options for the chosen setting, and send the selected model as a call-scoped override without writing it back to Settings.

Focused command results during the 2026-07-01 Review/Workshop UI and model-selection repair:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts test/proposals.test.ts`: passed, 2 files / 10 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts test/proposal-routes.test.ts`: passed, 2 files / 4 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 51 tests.
- `git diff --check`: passed with Windows line-ending warnings only.

Focused command results during the 2026-07-01 Settings model-profile repair:

- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 51 tests.
- `npm.cmd run test -w @novel-studio/contracts -- test/ai.test.ts`: passed, 1 file / 1 test.
- `npm.cmd run test -w @novel-studio/storage -- test/ai-files.test.ts`: passed, 1 file / 2 tests.
- `npm.cmd run test -w @novel-studio/server -- test/ai-routes.test.ts test/context-routes.test.ts test/model-calls.test.ts test/workshop-routes.test.ts`: passed, 4 files / 15 tests.
- `npm.cmd run test -w @novel-studio/ai`: passed, 1 file / 20 tests.
- `npm.cmd run build -w @novel-studio/contracts`, `npm.cmd run build -w @novel-studio/storage`, `npm.cmd run build -w @novel-studio/ai`, `npm.cmd run build -w @novel-studio/server`, and `npm.cmd run build -w @novel-studio/web`: passed.
- Runtime/documentation searches for cloud/local policy strings and old series-scoped model-profile routes returned no matches.
- `npm.cmd run test:e2e`: failed during the rebuild step with a transient EPERM writing contracts dist files; `npm.cmd run build -w @novel-studio/contracts` passed immediately afterward. `npm.cmd run test:e2e:quick` then failed before the Settings path because `tests/e2e/browser-acceptance.spec.ts` still expects the old Chinese homepage heading `小说工作室`, while the current app shell exposes `Novel Studio` and `Library`.

The repair closed these Settings regressions:

- Model settings and service keys are library-global and shared by all projects.
- The obsolete deployment-policy surface is removed from runtime routes, contracts, UI, tests, and docs searched in this repair.
- Profile create/update payloads reject `credentialRef`; only the credential endpoint may save, replace, or delete a key.
- Save Setting preserves an existing key when the key input is empty and saves a newly typed key through the credential endpoint.
- Settings actions for key save, connection test, and model fetch are available without opening a project.
- Large fetched provider model lists are collapsed by default and render inside a bounded scroll list when opened.

Focused command results during the 2026-07-02 Workshop context selector and Codex detail Send to AI audit:

- `npm.cmd run test -w @novel-studio/server -- test/context-routes.test.ts`: passed, 1 file / 1 test. This test verifies per-detail `detailAiContext` filtering by omitting disabled detail text from the built context bundle.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 2 tests. This covers full-novel, full-outline, act, chapter, selected-scene context kinds and auto-linked Codex materialization while excluding `manual` and `never` Codex entries.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop context selection"`: passed, 1 file / 1 test, 52 skipped by filter. This covers the nested compact context menu, toggle behavior, grouped Codex entries, and linked Codex visibility.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 4 tests.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.

The 2026-07-02 repair closed these Workshop/Codex context gaps:

- The visible right-side Context Basket panel and separate Preview Context button are removed from Workshop.
- The composer context menu supports full novel text, full outline, acts, chapters, multiple scenes, direct Codex entries, entries by type, entries by detail type, and entries by category.
- Context menu selections are toggleable; selecting a menu branch alone does not mutate the basket.
- Full-novel, full-outline, act, chapter, and selected-scene scopes flow through contracts, storage validation, Workshop route mapping, and Context Builder item assembly.
- Selecting a story scope materializes policy-allowed Codex entries into the same internal basket with `note: "Linked from selected context."`; entries set to `manual` or `never` are not auto-linked.
- The Codex detail `Send to AI` checkbox is not decorative: it writes `detailAiContext`, and Context Builder filters disabled details from the actual context bundle.

Focused command results during the 2026-07-02 Workshop General Chat repair:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- Initial root-level focused test command was invalid because the same path filters were applied to unrelated workspaces and reported no matching files; workspace-relative reruns were used.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 3 tests.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 5 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 54 tests.
- `npm.cmd run build -w @novel-studio/web`: first exposed a General Chat system-prompt state typing issue; after fixing the source, passed. Same-turn UI corrections then moved the system prompt editor out of the permanent footer into a compact popover, moved Mode and Model controls to the Conversation header, and kept the footer focused on System Prompt plus Send. `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx` passed 54/54 again after each UI correction, and `npm.cmd run build -w @novel-studio/web` passed after each correction.

The repair closed these Workshop General Chat gaps:

- The author's submitted message appears in the chat stream immediately after Send instead of waiting for the AI reply.
- General Chat is the default mode and can use a user-edited system prompt.
- General Chat replies do not expose Create Proposal in the UI, and storage/API reject Proposal creation if called directly.
- Mode and Model controls are in the Conversation header, and the system prompt editor is not a cramped permanent footer textarea; it opens from a compact footer button into a larger popover editor.

Focused command results during the 2026-07-03 Workshop chat/settings repair:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed.
- `npm.cmd run build -w @novel-studio/storage`: passed.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed.
- `npm.cmd run build -w @novel-studio/ai`: passed.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts test/context-routes.test.ts`: passed.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 54 tests.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.

The 2026-07-03 repair closed these Workshop chat/settings gaps:

- Workshop sessions no longer bind a default scene; context is assembled from explicit user-selected context items.
- General Chat provider calls use the visible custom system prompt exactly, including an intentionally empty prompt, and remove role-instruction/prompt-template/user-request context items from the provider context bundle.
- General Chat can stream assistant output and splits `<think>`/`<thinking>` spans into `reasoningContent` instead of mixing them with visible answer text.
- Reasoning display is styled differently from answer text and can be expanded/collapsed per message, with a global default controlled in Workshop settings.
- Unlinked Workshop messages can be deleted, while Proposal-linked messages remain protected.
- The duplicate user-message regression was fixed by merging local optimistic IDs and server IDs into one message.
- Enter sends the composer message; Ctrl+Enter preserves newline insertion; IME composition Enter is not treated as Send.
- Mode, model setting, provider model override, system prompt, streaming, and reasoning-display controls are centralized in a settings dialog instead of scattered through header/footer controls.

Focused command results during the 2026-07-03 Workshop message-attachment slice:

- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 6 tests.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 8 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 6 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 4 selected tests, 50 skipped by filter.
- `npm.cmd run build`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.

The attachment slice closed these Workshop gaps:

- Workshop attachment contracts now support draft and message-bound attachment states. `RunWorkshopCallInput` and message creation inputs carry `attachmentIds` plus `draftToken`, not raw file contents.
- Server upload/list/delete attachment APIs parse `.txt`, `.md`, `.doc`, `.docx`, and text-extractable `.pdf` during upload. Text and Markdown attachments decode mainstream encodings such as UTF-8, UTF-16, GB18030/GBK, Big5, Shift_JIS, and Windows-1252 instead of requiring manual UTF-8 conversion. Damaged Word files, empty files, oversized files, binary disguised as text, and OCR-required PDFs fail or reject with explicit reasons.
- Storage persists parsed attachment JSON, reloads it, deletes draft attachments, binds parsed draft attachments to the created author message, rejects cross-session/wrong-draft/failed/already-bound references, and cascades unlinked message attachment deletion.
- Context Builder adds parsed attachments as `message-attachment` items with immutable extracted-text snapshots and `workshop-message-attachment` source type; attachments are not SourceDocuments and are not retrieval-index inputs.
- Workshop UI uses one composer attachment icon, parse-state chips, send blocking for parsing/failed chips, attachment names on sent user messages, draft removal deletion, and message-delete cleanup. Agent-owned screenshot acceptance was not run; user visual acceptance remains separate.

Focused command results during the 2026-07-03 Workshop context-delivery repair:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run build -w @novel-studio/ai`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 6 tests.
- `npm.cmd run test -w @novel-studio/ai -- test/mockProvider.test.ts`: passed, 1 file / 20 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed after rebuilding stale contracts/AI dist, 1 file / 7 tests.

The context-delivery repair closed these Workshop gaps:

- OpenAI-compatible provider requests now include ContextBundle item text in the actual chat-completions user message, instead of only using it for audit and token estimation.
- Workshop ContextBundle assembly now adds prior visible same-session messages as `workshop-chat-history`, excludes the just-created current author message, and includes extracted text from historical message-bound attachments so follow-up questions about an earlier upload retain file context.
- Provider-request regression tests assert that the first actual OpenAI-compatible request contains the current attachment text and the second actual request contains the previous author message, previous assistant reply, and previous attachment text. Model reasoning content is not fed back into chat history.

Focused command results during the 2026-07-03 Workshop UI interaction repair:

- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "attachment-only"`: passed, 1 file / 1 selected test, 54 skipped by filter.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "shows the author message"`: passed, 1 file / 1 selected test, 54 skipped by filter.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 5 selected tests, 50 skipped by filter.
- `npm.cmd run build`: initially failed because the optional `AbortSignal` field was passed as `undefined` under `exactOptionalPropertyTypes`; after conditionally adding `signal` only when present, rerun passed.
- `git diff --check`: passed with Windows line-ending warnings only.

The UI interaction repair closed these Workshop gaps:

- A parsed draft attachment alone can send a Workshop request. The frontend uses the explicit attachment-review request text, sends parsed `attachmentIds`, creates the author message, and binds the attachment without requiring redundant composer text.
- The composer attachment icon is a real button that invokes the hidden file input and is disabled during an in-flight call.
- Streamed and non-streamed Workshop calls pass `AbortSignal`; the Stop button aborts the active request/stream, preserves the author message and attachment chip on the sent message, and renders one stopped assistant state instead of duplicate stopped/error text.
- Collapsed reasoning now has a visible per-message state and an explicit expanded/collapsed toggle state; reasoning content remains visually separate from answer text.

Focused command results during the 2026-07-03 Workshop provider-reasoning repair:

- `npm.cmd run test -w @novel-studio/ai -- test/mockProvider.test.ts`: passed, 1 file / 21 tests.
- `npm.cmd run build -w @novel-studio/ai`: passed.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts -t "reasoning fields"`: passed, 1 selected test / 7 skipped.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 8 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 5 selected tests, 50 skipped by filter.
- `npm.cmd run build`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.

The provider-reasoning repair closed these Workshop gaps:

- Official DeepSeek `reasoning_content` streaming fields are normalized into Workshop `reasoning-delta` events and saved as `assistantMessage.reasoningContent`.
- Official OpenRouter `reasoning`, `reasoning_content`, and `reasoning_details` fields are preserved instead of being dropped by the OpenAI-compatible adapter.
- Official Ollama `thinking`-style chunks are preserved when returned through the compatible adapter.
- OpenAI reasoning that is only exposed through the Responses API is documented as a future explicit integration; this repair does not fabricate private reasoning on the current Chat Completions-compatible adapter path.
- Official source basis: DeepSeek reasoning model docs, OpenRouter reasoning token docs, Ollama thinking docs, and OpenAI reasoning model docs as checked on 2026-07-03.

Focused command results during the 2026-07-03 Workshop chat-layout repair:

- Figma MCP check: `get_design_context` for recorded node `12:2` failed because the node was unavailable; `get_metadata` for the file listed only top-level page `00 Cover`, and `get_metadata` for `0:1` showed only the cover frame. No screenshot-based acceptance was run or claimed.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop chat messages"`: the initial two runs failed because the new CSS regression test used a raw CSS import/helper that did not read the source selector reliably; after changing the test to read the CSS source through Node `fs`, rerun passed, 1 selected test / 55 skipped.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 6 selected tests, 50 skipped.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 56 tests.
- `npm.cmd run build`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.

The chat-layout repair closed these Workshop UI gaps:

- User/author messages are no longer right-aligned narrow bubbles capped at 52% width; all messages now use the available conversation column.
- Assistant and author messages stay in one reading flow and are distinguished by role metadata, restrained tint, and a small left accent.
- Message body text is increased to a readable author-workspace scale; reasoning text and collapsed reasoning state are also enlarged, with attachment chips spaced for scanning.
- A source-level web regression test guards the key CSS rules so the layout does not silently regress to left/right chat bubbles.

Focused command results during the 2026-07-03 Workshop session naming and Branch repair:

- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 7 tests.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 8 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts -t "branches"`: first run failed because server was reading stale `@novel-studio/contracts` dist with the old default title; after rebuilding contracts and storage, rerun passed, 1 selected test / 8 skipped.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop chats"`: passed, 2 selected tests / 56 skipped.
- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run build -w @novel-studio/storage`: passed.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 8 selected tests / 50 skipped.
- Final rerun after implementation and documentation updates:
  - `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 7 tests.
  - `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 8 tests.
  - `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 9 tests.
  - `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 58 tests.
  - `npm.cmd run build`: passed.
  - `git diff --check`: passed with Windows line-ending warnings only.

The session naming and Branch repair closed these Workshop gaps:

- New Workshop sessions now default to neutral `New chat` instead of the scene/task-specific `Scene continuity pass`.
- Empty chats auto-name from the first author request or from attachment file names once sending begins.
- Authors can double-click a session title in the sessions list, edit it, and persist the new title through the Workshop session update API.
- Branch creation now copies source messages through the source message into the new session. Copied messages use new IDs, carry no old Proposal/model-call/context audit links, and remain readable in the newly opened branch.
- Branch creation copies message-bound attachment snapshots into the new session and rewrites cloned message attachment IDs to those new attachment records.

Focused command results during the 2026-07-03 Workshop streaming session-switch and permanent session delete repair:

- Official source basis checked before implementation: React `useRef` and `useState` docs for session-scoped mutable stream refs plus state updater behavior; Fastify routes docs for adding the session `DELETE` route beside existing session routes.
- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 8 tests.
- Initial `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts` and `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts` failed because downstream workspaces were reading stale built `@novel-studio/contracts` / `@novel-studio/storage` exports; after rebuilding contracts/storage, reruns passed.
- Initial `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"` exposed a test mock inconsistency: the delayed SSE mock persisted final server messages before the stream response resolved. The mock was corrected to persist streamed results only when the delayed response resolves.
- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run build -w @novel-studio/storage`: passed.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 9 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 10 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 10 selected tests, 50 skipped by filter.
- `npm.cmd run build`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.

The repair closed these Workshop gaps:

- A streaming call now captures its originating session ID and updates that session's local in-flight message overlay rather than blindly updating whichever session is currently open.
- Loading a session merges persisted messages with that session's in-flight local messages, so switching away and back before completion still shows the pending author message, pending assistant reply, and received stream content.
- Stream completion replaces optimistic local messages with saved server messages and clears the in-flight overlay for that session.
- Workshop sessions now have a permanent delete contract, storage method, Fastify route, web API method, and compact session actions menu entry.
- Permanent delete cascades unlinked session messages, message attachments, context basket JSON, and branch records; it clears other sessions' branch source pointer when the referenced source message was deleted.
- Sessions containing Proposal-linked messages are blocked from permanent delete with an explicit storage/API error instead of breaking Proposal source/audit references.

Focused command results during the 2026-07-03 Review diff-workspace repair:

- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: passed, 1 file / 60 tests.
- `npm.cmd run build -w @novel-studio/web`: passed.

The Review diff-workspace repair closed these Review UI gaps:

- The Review main route is no longer a four-column management dashboard with permanent Evidence, Impact, Batch Preview, and Batch Review panels.
- The Review working queue shows pending Proposal records only; decided Proposals leave the pending queue after accept/reject/edit/stale actions.
- Selecting a queue row opens the exact `/review/proposals/:id` route without a redundant `Open` button.
- The main detail area prioritizes readable before/after diff panes for manuscript patches and field-level before/after rows for structured Codex-like patches.
- Source, reason, and evidence remain available from a collapsed details section instead of occupying permanent side columns.
- `Mark Stale` is exposed only for recoverable unavailable source/target states; ordinary valid Proposals show Reject, Edit and Accept, and Accept.
- Workshop-to-Review source-message return remains available from the source/evidence details when the source message is available.
- No agent-owned screenshot acceptance was run or claimed; user visual acceptance remains separate.

Focused command results during the 2026-07-07 Workshop Agent `codex.create_entry` protocol repair:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 9 tests.
- `npm.cmd run build -w @novel-studio/storage`: passed.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 11 tests.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 17 tests.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 62 tests.

The Agent `codex.create_entry` protocol repair closed these gaps:

- Workshop no longer treats Codex creation as a mutable chat mode. New Workshop sessions are created as fixed `chat` or `agent` conversations.
- Agent provider output is parsed as a structured step. Raw simulated `Tool Call` text is suppressed from streaming and does not create a tool request.
- A valid structured Agent step creates a server-owned `role: tool` JSON message for `codex.create_entry`; the frontend confirmation card appears only for that tool message.
- The execute route accepts only structured JSON tool requests from Agent sessions. Plain `Codex Draft` text and fake `Tool Call` text cannot execute.
- Draft Details are written only through stable reusable detail type IDs. Existing detail types are matched by stable ID or exact normalized type name; unmatched draft labels are not persisted as free keys.
- Unmatched draft detail labels first return `CODEX_DETAIL_TYPE_CREATION_REQUIRED` and do not write an entry. After explicit confirmation, the server creates the missing detail types and then writes the entry with those new IDs.
- This is not full M5.6 Tool Plan/Grant behavior. The later `codex.update_entry` and M5.6A repairs add existing-entry/Progression support and durable execution identity for the current limited tools, but relation, category, knowledge, world-fact writes, stale baselines, and atomic command adapters remain unfinished.

Focused command results during the 2026-07-07 Workshop General Chat edit/resend repair:

- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 10 tests.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 13 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 18 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 63 tests.
- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run build -w @novel-studio/storage`: passed.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run build -w @novel-studio/web`: passed.

The General Chat edit/resend repair closed these gaps:

- Resend is limited to active `chat` sessions and successful `author` / `general-chat` messages.
- The storage/API path replaces the selected author message, deletes later unprotected General Chat history, deletes later message-bound attachments, and clears branch records/pointers that depended on deleted messages.
- Protected later records and Agent sessions are rejected instead of being handed to the author as a manual repair problem.
- The frontend exposes Edit/Resend only on General Chat author messages and removes old forward history/attachment chips after the resend result arrives.

Focused command results during the 2026-07-07 Workshop session export repair:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 11 tests.
- `npm.cmd run test -w @novel-studio/server -- workshop-routes`: passed, 1 file / 19 tests.
- `npm.cmd run test -w @novel-studio/web -- AppShell`: passed, 1 file / 64 tests.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.

The Workshop session export repair closed these gaps:

- The session sidebar exposes one session-level Export action with explicit Include reasoning and Include prompt audit checkboxes, not per-message actions.
- The server export route returns Markdown from persisted session, message, attachment, ContextBundle, and ModelCallLog records while filtering to the requested session.
- Default export excludes saved reasoning and prompt/context audit; `includeReasoning=true` includes saved provider reasoning blocks, and `includePromptAudit=true` includes reconstructed provider prompt/context records where durable context links exist.
- Export emits UTF-8 portable Markdown, does not fabricate tool calls or hidden prompts, and omits attachment body text while attachment file records remain.

Focused command results during the 2026-07-08 shared embedding infrastructure foundation:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- ai.test.ts`: passed, 1 file / 3 tests.
- `npm.cmd run build -w @novel-studio/ai`: passed.
- `npm.cmd run test -w @novel-studio/ai -- embeddings.test.ts`: passed, 1 file / 6 tests.
- `npm.cmd run build -w @novel-studio/storage`: passed.
- `npm.cmd run test -w @novel-studio/storage -- ai-files.test.ts`: passed, 1 file / 2 tests.

The shared embedding foundation closed these infrastructure gaps:

- `EmbeddingModelProfile` is a separate contract from generation `ModelProfile`, with provider, endpoint, model, dimensions, batching, profile-level concurrency, normalization, license, and credential-reference metadata.
- `@novel-studio/ai` now exposes an `EmbeddingRouter` that routes by use case or explicit profile ID, batches inputs, enforces profile-level concurrency, and allows different use cases to run different embedding models concurrently.
- The first default profile helper targets a local `BAAI/bge-small-zh-v1.5` HTTP service; it does not download model weights, create a vector index, or silently fall back to cloud embedding.
- Storage can persist library-global embedding profiles under `.studio/embedding-profiles/`, separate from existing generation model profiles.
- This is not M6 Reference Library semantic search, not a Settings UI, and not M5.6 Tool Plan/Grant execution.

Focused command results during the 2026-07-08 Workshop Agent authorization and `codex.update_entry` progression repair:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- workshop.test.ts`: passed, 1 file / 11 tests.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run test -w @novel-studio/server -- workshop-routes.test.ts`: passed, 1 file / 21 tests.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: passed, 1 file / 64 tests.
- `git diff --check`: passed with Windows line-ending warnings only.

The Agent authorization and `codex.update_entry` progression repair closed these gaps:

- Explicit author authorization in an Agent conversation is now treated as sufficient source basis for drafting/calling the limited Codex tools.
- Agent prompt/runtime behavior is expected to use current-session author decisions as source material directly; the current implementation does not use a server-owned continuation loop.
- The Agent prompt protocol now includes `codex.update_entry` with `patch.progressions`, instead of treating update/progression work as general prose.
- `codex.update_entry` tool execution can update one existing Codex entry and can create, update, or delete unified Codex Progression records through the same validated repository commands used by the normal Codex API.
- The frontend confirmation card now detects both `codex.create_entry` and `codex.update_entry` server-owned tool messages and executes the correct route; it no longer depends on create-only helper names.
- This remains below M5.6 Tool Plan/Grant scope and does not implement relation, category, character knowledge, broad world mutation, or broad Write adapters.

Focused command results during the 2026-07-09 Workshop prompt/role isolation:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run test -w @novel-studio/server -- test/prompt-routes.test.ts test/workshop-routes.test.ts test/context-routes.test.ts test/model-calls.test.ts`: passed, 4 files / 26 tests.
- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 11 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 66 tests.
- `npm.cmd run test -w @novel-studio/storage -- test/ai-files.test.ts test/proposals.test.ts test/repository.test.ts`: passed, 3 files / 64 tests.
- `npm.cmd run test -w @novel-studio/ai -- test/mockProvider.test.ts`: passed, 1 file / 21 tests.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run build -w @novel-studio/web`: passed.

The prompt/role isolation closed these gaps:

- Workshop General Chat and Agent prompts now live in `apps/server/src/workshop/workshopPrompts.ts`, not in global prompt/role seed data.
- The global built-in role/template seed file and route seeding calls were removed.
- Workshop frontend `chat` and `agent` calls no longer send global role/template/task fields; the server derives Workshop prompt identity from the fixed session mode.
- Non-Workshop context/model-call paths still support user-created roles and templates, but tests now create those records explicitly.
- Product, architecture, task, and handoff records no longer require fixed global built-in editorial roles.

Focused command results during the 2026-07-09 Workshop prompt/call boundary repair:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 12 tests.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 14 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 23 tests.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run build -w @novel-studio/storage`: passed.

The prompt/call boundary repair closed these gaps:

- Public `CreateWorkshopMessageInputSchema` is author-only, and the public Workshop message API rejects attempts to create `assistant` or `tool` messages.
- Server-owned `role: result` messages from `codex.create_entry` and `codex.update_entry` execution are saved through the internal message path, not through the public author-message helper.
- Agent provider requests now filter prompt audit context items before sending to the model, preventing duplicated role instructions and user requests in the provider payload.
- Session export prompt-audit reconstruction uses the same provider-context filtering.
- The current Agent is still a single-step structured parser, not a durable multi-step runner; M5.6 Tool Plans/Grants remain not started.

Focused command results during the 2026-07-09 Workshop Agent pending Codex draft follow-up repair:

- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 25 tests.
- `npm.cmd run test -w @novel-studio/contracts`: passed, 3 files / 22 tests.
- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `node .hermes\workshop-real-api-test.mjs`: passed against the current server source, existing DeepSeek credential, and a new 10-turn English Agent session. The script deliberately sent stale `lead-writing-partner` / old prompt-template input fields; every runtime ContextBundle still used `workshop-agent` and prompt template `00000000-0000-4000-8000-000000000422`. Required tool turns 3, 5, 6, 8, and 10 produced tool messages; review-only turns did not force a tool; total tool messages were 6 with 5 follow-up revision tool messages; export without reasoning did not include reasoning; no old prompt/role text leaked into messages, context, or export.
- `git diff --check`: passed with Windows line-ending warnings only.

The pending Codex draft follow-up repair closed these gaps:

- Agent context assembly now derives a `pending-codex-draft` item from the latest unexecuted Agent Codex tool message and includes it only for Agent calls.
- The provider sees the current pending draft on later turns, so ordinary follow-up edits can revise the same draft instead of restarting from chat memory alone.
- If the provider returns direct structured `codex.create_entry` / `codex.update_entry` JSON, the server parses it as a tool request rather than saving raw JSON as assistant prose.
- The server has a narrow fallback for clear pending-draft edits so obvious draft revision requests do not collapse into prose-only replies.
- This is still not full M5.6. It does not add durable Tool Plans, Grants, structured-output provider APIs, or broad command adapters.

Focused documentation results during the Workshop current-function and verified defect audits:

- `docs/design/ui-redesign/M5_WORKSHOP_CURRENT_FUNCTION_AND_UI_MAP.md` records the current Workshop UI/control inventory and frontend-backend-storage mapping for future UI redesign.
- `docs/testing/M5_WORKSHOP_VERIFIED_DEFECT_AUDIT_2026-07-09.md` replaces the deleted older functional and prompt/call-chain audit records. It was fully rechecked against `aea8998` plus the current M5.6A lifecycle follow-up and remains the current defect source for M5.6 replanning.
- The highest-risk findings after re-audit are unserialized per-series file transactions, non-atomic composed Codex writes, stale-baseline bypass, weak Progression target/scene binding, no running/failed execution recovery, mutable code-only Agent prompt versions, incomplete approval-payload identity, missing embedding-backed detail planning, and the single-step/hard-coded-fallback Agent path.
- This audit now records M5.6A as closed for current limited Agent-tool idempotency and archived-session prechecks, but it does not advance M5.6 Tool Plan/Grant execution or user visual acceptance.

Focused command results during M5.6A Tool Execution Containment:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run build -w @novel-studio/storage`: passed.
- `npm.cmd run test -w @novel-studio/server -- workshop-routes`: first run failed because the server test process read stale `@novel-studio/storage` dist before the new storage method was built; after `npm.cmd run build -w @novel-studio/storage`, passed, 1 file / 26 tests.
- `npm.cmd run build -w @novel-studio/server`: passed after adding an explicit `codexInput` guard.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `npm.cmd run test -w @novel-studio/storage -- workshop.test.ts`: passed, 1 file / 16 tests after lifecycle follow-up.
- The first expanded `npm.cmd run test -w @novel-studio/server -- workshop-routes` run failed before route execution because the new failure fixture referenced an unimported `randomUUID`; the fixture was corrected to use a fixed valid UUID without changing the scenario.
- `npm.cmd run test -w @novel-studio/server -- workshop-routes`: passed, 1 file / 27 tests.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop Agent"`: passed, 3 selected tests / 64 skipped.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 67 tests.

M5.6A closed these current limited-Agent-tool gaps:

- Server-owned Agent tool messages now carry optional `toolExecution` metadata with request hash, execution status, timestamps, result-message link, and error fields.
- `codex.create_entry` and `codex.update_entry` execute routes reject archived source sessions before any Codex/detail/progression write.
- Storage serializes execution claims per Workshop session in the specified single local server process, so concurrent confirmations cannot both pass the claim boundary.
- The same execute routes mark the source tool message as `running` before the first authority write, mark it `succeeded` with the result message ID after success, mark post-start failures as failed, and reject concurrent or repeated execution before duplicate authority mutation.
- Running tool execution blocks session archive/delete; server-owned tool requests and linked results cannot be deleted independently; Branch rejects running/incomplete execution history and remaps complete tool/result pairs.
- Execution schemas reject malformed terminal state and reject execution metadata on non-Agent-tool messages. Failed/executed tools are excluded from pending-draft context.
- The Workshop UI replaces confirmation with execution state after success and reloads the persisted failed state after an execution error; tool/result messages do not expose generic Delete.
- Regression coverage proves concurrent and repeated execution does not duplicate entries/progressions; archived-session execution creates no Codex entry/result/marker; running execution blocks archive/delete; post-claim failure records `failed` and refuses replay; result links survive branch/source-session deletion; and failure does not become a pending draft.

M5.6A does not implement full M5.6 Tool Plans/Grants, stale draft baselines, atomic composed Codex adapters, Progression target/scene binding, semantic detail planning, durable multi-step Agent execution, or user visual acceptance.

Focused command results during the 2026-07-08 Workshop workbench-shell/conversation/context-panel redesign pass:

- `ui-ux-pro-max-v3` was reloaded before implementation. The local design-system search classified the surface as a review/workbench productivity tool and emphasized readable 16px+ text, visible focus states, semantic buttons, controlled state, and no fake controls.
- Design reference: `docs/design/ui-redesign/M5_WORKSHOP_UI_REDESIGN_REVIEW.html`.
- Acceptance mapping: `M5-A23` for author-facing message/composer/session controls and `M5-A24` for design-reference structure alignment with user visual acceptance still pending.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 13 selected tests, 51 skipped by filter.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.
- The web tests were updated for the moved topbar New/More session actions, renamed Context and Call Settings buttons, tabbed context panel, and message action menu. These changes follow the redesign reference's workbench control placement and are not behavior downgrades.
- Screenshot/visual-diff validation was not run by Codex per project instruction; user visual acceptance remains separate.

Focused command results during the 2026-07-09 Workshop shared-sidebar and floating-menu repair:

- `ui-ux-pro-max-v3` remained the design skill basis, and `docs/design/ui-redesign/M5_WORKSHOP_UI_REDESIGN_REVIEW.html` remained the local reference.
- Scope: remove the Workshop-only project-sidebar rail override so Workshop uses the shared expandable/collapsible app project sidebar; keep the Workshop page body full-height; close Context, New/Add, More/session actions, message action menus, and Workshop settings on outside pointer or Escape.
- Acceptance mapping: `M5-A23` for author-facing menu behavior and `M5-A24` for shared-sidebar design-structure alignment with user visual acceptance still pending.
- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx -t "Workshop"`: passed, 1 file / 15 selected tests, 51 skipped by filter.
- `npm.cmd run build -w @novel-studio/web`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.
- Screenshot/visual-diff validation was not run by Codex per project instruction; user visual acceptance remains separate.

## M5.0 Startup Protection Mapping

| Protected behavior | Existing or planned verification |
| --- | --- |
| Current Write app shell, continuous manuscript editor entry, Focus behavior, and no return to repeated block-card/textarea editing. | Existing web tests to run: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`; existing editor mapping tests to include if touched: `npm.cmd run test -w @novel-studio/web -- sceneBlockMapping.test.ts`. |
| Codex Canon/Detail editing, mentions, previews, bounded editor behavior, and shared editor surface behavior. | Existing web tests to run: `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx`; existing server/storage Codex coverage below must remain passing. |
| SceneBlockDocument JSON authority, Markdown projection/export boundary, scene progression-block commands, unified Progression JSON authority, and no stale YAML/Markdown runtime authority path. | Existing storage tests to run: `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts`; existing server tests to run: `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts`. |
| Context Builder and Codex context preview preserve future-story and future-progression isolation. | Existing server tests to run: `npm.cmd run test -w @novel-studio/server -- context-routes.test.ts model-calls.test.ts`; existing storage coverage in `repository.test.ts` and `smoke.test.ts` should be considered for focused runs. |
| Settings and AI provider behavior uses explicit Provider selection and does not silently fall back to another Provider. | Existing server tests to run: `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts model-calls.test.ts`; existing AI tests to run if provider registry changes: `npm.cmd run test -w @novel-studio/ai`. |
| Whole-workspace contract and build health before M5 contract/UI changes. | Required before M5.0 exit: `npm.cmd run build -w @novel-studio/contracts`, `npm.cmd run build`, `npm.cmd run test`, and `git diff --check`. |
