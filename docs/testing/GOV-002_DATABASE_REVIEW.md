# GOV-002 Database Implementation Review

Date: 2026-07-19
Baseline: `bb37126 NS-602 feat(research): add source workspace and index kernel`
Status: complete

## Executive Summary

The current database implementation is a useful M6.1 kernel, not yet the
complete novel-text knowledge database planned by NS-601. JSON and managed
original files remain authority. The per-Series SQLite file is a rebuildable
projection for Scene, Codex, mention, ambiguity, Context Bundle, and Model Call
data; Research SourceDocument metadata and original text are not yet projected
into it.

This review did not infer safety from the existing test suite. Evidence came
from a repository-wide opener/SQL inventory, line-by-line control-flow review,
official SQLite constraints, new failure reproductions, direct temporary-disk
inspection, a real in-process HTTP route workflow, and a synthetic performance
probe. Existing and new tests were then used to preserve confirmed behavior.

Fifteen confirmed defects were fixed. The highest-impact defects allowed a
foreign or cross-Series database to be mutated or read, allowed concurrent
duplicate Research sources, mishandled corrupt live-index replacement, exposed
readers to a two-rename gap, or could delete the only rollback bundle during a
second recovery failure. No confirmed defect changed or lost valid JSON
authority. There are no known open P0 authority-loss defects in the reviewed
scope, but important P1 residual risks remain: coordination is process-local,
projection freshness has no durable ledger, deep FTS corruption is not bounded
or isolated from the synchronous request thread, and filesystem containment is
lexical rather than symlink-safe.

Recommendations in this report are proposals, not accepted product
requirements.

## Reviewed Surface

| Surface | Current implementation | Review result |
| --- | --- | --- |
| Authority | Schema-versioned JSON plus managed Research originals | Remains authoritative; no user `data/library/` content was read or changed |
| Database topology | One `.studio/index.sqlite` per Series | Correct boundary; Series identity is now verified in metadata before use |
| Runtime opener | `packages/storage/src/indexDatabase.ts` | The only production constructor of `better-sqlite3`; callers use the shared policy |
| Schema/migration | `application_id`, `user_version`, schema checksum, migration and metadata ledgers | Identity, version, checksum, build, Series, and projection policy are validated |
| Connection policy | WAL, `busy_timeout`, foreign keys, trusted schema off, secure delete, checkpoint limit | Policy is applied only after foreign identity rejection and verified on supported SQLite |
| Projections | Scene/FTS, Codex/FTS, mentions, ambiguities, Context Bundles, Model Calls | Core/FTS pairing and build-time FTS integrity are validated; no source/catalog/vector projection yet |
| Writes | Per-Series in-process lane and SQLite transactions | Same-process writes serialize; different Series remain independent |
| Rebuild | Temporary build, validation, WAL settlement, bundle swap, rollback | Cancellation and every injected swap phase preserve live or recoverable old data |
| Research files | Original plus SourceDocument JSON transaction | Exact UTF-8/hash/revision/canonical path/Series ownership and duplicate rules verified |
| API | Research list/get/import/update, index rebuild, Scene/Codex search | Direct Fastify injection passed the connected workflow and recovery probe |
| UI | Research shelf, original preview, property editor | Unsaved source-property loss and save-time edit races fixed; visual acceptance remains separate |
| Forbidden paths | Runtime `ATTACH`, extension loading, writable schema, hidden database authority | No production occurrence found |

The lockfile resolves `better-sqlite3` 12.11.1 with SQLite 3.53.2 on this
machine. That SQLite engine is newer than the WAL-reset fix in 3.51.3. Runtime
policy also admits the official 3.44.6 and 3.50.7 backports. SQLite documents
the affected and fixed versions in its [WAL guidance](https://sqlite.org/wal.html#the_wal_reset_bug).

The file-swap review follows SQLite's requirement that the main database and a
hot `-wal` or `-journal` remain paired, and that an open database must not be
renamed or unlinked. See [How To Corrupt An SQLite Database File](https://www.sqlite.org/howtocorrupt.html#_mispairing_database_files_and_hot_journals)
and [the open-file rename warning](https://www.sqlite.org/howtocorrupt.html#_unlinking_or_renaming_a_database_file_while_in_use).

## Confirmed Findings And Fixes

| ID | Severity | Confirmed defect | Repair and retained proof |
| --- | --- | --- | --- |
| DB-01 | P1 | Opening a foreign SQLite file changed it to WAL before rejecting its identity | Preflight is non-persistent; identity is rejected before mutable policy. Test compares bytes and journal mode before/after rejection |
| DB-02 | P1 | Rebuild tried to settle corrupt/foreign live files by opening them and did not treat WAL/journal files as one bundle | Health decides whether settlement is safe; main, WAL, SHM, and rollback journal move/restore together. Corrupt and foreign live replacement cases pass |
| DB-03 | P2 | Cancellation that arrived inside `beforeSwap` or `afterNewMoved` was ignored | Cancellation is checked after every asynchronous hook; old live content remains readable |
| DB-04 | P1 | Readers could enter the two-rename gap, while a missing DB could be silently recreated empty | Readers wait for the Series write lane, normal opens require an existing file, and missing/unhealthy indexes rebuild from authority |
| DB-05 | P1 | Concurrent identical Research imports all passed because duplicate detection ran outside the transaction coordinator | Duplicate scan and commit now share the same Series file-transaction lane; 12 concurrent attempts produce one source and 11 conflicts |
| DB-06 | P2 | A SourceDocument could redirect `originalRelativePath` to another same-hash file | Read and create require the canonical managed path derived from source ID and kind |
| DB-07 | P2 | One- and two-character searches treated `%` and `_` as SQL wildcards | LIKE patterns escape backslash, percent, and underscore and use an explicit `ESCAPE` clause |
| DB-08 | P2 | Failure before transaction-journal creation left plaintext `.tmp` source content | Setup tracks and removes every prepared temporary before rethrow; no `.tmp` or `.bak` remains |
| DB-09 | P1 | Cross-Series Research authority could be listed late or updated before the ownership error was raised | List/get/update require expected Series identity; update validates inside the transaction before writing and compares unchanged bytes |
| DB-10 | P1 | A valid Novel Studio index copied from another Series passed application/schema checks and leaked the other Series' search results | `series_id` is mandatory metadata for repository opens and health; mismatch is classified and rebuilt from local authority |
| DB-11 | P1 | Core rows and FTS rows could diverge while `quick_check` still returned `ok` | Missing, orphan, and duplicate FTS IDs are classified as corruption; reads rebuild before returning results |
| DB-12 | P2 | FTS5 retained deleted terms under its default persistent policy | New databases enable FTS5 `secure-delete=1`; drift is classified and rebuilt. Core `secure_delete` remains enabled |
| DB-13 | P1 | If cleanup or rollback restoration failed after installing the new database, `finally` could delete the only rollback bundle | Rollback cleanup now depends on confirmed restoration; partial restores reverse into the bundle. An obstructed-cleanup probe confirms the old Scene remains recoverable |
| DB-14 | P1 | Research property update wrote JSON before validating the managed original; a damaged original caused an error after the update had committed | Update now verifies canonical path, bytes, size, and hash before commit; damaged-original test proves authority bytes do not change |
| DB-15 | P2 | Switching/uploading while Research properties were dirty silently lost the draft; editing during save could be overwritten by the response | Dirty state is visible, source switching/import are held, `Discard changes` is explicit, and form controls are frozen during save |

Build acceptance now uses full `PRAGMA integrity_check`, `foreign_key_check`,
core/FTS pairing, and the FTS5 special `integrity-check` command. Daily health
classification keeps `quick_check` because SQLite states that it is O(N), while
the full check is O(N log N). SQLite also states that `quick_check` does not
verify UNIQUE constraints or index content against table content; see the
[PRAGMA documentation](https://www.sqlite.org/pragma.html#pragma_quick_check).

FTS5's dedicated command verifies internal index structures and reports
`SQLITE_CORRUPT_VTAB`; its persistent secure-delete option removes old terms
instead of leaving reconstructable delete keys. See the
[FTS5 integrity-check command](https://www.sqlite.org/fts5.html#the_integrity_check_command)
and [FTS5 secure-delete option](https://www.sqlite.org/fts5.html#the_secure_delete_configuration_option).

## Performance And Maintainability

- Full rebuild now opens one Scene projection connection for the entire Scene
  pass instead of opening and validating a connection per Scene. Initial Series
  creation no longer performs an unnecessary second full rebuild after its
  first Scene projection.
- A synthetic isolated database with 20,000 matched Scene/core FTS rows measured
  12 normal verified opens at median 15.58 ms and maximum/p95 sample 18.74 ms on
  this machine. This is not a product benchmark. It demonstrates that current
  per-open pair validation is visible and grows with corpus size; M8 needs
  author-scale measurements before this becomes a pooled or cached policy.
- Research duplicate detection and listing are O(number of source files) and
  currently use unbounded `Promise.all`. This is acceptable for M6.1 fixtures,
  not for a large professional source shelf.
- Codex rebuild loads every Scene with `Promise.all`; Scene rebuild now streams
  files sequentially but still performs synchronous SQLite work on the server
  thread. Rebuild progress, cancellation, and resource budgets need a worker or
  job boundary before large projects.
- The short-query literal LIKE path still scans core text columns. Escaping is
  now correct, but a dedicated short-query strategy belongs with NS-603's
  language-aware index.
- `packages/storage/src/index.ts` remains oversized and mixes many domains.
  Splitting only the touched database/Research projection boundary would reduce
  review cost without changing authority.

## Residual Risks

| Risk | Priority | Current boundary |
| --- | --- | --- |
| Write lane and file-transaction coordinator are process-local | P1 | The startup script prevents ordinary duplicate service startup, but direct second-process writers are not durably excluded |
| Projection freshness has no durable source-revision/projector ledger | P1 | An authority write followed by a projection error can leave authority committed while the database still appears structurally ready |
| Deep live FTS corruption is not isolated or bounded | P1 | Build-time FTS integrity is complete, but the FTS special command requires a writable connection and is not run before every read. An isolated destructive segment probe did not complete within 50 seconds and was terminated; the blocking stage was not localized, so no pass is claimed |
| Swap has an unavoidable path gap for external processes | P1 | In-process readers wait for the lane; external processes are not coordinated across the two Windows-compatible renames |
| Filesystem containment is lexical | P1 | `assertInside` blocks `..` and absolute escape but does not enforce realpath/no-follow rules against symlink or junction substitution races |
| No declared foreign keys in schema v1 | P2 | Application transactions and validation protect current rows; schema-v2 relational constraints remain deferred |
| No at-rest encryption or forensic erasure guarantee | P2 | Core and FTS secure delete reduce retained text, but do not encrypt authority, SQLite pages, temp files, or storage media |
| UI draft guard is local to source switching/import | P2 | App-wide workspace or Series navigation can still need a shared unsaved-change boundary |
| Browser visual diagnosis was unavailable | P2 | Current in-app Browser blocked the local URL by policy after health verification; no visual acceptance is claimed |
| Backup/restore drill is not implemented | P2 | Derived indexes rebuild, but authority/original backup, checksum catalog, restore, and disaster rehearsal remain future work |

The current implementation intentionally does not yet provide PDF/DOCX/EPUB
parsing, source chunks, citation anchors, language-profile FTS shards, alias or
transliteration expansion, query translation, embeddings, vector search,
cross-language fusion, Research Notes, source deletion/archive/reparse, or
source-to-Canon promotion. The database kernel therefore cannot yet satisfy the
complete multilingual novel knowledge-base goal by itself.

## Recommendations

| Order | Recommendation | Author impact and dependency | Decision state |
| --- | --- | --- | --- |
| R1 | Add a durable projector ledger containing authority revision, projector version, completion state, and last error; reconcile in background and expose degraded state | Prevents silent stale search after an otherwise successful author save; natural next boundary for NS-603 | Recommended, not approved |
| R2 | Make one service the explicit database/file writer and add an OS-visible per-Series lock or lease with stale-owner recovery | Closes cross-process duplicate and swap hazards before background jobs are introduced | Recommended, not approved |
| R3 | Run deep FTS integrity and potentially expensive rebuild/search work in a bounded worker/job with timeout, cancellation, progress, and fallback to authority | Prevents one damaged index or large query from freezing the author UI | Recommended, not approved |
| R4 | Define schema v2 with source/projector ledgers, explicit foreign keys, and external-content/contentless FTS only after migration and rollback fixtures exist | Improves relational integrity and reduces duplicate text, but changes the schema contract | Planned direction; requires NS-603 task and migration decision |
| R5 | Harden managed paths with realpath/no-follow component checks, reject symlinks/junctions at authority boundaries, and add race-focused fixtures | Protects originals and journals from local path substitution | Recommended, not approved |
| R6 | Add a database health surface with last successful build, authority freshness, degraded reason, rebuild action, and preserved recovery-bundle location | Gives authors an actionable state instead of a generic search failure; must hide engineering hashes from main writing paths | Recommended, not approved |
| R7 | Add bounded source iteration, streaming Scene/Codex rebuild, corpus-size budgets, and 10k/100k/1m-character author benchmarks | Controls latency and memory before larger formats and embeddings arrive | Recommended for M8 planning |
| R8 | Implement the NS-603 to NS-605 multilingual path in order: source ledger/chunks, language-aware lexical channels, aliases/transliteration/query translation, then validated multilingual embeddings and disclosed fusion | Required for Chinese queries to retrieve Japanese/English evidence while always citing unchanged originals | Already planned, not implemented |
| R9 | Add authority-plus-original backup manifests, `VACUUM INTO` or backup-API snapshots for derived diagnostics, restore verification, and a disaster drill | Rebuildability is not a substitute for authority backup. SQLite describes `VACUUM INTO` as a consistent snapshot mechanism in its [VACUUM documentation](https://sqlite.org/lang_vacuum.html#vacuum_with_an_into_clause) | Recommended, not approved |
| R10 | Add one shared unsaved-change boundary for workspace/Series navigation and split database/Research code from the repository monolith when the next task touches it | Reduces author draft loss and implementation review cost without inventing a new product surface | Recommended, not approved |

## Evidence

The independent HTTP/disk probe created an isolated Series through the real
Fastify route, imported mixed Japanese/English/Chinese Markdown, changed source
properties, rebuilt the index, and directly inspected the resulting file. It
observed HTTP 201/201/200/200, exact source hash and text, a changed revision,
matching Series metadata, 64-character schema checksum, application ID
`1314081112`, schema version 1, WAL, `quick_check=ok`, zero foreign-key errors,
and both FTS secure-delete values set to 1.

The first recovery probe accidentally used an empty Scene body to create an
empty query, so it never entered the index read path and was explicitly rejected
as evidence. A corrected non-empty query proved a deliberate 1-core/0-FTS
divergence became 1/1 and returned one result after authority rebuild.

See `docs/testing/GOV-002_ACCEPTANCE.md` for exact commands, regression counts,
known blocked visual evidence, and repository state.
