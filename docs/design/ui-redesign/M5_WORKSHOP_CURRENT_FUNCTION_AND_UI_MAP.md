# M5 Workshop Current Function And UI Map

Date: 2026-07-08
Scope: current Workshop UI and code-backed behavior after commit `fedeeab NS-410 fix(workshop): repair agent tools and embedding foundation`.

This report is a functional inventory for a later UI redesign. It describes what the current Workshop surface does, which controls exist, and how each visible interaction maps to frontend state, API calls, server routes, and storage behavior. It is not a visual acceptance record and does not claim the current UI is acceptable.

## Source Files

- Frontend workspace: `apps/web/src/features/workshop/WorkshopWorkspace.tsx`
- Workshop API client: `apps/web/src/api/workshop.ts`
- Workshop text labels: `apps/web/src/app/uiText.ts`
- Workshop route module: `apps/server/src/routes/workshop.ts`
- Agent protocol: `apps/server/src/workshop/workshopAgent.ts`
- Codex tool draft adapter: `apps/server/src/workshop/codexDraft.ts`
- Session export: `apps/server/src/workshop/sessionExport.ts`
- Contracts: `packages/contracts/src/workshop.ts`
- Storage: `packages/storage/src/index.ts`

## Product Shape

Workshop currently has two fixed session kinds:

| Session kind | Frontend mode sent | Purpose | Write behavior |
| --- | --- | --- | --- |
| `chat` | `general-chat` | Ordinary discussion with an editable visible system prompt. | Discussion-only. Generic Proposal creation and Codex tools are blocked. |
| `agent` | `agent` | Dialogue Agent with server-side structured-step parsing. | Can produce server-owned Codex tool request messages. Actual Codex writes require author confirmation through a tool execute route. |

The deprecated `codex-creation` mode remains in the contract enum for legacy compatibility, but server/storage reject it at runtime.

Workshop data is persisted as:

| Data | Authority path / owner | Notes |
| --- | --- | --- |
| Sessions | `workshop/sessions/<session-id>.json` through storage helpers | Contains fixed `kind`, status, title, branch source pointer, timestamps. |
| Messages | `workshop/messages/<message-id>.json` | Roles include `author`, `assistant`, `tool`, `result`, and `system`. |
| Context selection | `WorkshopContextBasket` JSON per session | UI no longer shows a right basket panel, but still edits this object. |
| Attachments | `workshop/attachments/<attachment-id>.json` | Draft first, then bound to the next author message. Not Reference Library sources. |
| Branch records | `workshop/branches/<branch-id>.json` | Branch creates cloned message and attachment snapshots. |
| ContextBundle / ModelCallLog | existing AI authority records | Linked from assistant/tool/result messages when available. |

## Initial Load

When the Workshop route mounts, `loadShell()` runs these calls in parallel:

| Frontend call | API route | Purpose |
| --- | --- | --- |
| `api.workshop.listSessions(seriesId)` | `GET /series/:seriesId/workshop/sessions` | Populate the session list and choose the active session. |
| `api.ai.listModelProfiles()` | AI settings route | Populate model settings. |
| `api.ai.listPromptTemplates(seriesId)` | prompt template route | Select the newest role template for chat/agent calls. |

When a session is selected, `loadSession(sessionId)` runs:

| Frontend call | API route | Purpose |
| --- | --- | --- |
| `getSession` | `GET /series/:seriesId/workshop/sessions/:sessionId` | Load session, basket, messages, and attachments. |
| `api.proposals.list(seriesId)` | Proposal API | Resolve linked Proposal cards shown under messages. |
| `api.codex.listCategories` | Codex API | Context menu labels and groups. |
| `api.codex.listDetailTypes` | Codex API | Context by detail type and tool detail resolution UI. |
| `api.codex.listEntries` | Codex API | Context menu Codex entries and auto-link preview on the client. |

## Layout Regions

The current screen has two columns:

1. Left session panel.
2. Main conversation panel with settings, message stack, context selector, attachments, and composer.

The page also has global error/status messages and a global Codex missing-detail resolution card above the main grid.

## Session Panel

### Add Session

Visible control:

- Button: `Add`
- Opens a small menu with:
  - `Chat`
  - `Agent`

Frontend mapping:

- `createSession(kind)` in `WorkshopWorkspace.tsx`.
- Sends `{ title: "New chat", kind, sceneId: null }`.

Backend mapping:

- `POST /api/v1/series/:seriesId/workshop/sessions`
- `repository.createWorkshopSession()`
- Creates a `WorkshopSession` plus an empty `WorkshopContextBasket`.

Redesign requirement:

- Preserve creation-time session kind selection.
- Do not reintroduce a mutable per-message mode selector.
- The UI can be redesigned as a dropdown, split command, modal, or segmented creation flow, but the chosen kind must be fixed on the session.

### Session Rows

Visible behavior:

- Click row: activates session.
- Double-click row title: starts inline rename.
- Active row has active styling.
- Row metadata shows session kind, thread/branch state, and last-message time.
- Status pill shows `Active` or `Archived`.

Frontend mapping:

- `activateSession(session.id)`
- `startSessionTitleEdit(session)`
- `commitSessionTitleEdit()`

Backend mapping:

- Rename uses `PUT /series/:seriesId/workshop/sessions/:sessionId`.
- Storage updates session title and `updatedAt`.

Redesign requirement:

- Preserve activation and persistent rename.
- Rename does not need to remain double-click, but the new design must include a discoverable rename path.

### Archive / Restore

Visible control:

- Button label is `Archive` for active sessions.
- Button label is `Restore` for archived sessions.

Frontend mapping:

- `archiveSession()`

Backend mapping:

- `POST /series/:seriesId/workshop/sessions/:sessionId/archive`
- `POST /series/:seriesId/workshop/sessions/:sessionId/restore`

Storage behavior:

- Archive sets `status: "archived"` and `archivedAt`.
- Restore sets `status: "active"` and clears `archivedAt`.

Redesign requirement:

- Preserve archive and restore as reversible lifecycle actions.
- Archived sessions must not accept new messages, attachments, or message deletes through normal storage paths.

### Branch

Visible control:

- Button: `Branch`
- Disabled when no active session, no messages, deleting, or calling.

Frontend mapping:

- `branchFromLastMessage()`
- Always uses `messages[messages.length - 1]` as the branch source.

Backend mapping:

- `POST /series/:seriesId/workshop/sessions/:sessionId/branch`
- Input contract supports arbitrary `sourceMessageId`.

Storage behavior:

- Creates a new session with the same `kind`.
- Copies all source messages through the source message.
- Clones message-bound attachments.
- Clears old Proposal IDs, context bundle IDs, and model call IDs from copied messages.

Redesign requirement:

- Preserve branch creation and copied history semantics.
- A redesign should expose branch-from-message, not only branch-from-last-message, if preserving the full backend capability is desired.

### Session Actions Menu

Visible control:

- Button: `...`
- Menu item: `Delete permanently`

Frontend mapping:

- `deleteSessionPermanently()`
- Uses browser `confirm("Delete this Workshop session permanently?...")`.

Backend mapping:

- `DELETE /series/:seriesId/workshop/sessions/:sessionId`

Storage behavior:

- Blocks deletion if any message has linked Proposal IDs.
- Deletes the session, its basket, messages, attachments, and branch records.
- Clears `branchOfMessageId` on branch sessions whose source message was deleted.

Redesign requirement:

- Preserve permanent delete as separate from Archive.
- Preserve Proposal-linked deletion blocking.
- Consider a stronger confirmation UI, but the product behavior must remain cascade-or-block.

### Export

Visible controls:

- Checkbox: `Include reasoning`
- Checkbox: `Include prompt audit`
- Button: `Export`

Frontend mapping:

- `exportActiveSession()`
- Calls `api.workshop.exportSession()` and downloads a Markdown blob.
- Client filename format: `workshop-<session-title>-<session-id-prefix>.md`.

Backend mapping:

- `GET /series/:seriesId/workshop/sessions/:sessionId/export?includePromptAudit=&includeReasoning=`
- Returns `text/markdown; charset=utf-8` with BOM.

Export behavior:

- Always scoped to the requested session only.
- Default includes visible message history and attachment file records.
- Does not include attachment body text.
- Includes saved reasoning only when requested.
- Includes prompt/model/context audit only when requested and durable links exist.
- Tool messages are compacted unless prompt audit is included.

Redesign requirement:

- Preserve session-scoped export.
- Preserve separate reasoning and prompt-audit options.
- Do not export all sessions into one file.
- Do not export attachment body text.

### Import Thread

Visible control:

- Button: `Import Thread`
- Always disabled.

Current mapping:

- No frontend handler.
- No current backend route.

Redesign requirement:

- Either keep it clearly deferred/disabled or remove it from the redesigned main path until implemented.

## Conversation Header And Settings

Visible control:

- Button: `Workshop settings`

Opens a dialog with:

| Control | Current behavior | Backend mapping |
| --- | --- | --- |
| `Model setting` select | Chooses an active library-global model profile in component state. | No write. Profiles are loaded from AI settings. |
| `Model` select | Chooses the profile model or fetched provider model override for this call. | Sent as `modelOverride` when it differs from the profile default. |
| `Fetch Models` button | Calls provider model listing for the selected model profile. | AI model-profile provider route. |
| `General Chat system prompt` textarea | Editable only for `chat` sessions; disabled in `agent` sessions. | Sent as `systemPrompt` for General Chat calls. |
| `Stream output` checkbox | Toggles `/calls/stream` vs `/calls`. | Frontend-only state. |
| `Show reasoning by default` checkbox | Controls initial reasoning expansion. | Frontend-only state. |
| `Close` button | Closes dialog. | No backend. |

Prompt selection:

- Chat sessions use the visible `systemPrompt` plus the user request; they do not select a global prompt template.
- Agent sessions use the Workshop-specific Agent prompt and server Agent protocol from `apps/server/src/workshop/workshopPrompts.ts`.
- General Chat and Agent prompt paths are isolated from global role/template records.
- Non-Workshop AI calls still use explicitly selected user-created role/template records.

Redesign requirement:

- Preserve visible editable General Chat system prompt.
- Preserve no hidden General Chat fallback prompt.
- Preserve agent prompt isolation.
- Preserve per-call model override without writing it back to Settings.

## Global Codex Missing-Detail Resolution Card

When a Codex tool execution returns `409 CODEX_DETAIL_TYPE_CREATION_REQUIRED`, the UI shows a global card:

Visible content:

- Title: `Create Missing Detail Types`
- Body explains unmatched detail labels.
- Each missing detail label with a value preview.
- Optional one-line list of existing detail type names.

Visible controls:

- `Cancel`
- `Create Detail Types and Run Tool`

Frontend mapping:

- `executeCodexToolFromMessage()` first calls the execute route with `createMissingDetailTypes: false`.
- On 409 it saves `codexDraftResolution`.
- `applyResolvedCodexDraft()` calls the same execute function with `createMissingDetailTypes: true`.

Backend mapping:

- `POST .../tools/codex.create_entry/execute`
- `POST .../tools/codex.update_entry/execute`

Redesign requirement:

- Preserve a clear second confirmation before creating missing reusable detail types.
- A better redesign should expose mapping choices to existing detail types because the current UI does not.

## Message Stack

Each message is rendered as an `article.message`.

### Message Metadata

Visible elements:

- Role/status pill:
  - pending messages show `Pending`
  - author messages show `Author`
  - assistant messages show `Workshop`
  - tool messages show `Tool`
  - result messages show `Result`
- Created time.

### Reasoning Toggle

Visible controls:

- `Show Reasoning`
- `Hide Reasoning`

Conditions:

- Only appears when `message.reasoningContent` is non-empty.

Frontend mapping:

- `toggleReasoning(message.id)`
- Uses `reasoningOverrideIds` plus `showReasoningByDefault`.

Backend mapping:

- Reasoning comes from saved `WorkshopMessage.reasoningContent`.
- Streaming routes emit `reasoning-delta`.

Redesign requirement:

- Preserve distinct reasoning display and collapsed availability indicator.

### Delete Message

Visible control:

- `Delete`

Conditions:

- Active session.
- Message mode is `general-chat` or `agent`.
- Message is not linked to Proposal IDs.
- Message is not pending.

Frontend mapping:

- `deleteMessage(message)`

Backend mapping:

- `DELETE /series/:seriesId/workshop/sessions/:sessionId/messages/:messageId`

Storage behavior:

- Rejects archived sessions.
- Rejects Proposal-linked messages.
- Deletes message-bound attachments attached to that message.
- Updates session `lastMessageAt`.

Redesign requirement:

- Preserve deletion for unlinked records and Proposal-linked protection.
- Consider turn-aware deletion in the redesigned interaction model.

### General Chat Edit / Resend

Visible controls:

- `Edit`
- `Resend`
- Edit mode textarea.
- Edit-mode `Resend`
- Edit-mode `Cancel`

Conditions:

- Active `chat` session.
- Message role is `author`.
- Message mode is `general-chat`.
- Message succeeded.
- Message has no linked Proposal IDs.
- No call is currently in flight.

Frontend mapping:

- `beginEditMessage(message)`
- `resendGeneralChatMessage(message, content?)`

Backend mapping:

- `POST /series/:seriesId/workshop/sessions/:sessionId/messages/:messageId/resend`

Storage/server behavior:

- Only supports General Chat author messages in `chat` sessions.
- Replaces the selected author message content.
- Deletes later unprotected General Chat messages.
- Deletes bound attachments attached to deleted later messages.
- Deletes branch records sourced from deleted later messages and clears branch pointers.
- Builds a new ContextBundle/ModelCallLog and appends a new assistant reply.
- Blocks if later protected records would be erased.

Redesign requirement:

- Preserve this feature only for General Chat.
- Do not expose it in Agent sessions.
- Preserve durable history replacement semantics.

### Message Content And Attachments

Visible behavior:

- Non-tool message content is shown as paragraph text.
- Pending messages show `Writing...` if empty.
- Tool message JSON content is not rendered as raw JSON in the normal message body.
- Sent attachments show file-name pills under the message.
- Failed messages show `message.errorMessage` or `Model call failed`.

Redesign requirement:

- Preserve raw tool request suppression in normal chat display.
- Preserve attachment records without showing extracted body text.

### Proposal Cards

Visible conditions:

- Rendered when `message.proposalIds.length > 0`.

Available Proposal card:

- Status pill from Proposal authority.
- Target-kind pill.
- Optional `Unavailable` pill if source or target unavailable.
- Title and summary.
- Button: `Open Proposal`

Unavailable Proposal card:

- `Unavailable` pill.
- Title/body explaining missing Proposal.
- Disabled `Open Proposal`.
- `Refresh` button reloads the active Workshop session.

Frontend mapping:

- Proposal documents are loaded through `api.proposals.list(seriesId)`.
- `Open Proposal` calls the parent `onOpenProposal(proposalId)`.

Backend/storage mapping:

- Workshop messages store Proposal IDs.
- Proposal authority supplies status and availability.

Redesign requirement:

- Preserve linked Proposal card visibility and exact Review open behavior.
- Preserve recoverable missing/unavailable states.

### Create Proposal

Visible control:

- `Create Proposal`

Current conditions:

- Active session.
- Message role is not `author`.
- Message mode is `continuity-check`.
- Message succeeded and has content.
- Message has no linked Proposal IDs.

Frontend mapping:

- `createProposalFromMessage(message)`
- Builds a scene-content text-insertion Proposal from the message content.
- Requires exactly one scene in the current basket/selection path.

Backend mapping:

- `POST /series/:seriesId/workshop/sessions/:sessionId/messages/:messageId/proposals`

Current reachability:

- Current send path produces only `general-chat` or `agent` messages.
- This button is effectively a legacy path for existing `continuity-check` messages unless another route creates such messages.

Redesign requirement:

- Preserve existing linked Proposal display.
- Do not present General Chat or Agent replies as generic scene Proposal sources.
- Decide explicitly whether continuity-check Proposal creation remains a visible workflow or is replaced by a future Tool Plan/Proposal path.

### Agent Tool Call Card

Visible control:

- Card title: `Tool Call`
- Tool label:
  - `codex.create_entry`
  - `codex.update_entry`
- Button: `Confirm Tool Call`

Conditions:

- Active session.
- Message role is `tool`.
- Message mode is `agent`.
- Message succeeded.
- Message content parses as structured JSON with `schemaVersion: 1` and a supported tool name.

Frontend mapping:

- `executeCodexToolFromMessage(message)`
- Browser confirm is shown first:
  - create: `Run codex.create_entry?...`
  - update: `Run codex.update_entry?...`
- Execute route is called only after confirmation.

Backend mapping:

- `POST .../tools/codex.create_entry/execute`
- `POST .../tools/codex.update_entry/execute`

Tool behavior:

- `codex.create_entry` creates a new Codex entry from the structured draft.
- `codex.update_entry` resolves one existing entry by ID or exact name/alias, then may update entry fields/research/details and create/update/delete unified Codex Progression records.
- Missing detail types cause a 409 and require the global second confirmation card.

Redesign requirement:

- The confirmation control must appear only on server-owned tool request messages, not under ordinary assistant messages.
- The UI must not render fake assistant prose such as `Tool Call: codex-create` as executable.
- The redesigned flow should make tool execution state and completion state explicit.

## Context Selector And Composer

### Context Trigger

Visible control:

- Button: `+ Context`
- Disabled without active session/basket.

Opens a nested menu backed by `WorkshopContextBasket.items`.

### Root Context Menu

Root items:

| Label | UI behavior | Basket item |
| --- | --- | --- |
| `Full Novel Text` | Toggle add/remove. | `kind: "full-novel", sourceId: seriesId` |
| `Full Outline` | Toggle add/remove. | `kind: "full-outline", sourceId: seriesId` |
| `Acts` | Opens act list. | Act rows toggle `kind: "act"`. |
| `Chapters` | Opens chapter list. | Chapter rows toggle `kind: "chapter"`. |
| `Scenes` | Opens scene list. | Scene rows toggle `kind: "scene"`. |
| `Codex Entries` | Opens all active Codex entries. | Entry rows toggle `kind: "codex-entry"`. |
| `Entries by Type` | Opens category groups in current implementation. | Then toggles `codex-entry`. |
| `Entries by Detail` | Opens detail-type groups. | Then toggles `codex-entry`. |
| `Entries by Category` | Opens category groups. | Then toggles `codex-entry`. |
| `Clear selection` | Clears `sceneId`, `blockId`, `selection`, and `items`. | Empty basket state. |

Frontend mapping:

- `toggleContextItem(kind, sourceId, label)`
- `toggleSceneContext(scene)`
- `toggleCodexEntryContext(entry)`
- `clearBasket()`

Backend mapping:

- `PUT /series/:seriesId/workshop/sessions/:sessionId/context-basket`
- Storage validates references and materializes linked Codex entries.

Auto-linked Codex behavior:

- Frontend previews linked entries when story scope text mentions `on-mention` entries or when entries are `always`.
- Storage also materializes linked Codex entries on basket update through `withLinkedWorkshopCodexItems`.
- `manual` and `never` entries are not auto-linked.

Context chips:

- Shows counts for full novel, full outline, acts, chapters, current scene, scenes, Codex entries, Proposal sources, and other references.

Redesign requirement:

- Preserve explicit compact context selection.
- Preserve visible selected-context chips.
- Preserve server-backed basket updates.
- Preserve auto-linked Codex visibility.
- Do not reintroduce the removed permanent right-side Context Basket panel unless the product decision changes.

### Composer Textarea

Visible control:

- Textarea label: `Workshop message`
- Placeholder: `Ask for a rewrite, continuity check, Codex draft, or planning pass...`
- Disabled without an active active-status session.

Keyboard:

- Enter sends.
- Ctrl+Enter inserts newline.
- IME composition does not send.

Frontend mapping:

- `sendMessage()`
- `handleComposerKeyDown()`

Send conditions:

- Active session is active.
- Selected prompt template exists.
- Selected model profile and model ID exist.
- Composer has text or at least one parsed draft attachment.
- No draft attachment is still parsing, failed, or rejected.
- No call is already in flight.

### Attachment Picker

Visible controls:

- Hidden file input.
- Icon button with title/label `Attach file`.
- Draft attachment chips with:
  - filename
  - parse status pill
  - remove button `x`
  - parse error text when failed/rejected

Accepted input:

- `.txt`
- `.md`
- `.markdown`
- `.doc`
- `.docx`
- `.pdf`
- corresponding media types.

Frontend mapping:

- `uploadComposerFile(file)`
- `removeDraftAttachment(attachment)`

Backend mapping:

- `POST /series/:seriesId/workshop/sessions/:sessionId/attachments`
- `DELETE /series/:seriesId/workshop/sessions/:sessionId/attachments/:attachmentId`

Storage behavior:

- Attachments start as drafts with a `draftToken`.
- Only parsed draft attachments can be bound to a message.
- Bound message attachments cannot be deleted directly; deleting the message cascades them.

Redesign requirement:

- Preserve attachment-only send.
- Preserve parse state and removal.
- Preserve message-bound attachment records.
- Do not turn attachments into Reference Library sources in this workflow.

### Stop And Send

Visible controls:

- `Stop` button only while calling.
- `Send` / `Sending` button.

Frontend mapping:

- `stopSending()` aborts the active `AbortController`.
- `sendMessage()` calls stream or non-stream route.

Backend mapping:

- Streaming: `POST /series/:seriesId/workshop/sessions/:sessionId/calls/stream`
- Non-streaming: `POST /series/:seriesId/workshop/sessions/:sessionId/calls`

Call behavior:

- Creates the durable author message first.
- Builds a ContextBundle from the current basket, attachments, and prior visible same-session history.
- Uses selected model profile and per-call model override.
- Saves a ModelCallLog.
- Saves assistant message.
- Agent mode may also save server-owned tool request messages.

Streaming event types:

- `author-message`
- `metadata`
- `delta`
- `reasoning-delta`
- `assistant-message`
- `error`
- `done`

Frontend live-state behavior:

- Optimistic author and assistant placeholders are stored per session in `liveSessionMessagesRef`.
- In-flight stream output remains attached to the originating session while switching sessions.

Redesign requirement:

- Preserve immediate author message visibility.
- Preserve session-scoped in-flight display.
- Preserve stop behavior and a single stopped assistant state.

## Backend Route Map

| Route | Current UI entry | Storage / server behavior |
| --- | --- | --- |
| `GET /workshop/sessions` | Initial session list. | Lists session files. |
| `POST /workshop/sessions` | Add -> Chat/Agent. | Creates session and basket. |
| `GET /workshop/sessions/:sessionId` | Load selected session. | Returns session, basket, messages, attachments. |
| `GET /workshop/sessions/:sessionId/export` | Export button. | Returns one-session Markdown. |
| `PUT /workshop/sessions/:sessionId` | Rename session. | Updates title/status fields allowed by contract. |
| `DELETE /workshop/sessions/:sessionId` | Delete permanently. | Cascades unlinked session data, blocks Proposal-linked sessions. |
| `POST /archive` / `POST /restore` | Archive/Restore. | Updates lifecycle state. |
| `GET /messages` | API method exists, not used by main UI load. | Lists messages. |
| `POST /messages` | API method exists, not used by current send path. | Creates a standalone message. |
| `DELETE /messages/:messageId` | Message Delete. | Deletes unlinked message and bound attachments. |
| `POST /messages/:messageId/resend` | Edit/Resend. | Replaces General Chat author message and truncates later unprotected history. |
| `POST /messages/:messageId/proposals` | Legacy continuity-check Create Proposal. | Creates a Proposal linked to the Workshop message. |
| `POST /tools/codex.create_entry/execute` | Agent tool confirmation. | Writes Codex entry after confirmation. |
| `POST /tools/codex.update_entry/execute` | Agent tool confirmation. | Updates one Codex entry and optional Progressions after confirmation. |
| `POST /branch` | Branch button. | Clones history and attachments through source message. |
| `GET /context-basket` | API method exists; detail load already includes basket. | Reads basket. |
| `PUT /context-basket` | Context menu changes. | Validates/materializes linked Codex and writes basket. |
| `POST /context-preview` | API method exists, no current visible Preview button. | Builds a ContextBundle preview. |
| `POST /calls` | Non-stream Send. | Creates author message, runs provider, saves assistant/tool messages. |
| `POST /calls/stream` | Streaming Send. | Same, with SSE events. |
| `POST /attachments` | Attach file. | Parses upload and creates draft attachment record. |
| `DELETE /attachments/:attachmentId` | Remove draft chip. | Deletes unbound draft attachment. |
| `GET /messages/:messageId/source` | Used by Review/source workflows, not main Workshop screen. | Resolves message and session. |

## Redesign Preservation Checklist

A redesigned Workshop UI must preserve these current functional invariants:

- Sessions are fixed as `chat` or `agent` at creation.
- General Chat does not expose write actions or Proposal creation.
- Agent tool actions are shown only for server-owned `role: tool` messages.
- Tool execution requires author confirmation.
- Missing reusable detail types require a second confirmation before creation.
- General Chat edit/resend is limited to successful author messages in `chat` sessions.
- Agent sessions do not expose edit/resend.
- Export is per session and has separate reasoning and prompt-audit options.
- Attachments are Workshop message context records, not Reference Library sources.
- Context selection writes to the session basket and remains visible before Send.
- Branch creates a populated cloned-history session.
- Permanent delete is separate from Archive and blocks Proposal-linked sessions.
- Streaming output stays attached to the originating session.
- Reasoning is distinct from visible answer text.
- User visual acceptance is not replaced by tests or screenshots.

## Deferred Or Unreachable Current Features

- `Import Thread` is visible but disabled and has no route.
- `context-preview` has an API route but no current visible Preview button.
- `Create Proposal` for `continuity-check` messages remains in UI code, but current sends produce only `general-chat` or `agent`.
- Contracts/storage know about `selection`, `scene-section`, `research-note`, `note`, and `proposal-source` context item kinds; the current context menu exposes only project/structure/scene/Codex paths.
- `selectedScene` is passed into `WorkshopWorkspace` but is not used by the component.
- Full M5.6 Tool Plans, Grants, relation/category/knowledge adapters, Council, and final user visual acceptance remain outside the current implemented slice.
