# NS-608 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-608.md`
Decisions: `docs/adr/0021-tool-driven-research-retrieval.md`,
`docs/adr/0023-workshop-research-activation-and-tool-loop.md`
Real Provider model: `deepseek-v4-pro`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| Acceptance ID | Status | Verification | Required evidence |
| --- | --- | --- | --- |
| NS-608-A01 | passed | specifications, official DeepSeek documentation, and `npm.cmd run docs:check` | task-specific Provider decision and exact evidence map are recorded before runtime edits; live documents no longer describe implemented NS-607 paths as absent; documentation check passes 193 Markdown files |
| NS-608-A02 | planned | saved-key preflight in `scripts/ns-608-real-author-harness.mjs` | discover exactly one eligible saved DeepSeek profile without printing its reference, project it to a temporary library as `deepseek-v4-pro`, confirm `/models`, connection, native tools, and redaction without reading plaintext key |
| NS-608-A03 | planned | reusable live runner and Node tests | temporary authority, adaptive natural author turns, full trace capture, exact write confirmations, outcome reads, redacted summaries, and `finally` cleanup are deterministic around the real stochastic Provider boundary |
| NS-608-A04 | planned | three real cross-language continuity trials | every session has several turns until resolved; Research reads are selective, Japanese/English original citations are exact, and final answers contain the governed facts without bulk context stuffing |
| NS-608-A05 | planned | three real natural-correction/Codex trials | discussion and prose-only turns do not write; short corrections persist; exactly one create and one later update receive separate confirmation; corrected authority and no replay pass |
| NS-608-A06 | planned | three real balanced-triggering/conflicting-source trials | necessary reads are not omitted, unnecessary reads/writes are not called, source disagreement and false friends remain explicit, and ordinary author language is sufficient |
| NS-608-A07 | planned | real plus deterministic adversarial probes | prompt-injection Source text remains data; `never`, inactive, malformed, broad-dump, duplicate, and cross-target requests fail closed without secret/path/body leakage |
| NS-608-A08 | planned | real cancellation and controlled recovery probes | cancellation, Provider failure, restart, stale citation, deactivation, explicit retry, and no hidden replay preserve authority and terminate visibly |
| NS-608-A09 | planned | declared large-corpus probes | current hardware is recorded; 25 MiB exact and 4,096-Chunk vector targets are measured without weakening misses or treating indexes as authority |
| NS-608-A10 | planned | identified local server plus real in-app browser | complete Research/Codex author workflow, confirmation, stop, citation opening, session switching, and responsive layout are inspected without claiming author acceptance |
| NS-608-A11 | planned | `docs/testing/NS-608_DATABASE_FINAL_AUDIT.md` | requirement-by-requirement final database audit confirms implementation or lists every defect, overstatement, residual risk, and recommendation in scope |
| NS-608-A12 | planned | repository commands | focused suites, one final full check/build, docs/link check, diff safety, exact commits, and clean-state evidence pass |
| NS-608-A13 | manual_pending | explicit author decision | author accepts or rejects the final connected Research-assisted Workshop workflow; no automated evidence can pass this row |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Provider Boundary

- The real source profile is library-global and read-only. The test runner may
  read its parsed non-secret metadata and use the system credential service, but
  may not print, export, replace, delete, or persist the credential or reference.
- Only `deepseek-v4-pro` is used. The original profile's Provider, base URL,
  credential, and all other connection fields stay unchanged.
- DeepSeek official documentation declares the OpenAI-format base URL, model
  list, streamed Chat Completions, reasoning fields, and native function tools.
  The live preflight remains authoritative for the saved account and current
  service state.
- Provider output is untrusted. Production schemas, policy, confirmation,
  allowlists, budgets, identity checks, and replay prevention remain mandatory.

## Evidence Retention

- Committed evidence: aggregate pass/fail, task/trial counts, tool names/counts,
  confirmation/result states, authority hashes, citation identities without
  passage bodies, error classifications, timings, sizes, and redaction results.
- Ephemeral only: complete prompts, complete transcripts, Source passages,
  Provider raw responses, request headers, credential references, temporary
  roots, and any private corpus content. Ephemeral artifacts are deleted after
  grading and cannot be staged.
- Real calls and browser fixtures use generated temporary Series, Research
  Databases, Sources, Workshop sessions, Codex entries, indexes, and audits.
  `data/library/` authority and indexes are not mutated.

## Run Ledger

| Date | Commit/worktree | Command or procedure | Result |
| --- | --- | --- | --- |
| 2026-07-20 | clean post-`3af0d9c` worktree | current-state read, saved profile metadata redaction, official DeepSeek model/tool/API research, and NS-608 acceptance mapping | Planning began with one credential-configured DeepSeek profile. The author selected `deepseek-v4-pro` and required every other connection setting to remain unchanged. No real Provider call, runtime mutation, or `data/library/` authority mutation occurred before this map |
| 2026-07-20 | NS-608 planning worktree | `npm.cmd run docs:check` | Passed 193 Markdown files after activating NS-608, freezing A01-A13 mappings, creating the pending final-audit matrix, and correcting stale Architecture/API/traceability claims before runtime edits |

## Repository Safety

- Never print or persist plaintext API keys, credential references,
  Authorization/Cookie headers, Provider raw responses, or private full text.
- Never create, migrate, rebuild, modify, delete, or stage real
  `data/library/` Series/Research/Workshop/Codex/index/audit authority.
- A saved-key failure is evidence, not permission to replace the Provider,
  lower a hard boundary, or silently use Mock Provider output.
- Browser diagnostics cannot claim the author-only A13 decision.
