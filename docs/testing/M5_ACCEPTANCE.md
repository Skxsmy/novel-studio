# M5 Acceptance Record

Status: milestone_in_progress
Task: `docs/tasks/M5.md`
Updated: 2026-07-10

This record is the milestone evidence index. Child NS task acceptance records own their command transcripts. `passed` below means existing command/function evidence; it does not imply user visual acceptance.

## Acceptance Matrix

| ID | Status | Exact evidence locator |
| --- | --- | --- |
| M5-A01 | passed | `apps/web/src/app/AppShell.test.tsx` — `saves direct continuous manuscript input without the old card editor`, `shows codex baseline effective state and grouped progression history without future leakage`, `manages multiple real model settings and service keys from settings`; NS-410 acceptance matrix |
| M5-A02 | passed | `packages/contracts/test/proposals.test.ts` — `covers the planned target, source, and generator kinds`; source review confirms one Proposal schema export |
| M5-A03 | passed | `packages/contracts/test/proposals.test.ts` — `covers the planned target, source, and generator kinds`, `rejects non-manual sources without a source id` |
| M5-A04 | passed | `packages/contracts/test/proposals.test.ts` — `keeps the Proposal status machine narrow`, `requires stale, superseded, accepted, and edited records to carry their audit payloads` |
| M5-A05 | passed | `packages/storage/test/proposals.test.ts` — `isolates corrupted Proposal files while keeping valid inbox items readable` |
| M5-A06 | passed | `packages/storage/test/proposals.test.ts` — `rejects duplicate ids, unavailable sources, and stale target revisions` |
| M5-A07 | passed | `packages/storage/test/proposals.test.ts` — `rejects duplicate ids, unavailable sources, and stale target revisions`; `apps/web/src/app/AppShell.test.tsx` — `shows a recoverable Review state when a Workshop source message is unavailable` |
| M5-A08 | passed | `packages/contracts/test/proposals.test.ts` — `requires applicable scene-content patches to carry base revisions`; `packages/storage/test/proposals.test.ts` — `rejects duplicate ids, unavailable sources, and stale target revisions` |
| M5-A09 | passed | `packages/storage/test/proposals.test.ts` — `accepts a scene-content Proposal by snapshotting before the authority write` |
| M5-A10 | passed | `apps/server/test/proposal-routes.test.ts` — `creates, lists, previews, and accepts a Proposal through review routes` (edited acceptance scenario) |
| M5-A11 | passed | `packages/storage/test/proposals.test.ts` — `blocks intra-batch scene conflicts and accepts only previewed revisions` |
| M5-A12 | passed | `apps/server/test/proposal-routes.test.ts` — `reports blocked items during batch accept instead of silently skipping them` |
| M5-A13 | passed | `apps/web/src/app/AppShell.test.tsx` — `connects Review to the Proposal inbox and opens exact Proposal links` |
| M5-A14 | passed | `apps/web/src/app/AppShell.test.tsx` — `connects Review to the Proposal inbox and opens exact Proposal links` |
| M5-A15 | passed | `apps/server/test/proposal-routes.test.ts` — `creates, lists, previews, and accepts a Proposal through review routes`; `apps/web/src/app/AppShell.test.tsx` — `connects Review to the Proposal inbox and opens exact Proposal links` |
| M5-A16 | passed | `apps/web/src/app/AppShell.test.tsx` — `connects Review to the Proposal inbox and opens exact Proposal links`; Review source review for collapsed audit details |
| M5-A17 | manual_pending | User visual review against the approved Review structure; no agent-owned screenshot can pass this item |
| M5-A18 | passed | `packages/storage/test/workshop.test.ts` — `persists sessions and messages as reloadable JSON authority`, `creates a branch session from a source message`, `resends a General Chat author message by replacing it and truncating later history`, `permanently deletes unlinked Workshop sessions and clears branch source pointers` |
| M5-A19 | passed | `packages/storage/test/workshop.test.ts` — `updates context basket refs and rejects missing scene targets`; `apps/web/src/app/AppShell.test.tsx` — `renders Workshop context selection as nested scene and Codex menus` |
| M5-A20 | passed | `apps/server/test/context-routes.test.ts` — `builds an auditable ContextBundle without leaking future or forbidden material`; `apps/server/test/workshop-routes.test.ts` — `uploads parsed Workshop attachments and includes them in the call ContextBundle`, `sends attachments and previous Workshop chat history to OpenAI-compatible providers` |
| M5-A21 | passed | `apps/server/test/workshop-routes.test.ts` — `persists sessions, previews context, and saves a successful single-role call`, `sends Agent provider requests without prompt-audit context duplication`, `exports Workshop session history with optional reasoning and reconstructed provider prompts` |
| M5-A22 | passed | `apps/server/test/workshop-routes.test.ts` — `preserves input and context on model failure without creating an empty Proposal` |
| M5-A23 | passed | `apps/web/src/app/AppShell.test.tsx` — `connects Workshop sessions, context basket, and single-role calls without exposing audit IDs`, `auto-names new Workshop chats and lets authors rename sessions`, `exports Workshop sessions with the selected reasoning option`, `allows attachment-only Workshop sends and lets the author stop an in-flight call`, `keeps an in-flight Workshop stream attached to its session while authors switch sessions` |
| M5-A24 | manual_pending | User visual review against the approved Workshop structure; the unavailable historical Figma node is not acceptance evidence |
| M5-A25 | passed | `packages/storage/test/workshop.test.ts` — `creates linked Proposals from Workshop messages and reports unavailable sources` |
| M5-A26 | passed | `apps/web/src/app/AppShell.test.tsx` — `connects Review to the Proposal inbox and opens exact Proposal links` |
| M5-A27 | passed | `apps/web/src/app/AppShell.test.tsx` — `connects Review to the Proposal inbox and opens exact Proposal links` (source-return scenario) |
| M5-A28 | function_passed_visual_pending | `apps/web/src/app/AppShell.test.tsx` — `shows Workshop proposal card states from Proposal authority`; user visual review pending |
| M5-A29 | passed | `apps/web/src/app/AppShell.test.tsx` — `shows a recoverable Review state when a Workshop source message is unavailable`; storage unavailable-source scenario under `creates linked Proposals from Workshop messages and reports unavailable sources` |
| M5-A30 | planned | Future child NS task must test durable Tool Plan storage and execution refusal without a Grant |
| M5-A31 | planned | Future child NS task must test expired, scope-mismatched, and plan-hash-mismatched Grants |
| M5-A32 | planned | Future child NS task must test unauthorized tool refusal before any authority mutation; M5.6A containment is partial evidence only |
| M5-A33 | passed | `docs/testing/NS-507_ACCEPTANCE.md` NS-507-A02/A03: execute routes delegate to repository-owned atomic create/update commands; success and no-partial-write failure scenarios pass |
| M5-A34 | planned | Future Tool Plan child NS task: risk classification and dangerous-action-specific confirmation scenarios |
| M5-A35 | passed | `docs/testing/NS-507_ACCEPTANCE.md` NS-507-A04/A05: draft-time entry/research/Progression baselines, wrong-target refusal, and effective-Scene immutability pass |
| M5-A36 | planned | Future Tool Plan child NS task: mixed completed/skipped/failed/blocked result fixture |
| M5-A37 | planned | Future Tool Plan child NS task: Proposal fallback preserves source, evidence, reason, and target revision |
| M5-A38 | planned | NS-513/M5.7: two first-round Provider requests prove no peer output in either context |
| M5-A39 | planned | NS-513/M5.7: summary references only durable first-round outputs/evidence |
| M5-A40 | planned | NS-513/M5.7: future Progression, future Scene text, hidden Section, and forbidden source fixtures |
| M5-A41 | planned | NS-513/M5.7: batch accept eligible/skipped/failed/blocked fixture |
| M5-A42 | planned | NS-513/M5.7: recoverable stale/conflict UI and no silent merge |
| M5-A43 | planned | NS-513/M5.7: approved responsive checklist and functional narrow-layout checks |
| M5-A44 | planned | NS-513/M5.7 manual record distinguishes diagnostic visual artifacts from user acceptance |
| M5-A45 | planned | Final M5 close task checks all matrix rows, required commands, clean task state, and explicit user visual acceptance |

## Current Limited Tool Evidence

M5.6A containment, NS-507 atomicity, and NS-508 detail schema planning are verified for the existing limited Agent Codex path:

- `packages/storage/test/workshop.test.ts` — `atomically claims Agent tool execution and blocks destructive session changes while running`, `preserves successful Agent tool result links across deletion and branching`.
- `apps/server/test/workshop-routes.test.ts` — `rejects Agent codex.create_entry execution for archived sessions before any Codex write`, `atomically executes an approved Agent codex.create_entry command`, `atomically executes Agent codex.update_entry entry research and progression changes`, and the stale, wrong-target, Scene-movement, and confirmation-identity refusal scenarios indexed by `docs/testing/NS-507_ACCEPTANCE.md`.
- `packages/storage/test/file-transactions.test.ts` — per-Series serialization and injected mid-commit rollback scenarios.
- `apps/web/src/app/AppShell.test.tsx` — `reloads terminal Workshop Agent tool state after execution failure`.
- `docs/testing/NS-508_ACCEPTANCE.md` — persisted embedding binding, category-scoped ranked suggestions, manual degradation, create/update stable-ID mapping, explicit name/NSFW creation, and exact UI payload evidence.

M5.6A alone did not pass M5-A30 through M5-A37. NS-507 now passes M5-A33 and M5-A35 for the limited Codex tools; durable Tool Plan/Grant, dangerous-action confirmation, partial-result reporting, and Proposal fallback remain planned.

## Milestone Run Ledger

Detailed command history remains in the acceptance records of completed child work and Git history. `docs/testing/NS-507_ACCEPTANCE.md` and `docs/testing/NS-508_ACCEPTANCE.md` record the focused adversarial tests, full repository suites, package builds, and documentation checks for M5.6B/M5.6C. Earlier M5.6A lifecycle evidence remains anchored at `6fbabac NS-506 fix(workshop): close tool execution lifecycle gaps`.

## Open Gates

- M5-A17 and M5-A24 require explicit user visual acceptance.
- M5-A28 still requires user visual acceptance for its displayed states.
- M5-A30 through M5-A32, M5-A34, and M5-A36 through M5-A45 require new child NS tasks and actual evidence.
- M5 must remain `milestone_in_progress` until all open gates pass.
