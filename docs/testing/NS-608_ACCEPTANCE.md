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
| NS-608-A05 | passed | three saved-key `deepseek-v4-pro` natural-correction/Codex trials plus semantic-replay regressions | all three independent eight-turn sessions kept six discussion/prose/summary turns read-only, preserved short corrections, performed exactly one create and one later update behind separate confirmations, rejected both execution replays, and ended with only the corrected Codex authority |
| NS-608-A06 | passed | three real balanced-triggering trials, three real conflicting-source trials, deterministic graders, and failure-aggregation regressions | all six independent five-turn sessions passed; ordinary writing stayed tool-free, explicit evidence requests retrieved bounded exact citations, source disagreement and false friends remained separate, no Codex authority was written, and one failed trial can no longer abort evidence collection for the remaining trials |
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
| 2026-07-20 | NS-608 A05 hardening worktree | diagnostic saved-key natural-correction trials and focused regressions | Found and fixed independent live-path defects instead of rerunning an unchanged path: natural write intent could end as prose; the diagnostic runner omitted its confirmation helper import; continuation parsing could mistake a plain result for a request; exact-draft replay comparison allowed a rewritten create and then an ordinary-field update of the just-created target; replacement-field guidance did not reliably preserve accepted content or isolate rejected edit history; and the dialogue grader incorrectly treated an author-requested retrospective summary as restoring rejected canon. Server policy now suppresses same-category/same-name create variants and immediate ordinary-field create-to-update echoes across the full run while preserving distinct-target and Progression follow-ups |
| 2026-07-20 | NS-608 A05 hardening worktree | `npm.cmd run test -w @novel-studio/server -- workshop-tool-policy.test.ts workshop-routes.test.ts`; `npm.cmd run test:harness:ns608`; contracts/server builds | Passed 59 Server policy/route tests, 6 live-runner tests, and both package builds. Regression coverage proves ordinary natural write phrases, rewritten create suppression, immediate create-to-update echo suppression, unchanged confirmed authority, normal continuation, and a separately confirmed different-target follow-up |
| 2026-07-20 | NS-608 A05 hardening worktree | host-credential `npm.cmd run probe:ns608:codex -- --trials=3` | Final formal batch passed 3/3 independent trials. Every trial completed eight author turns, made no Research calls, kept turns 1/2/3/4/6/8 tool-free, requested one create followed later by one update, settled both exact confirmations, rejected both replay attempts, exposed no protocol labels, and left exactly one `沈遥` entry. All three final descriptions retained `黑发`, the gatekeeper role, and `钟声`, omitted `红发`, `家庭仇恨`, and `怕水`, confined the credential pointer, cleaned temporary authority, and preserved the byte-exact 413-file/2,497,618-byte real library |
| 2026-07-20 | NS-608 A06 hardening worktree | official Anthropic agent-evaluation guidance and OpenAI grader documentation, followed by deterministic harness implementation | The harness separates outcome, tool-trajectory, author-dialogue, and safety grading; runs three independent multi-turn trials; keeps objective authority/tool/citation checks in code; and reports each trial independently. Provider output does not grade itself. References: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents and https://platform.openai.com/docs/api-reference/graders?api-mode=chat |
| 2026-07-20 | NS-608 A06 hardening worktree | diagnostic saved-key balanced/conflicting-source trials and focused regressions | Diagnostic runs found that equivalent original-English source wording produced grader false negatives, the Agent prompt lacked an explicit conflict/false-friend preservation rule, a single Provider failure aborted a complete multi-trial suite, and cause-wrapped Node fetch/socket failures were classified as unknown. Deterministic graders now recognize governed Chinese and source-language equivalents; Agent prompt version 3 preserves each source and its uncertainty; the suite records and sanitizes one failed trial while continuing; and network cause chains become retryable `provider-unavailable` failures without exposing raw errors |
| 2026-07-20 | NS-608 A06 hardening worktree | `node --check scripts/ns-608-real-author-harness.mjs`; `npm.cmd run test:harness:ns607`; `npm.cmd run test:harness:ns608`; focused artificial-intelligence error test and package build | Passed syntax validation, 3 behavior-harness aggregation tests, 7 live-runner/grader tests, and the focused cause-wrapped network error regression. A controlled middle-trial failure proves that trials one and three still run, pass rate remains exact, and private error text does not enter public evidence |
| 2026-07-20 | NS-608 A06 hardening worktree | host-credential `npm.cmd run probe:ns608:balanced -- --trials=3`; host-credential `npm.cmd run probe:ns608:conflict -- --trials=3` | Both final formal batches passed 3/3. Every balanced trial completed five author turns, kept turns one through four tool-free, made exactly one search only after an explicit evidence request, retained both governed facts and one exact citation, and wrote no Codex authority. Every conflict trial completed five author turns, made four searches within four or five total Research calls, retained exact Japanese and English citation identities plus all six date/action/meaning boundaries, and wrote no Codex authority. All six trials confined the credential pointer, cleaned temporary authority, and preserved the byte-exact 413-file/2,497,618-byte real library |

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
