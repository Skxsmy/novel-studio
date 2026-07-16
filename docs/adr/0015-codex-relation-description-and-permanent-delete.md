# ADR-0015: Codex Relations Use Description And Permanent Delete

Status: Accepted
Date: 2026-07-15

## Context

The current Relation v1 authority requires a short `type`, even though an
author may need a relationship whose meaning is conditional, asymmetric, or
too complex for one type label. The approved NS-514 Codex design asks the
author only who relates to whom and for a simple natural-language description.
It also removes Relation archive/restore from the author-facing lifecycle and
places permanent delete in the Relation row context menu.

This is not only a presentation change. Omitting `type` from the form while
continuing to require it in authority would create fabricated or hidden data.
Changing the lifecycle to Delete also requires a real server command with
reference validation; the existing archive command cannot be relabeled as
delete.

## Decision

1. Codex Relation authority advances from schema version 1 to version 2.
2. A v2 Relation contains stable ID, `sourceEntryId`, `targetEntryId`,
   `directed`, `description`, optional evidence and story-position bounds,
   revision timestamps, and migration-only archived-state compatibility. It
   does not contain `type`.
3. New Relation creation requires distinct valid From and To entries plus a
   non-empty Simple Description. The UI does not ask the author to classify a
   relationship. From → To is represented with `directed: true`.
4. A migrated v1 Relation may have an empty description when the old record
   supplied no description. The migration must not synthesize prose from the
   removed `type`; subsequent author-created records still require a non-empty
   description.
5. The author-facing Relation lifecycle is permanent Delete only. New UI and
   new API clients do not expose Archive or Restore. A hard-delete command
   requires `baseRevision`, explicit UI confirmation, and server-side checks
   for live Progression, character-knowledge, evidence, or other authority
   references. A blocked delete leaves the Relation unchanged and returns a
   useful reason.
6. Existing archived-state data may be read during migration compatibility so
   that an upgrade does not silently resurrect a hidden Relation. Version 2
   clients do not create a new archived state. Removing that compatibility
   field requires a separately proved cleanup once all legacy archived records
   have an explicit disposition.
7. ADR-0008 remains authoritative for separate Relation documents and explicit
   direction. Its general archive/restore rule no longer governs the
   author-facing Relation lifecycle; Entry and other domain lifecycles are not
   changed by this ADR.

## Migration And Rollback

- Before rewriting any Relation, migration creates a rollback artifact that
  contains the exact validated v1 Relation documents and their paths. Product
  authority writes continue to use same-directory validation, checksum or
  revision protection, and atomic replacement.
- The explicit v1-to-v2 migration copies every supported field except `type`,
  sets `schemaVersion: 2`, and does not merge, preserve, or translate the old
  `type` value into `description`, evidence, or another product field. This is
  the author-approved lossy part of the migration.
- Migration validates IDs, source/target references, versions, duplicate IDs,
  and damaged or omitted members before replacement. A failed project
  migration leaves the original authority intact and reports the failing path.
- Rollback restores the exact v1 documents from the pre-migration artifact.
  The rollback copy is recovery evidence, not readable Relation v2 product
  data and not permission to surface legacy `type` in the new UI.
- An older binary must not parse and rewrite a v2 Relation as v1. Mixed-version
  read/write behavior must be rejected or completed through the explicit
  migration boundary.

## Consequences

- The UI, API contract, storage repository, fixtures, migration, rollback, and
  tests must advance together; the frontend cannot ship a description-only
  form against the current v1 create contract.
- Relation complexity remains in author prose instead of a mandatory label.
- Delete is honest and irreversible after confirmation, while referenced
  Relations remain protected by server-owned validation.
- Existing archive endpoints may remain temporarily as legacy compatibility
  code during implementation, but the connected NS-514 Codex UI must not call
  or advertise them. Their removal requires a searched and tested exit step.
- Current architecture and API documents continue to describe the implemented
  v1 runtime until the migration and hard-delete command actually ship.

## Rejected Alternatives

- Keep `type` required in authority and generate a hidden placeholder from the
  UI.
- Merge the old `type` into `description` during migration.
- Preserve `type` in v2 as an optional or deprecated product field.
- Relabel the existing archive command as Delete.
- Delete a Relation without checking live authority references.
