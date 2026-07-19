# NS-606 Acceptance Record

Status: passed
Task: `docs/tasks/NS-606.md`
Decision: `docs/adr/0021-tool-driven-research-retrieval.md`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| Acceptance ID | Status | Verification | Required evidence |
| --- | --- | --- | --- |
| NS-606-A01 | passed | specifications and documentation checker | Product, artificial-intelligence editorial, Reference Library, architecture, security, ADR-0021, task, traceability, and acceptance records agree; post-implementation documentation check passes 189 Markdown files |
| NS-606-A02 | passed | `packages/contracts/test/research-tools.test.ts` | five tests prove strict model-owned arguments, complete immutable open citations, bounded original evidence, text-free audit shape, and internally consistent immutable budget state |
| NS-606-A03 | passed | `packages/storage/test/research-tool-audits.test.ts` | four tests prove atomic concurrent append, contiguous restart recovery, existing Model Call linkage, Series/path confinement, raw-text redaction, and fail-closed gap handling |
| NS-606-A04 | passed | `apps/server/test/research-tool-gateway.test.ts` | active-model-call/database allowlists, metadata-only permitted listing, server-owned search limit, exact prior-citation open, immediate permission revocation, stale revisions, and no mutation surface pass against real temporary authority/index files |
| NS-606-A05 | passed | gateway budget/lifecycle tests | per-call oversized result denial, dynamically measured cumulative character and token denial, five-call scripted exhaustion, default two-call no-progress exhaustion, running cancellation, concurrent serialization, restart restoration, and post-exhaustion no-audit/no-read behavior pass |
| NS-606-A06 | passed | gateway citation/security tests | search-to-open text/hash/revision/language/location/channels remain exact; inactive and `never` Sources are excluded; forged/stale citations fail; query, Provider-key/header-shaped strings, Source prompt injection, and passage text are absent from audit |
| NS-606-A07 | passed | Provider definition test | native-tool-capable models receive exactly the three strict read-only definitions; unsupported models receive an empty tool list; search arguments expose no result limit or write operation |
| NS-606-A08 | passed | scripted model-native gateway sequence | one adaptive sequence lists, searches, refines, opens, repeats, reaches the fixed fifth-call test budget, and stops before a sixth audit independently of Workshop presentation |
| NS-606-A09 | passed | `scripts/ns-606-retrieval-gateway-probe.mjs` | temporary-disk probe returns one search hit, one opened passage, twelve of thirteen permitted Source rows plus cursor, three audits and restored call count; outputs measure 1,801/1,287/5,785 characters, Research authority hash is unchanged, and private/query/passage text is absent from audit |
| NS-606-A10 | passed | repository commands | focused suites, package builds, the single full check, 189-file documentation check, diff checks, exact fifteen-file staging, implementation commit `c6f7e61`, and clean post-commit state pass without touching `data/library/` |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Planned Fixed Limits

| Limit | Value | Ownership |
| --- | ---: | --- |
| Active Research Databases | 1-12 | server execution context |
| Tool calls per model call | 8 | server execution context |
| Consecutive no-progress calls | 2 | server execution context |
| Output characters per call | 16,000 | server execution context |
| Output token estimate per call | 8,000 | server execution context |
| Cumulative output characters | 48,000 | durable audit-derived state |
| Cumulative output token estimate | 24,000 | durable audit-derived state |
| Search passages per call | 6 | gateway |
| Source metadata rows per call | 12 | gateway |
| Opened passage neighborhood | target plus one adjacent Chunk per side | gateway |

## Run Ledger

| Date | Commit/worktree | Command or procedure | Result |
| --- | --- | --- | --- |
| 2026-07-19 | clean `d03b380` on `codex/ns-514-overview` | Author's persistent goal continued after NS-605 A01-A11; inspect NS-606 through NS-608, Product, artificial-intelligence editorial, Reference Library, architecture, security, ADR-0021, Provider native-tool interfaces, ModelCallLog authority, and Research APIs | NS-606 is the sole active runtime task. Existing retrieval is not a model tool; no NS-606 acceptance record, audit authority, fixed budget executor, or Provider tool definitions existed before this task |
| 2026-07-19 | planning commit `e3d0661` | Record strict tools, limits, audit authority, restart behavior, and exact acceptance mapping before runtime edits; run documentation checker | Planning committed independently; documentation checker passed 189 Markdown files before implementation |
| 2026-07-19 | NS-606 runtime worktree | `npm.cmd run test -w @novel-studio/contracts -- test/research-tools.test.ts`; `npm.cmd run test -w @novel-studio/storage -- test/research-tool-audits.test.ts`; `npm.cmd run test -w @novel-studio/server -- test/research-tool-gateway.test.ts` | Latest focused runs pass 5 contract, 4 storage, and 10 real-authority gateway tests |
| 2026-07-19 | NS-606 runtime worktree | `npm.cmd run test -w @novel-studio/server -- test/research-retrieval-routes.test.ts`; package builds | Three affected NS-605 retrieval regression tests and contracts/storage/server TypeScript builds pass after cancellation propagation and metadata-only listing hardening |
| 2026-07-19 | NS-606 runtime worktree | `node scripts/ns-606-retrieval-gateway-probe.mjs` | Independent temporary-root probe passes: three tool definitions; one search result; one opened passage; twelve permitted metadata rows and a cursor; three contiguous audits; restart restores three used calls; outputs are 1,801, 1,287, and 5,785 characters; Research authority is byte-identical; no private text leaks |
| 2026-07-19 | NS-606 runtime worktree | `npm.cmd run check`; `git diff --check` | Passed 189 Markdown files, every workspace typecheck, 70 test files with 642 tests, and production Server/Web builds. Vite emitted only its existing chunk-size advisory; diff check passed and `data/library/` remained absent from status |
| 2026-07-19 | implementation commit `c6f7e61` | exact `git add` of the fifteen listed NS-606 files; `git commit -m "NS-606 feat(research): add permissioned retrieval gateway"`; post-commit status | Commit created with 2,509 insertions and 17 deletions; the worktree was clean immediately after commit, branch was 22 commits ahead, and `data/library/` was neither staged nor modified |

## Repository Safety

- All fixtures and probes use temporary library roots.
- Never read, migrate, rebuild, modify, or stage `data/library/`.
- Research Source and database authority is read-only to the gateway. The only
  NS-606 write is the schema-versioned redacted audit linked to an existing
  model call.
- No acceptance evidence may claim Workshop activation, iterative Workshop
  continuation, saved-key author validation, or Workshop visual acceptance;
  those remain NS-607 and NS-608.
