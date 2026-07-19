# ADR-0023: Workshop Research Activation And Tool Loop

Status: Accepted
Date: 2026-07-19

## Context

ADR-0021 and NS-606 provide a permissioned, bounded, read-only Research gateway,
but Workshop still has neither session activation authority nor a Provider
continuation coordinator that can call that gateway. A one-shot Provider request
cannot adapt a query, inspect exact evidence, or continue to an answer. Loading
all related Chunks into the prompt would violate the product's selective
retrieval and context-budget requirements.

The existing Workshop session authority predates library-scoped Research
Databases. It needs a migration that does not silently activate linked databases,
and Research citations need durable author-facing navigation without copying
private passage text into ordinary logs.

## Decision

### Session Authority

1. `WorkshopSession` schema version 3 adds
   `activeResearchDatabaseIds: string[]`. The array is ordered, unique, and
   limited to twelve UUIDs. New sessions use an empty array.
2. A repository-owned transaction migrates all valid version 1/version 2 session
   records for one Series together. It writes exact raw backups beneath the
   Series Workshop migration directory, validates every projected version 3
   record, and atomically replaces the originals. Existing activation is always
   empty because earlier schemas had no such authority.
3. Rollback restores exact raw records only when every migrated record still has
   the migration's expected revision. A stale revision blocks the whole rollback.
   Damage or path escape blocks migration without partial writes. Diagnostic list
   reads may return valid sessions plus path-confined damage records, but never
   silently erase the damage.
4. Activation updates validate every Research Database against current global
   library authority and reject duplicates, deleted databases, and more than
   twelve selections. A Series link affects ordering/labels only.
5. Branching copies the selected source prefix and activation snapshot. Archived
   sessions expose the snapshot read-only. Permanent session deletion removes it
   with the session. A Research Database cannot be deleted while any Workshop
   session, including an archived session, still activates it; the author must
   first remove those explicit references.

### Provider Loop And Evidence

6. One author turn owns one session-scoped, non-recursive coordinator. Each step
   calls the Provider, validates at most one native tool call, immediately
   executes a Research read tool through the NS-606 gateway, appends the native
   assistant/tool-result protocol to the next Provider request, and stops on a
   final assistant answer, cancellation, Provider error, context guard, gateway
   budget, no-progress limit, or session deactivation.
7. General Chat and Agent use the same Research read loop. Agent native write
   tools retain the existing author-confirmation protocol and must be the only
   tool call in their Provider step. Research reads do not create a pending
   confirmation message and cannot mutate authority.
8. Active database names, identifiers, and capability state are exposed through
   dynamic native tool descriptions plus the author-visible source selector.
   No Source body, search result, or hidden General Chat instruction is prefetched
   into the first request. Models without native tools continue ordinary chat and
   receive no executable Research definitions.
9. The coordinator persists a version 1 evidence record keyed to the completed
   assistant message. It contains only citations actually returned by gateway
   calls in that author turn: database and Source display identity, immutable
   Chunk/hash/revision/language/location anchors, and disclosed retrieval
   channels. Source text remains authoritative only in the Research Database.
10. Citation opening revalidates the active Research Database, Source revision,
    hash, Chunk, and location before navigating. A stale citation remains visible
    as historical evidence but reports that the exact passage can no longer be
    opened; it never silently opens replacement text.

### User Interface And Harness

11. Workshop adds a compact `Sources` control beside Context, not another page or
    permanent panel. Linked databases are promoted but not selected. Evidence is
    presented as a compact ribbon beneath the answer and opens the exact Research
    passage. Running retrieval uses a concise activity line and the existing
    Stop action.
12. The author explicitly rejected Figma for this surface. The implementation is
    designed directly in code from existing Novel Studio tokens and components,
    the NS-607 checklist, and documented external interaction references. User
    visual acceptance remains a separate explicit gate.
13. A reusable scripted Provider harness records and asserts every Provider
    request, native tool step, result, cancellation, error, and stop condition.
    It supports multi-session, multi-turn scenarios and fault injection. NS-607
    uses deterministic credentials only; saved real credentials and author-level
    workflow correction belong to NS-608.

## Consequences

- Research Database activation remains independent per Workshop session and from
  Series links or Context Basket membership.
- The model retrieves only what it asks for within server limits, and the author
  can inspect where each answer's evidence came from.
- Existing sessions require a controlled authority migration, while old messages
  need no rewrite because absence of a message evidence record means no persisted
  Research evidence.
- Database deletion gains a real reference blocker instead of leaving broken
  session selections.
- Provider protocol complexity is concentrated in a testable coordinator rather
  than recursive route handlers.

## Migration And Rollback

1. Discover every session record for one Series and parse without mutation.
2. Stop with diagnostics if any record is damaged, duplicated, or outside its
   expected path.
3. Build version 3 projections with empty activation and validated revisions.
4. Persist one exact backup manifest and raw record set, then replace all session
   records through the existing same-directory transaction boundary.
5. Verify restart reads version 3 records and branch/archive/delete semantics.
6. Rollback only when the migration manifest and every expected revision still
   match; restore exact raw bytes atomically.

Disabling the Workshop integration never changes Research Database authority or
derived indexes. Removing an evidence record removes only Workshop navigation
metadata, not Source content.

## Validation

- Prove empty-default migration, exact rollback, stale rollback rejection,
  damaged-record diagnostics, branch copy, archive read-only behavior, session
  deletion, and database deletion blockers.
- Prove General Chat and Agent execute several adaptive native Research calls and
  finish a useful answer without prompt stuffing or prose-simulated tools.
- Prove inactive/never/deleted Sources, duplicate/no-progress calls, malformed or
  parallel calls, cancellation, Provider errors, restart, context exhaustion,
  and unsupported models terminate truthfully.
- Prove persisted citations open exact original-language evidence or report stale
  identity without substitution.
- Prove the direct-code Workshop control is keyboard operable, responsive, backed
  by real API data, and separately awaiting explicit author visual acceptance.
