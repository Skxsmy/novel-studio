# Handoff

Updated: 2026-07-19
Purpose: resume incomplete work only

## Resume Point

- Active support task: none; `GOV-002 Database Implementation Review And Hardening` is complete on the existing `codex/ns-514-overview` worktree.
- Active product task: `NS-603 / M6.2 Library-scoped Research Database Authority And Isolation`; A01-A12 are mapped before runtime edits.
- NS-602 is complete. The author explicitly accepted the overall connected Research layout on 2026-07-19, then required Word, PDF, web-link inputs and multiple isolated Research Databases that are not owned by a Series.
- NS-514 is paused with P0-P6 and automated A15 passed; only explicit author visual acceptance A16 remains open.
- NS-601 changes documentation only and is complete. NS-514 follow-up work is separately committed at `b7ae1be`; preserve `data/library/` while reviewing NS-602.
- NS-602 follows `b7ae1be` at `bb37126`; this clean commit is the GOV-002 review baseline.

## GOV-002 Closure

- Reviewed every production SQLite opener, SQL/rebuild path, Research file transaction, Research route, and connected Research UI state using source inspection, official SQLite documentation, new failure reproductions, independent Fastify/disk probes, and a 20,000-row performance probe rather than relying on existing tests alone.
- Fixed fifteen confirmed defects covering foreign/cross-Series identity, corrupt index replacement, WAL/journal bundles, cancellation, reader gaps, duplicate imports, canonical originals, literal short search, pre-journal cleanup, FTS/core drift, FTS secure delete, second-failure rollback preservation, damaged-original updates, and unsaved property drafts.
- Full typecheck, 49 files/523 tests, production build, 174-file documentation check, and diff check pass. The in-app Browser blocked the local URL by policy, so no diagnostic visual pass or author acceptance is claimed.
- Read `docs/testing/GOV-002_DATABASE_REVIEW.md` before NS-603. Process-local coordination, durable projector freshness, bounded deep-FTS diagnosis, symlink-safe containment, schema-v2 constraints, backups, scaling, and multilingual retrieval remain explicit recommendations or risks rather than completed features.

## Work Completed In This Task

- Audited the current per-Series SQLite/FTS5 prototype, its unversioned schema, live-clear rebuild, driver, local SQLite engine, and five existing database headers without reading indexed content.
- Drafted `docs/architecture/DATABASE_ARCHITECTURE.md` with topology, novel-text/narrative tables, CJK/word FTS shards, Chinese-to-Japanese/English retrieval, source hashes, WAL policy, migration, atomic rebuild, corruption recovery, Reference Library, vector boundary, security, performance, and phased implementation.
- Added accepted ADR-0018 and NS-601 task/acceptance records. Runtime database code remains unchanged.
- Connected the database plan to Product P-06, Reference Library, M6 traceability, and the current/data/target architecture entry documents. The author-directed expansion now distinguishes original-language lexical search from cross-language semantic retrieval, keeps original evidence authoritative, and adds language/profile/privacy failure fixtures.
- After that expansion, documentation checks pass for 168 Markdown files, all seven governance tests pass, and `git diff --check` reports no whitespace error.
- Fixed the documentation governance transition check so an honest `NS-510 / M5` to first-task `NS-601 / M6` transition is accepted while a jump to `NS-602` is rejected.
- Implemented NS-602 SourceDocument v1 contracts, strict UTF-8 TXT/Markdown validation, coordinated original/JSON authority transactions, duplicate detection, revision-safe properties, and list/get/import/update routes.
- Added the Skill-designed independent Research workspace with source shelf, unchanged original reader, property inspector, AI permission, stable empty/error/upload/save/conflict states, selection restoration, compact inspector flow, and narrow source drawer.
- Added `IndexDatabase` application identity `0x4E534958`, schema checksum/version/health, fixed connection policy, per-Series serial write lane, temporary-build validation, rollback replacement, and Scene/Codex/mention/ambiguity/Context Bundle/Model Call compatibility projection.
- Full workspace typecheck, production build, 505 tests, 130 Storage tests, 15 focused Web tests, docs check, and the focused real-Chrome Research workflow pass. Current E2E files now isolate their temporary library; the aggregate run is 5 passed and one historical Chinese-shell test failed.
- Implemented NS-603 library-scoped ResearchDatabase v1 and database-owned SourceDocument v2 authority, isolated roots and scoped routes, multi-Series links, explicit legacy discovery/copy receipts, and the connected database selector/settings workflow.
- Added no-Series creation, two-database isolation, same-hash cross-database import, stale/damaged/injected-failure, link/unlink, exact legacy bytes, dirty/conflict, refresh restoration, compact layout, and logger-body omission evidence. Real browser work found and fixed selection erasure, cross-database stale Source requests, and an empty-reader scrollbar.

- Replaced the production reference runtime's fixture-only Project Library handler with a connected handler that uses `useProjectSession.createSeries` and `openSeries`.
- Preserved the accepted appbar, Project Library menu, New Series dialog, focus behavior, Escape/backdrop dismissal, loading state, and real error path.
- Added focused regressions for real Series creation, existing-Series selection, failure display, and fixture-handler exclusion.
- Repaired the Settings-to-Workshop model-profile boundary: two profiles remain distinct, every profile mutation refreshes mounted Workshop without reload, and the chooser preserves a still-valid selection while exposing both exact models.
- Reworked Model connections into a responsive connection browser plus focused editor. Connection rows show name, Provider, and model; new records use `Add connection`, existing records use `Save changes`, and credential operations stay with the credential field.
- Corrected the connected reference-runtime omission order so Project removal cannot leave the old Write or Workshop fixture script active against connected DOM.
- Corrected NS-514 reference-contract parsing to canonicalize Windows CRLF checkouts to the frozen Git LF identity; the binding reference and generated snapshots remain unchanged.
- Passed all-workspace typecheck, 52 focused Workshop route tests, the full 176-test Web suite, the 486-test root suite, two real-Chrome Settings/Workshop tests, 11 NS-514 documentation tests, and the full contracts/AI/storage/server/Web production build.
- From a new empty isolated library, real browser interaction created two Series, switched between them, then created a Codex Entry, Workshop session, and Ollama Model Profile. API reads and JSON authority files confirmed all four creation paths.
- A separate isolated browser pass created `Primary Ollama / llama3.1` and `Secondary Ollama / qwen2.5`, confirmed two distinct API IDs, returned to Workshop without reload, displayed both chooser entries, and switched to `qwen2.5`. Desktop and 700-pixel compact Settings screenshots were inspected as diagnostics, not A16 acceptance.
- Used the saved DeepSeek profile without exposing its credential to complete seven author workflows with multiple rounds per problem: premise, opening Scene, 12-round character arc, 19-round ending branch, cancellation/recovery, discard/delete, and Agent Codex create/update. Branch, edit/resend, export, archive/restore, permanent delete, attachment parsing, stream cancellation, tool confirmation, duplicate rejection, and retry/abandon paths were exercised.
- Made natural author corrections durable across the session and beyond the recent 40-message window. A persistent source lock excludes prior Assistant candidates after ordinary feedback such as "do not invent" or "use only the source"; author messages and parsed attachments remain authoritative.
- Repaired malformed native tool quotation, identical post-success tool replay, duplicated Research append content, and the `start.ps1 -Stop` mutex deadlock found during the real workflow.

## Still Required

- Commit the task-scoped NS-603 work and obtain the author's explicit A12 visual decision. A01-A11 pass; do not relabel diagnostic browser inspection as A12.
- Resolve the implementation-time analyzer, multilingual profile, vector engine, and resource-budget choices before the corresponding NS-604/605 runtime slices.
- Obtain the author's explicit visual decision for NS-603-A12 after the connected multi-database page is implemented; diagnostic screenshots cannot satisfy it.
- Obtain explicit author visual acceptance for A16. Diagnostic screenshots and the browser function pass do not satisfy that gate.
- Keep future database review fixes in their support-task commit; do not rewrite the separate NS-514, NS-601, or NS-602 task history.

## Repository Safety

- Preserve the pre-existing untracked `data/library/` directory; it is not A13 test data.
- The temporary `data/ns514-create-regression*` and `data/ns514-model-sync-regression` libraries were created only for verification and should not remain in the final worktree.
- Do not alter `docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html`; it remains the tracked binding reference.
