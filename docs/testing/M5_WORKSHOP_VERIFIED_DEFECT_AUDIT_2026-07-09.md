# M5 Workshop Verified Defect Audit

Date: 2026-07-09
Updated: 2026-07-10
Verified baseline: `6fbabac NS-506 fix(workshop): close tool execution lifecycle gaps`, plus NS-507 evidence in `docs/testing/NS-507_ACCEPTANCE.md`
Status: current-source audit for M5 replanning, fully rechecked after NS-507 Atomic Codex Tool Adapters

This file replaces the older Workshop functional audit and prompt/call-chain audit. Those older records mixed pre-repair and post-repair states, so they were removed to avoid misleading later implementers.

## Verification Boundary

Checked current source paths:

- `apps/server/src/routes/workshop.ts`
- `apps/server/src/routes/context.ts`
- `apps/server/src/workshop/workshopAgent.ts`
- `apps/server/src/workshop/workshopPrompts.ts`
- `apps/server/src/workshop/codexDraft.ts`
- `apps/server/src/workshop/sessionExport.ts`
- `packages/storage/src/fileTransactions.ts`
- `packages/ai/src/embeddings.ts`
- `apps/web/src/features/workshop/WorkshopWorkspace.tsx`
- `apps/web/src/app/AppShell.test.tsx`
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
- M5.6A lifecycle follow-up closes additional execution-record gaps found during this re-audit: execution schemas now enforce role/mode and terminal-state invariants; failed/executed tools are not reintroduced as pending drafts; linked result messages cannot be deleted independently; Branch remaps complete tool/result pairs and rejects running or incomplete execution history; and the frontend reloads terminal state after an execution error instead of showing another confirmation action.
- M5-WV-002 is closed by NS-507: the limited Agent Codex execute routes delegate to repository-owned create/update command adapters. Confirmed detail types, entry/research changes, Progression operations, result message, session metadata, and terminal success record commit in one file transaction; validation or stale failure leaves semantic authority and result history unchanged.
- M5-WV-004 is closed by NS-507: server-owned update requests capture entry and research revisions when the tool request is created. Execution refuses changed revisions, and legacy unbound update requests cannot substitute current revisions.
- M5-WV-005 is closed by NS-507: Progression update/delete requests capture revision, target entry/relation, field target, and effective Scene binding. Cross-entry and unrelated-relation targets are rejected, and Agent updates cannot move the effective Scene.
- M5-WV-021 is closed by NS-507: file transactions share a process-wide per-Series coordinator; recovery runs on first repository access or inside the coordinator, not against another live commit. Concurrent stale-checked Codex commands, overlapping file transactions, injected mid-commit rollback, and repository-restart recovery have exact tests in `docs/testing/NS-507_ACCEPTANCE.md`.

## Current Open Defects

### M5-WV-006: Detail schema planning is still exact-match only

Status: still open.
Severity: high.

The detail resolver supports explicit mappings, embedded stable detail type IDs, and exact normalized type-name matches. It does not call the shared embedding layer and does not return semantic mapping suggestions with scores/reasons.

Evidence:

- `resolveDraftDetails(...)` in `apps/server/src/workshop/codexDraft.ts`.
- `EmbeddingRouter` exists in `packages/ai/src/embeddings.ts`, but Workshop detail resolution does not use it.
- `EmbeddingRouter.bindUseCase(...)` stores routing only in memory. `EmbeddingUseCaseBindingSchema` exists, but there is no persisted binding repository/API, so `codex.detail-schema` cannot retain a user-selected model across restarts.

Required repair:

- Add a schema planner that recommends existing reusable detail types before creating new ones.
- Use profile-routed embeddings where configured, with fallback behavior that does not silently create duplicates.
- Persist library-global use-case-to-profile bindings before the planner depends on them.

### M5-WV-007: `detailCreations` is ignored and missing-detail creation hardcodes sensitive metadata

Status: still open.
Severity: high.

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

### M5-WV-022: running and failed executions have no recovery protocol

Status: open.
Severity: high.

M5.6A intentionally makes `running`, `succeeded`, and `failed` terminally visible, but no startup reconciliation or author recovery action exists. A process crash after claim leaves `running` indefinitely and blocks archive/delete. A post-claim failure is permanently non-replayable even when no authority write occurred. `markWorkshopToolExecutionFailed(...)` also suppresses a secondary persistence failure, which can leave the source message running.

Evidence:

- `workshopToolConflict(...)` rejects both `running` and `failed` execution records.
- No startup or session-load path reconciles `running` records with result messages or authority state.
- `markWorkshopToolExecutionFailed(...)` catches and discards failure while persisting the failed marker.
- The UI exposes only a status pill; it has no inspect/recover/convert-to-Proposal action.

Required repair:

- Define restart reconciliation states such as interrupted, succeeded-with-result, partial-failure, and safe-to-retry.
- Store step-level effects or an atomic adapter result so recovery does not guess from prose.
- Add an explicit author action for safe retry, abandon, or Proposal conversion; never silently replay.

### M5-WV-023: Workshop Agent prompt versions are not immutable audit records

Status: open.
Severity: high.

Workshop prompts are isolated from global roles, but they are code constants with fixed template IDs and version `1`. Agent prompt export reconstructs the prompt from current code. Editing the code prompt later changes the reconstructed historical prompt while old ModelCallLogs still claim the same template version. The request hash can prove bytes differed but cannot recover those bytes.

Evidence:

- `apps/server/src/workshop/workshopPrompts.ts` hardcodes both Workshop prompt IDs and `promptTemplateVersion: 1`.
- `apps/server/src/workshop/sessionExport.ts` reconstructs Agent prompt audit by calling the current `workshopProviderPrompt(...)` and `applyWorkshopAgentPrompt(...)`.
- `ModelCallLog` stores prompt identity/hash links, not an immutable full provider prompt snapshot.

Required repair:

- Create Workshop-specific versioned prompt authority records before user customization or durable Agent runs.
- Bind each session/call to a prompt ID and exact version; preserve the exact rendered provider prompt or an immutable referenced snapshot.
- Do not reconstruct historical Agent prompts from current source constants.

### M5-WV-024: execution identity omits the confirmed execution payload

Status: open.
Severity: high.

The persisted execution request hash covers only the server-owned tool message content. It does not cover `detailMappings`, `detailCreations`, `createMissingDetailTypes`, or any later grant/confirmation parameters. Those author-confirmed choices can materially change what is written, but the execution record cannot prove which payload won a concurrent claim or produced the result.

Evidence:

- `workshopToolRequestHash(...)` hashes only `message.content`.
- Execute input contains mapping/creation/confirmation fields outside the message content.
- `WorkshopToolExecution` stores no normalized execution input or approval payload hash.

Required repair:

- Compute execution identity from tool request ID/content plus the normalized author-confirmed execution payload.
- Persist the approved payload or its immutable record ID and hash before the first authority write.
- Reuse this identity in M5.6G Tool Plan/Grant/Tool Call records instead of inventing a second incompatible audit model.

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

- `WorkshopWorkspace.tsx`: 3039 lines.
- `apps/server/src/routes/workshop.ts`: 1883 lines.
- `apps/server/src/workshop/codexDraft.ts`: 783 lines.
- `apps/server/test/workshop-routes.test.ts`: 2822 lines.
- `packages/storage/src/index.ts`: 8518 lines.

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

### M5-WV-020: Workshop prompt customization UI is not implemented

Status: open product gap.
Severity: medium.

Workshop prompts are now isolated in the server module, which fixes role leakage, but users cannot yet edit or create Workshop-specific General Chat / Agent prompts from the UI.

Required repair:

- Add a Workshop-specific prompt configuration source that can later be edited from UI without mixing with global non-Workshop roles/templates.
- Preserve historical prompt versions in ModelCallLog/ContextBundle audit.

## Confirmed Honest Deferred State

### M5-WV-019: Import Thread

This is no longer classified as an implementation defect. The control is visibly disabled and has no backend route, which satisfies the project's requirement that deferred controls remain honest. It should stay disabled or absent until a real import contract exists; it must not be described as implemented.

## Planning Consequences

M5 remaining work must not be planned from the deleted audits. Recommended order after this re-audit:

1. Implement M5.6C as a deterministic server schema-planner service: persist embedding use-case bindings, embed existing detail type names/descriptions, score candidates, return ranked suggestions/reasons, and require author confirmation only for unmatched creation.
2. Resolve the immutable Workshop prompt-authority dependency before durable Agent run persistence. Otherwise M5.6D would persist runs against mutable code constants that cannot reproduce historical prompts.
3. Implement M5.6D durable Agent runs/steps using provider structured output where available, explicit malformed-output repair, pause-for-confirmation, tool result continuation, and startup reconciliation. Delete the English regex draft-rewrite fallback after equivalent tests pass.
4. Complete M5.6E capability cleanup: prompt scope/session binding, per-message branching, context-kind quarantine, legacy mode removal/migration, turn-aware deletion, copy/i18n, and module splits.
5. Implement M5.6G Tool Plan/Grant/Tool Call records by reusing the NS-507 command adapters and execution identity. Add approved Codex/Write tool definitions, grant scope/expiry, renewed approval for changed plans, partial-failure state, stale-target refusal, and Proposal fallback.
6. Only after those foundations pass adversarial and restart tests should M5.7 Council, final state sweep, responsive behavior, and user visual acceptance begin.

The original M5.6 requirements are not deleted. They are classified in `docs/tasks/M5.md` as kept, partially started, or replaced. The replaced part is the old monolithic implementation order, not the Tool Plan/Grant product requirement.
