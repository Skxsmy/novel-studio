# Documentation Map

This directory is for durable project knowledge. Temporary browser notes, failed screenshot runs, and duplicate status notes should not be added here.

## Fast Reading Path

For the current NS-409 state, read:

1. `../STATUS.md`
2. `../HANDOFF.md`
3. `../TASKS.md`
4. `tasks/NS-409.md`
5. `testing/NS-409_ACCEPTANCE.md`
6. `design/ui-redesign/README.md`

Only read older milestone documents when the current task depends on that area.

## Directory Roles

- `product/`: product scope, UX rules, AI editorial model, feature matrix, reference library, import/export/versioning. Highest authority for product intent.
- `architecture/`: API, data model, security, and target architecture. Highest authority for technical boundaries.
- `adr/`: accepted architectural decisions. Read the relevant ADR before changing a governed subsystem.
- `tasks/`: milestone and task specs. Current active recovery plan is `tasks/NS-409.md`.
- `testing/`: acceptance records and test strategy. Current NS-409 truth is `testing/NS-409_ACCEPTANCE.md`.
- `design/ui-redesign/`: NS-409 UI baselines, current design evidence, and protected backups.

## Cleanup Rules

- Do not create new status or handoff files for routine progress. Update `STATUS.md`, `HANDOFF.md`, `TASKS.md`, `CHANGELOG.md`, the current task file, and the current acceptance file.
- Do not delete anything under `design/**/backups/` unless the user explicitly names the backup to delete.
- Delete only non-backup files that are superseded, temporary, duplicated, or explicitly marked obsolete.
- Generated directories such as `node_modules`, `dist`, `.vite`, `.npm-cache`, reports, and caches are not documentation and should never be part of the reading path.

## Current Warning

NS-409 is not accepted. It has been replanned around foundation audit, Codex/API recovery, Write hierarchy recovery, Settings completion, and honest Review/Workshop scope. The current React UI is a command-verified working draft with rejected visuals.
