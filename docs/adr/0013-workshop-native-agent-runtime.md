# ADR-0013: Workshop Uses A Native Text And Tool Agent Runtime

Status: Accepted
Date: 2026-07-13

## Context

The first Workshop Agent implementation required every model step to match a local `respond | request_tool` JSON union. Ordinary conversation therefore depended on JSON syntax and local schema validation. A successful Codex command was followed by route-owned continuation, and a malformed continuation could leave the run stopped until the author sent another message.

Source-level review of Hermes Agent and OpenCode, frozen in `docs/tasks/NS-510_AGENT_RUNTIME_REFERENCE.md`, confirmed a more reliable boundary: assistant text and Provider tool calls are separate protocol channels; tool results re-enter one bounded session run; continuation is owned by a run coordinator; structured final output is an explicit operation rather than the shape of every reply.

## Decision

1. Ordinary Workshop Agent replies use normalized assistant text. They are not wrapped in a required application JSON object.
2. Agent tools are declared through a registry and sent through the selected Provider's native tool-call interface. Simulated calls in prose or fenced JSON are never executable.
3. The Provider layer normalizes assistant text, reasoning/replay metadata, tool calls, finish reason, and usage. JSON object generation remains a separate method for explicitly structured tasks.
4. One session-scoped coordinator owns each active run, including Provider attempts, tool validation, confirmation waits, tool results, retries, cancellation, and continuation. HTTP routes append intent or decisions and wake/join the coordinator.
5. Tool calls are persisted before side effects. Confirmed writes remain bound to validated domain commands, exact payload/revision protection, and the product's Proposal/Grant boundaries.
6. Transport retry, tool correction, explicit structured-output repair, and no-progress limits have separate bounded policies. Exhausted recoverable work remains retryable in the same run without a synthetic author message.
7. Provider/model capabilities distinguish native tool calling from JSON syntax/schema support. Models without native tool calling may converse but receive no write tools.

## Authority And Compatibility

Project JSON remains authoritative. This ADR does not authorize direct model writes, silent Provider fallback, automatic network research, or replay of an uncertain side effect.

The initial migration is additive and staged. Existing Workshop run records remain readable. `historySnapshot` is introduced as a read-time migration with an empty-array default for legacy steps; `retry` is added to the step-kind enum; new model steps persist the exact normalized Provider history. Older readers ignore `historySnapshot`, while rollback code must tolerate or explicitly migrate `retry` steps before using the earlier enum. Existing pending tool requests continue through their current validated Codex command adapters during the transition.

## Consequences

- The universal Workshop Agent step schema and its JSON-only prompt cease to be the ordinary dialogue contract.
- `ProviderAdapter` gains a normalized chat/tool completion boundary and granular runtime capability declarations.
- Workshop routes become thin input/confirmation boundaries instead of continuation owners.
- Tests must cover plain prose, native tool calls, invalid tool correction, confirmation, continuation, retry, cancellation, restart, duplicate-side-effect prevention, and exact audit export.
- Provider implementations must follow official Provider protocol documentation and preserve required replay metadata.

## Rejected Alternatives

- Add more prompt prohibitions or examples to the existing JSON union.
- Parse assistant prose for tool-call markers.
- Retry schema validation until the model eventually conforms.
- Treat a visible failure message as completion of a recoverable run.
- Ask the author to send another message after an internal continuation failure.
