# ADR-0021: Tool-driven Research Retrieval

Status: Accepted
Date: 2026-07-19

## Context

NS-604 introduced imported Source authority and a local single-database lexical
index. That is not yet an artificial-intelligence-usable Research Database.
Workshop does not call the index, the `model-context` search purpose only filters
permissions, and no Provider run can iteratively search or open evidence. Treating
that substrate as a finished database obscures the missing retrieval product.

The author requires several library-scoped isolated databases, cross-language
retrieval, and model-initiated evidence lookup without mechanically appending all
matching material to context.

## Decision

1. Delivery is split across five independently accepted mainline tasks. NS-604
   completes durable Sources, large-file ingestion, bounded reading, and one-
   database original-language lexical search. NS-605 implements explicit multi-
   database hybrid and validated cross-language retrieval. NS-606 implements a
   model-facing read-only retrieval gateway. NS-607 integrates activation and
   iterative retrieval into Workshop. NS-608 validates and hardens real author
   workflows. No earlier task claims a later capability.
2. Workshop activation is session-scoped and may contain several Research
   Database IDs. Activation never changes database ownership and does not require
   a Series link. Links only improve author discovery and labels.
3. Initial Provider context contains compact activation metadata and tool
   definitions, not Source bodies or a prefetched result dump.
4. The read-only tool surface is `research.list_sources`, `research.search`, and
   `research.open_passage`. Tools return bounded original-language evidence and
   stable citation anchors. Import, update, delete, rebuild, web fetch, and other
   mutations are not model tools.
5. The server enforces active-database allowlists, Source permission, filters,
   relevance thresholds, deterministic fusion, deduplication, source diversity,
   per-call and cumulative token/character budgets, maximum tool calls, no-
   progress limits, cancellation, and redacted durable audit. The model cannot
   raise these limits or bypass them through tool arguments.
6. General Chat and Agent may use the same read-only gateway only through a
   Provider's native tool-call protocol. Models without native tool calls remain
   usable for ordinary conversation but are reported as unable to use active
   Research Databases. Prompt injection or simulated tool-call prose is never
   executable.
7. Lexical, alias/transliteration, translation, and embedding channels are
   separate and disclosed. Semantic cross-language capability exists only for a
   configured profile that passes the governed language-pair fixture. Every
   result and final citation returns to unchanged original Source text.

## Consequences

- A database can be useful locally before later artificial-intelligence layers
  pass, while the interface and records remain truthful about that boundary.
- Model retrieval is selective and iterative. A model can search again or open
  neighboring passages, but cannot request a whole database dump.
- Read tools need no author confirmation because they do not write authority;
  their inputs, outputs, limits, and citations remain auditable.
- Workshop General Chat requires a bounded native-tool continuation loop rather
  than the current one-shot text stream. Agent write confirmation remains
  unchanged and separate from automatic read-tool execution.

## Migration And Rollback

- NS-607 introduces versioned session activation authority with explicit
  migration and rollback tests. Existing sessions migrate to no active Research
  Databases; no database is silently activated.
- Disabling the gateway or rolling back NS-607 leaves Research Database authority
  and indexes unchanged. Workshop continues without database retrieval.
- Vector and fused retrieval indexes remain rebuildable derived state. Removing
  them falls back to the exact lexical capability declared by the active profile.

## Validation

- Prove two isolated active databases can be queried without row, permission, or
  citation leakage and that an inactive database cannot be named through tools.
- Prove `never` Sources, oversized requests, broad dump attempts, prompt
  injection, duplicate/no-progress loops, cancellation, and restart are bounded.
- Prove Chinese, Japanese, and English positive and negative fixtures disclose
  the actual channels and always cite original-language Chunks.
- Use saved real model credentials for several author sessions, with multiple
  retrieval calls per session until the author question is resolved, then verify
  audit, citations, context budgets, and user-visible capability states.
