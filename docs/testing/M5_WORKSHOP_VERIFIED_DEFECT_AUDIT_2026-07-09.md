# M5 Workshop Verified Defect Audit

Date: 2026-07-09
Updated: 2026-07-10
Verified baseline: `0fe44d7 NS-410 fix(workshop): repair agent prompt and draft flow`
Status: current-source audit for M5 replanning, updated through M5.6A Tool Execution Containment

This file replaces the older Workshop functional audit and prompt/call-chain audit. Those older records mixed pre-repair and post-repair states, so they were removed to avoid misleading later implementers.

## Verification Boundary

Checked current source paths:

- `apps/server/src/routes/workshop.ts`
- `apps/server/src/routes/context.ts`
- `apps/server/src/workshop/workshopAgent.ts`
- `apps/server/src/workshop/workshopPrompts.ts`
- `apps/server/src/workshop/codexDraft.ts`
- `apps/server/src/workshop/sessionExport.ts`
- `apps/web/src/features/workshop/WorkshopWorkspace.tsx`
- `apps/web/src/app/uiText.ts`
- `packages/contracts/src/workshop.ts`
- `packages/contracts/src/context.ts`
- `packages/contracts/src/codex.ts`
- `packages/storage/src/index.ts`
- focused Workshop/server/web/storage tests referenced by `docs/testing/M5_ACCEPTANCE.md`

## Confirmed Repaired Boundaries

These old findings are no longer open blockers:

- Public Workshop message creation is author-only. `CreateWorkshopMessageInputSchema` now uses `role: "author"`; server-owned `assistant`, `tool`, and `result` messages use internal save paths.
- Workshop General Chat and Agent prompts are isolated in `apps/server/src/workshop/workshopPrompts.ts`; the global built-in role/template seed path is deleted.
- Agent and General Chat provider-bound context filters `role-instruction`, `prompt-template`, and `user-request` so prompt/user text is not duplicated in the provider payload.
- Plain assistant text, fake `Tool Call` prose, and old plain `Codex Draft` text are not executable Agent tool protocol.
- Direct structured provider JSON for `codex.create_entry` / `codex.update_entry` is parsed as a server-owned tool request instead of being saved as raw assistant prose.
- A later Agent turn receives the latest unexecuted Codex tool draft as `pending-codex-draft` context.
- M5-WV-001 is closed for the current limited Agent Codex tool path: server-owned tool messages now persist `toolExecution` request hashes/status/result links; storage serializes claims per Workshop session in the specified single local server process; execute routes mark `running` before authority writes, mark `succeeded` after result-message creation, mark post-start failures as failed, and reject concurrent or later execution before duplicate authority mutation.
- M5-WV-003 is closed for the current limited Agent Codex tool path: execute routes reject archived source sessions before Codex/detail/progression writes; running execution blocks archive/delete and direct tool-message deletion; and regression coverage proves no entry, result message, or execution marker is created from an archived source session.

## Current Open Defects

### M5-WV-002: Agent Codex tool execution is not atomic across authority writes and result messages

Status: still open.
Severity: critical.

The execute routes compose multiple writes sequentially. Missing detail types can be created before the entry write. `codex.update_entry` updates the Codex entry before Progression operations. Progression operations are applied in a loop. Result message creation happens after authority writes.

Evidence:

- `apps/server/src/routes/workshop.ts` creates missing detail types in the execute routes before rebuilding final Codex input.
- `apps/server/src/routes/workshop.ts` calls `repository.updateCodexEntry(...)` before `executeCodexProgressionDrafts(...)`.
- `executeCodexProgressionDrafts(...)` calls create/update/delete Progression repository methods one by one.
- Result messages are saved after Codex writes.

Required repair:

- Move limited Agent tools behind a command adapter / Tool Plan execution path that writes all affected authority files and audit/result state transactionally, or convert to Proposal when that is not possible.

### M5-WV-004: `codex.update_entry` can bypass stale entry/research baselines

Status: still open.
Severity: critical.

The Agent update draft does not carry the entry/research base revisions used when the draft was generated. At execute time, the server resolves the current entry and fills current revisions into the update input, satisfying storage revision checks while allowing a stale draft to overwrite newer changes.

Evidence:

- `apps/server/src/workshop/codexDraft.ts` sets `input.baseRevision = entry.revision`.
- `apps/server/src/workshop/codexDraft.ts` sets `input.baseResearchRevision = entry.research.revision`.

Required repair:

- Store draft-time entry and research revisions in the server-owned tool request.
- Reject execution when current revisions differ.

### M5-WV-005: Progression update/delete scope is too loose

Status: still open.
Severity: critical.

Agent `codex.update_entry` Progression update/delete operations use `progressionId` and `baseRevision`, but the route does not verify the target Progression belongs to the target Codex entry, relation, or intended scene. Generic progression update input can also change `effectiveFromSceneId`.

Evidence:

- `apps/server/src/routes/workshop.ts` calls update/delete by `draft.progressionId`.
- `codexProgressionUpdateInputFromDraft(...)` passes generic `UpdateCodexProgressionInputSchema`.
- `packages/contracts/src/codex.ts` allows optional `effectiveFromSceneId` in generic update input.

Required repair:

- Load the target Progression before mutation.
- Verify target entry/relation/scene binding.
- For Agent tools, disallow moving `effectiveFromSceneId` unless a dedicated move operation is designed and confirmed.

### M5-WV-006: Detail schema planning is still exact-match only

Status: still open.
Severity: high.

The detail resolver supports explicit mappings, embedded stable detail type IDs, and exact normalized type-name matches. It does not call the shared embedding layer and does not return semantic mapping suggestions with scores/reasons.

Evidence:

- `resolveDraftDetails(...)` in `apps/server/src/workshop/codexDraft.ts`.
- `EmbeddingRouter` exists in `packages/ai/src/embeddings.ts`, but Workshop detail resolution does not use it.

Required repair:

- Add a schema planner that recommends existing reusable detail types before creating new ones.
- Use profile-routed embeddings where configured, with fallback behavior that does not silently create duplicates.

### M5-WV-007: `detailCreations` and sensitive-detail metadata are declared but not implemented

Status: still open.
Severity: medium.

`ExecuteWorkshopCodexCreateEntryToolInputSchema` declares `detailCreations`, but the execute routes never read it. Missing detail types are created directly from the draft label with `nsfw: false`.

Evidence:

- `packages/contracts/src/workshop.ts` declares `detailCreations`.
- `apps/server/src/routes/workshop.ts` creates missing detail types from `missingDetailType.label`.
- The same route hardcodes `nsfw: false`.

Required repair:

- Either implement the detail creation customization path as part of the schema planner UI, including final name and NSFW flag, or remove the field until it is backed.

### M5-WV-008: Agent execution is still a single-step parser, not a durable multi-step runner

Status: still open, with a partial follow-up workaround.
Severity: high.

The Agent path parses one provider response, creates at most one assistant message and one tool request message, then stops. Tool execution appends a result message, but does not feed that result back into a durable Agent continuation loop. The pending-draft repair carries drafts forward, but part of that behavior is implemented by hard-coded English regex heuristics in the server, not by a general runner.

Evidence:

- `saveWorkshopAssistantTurn(...)` calls `parseWorkshopAgentStep(...)` once.
- `executeCodexToolFromMessage(...)` appends a result message but does not continue the Agent run.
- `revisedPendingCodexDraft(...)`, `requestedAliases(...)`, `requestedAddedDetail(...)`, and `removeInventedCosmicMaterial(...)` are narrow hard-coded fallback helpers.

Required repair:

- Add durable Agent step records with explicit states: model step, tool request, waiting for confirmation, tool result, continuation, failed repair.
- Remove hard-coded content-rewrite heuristics from the long-term path.

### M5-WV-009: Tool protocol still depends on prompt compliance

Status: still open.
Severity: high.

The Agent tool protocol is appended to natural-language prompt instructions and validated after generation. Provider structured-output support exists elsewhere, but Workshop Agent does not yet use structured-output/tool-schema generation with retry/repair.

Evidence:

- `WORKSHOP_AGENT_TOOL_PROTOCOL_PROMPT` is plain prompt text.
- `parseWorkshopAgentStep(...)` falls back to prose when parsing fails.
- `ProviderAdapter.generateStructured` exists in AI providers, but the Workshop Agent call path uses text generation plus post-parse.

Required repair:

- Use provider structured-output support where available.
- Add server-side repair/retry for malformed structured output.
- Preserve a visible degraded mode when a selected provider cannot support structured output.

### M5-WV-010: General Chat system prompt is component-global

Status: still open.
Severity: medium.

The visible General Chat system prompt is held in React component state and is not persisted per session. Switching sessions keeps the same editor value; resend uses the current prompt value.

Evidence:

- `generalSystemPrompt` is `useState(...)` in `WorkshopWorkspace.tsx`.
- Resend sends the current `generalSystemPrompt`.
- `WorkshopSession` has no persisted prompt setting.

Required repair:

- Decide and implement either explicit global/current-call prompt scope or persisted per-session prompt settings.

### M5-WV-011: Branch UI only exposes branch-from-last-message

Status: still open.
Severity: medium.

The backend branch API supports an arbitrary source message, but the UI action always branches from the last message in the session.

Evidence:

- `branchFromLastMessage()` uses `messages[messages.length - 1]`.

Required repair:

- Add per-message branch or a selected-message branch flow.

### M5-WV-012: Legacy `continuity-check` Proposal creation remains reachable only as an old path

Status: still open.
Severity: medium.

The UI still contains `Create Proposal` for successful non-author `continuity-check` messages, but current sends produce General Chat or Agent messages. General Chat and Agent generic Proposal creation are intentionally blocked.

Evidence:

- Message render condition checks `message.mode === "continuity-check"`.
- Current send path maps fixed sessions to `general-chat` or `agent`.

Required repair:

- Remove/hide this legacy path, or add a current supported workflow that creates such source messages.

### M5-WV-013: Backend context kinds exceed current UI exposure

Status: still open.
Severity: medium.

Contracts and backend support `selection`, `scene-section`, `research-note`, `note`, and `proposal-source` context kinds, but the current UI mainly exposes full novel, full outline, act, chapter, scene, Codex entries, and file attachments.

Evidence:

- `WorkshopContextItemKindSchema` includes those kinds.
- `WorkshopWorkspace.tsx` context menu exposes only the current Story/Structure/Codex/Files paths.

Required repair:

- Decide which context kinds belong in the author-facing Workshop UI, then either expose them or quarantine them as backend-only/deferred.

### M5-WV-014: Codex grouping labels are duplicated

Status: still open.
Severity: medium.

`Entries by Type` and `Entries by Category` both use category groups. `Entries by Detail` uses detail type groups. `Entries by Tag` copy exists but is unused.

Evidence:

- `entryTypes` and `entryCategories` both route through `categoryGroups`.
- `uiText.workshop.contextMenu.entriesByTag` exists without a current menu path.

Required repair:

- Normalize Codex grouping information architecture before further UI redesign.

### M5-WV-015: Message deletion is not turn-aware

Status: still open.
Severity: medium.

The UI can delete individual unlinked `general-chat` or `agent` messages. Storage deletes one message and its bound attachments, but does not treat a conversational turn as a unit.

Evidence:

- `canDeleteMessage` is per-message.
- `deleteWorkshopMessage(...)` deletes one message record and bound attachments.

Required repair:

- Make deletion turn-aware, or explicitly constrain it to safe author-message history editing paths.

### M5-WV-016: Workshop UI copy remains English-centered

Status: still open.
Severity: medium.

Workshop UI labels and status text are still mostly English. The product requires natural Chinese-first copy or an explicit bilingual/i18n layer.

Evidence:

- `apps/web/src/app/uiText.ts` Workshop labels are English-centered.

Required repair:

- Centralize and rewrite Workshop copy as Chinese-first or define a real bilingual/i18n boundary.

### M5-WV-017: Workshop modules remain too large

Status: still open.
Severity: medium.

Workshop code is still concentrated in large modules:

- `WorkshopWorkspace.tsx`: 2903 lines.
- `apps/server/src/routes/workshop.ts`: 1583 lines.
- `apps/server/src/workshop/codexDraft.ts`: 713 lines.
- `apps/server/test/workshop-routes.test.ts`: 2461 lines.

Required repair:

- Split frontend by session dock, message stream, composer, context selector, settings, Agent tool cards, and service hooks.
- Split server routes by sessions, messages, calls, context, attachments, export, and tool adapters.

### M5-WV-018: Legacy Workshop modes remain in public contracts

Status: still open but runtime-blocked.
Severity: low.

`continuity-check` and `codex-creation` remain in `WorkshopModeSchema`. Runtime routes/storage reject `codex-creation`, but the enum still exposes a misleading active mode.

Evidence:

- `packages/contracts/src/workshop.ts` includes both modes.
- `rejectLegacyCodexCreationMode(...)` blocks `codex-creation` at route level.
- Storage rejects `codex-creation`.

Required repair:

- Move legacy acceptance into migration-only schemas or mark/remove deprecated modes from active contracts.

### M5-WV-019: Import Thread is visible but unimplemented

Status: still open/deferred.
Severity: low.

The session actions menu shows a disabled `Import Thread` button and there is no backend route.

Required repair:

- Remove it from the main path until implemented, or keep it explicitly disabled in the redesign.

### M5-WV-020: Workshop prompt customization UI is not implemented

Status: open product gap.
Severity: medium.

Workshop prompts are now isolated in the server module, which fixes role leakage, but users cannot yet edit or create Workshop-specific General Chat / Agent prompts from the UI.

Required repair:

- Add a Workshop-specific prompt configuration source that can later be edited from UI without mixing with global non-Workshop roles/templates.
- Preserve historical prompt versions in ModelCallLog/ContextBundle audit.

## Planning Consequences

M5 remaining work must not be planned from the deleted audits. The current order should be:

1. Continue containing the existing limited Agent Codex tools beyond M5.6A: stale baselines, progression binding, and atomicity.
2. Replace the hard-coded pending-draft fallback with a durable Agent runner and structured-output/repair path.
3. Add the detail schema planner using the shared embedding infrastructure.
4. Then implement the original M5.6 Tool Plan/Grant layer explicitly: durable Tool Plan, Grant, and Tool Call records, approved Codex/Write tool definitions, validated command adapters, permission/result UI, stale-target refusal, partial-failure reporting, and Proposal fallback.
5. Only after that, continue to Council, batch/failure states, responsive behavior, copy/i18n, and user visual acceptance.

The original M5.6 requirements are not deleted. They are classified in `docs/tasks/M5.md` as kept, partially started, or replaced. The replaced part is the old monolithic implementation order, not the Tool Plan/Grant product requirement.
