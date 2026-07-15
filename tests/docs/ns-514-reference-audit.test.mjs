import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { buildReferenceContract } from "../../scripts/ns514-reference-contract.mjs";
import {
  AUDIT_PATH,
  buildOldCapabilityInventory,
  buildReferenceAudit,
  parseReferenceAudit,
  scanHandlerlessOldButtons,
  scanRuntimeApiCalls,
} from "../../scripts/ns514-reference-audit.mjs";

function loadAudit() {
  const expected = buildReferenceAudit();
  const actual = parseReferenceAudit(readFileSync(AUDIT_PATH, "utf8"));
  return { actual, expected };
}

function stableCapability(capability) {
  const { frontendCallback, oldEntryPoint, sourceAnchors, ...stable } = capability;
  return stable;
}

function stableExcludedControl(control) {
  const { line, ...stable } = control;
  return stable;
}

test("accounts for every manifest control exactly once", () => {
  const contract = buildReferenceContract();
  const { actual, expected } = loadAudit();
  assert.deepEqual(actual.bindingSource, expected.bindingSource);
  assert.deepEqual(actual.boundary, expected.boundary);
  assert.deepEqual(actual.referenceControls, expected.referenceControls);

  const manifestKeys = contract.surfaces.flatMap((surface) =>
    surface.controls.map((control) => `${surface.key}:${control.selector}`),
  );
  const auditKeys = actual.referenceControls.map((control) => control.workspaceReferenceNode);
  assert.equal(auditKeys.length, contract.totalControls);
  assert.deepEqual(auditKeys, manifestKeys);
  assert.equal(new Set(auditKeys).size, auditKeys.length, "a reference control is duplicated");
  assert.equal(new Set(actual.referenceControls.map((control) => control.id)).size, auditKeys.length);

  const allowedStatuses = new Set(["connect in place", "local-only", "disabled-deferred", "fixture-only"]);
  for (const control of actual.referenceControls) {
    for (const field of [
      "workspaceReferenceNode",
      "controlLabelIcon",
      "referenceState",
      "referenceInteraction",
      "existingFrontendCallback",
      "existingApiEndpoint",
      "proposedStatus",
      "connectsWithoutDomVisualChange",
      "authorDecisionStatus",
    ]) {
      assert.ok(control[field], `${control.id} is missing ${field}`);
    }
    assert.ok(allowedStatuses.has(control.proposedStatus), `${control.id} has an unknown disposition`);
    assert.equal(control.authorDecisionStatus, "pending_author", `${control.id} was decided without author approval`);
  }
});

test("accounts for every inventoried runtime capability exactly once", () => {
  const { actual, expected } = loadAudit();
  assert.deepEqual(
    actual.oldCapabilities.map(stableCapability),
    expected.oldCapabilities.map(stableCapability),
  );
  assert.deepEqual(
    actual.oldCapabilities.map(stableCapability),
    buildOldCapabilityInventory().map(stableCapability),
  );
  assert.equal(new Set(actual.oldCapabilities.map((item) => item.id)).size, actual.oldCapabilities.length);
  assert.equal(new Set(actual.oldCapabilities.map((item) => `${item.kind}:${item.key}`)).size, actual.oldCapabilities.length);

  const scannedApiTokens = [...new Set(scanRuntimeApiCalls().map((call) => `api.${call.token}`))].sort();
  const auditedApiTokens = actual.oldCapabilities
    .filter((item) => item.kind === "api-backed")
    .map((item) => item.apiToken)
    .sort();
  assert.deepEqual(auditedApiTokens, scannedApiTokens);

  const allowedCoverage = new Set(["represented", "partial", "absent"]);
  for (const capability of actual.oldCapabilities) {
    for (const field of [
      "name",
      "oldEntryPoint",
      "frontendCallback",
      "apiEndpoint",
      "authorityBoundary",
      "referenceCoverage",
      "referenceControl",
      "whyNoReferenceControl",
      "userImpactIfOmitted",
      "futureReferenceOptions",
      "authorDecisionStatus",
    ]) {
      assert.ok(capability[field], `${capability.id} is missing ${field}`);
    }
    assert.ok(allowedCoverage.has(capability.referenceCoverage), `${capability.id} has unknown coverage`);
    assert.equal(capability.authorDecisionStatus, "pending_author", `${capability.id} was decided without author approval`);
    assert.ok(capability.sourceAnchors.length > 0, `${capability.id} has no source anchor`);
    for (const anchor of capability.sourceAnchors) {
      assert.ok(existsSync(anchor.split(":")[0].split("#")[0]), `${capability.id} source path no longer exists`);
    }
    if (capability.kind === "frontend-local") {
      const [source] = capability.sourceAnchors[0].split("#");
      assert.ok(
        readFileSync(source, "utf8").includes(capability.sourceTextAnchor),
        `${capability.id} local source anchor drifted`,
      );
    }
  }

  assert.ok(actual.oldCapabilities.some((item) => item.referenceCoverage === "absent"));
  assert.ok(actual.oldCapabilities.some((item) => item.referenceCoverage === "partial"));
  const scannedHandlerless = scanHandlerlessOldButtons();
  assert.deepEqual(
    actual.excludedOldControls.filter((item) => item.kind === "handlerless-button").map(stableExcludedControl),
    scannedHandlerless.map(stableExcludedControl),
  );
  assert.deepEqual(
    scannedHandlerless.filter((item) => !item.disabled).map((item) => item.control),
    ["Continue Scene", "Draft", "Revise"],
  );
  assert.equal(scannedHandlerless.filter((item) => item.disabled).length, 3);
  assert.deepEqual(
    actual.excludedOldControls.filter((item) => item.kind === "disabled-input-placeholder").map((item) => item.control),
    ["Command search input"],
  );
  assert.equal(actual.excludedOldControls.length, 7);
});
