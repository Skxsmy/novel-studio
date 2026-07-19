# NS-609 Research Notes UI Checklist

Status: active implementation checklist
Updated: 2026-07-20
Task: `docs/tasks/NS-609.md`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Design Source

This is the named written checklist required before NS-609 Research UI code.
The author rejected the obsolete Figma path. The design extends the connected
React workspace using the installed `ui-design` Skill, existing Novel Studio
tokens and controls, the accepted NS-602/NS-603 Research direction, and real
author workflows. No Figma node or screenshot is binding. Existing product
components are sufficient, so targeted 21st.dev component inspiration is not
used.

ADR-0024 fixes the two boundaries used by this checklist. A Research Note is
owned by the current Research Database and begins with server-verified Source
evidence. Promotion requires an active Series, creates a Review Proposal, maps
`World rule` to Canon Description, maps `Real-world reference` and
`Inspiration only` to Codex Research, and permits an existing or named new
Codex Entry target.

## Direction

1. Purpose and audience: let a novelist capture an interpretation from exact
   source evidence, develop it in their own words, and deliberately decide
   whether any part belongs in one story's Codex.
2. Tone: quiet editorial archive. Sources are evidence; Notes are the author's
   thinking; Proposals are decisions awaiting review. Color and copy must not
   blur those roles.
3. Layout: preserve the continuous three-column Research workspace. A compact
   `Sources / Notes` tab control changes all three columns together instead of
   nesting a new dashboard or opening an unrelated page.
4. Typography: original passages retain readable document measure; Note body
   uses the same long-form editor scale; evidence metadata remains compact and
   secondary.
5. Color and surfaces: neutral content surfaces, existing green only for current
   evidence, amber for changed evidence, and red only for missing or unreadable
   evidence. Research Note and Canon are never distinguished by color alone.
6. Motion: selection, save, archive, and drawer transitions only. No animated
   generation decoration or layout-shifting progress state.
7. Signature differentiator: each evidence item has one narrow vertical source
   spine linking database, Source, location, unchanged quote, and freshness in
   reading order. The Note body remains visually independent beside it.

## Route, Entry, And Return

- Product route remains the existing `Research` workspace in the application
  shell. There is no separate settings page or marketing-style notes route.
- Opening Research restores the last valid database and the last selected
  `Sources` or `Notes` view for that database.
- `Add to project` appears only on an opened original passage or an exact search
  result. It opens a focused note-capture dialog containing the immutable
  evidence preview and a `New note / Existing note` target control. New note
  exposes editable title/body fields; existing note lists active Notes from the
  current database only.
- Successful note creation or evidence append switches the Research workspace
  to `Notes`, selects the target note, and keeps the originating database
  selected.
- `Move to Codex` requires an active Series, opens a promotion dialog, creates
  one pending Proposal, and navigates to that Proposal in Review.
- Rejecting or archiving the Proposal returns to the originating Research Note.
  Accepting it exposes both `Open Research Note` and `Open Codex Entry` return
  actions. No route implies that opening a Note changed Canon.

## Layout Structure

### Shared Toolbar

- Keep the existing Research title, Research Database selector, database create,
  database settings, and Add Source controls.
- Add a two-option tab control labeled `Sources` and `Notes` adjacent to the
  database identity, not inside a card and not in global navigation.
- The active database remains visible in both views. Changing database replaces
  the entire source/note rail, center content, evidence, and selection.
- Dirty Note or Source edits must be saved or explicitly discarded before view
  or database changes.

### Sources View

- Preserve the current source shelf, search controls, original reader, and
  property inspector.
- An opened search result shows `Add to project` beside its exact location and
  match channels after the containing source page is actually open.
- A reader passage action uses the same command and evidence identity. It does
  not copy arbitrary rendered HTML or an unbounded source page into the Note.
- The capture dialog shows source name, database, original-language quote, and
  human-readable location as read-only evidence. Hashes and internal IDs stay
  out of the primary author flow.

### Notes View

- Left rail: compact active/archived filter, note rows with title, evidence
  count, freshness summary, and updated time. Rows have stable height and no
  preview card nesting.
- Center: Note title, editable body, tags, save/discard state, and archive or
  restore command. Original quotes never appear inside the editable body by
  default; the author may quote deliberately, but evidence remains separately
  linked.
- Right inspector: ordered evidence list showing Source, Research Database,
  language, location, unchanged original quote, and current/changed/missing/
  unreadable state. Engineering hashes are available only in a collapsed
  evidence-details disclosure.
- An empty note list explains that evidence-bound Notes begin from `Add to
  project` on an opened Source passage. It does not present a standalone-note
  control that schema version 1 cannot support.
- Archived Notes are read-only until restored. A stale Note remains editable;
  staleness warns about evidence and never rewrites or deletes the author's body.

### Promotion Dialog

- The dialog first states that the Research Note is not Canon and that this
  action creates a Review Proposal rather than changing Codex immediately.
- Meaning is a required segmented or radio control with complete labels:
  `Real-world reference`, `World rule`, and `Inspiration only`.
- Target uses a required segmented control: `Existing Codex Entry` or
  `New Codex Entry`, if both are approved. Existing target provides searchable
  entry selection; new target provides category and name.
- A read-only destination summary names `Codex Research` for `Real-world
  reference` and `Inspiration only`, or `Canon Description` for `World rule`.
- The author can edit the candidate text independently from the Research Note.
  Editing the candidate does not mutate the Note.
- Primary command is `Create Review Proposal`; there is no `Add to Canon`,
  `Apply`, or other wording that implies immediate authority mutation.

## Component And Data Map

| Surface | Implementation owner | Real data or action | Decision dependency |
| --- | --- | --- | --- |
| Sources/Notes tabs | `ResearchDatabaseWorkspace.tsx` plus feature CSS | local view state persisted per database | none |
| Passage command | Research result and reader block components | exact opened `ResearchRetrievalResult` or bounded block selection | none |
| Capture dialog | new Research feature component | create-note or append-evidence API after validation | none |
| Note rail/editor | new Research feature components | list/get/update/archive/restore APIs | none |
| Evidence inspector | new Research feature component | server-resolved evidence status and bounded original quote | none |
| Promotion dialog | new Research feature component | Codex target list and create-Proposal API | active Series |
| Review return actions | `ReviewWorkspace.tsx` | Proposal source/target navigation | promotion contract |
| API client | `apps/web/src/api/research.ts` and proposals API | typed server routes only | contract outcome |
| Copy | Research feature view-model text module | centralized author-facing labels/errors | none |

## Required States

- Loading database Notes without hiding the existing Source shelf state.
- No Notes in a valid database.
- Note selected with all evidence current.
- Mixed current and changed evidence.
- Missing Source, missing Chunk, changed quote, unreadable authority, and damaged
  Note file diagnostics.
- Note create/update saving, saved, validation failure, conflict, interrupted
  write recovery, archive, and restore.
- Database changed while a dirty Note is open.
- No Series open; Series open but database unlinked; linked Series; missing or
  archived Codex target; Proposal created, stale, rejected, accepted, and failed.
- Narrow viewport with source/note rail drawer and evidence inspector following
  the editor without horizontal overflow.

## Interaction And Accessibility Rules

- Tabs use native tab semantics and preserve focus. Dialog focus returns to the
  exact passage command that opened it unless navigation intentionally changes.
- Icon buttons use Lucide icons with accessible names and tooltips. Text buttons
  are reserved for clear commands such as Save, Discard, Archive, and Create
  Review Proposal.
- Evidence status always includes text, not color alone. Original-language quote
  direction and line wrapping remain correct for Chinese, Japanese, and English.
- Long titles, Source names, and locations wrap without changing control widths;
  stable grid tracks prevent errors or save labels from shifting the editor.
- Keyboard users can open a result, create a Note, edit it, inspect evidence,
  open promotion, and reach Review without pointer-only controls.
- A temporary network or page error keeps the Note row and unsaved editor body.
  Only an explicit not-found response changes object selection.

## Responsive Rules

- Wide desktop keeps the current narrow rail, dominant center reader/editor, and
  bounded right inspector. Evidence does not reduce the Note editor below a
  useful long-form measure.
- Compact desktop/tablet moves the inspector below the center editor before
  compressing the rail below its stable width.
- Narrow screens use one closeable Sources/Notes rail drawer. The Note editor is
  first in document order; evidence follows as a disclosure section; promotion
  uses a full-height modal sheet with visible primary action.
- No badge, status message, quote, field label, or button may create horizontal
  scrolling at 390 CSS pixels.

## Verification Checklist

- Component tests cover tabs, capture from exact opened evidence, empty/loading/
  damaged states, dirty navigation, conflict preservation, archive/restore,
  stale evidence, promotion prerequisites, Proposal navigation, focus return,
  keyboard use, and absence of premature Canon writes.
- Server and Storage tests prove every displayed state comes from real authority
  or classified error data rather than UI inference.
- Real-browser verification uses a generated temporary library at desktop and
  390-by-844 viewports. It creates a multilingual Note, refreshes, changes the
  underlying evidence fixture, observes the warning, creates and accepts one
  Proposal, and verifies both Note and Codex authority.
- Browser inspection checks hierarchy, line length, clipping, focus, scroll
  ownership, and overlap. It is diagnostic evidence and never author acceptance.
- Only the author can pass NS-609-A12.

The implemented A10 browser pass used the installed `ui-design` Skill's quiet
editorial direction without Figma or an external component reference. Review
keeps the applied destination as the completion anchor, provides exact return
commands for the originating Note and resulting Codex field, gives narrow-screen
decision controls a 40-pixel minimum height, and keeps the collapsed Series
switch named with the current Series and Volume. Exact return requests are
consumed once, so ordinary Note edits and later Codex refreshes do not reopen a
stale destination. Diagnostic desktop and
390-by-844 inspection found no document-level horizontal overflow; this evidence
does not pass the author-only acceptance row.
