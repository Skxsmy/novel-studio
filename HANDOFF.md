# Handoff

Updated: 2026-07-19
Purpose: resume incomplete work only

## Resume Point

- Paused product task: `NS-602 / M6.1 Database Kernel And Research Source Vertical Slice` on the existing `codex/ns-514-overview` worktree; only explicit author visual acceptance remains open after repository closure.
- NS-514 is paused with P0-P6 and automated A15 passed; only explicit author visual acceptance A16 remains open.
- NS-601 changes documentation only and is complete. NS-514 follow-up work is separately committed at `b7ae1be`; preserve `data/library/` while reviewing NS-602.
- NS-602 follows `b7ae1be` as its own task-scoped implementation commit.

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

- Resolve the implementation-time analyzer, multilingual profile, vector engine, and resource-budget choices recorded in the database plan before the corresponding NS-603/605 runtime slices.
- Obtain the author's explicit Research visual decision for NS-602-A12; diagnostic screenshots do not satisfy it.
- Keep NS-602 paused until the author explicitly accepts or rejects the connected Research page; the separate task-scoped commit satisfies the repository portion of A13.
- Obtain explicit author visual acceptance for A16. Diagnostic screenshots and the browser function pass do not satisfy that gate.
- Keep future database review fixes in their support-task commit; do not rewrite the separate NS-514, NS-601, or NS-602 task history.

## Repository Safety

- Preserve the pre-existing untracked `data/library/` directory; it is not A13 test data.
- The temporary `data/ns514-create-regression*` and `data/ns514-model-sync-regression` libraries were created only for verification and should not remain in the final worktree.
- Do not alter `docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html`; it remains the tracked binding reference.
