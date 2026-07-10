# GOV-001 Acceptance Record

Status: manual_pending
Task: `docs/tasks/GOV-001.md`
Updated: 2026-07-10

## Acceptance Matrix

| ID | Status | Proof target | Actual evidence |
| --- | --- | --- | --- |
| GOV-001-A01 | passed | `scripts/docs-check.mjs` active-work-item checks; Git/status review | Exactly one active row: GOV-001; M5 is a milestone and NS-408 is paused |
| GOV-001-A02 | passed | Manual review of `AGENTS.md`; task-route assertions | Audit, implementation, UI, migration, and Provider routes are explicit; historical full-read fan-out removed |
| GOV-001-A03 | passed | `scripts/docs-check.mjs` current-state ownership checks; source review | Entry documents pass ownership/line limits; no conflicting next-step claim remains |
| GOV-001-A04 | passed | Stale-authority phrase checks; product/architecture source review | Confirmed Markdown-authority, archive-only, stale M4, and implementation-active claims removed |
| GOV-001-A05 | passed | ADR metadata and supersession checks | All 12 ADRs pass normalized Accepted/Superseded validation |
| GOV-001-A06 | passed | Active work-item/acceptance ID cross-check; templates; M5 evidence rewrite | GOV-001 IDs map exactly; M5 evidence locators name test files and test names |
| GOV-001-A07 | passed | `tests/docs/docs-check.test.mjs`; `npm.cmd run docs:check` | Six checker tests and the 90-file repository scan pass |
| GOV-001-A08 | passed | `git diff --name-only` and source-scope review | Changes are documentation, `package.json`, documentation checker, and checker tests only; no runtime app/package source changed |
| GOV-001-A09 | passed | Explicit user hierarchy decision and synchronized search | Product, UX, traceability, current/target architecture, data model, API, import/export, recovery, and agent rules now use `Series → Volume → Chapter → Act → Scene` and isolate the storage mapping |
| GOV-001-A10 | in_progress | Final branch/commit/worktree and command ledger | Final evidence pending synchronized hierarchy and commit |
| GOV-001-A11 | in_progress | Backup ref, `git log origin..HEAD`, before/after subjects, and `git diff <backup>..HEAD` | Eligible range identified as 28 unpublished commits; rewrite and tree-identity proof pending |

## Required Commands

```powershell
npm.cmd run test:docs
npm.cmd run docs:check
git diff --check
git status --short --branch
git diff --name-only
```

## Run Ledger

| Date | Commit/worktree | Command | Result |
| --- | --- | --- | --- |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run test:docs` | Passed: 4 tests before typed-ID expansion |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run docs:check` | Passed: 90 Markdown files before typed-ID expansion |
| 2026-07-10 | uncommitted GOV-001 | stale-claim `rg` audit | Passed: no confirmed stale claim remains in current authority/entry scope |
| 2026-07-10 | uncommitted GOV-001 | `git diff --check` | Passed with line-ending conversion warnings only |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run check` (sandboxed) | Documentation check passed, then package build was blocked by EPERM writing `packages/contracts/dist`; no source/test failure |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run check` (approved build permissions) | Passed: docs 90 files; server 55, web 82, AI 27, contracts 22, storage 89 tests; all typechecks and builds passed |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run test:docs` | Passed: 6/6 checker tests after mainline/support and hierarchy rules were added |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run docs:check` | Passed: 90 Markdown files with GOV/NS separation, sequential M5 mapping, links, ADR status, and hierarchy mapping enforced |
| 2026-07-10 | uncommitted GOV-001 | `git diff --check` | Passed with line-ending conversion warnings only |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run check` (sandboxed) | Documentation gate passed; package build was blocked by Windows sandbox EPERM on `packages/contracts/dist` |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run check` (approved build permissions) | Reached the final Web production build, then the command wrapper timed out at 122 seconds and caused an EPIPE; verification was split into the same constituent commands |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run typecheck` (approved build permissions) | Passed: package builds and all workspace typechecks |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run test` (approved build permissions) | Passed: server 55, web 82, AI 27, contracts 22, storage 89 tests |
| 2026-07-10 | uncommitted GOV-001 | `npm.cmd run build` (approved build permissions) | Passed: packages, server, and Web production build |

Initial checker execution exposed an invalid JavaScript regular-expression escape; the checker was corrected before any repository result was accepted. The first repository check then reported two simultaneously active NS rows and four ambiguous bare document references; the records were corrected and the same check passed. The first `git diff --check` reported new trailing whitespace/blank EOF lines; those formatting defects were corrected before the passing run. The first full repository check reached the documentation gate and then hit the known Windows sandbox EPERM on generated package output; rerunning the same command with approved build permissions passed.

## Manual Verification

- Confirm that root entry documents do not duplicate the current task narrative.
- Confirm that AGENTS rules distinguish runtime authority writes from source/document edits.
- Confirm that UI screenshots remain non-authoritative evidence while diagnostic visual inspection is not misreported as acceptance.
- Confirm that every author-facing hierarchy reference uses exact English labels in the order `Series → Volume → Chapter → Act → Scene` and maps legacy storage as `series → book → act → chapter → scene` only at the compatibility boundary.
