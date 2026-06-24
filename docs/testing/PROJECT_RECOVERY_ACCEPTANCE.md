# Project Recovery Acceptance Record

Status: active, not accepted
Updated: 2026-06-24

## Conclusion

The project recovery phase is not accepted yet.

The current React app is command-verified but failed user visual/product acceptance. The active acceptance target is Recovery Release A, not completion of an `NS-409` task.

## Recovery Release A Acceptance

Release A is accepted only when the following slices pass.

### Slice A: Baseline Triage

Status: recorded on 2026-06-24 in `docs/tasks/PROJECT_RECOVERY.md`.

- Workspace-by-workspace status table exists for Library, App shell, Write, Overview, Plan, Codex, Settings, Review, Workshop, API/storage/contracts, i18n/copy, and validation.
- Each area is classified as repair now, keep minimal, unavailable for Release A, or audit while touching.
- Hard decisions exist for hierarchy, Codex minimum workflow, Settings minimum workflow, Review/Workshop scope, app-shell honesty, and visual-pass ordering.
- No implementation proceeds from vague "fix UI" direction.

### Slice B: Start-to-Write

Status: in progress, not accepted.

- Current evidence: `AppShell.test.tsx` covers empty-library project creation, opening the first scene, and adding a Chapter to the selected Volume.
- Current evidence: `AppShell.test.tsx` also covers deleting selected Chapter, deleting selected Act, deleting selected Scene, and creating a Scene inside the selected Act.
- Current evidence: `AppShell.test.tsx` covers entering and exiting Focus from Write, including automatic exit when switching away from Write.
- Current evidence: `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` passed with 17 tests.
- Current evidence: `npm.cmd run build -w @novel-studio/web` passed.
- Empty library can create a project through the UI.
- New project creates coherent first hierarchy and first editable scene.
- Hierarchy add, rename, delete with confirmation, collapse, scroll, and selection work.
- Scene write/save/reload/conflict behavior works.
- Focus exists only in Write and can be exited.
- Tests cover the flow.

### Slice C: Codex Core

- Codex API/contract/storage gap audit is recorded.
- A user can create, rename, edit, save, reload, archive, and restore a Codex entry through real APIs.
- Details/canon description and research are editable.
- Revision conflict behavior is visible and recoverable.
- Missing API capability is recorded as backend work, not mocked in the UI.

### Slice D: Codex Connections

- Write shows real scene mention/context data where scoped.
- Ambiguity is visible and not falsely resolved.
- Plan/tracking surfaces use stable Codex IDs and readable names where scoped.
- Codex context and M4 ContextBundle boundaries are consistent.
- `never` and future-information boundaries still hold.

### Slice E: Settings and AI Safety

- Supported model/profile/credential workflow uses real APIs.
- Secrets are not written to project files, logs, console, screenshots, or Git.
- Provider/cloud policy is explicit.
- No silent provider fallback exists.
- Unfinished providers are explicitly deferred or completed.

### Slice F: Review, Workshop, and Navigation Honesty

- Review and Workshop are real scoped workflows or honest unavailable states.
- Navigation does not imply incomplete pages are complete.
- No decorative placeholder dashboard is accepted.

### Slice G: Visual System and Responsive Acceptance

- Sidebar expanded/collapsed states are usable.
- Core layouts scale without broken density or empty wasteland regions.
- Text fits controls.
- Copy is centralized enough for future bilingual support.
- User accepts the visual/product direction.

### Slice H: Verification and Handoff

Required commands pass:

```powershell
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx
npm.cmd run build
npm.cmd run test
git diff --check
```

Final docs are updated:

- `STATUS.md`
- `HANDOFF.md`
- `TASKS.md`
- `CHANGELOG.md`
- `docs/tasks/PROJECT_RECOVERY.md`
- `docs/testing/PROJECT_RECOVERY_ACCEPTANCE.md`

Worktree is clean.

## Last Known Passing Commands Before This Reframe

- `AppShell.test.tsx`: 11 tests passed.
- `npm.cmd run build`: passed.
- `npm.cmd run test`: server 16, web 11, AI 18, storage 43 tests passed.
- `git diff --check`: passed with line-ending warnings only.

These results do not mean the product is accepted.
