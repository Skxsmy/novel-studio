# NS-514 P5 Audit Summary

Status: ready for author audit; no P6 integration authorized
Date: 2026-07-15

Authoritative detailed record:
`docs/tasks/NS-514_REFERENCE_CONTROL_AND_CAPABILITY_AUDIT.md`

Acceptance evidence: `docs/testing/NS-514_ACCEPTANCE.md`

## 1. Purpose And Reading Order

This document is a compact review aid. It does not replace the detailed audit
and does not create product requirements or approve implementation.

Recommended audit order:

1. Review the totals and control matrix below.
2. Decide the four reference-control queues: connect, local-only, disabled,
   and fixture-only.
3. Review the 47 old-capability gaps, especially Proposal/Review, lifecycle,
   evidence navigation, and Workshop recovery.
4. Return decisions using RC/OC IDs. P6 may implement only explicitly approved
   in-place mappings.

## 2. Executive Result

| Audit population | Count | Result |
| --- | ---: | --- |
| Binding-reference controls | 368 | Every control appears exactly once |
| Proposed `connect in place` controls | 129 | Candidate only; author approval required |
| Proposed `local-only` controls | 165 | Presentation state only; author approval required |
| Proposed `disabled-deferred` controls | 72 | Must not appear functional |
| Proposed `fixture-only` controls | 2 | Must not reach production data paths |
| Old real capabilities | 101 | 80 API-backed plus 21 frontend-local |
| Old capabilities represented by the reference | 54 | Structurally represented; not yet connected |
| Old capabilities partially represented | 14 | Missing state, action, or safety/evidence path |
| Old capabilities absent from the reference | 33 | Requires an explicit binding decision |
| Excluded old placeholders | 7 | Six handlerless buttons plus one disabled command input |
| Pending author decision rows | 469 | 368 RC rows plus 101 OC rows |

P6 has not started. No row is approved merely because it has a proposed
classification.

## 3. Reference-Control Decision Matrix

| Surface | Total | Connect in place | Local-only | Disabled/deferred | Fixture-only |
| --- | ---: | ---: | ---: | ---: | ---: |
| Appbar | 10 | 1 | 7 | 2 | 0 |
| New Series dialog | 6 | 1 | 5 | 0 | 0 |
| Overview | 9 | 7 | 2 | 0 | 0 |
| Settings | 70 | 8 | 22 | 40 | 0 |
| Plan | 53 | 7 | 33 | 13 | 0 |
| Write | 50 | 15 | 20 | 13 | 2 |
| Codex | 58 | 19 | 36 | 3 | 0 |
| Workshop | 76 | 65 | 11 | 0 | 0 |
| Workshop request review | 7 | 1 | 6 | 0 | 0 |
| Detail-type dialog | 14 | 2 | 11 | 1 | 0 |
| Create Entry dialog | 6 | 1 | 5 | 0 | 0 |
| Create Category dialog | 5 | 1 | 4 | 0 | 0 |
| Write structure dialog | 4 | 1 | 3 | 0 | 0 |
| **Total** | **368** | **129** | **165** | **72** | **2** |

### Queue RC-A: connect in place (129)

These controls have a plausible existing callback/API mapping without adding
a new reference node. Approval must still preserve revision checks,
destructive confirmation, Proposal/Grant boundaries, credentials, context,
story time, and character knowledge.

The most decision-sensitive conditional mappings are:

- `RC-253` through `RC-256`: enable Codex Open in Write/Open Scene only when a
  real target Scene exists.
- `RC-283`: enable Workshop Stop only while a real Provider call is active.
- `RC-339`: enable Confirm and run only after valid mappings and explicit tool
  confirmation.

Suggested audit decision: approve by surface, not as an unreviewed global
batch.

### Queue RC-B: keep local-only (165)

These are view switches, filters, panels, tabs, dialog state, selections, and
other non-authoritative presentation behavior. They must never become the only
copy of project data.

Suggested audit decision: these can be batch-approved as local-only if their
exact reference behavior is acceptable.

### Queue RC-C: disabled/deferred (72)

| Area | IDs | Reason |
| --- | --- | --- |
| Disabled workspaces | `RC-006`, `RC-007` | Review has real missing capability; Research is not implemented |
| Unsupported Settings | `RC-049`–`RC-085`, `RC-093`–`RC-095` | Embeddings, roles, versioned prompts, backup, privacy, and library-location actions lack matching production UI paths |
| Unsupported Plan editing | `RC-135`–`RC-147` | Rich Scene fields, beats, time, and divergence actions are reference fixtures without matching persisted operations |
| Unsupported Write actions | `RC-171`–`RC-176`, `RC-178`, `RC-193`–`RC-198` | Comment/Snippet/AI rewrite/candidate/check actions lack approved production callbacks |
| Unsupported Codex actions | `RC-226`, `RC-245`, `RC-252` | More, Research Add, and Add relation lack a complete reference-defined action path |
| Detail-type deletion | `RC-351` | Existing deletion requires lifecycle/confirmation UI absent from the binding |

Suggested audit decision: keep disabled unless a later binding revision adds
the missing complete workflow.

### Queue RC-D: fixture-only (2)

- `RC-168` Keep.
- `RC-169` Undo.

Both operate only on the reference candidate fixture. They have no existing
Proposal-backed candidate operation and must not be shown as successful
production actions.

## 4. Old-Capability Coverage Matrix

| Capability domain | Total | Represented | Partial | Absent |
| --- | ---: | ---: | ---: | ---: |
| AI model/credential settings | 9 | 8 | 0 | 1 |
| Codex | 22 | 11 | 5 | 6 |
| Proposal/Review APIs | 5 | 0 | 0 | 5 |
| Series/Plan/Write APIs | 23 | 11 | 1 | 11 |
| Workshop APIs | 21 | 13 | 3 | 5 |
| Frontend-local behavior | 21 | 11 | 5 | 5 |
| **Total** | **101** | **54** | **14** | **33** |

## 5. High-Priority Capability Gaps

### A. Proposal and Review: structurally absent

| IDs | Existing capability missing from the binding |
| --- | --- |
| `OC-032`–`OC-036` | Proposal accept, edit-and-accept, inbox, mark stale, and reject |
| `OC-070` | Navigate from a Proposal to its source Workshop message |
| `OC-085` | Stable Proposal deep link |
| `OC-101` | Edit Proposal patch text before acceptance |

Impact: AI or bulk semantic changes cannot complete the required author review
cycle. Enabling the existing Review appbar button alone is insufficient because
the binding contains no Review workspace.

Required decision: request a binding revision for Review; do not inject the old
Review UI into the replica.

### B. Series and manuscript lifecycle: absent or partial

| IDs | Gap |
| --- | --- |
| `OC-043`–`OC-048` | Delete Chapter, Volume, Act, Scene, Story change block, and Series |
| `OC-054`, `OC-055` | Restore or trash Series |
| `OC-056`–`OC-058` | Rename/update Chapter, Volume, and Act |
| `OC-041` | Story change insertion is only partially represented |
| `OC-095` | Reorder Story change blocks |

Impact: authors can create structure but cannot complete existing rename,
delete, trash, restore, and Story change lifecycle operations.

Required decision: add lifecycle controls in a future binding revision or
explicitly accept temporary capability loss. Silent omission is not allowed.

### C. Codex lifecycle and evidence navigation

| IDs | Gap |
| --- | --- |
| `OC-010`, `OC-016`, `OC-018`, `OC-027` | Archive/delete category or Entry, restore Entry |
| `OC-011`, `OC-015` | Archive/create relation |
| `OC-019`, `OC-024`–`OC-026`, `OC-031` | Effective state, mentions, progressions, relations, and progression update are partial |
| `OC-092`–`OC-094` | Inline preview, source-Scene navigation, and mention preview are partial |

Impact: reference tabs exist, but several evidence and lifecycle actions are
disabled or incomplete.

Required decision: approve only in-place evidence navigation where the same
node can be conditionally enabled; request a binding revision for lifecycle or
relation workflows that require missing menus/dialogs.

### D. Workshop lifecycle and recovery

| IDs | Gap |
| --- | --- |
| `OC-065`, `OC-073`, `OC-074`, `OC-079` | Delete/resend message, restore session, rename/update session |
| `OC-067`, `OC-068` | Codex create/update tool confirmation is partial |
| `OC-076` | Non-streaming Provider call path is partial |
| `OC-086` | Source-message deep link is partial |
| `OC-100` | Reasoning visibility/export control is partial |

Impact: normal conversation works, but recovery, message correction, source
navigation, and audit/privacy behavior are incomplete.

Required decision: preserve confirmation, context, Provider cancellation, and
reasoning/privacy boundaries; do not map a visual button directly to an unsafe
shortcut.

### E. Other explicit gaps

- `OC-003`: remove stored model credential.
- `OC-083`: collapse the removed legacy sidebar. This can remain absent if the
  new appbar layout is accepted as the replacement.
- `OC-089`: clear manuscript structure selection.

## 6. Old Fake And Placeholder Controls

These controls are not counted as real old capabilities:

| Old control | Source | Classification |
| --- | --- | --- |
| Continue Scene | `apps/web/src/features/overview/OverviewWorkspace.tsx:18` | Enabled dead/fake button; no handler |
| Draft | `apps/web/src/features/write/WriteWorkspace.tsx:708` | Enabled static button; no handler |
| Revise | `apps/web/src/features/write/WriteWorkspace.tsx:709` | Enabled static button; no handler |
| Import Thread | `apps/web/src/features/workshop/WorkshopWorkspace.tsx:2185` | Explicitly disabled placeholder |
| Unavailable Proposal Open | `apps/web/src/features/workshop/WorkshopWorkspace.tsx:2802` | Explicitly disabled unavailable-state placeholder |
| Source unavailable | `apps/web/src/features/review/ReviewWorkspace.tsx:267` | Explicitly disabled unavailable-state placeholder |
| Command search | `apps/web/src/app/App.tsx:395` | Explicitly disabled input placeholder |

The audit test parses the old TSX and requires every handlerless old button to
appear in this excluded population.

## 7. Suggested Decision Response Format

The author may approve by queue, surface, or individual ID. A precise response
can use this format:

```text
RC-B local-only: approve all.
RC-A connect in place: approve [surface names or RC IDs].
RC-C disabled/deferred: keep disabled [all or exceptions].
RC-D fixture-only: keep fixture-only / remove from production.

OC partial/absent decisions:
- approve conditional in-place mapping: [OC IDs]
- request binding revision: [OC IDs]
- explicitly accept temporary omission: [OC IDs]
```

No P6 code change is authorized until these decisions are recorded in the
authoritative task document.

## 8. Reporting-Process Defect And Durable Guard

While updating the detailed audit, the assistant temporarily removed and
re-added the same generated report path to replace its embedded machine block.
The file was restored and the binding reference was not touched, but the
method was unnecessary and created risk.

Root `AGENTS.md` now makes the following enforceable repository rule:

- an existing path must never be modified by delete-and-readd;
- deletion requires explicit user authorization;
- an oversized generated artifact must be redesigned rather than temporarily
  removed.

This incident is also recorded in `docs/testing/NS-514_ACCEPTANCE.md`.
