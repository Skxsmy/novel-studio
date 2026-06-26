# NS-410 Acceptance Record

Status: in progress  
Started: 2026-06-26

## Scope

This record verifies the Block Write Editor and Codex Field Progression task described in `docs/tasks/NS-410.md`.

Command/browser checks do not equal user visual acceptance. User visual acceptance remains separate because the current recovery UI is not accepted.

## Acceptance IDs

| ID | Status | Evidence |
| --- | --- | --- |
| NS-410-A01 | pending | Storage/migration test planned: current Markdown/YAML test data migrates or regenerates into JSON block documents; Markdown import preserves supported structure where kept. |
| NS-410-A02 | pending | Storage/server tests planned: save/reload revision behavior. |
| NS-410-A03 | pending | Storage/server tests planned: Markdown export. |
| NS-410-A04 | pending | Storage/server adversarial tests planned. |
| NS-410-A05 | pending | Storage/server tests planned: field progression CRUD and validation. |
| NS-410-A06 | pending | Storage/web tests planned: progression block deletion synchronization. |
| NS-410-A07 | pending | Projection tests planned: baseline only. |
| NS-410-A08 | pending | Projection tests planned: add/replace/empty replace folding. |
| NS-410-A09 | pending | Projection/API tests planned: same-scene block position. |
| NS-410-A10 | pending | Projection/API/context tests planned: future data isolation. |
| NS-410-A11 | pending | Projection tests planned: baseline edit and replace boundary. |
| NS-410-A12 | pending | Context route tests planned: projected Codex fields and AI switches. |
| NS-410-A13 | pending | Regression: existing progressions/knowledge tests must continue passing. |
| NS-410-A14 | pending | Web tests planned where feasible; user visual acceptance required for final UI. |
| NS-410-A15 | pending | Web tests planned where feasible; user visual acceptance required for final UI. |
| NS-410-A16 | pending | Storage/context/search/mention regression tests planned. |
| NS-410-A17 | pending | API/web regression planned: existing frontend-used scene responses still include projected `content`, and legacy `content` updates convert to JSON block authority without breaking current callers. |

## Slice Exit Map

Each slice must update this section with actual command output before the next slice starts.

| Slice | Exit requirement | Acceptance IDs |
| --- | --- | --- |
| Slice 0 Planning Lock | Documentation-only state; no contracts/storage/server/web implementation diff. | Precondition for all IDs |
| Slice 1 Contracts And JSON File Foundation | Contracts build and focused JSON helper tests pass; malformed JSON, duplicate block IDs, schema mismatch, revision and atomic-write failures are covered. | A02, A04, A17 partial |
| Slice 2 Scene JSON Authority Compatibility | Existing scene read/write APIs still work; JSON scene save/reload and Markdown projection pass storage/server/web regression tests. | A01, A02, A03, A04, A16, A17 |
| Slice 3 Scene Document API | New scene document get/update/export endpoints pass; stale `baseRevision` conflicts; old `content` APIs still pass. | A02, A03, A04, A17 |
| Slice 4 Field Progression CRUD | Field progression JSON CRUD, validation, cross-series rejection, and delete blocker shape pass. | A05, A06 partial, A13 regression |
| Slice 5 Projection Engine | Baseline/add/replace/empty replace/same-scene/future isolation/baseline edit projection tests and effective-entry API tests pass. | A07, A08, A09, A10, A11, A13 |
| Slice 6 Context Builder Projection | Context route tests prove projected Codex fields, detail AI switches, hidden empty fields, and future isolation. | A10, A12, A13, A16 |
| Slice 7 Write Ordinary Block MVP | Write loads/saves ordinary blocks; projection powers counts/search/mentions; no UI-only markup saved. | A14 partial, A16, A17 regression |
| Slice 8 Write Progression Blocks | Embedded progression block and panel create/edit/delete synchronize with field progression records. | A05, A06, A09, A14 |
| Slice 9 Codex Effective UI | Codex baseline/history/effective-at-scene UI is tested without future leakage or fake data. | A10, A13, A15 |
| Slice 10 Final Regression | Required commands pass; docs/status/handoff/changelog contain actual results; user visual acceptance remains separate. | A01-A17 |

## Required Commands

At minimum before declaring implementation complete:

```powershell
npm.cmd run build -w @novel-studio/contracts
npm.cmd run test -w @novel-studio/storage -- repository.test.ts
npm.cmd run test -w @novel-studio/server -- app.test.ts context-routes.test.ts
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx EditorSurface.test.tsx
npm.cmd run build
npm.cmd run test
git diff --check
```

If any full command is blocked by the sandbox, rerun with the required approval and record both the failed command and the passing rerun.

## Invariant Checklist

- Project JSON files are durable authority; Markdown/Word are boundary formats; SQLite is rebuildable.
- AI and Proposal paths do not directly mutate authoritative scene or Codex files.
- Field progression is distinct from old world fact progression and character knowledge.
- Same-scene block position determines visibility.
- Future progression content is not leaked.
- Empty replace hides the field from context.
- Every write remains revision-protected and uses atomic file replacement or transaction helpers.
- Current product/UI visual acceptance is not claimed by automated checks.
- JSON authority must be hidden behind compatibility adapters where possible; unrelated frontend/backend surfaces must not be rewritten solely for the storage format change.
