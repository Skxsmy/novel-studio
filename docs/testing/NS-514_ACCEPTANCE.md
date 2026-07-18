# NS-514 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-514.md`
Updated: 2026-07-18

Binding reference:
`docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html`

Reference SHA-256 at P0:
`FA55F41FE3629360A1E193B3AF8CB7E578C420107A5FA445D3D493DAE92AC284`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| ID | Status | Proof type | Exact evidence target | Actual result |
| --- | --- | --- | --- | --- |
| NS-514-A01 | passed | automated/source | P0 Git baseline checks, tracked reference hash, and Web build | `apps/web` has no tracked diff from `HEAD` and no untracked files; reference is tracked as blob `876413e`; SHA-256 matches the value above; Web build passed |
| NS-514-A02 | passed | automated/source | `tests/docs/docs-check.test.mjs` — `keeps support work separate from the sequential M-to-NS mainline`; `npm.cmd run docs:check`; `git diff --check` | Governance test passed 7/7, documentation check passed for 102 Markdown files, and diff check passed with line-ending warnings only |
| NS-514-A03 | passed | automated/source | `tests/docs/ns-514-reference-contract.test.mjs` — `indexes every binding reference surface and ordered region` | Passed; generated contract deep-equals the binding HTML extraction and accounts for all 14 surfaces, ordered regions, classes, IDs, and controls |
| NS-514-A04 | passed | automated/source | `tests/docs/ns-514-reference-contract.test.mjs` — `maps reference states interactions breakpoints and fixtures without runtime leakage` | Passed; states, listener inventory, 31 media queries, navigation defaults, and fixture families match the binding HTML with no runtime/API requirement leakage |
| NS-514-A05 | passed | automated test | `apps/web/src/app/ReferenceAppShell.test.tsx` — `renders only the manifest shell regions in reference order`; `preserves the reference default workspace and disabled navigation` | Passed; the reference appbar, workspace order, default Codex state, disabled Review/Research controls, project switch, dialog order, tokens, and compact selectors are present without legacy shell regions |
| NS-514-A06 | passed | automated test | `apps/web/src/app/ReferenceAppShell.test.tsx` — `reproduces project menu and New Series dialog interactions`; `keeps reference shell interactions keyboard reachable` | Passed; workspace switching, menu open/dismiss, dialog validation/reset/local creation, initial focus, focus containment, backdrop dismissal, outside click, and Escape behavior match the reference interaction contract |
| NS-514-A07 | passed | automated/source | owning domain tests named `matches the NS-514 manifest for <workspace>` plus `ReferenceOverlays.test.tsx` | Passed; Overview, Settings, Plan, Write, Codex, Workshop, and all six reference overlays reproduce the binding roots, inner DOM, ordered regions, controls, default states, fixture anchors, and responsive rules without legacy additions |
| NS-514-A08 | passed | automated/diagnostic | `apps/web/src/app/ReferenceReplica.test.tsx` — `reproduces declared workspace interactions without calling product APIs`; `tests/e2e/ns-514-reference-structure.spec.ts` — `matches declared desktop and compact structural states` | Passed; the exact binding runtime handles workspace/menu/dialog/domain interactions without `fetch`, and Chrome reports identical key geometry/computed layout for replica and binding at 1600×1000, 1180×800, and 720×900 |
| NS-514-A09 | passed | automated/source | `apps/web/src/app/ReferenceReplica.test.tsx` — `assembles every reference surface without non-reference controls` plus the declared interaction/return-path case | Passed; application-frame and global-overlay order match the manifest, all six workspaces mount, reference return paths work, and no tested legacy shell selector is present |
| NS-514-A10 | passed | explicit user manual | `P4 author reference-replica visual review` | Passed by the author's 2026-07-15 direction to start P5 after the audit phase and gate were restated |
| NS-514-A11 | passed | automated/source | `tests/docs/ns-514-reference-audit.test.mjs` — `accounts for every manifest control exactly once` | Passed; all 368 binding controls appear once with node, state/interaction, frontend/API candidate, proposed disposition, structural fit, and pending author decision |
| NS-514-A12 | passed | automated/manual | `tests/docs/ns-514-reference-audit.test.mjs` — `accounts for every inventoried runtime capability exactly once` plus pre-NS-514 source review | Passed; 80 unique reachable `api.*` methods and 21 frontend-local capabilities appear once; 33 absent and 14 partial gaps are explicit; six handlerless old buttons and one disabled command placeholder are excluded with reasons |
| NS-514-A13 | in_progress | automated test | focused approved-mapping tests plus production-fixture exclusion regression | Write, Codex, Workshop, and Settings now use real runtime data and results with their fixture handlers excluded. The shared `New Series` dialog still reports a local fixture result without calling the Series creation API, so this broader gate remains open |
| NS-514-A14 | passed | automated test | affected existing safety tests plus exact new mapping regressions | Passed: revision, confirmation, atomic authority, Provider, cancellation, context, destructive-history, archived-read-only, and credential boundaries remain covered after the approved Write, Codex, Workshop, and Settings mappings |
| NS-514-A15 | planned | automated/source | focused/full commands, docs/link checks, diff and repository-state ledger | Pending P7 |
| NS-514-A16 | manual_pending | explicit user manual | `P7 final author visual acceptance` | Awaiting completed approved integration; diagnostics cannot pass this gate |
| NS-514-A17 | passed | automated test | `ReferenceWriteWorkspace.test.tsx` — `connects real Write data and the complete NovelEditor without fixture manuscript claims` | Passed with real hierarchy/Scene content/counts, effective block-aware Canon Description preview, and no binding fixture manuscript claim |
| NS-514-A18 | passed | automated test | `useProjectSession.test.tsx` — exact retry and conflict cases; connected Write status assertion | Passed: one initial request plus three delayed retries, stable Failed, next-edit restart, no conflict retry, and one animated live status slot |
| NS-514-A19 | passed | automated test | `ReferenceWriteWorkspace.test.tsx` — `manages Story changes from the Scene page without adding an editor insertion control` and `renders Story Change as a labeled Write surface while preserving its legacy actions`; existing `AppShell.test.tsx` — `creates edits collapses and deletes write progression blocks` | Passed: Add remains in the Scene page heading and calls the real block API; the replacement uses a labeled Write-only Story Change surface and sidebar index; edit/collapse/resize/reorder/focus/confirmed delete continue through the retained NovelEditor node path. The first visual treatment was author-rejected, and A16 remains pending for the replacement |
| NS-514-A20 | passed | automated test | `ReferenceWriteWorkspace.test.tsx` — `renames and confirms deletion from hierarchy title context menus without exposing Series lifecycle actions` | Passed for title-only mouse and keyboard menus, inline rename, cascade confirmation, real deletion callback, and no Series menu |
| NS-514-A21 | passed | automated test | connected Write disabled-state assertions plus `ReferenceReplica.test.tsx` fixture-runtime exclusion | Passed: Draft is fixed, deferred controls remain visible/selection-responsive but disabled, and the binding's fake Write runtime is omitted |
| NS-514-A22 | passed | automated test | `ReferenceCodexWorkspace.test.tsx` — `loads real Codex entries and manages category and entry lifecycle from keyboard-reachable context menus` | Passed: real categories/entries and counts load; removed lenses/filters/Reload are absent; keyboard menus execute Category rename/delete and Entry archive/restore/confirmed delete through real API calls |
| NS-514-A23 | passed | automated test | `ReferenceCodexWorkspace.test.tsx` — `adds and deletes structural Detail rows and deletes an unused Detail Type from context menus`; full Storage and Server regressions | Passed: appended row saves before showing the normal policy control, saved Detail deletion persists through `updateEntry`, Detail Type deletion uses confirmation, and the existing in-use blocker remains covered |
| NS-514-A24 | passed | contract/storage/server/Web | three Relation v2 contract cases; six focused migration/rollback/delete-blocker Storage cases; Server hard-delete route; `ReferenceCodexWorkspace.test.tsx` — `creates and deletes a description-only relation without archive controls` | Passed: v2 has no `type`, creation requires description, migration drops `type`, rollback restores exact v1 bytes and rejects later changes, damaged/duplicate authority causes no partial rewrite, Progression/Character Knowledge/Proposal references block Delete, stale revision conflicts, and the UI never calls Archive |
| NS-514-A25 | passed | storage/server/Web | full effective-entry Storage/Server regressions; `ReferenceCodexWorkspace.test.tsx` — `switches Baseline and Current Scene using the Write-selected Scene without future leakage` | Passed: the shared Write-selected Scene drives read-only Canon/Details, Research stays Baseline, future-count text and the blue hint are absent, and effective projection regressions pass |
| NS-514-A26 | passed | automated test | `ReferenceCodexWorkspace.test.tsx` — `opens real Progression and Mention targets in Write` | Passed: both controls resolve the actual Scene and block through the shared project-session callback; unresolved targets remain disabled in implementation |
| NS-514-A27 | passed | automated test | `ReferenceCodexWorkspace.test.tsx` — `keeps Mention sources stable while Canon popovers follow Baseline and Current Scene`; existing Write/NovelEditor mention-preview regressions | Passed: Manuscript and Codex mention sources stay independent of Canon mode, while highlighted Canon mentions preview the referenced Baseline or Current Scene effective Canon Description as selected |
| NS-514-A28 | passed | contract/storage/server/Web | `packages/contracts/test/codex.test.ts` — `accepts Detail Type v2 descriptions and projects v1 without inventing text`; `packages/storage/test/repository.test.ts` — `renames a Detail Type and atomically converts legacy Entry keys` plus the three migration/rollback cases; `apps/server/test/app.test.ts` — `persists Detail Type Rename descriptions and NSFW state through create update and list`; `apps/web/src/features/codex/ReferenceCodexWorkspace.test.tsx` — `reproduces the three-column Detail Type Library and persists descriptions` | Passed: the author-rejected two-column inline form is absent; the binding Category, Detail Type list, and selected editor columns are restored; description and NSFW use real version 2 writes; Rename and Delete are keyboard-reachable row context actions; Rename rejects same-Category duplicates and atomically converts non-conflicting legacy Entry keys without overwriting conflicts. A16 remains the separate visual acceptance gate |
| NS-514-A29 | passed | Web/storage/server | Exact Workshop session-filter, archived-read-only, mouse/keyboard/touch context-menu, lifecycle, no-double-click, and no-header-menu cases named in the active task | Passed: real active and archived sessions are filtered without fake counts; row menus open by right-click, Menu, Shift+F10, and touch long press; double-click does not Rename; Archived exposes only Export, Restore, and confirmed Delete; repository and route regressions reject archived writes and active-call lifecycle races |
| NS-514-A30 | passed | Web/storage/server | Exact bottom-right icon-menu, eligibility, edit/resend, branch, and complete-turn deletion cases named in the active task plus protected-history regressions | Passed: only eligible settled boundaries expose the icon menu; General Chat edit/resend truncates later unprotected history; Agent edit/resend is absent; complete-turn Delete and Branch preserve protected tool, Proposal, attachment, child-session, and source-link invariants; concurrent resend and Branch cannot leave a dangling reference |
| NS-514-A31 | passed | Web/server/storage | Exact merged-control, separate-cancel-command, terminal-cancelled, partial-content, no-retry/tool-side-effect, reduced-motion, and session-switch cases named in the active task | Passed: the single animated control reaches Send, Sending, Stop, and Stopping; a separate cancel command keeps the stream authoritative through terminal `cancelled`; cancellation before context or the first event, non-streaming cancellation, resend cancellation, late completion/cancel races, reduced motion, and session switching all converge without failure, interruption, retry, duplicate optimistic rows, or tool side effects |
| NS-514-A32 | passed | Provider/server/Web | Typed Provider reasoning, attempt-scoped Agent stream, reasoning-before-answer, initial expansion, per-message chevron, and no-Show-reasoning cases named in the active task | Passed: OpenAI-compatible, Anthropic, Gemini, DeepSeek, OpenRouter, Ollama, and Mock adapters use declared exact-model controls and typed reasoning events; General Chat and Agent streams render reasoning immediately above answer text; retry/repair resets are attempt-scoped; saved reasoning starts expanded and only its own chevron changes it |
| NS-514-A33 | passed | contract/Provider/server/Web/browser | Exact-model capability, version 2 preference persistence, separate model/runtime/Provider entries, no-invented-options, Settings return, credential-boundary cases, and partial-update preservation named in the active task | Passed: exact-model preferences and partial updates remain valid; Workshop keeps separate model, runtime-options, and Provider-settings entries; the Provider-settings path now opens the real Model connections editor and returns to the same Workshop session without exposing stored credentials |
| NS-514-A34 | passed | Web/server integration | `apps/web/src/features/workshop/ReferenceWorkshopWorkspace.test.tsx` — `keeps Not now local and reopens the unchanged pending tool request` and `reviews and confirms the exact pending tool request without bypassing server validation`; existing `apps/server/test/workshop-routes.test.ts` exact tool-execution validation cases | Passed: `Not now` closes and reopens the unchanged durable request without an API mutation; Confirm and run remains the only execution path, requires the exact server-owned payload, preserves atomic Codex validation, and holds the session activity boundary through Agent continuation |
| NS-514-A35 | passed | contract/storage | ADR-0017 Model Profile, Model Call Log, Workshop Message, Workshop Agent Run, Workshop Context Basket, and Context Bundle version 1 compatibility; version 2 write; hierarchy-preserving projection; exact rollback backup; damaged input; and changed-target refusal cases named in the active task | Passed: version 1 reads do not invent reasoning or cancellation history; version 2 writes persist normalized parameters, output kind, cancelled state, public hierarchy kinds, and internal `book` evidence; exact rollback artifacts restore version 1 bytes; damaged sources and changed targets are rejected without partial rewrites |
| NS-514-A36 | passed | Web/browser integration | `apps/web/src/features/settings/ReferenceSettingsWorkspace.regression-1.test.tsx` — `uses real model profiles and credential controls without fixture connection data`; `apps/web/src/app/ReferenceReplica.test.tsx` — `omits fixture Settings behavior when real model connections own the page` and `keeps real Model connections visible and provides a return to the exact Workshop session`; browser Settings recovery path inside `tests/e2e/ns-514-workshop-context-regression.spec.ts` | Passed: the connected Settings page loads and mutates real model profiles, reads only credential existence, saves or replaces and deletes credentials through the credential API, discovers models, tests connections, confirms archive, omits fixture handlers, and returns to the exact originating Workshop session |
| NS-514-A37 | passed | Web/server/browser integration | `apps/web/src/features/workshop/ReferenceWorkshopWorkspace.regression-1.test.tsx` — `keeps non-model Workshop controls usable without a configured model` and `preserves Shift Enter newlines and sends with Enter after model selection`; `tests/e2e/ns-514-workshop-context-regression.spec.ts` — `selects context in Workshop and proves the sent Context Bundle contains it` | Passed: Web regressions keep session, draft, multiline, attachment, and context controls usable with no model while disabling only model calls; real Chrome selected `Full Outline`, sent through Mock, then proved the persisted assistant-call Context Bundle contains the manually selected `full-outline` item for the same Series and that the prompt-audit export contains it |
| NS-514-A38 | passed | storage/browser integration | `packages/storage/test/workshop.test.ts` — `isolates a routeable schema-invalid Workshop message to its owning session`; `tests/e2e/ns-514-workshop-context-regression.spec.ts` mixed-session legacy case; normal-library real-Chrome coordinate clicks | Passed: the reader validates a message's Series and session routing identity before filtering, then fully validates only messages owned by the requested session. The isolated real-Chrome test includes a separate `codex-creation` message and still clicks the composer controls through the full context chain. Against the normal library, `New chat` loaded with Context, model selection, attachment, and message editor all enabled; coordinate clicks opened both popovers and focused the editor with no Workshop 4xx response. The owning damaged session still returns `INVALID_DATA`, and the regression proves the file is not rewritten. |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Phase Gates

| Phase | State | Evidence/gate |
| --- | --- | --- |
| P0 recovery | passed | A01-A02 passed |
| P1 reference contract | passed | A03-A04 passed |
| P2 shared shell | passed | A05-A06 passed; focused test, Web typecheck, and production build passed |
| P3 isolated workspaces | passed | A07-A08 passed |
| P4 assembled replica | passed | A09 automated evidence and explicit author gate A10 passed |
| P5 control/capability audit | passed | A11-A12 passed; all 469 decision rows remain `pending_author` |
| P6 approved integration | in_progress | A14 and A17-A38 pass. A13 remains open because the shared `New Series` dialog still uses a local fixture result; final author visual review is tracked separately by A16 |
| P7 final verification | planned | A15 plus explicit user gate A16 |

## Required Commands

```powershell
git diff --name-status HEAD -- apps/web
git ls-files --others --exclude-standard -- apps/web
git ls-files -s -- docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html
Get-FileHash -Algorithm SHA256 docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html
npm.cmd run build -w @novel-studio/web

# Added at P1-P7 as their planned tests become real:
node --test tests/docs/ns-514-reference-contract.test.mjs
npm.cmd run test -w @novel-studio/web
npm.cmd run typecheck -w @novel-studio/web
npm.cmd run build -w @novel-studio/web
npm.cmd run docs:check
git diff --check
```

## Adversarial Coverage

| Risk | Fixture/scenario | Expected result | Evidence |
| --- | --- | --- | --- |
| Rejected attempt leaks into restart | Tracked and untracked Web-file scans | No rejected NS-514 runtime file exists before new implementation | P0 passed |
| Unrelated work is overwritten | Dirty worktree contains user edits/deletions and `.hermes/plans/` | Every unrelated path remains byte-for-byte outside NS-514 patches | P0 inventory captured; final proof pending |
| Reference drift | Tracked blob and SHA-256 change without approved design update | Contract test fails and task records an explicit reference decision | P0 hash captured; P1 test planned |
| Fixture claims appear as project truth | Reference counts/story names rendered in production mode | Production-fixture exclusion test fails; UI uses real data or honest unavailable state | A13 planned |
| Old capability is silently removed | Capability has no reference control | P5 gap inventory records impact/options and requires author disposition | A12 passed; 33 absent and 14 partial rows recorded |
| Unsupported reference action appears real | Reference JavaScript simulates success without a backend | Production control remains disabled/local-only or is connected to a real result/error | A11 passed for classification; A13 remains planned for P6 production behavior |
| Existing authority safety is bypassed | Connected semantic/destructive action | Existing Proposal/Grant/revision/snapshot/atomic confirmation path remains mandatory | A14 planned |
| Narrow viewport hides required navigation | Declared compact breakpoints and long labels | Structure follows the reference contract, remains keyboard reachable, and does not fabricate a mobile editor | A06/A08 planned |
| Diagnostic evidence is mistaken for acceptance | Builds, DOM checks, or visual diagnostics pass | A10/A16 remain `manual_pending` until explicit author decisions are recorded | Enforced in matrix |
| Autosave burns requests after a persistent failure | Ordinary save fails repeatedly | One initial attempt and three retries occur; Failed remains stable until a later edit starts a new cycle | A18 passed |
| Right-click lifecycle removes the wrong scope | Series or a hierarchy row outside the title target is invoked | Only Volume through Scene title targets expose the menu; every delete names and confirms its cascade | A20 passed |
| Relation migration silently retains or invents `type` meaning | v1 Relation has a `type` and an empty or different description | v2 drops `type` without merging or synthesizing prose; rollback restores the byte-equivalent validated v1 authority | A24 passed |
| Relation Delete is archive in disguise or breaks references | Relation has a live Progression, Character Knowledge, Proposal, or evidence reference | Server rejects hard delete and leaves authority unchanged; the UI uses permanent Delete and never calls Archive | A24 passed |
| Current Scene leaks future state or becomes editable | Write selects an earlier Scene/block and later Progressions exist | Canon and Details use the selected Scene projection, Research stays Baseline, and all effective fields are read-only | A25 passed |
| Detail Type description is displayed but not durable | Author edits Description, closes the library, and opens it again | The version 2 authority write returns through the real API and the reopened selected editor shows the saved description | A28 passed |
| Detail Type Rename strands legacy name-keyed Entry values | An Entry stores Detail and context-policy values under the old display name | Rename converts both keys to the stable Detail Type identifier in the same authority transaction | A28 passed |
| Detail Type Rename overwrites an ambiguous Entry value | An Entry contains different values under the old display name and the stable identifier | The server rejects Rename and changes neither the Detail Type nor any Entry file | A28 passed |
| A model call races with another call, Branch, Archive, Restore, session Delete, or turn Delete | Two operations target one Workshop session before the first becomes terminal | The second operation returns conflict before Provider transport or history/lifecycle mutation; a different session remains independent | A29-A31 passed |
| Resend truncation races with Branch | Resend removes the selected turn's later history while Branch targets a later message | Per-session storage serialization leaves either a valid branch or no branch; no branch or child session references deleted source history | A30 passed |
| Stop races with the first stream event or a successful terminal result | The cancel command arrives before context, before the first event, or after the request settles | The operation converges to one authoritative cancelled or successful terminal result without duplicate messages, a false error, retry, or tool side effect | A31 passed |
| Exact-model metadata or preference saves arrive late | The author changes model, Series, session, or reasoning choice while requests are pending | Stale metadata and stale session/Series responses are ignored; Send waits for the current exact-model preference write and uses its returned normalized value | A29/A33 passed |
| Version 1 authority is damaged or its target changes before migration/rollback | One source fails validation or a post-migration file no longer matches the recorded target | Migration or rollback refuses the operation and leaves every unaffected authority file unchanged | A35 passed |
| A legacy message in one session disables every session in the same Series | One session contains a routeable version 1 message with removed mode `codex-creation`, while a separate version 2 session is empty and valid | Listing the valid session filters by the routing identity before full message validation and remains interactive; listing the legacy message's owning session still returns the validation failure; neither file is rewritten | A38 passed |

## Write P6 Acceptance Mapping

| Approved behavior | Exact proof before implementation completion |
| --- | --- |
| Complete NovelEditor and lightweight effective Canon Description preview | Existing `NovelEditor.test.tsx` cases plus new `ReferenceWriteWorkspace.test.tsx` real-data integration case |
| Compact autosave animation and retry state machine | New `useProjectSession.test.tsx` fake-timer/API cases plus Write status live-region case |
| Story Change add/edit/reorder/resize/delete confirmation | Existing editor/node behavior tests plus Scene-page management and labeled Write-presentation cases |
| Volume through Scene context rename/delete; no Series lifecycle menu | New hierarchy context-menu interaction case |
| Unsupported controls disabled; Draft fixed | New disabled-state inventory case |
| Visual result | A16 remains an explicit author gate; automated evidence cannot pass it |

## Codex P6 Acceptance Mapping

| Approved behavior | Exact proof before implementation completion |
| --- | --- |
| Real categories/entries, Archived Entries, no Story Lenses/In Scene/Changed/Watch/Reload, Category and Entry context lifecycle | A22 Web integration test with mouse and keyboard menus, confirmed Delete, real rename/archive/restore results, and no fixture counts or removed controls |
| Appended Structural Detail row, saved Detail deletion, and Detail Type context deletion | A23 Web row-state and context-menu tests plus existing/affected revision, validation, in-use, and delete server regressions |
| Description-only Relation v2 and guarded permanent Delete | A24 contract, migration/rollback, damaged-input, duplicate-ID, reference-blocker, route, and Web lifecycle tests governed by ADR-0015 |
| Baseline and read-only Current Scene | A25 effective-entry storage/server regressions plus Web shared-Scene, read-only, Research-baseline, no-blue-hint, and future-leakage assertions |
| Real Open in Write/Open Scene navigation | A26 Web navigation test for valid Scene/block targets and honest disabled state when a target is absent |
| Manuscript/Codex mention sources and Canon-page inline Entry preview | A27 verifies two independent behaviors: the separate Mentions page keeps its Manuscript/Codex source and real content when the Canon mode changes; the popover opened from a highlighted Entry inside the Canon page shows referenced Baseline Canon in Baseline mode and referenced effective Canon at the Write-selected Scene in Current Scene mode |
| Three-column Detail Type Library, description authority, and row lifecycle | A28 verifies the binding three-column structure, original list/editor placement, real Description and NSFW writes, context-menu-only Rename/Delete, revision protection, same-Category uniqueness, atomic legacy Entry key conversion, conflicting-key rejection, migration, and exact rollback under ADR-0016 |
| Visual result | A16 remains an explicit author gate; automated evidence cannot pass it |

## Workshop P6 Acceptance Mapping

| Approved behavior | Exact proof before implementation completion |
| --- | --- |
| Active and archived session filters plus row-only lifecycle menu | A29 exact Web interaction cases; real session API results; no fixture counts, double-click Rename, or header actions menu |
| Message bottom-right icon menu and eligibility | A30 exact Web cases plus existing protected resend/branch/delete storage and server regressions |
| One Send/Sending/Stop/Stopping control and truthful cancellation | A31 Web state/reduced-motion/session-switch cases plus separate cancel command, cancelled authority, no retry, and no tool-side-effect server/storage cases |
| Immediate reasoning above answer for General Chat and Agent | A32 Provider typed-event cases, attempt-scoped server stream cases, and Web order/expansion/chevron cases |
| Separate model, runtime options, and Provider Settings entries with exact-model persistence | A33 contract, Provider, model-profile route, Web model-switch, and Settings entry/return cases |
| `Not now` changes no durable request | A34 Web reopen-unchanged case plus existing exact Confirm and run server validation |
| Versioned authority, migration, and rollback | A35 contract and storage compatibility for model, call, message, run, public context basket, and internal Context Bundle authority; hierarchy-preserving projection; damaged-input; exact-backup; and changed-target refusal cases under ADR-0017 |
| Browser acceptance | After implementation is committed, the explicitly requested `qa` skill runs the affected Workshop paths in a clean QA worktree; its report is diagnostic evidence and does not pass A16 |
| Visual result | A16 remains an explicit author gate; skill/browser evidence cannot pass it |

## Workshop Clean-Worktree Browser Quality Assurance

- The requested `qa` skill was used first. Its bundled browser daemon failed on
  Windows in three distinct startup attempts because its executable could not
  resolve the server script and its temporary package lacked required runtime
  modules. Following that skill's documented fallback, the Playwright skill ran
  the same real-browser acceptance scope. No project dependency was added.
- The browser used the isolated worktree
  `D:\tmp\novel-studio-ns514-qa-41d43fb` and isolated library
  `D:\tmp\novel-studio-ns514-qa-library`. At the end of implementation
  verification, clean-worktree commit `5184272` and branch commit `02abdde`
  had the identical tree `e129f8bdbd117a32424eb44df3dfe1368ca29b8f`;
  the isolated worktree had no tracked or untracked status output.
- Browser inspection is diagnostic evidence only. It does not pass the explicit
  author visual-acceptance gate `NS-514-A16`.

### Confirmed Browser Defects And Repairs

| Confirmed defect | Repair commit | Regression and browser result |
| --- | --- | --- |
| A Series with zero Workshop sessions hid the sidebar before the author could create the first conversation | `41d43fb` | The sidebar and enabled `New conversation` control remain present; the real API creates the first General Chat session |
| The `New conversation` menu was mounted but hidden because the binding visibility class was absent | `3ad5d85` | The menu carries `is-open`; General Chat and Agent choices are visible and create real sessions |
| Context selection, model selection, and model options dialogs were mounted but hidden by the same missing visibility class | `1bec4ff` | All three dialogs carry `is-open`; browser snapshots expose their real controls and the focused Web suite protects the state class |
| The first message's bottom-right action menu opened upward behind the conversation header, which intercepted `Edit and resend` | `505d8e4` | Placement now switches below when there is insufficient space above; a normal, non-forced browser click enters the edit state |
| At 375 pixels, the session sidebar disappeared without a replacement entry point, the opened drawer hid session titles and filters, and an implicit grid column widened the conversation to 672 pixels | `afa206a`, `ca5f95a`, `28e41c2` | `Open conversations` exposes New, Search, All, Chat, Agent, Archived, title, kind, and time; choosing a session closes the drawer; measured document and conversation widths are exactly 375 pixels and the composer is 347 pixels with no horizontal overflow |
| Saving only a reasoning preference silently replaced the Model Profile capabilities with `false` defaults and changed its context window from 32000 to 8192 | `02abdde` | Update contracts no longer materialize omitted defaults; route and contract regressions prove untouched fields remain unchanged; the browser/API recheck preserved all five Mock capabilities and 32000 tokens while persisting `high` |

### Browser Paths Verified

| Area | Real-browser result |
| --- | --- |
| Session creation and filtering | Created General Chat and Agent sessions through `New conversation`; All, Chat, Agent, and Archived showed the correct real session kinds without fake counts |
| Session lifecycle | Right-click exposed the approved menu; double-click did not Rename; Rename, Archive, read-only Archived state, Restore, Delete confirmation cancellation, and confirmed permanent Delete all reached real APIs |
| General Chat session controls | Saved and reopened the per-conversation system prompt; opened Export with separate reasoning and prompt-audit choices |
| Provider navigation | `Provider settings` opened Settings at `Model connections`; `Return to Workshop` returned to the exact originating session |
| Context and attachments | Added Full Outline to the real context basket and observed the count change from zero to one; uploaded `PROJECT.md` to the isolated library and observed `Ready` before sending |
| Model and reasoning | The model picker displayed the model name without the Provider-profile title; model options displayed Stream responses plus the exact model's disabled, low, medium, and high choices; `high` persisted without changing other Model Profile fields |
| Sending and response | A real local Mock stream produced the observed control sequence `Sending` to `Stop` to `Send`; reasoning appeared immediately above the public answer and remained expanded |
| Message actions and history | The icon-only bottom-right menu exposed Edit and resend, Resend, Branch, and Delete turn; Edit and resend was clickable after the placement repair; Branch created a real child conversation |
| Responsive behavior | At 375 by 812 pixels the mobile conversation drawer remained usable, long prose wrapped, the input toolbar stayed inside the viewport, and no horizontal overflow remained |
| Runtime diagnostics | Browser console errors: zero; all observed Workshop, Model Profile, context, attachment, stream, lifecycle, and delete requests returned successful status codes |

### Confirmed Adjacent Finding Outside The Workshop Slice

- The shared reference application shell's `New Series` dialog currently shows
  a local `Created` result without calling the Series creation API. This is a
  confirmed fixture-only shell behavior, not a Workshop implementation defect.
  It was not changed without an approved shared-shell integration disposition;
  it remains open under the broader in-progress `NS-514-A13` production-data
  gate.

## 2026-07-18 Settings And Workshop Recovery Verification

- The earlier Provider-navigation browser claim was reopened because it had
  only reached the static reference Settings page. Commit `d532e79` restores
  the real connected Model connections editor inside the approved Settings
  structure. The production reference runtime no longer installs the fixture
  Settings handlers.
- Commit `1f01082` keeps non-model Workshop work usable, disables only actions
  that require a model call, preserves multiline message display, keeps the
  conversation scrolled to new streaming content, and adds an honest empty
  model state with a working Model connections route.
- `tests/e2e/ns-514-workshop-context-regression.spec.ts` uses a unique isolated
  project library. It first proves the zero-model state and the real Settings
  return path, then creates a local Mock profile, selects `Full Outline` through
  the visible Workshop context control, sends with Enter, waits for the real
  stream, reads the persisted assistant-call Context Bundle, and verifies the
  same manually selected `full-outline` item and Series source in both the JSON
  authority and prompt-audit export.
- The browser test neither reads nor mutates the author's normal project
  library or Windows credential entries. Stored secret values remain outside
  project JSON and are never returned to the Settings page; the Settings
  regression verifies credential existence and lifecycle API calls without
  displaying secret material.
- The author's subsequent normal-library test invalidated the broader claim
  that Workshop interaction was restored for existing project data. A direct
  real-Chrome reproduction selected the version 2 `New chat` session and found
  the Context control, model selector, attachment control, and message editor
  disabled. The session detail request returned 422 even though that session
  had no messages. Metadata-only inspection located the failure in twenty
  routeable version 1 `codex-creation` messages owned by the separate
  `Scene continuity pass` session. A37 remains evidence for the isolated
  context-to-Context-Bundle chain; A38 now owns mixed-session compatibility and
  normal-library interactivity. A38 passed after the reader was corrected and
  both the isolated mixed-session regression and the normal-library coordinate
  clicks succeeded without rewriting project authority.

| Recovery path | Actual result |
| --- | --- |
| No model configured | Message drafting, Shift+Enter multiline input, context selection, attachment selection, new conversation, Branch, eligible Delete turn, and session lifecycle remain available; Send, model options, Edit and resend, and Resend are disabled with an explanation |
| Settings recovery | `Open Model connections` reaches the real editor; connection name, Provider, model, Base URL, context window, credential status, save, test, model discovery, credential deletion, and confirmed archive use the real APIs; unsupported Settings pages retain their structure with controls disabled |
| Return path | `Return to Workshop` restores the exact originating session |
| Context selection | The visible context count changes from zero to one after the successful real context-basket `PUT` |
| Sent context proof | The persisted assistant-call Context Bundle contains `kind: full-outline`, `manuallySelected: true`, and the exact Series source selected through the interface; the prompt-audit export contains the same item |
| Mixed-session compatibility | A separate routeable version 1 `codex-creation` message no longer blocks the valid session. The damaged message's owning session still returns `INVALID_DATA`, and its exact source bytes remain unchanged |
| Normal-library interaction | In `New chat`, Context, model selection, attachment, and the message editor all reported `disabled: false`; coordinate clicks opened the Context and model popovers and focused the editor; no Workshop request returned 4xx |
| Browser diagnostics | Real Chrome completed with no captured console errors or page errors |

## Run Ledger

| Date | Commit/worktree | Command or manual procedure | Result |
| --- | --- | --- | --- |
| 2026-07-15 | `27d0c10`, dirty unrelated worktree plus untracked rebuild plan | `git diff --name-status HEAD -- apps/web` | Passed; no tracked Web diff. Git emitted only an existing LF-to-CRLF warning for `codexViewModel.ts` |
| 2026-07-15 | `27d0c10`, same worktree | `git ls-files --others --exclude-standard -- apps/web` | Passed; no untracked Web file |
| 2026-07-15 | `27d0c10`, same worktree | `git ls-files -s -- docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html` | Passed; tracked blob `876413ea842cd6ecc3ac36a7775de2effb82f77c` |
| 2026-07-15 | `27d0c10`, same worktree | `Get-FileHash -Algorithm SHA256 docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html` | Passed; `FA55F41FE3629360A1E193B3AF8CB7E578C420107A5FA445D3D493DAE92AC284` |
| 2026-07-15 | `27d0c10`, same worktree | `npm.cmd run build -w @novel-studio/web` | Passed; TypeScript and Vite built 234 modules |
| 2026-07-15 | `27d0c10`, task activation worktree | `node --test tests/docs/docs-check.test.mjs` | Passed; 7 tests including the exact explicit-user deferral case |
| 2026-07-15 | `27d0c10`, task activation worktree | `npm.cmd run docs:check` | Passed for 102 Markdown files |
| 2026-07-15 | `27d0c10`, task activation worktree | `git diff --check` | Passed; only existing LF-to-CRLF warnings were emitted |
| 2026-07-15 | `27d0c10`, P1 worktree | `node --test tests/docs/ns-514-reference-contract.test.mjs` | Passed; 2 tests |
| 2026-07-15 | `27d0c10`, P1 worktree | `npm.cmd run docs:check` | Passed for 103 Markdown files |
| 2026-07-15 | `27d0c10`, P1 worktree | `git diff --check` | Passed; only existing LF-to-CRLF warnings were emitted |
| 2026-07-15 | `27d0c10`, P2 worktree | `npm.cmd run test -w @novel-studio/web -- ReferenceAppShell.test.tsx` | Passed; 4 tests covering shell structure/defaults and project-menu/New-Series interactions |
| 2026-07-15 | `27d0c10`, P2 worktree | `npm.cmd run typecheck -w @novel-studio/web` | Passed |
| 2026-07-15 | `27d0c10`, P2 worktree | `npm.cmd run build -w @novel-studio/web` | Passed; Vite built 19 reference-shell modules |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | focused NS-514 Web tests for shell, six workspaces, overlays, and replica | Passed; 9 files and 14 tests |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | `node --test tests/docs/ns-514-reference-contract.test.mjs` | Passed; 2 tests |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | `npm.cmd run typecheck -w @novel-studio/web` | Passed |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | `npm.cmd run build -w @novel-studio/web` | Passed; Vite built 27 modules |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | `npm.cmd run test:e2e:quick -- tests/e2e/ns-514-reference-structure.spec.ts` | Passed in real Chrome; replica and binding key geometry/computed layout matched at desktop, compact, and narrow viewports; diagnostic screenshots were written only to the temporary browser-acceptance directory |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | manual diagnostic inspection of desktop and narrow replica/binding screenshots | No visible discrepancy found; diagnostic only, and A10 remains `manual_pending` |
| 2026-07-15 | `27d0c10`, P4 gate worktree | `npm.cmd run test -w @novel-studio/web` | Passed; all 15 Web test files and 103 tests |
| 2026-07-15 | `27d0c10`, P4 gate worktree | `node --test tests/docs/docs-check.test.mjs` | Passed; 7 tests |
| 2026-07-15 | `27d0c10`, P4 gate worktree | `npm.cmd run docs:check` | Passed for 103 Markdown files |
| 2026-07-15 | `27d0c10`, P4 gate worktree | `git diff --check` | Passed; only existing LF-to-CRLF warnings were emitted |
| 2026-07-15 | `27d0c10`, P5 activation worktree | Author direction `开始` after P5 scope/gate explanation | P4 visual gate A10 passed and P5 audit authorized; no P6 integration authorized |
| 2026-07-15 | `27d0c10`, P5 audit worktree | Manual pre-NS-514 source review plus generated `docs/tasks/NS-514_REFERENCE_CONTROL_AND_CAPABILITY_AUDIT.md` | Accounted for 368 reference controls, 80 reachable API methods, 21 frontend-local capabilities, six handlerless old buttons, and one disabled command placeholder; every decision remains pending author review |
| 2026-07-15 | `27d0c10`, P5 audit worktree | `node --test tests/docs/ns-514-reference-audit.test.mjs` | Passed; 2 tests proving exact reference-control and old-capability accounting |
| 2026-07-15 | `27d0c10`, P5 audit worktree | `node --test tests/docs/ns-514-reference-contract.test.mjs` | Passed; 2 tests confirming the audit still targets the unchanged binding contract |
| 2026-07-15 | `27d0c10`, P5 audit worktree | `npm.cmd run docs:check` | Passed for 104 Markdown files after the audit and evidence updates |
| 2026-07-15 | `27d0c10`, P5 audit worktree | `git diff --check` | Passed; only existing LF-to-CRLF working-copy warnings were emitted |
| 2026-07-15 | branch `codex/ns-410-json-authority`, commit `27d0c10` | `git branch --show-current`; `git rev-parse --short HEAD`; `git status --short` | Confirmed the NS-514 files are uncommitted, P6 has no integration changes, and the previously recorded unrelated edits/deletions plus `.hermes/plans/` remain present |
| 2026-07-15 | `27d0c10`, P5 reporting worktree | Process incident: the generated audit path was temporarily removed and re-added while regenerating its embedded machine block | Defect acknowledged; the audit file was restored, the binding reference was untouched, and root `AGENTS.md` now forbids delete-and-readd modification of an existing path |
| 2026-07-15 | `27d0c10`, P5 comparison worktree | Author-requested detailed Settings, Write, Codex, and Workshop comparison documents | Recorded complete per-page matrices for shared, new-only, old-only, partial, disabled, fixture, authority, safety, accessibility, and pending-decision behavior; no P6 wiring authorized |
| 2026-07-15 | `27d0c10`, P5 comparison worktree | `npm.cmd run docs:check` | Passed for 109 Markdown files after adding and indexing the four page comparisons |
| 2026-07-15 | `27d0c10`, P5 comparison worktree | `git diff --check` | Passed; only existing LF-to-CRLF working-copy warnings were emitted |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `npm.cmd run test -w @novel-studio/web` | Passed; 16 Web test files and 107 tests before adding the final focused Story Change placement/API assertion |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `npm.cmd run build -w @novel-studio/web` | Passed; TypeScript and Vite built 189 modules; emitted only the existing chunk-size advisory |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `npm.cmd run test -w @novel-studio/web -- ReferenceWriteWorkspace.test.tsx useProjectSession.test.tsx` | Passed after the final assertion; 2 files and 5 tests covering real Write data, effective preview, selection visuals/disabled controls, Story Change placement/API, hierarchy lifecycle, autosave retries, and conflicts |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `node --test tests/docs/ns-514-reference-contract.test.mjs tests/docs/ns-514-reference-audit.test.mjs tests/docs/docs-check.test.mjs` | Passed; 11 tests. The completed P5 audit remains an immutable semantic snapshot while capability identities and the current reachable API set are still checked exactly |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `npm.cmd run docs:check`; `git diff --check` | Passed for 109 Markdown files; diff check emitted only existing LF-to-CRLF working-copy warnings |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | Author review: `story change 界面完全不合格。重做` | The first connected Story Change visual treatment is rejected. No visual acceptance is inferred; the retained lifecycle and approved Scene-page placement remain unchanged |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | `npm.cmd run test -w @novel-studio/web -- ReferenceWriteWorkspace.test.tsx` | Passed; 1 file and 4 tests, including the new labeled Write-only Story Change structure, sidebar index, and replacement delete confirmation copy |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx -t "creates edits collapses and deletes write progression blocks"` | Passed; 1 targeted legacy lifecycle regression, with 74 unrelated tests skipped |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | `npm.cmd run build -w @novel-studio/web` | Passed; TypeScript and Vite built 189 modules and emitted only the existing chunk-size advisory |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | `npm.cmd run docs:check`; `git diff --check` | Passed for 109 Markdown files; diff check emitted only existing LF-to-CRLF working-copy warnings |
| 2026-07-15 | `27d0c10`, NS-514 pre-commit worktree | `npm.cmd run test -w @novel-studio/web` | Passed; all 16 Web test files and 109 tests after the Story Change replacement regression was added |
| 2026-07-15 | `e62315a`, Codex decision-recording worktree | Author decisions for Entry/Detail/Relation/Current Scene/filter/navigation dispositions, including no preservation or merge of legacy Relation `type` | Product/UX decisions, ADR-0015, and planned A22-A27 proofs recorded; no Codex implementation authorized or performed |
| 2026-07-15 | `e62315a`, Codex decision-recording worktree | `npm.cmd run docs:check` | Passed for 110 Markdown files |
| 2026-07-15 | `e62315a`, Codex decision-recording worktree | `node --test tests/docs/docs-check.test.mjs tests/docs/ns-514-reference-contract.test.mjs tests/docs/ns-514-reference-audit.test.mjs` | Passed 11/11; P5 binding/audit snapshots remain intact and active-task documentation is consistent |
| 2026-07-15 | `e62315a`, Codex decision-recording worktree | `git diff --check`; `git branch --show-current`; `git rev-parse --short HEAD`; `git status --short` | Diff check passed with existing LF-to-CRLF warnings only; branch is `codex/ns-410-json-authority`, tip is `e62315a`, only the nine Codex decision documents are task-related dirty files, and all previously unrelated dirty files remain present |
| 2026-07-15 | `e62315a`, Codex decision correction | Author correction that In Scene/Changed are removed, Category and saved Detail lifecycle use context menus, and Entry Reload is not retained | A22-A23 and the product/UX/comparison records corrected; Mention behavior is recorded by the following decision, and no runtime implementation was performed |
| 2026-07-15 | `e62315a`, Codex mention clarification | Author confirms separate Manuscript/Codex mention sources and manuscript-style preview for Codex Entries mentioned in Canon Description | Product/UX/comparison and planned A27 proof updated; no runtime implementation was performed |
| 2026-07-15 | `e62315a`, Mention/view-boundary clarification | The Baseline/Current Scene switch changes Canon and Details page content, not the separate Mentions page or its selected source | Product/UX/A27 wording separates the Mentions page from the popover inside the Canon page; no runtime implementation was performed |
| 2026-07-15 | `e62315a`, Canon popover final decision | Author confirms that the popover opened from a highlighted Entry inside the Codex Canon page must follow the Canon mode | Baseline mode uses the referenced Entry's Baseline Canon summary; Current Scene mode uses its effective Canon summary at the Scene currently open in Write; the separate Mentions page remains unaffected |
| 2026-07-15 | `e62315a`, corrected Codex decision record | `npm.cmd run docs:check`; `node --test tests/docs/docs-check.test.mjs tests/docs/ns-514-reference-contract.test.mjs tests/docs/ns-514-reference-audit.test.mjs`; `git diff --check` | Documentation passed for 110 files, all 11 documentation/audit contract tests passed, and diff check passed with existing line-ending warnings only |
| 2026-07-16 | `e62315a`, Codex P6 implementation worktree | `npm.cmd run test -w @novel-studio/web -- --run src/features/codex/ReferenceCodexWorkspace.test.tsx --reporter=dot` | Passed 7/7 after strengthening Category rename/delete, Entry archive/restore/confirmed delete, saved Detail persistence, Relation lifecycle, Current Scene, navigation, and Mention preview assertions |
| 2026-07-16 | `e62315a`, Codex P6 implementation worktree | `npm.cmd run test -w @novel-studio/web -- --run src/app/ReferenceReplica.test.tsx --reporter=dot` | Passed 4/4; connected Codex removes fixture data and fixture handlers while preserving workspace navigation and the other reference runtimes |
| 2026-07-16 | `e62315a`, Codex P6 implementation worktree | full Contracts, Storage, Server, and Web tests | Contracts passed 31/31, Server passed 84/84, and Web passed 116/116. Storage passed 102/102 before the final Character Knowledge/Proposal blocker case; the final full Storage result is recorded below |
| 2026-07-16 | `e62315a`, Codex P6 implementation worktree | Contracts, Storage, Server, and Web typechecks | Passed for all four workspaces |
| 2026-07-16 | `e62315a`, Codex P6 implementation worktree | `npm.cmd run build` | Passed the complete Contracts, AI, Storage, Server, and Web production build; Vite built 190 modules and emitted only the existing chunk-size advisory |
| 2026-07-16 | `e62315a`, Codex P6 implementation worktree | in-app browser diagnostic setup for `http://127.0.0.1:5173/` | Local Web became ready, but the browser runtime reported no available browser backend. No visual result or acceptance is claimed; A16 remains open |
| 2026-07-16 | `e62315a`, final Codex P6 validation worktree | `npm.cmd run test -w @novel-studio/web -- --run --reporter=dot --silent=passed-only` | Passed all 16 Web test files and 116 tests |
| 2026-07-16 | `e62315a`, final Codex P6 validation worktree | `npm.cmd run test -w @novel-studio/storage -- --run --reporter=dot` | Passed all 7 Storage test files and 103 tests, including the final Character Knowledge and Proposal reference-blocker case |
| 2026-07-16 | `e62315a`, final Codex P6 validation worktree | `node --test tests/docs/docs-check.test.mjs tests/docs/ns-514-reference-contract.test.mjs tests/docs/ns-514-reference-audit.test.mjs` | Passed 11/11. The P5 audit remains an implementation-before snapshot, while the test proves that its only current capability drift is the approved replacement of Relation Archive by permanent Delete |
| 2026-07-16 | `e62315a`, final Codex P6 validation worktree | `npm.cmd run docs:check`; `git diff --check` | Documentation passed for 110 Markdown files; diff check passed with existing line-ending warnings only |
| 2026-07-16 | `e62315a`, Detail Type Library correction worktree | Contracts, Storage, Server, and Web typechecks | Passed for all four workspaces after rebuilding the changed Contracts declarations consumed by Storage |
| 2026-07-16 | `e62315a`, Detail Type Library correction worktree | focused contract, Storage Rename, Server update, and Web three-column/context-menu tests | Passed: Contracts 4/4, Storage 1/1 with 68 unrelated cases skipped, Server 1/1 with 12 unrelated cases skipped, and Web 1/1 with 7 unrelated cases skipped |
| 2026-07-16 | `e62315a`, Detail Type Library correction worktree | first parallel full-suite attempt | Contracts, Server, and Web jobs were running, while one unrelated Storage hierarchy smoke test exceeded its fixed five-second limit under four-workspace contention; the other 106 Storage tests passed. No assertion or timeout was changed |
| 2026-07-16 | `e62315a`, Detail Type Library correction worktree | full Contracts, Storage, Server, and Web tests with Storage rerun without four-workspace contention | Passed: Contracts 32/32, Storage 107/107, Server 85/85, and Web 117/117 |
| 2026-07-16 | `e62315a`, Detail Type Library correction worktree | `npm.cmd run build` | Passed the complete Contracts, artificial-intelligence, Storage, Server, and Web production build; Vite built 190 modules and emitted only the existing chunk-size advisory |
| 2026-07-16 | `e62315a`, Detail Type Library correction worktree | `node --test tests/docs/docs-check.test.mjs tests/docs/ns-514-reference-contract.test.mjs tests/docs/ns-514-reference-audit.test.mjs`; `npm.cmd run docs:check`; `git diff --check` | Passed 11/11 documentation and audit tests; documentation passed for 111 Markdown files; diff check emitted only existing line-ending warnings |
| 2026-07-16 | branch `codex/ns-410-json-authority` | `git commit -m "NS-514 feat(codex): connect approved reference workspace"`; post-commit `git status --short` review | Created implementation commit `c4dd028` with exactly 40 NS-514 files and no deletions. The unrelated HANDOFF, NS-507, design-directory, and `.hermes/plans/` changes remain outside the commit |
| 2026-07-17 | `8fe2d44`, Workshop P6 integration review worktree | Root review of active-call, lifecycle, history, archive, stale-response, optimistic-state, and exact-model preference boundaries | Corrected a resend-versus-Branch storage race, added Branch to the active-session boundary, serialized archived-session message/attachment writes, corrected one invalid frontend test fixture, and retained the legacy storage-hierarchy helper only for the old workspace while the connected reference workspace uses the public hierarchy |
| 2026-07-17 | `8fe2d44`, Workshop P6 worktree | `npm.cmd run typecheck -w @novel-studio/storage`; `npm.cmd run test -w @novel-studio/storage -- test/workshop.test.ts` | Passed Storage typecheck and all 27 focused Workshop storage tests, including archived read-only authority and concurrent resend/Branch consistency |
| 2026-07-17 | `8fe2d44`, Workshop P6 worktree | six focused Workshop Server files; connected Workshop plus reference and legacy shell Web files | Passed 6 Server files and 71 tests; passed 3 Web files and 112 tests |
| 2026-07-17 | `8fe2d44`, Workshop P6 worktree | `npm.cmd run test` | Passed all suites: Server 102/102, Web 158/158, artificial-intelligence Provider layer 39/39, Contracts 43/43, and Storage 121/121 |
| 2026-07-17 | `8fe2d44`, Workshop P6 worktree | `npm.cmd run typecheck --workspaces --if-present` | Passed Server, Web, artificial-intelligence Provider layer, Contracts, and Storage typechecks. The root wrapper's redundant pre-typecheck Contracts rebuild separately encountered a transient Windows `EPERM` write lock; no typecheck failed, and the complete production build below rebuilt the same artifacts successfully |
| 2026-07-17 | `8fe2d44`, Workshop P6 worktree | `npm.cmd run build` | Passed complete Contracts, artificial-intelligence Provider layer, Storage, Server, and Web production build; Vite built 194 modules and emitted only the existing chunk-size advisory |
| 2026-07-17 | `8fe2d44`, Workshop P6 worktree | `npm.cmd run docs:check`; `node --test tests/docs/docs-check.test.mjs tests/docs/ns-514-reference-contract.test.mjs tests/docs/ns-514-reference-audit.test.mjs` | Documentation passed for 112 Markdown files; all 11 governance, reference-contract, and audit tests passed |
| 2026-07-17 | `8fe2d44`, Workshop P6 Provider review | Manual comparison against every official Provider source listed in ADR-0017 | Confirmed the implemented exact-model controls and request fields for OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, and Ollama; models without exact declared metadata remain unsupported instead of inheriting a family guess |
| 2026-07-17 | `ee1a4f3` through `02abdde`, branch implementation worktree | Skill-directed clean-worktree browser acceptance against the production build and isolated real authority | Confirmed the browser paths listed above, found six defect groups, repaired each in place, and re-ran the failing path after every repair; no author visual acceptance is claimed |
| 2026-07-17 | `02abdde`, branch implementation worktree | `npm.cmd run test` | Passed all suites: Server 102/102, Web 160/160, artificial-intelligence Provider layer 39/39, Contracts 43/43, and Storage 121/121 |
| 2026-07-17 | `02abdde`, branch implementation worktree | `npm.cmd run typecheck --workspaces --if-present` | Passed Server, Web, artificial-intelligence Provider layer, Contracts, and Storage typechecks |
| 2026-07-17 | `02abdde`, branch implementation worktree | `npm.cmd run build` | Passed the complete Contracts, artificial-intelligence Provider layer, Storage, Server, and Web production build; Vite built 194 modules and emitted only the existing chunk-size advisory |
| 2026-07-17 | branch `02abdde`, clean worktree `5184272` | `git rev-parse "HEAD^{tree}"`; `git status --short` in both worktrees | Both worktrees reported tree `e129f8bdbd117a32424eb44df3dfe1368ca29b8f`; the clean quality-assurance worktree reported no dirty paths, while the branch worktree retained only the previously inventoried unrelated paths |
| 2026-07-17 | `02abdde`, branch documentation worktree | `npm.cmd run docs:check`; `node --test tests/docs/docs-check.test.mjs tests/docs/ns-514-reference-contract.test.mjs tests/docs/ns-514-reference-audit.test.mjs`; `git diff --check -- STATUS.md CHANGELOG.md docs/testing/NS-514_ACCEPTANCE.md` | Passed for 112 Markdown files and all 11 documentation/reference-audit tests; diff check reported only the existing line-ending conversion warnings |
| 2026-07-18 | `d532e79`, Settings recovery worktree | focused connected Settings and reference-replica regressions; `npm.cmd run typecheck -w @novel-studio/web` | Passed 3 files and 9 tests; Web typecheck passed. The commit contains the real Model connections editor, fixture-runtime exclusion, and exact-session return path |
| 2026-07-18 | `1f01082`, Workshop recovery worktree | `npm.cmd run test -w @novel-studio/web -- src/features/workshop/ReferenceWorkshopWorkspace.test.tsx src/features/workshop/ReferenceWorkshopWorkspace.regression-1.test.tsx src/features/settings/ReferenceSettingsWorkspace.regression-1.test.tsx src/app/ReferenceReplica.test.tsx` | Passed 4 files and 49 tests covering zero-model behavior, multiline send, model-dependent message actions, Settings lifecycle, and exact-session return |
| 2026-07-18 | `1f01082`, isolated browser library and production build | `npx.cmd playwright test tests/e2e/ns-514-workshop-context-regression.spec.ts --project=chrome` | Passed 1/1 in real Chrome. The test proved zero-model usability, real Settings navigation, model recovery, visible context selection, Mock streaming, persisted assistant-call Context Bundle content, prompt-audit content, and zero captured browser errors |
| 2026-07-18 | `1f01082`, Workshop recovery worktree | `npm.cmd run test -w @novel-studio/web`; `npm.cmd run test` | Passed all 18 Web files and 164 tests; repository suites passed Server 102/102, Web 164/164, artificial-intelligence Provider layer 39/39, Contracts 43/43, and Storage 121/121 |
| 2026-07-18 | `1f01082`, Workshop recovery worktree | `npm.cmd run typecheck --workspaces --if-present`; `npm.cmd run build` | All five workspace typechecks passed; the complete Contracts, artificial-intelligence Provider layer, Storage, Server, and Web production build passed with 196 Web modules and only the existing chunk-size advisory |
| 2026-07-18 | `1f01082`, repair evidence worktree | `npm.cmd run docs:check`; `node --test tests/docs/docs-check.test.mjs tests/docs/ns-514-reference-contract.test.mjs tests/docs/ns-514-reference-audit.test.mjs`; `git diff --check -- STATUS.md CHANGELOG.md docs/testing/NS-514_ACCEPTANCE.md`; branch, commit, and dirty-file inspection | Documentation passed for 118 Markdown files; all 11 governance, reference-contract, and audit tests passed; scoped diff check passed with line-ending warnings only; branch is `codex/ns-410-json-authority`; implementation tip is `1f01082`; only `STATUS.md`, `CHANGELOG.md`, and this acceptance record are task-related dirty files awaiting the evidence commit, while all inventoried unrelated changes remain unstaged |
| 2026-07-18 | `49e28a8` plus A38 worktree | focused storage regression before the fix | Failed exactly as required: listing the valid session rejected at `listWorkshopMessageFiles` because the unrelated `codex-creation` message was fully validated before filtering |
| 2026-07-18 | A38 implementation worktree | `npm.cmd run test -w @novel-studio/storage -- --run test/workshop.test.ts`; Contracts and Storage typechecks | Passed all 28 Workshop storage tests; both typechecks passed. The new test proves valid-session isolation, owning-session failure, and exact preservation of the damaged source bytes |
| 2026-07-18 | A38 implementation worktree | `npm.cmd run build`; `npm.cmd run test:e2e:quick -- tests/e2e/ns-514-workshop-context-regression.spec.ts --project=chrome` | Complete production build passed with 196 Web modules and only the existing chunk-size advisory; the mixed-session real-Chrome context-to-Context-Bundle regression passed 1/1 |
| 2026-07-18 | A38 implementation worktree, normal `data/library` | fresh real Chrome at `http://127.0.0.1:4317`; coordinate clicks on the `New chat` Context control, model selector, and message editor | Context, model selection, attachment, and editor reported `disabled: false`; the Context and model popovers opened; the editor received focus; no Workshop request returned 4xx. The first attempt was excluded because the detached service had exited before Chrome connected; the successful check used an attached healthy service |
| 2026-07-18 | A38 implementation worktree | `npm.cmd run test`; `npm.cmd run typecheck --workspaces --if-present`; documentation checks; scoped `git diff --check` | Passed Server 102/102, Web 164/164, artificial-intelligence Provider layer 39/39, Contracts 43/43, and Storage 122/122; all five workspace typechecks passed; documentation passed for 118 Markdown files and all 11 governance/reference tests; diff check reported only existing line-ending warnings |

## P0 Recovery Evidence

- No tracked file under `apps/web` differs from `HEAD`.
- No untracked file exists under `apps/web`; therefore there was no rejected
  generated component, style, or test to delete.
- The binding reference is tracked and unchanged during recovery.
- The pre-NS-514 Web baseline builds successfully.
- Unrelated existing changes remain present and were not edited by P0.

## Manual And User Gates

- A10 is the explicit P4 visual review of the assembled reference replica.
- A16 is the explicit P7 visual review of the final approved connected UI.
- Browser inspection, screenshots, computed layout, builds, and tests may
  diagnose discrepancies but cannot change either row to `passed`.

## Current Repository State

- Branch: `codex/ns-410-json-authority`.
- Starting commit: `27d0c10 NS-510 docs(workshop): record closure evidence`.
- Write implementation baseline: `e62315a NS-514 feat(ui): rebuild reference shell and connect Write`.
- Codex implementation commit: `c4dd028 NS-514 feat(codex): connect approved reference workspace`.
- Codex evidence commit: `8fe2d44 NS-514 docs(codex): record integration evidence`.
- Workshop P6 implementation begins at `ee1a4f3`; browser-discovered repair
  commits end at `02abdde`. Settings recovery commit `d532e79` and Workshop
  recovery commit `1f01082` close A33, A36, and A37 with real Settings and
  interface-to-Context-Bundle browser evidence. The A38 worktree isolates
  message validation to the requested session and closes the normal-library
  interaction failure with storage, mixed-session browser, and coordinate-click
  evidence. NS-514 remains in progress because the shared `New Series` fixture
  keeps A13 open, P7 remains pending, and the explicit A16 author visual gate
  remains open.
- Unrelated preserved files: existing `HANDOFF.md` and
  `docs/testing/NS-507_ACCEPTANCE.md` edits; existing
  `docs/design/ui-redesign/` deletions and `README.md` edit; untracked
  `.hermes/plans/`.
