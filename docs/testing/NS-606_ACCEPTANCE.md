# NS-606 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-606.md`
Decision: `docs/adr/0021-tool-driven-research-retrieval.md`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| Acceptance ID | Status | Verification | Required evidence |
| --- | --- | --- | --- |
| NS-606-A01 | in_progress | specifications and documentation checker | Product, artificial-intelligence editorial, Reference Library, architecture, security, ADR-0021, task, traceability, and acceptance records agree before runtime edits |
| NS-606-A02 | planned | contract tests | strict tool arguments/results, citation, budget, execution error, and redacted audit schemas reject unknown fields, malformed identities, oversized arrays/text/cursors, and invalid lifecycle combinations |
| NS-606-A03 | planned | storage audit tests | per-model-call audit append is atomic, contiguous, restart-stable, path-confined, linked to an existing model call, and fails closed on damage without storing query or passage text |
| NS-606-A04 | planned | gateway tests | only active databases and permitted Sources participate; list/search/open are bounded, exact-citation checked, read-only, and expose no file path or mutation command |
| NS-606-A05 | planned | budget/lifecycle tests | immutable page, character, token-estimate, call-count, no-progress, cancellation, serialization, and restart-restored limits terminate extraction attempts |
| NS-606-A06 | planned | citation/security tests | original language/text/hash/revision/location/channels remain attributable; inactive and `never` Sources, stale citations, Provider-like secrets, headers, and prompt-injection text do not leak into audit |
| NS-606-A07 | planned | Provider definition tests | native-tool-capable models receive exactly three strict read-only tools; unsupported models and assistant prose receive no executable tool surface |
| NS-606-A08 | planned | scripted Mock Provider sequence | iterative list, search, refine, open, duplicate/no-progress, and completion behavior works independently of Workshop presentation |
| NS-606-A09 | planned | independent probe | disk/audit redaction, restart budget, before/after Research authority hashes, extraction bounds, and output measurements are verified outside the main test assertions |
| NS-606-A10 | planned | repository commands | focused suites, full check/build, documentation/diff checks, exact staging, commit, and clean state pass without touching `data/library/` |

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

## Repository Safety

- All fixtures and probes use temporary library roots.
- Never read, migrate, rebuild, modify, or stage `data/library/`.
- Research Source and database authority is read-only to the gateway. The only
  NS-606 write is the schema-versioned redacted audit linked to an existing
  model call.
- No acceptance evidence may claim Workshop activation, iterative Workshop
  continuation, saved-key author validation, or Workshop visual acceptance;
  those remain NS-607 and NS-608.
