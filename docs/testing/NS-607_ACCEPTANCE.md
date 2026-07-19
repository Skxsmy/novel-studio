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
| NS-607-A03 | passed | `packages/storage/test/workshop-research-activation.test.ts` | four tests prove migration, rollback, diagnostics, branch snapshots, evidence cleanup, deep citation equality, and active/archived session deletion blockers without internal paths |
| NS-607-A04 | passed | `apps/server/test/workshop-research-activation-routes.test.ts` | two route tests prove zero-to-twelve activation validation, conflict/read-only behavior, explicit migration, and human-facing database deletion blockers |
| NS-607-A05 | passed | `apps/server/test/workshop-research-loop.test.ts`; `apps/server/test/workshop-research-lifecycle.test.ts` | General Chat list/search/open/final answer and redacted stream activity pass; duplicate parallel turns, cancellation, restart, unsupported tools, and no-progress exhaustion terminate explicitly |
| NS-607-A06 | passed | `apps/server/test/workshop-agent-research-loop.test.ts`; existing Agent regression suite | automatic search/open followed by separately confirmed Codex creation passes; a mixed parallel Research/write step executes neither tool, and tool-shaped prose remains prose |
| NS-607-A07 | passed | `apps/server/test/workshop-research-lifecycle.test.ts`; activation Storage tests; independent harness | one active turn, switch isolation, cancellation without evidence, no restart replay, explicit retry, unsupported ordinary chat, no-progress exhaustion, branch/archive lifecycle, and deletion blocking terminate without hidden replay |
| NS-607-A08 | passed | `apps/server/test/workshop-research-citations.test.ts`; Storage activation tests | only a complete gateway-returned citation persists; forged hash and inactive database calls fail, exact navigation validates revision/Chunk/hash, metadata substitution is rejected, and Provider/audit records omit private passage text |
| NS-607-A09 | in_progress | `apps/web/src/features/workshop/WorkshopResearchSources.test.tsx`; `ReferenceWorkshopWorkspace.test.tsx` | linked-first ordering without auto-selection, explicit selection, real capability state, per-session props, loading/error states, Escape close, and trigger-focus restoration pass; connected archive and responsive browser evidence remains |
| NS-607-A10 | in_progress | `apps/web/src/features/workshop/WorkshopResearchEvidence.test.tsx`; General Chat stream test | bounded evidence ribbon, full citation callback, exact database/location/language/channels, stale state, audit-field omission, and redacted stream activity pass; responsive browser evidence remains |
| NS-607-A11 | passed | `apps/server/test/harness/scriptedWorkshopProvider.ts` plus A05-A07 suites | deterministic protocol layer drives General Chat and Agent native calls, usage, request history, parallel-call rejection, abort barriers, capability override, and fault assertions; this row does not claim unconstrained model behavior quality |
| NS-607-A12 | passed | `npm.cmd run probe:ns607` | deterministic integration layer completes temporary-root multi-session Research/Codex protocol, cancellation/restart, exact citation, lifecycle, redacted audits, and unchanged Research authority hashes; this row does not substitute for A16-A18 |
| NS-607-A13 | planned | local persistent server plus real browser interaction | create/switch/branch sessions, activate isolated databases, run a multi-step answer, stop one run, open an exact citation, and exercise compact/mobile layouts without claiming author visual acceptance |
| NS-607-A14 | planned | repository commands | focused suites, one final full check/build, documentation/link check, diff/repository safety, exact staging/commit and clean-state evidence |
| NS-607-A15 | manual_pending | explicit author decision | author accepts or rejects the implemented Workshop source-selection/evidence workflow after using it; automation cannot pass this row |
| NS-607-A16 | passed | `apps/server/test/workshop-tool-policy.test.ts`; six focused Workshop suites; server build | one production registry covers all three Research reads and both Codex writes; mode visibility, side effects, confirmation timing, mixed-call rejection, unknown/unavailable tools, budget-specific rejection, and result identity are enforced outside model prose; 26 focused regressions pass |
| NS-607-A17 | passed | `scripts/harness/workshop-behavior-harness.mjs`; `npm.cmd run test:harness:ns607`; `npm.cmd run probe:ns607:behavior` | reusable task/trial runner records author, assistant, tool, confirmation, and result traces and grades final authority, required/allowed/forbidden trajectory, author-effort boundaries, correction persistence, and replay behavior against temporary live-HTTP authority |
| NS-607-A18 | passed | two Node harness tests plus two deterministic reference tasks | negative over-triggering fails even when final prose claims success; multi-trial aggregation is exercised; an eight-turn Codex task and four-turn Research-then-update task cover all five current tools, short corrections, no-tool turns, exact confirmation, final authority, and no duplicate writes. Saved-key stochastic trials remain NS-608 |

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
| Ordinary author discussion | two Agent sessions, at least three author turns each | no Codex write is requested when the author is brainstorming, rejecting a suggestion, or asking for prose only |
| Durable short correction | one Agent session, at least four author turns | a short correction changes later prose and later Codex drafts without requiring the author to restate a long prompt |
| Codex create and revision | one Agent session, at least four author turns | one create draft waits; author correction changes the draft before confirmation; exactly one authority entry is created |
| Codex update | one Agent session, at least four author turns | exact target and patch are preserved, excluded fields remain unchanged, stale or ambiguous targets do not write, and success is not replayed |
| Research then Codex | one Agent session, at least five author turns | automatic reads may collect evidence, but the later Codex write is a separate pending request with exact confirmation identity |
| Balanced triggering | positive and negative task pairs, multiple trials | required tools are not omitted and unnecessary read/write tools are not called merely to appear proactive |

## Run Ledger

| Date | Commit/worktree | Command or procedure | Result |
| --- | --- | --- | --- |
| 2026-07-19 | post-NS-606 worktree at `c6f7e61` | Freeze ADR-0023, direct-code UI checklist, external interaction references, harness design, and A01-A15 before runtime edits | Planning in progress; no runtime or user Research authority mutation has begun |
| 2026-07-19 | NS-607 planning worktree | `npm.cmd run docs:check` | Passed 191 Markdown files; A01 is complete before contracts, storage, server, or Web runtime edits |
| 2026-07-19 | NS-607 runtime worktree | focused Contracts, Storage, activation-route, General Chat loop, Agent regression, Agent Research loop, and Web selector/evidence suites | Passed: Contracts 5, Storage 4 plus Workshop 28, activation routes 2, General Chat loop 1, Agent regression 10, Agent Research loop 1, Web components 5 |
| 2026-07-19 | NS-607 runtime worktree | targeted builds for `@novel-studio/contracts`, `@novel-studio/storage`, `@novel-studio/server`, and `@novel-studio/web` | Passed; Web emitted only the existing large-chunk advisory |
| 2026-07-19 | NS-607 citation/lifecycle hardening worktree | focused lifecycle, citation, General Chat, Agent, activation Storage/route, selector/evidence, and connected selector tests | Passed: lifecycle 4, citations 2, General Chat 2, Agent Research 3, Storage activation 4, activation routes 2, Web components 5, and connected selector 1; a disabled-during-load test timing defect was corrected without weakening the interaction assertion |
| 2026-07-19 | NS-607 citation/lifecycle hardening worktree | targeted `@novel-studio/server` and `@novel-studio/web` production builds | Passed; Web emitted only the existing large-chunk advisory |
| 2026-07-19 | NS-607 independent harness worktree | `npm.cmd run probe:ns607` | Passed against a generated temporary library and live random-port HTTP server: two Chinese-author sessions x three turns over Japanese/English originals, one Agent session x four turns with confirmed Codex write, two unsupported sessions x two turns, cancellation/restart, exact citation navigation, branch/archive/deletion blockers, 20 redacted audit events, zero unsupported Research calls, zero replay, and unchanged Research authority hashes |
| 2026-07-19 | post-`cf2c98e` NS-607 worktree | official OpenAI, Anthropic, and Vercel AI SDK guidance plus existing NS-510 source study | Scope correction recorded: the existing probe is retained as deterministic protocol evidence; production constraints and reusable model-behavior evaluation now cover all five Workshop tools in A16-A18 |
| 2026-07-19 | NS-607 all-tool behavior harness worktree | `npm.cmd run test -w @novel-studio/server -- workshop-tool-policy.test.ts workshop-agent-runner.test.ts workshop-research-loop.test.ts workshop-agent-research-loop.test.ts workshop-research-lifecycle.test.ts workshop-research-citations.test.ts` | Passed six suites and 26 tests. A regression found that generic unavailable-tool feedback had displaced the model-visible `BUDGET_EXHAUSTED` boundary; the policy now rejects execution while preserving the precise stop reason |
| 2026-07-19 | NS-607 all-tool behavior harness worktree | `npm.cmd run test:harness:ns607`; `npm.cmd run probe:ns607:behavior`; `npm.cmd run build -w @novel-studio/server` | Passed two grader tests, two temporary live-HTTP behavior tasks, and the server build. Codex task: eight author turns, ten Provider steps, one confirmed create, one confirmed update, six no-tool turns, corrected final authority. Research task: four author turns, all three read tools, one separately confirmed update, exact evidence, and no replay |

## Repository Safety

- Every fixture, browser setup, and independent harness uses generated temporary
  library and Series roots.
- Never read, migrate, rebuild, modify, or stage `data/library/`.
- Saved real Provider keys and real-author multi-session validation belong to
  NS-608. NS-607 deterministic harness evidence cannot claim that later gate.
- Browser checks cannot claim the author-only A15 decision.
