# ADR-0022: Isolated Research Vector Index

Status: Accepted
Date: 2026-07-19

## Context

NS-605 must search several explicitly selected Research Databases and retrieve
Chinese, Japanese, and English passages without shared terms. The existing
per-database FTS index cannot provide that semantic channel. The database plan
left the vector engine, library catalog, profile capability record, and alias
authority location open until current Windows packaging and deletion behavior
could be reviewed.

The vector implementation must not merge database authority, load arbitrary
SQLite extensions, scan an unbounded multi-database vector corpus in JavaScript,
or create a second Embedding configuration system. Every semantic hit still has
to resolve to the unchanged Source Chunk and its current revision/hash/location.

## Decision

1. No library-wide Research catalog is added. A retrieval request contains one
   to twelve unique database IDs, and the repository opens only those isolated
   roots. Results are labeled and fused in memory; databases are never attached
   to one SQLite connection.
2. Each Research Database owns `retrieval/aliases.json`, a schema-versioned,
   atomic, revision-checked authority document for author-entered alias and
   transliteration pairs. Missing authority means an empty set. Expansion text
   is disclosed query provenance, not Source content or Evidence.
3. Each Research Database owns a rebuildable `.studio/vector-index.sqlite`
   sidecar. It stores vector rows and exact database, Source, Chunk, revision,
   text-hash, profile, model, dimension, normalization, prefix, and fixture
   provenance. It is never the only copy of Source text.
4. The sidecar uses exactly `sqlite-vec` 0.1.9, dual licensed MIT/Apache-2.0.
   Novel Studio loads the extension only from the resolved reviewed package on
   the dedicated sidecar connection. No request, setting, SQL value, environment
   variable, or project file can choose an extension path. Arbitrary extension
   loading, SQL `ATTACH`, and extension loading on authority/FTS connections
   remain forbidden.
5. Version 0.1.9 is pinned because `sqlite-vec` is pre-v1 and that stable release
   contains the current DELETE fix. Schema checksum, application identity,
   package version, deletion, cancellation, foreign identity, and full
   delete-and-rebuild behavior are acceptance gates. Experimental DiskANN/IVF
   prereleases are not used.
6. Research semantic retrieval reuses the existing library-global Embedding
   profile and the `research.multilingual` use-case binding. A versioned
   capability document references the exact profile revision and records
   supported language tags, shared-space declaration, query/document prefixes,
   fixture version, validation status, metrics, and validation time. Only a
   passing current record enables vectors.
7. A Source with `aiPermission=never` remains locally searchable through lexical
   and author-entered expansion channels but its text is not sent to an
   Embedding or translation Provider and it receives no semantic vector.
8. Deterministic weighted reciprocal-rank fusion combines disclosed channels.
   Results deduplicate by database and Chunk, preserve database labels and
   original citation fields, apply a relevance floor and source diversity, and
   paginate with a cursor bound to the query and selected index snapshots.
9. Rebuilds create a complete replacement sidecar in bounded Provider batches.
   When the live sidecar has the same database, profile, model, dimension,
   normalization, prefix, capability, and fixture identity, unchanged Chunk
   vectors are copied batch by batch from it. Only added, changed, or missing
   Chunk vectors are sent to the Provider. The replacement still owns a fresh
   Source ledger and complete current metadata before atomic swap.

## Alternatives Rejected

- USearch provides a mature native HNSW index and Windows/JavaScript support,
  but a separate index file would add a second key/filter/deletion synchronization
  contract beside SQLite metadata in the first implementation.
- Unbounded JavaScript cosine comparison is simple but consumes request-thread
  CPU and memory in proportion to all vectors across every selected database.
- Experimental `sqlite-vec` DiskANN/IVF builds are not stable enough for the
  current authority/deletion boundary.
- A global `catalog.sqlite` would create another isolation and freshness surface
  before measured evidence shows that bounded explicit database fan-out needs it.

## Consequences

- Flat KNN is exact and operationally simple but must be benchmarked on the
  author-scale corpus; a later ADR may replace the adapter without changing
  retrieval contracts or authority.
- Semantic search is honestly unavailable until a profile is bound, capability
  fixtures pass, and vectors are current. Lexical/alias search remains usable.
- Updating profile identity, model, dimensions, normalization, prefixes,
  capability, or fixture version prevents vector reuse. Source, permission, or
  text changes make the sidecar stale and require a replacement build; a Chunk
  whose ID, original text, and text hash are unchanged may reuse its vector
  while the replacement records the current Source revision and permissions.
- The new dependency and narrow load path become security and packaging gates on
  Windows. Failure to load never enables arbitrary fallback or remote service use.

## Validation

- Prove package-path confinement, sidecar identity/checksum, vector provenance,
  permission exclusion, cancellation, deletion, damaged/foreign rejection, and
  delete-and-rebuild on Windows.
- Prove two selected databases return deterministic labeled results while an
  inactive or damaged sibling cannot leak or relabel rows.
- Prove Chinese/Japanese/English positive and negative capability fixtures, plus
  exact-only degradation when validation/profile/vector state is unavailable.

## Sources

- <https://github.com/asg017/sqlite-vec>
- <https://github.com/asg017/sqlite-vec/releases/tag/v0.1.9>
- <https://github.com/unum-cloud/USearch>
