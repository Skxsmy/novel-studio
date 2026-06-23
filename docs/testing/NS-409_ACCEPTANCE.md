# NS-409 Acceptance Record

Status: replanned, not accepted
Updated: 2026-06-23

## Conclusion

`NS-409` is not passed. The current React frontend is command-verified but visually and product-wise rejected by the user.

The task has been replanned. Acceptance now covers frontend recovery, Codex product recovery, API/contract audit, Write hierarchy recovery, Settings completion, and honest Review/Workshop treatment.

## Current Working Draft

- React frontend reorganized into:
  - `apps/web/src/app`
  - `apps/web/src/api`
  - `apps/web/src/features`
  - `apps/web/src/ui`
- Library/project creation and no-project handling exist, but zero-project UX previously failed and must be retested.
- Write has real series/scene save flow and partial hierarchy controls.
- Codex has minimal API-backed load/create/select/collapse behavior.
- Settings has API-backed model profile, service key, connection test, model list, and project cloud policy behavior.
- Contracts were split with `codex.ts` and `defaults.ts`.
- Storage has a Windows `better-sqlite3` typing fix.

## Replan Acceptance Gates

### NS-409.0 Rebaseline

- Authority docs describe the new plan.
- No new routine status files are created.
- Protected backups remain under `docs/design/**/backups/`.

### NS-409.1 Foundation Audit

- Hierarchy contract is explicitly classified as UI terminology, API projection, or storage/migration change.
- Codex route/contract/storage/frontend-wrapper gap list is recorded.
- Required changes to M2/M3 foundations are named before UI-only workarounds are built.

### NS-409.2 Project and Library

- A user can start from no projects and create/open a project through the UI.
- Primary creation actions are not disabled dead ends.
- Tests cover empty-library creation.

### NS-409.3 Write Hierarchy

- `Volume -> Chapter -> Act -> Scene` decision is reflected consistently.
- Add is a compact contextual menu.
- Delete sits beside Add and confirms deletion of the selected hierarchy item.
- Default naming, later rename, double-click rename where appropriate, collapse, scroll, and scene selection work.

### NS-409.4 Codex API Wrapper

- Frontend API wrapper covers the Codex routes used by the product UI.
- Missing route/contract needs are documented instead of hidden in component state.
- Tests cover critical Codex API wrapper behavior.

### NS-409.5 Codex Workspace

- Create, rename, edit details, edit research, save, reload, and conflict recovery work.
- Detail tabs use real data for details, research, relations, mentions, tracking/context policy, progressions, knowledge, and effective state where scoped.
- Selecting the same entry hides details.
- Archive/restore is available; hard delete is not introduced without product decision.

### NS-409.6 Codex Integration

- Write shows real scene Codex mentions/context data.
- Plan/tracking views use stable Codex IDs and readable names.
- Codex context preview and M4 ContextBundle preview are consistent.
- `never` and future-information boundaries still hold.

### NS-409.7 Settings

- Model profile/service-key/cloud-policy workflow is real enough for scoped use.
- Credentials are not written to project files, logs, console, or Git.
- No silent provider fallback exists.

### NS-409.8 Review and Workshop

- Review and Workshop either implement scoped real workflows or show honest unavailable states.
- They do not remain decorative placeholder dashboards.

### NS-409.9 Final Recovery

- Command validation passes.
- User accepts the visual/product result.

## Last Known Passing Commands Before Replan

```powershell
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx
npm.cmd run build -w @novel-studio/web
npm.cmd run build
npm.cmd run test
git diff --check
```

Latest known results before this replan:

- `AppShell.test.tsx`: 11 tests passed.
- `npm.cmd run build`: passed.
- `npm.cmd run test`: server 16, web 11, AI 18, storage 43 tests passed.
- `git diff --check`: passed with line-ending warnings only.

## Protected Evidence

- `docs/design/ui-redesign/backups/` contains protected historical UI baseline backups and must not be deleted without explicit user permission.
- Current design references and retained screenshots are described in `docs/design/ui-redesign/README.md`.

## Not Accepted Yet

Do not mark `NS-409` complete until every relevant gate above passes and the user accepts the resulting UI.
