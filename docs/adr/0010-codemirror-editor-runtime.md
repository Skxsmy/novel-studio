# ADR-0010: CodeMirror editor runtime

Status: Superseded by ADR-0012 for the Write scene runtime

ADR-0012 and the NS-410 Write implementation replace the scene-runtime and persistence assumptions with a block document plus Tiptap/ProseMirror boundary. CodeMirror remains an implementation choice for current pure-text Codex surfaces, while the editor-private-state boundary is restated in current architecture.

## Context

Release A still treats scene manuscript and Codex Canon descriptions as pure text persisted through the existing Markdown/YAML contract. The previous React-rendered `contentEditable` path mixed browser editing, IME composition, and realtime Codex mark rerenders in the same DOM. That caused duplicate punctuation/text, unstable Chinese input, and inconsistent duplicate Codex underlines.

ADR-0004 and ADR-0007 were authoritative for Markdown/YAML persistence at the time of this ADR and remain relevant for keeping editor-private state out of saved work. ADR-0012 later supersedes the persistence format with JSON authority. Their Milkdown runtime choice is superseded for the current Write scene and Codex Canon editor surfaces.

## Decision

Use CodeMirror 6 as the current web editor runtime for pure-text scene content and Codex Canon descriptions.

- Persist only plain text through the existing scene and Codex APIs.
- Implement Codex names/aliases as CodeMirror decorations, never as saved markup or React-rendered editable nodes.
- Keep Canon previews as editor-anchored UI outside the document.
- Use CodeMirror transactions/commands for text edits, selection, undo/redo, paste filtering, and read-only state.
- Remove unused Milkdown runtime dependencies from the web package.

## Consequences

- The editor can support Chinese IME and ordinary text input without React replacing editable text nodes.
- Duplicate Codex names/aliases can each receive independent decoration ranges over one underlying text occurrence.
- Future rich-text features must either preserve the pure-text contract or introduce a separate ADR, migration, and rollback plan.
- Browser screenshot verification is not a default completion requirement for this editor runtime decision; browser checks or screenshots are run only when explicitly requested by the task or user.

## Dependencies

- `@codemirror/state` 6.6.0, MIT: immutable editor state, transactions, selections, effects, fields, compartments.
- `@codemirror/view` 6.43.1, MIT: editor view, decorations, tooltips, clipboard hooks, DOM integration.
- `@codemirror/commands` 6.10.3, MIT: history, undo/redo, keymaps.
- `@codemirror/lang-markdown` 6.5.0, MIT: Markdown-aware editing behavior while preserving plain-text persistence.
