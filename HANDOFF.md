# Handoff

Updated: 2026-07-10
Purpose: resume incomplete work only

## Resume Point

- Product mainline: M5; completed through `NS-506 / M5.6A`.
- Next product-mainline task: `NS-507 / M5.6B`.
- Active support task: `GOV-001 Documentation Governance And Delivery Skeleton`.
- Resume from `docs/tasks/GOV-001.md` and `docs/testing/GOV-001_ACCEPTANCE.md`.
- Runtime application behavior is out of scope.
- NS-507/M5.6B remains queued until this governance task closes.

## Work Completed In This Task

- Created the GOV-001 task and acceptance matrix without consuming an M5 mainline NS identity.
- Reworked `AGENTS.md` around the `M milestone -> matching NS-xYY task` model, conditional reading, proportional closure, precise evidence, scoped runtime-write rules, and document ownership.
- Reduced root entry documents to non-overlapping roles and removed duplicated live-state/history logs.
- Replaced stale current architecture, JSON-authority, traceability, and ADR lifecycle claims.
- Added task/acceptance templates and rewrote M5 milestone/acceptance records with exact evidence locators.
- Added and tested `npm.cmd run docs:check`.

## Still Required

- Synchronize the confirmed `Series → Volume → Chapter → Act → Scene` English hierarchy and legacy storage mapping.
- Run final verification, update the acceptance ledger, review the final diff, and commit only task files.

## Repository Safety

- Branch at task start: `codex/ns-410-json-authority`.
- Baseline at task start: `1e9bd66`.
- Preserve the pre-existing untracked `.hermes/plans/` directory.
- Commit this support task with the GOV-001 prefix; preserve NS-507 for the next product-mainline task.
