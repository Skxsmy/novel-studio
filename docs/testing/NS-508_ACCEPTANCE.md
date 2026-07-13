# NS-508 Acceptance Record

Status: passed
Task: `docs/tasks/NS-508.md`
Updated: 2026-07-13

## Acceptance Matrix

| ID | Status | Proof type | Exact evidence target | Actual result |
| --- | --- | --- | --- | --- |
| NS-508-A01 | passed | automated | `packages/storage/test/ai-files.test.ts` — `persists embedding use-case bindings across repository restart and deletes them explicitly`; `rejects embedding bindings to missing profiles`; `apps/server/test/ai-routes.test.ts` — `persists library-global embedding use-case bindings through the API` | Passed |
| NS-508-A02 | passed | automated | `apps/server/test/workshop-detail-schema-planner.test.ts` — `ranks same-category reusable detail types through the bound embedding profile`; `keeps exact matches deterministic without embedding`; `leaves ambiguous semantic candidates as author choices` | Passed |
| NS-508-A03 | passed | automated | `apps/server/test/workshop-detail-schema-planner.test.ts` — `degrades to manual mapping when embedding is unconfigured or unavailable without fallback` | Passed |
| NS-508-A04 | passed | automated | `apps/server/test/workshop-routes.test.ts` — `returns ranked detail schema suggestions before Codex create and update execution` | Passed; both routes reuse the selected stable detail type ID and create no duplicate type |
| NS-508-A05 | passed | automated | `apps/server/test/workshop-routes.test.ts` — `refuses incomplete duplicate and cross-category detail resolution choices without Codex writes` | Passed |
| NS-508-A06 | passed | automated | `apps/server/test/workshop-routes.test.ts` — `atomically creates author-specified detail types with NSFW metadata and binds confirmation identity` | Passed |
| NS-508-A07 | passed | automated | `apps/web/src/app/AppShell.test.tsx` — `maps suggested Codex details or explicitly creates reusable detail types before tool execution` | Passed |
| NS-508-A08 | passed | automated | Required commands and invariant re-check below | Passed; no user visual-acceptance claim |

## Required Commands

```powershell
npm.cmd run test -w @novel-studio/contracts -- --run test/ai.test.ts test/workshop.test.ts
npm.cmd run test -w @novel-studio/storage -- --run test/ai-files.test.ts
npm.cmd run test -w @novel-studio/ai -- --run test/embeddings.test.ts
npm.cmd run test -w @novel-studio/server -- --run test/workshop-detail-schema-planner.test.ts test/workshop-routes.test.ts test/ai-routes.test.ts
npm.cmd run test -w @novel-studio/web -- --run src/app/AppShell.test.tsx
npm.cmd run test
npm.cmd run build -w @novel-studio/contracts
npm.cmd run build -w @novel-studio/ai
npm.cmd run build -w @novel-studio/storage
npm.cmd run build -w @novel-studio/server
npm.cmd run build -w @novel-studio/web
npm.cmd run docs:check
```

## Adversarial Coverage

| Risk | Fixture/scenario | Expected result | Evidence |
| --- | --- | --- | --- |
| Missing binding | No `codex.detail-schema` binding exists | Manual planner state; no arbitrary default profile or creation | Passed: planner unconfigured fixture |
| Broken binding | Binding points to missing or archived profile | Unavailable planner state; no fallback Provider call | Passed: missing and archived profile fixtures; Provider call count unchanged |
| Provider failure | Bound embedding service rejects or returns damaged vectors | Manual planner state; no authority mutation or invented match | Passed: rejecting adapter fixture |
| Cross-category match | Semantically similar type exists only in another category | Candidate is excluded | Passed: same-name location candidate excluded from character suggestions |
| Ambiguous similarity | Two candidates have close scores | Ranked suggestions remain author choices; no automatic write | Passed: close-score fixture returns no recommended candidate |
| Omitted choice | One unmatched label has no mapping or creation | Explicit refusal before claim/semantic mutation | Passed: incomplete route payload fixture |
| Duplicate choice | One label is both mapped and created or repeated | Explicit refusal before claim/semantic mutation | Passed: map-and-create fixture |
| Stale/cross-category mapping | Selected type no longer exists or belongs to another category | Explicit refusal before atomic command writes | Passed: cross-category stable-ID fixture |
| Sensitive type | Author selects create, edits final name, and enables NSFW | Exact name/flag are included in confirmation identity and stored atomically | Passed: name/NSFW creation plus changed-confirmation conflict fixture |

## Run Ledger

| Date | Commit/worktree | Command or manual procedure | Result |
| --- | --- | --- | --- |
| 2026-07-13 | uncommitted | Acceptance mapping and closure-boundary review | complete; every acceptance ID mapped before runtime edits |
| 2026-07-13 | uncommitted | Focused contracts tests | passed: 2 files, 15 tests |
| 2026-07-13 | uncommitted | Focused storage binding tests | passed: 1 file, 4 tests |
| 2026-07-13 | uncommitted | Focused AI embedding router tests | passed: 1 file, 6 tests |
| 2026-07-13 | uncommitted | Focused server planner/Workshop/AI route tests | passed: 3 files, 48 tests; final added ambiguity fixture passed separately: 1 file, 4 tests |
| 2026-07-13 | uncommitted | Focused Workshop web test | passed: 1 file, 67 tests |
| 2026-07-13 | uncommitted | `npm.cmd run test` | passed: server 67, web 82, AI 27, contracts 22, storage 94 |
| 2026-07-13 | uncommitted | `npm.cmd run build` | passed: contracts, AI, storage, server, and web production build |
| 2026-07-13 | uncommitted | `npm.cmd run docs:check` | passed after final authoritative-record synchronization |

## Final Repository State

- Branch: `codex/ns-410-json-authority`
- Commit: `NS-508 feat(workshop): add detail schema planning`
- Worktree: task-related files are included in the completion commit
- Task-related dirty files: none after the completion commit
- Unrelated preserved files: existing `docs/design/ui-redesign/` deletions and README edit; `.hermes/plans/`; `docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html`
