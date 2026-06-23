# Handoff

Updated: 2026-06-23

This file is the short operational handoff. The older Chinese handoff was fully read before this rewrite; its task history, verification facts, and warnings have been translated and reorganized here.

## Current Repository State

- Branch: `main`.
- Latest relevant commit before this documentation repair: `cca70e8 NS-409 docs(frontend): record current working state`.
- Current active task: `NS-409` frontend rebuild.
- Current acceptance state: not accepted. Command validation passed, but user visual/product validation failed.
- Expected current modified files for this handoff repair only:
  - `STATUS.md`
  - `HANDOFF.md`
  - `CHANGELOG.md`
  - `TASKS.md`

## Start Here

Read these files in order:

1. `README.md`
2. `STATUS.md`
3. `TASKS.md`
4. `docs/README.md`
5. `docs/tasks/NS-409.md`
6. `docs/testing/NS-409_ACCEPTANCE.md`
7. `docs/design/ui-redesign/README.md`

Do not begin from old `NS-409A` through `NS-409F` screenshots as if they are current guidance. Current truth is the task and acceptance record above.

## Do Not Break These Rules

- Do not mark `NS-409` complete until the user accepts the visual/product result.
- Do not add new routine status or handoff files. Update the existing authority files.
- Do not delete `docs/design/**/backups/` unless the user explicitly names the backup to delete.
- Do not let `apps/web/src/app/app-shell.css`, `apps/server/src/app.ts`, or `packages/storage/src/index.ts` become larger dumping grounds.
- Do not hardcode user-facing UI text inside feature logic; later bilingual support is required.
- Do not claim browser screenshots or DOM checks as user visual acceptance.
- Do not expose developer/audit details in author-facing writing paths unless the product spec calls for them.

## Current NS-409 Work

The current React frontend has a reorganized shell and partial API wiring, but it is not a usable accepted UI.

Working draft pieces:

- Library/project creation and no-project handling exist.
- Write has real project/scene API wiring and partial hierarchy controls.
- Plan has surfaces, but the current frontend line still needs product-level validation.
- Codex can minimally load/create/select entries and collapse detail by selecting the same entry.
- Settings has API-backed model profile, service key, connection test, model list, and project cloud policy behavior.
- Workshop and Review are incomplete.

Critical blockers:

- Visual design is rejected.
- Codex is a shell, not a real product workflow.
- Write hierarchy must follow `Volume -> Chapter -> Act -> Scene` and support compact add menu, default names, later rename, double-click rename where appropriate, selected delete with confirmation, sane collapse, and scroll.
- Settings is only partially product-complete.
- Review and Workshop need either real scoped workflows or honest unavailable states.

## Historical Handoff Record

### NS-301

- Added explicit Act/Chapter lists, ordering, scene moves, stable references, hierarchy validation API, recoverable multi-file transactions, and real migration for M2 projects missing lists.
- WriteView loaded hierarchy immediately after create and displayed Act -> Chapter.
- Added adversarial tests for missing references, duplicate/omitted entries, same-chapter moves, cross-act moves, migration, and interrupted transaction recovery.

### NS-302

- Connected grid/board, outline, matrix/tracking, and dual timelines to the shared PlanningBoard.
- Added explicit TimelineEvent files, unplaced scenes, POV and other matrix filters, same/cross-chapter structure commands, and manual planning-branch decisions.
- Old projects without timeline files remained read-compatible.

### NS-303

- Added `@milkdown/kit` / React 7.21.2 Markdown scene editing over YAML frontmatter + Markdown authority.
- Implemented title/body editing, counts, autosave, 409 conflict handling, real disk reload, and revision-aware localStorage draft recovery.
- Added independent `sections/<scene-id>/<section-id>.md` section files, three AI permission levels, archive/restore, and review anchors under `review/anchors/<anchor-id>.yaml`.
- Anchor relocation covers original position, unique quote, context disambiguation, and explicit orphaning.
- ADR-0007, execution specs A01-A12, and acceptance records were completed.

### NS-304

- Added six built-in Codex categories and immutable built-ins plus custom categories in `codex/categories/<category-id>.yaml`.
- Physically separated canon entries, research notes in `codex/entry-research/<entry-id>.md`, and relations in `codex/relations/<relation-id>.yaml`.
- Added names, aliases, tags, custom fields, thumbnail references, recognition rules, and readable-scope policy.
- Added rebuildable SQLite indexes for Codex, FTS5, mentions, and ambiguity.
- Mention rules include aliases, excluded words, case, English plurals, longest-match priority, and same-scope ambiguity.
- Scene save rebuilds only current-scene mentions; Codex entry changes rebuild derived indexes without changing scene prose or explicit links.
- Added directed/undirected relations that retain original source/target/relation ID and archive instead of destructive delete.
- Added Fastify `/api/v1` routes for categories, entries, research notes, relations, mentions, readable-scope preview, and search.
- Added a three-column Codex UI and planning tracking tables that show entry names instead of internal UUIDs.
- ADR-0008, execution specs A01-A12, and acceptance records were completed.

### UI Copy Normalization Before English Rebuild

- The old Chinese UI was corrected to use author-facing Chinese terms instead of exposing Codex, Canon, Research, Section, POV, tokens, AI, or rough literal translations.
- Model scope terms moved toward "model-readable scope", "data scope", and "manual selection" equivalents instead of awkward pinning language.
- Writing side drawers used attachment/document language rather than developer section labels.

### NS-305

- Added `codex/progressions/<id>.yaml` for story progressions.
- Added `codex/knowledge/<id>.yaml` for character knowledge, including knowing, believing, and misunderstanding.
- Effective-state queries work by narrative scene and do not leak future content into earlier scenes.
- Future records expose counts only, not summaries, evidence, or internal IDs.
- Evidence can reference prose scenes, Codex entries, and relations; prose quotes must exist in scene text.
- Added `/api/v1` routes for progressions, character knowledge, and effective state.
- Codex detail pages gained progressions, character knowledge, and effective-state areas in the old UI.
- ADR-0009, data model docs, API docs, and `docs/testing/NS-305_ACCEPTANCE.md` were completed.

### Launcher Fixes

- `scripts/start.ps1` added `Local\NovelStudioStartLock`.
- Existing healthy service is reused.
- If a port is occupied but health fails, the script errors instead of launching a redundant background service.
- Later patches added identity checks, `-Wait`, `-SmokeTest`, `-Foreground`, `-Stop`, direct Node artifact launch, old process cleanup, and `%TEMP%\novel-studio` fallback for locked server state files.

### NS-306

- Nonempty library showed new-series form.
- New series opened immediately while preserving old series list.
- Added `POST /api/v1/series/:seriesId/books`; creating a new book also created first act and first chapter.
- Writing drawer displayed book/act/chapter/scene hierarchy and offered new scene/book/act/chapter entry points.
- Empty acts showed an add-first-chapter path.
- Automatic titles used Chinese ordinal naming in the old UI.
- Full check and browser acceptance passed.

### NS-400 and NS-307

- Added `docs/tasks/M4_PREP.md` and `docs/testing/NS-400_ACCEPTANCE.md`.
- Updated architecture docs beyond M0-M2.
- Moved Codex API routes from `apps/server/src/app.ts` into `apps/server/src/routes/codex.ts`; `app.ts` shrank from about 718 lines to about 363 lines.
- Split storage errors, file-system safety, atomic writes, and file transactions into separate modules.
- Split `CodexView.tsx` into top-level list view, `CodexEntryEditor.tsx`, and `CodexEntryPanels.tsx`.
- Added `packages/storage/test/smoke.test.ts` and `npm.cmd run test:smoke`.
- Added minimum M4 contracts for `ContextBundle`, `ContextItem`, `PromptTemplate`, `ModelCallLog`, `Proposal`, and `ProposalPatch`.
- `NS-307` cleaned the writing-page structure column and allowed `CreateSceneInput` to target `bookId`, `actId`, and `chapterId`.
- Typechecks, unit tests, storage tests, web tests, and full `npm.cmd run check` passed.

### Browser Acceptance Harness

- Added `@playwright/test`, `playwright.config.ts`, `tests/e2e/`, and `docs/testing/BROWSER_ACCEPTANCE.md`.
- Playwright global setup starts Fastify and uses an isolated `%TEMP%\novel-studio-browser-acceptance\library`.
- Coverage included implemented M3 paths and minimum M4 model settings, context preview, and prompt preview paths.
- Incomplete AI calls, full context logs, and proposal/candidate acceptance were recorded as pending instead of faked with skipped tests.

### NS-401 to NS-403

- `NS-401`: M4 execution spec, API draft, data-format draft, MockProvider vertical-slice plan, browser acceptance mapping. No real provider or key access.
- `NS-402`: split contracts into `common.ts`, `ai.ts`, `context.ts`, `prompts.ts`, and `proposals.ts`; added `packages/storage/src/aiFiles.ts`; exposed model profile, role, prompt, preset, context bundle, and call-log storage; added rebuildable `ai_context_bundles` and `ai_model_calls` indexes.
- `NS-403`: added `packages/ai`, `ProviderAdapter`, `ProviderRegistry`, default registry, `MockProvider`, model capabilities, streaming, structured output, embeddings, token estimates, simulated provider failures, `ProviderAdapterError`, and `classifyProviderError`.

### NS-404 and NS-405

- `NS-404`: added model config API, project cloud policy API, provider connection test routes, server policy helpers, credential storage abstraction, Windows Credential Manager implementation, credential-reference validation, and Settings model/data permission page.
- The old global cloud/local switch was later removed from the main path after `NS-408`; explicit provider selection, data-level filtering, and no silent fallback remained.
- `NS-405`: added context preview creation and lookup APIs. Context includes role, prompt template, user request, current scene, selected prose, previous scene summary, readable Codex entries, effective facts, relation changes, and character knowledge.
- `never`, hidden sections, local-only unselected data, unselected manual data, and future information are excluded with recorded reasons.

### NS-406

- Added built-in roles: chief writing partner, structure editor, character editor, continuity editor, style editor, harsh reader, and researcher.
- Roles/templates/presets are stored under `prompts/roles`, `prompts/templates`, and `prompts/presets`.
- Built-ins are read-only; copies can be edited.
- Declarative renderer only allows `{{variableName}}`.
- Missing required input returns `PROMPT_INPUT_MISSING`; expressions or unclosed placeholders return `PROMPT_TEMPLATE_INVALID`.
- Template updates create new versions instead of overwriting older versions.
- Context preview includes prompt-template items with template ID, version, and rendered result.
- Settings gained roles/prompts UI for role viewing, copying, prompt preview, and saving template versions.
- A concurrent built-in seeding race was found and fixed with per-project seeding lock and tests.

### NS-407

- Added `apps/server/src/routes/modelCalls.ts`.
- Registered `/api/v1/series/:seriesId/ai/calls`, call list, call details, and call context snapshot APIs.
- `POST /ai/calls` uses SSE events: `metadata`, `delta`, `usage`, `done`; failures emit `error` and save failed logs.
- Call logs record model, role, PromptTemplate ID/version, ContextBundle ID, request/response hashes, status, error classification, and usage; they do not store keys or auth headers.
- MockProvider analysis returns non-writing review output; rewrite-like tasks return candidate prose only.
- Writing page gained a minimal AI Review panel.
- Rewrite candidate enters the editor selected; the author must keep or discard it.
- Main writing UI does not show call source, base version, usage, or call ID.
- UI principles and screenshot rules were added to product, UX, AGENTS, and browser acceptance docs.

### NS-408

- Added `packages/ai/src/openAiCompatibleProvider.ts`.
- Default registry registers `mock`, `deepseek`, and `openai-compatible`.
- DeepSeek and generic OpenAI-compatible share OpenAI-format transport, but provider semantics are separate.
- Generic compatible services do not inherit DeepSeek default address, model, or provider-specific errors.
- DeepSeek supports connection test, model list, streaming text, basic structured output, token estimate, and unified error classification.
- Settings can create DeepSeek config with default base URL `https://api.deepseek.com` and default model `deepseek-v4-flash`.
- Added service-key save/status/delete endpoints. Plain keys go only into `CredentialStore`; model config stores only credential references.
- Server injects one `CredentialStore` and one `ProviderRegistry` into AI, context, and model-call routes.
- Browser screenshots use unique run IDs, unique file names, and `*-screenshot-manifest.json`.
- Settings UI removed developer fallback explanations from the main interface and folded credential refs/capability parameters into advanced info.
- User confirmed real DeepSeek connection and model list. Codex did not read or print the real secret.
- Not completed: OpenAI, OpenRouter, Anthropic, Gemini, Ollama providers; real DeepSeek non-writing result was not recorded in the older handoff.

### NS-409 UI Correction History

- User rejected earlier UI because it diverged from target images and implementation kept fighting multiple style layers.
- `NS-409C` removed the untracked `apps/web/src/ui-foundation.css` second override layer and removed its `main.tsx` import.
- `NS-409B-plan-target-v2.png` and `NS-409B-write-target-v2.png` were marked not adopted.
- New target/review images were registered for plan and write.
- Planning moved toward a three-column workbench.
- Writing E2E screenshots used real Chinese prose rather than an empty editor.
- Writing title/body fonts moved toward Chinese manuscript style.
- Remaining issues after `NS-409C`: writing structure add buttons stayed too form-like; planning bottom new-scene workbench entry was not implemented; other pages did not receive equal review depth.
- `NS-409D` responded to wide-screen screenshots showing abnormal writing-page gaps and wasted space in Codex/Workshop.
- Wide-screen targets and review images were saved. Writing stopped drifting; Codex detail/progressions and Workshop moved toward controlled layouts; 1920-wide E2E screenshots were added.
- `NS-409E` handled planning wide-screen transition for board, outline, matrix, and timeline with current/target/implemented screenshots. It was explicitly not overall UI acceptance.
- Later React rebuild work was committed in `cca70e8`; current docs record that the new UI is still rejected and Codex remains rough.

## Verification Summary

- Repeated `npm.cmd run check` runs passed through M3/M4.
- `npm.cmd run test:smoke` passed 3 tests after NS-400.
- Playwright E2E passed for M3 main paths, M4 settings/context/prompt preview paths, AI review/rewrite path, DeepSeek settings path, and multiple NS-409 visual screenshot runs.
- M4 task tests progressed from server 7/7, web 14/14, storage 39/39 to server 15/15, web 14/14, AI 15/15, storage 41/41 before the later frontend rewrite.
- Current post-rewrite validation recorded in `docs/testing/NS-409_ACCEPTANCE.md`:
  - `AppShell.test.tsx`: 11 passed.
  - `npm.cmd run build`: passed.
  - `npm.cmd run test`: server 16, web 11, AI 18, storage 43 passed.
  - `git diff --check`: passed with line-ending warnings only.

## Known Risks

- UI is not accepted.
- Codex is not product-complete.
- Settings is API-backed but incomplete.
- Review and Workshop are not complete.
- Storage `src/index.ts` remains too large and should be split when touched.
- Browser visual validation is currently user-owned.
- Local sample data may contain old manual browser validation artifacts; new tests use isolated libraries.
- Windows sandbox may reject fixed server state file writes; startup scripts have temp fallback.

## Immediate Next Step

Stay on `NS-409`. Repair the real frontend product flows, especially Write hierarchy and Codex, then update the same authority docs and rerun validation. Do not start a new milestone and do not create parallel handoff files.
