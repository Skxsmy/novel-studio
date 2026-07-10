# Current Status

Updated: 2026-07-10
Authority: current operational state only

## Project Mainline

- Active milestone: `M5 Workshop, Proposal, And Review`.
- Last reached mainline task: `NS-506 / M5.6A Execution Containment`.
- Next mainline task: `NS-507 / M5.6B Atomic Codex Adapters`.
- Open earlier gates: NS-503/M5.3, NS-504/M5.4, and NS-505/M5.5 retain explicit user visual-acceptance work; their command/function evidence is not a visual pass.
- Mainline state: ready to resume at NS-507; GOV-001 did not consume or renumber an NS task.

## Active Support Work

- Active task: none.
- Last completed support task: `GOV-001 Documentation Governance And Delivery Skeleton`.
- Task record: `docs/tasks/GOV-001.md`.
- Acceptance record: `docs/testing/GOV-001_ACCEPTANCE.md`.
- Next action: open the scoped NS-507 task and acceptance record before M5.6B implementation begins.

## Repository State

- Branch: `codex/ns-410-json-authority`.
- Rewritten pre-GOV-001 mainline tip: `6fbabac NS-506 fix(workshop): close tool execution lifecycle gaps`.
- Numbering-repair verification tip before closure: `578a74a GOV-001 docs(governance): separate support work from product mainline`.
- Local recovery ref: `backup/gov-001-before-numbering-rewrite-20260710` preserves the original pre-rewrite history; the rewritten and backup tips have identical tree `deae3c9fae1f797239b975c464106126df530765`.
- Pre-existing unrelated worktree item: untracked `.hermes/plans/`; GOV-001 must not modify or commit it.
- The unpublished range contains 29 rewritten commits including the first GOV-001 commit; no remote history was rewritten.

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
