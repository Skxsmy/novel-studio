# TASK-ID Task Title

Status: todo
Created: YYYY-MM-DD
Owner: unassigned
Acceptance: `docs/testing/TASK-ID_ACCEPTANCE.md`

## Objective

State the independently verifiable product or architecture outcome.

## Required Reading

- Name only the product sections, domain specs, architecture documents, ADRs, design records, or historical tasks required by this work.

## In Scope

- List the complete logical unit.

## Out Of Scope

- List adjacent behavior that must not be implied or changed.

## Logical Closure Boundary

| Boundary | Handling |
| --- | --- |
| Authoritative data | Applicable source of truth |
| Read paths | Applicable readers/queries |
| Write paths | Applicable commands/writers |
| Derived state | Applicable indexes/caches or `not applicable` |
| User entry points | Applicable API/UI/import paths or `not applicable` |
| Lifecycle | Applicable archive/delete/restore behavior or `not applicable` |
| Migration/rollback | Required plan or `not applicable` with reason |
| Fixtures | Required normal/adversarial fixtures |
| Acceptance | Matching acceptance record |

## Decisions And Open Questions

- Record material decisions. Leave unresolved product questions explicit and ask the user before implementation.

## Acceptance IDs

| ID | Atomic requirement | Planned exact proof |
| --- | --- | --- |
| TASK-ID-A01 | One independently decidable invariant | Test file and test name, planned test, or named manual verification |

## Completion Criteria

- Every acceptance ID has actual evidence.
- Required focused and regression checks pass.
- Documentation owners are updated only when their facts changed.
- Branch, commit, worktree, dirty files, and actual commands are recorded in the acceptance record.
