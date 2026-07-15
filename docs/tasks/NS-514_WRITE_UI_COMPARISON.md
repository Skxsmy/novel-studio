# NS-514 Write UI Function Comparison

Status: P5 detailed comparison; Write P6 automated implementation complete, author visual review pending
Surface: Write
Binding node: `#write-workspace`
New component: `apps/web/src/features/write/ReferenceWriteWorkspace.tsx`
Old components: `apps/web/src/features/write/WriteWorkspace.tsx` and
`apps/web/src/features/write/editor/NovelEditor.tsx`

## Scope And Interpretation

This document compares the binding-reference Write surface with the real
pre-NS-514 Write workflow. The author-facing hierarchy is always
`Series → Volume → Chapter → Act → Scene`; internal `book/act/chapter` storage
names are not product labels.

The primary Write surface contains 50 controls. Its structure-creation dialog
contains 4 more. Combined disposition: 16 proposed in-place connections,
23 local-only controls, 13 disabled/deferred controls, and 2 fixture-only
controls.

## Binding And Entry Checklist

| Property | New Write | Old Write |
| --- | --- | --- |
| Entry | Appbar Write control | Sidebar Write workspace |
| Scene entry | Overview/Plan/structure reference actions | Project session Scene selection |
| Return path | Appbar workspace controls | Sidebar workspace controls |
| Layout | Toolbar, manuscript structure, editor, writing sidebar | Page header, structure panel, NovelEditor, Scene brief |
| Primary data | Fixture hierarchy, prose, Codex facts and issue rows | Real Series detail, Scene block document and Codex data |
| Write authority | None in replica | `api.series.updateSceneDocument` with revision protection |
| Story-change authority | Fixture card | Scene progression block plus Codex progression documents |

## Complete Function Matrix

| ID | Atomic function | New UI | Old UI | Existing callback/API | Comparison | Required P6 disposition |
| --- | --- | --- | --- | --- | --- | --- |
| WR-01 | Open Write | Appbar Write | Sidebar Write | `App.showWorkspace("write")` | both | Connect workspace state |
| WR-02 | Toggle manuscript structure | Explicit toolbar button | Structure panel always present | local reference state | new-only presentation | Keep local-only |
| WR-03 | Draft/Revise mode | Two active reference buttons | Two visible buttons without handlers | No real old capability | new-only reference behavior | Do not claim production editorial modes |
| WR-04 | Focus mode | `Focus` | Real Focus button | `App.onToggleFocus` / `OC-084` | both | Connect in place |
| WR-05 | Toggle writing sidebar | Explicit toolbar button | Show/hide Scene brief | `WriteWorkspace.setIsBriefVisible` / `OC-091` | partial | Map only if Scene brief semantics are preserved |
| WR-06 | Open structure-creation menu | Add button plus four levels | Add menu plus four levels | existing local state | both | Keep reference structure |
| WR-07 | Create Volume | New Volume | Real create Volume | `api.series.createBook` | both | Connect in place |
| WR-08 | Create Chapter | New Chapter | Real create Chapter | `api.series.createAct` | both | Connect in place |
| WR-09 | Create Act | New Act | Real create Act | `api.series.createChapter` | both | Connect in place |
| WR-10 | Create Scene | New Scene | Real create Scene | `api.series.createScene` | both | Connect in place |
| WR-11 | Structure creation dialog | Name plus Create/Cancel | Inline creation state | existing create callbacks | both | Use the reference dialog with real validation/errors |
| WR-12 | Select Volume/Chapter/Act | Hierarchy rows | Real hierarchy selection | project-session selection callbacks | both | Connect local selection state |
| WR-13 | Select and load Scene | Scene rows | Real Scene selection/load | `api.series.getSceneDocument` | both | Load real block document |
| WR-14 | Collapse hierarchy branches | Disclosure rows | Real collapse sets | `OC-088` | both | Keep local-only |
| WR-15 | Rename Volume | No control | Double-click rename and Save/Cancel | `api.series.updateBook` / `OC-057` | old-only | Requires binding revision |
| WR-16 | Rename Chapter | No control | Double-click rename and Save/Cancel | `api.series.updateAct` / `OC-056` | old-only | Requires binding revision |
| WR-17 | Rename Act | No control | Double-click rename and Save/Cancel | `api.series.updateChapter` / `OC-058` | old-only | Requires binding revision |
| WR-18 | Delete Volume | No control | Delete menu with confirmation | `api.series.deleteBook` / `OC-044` | old-only | Requires binding revision and confirmation UI |
| WR-19 | Delete Chapter | No control | Delete menu with confirmation | `api.series.deleteAct` / `OC-043` | old-only | Requires binding revision and confirmation UI |
| WR-20 | Delete Act | No control | Delete menu with confirmation | `api.series.deleteChapter` / `OC-045` | old-only | Requires binding revision and confirmation UI |
| WR-21 | Delete Scene | No control | Delete menu with confirmation | `api.series.deleteScene` / `OC-046` | old-only | Requires binding revision and confirmation UI |
| WR-22 | Clear structure selection | No control | Internal reset behavior | `OC-089` | old-only | May remain implicit or require a future control |
| WR-23 | Edit Scene title | `#wr6-title` | Real title draft | project-session draft state | both | Bind to real Scene draft |
| WR-24 | Edit structured prose | Reference manuscript region | Real NovelEditor | `NovelEditor.onUpdateDocument` / `OC-090` | partial | Mount the real editor without changing reference regions |
| WR-25 | Commit/autosave Scene document | Reference save text is fixture-only | Revision-safe autosave | `api.series.updateSceneDocument` | old capability behind new region | Preserve revision/checksum failure handling |
| WR-26 | Show Save state | Fixture save label | Real dirty/saving/saved/error state | project-session save state | partial | Replace fixture status with real state |
| WR-27 | Show/hide Scene brief | Scene sidebar tab and sidebar toggle | Real Scene brief panel | `OC-091` | partial | Author must approve semantic mapping |
| WR-28 | Insert Story change | Existing reference card; no explicit insertion action | Real editor tool menu insertion | `api.series.createSceneProgressionBlock` / `OC-041` | partial | Needs an approved existing-node entry or binding revision |
| WR-29 | Edit Story change | Open/collapsed reference card | Real progression editor | `api.codex.updateProgression` / `OC-031` | partial | Connect only with real Codex/Scene state |
| WR-30 | Delete Story change | No control | Real delete action | `api.series.deleteSceneProgressionBlock` / `OC-047` | old-only | Requires binding revision |
| WR-31 | Reorder Story change blocks | No control | Drag and keyboard reorder | `OC-095` | old-only | Requires binding revision or explicit approval for in-card behavior |
| WR-32 | Open Codex sidebar | Codex tab | Codex data integrated into editor/workspace | existing list APIs | both | Connect to real entries |
| WR-33 | Search Codex in Write | Search field | No equivalent Write search field | Local filtering over `api.codex.listEntries` | new-only | Can be local-only over real data |
| WR-34 | Select Codex reference | Four reference buttons/list rows | Real Codex entry data | `api.codex.listEntries` | both | Replace fixture entries |
| WR-35 | Read detail types/progressions | Story change/reference data | Real API reads | `api.codex.listDetailTypes`; `listProgressions` | both | Preserve story-position semantics |
| WR-36 | Inline Codex mention preview | No binding control | Real NovelEditor mention popover | `OC-092` | old-only | Needs binding decision; do not silently remove |
| WR-37 | Comment action | Visible button | No old capability | No production callback | new-only | `RC-171` remains disabled |
| WR-38 | Add to Snippet | Visible button | No old capability | No production callback | new-only | `RC-172` remains disabled |
| WR-39 | Expand/Compress/Rephrase | Toolbar and sidebar actions | No old capability | No production callback | new-only | `RC-173`–`RC-175`, `RC-193`–`RC-195` remain disabled |
| WR-40 | Custom Prompt | Button, textarea and Prepare candidate | No old capability | No production callback | new-only | `RC-176`, `RC-196`, `RC-197` remain disabled |
| WR-41 | Keep/Undo candidate | Two enabled reference buttons | No Proposal-backed candidate workflow | Fixture-only | placeholder | `RC-168`, `RC-169` must not reach production |
| WR-42 | Continuity check | Badge/check actions | No old Write action | No production callback | new-only | `RC-178`, `RC-198` remain disabled |
| WR-43 | AI sidebar | AI tab and selection actions | No old Write AI panel | No production callback | new-only | Keep disabled until Proposal-backed workflow exists |
| WR-44 | Check sidebar | Check tab and issue row | No old Write check panel | No production callback | new-only | Keep disabled |

## New UI Functions Missing From The Old UI

| Function family | Controls | Current truth |
| --- | --- | --- |
| Explicit structure/sidebar toggles | `RC-149`, `RC-153` | Local presentation only |
| Draft/Revise mode | `RC-150`, `RC-151` | Old buttons were fake; new behavior is still local-only |
| Codex search inside Write | `RC-188` | Can filter real entries locally |
| Comment/Snippet | `RC-171`, `RC-172` | No production capability |
| Rewrite/custom-prompt actions | `RC-173`–`RC-176`, `RC-193`–`RC-197` | No approved AI/Proposal path |
| Candidate Keep/Undo | `RC-168`, `RC-169` | Fixture-only |
| Continuity/Check panel | `RC-178`, `RC-182`, `RC-198` | No production path |

## Old UI Functions Missing From The New UI

| Function family | Evidence | Impact |
| --- | --- | --- |
| Rename Volume/Chapter/Act | `OC-056`–`OC-058` | Structure names cannot be corrected after creation |
| Delete Volume/Chapter/Act/Scene | `OC-043`–`OC-046` | Structure lifecycle is incomplete |
| Delete/reorder Story changes | `OC-047`, `OC-095` | Saved story-state blocks cannot complete their lifecycle |
| Explicit Story-change insertion | `OC-041` | Reference shows an existing card but no clear creation entry |
| Inline Codex mention preview | `OC-092` | In-prose evidence lookup is lost |
| Clear structure selection | `OC-089` | No explicit return to an unselected state |

## Fixture, Safety, And Accessibility Audit

- The hierarchy, prose, selection, word counts, save state, Codex entries,
  Story change and issue rows are fixtures.
- Scene writes must continue through revision-protected project JSON authority;
  editor-local state is never the only copy.
- AI rewrite, custom prompt, continuity and candidate actions require a
  Proposal or another explicit user-confirmed semantic-change boundary.
- Story changes must preserve story time, effective position and character
  knowledge.
- Toolbar icon controls require accessible names and keyboard reachability.
- Disabled AI/check actions must remain visually and semantically disabled;
  they cannot silently succeed against fixture content.
- Save and validation errors must be shown near the editor/status region and
  announced accessibly.

## Author Decision Queue

1. Approve real Scene loading, editing and autosave inside the exact reference
   structure.
2. Decide whether the new Scene sidebar is an acceptable replacement for the
   old Scene brief.
3. Request a binding revision for rename/delete structure operations and
   Story-change delete/reorder.
4. Decide how Story-change creation is entered without adding an unapproved
   control.
5. Keep WR-37 through WR-44 disabled/fixture-only until a Proposal-backed AI
   workflow is separately approved.

## Author-Approved Write P6 Dispositions

- WR-13, WR-23 through WR-26, WR-32 through WR-36: connect real hierarchy,
  Scene block document, complete NovelEditor behavior, live counts, autosave,
  Codex data, and a lightweight current-position Canon Description preview.
- WR-15 through WR-21: add title-only context menus for Volume, Chapter, Act,
  and Scene with inline rename and confirmed cascade delete. Series lifecycle
  remains outside Write.
- WR-28 through WR-31: redesign Story Change within the accepted Write visual
  language; place Add at `right sidebar -> Scene page -> Story changes heading`;
  retain editing, collapse, resize, reorder, keyboard movement and focus; require
  deletion confirmation.
  The author rejected the first connected visual treatment on 2026-07-15. Its
  replacement must use a dedicated Write presentation and must not expose the
  old `Codex progression` visual identity; author visual acceptance remains
  pending.
- WR-25/WR-26: show one animated status slot; retry an ordinary failed save
  three times with yellow `Retrying`, then hold red `Failed` until the next edit
  creates a new autosave cycle. Do not expose a manual retry. Preserve the
  separate revision-conflict boundary.
- WR-03: keep the mode control disabled and fixed at Draft.
- WR-37 through WR-44 and fixture candidate actions: preserve the approved
  reference appearance while making every unsupported action non-interactive.
- These decisions authorize only the Write slice and do not approve any other
  page's pending P5 rows.
