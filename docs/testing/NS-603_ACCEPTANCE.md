# NS-603 Acceptance

Status: complete
Task: `docs/tasks/NS-603.md`
Updated: 2026-07-19

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| ID | Status | Proof type | Exact evidence target | Actual result |
| --- | --- | --- | --- | --- |
| NS-603-A01 | passed | specification/ADR | ADR-0019 plus Product, Reference Library, UX, traceability, and architecture updates | Series projections and library Research Databases are distinct; accepted link/query boundaries are recorded |
| NS-603-A02 | passed | contract test | ResearchDatabase v1, SourceDocument v2, update and legacy schemas | 7 focused contract tests passed |
| NS-603-A03 | passed | storage test | isolated roots, create/list/get/update/restart/foreign/stale/failure matrix | 12 focused Storage tests passed, including restart, damaged sibling, stale revision, and injected failure |
| NS-603-A04 | passed | storage/server test | per-database duplicate and Source isolation | Same hash is accepted in two databases while duplicate and foreign ownership remain database-scoped |
| NS-603-A05 | passed | storage/server test | one database linked to two Series, unlink, missing Series rejection | Storage and route tests pass; missing Series leaves the revision unchanged |
| NS-603-A06 | passed | storage/disk test | explicit legacy copy, provenance, exact bytes, rollback, injected failure | Legacy bytes remain exact; failed copy exposes no target Source; successful copy records provenance and receipt |
| NS-603-A07 | passed | automated server test | `apps/server/test/research-database-routes.test.ts` library-scoped database and Source routes plus logger redaction | 6 focused route tests passed; an independent logger-enabled import probe logged method, URL, and status only, not body/base64/original text |
| NS-603-A08 | passed | automated Web/browser | `apps/web/src/features/research/ReferenceResearchWorkspace.test.tsx`, `apps/web/src/app/ReferenceReplica.test.tsx`, and `tests/e2e/ns-603-research-databases.spec.ts` no-Series create, switch, edit, link, import, return, isolated shelf | 22 focused Web tests and the real-Chrome two-database workflow passed |
| NS-603-A09 | passed | automated Web test | `apps/web/src/features/research/ReferenceResearchWorkspace.test.tsx` dirty database/source switching, link/import block, save race and conflict | Dirty source blocks import/database/source switching; source and database conflicts preserve drafts; migration requires a saved link |
| NS-603-A10 | passed | Web and manual review | `apps/web/src/features/research/ReferenceResearchWorkspace.test.tsx`, `docs/design/ui-redesign/NS-603_RESEARCH_DATABASE_UI_CHECKLIST.md`, and manual desktop/compact inspection | Desktop diagnostic inspection found and fixed an empty-reader scrollbar; 720px geometry and compact Settings label pass without horizontal overflow |
| NS-603-A11 | passed | commands/probes | focused/full checks, API/disk probe, repository ledger | 52 files and 540 tests, full typecheck, production build, 178-file docs check, two E2E workflows, independent probes, and diff check pass; implementation committed at `d518666` |
| NS-603-A12 | passed | author visual decision | connected multi-database Research workspace at `http://127.0.0.1:4317/` | Author response on 2026-07-19: `通过。继续NS-604` |

Allowed matrix status values: `planned`, `in_progress`, `passed`,
`manual_pending`, `blocked`, `not_applicable`.

## Acceptance Mapping Established Before Runtime Edits

The exact A01-A12 mapping above was recorded before contract, storage, route,
or Web runtime files were changed. Existing tests will be updated only where
the author-approved ownership contract changed; assertions for atomicity,
revision protection, original-byte validation, redaction, and dirty drafts
remain required.

## Run Ledger

| Date | Commit/worktree | Command or manual procedure | Result |
| --- | --- | --- | --- |
| 2026-07-19 | `codex/ns-514-overview` at `8d62932` | Record author acceptance of NS-602 and map NS-603 A01-A12 before runtime edits | Mapping established; implementation not yet claimed |
| 2026-07-19 | dirty NS-603 worktree | Focused Contracts, Storage, Server, Research Web, and app-shell tests | 7 + 12 + 6 + 11 + 11 tests passed |
| 2026-07-19 | dirty NS-603 worktree | `npm.cmd run test -w @novel-studio/web` | 20 files and 187 tests passed after correcting one test-only persistence wait |
| 2026-07-19 | dirty NS-603 worktree | `npm.cmd run build` and later focused Web rebuilds | Production Contracts, AI, Storage, Server, and Web build passed; Vite emitted only the existing large-chunk warning |
| 2026-07-19 | dirty NS-603 worktree | `npm.cmd run test:e2e:quick -- tests/e2e/ns-602-research.spec.ts tests/e2e/ns-603-research-databases.spec.ts` | 2 real-Chrome tests passed; no console/page/HTTP errors; 720px layout fits |
| 2026-07-19 | temporary library outside repository | Independent REST and disk probe with one Series, two databases, and the same Chinese/Japanese/English source in both | 2 isolated database roots, 1 Source each, distinct Source IDs, correct ownership, exact original bytes, same hash accepted across databases, and one explicit Series link |
| 2026-07-19 | temporary library outside repository | Logger-enabled Fastify import probe with unique private-text sentinel | POSTs returned 201; logs contained request method/URL/status only and omitted payload, base64, and original text |
| 2026-07-19 | temporary library outside repository | In-app Browser diagnostic at 1280px plus source/geometry review | Database creation UI inspected; empty-reader scrollbar found and fixed; diagnostic inspection is not author acceptance |
| 2026-07-19 | dirty NS-603 worktree | `npm.cmd run typecheck` | Contracts, AI, Storage, Server, and Web typechecks passed |
| 2026-07-19 | dirty NS-603 worktree | `npm.cmd run test` | 52 files and 540 tests passed: Server 112, Web 188, AI 39, Contracts 50, Storage 151 |
| 2026-07-19 | dirty NS-603 worktree | `npm.cmd run docs:check` | Documentation check passed for 178 Markdown files |
| 2026-07-19 | dirty NS-603 worktree | `git diff --check` | Passed with no whitespace errors; Git reported only expected checkout line-ending notices |
| 2026-07-19 | `d518666` | `git commit -m "NS-603 feat(research): add isolated library databases"` | 43 task-scoped files committed; A12 intentionally remains open |
| 2026-07-19 | committed preview through `d78ff45` | Author separately reviewed the connected multi-database Research workspace | A12 passed with the response `通过。继续NS-604`; NS-603 may close |

## Repository Safety

- Automated fixtures use temporary library roots.
- Do not read, modify, rebuild, migrate, or stage `data/library/`.
- Do not delete or rewrite NS-602 legacy Research authority during tests.
- Do not change the binding reference HTML or claim diagnostic inspection as
  author acceptance.
