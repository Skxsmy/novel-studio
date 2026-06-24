# Changelog

## 0.1.0 - In Development

This changelog retains the historical milestone record from the earlier Chinese log, translated and reorganized in English.

### Project Foundation

- Established product boundaries, architecture, milestone tracking, task governance, and multi-agent handoff rules.
- Built the first local web vertical slice: series creation, Markdown scene editing, autosave, refresh recovery, SHA-256 conflict protection, SQLite/FTS5 rebuild, and Chinese search.
- Added Overview, Plan, Write, Codex, Workshop, and Review workspaces in the original Chinese UI.
- Added Windows double-click startup flow and kept dependency audit at 0 known vulnerabilities at the time.
- Expanded product documentation to cover feature scope, final UX, AI editorial team, context/proposal rules, reference library, Word round trip, version backups, and milestone acceptance.

### M3 Structure, Planning, Writing, and Codex

- **NS-301**: Added explicit Act/Chapter lists, full ordering, scene moves with server-derived parent chain, hierarchy validation API, recoverable multi-file transactions, and real migration for M2 projects missing hierarchy lists. WriteView loaded hierarchy after creation; tests covered missing references, duplicate/omitted entries, same-chapter moves, cross-act moves, migration, and interrupted transaction recovery.
- **NS-302**: Connected shared PlanningBoard to grid/board, outline, matrix/tracking, and dual timelines. Added TimelineEvent files, unplaced scenes, POV and other filters, structure commands, and manual planning divergence decisions.
- **NS-303**: Added Milkdown Markdown editing, focus writing, revision-aware crash drafts, independent Sections with AI permissions, Section archive/restore, review anchors, and read-only anchor relocation. External modification conflicts can safely reload real disk versions.
- **NS-304**: Added built-in/custom Codex categories, separate canon/research documents, aliases, mention rules, directed/undirected relations, readable-scope policy, rebuildable Codex/FTS5/mention/ambiguity indexes, and a three-column Codex UI. Planning tracking displays entry names; prose mentions do not silently rewrite explicit scene links.
- **NS-304 UI Copy Correction**: Normalized the original Chinese author-facing UI terms. The main UI stopped exposing Codex, Canon, Research, Section, POV, tokens, AI, and similar developer labels. Manual model selection wording was corrected.
- **NS-305**: Added story progressions, character knowledge, and effective-state queries. World facts, relationship changes, knowing, believing, and misunderstanding are stored separately and take effect by narrative scene without leaking future content. Codex detail pages were connected to progressions, knowledge, and effective state.
- **NS-306**: Exposed existing hierarchy features in the UI. Nonempty libraries can create new series; the writing drawer can create books, acts, and chapters; a new book creates first act and first chapter.
- **NS-307**: Cleaned the writing-page book/act/chapter/scene structure column and allowed new scenes to target a specific book, act, and chapter instead of falling back to the first book.

### Startup, Architecture, and M3 to M4 Preparation

- **Launcher Duplicate-Start Protection**: Added startup mutex and healthy-service reuse. If an occupied port fails health, the launcher errors instead of starting another background service.
- **NS-400 Startup and Acceptance Reliability**: Health now returns version, commit, startedAt, workspaceRoot, and libraryRoot. Windows launcher verifies checkout identity, cleans known old processes, supports `-Wait`, and falls back to `%TEMP%\novel-studio` when fixed logs/PID files are locked.
- **NS-400**: Completed M3 -> M4 preparation. Split server Codex routes, storage transaction/file modules, frontend Codex views, repeatable smoke tests, and Playwright browser acceptance. M4 minimum contracts were added.
- **Browser Acceptance Harness**: Added Playwright-based browser acceptance with isolated temp libraries. UI paths save screenshot evidence where visual review matters.

### M4 AI Foundation

- **NS-401**: Wrote M4 execution spec, API drafts, data-format drafts, MockProvider vertical-slice plan, and browser acceptance mapping.
- **NS-402**: Split AI contract files and added YAML persistence plus rebuildable indexes for model profiles, roles, prompt templates, presets, context bundles, and model call logs.
- **NS-403**: Added `@novel-studio/ai`, ProviderAdapter, ProviderRegistry, MockProvider, capability descriptions, streaming/structured/embedding simulation, token estimates, and unified error classification. No real provider or key access was added in this step.
- **NS-404**: Added model settings, connection tests, credential storage abstraction, credential-reference validation, and cloud permission boundaries. Connection tests reject disabled cloud or missing credentials and do not silently fall back to MockProvider.
- **NS-405**: Added scene-level `ContextBundle` assembly and preview APIs. The writing page can show minimum context preview. `never`, hidden sections, and future information are excluded with recorded source/reason/usage metadata.
- **NS-406**: Added seven built-in editorial roles, prompt templates, presets, declarative rendering, and prompt-template version history. Settings gained a roles/prompts section and prompt preview. Invalid or missing template inputs are rejected.
- **NS-407**: Added non-writing AI call APIs, SSE streaming, ModelCallLog persistence, and a minimal writing-page review/rewrite loop. Rewrite only creates an inline candidate; the author must explicitly keep it before it is saved. The writing main path does not expose audit fields.
- **NS-408**: Added a dedicated DeepSeek provider and generic OpenAI-compatible provider foundation. Settings can create DeepSeek config, save/replace/delete/reuse service keys, fetch model lists, and test connections through ProviderRegistry. The user confirmed real DeepSeek connection and model-list retrieval. OpenAI, OpenRouter, Anthropic, Gemini, and Ollama were not finished in the old scope.

### UI Principles and NS-409 History

- **UI Principle Strengthening**: Product and UX specs were updated with author-first information architecture, unified visual language, natural copy, image-model preview rules, preview-asset management, and screenshot review requirements.
- **NS-409C UI Correction**: Removed the untracked second `ui-foundation.css` layer, marked rejected `NS-409B` targets as not adopted, regenerated plan/write target images, moved planning toward a three-column workbench, and changed writing screenshots to real-prose states. Remaining issues were recorded.
- **NS-409D Wide-Screen Review**: Responded to user high-resolution screenshots showing abnormal writing gaps and wasted Codex/Workshop space. Saved wide page targets/review images, stopped writing-page wide drift, constrained Codex/Workshop workbenches, and added 1920-wide browser screenshots.
- **NS-409E Planning Wide-Screen Transition**: Saved current/target/implemented screenshots for board, outline, matrix, and timeline; removed narrow width locking and moved planning views toward wide workspaces. This was explicitly not a final UI acceptance.
- **NS-409 Current React Rebuild (`cca70e8`)**: Recorded and committed the current frontend working draft, reorganized React folders, removed obsolete non-backup UI assets, added protected UI baseline backups, updated current docs, fixed Windows `better-sqlite3` typing, and validated commands. The UI remains visually rejected and Codex remains a rough shell.
- **NS-409 Replan**: Replanned the remaining work instead of mechanically continuing the old task order. M2/M3 hierarchy, Codex API, storage, and index foundations are explicitly open to revision if the rebuilt frontend exposes gaps. The new order starts with hierarchy/project creation and Codex API audit, then proceeds through project recovery, Write hierarchy recovery, Codex API wrapper expansion, real Codex workspace implementation, Codex integration with Write/Plan/AI context, Settings recovery, Review/Workshop decision, and final acceptance.
- **Project Recovery Reframe**: Replaced the active `NS-409` umbrella with a project-level recovery roadmap. The active plan now covers product/UX baseline, architecture/contracts/storage/API audit, Library, Write, Plan, Codex, Settings, Review, Workshop, design system, app shell, i18n readiness, and validation. Old `NS-409*` records remain historical evidence, not the current task frame.
- **Project Recovery Slice A**: Recorded the baseline triage table and Release A scope decisions. The next active implementation slice is Start-to-Write: empty-library project creation, first editable scene, and correct `Volume -> Chapter -> Act -> Scene` behavior before Codex expansion or visual redesign.

### Current Validation Snapshot

- `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx`: 11 tests passed.
- `npm.cmd run build`: passed.
- `npm.cmd run test`: server 16, web 11, AI 18, storage 43 tests passed.
- `git diff --check`: passed with line-ending warnings only.
- User visual acceptance: failed. Project recovery remains open.
