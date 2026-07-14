# NS-510 Agent Runtime Reference And Implementation Path

Status: active reference
Created: 2026-07-13
Task: `docs/tasks/NS-510.md`

## Purpose And Authority

This document records a source-level study of established open-source agent runtimes and turns that evidence into an implementation path for Novel Studio's Workshop Agent. It covers the complete runtime boundary, not only the current structured-response failure.

This document is implementation guidance, not product authority. `docs/product/PRODUCT_SPEC.md`, `docs/product/AI_EDITORIAL_SYSTEM.md`, accepted ADRs, and the active task remain authoritative. Where a reference project conflicts with Novel Studio's durable Grants, Proposal safety, project JSON authority, privacy rules, or author-facing behavior, Novel Studio's specifications win.

## Frozen Reference Revisions

The findings below were verified against these exact source revisions:

| Project | Repository | Revision | Verified source areas |
| --- | --- | --- | --- |
| Hermes Agent | <https://github.com/NousResearch/hermes-agent> | [`acb3bde097cb854b038ca818c3d2437e3c29802c`](https://github.com/NousResearch/hermes-agent/tree/acb3bde097cb854b038ca818c3d2437e3c29802c) | conversation loop, normalized transports, replay cleanup, retries, tool guardrails, approval and staged writes, compression |
| OpenCode | <https://github.com/anomalyco/opencode> | [`f47684787ad07e5311bd9422c1a9eb70c9966274`](https://github.com/anomalyco/opencode/tree/f47684787ad07e5311bd9422c1a9eb70c9966274) | production session loop and processor, retry policy, run state, tool registry, permissions, message projection, structured output, V2 coordinator work |

Provider behavior was checked against official documentation:

- DeepSeek JSON Output: <https://api-docs.deepseek.com/guides/json_mode/>
- DeepSeek Chat Completion API: <https://api-docs.deepseek.com/api/create-chat-completion>
- DeepSeek Tool Calls: <https://api-docs.deepseek.com/guides/tool_calls>
- DeepSeek Thinking Mode: <https://api-docs.deepseek.com/guides/thinking_mode>
- OpenAI Chat Completions API: <https://platform.openai.com/docs/api-reference/chat>

The local reference clones used for inspection are disposable evidence under `D:\tmp`; they are not Novel Studio dependencies and must not be imported into the product.

## Executive Finding

The current Workshop Agent contract is built around the wrong abstraction. Every Agent response is forced through a local union such as `respond | request_tool`. This converts ordinary conversation into a schema-validation problem and makes a harmless prose reply capable of terminating the run.

Hermes Agent and OpenCode both use a different boundary:

1. Ordinary assistant language is ordinary assistant text.
2. Tool invocation is carried by the Provider's tool-call protocol and validated as a tool call.
3. A tool result is appended to the same run, after which the runtime automatically asks the model to continue.
4. Structured final output is an explicit, opt-in operation, not the envelope for every turn.
5. Recoverable failures become retry state or model-visible tool results; they do not silently end the chain.

Novel Studio should adopt that separation. More prompt rules or a larger `respond | request_tool` schema would preserve the root defect.

## Source Findings

### Hermes Agent

Primary source paths at the frozen revision:

- [`agent/conversation_loop.py`](https://github.com/NousResearch/hermes-agent/blob/acb3bde097cb854b038ca818c3d2437e3c29802c/agent/conversation_loop.py)
- [`agent/transports/types.py`](https://github.com/NousResearch/hermes-agent/blob/acb3bde097cb854b038ca818c3d2437e3c29802c/agent/transports/types.py)
- [`agent/transports/base.py`](https://github.com/NousResearch/hermes-agent/blob/acb3bde097cb854b038ca818c3d2437e3c29802c/agent/transports/base.py)
- [`agent/replay_cleanup.py`](https://github.com/NousResearch/hermes-agent/blob/acb3bde097cb854b038ca818c3d2437e3c29802c/agent/replay_cleanup.py)
- [`agent/turn_retry_state.py`](https://github.com/NousResearch/hermes-agent/blob/acb3bde097cb854b038ca818c3d2437e3c29802c/agent/turn_retry_state.py)
- [`agent/tool_guardrails.py`](https://github.com/NousResearch/hermes-agent/blob/acb3bde097cb854b038ca818c3d2437e3c29802c/agent/tool_guardrails.py)
- [`tools/approval.py`](https://github.com/NousResearch/hermes-agent/blob/acb3bde097cb854b038ca818c3d2437e3c29802c/tools/approval.py)
- [`tools/write_approval.py`](https://github.com/NousResearch/hermes-agent/blob/acb3bde097cb854b038ca818c3d2437e3c29802c/tools/write_approval.py)

Verified behavior:

- A complete author turn is an iterative loop with a bounded iteration budget, not one request followed by one response.
- The Provider transport normalizes text, reasoning, finish reason, usage, tool calls, and Provider-specific replay metadata without merging them into one JSON envelope.
- Transport retries and agent-loop retries are separate. Transient Provider failures use bounded, interruptible backoff; malformed tool behavior is handled inside the active loop.
- Invalid tool names can receive bounded fuzzy repair. Invalid arguments become tool-error messages that the model can correct on the next step.
- The assistant tool-call message is recorded before tool side effects are executed.
- Tool results are appended and the loop continues without another author message.
- Replay cleanup distinguishes incomplete read-only calls from side-effecting calls whose effect is unknown. Unknown writes are not silently replayed.
- Tool guardrails detect repeated calls, repeated failures, and no-progress loops.
- Approval has request identity, scope, timeout, and explicit outcomes. Staged writes fail closed when approval is absent.
- Context compression is part of the runtime lifecycle, rather than an unrelated UI operation.

Constraint: Hermes' main conversation loop is a large monolith. Novel Studio should adopt its runtime invariants, not copy its file structure. Hermes also keeps important pending approval state in memory; Novel Studio requires durable Grant authority and therefore cannot copy that storage choice.

### OpenCode Production Runtime

Primary source paths at the frozen revision:

- [`packages/opencode/src/session/prompt.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/src/session/prompt.ts)
- [`packages/opencode/src/session/processor.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/src/session/processor.ts)
- [`packages/opencode/src/session/retry.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/src/session/retry.ts)
- [`packages/opencode/src/session/run-state.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/src/session/run-state.ts)
- [`packages/opencode/src/session/tools.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/src/session/tools.ts)
- [`packages/opencode/src/session/message-v2.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/src/session/message-v2.ts)
- [`packages/opencode/src/permission/index.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/src/permission/index.ts)

Verified behavior:

- The production session loop rebuilds canonical message history on every step and continues after tools until it reaches a real terminal condition.
- Normal assistant text is streamed and persisted as text parts. Tool calls have independent lifecycle parts: pending, running, completed, or error.
- Tool calls are persisted before execution. Unsettled calls are converted to interrupted errors during cleanup so future history does not contain dangling protocol state.
- A Provider may report a stop finish reason while having emitted tool calls. The runtime checks actual tool parts and continues instead of trusting only the finish reason.
- Provider retry status is observable as busy, retrying, or idle. Retry delay respects retry headers and is cancellable.
- One active run is owned per session. Callers can join, cancel, or wake the run rather than independently starting competing continuations.
- Tools are materialized through a registry with execution context, permission checks, hooks, abort signals, and output truncation.
- Permission requests support allow, ask, deny, one-time approval, persistent matching, rejection, and corrected feedback.
- Structured output is a special terminal tool used only when a caller explicitly requests an output schema. It is not the ordinary conversation protocol.

Relevant regression examples:

- [`packages/opencode/test/session/llm-native-recorded.test.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/test/session/llm-native-recorded.test.ts)
- [`packages/opencode/test/session/message-v2.test.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/test/session/message-v2.test.ts)
- [`packages/opencode/test/session/retry.test.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/test/session/retry.test.ts)
- [`packages/opencode/test/session/structured-output.test.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/opencode/test/session/structured-output.test.ts)

Constraint: OpenCode's permission requests also rely substantially on process memory. Novel Studio must keep durable Tool Plans and Grants in project authority where its product specifications require them.

### OpenCode V2 Direction

The current OpenCode repository also contains a newer coordinator-oriented runtime:

- [`packages/core/src/session/run-coordinator.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/core/src/session/run-coordinator.ts)
- [`packages/core/src/session/execution.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/core/src/session/execution.ts)
- [`packages/core/src/session/runner/llm.ts`](https://github.com/anomalyco/opencode/blob/f47684787ad07e5311bd9422c1a9eb70c9966274/packages/core/src/session/runner/llm.ts)

This code demonstrates a useful target boundary:

- execution is serialized by session key while different sessions can run concurrently;
- routes write durable input and wake a coordinator;
- the coordinator owns continuation and cleanup;
- tool calls are events persisted before parallel side effects;
- history is reprojected from durable events before the next model step.

The V2 source explicitly marks durable continuation recovery, complete retry/status behavior, and some loop bounds as unfinished. It is architectural evidence, not proof of completed production behavior. Novel Studio should combine this coordinator boundary with the proven failure handling in the production OpenCode runtime and Hermes.

## Feature Matrix

| Capability | Hermes Agent | OpenCode production | OpenCode V2 direction | Current Workshop | Novel Studio target |
| --- | --- | --- | --- | --- | --- |
| Ordinary prose | Native assistant text | Native assistant text | Native assistant events | Forced through `respond` schema | Native assistant text |
| Tool request | Provider tool call | Provider tool call | Persisted tool event | `request_tool` JSON envelope | Provider tool call with validated command adapter |
| Tool continuation | Same loop | Same loop | Coordinator wake | Route calls continuation and can swallow failure | Coordinator resumes from durable result |
| Structured output | Separate behavior | Explicit terminal tool | Event/tool boundary | Required on every Agent step | Explicit opt-in only |
| Tool lifecycle | Call, execute, result | pending/running/completed/error | Persist then execute | Partial message/run state | Durable call/result state machine |
| Provider retry | Bounded backoff/fallback policy | Typed bounded backoff | Planned | Incomplete and coupled to schema repair | Typed, bounded, observable, cancellable |
| Invalid tool args | Tool error and self-correction | Tool error part | Planned | Schema failure can terminate run | Tool error and automatic bounded continuation |
| Confirmation | Approval/write staging | Permission request | Event-driven candidate | Route-owned confirmation/continuation | Durable Grant then coordinator wake |
| Restart recovery | Replay cleanup with unknown-effect state | Interrupted tool cleanup | Durable event target | Incomplete | Deterministic recovery without replaying unknown writes |
| Loop guards | Iteration and repeat guards | Step and doom-loop guards | Planned | Partial | Step, attempt, repeated-call, and no-progress budgets |
| Session concurrency | Loop instance | One active run per session | Explicit coordinator | Route-driven | Serialized per session, concurrent across sessions |
| Audit/export | Conversation/provider metadata | Message/part events | Event projection | Reconstructed and duplicated prompt history | Exact attempt snapshots and events once |
| Context compression | Integrated | Integrated | Event projection target | Separate/incomplete | Runtime-owned compaction with audit boundary |
| Provider capability model | Transport-specific | Model/tool capability checks | Transport boundary | One `structuredOutput` boolean | Granular text, JSON, schema, tool, reasoning capabilities |

## Target Runtime Model

### Identity And State

The runtime must distinguish these identities:

| Identity | Meaning |
| --- | --- |
| Session | Durable General Chat or Agent conversation selected at chat creation |
| Run | One author-triggered Agent execution that may contain many model and tool steps |
| Turn | One logical author-to-final-assistant exchange inside a run |
| Step | One Provider invocation and its emitted assistant/tool events |
| Attempt | One transport attempt or semantic repair attempt for a step |
| Tool call | One Provider request to invoke a named tool with arguments |
| Tool execution | One command-side attempt tied to a validated tool call and exact Grant |

Failures, retries, exports, and UI status must be attached to the correct identity. A transport retry is not a new author turn. A tool correction is not a new run. A user retry after exhausted semantic repair adds an attempt to the same run and does not synthesize a second author message.

### Event And Projection Boundary

The durable history should support events or equivalently normalized records for:

- author message accepted;
- run created, busy, waiting for approval, retrying, completed, failed, cancelled;
- model attempt started and completed;
- reasoning summary/reference emitted, subject to Provider and privacy policy;
- assistant text delta/finalized;
- tool call proposed;
- tool call validated or rejected;
- Grant requested, accepted, rejected, expired, or stale;
- tool execution started, succeeded, failed, or effect unknown;
- tool result appended;
- context compacted;
- recovery performed.

The model history, UI message list, prompt audit, and restart state should be projections from the same normalized records. Export must not reconstruct a continuation prompt from the initial ContextBundle or duplicate one model call for every related message.

### Provider Response Contract

Replace a universal structured step with a normalized Provider event/result contract:

```ts
type ProviderEvent =
  | { type: "text_delta"; text: string }
  | { type: "reasoning_delta"; text: string; replayToken?: string }
  | { type: "tool_call_delta"; callId: string; name?: string; argumentsDelta?: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "completed"; finishReason: ProviderFinishReason; providerMetadata?: unknown };

type NormalizedAssistantStep = {
  text: string;
  reasoning?: ProviderReasoningRecord;
  toolCalls: NormalizedToolCall[];
  finishReason: ProviderFinishReason;
  usage?: TokenUsage;
  replayMetadata?: ProviderReplayMetadata;
};
```

Provider-specific metadata needed for replay must be preserved internally and redacted from ordinary UI. DeepSeek thinking mode, for example, requires reasoning content to be replayed with the assistant tool-call message on the subsequent request. The transport owns that conversion; Workshop business logic must not special-case each Provider.

### Capability Model

The existing `structuredOutput` capability is too broad. It conflates valid JSON syntax, application schema conformance, native tool calls, and strict tool schemas. Replace it with explicit capabilities such as:

```ts
type ModelCapabilities = {
  streamText: boolean;
  reasoning: "none" | "separate" | "interleaved";
  jsonObject: boolean;
  jsonSchema: boolean;
  nativeToolCalls: boolean;
  strictToolSchema: boolean;
  parallelToolCalls: boolean;
  toolChoice: "none" | "auto" | "required" | "named";
  streamingToolArguments: boolean;
  providerExecutedTools: boolean;
  tokenEstimate: boolean;
  usage: boolean;
  modelList: boolean;
};
```

Capability selection must be explicit per Provider and model. There is no silent Provider fallback. A model without native tool calls can still run General Chat. It must not pretend to execute Workshop tools. Emulated tool calling would require a separate product decision, protocol, and test matrix.

### Tool Registry And Command Boundary

Workshop tools should be registered as data rather than embedded in one prompt or route:

```ts
type WorkshopToolDefinition<Input, Result> = {
  name: string;
  description: string;
  inputSchema: ZodSchema<Input>;
  permission: "read" | "proposal" | "confirmed-write";
  sideEffect: "none" | "idempotent" | "non-idempotent";
  execute(context: ToolExecutionContext, input: Input): Promise<Result>;
};
```

The registry exposes only tools allowed by session mode, project state, model capability, and author permissions. Tool descriptions explain the positive operation and required inputs. They are not a second system prompt filled with lists of prohibited hallucinations.

Codex tools continue to use the existing domain command adapters. The agent runtime does not write project JSON directly. Tool validation includes schema, referenced authority IDs, revision/checksum, and command-specific invariants before a Grant can execute the write.

### Agent Loop

The coordinator owns the run. Routes append input, confirm a Grant, request retry, cancel, or wake the coordinator; routes do not implement continuation themselves.

```text
resume(sessionId, runId):
  acquire the session run lease
  recover interrupted state

  while step budget remains:
    project canonical model history
    invoke Provider with available tool definitions
    persist normalized text, reasoning, usage, and tool-call events

    if the step has no tool calls:
      finalize assistant text and complete the run
      return

    for each tool call:
      persist the call before any side effect
      validate name and arguments

      if validation fails:
        append a model-visible tool error
        continue the loop within the correction budget

      if confirmation is required and no exact Grant exists:
        persist waiting-for-approval state
        return

      execute the domain command once
      persist success, failure, or unknown-effect result
      append the tool result to model history

    continue the loop automatically

  persist a retryable step-budget terminal state
```

The loop determines terminal state from emitted content and tool parts, not only a Provider finish-reason string. A tool call always settles as success, error, rejected, interrupted, or effect unknown before it is projected into a subsequent model request.

### Confirmation And Grant Flow

The target confirmation path is:

1. Persist the normalized tool call and validated command payload.
2. Present an author-facing change summary based on that exact payload.
3. Author confirmation creates or activates a durable Grant tied to session, run, tool call, normalized payload hash, authority revision, and permission scope.
4. The route records the decision and calls `coordinator.wake(sessionId)`.
5. The coordinator reprojects current state, verifies that the Grant is still exact and current, executes the command, records the result, and continues the model loop.

A route-level `try/catch` must not swallow continuation and leave a successful command with a dead run. If the HTTP client disconnects after confirmation, the durable wake/run state still permits the coordinator or recovery worker to continue.

### Retry And Failure Taxonomy

Retries must be classified by layer. One generic retry counter is insufficient.

| Failure | Runtime behavior |
| --- | --- |
| Network timeout, connection reset, retryable 5xx, rate limit | Automatic bounded Provider retry with jitter, `Retry-After` support, visible retry state, and cancellation |
| Authentication, invalid model, unsupported capability | Terminal configuration error; no silent model or Provider fallback |
| Empty or truncated Provider response | Automatic bounded same-step retry when Provider policy marks it recoverable |
| Invalid native tool name | Append bounded model-visible tool error; permit correction in the same run |
| Invalid tool arguments | Append validation details safe for the model; permit correction in the same run |
| Domain command validation failure | Persist tool error result and continue so the model can explain or choose another valid action |
| Grant missing | Pause in waiting-for-approval; do not ask the model to invent permission |
| Grant denied or expired | Persist explicit tool result and follow product policy for continuation or terminal cancellation |
| Ordinary explicit structured-output schema mismatch | One evidence-based semantic repair; if exhausted, keep the same run retryable without a new author message |
| Process crash before side effect | Recover and execute only after state and Grant revalidation |
| Process crash after side effect, before result record | Mark effect unknown; inspect authority/idempotency evidence before any retry |
| Repeated identical tool call/result or repeated failure | Warn within a small threshold, then stop with a retryable no-progress state |
| Step/attempt budget exhausted | Persist retryable terminal state with exact last failure; never spin indefinitely |

Automatic retries must preserve attempts, prompts, Provider metadata, usage, and outcomes for audit. They must not duplicate author messages or committed side effects.

### Concurrency, Wake, Cancel, And Steering

- Only one active coordinator run may mutate one session at a time.
- Different sessions may run concurrently.
- A second request for an active run joins or wakes it; it does not start a competing loop.
- Cancellation propagates through an abort signal to Provider streaming and tool execution where safe.
- Cancellation does not erase persisted partial text or tool state.
- New author input during an active run follows an explicit queue/steer policy. It is never silently spliced into the current Provider request.
- General Chat and Agent sessions remain isolated because their mode is fixed at chat creation.

### Context, Prompt, And Compaction

The Workshop prompt boundary should remain in its dedicated Workshop prompt authority. Runtime assembly should add:

- the selected General Chat or Agent role;
- project and selected context records;
- canonical projected conversation history;
- available tool definitions for Agent mode;
- Provider replay metadata required by the active transport.

It should not inject obsolete generic agent roles, template audit commentary, or invented researcher identity. Prompt instructions guide writing and conversation behavior; command schemas and server-side validation enforce tool behavior.

Compaction must be run-aware. It preserves unresolved tool calls, Grants, current authority references, and the recent conversational tail. The summary is a durable context artifact with source boundaries, not a replacement for audit events. Compaction cannot remove the evidence needed to decide whether a side effect occurred.

### Persistence And Recovery

On process start or explicit retry, recovery should:

1. Find runs left in busy, retrying, or executing states.
2. Settle incomplete Provider attempts as interrupted.
3. Classify incomplete tools by side-effect policy and authority evidence.
4. Expire stale confirmations and Grants.
5. Reproject canonical history without dangling tool calls.
6. Resume only states proven safe; mark unknown effects for inspection.

Idempotency keys should bind run, tool call, command payload, and authority revision. An existing committed command result is returned to the loop rather than applied twice.

### Streaming And UI State

The UI should observe normalized run state instead of inferring it from prose:

- `busy`: model or tool work is active;
- `waiting_for_approval`: an exact action awaits author confirmation;
- `retrying`: an automatic attempt is scheduled or running;
- `retryable`: automatic budgets are exhausted and the author may retry the same run;
- `completed`: final assistant output settled;
- `failed`: a non-retryable configuration or invariant failure occurred;
- `cancelled`: the author cancelled the run.

Assistant text, tool state, and retry status may update incrementally. Internal invocation IDs, hashes, raw Provider payloads, and private reasoning remain outside normal author-facing copy. A retry control invokes the same run; it does not send a hidden `?` or synthetic message.

### Audit And Export

Prompt audit and session export are separate views over exact durable records:

- session export includes only the selected session and its branch lineage;
- attachments are listed by metadata, not embedded;
- each author or assistant message appears once;
- each model attempt appears once with the exact system/context/history/tool snapshot or an immutable reference to it;
- initial, continuation, repair, and retry attempts are distinguishable;
- tool calls, confirmation decisions, command results, and terminal state are ordered correctly;
- reasoning is included only when the author selects it and the Provider supplied an allowed reasoning record;
- secret headers, credentials, complete private manuscript payloads outside selected messages, and raw unredacted requests are never exported.

### Subagents And Council

Future Council or specialist Agent work should build on the same coordinator instead of creating a second execution architecture. A subagent is a child run with:

- explicit parent run and objective;
- bounded context and tool set;
- independent step/attempt budget;
- cancellation propagation;
- durable child output returned as a tool result;
- no direct write authority unless separately granted.

NS-510 does not implement Council, but its runtime must not make Council depend on route recursion or synthetic user messages.

## Proposed Module Boundaries

Names may change to match repository conventions, but ownership should be explicit:

| Component | Responsibility |
| --- | --- |
| `WorkshopAgentCoordinator` | One active run per session, wake/join/cancel, lifecycle state, recovery entry point |
| `WorkshopAgentLoop` | Step budget, history projection, terminal decisions, automatic continuation |
| `WorkshopProviderTransport` | Provider requests, normalized events, replay metadata, transport retry classification |
| `WorkshopToolRegistry` | Available tools, schemas, permission and side-effect metadata |
| `WorkshopToolExecutor` | Validation, Grant verification, idempotent domain-command execution, result settlement |
| `WorkshopGrantService` | Durable confirmation request and exact Grant lifecycle |
| `WorkshopContextAssembler` | Prompt authority, project context, history, tools, compaction boundary |
| `WorkshopAgentStore` | Runs, steps, attempts, events, calls, results, and atomic state transitions |
| `WorkshopAgentProjector` | Model history, UI messages/status, restart state, and export projections |
| `WorkshopAgentRecovery` | Interrupted attempt/tool classification and safe resume |
| `WorkshopSessionExport` | Session-scoped human export and optional prompt/reasoning audit |

Routes remain thin orchestration boundaries. They authenticate project/session access, validate request shape, append intent or confirmation, wake the coordinator, and return observable state.

## Migration Path

### Phase 0: Freeze Evidence And Add Failing Regressions

- Preserve the real exported reproduction as a redacted test fixture or equivalent sequence.
- Add regressions for ordinary prose, tool call, confirmation, tool result, continuation, invalid tool arguments, Provider failure, and retry without a new author message.
- Record exact current storage migrations required before changing authority records.

### Phase 1: Split Provider Capabilities And Normalized Responses

- Replace the single structured-output capability with granular model capabilities.
- Add native tool definitions/tool-call response types to `packages/ai`.
- Implement DeepSeek/OpenAI-compatible tool-call request and response conversion, including streaming argument assembly and reasoning replay metadata where applicable.
- Keep `generateObject` only for explicitly requested structured outputs.

### Phase 2: Introduce Durable Loop And Coordinator

- Add run/step/attempt/tool state transitions behind storage interfaces.
- Move continuation ownership out of HTTP routes.
- Reproject history on every step.
- Persist tool calls before execution and settle every call.
- Keep current Codex domain command adapters as the write boundary.

### Phase 3: Durable Confirmation And Recovery

- Bind confirmation to exact payload and revision.
- Confirm by recording Grant plus coordinator wake.
- Add idempotency and unknown-effect recovery.
- Add startup/manual resume for interrupted runs.

### Phase 4: Retry, Guardrails, And Cancellation

- Add typed Provider retry policy with cancellable backoff.
- Add tool correction, structured-output repair, repeated-call, and no-progress budgets.
- Expose retryable state and same-run retry command.
- Ensure command failures can continue to a final assistant explanation.

### Phase 5: Projection, UI, And Export

- Stream normalized status and message/tool parts to the existing Workshop UI.
- Replace prose-derived failure state with run state.
- Export exact selected-session attempts, calls, and optional reasoning once.
- Remove reconstructed prompts and duplicated model-call records.

### Phase 6: Provider Breadth And Compaction

- Implement the same transport contract for each supported Provider according to declared capabilities.
- Add run-aware compaction and restart tests.
- Do not enable an Agent write workflow on a model without proven native tool support.

## Acceptance And Adversarial Matrix

The implementation must eventually prove at least these scenarios:

1. Agent mode can hold a multi-turn writing discussion using plain assistant text and no tool call.
2. A valid Codex create call waits for confirmation, executes once, receives its result, and produces a natural follow-up without another author message.
3. Invalid tool arguments produce a tool error and the model corrects them inside the same run.
4. Repeated invalid corrections exhaust a bounded budget and expose same-run retry without synthesizing an author message.
5. A command-domain failure reaches the model as a tool result and does not silently stop the loop.
6. Rate limit, retryable 5xx, timeout, empty content, truncated output, and cancellation follow their classified policies.
7. Authentication, unsupported model, and unsupported tool capability fail without silent Provider fallback.
8. A process crash before a write resumes safely; a crash after a possible write does not blindly replay it.
9. A client disconnect after confirmation cannot strand a successful command with no continuation.
10. Concurrent requests for one session serialize while separate sessions remain concurrent.
11. Approval denial, expiration, stale revision, and payload mismatch cannot execute a write.
12. Repeated identical calls/results and no-progress loops terminate within explicit budgets.
13. Context compaction preserves unresolved tool and authority evidence.
14. DeepSeek thinking-mode continuation replays required reasoning metadata with tool calls.
15. Selected-session export contains each prompt, model attempt, message, tool call, and result once; attachment bodies remain omitted.
16. General Chat keeps its existing no-tool behavior and cannot inherit Agent run state.

## Immediate NS-510 Priority

The blocking order is:

1. Stop requiring a structured `respond` envelope for ordinary Agent conversation.
2. Add native tool-call support to the DeepSeek/OpenAI-compatible Provider path and preserve required replay metadata.
3. Move post-confirmation continuation from route-local recursion into a session-scoped run coordinator/wake path.
4. Add bounded transport, tool-correction, and same-run retry behavior with exact attempt audit.
5. Correct session export to project durable attempts rather than reconstruct prompts.

NS-512 remains the owner of the broader durable Tool Plan/Grant product surface and additional mutation tools. NS-510 must nevertheless establish the coordinator, normalized tool lifecycle, and recovery boundaries that NS-512 will extend; otherwise NS-512 would be built on the same route-driven dead-chain architecture.

## Rejected Approaches

- Expanding the current structured response prompt with more prohibitions.
- Treating every Agent answer as JSON because some Providers support JSON mode.
- Parsing prose for `Tool Call:` markers.
- Retrying schema validation forever until a response passes.
- Returning a failure message while abandoning the active run.
- Asking the author to send another message to continue after an internal recoverable failure.
- Letting HTTP routes recursively own model continuation.
- Replaying a side-effecting tool after restart without proving whether it committed.
- Silently switching Provider or model when the selected model lacks a capability.
- Copying reference-project in-memory permission state where Novel Studio requires durable Grants.
