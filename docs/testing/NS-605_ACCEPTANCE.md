# NS-605 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-605.md`
Decisions: `docs/adr/0021-tool-driven-research-retrieval.md`; `docs/adr/0022-isolated-research-vector-index.md`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| Acceptance ID | Status | Verification | Required evidence |
| --- | --- | --- | --- |
| NS-605-A01 | passed | specifications and ADRs | Product, UX, Reference Library, traceability, architecture, security, ADR-0021/0022, task, dependency, and acceptance records agree before runtime edits; documentation check passes for 188 Markdown files |
| NS-605-A02 | planned | contract tests | strict alias/capability/vector/multi-search schemas reject duplicate database IDs, malformed channels, unbound cursors, missing provenance, and unbounded inputs |
| NS-605-A03 | planned | storage authority tests | per-database alias authority is atomic, revision-safe, restart-stable, isolated, normalized, and damage-reporting |
| NS-605-A04 | planned | vector-index tests | the isolated rebuildable sidecar pins database/profile/model/dimension/normalization/text/source provenance and safely rebuilds, cancels, deletes, and rejects foreign/damaged state |
| NS-605-A05 | planned | retrieval tests | only explicit databases participate; deterministic fusion, deduplication, source diversity, relevance threshold, filters, cursor pagination, and healthy-sibling partial results pass |
| NS-605-A06 | planned | multilingual capability tests | the exact bound profile passes Chinese/Japanese/English positive and negative fixtures before semantic use; invalid/unavailable profiles disclose exact-only degradation |
| NS-605-A07 | planned | server and security tests | routes bound input and work, map errors, redact Provider text, preserve permissions, and never silently translate, embed, or fall back through another Provider |
| NS-605-A08 | planned | `apps/web/src/features/research/ResearchDatabaseWorkspace.ns605.test.tsx` | scope/mode controls, alias management, capability/vector state, database-labeled results, channel explanations, issues, pagination, exact open, dirty-state guards, and recovery are real |
| NS-605-A09 | planned | real browser workflow | two isolated databases return labeled original-language evidence for Chinese-to-Japanese/English, reverse, mixed, proper-name, false-friend, and negative cases without inactive leakage |
| NS-605-A10 | planned | independent probes and benchmark | disk/API/vector identity, original citation hashes, sidecar delete/rebuild, cancellation, bounded page, latency, memory, database size, and WAL growth are measured outside the main test assertions |
| NS-605-A11 | planned | repository commands | focused suites, full check, production build, dependency/license evidence, diff checks, exact staging, and clean repository state pass without touching `data/library/` |
| NS-605-A12 | manual_pending | author visual/workflow decision | only the author accepts or rejects the connected multi-database retrieval surface |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Dependency Record

| Dependency | Version | Purpose | License | Decision evidence |
| --- | --- | --- | --- | --- |
| `sqlite-vec` | exactly `0.1.9` | per-database flat KNN vector sidecar without loading all vectors into JavaScript or adding a remote service | MIT OR Apache-2.0 | official repository documents Windows/Node support and compact binary vectors; the 0.1.9 stable release fixes DELETE behavior. Pre-v1 status requires exact pinning and dedicated lifecycle tests |

Official sources:

- <https://github.com/asg017/sqlite-vec>
- <https://github.com/asg017/sqlite-vec/releases/tag/v0.1.9>
- <https://github.com/unum-cloud/USearch>

USearch is not selected in NS-605 because its separate native index adds a
second metadata/filter synchronization surface. Unbounded JavaScript cosine
scanning is not selected because author-scale multi-database corpora would load
or traverse too many vectors on the request thread.

## Run Ledger

| Date | Commit/worktree | Command or procedure | Result |
| --- | --- | --- | --- |
| 2026-07-19 | clean `e024161` on `codex/ns-514-overview` | User directed implementation to continue instead of waiting on NS-604 A14; inspect current task, product, architecture, embedding router, lexical index, and UI | NS-604 remains paused with A14 open; NS-605 is the sole active task. The missing acceptance record and unresolved vector/catalog decisions were confirmed before runtime edits |
| 2026-07-19 | documentation worktree | Compare official `sqlite-vec` 0.1.9 and USearch documentation against Windows, license, filtering, deletion, packaging, and isolation requirements | Selected exactly pinned `sqlite-vec` 0.1.9 on a dedicated per-database sidecar; rejected a global catalog, arbitrary extension paths, a separate native HNSW metadata surface, and unbounded JavaScript scan |
| 2026-07-19 | documentation worktree before runtime edits | `npm.cmd run docs:check` and `git diff --check` | First documentation check identified missing canonical hierarchy declarations and a non-exact A08 target; after correcting both records, the repeated check passed all 188 Markdown files and the diff check passed |

## Repository Safety

- All fixtures and probes use temporary library roots.
- Never read, migrate, rebuild, modify, or stage `data/library/`.
- Vector and lexical indexes are derived state. Alias documents are database-
  scoped JSON authority and use atomic revision-checked writes.
- A semantic score, alias, transliteration, or translated query never replaces
  original Source text, hash, revision, language, location, or citation.
- No NS-605 evidence may claim NS-606 model tools or NS-607 Workshop activation.
- Screenshots and DOM measurements cannot satisfy NS-605-A12.
