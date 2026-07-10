# Task Documents

Task files turn authoritative product and architecture requirements into one implementable, verifiable `NS-###` task. The first digit follows the milestone: M3 uses NS-3xx, M4 uses NS-4xx, and M5 uses NS-5xx. Do not create a parallel task-ID namespace for documentation or governance work inside a milestone.

## Reading Rule

Resolve the active task from `../../STATUS.md` and `../../TASKS.md`. Read that task, its acceptance record, and only the product/architecture/design/history documents named by the task.

Milestone files such as `M3.md`, `M4.md`, and `M5.md` organize work but are not active commit identities. Historical tasks are not part of the default reading path.

## Required Task Shape

New tasks start from `TEMPLATE.md` and contain:

- Stable task ID, normalized status, owner, and acceptance link.
- Objective, in-scope and out-of-scope boundaries.
- Required reading routed by task type.
- Proportionate logical closure boundary.
- Material decisions and unresolved product questions.
- Atomic acceptance IDs mapped before implementation.
- Completion criteria without command transcripts.

Implementation evidence and command results belong in the matching acceptance record, not the task narrative.

## Rule

Do not create task documents for routine notes, exploratory logs, or status copies. Add a task only for a real scoped work item. Update `../../TASKS.md` only when its top-level status changes.
