# ADR-0024: Database-owned Research Notes And Codex Promotion

Status: Superseded by ADR-0026 for product approval status
Date: 2026-07-20

This document describes the implemented NS-609 architecture. ADR-0026 records
the author's correction that this feature was never requested, freezes further
work, and prevents this historical implementation record from being treated as
an approved product requirement.

## Context

ADR-0019 establishes that a Research Database is a library-scoped authority
root that is independent from every Series. The Research product specification
also establishes that content distilled from a Source belongs to a Research
Note, that a Research Note is not story fact by default, and that moving it to
Codex creates a Proposal. NS-609 needs the missing ownership, evidence, and
application boundaries before implementing that workflow.

A Research Note must remain reusable wherever its database is useful. Copying
the Note into one Series would silently change that ownership rule. Conversely,
Codex is Series authority, so a database-owned Note cannot write Codex or own a
pending Codex change directly. The application path also has to distinguish an
existing Codex target from a new target, whose pre-acceptance state is absence
rather than a fabricated revision.

## Decision

### Research Note Authority

1. A Research Note belongs to exactly one Research Database and is stored at
   `research-databases/<database-id>/notes/<note-id>.json`. It can be created,
   opened, edited, archived, and restored without an active Series. Series links
   do not copy, move, or grant ownership of the Note.
2. NS-609 Notes are evidence-bound. Creation requires at least one exact Source
   passage from the same Research Database. Additional evidence may be appended
   to or removed from an active Note through revision-checked commands. A
   standalone note without Source evidence is not part of this schema version.
3. Each evidence item stores the Research Database and Source identities,
   Source content revision and hash, Chunk and Block identities, Chunk hash,
   original-language quote snapshot and quote hash, language, SourceLocation,
   and capture time. The server materializes these fields from current Source
   authority; a client cannot assert arbitrary quote text or hashes.
4. The author's title, body, and tags remain separate from evidence. Generated
   or author-written summaries never become original evidence. Source updates,
   replacement, reparse, permission changes, archive, or damage never rewrite
   the Note body or its captured quote snapshot.
5. Evidence freshness is derived on read as current, Source revision changed
   while the exact passage remains identifiable, passage changed, Source
   missing, unreadable authority, or ownership mismatch. Source artificial-
   intelligence permission is reported separately: `never` prevents model use
   but does not prevent the author from capturing or reading local evidence.
6. Archived Notes are read-only until restored. Archive and restore increment
   the Note revision. Permanent deletion is deferred until a later lifecycle
   command can prove that no Proposal, snapshot, or other audit reference needs
   the Note.

### Codex Promotion

7. `Move to Codex` requires an active Series but does not require the Research
   Database to be linked to that Series. It creates one pending Series-scoped
   Proposal and does not invoke a Provider or modify Codex authority.
8. The author must select one meaning and one target:
   - `Real-world reference` writes the accepted candidate to Codex Research.
   - `Inspiration only` writes the accepted candidate to Codex Research.
   - `World rule` writes the accepted candidate to Canon Description.
   The author may select an existing Codex Entry or define a named new entry in
   an existing Codex category. Candidate text is independently editable and
   never changes the Research Note.
9. Existing targets capture the exact Codex Entry revision for Canon Description
   or the exact Codex Research revision for non-Canon Research. New targets use
   a stable preallocated Codex Entry identifier and explicitly record that the
   target was absent; no fake baseline revision is allowed.
10. Proposal creation and acceptance reread the active Note and resolve every
    Source evidence item. Changed, missing, unreadable, cross-database, or
    ownership-mismatched evidence blocks acceptance and requires a new author
    review. Model-use prohibition alone does not block this local, author-
    confirmed promotion because no Source body is sent to a Provider.
11. Acceptance runs beneath the repository's process-local command lock,
    revalidates Note, evidence, target, and edited candidate immediately before
    committing, then writes the target Codex authority, immutable Proposal
    snapshot, and decided Proposal through one Series-root file transaction.
    A new-entry transaction creates both the Codex Entry and its Codex Research
    authority. Research Note and Source files are read-only dependencies; this
    ADR does not claim an atomic write spanning a Research Database and Series.
12. Rejecting a Proposal never changes the Note or Codex. Acceptance is exact-
    once. A Note archive, restore, edit, evidence change, Source change, or target
    revision change after Proposal creation invalidates its captured baseline
    and cannot be silently merged.

## Consequences

- Research Notes preserve database isolation and remain useful with no Series
  open or across several explicitly linked Series.
- Original evidence, author interpretation, non-Canon Codex Research, Canon
  Description, and pending Proposal state have distinct visible and storage
  boundaries.
- The Proposal contract needs a Research Note source kind, target-family
  validation, and a snapshot representation for verified target absence.
- Source permission continues to constrain model context without taking local
  reading and note-taking away from the author.
- Note permanent deletion, cross-process locking, and backup/restore remain
  separate lifecycle work and must not be implied by NS-609.

## Migration And Rollback

- Schema version 1 creates a new `notes/` directory only when the first Note is
  written. No existing authority migration is required.
- Disabling the feature leaves Note and Proposal JSON intact. It does not copy
  Notes into Series directories or convert them into Codex fields.
- A failed Note command recovers through the database transaction boundary. A
  failed promotion application recovers through the Series transaction journal;
  no partial Codex, snapshot, or Proposal decision becomes visible.
- A code rollback that cannot read Research Notes must preserve their files and
  report the unsupported schema rather than deleting or rewriting them.

## Validation

- Prove same-database evidence capture, cross-database rejection, revision
  conflicts, archive/restore, damaged authority isolation, and injected write
  recovery.
- Prove every evidence freshness state against unchanged original-language
  quotes without mutating the Note.
- Prove both Codex destinations and both existing/new targets create no early
  Codex write, apply exactly once after Review, and fail atomically on every
  stale dependency.
- Prove local use of a `never` Source does not invoke or expose content to a
  Provider, while every model-context path still rejects that Source.
- Prove APIs and UI never expose credentials, private file paths, unbounded
  Source bodies, internal hashes in the main author flow, or another database's
  Notes.
