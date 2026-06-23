# Task Index

Status keys: `[ ]` todo, `[-]` in progress, `[x]` complete, `[!]` blocked or rejected.

This index keeps the original milestone/task history translated from the earlier Chinese log. Do not move routine task state into new files.

## Current Active Task

- [!] `NS-409` Frontend and Codex recovery plan.

Current decision:

- `NS-409` has been replanned. It is no longer a mechanical continuation of the old frontend sequence.
- `NS-409` is not accepted.
- Do not continue to `NS-410`.
- Do not treat old `NS-409A` through `NS-409F` assets as current guidance.
- M2/M3 completion does not make their contracts untouchable. Hierarchy, Codex API, storage, and index behavior may be revised if the rebuilt frontend requires it.
- Current source files:
  - `docs/tasks/NS-409.md`
  - `docs/testing/NS-409_ACCEPTANCE.md`
  - `docs/design/ui-redesign/README.md`

Immediate task requirements:

- Start with `NS-409.1`: audit hierarchy/project creation and Codex API gaps.
- Repair Write hierarchy around `Volume -> Chapter -> Act -> Scene`.
- Add must open a compact menu and create default-named items.
- Delete must sit beside Add and delete the selected hierarchy item only after confirmation.
- Titles must be renameable later, including double-click rename where appropriate.
- Collapsed sections must not auto-center and waste space.
- Scroll must exist where hierarchy content can overflow.
- Codex must become a real entry workflow, not a shell.
- Codex frontend API coverage must be expanded only after checking existing server routes and contracts.
- Settings must complete scoped product behavior.
- Review and Workshop must become real scoped workflows or honest unavailable states.
- UI copy must remain adaptable for bilingual support.

## M0

- [x] `NS-001` Repository governance, product boundary, architecture, data contract, and test strategy.
- [x] `NS-002` Git initialization, dependency lockfile, base build, and CI-equivalent local check.
- [x] `NS-003` Durable product, UX, AI, data, import/export, and milestone specs.

## M1

- [x] `NS-101` React app shell and original Chinese visual system.
- [x] `NS-102` Sample project navigation and clickable Plan/Write/Codex/Workshop/Review shell.
- [x] `NS-103` Browser usability check and interface decision record.

## M2

- [x] `NS-201` Series, book, act, chapter, and scene file contracts plus atomic storage.
- [x] `NS-202` Fastify `/api/v1` series and scene APIs.
- [x] `NS-203` Frontend create/open/edit/save/reload vertical loop.
- [x] `NS-204` SQLite/FTS5 index rebuild and search.

## M3

- [x] `NS-301` Explicit Act/Chapter lists, ordering, scene movement, stable references, migration, and validation.
- [x] `NS-302` Real planning data for grid/board, outline, matrix/tracking, and dual timelines.
- [x] `NS-303` Milkdown editor, independent Sections, focus writing, revision-aware crash recovery, and anchors.
- [x] `NS-304` Codex file contracts, categories, aliases, relations, mention indexes, and readable-scope preview.
- [x] `NS-305` Story progressions, character knowledge, and scene-effective facts.
- [x] `NS-306` UI entry points for new series, book, act, and chapter.
- [x] `NS-307` Writing-page layout repair and scene creation into a specified book/act/chapter.

## M3 to M4 Preparation

- [x] `NS-400` M3 close, architecture refresh, module splits, repeatable smoke tests, launcher/browser-acceptance reliability, and M4 contract preparation.

## M4

- [x] `NS-401` M4 execution spec, API draft, file-format draft, and first vertical-slice design.
- [x] `NS-402` AI contract partition plus minimum persistence for model profiles, prompts, context bundles, and call logs.
- [x] `NS-403` ProviderAdapter core, capability descriptions, error classification, and MockProvider.
- [x] `NS-404` Model settings, connection tests, credential storage abstraction, and cloud permission boundaries.
- [x] `NS-405` Scene-level context assembler, permission filtering, future-story isolation, and usage estimates.
- [x] `NS-406` Prompt templates, editorial roles, presets, declarative rendering, and version history.
- [x] `NS-407` Non-writing AI calls, SSE streaming, and ModelCallLog.
- [-] `NS-408` DeepSeek and OpenAI-compatible provider foundation.
  - Done: DeepSeek provider path, generic OpenAI-compatible foundation, settings credential controls, connection test, model-list flow, and user-confirmed DeepSeek connection/model-list retrieval.
  - Not finished from original scope: OpenAI, OpenRouter, Anthropic, Gemini, and Ollama providers; recorded real DeepSeek non-writing call result.
- [!] `NS-409` Frontend and Codex recovery plan.
  - Historical `NS-409A/NS-409C`: image-model-assisted UI redo and plan/write correction records. Not current acceptance.
  - Historical `NS-409D`: wide-screen review for Write, Codex, and Workshop. Not current acceptance.
  - Historical `NS-409E`: planning board/outline/matrix/timeline wide-screen transition. Not current acceptance.
  - `NS-409.0`: rebaseline and guardrails.
  - `NS-409.1`: foundation audit for hierarchy, project creation, and Codex API.
  - `NS-409.2`: project/library recovery from empty state.
  - `NS-409.3`: Write hierarchy recovery.
  - `NS-409.4`: Codex API and frontend wrapper expansion.
  - `NS-409.5`: Codex entry workspace.
  - `NS-409.6`: Codex integration with Write, Plan, and AI context.
  - `NS-409.7`: Settings recovery.
  - `NS-409.8`: Review and Workshop decision.
  - `NS-409.9`: regression, acceptance, and handoff.
  - Current `NS-409`: React working draft is command-verified but visually rejected.
- [ ] `NS-410` M4 closeout, security check, state handoff, and M5 entry confirmation. Do not start until `NS-409` is accepted.

M4 detailed planning remains in `docs/tasks/M4.md`. Throughout M4, AI must not directly modify prose, canon, summaries, character state, story progressions, or character knowledge.
