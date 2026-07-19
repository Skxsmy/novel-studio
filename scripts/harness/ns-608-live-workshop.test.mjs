import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ProjectRepository } from "@novel-studio/storage";
import {
  NS608_TARGET_MODEL,
  assertPublicSummarySafe,
  fingerprintDirectory,
  harnessFailure,
  publicHarnessFailure,
  projectDeepseekV4ProProfile,
  selectSavedDeepseekProfile,
  withTemporaryRealProviderEnvironment,
} from "./ns-608-live-workshop.mjs";

function profile(overrides = {}) {
  return {
    schemaVersion: 2,
    id: "11111111-1111-4111-8111-111111111111",
    title: "DeepSeek",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    credentialRef: "novel-studio/model-profile/reference",
    contextWindowTokens: 1_000_000,
    capabilities: {
      streamText: true,
      structuredOutput: true,
      embeddings: false,
      tokenEstimate: true,
      modelList: true,
    },
    defaultParameters: {},
    reasoningPreference: null,
    archivedAt: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

test("selects one saved DeepSeek profile and changes only the trial model", () => {
  const source = profile();
  assert.equal(selectSavedDeepseekProfile([source]), source);
  assert.throws(() => selectSavedDeepseekProfile([]), /exactly one/iu);
  assert.throws(() => selectSavedDeepseekProfile([source, profile({ id: "22222222-2222-4222-8222-222222222222" })]), /found 2/iu);
  const projected = projectDeepseekV4ProProfile(source);
  assert.equal(projected.model, NS608_TARGET_MODEL);
  assert.deepEqual({ ...projected, model: source.model }, source);
});

test("fingerprints byte changes and rejects private material in public summaries", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ns608-unit-"));
  try {
    await writeFile(path.join(root, "record.json"), "{\"ok\":true}\n", "utf8");
    const first = await fingerprintDirectory(root);
    await writeFile(path.join(root, "record.json"), "{\"ok\":false}\n", "utf8");
    const second = await fingerprintDirectory(root);
    assert.notEqual(first.digest, second.digest);
    assert.doesNotThrow(() => assertPublicSummarySafe({ model: NS608_TARGET_MODEL, passed: true }));
    assert.throws(() => assertPublicSummarySafe({ credentialRef: "hidden" }), /forbidden material/iu);
    assert.throws(() => assertPublicSummarySafe({ value: "private-root" }, ["private-root"]), /private runtime value/iu);
    assert.deepEqual(publicHarnessFailure(harnessFailure("saved-credential-missing", { retryable: true })), {
      code: "saved-credential-missing",
      retryable: true,
    });
    assert.doesNotThrow(() => assertPublicSummarySafe({ systemSecretPointerConfined: true }));
    assert.deepEqual(publicHarnessFailure(new Error("private path and identifier")), {
      code: "unexpected-harness-failure",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("preserves the source library and reports cleanup safety after a failed live callback", async () => {
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-ns608-source-"));
  try {
    const repository = new ProjectRepository(sourceRoot);
    await repository.initialize();
    await repository.saveModelProfile(profile());
    const before = await fingerprintDirectory(sourceRoot);
    await assert.rejects(
      () => withTemporaryRealProviderEnvironment({ sourceLibraryRoot: sourceRoot }, async () => {
        throw harnessFailure("controlled-provider-failure", { retryable: true });
      }),
      (error) => {
        const failure = publicHarnessFailure(error);
        assert.equal(failure.code, "controlled-provider-failure");
        assert.equal(failure.retryable, true);
        assert.equal(failure.safety.systemSecretPointerConfined, true);
        assert.equal(failure.safety.sourceLibraryUnchanged, true);
        return true;
      },
    );
    assert.deepEqual(await fingerprintDirectory(sourceRoot), before);
  } finally {
    await rm(sourceRoot, { recursive: true, force: true });
  }
});
