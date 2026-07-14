# ADR-0014: General Chat Prompt Is Session Authority

Status: Accepted
Date: 2026-07-14

## Context

The visible General Chat system prompt was held in one `WorkshopWorkspace` component state value and repeated in preview, call, stream, and resend request bodies. Switching chats did not rebind that state, so one session could silently use another session's prompt and resend was not reproducible from durable history.

NS-511 will later introduce versioned, user-customizable Workshop Prompt definitions. NS-510 still needs a stable session binding now without pre-empting that versioned Prompt-management scope.

## Decision

1. `WorkshopSession` v2 adds `generalChatSystemPrompt`. It is a string, including an intentionally empty string, for `chat` sessions and `null` for `agent` sessions.
2. Creating a chat session snapshots the current built-in General Chat prompt. Creating an Agent session stores `null`.
3. Editing the visible prompt updates the current chat session before a Provider call. Switching sessions restores the selected session's value. A General Chat branch copies the source session's prompt snapshot.
4. Context preview, non-streaming call, streaming call, and resend resolve the target session and use its persisted prompt. Their request schemas do not accept a request-local `systemPrompt` override.
5. The built-in General Chat and Agent prompt content remains centralized in one Workshop-specific prompt catalog. NS-511 may replace the snapshot with a versioned Prompt reference plus resolved snapshot while preserving this session ownership.

## Migration And Rollback

- The explicit v1-to-v2 migration maps a legacy chat session to the built-in General Chat prompt snapshot and a legacy Agent session to `null`. Reads return v2; the next session mutation persists v2 through the existing atomic JSON write path.
- A rollback helper produces the legacy v1 session record together with a separate prompt backup. A custom or empty prompt must not be silently discarded when preparing rollback data.
- New v2 records are not written with `schemaVersion: 1`; an older binary therefore cannot silently parse and rewrite a v2 record as though it understood the prompt field.

## Consequences

- General Chat prompt isolation and resend behavior no longer depend on React component lifetime.
- API clients cannot inject a one-call prompt that is absent from session authority.
- Session updates and branches become part of the prompt lifecycle and require focused contract, storage, server, and Web regressions.
- This ADR does not add Prompt history, presets, custom Prompt creation, or Prompt-management UI; those remain NS-511 scope.

## Rejected Alternatives

- Keep one component-global prompt value and reset it heuristically on session switches.
- Allow request-local prompt overrides and infer the durable session value after a call.
- Store only a nullable reference to the mutable built-in default, which would make old sessions change when the default changes.
