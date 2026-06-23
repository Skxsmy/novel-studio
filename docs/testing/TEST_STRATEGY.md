# Test Strategy

## Current Rule

Tests prove behavior. They do not prove visual acceptance. For NS-409, user visual review is the acceptance authority.

## Layers

- Unit tests: schemas, helpers, view models, storage behavior, provider behavior.
- Integration tests: server routes, repository operations, API persistence, conflict paths.
- Browser/E2E tests: real user flows that are stable enough to automate.
- Manual visual review: required for UI/layout acceptance.

## Current NS-409 Commands

```powershell
npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx
npm.cmd run build
git diff --check
```

## Acceptance Records

- Current frontend acceptance record: `NS-409_ACCEPTANCE.md`
- General browser process history: `BROWSER_ACCEPTANCE.md`
- Older `NS-*.md` acceptance files are historical evidence, not current UI acceptance.

## Cleanup Rule

Do not add temporary browser notes for each failed exploration. Put durable outcomes in the active acceptance file only.
