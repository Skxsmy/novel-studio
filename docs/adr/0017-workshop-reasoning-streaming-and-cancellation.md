# ADR-0017: Workshop Model Reasoning, Streaming, And Cancellation Authority

Status: Accepted
Date: 2026-07-17

## Context

The Workshop reference reproduction exposes model selection, reasoning, and
stopping controls, but the current connected paths do not share one truthful
contract. General Chat can separate some streamed reasoning, Agent waits for a
complete non-streaming result, cancellation is recorded as failure, and the
model popover mixes model choice, Provider configuration, stream behavior, and
reasoning display preferences. Different Providers also expose incompatible
reasoning controls: some models use a switch, some expose an exact effort set,
some use a token budget, and some cannot disable reasoning.

The author approved a model-name-only selector, a separate per-model runtime
options entry, a separate Provider Settings entry, reasoning enabled by
default, immediate reasoning above the answer, per-message collapse, and one
Send/Sending/Stop/Stopping control. The last valid reasoning request setting
must persist for each Provider connection and exact model name.

## Official Provider Sources

- OpenAI reasoning behavior and model-dependent effort values:
  <https://developers.openai.com/api/docs/guides/reasoning>
- Anthropic effort controls and extended-thinking behavior:
  <https://platform.claude.com/docs/en/build-with-claude/effort> and
  <https://platform.claude.com/docs/en/build-with-claude/extended-thinking>;
  exact current model identifiers are defined by
  <https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions>
- Gemini thinking configuration for the Generate Content endpoint used by the
  current adapter:
  <https://ai.google.dev/gemini-api/docs/generate-content/thinking>
- OpenRouter reasoning-token normalization and exact-model metadata:
  <https://openrouter.ai/docs/guides/best-practices/reasoning-tokens>
- DeepSeek thinking mode:
  <https://api-docs.deepseek.com/guides/thinking_mode>
- Ollama thinking capability:
  <https://docs.ollama.com/capabilities/thinking>

These sources define Provider-specific request mapping and discovery behavior.
They do not authorize inferring controls for an unknown model or endpoint.

## Decision

1. `ReasoningConfiguration` is a normalized discriminated union for enabled,
   disabled, Provider-declared effort, or token-budget requests. It never stores
   a Provider-private request object.
2. `ProviderModelDescriptor` carries the reasoning control declared for the
   exact Provider connection and model: unsupported, toggle, an exact effort
   set, or a bounded token budget. The UI never invents a universal effort list.
3. `ModelProfile` version 2 stores the last valid normalized
   `reasoningPreference` for that profile's exact model. Version 1 profiles read
   as version 2 with a null preference. For an exact model that declares a
   reasoning control, null means the product's approved enabled default: a
   toggle is enabled, an effort control uses that model's declared default
   effort, and a budget control uses its declared default budget or its
   Provider-managed dynamic mode. Null remains null only when the exact model
   declares reasoning unsupported. A model change revalidates the stored
   preference before use.
4. Provider text and chat streams emit typed answer and reasoning events.
   Reasoning is never rewrapped in answer text. A chat stream ends with one
   authoritative result that includes tool calls, usage, finish reason, and
   whether visible reasoning is a summary, full content, or unavailable.
5. Workshop stream events identify the target assistant message, model call,
   and attempt. A retry or repair explicitly resets provisional content for the
   same target; post-tool continuation starts a new target. Late events from a
   replaced or cancelled attempt are ignored.
6. `ModelCallLog` version 2 stores the complete resolved parameters that were
   actually sent. A version 1 log reads with `resolvedParameters: null`; the
   application does not invent historical parameters. If exact-model parameter
   resolution fails before any Provider request can be formed, that failure is
   a preflight failure rather than a Model Call: the author message remains,
   the failed assistant message has no Model Call identity, and no
   `ModelCallLog` is created. An Agent run retains the failed preflight step but
   clears its reserved Model Call identity before terminal persistence.
7. `WorkshopMessage` and `WorkshopAgentRun` version 2 add terminal
   `cancelled` state. Messages also store `reasoningOutputKind`. Author Stop
   propagates through the active General Chat or Agent Provider request, does
   not enter automatic retry or continuation, does not execute a tool side
   effect, and ends with a normal cancelled terminal stream event rather than
   an error event.
8. Provider credentials, service addresses, and model discovery remain
   library-global Settings data. Workshop only stores a model-profile reference
   and normalized runtime parameters.
9. The author-facing Workshop context basket uses the public hierarchy
   `Series → Volume → Chapter → Act → Scene`, while Context Bundle
   evidence continues to use the existing internal authority identities
   `series`, `book`, `act`, `chapter`, and `scene`. The public-to-internal
   mapping is `Volume → book`, `Chapter → act`, `Act → chapter`, and
   `Scene → scene`. Existing version 1 basket and Context Bundle documents
   retain their historical meaning; a compatibility read never reinterprets
   an old `act` or `chapter` value under a different hierarchy level.
10. One local server process permits only one model-producing Workshop
    operation per session. General Chat, Agent send, resend, Agent retry, and
    confirmed tool execution plus its Agent continuation share this boundary.
    Session Branch, Archive, Restore, permanent Delete, and message-turn Delete
    are mutually exclusive with those operations. A conflict is rejected
    before a second Provider transport or destructive history mutation begins.

## Migration And Rollback

- Model Profile version 1 reads as version 2 with
  `reasoningPreference: null`. The next explicit profile update persists
  version 2. A rollback helper emits the exact version 1 profile plus a separate
  backup of the version 2 reasoning preference.
- Model Call Log version 1 reads as version 2 with
  `resolvedParameters: null`. New calls always write version 2 with non-null
  resolved parameters. A parameter-resolution preflight failure is not a new
  call and therefore does not create a log. A rollback helper emits the exact
  version 1 log and a separate parameter backup.
- Workshop Message and Agent Run version 1 read as version 2 without changing
  their existing state. Legacy reasoning content is marked `unknown` rather
  than falsely classified as a Provider summary or full reasoning. New records
  write version 2. Rollback helpers preserve the exact version 2 cancellation
  and reasoning metadata in a side backup and emit a version 1-compatible
  record only for an explicitly requested rollback.
- Workshop Context Basket version 1 used the internal storage labels `act` and
  `chapter` directly. Its version 2 compatibility projection maps the old
  `act` item to the public `Chapter` item and the old `chapter` item to the
  public `Act` item; new baskets write the public `volume`, `chapter`, `act`,
  and `scene` kinds. A persisted migration stores the exact version 1 bytes and
  refuses rollback when the migrated target has changed.
- Context Bundle version 1 keeps its historical internal `act`, `chapter`, and
  `scene` meanings. Version 2 adds internal `book` evidence for a selected
  public Volume without renaming or reinterpreting the existing kinds. New
  bundles write version 2. A persisted migration stores the exact version 1
  bytes and refuses rollback when the migrated target has changed.
- Compatibility reads do not rewrite files. Every persisted migration uses the
  existing same-directory temporary file, validation, revision protection, and
  atomic replacement path. Focused tests cover valid version 1 input, damaged
  input, cancellation, exact backup content, and rollback refusal after the
  migrated authority changes.

## Consequences

- General Chat and Agent share one truthful immediate streaming and Stop model.
- The UI can render only controls the exact model supports and can restore each
  model's own preference after restart.
- Cancellation is distinguishable from failure, completion, and restart
  interruption in authority and audit records.
- OpenAI Chat Completions-compatible paths may request supported reasoning but
  do not fabricate visible reasoning summaries. A future Responses API adapter
  is required for OpenAI-visible summaries when that endpoint is selected.
- Full opaque reasoning replay for Providers that require signed or structured
  reasoning items is limited to adapters and authority records that explicitly
  preserve those items. Unsupported replay is declared rather than simulated.

## Rejected Alternatives

- One fixed Low/Medium/High control for every model.
- A global `Show reasoning` preference that hides whether reasoning was
  requested or returned.
- Keeping Agent non-streaming while animating only the button.
- Recording author cancellation as failed, succeeded, or restart-interrupted.
- Keeping optional version 2 fields under `schemaVersion: 1`.
- Saving Provider-private reasoning request objects in project data.
