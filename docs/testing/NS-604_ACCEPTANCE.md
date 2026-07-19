# NS-604 Acceptance

Status: in_progress
Task: `docs/tasks/NS-604.md`
Updated: 2026-07-19

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| ID | Status | Proof type | Exact evidence target | Actual result |
| --- | --- | --- | --- | --- |
| NS-604-A01 | passed | specification/ADR | ADR-0020 and ADR-0021 plus Product, Reference Library, UX, traceability, architecture, security, task, dependency, and acceptance review | Records now agree that NS-604 stops at durable Sources and local single-database lexical search; NS-605-NS-608 are separate unstarted tasks, and documentation check passes for 186 Markdown files |
| NS-604-A02 | passed | contract tests | `packages/contracts/test/research-content.test.ts` and existing Research contract suites | Contracts reject malformed structures and preserve v2 reads; 7 files/55 tests passed, including linear validation of a canonical 25 MiB Base64 payload, with computed hash verification in Storage |
| NS-604-A03 | passed | parser tests | `apps/server/test/research-parsers.test.ts` generated TXT/Markdown/DOCX/PDF/EPUB/HTML fixtures plus large-text stress | Original fixtures remain deterministic; 3 MiB single-line and many-paragraph TXT files produce bounded Blocks with precomputed line offsets instead of quadratic prefix scans; a Unicode boundary fixture proves surrogate pairs are not split |
| NS-604-A04 | passed | adversarial parser/route tests | damaged, disguised, scanned, external, traversal, symlink, bomb, active-content, empty, oversized, and mismatched inputs | Parser and route matrices reject unsafe input before visible authority; full Server 17 files/134 tests passed |
| NS-604-A05 | passed | storage/disk tests | `packages/storage/test/research-content-files.test.ts` exact binary authority, transaction failure, and large-content paging matrix | Existing exact-byte and transaction assertions pass; version 3 Source views expose summaries and the new bounded reader returns at most the requested 100 Blocks with stable offsets |
| NS-604-A06 | passed | migration/rollback tests | explicit version 2 to version 3 conversion, exact rollback/original, stale/foreign/damaged/failure matrix | Explicit migration matrix passed with unchanged original, exact v2 rollback JSON, deterministic content, and no partial failure |
| NS-604-A07 | passed | automated index tests | `packages/storage/test/research-index.test.ts` identity, freshness, FTS, atomic rebuild, recovery, cancellation, isolation, and large-source search | Existing index matrix passes; a direct 25 MiB import produced 1,639 Blocks and 22,938 searchable Chunks, then returned the unique final marker with its Block identity and order |
| NS-604-A08 | passed | storage/server search tests | Chinese/Japanese/English/mixed/literal/filter/location/single-database query matrix | CJK/word/literal/filter/location matrix passed; Chrome found and regressions cover UTF-8 Japanese and kana-context Kanji language labeling |
| NS-604-A09 | passed | permission tests | local versus model-context retrieval plus permission projection update and redaction | Local results include `never` Sources while model-context returns none; update and independent probe passed without returning blocked text |
| NS-604-A10 | passed | network-security tests | `apps/server/test/research-web-import.test.ts` injected DNS, pinned HTTP, redirects, limits, sanitization, and no recursion | DNS/address pinning, four-hop redirect limit, private/mapped target rejection, downgrade/loop/media/size/time bounds and sanitization passed; independent local server received zero requests |
| NS-604-A11 | passed | server/probe tests | routes, parser/index error mapping, authority-versus-index failure, logger redaction, and large-import errors | Existing route/redaction proof passes; real 3 MiB HTTP uploads return `201` in the focused route suite and the direct 25 MiB probe returns `201` with a 1,027-byte response instead of bare `Internal Server Error` |
| NS-604-A12 | passed | Web/browser tests | Research component/app-shell tests, bounded reader paging, and `tests/e2e/ns-604-research-formats.spec.ts` | Web paging/navigation/cancellation suite passes 7 tests; real Chrome passes both structured-format and 3 MiB upload/page/search workflows in 7.8 seconds; the connected browser independently imported 3 MiB, paged from Blocks 1-40 to 41-80, and opened the final hit at Blocks 161-196 without console errors |
| NS-604-A13 | passed | commands/probes | focused/full checks, generated real files, API/disk/network/25 MiB stress probes, browser diagnostics, and repository ledger | `npm.cmd run check` passes 186-file documentation, all workspace typechecks, 59 files/584 tests, and production build; focused Chrome and final 25 MiB probes pass; final diff check remains required immediately before commit |
| NS-604-A14 | manual_pending | author visual decision | connected NS-604 Research workspace | Automated and connected-browser defect closure is ready for review, but only the author can accept or reject the resulting Research workflow |

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
| 2026-07-19 | implementation tree committed as `1017c88` | `npm.cmd run check` | Passed documentation check for 181 files, all workspace typechecks, 59 files/579 tests, and production build; Vite reported only its non-failing large-chunk warning |
| 2026-07-19 | `1017c88` implementation tree and temporary E2E library | `npm.cmd run test:e2e:quick -- tests/e2e/ns-602-research.spec.ts tests/e2e/ns-603-research-databases.spec.ts tests/e2e/ns-604-research-formats.spec.ts --project=chrome` | Three real-Chrome workflows passed in 6.6 seconds after the run exposed and prompted fixes for Japanese decoding and kana-context Kanji language labeling |
| 2026-07-19 | temporary library roots only | Independent Fastify/disk/network and final Storage scripts outside Vitest/Playwright | Source v3 and exact original bytes verified; local `ja` hit was one, model-context and sibling hits were zero; private target was rejected before the local server received a request |
| 2026-07-19 | connected temporary preview library | In-app Browser diagnostic attempt | Localhost reload was rejected by Browser policy; no in-app visual inspection or A14 acceptance is claimed |
| 2026-07-19 | clean `1017c88` on `codex/ns-514-overview`, ahead 8 | `git status --short --branch` after implementation commit | No task or unrelated worktree changes remained before this evidence-only update; `data/library/` was untouched |
| 2026-07-19 | clean `bb83a34` plus temporary preview databases | Author 3 MiB report followed by two generated real HTTP uploads | Single-line 3 MiB TXT returned `400 VALIDATION_ERROR` because one Block exceeded 100,000 characters; many-paragraph 3 MiB TXT returned `201` only after about 73 seconds. Large-source acceptance reopened before runtime edits |
| 2026-07-19 | task worktree after `bb83a34`; temporary library | Focused large-parser/route, Storage index, Web paging, and contract suites | Final parser/route run passed 11 tests, Storage index passed 5, Web paging/cancellation passed 7, and Contracts passed 5; generated 3 MiB HTTP uploads complete in about 3.5 seconds |
| 2026-07-19 | task worktree after `bb83a34`; temporary library | Direct 25 MiB full HTTP import, content-page, and final-marker search probe | `201` in 9,399 ms; 1,027-byte import response; 1,639 Blocks; 22,938 Chunks; 40-Block page and one final-marker result returned; temporary library removed |
| 2026-07-19 | task worktree after `bb83a34`; isolated Chrome library | `npm.cmd run test:e2e:quick -- tests/e2e/ns-604-research-formats.spec.ts --project=chrome` | Initial fixture-size and locator mistakes failed before a product assertion; after correcting the test, both format/isolation and 3 MiB upload/page/search workflows passed in 7.6 seconds |
| 2026-07-19 | task worktree after `bb83a34`; connected preview library | Real visible file chooser, 3 MiB TXT import, reader paging, final-marker search, result opening, and browser console inspection | Imported 3,145,343 bytes as 196 Blocks and 2,739 searchable passages; opened Blocks 41-80, then the exact final result at Blocks 161-196; no browser error or warning; diagnostic evidence only, not A14 acceptance |
| 2026-07-19 | task worktree after `bb83a34`; isolated Chrome library | Final `npm.cmd run test:e2e:quick -- tests/e2e/ns-604-research-formats.spec.ts --project=chrome` | Two real-Chrome workflows passed in 7.8 seconds after the Unicode and cancellation review fixes |
| 2026-07-19 | latest production build; temporary library removed in `finally` | Final direct 25 MiB Fastify probe through create/import/page/search routes | `201` in 9,548 ms; 1,027-byte import response; 1,639 Blocks; 22,938 Chunks; 40-Block page and one final-marker hit returned |
| 2026-07-19 | task worktree after `bb83a34` | `npm.cmd run check` | Passed documentation check for 186 Markdown files, all workspace typechecks, 59 files/584 tests, and production build; Vite emitted only its existing non-failing chunk-size warning |

## Repository Safety

- Automated fixtures use temporary library roots.
- Do not read, modify, migrate, rebuild, or stage `data/library/`.
- Do not delete or silently rewrite version 2 Research authority.
- Do not weaken ZIP, URL, parser, FTS, permission, redaction, or transaction
  assertions to obtain a passing command.
- Diagnostic screenshots and DOM measurements cannot satisfy A14.
