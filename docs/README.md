# Documentation Map

This directory is for durable project knowledge. Temporary browser notes, failed screenshot runs, and duplicate status notes should not be added here.

## Fast Reading Path

For the current NS-410 implementation state, read:

1. `../STATUS.md`
2. `../HANDOFF.md`
3. `../TASKS.md`
4. `tasks/NS-410.md`
5. `testing/NS-410_ACCEPTANCE.md`
6. `adr/0012-scene-block-documents-and-codex-field-progression.md`
7. `tasks/PROJECT_RECOVERY.md`
8. `testing/PROJECT_RECOVERY_ACCEPTANCE.md`

Only read older milestone documents when the current task depends on that area.

## Directory Roles

- `product/`: product scope, UX rules, AI editorial model, feature matrix, reference library, import/export/versioning. Highest authority for product intent.
- `architecture/`: API, data model, security, and target architecture. Highest authority for technical boundaries.
- `adr/`: accepted architectural decisions. Read the relevant ADR before changing a governed subsystem.
- `tasks/`: milestone and task specs. Current active recovery plan is `tasks/PROJECT_RECOVERY.md`.
- `testing/`: acceptance records and test strategy. Current recovery truth is `testing/PROJECT_RECOVERY_ACCEPTANCE.md`.
- `design/ui-redesign/`: historical UI baselines, current design evidence, and protected backups.

## Cleanup Rules

- Do not create new status or handoff files for routine progress. Update `STATUS.md`, `HANDOFF.md`, `TASKS.md`, `CHANGELOG.md`, the current task file, and the current acceptance file.
- Do not delete anything under `design/**/backups/` unless the user explicitly names the backup to delete.
- Delete only non-backup files that are superseded, temporary, duplicated, or explicitly marked obsolete.
- Generated directories such as `node_modules`, `dist`, `.vite`, `.npm-cache`, reports, and caches are not documentation and should never be part of the reading path.

## Current Warning

The current product is not visually accepted. By explicit user direction on 2026-06-26, the active planning line is `NS-410` JSON Authority, Block Write Editor, and Unified Codex Progression. Project recovery is paused but still not accepted; automated NS-410 checks must not be reported as user visual acceptance. NS-410 implementation is active on `codex/ns-410-json-authority`; continue only through the controlled slice plan in `docs/tasks/NS-410.md`.
