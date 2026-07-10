# Current Status

Updated: 2026-07-10
Authority: current operational state only

## Project Mainline

- Active milestone: `M5 Workshop, Proposal, And Review`.
- Last completed mainline task: `NS-506 / M5.6A Execution Containment`.
- Next mainline task: `NS-507 / M5.6B Atomic Codex Adapters`.
- Mainline state: paused only while the active support task is completed; GOV-001 does not consume or renumber an NS task.

## Active Support Work

- Active task: `GOV-001 Documentation Governance And Delivery Skeleton`.
- Task record: `docs/tasks/GOV-001.md`.
- Acceptance record: `docs/testing/GOV-001_ACCEPTANCE.md`.
- State: in progress.
- Next action: synchronize the confirmed English hierarchy, run final verification, and commit GOV-001.

## Repository State

- Branch: `codex/ns-410-json-authority`.
- Baseline observed before GOV-001 edits: `1e9bd66 NS-410 fix(workshop): close tool execution lifecycle gaps`.
- The branch was 28 commits ahead of `origin/codex/ns-410-json-authority` when GOV-001 started.
- Pre-existing unrelated worktree item: untracked `.hermes/plans/`; GOV-001 must not modify or commit it.
- GOV-001 changes are currently uncommitted, so the support task remains in progress.

## Current Product And Implementation Boundary

- Project authority is schema-versioned JSON; Markdown and Word are boundary formats, and indexes/caches are rebuildable.
- NS-410 is command-verified. Its completed task and acceptance records remain historical evidence, not the active work item.
- Project Recovery is the accepted baseline for the current UI/application stage, not proof of M5 completion.
- M5.1 through M5.5 and M5.6A have command/function evidence. Tool Plans/Grants, atomic composed Codex adapters, stale Agent draft baselines, broader tool coverage, Council, and final user visual acceptance remain unfinished.
- User visual acceptance is distinct from command/function verification. Diagnostic visual inspection cannot be reported as user acceptance.

## Confirmed Product Decision

- The canonical author-facing hierarchy is always English and ordered `Series → Volume → Chapter → Act → Scene`.
- The existing internal compatibility mapping is `Series → series`, `Volume → book`, `Chapter → act`, `Act → chapter`, and `Scene → scene` until a separately approved schema migration removes it. Internal names must not appear as product labels.

## Known Risks

- Current Workshop tool execution is contained for the limited path but still needs M5.6B atomicity, stale-baseline, and Progression target/scene binding work.
- Some current non-Write surfaces still expose the legacy `act/chapter` interpretation; product-facing mapping closure belongs to the next scoped mainline UI/runtime task and must follow the canonical labels above.
- `packages/storage/src/index.ts` remains oversized and should be split only when a scoped task touches the relevant domain.
- First-start library selection, in-app service stop, tray behavior, full provider real-world validation, and broader UI visual acceptance remain incomplete.
