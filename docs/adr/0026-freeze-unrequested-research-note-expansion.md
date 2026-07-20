# ADR-0026: Freeze Unrequested Research Note Expansion

Status: Accepted
Date: 2026-07-20
Supersedes: ADR-0024 as an approved product-scope decision

## Context

The author requested a real Reference Library with independent isolated
Research Databases, broad file ingestion, large-file handling, original-language
and cross-language retrieval, model-facing read tools, Workshop integration,
mature model behavior harnesses, and later Write artificial-intelligence tools.
The author did not request a Research Note feature or a Research Note-to-Codex
promotion workflow.

NS-609 was opened and implemented by the agent from a pre-existing speculative
Reference Library document and external product comparisons. That was an
unapproved expansion. Automated implementation evidence cannot convert it into
an author decision, and the feature must not be described as requested or
accepted merely because its tests pass.

## Decision

1. NS-609 is frozen. No further Research Note or Research Note-to-Codex feature
   work may proceed without a new explicit author instruction.
2. Existing NS-609 code and authority files are preserved temporarily. Removing
   committed routes, schemas, storage, UI, or saved authority is a separate
   destructive product decision; it must not be inferred from the correction
   that the feature was never requested.
3. NS-610 is limited to Research Database and Source lifecycle: archive,
   restore, version-preserving replacement, reparse, controlled web refresh,
   permanent delete, retrieval exclusion, recovery, and connected UI.
4. NS-610 may read existing Research Note/Proposal references only to avoid
   corrupting data already created by the frozen implementation. Compatibility
   checks are not new Research Note functionality and cannot add Note creation,
   editing, promotion, or deletion behavior.
5. A Source deletion may preserve an existing Note's immutable quote snapshot
   and report the original Source as missing. A pending Proposal that still
   depends on current Source authority blocks destructive deletion. This keeps
   current data safe without making Research Notes part of the requested
   database roadmap.
6. Product, status, task, acceptance, and traceability records must identify the
   scope error explicitly. ADR-0024 remains a historical description of the
   frozen implementation, not an approved author requirement.

## Consequences

- Passing NS-609 tests remains useful implementation evidence but is not product
  acceptance.
- The current mainline returns to the author's requested database work before
  Workshop harness engineering and Write artificial-intelligence features.
- A later explicit author decision may retain, redesign, or remove NS-609. Until
  then, no completion claim may count it toward the requested database scope.

## Validation

- Documentation checks must find one active statement: NS-609 is unrequested,
  frozen, and pending a retain-or-remove decision.
- NS-610 acceptance must not contain a planned Research Note mutation or UI.
- Database and Source lifecycle tests may use existing Note/Proposal authority
  only as external-reference fixtures.
