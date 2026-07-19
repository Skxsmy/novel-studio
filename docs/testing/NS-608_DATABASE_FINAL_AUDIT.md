# NS-608 Final Database Implementation Audit

Status: planned
Task: `docs/tasks/NS-608.md`
Acceptance: `docs/testing/NS-608_ACCEPTANCE.md`

Canonical author-facing hierarchy: `Series → Volume → Chapter → Act → Scene`.

## Purpose

This report will close the final requirement-by-requirement audit of the
Research Database and Research-assisted Workshop program after real saved-key,
adversarial, recovery, performance, and connected-browser evidence exists. It
does not claim any audit conclusion before those runs finish.

## Audit Matrix

| Scope | Authority and required proof | Current conclusion |
| --- | --- | --- |
| Library-level ownership and database isolation | product specification, ADR-0019, JSON roots, storage/API/browser isolation probes | pending evidence review |
| Source formats, originals, parsing, bounded large files, and exact navigation | Reference Library specification, SourceDocument version 3, parser/index/API probes | pending evidence review |
| Exact, alias, transliteration, semantic, multi-database, and cross-language retrieval | ADR-0020/0022, retrieval service, language fixtures, ranking/citation probes | pending evidence review |
| Model read gateway, permissions, budgets, citations, and audit redaction | ADR-0021, gateway policy, audit authority, adversarial probes | pending evidence review |
| Workshop activation, iterative reads, Codex writes, and behavior harness | ADR-0023, production tool policy, real task/trial traces, authority outcomes | pending evidence review |
| Cancellation, restart, stale identity, corruption, rebuild, and deletion | transactions, lifecycle paths, fault probes, browser recovery | pending evidence review |
| Performance and author-scale resource behavior | declared fixture sizes/hardware, latency/RSS/disk measurements | pending evidence review |
| Product and documentation truthfulness | Product/UX/architecture/API/task/acceptance claims versus current runtime | pending evidence review |

## Reporting Rules

- Every confirmed defect in scope is listed even when it is fixed during
  NS-608; the report records the defect, correction, and rerun evidence.
- Missing or indirect evidence is not a pass. Residual risks and unimplemented
  recommendations remain distinct from completed behavior.
- Automated tests, deterministic harnesses, real Provider trials, diagnostic
  browser inspection, and explicit author acceptance are reported as separate
  evidence classes.
- The report never contains credentials, credential references, complete
  private passages, complete transcripts, Provider raw responses, temporary
  paths, or unredacted headers.
