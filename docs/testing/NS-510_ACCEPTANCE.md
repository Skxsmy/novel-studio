# NS-510 Acceptance Record

Status: complete
Task: `docs/tasks/NS-510.md`
Updated: 2026-07-14

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| ID | Status | Evidence |
| --- | --- | --- |
| NS-510-A01 | passed | AI regressions normalize plain text/native tools, preserve invalid explicit structured output internally, encode canonical dotted tool IDs to collision-safe Provider names, decode responses, and replay reasoning/tool history |
| NS-510-A02 | passed | Runner/route regressions cover plain prose, tool validation correction, bounded transport retry, retry exhaustion, confirmation, continuation, and explicit retry; a disposable ten-turn real DeepSeek session completed the confirmed update continuation without another author message |
| NS-510-A03 | passed | Route export regression enumerates four exact durable steps and two ModelCalls once, includes the real Provider history, and does not reconstruct a fake continuation prompt |
| NS-510-A04 | passed | Contracts prove v1-to-v2 migration, rollback backup, kind invariants, and strict request inputs; storage proves prompt isolation, branch inheritance, and Agent rejection; server proves preview/call/stream/resend resolve the saved session prompt and reject request-local overrides; Web saves, switches, and restores independent prompts while omitting prompt fields from call/resend payloads |
| NS-510-A05 | passed | Storage proves exact source truncation and complete tool-result cloning; the route preserves the exact source API; AppShell selects an older eligible message, submits its exact `sourceMessageId`, and omits later history from the branch while retaining the session-level branch action |
| NS-510-A06 | passed | Contracts expose exactly `general-chat` and `agent` plus six supported basket ref kinds; storage materializes and validates every supported kind; current General Chat/Agent route regressions pass while both removed modes return 400 and the deleted message Proposal route returns 404; AppShell has no legacy Proposal command or duplicate Type/Tag Codex grouping |
| NS-510-A07 | passed | Contracts return complete message/attachment/branch deletion identity; storage atomically deletes an author/reply turn, detaches affected branches, updates timestamps, and rejects Agent or Proposal-linked history; the streaming route deletes both turn records; AppShell removes the complete turn after confirmation and never offers deletion in Agent sessions |
| NS-510-A08 | passed | `WORKSHOP_UI_LOCALE` freezes current chrome at `en-US`; static copy, date formatting, fallback errors, target labels, and message input labels use the resource boundary; the copy audit permits non-ASCII only in the editable default prompt; AppShell does not expose mode/storage field names. Chinese localization remains an explicit future resource, not a claimed pass |
| NS-510-A09 | passed | Frontend branch/turn policy and presentation helpers are extracted into pure modules; server session/message/attachment/export record routes and reasoning parsing are extracted from the Agent/tool orchestration route; boundary tests prevent duplicate record-route ownership and Provider/Agent/Codex imports; full focused package regressions and affected builds pass |
| NS-510-A10 | passed | Focused package regressions and affected builds pass; removed Workshop capabilities have no runtime entry points; documentation and diff checks pass; durable-coordinator and visual gates remain explicitly outside this acceptance claim |

## Confirmed Reproduction

- Real exported session: `28c5f603-28c0-4b49-9a2c-e69fcd094340`.
- The first Agent model step produced a valid `codex.create_entry` request and the confirmed command created the entry.
- The continuation ended with `structured-output-failed` and the user-visible message `Provider 返回的结构化内容不符合契约。`.
- Code inspection confirmed that Provider adapters discard the response body when JSON parses but schema validation fails, leaving the runner's repair prompt with an empty `Invalid output` value.
- Code inspection confirmed that session export reconstructs every Agent prompt from the initial ContextBundle and omits model attempts that have no directly linked message, so the exported continuation/repair audit is not faithful.
- The author explicitly requires an exhausted structured-output repair to retain a same-run retry path; it must not require a new author message to reactivate the Agent chain.

## Command Evidence

- `npm.cmd run build -w @novel-studio/contracts` - passed.
- `npm.cmd run build -w @novel-studio/ai` - passed.
- `npm.cmd run build -w @novel-studio/server` - passed.
- `npm.cmd run test -w @novel-studio/contracts -- workshop.test.ts` - 15 passed.
- `npm.cmd run test -w @novel-studio/ai -- mockProvider.test.ts` - 24 passed.
- `npm.cmd run test -w @novel-studio/server -- workshop-agent-runner.test.ts workshop-routes.test.ts` - 48 passed.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx -t "branches Workshop"` - 2 passed, including exact older-message selection.
- `npm.cmd run test -w @novel-studio/storage -- workshop.test.ts -t "branch"` - 4 passed.
- `npm.cmd run test -w @novel-studio/server -- workshop-routes.test.ts -t "branches with copied message history"` - 1 passed.
- `npm.cmd run build -w @novel-studio/contracts` - passed after the A06 contract removal.
- `npm.cmd run build -w @novel-studio/storage` - passed after the A06 storage cleanup.
- `npm.cmd run build -w @novel-studio/server` - passed after the A06 route removal.
- `npm.cmd run build -w @novel-studio/web` - passed after the A06 UI/API cleanup.
- `npm.cmd run test -w @novel-studio/contracts -- workshop.test.ts` - 16 passed; exact mode and basket-kind surfaces are asserted.
- `npm.cmd run test -w @novel-studio/storage -- workshop.test.ts` - 18 passed; a focused rerun also proved all six supported basket ref kinds and missing-target rejection.
- `npm.cmd run test -w @novel-studio/server -- workshop-routes.test.ts` - 40 passed.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx -t "renders Workshop context selection"` - 1 passed; duplicate Type/Tag groups are absent.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx -t "maps suggested Codex details"` - 1 passed after replacing a stale pre-A05 tool-result assertion with the specified complete-prefix branch behavior.
- `npm.cmd run test -w @novel-studio/contracts -- workshop.test.ts -t "turn delete"` - 1 passed.
- `npm.cmd run test -w @novel-studio/storage -- workshop.test.ts -t "deletes complete General Chat turns"` - 1 passed.
- `npm.cmd run test -w @novel-studio/server -- workshop-routes.test.ts -t "deletes the complete unlinked turn"` - 1 passed.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx -t "deletes complete General Chat turns"` - 1 passed.
- `npm.cmd run test -w @novel-studio/web -- uiText.test.ts` - 1 passed.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx -t "connects Workshop sessions"` - 1 passed with storage/mode labels absent.
- `npm.cmd run build -w @novel-studio/web` - passed with the explicit copy resource interface.
- `npm.cmd run test -w @novel-studio/contracts -- workshop.test.ts` - 17 passed after A09.
- `npm.cmd run test -w @novel-studio/storage -- workshop.test.ts` - 18 passed after A09.
- `npm.cmd run test -w @novel-studio/ai -- mockProvider.test.ts` - 24 passed after A09.
- `npm.cmd run test -w @novel-studio/server -- workshop-agent-runner.test.ts workshop-routes.test.ts workshop-route-boundaries.test.ts workshop-reasoning.test.ts` - 51 passed across 4 files after A09.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx uiText.test.ts workshopConversation.test.ts` - 73 passed across 3 files after A09.
- `npm.cmd run build -w @novel-studio/server` - passed after extracting record routes and reasoning parsing.
- `npm.cmd run build -w @novel-studio/web` - passed after extracting conversation policy and presentation helpers.
- `npm.cmd run test -w @novel-studio/contracts -- workshop.test.ts` - 18 passed after A04, including session-v2 migration, rollback backup, kind invariants, and strict call/resend inputs.
- `npm.cmd run build -w @novel-studio/contracts` - passed after A04.
- `npm.cmd run test -w @novel-studio/storage -- workshop.test.ts` - 19 passed after A04, including independent prompt updates, Agent rejection, and branch inheritance.
- `npm.cmd run build -w @novel-studio/storage` - passed after A04. The first server rerun had loaded the stale pre-build storage package and failed two new session-schema assertions; rebuilding storage and rerunning the same assertions passed.
- `npm.cmd run test -w @novel-studio/server -- workshop-agent-runner.test.ts workshop-routes.test.ts workshop-route-boundaries.test.ts workshop-reasoning.test.ts` - 51 passed across 4 files after A04, including session-owned preview/call/stream/resend prompt resolution and request-local override rejection.
- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx uiText.test.ts workshopConversation.test.ts` - 74 passed across 3 files after A04, including per-session save/switch/restore and prompt-free call/resend request bodies.
- `npm.cmd run build` - passed for contracts, AI, storage, server, and Web after A04.
- `npm.cmd run docs:check` - passed for 99 Markdown files after A04 and ADR-0014.
- `git diff --check` - passed after A04; only existing LF-to-CRLF working-copy warnings were emitted.
- `rg -n -e createProposalFromWorkshopMessage -e createMessageProposal -e CreateWorkshopMessageProposal -e WorkshopMessageProposalResult -e entriesByType -e entriesByTag -e continuity-check -e codex-creation apps packages` - no removed Proposal/grouping runtime API remains; removed Workshop modes appear only in negative mode tests, while other `continuity-check` matches are the separate AI task kind and `workshop-codex-creation-fields` is a Codex tool-confirmation style name rather than a session mode.
- `npm.cmd run docs:check` - passed for 98 Markdown files.
- `git diff --check` - passed; only existing LF-to-CRLF working-copy warnings were emitted.
- `node --check scripts/ns510-real-agent-chat.mjs` - passed.
- Initial disposable real-Provider run reproduced DeepSeek's `^[a-zA-Z0-9_-]+$` function-name constraint for canonical dotted tool IDs. The Provider adapter was then repaired with a request-local collision-safe name map.
- Final `node scripts/ns510-real-agent-chat.mjs --source-profile <existing-profile-json> --confirm-synthetic-details` - passed in a disposable synthetic project: turns 1-9 completed as prose with no tools; turn 10 produced one `codex.update_entry`; initial confirmation paused for three explicit synthetic detail-type decisions; confirmed execution returned 201; automatic continuation returned an assistant message and the same run ended `completed`.
- The real-Provider script reused only Provider/model metadata and a credential reference. It did not read existing manuscript, Codex, or Workshop content, did not print the secret, and deleted the synthetic library afterward.

## Manual And User Gates

- The disposable ten-turn real-Provider gate passed. Synthetic missing detail types were created only after the test user explicitly supplied `--confirm-synthetic-details`; this path is not enabled for real project content.
- Durable coordinator wake/join, cancellation, startup recovery, and unknown-side-effect recovery remain open; A01-A03 do not claim them.
- Full Workshop visual acceptance remains NS-513 and is not claimed here.

## Repository Evidence

- Branch: `codex/ns-410-json-authority`
- Starting commit: `5929532 NS-509 docs(workshop): record closure evidence`.
- Implementation commit: `8e7dc76 NS-510 feat(workshop): harden agent runtime and session boundaries`.
- The final task commit contains this closure record and the explicitly requested `docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html`.
- Unrelated dirty files listed in `STATUS.md` remain outside NS-510.
