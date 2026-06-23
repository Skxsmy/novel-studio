# Changelog

## 0.1.0 - In Development

### 2026-06-23

- Reorganized project documentation so new contributors start from `README.md`, `STATUS.md`, `HANDOFF.md`, `TASKS.md`, `docs/README.md`, `docs/tasks/NS-409.md`, and `docs/testing/NS-409_ACCEPTANCE.md`.
- Removed obsolete non-backup NS-409 reset/control/browser-runbook drafts and stale v1 baseline screenshots/manifests from the active documentation tree.
- Preserved `docs/design/ui-redesign/backups/` as protected historical baseline storage.
- Recorded the current NS-409 truth: the React UI builds and has partial API-backed behavior, but user visual acceptance failed.
- Recorded that Codex is still a rough shell and needs real entry editing, detail tabs, relations, mentions, progressions, knowledge, and effective-state workflows.
- Recorded that Settings is now API-backed for model profile, service key, connection test, model list, and project cloud policy, but is not product-complete.
- Recorded that Write hierarchy UX still needs repair around `Volume -> Chapter -> Act -> Scene`, Add menu, default names, rename, selected delete confirmation, collapse, and scroll behavior.
- Added cleanup rules to `AGENTS.md`: do not create routine status files, do not delete backups without explicit user instruction, and do not claim visual acceptance from command/DOM checks.

### Current Working Draft

- Frontend source is organized as:
  - `apps/web/src/app`
  - `apps/web/src/api`
  - `apps/web/src/features`
  - `apps/web/src/ui`
- Server API remains in Fastify under `apps/server/src`, with route modules under `src/routes`.
- Shared schemas are split in `packages/contracts`.
- AI provider code lives in `packages/ai`.
- Storage still needs further extraction from `packages/storage/src/index.ts`.

### Earlier Milestones

- M0 through M3 established product governance, local web runtime, file authority, hierarchy, planning, writing editor, Codex storage, progressions, and character knowledge.
- NS-400 prepared M4 with architecture cleanup, smoke tests, browser acceptance infrastructure, and model/context/proposal contracts.
- NS-401 through NS-407 implemented AI contracts, storage, provider core, model settings, context preview, prompt roles, and non-writing AI calls.
- NS-408 partially implemented DeepSeek/OpenAI-compatible/OpenAI/OpenRouter/Ollama provider support. Anthropic/Gemini and real non-writing DeepSeek validation remain incomplete.
- Old NS-409A through NS-409F frontend branches and screenshots are obsolete.
