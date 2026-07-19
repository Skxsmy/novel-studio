# Changelog

This changelog records user-visible product changes. Task status, command logs, internal refactors, and acceptance evidence belong in `STATUS.md`, task records, and acceptance records.

## Unreleased

### Added

- Library-wide Research workspace with multiple isolated Research Databases, real UTF-8 TXT/Markdown import, unchanged original preview, persisted per-database source selection, revision-safe properties, explicit AI context permission, optional links from one database to multiple Series, and honest format/lifecycle limits.
- Original-language Research sources now accept TXT, Markdown, DOCX, text PDF, EPUB, HTML, and one controlled web snapshot; exact originals and structured locations remain versioned authority, while each isolated database has its own rebuildable Chinese/Japanese/English keyword index and result-to-source navigation.
- Versioned per-Series SQLite index kernel with fixed application identity, migration checksum and health classification, serialized writes, and validated temporary-build replacement that preserves the live index on failure.
- Connected Codex workspace with real categories and Entries, Archived Entries, keyboard-reachable lifecycle menus, appended Detail editing, the original three-column Detail Type Library with persisted descriptions and row-context Rename/Delete, description-only Relation creation, Current Scene projection, real Write navigation, and separate Manuscript/Codex mentions with Canon previews.
- Relation authority v2 migration with exact v1 rollback artifacts and guarded permanent deletion.
- Connected reference Workshop workspace with real Chat, Agent, and Archived filtering; row-only session lifecycle menus; bottom-right message action menus; context selection; attachments; branch history; export; immediate expanded reasoning above replies; exact-model runtime options; and one truthful Send/Sending/Stop/Stopping control.
- Durable Workshop Agent runs now support ordinary conversation, structured Codex requests, bounded output repair, confirmed-tool continuation, separately confirmed follow-up tools, and explicit retry or abandon after eligible interruptions.
- Proposal-backed Review inbox and focused before/after decision workspace.
- Limited author-confirmed Agent tools for Codex entry creation and update, including unified Codex Progression changes.
- Shared embedding-profile and routing foundation for future Codex and Reference Library semantic features.
- Project Trash, restore, and exact-name-confirmed permanent deletion.
- JSON `SceneBlockDocument` authority with Markdown projection/export and unified JSON Codex Progression.

### Changed

- Legacy Series-owned Research sources now remain untouched until the author explicitly copies them into a linked Research Database; the copy preserves provenance and original bytes and never turns a Series into the database owner.
- Database recovery now rejects foreign or cross-Series indexes before mutation, rebuilds missing or drifted projections from JSON authority, preserves WAL/journal bundles and rollback recovery artifacts, validates full build integrity, and prevents readers from entering replacement gaps. Research imports serialize duplicate detection, damaged originals cannot receive property writes, literal short search no longer treats SQL wildcards as author input, and unsaved Research properties cannot be lost by switching sources or importing during a save.
- Research text import now processes author-scale files with bounded Blocks instead of one unbounded paragraph, returns a compact Source summary instead of the complete parsed document, pages the reader in forty-Block windows, and opens a search result on the page containing its exact original Block.
- Research search-result navigation now scrolls the exact matched term into view and highlights only that term, instead of leaving the reader at the beginning of a large matched Block or coloring the entire Block.
- Research page-read failures now preserve the Source and its editable properties; failed result navigation remains retryable and reports success only after the matching page opens. Existing results and highlights stay tied to the submitted query instead of changing when the author edits an unsubmitted search draft, and fallback from a deleted saved database now persists the valid replacement selection immediately.
- Project Library now creates real Series authority from an empty library, immediately opens the new Series, and lists other real Series for selection instead of reporting fixture-only success.
- Overview is now the initial workspace when no previous workspace can be restored. Its approved header, Continue Scene panel, project progress, recent Scene list, attention area, and Review queue now use the open Series and current Write Scene instead of reference fixtures; unavailable continuity analysis and missing targets remain visibly honest and disabled.
- Workshop now loads each conversation independently: a routeable legacy or schema-invalid message owned by another conversation no longer disables Context, model selection, attachments, or message editing in the current conversation. The damaged conversation still reports its own validation error, and no authority file is silently rewritten.
- Workshop now carries an author's natural corrections, rejections, accepted choices, and source limits across the full conversation instead of requiring repeated prompt instructions. Author messages and parsed attachments remain authoritative after the recent transcript window rolls forward, while Assistant suggestions remain non-canon; an author can explicitly relax a source limit in ordinary language.
- Workshop Agent now repairs the observed unescaped-quotation failure in native tool arguments before schema validation, prevents identical successful tools from being proposed again, and appends only new Research text. The startup stop command also bypasses the long-lived build mutex so a failed or attached startup can be stopped reliably.
- Settings now exposes the real library-global Model connections editor and credential lifecycle in the reference interface, including safe credential status, save or replacement, deletion, model discovery, connection testing, and confirmed archive without echoing stored secrets. Multiple connections remain distinct in a compact connection browser, new and edit actions are unambiguous, and saved changes appear immediately in Workshop's model chooser without reloading the page.
- Workshop remains usable before a model is configured: authors can manage sessions, draft multiline messages, attach files, and select context, while only model-dependent send and resend actions are disabled with a direct route to Model connections.
- Codex Relation creation no longer exposes or writes a `type`; permanent Relation deletion is blocked by live Progression, Character Knowledge, and Proposal references.
- Detail Type Rename preserves the stable identifier and atomically converts legacy name-keyed Entry Detail data; conflicting legacy and stable values reject the rename without partial writes.
- Workshop Codex detail drafts now rank reusable same-category detail types, let authors map each unmatched label, and require an explicit final name and NSFW choice before creating a new reusable type.
- Workshop conversation, context, model, and message-action menus now remain visibly interactive in their real browser states; the compact layout restores a complete conversation drawer and prevents horizontal clipping. Reasoning-only Model Profile updates preserve all other capabilities, context limits, and default parameters.
- Workshop Agent uses ordinary Provider assistant text for conversation and Provider-native tool calls for Codex requests. Models without native tools remain available for conversation but receive no write tools; there is no strict-JSON dialogue fallback or silent Provider fallback.
- Retryable Agent transport failures receive one bounded same-run retry, while invalid native tool arguments receive one model-visible correction attempt before the run becomes explicitly retryable.
- Workshop Codex update migrates legacy name-keyed Details through the reusable detail planner, and atomically failed tool calls now return to the same Agent run instead of stopping the conversation.
- Workshop Chat and Agent prompts are isolated from global non-Workshop role/template records.
- Each Workshop General Chat session now owns its system-prompt snapshot; switching sessions restores the corresponding prompt, branches inherit it, and Agent sessions remain separate from General Chat prompt state.
- Workshop uses explicit context selection, prior same-session history, and message attachment snapshots rather than an implicit current scene.
- Review prioritizes the candidate difference and author decision instead of an engineering Proposal dashboard.
- Model settings and credentials are library-global and do not expose a cloud/local policy switch.
- Write uses a continuous manuscript editor with inline Codex Progression components.

### Safety And Integrity

- AI-produced semantic changes remain candidate or explicitly confirmed actions.
- Project authority uses schema-versioned JSON and conflict-safe atomic storage; indexes remain rebuildable.
- Workshop tool execution rejects repeated or archived-session execution on the current limited path.
- Confirmed Agent Codex create/update commands now apply detail types, entry/research changes, Progressions, and result history atomically, and refuse stale or cross-target requests.
- User visual acceptance remains separate from command and functional verification.
