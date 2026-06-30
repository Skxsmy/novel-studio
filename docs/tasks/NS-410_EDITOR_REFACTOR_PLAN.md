# NS-410 Write Editor Refactor Plan

Status: implemented and command-verified for the current code; user visual acceptance remains separate  
Date: 2026-06-29  
Scope: Write manuscript editor UX and its integration with existing JSON authority, repaired Slice 8 progression commands, and Slice 9 Codex progression visibility  
Owner: current NS-410 implementation slice

## Purpose

The Write workspace must feel like a continuous authoring surface, not like a form made of visible database rows. The current JSON authority work is directionally correct, but the author-facing editor has exposed the storage model too directly. A good text editor should let the user write, revise, select, paste, undo, and move through a scene in one coherent manuscript flow while the application preserves structured JSON behind the scenes.

This plan replaces the visible block-row writing experience with a mature rich-text editing layer backed by the existing `SceneBlockDocument` JSON authority. It does not replace the repaired Slice 8 storage/API work or the Slice 9 Codex Progressions tab. Those are now baseline behavior that the editor refactor must preserve.

## Implementation Update 2026-06-29

This plan is now implemented as a user-directed NS-410 editor refactor follow-up after Slice 9 and before Slice 10.

Implemented:

- Added Tiptap as a runtime editor integration layer: `@tiptap/core`, `@tiptap/react`, and `@tiptap/starter-kit` at `^3.27.1`.
- Verified installed package metadata for those Tiptap packages lists the MIT license.
- Added `apps/web/src/features/write/editor/` with a reversible `SceneBlockDocument` to Tiptap JSON adapter, schema extensions, selection helpers, and a continuous `NovelEditor`.
- Added `apps/web/src/features/write/story-change/` with Codex progression view-model helpers.
- Replaced the author-facing Write scene body with a continuous manuscript editor. The old repeated card/textarea row UI is no longer rendered.
- Preserved paragraph insertion, paragraph deletion, Focus mode, Scene Brief hiding/restoring, Codex progression creation/edit/delete/collapse, and Codex Progressions tab regressions. Heading/quote/scene-break nodes remain adapter compatibility, not visible current-text conversion controls.
- Current product decision after user visual review: Codex progression editing happens only in a resizable inline manuscript component; Scene Brief must not duplicate current-scene progressions or show a read-only progression overview.
- Write scene edits, inline Codex progression edits, and Codex entry edits autosave. Normal editor Save buttons and normal save-status noise are removed; failure/conflict feedback remains.
- Removed the floating formatting panel and destructive current-text type selector after user visual review showed it was still behaving like a form panel and could erase active prose by converting it to a scene break.
- Kept `SceneBlockDocument` as the saved authority. Tiptap JSON remains runtime state only and is converted back to the authority document before saving.

Not yet claimed:

- User visual acceptance is not claimed by automated checks.
- Slice 10 remaining JSON authority migration is still separate work.
- Codex Canon/Details CodeMirror surfaces remain out of scope for this Write editor refactor.

## Current Project Baseline

The plan assumes the following current state from `STATUS.md`, `docs/tasks/NS-410.md`, and `docs/testing/NS-410_ACCEPTANCE.md`:

- Scene manuscripts are already JSON-authoritative through `SceneBlockDocument`.
- Write scene content no longer depends on CodeMirror or `EditorSurface`; ordinary scene blocks are rendered through the native Write workspace.
- Slice 8 has repaired the earlier Write progression defects with scene-level atomic progression-block create/delete commands, dirty-draft-safe deletion, and previous-scene effective-state projection.
- Progression records use unified JSON authority under `codex/progressions/<id>.json`.
- Slice 9 has completed the Codex `Progressions` tab for baseline, effective-at-scene state, scene selection, field history, hidden-future behavior, and author-safe labels without exposing progression IDs or revisions.
- Slice 9 is command-verified, but user visual acceptance is still separate.
- Codex Details and Canon description fields may still use the shared CodeMirror-based `EditorSurface`; replacing those surfaces is outside this Write editor refactor unless a later slice explicitly scopes it.

## Product Decision

Use Tiptap as the editor integration layer, backed by ProseMirror document semantics.

Primary references:

- Tiptap React editor installation and integration: https://tiptap.dev/docs/editor/getting-started/install/react
- Tiptap JSON content model: https://tiptap.dev/docs/editor/core-concepts/schema
- Tiptap keyboard shortcuts and extension model: https://tiptap.dev/docs/editor/core-concepts/keyboard-shortcuts
- Tiptap persistence guidance: https://tiptap.dev/docs/guides/output-json-html
- ProseMirror schema and document model: https://prosemirror.net/docs/guide/#schema

The application should not expose ProseMirror or Tiptap as the product model. They are implementation tools used to provide mature editing behavior. `SceneBlockDocument` remains the authoritative project-file format.

## Why This Is The Right Fit

Tiptap is a practical choice because it provides the authoring behavior expected from a real text editor while still allowing the project to keep a structured JSON authority layer.

Expected gains:

- Continuous writing instead of one textarea per block.
- Mature selection, paste, undo, redo, keyboard handling, and composition behavior.
- Structured nodes for paragraphs, headings, separators, notes, and Codex progression blocks.
- JSON output that can be mapped deterministically to `SceneBlockDocument`.
- Extension points for scene-specific controls without showing raw engineering fields.
- A path to future comments, inline annotations, review marks, and import/export mapping.

Plain textareas or custom `contenteditable` code should not be used for the main manuscript surface. They would recreate editor problems that ProseMirror already solves.

## Current Problems To Fix

The remaining problem is primarily an editor UX and information-architecture problem, not a JSON authority problem.

The current Write UI still exposes the manuscript as discrete editable blocks with visible block numbers, type selectors, and row-level controls. That makes the author feel like they are editing a database record list rather than a scene. The result is visually and behaviorally far from Word-like authoring and far from the earlier YAML/Markdown authoring feel.

The refactor must fix these problems:

- The primary scene surface must look and behave like a continuous document.
- Paragraphs and structural elements must be edited inline, not through a repeated form layout.
- Block identity must remain internal; normal writing must not show block IDs, source hashes, revisions, or implementation names.
- Codex progression operations must be available without dominating the manuscript surface.
- Adding, deleting, and reordering text must feel like document editing first and JSON mutation second.
- Autosave and dirty-state behavior must remain clear without turning the editor into a task dashboard.
- Existing repaired behavior from Slice 8 must not regress.
- Existing read-only visibility from Slice 9 must not regress.

## Non-Goals

This refactor must stay focused.

Do not rebuild these already-completed foundations:

- JSON-authoritative scene manuscript storage.
- Unified Progression JSON storage.
- Slice 8 scene-level progression-block create/delete API.
- Slice 8 dirty-draft-safe deletion behavior.
- Slice 8 previous-scene effective-state projection semantics.
- Slice 9 Codex Progressions tab.
- Slice 9 effective-at-scene read model.

Do not expand this plan into these later areas unless explicitly assigned:

- Broad Slice 10 YAML/Markdown cleanup.
- Codex Canon and Details editor replacement.
- Proposal workflow redesign.
- Word import/export redesign.
- Multi-user collaboration.
- Cloud sync, telemetry, accounts, or remote fallback.

## Dependency And License Decision

Recommended dependencies:

- `@tiptap/core` `^3.27.1`
- `@tiptap/react` `^3.27.1`
- `@tiptap/starter-kit` `^3.27.1`
- Optional only if needed: small Tiptap extensions for placeholder, link, typography, or history customization.

The installed Tiptap package metadata for `@tiptap/core`, `@tiptap/react`, and `@tiptap/starter-kit` lists the MIT license. ProseMirror packages are MIT licensed. The implementation slice records the exact package names and semver ranges here before merging.

No dependency should be added merely to restyle the page. The dependency is justified only for mature editor behavior and structured document mapping.

## Architecture

The editor should be introduced as a feature-level Write component, not as a global app primitive.

Proposed structure:

```text
apps/web/src/features/write/
  WriteWorkspace.tsx
  writeViewModel.ts
  editor/
    NovelEditor.tsx
    novelEditorSchema.ts
    sceneBlockMapping.ts
    storyChangeAnchors.ts
    CodexProgressionNodeView.tsx
    editorSelection.ts
    editorStyles.css
  story-change/
    storyChangeViewModel.ts
```

Roles:

- `WriteWorkspace.tsx` remains the scene-level page composer and API coordinator.
- `NovelEditor.tsx` owns the continuous manuscript editing surface.
- `sceneBlockMapping.ts` converts between `SceneBlockDocument` and Tiptap JSON.
- `CodexProgressionNodeView.tsx` renders the resizable inline manuscript Codex progression component.
- `storyChangeAnchors.ts` maps progression-backed blocks to the Codex progression editor node.
- `writeViewModel.ts` and `storyChangeViewModel.ts` centralize user-facing labels and prevent mixed hard-coded UI text.

If Codex and Write need shared progression labels after Slice 9, add a narrow shared helper only for labels or formatting. Do not couple the Write editor to `CodexWorkspace.tsx`.

## Document Model Mapping

`SceneBlockDocument` remains the saved authority. Tiptap JSON is runtime editor state.

Initial mapping:

| Scene Block Type | Editor Representation | Author-Facing Behavior |
| --- | --- | --- |
| Paragraph | Paragraph node | Normal manuscript prose |
| Heading or scene marker | Legacy heading node mapping | Compatibility only unless a later product decision gives intra-scene headings a role |
| Separator | Legacy horizontal rule mapping | Compatibility only; not exposed as a current-text conversion control |
| Note or planning block, if present | Distinct inline/block node only when product-approved | Not shown as raw metadata |
| Codex progression block | Resizable inline manuscript component | Editable at its manuscript position without exposing IDs/revisions or duplicating state in Scene Brief |

The mapping must be deterministic and reversible. Unsupported legacy block types should round-trip safely and display as an unobtrusive recoverable block, not be dropped.

## Codex Progression UX

Codex progressions are product content, but they should not turn the manuscript into a database editor.

Required behavior after user visual review:

- Codex progression blocks appear inline at their manuscript position as an independent component.
- The inline component owns target entry/field/operation/summary/body editing, collapse/delete, and UI-only width/height resizing by dragging component edges.
- Scene Brief must not list current-scene Codex progressions or show a duplicated read-only selected overview.
- Add Codex progression is a compact command at the cursor/selected block.
- Delete Codex progression uses the existing repaired scene-level delete command and must preserve dirty draft content first.
- Effective-state review remains in the Codex Progressions tab and projection/API tests, not as a constant Write before/after panel.
- Labels remain author-facing and must use "Codex progression" where the inline component needs a label; do not expose progression IDs, revision names, hashes, or internal operation names.

The editor must use the existing scene-level progression-block APIs rather than recreating multi-file transaction logic in the browser.

## Slice 9 Integration

Slice 9 adds read-only Codex progression visibility. The Write editor refactor must fit that state.

Required preservation:

- The Codex `Progressions` tab must continue to show baseline, effective-at-scene values, and history from the existing progressions/effective APIs.
- Hidden future progressions must remain hidden until the selected scene permits them.
- Engineering identifiers must remain absent from the author workflow.
- Codex copy remains centralized in `codexViewModel.ts` or a deliberately shared label helper.
- The Codex `Progressions` tab must stay read-only unless a later product decision explicitly adds editing there.

Recommended integration:

- If the Codex Progressions tab shows a write-block-sourced history item, it may offer a navigation affordance to the corresponding Write editor anchor.
- If that navigation is implemented, tests must prove that the target anchor is located in the continuous editor and that the selected scene context is respected.
- If that navigation is not implemented in the first editor slice, the plan must record it as deferred rather than imply it exists.
- Write and Codex should share progression field labels where practical so that the same Codex progression is not described differently across workspaces.

## Implementation Phases

### Phase 0 - Current-State Lock

Before code changes, capture the current accepted baseline:

- Record that Slice 8 storage/API repairs are the baseline and must not be replaced.
- Record that Slice 9 Codex Progressions is read-only and command-verified but visually separate.
- Identify the exact current Write tests that cover save state, progression create/delete, absence of duplicated Write progression panels/previews, and Codex progressions.
- Map every affected acceptance ID to existing tests, proposed tests, or explicit manual visual verification.

No code should be written until this mapping exists.

### Phase 1 - Dependency And ADR

Add the editor dependency decision in the task documentation or an ADR:

- Tiptap and ProseMirror package names.
- Version numbers.
- MIT license note.
- Reason for choosing Tiptap over custom `contenteditable`, textarea-only editing, or keeping the current block form UI.
- Rollback plan: remove the Tiptap editor adapter and return to existing `SceneBlockDocument` rendering without changing saved JSON.

### Phase 2 - Adapter Layer

Build `sceneBlockMapping.ts` first.

Required behavior:

- Convert existing `SceneBlockDocument` fixtures into Tiptap JSON.
- Convert Tiptap JSON back into stable `SceneBlockDocument` JSON.
- Preserve block identity internally where needed for progression anchors.
- Preserve unknown or unsupported blocks without data loss.
- Reject invalid editor output with clear recoverable errors.

Tests must run before UI replacement. This prevents the editor dependency from becoming the authority layer.

### Phase 3 - Continuous Manuscript Editor

Introduce `NovelEditor.tsx` behind the existing Write workspace data flow.

Required behavior:

- The main scene body renders as one continuous editor.
- Paragraph editing, Enter, Backspace, paste, undo, redo, and selection behave like a mature document editor.
- Autosave uses the existing Write save path.
- Dirty state remains accurate when the user edits prose.
- The UI does not show block numbers, block type selectors, or row-level database controls during normal writing.

This phase should keep Codex progression editing temporarily functional through the existing commands while the inline component UI is finished.

### Phase 4 - Codex Progression Inline Components

Move Codex progression editing out of the block-row layout and into the new manuscript model.

Required behavior:

- Create Codex progression at cursor through the existing scene-level create command.
- Render Codex progressions as independent inline manuscript components.
- Let the user edit target entry/field/operation/summary/body inside the inline component.
- Let the user resize the inline component by dragging its edges; component size is UI-only and not persisted to authority.
- Scene Brief does not duplicate Codex progression state.
- Autosave updates through the existing repaired scene-level/Progression APIs.
- Delete through the existing repaired scene-level APIs.
- Preserve dirty-draft-safe deletion.
- Preserve effective-state behavior through the existing projection/API and Codex Progressions regressions.
- Preserve author-safe labels and avoid internal IDs.

### Phase 5 - Slice 9 Codex Regression Integration

Verify the new editor does not break Codex progression visibility.

Required behavior:

- A Codex progression created from the new editor appears in the Codex `Progressions` tab history through the existing API path.
- Effective-at-scene values match the existing Slice 9 projection behavior.
- Hidden future items remain hidden.
- Codex continues to render only the active tab content.
- No duplicate hidden Progressions panels or Write-side progression overviews reappear in DOM queries.

Optional behavior:

- Add a Codex-to-Write anchor navigation command if it can be implemented cleanly without expanding the slice.

### Phase 6 - Remove Old Block-Form UI

After the continuous editor and Codex progression inline components are covered, remove the obsolete author-facing block-row editor UI from Write.

Required cleanup:

- Remove visible block number controls from the writing surface.
- Remove paragraph type dropdowns from ordinary prose editing.
- Remove row-level add/delete controls from normal manuscript paragraphs.
- Keep only author-facing insert, Codex progression, and document controls.
- Update tests that asserted the old block UI to assert author behavior instead.

Do not delete server commands, storage code, or acceptance coverage that still proves JSON authority.

### Phase 7 - Visual Acceptance

Command tests are not enough for this task. The previous UI failed because it was technically functional but visually wrong.

Manual visual acceptance must check:

- The first viewport looks like a writing editor, not a record editor.
- Scene title and body hierarchy are clear.
- The editor can support long-form writing without visible block chrome.
- Codex progression controls are discoverable without taking over the manuscript.
- English UI copy is consistent.
- No engineering identifiers appear in the author workflow.
- Mobile and desktop layouts do not overlap or force text out of controls.

Do not mark visual acceptance passed until the user explicitly accepts the result or an agreed screenshot baseline is approved.

### Phase 8 - Regression Before Slice 10

Before moving into later cleanup or migration slices, run a full regression over the NS-410 paths affected by the editor:

- scene manuscript load/save
- dirty save
- Codex progression create/edit/delete
- effective-at-scene projection
- Codex Progressions read-only tab
- effective-at-scene calculation
- hidden-future progression behavior
- import/export or mirror paths if the slice touches them

## Acceptance Mapping

At minimum, the implementation slice must map these NS-410 acceptance areas:

- `A1` JSON project authority remains the saved source of truth.
- `A2` Markdown/Word remain import/export or mirror boundaries only.
- `A3` writes use validated atomic project-file replacement.
- `A4` no editor runtime JSON, cache, index, or localStorage copy becomes the only source.
- `A8` Write can edit and persist scene manuscripts through JSON authority.
- `A11` UI does not expose engineering-only identifiers in author workflows.
- `A12` user-visible copy is centralized and not mixed hard-coded language.
- `A13` existing story timeline/progression semantics are preserved.
- `A15` Codex Progressions read-only effective/history display remains correct after the editor refactor.

Any acceptance ID touched by the implementation must be explicitly mapped before coding.

## Test Strategy

Unit tests:

- `SceneBlockDocument` to Tiptap JSON conversion.
- Tiptap JSON to `SceneBlockDocument` conversion.
- Round-trip stability for paragraphs, separators, headings, and Codex progression blocks.
- Unsupported block preservation.
- Codex progression block lookup by block ID.

Component tests:

- Write editor renders as one continuous surface.
- Editing prose marks the scene dirty and saves through the existing save path.
- Paragraph creation and deletion produce correct `SceneBlockDocument` output.
- Codex progression create uses the existing scene-level API.
- Codex progression delete saves dirty draft content before deletion.
- Codex progression edits autosave without a normal Save button.
- Effective-state behavior remains correct through Codex Progressions and projection/API tests.
- UI does not render block numbers, block type dropdowns, or raw IDs in the main writing surface.

Codex regression tests:

- Codex Progressions tab still renders baseline/history/effective values.
- Hidden future progressions remain hidden.
- Duplicate hidden Progressions content is not rendered.
- Codex progressions created through Write appear in Codex history through the existing API.
- Optional navigation from Codex to Write anchor works if implemented.

End-to-end or integration tests:

- Open project, select work, open Write, edit prose, save, reload, verify JSON authority.
- Add Codex progression, verify autosave, view Codex Progressions, verify field history and effective-at-scene value.
- Delete Codex progression with dirty prose present, verify prose is not lost and progression is removed atomically.

Manual visual checks:

- Desktop screenshot.
- Narrow viewport screenshot.
- Long scene editing behavior.
- Inline Codex progression resized/collapsed states, with no duplicated Scene Brief progression list.

## Required Commands

The implementation slice should run the project-required commands, adjusted for touched packages:

```powershell
npm.cmd run build -w @novel-studio/contracts
npm.cmd run test
npm.cmd run build
```

Also run targeted web tests for the Write workspace and Codex Progressions tab when available.

The final task record must include exact commands, pass/fail results, branch, dirty files, and test counts. Failed tests must be investigated against product code first; test changes are acceptable only after the implementation behavior has been verified against the authoritative specification.

## Risks

Main risks:

- Treating Tiptap JSON as the new authority instead of a runtime document.
- Losing internal block identity needed for Codex progression blocks.
- Reintroducing multi-file progression writes in the browser instead of using the repaired scene-level APIs.
- Regressing dirty-draft-safe deletion.
- Regressing Slice 9 hidden-future Codex behavior.
- Recreating the old block editor visually inside Tiptap nodes.
- Over-coupling Write editor state to Codex workspace state.

Mitigations:

- Keep mapping tests independent from UI.
- Keep `SceneBlockDocument` as the only saved manuscript authority.
- Use existing API functions for progression-block create/delete.
- Run Codex Progressions regressions in the editor refactor slice.
- Require user visual acceptance before declaring the UI repair complete.

## Definition Of Done

This refactor is done only when:

- The Write scene body is a continuous editor suitable for long-form prose.
- Existing JSON authority files remain the saved source of truth.
- Codex progression creation, editing, and deletion work through the repaired Slice 8 paths; effective-state review remains in Codex Progressions/projection tests.
- Slice 9 Codex Progressions behavior still passes regression checks.
- The main author workflow does not expose block IDs, revisions, hashes, or internal operation names.
- Tests cover the adapter, Write behavior, Codex progression behavior, and Codex progression regressions.
- Visual acceptance is explicitly recorded as passed by the user or an approved screenshot baseline.
- `STATUS.md`, `TASKS.md`, `HANDOFF.md`, `CHANGELOG.md`, task docs, and acceptance records are updated truthfully.

Until visual acceptance is passed, this should remain "implementation in progress" even if automated tests pass.
