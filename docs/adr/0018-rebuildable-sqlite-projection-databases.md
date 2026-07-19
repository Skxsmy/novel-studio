# ADR-0018: Rebuildable SQLite projection databases

Status: Accepted

## Context

Novel Studio already creates one SQLite `index.sqlite` per Series and uses
FTS5 for Scene/Codex search, mentions, ambiguity, Context Bundle metadata, and
model-call metadata. The current database is useful but remains an unversioned
prototype: DDL is embedded in repository modules, `user_version` and
`application_id` are zero, small operations repeatedly open and close the
database, and full rebuild clears live rows before parsing authority. A failed
rebuild can therefore leave a partially empty derived database.

ADR-0012 established schema-versioned JSON as project authority and made
SQLite, vectors, caches, and editor state rebuildable. The database plan must
strengthen search and query performance without reversing that decision.

M6 Reference Library work also needs SourceDocument/Chunk keyword search,
evidence locations, permission filters, optional vector provenance, and a
Chinese-author workflow that can retrieve Japanese and English originals even
when the query and source share no words. Adding those tables directly to the
current monolithic repository would make schema, language analysis, rebuild,
concurrency, and corruption handling harder to reason about.

## Decision

1. Schema-versioned JSON and managed source files remain authority. SQLite is
   never the only copy of manuscript, hierarchy, Codex, Workshop, Proposal,
   Research, settings, or audit data.
2. Each Series owns a derived `<series-root>/.studio/index.sqlite` projection.
   A future `<library-root>/.studio/catalog.sqlite` may provide rebuildable
   cross-Series catalog queries only when a proven Library use case needs it.
3. Database access moves behind one `IndexDatabase` subsystem with a migration
   registry, fixed identity, source revision/hash ledger, projector versions,
   health checks, and one serialized writer per database.
4. New ordinary tables use SQLite strict typing, declared foreign keys, bound
   parameters, canonical product terminology, explicit ordering, and no secret
   fields.
5. WAL remains the journal mode for the local same-host application. The
   implementation gates multi-connection WAL use on SQLite `3.51.3` or a known
   fixed backport and applies explicit connection PRAGMAs. The currently
   installed SQLite `3.53.2` satisfies that gate.
6. Search uses a normalized document/segment catalog plus domain- and
   analyzer-specific external-content FTS5 shards synchronized by tested
   triggers. Chinese/Japanese continuous text uses a trigram baseline;
   one/two-character text uses a bounded fallback; English uses Unicode word/
   phrase search; Codex names use language-tagged normalized alias tables.
7. Both core and FTS secure-delete settings are enabled. Extension loading and
   arbitrary attached databases are prohibited. This reduces recoverable
   deleted index text but is not represented as disk encryption or forensic
   erasure.
8. Authority commits happen before indexing. Index failure marks a projector
   stale/degraded and schedules reconciliation; it never rolls back or reports
   failure for an already committed author write.
9. Full rebuild creates, validates, checkpoints, closes, and atomically swaps a
   temporary database. It never clears the live database in place. Missing,
   corrupt, unversioned, wrong-identity, or incompatible derived databases use
   the same rebuild path.
10. Database schema rollback is delete-and-rebuild because all rows are
    derived. Authority schema migration remains subject to its separate backup
    and exact rollback rules.
11. Vector provenance may be projected into SQLite, but actual vector storage
    remains behind a later `VectorIndexAdapter` decision. Runtime loadable
    extensions and unapproved native dependencies are not introduced by this
    ADR.
12. Original text is preserved exactly while paragraph/sentence/dialogue units,
    mixed-language spans, normalization variants, entity aliases, POV, story
    time, plot threads, and text metrics remain versioned rebuildable
    projections. Language identity uses BCP 47 and every span returns to
    original offsets/hash.
13. Cross-language retrieval combines literal FTS, author-confirmed aliases,
    deterministic search-only transforms, a validated multilingual embedding
    profile, and optional versioned query translation. Profiles must pass
    Chinese/Japanese/English cross-language fixtures before being marked ready;
    translation and semantic results disclose their channel and never replace
    original-language Evidence or silently use a Provider.
14. The detailed logical schema, connection settings, rebuild algorithm,
    phased implementation, and test blueprint are owned by
    `docs/architecture/DATABASE_ARCHITECTURE.md`.

## Consequences

- Authors can delete every projection database without losing the novel or
  research authority.
- Search can degrade independently from saving and editing.
- Current unversioned index files do not need a unique-data migration; the
  first database-kernel implementation rebuilds them from authority.
- The database layer gains more files and explicit lifecycle code, but schema
  changes, corruption, WAL behavior, and query ownership become testable.
- A per-Series database keeps project portability and damage isolation. A
  Library catalog is an optimization rather than a new global authority.
- External-content FTS reduces duplicated content-table ownership but requires
  trigger and integrity tests. An inconsistent FTS table is corruption of
  derived state and is rebuilt.
- Multiple domain/language FTS shards and a query planner add schema and test
  cost, but permit novel-specific field weighting and prevent Chinese,
  Japanese, English, Workshop, and research prose from sharing a misleading
  raw relevance score.
- Cross-language retrieval remains useful without pre-translating or replacing
  source files. Without a validated multilingual profile it degrades honestly
  to original-language/alias/transliteration search rather than claiming that
  foreign-language evidence does not exist.
- `synchronous=NORMAL` may lose the latest index transaction after sudden power
  loss. That is acceptable because source revisions detect the stale cache and
  authority remains durable through the file transaction path.
- SQLite contains plaintext search projections. Optional at-rest encryption is
  not solved by this decision and requires a separate product/security ADR.

## Alternatives Rejected

### Make SQLite the project authority

Rejected because it would contradict ADR-0012, make database damage a novel
data-loss event, weaken file portability, and force every backup/import path to
depend on one database file.

### One database for the entire library

Rejected as the default because one corrupt or locked file would affect every
Series, project copies would lose their local query state, and cross-Series
transactions are not a product requirement. A small rebuildable catalog may be
added later without storing unique project data.

### Keep embedded `CREATE TABLE IF NOT EXISTS` calls

Rejected because they cannot prove schema identity, migration order, checksum,
or projector compatibility and allow different call paths to own partial DDL.

### Clear and repopulate the live database

Rejected because cancellation, disk failure, damaged authority, or process exit
can expose a partial index. Temporary-build validation and atomic swap keep the
last valid index available.

### Add one native tokenizer or vector extension immediately

Rejected for the first database phase. Packaging, ABI, license, extension
loading, model dimensions, and security need independent evidence. Built-in
trigram, Unicode word segmentation, explicit short-query behavior, and an
application-owned analyzer boundary preserve current functionality while
Chinese/Japanese/English analyzers and vector choices are benchmarked.

### Translate and store every foreign-language source as Chinese

Rejected because translation is lossy, expensive, permission-sensitive, and
cannot replace the wording that supports an Evidence citation. Optional query
or result translation remains a derived, versioned reading/retrieval aid tied
to the unchanged original Chunk and SourceLocation.

### Store every derived structure as JSON blobs

Rejected because it prevents foreign keys, targeted invalidation, stable query
plans, and useful filters. JSON is permitted only for bounded supplemental
metadata whose fields are not query invariants.

## Migration

- Existing `user_version=0` Series databases are treated as legacy derived
  indexes. The first implementation builds schema version 1 from authority and
  swaps it into place.
- Current APIs and search results remain compatible during extraction. Schema
  normalization happens behind repository/query adapters.
- No authority file is rewritten by database migration.
- Backup does not need to preserve legacy SQLite rows. A real fixture must
  prove delete-and-rebuild against an existing unversioned index.

## Rollback

- Stop the index service and close all database handles.
- Remove the unsupported derived database, WAL, SHM, temporary builds, and
  vector sidecars through the scoped index cleanup command.
- Run the older application's supported rebuild from unchanged authority.
- If a code rollback predates the new schema, it creates its own compatible
  derived index. No SQLite row is copied back into JSON.

## Validation

- Identity, schema, migration checksum, fixed SQLite version, PRAGMA, foreign
  key, quick-check, FTS integrity, and source-hash tests.
- Current unversioned database rebuild, missing database rebuild, corrupt bytes,
  wrong identity, unknown version, and migration checksum drift.
- Injected cancellation/failure during scan, projection, validation,
  checkpoint, atomic swap, reopen, and cleanup.
- Concurrent query and serialized write tests with bounded busy behavior and
  WAL size/checkpoint diagnostics.
- Chinese/Japanese one/two-character fallback and trigram search, English word/
  phrase search, mixed-language spans, Codex multilingual alias lookup,
  escaped FTS input, deterministic fusion, and permission/archive filters.
- Chinese-to-Japanese, Chinese-to-English, reverse, mixed-language,
  proper-name, false-friend, and negative cross-language fixtures; exact-only
  degradation without a validated profile; query/result translation privacy;
  match-channel disclosure; and original-language Evidence after translation.
- Backup restore without derived databases, then complete rebuild.
- M8-scale startup, save, search, rebuild, memory, and disk benchmarks.
