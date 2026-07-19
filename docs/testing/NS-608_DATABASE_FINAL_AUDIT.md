# NS-608 Final Database Implementation Audit

Date: 2026-07-20
Status: complete
Task: `docs/tasks/NS-608.md`
Acceptance: `docs/testing/NS-608_ACCEPTANCE.md`
Reviewed through: A10 commit `d611dd6` plus the A11 worktree

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Executive Conclusion

Novel Studio now has a real, locally authoritative, library-scoped Research
Database and a real selective model-retrieval path. It is not an empty upload
surface and it does not put every related file or every matched Chunk into the
model prompt. Multiple databases own separate JSON Source authority, managed
originals, parsed content, lexical indexes, vector sidecars, permissions, and
damage state. Workshop activates an explicit per-session database set and lets
the selected model call three bounded read-only tools; exact author confirmation
still gates every current Codex write.

The implemented slice meets the NS-603 through NS-608 boundaries after the
defects in this report are fixed. It does **not** complete the full Reference
Library product specification. Research Notes, Source and Research Database
archive/permanent-delete, source replacement/reparse, authority backup/restore,
OCR, legacy `.doc`, and query translation have no working command or UI. Those
gaps are listed as unimplemented work, not described as degraded completed
features. The current code has no known open P0 authority-loss or permission-
bypass defect in the reviewed scope. Author-only visual decisions remain open
where their acceptance records say so.

## Review Method

This conclusion was not inferred from the existing test count. The audit used:

- line-by-line source-to-sink review of Research authority, parsing, lexical and
  vector indexing, multi-database fusion, model tool policy, Workshop run
  lifecycle, citations, and the connected Research/Workshop/Codex UI;
- production constructor and route inventories, forbidden-path searches, and
  comparison of current code against product specifications and ADR-0019
  through ADR-0023;
- independent temporary-root HTTP/disk performance probes, real saved-key
  `deepseek-v4-pro` trials, and a real in-app browser workflow;
- new adversarial fixtures larger than the internal candidate windows, followed
  by focused regression runs and sequential package builds;
- byte-count and repository-state checks that never mutate or stage the real
  `data/library/` authority.

## Requirement Audit

| Scope | Implemented and directly verified | Missing or bounded |
| --- | --- | --- |
| Library ownership and isolation | Research Database authority lives under a library-level UUID root; creation works without an active Series; names are revision-safe; one database may link to several Series; same-hash Sources in different databases, index identity, search results, permissions, and damage remain isolated | Database archive, permanent delete, merge, export, and backup are absent; the deletion-blocker read path exists but there is no destructive command |
| Source authority and formats | SourceDocument version 3 atomically binds exact original bytes, SHA-256, parsed-content authority, parser identity, properties, and revision. TXT, Markdown, DOCX, text PDF, EPUB, HTML/XHTML, and one controlled web snapshot are real paths. Empty, oversized, disguised, damaged, unsafe ZIP, external-file, active-HTML, private-network, redirect, and image-only PDF inputs fail before authority creation | Legacy binary `.doc`, OCR/scanned PDF, source replacement, reparse/refresh, archive, and permanent delete are absent. The hard input ceiling is 25 MiB, not unlimited |
| Large text and navigation | Plain-text parsing is linear and splits Blocks at 16,000 characters; UI reads forty-Block pages and opens the exact cited Block/term. A 25 MiB, 1,639-Block, 22,938-Chunk production import/search probe passes | Import and index work still execute in the server process; there is no background job/progress service for larger future limits |
| Lexical retrieval | Each database has an identity-bound rebuildable SQLite index with Source revision ledger, Section/Block/Chunk/language projections, CJK trigram and Unicode-word FTS, literal fallback, filters, exact locations, and original text/hash citation identity | There is no morphological Japanese analyzer or versioned query-translation channel. Short/literal scans and some metadata filtering remain synchronous SQLite work |
| Hybrid and cross-language retrieval | Explicit selection of one to twelve databases fans out without a shared global catalog. Database-local aliases/transliterations, a validated `research.multilingual` profile, isolated `sqlite-vec` sidecars, disclosed channels, deterministic fusion, stale cursors, partial-database issues, and exact-original citations are implemented. No Provider fallback fabricates semantic availability | A validated multilingual embedding profile is required for no-shared-term recall. Query translation is explicitly unbound. Embedding profile creation/lifecycle is not yet a complete Settings workflow |
| Model retrieval gateway | `research.list_sources`, `research.search`, and `research.open_passage` are the only model read tools. Active database IDs, Source permission, exact prior citation, result/page limits, call/output/no-progress budgets, cancellation, and redacted audit are server-owned. Unknown, malformed, duplicate-scope, forged, inactive, denied, stale, and model-owned-limit requests fail closed | Research import, property, lifecycle, note, and write commands are intentionally not model tools |
| Workshop integration and harness | Session authority stores an empty-default explicit activation snapshot. General Chat and Agent can retrieve iteratively only with native tool support; the initial prompt contains database metadata and definitions, not Source bodies. Research reads are automatic and bounded; Codex writes are separate native tool calls with exact confirmation. Real multi-turn trials grade authority outcome, trajectory, citations, corrections, duplicate writes, cancellation, and safety across independent sessions | Current writes cover Codex entry create/update and Progression operations only. Broad Tool Plans/Grants, Research Notes, Relations, Character Knowledge, and automatic source-to-Canon promotion remain absent |
| Recovery and integrity | Source transactions, migration rollback bytes, lexical/vector atomic rebuild, foreign identity, stale revisions, changed authority signatures, FTS/vector divergence, cancellation, restart interruption, permission revocation, database deactivation, and no-replay behavior are verified. Missing or damaged derived indexes rebuild from authority | Writer/rebuild lanes are process-local; path containment is lexical rather than symlink/junction-safe; one damaged Source authority currently makes that database's Source list unavailable rather than returning healthy Sources plus a per-Source diagnostic |
| Performance | On the declared machine, exact 25 MiB import is 6,353.49 ms and twenty-query P95 is 54.79 ms; 4,096 Chunks at 384 dimensions build in 401.45 ms with 35.56 ms P95 and 37,703,680-byte measured peak RSS increase. All fixed A09 targets pass without relaxation | These are regression gates on one machine, not universal hardware promises. Million-Chunk, simultaneous-import, and multi-process writer behavior are not proven |
| UI truthfulness | Research is an independent workspace with no-Series creation, explicit database selection, scoped Source shelf, real upload/web import, paged original view, properties/permission, exact/hybrid controls, capability/index state, labeled evidence, retries, dirty-state guards, and responsive layouts. Workshop citations open immutable evidence. Confirmed Workshop Codex writes now refresh Codex without page reload | No UI pretends that Source/Database delete, Research Notes, OCR, `.doc`, query translation, or backup exists. Several author-only visual gates remain manual |

## Confirmed Defects And Repairs

| ID | Severity | Confirmed defect | Repair and retained evidence |
| --- | --- | --- | --- |
| NS608-DB-01 | P1 | Per-character locale normalization during Block and Chunk language analysis made a valid 25 MiB import take 60,215.88 ms; every exact query also reread full parsed authority and reran complete SQLite/FTS validation, producing 1,570.11 ms P95 | Language analysis now streams code points and normalizes declared language once. Source verification and deep index validation are cached only for unchanged authority/index artifact signatures. The final exact probe passes at 6,353.49 ms import and 54.79 ms P95; changed files still force full verification |
| NS608-DB-02 | P1 | Lexical channels and literal fallback truncated to 500 candidates before applying model permission and metadata filters. A large forbidden or nonmatching Source could hide a valid later result and make the model receive a false empty answer | Permission, Source kind, language, tag, and author predicates now run in SQL before each bounded candidate window. A new 501-Chunk adversarial fixture returns the one permitted matching Source and excludes every denied Chunk |
| NS608-DB-03 | P1 | Vector retrieval requested only the nearest 100 rows and applied metadata filters afterward. A valid semantic result outside that unfiltered window disappeared | Vector search now expands the nearest-neighbor window geometrically until it has enough filtered evidence or reaches the complete sidecar, preserving distance order and the public result limit. A new fixture with 120 nearer wrong-kind rows retrieves the later matching result |
| NS608-WF-01 | P1 | DeepSeek thinking mode could receive a final continuation that referenced removed tool history after Research exhaustion; strict all-term lexical behavior also discarded useful longer original-language queries | Exhaustion now uses a fresh tool-free finalization prompt containing only bounded quoted evidence. Longer multi-term queries require at least two terms and half coverage while short queries remain strict. Three independent cross-language trial batches and loop regressions pass |
| NS608-WF-02 | P1 | Natural author write intent could end as prose, rewritten same-target creates and immediate create-to-update echoes could request duplicate writes, and replacement guidance could restore rejected values | Agent prompt and server policy now preserve natural corrections, require canonical final replacement values, suppress semantic same-target replay, and continue after confirmed results. Three independent eight-turn trials produce exactly one create and one later update with only corrected authority |
| NS608-WF-03 | P2 | One Provider failure aborted the remaining real-model trials; cause-wrapped network failures were exposed as an unknown classification; conflicting-source rules were too implicit | The harness records each trial independently, sanitizes public failure evidence, and continues the batch. Network cause chains map to retryable Provider-unavailable errors, and Agent prompt version 3 preserves source/language disagreement and false friends. Six five-turn balanced/conflict trials pass |
| NS608-UI-01 | P1 | Workshop saved a confirmed Codex entry, but the continuously mounted Codex workspace retained its old list until page reload | The application propagates a Codex-authority revision after confirmed Workshop writes and reloads Codex for that revision. Forty-nine focused Web tests pass, and the fresh real-browser rerun shows `1 active` plus the saved entry without reload |
| NS608-OPS-01 | P2 | The first browser fixture was forcibly terminated and left one fixture-owned temporary root | The fixture now exposes a graceful shutdown endpoint; the fresh rerun removed its temporary root and left health unreachable. The earlier root remains untouched because deletion requires explicit authorization |

## Evidence Separation

| Evidence class | What it proves | What it does not prove |
| --- | --- | --- |
| Source audit | Current runtime entry points, authority ownership, filters, policy, and failure handling exist as reviewed | That every future input or machine behaves identically |
| Automated regressions | Exact schemas, transactions, retrieval identity, recovery, and newly reproduced defects remain fixed | Author visual acceptance or real Provider quality |
| Independent probes | Production HTTP/storage/index paths meet declared sizes, identity, hashes, timings, RSS, disk, cancellation, and rebuild checks | Universal benchmarks or backup recovery |
| Saved-key trials | The author's existing DeepSeek connection, projected only as `deepseek-v4-pro`, completes independent multi-turn author tasks without secret/library mutation | Every Provider model, account, network condition, or creative genre |
| Diagnostic browser inspection | Connected citation, confirmation, cancellation, session switching, live Codex refresh, and desktop/mobile layout work in the inspected build | The author's explicit A13 acceptance decision |

## Open Risks

| Risk | Priority | Current consequence |
| --- | --- | --- |
| Research Notes and source-to-Canon Proposal are absent | P1 product gap | Authors can retrieve and cite sources or manually create confirmed Codex entries, but cannot maintain first-class evidence-bound Research Notes as specified |
| Source and Research Database lifecycle commands are absent | P1 product gap | Imports can accumulate; there is no supported archive, permanent delete, source replacement, or reparse workflow despite the preparatory deletion-blocker read path |
| Writer and rebuild coordination is process-local | P1 integrity risk | Ordinary startup prevents duplicate service launches, but a manually launched second writer is not protected by an operating-system lock or lease |
| Parser/index/embedding jobs run in the service process | P1 availability risk | Current targets pass, but a future larger corpus, slow parser, or deep integrity operation can delay unrelated requests; there is no durable job progress/cancellation surface |
| Source-list corruption granularity is database-wide | P1 recovery risk | One malformed Source authority causes that database's Source listing to fail; sibling databases remain usable, but healthy Sources in the same database are not returned with individual diagnostics |
| Authority backup/restore drill is absent | P1 recovery gap | Derived indexes rebuild, but JSON authority and managed originals have no checksum manifest, scheduled snapshot, restore verification, or disaster rehearsal |
| Filesystem containment is lexical | P1 local-security risk | UUID/path validation blocks traversal, but symlink or junction substitution races are not rejected by realpath/no-follow enforcement |
| Query translation is absent | P2 retrieval gap | Alias/transliteration and validated multilingual embeddings work; environments without a usable embedding profile cannot recall unrelated cross-language vocabulary |
| OCR and legacy `.doc` are absent | P2 format gap | Text PDF and DOCX work; scanned PDFs fail honestly and old binary Word files require conversion outside the app |
| Embedding profile lifecycle is incomplete in Settings | P2 usability gap | Research can validate/use the current binding, but authors do not yet have one complete Settings-managed embedding-profile workflow |
| Author visual acceptance remains open | manual gate | Diagnostic browser evidence cannot close NS-604 A14, NS-605 A12, NS-607 A15, or NS-608 A13 |

## Recommendations

Recommendations are not completed behavior until separately accepted and
implemented.

| Order | Recommendation | Reason and dependency |
| --- | --- | --- |
| R1 | Implement first-class Research Notes with immutable Source/Chunk evidence identity, stale-evidence state, and a separate Proposal-gated `Move to Codex` action | This is the largest missing novel-writing knowledge function and prevents retrieved evidence from becoming an unaudited story fact |
| R2 | Implement revision-safe Source archive/delete/replace/reparse and Research Database archive/delete, using the existing Workshop-reference blocker and exact derived-index cleanup/rebuild | Closes the current lifecycle dead end; deletion must account for Workshop sessions, Notes, citations, migrations, indexes, and backups before any bytes are removed |
| R3 | Add per-Source list diagnostics and recovery actions | One damaged Source should not hide healthy Sources in the same database, while the damaged authority must remain visible and unmodified |
| R4 | Add an operating-system-visible single-writer lease and move parse/index/vector work behind durable bounded jobs | Closes cross-process races and keeps long operations from blocking ordinary author work; jobs need restart reconciliation and honest progress |
| R5 | Add authority/original checksum manifests, versioned snapshots, restore into a new library, and a destructive disaster drill | Rebuildable indexes are not backups; the author needs proof that novel and reference authority can be restored independently |
| R6 | Add a versioned optional query-translation channel only after provenance, cache, cost, cancellation, and original-evidence rules are accepted | Improves cross-language recall when embeddings are unavailable without letting translated text replace the original citation |
| R7 | Complete embedding profile creation, testing, binding, replacement, and archive in Settings | Makes hybrid retrieval operable without hidden/manual profile setup and keeps generation and embedding credentials distinct |
| R8 | Add optional OCR and legacy `.doc` conversion behind isolated resource-bounded workers | Expands real-world format coverage without weakening current parser and network safety boundaries |
| R9 | Split the Research repository, index, lifecycle, and Workshop evidence domains out of `packages/storage/src/index.ts` when the next scoped task touches them | Reduces review cost and accidental cross-domain coupling without changing authority contracts |

## Final Truthful Boundary

The Research Database is currently usable for multiple isolated source shelves,
large supported documents, exact and validated hybrid cross-language retrieval,
selective model tool use, citations, and author-confirmed Codex follow-up. It is
not yet the complete text-specialized novel knowledge system described by the
full product specification because evidence-bound Research Notes, lifecycle,
backup, and several format/recovery capabilities remain open. Any roadmap or UI
claim that calls the whole Reference Library complete before those rows close
would be an overstatement.
