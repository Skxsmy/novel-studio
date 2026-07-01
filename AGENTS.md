# AI Development Collaboration Protocol

This file applies to all AI agents and automation tools participating in Novel Studio.

## Before Starting A Task

You must read the following in order:

1. `PROJECT.md`
2. `docs/product/README.md`
3. `docs/product/PRODUCT_SPEC.md`
4. `docs/product/REQUIREMENTS_TRACEABILITY.md`
5. `STATUS.md`
6. `HANDOFF.md`
7. `TASKS.md`
8. `docs/architecture/TARGET_ARCHITECTURE.md`
9. The domain specification, architecture documents, and ADRs relevant to the current task

You must also read `docs/README.md` and the acceptance record relevant to the current task. Before coding, map every acceptance ID in the task specification to an existing test, a planned new test, or an explicit manual verification. Acceptance items that cannot be mapped must not be silently ignored.

Handle only one `NS-###` task at a time. Do not opportunistically expand scope, rewrite unrelated modules, or describe roadmap placeholder UI as completed functionality.

Chat context is not a long-term source of project requirements. If you find an important product decision that exists only in chat, first add it to the authoritative specification, then implement it. If a requirement is unclear, do not infer it from the current code; record the product question in `STATUS.md` and ask the user to decide.

Tasks involving UI, layout, or copy must also read `docs/product/USER_EXPERIENCE_SPEC.md`. During implementation, judge information hierarchy from the author's perspective: the main writing, planning, and review screens must not display engineering audit fields such as invocation IDs, baseline versions, source hashes, or internal task names. These details may appear only in logs, detail pages, or debug views. New screens must reuse the unified visual language and component style; do not invent separate buttons, cards, fonts, spacing, or colors for each page. The main interface must not be written as an operation manual; "how to use" guidance may appear only lightly as short labels, input placeholders, icon tooltips, concise empty states, and necessary error messages. Tutorial cards, long explanations, or persistent help copy must not crowd the manuscript and workspace.

## UI And Figma Implementation Discipline

For UI work backed by Figma, Figma is a binding implementation constraint, not an inspiration image. Before editing UI code, extract the target Figma node into a concrete checklist covering node ID, product route, entry and return paths, column structure, region order, row heights, control sizes, key cards, state surfaces, component mapping, data source, and disabled/deferred behavior. Code changes must correspond to that checklist. Do not replace a Figma structure with a personally preferred layout, an easier existing CSS pattern, or an API-shaped placeholder unless the deviation is explicitly recorded and approved.

Unimplemented Figma controls must remain honest: disabled, deferred, or absent according to the current slice. Do not redesign the page to hide missing behavior, and do not present unbacked buttons, fake counts, static proposal cards, or dead links as working UI.

Agents must not perform screenshot-based UI acceptance for this project. Do not start browser screenshot loops, visual-diff loops, or screenshot QA as a completion gate. Screenshots may be captured only when the user explicitly requests a screenshot artifact; they must be treated as a reference artifact, not as agent-owned visual acceptance. If a browser or screenshot tool fails, stop that path and report the tool failure instead of debugging the screenshot pipeline.

UI acceptance must be argued from the Figma checklist, component mapping, real data/control backing, focused functional tests where appropriate, and explicit user visual review. A passing build, test count, screenshot, or DOM measurement must not be described as visual acceptance.

Do not add hard time-box rules for UI work. The constraint is procedural: keep Figma checklist adherence, implementation, and verification separate; do not let verification tooling replace the actual UI work.

The NS-409 frontend redo must build maintainable architecture before full pages. The fixed boundaries are: `src/ui/` for design tokens and base components, `src/features/<domain>/` for domain-composed pages, `src/api/` for an independent API layer, and `src/app/` for the application shell and global boundaries. Global styles may contain only `reset.css`, `tokens.css`, and a small amount of base layout. A multi-thousand-line global `styles.css` must not reappear. Before full implementation, first deliver the English UI designs for the three core pages: writing, planning, and settings. Then complete the vertical slice "project selection -> writing page -> save status -> settings entry". Every control must come from the component library.

## Minimum Verifiable Logical Work

"Minimum" must not be understood as the smallest code diff, the fewest changed files, or only fixing the current error. The minimum unit of work must be an independently verifiable product/architecture logic closure: it covers the corresponding acceptance IDs, specification invariants, authoritative data read/write paths, API/UI entry points, test evidence, and necessary documentation state.

When the user asks for refactoring, migration, authoritative format switching, architecture cleanup, or deletion of old implementation, the default target is logical closure inside the requested scope, not compatibility remnants. You must systematically search for old formats, old interfaces, old runtime paths, old test fixtures, old documentation claims, and old UI entry points. Any old path that remains must satisfy one of the following:

- It is explicitly required by the specification as an import, export, mirror, migration, rollback, or compatibility boundary.
- It has clear old/new boundary naming, test coverage, and exit conditions.
- It is recorded as an unfinished risk or product question and is not marked as completed in the acceptance record.

Do not use "keep the change minimal", "avoid expanding scope", or "simplify first" as a reason to skip legacy remnants, tests, migrations, rollbacks, deletion entry points, documentation synchronization, or acceptance updates that are within the user-specified scope. If complete closure would touch modules outside the current task, first explain the dependency relationship and record the unclosed items in `STATUS.md`, the current task document, or an audit report. Do not describe a local compatibility path as a completed migration.

Before implementation or audit, you must list the logical closure boundary for the work: authoritative data sources, all read paths, all write paths, derived caches/indexes, user-visible entry points, delete/archive/restore paths, migration/rollback paths, test fixtures, and acceptance records. Before completion, prove item by item through search, tests, or manual verification that these boundaries have been handled. Do not use only test counts, a successful build, or a no-op path as completion proof.

Test failures must first be treated as evidence of inconsistency between implementation, specifications, fixtures, or acceptance records. Do not prioritize changing test code just to make the result green. Before handling a failing test, first verify: the authoritative specification and acceptance ID for the failing path, whether the original implementation or the current change violates the specification, whether the test fixture still represents a valid scenario, and whether the assertion is obsolete because of an explicit product decision. You may modify tests only after proving that the test conflicts with the authoritative specification, the fixture has been deprecated by specification, or the test itself is constructed incorrectly. Test modifications must record the reason and add enough implementation verification to prove the new behavior. Do not obtain a pass by deleting assertions, reducing coverage, changing snapshots, bypassing the failing path, or rewriting a real defect as a test problem.

Audit tasks must list every defect and overstatement found inside the target scope, not only the easiest item to fix. If an acceptance record, status document, or ADR claims more than the implementation actually provides, the documentation overstatement itself must be listed as an issue.

## Implementation Constraints

- Starting with NS-410, authoritative work data must be structured JSON files inside the project directory. Markdown/Word may be used only as import, export, mirror, and migration boundary formats. The index database, cache, localStorage, and editor runtime JSON must not become the only copy.
- AI, bulk replacement, Word import, and similar writes must go through a Proposal or an explicit user action.
- All file writes must use same-directory temporary files, validation/checksum, and atomic replacement.
- Do not log API keys, complete private manuscript text, or unredacted request headers.
- Do not add telemetry, accounts, remote listeners, or automatic cloud fallback.
- New dependencies must document their purpose and license; prefer permissive licenses.
- When changing a data format or database structure, add an ADR, migration, and rollback tests.
- Unless the user explicitly says otherwise, no fix may reduce, hide, bypass, or downgrade existing functionality. If a fix must temporarily disable or replace a capability, first record the impact scope and request user confirmation.
- Do not remove core product constraints such as Proposals, evidence, permissions, story time, or character knowledge on the grounds of "simplifying first".
- Product scope changes must update the product specification, requirements traceability, ADRs, tasks, and acceptance records in sync. Do not change only code.
- UI changes must also check whether Chinese copy reads naturally, whether Chinese and English are mixed, and whether translations sound unnatural. Do not move data field names directly into the user interface.

## Before Completing A Task

1. Run the tests required by the task and record the actual commands and results.
2. Update `STATUS.md`, `TASKS.md`, `HANDOFF.md`, and necessary `CHANGELOG.md`.
3. Ensure the worktree contains only task-related changes.
4. Commit format: `NS-### type(scope): summary`.

Completion declarations must also satisfy the following:

- Run adversarial tests proportionate to the task risk for damaged input, omitted members, duplicate IDs, stale versions, and mid-operation failures.
- The implementer must re-check each item in "specification invariant -> test -> actual result". Do not use the total number of tests as a substitute for coverage proof.
- Worktree status, branch, commit, dirty files, and test counts must be recorded according to actual commands. If the work is uncommitted or still has task-related dirty files, keep the status as "in progress".
- A no-op path cannot prove migration, recovery, or rollback success. Fixtures must truly enter the state that requires migration or failure handling.

`main` must always be buildable and have passing tests. Sequential handoff defaults to continuing the current milestone branch. Parallel work must first allocate module ownership.

## Documentation Cleanup Rules

- When organizing project records, update the existing entry documents by default: `STATUS.md`, `HANDOFF.md`, `TASKS.md`, `CHANGELOG.md`, the current `docs/tasks/NS-*.md`, and the current `docs/testing/NS-*_ACCEPTANCE.md`. Do not create extra documents for ordinary status records.
- `docs/design/**/backups/` contains historical baseline backups confirmed by the user and must be preserved by default. Unless the user explicitly names a backup directory or file that may be deleted, do not treat backups as obsolete documents to clean up.
- Deletable objects are limited to temporary validation records, failed intermediate screenshots, duplicate drafts, and clearly deprecated non-backup assets that have already been replaced by the current entry documents. Before deletion, first confirm that the object is not in an effective reference chain from the current task, acceptance record, or README.
- UI implementation records must distinguish "command verification passed" from "user visual acceptance passed". If user visual acceptance has not passed, do not write the stage as complete, and do not treat the current screenshot or implementation as the new baseline.
- New UI copy must be centralized in `uiText`, feature view models, or future i18n resources. Components must not continue hardcoding mixed-language copy.
