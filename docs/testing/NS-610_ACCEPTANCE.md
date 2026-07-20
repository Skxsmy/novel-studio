# NS-610 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-610.md`
Decision: `docs/adr/0025-research-lifecycle-and-versioned-source-replacement.md`
Scope correction: `docs/adr/0026-freeze-unrequested-research-note-expansion.md`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| Acceptance ID | Status | Verification | Required evidence |
| --- | --- | --- | --- |
| NS-610-A01 | passed | authoritative records and `npm.cmd run docs:check` | after the author identified that NS-609 was unrequested, ADR-0026 and every active product, data, API, security, UX, traceability, task, and acceptance record now identify it as frozen compatibility rather than approved scope; documentation check passes 201 Markdown files before runtime work resumes |
| NS-610-A02 | passed | `packages/contracts/test/research-lifecycle.test.ts`, full Contracts suite/build, and affected workspace typechecks | Database version 1/version 2 and Source version 2/version 3/version 4 compatibility, lifecycle consistency, bounded replacement/confirmation inputs, Source blocker consistency, and archived-Source freshness pass; the corrected contracts contain no Research Note lifecycle or delete command |
| NS-610-A03 | planned | Storage database lifecycle tests | archive, restore, blocker, quarantine delete, restart cleanup, and rollback evidence |
| NS-610-A04 | planned | Storage Source lifecycle tests | immutable file/web replacement versions, reparse, archive/restore, parser-family, Note freshness, and rollback evidence |
| NS-610-A05 | planned | Storage Source blocker matrix and Proposal regressions | exact-confirmed deletion, Note snapshot consequence, and every pending/unreadable external-reference outcome |
| NS-610-A06 | planned | index, retrieval, gateway, Workshop, and restart tests | active-only projection/tool behavior and restore/current-version reconciliation |
| NS-610-A07 | planned | Server lifecycle route tests | complete connected route and classified bounded response evidence |
| NS-610-A08 | planned | Web NS-610 and affected shell tests | connected states, actions, drafts, selection, retry, blockers, and responsive behavior |
| NS-610-A09 | planned | adversarial Storage/Server and disk probes | injected failure, damage, stale revision, cross-root, and unchanged-authority evidence |
| NS-610-A10 | planned | adversarial public-output scans | isolation and redaction evidence without private Source/key/path disclosure |
| NS-610-A11 | planned | identified temporary-library server and real in-app browser | desktop and narrow author lifecycle workflow with API/disk cross-checks |
| NS-610-A12 | planned | final repository verification | full command, build, status, port, commit, diff, and real-library fingerprint ledger |
| NS-610-A13 | manual_pending | explicit author decision | author accepts or rejects the connected lifecycle workflow; automation cannot pass this row |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Pre-implementation Record

- Author correction on 2026-07-20: Research Note and Research Note-to-Codex were
  never requested. NS-609 is a frozen agent-created expansion under ADR-0026.
  NS-610 contains only Database and Source lifecycle; read-only Note/Proposal
  fixtures may prove that existing authority is not corrupted.

- At task opening, Research Database authority is version 1 and Source authority
  is version 3. Neither has lifecycle state; database and Source deletion-
  blocker/lifecycle contracts are partial scaffolding and are not implementation
  evidence. Research Note remains outside the NS-610 feature scope.
- Existing Source property updates rebuild indexes, but there is no retained
  version, replacement, reparse, archive, restore, or permanent-delete command.
- The author's saved model credential remains present and unchanged. NS-610
  does not read, copy, replace, delete, or print it.
- `data/library/` is protected. All lifecycle tests and browser work use generated
  temporary roots.

## Run Ledger

| Date | Commit/worktree | Command or procedure | Result |
| --- | --- | --- | --- |
| 2026-07-20 | clean tracked post-`c3c87ac` worktree | current contracts, storage, routes, Research UI, Proposal/audit references, architecture, and predecessor evidence inventory | Confirmed the missing lifecycle commands, identified existing Workshop database blocker scaffolding, mapped versioned authority and reference boundaries, and opened NS-610 without treating scaffolding as implemented behavior |
| 2026-07-20 | NS-610 planning worktree before runtime edits | `npm.cmd run docs:check`; `git diff --check`; scoped lifecycle contradiction scan | Passed 200 Markdown files and diff safety. ADR-0025 fixes database v2, Source v4 immutable replacement/reparse history, archive/read-only retrieval exclusion, deletion dependency order, external blocker handling, and exact-confirmed cleanup; A01 passed before runtime edits. |
| 2026-07-20 | post-`d35462e` A02 worktree | focused lifecycle and affected Contracts tests; full Contracts suite/build; Storage, Server, and Web typechecks; `git diff --check` | Passed 5 focused files/20 tests, full Contracts 12 files/79 tests, Contracts build, all affected workspace typechecks, and diff safety. Malformed lifecycle pairs, invalid versions, unsafe replacement envelopes, inconsistent blocker booleans, and oversized/empty confirmations are rejected. |
| 2026-07-20 | post-`1921881` scope-correction worktree | author correction inventory across status, task, product, architecture, API, contracts, and acceptance records | Confirmed that Research Note and Research Note-to-Codex were never requested. Froze NS-609 under ADR-0026, removed Note lifecycle from NS-610, and paused implementation until the corrected documentation check and a separate documentation commit pass. |
| 2026-07-20 | ADR-0026 documentation-correction worktree | `npm.cmd run docs:check`; `git diff --check`; scoped active-claim scan | Passed 201 Markdown files and diff safety. Active product and architecture records now limit NS-610 to Research Database and Source lifecycle; Research Note references are explicitly frozen historical or read-only compatibility boundaries pending an author retain, redesign, or remove decision. |
| 2026-07-20 | post-`c897496` corrected Contracts worktree | `npm.cmd run test -w @novel-studio/contracts -- research-lifecycle.test.ts`; full Contracts test/build; `git diff --check`; scoped Note lifecycle contract scan | Passed 1 focused file/5 tests, full 12-file/79-test Contracts suite, Contracts build, and diff safety. Removed the unrequested Note delete input/blocker schemas; Source Note snapshots are informational while pending Proposal or unreadable Series references block deletion. No Research Note lifecycle/delete contract remains. |
| 2026-07-20 | post-`134cd57` closeout worktree | exact NS-610 task acceptance-map review | Removed the final two planned Research Note UI/lifecycle references from the active NS-610 closure boundary and A08. No Storage implementation started after the author's closeout instruction; A03 remains the next implementation boundary. |

## Repository Safety

- Never mutate `data/library/`; recheck its exact recursive file-count and byte
  fingerprint before the implementation commit and final evidence commit.
- Never print or persist plaintext credentials, credential references, private
  Source bodies, authorization headers, or unredacted private paths.
- Keep generated lifecycle/browser roots under `.tmp/` and untracked.
