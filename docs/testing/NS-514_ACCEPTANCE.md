# NS-514 Acceptance Record

Status: in_progress
Task: `docs/tasks/NS-514.md`
Updated: 2026-07-15

Binding reference:
`docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html`

Reference SHA-256 at P0:
`FA55F41FE3629360A1E193B3AF8CB7E578C420107A5FA445D3D493DAE92AC284`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Acceptance Matrix

| ID | Status | Proof type | Exact evidence target | Actual result |
| --- | --- | --- | --- | --- |
| NS-514-A01 | passed | automated/source | P0 Git baseline checks, tracked reference hash, and Web build | `apps/web` has no tracked diff from `HEAD` and no untracked files; reference is tracked as blob `876413e`; SHA-256 matches the value above; Web build passed |
| NS-514-A02 | passed | automated/source | `tests/docs/docs-check.test.mjs` — `keeps support work separate from the sequential M-to-NS mainline`; `npm.cmd run docs:check`; `git diff --check` | Governance test passed 7/7, documentation check passed for 102 Markdown files, and diff check passed with line-ending warnings only |
| NS-514-A03 | passed | automated/source | `tests/docs/ns-514-reference-contract.test.mjs` — `indexes every binding reference surface and ordered region` | Passed; generated contract deep-equals the binding HTML extraction and accounts for all 14 surfaces, ordered regions, classes, IDs, and controls |
| NS-514-A04 | passed | automated/source | `tests/docs/ns-514-reference-contract.test.mjs` — `maps reference states interactions breakpoints and fixtures without runtime leakage` | Passed; states, listener inventory, 31 media queries, navigation defaults, and fixture families match the binding HTML with no runtime/API requirement leakage |
| NS-514-A05 | passed | automated test | `apps/web/src/app/ReferenceAppShell.test.tsx` — `renders only the manifest shell regions in reference order`; `preserves the reference default workspace and disabled navigation` | Passed; the reference appbar, workspace order, default Codex state, disabled Review/Research controls, project switch, dialog order, tokens, and compact selectors are present without legacy shell regions |
| NS-514-A06 | passed | automated test | `apps/web/src/app/ReferenceAppShell.test.tsx` — `reproduces project menu and New Series dialog interactions`; `keeps reference shell interactions keyboard reachable` | Passed; workspace switching, menu open/dismiss, dialog validation/reset/local creation, initial focus, focus containment, backdrop dismissal, outside click, and Escape behavior match the reference interaction contract |
| NS-514-A07 | passed | automated/source | owning domain tests named `matches the NS-514 manifest for <workspace>` plus `ReferenceOverlays.test.tsx` | Passed; Overview, Settings, Plan, Write, Codex, Workshop, and all six reference overlays reproduce the binding roots, inner DOM, ordered regions, controls, default states, fixture anchors, and responsive rules without legacy additions |
| NS-514-A08 | passed | automated/diagnostic | `apps/web/src/app/ReferenceReplica.test.tsx` — `reproduces declared workspace interactions without calling product APIs`; `tests/e2e/ns-514-reference-structure.spec.ts` — `matches declared desktop and compact structural states` | Passed; the exact binding runtime handles workspace/menu/dialog/domain interactions without `fetch`, and Chrome reports identical key geometry/computed layout for replica and binding at 1600×1000, 1180×800, and 720×900 |
| NS-514-A09 | passed | automated/source | `apps/web/src/app/ReferenceReplica.test.tsx` — `assembles every reference surface without non-reference controls` plus the declared interaction/return-path case | Passed; application-frame and global-overlay order match the manifest, all six workspaces mount, reference return paths work, and no tested legacy shell selector is present |
| NS-514-A10 | passed | explicit user manual | `P4 author reference-replica visual review` | Passed by the author's 2026-07-15 direction to start P5 after the audit phase and gate were restated |
| NS-514-A11 | passed | automated/source | `tests/docs/ns-514-reference-audit.test.mjs` — `accounts for every manifest control exactly once` | Passed; all 368 binding controls appear once with node, state/interaction, frontend/API candidate, proposed disposition, structural fit, and pending author decision |
| NS-514-A12 | passed | automated/manual | `tests/docs/ns-514-reference-audit.test.mjs` — `accounts for every inventoried runtime capability exactly once` plus pre-NS-514 source review | Passed; 80 unique reachable `api.*` methods and 21 frontend-local capabilities appear once; 33 absent and 14 partial gaps are explicit; six handlerless old buttons and one disabled command placeholder are excluded with reasons |
| NS-514-A13 | in_progress | automated test | focused approved-mapping tests plus production-fixture exclusion regression | Write passed real-data and fixture-runtime exclusion tests; other surfaces remain pending and unapproved |
| NS-514-A14 | in_progress | automated test | affected existing safety tests plus exact new mapping regressions | Write retained revision conflicts, destructive confirmation, and the existing Story Change authority path; other surfaces remain pending |
| NS-514-A15 | planned | automated/source | focused/full commands, docs/link checks, diff and repository-state ledger | Pending P7 |
| NS-514-A16 | manual_pending | explicit user manual | `P7 final author visual acceptance` | Awaiting completed approved integration; diagnostics cannot pass this gate |
| NS-514-A17 | passed | automated test | `ReferenceWriteWorkspace.test.tsx` — `connects real Write data and the complete NovelEditor without fixture manuscript claims` | Passed with real hierarchy/Scene content/counts, effective block-aware Canon Description preview, and no binding fixture manuscript claim |
| NS-514-A18 | passed | automated test | `useProjectSession.test.tsx` — exact retry and conflict cases; connected Write status assertion | Passed: one initial request plus three delayed retries, stable Failed, next-edit restart, no conflict retry, and one animated live status slot |
| NS-514-A19 | passed | automated test | `ReferenceWriteWorkspace.test.tsx` — `manages Story changes from the Scene page without adding an editor insertion control` and `renders Story Change as a labeled Write surface while preserving its legacy actions`; existing `AppShell.test.tsx` — `creates edits collapses and deletes write progression blocks` | Passed: Add remains in the Scene page heading and calls the real block API; the replacement uses a labeled Write-only Story Change surface and sidebar index; edit/collapse/resize/reorder/focus/confirmed delete continue through the retained NovelEditor node path. The first visual treatment was author-rejected, and A16 remains pending for the replacement |
| NS-514-A20 | passed | automated test | `ReferenceWriteWorkspace.test.tsx` — `renames and confirms deletion from hierarchy title context menus without exposing Series lifecycle actions` | Passed for title-only mouse and keyboard menus, inline rename, cascade confirmation, real deletion callback, and no Series menu |
| NS-514-A21 | passed | automated test | connected Write disabled-state assertions plus `ReferenceReplica.test.tsx` fixture-runtime exclusion | Passed: Draft is fixed, deferred controls remain visible/selection-responsive but disabled, and the binding's fake Write runtime is omitted |

Allowed status values: `planned`, `in_progress`, `passed`, `manual_pending`,
`blocked`, `not_applicable`.

## Phase Gates

| Phase | State | Evidence/gate |
| --- | --- | --- |
| P0 recovery | passed | A01-A02 passed |
| P1 reference contract | passed | A03-A04 passed |
| P2 shared shell | passed | A05-A06 passed; focused test, Web typecheck, and production build passed |
| P3 isolated workspaces | passed | A07-A08 passed |
| P4 assembled replica | passed | A09 automated evidence and explicit author gate A10 passed |
| P5 control/capability audit | passed | A11-A12 passed; all 469 decision rows remain `pending_author` |
| P6 approved integration | in_progress | A13-A14 and Write-specific A17-A21; only the author-approved Write dispositions are in progress |
| P7 final verification | planned | A15 plus explicit user gate A16 |

## Required Commands

```powershell
git diff --name-status HEAD -- apps/web
git ls-files --others --exclude-standard -- apps/web
git ls-files -s -- docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html
Get-FileHash -Algorithm SHA256 docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html
npm.cmd run build -w @novel-studio/web

# Added at P1-P7 as their planned tests become real:
node --test tests/docs/ns-514-reference-contract.test.mjs
npm.cmd run test -w @novel-studio/web
npm.cmd run typecheck -w @novel-studio/web
npm.cmd run build -w @novel-studio/web
npm.cmd run docs:check
git diff --check
```

## Adversarial Coverage

| Risk | Fixture/scenario | Expected result | Evidence |
| --- | --- | --- | --- |
| Rejected attempt leaks into restart | Tracked and untracked Web-file scans | No rejected NS-514 runtime file exists before new implementation | P0 passed |
| Unrelated work is overwritten | Dirty worktree contains user edits/deletions and `.hermes/plans/` | Every unrelated path remains byte-for-byte outside NS-514 patches | P0 inventory captured; final proof pending |
| Reference drift | Tracked blob and SHA-256 change without approved design update | Contract test fails and task records an explicit reference decision | P0 hash captured; P1 test planned |
| Fixture claims appear as project truth | Reference counts/story names rendered in production mode | Production-fixture exclusion test fails; UI uses real data or honest unavailable state | A13 planned |
| Old capability is silently removed | Capability has no reference control | P5 gap inventory records impact/options and requires author disposition | A12 passed; 33 absent and 14 partial rows recorded |
| Unsupported reference action appears real | Reference JavaScript simulates success without a backend | Production control remains disabled/local-only or is connected to a real result/error | A11 passed for classification; A13 remains planned for P6 production behavior |
| Existing authority safety is bypassed | Connected semantic/destructive action | Existing Proposal/Grant/revision/snapshot/atomic confirmation path remains mandatory | A14 planned |
| Narrow viewport hides required navigation | Declared compact breakpoints and long labels | Structure follows the reference contract, remains keyboard reachable, and does not fabricate a mobile editor | A06/A08 planned |
| Diagnostic evidence is mistaken for acceptance | Builds, DOM checks, or visual diagnostics pass | A10/A16 remain `manual_pending` until explicit author decisions are recorded | Enforced in matrix |
| Autosave burns requests after a persistent failure | Ordinary save fails repeatedly | One initial attempt and three retries occur; Failed remains stable until a later edit starts a new cycle | A18 passed |
| Right-click lifecycle removes the wrong scope | Series or a hierarchy row outside the title target is invoked | Only Volume through Scene title targets expose the menu; every delete names and confirms its cascade | A20 passed |

## Write P6 Acceptance Mapping

| Approved behavior | Exact proof before implementation completion |
| --- | --- |
| Complete NovelEditor and lightweight effective Canon Description preview | Existing `NovelEditor.test.tsx` cases plus new `ReferenceWriteWorkspace.test.tsx` real-data integration case |
| Compact autosave animation and retry state machine | New `useProjectSession.test.tsx` fake-timer/API cases plus Write status live-region case |
| Story Change add/edit/reorder/resize/delete confirmation | Existing editor/node behavior tests plus Scene-page management and labeled Write-presentation cases |
| Volume through Scene context rename/delete; no Series lifecycle menu | New hierarchy context-menu interaction case |
| Unsupported controls disabled; Draft fixed | New disabled-state inventory case |
| Visual result | A16 remains an explicit author gate; automated evidence cannot pass it |

## Run Ledger

| Date | Commit/worktree | Command or manual procedure | Result |
| --- | --- | --- | --- |
| 2026-07-15 | `27d0c10`, dirty unrelated worktree plus untracked rebuild plan | `git diff --name-status HEAD -- apps/web` | Passed; no tracked Web diff. Git emitted only an existing LF-to-CRLF warning for `codexViewModel.ts` |
| 2026-07-15 | `27d0c10`, same worktree | `git ls-files --others --exclude-standard -- apps/web` | Passed; no untracked Web file |
| 2026-07-15 | `27d0c10`, same worktree | `git ls-files -s -- docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html` | Passed; tracked blob `876413ea842cd6ecc3ac36a7775de2effb82f77c` |
| 2026-07-15 | `27d0c10`, same worktree | `Get-FileHash -Algorithm SHA256 docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html` | Passed; `FA55F41FE3629360A1E193B3AF8CB7E578C420107A5FA445D3D493DAE92AC284` |
| 2026-07-15 | `27d0c10`, same worktree | `npm.cmd run build -w @novel-studio/web` | Passed; TypeScript and Vite built 234 modules |
| 2026-07-15 | `27d0c10`, task activation worktree | `node --test tests/docs/docs-check.test.mjs` | Passed; 7 tests including the exact explicit-user deferral case |
| 2026-07-15 | `27d0c10`, task activation worktree | `npm.cmd run docs:check` | Passed for 102 Markdown files |
| 2026-07-15 | `27d0c10`, task activation worktree | `git diff --check` | Passed; only existing LF-to-CRLF warnings were emitted |
| 2026-07-15 | `27d0c10`, P1 worktree | `node --test tests/docs/ns-514-reference-contract.test.mjs` | Passed; 2 tests |
| 2026-07-15 | `27d0c10`, P1 worktree | `npm.cmd run docs:check` | Passed for 103 Markdown files |
| 2026-07-15 | `27d0c10`, P1 worktree | `git diff --check` | Passed; only existing LF-to-CRLF warnings were emitted |
| 2026-07-15 | `27d0c10`, P2 worktree | `npm.cmd run test -w @novel-studio/web -- ReferenceAppShell.test.tsx` | Passed; 4 tests covering shell structure/defaults and project-menu/New-Series interactions |
| 2026-07-15 | `27d0c10`, P2 worktree | `npm.cmd run typecheck -w @novel-studio/web` | Passed |
| 2026-07-15 | `27d0c10`, P2 worktree | `npm.cmd run build -w @novel-studio/web` | Passed; Vite built 19 reference-shell modules |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | focused NS-514 Web tests for shell, six workspaces, overlays, and replica | Passed; 9 files and 14 tests |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | `node --test tests/docs/ns-514-reference-contract.test.mjs` | Passed; 2 tests |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | `npm.cmd run typecheck -w @novel-studio/web` | Passed |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | `npm.cmd run build -w @novel-studio/web` | Passed; Vite built 27 modules |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | `npm.cmd run test:e2e:quick -- tests/e2e/ns-514-reference-structure.spec.ts` | Passed in real Chrome; replica and binding key geometry/computed layout matched at desktop, compact, and narrow viewports; diagnostic screenshots were written only to the temporary browser-acceptance directory |
| 2026-07-15 | `27d0c10`, P3/P4 worktree | manual diagnostic inspection of desktop and narrow replica/binding screenshots | No visible discrepancy found; diagnostic only, and A10 remains `manual_pending` |
| 2026-07-15 | `27d0c10`, P4 gate worktree | `npm.cmd run test -w @novel-studio/web` | Passed; all 15 Web test files and 103 tests |
| 2026-07-15 | `27d0c10`, P4 gate worktree | `node --test tests/docs/docs-check.test.mjs` | Passed; 7 tests |
| 2026-07-15 | `27d0c10`, P4 gate worktree | `npm.cmd run docs:check` | Passed for 103 Markdown files |
| 2026-07-15 | `27d0c10`, P4 gate worktree | `git diff --check` | Passed; only existing LF-to-CRLF warnings were emitted |
| 2026-07-15 | `27d0c10`, P5 activation worktree | Author direction `开始` after P5 scope/gate explanation | P4 visual gate A10 passed and P5 audit authorized; no P6 integration authorized |
| 2026-07-15 | `27d0c10`, P5 audit worktree | Manual pre-NS-514 source review plus generated `docs/tasks/NS-514_REFERENCE_CONTROL_AND_CAPABILITY_AUDIT.md` | Accounted for 368 reference controls, 80 reachable API methods, 21 frontend-local capabilities, six handlerless old buttons, and one disabled command placeholder; every decision remains pending author review |
| 2026-07-15 | `27d0c10`, P5 audit worktree | `node --test tests/docs/ns-514-reference-audit.test.mjs` | Passed; 2 tests proving exact reference-control and old-capability accounting |
| 2026-07-15 | `27d0c10`, P5 audit worktree | `node --test tests/docs/ns-514-reference-contract.test.mjs` | Passed; 2 tests confirming the audit still targets the unchanged binding contract |
| 2026-07-15 | `27d0c10`, P5 audit worktree | `npm.cmd run docs:check` | Passed for 104 Markdown files after the audit and evidence updates |
| 2026-07-15 | `27d0c10`, P5 audit worktree | `git diff --check` | Passed; only existing LF-to-CRLF working-copy warnings were emitted |
| 2026-07-15 | branch `codex/ns-410-json-authority`, commit `27d0c10` | `git branch --show-current`; `git rev-parse --short HEAD`; `git status --short` | Confirmed the NS-514 files are uncommitted, P6 has no integration changes, and the previously recorded unrelated edits/deletions plus `.hermes/plans/` remain present |
| 2026-07-15 | `27d0c10`, P5 reporting worktree | Process incident: the generated audit path was temporarily removed and re-added while regenerating its embedded machine block | Defect acknowledged; the audit file was restored, the binding reference was untouched, and root `AGENTS.md` now forbids delete-and-readd modification of an existing path |
| 2026-07-15 | `27d0c10`, P5 comparison worktree | Author-requested detailed Settings, Write, Codex, and Workshop comparison documents | Recorded complete per-page matrices for shared, new-only, old-only, partial, disabled, fixture, authority, safety, accessibility, and pending-decision behavior; no P6 wiring authorized |
| 2026-07-15 | `27d0c10`, P5 comparison worktree | `npm.cmd run docs:check` | Passed for 109 Markdown files after adding and indexing the four page comparisons |
| 2026-07-15 | `27d0c10`, P5 comparison worktree | `git diff --check` | Passed; only existing LF-to-CRLF working-copy warnings were emitted |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `npm.cmd run test -w @novel-studio/web` | Passed; 16 Web test files and 107 tests before adding the final focused Story Change placement/API assertion |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `npm.cmd run build -w @novel-studio/web` | Passed; TypeScript and Vite built 189 modules; emitted only the existing chunk-size advisory |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `npm.cmd run test -w @novel-studio/web -- ReferenceWriteWorkspace.test.tsx useProjectSession.test.tsx` | Passed after the final assertion; 2 files and 5 tests covering real Write data, effective preview, selection visuals/disabled controls, Story Change placement/API, hierarchy lifecycle, autosave retries, and conflicts |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `node --test tests/docs/ns-514-reference-contract.test.mjs tests/docs/ns-514-reference-audit.test.mjs tests/docs/docs-check.test.mjs` | Passed; 11 tests. The completed P5 audit remains an immutable semantic snapshot while capability identities and the current reachable API set are still checked exactly |
| 2026-07-15 | `27d0c10`, Write P6 worktree | `npm.cmd run docs:check`; `git diff --check` | Passed for 109 Markdown files; diff check emitted only existing LF-to-CRLF working-copy warnings |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | Author review: `story change 界面完全不合格。重做` | The first connected Story Change visual treatment is rejected. No visual acceptance is inferred; the retained lifecycle and approved Scene-page placement remain unchanged |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | `npm.cmd run test -w @novel-studio/web -- ReferenceWriteWorkspace.test.tsx` | Passed; 1 file and 4 tests, including the new labeled Write-only Story Change structure, sidebar index, and replacement delete confirmation copy |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx -t "creates edits collapses and deletes write progression blocks"` | Passed; 1 targeted legacy lifecycle regression, with 74 unrelated tests skipped |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | `npm.cmd run build -w @novel-studio/web` | Passed; TypeScript and Vite built 189 modules and emitted only the existing chunk-size advisory |
| 2026-07-15 | `27d0c10`, Story Change redo worktree | `npm.cmd run docs:check`; `git diff --check` | Passed for 109 Markdown files; diff check emitted only existing LF-to-CRLF working-copy warnings |
| 2026-07-15 | `27d0c10`, NS-514 pre-commit worktree | `npm.cmd run test -w @novel-studio/web` | Passed; all 16 Web test files and 109 tests after the Story Change replacement regression was added |

## P0 Recovery Evidence

- No tracked file under `apps/web` differs from `HEAD`.
- No untracked file exists under `apps/web`; therefore there was no rejected
  generated component, style, or test to delete.
- The binding reference is tracked and unchanged during recovery.
- The pre-NS-514 Web baseline builds successfully.
- Unrelated existing changes remain present and were not edited by P0.

## Manual And User Gates

- A10 is the explicit P4 visual review of the assembled reference replica.
- A16 is the explicit P7 visual review of the final approved connected UI.
- Browser inspection, screenshots, computed layout, builds, and tests may
  diagnose discrepancies but cannot change either row to `passed`.

## Current Repository State

- Branch: `codex/ns-410-json-authority`.
- Starting commit: `27d0c10 NS-510 docs(workshop): record closure evidence`.
- Task-related dirty files: NS-514 plan/task/manifest/audit/acceptance,
  reference extraction/audit/checker tests, the reference-only Web replica and
  focused tests, the connected Write hierarchy/sidebar/Story Change layer,
  autosave and effective-preview integration, the Chrome structural diagnostic,
  and the active task/index/status updates.
- Unrelated preserved files: existing `HANDOFF.md` and
  `docs/testing/NS-507_ACCEPTANCE.md` edits; existing
  `docs/design/ui-redesign/` deletions and `README.md` edit; untracked
  `.hermes/plans/`.
