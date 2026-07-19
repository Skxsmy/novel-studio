# NS-607 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-607.md`
Decisions: `docs/adr/0021-tool-driven-research-retrieval.md`,
`docs/adr/0023-workshop-research-activation-and-tool-loop.md`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| Acceptance ID | Status | Verification | Required evidence |
| --- | --- | --- | --- |
| NS-607-A01 | passed | specifications and documentation checker | Product, artificial-intelligence editorial, UX, architecture, ADR-0021, ADR-0023, task, traceability, and this record agree; documentation check passes 191 Markdown files before runtime edits |
| NS-607-A02 | passed | `packages/contracts/test/workshop-research-activation.test.ts` | strict version 3 activation, limits, diagnostics, evidence, API, and stream-event schemas; older records project only through the explicit migration contract |
| NS-607-A03 | in_progress | `packages/storage/test/workshop-research-activation.test.ts` | migration, rollback, diagnostics, branch snapshot, session deletion, and evidence lifecycle pass; database deletion blocker remains to prove |
| NS-607-A04 | in_progress | `apps/server/test/workshop-research-activation-routes.test.ts` | activation and migration route behavior pass; deletion blocker and full route edge matrix remain |
| NS-607-A05 | in_progress | `apps/server/test/workshop-research-loop.test.ts` | General Chat list/search/open/final-answer path, initial context protection, audits, and evidence pass; boundary exhaustion cases remain |
| NS-607-A06 | in_progress | `apps/server/test/workshop-agent-research-loop.test.ts` | Agent search/open followed by a separately confirmed Codex request passes; malformed, parallel, and mixed-call rejection remain |
| NS-607-A07 | planned | `apps/server/test/workshop-research-lifecycle.test.ts` | cancellation, one active turn per session, switch isolation, retry/interruption/restart reconciliation, Provider failure, context protection, gateway exhaustion, and active-database removal terminate without replay |
| NS-607-A08 | planned | `apps/server/test/workshop-research-citations.test.ts` | only gateway-returned citations persist; exact database/Source/Chunk/hash/revision/location opens; inactive, forged, stale, and changed authority cannot substitute text; logs contain no private passage or key |
| NS-607-A09 | in_progress | `apps/web/src/features/workshop/WorkshopResearchSources.test.tsx` | linked-first ordering without auto-selection, explicit selection, per-session prop restore, and loading/error/unsupported states pass; connected archive and keyboard coverage remains |
| NS-607-A10 | in_progress | `apps/web/src/features/workshop/WorkshopResearchEvidence.test.tsx` | bounded evidence ribbon, exact citation callback, stale state, and audit-field omission pass; connected stream activity and responsive browser evidence remain |
| NS-607-A11 | in_progress | `apps/server/test/harness/scriptedWorkshopProvider.ts` plus A05-A07 suites | reusable exact-step harness drives General Chat and Agent native calls, usage, request history, and assertions; abort/fault multi-session coverage remains |
| NS-607-A12 | planned | `scripts/ns-607-workshop-research-harness.mjs` | independent temporary-root HTTP/storage/provider run completes multi-session multi-turn questions, checks citations/audits/authority hashes/restart, and never reads or writes `data/library/` |
| NS-607-A13 | planned | local persistent server plus real browser interaction | create/switch/branch sessions, activate isolated databases, run a multi-step answer, stop one run, open an exact citation, and exercise compact/mobile layouts without claiming author visual acceptance |
| NS-607-A14 | planned | repository commands | focused suites, one final full check/build, documentation/link check, diff/repository safety, exact staging/commit and clean-state evidence |
| NS-607-A15 | manual_pending | explicit author decision | author accepts or rejects the implemented Workshop source-selection/evidence workflow after using it; automation cannot pass this row |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Fixed Runtime Limits

| Limit | Value | Owner |
| --- | ---: | --- |
| Active Research Databases per session | 0-12 | session schema plus server validation |
| Concurrent author turns per session | 1 | Workshop coordinator |
| Native tool calls in one Provider step | 1 | Workshop coordinator |
| Research calls, no-progress calls, per-call and cumulative output | NS-606 fixed limits | Research gateway durable state |
| Native Provider continuation steps | 10 | Workshop coordinator; permits final answer after eight Research calls |
| Provider repair for malformed native Research call | 1 model-visible error continuation | Workshop coordinator |
| Persisted evidence | unique citations actually returned in the completed turn | message evidence writer |

## Harness Scenario Matrix

| Scenario | Sessions/turns | Required conclusion |
| --- | --- | --- |
| Chinese author checks Japanese and English references | two sessions, at least three author turns each | model refines queries, opens exact original-language passages, cites them, and answers the current writing question |
| Agent researches before a Codex proposal | one session, at least four author turns | read tools execute automatically; later write request remains pending until confirmation and continuation |
| Unsupported/degraded model | two sessions, at least two turns each | ordinary chat works; no fake Research call occurs; UI and transcript state the exact limitation |
| Failure and recovery | one session, cancellation plus retry/restart turns | no automatic replay, no duplicate audit/evidence, and a later explicit retry can finish |
| Isolation and lifecycle | two databases, active plus archived and branched sessions | selection never crosses sessions; branch snapshot is exact; database deletion is blocked until explicit deactivation |

## Run Ledger

| Date | Commit/worktree | Command or procedure | Result |
| --- | --- | --- | --- |
| 2026-07-19 | post-NS-606 worktree at `c6f7e61` | Freeze ADR-0023, direct-code UI checklist, external interaction references, harness design, and A01-A15 before runtime edits | Planning in progress; no runtime or user Research authority mutation has begun |
| 2026-07-19 | NS-607 planning worktree | `npm.cmd run docs:check` | Passed 191 Markdown files; A01 is complete before contracts, storage, server, or Web runtime edits |
| 2026-07-19 | NS-607 runtime worktree | focused Contracts, Storage, activation-route, General Chat loop, Agent regression, Agent Research loop, and Web selector/evidence suites | Passed: Contracts 5, Storage 4 plus Workshop 28, activation routes 2, General Chat loop 1, Agent regression 10, Agent Research loop 1, Web components 5 |
| 2026-07-19 | NS-607 runtime worktree | targeted builds for `@novel-studio/contracts`, `@novel-studio/storage`, `@novel-studio/server`, and `@novel-studio/web` | Passed; Web emitted only the existing large-chunk advisory |

## Repository Safety

- Every fixture, browser setup, and independent harness uses generated temporary
  library and Series roots.
- Never read, migrate, rebuild, modify, or stage `data/library/`.
- Saved real Provider keys and real-author multi-session validation belong to
  NS-608. NS-607 deterministic harness evidence cannot claim that later gate.
- Browser checks cannot claim the author-only A15 decision.
