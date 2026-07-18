# Current Status

Updated: 2026-07-18
Authority: current operational state only

## Project Mainline

- Active milestone: `M5 Workshop, Proposal, And Review`.
- Active task: `NS-514 / M5.8 Reference UI Rebuild` (`in_progress`).
- Task record: `docs/tasks/NS-514.md`.
- Acceptance record: `docs/testing/NS-514_ACCEPTANCE.md`.
- Last reached mainline task: `NS-510 / M5.6E Workshop Capability And Boundary Cleanup` at `8e7dc76`.
- Next mainline task: `NS-514 / M5.8 Reference UI Rebuild`.
- Deferred earlier mainline tasks: `NS-511-NS-513` remain unfinished by explicit user direction; no task is skipped, renumbered, or implied complete.
- Open earlier gates: NS-503/M5.3, NS-504/M5.4, and NS-505/M5.5 retain explicit user visual-acceptance work; their command/function evidence is not a visual pass.
- Mainline state: NS-514 follows the existing reference-rebuild plan and remains in progress. P0 through P5, Write A17-A21, Codex A22-A28, and Workshop A29-A35 retain their recorded evidence. Commits `d532e79` and `1f01082` retain their Settings and isolated context-chain evidence. A38 now passes: Workshop first reads each message's Series and session routing identity, then fully validates only messages owned by the requested session. A routeable legacy `codex-creation` message in `Scene continuity pass` no longer disables the separate `New chat`; storage, isolated real-Chrome, and normal-library coordinate-click checks all pass without rewriting authority. A13 remains open because the shared `New Series` dialog still returns fixture-only success; P7 evidence closure and final author visual acceptance remain open.

## Active Support Work

- Active task: none.
- Last completed support task: `GOV-001 Documentation Governance And Delivery Skeleton`.
- Task record: `docs/tasks/GOV-001.md`.
- Acceptance record: `docs/testing/GOV-001_ACCEPTANCE.md`.
- Next action: present the corrected Workshop interaction for author audit while keeping A16 open. Do not change the separate shared `New Series` fixture without an approved disposition.

## Repository State

- Branch: `codex/ns-410-json-authority`.
- Rewritten pre-GOV-001 mainline tip: `6fbabac NS-506 fix(workshop): close tool execution lifecycle gaps`.
- Numbering-repair verification tip before closure: `578a74a GOV-001 docs(governance): separate support work from product mainline`.
- Local recovery ref: `backup/gov-001-before-numbering-rewrite-20260710` preserves the original pre-rewrite history; the rewritten and backup tips have identical tree `deae3c9fae1f797239b975c464106126df530765`.
- NS-514 repair commits: `d532e79 NS-514 fix(settings): restore real model connections` and `1f01082 NS-514 fix(workshop): restore zero-model chat flow`.
- Unrelated worktree items preserved outside NS-514: existing `HANDOFF.md` and `docs/testing/NS-507_ACCEPTANCE.md` edits, `docs/design/ui-redesign/` deletions and README edit, and untracked `.hermes/plans/` and `.playwright-cli/`. The explicitly named `docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html` remains tracked and unchanged by this repair.
- The unpublished range contains 29 rewritten commits including the first GOV-001 commit; no remote history was rewritten.

## Current Product And Implementation Boundary

- Project authority is schema-versioned JSON; Markdown and Word are boundary formats, and indexes/caches are rebuildable.
- ADR-0015 governs the implemented Relation v1-to-v2 migration: v2 removes `type` without preserving or merging it, writes an exact v1 rollback artifact, rejects damaged or duplicate authority, and permits permanent Delete only when Progression, Character Knowledge, and Proposal references are absent.
- NS-410 is command-verified. Its completed task and acceptance records remain historical evidence, not the active work item.
- Project Recovery is the accepted baseline for the current UI/application stage, not proof of M5 completion.
- M5.1 through M5.6E have command/function evidence. Versioned Prompt customization, Tool Plans/Grants, broader tool coverage, Council, and final user visual acceptance remain unfinished.
- User visual acceptance is distinct from command/function verification. Diagnostic visual inspection cannot be reported as user acceptance.

## Confirmed Product Decision

- The canonical author-facing hierarchy is always English and ordered `Series → Volume → Chapter → Act → Scene`.
- The existing internal compatibility mapping is `Series → series`, `Volume → book`, `Chapter → act`, `Act → chapter`, and `Scene → scene` until a separately approved schema migration removes it. Internal names must not appear as product labels.

## Known Risks

- Current limited Workshop Codex tools are atomic, stale/target-bound, and connected to durable Agent continuation; Tool Plans/Grants, broader tools, and Proposal fallback remain unfinished.
- Workshop call and lifecycle mutual exclusion is local to one server process. Restart reconciliation marks unfinished work without replay, but durable cross-process wake/join, cross-process cancellation, and unknown-side-effect recovery remain open architecture work.
- Embedding profile Settings UI and model lifecycle controls remain deferred; NS-508 exposes the persisted binding/API and manual planner degradation without pretending that Settings UI exists.
- Some current non-Write surfaces still expose the legacy `act/chapter` interpretation; product-facing mapping closure belongs to the next scoped mainline UI/runtime task and must follow the canonical labels above.
- `packages/storage/src/index.ts` remains oversized and should be split only when a scoped task touches the relevant domain.
- First-start library selection, in-app service stop, tray behavior, full provider real-world validation, and broader UI visual acceptance remain incomplete.
