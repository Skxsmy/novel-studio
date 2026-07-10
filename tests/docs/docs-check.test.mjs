import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkActiveTask,
  checkAdrStatuses,
  checkCanonicalHierarchy,
  checkCurrentDocumentReferences,
  checkMainlineMapping,
  checkMarkdownLinks,
} from "../../scripts/docs-check.mjs";

function withFixture(run) {
  const root = mkdtempSync(path.join(os.tmpdir(), "novel-studio-docs-check-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

test("reports a broken relative Markdown link", () => {
  withFixture((root) => {
    write(root, "README.md", "[missing](docs/missing.md)\n");
    assert.deepEqual(checkMarkdownLinks(root, ["README.md"]), [
      "README.md: missing Markdown link target docs/missing.md",
    ]);
  });
});

test("requires one active typed task and a complete acceptance mapping", () => {
  withFixture((root) => {
    write(root, "STATUS.md", "- Active task: `GOV-999 Example`.\n");
    write(root, "TASKS.md", "| GOV-999 | in_progress | Example | records |\n");
    write(
      root,
      "docs/tasks/GOV-999.md",
      "# GOV-999\n\nStatus: in_progress\n\n| GOV-999-A01 | Requirement | exact test |\n",
    );
    write(
      root,
      "docs/testing/GOV-999_ACCEPTANCE.md",
      "# Acceptance\n\nStatus: in_progress\n\n| GOV-999-A01 | planned | test/example.test.ts — exact name | Pending |\n",
    );
    assert.deepEqual(checkActiveTask(root), []);

    write(
      root,
      "docs/testing/GOV-999_ACCEPTANCE.md",
      "# Acceptance\n\nStatus: in_progress\n\n| GOV-999-A02 | planned | Covered by tests | Pending |\n",
    );
    assert.ok(checkActiveTask(root).some((error) => error.includes("missing acceptance row for GOV-999-A01")));
  });
});

test("keeps support work separate from the sequential M-to-NS mainline", () => {
  withFixture((root) => {
    write(root, "STATUS.md", [
      "- Active milestone: `M5 Workshop`.",
      "- Last completed mainline task: `NS-506 / M5.6A Execution Containment`.",
      "- Next mainline task: `NS-507 / M5.6B Atomic Codex Adapters`.",
      "- Active task: `GOV-001 Governance`.",
      "",
    ].join("\n"));
    assert.deepEqual(checkMainlineMapping(root), []);

    write(root, "STATUS.md", [
      "- Active milestone: `M5 Workshop`.",
      "- Last completed mainline task: `NS-506 / M5.6A Execution Containment`.",
      "- Next mainline task: `NS-508 / M5.6B Atomic Codex Adapters`.",
      "- Active task: `GOV-001 Governance`.",
      "",
    ].join("\n"));
    assert.ok(checkMainlineMapping(root).some((error) => error.includes("must immediately follow")));

    write(root, "STATUS.md", [
      "- Active milestone: `M5 Workshop`.",
      "- Last completed mainline task: `NS-506 / M5.6A Execution Containment`.",
      "- Next mainline task: `NS-507 / M5.6B Atomic Codex Adapters`.",
      "- Active task: `NS-507 Documentation Governance`.",
      "",
    ].join("\n"));
    assert.ok(checkMainlineMapping(root).some((error) => error.includes("NS is mainline-only")));
  });
});

test("requires the canonical English hierarchy and compatibility mapping", () => {
  withFixture((root) => {
    const files = [
      "AGENTS.md", "PROJECT.md", "STATUS.md", "docs/product/README.md",
      "docs/product/PRODUCT_SPEC.md", "docs/product/REQUIREMENTS_TRACEABILITY.md",
      "docs/product/USER_EXPERIENCE_SPEC.md", "docs/architecture/ARCHITECTURE.md",
      "docs/architecture/TARGET_ARCHITECTURE.md", "docs/architecture/DATA_MODEL.md",
      "docs/tasks/GOV-001.md", "docs/testing/GOV-001_ACCEPTANCE.md",
    ];
    const canonical = "Series → Volume → Chapter → Act → Scene";
    const mapping = "Series → series; Volume → book; Chapter → act; Act → chapter; Scene → scene.";
    for (const file of files) write(root, file, `${canonical}\n${mapping}\n`);
    assert.deepEqual(checkCanonicalHierarchy(root, "GOV-001"), []);

    write(root, "docs/product/PRODUCT_SPEC.md", "Series → Book → Act → Chapter → Scene\n");
    assert.ok(checkCanonicalHierarchy(root, "GOV-001").some((error) => error.includes("forbidden author-facing hierarchy")));
  });
});

test("normalizes ADR status and validates the superseding ADR", () => {
  withFixture((root) => {
    write(root, "docs/adr/0001-old.md", "# ADR-0001\n\nStatus: Superseded by ADR-0002\n");
    write(root, "docs/adr/0002-new.md", "# ADR-0002\n\nStatus: Accepted\n");
    assert.deepEqual(checkAdrStatuses(root), []);

    write(root, "docs/adr/0001-old.md", "# ADR-0001\n\n状态：已接受\n");
    assert.ok(checkAdrStatuses(root).some((error) => error.includes("invalid or missing ADR Status")));
  });
});

test("reports missing backtick document references from current entry files", () => {
  withFixture((root) => {
    const currentFiles = [
      "AGENTS.md",
      "README.md",
      "ROADMAP.md",
      "STATUS.md",
      "HANDOFF.md",
      "TASKS.md",
      "CHANGELOG.md",
      "docs/README.md",
      "docs/tasks/GOV-999.md",
      "docs/testing/GOV-999_ACCEPTANCE.md",
    ];
    for (const file of currentFiles) write(root, file, "# Current\n");
    write(root, "AGENTS.md", "# Current\n\nRead `docs/missing.md`.\n");

    assert.ok(
      checkCurrentDocumentReferences(root, "GOV-999").some((error) =>
        error.includes("missing backtick document reference docs/missing.md"),
      ),
    );
  });
});
