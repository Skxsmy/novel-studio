# Current Status

Updated: 2026-07-19
Authority: current operational state only

## Project Mainline

- Active milestone: `M6 Reference Library And Retrieval`.
- Active task: `NS-605 / M6.4 Multi-database Hybrid And Cross-language Retrieval`; automated and engineering acceptance A01-A11 is committed, while the independent author visual/workflow decision A12 remains open.
- Last reached mainline task: `NS-604 / M6.3 Durable Research Source And Original-language Lexical Index`; A01-A13 are committed through `d655ad8`, while A14 author visual acceptance remains open without blocking NS-605 by the author's explicit 2026-07-19 direction to continue.
- Next mainline task: `NS-605 / M6.4 Multi-database Hybrid And Cross-language Retrieval`; NS-606, NS-607, and NS-608 remain separate unstarted successors.
- Next mainline action: present the committed NS-605 Research retrieval surface for the independent A12 author decision. Model-facing read-only tools remain the separate NS-606 scope, and Workshop activation remains NS-607.
- Deferred earlier mainline tasks: `NS-511-NS-513` remain unfinished by explicit user direction; NS-514 is paused with only A16 author visual acceptance open. No task is skipped, renumbered, or implied complete.
- Open earlier gates: NS-503/M5.3, NS-504/M5.4, and NS-505/M5.5 retain explicit user visual-acceptance work; their command/function evidence is not a visual pass.
- Mainline state: GOV-002 is complete and does not consume, complete, or renumber an NS task. NS-602 author visual acceptance was supplied separately by the author.

## Active Support Work

- Active task: none.
- Last completed support task: `GOV-002 Database Implementation Review And Hardening`.
- Task record: `docs/tasks/GOV-002.md`.
- Acceptance and report: `docs/testing/GOV-002_ACCEPTANCE.md`; `docs/testing/GOV-002_DATABASE_REVIEW.md`.
- State: complete; fifteen confirmed defects were fixed, full verification passed, and unresolved risks/recommendations remain explicitly unapproved.

## Repository State

- Branch: `codex/ns-514-overview`; NS-601 base is `e889c4c` and the separate NS-514 follow-up commit is `b7ae1be`.
- Review baseline: `bb37126 NS-602 feat(research): add source workspace and index kernel`; the worktree was clean when GOV-002 opened.
- GOV-002 hardens SQLite identity, health, recovery, FTS policy, Research transactions, literal search, and Research dirty-state handling in its own task-scoped closure commit.
- Rewritten pre-GOV-001 mainline tip: `6fbabac NS-506 fix(workshop): close tool execution lifecycle gaps`.
- Numbering-repair verification tip before closure: `578a74a GOV-001 docs(governance): separate support work from product mainline`.
- Local recovery ref: `backup/gov-001-before-numbering-rewrite-20260710` preserves the original pre-rewrite history; the rewritten and backup tips have identical tree `deae3c9fae1f797239b975c464106126df530765`.
- NS-514 repair and integration commits include `d532e79 NS-514 fix(settings): restore real model connections`, `1f01082 NS-514 fix(workshop): restore zero-model chat flow`, `ae7452b NS-514 fix(workshop): isolate session message validation`, `64b7ef0 NS-514 feat(overview): connect reference workspace`, and current base `5981d38 NS-514 docs(overview): record integration evidence`.
- NS-514 and NS-602 were split into separate task-scoped commits. NS-602 contains Research contracts/storage/API/UI/tests, the versioned SQLite kernel and atomic rebuild, database/product records, and isolated current end-to-end fixtures. The pre-existing `data/library/` remains outside task scope and must be preserved; the tracked binding reference remains unchanged.
- NS-603 implementation commit `d518666` adds library-scoped ResearchDatabase v1, database-owned SourceDocument v2, isolated storage/API paths, explicit multi-Series links, legacy copy migration, and the connected multi-database UI. Full typecheck, 52 files/540 tests, production build, 178-file documentation check, two real-Chrome workflows, independent API/disk/logger probes, and diff check pass.
- NS-603 evidence commit `d78ff45` records the final implementation ledger. The author separately accepted the connected multi-database page on 2026-07-19, closing A12 and authorizing NS-604 to begin.
- NS-604 planning commit `33a8e0f` records ADR-0020 and A01-A14 before runtime edits. Implementation commit `1017c88` adds SourceDocument version 3, TXT/Markdown/DOCX/PDF/EPUB/HTML/web parsing, exact binary/content authority, explicit v2 migration, one identity-bound index per Research Database, and single-database original-language lexical search. Defect-closure commit `8b049a0` replaces quadratic/unbounded plain-text parsing, bounds Blocks, returns lightweight Source views, pages the reader, opens search results on the matched Block page, and records NS-605 through NS-608 as separate unstarted tasks. A direct 25 MiB HTTP probe and connected 3 MiB browser workflow pass, but NS-604 remains in progress until A14 is decided. It does not provide hybrid cross-language retrieval, model-facing tools, or Workshop integration.
- Post-`f6307e8` connected inspection found that a search result opened the correct 40-Block page but left the exact term outside the viewport when the matched Block was large. Commit `52b8da4` renders a term-level marker, scrolls it after the page commits, cancels stale navigation on source changes, and verifies the marker is in the real Chrome viewport without coloring the full Block.
- Post-`fd289c2` failure-path review found that an initial page-read error removed an otherwise valid Source from local UI state, a failed result-page request could leave stale navigation state, result labels/highlights followed unsubmitted input, and fallback from a deleted saved database could leave the stale identifier in local storage. The current correction closes all four paths; focused Chrome passes both workflows and `npm.cmd run check` passes 186 Markdown files, all workspace typechecks, 59 files/586 tests, and production build.
- Post-`b13cb1d` recovery review found that an initial page failure exposed no working retry and every Source-detail error was treated as stale authority. Commit `d655ad8` adds real page, Source-card, Source-button, and search-result retries, preserves the selected and persisted Source on transient errors, and reserves stale removal for explicit `404 NOT_FOUND`. Focused Web passes 22 tests, both real-Chrome workflows pass with exact page and detail failure injection, and `npm.cmd run check` passes 186 Markdown files, all workspace typechecks, 59 files/588 tests, and production build. The connected preview health reports `d655ad848b12`; its 3 MiB final result opens Blocks 161-196 with the exact term in the current viewport.
- NS-605 planning commit `ef83e53` records the isolated `sqlite-vec` 0.1.9 decision and exact acceptance map before the task's runtime implementation.
- NS-605 implementation commit `0114411` closes A02-A11 with exact multi-database/permission/filter/cursor behavior, incremental vector reuse, stale-page recovery, and long-dialog layering repair. `npm.cmd run check` passes 188 Markdown files, every workspace typecheck, 65 test files with 623 tests, and production build; the dedicated Chrome workflow and independent 4,096-Chunk probe pass. A12 remains an author-only decision and is not implied by automation.
- The unpublished range contains 29 rewritten commits including the first GOV-001 commit; no remote history was rewritten.

## Current Product And Implementation Boundary

- Project authority is schema-versioned JSON; Markdown and Word are boundary formats, and indexes/caches are rebuildable.
- ADR-0015 governs the implemented Relation v1-to-v2 migration: v2 removes `type` without preserving or merging it, writes an exact v1 rollback artifact, rejects damaged or duplicate authority, and permits permanent Delete only when Progression, Character Knowledge, and Proposal references are absent.
- NS-410 is command-verified. Its completed task and acceptance records remain historical evidence, not the active work item.
- Project Recovery is the accepted baseline for the current UI/application stage, not proof of M5 completion.
- M5.1 through M5.6E have command/function evidence. Versioned Prompt customization, Tool Plans/Grants, broader tool coverage, Council, and final user visual acceptance remain unfinished.
- User visual acceptance is distinct from command/function verification. Diagnostic visual inspection cannot be reported as user acceptance.

## Confirmed Product Decision

- The canonical author-facing hierarchy is always English and ordered `Series → Volume → Chapter → Act → Scene`.
- The existing internal compatibility mapping is `Series → series`, `Volume → book`, `Chapter → act`, `Act → chapter`, and `Scene → scene` until a separately approved schema migration removes it. Internal names must not appear as product labels.
- Novel/database search is Chinese-author-first but not Chinese-corpus-only. A Chinese query must be able to retrieve relevant Japanese and English originals through an explainable multilingual path; aliases, transliteration, query translation, and semantic similarity remain disclosed derived channels, while Evidence and citations always return to the unchanged original language/hash/location.
- Research Databases are library-scoped, may be created without an active Series, and are not owned by a Series. Multiple databases keep separate authority, Sources, originals, indexes, permissions, damage, and lifecycle state. One database may link to several Series; default search uses one database and only explicit author multi-selection may merge labeled results.
- Current implementation includes local explicit multi-database Exact/Hybrid retrieval, database-scoped aliases/transliterations, and a semantic channel that uses only the current validated `research.multilingual` Embedding profile and current per-database vector sidecar. Query translation has no active binding or runtime path. Read-only model tools, Workshop activation, bounded iterative retrieval, and real saved-key author workflows remain NS-606 through NS-608 and must not be presented as implemented.

## Known Risks

- GOV-002 leaves process-local writer coordination, durable projector freshness, bounded deep-FTS diagnosis, symlink-safe filesystem containment, schema-v2 foreign keys, authority backup drills, and author-scale performance as explicit residual risks. See `docs/testing/GOV-002_DATABASE_REVIEW.md` before scoping NS-603.
- Current limited Workshop Codex tools are atomic, stale/target-bound, and connected to durable Agent continuation; Tool Plans/Grants, broader tools, and Proposal fallback remain unfinished.
- Workshop call and lifecycle mutual exclusion is local to one server process. Restart reconciliation marks unfinished work without replay, but durable cross-process wake/join, cross-process cancellation, and unknown-side-effect recovery remain open architecture work.
- Embedding profile Settings UI and model lifecycle controls remain deferred; NS-508 exposes the persisted binding/API and manual planner degradation without pretending that Settings UI exists.
- Some current non-Write surfaces still expose the legacy `act/chapter` interpretation; product-facing mapping closure belongs to the next scoped mainline UI/runtime task and must follow the canonical labels above.
- `packages/storage/src/index.ts` remains oversized and should be split only when a scoped task touches the relevant domain.
- First-start library selection, in-app service stop, tray behavior, full provider real-world validation, and broader UI visual acceptance remain incomplete.
- `tests/e2e/browser-acceptance.spec.ts` still asserts the retired Chinese pre-reference shell (`小说工作室`) and fails independently; the five current reference/Research browser tests pass after per-test temporary-library isolation. Do not skip or weaken the historical assertions merely to make the aggregate command green.
