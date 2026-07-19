# Current Status

Updated: 2026-07-19
Authority: current operational state only

## Project Mainline

- Active milestone: `M6 Reference Library And Retrieval`.
- Active task: `NS-602 / M6.1 Database Kernel And Research Source Vertical Slice`; status remains in progress because explicit author visual acceptance is open.
- Last reached mainline task: `NS-601 / M6.0 Database Architecture Planning` at `e889c4c`; NS-602 is implemented but not completed while its author visual gate remains open.
- Next mainline task: `NS-602 / M6.1 Database Kernel And Research Source Vertical Slice`; its author visual decision must be recorded before NS-603 is opened.
- Next mainline action: obtain the author's explicit Research visual decision for NS-602; after that gate closes, scope NS-603 without assuming the GOV-002 recommendations are approved.
- Deferred earlier mainline tasks: `NS-511-NS-513` remain unfinished by explicit user direction; NS-514 is paused with only A16 author visual acceptance open. No task is skipped, renumbered, or implied complete.
- Open earlier gates: NS-503/M5.3, NS-504/M5.4, and NS-505/M5.5 retain explicit user visual-acceptance work; their command/function evidence is not a visual pass.
- Mainline state: GOV-002 is complete and does not consume, complete, or renumber an NS task. Its diagnostic UI work does not satisfy NS-602 author visual acceptance.

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

## Known Risks

- GOV-002 leaves process-local writer coordination, durable projector freshness, bounded deep-FTS diagnosis, symlink-safe filesystem containment, schema-v2 foreign keys, authority backup drills, and author-scale performance as explicit residual risks. See `docs/testing/GOV-002_DATABASE_REVIEW.md` before scoping NS-603.
- Current limited Workshop Codex tools are atomic, stale/target-bound, and connected to durable Agent continuation; Tool Plans/Grants, broader tools, and Proposal fallback remain unfinished.
- Workshop call and lifecycle mutual exclusion is local to one server process. Restart reconciliation marks unfinished work without replay, but durable cross-process wake/join, cross-process cancellation, and unknown-side-effect recovery remain open architecture work.
- Embedding profile Settings UI and model lifecycle controls remain deferred; NS-508 exposes the persisted binding/API and manual planner degradation without pretending that Settings UI exists.
- Some current non-Write surfaces still expose the legacy `act/chapter` interpretation; product-facing mapping closure belongs to the next scoped mainline UI/runtime task and must follow the canonical labels above.
- `packages/storage/src/index.ts` remains oversized and should be split only when a scoped task touches the relevant domain.
- First-start library selection, in-app service stop, tray behavior, full provider real-world validation, and broader UI visual acceptance remain incomplete.
- `tests/e2e/browser-acceptance.spec.ts` still asserts the retired Chinese pre-reference shell (`小说工作室`) and fails independently; the five current reference/Research browser tests pass after per-test temporary-library isolation. Do not skip or weaken the historical assertions merely to make the aggregate command green.
