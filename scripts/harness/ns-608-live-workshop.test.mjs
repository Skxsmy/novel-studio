import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ProjectRepository } from "@novel-studio/storage";
import {
  NS608_TARGET_MODEL,
  assertPublicSummarySafe,
  evaluateBalancedResearchFactCoverage,
  evaluateConflictFactCoverage,
  evaluateCrossLanguageFactCoverage,
  exactResearchCitationPresent,
  fingerprintDirectory,
  harnessFailure,
  parseContinuationWriteRequest,
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

test("matches Research citations against the source chunk text hash", () => {
  const sourceDetail = {
    source: { id: "source-japanese" },
    content: {
      chunks: [{ id: "chunk-1", textHash: "a".repeat(64) }],
    },
  };
  assert.equal(exactResearchCitationPresent([{
    sourceId: "source-japanese",
    chunkId: "chunk-1",
    chunkHash: "a".repeat(64),
  }], sourceDetail), true);
  assert.equal(exactResearchCitationPresent([{
    sourceId: "source-japanese",
    chunkId: "chunk-1",
    chunkHash: "b".repeat(64),
  }], sourceDetail), false);
});

test("recognizes governed cross-language facts without forcing simplified Chinese wording", () => {
  assert.deepEqual(evaluateCrossLanguageFactCoverage(
    "冬至に西門を守り、開門前に青銅の鈴を三度鳴らす。鐘の音が終わるまで門扉に触れてはならない。",
  ), {
    winterSolstice: true,
    westGate: true,
    bronzeBell: true,
    ringsThreeTimes: true,
    beforeOpening: true,
    noDoorTouchUntilRingingEnds: true,
  });
  assert.deepEqual(evaluateCrossLanguageFactCoverage(
    "At the Winter Solstice west gate, ring the bronze bell three times before opening. The guard must not touch the door until the ringing has ended.",
  ), {
    winterSolstice: true,
    westGate: true,
    bronzeBell: true,
    ringsThreeTimes: true,
    beforeOpening: true,
    noDoorTouchUntilRingingEnds: true,
  });
});

test("grades balanced retrieval facts and conflicting-source boundaries independently", () => {
  assert.deepEqual(evaluateBalancedResearchFactCoverage(
    "资料记录关门钟在子时前两刻敲三声。",
  ), { beforeMidnight: true, threeChimes: true });
  assert.deepEqual(evaluateConflictFactCoverage([
    "日文记录写冬至翌朝举行，北门未开门。",
    "英文商人账簿却写冬至前一晚为盐车开门放行，两者明显冲突。",
    "送り不是放逐，不能据此推出有人被驱逐。",
  ].join("\n")), {
    japaneseAfterSolsticeMorning: true,
    japaneseGateClosed: true,
    englishBeforeSolsticeEvening: true,
    englishGateOpenedForSaltWagons: true,
    conflictExplicit: true,
    noExileInference: true,
  });
  assert.deepEqual(evaluateConflictFactCoverage([
    "英文账簿把时间写成冬至前夕，并称北门对盐商车队开放一次。",
    "日文记录则是冬至翌朝，北门不开门，因此存在分歧。",
    "这些名称不能理解为有人被放逐。",
  ].join("\n")), {
    japaneseAfterSolsticeMorning: true,
    japaneseGateClosed: true,
    englishBeforeSolsticeEvening: true,
    englishGateOpenedForSaltWagons: true,
    conflictExplicit: true,
    noExileInference: true,
  });
  assert.deepEqual(evaluateConflictFactCoverage([
    "日文来源：冬至翌朝，北门未开门。两边有冲突。",
    "English ledger: evening before the winter solstice; the north gate opened once for salt wagons.",
    "The label does not prove that anyone was exiled.",
  ].join("\n")), {
    japaneseAfterSolsticeMorning: true,
    japaneseGateClosed: true,
    englishBeforeSolsticeEvening: true,
    englishGateOpenedForSaltWagons: true,
    conflictExplicit: true,
    noExileInference: true,
  });
});

test("distinguishes plain tool results from new continuation write requests", () => {
  assert.equal(parseContinuationWriteRequest({
    role: "tool",
    content: "codex.create_entry created Codex entry: Shen Yao",
  }), null);
  assert.deepEqual(parseContinuationWriteRequest({
    role: "tool",
    content: JSON.stringify({ tool: "codex.update_entry", draft: { target: { name: "Shen Yao" } } }),
  }), {
    tool: "codex.update_entry",
    draft: { target: { name: "Shen Yao" } },
  });
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
