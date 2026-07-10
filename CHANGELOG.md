# Changelog

This changelog records user-visible product changes. Task status, command logs, internal refactors, and acceptance evidence belong in `STATUS.md`, task records, and acceptance records.

## Unreleased

### Added

- Persistent Workshop Chat and Agent sessions with message attachments, branch history, session export, reasoning display, stop controls, and session lifecycle actions.
- Proposal-backed Review inbox and focused before/after decision workspace.
- Limited author-confirmed Agent tools for Codex entry creation and update, including unified Codex Progression changes.
- Shared embedding-profile and routing foundation for future Codex and Reference Library semantic features.
- Project Trash, restore, and exact-name-confirmed permanent deletion.
- JSON `SceneBlockDocument` authority with Markdown projection/export and unified JSON Codex Progression.

### Changed

- Workshop Chat and Agent prompts are isolated from global non-Workshop role/template records.
- Workshop uses explicit context selection, prior same-session history, and message attachment snapshots rather than an implicit current scene.
- Review prioritizes the candidate difference and author decision instead of an engineering Proposal dashboard.
- Model settings and credentials are library-global and do not expose a cloud/local policy switch.
- Write uses a continuous manuscript editor with inline Codex Progression components.

### Safety And Integrity

- AI-produced semantic changes remain candidate or explicitly confirmed actions.
- Project authority uses schema-versioned JSON and conflict-safe atomic storage; indexes remain rebuildable.
- Workshop tool execution rejects repeated or archived-session execution on the current limited path.
- User visual acceptance remains separate from command and functional verification.
