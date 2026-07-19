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
| NS-608-A02 | passed | saved-key preflight in `scripts/ns-608-real-author-harness.mjs` | exactly one eligible saved DeepSeek profile was projected into a temporary library as `deepseek-v4-pro`; the host credential context resolved the saved key, `/models`, connection, native `codex.create_entry`, confirmation boundary, redaction, pointer confinement, cleanup, and byte-exact real-library safety passed |
| NS-608-A03 | in_progress | reusable live runner and Node tests | temporary profile projection, source-library fingerprinting, secret-pointer confinement, public-summary redaction, safe failure classification, and unconditional cleanup pass; adaptive multi-round trace, confirmation, and outcome helpers remain in progress |
| NS-608-A04 | passed | three saved-key `deepseek-v4-pro` cross-language continuity trials plus focused lexical/loop regressions | all three independent four-turn sessions passed; each obtained exact Japanese and English citation identities, preserved all six governed facts, used four searches with four/four/five total Research reads, created no Codex authority, and left the real library byte-exact |
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
| 2026-07-20 | NS-608 preflight worktree | `npm.cmd run test:harness:ns608` | Passed 3 Node tests covering exact profile projection to `deepseek-v4-pro`, zero/multiple-profile rejection, byte-sensitive library fingerprints, safe public summaries, private failure-message suppression, and cleanup/source-integrity evidence after a controlled callback failure |
| 2026-07-20 | NS-608 preflight worktree | sandboxed `npm.cmd run probe:ns608:preflight` | Correctly failed as `saved-credential-missing` because the restricted command context could not access the host Windows credential store; this is not evidence that the author's key was absent. Temporary pointer confinement and the byte-exact 413-file/2,497,618-byte real-library safety check still passed |
| 2026-07-20 | NS-608 preflight worktree | host-credential `npm.cmd run probe:ns608:preflight` | Passed with the saved DeepSeek key and exact `deepseek-v4-pro`: target model discovered, connection passed, the real Provider requested native `codex.create_entry`, the run stopped at confirmation, authority write count remained zero, the non-secret pointer stayed confined to the temporary profile, and the 413-file/2,497,618-byte real library remained byte-exact |
| 2026-07-20 | NS-608 A04 hardening worktree | diagnostic saved-key cross-language trials and focused regressions | Found and fixed four independent defects: the grader read `hash` instead of Source Chunk `textHash`; a failed behavior suite returned process success; exhausted Research removed definitions still referenced by tool history under DeepSeek thinking mode; and strict all-term/CJK phrase matching discarded otherwise relevant original-language queries. A mechanically prescribed `open_passage` requirement was also removed because the task grades evidence and outcome rather than one tool sequence |
| 2026-07-20 | NS-608 A04 hardening worktree | `npm.cmd run test -w @novel-studio/storage -- research-index.test.ts`; three focused Server files; contracts/storage/server builds; `npm.cmd run test:harness:ns608` | Passed 5 SQLite index tests, 66 Workshop/Gateway/route tests, all three package builds, and 5 live-runner safety/grader tests. Long multi-term lexical queries now require at least two matching terms and half coverage; short queries stay strict; CJK term fallback remains database-, permission-, language-, and result-bound |
| 2026-07-20 | NS-608 A04 hardening worktree | host-credential `npm.cmd run probe:ns608:cross-language` | Final formal batch passed 3/3 independent trials. Every trial completed four author turns, made exactly four searches, retained exact Japanese and English citations and all six governed facts, made zero Codex calls, confined the system credential pointer to its temporary profile, cleaned temporary authority, and preserved the byte-exact 413-file/2,497,618-byte real library. Total Research reads were 4, 4, and 5; distinct selected citation counts were 2, 2, and 2 |

## Repository Safety

- Never print or persist plaintext API keys, credential references,
  Authorization/Cookie headers, Provider raw responses, or private full text.
- Never create, migrate, rebuild, modify, delete, or stage real
  `data/library/` Series/Research/Workshop/Codex/index/audit authority.
- A saved-key failure is evidence, not permission to replace the Provider,
  lower a hard boundary, or silently use Mock Provider output.
- Browser diagnostics cannot claim the author-only A13 decision.
- A restricted Codex command can be unable to see the host Windows credential
  store even when the normal application can use the saved key. Saved-key
  acceptance must run in the host credential context; a sandbox-only miss must
  not be reported as credential loss.
