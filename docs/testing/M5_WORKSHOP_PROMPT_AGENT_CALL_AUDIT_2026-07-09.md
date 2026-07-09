# M5 Workshop Prompt And Agent Call Audit

Date: 2026-07-09
Status: first repair slice command-verified; findings 1, 2, the pending Codex draft follow-up gap in finding 3, and the overstatement in 11 are repaired for the author-only/provider-context boundary
Scope: Workshop prompt definitions, ContextBundle assembly, provider request assembly, Agent structured-step parsing, public message creation, tool execution entry points, frontend payloads, session export, tests, and documentation claims.

This document exists because the current chat audit identified prompt/call-chain defects that must survive context compaction. It is not the primary acceptance record; `docs/testing/M5_ACCEPTANCE.md` records command evidence.

## Repair Evidence 2026-07-09

Completed in this repair slice:

- Public `CreateWorkshopMessageInputSchema` now accepts only `role: "author"`.
- The public Workshop message route and `ProjectRepository.createWorkshopMessage` therefore reject client-created `assistant`, `tool`, `system`, and `result` messages.
- Server-owned `assistant` and `tool` messages continue through `saveWorkshopAssistantTurn` / `saveWorkshopMessage`.
- `codex.create_entry` and `codex.update_entry` execution result messages now use `saveWorkshopMessage`, not the public author-message helper.
- Agent and General Chat provider-bound ContextBundles filter `role-instruction`, `prompt-template`, and `user-request` from the context items sent to the model; these items can remain in saved ContextBundles for audit.
- Session export prompt audit uses the same provider-context filtering so reconstructed provider context matches the runtime behavior.

Command evidence:

- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run test -w @novel-studio/contracts -- test/workshop.test.ts`: passed, 1 file / 12 tests.
- `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts`: passed, 1 file / 14 tests.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 23 tests.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `npm.cmd run build -w @novel-studio/storage`: passed.

Additional pending-draft follow-up evidence:

- Agent ContextBundle assembly now derives a `pending-codex-draft` item from the latest unexecuted Agent Codex tool message and sends it only for Agent calls.
- Follow-up author edits to a pending Codex draft can produce a revised server-owned tool request in the same Agent session instead of forcing the author to restate or manually create data.
- Direct structured tool JSON from a provider is parsed as an Agent tool request instead of being saved as assistant prose.
- The real-provider test harness `.hermes/workshop-real-api-test.mjs` starts the current server source, creates a new Agent session, sends 10 English turns through the existing DeepSeek credential, deliberately passes stale `lead-writing-partner` / old prompt-template input fields, and verifies that the server still uses `workshop-agent` plus the Workshop Agent prompt.
- Real 10-turn result on 2026-07-09: passed. Required tool turns 3, 5, 6, 8, and 10 all produced tool messages; review-only turns did not force a tool; total tool messages: 6; revision tool messages after the first draft: 5; no old prompt/role leakage; export without reasoning contained no reasoning.
- The temporary `Real API Clean...` test sessions, messages, context bundles, and model calls were removed after the run.
- `npm.cmd run test -w @novel-studio/server -- test/workshop-routes.test.ts`: passed, 1 file / 25 tests.
- `npm.cmd run test -w @novel-studio/contracts`: passed, 3 files / 22 tests.
- `npm.cmd run build -w @novel-studio/contracts`: passed.
- `npm.cmd run build -w @novel-studio/server`: passed.
- `git diff --check`: passed with Windows line-ending warnings only.

Still open:

- Durable multi-step Agent runner.
- Structured-output/tool-schema generation and repair/retry loop.
- Idempotent and atomic Tool Plan / command-adapter execution.
- Stale entry baselines for `codex.update_entry`.
- Progression target/scene binding hardening.
- Embedding-backed detail type recommendation.
- General Chat system prompt session policy.
- Legacy mode/helper quarantine.

## Closure Boundary

- Authoritative prompt sources:
  - Global user-created `AgentRole` / `PromptTemplate`.
  - Workshop-specific General Chat and Agent prompt definitions.
- Read paths:
  - Context preview / ContextBundle assembly.
  - Workshop call and stream routes.
  - Provider adapters that convert `ProviderPrompt` plus `ContextBundle` into actual model requests.
  - Session export prompt/context reconstruction.
- Write paths:
  - Public Workshop message creation route.
  - Server-owned assistant/tool/result message save paths.
  - Limited `codex.create_entry` and `codex.update_entry` execute routes.
- Derived records:
  - ModelCallLog.
  - ContextBundle.
  - Workshop chat history context item.
  - Export prompt audit.
- User-visible entry points:
  - Workshop Chat and Agent sessions.
  - Agent tool confirmation cards.
  - General Chat edit/resend.
  - Session export.
- Test/doc boundary:
  - Contract, server, storage, web tests around Workshop calls and tools.
  - M5 task and acceptance records that claim server-owned tool behavior.

## Findings

### 1. Public message creation can forge server-owned roles

Severity: Critical
Repair status: Repaired in the 2026-07-09 first repair slice.

The public Workshop message creation API accepts all message roles, including `assistant`, `system`, `tool`, and `result`. Storage then persists `input.role` directly. This breaks the claimed boundary that Agent tool messages are server-owned.

Evidence:

- `packages/contracts/src/workshop.ts:38` allows `author | assistant | system | tool | result`.
- `packages/contracts/src/workshop.ts:245` uses `WorkshopMessageRoleSchema` in `CreateWorkshopMessageInputSchema`.
- `apps/server/src/routes/workshop.ts:755` exposes public `POST /workshop/sessions/:sessionId/messages`.
- `packages/storage/src/index.ts:4281` saves `role: input.role`.

Impact:

- A client can directly create a `role: "tool"` Agent message and then call the execute route.
- A client can create `system` or `assistant` history that later enters `workshop-chat-history`.
- Documentation and tests saying "server-owned role: tool" are overstated.

Required repair direction:

- Split public author-message creation from server-internal message persistence.
- Public route should accept only author messages, with mode constrained by session kind.
- Tool/result/system/assistant messages must only be created by server call/runner paths.
- Add server/storage tests proving public API rejects forged non-author roles.

### 2. Agent prompt and user request are duplicated in the actual provider input

Severity: High
Repair status: Repaired in the 2026-07-09 first repair slice.

The Workshop Agent prompt is placed into the ContextBundle as `role-instruction`, then also sent as `ProviderPrompt.system/instructions`. Provider adapters send both the prompt and the ContextBundle item text. General Chat has a filter for prompt/user context items, but Agent currently does not.

Evidence:

- `apps/server/src/routes/context.ts:461` creates a `role-instruction` item from `systemPromptOverride`.
- `apps/server/src/routes/workshop.ts:274` builds Workshop provider prompt.
- `apps/server/src/routes/workshop.ts:294` filters prompt context items only for General Chat.
- `packages/ai/src/openAiCompatibleProvider.ts:227` sends prompt system/instructions.
- `packages/ai/src/openAiCompatibleProvider.ts:232` sends `contextItemsText(contextBundle)`.

Impact:

- Agent role instructions and user request can be sent twice.
- Prompt weighting becomes accidental.
- Export prompt audit mirrors this duplicate behavior for Agent.

Required repair direction:

- Filter `role-instruction`, `prompt-template`, and `user-request` from Agent provider ContextBundle as well.
- Keep those items in saved ContextBundle for audit only if needed, but not in the provider payload.
- Update export reconstruction to match the actual filtered provider context.
- Add provider-request regression verifying Agent request contains the Agent prompt once and the user request once.

### 3. Agent is still a single-step parser, not a durable dialogue agent

Severity: High

The current Agent path buffers one provider response, parses at most one structured JSON step, creates at most one tool request message, and then stops. Tool execution appends a result message but does not feed the result back into an Agent continuation loop.

Evidence:

- `apps/server/src/workshop/workshopAgent.ts:192` parses one `WorkshopAgentStep`.
- `apps/server/src/routes/workshop.ts:1189` calls the parser once.
- `apps/server/src/routes/workshop.ts:1227` creates one tool message if a tool request was parsed.
- Existing audit: `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md:210`.

Impact:

- This is not yet the requested multi-turn, tool-using conversation agent.
- Invalid JSON or unhelpful model output becomes ordinary assistant text instead of controlled repair/retry.
- Tool result cannot be inspected by the Agent and followed by another reply/tool step.

Required repair direction:

- Introduce durable Agent steps/tool requests/tool results.
- Add explicit pause-for-author-confirmation states.
- After tool result, support controlled Agent continuation when the workflow requires it.
- Keep General Chat and Agent histories isolated.

### 4. Tool protocol still depends on prompt compliance

Severity: High

The Agent tool protocol is appended as plain prompt text and JSON examples. The server validates after generation but does not constrain the model before generation through structured-output APIs or a server-side planner.

Evidence:

- `apps/server/src/workshop/workshopPrompts.ts:43` begins the English tool protocol.
- `apps/server/src/workshop/workshopAgent.ts:41` extracts JSON from any fenced block or first/last braces.
- `apps/server/src/workshop/workshopAgent.ts:192` falls back to normal prose when parsing fails.

Impact:

- The model can still produce invalid JSON, unnecessary refusals, fake tool text, or incomplete drafts.
- Prompt text alone cannot enforce Agent behavior.

Required repair direction:

- Use provider structured-output/tool schema where available.
- Add server-side validation plus retry/repair when structured output is malformed.
- Do not treat prompt wording as the only behavior constraint.

### 5. Tool execution remains non-idempotent and non-atomic

Severity: Critical

Existing audit findings remain valid: tool messages are not marked consumed/executed, Codex writes and result-message creation are sequential, and failures can leave partial authority changes.

Evidence:

- `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md:56` non-idempotent tool execution.
- `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md:79` non-atomic composed writes.
- `apps/server/src/routes/workshop.ts:957` creates Codex entry before result message.
- `apps/server/src/routes/workshop.ts:1079` updates Codex entry before progression operations.

Impact:

- Re-executing the same tool request can duplicate writes.
- A user may receive an error after authority data already changed.

Required repair direction:

- Move execution into a command adapter / Tool Plan path with execution records.
- Make execution idempotent by source tool message and request hash.
- Write affected authority records and result/audit state in one transaction or return Proposal/Tool Plan instead.

### 6. `codex.update_entry` can bypass stale entry baselines

Severity: Critical

The Agent update draft does not carry the entry/research base revisions used when drafting. At execute time, the route resolves the current entry and fills current revisions into the update input.

Evidence:

- `apps/server/src/workshop/codexDraft.ts:734` builds update input from draft.
- `apps/server/src/workshop/codexDraft.ts:773` fills current `entry.revision`.
- `apps/server/src/workshop/codexDraft.ts:776` fills current `entry.research.revision`.
- Existing audit: `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md:109`.

Impact:

- A stale Agent draft can overwrite newer Codex changes without conflict.

Required repair direction:

- Store base entry/research revisions in the tool request.
- Reject execution when current revisions differ.

### 7. Progression update/delete scope is too loose

Severity: Critical

Agent update/delete Progression operations only require `progressionId` and `baseRevision`. The route does not verify that the target Progression belongs to the target Codex entry or intended scene.

Evidence:

- `apps/server/src/routes/workshop.ts:561` parses update input from draft.
- `apps/server/src/routes/workshop.ts:593` updates by progression ID.
- `apps/server/src/routes/workshop.ts:599` deletes by progression ID.
- `packages/contracts/src/codex.ts:513` allows `effectiveFromSceneId` mutation in generic update input.
- Existing audit: `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md:130`.

Impact:

- Updating one entry can mutate/delete Progressions belonging to another target.
- Scene-bound history can be corrupted.

Required repair direction:

- Tool drafts need explicit target and scene binding.
- Execution must load the target Progression and verify it belongs to the allowed target/scope.
- Agent-specific updates should not move `effectiveFromSceneId` unless a dedicated operation exists.

### 8. Detail matching still lacks semantic recommendation

Severity: High

The server only supports explicit mappings, stable detail type IDs, and exact normalized label matches. There is no embedding-backed recommendation or mapping UI yet.

Evidence:

- `apps/server/src/workshop/codexDraft.ts:589` resolves draft details.
- `packages/contracts/src/workshop.ts:328` has `detailCreations`, but current route/UI do not implement the intended recommendation flow.
- Existing audit: `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md:178`.

Impact:

- Labels like "外貌" and "外表" can still become duplicate reusable detail types if the author confirms missing type creation.

Required repair direction:

- Use the shared embedding infrastructure as a schema/detail recommendation service.
- Server should suggest candidate mappings first, with scores/reasons.
- Only if no good match exists should it propose new detail type creation.

### 9. General Chat system prompt is not session-scoped

Severity: Medium

The General Chat system prompt is component state, shared across selected chat sessions. Resend also uses the current prompt value, not a prompt setting persisted with the session.

Evidence:

- `apps/web/src/features/workshop/WorkshopWorkspace.tsx:346` stores `generalSystemPrompt` in component state.
- `apps/web/src/features/workshop/WorkshopWorkspace.tsx:1656` sends current `generalSystemPrompt` on resend.
- Existing audit: `docs/testing/M5_WORKSHOP_FUNCTIONAL_AUDIT.md:343`.

Impact:

- Prompt edits in one chat can affect future sends/resends in another chat.

Required repair direction:

- Either make it explicitly global/current-call setting, or persist a per-session prompt setting.

### 10. Legacy modes and Codex Draft parser remain as misleading surface

Severity: Medium

Contracts still expose `continuity-check` and `codex-creation` modes, and old plain `Codex Draft` parser/render helpers remain in the codebase.

Evidence:

- `packages/contracts/src/workshop.ts:49` includes `continuity-check`.
- `packages/contracts/src/workshop.ts:51` includes `codex-creation`.
- `packages/contracts/src/workshop.ts:167` defaults message mode to `continuity-check`.
- `apps/server/src/workshop/codexDraft.ts:336` renders old `Codex Draft`.
- `apps/server/src/workshop/codexDraft.ts:665` parses old `Codex Draft`.

Impact:

- Future contributors can accidentally reconnect deprecated behavior.
- Tests and docs may continue to treat unreachable flows as active.

Required repair direction:

- Remove or clearly quarantine legacy modes/helpers.
- If retained for migration, name them as legacy-only and keep them out of active Workshop Agent paths.

### 11. Documentation overstates current server-owned Agent behavior

Severity: High
Repair status: Repaired for the public role-forgery overstatement in the 2026-07-09 first repair slice. Broader Agent limitations remain open in findings 3-8.

M5 documentation and acceptance records say valid structured Agent steps create server-owned `role: tool` messages. The current public API role forgery path makes that claim false.

Evidence:

- `docs/testing/M5_ACCEPTANCE.md:39` claims only valid structured Agent step can create server-owned `role: tool`.
- `docs/product/REQUIREMENTS_TRACEABILITY.md:88` claims server-owned tool requests.
- `docs/tasks/M5.md:92` claims server-owned role tool request messages.

Impact:

- Later work may rely on an authority boundary that is not implemented.

Required repair direction:

- After repairing the public API boundary, update these claims with precise test evidence.
- Until then, mark this as an overstatement.

## Immediate Repair Order

1. Block public non-author Workshop message creation.
2. Filter Agent provider context so prompt/user request are not duplicated.
3. Add tests for the two repaired boundaries.
4. Update acceptance/status records only with actual command results.
5. Continue later with durable Agent runner and Tool Plan/Grant command adapter.

## Acceptance Mapping For This Repair Slice

- M5-A18: Workshop message persistence remains valid, but public message creation must be restricted to author messages.
- M5-A20: Context assembly remains auditable; provider-bound context must not duplicate prompt/user items.
- M5-A21: Workshop call/provider request body must receive the intended ContextBundle items without hidden duplicate prompt injection.
- M5-A30 - M5-A37: still not implemented. Do not claim Tool Plan/Grant completion from this repair.
