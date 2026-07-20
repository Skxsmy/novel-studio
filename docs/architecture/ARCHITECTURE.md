# Current Architecture

Status: current implementation boundary
Updated: 2026-07-10
Target: `TARGET_ARCHITECTURE.md`
Product authority: `../product/PRODUCT_SPEC.md`

This document describes the current system shape. It does not own milestone status, next tasks, or acceptance claims.

## Runtime Topology

```text
React/Vite browser application
          |
     REST + SSE /api/v1
          |
Fastify local server on 127.0.0.1
   |              |                |
JSON authority    SQLite/FTS5      Provider/Credential adapters
files             derived index    and long-running model calls
```

The current release line runs as a local Windows-oriented web application. It has no account system, telemetry, automatic cloud fallback, or unauthenticated remote listener.

## Repository Boundaries

```text
apps/web                 React application shell and domain workspaces
apps/server              Fastify composition root and domain routes
packages/contracts       Zod schemas, DTOs, event shapes, and error contracts
packages/storage         JSON authority, transactions, snapshots, indexes, and repository queries
packages/ai              Provider adapters, capability/error normalization, and embedding routing
```

Current package dependencies are intentionally one-way:

```text
apps/* -> packages/*
packages/storage -> packages/contracts
packages/ai -> packages/contracts
packages/contracts -> no application package
```

The target architecture may introduce additional domain/import/security packages, but documents must not describe them as current implementation until they exist.

## Frontend Structure

The current frontend uses these boundaries:

```text
apps/web/src/app          application shell, workspace routing, global boundaries
apps/web/src/api          API clients and transport mapping
apps/web/src/features     library, write, plan, Codex, Workshop, Review, Settings, and shared domain UI
apps/web/src/ui           reusable primitives and design-system tokens/components
```

Feature components must not bypass the API layer to read project files. User-facing copy should stay in centralized text/view-model resources rather than being scattered through feature logic.

## Server Structure

`apps/server/src/app.ts` is the composition root. Domain routes are separated under `apps/server/src/routes/`, including AI/model settings, Codex, context, model calls, prompts, Proposals, Workshop, and Workshop attachments.

New domain behavior should extend or add a route module rather than growing `app.ts` into a monolithic API file.

Workshop-specific General Chat and Agent prompts live under the Workshop server module. They are separate from user-created non-Workshop global role/template records.

## Authority And Derived State

Project authority is schema-versioned JSON inside the project directory. Current authority includes:

- Author-facing `Series → Volume → Chapter → Act → Scene` hierarchy and `SceneBlockDocument` manuscript blocks.
- Planning events, Sections, review anchors, and snapshots.
- Codex categories, entries, research, reusable detail types, relations, Progressions, and character knowledge.
- Prompt/model/context/call metadata, Proposals, and Workshop session/message/attachment/context records.
- Library-scoped ResearchDatabase metadata, SourceDocument records, managed
  originals, and explicit links to zero or more Series.

Markdown and Word are import, export, mirror, preview, and migration boundary formats. Tiptap/ProseMirror, CodeMirror, browser state, localStorage, SQLite, FTS5, vectors, and caches are not the only saved project copy.

SQLite/FTS5 stores rebuildable projections such as search and mention indexes. Deleting derived state must not prevent the application from opening and editing authority files; rebuilding must validate source revisions and hashes.

`docs/architecture/DATABASE_ARCHITECTURE.md`, ADR-0018, ADR-0019, ADR-0020, ADR-0021, ADR-0022, ADR-0023, ADR-0025, and ADR-0026 define the active M6 implementation plan. A Series owns one rebuildable manuscript projection. Each author-facing Research Database is instead a library-level isolated authority root with its own Sources and rebuildable lexical/vector indexes, and may be explicitly linked to several Series. NS-602 implements the Series index kernel and first legacy Series-owned TXT/Markdown path. NS-603 replaces that Research ownership with multiple isolated database roots and an explicit migration boundary. NS-604 is limited to durable formats, large-source reading, and single-database original-language lexical indexing. NS-605 adds explicit multi-database hybrid and validated cross-language retrieval with per-database alias authority and a narrowly loaded, pinned vector sidecar; NS-606 adds the permissioned model tool gateway; NS-607 integrates session activation and bounded retrieval loops into Workshop; NS-608 performs real-author hardening. NS-609 added Research Notes and Codex promotion without an author request and is frozen under ADR-0026; it is not part of the approved M6 completion scope. NS-610 returns to Research Database and Source lifecycle. Completion of one task does not imply implementation of any later task.

The target Search Service is novel- and language-aware. It projects paragraph,
sentence, dialogue, POV, story-time, plot-thread, language-span, entity-alias,
and text-metric data with exact original offsets, then queries separate CJK and
word-oriented FTS shards behind one facade. Cross-language retrieval combines
original-language lexical matches, confirmed aliases/transliterations, a
fixture-validated multilingual Embedding profile, and optional versioned query
translation; every hit still cites unchanged original-language authority.

### Hierarchy Compatibility Boundary

The product hierarchy and the current storage names are intentionally separated:

| Product label | Current internal type/field/path |
| --- | --- |
| Series | `series` |
| Volume | `book` / `bookId` / `books/` |
| Chapter | `act` / `actId` / `acts/` |
| Act | `chapter` / `chapterId` / `chapters/` |
| Scene | `scene` / `sceneId` / `manuscript/` |

The internal names are a compatibility boundary, not alternate product terminology. UI and product-facing API descriptions must present `Series → Volume → Chapter → Act → Scene`; a future schema rename requires its own ADR, migration, and rollback evidence.

## Write And Codex Projection

- Scene authority is `SceneBlockDocument`; the active Write surface uses a Tiptap/ProseMirror runtime and converts at the storage boundary.
- Existing scene APIs may expose projected `content` for compatibility, but compatibility does not make Markdown authoritative.
- Codex Canon/Detail pure-text surfaces may use CodeMirror without saving editor-private state.
- Reusable Detail Type version 2 authority stores the selected type's
  author-written description. Version 1 compatibility reads are non-mutating;
  explicit migration and exact rollback follow ADR-0016. Detail Type Rename is
  one multi-file authority transaction when legacy name-keyed Entry data must
  be converted to the stable Detail Type identifier.
- Unified JSON Progression projects Canon Description, reusable details, world facts, and relation state by narrative scene and same-scene block position.
- Character knowledge remains a separate authority and cannot overwrite world truth.
- Future scene/progression content, summaries, evidence, and IDs must not leak into earlier projections or AI context.

## Commands, Proposals, And Transactions

Normal authority writes carry stable IDs and `baseRevision`. The server re-reads authority, rejects stale writes, validates references, writes same-directory temporary files, and atomically replaces targets. Multi-file invariants use recoverable file transactions.

AI and imports do not receive generic file-write authority. Semantic changes enter a Proposal or a limited author-confirmed command path. Proposal acceptance validates target revisions, creates required snapshots, applies through domain/repository commands, and records the decision.

The current Workshop Agent path persists revision-protected run/step records, uses Provider structured output when declared, bounds malformed-output repair to one attempt, continues after successful or atomically failed author-confirmed Codex create/update commands, and exposes explicit retry or abandon for eligible interruptions. Full Tool Plan/Grant records, broader tool scopes, and Proposal conversion remain target work and must not be inferred from this limited path.

The current Workshop path provides the NS-606 server-owned read-only Research
gateway through NS-607 session activation and bounded iterative Provider loops.
Initial context contains compact database metadata and tool definitions rather
than a passage dump; persisted citations retain exact original-language anchors.
NS-607 also governs the three Research reads and two confirmed Codex writes
through one production policy and reusable behavior-evaluation framework. Real
saved-key stability, adversarial/recovery/performance hardening, and final audit
remain NS-608 and must not be inferred from deterministic trials.

## Lifecycle And Deletion

Archive is a reversible visibility state, not a retention substitute. Archive-capable product objects require an explicit cleanup or permanent-delete design. Destructive cleanup must validate references or preserve the minimum immutable history snapshot required by audit views.

Projects currently support Trash, restore, and exact-name-confirmed permanent directory deletion. Other domains must not claim complete lifecycle support until their delete/reference behavior is implemented and accepted.

## AI And Credentials

- Model calls use an explicitly selected Provider/model profile and never silently cross a local/cloud boundary.
- Provider model discovery returns exact-model reasoning controls separately from the persisted connection profile. Model Profile version 2 stores only the normalized last valid reasoning preference for its exact Provider connection and model; Provider-private request objects remain adapter details.
- Workshop General Chat and Agent consume typed Provider answer/reasoning stream events. Version 2 call logs persist resolved parameters, and version 2 Workshop messages/runs distinguish author cancellation from failure, completion, and restart interruption under ADR-0017.
- Credentials are library-global references resolved through the credential service; plaintext keys do not enter project JSON, logs, or API responses.
- Context assembly applies source permission, Codex policy, per-detail switches, story position, character knowledge, and token budgeting before Provider delivery.
- `EmbeddingModelProfile` and `EmbeddingRouter` are shared infrastructure separate from generation-model configuration. Embeddings and vector indexes are rebuildable derived data, not evidence or Canon.

## Long-Running And Failure Boundaries

AI streaming is cancellable and session-scoped. Model failures preserve author input/context and must not create an empty Proposal. Index failure degrades search rather than corrupting authority. Damaged JSON or invalid references produce diagnostics and must not be silently rewritten by a read operation.

Document parsing, embedding/index rebuild, Word diff, backup, and large migration work belong on cancellable long-running paths as they are implemented. Ordinary manuscript saving must not wait for those operations.

## Current Structural Risks

- `packages/storage/src/index.ts` remains oversized and mixes multiple domains.
- Full Tool Plan/Grant and atomic Agent adapter boundaries are unfinished.
- First-start library selection, in-app shutdown/tray flow, broader provider real-world validation, Reference Library ingestion, Word round trip, backup, and final performance hardening remain incomplete product areas.
- Current UI command/function evidence is not equivalent to user visual acceptance.
