# NS-514 Codex UI Function Comparison

Status: P5 detailed comparison; approved Codex P6 dispositions implemented with automated evidence; author visual review pending
Surface: Codex
Binding node: `#codex-workspace`
New component: `apps/web/src/features/codex/ReferenceCodexWorkspace.tsx`
Old component: `apps/web/src/features/codex/CodexWorkspace.tsx`

## Scope And Interpretation

This document compares the binding-reference Codex UI with the real
pre-NS-514 Codex workflow, including the global Create Entry, Create Category,
and Detail Type dialogs owned by the Codex surface.

The primary Codex surface contains 58 controls. Its three dialogs contain 25
additional controls. Those counts remain the immutable P5 binding audit
baseline; the approved removals, redesigns, and real-data connections below are
P6 dispositions and do not rewrite that historical inventory.

## Binding And Entry Checklist

| Property | New Codex | Old Codex |
| --- | --- | --- |
| Entry | Appbar Codex; default visible workspace | Sidebar Codex |
| Return path | Appbar workspace controls | Sidebar workspace controls |
| Layout | Category rail, entry list, entry editor, tabs and global dialogs | Category rail, list, editor, lifecycle panels and managers |
| Primary data | Fixture categories, entries, relations, progressions and mentions | Real Codex JSON documents |
| Authority | None in replica | `api.codex.*` with base revisions/lifecycle guards |
| Story-position state | Fixture Baseline/Effective values | Real `getEffectiveEntry` and Progressions |

## Complete Function Matrix

| ID | Atomic function | New UI | Old UI | Existing callback/API | Comparison | Required P6 disposition |
| --- | --- | --- | --- | --- | --- | --- |
| CX-01 | Open Codex | Appbar Codex | Sidebar Codex | `App.showWorkspace("codex")` | both | Connect workspace state |
| CX-02 | Load categories | Fixture category rail | Real category documents | `api.codex.listCategories` | both | Replace fixtures |
| CX-03 | Select category | Category buttons and compact select | Real category selection | local old state | both | Bind to local filter state |
| CX-04 | All/standard categories | All, Characters, Locations, Objects, Lore, Organizations, Plot threads | Real built-in and custom categories | real category data | both | Render real counts, never fixture counts |
| CX-05 | Current Scene lens | Dedicated lens | No equivalent lens control | Can derive from mention data | new-only | Approved: remove this Story Lens; Current Scene belongs to the Baseline/Current Scene view switch instead |
| CX-06 | Changed-at-position lens | Dedicated lens | Effective/progression data without this lens | `getEffectiveEntry`; `listProgressions` | partial | Approved: remove this Story Lens; this does not define the separate `Changed` filter predicate |
| CX-07 | Needs-attention lens | Dedicated lens | No equivalent old filter | No matching production rule | new-only | Approved: remove this Story Lens |
| CX-08 | Search entries | Search input | Real search state | local filtering over entries | both | Use real entries |
| CX-09 | All/In Scene/Changed filters | Four filter controls including Watch | Old UI has show-archived/category/search and mention/effective data | mixed | partial | Approved: remove In Scene, Changed, and Watch; All is only the default complete-list state and requires no predicate |
| CX-10 | Show archived | No control | Real toggle | old local state | old-only | Approved redesign: Archived Entries is a real Entry category in the former Story Lens area |
| CX-11 | Load/select entry | Fixture entry rows | Real entry documents | `api.codex.listEntries`; `getEntry` | both | Replace fixtures and preserve dirty-selection handling |
| CX-12 | Create Entry | Two page buttons plus dialog | Real create action | `api.codex.createEntry` | both | Connect reference dialog with validation/errors |
| CX-13 | Create Category | Rail/compact actions plus dialog | Real create action | `api.codex.createCategory` | both | Connect reference dialog |
| CX-14 | Rename Category | No control | Real rename form | `api.codex.updateCategory` | old-only | Approved: Category title right-click/keyboard context menu |
| CX-15 | Delete Category | No control | Real delete confirmation | `api.codex.deleteCategory` / `OC-016` | old-only | Approved: Category title context menu with impact confirmation and real blockers |
| CX-16 | Edit Entry name/aliases/category | Reference editor fields | Real draft fields | `api.codex.updateEntry` | both | Bind to real draft and base revision |
| CX-17 | Edit Canon | Canon textarea | Real description editor | `api.codex.updateEntry` | both | Connect in place |
| CX-18 | Edit Research | Research textarea | Real research editor | `api.codex.updateEntry` | both | Connect in place |
| CX-19 | Save Entry | Save changes | Real save | `api.codex.updateEntry` | both | Preserve revision conflicts and errors |
| CX-20 | Reload Entry | No control | Real reload action | `api.codex.getEntry` | old-only | Approved: do not restore an explicit Reload control |
| CX-21 | More menu | Visible but disabled | Old lifecycle buttons are explicit | No complete reference menu | partial | Entry lifecycle does not use this button; keep it disabled until a separate non-lifecycle meaning is approved |
| CX-22 | Archive Entry | No usable control | Real archive | `api.codex.archiveEntry` / `OC-010` | old-only | Approved: active Entry right-click/keyboard context menu; use the real archive command |
| CX-23 | Restore Entry | No control | Real restore | `api.codex.restoreEntry` / `OC-027` | old-only | Approved: archived Entry right-click/keyboard context menu in Archived Entries |
| CX-24 | Delete Entry | No control | Real confirmation and delete | `api.codex.deleteEntry` / `OC-018` | old-only | Approved: active and archived Entry context menus with confirmed permanent Delete and real blockers |
| CX-25 | Baseline/Effective state | Two controls | Real effective-state view | `api.codex.getEffectiveEntry` / `OC-019` | both/partial | Approved: rename to Baseline/Current Scene; Baseline editable, Current Scene read-only Canon/Details at Write-selected Scene, Research remains Baseline, blue Canon hint removed |
| CX-26 | Canon/Research/Details/Relations/Progressions/Mentions tabs | Six tabs | Corresponding old panels | local tab state plus APIs | both | Keep reference tabs |
| CX-27 | Edit detail values | Reference Details content | Real detail rows | `api.codex.updateEntry` | both | Bind real detail schema/value state |
| CX-28 | Add/remove detail row | Add disabled; no Remove action | Real Add/Remove | old local draft behavior | partial | Approved redesign: append a row with Detail Type select, Value editor, and Save; after real save show the normal Send to AI switch; saved-row Delete uses its right-click/keyboard context menu with confirmation |
| CX-29 | Per-field AI/context policy | Five Send-to-AI toggles | Real detail context policy | `api.codex.updateEntry` | both | Preserve sensitive-field boundaries |
| CX-30 | Open Detail Type library | Two controls open a three-column Category, Detail Type list, and selected Detail Type editor dialog | Real manager | local manager state | both | Preserve the exact new-UI three-column structure; do not replace it with a two-column inline-create form |
| CX-31 | Load/select Detail Types | Fixture types/categories and usage presentation | Real detail-type documents and Entry usage | `api.codex.listDetailTypes` plus real Entries | both | Replace fixtures while retaining the original middle-list presentation: display name, real usage line, and real Sensitive tag only when applicable |
| CX-32 | Create Detail Type | Existing create control in the middle column | Real create | `api.codex.createDetailType` | both | Connect the existing control and use the right editor for the unsaved type |
| CX-33 | Update Detail Type description and NSFW state | Description and Sensitive controls in the selected editor | Real revision-protected update | `api.codex.updateDetailType` | both | Persist schema version 2 description and NSFW state; keep the unavailable type-level AI-default control visible and disabled |
| CX-33R | Rename Detail Type | Display name is visible in the selected editor | No complete prior Rename path | `api.codex.updateDetailType` | approved new lifecycle | Existing-type Display name remains read-only in the editor; the Detail Type row right-click/keyboard menu opens the sole Rename flow, which preserves the stable identifier and atomically converts legacy name-keyed Entry data |
| CX-34 | Delete Detail Type | Visible editor Delete button in the binding reference | Real deletion with impact handling | `api.codex.deleteDetailType` | both with approved placement change | Remove the duplicate editor button; Detail Type row right-click/keyboard context menu provides confirmed Delete with the existing in-use blocker |
| CX-35 | NSFW/sensitive flag | Sensitive checkbox | Old manager supports sensitive/NSFW state | detail-type update | both | Preserve exact privacy semantics through a real revision-protected update |
| CX-36 | Relations list | Relations tab and fixture count | Real relations | `api.codex.listRelations` / `OC-026` | partial | Replace fixtures |
| CX-37 | Create Relation | Add relation disabled | Real create form | `api.codex.createRelation` / `OC-015` | old capability, new disabled | Approved redesign: Add Relation opens From, To, and required Simple Description only; no `type` input |
| CX-38 | Archive/delete Relation | No control | Real archive action | `api.codex.archiveRelation` / `OC-011` | old-only | Approved redesign: Relation context menu has confirmed guarded hard Delete only; no Archive. Requires ADR-0015 schema/API/storage migration, not relabeling archive |
| CX-39 | Progressions list | Progressions tab and fixture count | Real Progressions | `api.codex.listProgressions` / `OC-025` | partial | Replace fixtures with story-position data |
| CX-40 | Update Progression | No direct editor on Codex reference tab | Real update through Write | `api.codex.updateProgression` / `OC-031` | partial | Preserve source Scene/block linkage |
| CX-41 | Mentions list | Mentions tab and fixture count | Real manuscript/Codex mentions | `api.codex.listEntryMentions` / `OC-024` | partial | Replace fixtures |
| CX-42 | Switch manuscript/Codex mention source | Manuscript mentions presentation exists; no Codex source control | Old UI has source tabs | old local state plus real mention data | old-only/partial | Approved: retain Manuscript mentions and add adjacent Codex mentions using real counts and content |
| CX-43 | Open in Write | Visible but disabled | Real callback | `CodexWorkspace.onOpenScene` / `OC-093` | old capability, new disabled | Approved: enable in place only when a real target resolves, otherwise remain semantically disabled |
| CX-44 | Open source Scene | Three visible disabled buttons | Real callback | `CodexWorkspace.onOpenScene` / `OC-093` | old capability, new disabled | Approved: enable in place only for a real Scene/block target and navigate to it |
| CX-45 | Canon inline Entry preview | No enabled inline Canon action | Old UI has mention preview behavior | `OC-094` plus editor mention behavior | old-only/partial | Approved redesign: clicking a highlighted Entry inside the Codex Canon page opens the manuscript-style popover. Baseline mode shows the referenced Entry's Baseline Canon summary; Current Scene mode shows its effective Canon summary at the Scene currently open in Write. This does not change the separate Mentions page |

## New UI Functions Missing From The Old UI

| Function family | Controls | Current truth |
| --- | --- | --- |
| Current Scene lens | `RC-208` | Approved for removal; Current Scene is the effective-state view, not a filter lens |
| Changed-at-position lens | `RC-209` | Approved for removal; does not authorize a `Changed` filter predicate |
| Needs-attention lens | `RC-210` | Approved for removal |
| Compact category selector | `RC-212` | Responsive presentation only |
| Watch filter | `RC-218` | Approved for removal because no product predicate exists |

## Old UI Functions Missing From The New UI

| Function family | Evidence | Impact |
| --- | --- | --- |
| Show archived | old local state | Approved replacement is a real Archived Entries category in the former Story Lens area |
| Rename/delete Category | `updateCategory`; `OC-016` | Approved for the Category title context menu |
| Reload Entry | `getEntry` | Explicit Reload is intentionally removed; normal recovery may refetch without a dedicated control |
| Archive/restore/delete Entry | `OC-010`, `OC-027`, `OC-018` | Approved for active/archived Entry context menus with confirmation |
| Add/remove detail rows | old draft behavior | Add is approved as an appended editable row; saved Detail Delete is approved for the row context menu |
| Delete Detail Type | `api.codex.deleteDetailType` | Approved for a confirmed, keyboard-reachable type-row context menu |
| Create/archive Relation | `OC-015`, `OC-011` | Create is redesigned without `type`; Archive is rejected and replaced by a real guarded hard-delete command under ADR-0015 |
| Mention-source switch | old local state | Approved: add Codex mentions beside the existing Manuscript mentions source |
| Enabled Open in Write/Open Scene | `OC-093` | Approved for real targets only |
| Mention preview | `OC-094` | Approved: preserve as inline Canon Description mention preview using the manuscript interaction pattern |

## Fixture, Authority, And Accessibility Audit

- All reference entries, categories, counts, relations, Progressions, Mentions,
  detail values and story positions are fixtures.
- Entry/category/detail-type/relation writes remain project JSON authority
  operations with base-revision and lifecycle guards.
- Effective state and Progressions must preserve story time and character
  knowledge; current-state data cannot leak into an earlier Scene.
- Sensitive/NSFW fields and context toggles must remain explicit.
- The unresolved More control must remain disabled. Add Relation, Open Scene,
  and Delete may look enabled only after their approved real commands and
  honest success/error states are connected.
- Create/edit dialogs require stable labels, focus containment, keyboard
  dismissal and nearby accessible validation errors.

## Recorded Author Decisions

1. Entry Archive/Delete and Restore/Delete use right-click menus with keyboard
   access and confirmed permanent deletion. Archived Entries replaces Story
   Lenses as a real category.
2. All three Story Lenses plus In Scene, Changed, and Watch are removed. All is
   only the default complete-list state and has no additional predicate.
3. Category Rename/Delete uses the Category title context menu. Explicit Entry
   Reload is removed.
4. Detail creation uses the approved appended row; saved Detail Delete uses its
   row context menu. The Detail Type Library retains the binding three-column
   Category/list/editor structure and persists the selected type's description.
   Detail Type Rename and Delete share the type-row context menu; Rename
   preserves the stable identifier and atomically converts legacy name-keyed
   Entry data, while Delete retains the real in-use blocker.
5. Relation creation uses From, To, and Simple Description only. Relation v2
   drops legacy `type` without preservation or merge; rollback restores exact
   pre-migration v1 documents. Relation has guarded permanent Delete and no
   author-facing Archive.
6. Baseline is editable. Current Scene follows Write and presents read-only
   effective Canon and Details; Research remains Baseline and the blue Canon
   hint is absent.
7. Open in Write and Open Scene are enabled only for real targets.
8. Mentions provides separate Manuscript and Codex sources. Canon Description
   mentions reuse the manuscript mention interaction. Inside the Codex Canon
   page, the highlighted Entry popover shows the referenced Baseline Canon in
   Baseline mode and its effective Canon at the Write-selected Scene in Current
   Scene mode. The separate Mentions page keeps its selected source and content.

## Decision Closure

No unresolved product decision remains inside the approved Codex scope recorded
in this comparison. New product questions must be raised explicitly rather than
reconstructed from old UI code.

This comparison did not authorize implementation by itself. The author gave
the explicit start direction on 2026-07-16; A22-A28 implementation and evidence
are now recorded in `docs/testing/NS-514_ACCEPTANCE.md`. A16 remains the separate
author visual gate.
