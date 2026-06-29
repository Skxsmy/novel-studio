# ADR-0012: JSON authority, scene block documents, and Codex field progression

Status: Accepted; NS-410 implementation active on the controlled slice plan

## Context

Earlier milestones kept project data in Markdown/YAML files. That was useful while the project was proving basic local-first behavior, but NS-410 changes the internal document model enough that preserving Markdown/YAML as the authority would force future agents to optimize for hand-editable test fixtures instead of durable product behavior.

The current development data is test data and has no product value. It may be migrated, regenerated, or discarded during NS-410 as long as the final application behavior is not broken.

ADR-0001, ADR-0004, ADR-0007, ADR-0010, and ADR-0011 remain useful historical records, but their Markdown/YAML persistence rules are superseded by this ADR wherever they conflict with JSON authority. Their rule that editor-private runtime state must not become the only saved copy still applies.

Codex already has `codex/progressions/` for world facts and relationship state summaries. Those records are not the same as field content changes to Canon description or reusable detail values. Reusing them would make summaries masquerade as Canon field text and blur product semantics.

## Decision

1. Project authority becomes structured JSON files in the project directory.
2. Markdown and Word are import/export, mirror, migration, and preview boundary formats. They are not internal authority.
3. SQLite, vector indexes, search caches, browser storage, and editor runtime JSON are rebuildable or runtime state and must not become the only project copy.
4. Scene manuscript authority becomes JSON `SceneBlockDocument`, stored in scene JSON files and exposed through scene document APIs.
5. Markdown export is a deterministic projection of blocks for readability, external workflows, and rollback.
6. Current Markdown/YAML fixtures may be migrated to JSON or regenerated. NS-410 does not need to preserve valueless test data through complex compatibility layers.
7. Existing HTTP/API contracts used by the current frontend remain compatible where feasible. Storage authority changes should sit behind repository methods and route adapters.
8. `SceneDocument.content` remains available as projected Markdown during the transition; legacy content writes may be accepted and converted to JSON block documents.
9. Codex entries, detail types, relationships, old world-fact progressions, character knowledge, prompts, sections, review anchors, AI call logs, and proposals move toward JSON authority files as part of the NS-410 storage boundary.
10. Codex field progression is stored separately under `codex/field-progressions/<progressionId>.json`.
11. Field progression supports only `add` and `replace` in v1. Empty `replace` is the deletion/hidden-field mechanism.
12. A field progression references `entryId` and either Canon description or a stable reusable detail type ID.
13. Embedded Write progression blocks reference field progression records by ID. Deleting the block deletes the linked field progression when no reference blocker exists.
14. Projection evaluates narrative scene order plus same-scene block order and returns projected entry fields plus field-state metadata and hidden future count.
15. Old world fact progression and character knowledge remain separate and continue to feed context as independent items.

## Consequences

- Implementation can use one structured authority model instead of preserving Markdown/YAML as a first-class storage constraint.
- Public API stability remains a product constraint; JSON authority does not require a full frontend/backend route rewrite.
- Write can host structured components without polluting exported manuscript text.
- AI context can see the Codex state that is valid at a scene/block position.
- Baseline Codex edits continue to matter for add chains unless a later replace has cut off that baseline.
- Project files become less hand-editable than Markdown/YAML, but they are schema-versioned, testable, and easier to migrate safely.
- Context Builder must stop sending baseline entry text directly and ask the field projection for effective fields.
- Any future rich-text or comment system must either use documented block extensions with projection or create another ADR.

## Migration

- No startup-wide silent migration is performed.
- NS-410 may provide explicit migration/import utilities for prior Markdown/YAML fixtures, or replace them with generated JSON fixtures.
- Reading legacy Markdown as an import path may derive a v1 block document from Markdown paragraphs, headings, quotes, scene breaks, blank lines, and Chinese text.
- Saving through the block document endpoint writes JSON authority and may refresh a Markdown mirror/export.
- Existing scene save endpoints may remain temporarily compatible by converting submitted Markdown to a block document before JSON persistence.
- Compatibility shims must have tests so current frontend-used calls do not break while block-aware surfaces are introduced.

## Rollback

- A rollback exporter can project block documents to Markdown and ignore embedded progression blocks or place them in comments/appendix text.
- JSON field progression files must be preserved when rolling back to a version that does not understand them.
- SQLite may be deleted and rebuilt; it is not the authority for block documents or field progression.
- If a rollback targets pre-NS-410 code, use exported Markdown/Word plus JSON backups rather than pretending old Markdown/YAML files are still the source of truth.

## Validation

- Storage tests cover JSON authority save/reload, Markdown import/migration where supported, Markdown export, damaged JSON diagnostics, duplicate block IDs, stale revisions, field progression reference validation, same-scene projection, future isolation, baseline/update folding, and empty replace.
- Migration tests must use fixtures that truly enter a legacy or damaged state; no no-op migration proves success.
- API tests cover new document/export/effective-entry/field-progression routes.
- API regression tests cover retained scene read/write compatibility for current frontend callers.
- Context tests cover projected Codex fields and hidden future exclusion.
- Web tests cover ordinary block editing and embedded progression synchronization where feasible; visual acceptance remains user-owned.
