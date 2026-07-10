# Test Strategy

Tests prove specified behavior. They do not define product requirements and do not prove user visual acceptance.

## Evidence Layers

- Unit tests: schemas, pure domain rules, helpers, view models, Provider behavior, and storage primitives.
- Integration tests: repository transactions, server routes, persistence, conflicts, recovery, and Provider request boundaries.
- Browser/E2E tests: stable functional user journeys against isolated temporary libraries.
- Source/contract review: static boundaries that are not usefully exercised through a UI.
- Manual functional verification: hardware, OS, Provider, or recovery behavior that cannot be reliably automated.
- User visual acceptance: explicit user decision for layout, hierarchy, copy, and visual quality.

A screenshot, DOM measurement, build, test count, or Figma file does not substitute for user visual acceptance. Diagnostic visual inspection may support implementation but must not be recorded as the acceptance decision.

## Acceptance Mapping

Before implementation, every active-task acceptance ID must map to one of:

1. An existing test file and exact test name.
2. A planned test file and named scenario.
3. A named manual verification with actor, environment, and expected result.

“Covered by tests” is not an acceptable evidence locator. Each acceptance ID should express one independently decidable invariant; split IDs that require unrelated proof paths.

## Risk-Proportionate Adversarial Coverage

Where applicable, cover damaged input, missing members, duplicate IDs, stale revisions, invalid references, permission denial, cancellation, partial/mid-operation failure, restart recovery, and rollback. Migration/recovery fixtures must actually enter the legacy or failed state; a no-op path is not evidence.

## Run Ledger

The active acceptance record owns command evidence. Each verification run records:

- Date and commit/worktree state.
- Exact command.
- Exit result and relevant test counts.
- Initial failure and correction when the failure affected the task reasoning.
- Manual or user-owned gates that remain pending.

Do not copy the same command transcript into STATUS, HANDOFF, TASKS, CHANGELOG, product specs, or architecture documents.

## Browser Process

Use isolated test libraries and clean up temporary services. Functional browser automation may verify real controls and data flow. Follow `BROWSER_ACCEPTANCE.md` for process details and the active task for its specific browser scope.

Do not create a new acceptance or browser-notes file for each failed exploration. Keep durable evidence in the active acceptance record.
