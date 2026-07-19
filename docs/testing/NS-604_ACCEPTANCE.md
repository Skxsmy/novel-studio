# NS-604 Acceptance

Status: in_progress
Task: `docs/tasks/NS-604.md`
Updated: 2026-07-19

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| ID | Status | Proof type | Exact evidence target | Actual result |
| --- | --- | --- | --- | --- |
| NS-604-A01 | in_progress | specification/ADR | ADR-0020 plus Product, Reference Library, UX, traceability, architecture, security, task, dependency, and acceptance review | ADR and exact mapping recorded before runtime edits; final consistency review pending |
| NS-604-A02 | planned | contract tests | `packages/contracts/test/research-content.test.ts` and existing Research contract suites | Not run |
| NS-604-A03 | planned | parser tests | `apps/server/test/research-parsers.test.ts` generated TXT/Markdown/DOCX/PDF/EPUB/HTML fixtures | Not run |
| NS-604-A04 | planned | adversarial parser/route tests | damaged, disguised, scanned, external, traversal, symlink, bomb, active-content, empty, oversized, and mismatched inputs | Not run |
| NS-604-A05 | planned | storage/disk tests | `packages/storage/test/research-content-files.test.ts` exact binary authority and transaction failure matrix | Not run |
| NS-604-A06 | planned | migration/rollback tests | explicit version 2 to version 3 conversion, exact rollback/original, stale/foreign/damaged/failure matrix | Not run |
| NS-604-A07 | planned | automated index tests | `packages/storage/test/research-index.test.ts` identity, freshness, FTS, atomic rebuild, recovery, cancellation, and isolation | Not run |
| NS-604-A08 | planned | storage/server search tests | Chinese/Japanese/English/mixed/literal/filter/location/single-database query matrix | Not run |
| NS-604-A09 | planned | permission tests | local versus model-context retrieval plus permission projection update and redaction | Not run |
| NS-604-A10 | planned | network-security tests | `apps/server/test/research-web-import.test.ts` injected DNS, pinned HTTP, redirects, limits, sanitization, and no recursion | Not run |
| NS-604-A11 | planned | server/probe tests | routes, parser/index error mapping, authority-versus-index failure, logger redaction | Not run |
| NS-604-A12 | planned | Web/browser tests | Research component/app-shell tests and `tests/e2e/ns-604-research-formats.spec.ts` | Not run |
| NS-604-A13 | planned | commands/probes | focused/full checks, generated real files, API/disk/network probes, browser diagnostics, and repository ledger | Not run |
| NS-604-A14 | manual_pending | author visual decision | connected NS-604 Research workspace | Not requested |

Allowed matrix status values: `planned`, `in_progress`, `passed`,
`manual_pending`, `blocked`, `not_applicable`.

## Mapping Established Before Runtime Edits

The A01-A14 mapping above was recorded after reviewing the implemented NS-603
contracts, storage transactions, routes, index kernel, Web state, and existing
tests, and before changing runtime source files. Existing assertions for exact
original bytes, atomicity, revisions, isolation, redaction, dirty drafts, and
author visual acceptance remain required.

## Fixture And Adversarial Matrix

| Fixture | Required proof |
| --- | --- |
| UTF-8 and non-UTF-8 TXT | Original bytes unchanged; decoded warning and line/paragraph locations stable |
| Markdown | Headings and paragraphs become ordered Sections/Blocks without executing embedded HTML |
| DOCX | Real ZIP/Word fixture yields headings and paragraphs; external relationship is rejected |
| Text PDF | Real PDF fixture yields page locations; image-only PDF reports that OCR is required |
| EPUB | Container/package/spine order yields chapter locations; traversal, symlink, and expansion abuse are rejected |
| HTML | Script/style/event/embed content is removed; visible title/body/link text and DOM-derived location remain |
| Controlled web page | One public validated fetch saves URL/redirect/media/hash facts and sanitized snapshot; no linked asset/page is fetched |
| Mixed Chinese/Japanese/English | Original offsets, language spans, character/word match channels, and filters remain explainable |
| Two databases | Same content may exist in both, but Source IDs, roots, indexes, results, permissions, damage, and rebuild remain isolated |

## Run Ledger

| Date | Commit/worktree | Command or manual procedure | Result |
| --- | --- | --- | --- |
| 2026-07-19 | clean `codex/ns-514-overview` through `d78ff45`, then documentation-only worktree | Record NS-603 author A12 pass and map NS-604 A01-A14 before runtime edits | NS-603 closed; NS-604 authority, migration, parsing, indexing, UI, security, and manual gates mapped |

## Repository Safety

- Automated fixtures use temporary library roots.
- Do not read, modify, migrate, rebuild, or stage `data/library/`.
- Do not delete or silently rewrite version 2 Research authority.
- Do not weaken ZIP, URL, parser, FTS, permission, redaction, or transaction
  assertions to obtain a passing command.
- Diagnostic screenshots and DOM measurements cannot satisfy A14.
