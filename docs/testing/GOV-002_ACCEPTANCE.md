# GOV-002 Acceptance Record

Status: passed
Task: `docs/tasks/GOV-002.md`
Report: `docs/testing/GOV-002_DATABASE_REVIEW.md`
Updated: 2026-07-19

Canonical author-facing hierarchy remains
`Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| ID | Status | Proof target | Actual evidence |
| --- | --- | --- | --- |
| GOV-002-A01 | passed | Repository database-path inventory and report scope | Report inventories authority, SQLite topology, opener, schema, projection, transactions, API, UI, and forbidden paths |
| GOV-002-A02 | passed | Kernel tests, official SQLite constraints, source review | SQLite 3.53.2 direct probe; official WAL/PRAGMA/FTS/corruption review; identity/policy/health tests |
| GOV-002-A03 | passed | Adversarial recovery tests | Corrupt, foreign, cross-Series, cancelled, build-failed, swap-failed, post-install-failed, FTS-drifted, and obstructed-rollback cases pass |
| GOV-002-A04 | passed | Concurrency and live-reader tests | Same-Series serialization, cross-Series independence, queue release, reader gap blocking, missing-index recovery, and 12-way duplicate import proof |
| GOV-002-A05 | passed | Research storage/server tests and source review | Exact hash/original, canonical path, duplicate, revision, cross-Series, damaged-original, setup cleanup, API, and privacy paths pass |
| GOV-002-A06 | passed | Repository-wide opener/SQL search and regressions | Only `indexDatabase.ts` constructs production SQLite; no runtime ATTACH/load-extension/writable-schema/hidden authority path found |
| GOV-002-A07 | passed | Reproduction tests and fixes | Fifteen confirmed defects and their retained proof are mapped in the report |
| GOV-002-A08 | passed | Focused optimization proof and regressions | Rebuild connection reuse and redundant rebuild removal reviewed; 20,000-row verified-open probe recorded median 15.58 ms |
| GOV-002-A09 | passed | Prioritized recommendation matrix | Ten clearly unapproved recommendations are ordered by author impact and dependency |
| GOV-002-A10 | passed | Full command and repository ledger | Typecheck, 49 files/523 tests, production build, 174-file docs check, diff check, and branch/dirty-state review pass; closure is the separate GOV-002 commit |

## Required Commands

```powershell
npm.cmd run test -w @novel-studio/storage
npm.cmd run test -w @novel-studio/server
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run docs:check
git diff --check
git status --short --branch
```

## Run Ledger

| Date | Commit/worktree | Command or review procedure | Result |
| --- | --- | --- | --- |
| 2026-07-19 | clean baseline `bb37126` on `codex/ns-514-overview` | Open GOV-002 after separate NS-514 `b7ae1be` and NS-602 `bb37126` commits | Review starts from a clean task boundary; no `data/library/` mutation is in scope |
| 2026-07-19 | GOV-002 worktree | Repository-wide opener, SQL, route, transaction, and UI source review | One production SQLite constructor; 15 confirmed defects; residual process, FTS, filesystem, scaling, and product boundaries recorded |
| 2026-07-19 | GOV-002 worktree | Official SQLite WAL, corruption, PRAGMA, FTS5, and VACUUM documentation review | WAL bundle/version policy, quick/full integrity boundary, FTS integrity/secure-delete, and snapshot recommendations grounded in primary documentation |
| 2026-07-19 | GOV-002 worktree | Direct Fastify plus disk probe in a temporary library | Create/import/update/rebuild/recovery HTTP paths passed; identity, checksum, WAL, quick check, FTS policy, exact source, and repaired pair observed directly |
| 2026-07-19 | GOV-002 worktree | Corrected independent 1-core/0-FTS recovery probe | Non-empty search returned one result and rebuilt to 1-core/1-FTS; prior empty-query probe explicitly rejected |
| 2026-07-19 | GOV-002 worktree | Synthetic 20,000-row verified-open probe | 12 samples; median 15.58 ms, maximum sample 18.74 ms on this machine; diagnostic only, not a product benchmark |
| 2026-07-19 | GOV-002 worktree | Destructive FTS segment exploratory probe | Did not finish within 50 seconds and was terminated; exact blocked stage unresolved and retained as P1 risk, not reported as a pass |
| 2026-07-19 | GOV-002 worktree | Current build via `scripts/start.ps1 -NoBrowser -SkipBuild -Wait` and `/api/v1/health` | Correct workspace and isolated library confirmed; in-app Browser then blocked local URL by policy, so no visual acceptance is claimed; server stopped and temp root removed |
| 2026-07-19 | GOV-002 worktree | `npm.cmd run test -w @novel-studio/storage` | 9 files, 146 tests passed |
| 2026-07-19 | GOV-002 worktree | `npm.cmd run test -w @novel-studio/server` | 13 files, 109 tests passed |
| 2026-07-19 | GOV-002 worktree | `npm.cmd run test -w @novel-studio/web -- --run src/features/research/ReferenceResearchWorkspace.test.tsx src/app/ReferenceReplica.test.tsx` | 2 files, 17 tests passed |
| 2026-07-19 | GOV-002 worktree | `npm.cmd run typecheck` | All package builds and workspace typechecks passed |
| 2026-07-19 | GOV-002 worktree | `npm.cmd run test` | 49 files and 523 tests passed: Server 109, Web 183, AI 39, Contracts 46, Storage 146 |
| 2026-07-19 | GOV-002 worktree | `npm.cmd run build` | Contracts, AI, Storage, Server, and Web production builds passed; existing Vite chunk-size warning remains advisory |
| 2026-07-19 | GOV-002 worktree | `npm.cmd run docs:check` | Documentation check passed for 174 Markdown files |
| 2026-07-19 | GOV-002 worktree | `git diff --check` | Passed; only Git line-ending conversion warnings were emitted |
| 2026-07-19 | GOV-002 closure records | First three `npm.cmd run docs:check` attempts after closing support work | The transition initially omitted the active row and exact next-task declaration, then treated an implemented but visually open NS-602 as last reached. Records now use last completed NS-601 and active/next NS-602 without changing product state |

## Repository Safety

- Do not open, inspect, rewrite, or delete user source content under
  `data/library/` as part of automated review.
- Use temporary isolated Series roots for every database and source fixture.
- Database files are derived artifacts; JSON and managed original files remain
  authority.
