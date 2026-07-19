# NS-602 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-602.md`
Updated: 2026-07-19

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.
Compatibility mapping: `Series → series`, `Volume → book`, `Chapter → act`,
`Act → chapter`, and `Scene → scene`.

## Acceptance Matrix

| ID | Status | Proof type | Exact evidence target | Actual result |
| --- | --- | --- | --- | --- |
| NS-602-A01 | passed | contract/source | `packages/contracts/test/research.test.ts`; product and Reference Library specifications | Three contract tests pass; source facts, editable properties, bounded import envelope, and revision update are distinct |
| NS-602-A02 | passed | automated server test | `apps/server/test/research-routes.test.ts` — `imports only verified UTF-8 TXT and Markdown source bytes` and `rejects malformed, mismatched, empty, oversized, and unsafe source uploads before authority creation` | Three route tests pass, including malformed Base64, byte mismatch, encoding, extension/media, path, empty, and size rejection |
| NS-602-A03 | passed | storage test | `packages/storage/test/research-files.test.ts` transaction, duplicate, and recovery cases | Injected first-mutation failure rolls back original and JSON; duplicate SHA-256 leaves one source |
| NS-602-A04 | passed | storage test | `packages/storage/test/research-files.test.ts` revision/restart/immutability cases | Restart reads the source; stale revision conflicts; original bytes and immutable facts remain unchanged |
| NS-602-A05 | passed | storage test | `packages/storage/test/index-database.test.ts` kernel identity/health/concurrency cases | Fixed `0x4E534958`, version 1 checksum, WAL policy, ready/legacy/drift/wrong/corrupt health, and serialized lane pass |
| NS-602-A06 | passed | storage test | `packages/storage/test/index-database.test.ts` atomic rebuild failure matrix | Cancellation, build failure, and post-live-move swap failure retain the old row; successful replacement reopens with only the new row and no build artifacts |
| NS-602-A07 | passed | automated regression | `packages/storage/test/index-database.test.ts` — `preserves Scene Codex mention ambiguity Context Bundle and Model Call projections behind the versioned kernel`; full `packages/storage/test/` suite | Compatibility test passes all six projections; full Storage suite passes 130 tests |
| NS-602-A08 | passed | automated server test | `apps/server/test/research-routes.test.ts` — `exposes only real Research list get import and update results without logging source text` | List/get/import/update return repository data, stale update is `409`, DELETE is absent, and the logger does not contain private source text |
| NS-602-A09 | passed | automated Web test | `apps/web/src/app/ReferenceReplica.test.tsx` — `enables Research after Review and returns to the selected source`; `ReferenceResearchWorkspace.test.tsx` — `falls back safely when the restored source no longer exists` | Navigation, brand context, leave/return, local selection restoration, and missing-source fallback pass |
| NS-602-A10 | passed | Web browser automation | `ReferenceResearchWorkspace.test.tsx` import/empty/failure cases; Playwright `imports two Research sources and restores the selected original preview` | Component tests pass empty/local reject/server reject/TXT/Markdown states; real Chrome imports mixed Chinese/Japanese/English sources and restores preview |
| NS-602-A11 | passed | automated Web test | `ReferenceResearchWorkspace.test.tsx` — `saves editable source properties with revision conflict recovery while immutable facts remain read only` | Properties and permission save; conflict reloads latest revision while retaining author draft for explicit retry |
| NS-602-A12 | manual_pending | Web/browser/manual | component accessibility assertions, desktop/compact diagnostics, explicit author visual decision | Keyboard-labeled controls and 960/720-pixel no-overflow layouts pass diagnostics; empty, selected, inspector-below, and source-drawer states inspected; author decision remains open |
| NS-602-A13 | passed | commands/repository | focused/full suites, typecheck, build, docs, diff, commit, status ledger | Full typecheck/build/tests/docs pass; focused NS-602 Chrome passes; full E2E is 5 passed/1 obsolete Chinese-shell test failed; NS-514 is isolated in `b7ae1be` and NS-602 is closed in its own following commit |

Allowed matrix status values: `planned`, `in_progress`, `passed`,
`manual_pending`, `blocked`, `not_applicable`.

## Run Ledger

| Date | Commit/worktree | Command or manual procedure | Result |
| --- | --- | --- | --- |
| 2026-07-19 | branch `codex/ns-514-overview`, base `e889c4c` | Install and inspect `ui-design` Skill pinned to `796166cdbe27b9aac6e069d1825b8c9d3b0b1582`; read design-direction and validation references | Apache-2.0 design-only Skill installed; no Novel Studio dependency added; Research uses direct React design rather than Figma |
| 2026-07-19 | NS-602 opening | Map A01-A13 to named tests/manual proof before runtime edits | Acceptance map established; implementation not yet claimed |
| 2026-07-19 | uncommitted NS-602 | `npm.cmd run test -w @novel-studio/storage -- test/index-database.test.ts test/research-files.test.ts` | 2 files, 8 tests passed |
| 2026-07-19 | uncommitted NS-602 | `npm.cmd run test -w @novel-studio/storage` | 9 files, 130 tests passed |
| 2026-07-19 | uncommitted NS-602 | `npm.cmd run test -w @novel-studio/web -- src/features/research/ReferenceResearchWorkspace.test.tsx src/app/ReferenceReplica.test.tsx` | 2 files, 15 tests passed |
| 2026-07-19 | uncommitted NS-602 follow-up | `npm.cmd run test -w @novel-studio/web` and `npm.cmd run build -w @novel-studio/web` after missing-detail recovery fix | 20 files, 182 tests passed; production Web build passed with the existing large-chunk warning |
| 2026-07-19 | uncommitted NS-602 | `npm.cmd run typecheck` | contracts, AI, storage, server, and Web passed |
| 2026-07-19 | uncommitted NS-602 | `npm.cmd run test` | 49 files and 505 tests passed across all workspaces |
| 2026-07-19 | uncommitted NS-602 | `npm.cmd run build` | contracts, AI, storage, server, and production Web build passed; Vite retained its existing large-chunk warning |
| 2026-07-19 | uncommitted NS-602 | `npm.cmd run docs:check` | 171 Markdown files passed |
| 2026-07-19 | uncommitted NS-602 | `npm.cmd run test:e2e:quick -- tests/e2e/ns-602-research.spec.ts` | One real-Chrome author workflow passed with two mixed-language file uploads, property save, leave/return, and compact geometry |
| 2026-07-19 | uncommitted NS-602 | `npm.cmd run test:e2e:quick` after per-test temporary-library isolation | 5 current tests passed; historical `browser-acceptance.spec.ts` still fails on retired Chinese heading `小说工作室`; no test was skipped or weakened |
| 2026-07-19 | isolated local server and in-app browser | Inspect empty and populated desktop, 960-pixel inspector-below, 720-pixel source-drawer, focus, clipping, and scroll geometry | No persistent overlap or horizontal overflow found; one resize transition frame was remeasured and confirmed non-product; author visual acceptance remains pending |
| 2026-07-19 | task-scoped repository split | `git diff --cached --check`, boundary search, separate NS-514 commit `b7ae1be`, then separate NS-602 commit | Shared shell, test, changelog, and storage changes were split by task; no NS-514 implementation is absorbed into NS-602 |

## Repository Safety

- Preserve every pre-existing uncommitted NS-514 implementation and record.
- Preserve `data/library/`; automated fixtures must use isolated temporary roots.
- Do not modify the old binding-reference HTML to manufacture a Research design.
