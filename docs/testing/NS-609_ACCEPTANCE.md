# NS-609 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-609.md`
Decision: pending author confirmation of Research Note ownership and Codex field mapping

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| Acceptance ID | Status | Verification | Required evidence |
| --- | --- | --- | --- |
| NS-609-A01 | in_progress | authoritative product/architecture records and `npm.cmd run docs:check` | owner and promotion mappings are explicitly approved and recorded before runtime edits; exact planned proofs remain aligned |
| NS-609-A02 | planned | `packages/contracts/test/research-notes.test.ts` | valid schema round trips and malformed, oversized, duplicate, contradictory, and unsupported inputs fail closed |
| NS-609-A03 | planned | `packages/storage/test/research-notes.test.ts` | atomic revision-checked authority lifecycle, isolation, diagnostics, and injected-failure recovery pass |
| NS-609-A04 | planned | Research Note evidence-resolution Storage tests | exact original-language evidence identity and every current/changed/missing/forbidden/cross-database/unreadable state pass without note mutation |
| NS-609-A05 | planned | `apps/server/test/research-note-routes.test.ts` | bounded API reads and classified error behavior pass |
| NS-609-A06 | planned | `apps/web/src/features/research/ResearchDatabaseWorkspace.ns609.test.tsx` and browser workflow | exact-passage note creation, editing, visible evidence separation, refresh, archive/restore, and stale-state UI pass |
| NS-609-A07 | planned | Proposal contract, Storage, Server, and Review tests | explicit Series, meaning, and Codex target produce one pending Proposal and zero pre-acceptance Codex writes |
| NS-609-A08 | planned | `packages/storage/test/proposals.test.ts`; `apps/server/test/proposal-routes.test.ts` | dependency recheck, snapshot, exact-once apply, edited candidate, and atomic stale/failure handling pass |
| NS-609-A09 | planned | adversarial contract/Storage/Server matrix and public-output scan | authority and permission isolation fail closed without content, path, or credential leakage |
| NS-609-A10 | planned | identified temporary-library server and real in-app browser | desktop and narrow author workflow reaches verified Codex authority with no dead control or incoherent overflow |
| NS-609-A11 | planned | focused checks, one final `npm.cmd run check`, docs/link check, diff/status/fingerprint inspection, and exact commits | all automated gates and repository safety evidence pass |
| NS-609-A12 | manual_pending | explicit author decision | author accepts or rejects the final connected workflow; automation cannot pass this row |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Pre-implementation Record

- The current contracts contain `research-note` and `create-research-note`
  Proposal enum values, but there is no Research Note schema, authority writer,
  route, UI, or Proposal application path. Those enum values are scaffolding and
  are not accepted as implementation evidence.
- Research Database and Source authority are library-scoped and isolated, while
  existing Proposal files are Series-scoped. The task records this ownership
  question instead of inferring behavior from either current path.
- The author's saved Provider credential remains present and unchanged. NS-609
  does not read, copy, replace, or test that credential.

## Run Ledger

| Date | Commit/worktree | Command or procedure | Result |
| --- | --- | --- | --- |
| 2026-07-20 | clean post-`b27e6f2` worktree | authority and runtime inventory over Research specifications, Research Database/Source contracts, Proposal contracts, Proposal storage, Review UI, STATUS, and TASKS | Confirmed the Research Note implementation is absent beyond Proposal enum scaffolding; recorded the two unresolved product boundaries before runtime changes |
| 2026-07-20 | clean post-`83ae262` worktree | official Zotero note/library model and official Novelcrafter Codex revision/progression research | Mature references support library-owned source-bound and standalone notes, separately versioned Canon description and non-Canon notes, and explicit story-state progression; recorded as recommendation evidence without claiming author approval |

## Repository Safety

- Do not mutate `data/library/` while planning or during generated-fixture tests.
- Do not print or persist plaintext credentials, credential references, private
  Source bodies, Provider raw responses, authorization headers, or private paths.
- Every runtime test uses a generated temporary library and verifies cleanup.
