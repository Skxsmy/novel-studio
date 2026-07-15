import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { JSDOM } from "jsdom";

import {
  MANIFEST_PATH,
  REFERENCE_PATH,
  buildReferenceContract,
  parseManifestContract,
} from "../../scripts/ns514-reference-contract.mjs";

const expectedSurfaceKeys = [
  "appbar",
  "newSeriesDialog",
  "overview",
  "settings",
  "plan",
  "write",
  "codex",
  "workshop",
  "workshopReview",
  "workshopToast",
  "detailTypeDialog",
  "createEntryDialog",
  "createCategoryDialog",
  "writeStructureDialog",
];

function loadContracts() {
  const expected = buildReferenceContract();
  const actual = parseManifestContract(readFileSync(MANIFEST_PATH, "utf8"));
  return { expected, actual };
}

test("indexes every binding reference surface and ordered region", () => {
  const { expected, actual } = loadContracts();
  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.surfaces.map((surface) => surface.key), expectedSurfaceKeys);
  assert.deepEqual(actual.rootOrder.body, [
    "main.prototype",
    "div#schema-backdrop.backdrop",
    "div#create-backdrop.backdrop",
    "div#category-backdrop.backdrop",
    "div#wr6-structure-backdrop.backdrop",
    "script",
  ]);
  assert.equal(actual.rootOrder.prototype[0], "header.appbar");
  assert.equal(actual.rootOrder.prototype.at(-1), "div#wr5-toast.wr5-toast");
  assert.equal(
    actual.totalControls,
    actual.surfaces.reduce((total, surface) => total + surface.controlCount, 0),
  );
  for (const surface of actual.surfaces) {
    assert.equal(new Set(surface.ids).size, surface.ids.length, `${surface.key} has duplicate IDs`);
    assert.equal(new Set(surface.classes).size, surface.classes.length, `${surface.key} has duplicate classes`);
    assert.equal(surface.controls.length, surface.controlCount, `${surface.key} control count drifted`);
  }
});

test("maps reference states interactions breakpoints and fixtures without runtime leakage", () => {
  const { expected, actual } = loadContracts();
  assert.deepEqual(actual, expected);
  assert.equal(actual.source.path, REFERENCE_PATH);
  assert.equal(actual.css.mediaQueries.length, 31);
  assert.ok(actual.css.stateSelectors.some((selector) => selector.includes(":disabled")));
  assert.ok(actual.css.stateSelectors.some((selector) => selector.includes("[hidden]")));
  assert.ok(actual.css.stateSelectors.some((selector) => selector.includes(".is-open")));
  assert.ok(actual.interactions.sourceInventory.totalListenerStatements > 100);
  assert.ok(actual.interactions.sourceInventory.eventCounts.click > 100);

  const navigation = Object.fromEntries(actual.workspaceNavigation.map((item) => [item.workspace, item]));
  assert.equal(navigation.Codex.active, true);
  assert.equal(navigation.Review.disabled, true);
  assert.equal(navigation.Research.disabled, true);
  assert.equal(navigation.Settings.disabled, false);

  const reference = readFileSync(REFERENCE_PATH, "utf8");
  const referenceText = new JSDOM(reference).window.document.body.textContent.replace(/\s+/gu, " ");
  for (const family of actual.fixtureFamilies) {
    assert.ok(family.examples.length > 0, `${family.surface} needs fixture anchors`);
    for (const example of family.examples) {
      assert.ok(
        reference.includes(example) || referenceText.includes(example),
        `${family.surface} fixture anchor is missing: ${example}`,
      );
    }
  }
  assert.match(actual.authority.reproductionRule, /no old UI structure/u);
  assert.match(actual.authority.fixtureRule, /fixture-only/u);
  const serialized = JSON.stringify(actual);
  assert.doesNotMatch(serialized, /apps\/web\/src|\/api\/v1/u);
});
