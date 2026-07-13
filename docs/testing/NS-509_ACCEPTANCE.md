# NS-509 Acceptance Record

Status: passed
Task: `docs/tasks/NS-509.md`
Updated: 2026-07-13

The canonical author-facing hierarchy remains `Series → Volume → Chapter → Act → Scene`; this acceptance record makes no hierarchy claim beyond preserving it.

## Acceptance Matrix

| ID | Status | Exact evidence target | Actual result |
| --- | --- | --- | --- |
| NS-509-A01 | passed | `packages/contracts/test/workshop.test.ts` durable run/step invariants plus storage evolution rejection | Contracts focused test: 15 passed; storage focused test rejects invocation mutation and completed-to-running transition. Failed tool executions may link their durable failure result. |
| NS-509-A02 | passed | `packages/storage/test/workshop.test.ts` persistence, revision, ownership, damaged data, branch, and delete lifecycle | Storage focused test: 21 passed, including restart reload, stale/wrong-session rejection, damaged isolation, detached branch links, and source-run deletion. |
| NS-509-A03 | passed | `apps/server/test/workshop-agent-runner.test.ts` structured prose and tool request | Runner focused tests pass for ordinary `respond` and structured Codex request waiting for confirmation. |
| NS-509-A04 | passed | `apps/server/test/workshop-agent-runner.test.ts` bounded repair success/failure | Runner records exactly one repair; valid repair succeeds and a second invalid result fails without a tool message. |
| NS-509-A05 | passed | `apps/server/test/workshop-agent-runner.test.ts` visible degraded JSON boundary | Unstructured profile used strict JSON text once, retained selected Provider/model, and persisted degraded state. |
| NS-509-A06 | passed | `apps/server/test/workshop-routes.test.ts` same-run success/failure continuation and second confirmation | Route tests pass for same-run success continuation, atomic failure result continuation without another author message, and a second independent waiting-confirmation request. Legacy name-keyed Details migrate to stable IDs in the same planned update. |
| NS-509-A07 | passed | storage and route tests for interruption, retry, abandon, and no replay | Reconciliation, no replay, appended retry attempt, and history-preserving abandon tests pass. |
| NS-509-A08 | passed | runner test and `rg` source audit for removed hard-coded draft rewrite heuristics | Structured revision test passes; source search returned zero matches for all six retired helper names. |
| NS-509-A09 | passed | `apps/web/src/app/AppShell.test.tsx` durable run recovery UI | AppShell test file: 68 passed, including durable state display and explicit recovery actions. |
| NS-509-A10 | passed | focused tests, regression suite, typecheck/build, and documentation checks | Final workspace regression 313 passed; all workspace no-emit typechecks passed; storage/server/web builds passed after final logic changes; docs check and 7 docs tests passed. |

## Command Evidence

- `npm.cmd run test -w @novel-studio/contracts -- --run test/workshop.test.ts` - passed, 15 tests after final contract changes.
- `npm.cmd run test -w @novel-studio/storage -- --run test/workshop.test.ts` - passed, 21 tests.
- `npm.cmd run test -w @novel-studio/server -- --run test/workshop-agent-runner.test.ts test/workshop-routes.test.ts` - passed before final failure-continuation expansion; final full server suite passed 79 tests.
- `npm.cmd run test -w @novel-studio/web -- --run src/app/AppShell.test.tsx` - passed, 68 tests.
- `npm.cmd run test` - passed before the final two regression additions: server 78, web 83, AI 27, contracts 24, storage 99; 311 total.
- `npm.cmd run test --workspaces --if-present` - final pass: server 79, web 83, AI 27, contracts 25, storage 99; 313 total.
- `npm.cmd run build` - passed for contracts, AI, storage, server, and web before the final failure-continuation change.
- `npm.cmd run build -w @novel-studio/storage`; `npm.cmd run build -w @novel-studio/server`; `npm.cmd run build -w @novel-studio/web` - passed after final logic changes.
- `npm.cmd run typecheck` - package prebuild was blocked by a transient Windows `EPERM` lock on `packages/contracts/dist`; no type diagnostic was emitted.
- `npm.cmd run typecheck --workspaces --if-present` - passed for all five workspaces without writing package output.
- `npm.cmd run docs:check` - passed for 94 Markdown files.
- `npm.cmd run test:docs` - passed, 7 tests.
- `rg -n "isPendingDraft|requestedAliases|requestedAddedDetail|removeInventedCosmicMaterial|revisedPendingCodexDraft|pendingDraftPreview" apps/server/src` - zero matches.
- `git diff --check` - no whitespace errors; only existing line-ending conversion warnings.

## Manual And User Gates

- Full Workshop visual acceptance remains an M5 gate and is not claimed by NS-509.
- Prompt customization remains NS-511.
- Tool Plan/Grant and Proposal conversion remain NS-512.

## Repository Evidence

- Branch: `codex/ns-410-json-authority`
- Starting commit: `a8eae7b NS-508 feat(workshop): add detail schema planning`
- Implementation commit: `5128b20 NS-509 feat(workshop): add durable agent runner`
- Closure record commit: pending
- Task-related dirty files after closure: none
- Unrelated dirty files are recorded in `STATUS.md` and must remain unstaged.
