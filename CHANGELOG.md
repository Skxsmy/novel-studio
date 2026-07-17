# Changelog

This changelog records user-visible product changes. Task status, command logs, internal refactors, and acceptance evidence belong in `STATUS.md`, task records, and acceptance records.

## Unreleased

### Added

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

- Codex Relation creation no longer exposes or writes a `type`; permanent Relation deletion is blocked by live Progression, Character Knowledge, and Proposal references.
- Detail Type Rename preserves the stable identifier and atomically converts legacy name-keyed Entry Detail data; conflicting legacy and stable values reject the rename without partial writes.
- Workshop Codex detail drafts now rank reusable same-category detail types, let authors map each unmatched label, and require an explicit final name and NSFW choice before creating a new reusable type.
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
