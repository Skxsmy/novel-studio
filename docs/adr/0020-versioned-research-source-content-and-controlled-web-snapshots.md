# ADR-0020: Versioned Research Source Content And Controlled Web Snapshots

Status: Accepted

## Context

NS-603 established library-scoped isolated Research Databases, but its
SourceDocument version 2 assumes a UTF-8 TXT or Markdown original and exposes
that original as one undivided string. DOCX, PDF, EPUB, HTML, and web pages are
binary or structured inputs. Search Evidence must return to a stable location
inside the unchanged imported material, and old version 2 Sources must not be
silently rewritten during startup.

The canonical author-facing hierarchy remains
`Series → Volume → Chapter → Act → Scene`. Research Sources are independent of
that hierarchy and remain owned only by their selected Research Database.

## Decision

1. New imports use SourceDocument version 3. It records immutable original
   byte facts, a canonical managed-original path, parser identity and version,
   a canonical parsed-content path, and either file-origin or controlled-web
   origin facts. The unchanged original bytes remain the import Evidence root.
2. Parsed content is a separate schema-versioned JSON authority document. It
   contains ordered Sections, Blocks, Chunks, exact extracted original-language
   text, stable identifiers, hashes, BCP 47 language analysis, language spans,
   and format-specific SourceLocation values. Parsed content is replaceable
   only through an explicit parser migration or author-confirmed re-import.
3. Version 2 TXT/Markdown Sources remain compatibility-readable. An explicit,
   revision-checked database migration creates a version 3 Source and content
   record from the exact existing original. It first preserves the exact
   version 2 authority as a rollback artifact and never changes the original
   bytes. No startup or search request silently mutates version 2 authority.
4. Every Research Database owns its own `.studio/index.sqlite`. That index has
   a Research-specific application identity, database identity, schema
   checksum, source revision ledger, language rows, and separate character
   n-gram and Unicode word FTS projections. It can be deleted and rebuilt from
   SourceDocument and parsed-content authority without opening another
   Research Database.
5. Keyword search opens exactly one selected Research Database in NS-604. It
   returns database, Source, Chunk, language, match channel, original text,
   hash, revision, and SourceLocation. Cross-language semantic retrieval and
   explicit multi-database result fusion remain NS-605.
6. Local author search may return a Source whose artificial-intelligence
   permission is `never`. Any request whose declared purpose is model context
   filters or rejects that Source before returning text. Search does not alter
   the permission.
7. An author-submitted web address performs one bounded acquisition. Each
   request and redirect must use `http` or `https`, contain no credentials,
   resolve only to public network addresses, and stay within redirect, timeout,
   response-size, and media-type limits. The HTTP connection is pinned to a
   validated address for that hop. Scripts, active content, event attributes,
   embedded resources, and unsafe URLs are removed before the managed snapshot
   is committed. The snapshot is never refreshed during search.
8. ZIP-based parsers reject absolute paths, parent traversal, symbolic links,
   excessive entries, excessive expanded bytes, and excessive compression
   ratios before content extraction. DOCX external relationships are rejected.
   EPUB spine items must resolve inside the validated archive.

## Dependency Decision

- `mammoth` 1.12.0, BSD-2-Clause, remains the DOCX text/structure converter.
- `pdfjs-dist` 6.1.200, Apache-2.0, remains the text-PDF parser.
- `jszip` 3.10.1 is used under its MIT license for bounded DOCX/EPUB archive
  inspection and extraction.
- `parse5` 8.0.1, MIT, parses and serializes HTML/XHTML into an explicit tree so
  active content can be removed without executing it.

No parser may access an external file or network resource. The controlled web
acquisition boundary is the only NS-604 network path.

## Consequences

- Binary originals no longer pass through UTF-8 string conversion and exact
  hashes remain meaningful for every supported format.
- The author can inspect a document by Section, page, chapter, paragraph, or
  DOM-derived location and search original Chinese, Japanese, and English text.
- Parser upgrades are visible migrations with rollback material instead of
  invisible changes to Evidence anchors.
- Import remains successful when authority commits but index projection fails;
  the index reports degraded state and can be rebuilt without re-importing.
- OCR, recursive crawling, automatic research, translation, semantic vectors,
  and multi-database search remain outside this decision.

## Rollback

- Stop using the version 3 parser/index code and leave version 3 files intact
  for diagnosis.
- For an explicitly migrated version 2 Source, restore its exact rollback JSON;
  the original file was never changed.
- Delete the Research index and all SQLite sidecars. No Source authority or
  managed original is deleted, and a compatible build can recreate the index.

## Validation

- Import deterministic TXT, Markdown, DOCX, text PDF, EPUB, HTML, and controlled
  web fixtures; restart and prove exact original hashes plus stable locations.
- Reject a scanned PDF, damaged office file, ZIP traversal, symbolic link,
  compression bomb, DOCX external relationship, active HTML, local/private web
  address, unsafe redirect, oversized response, and unsupported media type.
- Search Chinese, Japanese, English, and mixed-language text in one database;
  prove every result returns the unchanged Chunk and SourceLocation.
- Copy an index or Source content file across databases, damage one database,
  and prove the other database remains isolated and searchable.
- Inject parser, authority-write, build, and swap failures; prove no partial
  source appears and the prior live index remains readable or recoverable.
