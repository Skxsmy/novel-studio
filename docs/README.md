# Documentation Map

This directory is for durable project knowledge. Temporary browser notes, failed screenshot runs, and duplicate status notes should not be added here.

## Fast Reading Path

For the current M5 startup state and accepted recovery baseline, read:

1. `../STATUS.md`
2. `../HANDOFF.md`
3. `../TASKS.md`
4. `tasks/M5.md`
5. `testing/M5_ACCEPTANCE.md`
6. `design/ui-redesign/M5_WORKSHOP_REVIEW_FIGMA_PLAN.md`
7. `design/ui-redesign/M5_FIGMA_UI_REVIEW.md`
8. `design/ui-redesign/FIGMA_TO_IMPLEMENTATION_WORKFLOW.md`
9. `tasks/NS-410.md`
10. `testing/NS-410_ACCEPTANCE.md`
11. `adr/0012-scene-block-documents-and-codex-field-progression.md`
12. `tasks/PROJECT_RECOVERY.md`
13. `testing/PROJECT_RECOVERY_ACCEPTANCE.md`

Only read older milestone documents when the current task depends on that area.

## Directory Roles

- `product/`: product scope, UX rules, AI editorial model, feature matrix, reference library, import/export/versioning. Highest authority for product intent.
- `architecture/`: API, data model, security, and target architecture. Highest authority for technical boundaries.
- `adr/`: accepted architectural decisions. Read the relevant ADR before changing a governed subsystem.
- `tasks/`: milestone and task specs. Current active implementation line is `tasks/M5.md`; accepted recovery baseline remains in `tasks/PROJECT_RECOVERY.md`.
- `testing/`: acceptance records and test strategy. Current M5 acceptance record is `testing/M5_ACCEPTANCE.md`; accepted recovery baseline is `testing/PROJECT_RECOVERY_ACCEPTANCE.md`.
- `design/ui-redesign/`: historical UI baselines, current design evidence, and protected backups.

## Cleanup Rules

- Do not create new status or handoff files for routine progress. Update `STATUS.md`, `HANDOFF.md`, `TASKS.md`, `CHANGELOG.md`, the current task file, and the current acceptance file.
- Do not delete anything under `design/**/backups/` unless the user explicitly names the backup to delete.
- Delete only non-backup files that are superseded, temporary, duplicated, or explicitly marked obsolete.
- Generated directories such as `node_modules`, `dist`, `.vite`, `.npm-cache`, reports, and caches are not documentation and should never be part of the reading path.

## Current Warning

Project Recovery is accepted for the current stage by user decision on 2026-06-30. `NS-410` JSON Authority, Block Write Editor, and Unified Codex Progression is command-verified through post-Slice 11 audit repair; do not treat that as separate future M5 visual acceptance. The active line is `M5` Workshop, Proposal, and Review through `docs/tasks/M5.md` and `docs/testing/M5_ACCEPTANCE.md`; M5.0 Current Feature Protection Lock is in progress, while Workshop/Review UI implementation and user visual acceptance have not started.
