# M5 Acceptance Record

Status: M5.1-M5.5 command/function verified with post-M5.5 Workshop chat/settings, message-attachment, context-delivery, UI-interaction, provider-reasoning, chat-layout, session-lifecycle, streaming-session-switch, and Review diff-workspace repairs; M5.6 next; user visual acceptance pending
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
| M5-A18 | passed | Workshop sessions, messages, branches, and message attachments persist as schema-versioned JSON and reload after restart. Branch copies source message history through the branch point plus attachment snapshots into the new session instead of opening an empty chat. Unlinked messages can be deleted through storage/API/UI, while Proposal-linked messages remain protected. Whole Workshop sessions can now be permanently deleted through the session route/UI when no message is Proposal-linked; deletion cascades messages, attachments, context baskets, and branch records, and blocks Proposal-linked sessions. Draft attachment reload/delete, message binding, branch cloning, message-delete cascade, and session-delete cascade/blocking are covered by storage/server/web tests. |
| M5-A19 | passed | Workshop selected context can add/remove/toggle allowed references through the compact composer menu, including full novel text, full outline, act, chapter, multiple scenes, direct Codex entries, and Codex grouped by type/detail/category. The internal storage object is still `WorkshopContextBasket`; the visible right-side basket panel has been removed. Covered by storage/server/web tests. |
| M5-A20 | passed | Context assembly shows included/excluded items and respects permissions, future-story isolation, auto-linked Codex policy, per-detail Send to AI switches, parsed `message-attachment` ContextBundle snapshots, and prior same-session `workshop-chat-history`. Attachments do not create SourceDocuments or retrieval index records. Covered by contract/server/storage tests and source review. |
| M5-A21 | passed | Single-role Workshop call creates ContextBundle and ModelCallLog from IDs rather than raw files, and provider request bodies receive ContextBundle item text. Workshop can choose a library-global model setting and send a provider model override for that call. Call input accepts `attachmentIds` plus `draftToken`, rejects raw file content, and rejects invalid attachment references. Codex Creation is accepted as a Workshop mode, uses the researcher/research call path, dynamically loads Codex workflow/interface guidance only for that mode, includes an explicit boundary map for context selection, attachments, mention detection, detail Send to AI, scene-content Proposals, Review, entries, categories, detail types, relations, progressions, knowledge, and world facts, and is blocked from the generic scene-content Proposal action. Covered by contract/server/AI-provider/web tests. |
| M5-A22 | passed | Model failure preserves the input, parsed attachments, bound author message, and context, then appends a failed assistant message instead of creating an empty Proposal. Covered by server/web tests and the storage binding invariants. |
| M5-A23 | passed | Workshop message UI remains author-facing and does not expose main-path audit fields. Mode, model setting, provider model override, system prompt, streaming, and reasoning-display controls are centralized in one settings dialog; Codex Creation is selectable there as a scoped Codex drafting mode and does not expose Create Proposal; reasoning is distinct and collapsible; Enter sends and Ctrl+Enter inserts a newline. The composer has one attachment icon, removable parse-state chips, send blocking for parsing/failed chips, and attachment names on sent user messages. New sessions use a neutral title, empty chats auto-name from the first request or attachment file names after sending starts, and authors can double-click session titles to persist manual renames. In-flight streamed replies stay attached to the session that started the call when authors switch sessions and return before completion. Permanent session delete is tucked behind a compact session actions menu rather than added as another primary session-list button. The 2026-07-03 chat-layout repair makes messages one broad readable column instead of left/right narrow bubbles, with readable body/reasoning typography. Covered by web tests and source review. |
| M5-A24 | function passed; visual pending | Workshop implementation must be checked against the Figma structure checklist. The 2026-07-03 chat-layout repair could not use the previously recorded Figma Workshop node because `12:2` was unavailable and the Figma file exposed only `00 Cover`; this is recorded as a Figma evidence gap, not visual acceptance. Agent-owned screenshot acceptance is prohibited; user visual acceptance remains pending. |
| M5-A25 | passed | Workshop message output can create a Proposal linked to that exact source message. Proposal creation and message `proposalIds` update are written transactionally. Covered by storage/server/web tests. |
| M5-A26 | passed | Proposal cards deep-link to exact Review Proposal Detail by Proposal ID. Covered by web tests. |
| M5-A27 | passed | Review Detail links back to the source Workshop message. Covered by server/web tests. |
| M5-A28 | function passed; visual pending | Workshop Proposal cards read Proposal authority state and reflect accepted, rejected, edited, stale, superseded, and unavailable states. Covered by web state-sync tests and source review; user visual acceptance remains pending. |
| M5-A29 | passed | Archived/unavailable Proposal links and unavailable source-message returns show recoverable states instead of dead navigation. Covered by storage/server tests and Workshop/Review unavailable UI behavior. |
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
| M5.4 Workshop Sessions, Context Selection, And Single-Role Call | Workshop persists sessions/messages, edits selected context through the compact menu backed by `WorkshopContextBasket`, assembles context through Context Builder, and runs single-role calls without authority mutation. | M5-A18 - M5-A24 |
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

M5.1-M5.5 implementation continued on 2026-07-01.

Implemented scope:

- M5.1 upgraded the existing Proposal contract and state machine in `packages/contracts/src/proposals.ts`; it did not create a parallel Proposal model.
- M5.2 added Proposal JSON storage, Review/proposal API routes, stale/decision behavior, snapshot creation, batch preview, and batch accept reporting.
- M5.3 replaced the unavailable Review shell with a real Proposal inbox/detail/decision UI backed by Proposal APIs.
- M5.4 added Workshop session/message/context-basket storage and APIs, Context Builder preview integration, and single-role call handling without authority mutation.
- M5.5 added durable Workshop-message-to-Proposal creation, Workshop Proposal cards, exact Review Proposal Detail links, Review source-message return links, Proposal authority status sync back into Workshop cards, and recoverable source unavailable states for missing messages or archived source sessions.

Important boundary:

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

Focused command results during M5.5:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
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

## M5.0 Startup Protection Mapping

| Protected behavior | Existing or planned verification |
| --- | --- |
| Current Write app shell, continuous manuscript editor entry, Focus behavior, and no return to repeated block-card/textarea editing. | Existing web tests to run: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`; existing editor mapping tests to include if touched: `npm.cmd run test -w @novel-studio/web -- sceneBlockMapping.test.ts`. |
| Codex Canon/Detail editing, mentions, previews, bounded editor behavior, and shared editor surface behavior. | Existing web tests to run: `npm.cmd run test -w @novel-studio/web -- EditorSurface.test.tsx`; existing server/storage Codex coverage below must remain passing. |
| SceneBlockDocument JSON authority, Markdown projection/export boundary, scene progression-block commands, unified Progression JSON authority, and no stale YAML/Markdown runtime authority path. | Existing storage tests to run: `npm.cmd run test -w @novel-studio/storage -- repository.test.ts json-authority.test.ts`; existing server tests to run: `npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts`. |
| Context Builder and Codex context preview preserve future-story and future-progression isolation. | Existing server tests to run: `npm.cmd run test -w @novel-studio/server -- context-routes.test.ts model-calls.test.ts`; existing storage coverage in `repository.test.ts` and `smoke.test.ts` should be considered for focused runs. |
| Settings and AI provider behavior uses explicit Provider selection and does not silently fall back to another Provider. | Existing server tests to run: `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts model-calls.test.ts`; existing AI tests to run if provider registry changes: `npm.cmd run test -w @novel-studio/ai`. |
| Whole-workspace contract and build health before M5 contract/UI changes. | Required before M5.0 exit: `npm.cmd run build -w @novel-studio/contracts`, `npm.cmd run build`, `npm.cmd run test`, and `git diff --check`. |
