# NS-601 Acceptance Record

Status: complete
Task: `docs/tasks/NS-601.md`
Updated: 2026-07-19

The planned hierarchy projection uses the canonical author-facing order
`Series → Volume → Chapter → Act → Scene`; legacy storage names remain an
adapter-only compatibility detail.

## Acceptance Matrix

| ID | Status | Proof type | Exact evidence target | Actual result |
| --- | --- | --- | --- | --- |
| NS-601-A01 | passed | source/read-only inspection | `packages/storage/src/index.ts`, `packages/storage/src/aiFiles.ts`, package lock, local `sqlite_version()`, and read-only Series PRAGMAs/schema | Current implementation uses MIT `better-sqlite3` 12.11.1 with SQLite 3.53.2; five inspected Series databases are WAL, `quick_check=ok`, `user_version=0`, `application_id=0`; current schema and unsafe live-clear rebuild are inventoried without reading indexed content |
| NS-601-A02 | passed | architecture/source | `docs/architecture/DATABASE_ARCHITECTURE.md` sections 1, 4, 5; ADR-0018 decisions 1-2 | JSON and managed Source files remain authority; Series, catalog, FTS, vector, statistic, and cache databases are explicitly rebuildable |
| NS-601-A03 | passed | primary-source review | Official SQLite WAL/FTS5/PRAGMA/strict-table, Unicode normalization, BCP 47, ICU transform, ECMAScript `Intl.Segmenter`, Git index, calibre API, and multilingual model-card sources linked from the plan | Adopted one-writer WAL, checksummed source ledger, external-content domain/analyzer FTS, original/normalized separation, BCP 47 identity, versioned analyzer boundary, validated multilingual capability, and normalized query facade; rejected authority/database, pretranslated-source, and immediate native-extension interpretations |
| NS-601-A04 | passed | architecture review | `docs/architecture/DATABASE_ARCHITECTURE.md` sections 4-12 and 16 | Topology, PRAGMAs, version gate, metadata/core/novel-text/narrative/reference tables, CJK/word search shards, cross-language query plan, vector provenance, and security boundaries are specified |
| NS-601-A05 | passed | architecture review | `docs/architecture/DATABASE_ARCHITECTURE.md` sections 13-15 and 17; ADR-0018 decisions 8-10 | Authority-first incremental projection and temporary-build atomic swap cover missing, stale, corrupt, wrong-identity, unsupported, cancelled, and failed index states |
| NS-601-A06 | passed | architecture review | `docs/architecture/DATABASE_ARCHITECTURE.md` sections 15-18 and 20; ADR migration/rollback/validation | Derived schema rebuild, backup exclusion, secure deletion limits, performance fixture, and adversarial cases are explicit |
| NS-601-A07 | passed | task/traceability review | `docs/architecture/DATABASE_ARCHITECTURE.md` section 19 and M6 traceability | NS-602 kernel plus TXT/Markdown Research page vertical slice, NS-603 novel-text/language-aware search, NS-604 remaining formats/original-language Reference Library, and NS-605 catalog/cross-language retrieval are ordered and remain unimplemented |
| NS-601-A08 | passed | automated/source | documentation checks, governance tests, diff check, final worktree inventory | After the novel-text/cross-language expansion, `npm.cmd run docs:check` passed 168 Markdown files; seven documentation-governance tests passed; `git diff --check` returned no whitespace error; branch/base and mixed dirty state remain recorded below |
| NS-601-A09 | passed | product/architecture review | `docs/architecture/DATABASE_ARCHITECTURE.md` sections 8-9; ADR-0018 decisions 12-13; Product/Codex/Reference Library invariants | Plan now projects paragraph/sentence/dialogue/quote/narration units, exact offsets, language spans, dialogue/POV/participants, story-time, plot threads, setup/payoff, causality, metrics, and evidence-bearing candidate state; accepted semantics still require JSON/Proposal authority |
| NS-601-A10 | passed | product/architecture/primary-source review | Product P-06, `docs/product/REFERENCE_LIBRARY_SPEC.md` sections 4-5 and 10, database plan sections 9/12/18-20, Unicode/BCP 47/ICU/ECMA/SQLite/model-card references, adversarial rows below | Chinese query to Japanese/English original uses literal/alias/transform/optional-translation/validated-multilingual-vector channels, deterministic fusion, permission checks, exact-only degradation, channel disclosure, and original-language Evidence |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Current Read-Only Inventory

- Driver declaration: `packages/storage/package.json` allows
  `better-sqlite3 ^12.4.1`; `package-lock.json` resolves `12.11.1`, MIT.
- Local native engine: `select sqlite_version()` returned `3.53.2`, newer than
  SQLite's `3.51.3` WAL-reset fix.
- Local Node `v24.15.0` exposes `Intl.Segmenter` and reports support for
  `zh-Hans`, `ja`, and `en`; it is accepted only as a versioned sentence/word
  boundary baseline, not language detection or Japanese morphological truth.
- Five existing Series database files were inspected read-only. Sizes ranged
  from 81,920 to 155,648 bytes. Every `quick_check` returned `ok`; every
  database reported WAL mode, `user_version=0`, and `application_id=0`.
- The latest schema has 27 schema objects and includes Scene/Codex FTS5 shadow
  tables, mentions, ambiguities, Context Bundle metadata, and model-call
  metadata. Older Series databases have 21 objects before the AI index tables.
- No table content, manuscript text, credential, attachment body, Provider
  request, or secret was read for this inventory.

## Required Commands

```powershell
node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); console.log(db.prepare('select sqlite_version() as version').get()); db.close();"
node -e "console.log({node:process.version, segmenter:typeof Intl.Segmenter, locales:Intl.Segmenter.supportedLocalesOf(['zh-Hans','ja','en'])})"
npm.cmd run docs:check
node --test tests/docs/docs-check.test.mjs
git diff --check
git status --short --branch
```

## Adversarial Coverage Blueprint

| Risk | Fixture/scenario | Expected result | Evidence |
| --- | --- | --- | --- |
| Current index mistaken for authority | Delete current `user_version=0` index | Complete rebuild from JSON; no project loss | Planned NS-602 |
| Live rebuild becomes partial | Inject failure/cancel after projected batches | Temporary database removed; live index unchanged | Planned NS-602 |
| Corrupt database/FTS | Invalid header, damaged FTS shadow data, wrong application ID | Quarantine, disable stale query, rebuild; no authority rewrite | Planned NS-602/603 |
| Schema drift | Unknown `user_version` or changed applied checksum | Refuse normal open and rebuild from authority | Planned NS-602 |
| Stale query result | Authority revision/hash differs from source ledger | Refresh or reject candidate before critical use | Planned NS-602/603 |
| Missing/duplicate hierarchy | Broken parent member list and duplicate IDs | Authority diagnostic; no partial index swap | Planned NS-602/603 |
| Writer/checkpoint race | Concurrent reads, write, and checkpoint on fixed SQLite | One serialized writer, bounded busy behavior, valid integrity result | Planned NS-602 |
| Chinese search regression | One/two-character and trigram queries with quotes/operators | Literal bounded results, escaped syntax, deterministic order | Planned NS-603 |
| Japanese/English analyzer mismatch | Japanese continuous text, English phrase/prefix, mixed-language paragraph | Correct analyzer shards, original offsets/highlights, deterministic field weighting | Planned NS-603/604 |
| Language detection drift | Wrong/unknown/mixed BCP 47 detection or detector upgrade | Original preserved; declared/detected/confidence/version visible; only affected projections rebuild | Planned NS-603/604 |
| Proper-name ambiguity | Japanese kanji, multiple readings, romaji, Chinese translation, English alias | Author-confirmed alias outranks generated variants; ambiguous entities remain separate | Planned NS-603/605 |
| Cross-language false positive | False friends, shared kanji with different meaning, unrelated fluent-looking passages | Negative controls stay below threshold; semantic channel never presented as direct evidence | Planned NS-605 |
| Cross-language no shared term | Chinese concept query against relevant Japanese/English originals | Validated profile retrieves originals and records language, channel, profile/version, hash/location | Planned NS-605 |
| Unvalidated model overclaim | Model declares multilingual support but fails one language-pair fixture | Profile is not `crossLanguageReady`; exact/alias search continues with honest capability state | Planned NS-605 |
| Translation becomes evidence | Query/result translation differs materially from original | Translation stays derived and labeled; citation/export/Research Evidence uses original Chunk/hash/location | Planned NS-605 |
| Translation privacy leak | Query translation and result translation with restricted Source/provider policy | Query-only path sends no source; result path is blocked without Source permission; no silent Provider fallback | Planned NS-605 |
| Deleted sensitive text survives FTS | Delete indexed Scene/Chunk then inspect terms | Core and FTS secure-delete behavior proven without overclaiming disk erasure | Planned NS-603/604 |
| Permission leakage | `never` Source matched by FTS and selected for AI | Local search allowed; embedding/Context delivery denied | Planned NS-604 |
| Vector profile drift | Changed model, dimensions, normalization, or chunk hash | Only affected vectors invalidated and rebuilt | Planned NS-605 |
| Restore depends on cache | Backup omits SQLite/vector sidecars | Restored Series opens and fully rebuilds derived state | Planned NS-602/605 and M7 |
| Main thread stalls | M8-scale rebuild and search while saving Scene | Save remains independent; job is cancellable and measured | Planned NS-602/603 and M8 |

## Run Ledger

| Date | Commit/worktree | Command or manual procedure | Result |
| --- | --- | --- | --- |
| 2026-07-18 | `codex/ns-514-overview`, uncommitted mixed worktree preserved | Source inspection of current DDL, rebuild, FTS queries, package versions, and five existing database headers/schema objects | Inventory completed read-only; no database row content or authority file changed |
| 2026-07-18 | official primary documentation | Review SQLite WAL, FTS5, PRAGMA, strict tables; Git index format; calibre database API | Patterns and current WAL version risk recorded in the architecture plan and ADR |
| 2026-07-18 | author-directed NS-601 expansion | Add novel-text specialization and Chinese-query-to-Japanese/English cross-language retrieval; review Unicode normalization, BCP 47, ICU transforms, ECMA-402 segmentation, SQLite language/search controls, and BGE-M3 as a non-binding multilingual benchmark candidate | Product, Reference Library, traceability, architecture, ADR, task, and adversarial acceptance records expanded; no model/dependency/runtime selected |
| 2026-07-18 | NS-601 documentation worktree | `npm.cmd run docs:check` | Passed for 168 Markdown files |
| 2026-07-18 | NS-601 documentation worktree | `node --test tests/docs/docs-check.test.mjs` | Passed 7 tests; 0 failed, cancelled, skipped, or todo |
| 2026-07-18 | NS-601 documentation worktree | `git diff --check` | Exit 0; no whitespace errors; Git printed only existing LF-to-CRLF checkout warnings |
| 2026-07-18 | NS-601 documentation worktree | `git status --short --branch`; `git rev-parse --short=12 HEAD` | Branch `codex/ns-514-overview`; base `5981d384c44c`; mixed NS-514/NS-601 worktree remains uncommitted |
| 2026-07-19 | NS-601 scoped closure | `npm.cmd run docs:check`; `node --test tests/docs/docs-check.test.mjs`; `git diff --check` | Documentation check passed for 168 Markdown files; all 7 governance tests passed; diff check exited 0 with only line-ending conversion warnings |

## Final Repository State

- Branch: `codex/ns-514-overview`.
- Starting commit: `5981d384c44c`; the scoped closure uses commit subject `NS-601 docs(database): plan novel-text retrieval`.
- Worktree: pre-existing uncommitted NS-514 implementation and records are
  preserved; NS-601 adds only its planned documentation and entry-document
  updates.
- NS-601 closure paths are the task and acceptance records, ADR-0018, the
  database plan, three architecture entry documents, Product/Reference
  Library/experience/M6 specifications, the documentation check and its
  regression test, operational status/index records, and only the pause-status
  lines from the two NS-514 records. Shared NS-514 implementation evidence is
  excluded from the NS-601 commit.
- Unrelated preserved files: all existing NS-514 implementation changes and
  pre-existing `data/library/`; no database file was modified.

All NS-601 acceptance IDs A01-A10 pass. This record, the accepted architecture,
and the task-owned entry-document changes are committed together as the scoped
NS-601 planning closure. No NS-602 runtime capability is claimed here.
