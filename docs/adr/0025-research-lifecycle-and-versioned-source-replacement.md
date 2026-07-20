# ADR-0025: Research Lifecycle And Versioned Source Replacement

Status: Accepted
Date: 2026-07-20

## Context

ADR-0019 makes each Research Database an isolated library-scoped authority
root. ADR-0020 makes imported originals immutable and permits parsed content to
change only through an explicit parser migration or author-confirmed re-import.
NS-609 left database-owned Research Note and Proposal files in the current
checkout. ADR-0026 records that this was an unrequested agent expansion and
freezes it. NS-610 may read those files only to avoid corrupting existing data
when a Source changes or is deleted.

The current runtime can edit database and Source properties, but it cannot
archive or permanently delete a database, archive
or permanently delete a Source, replace a Source without overwriting history,
reparse its current original, or safely clean up those authority roots after
checking external references. UI controls for those operations would therefore
be false capabilities until this lifecycle boundary is implemented.

## Decision

### Database Lifecycle

1. Research Database authority version 2 adds `status: active | archived` and
   `archivedAt`. Version 1 remains compatibility-readable as active. The first
   revision-checked lifecycle command upgrades version 1 and writes an exact
   rollback artifact in the same database transaction.
2. Archiving is reversible and does not archive or rewrite contained Sources or
   frozen compatibility files. An archived database remains locally readable from the Research
   workspace, but it is read-only, excluded from ordinary and model retrieval,
   cannot be newly activated in Workshop, and cannot be selected by an existing
   model call.
3. Archive and permanent delete are blocked while any active or archived
   Workshop session still records the database as active. Unreadable Series or
   session authority also blocks conservatively because a hidden reference
   cannot be disproved.
4. Permanent delete requires an archived database, its current revision, and an
   exact author-entered database name. Pending Proposals created by the frozen
   NS-609 implementation and
   unreadable Proposal authority also block. Deletion removes that database's
   Sources, originals, parsed content, Notes, aliases, indexes, and migration or
   version artifacts as one isolated root. Series links do not own the database
   and disappear with its authority.
5. The database root is first atomically renamed to a library-internal deletion
   quarantine after all checks. Recursive removal happens only from that
   verified quarantine path. Startup reconciliation completes cleanup of an
   already quarantined delete and never treats it as a live database.

### Source Lifecycle And Versions

6. SourceDocument version 4 adds `status`, `archivedAt`, and a positive
   `contentVersion`. Version 3 remains compatibility-readable as active. A
   lifecycle, replacement, or reparse command upgrades version 3 in the same
   transaction and preserves its exact JSON as a rollback artifact. Version 2
   must first use the existing explicit version 3 migration.
7. Archiving a Source is reversible. An archived Source and its current original
   remain locally readable, but properties are read-only, it is excluded from
   lexical and vector indexes and is never returned by model tools. Existing
   frozen NS-609 evidence reads report `source-archived` without changing the
   captured quote; this is compatibility behavior, not new Note scope.
8. Replacing a Source is an explicit author action against the current revision.
   It preserves the stable Source ID and author-managed properties, writes a new
   immutable original and parsed-content file under a new content version, and
   retains the exact prior Source authority, original, and parsed content. It
   never overwrites an earlier original.
9. Reparse is also explicit and revision-checked. It verifies and reads the
   current immutable original, runs the current parser, writes a new
   parsed-content version, and retains the prior authority and content. It does
   not fetch the network or change original bytes. A web snapshot refresh is an
   explicit replacement that reacquires the recorded credential-free requested
   URL through the same controlled web policy and stores a new immutable
   original version.
10. Permanent Source delete requires the Source to be archived, its current
    revision, and its exact display name. A pending Proposal whose immutable
    Research evidence cites the Source, or unreadable Series authority that may
    hide such a Proposal, blocks deletion. Existing Research Notes retain their
    captured quote snapshots and become honestly `source-missing`; they are a
    visible consequence, not a blocker or a new lifecycle feature. The command
    atomically removes current and retained Source authority, original, and
    content files, then rebuilds disposable indexes. Historical model-tool audit
    metadata is retained, but its deleted original passage can no longer be
    opened; the confirmation UI states that consequence.

### Isolation And Concurrency

11. Every command verifies database ownership, current revision, exact
    confirmation text, lifecycle precondition, and references immediately before
    mutation under the existing process-local coordinator. Cross-database IDs
    fail closed. No lifecycle command is exposed as a model tool.
12. Derived lexical and vector indexes are rebuilt or marked unavailable only
    after authority commit. Index failure never rolls authority back or revives
    deleted content. Existing cross-process locking and backup gaps remain
    separate tasks and are not implied complete by this decision.

## Consequences

- Authors get a complete visible cleanup path instead of an archive-only data
  sink or silent recursive deletion.
- A replacement keeps one stable Source identity while every original version
  remains immutable and auditable.
- Existing frozen NS-609 files keep their exact captured evidence and become
  stale instead of being rewritten after archive, replacement, reparse, or
  deletion.
- Pending work blocks destructive cleanup; existing frozen quote snapshots
  remain readable from their own immutable evidence.
- Database and Source schema changes require compatibility reads, explicit
  upgrade artifacts, rollback verification, and damage tests.

## Migration And Rollback

- Version 1 database and version 3 Source files remain readable without an
  eager library rewrite. The first explicit lifecycle operation writes the new
  schema and exact prior JSON rollback artifact atomically.
- New databases and Sources use versions 2 and 4 respectively after this ADR is
  implemented. Existing version 2 Sources still require the accepted explicit
  version 2-to-version 3 migration before lifecycle commands.
- Replacement and reparse retain exact prior Source JSON and immutable files.
  Injected failure at every mutation boundary must restore the complete prior
  visible version.
- Code rollback must preserve newer authority and report an unsupported schema;
  it must not delete, flatten, or rewrite lifecycle/version history.

## Validation

- Prove compatibility reads, exact migration artifacts, interrupted-command
  recovery, stale revisions, duplicate IDs, damaged authority, and rollback.
- Prove archived databases and Sources are locally readable but absent from
  search, Workshop activation, model tools, and new writes.
- Prove replacement and reparse preserve old originals and any existing frozen
  quote snapshots while changing current retrieval only after commit.
- Prove Source and database blocker reports cover external references,
  fail closed on unreadable authority, and expose no private body, path, or
  credential.
- Prove permanent delete requires exact confirmation, never crosses database
  roots, rebuilds disposable indexes, and survives restart at quarantine and
  file-transaction failure points.
