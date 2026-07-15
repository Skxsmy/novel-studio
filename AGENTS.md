# AI Development Collaboration Protocol

This file defines durable collaboration invariants for Novel Studio. Current task state belongs in `STATUS.md`; product behavior belongs in `docs/product/`; implementation evidence belongs in the active acceptance record.

## Authority Order

Resolve conflicts in this order:

1. An explicit user decision for the current task, after it is recorded in the authoritative product/task document.
2. `docs/product/PRODUCT_SPEC.md` and the relevant domain specification.
3. Accepted ADRs that have not been superseded.
4. Current and target architecture documents.
5. The active work-item specification.
6. The active acceptance record, as evidence rather than a source of new requirements.
7. Current implementation.

`STATUS.md`, `HANDOFF.md`, `TASKS.md`, chat history, screenshots, and placeholder UI are operational context, not product authority.

## Start A Task

Work on exactly one active work item at a time. `M0` through `M8` are product-mainline milestone goals. `NS-###` identifiers are reserved exclusively for executable product-mainline tasks, using the matching hundred range:

- M3 tasks use `NS-3xx`.
- M4 tasks use `NS-4xx`.
- M5 tasks use `NS-5xx`.

`NS-x00` may be used for a milestone preparation/protection task, followed by `NS-x01`, `NS-x02`, and so on. Historical milestone slices must be assigned their matching NS identities when the mapping is reconstructed; for example, M5.0 through M5.6A map to NS-500 through NS-506.

Audit, governance, repository-maintenance, and other support work that does not advance the product mainline must use a separate typed namespace such as `GOV-###`. A support task never consumes, renumbers, or reassigns an NS identity. While support work is active, `STATUS.md` must still state the active product milestone, the last reached mainline task, its open gates, and the next mainline task. Use `<TASK-ID> type(scope): summary` for commits.

For any repository mutation, always read:

1. `PROJECT.md`
2. `STATUS.md`
3. The active row in `TASKS.md`
4. `docs/README.md`
5. The active task file
6. The active acceptance record

Then read only the material routed by the task:

| Task kind | Additional required reading |
| --- | --- |
| Product behavior or scope | `docs/product/README.md`, relevant `docs/product/PRODUCT_SPEC.md` sections, relevant domain spec, traceability rows |
| UI, layout, copy, or Figma | `docs/product/USER_EXPERIENCE_SPEC.md`, the named design checklist, `docs/design/ui-redesign/FIGMA_TO_IMPLEMENTATION_WORKFLOW.md` |
| Data authority, schema, migration, deletion, or recovery | Current/target architecture, data model, governing ADRs, migration and rollback acceptance items |
| AI, Prompt, Context, Proposal, Agent, or Provider | `docs/product/AI_EDITORIAL_SYSTEM.md`, `docs/architecture/SECURITY.md`, relevant architecture and ADRs; Provider work also requires official Provider documentation |
| Read-only audit or explanation | The scoped authority documents and evidence under review; task/acceptance files only when auditing a work item |

Do not read historical milestone records unless the active task depends on them. The task specification must name any required historical record.

Before changing files, map every acceptance ID to an exact existing test, a planned test, or an explicit manual verification. Generic phrases such as “covered by tests” are not a sufficient map.

## Decisions And Scope

- Do not infer unclear product behavior from current code or a lower-authority task record.
- Record an unresolved product question in the active task and ask the user. Do not place durable product questions in `STATUS.md`.
- When the user makes a material product decision, update the authoritative product/domain specification before implementation. Add or supersede an ADR only when the decision changes an architectural boundary.
- Do not expand into unrelated modules or report roadmap placeholders as completed functionality.
- A task may remain in progress when a user decision, manual verification, or visual acceptance is pending.

## Logical Closure And Tests

Define a closure boundary proportionate to the task. Include only applicable items from: authoritative data, read/write paths, derived state, user entry points, lifecycle operations, migration/rollback, fixtures, and acceptance records.

For refactoring, migration, authority-format switching, architecture cleanup, or legacy deletion, search all old runtime paths, interfaces, fixtures, documentation claims, and user entry points. A remaining old path must be a specified boundary with tests and exit conditions, or an explicitly recorded open risk.

Treat a failing test as evidence of a possible specification, implementation, fixture, or assertion inconsistency. Verify the governing acceptance item before changing the test. Do not delete assertions, reduce coverage, bypass the path, or relabel a defect merely to obtain a pass.

Audits must report every confirmed defect and documentation overstatement inside their declared scope.

## Runtime Authority And Safety

- Project authority is schema-versioned JSON inside the project directory. Markdown and Word are import, export, mirror, and migration boundary formats. SQLite, vectors, caches, localStorage, and editor runtime state are not the only project copy.
- AI, bulk replacement, Word import, and similar semantic changes require a Proposal or an explicit user-confirmed action.
- Product runtime writes to authority files use same-directory temporary files, validation, checksum/revision protection, and atomic replacement. This rule does not require source-code or documentation editors to implement product storage transactions.
- Authority-schema changes require an ADR where the architectural contract changes, an explicit migration, and rollback tests. Rebuildable derived-index schema changes may instead prove delete-and-rebuild behavior.
- Do not log API keys, complete private manuscript text, credentials, cookies, authorization headers, or unredacted request headers.
- Do not add telemetry, accounts, remote listeners, automatic network research, or cloud fallback without an explicit product decision.
- New dependencies must record purpose, version, and license in the task or acceptance record; prefer permissive licenses.
- Do not reduce, hide, bypass, or downgrade an existing real capability without recording the impact and obtaining user confirmation.
- Do not remove Proposal, evidence, permissions, story time, or character-knowledge boundaries as a simplification.

## UI And Figma

- Figma-backed work must begin with the named node, route, entry/return paths, layout structure, component mapping, data source, states, and deferred behavior checklist.
- Figma is binding for the approved structure. Record and obtain approval for a deviation before implementing it.
- Unimplemented controls must be disabled, deferred, or absent. Do not show fake counts, static result cards, dead links, or unbacked actions as working UI.
- Main writing, planning, and review paths must not expose invocation IDs, revisions, hashes, internal task names, or other engineering audit fields.
- Reuse `src/ui/` components and tokens, compose domain pages under `src/features/`, keep API access under `src/api/`, and global boundaries under `src/app/`. Do not reintroduce a global multi-thousand-line style sheet.
- Keep user-facing copy centralized and natural. Do not mix Chinese and English accidentally or expose data-field names as UI labels.
- The canonical author-facing hierarchy labels are always English and ordered `Series → Volume → Chapter → Act → Scene`. Do not translate, reorder, or replace them with internal storage names. Until a separately approved schema migration, the compatibility mapping is `Series → series`, `Volume → book`, `Chapter → act`, `Act → chapter`, and `Scene → scene`; internal names remain implementation details.
- A screenshot, DOM measurement, build, or test count cannot prove visual acceptance. Diagnostic visual inspection is allowed when the task requires it, but do not run screenshot loops or claim user acceptance. User visual acceptance remains an explicit separate gate.

## Completion And Records

Run the commands required by the active task and record actual results in its acceptance record. Include adversarial cases proportionate to risk, including applicable damaged input, omitted members, duplicate IDs, stale versions, and mid-operation failures.

Update documents by ownership, not by blanket fan-out:

| Document | Update when |
| --- | --- |
| `STATUS.md` | The active task, next action, blocker, or repository state changes |
| `TASKS.md` | A task is added or its top-level status changes |
| `HANDOFF.md` | Work is intentionally handed off while incomplete |
| `CHANGELOG.md` | A user-visible capability changes |
| Active task | Scope, decision, plan, or open question changes |
| Active acceptance record | Evidence or acceptance status changes |

Before completion:

1. Re-check each specification invariant against its exact proof and actual result.
2. Run documentation/link consistency checks required by the task.
3. Record branch, commit, worktree, dirty files, and commands from actual output.
4. Ensure only task-related changes are committed; preserve unrelated user changes.
5. Keep the task in progress if task-related files remain uncommitted or a required manual/user gate is pending.

`main` must remain buildable with passing required checks. Sequential work continues on the current milestone branch unless the user directs otherwise. Parallel work requires explicit module ownership.

## Documentation Hygiene

- Keep live state in `STATUS.md`; do not copy the same next-step narrative into README, ROADMAP, HANDOFF, TASKS, CHANGELOG, product specs, and architecture docs.
- Product specs contain stable behavior, traceability contains requirement mappings, ADRs contain decisions, tasks contain scoped plans, acceptance records contain proof, and changelogs contain user-visible release changes.
- Do not create routine status or handoff variants.
- Preserve `docs/design/**/backups/` unless the user explicitly names a backup for deletion.
- Before deleting a non-backup document, confirm it is not referenced by the active task, acceptance record, or documentation index.
- Use normalized status values defined by the documentation checker. Superseded ADRs must identify their replacement.

## File Mutation Discipline

- Never modify an existing path by deleting it and then adding the same path again. Use an in-place `apply_patch` update.
- A file may be deleted only when the user explicitly authorizes deletion of that file and required reference checks have passed.
- Before an authorized deletion, resolve and verify the absolute target path and inspect its size. For a file of 128 KiB or larger, use native PowerShell `Remove-Item -LiteralPath` rather than `apply_patch`; do not make the deletion part of a replacement workflow.
- If a generated or machine-checkable block is too large for a safe in-place patch, stop and redesign the artifact or generator. Do not temporarily remove the existing file.
- Treat a delete-and-readd sequence as a process defect even when final bytes are restored; record the defect and remediation in the active acceptance record.
