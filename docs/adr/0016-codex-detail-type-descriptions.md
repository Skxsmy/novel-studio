# ADR-0016: Codex Detail Types Store Descriptions

Status: Accepted
Date: 2026-07-16

## Context

The approved Detail Type Library design contains an editor for the selected
Detail Type, including a Description field. The connected implementation
replaced that design with an unauthorized two-column inline-create form, and
the current Detail Type version 1 authority has no field that can persist the
description shown by the approved interface.

A description explains the reusable field itself. It is different from the
value stored for that Detail Type on one Codex Entry. Displaying an editable
Description control without an authority path would create fake success;
keeping the unauthorized replacement layout would violate the binding design.

## Decision

1. Codex Detail Type authority advances from schema version 1 to schema
   version 2.
2. Version 2 retains the stable identifier, category identifier, display name,
   NSFW state, creation time, and update time, and adds an author-written
   `description` string.
3. `description` is trimmed at the API boundary, may be empty, and has a
   maximum length of 4000 characters. It is never synthesized from the display
   name, an Entry Detail value, or other project text.
4. Create accepts `description` and writes version 2. Update requires the
   current `baseRevision` and can change the display name, `description`, and
   NSFW state together. This decision does not add a type-level "Include in AI
   context by default" authority field.
5. The approved new-UI Detail Type Library keeps three columns: Category
   selection, Detail Type list and creation control, and the selected Detail
   Type editor. The existing Display name field remains visible but does not
   become a second Rename entry point; Rename opens from the Detail Type row
   context menu. The type-level AI-default control remains visible but disabled.
   Description and NSFW state use real version 2 writes.
6. Rename and permanent Delete are keyboard-reachable Detail Type row
   context-menu actions. Rename opens a focused name editor, requires the
   current revision, and rejects another Detail Type with the same normalized
   display name in the same Category. Delete retains confirmation and the
   existing server-owned in-use blocker. The selected editor adds neither a
   Rename button nor a Delete button.
7. Rename atomically converts legacy Entry `details` and `detailAiContext` keys
   equal to the old display name into the stable Detail Type identifier. When
   both the legacy name key and stable identifier key exist with the same
   value, Rename removes the redundant legacy key. When their values differ,
   Rename rejects the entire operation rather than choosing or overwriting a
   value. Detail Type and Entry files therefore change together or not at all.

## Migration And Rollback

- A compatibility read validates a version 1 file and projects it as version 2
  with `description: ""` in memory. Reading alone never rewrites authority.
- Explicit migration validates every Detail Type path, identifier, schema,
  duplicate identifier, category reference, and document before any write.
- Migration records the exact validated version 1 text, relative path, source
  checksum, and resulting version 2 checksum in a rollback artifact before
  atomically replacing the version 1 files.
- Migration writes version 2 with an empty description and does not invent
  prose from the display name.
- Rollback validates the backup identity, paths, checksums, exact version 1
  documents, and unchanged migrated files before atomically restoring the
  exact version 1 text. A changed migrated Detail Type produces a conflict
  instead of discarding the author's later edit.
- Damaged input, duplicate identifiers, omitted members, invalid categories,
  or mid-operation failure leaves the original authority set unchanged.

## Consequences

- The approved Description editor is backed by project JSON authority rather
  than local component state or a fixture.
- Existing version 1 projects remain readable without a silent startup
  migration.
- New and updated Detail Types are version 2. Older binaries must not rewrite a
  version 2 Detail Type as version 1.
- Detail Type Rename is a real row context-menu action. The Display name field
  in the selected editor remains disabled for an existing type so the interface
  has one unambiguous Rename entry point. The type-level AI-default setting
  remains deferred and disabled.

## Validation

- Contract tests prove strict version 1/version 2 parsing, empty compatibility
  projection, description trimming and length limits, and update requirements.
- Storage tests prove create, update, same-Category Rename uniqueness,
  atomic legacy Entry key conversion, conflicting-key rejection,
  stale-revision rejection, reload, all-or-nothing migration, damaged and
  duplicate input rejection, exact rollback, and rollback conflict after a
  later version 2 edit.
- Server tests prove create, Rename, description and NSFW update, list, revision
  conflict, and validation.
- Web tests prove the three-column structure, real Category and Detail Type
  selection, disabled unsupported controls, real Description/NSFW save,
  context-menu-only Rename and Delete, confirmation, and error preservation.
- Final visual acceptance remains the explicit NS-514-A16 author gate.
