# NS-514 Codex UI Function Comparison

Status: P5 detailed comparison; author decisions pending
Surface: Codex
Binding node: `#codex-workspace`
New component: `apps/web/src/features/codex/ReferenceCodexWorkspace.tsx`
Old component: `apps/web/src/features/codex/CodexWorkspace.tsx`

## Scope And Interpretation

This document compares the binding-reference Codex UI with the real
pre-NS-514 Codex workflow, including the global Create Entry, Create Category,
and Detail Type dialogs owned by the Codex surface.

The primary Codex surface contains 58 controls. Its three dialogs contain 25
additional controls. Combined disposition: 23 proposed in-place connections,
56 local-only controls, and 4 disabled/deferred controls.

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
| CX-05 | Current Scene lens | Dedicated lens | No equivalent lens control | Can derive from mention data | new-only | Author must approve derived behavior |
| CX-06 | Changed-at-position lens | Dedicated lens | Effective/progression data without this lens | `getEffectiveEntry`; `listProgressions` | partial | Define exact real filter semantics before connection |
| CX-07 | Needs-attention lens | Dedicated lens | No equivalent old filter | No matching production rule | new-only | Keep local/disabled until rule is specified |
| CX-08 | Search entries | Search input | Real search state | local filtering over entries | both | Use real entries |
| CX-09 | All/In Scene/Changed filters | Four filter controls including Watch | Old UI has show-archived/category/search and mention/effective data | mixed | partial | Define In Scene/Changed/Watch predicates explicitly |
| CX-10 | Show archived | No control | Real toggle | old local state | old-only | Requires binding revision |
| CX-11 | Load/select entry | Fixture entry rows | Real entry documents | `api.codex.listEntries`; `getEntry` | both | Replace fixtures and preserve dirty-selection handling |
| CX-12 | Create Entry | Two page buttons plus dialog | Real create action | `api.codex.createEntry` | both | Connect reference dialog with validation/errors |
| CX-13 | Create Category | Rail/compact actions plus dialog | Real create action | `api.codex.createCategory` | both | Connect reference dialog |
| CX-14 | Rename Category | No control | Real rename form | `api.codex.updateCategory` | old-only | Requires binding revision |
| CX-15 | Delete Category | No control | Real delete confirmation | `api.codex.deleteCategory` / `OC-016` | old-only | Requires binding revision and impact confirmation |
| CX-16 | Edit Entry name/aliases/category | Reference editor fields | Real draft fields | `api.codex.updateEntry` | both | Bind to real draft and base revision |
| CX-17 | Edit Canon | Canon textarea | Real description editor | `api.codex.updateEntry` | both | Connect in place |
| CX-18 | Edit Research | Research textarea | Real research editor | `api.codex.updateEntry` | both | Connect in place |
| CX-19 | Save Entry | Save changes | Real save | `api.codex.updateEntry` | both | Preserve revision conflicts and errors |
| CX-20 | Reload Entry | No control | Real reload action | `api.codex.getEntry` | old-only | Requires binding revision or an approved implicit recovery path |
| CX-21 | More menu | Visible but disabled | Old lifecycle buttons are explicit | No complete reference menu | partial | Keep disabled |
| CX-22 | Archive Entry | No usable control | Real archive | `api.codex.archiveEntry` / `OC-010` | old-only | Requires binding revision |
| CX-23 | Restore Entry | No control | Real restore | `api.codex.restoreEntry` / `OC-027` | old-only | Requires binding revision |
| CX-24 | Delete Entry | No control | Real confirmation and delete | `api.codex.deleteEntry` / `OC-018` | old-only | Requires binding revision |
| CX-25 | Baseline/Effective state | Two controls | Real effective-state view | `api.codex.getEffectiveEntry` / `OC-019` | both/partial | Connect only with real Scene/story position |
| CX-26 | Canon/Research/Details/Relations/Progressions/Mentions tabs | Six tabs | Corresponding old panels | local tab state plus APIs | both | Keep reference tabs |
| CX-27 | Edit detail values | Reference Details content | Real detail rows | `api.codex.updateEntry` | both | Bind real detail schema/value state |
| CX-28 | Add/remove detail row | Add disabled; no Remove action | Real Add/Remove | old local draft behavior | partial | Requires a binding revision |
| CX-29 | Per-field AI/context policy | Five Send-to-AI toggles | Real detail context policy | `api.codex.updateEntry` | both | Preserve sensitive-field boundaries |
| CX-30 | Open Detail Type library | Two controls | Real manager | local manager state | both | Use reference dialog |
| CX-31 | Load/select Detail Types | Fixture types/categories | Real detail-type documents | `api.codex.listDetailTypes` | both | Replace fixtures |
| CX-32 | Create Detail Type | Dialog action | Real create | `api.codex.createDetailType` | both | Connect in place |
| CX-33 | Update Detail Type | Save library | Real update | `api.codex.updateDetailType` | both | Preserve revision/validation |
| CX-34 | Delete Detail Type | Visible but disabled | Real deletion with impact handling | `api.codex.deleteDetailType` | old capability, new disabled | Requires binding revision/confirmation |
| CX-35 | NSFW/sensitive flag | Sensitive checkbox | Old manager supports sensitive/NSFW state | detail-type update | both | Preserve exact privacy semantics |
| CX-36 | Relations list | Relations tab and fixture count | Real relations | `api.codex.listRelations` / `OC-026` | partial | Replace fixtures |
| CX-37 | Create Relation | Add relation disabled | Real create form | `api.codex.createRelation` / `OC-015` | old capability, new disabled | Requires binding revision |
| CX-38 | Archive/delete Relation | No control | Real archive action | `api.codex.archiveRelation` / `OC-011` | old-only | Requires binding revision |
| CX-39 | Progressions list | Progressions tab and fixture count | Real Progressions | `api.codex.listProgressions` / `OC-025` | partial | Replace fixtures with story-position data |
| CX-40 | Update Progression | No direct editor on Codex reference tab | Real update through Write | `api.codex.updateProgression` / `OC-031` | partial | Preserve source Scene/block linkage |
| CX-41 | Mentions list | Mentions tab and fixture count | Real manuscript/Codex mentions | `api.codex.listEntryMentions` / `OC-024` | partial | Replace fixtures |
| CX-42 | Switch manuscript/Codex mention source | No explicit reference source switch | Old UI has source tabs | old local state | old-only/partial | Requires binding decision |
| CX-43 | Open in Write | Visible but disabled | Real callback | `CodexWorkspace.onOpenScene` / `OC-093` | old capability, new disabled | May be conditionally enabled on a real target |
| CX-44 | Open source Scene | Three visible disabled buttons | Real callback | `CodexWorkspace.onOpenScene` / `OC-093` | old capability, new disabled | May be conditionally enabled on a real target |
| CX-45 | Mention-entry preview | No enabled reference action | Real preview popover | `OC-094` | old-only/partial | Requires an approved existing-row interaction or binding revision |

## New UI Functions Missing From The Old UI

| Function family | Controls | Current truth |
| --- | --- | --- |
| Current Scene lens | `RC-208` | New derived filter; exact production predicate not defined |
| Changed-at-position lens | `RC-209` | Can use existing effective/progression data after semantics are approved |
| Needs-attention lens | `RC-210` | No existing rule/endpoint |
| Compact category selector | `RC-212` | Responsive presentation only |
| Watch filter | `RC-218` | No existing Watch predicate |

## Old UI Functions Missing From The New UI

| Function family | Evidence | Impact |
| --- | --- | --- |
| Show archived | old local state | Archived entries cannot be found/restored |
| Rename/delete Category | `updateCategory`; `OC-016` | Category lifecycle incomplete |
| Reload Entry | `getEntry` | No explicit stale/error recovery action |
| Archive/restore/delete Entry | `OC-010`, `OC-027`, `OC-018` | Entry lifecycle incomplete |
| Add/remove detail rows | old draft behavior | Variable detail editing is incomplete |
| Delete Detail Type | `api.codex.deleteDetailType` | Schema lifecycle incomplete |
| Create/archive Relation | `OC-015`, `OC-011` | Relation lifecycle incomplete |
| Mention-source switch | old local state | Manuscript and Codex evidence cannot be separated explicitly |
| Enabled Open in Write/Open Scene | `OC-093` | Evidence cannot navigate back to prose |
| Mention preview | `OC-094` | Cross-entry evidence inspection is lost |

## Fixture, Authority, And Accessibility Audit

- All reference entries, categories, counts, relations, Progressions, Mentions,
  detail values and story positions are fixtures.
- Entry/category/detail-type/relation writes remain project JSON authority
  operations with base-revision and lifecycle guards.
- Effective state and Progressions must preserve story time and character
  knowledge; current-state data cannot leak into an earlier Scene.
- Sensitive/NSFW fields and context toggles must remain explicit.
- Disabled More/Add relation/Open Scene/Delete controls must not look enabled or
  silently no-op.
- Create/edit dialogs require stable labels, focus containment, keyboard
  dismissal and nearby accessible validation errors.

## Author Decision Queue

1. Approve categories, entry selection/editing, tabs and detail-type management
   as in-place real-data mappings.
2. Define Current Scene, Changed, Needs attention and Watch filter semantics.
3. Request binding revisions for category/entry/relation/detail-row lifecycle.
4. Decide whether disabled Open in Write/Open Scene controls may be
   conditionally enabled without changing structure.
5. Decide whether the old manuscript/Codex mention-source switch and preview
   must be represented explicitly.
