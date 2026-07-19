# NS-605 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-605.md`
Decisions: `docs/adr/0021-tool-driven-research-retrieval.md`; `docs/adr/0022-isolated-research-vector-index.md`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| Acceptance ID | Status | Verification | Required evidence |
| --- | --- | --- | --- |
| NS-605-A01 | passed | specifications and ADRs | Product, UX, Reference Library, traceability, architecture, security, ADR-0021/0022, task, dependency, and acceptance records agree before runtime edits; documentation check passes for 188 Markdown files |
| NS-605-A02 | passed | `packages/contracts/test/research-retrieval.test.ts` | five tests accept bounded explicit scope and reject duplicate database IDs, Unicode-equivalent aliases, duplicate filters, malformed channels, oversized cursors, missing provenance, and unbounded inputs |
| NS-605-A03 | passed | `packages/storage/test/research-aliases.test.ts`; `packages/storage/test/research-embedding-capabilities.test.ts` | seven tests prove per-database isolation, NFKC resolution, atomic revision conflicts, restart stability, damaged authority reporting, exact profile revision binding, and capability-directory confinement |
| NS-605-A04 | passed | `packages/storage/test/research-vector-index.test.ts` | eight tests load real `sqlite-vec`, pin identity/provenance, reuse only unchanged vectors, stream bounded batches, delete with BigInt row IDs, cancel without swap, roll back failed swap, and reject foreign/damaged state |
| NS-605-A05 | passed | `packages/storage/test/research-retrieval.test.ts`; `apps/server/test/research-retrieval-routes.test.ts` | deterministic weighted fusion, deduplication, diversity, relevance floor, explicit inactive exclusion, language/type filters, permission filters, snapshot-bound cursor conflicts, and damaged-sibling partial results pass |
| NS-605-A06 | passed | `packages/ai/test/research-embedding-capability.test.ts`; server route tests | the exact bound profile runs Chinese/Japanese/English positive and negative pairs with prefixes and dimensions; missing, failed, changed, and Provider-unavailable state discloses exact-only degradation |
| NS-605-A07 | passed | `apps/server/test/research-retrieval-routes.test.ts` | three end-to-end service tests exercise capability/vector/retrieval routes, revision/status mapping, current-profile use, Provider error redaction, local versus model-context permission, and no translation or Provider fallback |
| NS-605-A08 | passed | `apps/web/src/features/research/ResearchDatabaseWorkspace.ns605.test.tsx`; NS-604 compatibility test | three new UI tests prove scope/mode, isolated alias edits, capability/vector actions, database/channel labels, issues, pagination, cross-database exact open, dirty close, conflict refresh, and stale-cursor first-page recovery; eleven prior Research UI tests remain passing |
| NS-605-A09 | passed | `tests/e2e/ns-605-research-retrieval.spec.ts` | isolated Chrome workflow proves Chinese query to Japanese/English originals, English reverse retrieval of Chinese/Japanese/English originals, mixed query, proper-name transliteration, false-friend and irrelevant negatives, pagination, inactive exclusion, and exact cross-database open |
| NS-605-A10 | passed | `npm.cmd run probe:ns605` | an independent temporary-root probe builds 4,096 Chunks, 384 dimensions, and 3,787,690 original-text bytes in batches of at most 128; it measures build/query/RSS/disk/WAL, verifies package/application/schema identity and citation hashes, rejects limit 101, deletes, cancels byte-preservingly, and incrementally re-embeds only the one deleted Chunk |
| NS-605-A11 | in_progress | repository commands | focused suites and production builds pass; final full check, focused Chrome rerun, documentation/diff checks, exact staging, commit, and repository-state evidence remain without touching `data/library/` |
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
| 2026-07-19 | NS-605 runtime worktree | Install exactly `sqlite-vec@0.1.9`; inspect the resolved Windows extension; execute direct load/version/KNN/DELETE probes | The reviewed package resolved to `node_modules/sqlite-vec-windows-x64/vec0.dll`, reported `v0.1.9`, and passed KNN and DELETE after the probe corrected row IDs from JavaScript Number to BigInt. The first Number-row-ID failure is retained as evidence for the dedicated BigInt deletion test |
| 2026-07-19 | NS-605 runtime worktree | Focused contracts, storage alias/capability/vector/fusion, artificial-intelligence capability, server route, and Web tests during implementation | Contracts 5, aliases 4, capability authority 3, vector 8, fusion 6, artificial-intelligence capability 3, server routes 3, new Web 3, and prior Research Web 11 passed at their latest focused runs; final aggregate check remains A11 |
| 2026-07-19 | NS-605 runtime worktree | Real Chrome author workflow in an isolated temporary library | Initial diagnostic runs corrected ambiguous selectors and realistic Chunk fixtures, then exposed a real long-dialog layering defect. Raising the Research modal above the application bar and constraining the retrieval body to internal scrolling fixed it. The workflow then passed before the final Chinese-original fixture extension; final evidence remains A09 in progress |
| 2026-07-19 | NS-605 runtime worktree | `npm.cmd run probe:ns605` after incremental reuse | Passed 4,096 Chunks at 384 dimensions over 3,787,690 original-text bytes. Maximum Provider batch was 128; build was 409.49 ms; 20-query median was 35.73 ms and P95 was 39.18 ms; measured RSS peak increase was 49,795,072 bytes; sidecar was 12,259,328 bytes; closed WAL was 0 bytes and SHM was 32,768 bytes. Citation hash, limit rejection, DELETE, byte-preserving cancellation, one-Chunk incremental re-embedding, and full count restoration passed |
| 2026-07-19 | NS-605 runtime worktree | `npm.cmd run check` | Passed documentation check for 188 Markdown files, every workspace typecheck, 65 test files with 623 tests, and the production Server/Web build. Vite retained only its existing chunk-size advisory |
| 2026-07-19 | NS-605 runtime worktree | `npm.cmd exec playwright test tests/e2e/ns-605-research-retrieval.spec.ts` after the Chinese-original fixture extension | One real Chrome test passed in 4.4 seconds against an isolated temporary library; the workflow exercised three original languages across two databases and reported no browser, page, or HTTP errors |
| 2026-07-19 | NS-605 runtime worktree | inspect installed `node_modules/sqlite-vec/package.json`; `git diff --check`; `git status --short --branch` | Confirmed exact version 0.1.9 and `MIT OR Apache`; diff check passed; only the listed NS-605 runtime, test, dependency, and owned documentation files are modified or untracked, while `data/library/` is absent from status |

## Repository Safety

- All fixtures and probes use temporary library roots.
- Never read, migrate, rebuild, modify, or stage `data/library/`.
- Vector and lexical indexes are derived state. Alias documents are database-
  scoped JSON authority and use atomic revision-checked writes.
- A semantic score, alias, transliteration, or translated query never replaces
  original Source text, hash, revision, language, location, or citation.
- No NS-605 evidence may claim NS-606 model tools or NS-607 Workshop activation.
- Screenshots and DOM measurements cannot satisfy NS-605-A12.
