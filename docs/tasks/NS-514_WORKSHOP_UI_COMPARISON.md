# NS-514 Workshop UI Function Comparison

Status: P5 comparison with Workshop P6 dispositions approved on 2026-07-17
Surface: Workshop
Binding nodes: `#workshop-workspace`, `#wr5-review-backdrop`, `#wr5-toast`
New component: `apps/web/src/features/workshop/ReferenceWorkshopWorkspace.tsx`
Old component: `apps/web/src/features/workshop/WorkshopWorkspace.tsx`

## Scope And Interpretation

This document compares the binding-reference Workshop UI with the real
pre-NS-514 Workshop workflow, including the request-review overlay. It does not
claim completion of NS-511 Prompt authority, NS-512 Tool Plans/Grants, or the
broader M5 Council/failure work.

The primary Workshop surface contains 76 controls and the request-review
overlay contains 7 controls. Combined disposition: 66 proposed in-place
connections and 17 local-only controls. Conditional controls still require
explicit author approval and real eligibility state.

## Binding And Entry Checklist

| Property | New Workshop | Old Workshop |
| --- | --- | --- |
| Entry | Appbar Workshop | Sidebar Workshop |
| Deep entry | No explicit message-addressable reference control | Hash route to session/message |
| Return path | Appbar workspaces | Sidebar workspaces and Proposal round-trip |
| Layout | Conversation rail, conversation content, composer, context/model popovers | Session list, messages, context/settings/actions, composer, Proposal/tool cards |
| Primary data | Fixture sessions/messages/context/models/tools | Real Workshop JSON sessions and messages |
| Provider boundary | Reference simulated response | Real streaming/non-streaming Provider calls |
| Tool boundary | Reference review overlay | Confirmed Codex create/update tool execution |

## Complete Function Matrix

| ID | Atomic function | New UI | Old UI | Existing callback/API | Comparison | Required P6 disposition |
| --- | --- | --- | --- | --- | --- | --- |
| WS-01 | Open Workshop | Appbar Workshop | Sidebar Workshop | `App.showWorkspace("workshop")` | both | Connect workspace state |
| WS-02 | Load session list | Fixture threads | Real sessions | `api.workshop.listSessions` | both | Replace fixtures |
| WS-03 | Search sessions | Search conversations | Old local filtering | local view state | both | Keep local over real sessions |
| WS-04 | Filter All/Chat/Agent/Archived | Reference has three fixture controls | Old authority has kind and archive status | local view state over real sessions | approved reference deviation | Add real Archived; All/Chat/Agent exclude archived; Archived is read-only |
| WS-05 | Select/load session | Thread buttons | Real session activation | `api.workshop.getSession` | both | Load real messages/basket/attachments/runs |
| WS-06 | Mobile session drawer | Open conversations | No equivalent explicit button | local reference state | new-only presentation | Keep local-only |
| WS-07 | New General Chat | New conversation menu | Real create Chat | `api.workshop.createSession` | both | Connect in place |
| WS-08 | New Agent conversation | New conversation menu | Real create Agent session | `api.workshop.createSession` | both | Connect in place |
| WS-09 | Rename session | No row menu in fixture | Real inline rename | `api.workshop.updateSession` / `OC-079` | old-only | Approved session-row context menu; mouse, keyboard, and touch; no double click |
| WS-10 | Archive session | Conversation action | Real archive | `api.workshop.archiveSession` | both | Connect in place |
| WS-11 | Restore session | No control | Real restore | `api.workshop.restoreSession` / `OC-074` | old-only | Approved in archived session-row context menu |
| WS-12 | Delete session | Conversation action | Real permanent delete | `api.workshop.deleteSession` | both | Preserve confirmation/eligibility |
| WS-13 | Branch session | Header action | Real branch from message | `api.workshop.branchSession` | both | Preserve eligible source-message rule |
| WS-14 | Export session | Header fixture action | Real Markdown export | `api.workshop.exportSession` | both | Move to approved session-row context menu and use real export result |
| WS-15 | Include reasoning in export | No explicit reference export option | Old checkbox | export options state | old-only | Retain in the Export flow, not the conversation or message surface |
| WS-16 | Include prompt audit in export | No explicit reference export option | Old checkbox | export options state | old-only | Retain in the Export flow, not the conversation or message surface |
| WS-17 | Not now | Fixture says Dismiss | No persisted old dismissal | local review state | approved copy/behavior deviation | Close review only; do not execute, reject, delete, or mutate the durable request |
| WS-18 | Review request | Header action and overlay | Old Codex draft resolution | tool-review state | both/partial | Connect only to a real pending tool request |
| WS-19 | Retry Agent run | Reference action | Real retry | `api.workshop.retryAgentRun` | both | Preserve stale run/continuation guards |
| WS-20 | Abandon Agent run | Reference action | Real abandon | `api.workshop.abandonAgentRun` | both | Preserve run-state guards |
| WS-21 | Open Context basket | Context button | Real context menu | local state plus basket | both | Replace fixture count |
| WS-22 | Switch Story/Structure/Codex/Files context tabs | Four tabs | Old context categories | local view state | both | Keep local |
| WS-23 | Clear selected context | Clear controls | Real basket clear/update | `api.workshop.updateContextBasket` | both | Persist real basket |
| WS-24 | Add full manuscript/outline | Reference options | Old context selection supports story/structure scopes | context-basket update | both | Use real scope refs, not copied manuscript text in UI state |
| WS-25 | Browse Volume/Chapter/Act/Scene | Reference context tree | Real hierarchy context selection | context-basket update | both | Preserve canonical labels |
| WS-26 | Browse Codex entries/types/details/categories | Reference context tree | Real Codex data in context menu | `api.codex.listCategories`; `listDetailTypes`; `listEntries` | both | Replace fixture counts/items |
| WS-27 | Add/remove context item | Reference Add/Included controls | Real basket toggles | `api.workshop.updateContextBasket` | both | Persist real refs |
| WS-28 | Attach file from context | Attach file | Real attachment upload | `api.workshop.uploadAttachment` | both | Enforce file validation/size/error state |
| WS-29 | Attach file from composer | Attach button/file input | Real draft attachment | `api.workshop.uploadAttachment` | both | Connect in place |
| WS-30 | Remove attachment | No explicit default-surface removal control in manifest | Old draft/message removal | `api.workshop.deleteAttachment` | partial | Requires an existing reference-row removal state or binding revision |
| WS-31 | Select model | Fixture popover mixes settings | Real profiles and Provider models | `api.ai.listModelProfiles`; `listProviderModels` | both | Model selector shows model names only |
| WS-32 | Streaming preference | Fixture checkbox mixed into model list | Old `useStreamingResponses` | normalized call setting | both | Move to adjacent runtime-options icon |
| WS-33 | Reasoning request preference | Fixture `Show reasoning` display checkbox | Old display preference | exact-model capability plus persisted profile preference | approved redesign | Remove display checkbox; runtime-options icon renders only declared exact-model request controls and restores each model's setting |
| WS-34 | General system prompt | No reference editor | Old session setting | `api.workshop.updateSession` | old-only | Approved only in General Chat session-row context menu; NS-511 version history remains unfinished |
| WS-35 | Compose message | Textarea | Real composer | local draft state | both | Keep local until send |
| WS-36 | Send streaming call | Send | Real event stream | `api.workshop.runCallStream` | both | One Send/Sending/Stop/Stopping control; typed reasoning and answer events only |
| WS-37 | Send non-streaming call | No distinct reference state | Real fallback path | `api.workshop.runCall` / `OC-076` | partial | Preserve fallback without inventing a visible second action |
| WS-38 | Stop active call | Separate Stop and Send buttons | Frontend aborts only General Chat transport | new operation cancel command plus active registry | approved redesign | Merge into one control; cancel General Chat and Agent, keep stream open to terminal cancelled result |
| WS-39 | Show Provider/call errors | Reference fixture messages | Real error/status state | old `error` / `statusMessage` | partial | Show actual nearby accessible errors |
| WS-40 | Edit and resend message | No fixture control | Real edit state | old `beginEditMessage` | old-only | Approved in eligible message bottom-right icon menu |
| WS-41 | Resend message | No fixture control | Real resend | `api.workshop.resendMessage` / `OC-073` | old-only | Approved in eligible message bottom-right icon menu |
| WS-42 | Delete turn | No fixture control | Real complete-turn delete | `api.workshop.deleteMessage` / `OC-065` | old-only | Approved in eligible message bottom-right icon menu with confirmation |
| WS-43 | Per-message reasoning disclosure | Fixture details is collapsed after answer | Old toggle and hidden default | typed stream plus message state | approved redesign | Reasoning is above answer and initially expanded; one inline chevron only, no message-menu action |
| WS-44 | Open Proposal | No usable Review destination | Real Proposal card action | `App.openProposal`; `api.proposals.list` | old-only | Blocked by missing Review surface |
| WS-45 | Open source message route | No explicit addressable action | Real session/message hash route | `OC-086` | old-only/partial | Preserve invisible route or add approved affordance |
| WS-46 | Review Codex tool mapping | Mapping selects/input/checkbox | Real Codex draft resolution | old resolution state | both | Bind real request data |
| WS-47 | Confirm Codex create tool | Confirm and run, disabled by default | Real confirmed execution | `api.workshop.executeCodexCreateEntryTool` / `OC-067` | both/conditional | Enable after valid mapping and explicit confirmation |
| WS-48 | Confirm Codex update tool | Same overlay | Real confirmed execution | `api.workshop.executeCodexUpdateEntryTool` / `OC-068` | both/conditional | Preserve target revision and stale guards |
| WS-49 | Dismiss tool review | Dismiss | Old resolution cancel | local state | both | Keep local; do not execute tool |
| WS-50 | Import Thread | No reference action | Old disabled placeholder | No capability | neither | Do not reintroduce |

## New UI Functions Missing From The Old UI

| Function family | Controls | Current truth |
| --- | --- | --- |
| Mobile Open conversations | `RC-268` | New responsive presentation only |
| Reference Dismiss request | `RC-274` | Local-only; no persisted old operation |
| Expanded context browse taxonomy/count presentation | `RC-285`–`RC-327` | Mostly a new presentation over old basket capabilities; counts/items are fixtures |

## Old UI Functions Missing From The New UI

| Function family | Evidence | Impact |
| --- | --- | --- |
| Rename/update session | `OC-079` | Resolved by the approved session-row context menu |
| Restore session | `OC-074` | Resolved by the real Archived filter and archived-row context menu |
| Edit/resend/delete message | `OC-073`, `OC-065`, old edit state | Resolved by the eligible bottom-right icon menu |
| Export reasoning/prompt-audit options | old export state | Audit/privacy choice is lost |
| General system prompt | old session setting | Resolved by the General Chat session-row context menu; version history remains NS-511 |
| Per-message reasoning disclosure | `OC-100` | Resolved by initially expanded reasoning above answer plus the inline chevron |
| Open Proposal | old `onOpenProposal` | Proposal review round-trip is broken |
| Source-message deep link | `OC-086` | Evidence navigation cannot focus the originating message |

## Fixture, Safety, And Accessibility Audit

- Sessions, messages, attachments, context counts/items, models, tool requests,
  results and timestamps in the reference are fixtures.
- Calls must use actual Provider success/error/stream events. No reference toast
  may claim that a call, archive, export, retry or tool execution succeeded.
- Context must remain explicit and auditable; complete manuscript text must not
  be logged or duplicated into UI-only authority.
- Tool execution requires explicit confirmation, valid target mapping, stale
  checks and the existing permission/Grant boundary.
- Stop is enabled only while a real call is active and must actually abort the
  underlying request.
- Error messages need recovery actions and accessible announcement.
- Model/context/attachment popovers and the review overlay require labelled
  controls, focus containment and keyboard dismissal.

## Approved Workshop P6 Disposition

The author approved real session, message, context, attachment, model, call,
run-recovery, tool-review, export, and existing Proposal-card connections. The
binding structure remains the visual base, with only the explicit deviations
recorded in `docs/tasks/NS-514.md` A29-A35: the Archived filter, row context
menus, bottom-right message icon menus, merged send/stop control, reasoning
above the answer, separate model/runtime/Provider entries, and `Not now`.

Settings Provider editing remains Settings P6 work. The Workshop entry may
navigate to the Settings page visibly labeled `Model connections` and return
to the exact Workshop session that opened it, but it cannot claim that
the still-deferred reference Settings controls are connected. Review remains a
separate route/gate; existing Proposal cards may open only the real currently
available Proposal destination and may not fabricate a reference Review page.
