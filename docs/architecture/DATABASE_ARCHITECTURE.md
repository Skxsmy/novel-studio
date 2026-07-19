# Database Architecture Plan

Status: proposed implementation plan
Planning task: `docs/tasks/NS-601.md`
Decision record: `docs/adr/0018-rebuildable-sqlite-projection-databases.md`
Updated: 2026-07-18

This document plans the maintainable database subsystem that replaces the
current ad hoc SQLite index setup. It does not change Novel Studio's authority
model: schema-versioned project JSON remains the only project authority;
SQLite, FTS5, vector stores, statistics, and caches remain disposable derived
state.

## 1. Decision Summary

Novel Studio will use three storage tiers:

1. **Authority files**: schema-versioned JSON and managed source files. These
   own manuscript, hierarchy, Codex, Workshop, Proposal, audit, Research, and
   settings truth.
2. **Per-Series projection database**:
   `<series-root>/.studio/index.sqlite`. It owns rebuildable relational
   projections, full-text indexes, mention indexes, source locations, query
   acceleration, and vector metadata for one Series.
3. **Library catalog and optional vector sidecars**:
   `<library-root>/.studio/catalog.sqlite` is a rebuildable cross-Series
   catalog; `<series-root>/.studio/vectors/` contains replaceable vector data
   selected by a later vector-engine ADR.

No command may create or change Canon by writing SQLite. Every semantic write
first commits validated authority files. Indexing runs after that commit and
may degrade search without rolling back a successful author write.

## 2. Current Implementation Inventory

The repository already has an SQLite prototype rather than an empty database
layer:

- `better-sqlite3` is the existing MIT-licensed driver. The installed lockfile
  resolves version `12.11.1`; the local native binding reports SQLite
  `3.53.2`.
- Every existing Series has its own `.studio/index.sqlite` in WAL mode.
- Current tables cover `scenes`, `codex_entries`, `codex_mentions`,
  `codex_ambiguities`, `ai_context_bundles`, and `ai_model_calls`, plus
  content-owning `scene_fts` and `codex_fts` tables.
- Current search uses FTS5 `tokenize='trigram'` for three-or-more-character
  queries and `LIKE` fallback for shorter queries.
- `ProjectRepository.rebuildIndex()` deletes live index rows before walking
  authority files. A crash, parse failure, or cancellation can therefore leave
  a partially rebuilt live database.
- Schema creation is embedded in `packages/storage/src/index.ts` and
  `packages/storage/src/aiFiles.ts`; there is no migration registry, schema
  checksum, `application_id`, projector version, or source-file ledger.
- Existing inspected databases report `user_version = 0` and
  `application_id = 0`. Their `quick_check` results are currently `ok`.
- Connections repeatedly open, execute DDL, and close for small operations.
  Index ownership and write serialization are implicit rather than a named
  subsystem.

The first implementation phase is therefore a compatibility-preserving
extraction and hardening of an existing derived database, not a new authority
database or a destructive project migration.

## 3. Mature Patterns Used

| Source | Mature pattern | Novel Studio adoption | Deliberate difference |
| --- | --- | --- | --- |
| SQLite WAL | Multiple readers can coexist with one writer; checkpoint policy is an application concern | One serialized writer per database, bounded readers only when workers need them, explicit checkpoint policy | Authority durability never depends on WAL durability |
| SQLite FTS5 | External-content tables, synchronization triggers, field filters, `rebuild`, and integrity checks | Normalized original-offset segments plus domain/language analyzer shards behind one query facade | CJK uses trigram, English uses word terms, and no unreviewed native tokenizer extension is loaded |
| SQLite application metadata | `application_id`, application-owned `user_version`, integrity and foreign-key checks | Fixed database identity, sequential schema versions, checksummed migration registry | Unknown or damaged derived schemas are rebuilt instead of risking authority migration |
| Git index | Paths, stat hints, object hashes, format versions, optional extensions, and invalidation of changed regions | Relative path, size/mtime hints, SHA-256/revision verification, projector versions, incremental invalidation | The index is never a staging area and never owns uncommitted author changes |
| calibre database API | A normalized cache behind a thread-safe multiple-reader/single-writer API | One `IndexDatabase` facade and one write lane; callers do not issue arbitrary SQL | Novel Studio's JSON files, not SQLite metadata, remain authority |
| Unicode normalization and BCP 47 | Original strings and language identity remain distinct from normalized comparison/search forms | Exact original text plus versioned NFC/compatibility search variants and BCP 47 tags per source/unit/span | Compatibility folding never rewrites manuscript/source authority or becomes a quotation |
| ICU transforms and `Intl.Segmenter` | Locale-aware segmentation/transformation are explicit services with identifiable rules | A versioned `TextAnalyzer` boundary for sentence/word boundaries and deterministic search-only transforms | Japanese readings and translated names are not inferred as Canon; author-confirmed aliases outrank generated variants |
| Multilingual embedding retrieval | A single validated multilingual model can place supported query/document languages in a shared retrieval space | Exact profile/version must pass Chinese-query-to-Japanese/English fixtures before `crossLanguageReady` | Model claims alone are insufficient; lexical search and original evidence remain available without vectors |

Primary references:

- SQLite WAL: <https://www.sqlite.org/wal.html>
- SQLite FTS5: <https://www.sqlite.org/fts5.html>
- SQLite PRAGMA reference: <https://www.sqlite.org/pragma.html>
- SQLite public application-ID registry: <https://www.sqlite.org/src/doc/trunk/magic.txt>
- SQLite strict tables: <https://www.sqlite.org/stricttables.html>
- Git index format: <https://git-scm.com/docs/gitformat-index>
- calibre database API: <https://manual.calibre-ebook.com/db_api.html>
- Unicode normalization: <https://www.unicode.org/reports/tr15/>
- BCP 47 language tags: <https://www.rfc-editor.org/rfc/rfc5646>
- ICU transforms: <https://unicode-org.github.io/icu/userguide/transforms/general/>
- ECMAScript `Intl.Segmenter`: <https://tc39.es/ecma402/#segmenter-objects>
- BGE-M3 multilingual model card, as a benchmark candidate rather than a fixed dependency: <https://huggingface.co/BAAI/bge-m3>

## 4. Filesystem Topology

```text
library-root/
├─ .studio/
│  ├─ model-profiles/                 JSON authority
│  ├─ embedding-profiles/             JSON authority
│  └─ catalog.sqlite                  rebuildable library projection
└─ <series-slug-id>/
   ├─ series.json                     JSON authority
   ├─ books/, codex/, workshop/, ... JSON authority
   └─ .studio/
      ├─ index.sqlite                 rebuildable Series projection
      ├─ index.sqlite-wal             runtime SQLite state
      ├─ index.sqlite-shm             runtime SQLite state
      ├─ vectors/                     optional rebuildable sidecars
      ├─ index-build/                 temporary rebuild output only
      └─ transactions/, snapshots/    authority recovery facilities
```

Rules:

- `catalog.sqlite` cannot contain a unique copy of model profiles, credentials,
  project paths, or Series metadata. It can be recreated by scanning the
  selected library root.
- `index.sqlite` is portable with its Series only as an optimization. A copied
  or restored Series must open without it.
- Backups exclude `catalog.sqlite`, `index.sqlite`, `-wal`, `-shm`, vector
  sidecars, and rebuild temporaries by default. If a whole-folder backup
  contains them, restore treats them as untrusted caches and validates or
  replaces them.
- Database code never uses arbitrary `ATTACH`, never loads runtime extensions,
  and never opens a path that has not passed the existing library-root path
  boundary checks.

## 5. Authority And Projection Contract

Every projected row must be traceable to an authority source:

| Required field | Meaning |
| --- | --- |
| `source_path` | POSIX-style path relative to the Series root |
| `source_revision` | Repository revision derived from canonical authority bytes |
| `content_hash` | SHA-256 of the exact projected source or projection input |
| `schema_version` | Authority document schema version |
| `projector` | Named projector that created the row |
| `projector_version` | Version of the deterministic projection algorithm |
| `indexed_at` | Diagnostic time only; never freshness authority |

`size_bytes` and `mtime_ms` are scan hints only. A changed hint requires a hash
check; unchanged hints may skip hashing during a fast startup scan, but a full
reconciliation and every externally detected change must verify SHA-256.

Critical query paths such as Context Builder may use the index to locate
candidates, then re-read authority and compare the recorded revision before
including content. A stale row must be rejected or refreshed; it must not leak
future or deleted content into an AI request.

## 6. Database Identity And Connection Policy

Every new database is created through one `IndexDatabase` factory. Callers do
not construct `better-sqlite3` directly.

The factory applies and verifies this baseline before normal queries:

```sql
PRAGMA application_id = 0x4E534958;
PRAGMA user_version = 1;
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA trusted_schema = OFF;
PRAGMA secure_delete = ON;
PRAGMA wal_autocheckpoint = 1000;
PRAGMA journal_size_limit = 67108864;
```

Additional policy:

- The implementation must verify that `journal_mode` actually returns `wal`.
- `foreign_keys`, `busy_timeout`, `trusted_schema`, and `synchronous` are set
  on every connection; code never relies on SQLite defaults.
- New databases enable incremental auto-vacuum before creating tables. Idle
  maintenance may run bounded incremental vacuum; normal saves never run full
  `VACUUM`.
- Long-lived connections run `PRAGMA optimize=0x10002` on open and
  `PRAGMA optimize` periodically and after schema changes.
- Startup runs `quick_check`; rebuild validation additionally runs
  `foreign_key_check` and the FTS5 `integrity-check` command.
- The SQLite build must be `3.51.3` or later, or an explicitly verified fixed
  backport such as `3.50.7` or `3.44.6`, before multi-connection WAL use. The
  installed `3.53.2` passes this gate. This guards the WAL-reset race documented
  by SQLite in 2026.
- Phase 1 keeps one long-lived read/write connection per active Series and one
  serialized write lane. Additional read-only worker connections are introduced
  only with concurrency tests and bounded lifetime.

NS-602 assigns `0x4E534958` (`NSIX`) to the per-Series Novel Studio index after
checking SQLite's public application-ID registry. This identity applies only to
the derived Series index; a future `catalog.sqlite` requires its own reviewed
identity. Code never modifies SQLite's internal `schema_version`; application
schema ownership uses `user_version` and the migration table below.

## 7. Core Metadata Schema

All ordinary tables use SQLite `STRICT` mode. IDs are canonical UUID text unless
the domain already owns a stable string ID. Timestamps use UTC ISO-8601 text.
Boolean fields use integer `0/1` with `CHECK` constraints. Ordered reads always
use an explicit `ORDER BY`.

### `index_schema_migrations`

| Column | Type | Rule |
| --- | --- | --- |
| `version` | INTEGER | primary key, positive and contiguous |
| `name` | TEXT | stable migration name |
| `checksum` | TEXT | SHA-256 of the migration definition |
| `applied_at` | TEXT | diagnostic timestamp |

`PRAGMA user_version` must equal the highest applied version. A checksum change
for an applied migration is schema drift and forces a rebuild.

### `index_meta`

Small key/value records for database kind, build ID, Series ID, created time,
last successful reconciliation, complete authority-set hash, and current
projection bundle version. It does not store user settings.

### `source_files`

```text
relative_path PRIMARY KEY
entity_type
entity_id
schema_version
source_revision
content_hash
size_bytes
mtime_ms
projector
projector_version
indexed_at
```

This is the Git-index-like reconciliation ledger. Deleting or renaming a source
invalidates all rows owned by its projector in the same database transaction.

### `projector_state`

One row per projector, including `hierarchy`, `scene-text`, `codex`, `mentions`,
`planning`, `ai-audit`, `workshop-search`, and `reference-library`. Each row
records version, source-set hash, state (`ready`, `stale`, `failed`), last run,
and last diagnostic code.

### `index_runs`

Bounded diagnostic history for rebuild/reconciliation runs: run ID, mode,
start/end, status, scanned/changed/deleted/error counts, cancellation, source-set
hash, and resulting build ID. Detailed source content and stack traces are not
stored here.

## 8. Series Projection Schema

The derived schema uses canonical product terms even while authority paths keep
the compatibility names `book/act/chapter`.

### Hierarchy and manuscript

| Table | Main columns | Purpose |
| --- | --- | --- |
| `volumes` | `id`, `title`, `position`, source fields | Series Volume ordering |
| `chapters` | `id`, `volume_id`, `title`, `position`, source fields | Chapter ordering; FK to Volume |
| `acts` | `id`, `chapter_id`, `title`, `position`, source fields | Act ordering; FK to Chapter |
| `scenes` | integer rowid, stable `id`, ancestor IDs, `position`, title, status, POV, summary, plain text, counts, source fields | Scene listing, location, lightweight reads |
| `scene_blocks` | integer rowid, `scene_id`, `block_id`, `position`, kind, plain text, start/end offsets | Block-aware anchors, mentions, statistics |
| `scene_tags` | `scene_id`, normalized tag, display tag | Filter and Matrix queries |
| `scene_codex_links` | `scene_id`, `entry_id`, link kind | Explicit author links only; automatic mentions remain separate |
| `narrative_positions` | `scene_id`, Volume/Chapter/Act/Scene ordinals, global ordinal | Stable narrative projection for Progression and knowledge queries |
| `text_units` | rowid, source/block parent, kind, order, original text, search text, start/end offsets, language tag, analyzer/version, hash | Paragraph, sentence, dialogue, quote, heading, and narration units without replacing original blocks |
| `language_spans` | text unit, BCP 47 tag, start/end offsets, detector source/confidence/version | Mixed Chinese/Japanese/English spans and exact return-to-original highlighting |
| `dialogue_turns` | text unit/span, speaker entry, addressee set, speech kind, evidence, origin/status | Searchable dialogue and speaker projection; uncertain extraction stays a candidate |
| `pov_segments` | Scene/text-unit range, focal character, narration mode, evidence, origin/status | Scene- or paragraph-level point-of-view queries and knowledge checks |
| `scene_participants` | Scene, Codex entry, role, explicit/inferred origin, evidence | Character/location/object presence without treating mention alone as Canon |
| `text_metrics` | source/unit, analyzer/version, character/word/sentence/dialogue counts and bounded style features | Rebuildable repetition, pacing, sentence-length, and dialogue-ratio analysis |

Parent foreign keys use `ON DELETE CASCADE` inside the derived database. This
does not authorize deleting authority children; it only prevents stale index
rows after a validated authority deletion.

### Codex and story state

| Table | Main columns | Purpose |
| --- | --- | --- |
| `codex_entries` | `id`, `category_id`, name, description, research, policy, archived time, source fields | Entry projection |
| `codex_aliases` | `entry_id`, normalized alias, display alias, alias kind | Exact/prefix name lookup and mention candidates |
| `codex_details` | `entry_id`, `detail_type_id`, value, send-to-AI flag | Detail filters without JSON blobs |
| `codex_relations` | relation ID, source/target IDs, description, effective metadata | Relation adjacency projection |
| `codex_progressions` | progression ID, target kind/IDs, operation, effective Scene/block ordinals | Effective-state candidate lookup |
| `character_knowledge` | knowledge ID, character/subject IDs, stance, effective range | POV knowledge candidate lookup |
| `story_events` | event ID, story-time bounds/precision, discourse position, source/evidence fields | Separate story chronology from manuscript order, including flashback and uncertain time |
| `event_temporal_edges` | source/target event, before/after/overlaps relation, confidence/evidence | Partial-order timeline queries without inventing exact dates |
| `plot_threads` | thread ID, name, state, authority source | Named plot, mystery, relationship, and motif threads |
| `plot_thread_occurrences` | thread/event/Scene, setup/development/payoff/closure role, position, evidence | Unresolved setup, dormant thread, and payoff coverage queries |
| `causal_links` | source/target event, relation, evidence, origin/status | Explicit or proposed cause/consequence graph |

Effective Canon text remains a deterministic query/projection result. It is not
saved as a unique database-only snapshot. Optional materialized effective-state
rows must include all source revisions and projector version and can always be
deleted.

### Mentions and ambiguities

| Table | Main columns | Purpose |
| --- | --- | --- |
| `mentions` | source kind/ID, Scene/block, entry ID, offsets, matched text, term, alias flag | Manuscript and Codex mentions with source separation |
| `mention_ambiguities` | ambiguity ID, source kind/ID, offsets, matched text | One ambiguous range |
| `mention_ambiguity_candidates` | ambiguity ID, entry ID | Normalized candidate set; no JSON ID array |

Offsets are defined against the same deterministic plain-text projection whose
hash is stored on the row. A hash mismatch invalidates navigation rather than
guessing a new range.

## 9. Novel-Text, Multilingual, And Cross-Language Search

Novel Studio exposes one `SearchService`, but it does not force manuscript,
Codex, Workshop, and research prose through one physical FTS table or one raw
rank. The normalized catalog is:

```text
search_documents
  document_key / domain / source_id / parent_id
  source_revision / content_hash / archive+permission filters / sort keys

search_segments
  document_key / text_unit_id / field_kind
  original_text / nfc_text / compatibility_text
  language_tag / script / original start+end offsets
  analyzer_id / analyzer_version / segment_hash
```

`field_kind` distinguishes title, summary, narration, dialogue, entity name,
tag, Codex description, research body, and Workshop-visible message. It allows
author queries such as dialogue-only search and field-aware weighting without
discarding original prose.

Initial physical FTS shards are:

| Shard | Analyzer | Specialized fields |
| --- | --- | --- |
| `manuscript_cjk_fts` | trigram | title, summary, narration, dialogue, entity terms |
| `manuscript_word_fts` | Unicode word terms | same fields, with English-oriented phrase/prefix behavior |
| `reference_cjk_fts` | trigram | source title, section title, body, author/tags |
| `reference_word_fts` | Unicode word terms | source title, section title, body, author/tags |
| `codex_fts` | trigram plus normalized alias B-trees | name, aliases, description, details, Research |
| `workshop_fts` | trigram baseline | visible author/assistant message text only |

Each FTS shard has a matching ordinary external-content table and tested
insert/update/delete triggers. Creation populates content before invoking FTS
`rebuild`; validation runs FTS `integrity-check` with external-content
comparison. The query planner selects shards by domain, query script, requested
languages, and field filters, ranks inside each shard, then uses deterministic
weighted rank fusion with stable tie-breakers. It never compares unrelated raw
BM25 and vector scores as if they shared a scale.

Workshop attachment bodies remain excluded because message attachments are not
Reference Library records. Archived or permission-restricted rows stay
filterable and cannot bypass domain permissions merely because any shard
matched.

### 9.1 Original Text And Language Representation

- Authority bytes and decoded original text are preserved exactly. Search
  projections use versioned NFC text plus a separate compatibility variant;
  no normalization result is quoted as source text.
- Source, text unit, and mixed-language span use canonical BCP 47 tags such as
  `zh-Hans`, `ja`, and `en`. Declared, parser-derived, and detected languages
  are distinguishable and retain detector/version/confidence.
- The local runtime's `Intl.Segmenter` support for Chinese, Japanese, and
  English is a baseline sentence/word boundary service, not a language detector
  or Japanese morphological truth. Analyzer output is versioned and rebuildable.
- CJK spans use trigram search for continuous text. One- and two-character
  broad queries use parameterized, domain-filtered, strictly bounded fallback;
  Codex aliases use B-tree lookup first.
- Word-language spans use word/phrase/prefix search. Diacritics are preserved
  in original and primary normalized forms; optional compatibility variants
  cannot silently merge distinct names.
- `entity_aliases` adds BCP 47 tag, script, alias kind, origin
  (`author`, `source`, `deterministic-transform`, `model-suggested`), review
  state, and evidence. Author-confirmed names/aliases always outrank generated
  transliterations. Ambiguous Japanese readings or translated names remain
  separate candidates until the author confirms a mapping.

### 9.2 Cross-Language Query Plan

Cross-language means that a Chinese query can retrieve semantically related
Japanese or English original text even when no terms are shared. FTS alone
cannot provide that guarantee. The request-local `CrossLanguageQueryPlan` is:

```text
original Chinese query
  -> language/script detection and literal per-domain FTS
  -> author-confirmed entity aliases + deterministic search-only transforms
  -> optional translated query variants for selected target languages
  -> validated multilingual embedding query in the exact bound profile
  -> per-channel ranking and permission filtering
  -> weighted rank fusion + Source/Chunk deduplication
  -> original-language hit, location, match channels, and optional translation
```

Rules:

- Multilingual embedding is the primary no-shared-term cross-language channel.
  Query and documents use the exact same profile, model, dimensions,
  normalization, prefixes, and vector space. A profile is not marked
  `crossLanguageReady` until Chinese-to-Japanese, Chinese-to-English, reverse,
  mixed-language, proper-name, and negative-control fixtures pass.
- Query translation is optional lexical recall expansion, not the semantic
  foundation. It uses an application-owned versioned translation task and an
  explicitly selected model connection; the author is never required to write
  a translation prompt. It sends the query only, records model/template/version
  in the request-local plan, and never silently changes Provider.
- Raw author queries and generated variants are not persisted by default.
  Diagnostics store modes, languages, counts, latency, and redacted error code,
  not private query text.
- Result translation is a separate, explicit reading action. Sending a source
  excerpt to a model requires that Source's permission check. The translated
  display records model/profile/version and Chunk hash but cannot become an
  Evidence quote.
- Every hit returns original text, original BCP 47 language, exact
  SourceLocation/SceneBlock offsets, source revision/hash, contributing
  channels (`literal`, `alias`, `transliteration`, `query-translation`,
  `multilingual-vector`), and optional derived translation.
- With no validated multilingual profile and no explicit translation route,
  local lexical/alias/transliteration search still works. The UI reports that
  cross-language semantic retrieval is unavailable instead of claiming no
  relevant foreign-language material exists or silently calling the cloud.
- Custom Jieba/ICU FTS tokenizers and loadable extensions remain deferred until
  dependency, packaging, license, benchmark, and security review. ICU-style
  deterministic transforms may run behind the application analyzer boundary;
  the database never loads arbitrary extensions.

Both SQLite core `secure_delete=ON` and FTS5 `secure-delete=1` are enabled for
text indexes. Permanent deletion must remove derived rows in the same index
transaction, checkpoint during idle maintenance, and never claim physical SSD
forensic erasure.

## 10. AI Audit, Workshop, And Proposal Projections

Existing `ai_context_bundles` and `ai_model_calls` become typed projections
with foreign keys where the referenced derived rows are present. They index
metadata needed for audit lists, not credentials, authorization headers,
complete hidden source bodies, or Provider-private error objects.

Additional lightweight tables may project:

- `workshop_sessions`: title, kind, archive state, timestamps, source revision.
- `workshop_messages`: role, status, searchable visible content, timestamps,
  Proposal/tool linkage, source revision. Parsed attachment bodies stay out.
- `proposal_summaries`: target kind/ID, state, created/decided times, source
  linkage. Proposal patches remain JSON authority.

These tables support search and queue counts. Protocol completeness, tool
confirmation, Proposal acceptance, and audit reconstruction still re-read JSON
authority.

## 11. Reference Library Projection

M6 adds these projections only after SourceDocument/Chunk authority contracts
exist:

| Table | Main columns | Purpose |
| --- | --- | --- |
| `reference_sources` | source ID, title, author, declared/detected BCP 47 languages, type, hash, parser/detector versions, permission, status | Source filters, language coverage, and duplicate detection |
| `reference_sections` | source/section IDs, parent, order, title, location | Hierarchical navigation |
| `reference_blocks` | source/block IDs, section, order, kind, location, language summary, hash | Stable parsed structure |
| `reference_chunks` | integer rowid, source/block IDs, order, exact original/versioned search text, location JSON, dominant language, hash | Evidence-linked retrieval and FTS source |
| `reference_language_spans` | chunk ID, BCP 47 tag, original offsets, detector source/confidence/version | Mixed-language segmentation and original-text highlighting |
| `reference_tags` | source ID, normalized/display tag | Filter index |

Original files and parsed JSON records remain authority. A search result must
carry Source ID, Chunk ID, location, chunk hash, and source revision so an
analysis can cite actual text. Semantic similarity never becomes Evidence by
itself.

## 12. Embedding And Vector Boundary

The relational database stores vector provenance, not an assumed vector engine:

```text
embedding_items
  use_case
  source_kind / source_id / chunk_id
  source_revision / text_hash
  profile_id / provider / model
  dimensions / normalization
  supported_language_tags / cross_language_capability
  input_prefix_profile / analyzer_version
  cross_language_fixture_version / validation_status
  vector_store_key
  status / indexed_at
```

Actual vectors live behind a `VectorIndexAdapter`. The first implementation
must benchmark and separately decide between a sidecar store, a reviewed static
SQLite extension, or bounded in-process comparison. Novel Studio does not load
arbitrary extensions, bundle an unapproved native vector dependency, or put
vectors into JSON authority.

Changing text hash, Embedding profile, model, dimensions, or normalization
invalidates only the affected vector rows. Each use case keeps its explicit
profile binding and profile-level concurrency; there is no silent cloud
fallback.

Language coverage is capability data, not a guess from a model name. The exact
profile version records declared supported BCP 47 ranges, whether its query and
document vectors are intended to share a multilingual space, model-specific
query/document prefixes, capability source, and the last local cross-language
fixture result. `BAAI/bge-m3` is one MIT-licensed benchmark candidate because
its publisher declares more than 100 languages and long-document retrieval;
it is not selected as a mandatory dependency until Windows resource, latency,
quality, packaging, and deletion tests pass. Smaller local and explicitly
selected cloud profiles use the same capability/fixture gate.

## 13. Commit And Incremental Indexing Flow

```text
Validated author/domain command
  -> authority file transaction and atomic replacement
  -> AuthorityCommitted event {changed paths, old/new revisions}
  -> return authority success independently of index result
  -> per-Series IndexCoordinator write queue
  -> one SQLite transaction updates source ledger + domain rows + FTS
  -> mark projector ready or degraded
```

Required behavior:

- The authority commit happens first. An index failure never reverses it and
  never reports that the author's save failed.
- The API may return an `indexState` diagnostic, but ordinary author surfaces
  show only useful states such as Search rebuilding or Search unavailable.
- A failed incremental update leaves its previous source revision visible in
  `source_files`; startup reconciliation therefore detects the stale projector.
- Multiple changed files from one authority transaction enter one ordered index
  job and one SQLite transaction.
- Context and destructive commands never trust a derived foreign key as proof
  that an authority reference exists or is absent.
- External file changes are found by reconciliation. No filesystem watcher is
  the sole correctness mechanism.

## 14. Atomic Rebuild And Corruption Recovery

Rebuild never clears the live database in place.

1. Acquire the per-Series rebuild lease and keep the current index readable.
2. Scan and validate authority files; compute the source-set hash. A severe
   hierarchy/reference error stops before swap and surfaces the existing
   read-only authority diagnostic.
3. Create a unique database under `.studio/index-build/` and apply every schema
   migration from an empty file.
4. Project validated sources in bounded batches. Cancellation deletes only the
   temporary database.
5. Run `quick_check`, `foreign_key_check`, FTS external-content
   `integrity-check`, projector counts, source-set hash verification, and
   representative query smoke tests.
6. Run a final WAL checkpoint, close every handle, and ensure temporary `-wal`
   and `-shm` state is settled.
7. On Windows, rename the live database to one bounded rollback name, rename
   the validated temporary database to `index.sqlite`, reopen and verify its
   identity/build ID, then remove the old derived file.
8. If swap or reopen fails, restore the old file. Authority files remain
   untouched in every branch.

When the live database is missing, corrupt, has the wrong `application_id`, has
an unknown schema checksum, or was created by an unsupported SQLite build, the
application quarantines it with a bounded diagnostic name and starts the same
rebuild path. Editing remains available; index-backed search reports rebuilding
or unavailable instead of returning stale results.

No-op rebuild tests are invalid. Failure fixtures must contain an actually
deleted database, corrupt bytes, stale source hash, incompatible version, or
injected mid-build/swap failure.

## 15. Schema Versioning And Migration

Implementation layout:

```text
packages/storage/src/indexdb/
├─ connection.ts
├─ registry.ts
├─ coordinator.ts
├─ schema/
│  ├─ migration.ts
│  └─ migrations/
│     ├─ 0001-initial.ts
│     └─ 0002-*.ts
├─ rebuild.ts
├─ health.ts
├─ projectors/
│  ├─ hierarchy.ts
│  ├─ scenes.ts
│  ├─ codex.ts
│  ├─ mentions.ts
│  ├─ aiAudit.ts
│  ├─ workshop.ts
│  └─ referenceLibrary.ts
└─ queries/
   ├─ search.ts
   ├─ mentions.ts
   ├─ planning.ts
   └─ audit.ts
```

Migration modules export version, name, immutable SQL text, and checksum. The
build packages these TypeScript modules without a separate runtime SQL-copy
step.

Because the database is derived, migration policy is intentionally simpler
than authority migration:

- Current unversioned databases are schema version 0 and are replaced by an
  atomic full rebuild. Their rows are not migrated as unique data.
- Additive schema changes may run in place only when covered by migration,
  downgrade, interruption, and integrity tests.
- Destructive or projector-semantic changes build a new database and swap it.
- Rollback means delete/rebuild with the older application's supported schema;
  it does not restore SQLite as authority.
- Authority schema migrations remain governed by their own ADR, backup, and
  exact rollback requirements. Database migration success cannot prove an
  authority migration.

## 16. Security And Privacy

- All values are bound parameters. Dynamic SQL is limited to trusted static
  migration definitions and enumerated sort/filter fragments.
- `trusted_schema=OFF`; extension loading and arbitrary `ATTACH` are disabled.
- Database paths are resolved inside the selected library/Series root and
  reject traversal and symlink escape.
- Credentials, authorization headers, secret environment values, and complete
  unredacted Provider errors are forbidden in every table and diagnostic.
- SQLite contains plaintext manuscript/search projections. File permissions
  should inherit the private Series directory. At-rest encryption is a separate
  product/dependency decision; the plan does not pretend secure deletion equals
  full-disk encryption.
- `never` AI permission prevents embedding/provider delivery, not local keyword
  search. Query and Context Builder permission checks remain separate and
  explicit.
- Query translation sends only the author's query and only through an explicit
  model binding allowed for the current Series. Translating a result sends
  source text and therefore additionally requires the Source's model-delivery
  permission. Neither path persists raw query/source text in database logs.
- Permanent deletion removes derived rows and FTS terms, but historical audit
  snapshots protected by product rules may still retain the minimum authorized
  record. The UI must explain a blocker rather than bypass it through SQL.

## 17. Health And Operational States

Index health is one of:

| State | Meaning | Product behavior |
| --- | --- | --- |
| `ready` | identity, schema, source hash, integrity checks valid | normal queries |
| `stale` | authority changed or projector version advanced | authority works; refresh queued |
| `rebuilding` | temporary database is being generated | current valid index may remain readable; otherwise search unavailable |
| `degraded` | incremental index update failed | author write remains successful; affected search is disabled or marked stale |
| `corrupt` | SQLite/FTS integrity failed | quarantine and rebuild; never auto-repair authority |
| `authority-invalid` | source JSON/reference graph failed validation | enter existing authority diagnostic/read-only behavior; do not swap a partial index |

Logs record IDs, counts, durations, schema/projector versions, and error codes,
not private text. A future Settings diagnostics page may expose rebuild and
health actions without placing database terminology in the writing interface.

## 18. Performance And Resource Gates

Exact budgets are frozen only after a baseline benchmark, but implementation
must measure these scenarios from the start:

- Two million Chinese manuscript characters, several thousand Scenes, a large
  Codex, and a large Reference Library.
- Scene save while a full rebuild, FTS merge, or embedding job is active.
- One/two-character Chinese search, three-plus-character trigram search, Codex
  alias lookup, Japanese CJK search, English word/phrase search, filtered
  reference search, and Context candidate lookup.
- Chinese-to-Japanese, Chinese-to-English, reverse-language, mixed-language,
  proper-name, false-friend, and irrelevant-negative cross-language retrieval
  with each candidate profile and chunk size.
- Startup fast reconciliation, full hash reconciliation, deleted database
  rebuild, and atomic swap on Windows.

Provisional acceptance targets:

- Authority save never waits for full rebuild, embedding, `VACUUM`, or FTS
  optimization.
- Incremental indexing of one ordinary Scene completes in one bounded job and
  does not visibly block typing.
- Search returns its first bounded page within 150 ms p95 on the M8 reference
  fixture after warm-up; broader short-query scans may report that the query is
  too broad rather than freezing the process.
- Full rebuild progress is cancellable, restart-safe, and never exposes a
  partially built database.
- Connection count, WAL size, database size, source count, stale count, and job
  duration have test-visible diagnostics without telemetry.

## 19. Implementation Sequence

### NS-602: Database kernel and Research source vertical slice

- Extract `IndexDatabase`, migration registry, connection policy, version gate,
  health checks, and per-Series coordinator.
- Recreate the current Scene/Codex/mention/AI behavior behind the new boundary.
- Replace live-table clearing with temporary-build validation and atomic swap.
- Treat current `user_version=0` databases as rebuildable legacy indexes.
- Add SourceDocument JSON authority and managed original-file storage for the
  first proven TXT/Markdown import path, with revision-safe property updates.
- Enable the independent `/research` app-shell workspace with real upload,
  source list, parse state, original preview, and property management. Formats,
  search modes, and lifecycle controls without real commands remain absent.

### NS-603: Novel-text projections and language-aware unified search

- Add source ledger, projector versions, canonical hierarchy tables, block
  projection, paragraph/sentence/dialogue units, language spans, POV/dialogue/
  participant projections, story-time/plot-thread projections, normalized
  aliases/details/ambiguities, and external-content FTS shards.
- Preserve existing API behavior and Chinese search, including short queries;
  add Japanese CJK, English word/phrase, mixed-language, field-restricted, and
  author-confirmed multilingual entity-alias search.
- Move index SQL and queries out of the oversized repository module.

### NS-604: Reference Library original-language database

- Extend the NS-602 SourceDocument path to DOCX, text PDF, EPUB, and HTML, and
  complete Section/Block/Chunk authority for all six formats.
- Add evidence-linked reference projections, BCP 47 source/unit/span language,
  CJK and word FTS filters, locations, permissions, import rebuild, and
  malicious/damaged/mixed-language fixture coverage.

### NS-605: Library catalog and cross-language retrieval

- Add rebuildable cross-Series catalog only for proven Library query needs.
- Select and document the vector engine after benchmark, packaging, license,
  extension-security, cancellation, and deletion tests.
- Add multilingual capability metadata and fixture validation to Embedding
  profiles; implement multilingual vector retrieval, optional versioned query
  translation, deterministic rank fusion, match-channel disclosure, and
  optional permission-gated result translation.
- Keep Embedding profile routing, language-pair validation, and vector
  provenance explicit. No model or translation Provider is selected silently.

Each implementation task requires its own task and acceptance record. NS-602
implements the first kernel, atomic replacement, and TXT/Markdown source slice;
the richer source ledger, text analyzer, complete format pipeline, library
catalog, and cross-language retrieval remain NS-603 through NS-605 work.

## 20. Acceptance Blueprint

Every implementation slice maps exact tests before code. The complete database
program must eventually prove:

1. Creation from an empty Series and compatibility rebuild from a real
   unversioned current index.
2. Deletion of every derived database followed by complete rebuild from JSON
   and managed Source files.
3. Corrupt SQLite, corrupt FTS shadow data, wrong identity, unknown version,
   migration checksum drift, duplicate IDs, missing parents, and stale hashes.
4. Injected failure and cancellation during scan, projection, validation,
   checkpoint, swap, reopen, and cleanup, with no authority mutation and no
   partial live index.
5. One writer with concurrent reads, bounded busy handling, WAL checkpoint, and
   minimum fixed SQLite version enforcement.
6. Chinese/Japanese short and trigram search, English word/phrase search,
   mixed-language span offsets, escaped FTS syntax, field filters,
   archive/permission behavior, and deterministic ordering.
7. FTS/content consistency, foreign keys, quick check, source-set hash, and
   query-to-authority revision verification.
8. Permanent deletion and secure-delete behavior without credential or hidden
   attachment leakage.
9. M8 performance fixture results for startup, save, search, rebuild, memory,
   database size, and WAL growth.
10. Backup restore into a new directory with all derived databases absent,
    followed by successful rebuild.
11. Chinese queries retrieving relevant Japanese and English originals without
    shared terms using a validated multilingual profile, plus reverse,
    mixed-language, proper-name, false-friend, and negative controls.
12. Exact-only degradation without a validated cross-language route; alias and
    transliteration provenance; query/result translation permission; match-mode
    disclosure; and original-text citation after optional translation.

## 21. Open Decisions Before Runtime Implementation

- Decide whether `catalog.sqlite` is needed in NS-605 or whether bounded file
  scanning remains sufficient for the first Library release.
- Benchmark trigram size and one/two-character fallback before considering a
  reviewed custom Chinese tokenizer.
- Freeze the `TextAnalyzer` normalization/segmentation versions and decide
  whether deterministic ICU transforms require a new dependency after the
  Chinese/Japanese/English mixed-text benchmark.
- Select the vector engine and default multilingual profile only after the
  Reference Library chunk fixture, real Embedding profiles, local Windows
  resource measurements, and cross-language quality gates exist.
- Decide whether optional at-rest encryption belongs in a later security
  milestone. It is not silently added to the database dependency chain.

These decisions do not block NS-602's database kernel because that phase keeps
all existing query semantics and changes only ownership, versioning, health,
and rebuild safety.
