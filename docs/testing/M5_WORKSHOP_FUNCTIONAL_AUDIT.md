# M5 Workshop Functional Audit

Date: 2026-07-08
Scope: current Workshop implementation after commit `fedeeab NS-410 fix(workshop): repair agent tools and embedding foundation`.

This is a defect-oriented audit. It lists functional gaps, architectural risks, and overstatements inside the current Workshop boundary. It does not propose that these issues are fixed. It also does not use screenshots or visual acceptance.

## Audit Boundary

Authoritative data sources checked:

- Workshop sessions, messages, attachments, branches, and context baskets.
- ContextBundle and ModelCallLog links created by Workshop calls.
- Codex entry/detail type/progression writes reachable from Workshop Agent tools.
- Proposal links created from Workshop messages.
- Frontend state and UI controls in the current Workshop screen.

Read paths checked:

- Session list/detail load.
- Message/attachment rendering.
- Context basket load and update.
- Proposal card status load.
- Session export.
- Agent tool request parsing.

Write paths checked:

- Session create/update/archive/restore/delete.
- Message create/delete.
- General Chat resend.
- Attachment upload/delete/bind.
- Context basket update.
- Calls and streaming calls.
- Branch creation.
- Workshop message-to-Proposal creation.
- Agent `codex.create_entry` execution.
- Agent `codex.update_entry` execution and Progression operations.

User-visible entry points checked:

- Session creation menu.
- Session rows and title rename.
- Archive/Restore/Branch/Delete/Export/Import Thread controls.
- Settings dialog.
- Message toolbar controls.
- Proposal cards.
- Agent tool confirmation cards.
- Missing-detail resolution card.
- Context selector.
- Attachment picker.
- Stop/Send composer actions.

## Findings

### W-AUDIT-001: Agent Codex tool execution is not idempotent or consumed after success

Severity: Critical

The source tool message is never marked as executed, consumed, or superseded. The UI condition for showing `Confirm Tool Call` only checks that the message is an active `agent` tool message with parseable content. After a successful execution, the same tool message still satisfies that condition. The server routes also do not record an execution ID or reject repeated execution of the same tool message.

Impact:

- `codex.create_entry` can be executed repeatedly from one tool request, potentially creating duplicate entries or repeated missing detail types.
- `codex.update_entry` can be executed repeatedly, applying repeated field/research/progression operations.
- Export/history does not provide a reliable "this tool request was already applied" state.

Evidence:

- UI condition and execute call: `apps/web/src/features/workshop/WorkshopWorkspace.tsx` around `executeCodexToolFromMessage()` and the tool card render.
- Create route: `apps/server/src/routes/workshop.ts` route beginning at `codex.create_entry/execute`.
- Update route: `apps/server/src/routes/workshop.ts` route beginning at `codex.update_entry/execute`.

Required direction:

- Add a durable tool invocation/execution record or mutate the tool message with a consumed/result link.
- Make execution routes idempotent by source tool message and tool request hash.

### W-AUDIT-002: Agent Codex tool execution is not transactionally atomic across all affected records

Severity: Critical

The tool execute routes compose multiple repository writes sequentially instead of wrapping the full operation in one command transaction.

Concrete partial-write cases:

- Missing detail type creation happens before the final entry input is rebuilt and before the entry is written.
- `codex.update_entry` updates the Codex entry before applying Progression operations.
- Progression create/update/delete operations are applied sequentially; a failure midway leaves earlier Progression mutations committed.
- Result message creation happens after Codex writes; if the Workshop session is archived or message creation fails, authority may already be changed without a corresponding result message.

Impact:

- The author can receive an error while the project has already been partially changed.
- Detail type, entry, progression, and Workshop audit state can diverge.

Evidence:

- Missing detail type loop in create route: `apps/server/src/routes/workshop.ts`.
- Missing detail type loop in update route: `apps/server/src/routes/workshop.ts`.
- Sequential progression executor: `executeCodexProgressionDrafts()` in `apps/server/src/routes/workshop.ts`.
- Result message creation occurs after authority writes in both tool routes.

Required direction:

- Route Agent tool execution through a single command adapter with all affected authority writes and the result message in one transaction.
- If that is not possible yet, block partial routes and return Proposal/Tool Plan instead.

### W-AUDIT-003: `codex.update_entry` bypasses stale entry/research revision protection

Severity: Critical

The Agent update draft does not carry the base Codex entry revision or research revision from the context used to draft the update. At execution time, the server resolves the current entry and sets `baseRevision` and `baseResearchRevision` to the latest values. That satisfies storage conflict checks while still allowing a stale AI draft to overwrite changes made after the draft was generated.

Impact:

- User or another operation can change an entry after the Agent draft is produced.
- Confirming the older tool request can overwrite the newer entry fields/research without a stale warning.

Evidence:

- `codexUpdateEntryInputFromWorkshopDraft()` sets `input.baseRevision = entry.revision` and `input.baseResearchRevision = entry.research.revision` from the current entry in `apps/server/src/workshop/codexDraft.ts`.
- The update route calls `resolveCodexUpdateTarget()` at execution time before building the input.

Required direction:

- Include base entry/research revisions in the tool draft or in the server-owned tool message.
- Reject execution when the entry/research revision differs from the draft baseline.

### W-AUDIT-004: Progression operations are not bound tightly enough to the target entry and scene

Severity: Critical

The Agent update tool can create, update, and delete Progressions, but update/delete operations only require `progressionId` and `baseRevision`. The route does not verify that the Progression belongs to the target Codex entry, target relation, or intended scene. The general `UpdateCodexProgressionInputSchema` also allows `effectiveFromSceneId` to be updated, so an Agent draft can move a Progression between scenes through the generic update shape.

This is especially important because Progression is scene-bound product state, not a free-floating detail field.

Impact:

- Updating one Codex entry can mutate or delete a Progression that belongs to another entry/relation.
- A Progression's effective scene can be moved through Agent execution.
- Scene-specific history can be corrupted from a tool request whose target appears unrelated.

Evidence:

- Tool prompt says update/delete use existing `progressionId` and `baseRevision`: `apps/server/src/workshop/workshopAgent.ts`.
- `codexProgressionUpdateInputFromDraft()` passes the draft into `UpdateCodexProgressionInputSchema` without route-level target/scene checks.
- `executeCodexProgressionDrafts()` calls repository update/delete directly by `progressionId`.
- `UpdateCodexProgressionInputSchema` includes optional `effectiveFromSceneId` in `packages/contracts/src/codex.ts`.

Required direction:

- Tool drafts need explicit scene binding and target binding.
- Update/delete routes must load the Progression and verify it is in the allowed target/scope before mutating.
- Agent-specific Progression updates should not allow `effectiveFromSceneId` mutation unless a dedicated move operation is designed and confirmed.

### W-AUDIT-005: Archived Agent sessions can still reach Codex tool execute routes

Severity: High

The execute routes validate that the source message is a successful Agent tool message in an Agent session, but they do not reject archived sessions before Codex authority writes. The UI hides tool execution in archived sessions, but the backend route is still callable.

Impact:

- An archived Agent session can trigger Codex writes through direct API usage.
- If result message creation later fails because archived sessions cannot receive messages, the Codex write may already be committed.

Evidence:

- Tool route validation checks message role/mode/status and session kind, not session status.
- `repository.createWorkshopMessage()` rejects archived sessions only when creating the result message after Codex writes.

Required direction:

- Tool execute routes must reject `source.session.status !== "active"` before any authority mutation.
- This should be covered by server tests.

### W-AUDIT-006: Detail matching still lacks the planned semantic/schema planner

Severity: High

The server detail resolver only supports:

- explicit `detailMappings`;
- a stable detail type UUID embedded in the label;
- exact normalized detail type name match.

If no exact match exists, it treats the label as missing and the current UI only offers to create missing detail types. There is no semantic/embedding recommendation path, no similarity score, and no user mapping UI. `detailCreations` exists in the contract but is not used by the server route or UI.

Impact:

- Similar labels such as "外貌" and "外表" can still become duplicate reusable detail types if the user confirms missing type creation.
- The system does not yet implement the intended "server recommends mapping first, create only when no good match" behavior.
- Contract surface suggests custom detail creations, but current implementation ignores that field.

Evidence:

- `resolveDraftDetails()` in `apps/server/src/workshop/codexDraft.ts`.
- Execute input has `detailMappings` and `detailCreations` in `packages/contracts/src/workshop.ts`.
- UI missing-detail card only has Cancel and Create Detail Types And Run Tool.
- `EmbeddingRouter` exists in `packages/ai/src/embeddings.ts`, but Workshop detail matching does not call it.

Required direction:

- Integrate a detail schema planner below Workshop tool execution.
- Use embedding/profile routing as a recommendation service.
- Return candidate mappings with scores and reasons.
- UI should let the author accept mappings, create a new type, or rename a new type.

### W-AUDIT-007: Agent is still a single-step structured parser, not a durable multi-step tool loop

Severity: High

The current Agent call buffers provider output, parses one JSON step, and optionally creates one server-owned tool request message. Tool execution happens later through a separate user click and only appends a result message. The result is not fed back into an automatic Agent continuation loop, and the system does not run a durable plan/tool/result cycle.

There is no durable retry or clarification loop for malformed tool steps or unhelpful assistant replies.

Impact:

- The implementation is not yet a general conversational agent that can call tools, inspect results, and continue within one Agent run.
- Invalid JSON or unhelpful replies become assistant text rather than a controlled continuation path.
- Complex Codex workflows cannot be decomposed into multiple safe tool steps.

Evidence:

- `saveWorkshopAssistantTurn()` parses a single Agent step and creates at most one tool request message.
- `executeCodexToolFromMessage()` appends a result message but does not call the model again.
- Workshop Agent prompts are isolated from global role/template records, but execution is still a single provider call plus one parsed step.

Required direction:

- Add a server-owned Agent runner with durable steps, tool request records, tool result records, retry policy, and explicit pause-for-confirmation states.
- Keep General Chat and Agent histories isolated.

### W-AUDIT-008: Prompt/schema enforcement still depends on model compliance

Severity: High

The Agent protocol is appended to the provider prompt as plain text. The server parser validates the output after the fact, which prevents fake tool text from executing, but it does not constrain the model before generation through a structured-output API or an internal planner.

Impact:

- The model can still produce prose, invalid JSON, incomplete drafts, or unnecessary questions.
- The server then saves generic fallback text instead of continuing a controlled planning loop.

Evidence:

- `AGENT_PROTOCOL_PROMPT` in `apps/server/src/workshop/workshopAgent.ts`.
- `parseWorkshopAgentStep()` converts invalid/missing JSON into a normal `respond` step.

Required direction:

- Prefer provider structured-output/schema support where available.
- Add server-side validation plus retry/repair for invalid structured output.
- Do not rely on prompt text as the only behavior constraint.

### W-AUDIT-009: Branch UI only exposes branch-from-last-message

Severity: Medium

The backend branch contract supports any `sourceMessageId`, and storage correctly clones history through that source message. The current UI's single `Branch` button always uses the last message in the current message array.

Impact:

- The user cannot branch from an earlier decision point without deleting or otherwise manipulating history.
- Current UI does not expose the full backend function.

Evidence:

- `branchFromLastMessage()` in `WorkshopWorkspace.tsx`.
- `CreateWorkshopBranchInputSchema` requires `sourceMessageId`.
- `branchWorkshopSession()` clones through the requested source message.

Required direction:

- Add per-message branch or branch-from-selected-message in the redesigned UI.

### W-AUDIT-010: Continuity-check Proposal creation is a legacy path with no current creation entry

Severity: Medium

The message renderer can show `Create Proposal` for successful non-author `continuity-check` messages. Current sends use only `general-chat` for chat sessions or `agent` for Agent sessions. General Chat and Agent proposal creation are intentionally blocked.

Impact:

- The UI contains a Proposal creation branch that is effectively unreachable in normal current use.
- Later maintainers may incorrectly assume Workshop can still generate continuity-check Proposal messages through the current composer.

Evidence:

- `previewPayload()` maps session kind to `general-chat` or `agent`.
- `Create Proposal` render condition checks `message.mode === "continuity-check"`.

Required direction:

- Either remove/hide this legacy UI path or add an explicit current workflow that can create supported Proposal-source messages.

### W-AUDIT-011: Several contract/backend context item kinds are not exposed in the current UI

Severity: Medium

Contracts/storage support context item kinds such as `selection`, `scene-section`, `research-note`, `note`, and `proposal-source`. The current context menu exposes full novel, full outline, acts, chapters, scenes, and Codex entry groupings. It does not expose selection, scene section, research note, free note, or Proposal source insertion.

The `selectedScene` prop is passed to `WorkshopWorkspace` but is not used.

Impact:

- Current UI cannot preserve or recreate all backend context basket capabilities.
- A redesign based only on the current visible menu would miss supported data kinds unless this gap is explicit.

Evidence:

- `WorkshopContextItemKindSchema` in `packages/contracts/src/workshop.ts`.
- Context menu view union and render functions in `WorkshopWorkspace.tsx`.
- `selectedScene` appears in props but is not destructured/used by the component.

Required direction:

- Decide which context kinds belong in the redesigned Workshop main path.
- Remove dead props/labels or expose the missing supported context paths.

### W-AUDIT-012: Codex context grouping labels are inconsistent

Severity: Medium

The context menu has both `Entries by Type` and `Entries by Category`, but both paths use `categoryGroups`. `Entries by Detail` uses detail type groups. The text also has `Entries by Tag`, but no current menu path uses it.

Impact:

- The current menu taxonomy is confusing and partly duplicated.
- A redesign needs a clean information architecture for Codex filtering.

Evidence:

- `renderContextMenuContent()` uses `categoryGroups` for both `entryTypes` and `entryCategories`.
- `uiText.workshop.contextMenu.entriesByTag` is present but unused.

Required direction:

- Collapse duplicate grouping labels or define distinct Type/Category meanings.
- Remove unused tag copy unless tags return as a real product concept.

### W-AUDIT-013: General Chat system prompt is component-global, not session-scoped or persisted

Severity: Medium

The General Chat system prompt is stored in React component state. It is not stored per session and not persisted as a session setting. Switching sessions keeps the same prompt editor value, and later resend calls use the current prompt rather than a prompt stored with that session.

The original call remains auditable through ContextBundle/ModelCallLog, but the editable prompt UI itself is not isolated by session.

Impact:

- Prompt changes in one chat can affect another chat's future sends/resends.
- The UI does not make that global/current-call scope clear.

Evidence:

- `const [generalSystemPrompt, setGeneralSystemPrompt] = useState(...)` in `WorkshopWorkspace.tsx`.
- Session schema has no prompt field.
- Resend sends the current `generalSystemPrompt`.

Required direction:

- Either make prompt scope explicit as a global/current-call setting or persist a per-session prompt setting.

### W-AUDIT-014: Message deletion is not turn-aware

Severity: Medium

The UI allows deleting any unlinked `general-chat` or `agent` message, including Agent tool/result messages. Storage deletes a single message and its bound attachments, but it does not delete or re-link the rest of a conversational turn.

Impact:

- Deleting a tool message can leave an assistant message saying a tool request was prepared but no executable tool request remains.
- Deleting a result message can remove the visible confirmation while the authority write remains.
- Deleting an author message can leave later assistant replies without their request.

Evidence:

- `canDeleteMessage` condition in message render.
- `deleteWorkshopMessage()` deletes only one message and attached attachments.

Required direction:

- Redesign delete as a turn-aware action, or clearly expose single-record deletion as an audit/editing tool with consequences.

### W-AUDIT-015: UI copy is English-centered despite Chinese-centered product requirements

Severity: Medium

Workshop labels, prompts, status text, and button copy are currently English. Product documentation says the application interface and default prompts should be centered on Chinese writing, with natural copy and no awkward mixed-language exposure in main author paths.

Impact:

- The current Workshop UI does not meet the stated language/copy direction for the target author.
- A future redesign cannot treat the current copy as acceptable final microcopy.

Evidence:

- `uiText.workshop` in `apps/web/src/app/uiText.ts`.
- Product language requirement in `docs/product/PRODUCT_SPEC.md`.

Required direction:

- Redesign copy as Chinese-first or define an explicit bilingual/i18n scope.
- Keep copy centralized.

### W-AUDIT-016: Workshop frontend and route modules are too large for the current complexity

Severity: Medium

Workshop behavior is concentrated in large files:

- `WorkshopWorkspace.tsx`: 2790 lines.
- `apps/server/src/routes/workshop.ts`: 1603 lines.
- `apps/server/src/workshop/codexDraft.ts`: 783 lines.
- `apps/server/test/workshop-routes.test.ts`: 2378 lines.

Impact:

- UI, API orchestration, state merging, Agent tool UX, context menus, attachments, and export behavior are difficult to reason about independently.
- Future redesign work is likely to break unrelated behavior without stronger module boundaries.

Required direction:

- Split by session shell, message list, composer, context selector, settings, Agent tool cards, export controls, and service hooks.
- Split server route logic into session, call, attachment, context, export, and tool adapter modules.

### W-AUDIT-017: `detailCreations` is declared but not implemented

Severity: Low

`ExecuteWorkshopCodexCreateEntryToolInputSchema` includes `detailCreations`, but the current execute routes create missing detail types directly from `missingDetailType.label` and never read `input.detailCreations`.

Impact:

- The contract suggests a capability to customize created detail type names, but the route ignores it.
- The UI cannot rename missing detail types before creation.

Evidence:

- Contract field in `packages/contracts/src/workshop.ts`.
- No route usage in `apps/server/src/routes/workshop.ts`.

Required direction:

- Either implement `detailCreations` or remove it until the schema planner UI uses it.

### W-AUDIT-018: Missing detail types always use `nsfw: false`

Severity: Low

When the Agent tool creates missing detail types, it hardcodes `nsfw: false`.

Impact:

- If the missing detail type is sensitive, the created reusable type has the wrong metadata.
- There is no UI chance to set NSFW before creation.

Evidence:

- Missing detail type creation loops in both Agent Codex execute routes.

Required direction:

- Missing detail creation confirmation should expose final name and NSFW flag, or defer to the normal Codex detail-type management UI.

### W-AUDIT-019: Legacy `codex-creation` remains in the public Workshop mode enum

Severity: Low

`WorkshopModeSchema` still includes `codex-creation`, but server routes and storage reject it. This may be useful for legacy validation, but it leaves an invalid mode visible in shared contracts.

Impact:

- New callers may see the enum and assume the mode is still valid.
- Tests and mocks can accidentally use a runtime-rejected mode.

Evidence:

- `WorkshopModeSchema` includes `codex-creation`.
- `rejectLegacyCodexCreationMode()` rejects it in routes.
- Storage rejects it for message create/save paths.

Required direction:

- Move legacy acceptance into an explicit migration schema or mark the enum member as deprecated in contracts/docs.

### W-AUDIT-020: Import Thread is visible but has no implementation

Severity: Low

The session panel includes a disabled `Import Thread` button. This is honest because it is disabled, but it is not connected to any current workflow.

Impact:

- A redesign should not preserve it as an active-looking control.

Evidence:

- Disabled button in `WorkshopWorkspace.tsx`.
- No route in `apps/server/src/routes/workshop.ts`.

Required direction:

- Keep it deferred, remove it, or implement a real import workflow.

## Test Gaps To Add Before Repair Claims

The following tests are missing or insufficient for the defects above:

- Re-executing the same Agent tool message must be rejected or idempotent.
- Tool execution from an archived Agent session must be rejected before any Codex write.
- `codex.update_entry` must reject stale entry/research baselines.
- `codex.update_entry` progression update/delete must reject Progressions outside the target entry/relation/scene scope.
- Multi-step tool execution must not leave partial detail type, entry, Progression, or result-message writes on failure.
- Detail schema planner must prefer existing similar types before creating new types.
- UI tests should cover mapping a missing detail label to an existing detail type instead of only creating it.
- Per-message branch UI should call the branch API with the selected message ID.
- Current unreachable `continuity-check` Create Proposal path should either be removed from UI tests or backed by an explicit workflow.
- Context menu tests should cover every context kind intended to remain in the redesigned UI.

## Summary

The current Workshop has real persistence, streaming, attachments, export, General Chat edit/resend, fixed Chat/Agent sessions, and limited author-confirmed Codex tools. The largest unresolved functional risks are in the Agent tool execution layer: no consumed/idempotent tool state, non-atomic composed writes, stale update baselines, weak Progression scope binding, and missing semantic detail planning. The UI also exposes only part of the backend context/branch capability and remains too monolithic for safe redesign work.
