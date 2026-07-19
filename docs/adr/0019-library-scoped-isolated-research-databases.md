# ADR-0019: Library-scoped isolated Research Databases

Status: Accepted

## Context

NS-602 introduced the first Research Source path under a Series directory. The
author clarified that this is not the intended ownership model. A Research
Database is reusable reference material, not part of one novel. The author must
be able to create several databases, keep their sources and indexes isolated,
and explicitly make one database available to more than one Series.

ADR-0018 remains controlling for the derived manuscript projection owned by a
Series. This ADR supersedes only its assumption that Research Sources and their
future Reference Library index live inside that Series projection.

## Decision

1. `ResearchDatabase` is a library-scoped authority object. It can be created,
   opened, and managed without an active Series.
2. A library may contain multiple Research Databases. Each database owns one
   separate directory containing its database authority, SourceDocument
   authority, managed originals, transaction journals, parser output, and one
   rebuildable search index. No database stores another database's rows or
   managed files.
3. A Series never owns a Research Database. A Research Database records an
   explicit set of linked Series identifiers and may be linked to several
   Series. Removing a link does not delete or move either object.
4. Source identity, duplicate-content checks, parsing, indexing, permissions,
   rebuild, damage handling, and lifecycle commands are scoped to one Research
   Database. The same original may be intentionally imported into two isolated
   databases.
5. Search defaults to exactly one selected Research Database. A future query
   may explicitly select several linked databases; the query layer merges
   labeled results without merging authority, files, indexes, permissions, or
   lifecycle state.
6. Every result and Evidence reference includes its Research Database and
   Source identity in addition to the original location, language, and hash.
7. Existing NS-602 Series-owned Research Sources are a legacy authority format.
   They are never silently deleted or moved. Migration is an explicit,
   revision-checked copy into a selected Research Database, followed by
   read-back verification and a receipt. The unchanged legacy files are the
   rollback source until a separately accepted cleanup command exists.
8. The Series-owned manuscript `index.sqlite` remains a disposable projection
   for that novel. It is distinct from every author-facing Research Database
   and must not be labeled as one in product UI or documentation.

## Consequences

- Reference collections such as historical research, Japanese source texts,
  or sailing manuals can be reused across novels without duplication.
- Damage, rebuild, duplicate detection, and deletion in one Research Database
  do not affect another database.
- Research navigation gains a database selector and database-level management
  before its source shelf. The workspace remains useful with no Series open.
- Explicit multi-database search requires deterministic result fusion and
  database labels, but does not require a global authority database.
- Library backup must discover every Research Database directory independently;
  a damaged database cannot make the remaining databases undiscoverable.

## Migration

- SourceDocument version 2 replaces `seriesId` with `researchDatabaseId` for
  new Research Database sources.
- NS-602 SourceDocument version 1 remains readable only by the legacy migration
  boundary.
- Migration validates the legacy source and original, writes a version 2 copy
  and receipt in one target-database transaction, and verifies the copy before
  reporting success.
- No Series manifest schema change is required. Links are revision-protected
  ResearchDatabase authority.

## Rollback

- Stop using the new Research Database and leave its directory intact for
  diagnosis.
- The original Series-owned version 1 source and original remain unchanged and
  readable by the NS-602 compatibility code.
- A code rollback does not copy database rows or version 2 source files back
  into a Series.

## Validation

- Create, restart, rename, and link multiple Research Databases with no active
  Series requirement.
- Import the same content into two databases, reject it only when repeated in
  the same database, and prove paths and list results never cross databases.
- Link one database to two Series and unlink one without changing sources.
- Inject failure during creation, source import, linking, and legacy migration;
  no partial authority or managed original becomes visible.
- Copy valid authority into the wrong database directory and reject it before
  update or indexing.
- Explicitly migrate a legacy source, verify exact text, hash, properties, and
  provenance, and prove the legacy bytes remain unchanged.
