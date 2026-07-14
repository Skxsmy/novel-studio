# Current Status

Updated: 2026-07-14
Authority: current operational state only

## Project Mainline

- Active milestone: `M5 Workshop, Proposal, And Review`.
- Active task: `NS-510 / M5.6E Workshop Capability And Boundary Cleanup`.
- Last reached mainline task: `NS-509 / M5.6D Durable Agent Runner` at `5929532`.
- Next mainline task: `NS-510 / M5.6E Workshop Capability And Boundary Cleanup`.
- Following mainline task: `NS-511 / M5.6F Versioned Workshop Prompt Customization`.
- Open earlier gates: NS-503/M5.3, NS-504/M5.4, and NS-505/M5.5 retain explicit user visual-acceptance work; their command/function evidence is not a visual pass.
- Mainline state: NS-509 is complete at `5929532`; NS-510 is in progress. A01-A10 are implemented and command-verified; closure checks and scoped commits remain.

## Active Support Work

- Active task: none.
- Last completed support task: `GOV-001 Documentation Governance And Delivery Skeleton`.
- Task record: `docs/tasks/GOV-001.md`.
- Acceptance record: `docs/testing/GOV-001_ACCEPTANCE.md`.
- Next action: run NS-510 closure checks, commit the scoped implementation, then record and commit closure evidence without unrelated worktree changes.

## Repository State

- Branch: `codex/ns-410-json-authority`.
- Rewritten pre-GOV-001 mainline tip: `6fbabac NS-506 fix(workshop): close tool execution lifecycle gaps`.
- Numbering-repair verification tip before closure: `578a74a GOV-001 docs(governance): separate support work from product mainline`.
- Local recovery ref: `backup/gov-001-before-numbering-rewrite-20260710` preserves the original pre-rewrite history; the rewritten and backup tips have identical tree `deae3c9fae1f797239b975c464106126df530765`.
- Unrelated worktree items preserved outside NS-510: existing `HANDOFF.md` and `docs/testing/NS-507_ACCEPTANCE.md` edits, `docs/design/ui-redesign/` deletions and README edit, and untracked `.hermes/plans/`. The explicitly named `docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html` belongs to the final NS-510 task commit.
- The unpublished range contains 29 rewritten commits including the first GOV-001 commit; no remote history was rewritten.

## Current Product And Implementation Boundary

- Project authority is schema-versioned JSON; Markdown and Word are boundary formats, and indexes/caches are rebuildable.
- NS-410 is command-verified. Its completed task and acceptance records remain historical evidence, not the active work item.
- Project Recovery is the accepted baseline for the current UI/application stage, not proof of M5 completion.
- M5.1 through M5.6D have command/function evidence. Prompt authority, Tool Plans/Grants, broader tool coverage, Council, and final user visual acceptance remain unfinished.
- User visual acceptance is distinct from command/function verification. Diagnostic visual inspection cannot be reported as user acceptance.

## Confirmed Product Decision

- The canonical author-facing hierarchy is always English and ordered `Series → Volume → Chapter → Act → Scene`.
- The existing internal compatibility mapping is `Series → series`, `Volume → book`, `Chapter → act`, `Act → chapter`, and `Scene → scene` until a separately approved schema migration removes it. Internal names must not appear as product labels.

## Known Risks

- Current limited Workshop Codex tools are atomic, stale/target-bound, and connected to durable Agent continuation; Tool Plans/Grants, broader tools, and Proposal fallback remain unfinished.
- `WorkshopAgentCoordinator` currently serializes work per session only within one server process. Durable wake/join, cancellation propagation, startup recovery, and unknown-side-effect recovery remain open architecture work and are not claimed by A01-A03.
- Embedding profile Settings UI and model lifecycle controls remain deferred; NS-508 exposes the persisted binding/API and manual planner degradation without pretending that Settings UI exists.
- Some current non-Write surfaces still expose the legacy `act/chapter` interpretation; product-facing mapping closure belongs to the next scoped mainline UI/runtime task and must follow the canonical labels above.
- `packages/storage/src/index.ts` remains oversized and should be split only when a scoped task touches the relevant domain.
- First-start library selection, in-app service stop, tray behavior, full provider real-world validation, and broader UI visual acceptance remain incomplete.
