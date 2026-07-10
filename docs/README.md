# Documentation Map

This directory contains durable product knowledge, architecture decisions, scoped work, and acceptance evidence. Live repository state is owned only by `../STATUS.md`.

## Start Here

For repository mutation, read in this order:

1. `../PROJECT.md`
2. `../STATUS.md`
3. The active row in `../TASKS.md`
4. The active task file
5. The active acceptance record
6. Only the product, architecture, ADR, design, and historical documents named by that task

Use the task-kind routing table in `../AGENTS.md`. Do not read every completed milestone by default.

## Authority And Directory Roles

| Location | Owns | Must not own |
| --- | --- | --- |
| `product/` | Stable product behavior, UX, domain constraints, requirement-to-milestone mapping | Current implementation status or dated implementation logs |
| `architecture/` | Current system shape, target boundaries, API/data/security contracts | Product-roadmap status or task run logs |
| `adr/` | Architectural decisions, consequences, and supersession | Implementation progress |
| `tasks/` | One scoped work item, closure boundary, decisions, acceptance IDs, open questions | Test run transcripts or unrelated roadmap history |
| `testing/` | Exact acceptance mappings, commands, fixtures, results, and manual gates | New product requirements |
| `design/` | Approved design constraints, mappings, historical baselines, protected backups | General current status |

Root entry-document ownership:

- `README.md`: stable repository onboarding.
- `ROADMAP.md`: milestone intent only.
- `STATUS.md`: current task, repository state, blockers, and next action.
- `TASKS.md`: task index only.
- `HANDOFF.md`: incomplete-work resume point only.
- `CHANGELOG.md`: user-visible product changes only.

## Current Task

The current task is resolved through `../STATUS.md`; this file intentionally does not repeat its identity or next action.

## Cleanup Rules

- Do not create routine status, handoff, audit, or acceptance variants.
- Keep completed task and acceptance records outside the default reading path unless an active task names them.
- Preserve everything under `design/**/backups/` unless the user explicitly names a backup for deletion.
- Delete a non-backup document only after confirming it is not referenced by the active task, acceptance record, documentation index, or an unsuperseded ADR.
- Temporary validation output and generated reports must not become durable project knowledge.

Run `npm.cmd run docs:check` before completing a documentation or governance task.
