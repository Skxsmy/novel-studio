# Task Index

Status markers: `[ ]` todo, `[-]` in progress, `[x]` complete, `[!]` blocked or rejected.

## Completed Milestones

- [x] `M0`: project governance, product boundary, architecture, data contracts, and test strategy.
- [x] `M1`: first clickable local web shell.
- [x] `M2`: file storage, API, conflict protection, index rebuild, and search.
- [x] `M3`: explicit hierarchy, planning views, editor, Codex storage, progressions, character knowledge, hierarchy creation UX.
- [x] `NS-400`: M3 closeout, architecture split, smoke tests, startup/browser validation reliability, M4 contract prep.
- [x] `NS-401` through `NS-407`: M4 AI contracts, storage, provider core, model settings, context preview, prompt roles, non-writing AI calls.
- [-] `NS-408`: DeepSeek/OpenAI-compatible/OpenAI/OpenRouter/Ollama implemented; real DeepSeek non-writing call validation and Anthropic/Gemini remain incomplete.

## Active Milestone

- [-] `NS-409`: frontend rebuild and UI remediation.

Current NS-409 facts:

- [x] Old `NS-409A` through `NS-409F` frontend branches and screenshots are obsolete and no longer implementation guidance.
- [x] New frontend structure exists: `apps/web/src/app`, `src/api`, `src/features`, `src/ui`.
- [x] Project creation/opening, Write save flow, partial hierarchy controls, minimal Codex shell, and partial Settings API wiring exist.
- [!] Current UI has failed user visual acceptance. Do not mark NS-409 as passed.
- [!] Codex frontend is still a rough shell and must be completed before the product can move forward.
- [!] Review and Workshop remain incomplete.
- [!] Settings is API-backed but not product-complete.
- [ ] Continue NS-409 remediation:
  - Codex real entry editor and detail tabs.
  - Write hierarchy UX: `Volume -> Chapter -> Act -> Scene`, add menu, default names, double-click rename, selected delete with confirmation, correct collapse/scroll behavior.
  - Settings product completion after visual baseline is accepted.
  - Split growing frontend CSS and large backend/storage files when touching them.

## Not Yet Active

- [ ] `NS-410`: M4 closeout, safety checks, state handoff, and M5 entry confirmation.

## Canonical Current Files

- Current state: `STATUS.md`
- Handoff: `HANDOFF.md`
- Current task spec: `docs/tasks/NS-409.md`
- Current acceptance record: `docs/testing/NS-409_ACCEPTANCE.md`
- Directory map: `docs/README.md`
