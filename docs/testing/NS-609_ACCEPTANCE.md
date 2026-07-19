# NS-609 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-609.md`
Decision: ADR-0024 fixes database-owned evidence-bound Notes and Proposal-gated Codex field mapping

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| Acceptance ID | Status | Verification | Required evidence |
| --- | --- | --- | --- |
| NS-609-A01 | passed | authoritative product/architecture records and `npm.cmd run docs:check` | ADR-0024 and governing product, data, API, security, UI, task, and traceability records agree before runtime edits; documentation check passed for 197 Markdown files and the contradiction scan returned no matches |
| NS-609-A02 | passed | `packages/contracts/test/research-notes.test.ts` | 3 focused tests pass bounded schema round trips and malformed, oversized, duplicate, contradictory, cross-database, lifecycle, and client-forged evidence rejection |
| NS-609-A03 | passed | `packages/storage/test/research-notes.test.ts` | 5 tests pass atomic revision-checked create/update/evidence/archive/restore, restart, filtering, isolation, damaged/duplicate diagnostics, and injected create/update rollback |
| NS-609-A04 | passed | `packages/storage/test/research-notes.test.ts` | exact original-language evidence passes current, Source revision changed, passage changed, Source missing, unreadable, ownership mismatch, model-use forbidden, stale capture, and cross-database rejection without note mutation |
| NS-609-A05 | passed | `apps/server/test/research-note-routes.test.ts` | 2 connected HTTP tests pass bounded list/detail, upload-to-search-to-capture, all Note mutations, validation/conflict/not-found/cross-database/damage classification, and response scans with no Source body, private path, or `filePath` leakage |
| NS-609-A06 | planned | `apps/web/src/features/research/ResearchDatabaseWorkspace.ns609.test.tsx` and browser workflow | exact-passage note creation, editing, visible evidence separation, refresh, archive/restore, and stale-state UI pass |
| NS-609-A07 | planned | Proposal contract, Storage, Server, and Review tests | explicit Series, meaning, and Codex target produce one pending Proposal and zero pre-acceptance Codex writes |
| NS-609-A08 | planned | `packages/storage/test/proposals.test.ts`; `apps/server/test/proposal-routes.test.ts` | dependency recheck, snapshot, exact-once apply, edited candidate, and atomic stale/failure handling pass |
| NS-609-A09 | planned | adversarial contract/Storage/Server matrix and public-output scan | authority and permission isolation fail closed without content, path, or credential leakage |
| NS-609-A10 | planned | identified temporary-library server and real in-app browser | desktop and narrow author workflow reaches verified Codex authority with no dead control or incoherent overflow |
| NS-609-A11 | planned | focused checks, one final `npm.cmd run check`, docs/link check, diff/status/fingerprint inspection, and exact commits | all automated gates and repository safety evidence pass |
| NS-609-A12 | manual_pending | explicit author decision | author accepts or rejects the final connected workflow; automation cannot pass this row |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Pre-implementation Record

- The current contracts contain `research-note` and `create-research-note`
  Proposal enum values, but there is no Research Note schema, authority writer,
  route, UI, or Proposal application path. Those enum values are scaffolding and
  are not accepted as implementation evidence.
- Research Database, Source, and Research Note authority are library-scoped and
  isolated, while Proposal files and Codex targets are Series-scoped. ADR-0024
  records the read-only dependency and Series transaction boundary.
- The author's saved Provider credential remains present and unchanged. NS-609
  does not read, copy, replace, or test that credential.

## Run Ledger

| Date | Commit/worktree | Command or procedure | Result |
| --- | --- | --- | --- |
| 2026-07-20 | clean post-`b27e6f2` worktree | authority and runtime inventory over Research specifications, Research Database/Source contracts, Proposal contracts, Proposal storage, Review UI, STATUS, and TASKS | Confirmed the Research Note implementation is absent beyond Proposal enum scaffolding; recorded the two unresolved product boundaries before runtime changes |
| 2026-07-20 | clean post-`83ae262` worktree | official Zotero note/library model and official Novelcrafter Codex revision/progression research | Mature references support library-owned source-bound and standalone notes, separately versioned Canon description and non-Canon notes, and explicit story-state progression; recorded as recommendation evidence without claiming author approval |
| 2026-07-20 | clean post-`5dca4d6` worktree | installed `ui-design` Skill, accepted Research checklists, current connected Research DOM/CSS, Story Change component, API, and state inventory | Added the named direct-to-React UI checklist covering route, entry/return, three-column Sources/Notes structure, component/data map, evidence states, promotion dialog, accessibility, responsiveness, and exact browser path while keeping both product decisions unresolved |
| 2026-07-20 | clean post-`aad19e9` worktree | Proposal contract, source/target availability, preview, accept/edit-accept, Scene transaction, Codex dual-revision authority, create/update transaction, and Research database transaction review | Confirmed dormant Codex/Research Note enum paths cannot currently apply: create target availability requires a nonexistent entry to exist, every non-Scene patch is rejected, both accept paths are Scene-only, create snapshots cannot represent target absence, and Research Note is not a Proposal source kind. Recorded a target-family planner and same-Series-root atomic application design without claiming implementation |
| 2026-07-20 | clean post-`610cc45` worktree | re-read ADR-0019, Research product and user-experience authority, Codex field separation, Proposal boundaries, and NS-609 checklist | Corrected the task's mistaken reopening of a settled ownership rule. Added ADR-0024 and aligned product, architecture, API, security, traceability, task, acceptance, and UI records before runtime edits |
| 2026-07-20 | NS-609 authority-decision worktree | `npm.cmd run docs:check`; `git diff --check`; scoped contradiction scan | Passed 197 Markdown files, no diff errors, and no remaining pending-decision wording in the active NS-609 records; A01 passed before runtime edits |
| 2026-07-20 | post-`d3d2b06` A02-A04 worktree | focused Research Note tests; full Contracts and Storage suites; Contracts and Storage builds; `git diff --check` | Focused 3 Contracts and 5 Storage tests pass. Full Contracts pass 11 files/73 tests; full Storage pass 19 files/199 tests; both builds and diff check pass. Verified exact disk bytes, restart, injected rollback, damaged/duplicate isolation, all evidence freshness states, local `never` separation, and cross-database rejection without touching `data/library/` |
| 2026-07-20 | post-`5097212` A05 worktree | `apps/server/test/research-note-routes.test.ts`; full Server suite; Server build; `git diff --check` | Focused 2 tests and full Server 26 files/171 tests pass. Real HTTP flow uploads and searches Sources before Note capture, bounds list/detail, exercises every Note mutation, and proves classified error bodies omit Source text, private paths, and internal `filePath`; build and diff check pass |

## Repository Safety

- Do not mutate `data/library/` while planning or during generated-fixture tests.
- Do not print or persist plaintext credentials, credential references, private
  Source bodies, Provider raw responses, authorization headers, or private paths.
- Every runtime test uses a generated temporary library and verifies cleanup.
