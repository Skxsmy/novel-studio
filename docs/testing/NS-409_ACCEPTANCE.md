# NS-409 Acceptance Record

Status: not accepted
Updated: 2026-06-23

## Conclusion

NS-409 is not passed. The current React frontend is command-verified but visually rejected by the user. This file records the working state so later contributors do not mistake it for an accepted baseline.

## Implemented Working Draft

- React frontend reorganized into:
  - `apps/web/src/app`
  - `apps/web/src/api`
  - `apps/web/src/features`
  - `apps/web/src/ui`
- Old monolithic frontend files were removed.
- Library/project creation and no-project handling exist in the new shell.
- Write has real series/scene save flow and partial hierarchy controls.
- Codex has minimal API-backed load/create/select/collapse behavior.
- Settings has API-backed model profile, service key, connection test, model list, and project cloud policy behavior.
- Contracts were split with `codex.ts` and `defaults.ts`.
- Storage has a Windows `better-sqlite3` typing fix.

## Failed / Incomplete Areas

- User visual acceptance: failed.
- Codex: rough shell only, not product-complete.
- Review: page utilization and workflow incomplete.
- Workshop: incomplete.
- Settings: API-backed but not full product workflow.
- Write hierarchy: still needs final UX repair around add menu, delete, confirmation, rename, collapse, scroll, and `Volume -> Chapter -> Act -> Scene` ordering.
- Browser screenshot validation is not claimed for this current UI. User handles visual validation.

## Last Known Passing Commands

```powershell
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx
npm.cmd run build -w @novel-studio/web
npm.cmd run build
npm.cmd run test
git diff --check
```

Latest results:

- `AppShell.test.tsx`: 11 tests passed.
- `npm.cmd run build`: passed.
- `npm.cmd run test`: server 16, web 11, AI 18, storage 43 tests passed.
- `git diff --check`: passed with line-ending warnings only.

## Acceptance Gate

Do not mark NS-409 complete until:

- user accepts the visual design;
- Codex supports real entry detail editing and tabbed/detail sections;
- Write hierarchy add/delete/rename/collapse/scroll behavior is usable;
- Settings has complete product behavior for the scoped model/profile/policy workflows;
- Review and Workshop stop being placeholder shells or are explicitly marked unavailable;
- command validation passes again after the final changes.

## Protected Evidence

- `docs/design/ui-redesign/backups/` contains protected historical UI baseline backups and must not be deleted without explicit user permission.
- Current design references and retained screenshots are described in `docs/design/ui-redesign/README.md`.
