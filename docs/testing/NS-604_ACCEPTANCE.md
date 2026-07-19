# NS-604 Acceptance

Status: in_progress
Task: `docs/tasks/NS-604.md`
Updated: 2026-07-19

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| ID | Status | Proof type | Exact evidence target | Actual result |
| --- | --- | --- | --- | --- |
| NS-604-A01 | passed | specification/ADR | ADR-0020 plus Product, Reference Library, UX, traceability, architecture, security, task, dependency, and acceptance review | Source v3, exact originals/content, controlled web, isolated keyword search, dependencies, and deferred NS-605 scope agree; 181-document check passed |
| NS-604-A02 | passed | contract tests | `packages/contracts/test/research-content.test.ts` and existing Research contract suites | Contracts reject malformed structures and preserve v2 reads; 7 files/54 tests passed, with computed hash verification in Storage |
| NS-604-A03 | passed | parser tests | `apps/server/test/research-parsers.test.ts` generated TXT/Markdown/DOCX/PDF/EPUB/HTML fixtures | Six real-format parser tests passed with deterministic structure, locations, warnings, hashes, and language spans |
| NS-604-A04 | passed | adversarial parser/route tests | damaged, disguised, scanned, external, traversal, symlink, bomb, active-content, empty, oversized, and mismatched inputs | Parser and route matrices reject unsafe input before visible authority; full Server 17 files/132 tests passed |
| NS-604-A05 | passed | storage/disk tests | `packages/storage/test/research-content-files.test.ts` exact binary authority and transaction failure matrix | Exact binary, v3 Source/content, restart/hash/ownership, and injected-failure assertions passed; independent disk probe reconfirmed exact bytes |
| NS-604-A06 | passed | migration/rollback tests | explicit version 2 to version 3 conversion, exact rollback/original, stale/foreign/damaged/failure matrix | Explicit migration matrix passed with unchanged original, exact v2 rollback JSON, deterministic content, and no partial failure |
| NS-604-A07 | passed | automated index tests | `packages/storage/test/research-index.test.ts` identity, freshness, FTS, atomic rebuild, recovery, cancellation, and isolation | Identity/schema/freshness, atomic swap/recovery, cancellation/failure, foreign index, and sibling isolation passed |
| NS-604-A08 | passed | storage/server search tests | Chinese/Japanese/English/mixed/literal/filter/location/single-database query matrix | CJK/word/literal/filter/location matrix passed; Chrome found and regressions cover UTF-8 Japanese and kana-context Kanji language labeling |
| NS-604-A09 | passed | permission tests | local versus model-context retrieval plus permission projection update and redaction | Local results include `never` Sources while model-context returns none; update and independent probe passed without returning blocked text |
| NS-604-A10 | passed | network-security tests | `apps/server/test/research-web-import.test.ts` injected DNS, pinned HTTP, redirects, limits, sanitization, and no recursion | DNS/address pinning, four-hop redirect limit, private/mapped target rejection, downgrade/loop/media/size/time bounds and sanitization passed; independent local server received zero requests |
| NS-604-A11 | passed | server/probe tests | routes, parser/index error mapping, authority-versus-index failure, logger redaction | Scoped routes, readable errors, authority success during index failure, and body/logger omission passed in the 132-test Server suite and independent probes |
| NS-604-A12 | passed | Web/browser tests | Research component/app-shell tests and `tests/e2e/ns-604-research-formats.spec.ts` | Web 21 files/193 tests passed; three real-Chrome Research workflows passed, including DOCX/web/HTML, exact result opening, second-database isolation, and 720-pixel overflow checks |
| NS-604-A13 | passed | commands/probes | focused/full checks, generated real files, API/disk/network probes, browser diagnostics, and repository ledger | Final `npm.cmd run check` passed typecheck, 59 files/579 tests, production build and 181 documents; diff/safety checks and independent probes passed without touching `data/library/` |
| NS-604-A14 | manual_pending | author visual decision | connected NS-604 Research workspace | Connected preview is available at `http://127.0.0.1:4317/`; author acceptance or rejection remains pending |

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
| 2026-07-19 | `33a8e0f` planning commit plus task worktree | Generated real TXT/Markdown/DOCX/PDF/EPUB/HTML parser tests and adversarial URL/ZIP/parser/route suites | All focused parser, controlled-web, contract, storage, Server, and Web suites passed |
| 2026-07-19 | task worktree | `npm.cmd run check` | Passed documentation check for 181 files, all workspace typechecks, 59 files/579 tests, and production build; Vite reported only its non-failing large-chunk warning |
| 2026-07-19 | task worktree and temporary E2E library | `npm.cmd run test:e2e:quick -- tests/e2e/ns-602-research.spec.ts tests/e2e/ns-603-research-databases.spec.ts tests/e2e/ns-604-research-formats.spec.ts --project=chrome` | Three real-Chrome workflows passed in 6.6 seconds after the run exposed and prompted fixes for Japanese decoding and kana-context Kanji language labeling |
| 2026-07-19 | temporary library roots only | Independent Fastify/disk/network and final Storage scripts outside Vitest/Playwright | Source v3 and exact original bytes verified; local `ja` hit was one, model-context and sibling hits were zero; private target was rejected before the local server received a request |
| 2026-07-19 | connected temporary preview library | In-app Browser diagnostic attempt | Localhost reload was rejected by Browser policy; no in-app visual inspection or A14 acceptance is claimed |

## Repository Safety

- Automated fixtures use temporary library roots.
- Do not read, modify, migrate, rebuild, or stage `data/library/`.
- Do not delete or silently rewrite version 2 Research authority.
- Do not weaken ZIP, URL, parser, FTS, permission, redaction, or transaction
  assertions to obtain a passing command.
- Diagnostic screenshots and DOM measurements cannot satisfy A14.
