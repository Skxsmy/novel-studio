# M5 Workshop Verified Defect Audit

Date: 2026-07-09
Updated: 2026-07-13
Verified baseline: `6fbabac NS-506 fix(workshop): close tool execution lifecycle gaps`, plus NS-507/NS-508 evidence in their acceptance records
Status: current-source audit for M5 replanning, fully rechecked through NS-508 Detail Schema Planning

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
- M5-WV-006 is closed by NS-508: library-global embedding use-case bindings persist and reload; the Workshop planner uses only the explicitly bound `codex.detail-schema` profile, embeds request-local unmatched labels and same-category reusable type names, returns ranked scores/reasons, leaves ambiguous candidates unselected, and degrades to manual mapping without Provider fallback. Current detail-type authority has no description field, so the planner does not invent one.
- M5-WV-007 is closed by NS-508: every unmatched label requires exactly one author mapping or creation choice. Explicit creation carries the final reusable name and NSFW flag into the confirmation identity and NS-507 atomic command; omitted, duplicate, and cross-category choices are refused before semantic mutation.
- M5-WV-008 is closed by NS-509: one author turn now owns a revision-protected run with ordered model, repair, tool-request, tool-result, and continuation steps. Successful confirmed Codex execution feeds its result into the same run; a later request creates a new waiting-confirmation step. The previous pending-draft keyword rewrite helpers were removed.
- M5-WV-009 is closed by NS-509: profiles declaring structured output call `ProviderAdapter.generateObject` with the Workshop Agent step schema. Malformed output receives at most one recorded repair attempt. Profiles without structured output use strict JSON text parsing with a durable degraded marker and no Provider/model fallback; invalid text never becomes prose or executable protocol.
- M5-WV-022 is closed for execution recovery by NS-509: session-load reconciliation marks unfinished model and tool work interrupted without replay, successful Codex/result writes commit atomically, eligible interruption retries append attempts, and abandon is terminal while preserving history. Proposal conversion remains an explicit NS-512 capability, not an open recovery defect in the limited create/update command path.

## Current Open Defects

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

Status: resolved by NS-510-A05.
Severity: medium.

Workshop now exposes Branch on every eligible settled message and submits that exact `sourceMessageId`; the session-level last-message action remains available.

Evidence:

- Storage, route, and AppShell regressions prove exact-source truncation and reject incomplete Agent protocol prefixes.

Required repair:

- None for this finding.

### M5-WV-012: Legacy `continuity-check` Proposal creation remains reachable only as an old path

Status: resolved by NS-510-A06.
Severity: medium.

The legacy Workshop message-to-Proposal route, client method, and message action have been removed. Existing linked Proposal cards remain readable.

Evidence:

- Route regressions assert the deleted endpoint returns 404.
- AppShell regressions assert neither General Chat nor Agent messages expose `Create Proposal`.

Required repair:

- None for this finding.

### M5-WV-013: Backend context kinds exceed current UI exposure

Status: resolved by NS-510-A06.
Severity: medium.

Workshop basket authority now supports exactly `full-novel`, `full-outline`, `act`, `chapter`, `scene`, and `codex-entry`. Selection remains a dedicated basket field and call attachments remain message-bound records rather than basket refs.

Evidence:

- Contract tests assert the exact enum.
- Storage tests persist and validate all six supported kinds and reject missing targets.

Required repair:

- None for this finding.

### M5-WV-014: Codex grouping labels are duplicated

Status: resolved by NS-510-A06.
Severity: medium.

Codex context navigation now contains only all entries, entries grouped by reusable detail type, and entries grouped by Codex category.

Evidence:

- AppShell regression asserts `Entries by Type` and `Entries by Tag` are absent while Detail and Category paths remain usable.

Required repair:

- None for this finding.

### M5-WV-015: Message deletion is not turn-aware

Status: resolved by NS-510-A07.
Severity: medium.

Workshop deletion now treats one settled General Chat author/reply turn as the minimum unit and does not expose deletion for Agent history.

Evidence:

- Contract, storage, route, and AppShell regressions prove complete-turn deletion.
- Storage atomically removes turn messages, attachments, branch records, and stale child-session source links while preserving later turns.

Required repair:

- None for this finding.

### M5-WV-016: Workshop UI copy remains English-centered

Status: resolved as an explicit implementation-stage locale boundary by NS-510-A08.
Severity: medium.

Workshop chrome is explicitly frozen at `en-US` under the UX rule that permits an English baseline until natural Chinese localization is ready. Static chrome is centralized; editable prompt, author, project, and model content is language-independent.

Evidence:

- `WORKSHOP_UI_LOCALE` defines the current boundary.
- `uiText.test.ts` rejects undeclared non-ASCII static chrome outside the editable default prompt.
- AppShell regressions assert storage/mode field names are not exposed.

Required repair:

- Add a complete natural-Chinese resource through the same boundary in a later localization task; do not translate strings inline in components.

### M5-WV-017: Workshop modules remain too large

Status: partially resolved by NS-510-A09; residual risk remains open.
Severity: medium.

NS-510-A09 established tested ownership boundaries and reduced the two primary runtime modules:

- `WorkshopWorkspace.tsx`: 2965 lines; pure conversation policy is in a 53-line module and presentation helpers are in a 211-line module.
- `apps/server/src/routes/workshop.ts`: 1808 lines; record routes are in a 186-line module and reasoning parsing is in a 95-line module.
- A source-boundary regression prevents record-route duplication and Provider, Agent, or Codex orchestration imports in the record module.

The remaining concentration is still material:

- `apps/server/src/workshop/codexDraft.ts`: 896 lines.
- `apps/server/test/workshop-routes.test.ts`: 3916 lines.
- `apps/web/src/app/AppShell.test.tsx`: 6039 lines.
- `packages/storage/src/index.ts`: 9875 lines.

Required repair:

- Continue frontend extraction by context selector, message stream, composer, settings, Agent tool cards, and service hooks in scoped follow-up tasks.
- Continue server extraction by calls, context, and tool adapters; split broad route tests by route ownership and move storage implementations out of the package root.

### M5-WV-018: Legacy Workshop modes remain in public contracts

Status: resolved by NS-510-A06.
Severity: low.

Workshop authority, API, storage, server, UI, and fixtures now expose exactly `general-chat` and `agent`. The removed modes have no compatibility path because the author confirmed the environment contains no retained data requiring migration.

Evidence:

- Contract tests assert the exact active enum and reject both removed values.
- Route regressions assert calls using either removed value return 400.

Required repair:

- None for this finding.

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

1. Resolve the immutable Workshop prompt-authority dependency before durable Agent run persistence. Otherwise M5.6D would persist runs against mutable code constants that cannot reproduce historical prompts.
2. Implement M5.6D durable Agent runs/steps using provider structured output where available, explicit malformed-output repair, pause-for-confirmation, tool result continuation, and startup reconciliation. Delete the English regex draft-rewrite fallback after equivalent tests pass.
3. Complete M5.6E capability cleanup: prompt scope/session binding, per-message branching, context-kind quarantine, legacy mode removal/migration, turn-aware deletion, copy/i18n, and module splits.
4. Implement M5.6G Tool Plan/Grant/Tool Call records by reusing the NS-507 command adapters and execution identity. Add approved Codex/Write tool definitions, grant scope/expiry, renewed approval for changed plans, partial-failure state, stale-target refusal, and Proposal fallback.
5. Only after those foundations pass adversarial and restart tests should M5.7 Council, final state sweep, responsive behavior, and user visual acceptance begin.

The original M5.6 requirements are not deleted. They are classified in `docs/tasks/M5.md` as kept, partially started, or replaced. The replaced part is the old monolithic implementation order, not the Tool Plan/Grant product requirement.
