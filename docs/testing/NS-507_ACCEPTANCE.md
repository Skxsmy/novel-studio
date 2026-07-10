# NS-507 Acceptance Record

Status: passed
Task: `docs/tasks/NS-507.md`
Updated: 2026-07-10

Canonical author-facing hierarchy checked for this task: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| ID | Status | Exact evidence target | Actual result |
| --- | --- | --- | --- |
| NS-507-A01 | passed | `packages/storage/test/file-transactions.test.ts` — `serializes concurrent transactions per series`; `rolls back every target after an injected mid-commit failure`; `packages/storage/test/repository.test.ts` — `serializes stale-checked Codex entry and Progression commands per series` | Passed |
| NS-507-A02 | passed | `apps/server/test/workshop-routes.test.ts` — `atomically executes an approved Agent codex.create_entry command`; `leaves confirmed detail types uncreated when an atomic create command fails` | Passed |
| NS-507-A03 | passed | `apps/server/test/workshop-routes.test.ts` — `atomically executes Agent codex.update_entry entry research and progression changes`; `leaves every semantic target unchanged when an atomic update command becomes stale` | Passed |
| NS-507-A04 | passed | `apps/server/test/workshop-routes.test.ts` — `refuses an Agent Codex update after its entry or research baseline becomes stale`; `refuses legacy update requests without server-owned baselines` | Passed |
| NS-507-A05 | passed | `apps/server/test/workshop-routes.test.ts` — `rejects cross-entry and unrelated-relation progression targets`; `rejects progression Scene moves without changing authority` | Passed |
| NS-507-A06 | passed | `apps/server/test/workshop-routes.test.ts` — `binds Agent Codex execution to the exact confirmation payload` | Passed |
| NS-507-A07 | passed | Required focused/full test, build, and documentation commands in the Run Ledger below | Passed |

## Required Commands

```powershell
npm.cmd run test -w @novel-studio/storage -- --run test/file-transactions.test.ts test/workshop.test.ts test/repository.test.ts
npm.cmd run test -w @novel-studio/server -- --run test/workshop-routes.test.ts
npm.cmd run test -w @novel-studio/contracts
npm.cmd run test -w @novel-studio/storage
npm.cmd run test -w @novel-studio/server
npm.cmd run test -w @novel-studio/web
npm.cmd run build -w @novel-studio/contracts
npm.cmd run build -w @novel-studio/storage
npm.cmd run build -w @novel-studio/server
npm.cmd run build -w @novel-studio/web
npm.cmd run docs:check
```

## Adversarial Coverage

| Risk | Fixture/scenario | Expected result | Evidence |
| --- | --- | --- | --- |
| Concurrent transactions | Overlapping and non-overlapping writes in one Series | Operations serialize; journals are not recovered from under a live commit | Passed: `serializes concurrent transactions per series`; `serializes stale-checked Codex entry and Progression commands per series` |
| Mid-operation failure | Injected failure after one target replacement | Every target restores to its pre-command state | Passed: `rolls back every target after an injected mid-commit failure` |
| Partial Codex command | Entry plus multiple Progression operations where one target is invalid | No detail, entry, research, Progression, result, or success write survives | Passed: `leaves every semantic target unchanged when an atomic update command becomes stale` |
| Stale baseline | Entry, research, or Progression changes after tool-request creation | Conflict before semantic mutation | Passed: `refuses an Agent Codex update after its entry or research baseline becomes stale` and the atomic stale-command scenario |
| Missing baseline | Legacy update request lacks server-owned draft revisions | Explicit refusal; no current revision is substituted | Passed: `refuses legacy update requests without server-owned baselines` |
| Wrong target | Progression belongs to another entry or unrelated relation | Explicit refusal before mutation | Passed: `rejects cross-entry and unrelated-relation progression targets` |
| Scene movement | Update input attempts to change `effectiveFromSceneId` | Explicit refusal; existing Scene binding remains | Passed: `rejects progression Scene moves without changing authority` |
| Confirmation mismatch | Same tool message executed with a different mapping/creation payload | Execution identity conflict; no second semantic write | Passed: `binds Agent Codex execution to the exact confirmation payload` |

## Run Ledger

| Date | Commit/worktree | Command or manual procedure | Result |
| --- | --- | --- | --- |
| 2026-07-10 | uncommitted | Acceptance mapping and closure-boundary review | complete; implementation and evidence mapped to every acceptance ID |
| 2026-07-10 | uncommitted | `npm.cmd run test -w @novel-studio/storage -- --run test/file-transactions.test.ts test/workshop.test.ts test/repository.test.ts` | passed: 3 files, 77 tests |
| 2026-07-10 | uncommitted | `npm.cmd run test -w @novel-studio/server -- --run test/workshop-routes.test.ts` | passed: 1 file, 33 tests |
| 2026-07-10 | uncommitted | `npm.cmd run test` | passed: server 61, web 82, AI 27, contracts 22, storage 92 |
| 2026-07-10 | uncommitted | Builds for contracts, storage, server, and web | passed; web production bundle generated |
| 2026-07-10 | uncommitted | `npm.cmd run docs:check` | passed: final authoritative-record synchronization verified |

## Final Repository State

- Branch: `codex/ns-410-json-authority`
- Commit: `NS-507 fix(workshop): make Codex tool execution atomic`
- Worktree: task-related files are included in the completion commit
- Task-related dirty files: none after the completion commit
- Unrelated preserved files: `.hermes/plans/`; `docs/design/ui-redesign/codex-panel-redesign-v1.html`
