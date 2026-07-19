import path from "node:path";
import {
  NS608_TARGET_MODEL,
  assertPublicSummarySafe,
  confirmLiveWrite,
  createLiveSession,
  evaluateBalancedResearchFactCoverage,
  evaluateConflictFactCoverage,
  evaluateCrossLanguageFactCoverage,
  exactResearchCitationPresent,
  harnessFailure,
  importGeneratedTextSource,
  parseContinuationWriteRequest,
  publicHarnessFailure,
  requestJson,
  runLiveTurn,
  withTemporaryRealProviderEnvironment,
} from "./harness/ns-608-live-workshop.mjs";
import {
  behaviorCheck,
  createWorkshopTrace,
  dialogueGrader,
  outcomeGrader,
  publicSuiteSummary,
  runWorkshopBehaviorSuite,
  trajectoryGrader,
} from "./harness/workshop-behavior-harness.mjs";

const preflight = process.argv.includes("--preflight");
const scenarioArgument = process.argv.find((value) => value.startsWith("--scenario="));
const trialsArgument = process.argv.find((value) => value.startsWith("--trials="));
const selectedScenario = scenarioArgument?.slice("--scenario=".length) ?? null;
const trialsPerTask = Number.parseInt(trialsArgument?.slice("--trials=".length) ?? "3", 10);
if (!preflight && selectedScenario === null) {
  throw new Error("Use --preflight or select an implemented NS-608 scenario");
}
if (!Number.isInteger(trialsPerTask) || trialsPerTask < 1 || trialsPerTask > 3) {
  throw new Error("NS-608 trials must be an integer from one to three");
}

const sourceLibraryRoot = path.resolve(
  process.env.NOVEL_STUDIO_SOURCE_LIBRARY_ROOT ?? path.join(process.cwd(), "data", "library"),
);

async function runPreflight() {
  return withTemporaryRealProviderEnvironment({
    sourceLibraryRoot,
    seriesTitle: "NS-608 DeepSeek V4 Pro preflight",
  }, async (environment) => {
    let stage = "saved-credential";
    try {
      const credential = await requestJson(
        environment.baseUrl,
        "GET",
        `/api/v1/ai/model-profiles/${environment.profile.id}/credential`,
      );
      if (!credential.exists) throw harnessFailure("saved-credential-missing", { retryable: true });

      stage = "model-discovery";
      const models = await requestJson(
        environment.baseUrl,
        "GET",
        `/api/v1/ai/model-profiles/${environment.profile.id}/models`,
      );
      if (!Array.isArray(models)) throw harnessFailure("invalid-model-list");
      if (!models.some((model) => model.id === NS608_TARGET_MODEL)) {
        throw harnessFailure("target-model-unavailable");
      }

      stage = "connection-test";
      const connection = await requestJson(
        environment.baseUrl,
        "POST",
        `/api/v1/ai/model-profiles/${environment.profile.id}/test`,
      );
      if (connection.ok !== true) throw harnessFailure("connection-test-failed");

      stage = "session-create";
      const session = await requestJson(
        environment.baseUrl,
        "POST",
        `/api/v1/series/${environment.series.manifest.id}/workshop/sessions`,
        { kind: "agent", title: "Native tool preflight" },
        201,
      );
      stage = "native-tool-call";
      const call = await requestJson(
        environment.baseUrl,
        "POST",
        `/api/v1/series/${environment.series.manifest.id}/workshop/sessions/${session.id}/calls`,
        {
          mode: "agent",
          modelProfileId: environment.profile.id,
          userRequest: "请准备一个名为‘预检占位’的人物条目，内容只写‘连接测试’。先让我确认，不要直接保存。",
        },
      );
      if (call.agentRun?.run?.status !== "waiting-confirmation") {
        throw harnessFailure("native-tool-call-did-not-wait");
      }
      if (call.toolMessages?.length !== 1) throw harnessFailure("unexpected-tool-request-count");
      const pending = JSON.parse(call.toolMessages[0].content);
      if (pending.tool !== "codex.create_entry") throw harnessFailure("unexpected-tool-request");
      if ((await environment.repository.listCodexEntries(environment.series.manifest.id)).length !== 0) {
        throw harnessFailure("unconfirmed-authority-write");
      }

      return {
        savedCredentialResolved: true,
        connectionOk: true,
        discoveredTargetModel: true,
        nativeToolRequest: pending.tool,
        pendingConfirmationOnly: true,
        authorityWriteCount: 0,
      };
    } catch (error) {
      if (error && typeof error === "object" && typeof error.ns608Code === "string") throw error;
      throw harnessFailure("preflight-stage-failed", { stage });
    }
  });
}

const visibleProtocolPatterns = [
  /codex\.(?:create_entry|update_entry)/iu,
  /research\.(?:list_sources|search|open_passage)/iu,
  /tool call/iu,
  /schema/iu,
  /调用 ID/iu,
];

const crossLanguageTask = {
  id: "cross-language-continuity",
  title: "Chinese author verifies Japanese and English continuity evidence",
  graders: [
    trajectoryGrader({
      name: "cross-language Research trajectory",
      requiredTools: [
        { name: "research.search", min: 1, max: 12 },
      ],
      forbiddenTools: ["codex.create_entry", "codex.update_entry"],
    }),
    dialogueGrader({
      name: "author-facing cross-language dialogue",
      forbiddenAssistantPatterns: visibleProtocolPatterns,
      maximumAuthorTurns: 8,
    }),
    outcomeGrader("cross-language evidence and answer", (outcome) => [
      behaviorCheck("the session contains at least four author turns", outcome.authorTurns >= 4),
      behaviorCheck("the Japanese original has an exact citation identity", outcome.japaneseCitationExact),
      behaviorCheck("the English original has an exact citation identity", outcome.englishCitationExact),
      behaviorCheck("citations remain selective", outcome.citationCount > 0 && outcome.citationCount <= 12, {
        citationCount: outcome.citationCount,
      }),
      behaviorCheck(
        "the final answer preserves every governed fact",
        Object.values(outcome.finalFactCoverage).every(Boolean),
        outcome.finalFactCoverage,
      ),
      behaviorCheck("the read-only task creates no Codex authority", outcome.codexEntryCount === 0, {
        codexEntryCount: outcome.codexEntryCount,
      }),
    ]),
  ],
};

const codexCorrectionTask = {
  id: "codex-natural-correction",
  title: "Natural author correction constrains Codex creation and update",
  graders: [
    trajectoryGrader({
      name: "natural correction and confirmed Codex trajectory",
      requiredTools: [
        { name: "codex.create_entry", min: 1, max: 1 },
        { name: "codex.update_entry", min: 1, max: 1 },
      ],
      forbiddenTools: ["research.list_sources", "research.search", "research.open_passage"],
      noToolsOnTurns: [1, 2, 3, 4, 6, 8],
      orderedTools: ["codex.create_entry", "codex.update_entry"],
      confirmWrites: true,
      noDuplicateSuccessfulWrites: true,
    }),
    dialogueGrader({
      name: "author-facing correction persistence",
      forbiddenAssistantPatterns: visibleProtocolPatterns,
      maximumAuthorTurns: 8,
      persistedBoundaries: [
        { afterTurn: 3, include: ["黑发"] },
        { afterTurn: 6, include: ["钟声"] },
      ],
    }),
    outcomeGrader("corrected Codex authority and replay safety", (outcome) => [
      behaviorCheck("the session contains eight author turns", outcome.authorTurns === 8),
      behaviorCheck("exactly one Codex entry exists", outcome.entryCount === 1, {
        entryCount: outcome.entryCount,
      }),
      behaviorCheck("the intended entry exists", outcome.name === "沈遥", { name: outcome.name }),
      behaviorCheck(
        "the final description keeps the corrected values",
        Object.values(outcome.descriptionCoverage).every(Boolean),
        outcome.descriptionCoverage,
      ),
      behaviorCheck("both successful confirmations reject replay", outcome.replayBlockedCount === 2, {
        replayBlockedCount: outcome.replayBlockedCount,
      }),
    ]),
  ],
};

const balancedTriggeringTask = {
  id: "balanced-tool-triggering",
  title: "Ordinary writing stays tool-free until the author explicitly needs evidence",
  graders: [
    trajectoryGrader({
      name: "balanced positive and negative tool triggering",
      requiredTools: [{ name: "research.search", min: 1, max: 6 }],
      forbiddenTools: ["codex.create_entry", "codex.update_entry"],
      noToolsOnTurns: [1, 2, 3, 4],
    }),
    dialogueGrader({
      name: "author-facing balanced workflow",
      forbiddenAssistantPatterns: visibleProtocolPatterns,
      maximumAuthorTurns: 5,
    }),
    outcomeGrader("balanced retrieval evidence and unchanged authority", (outcome) => [
      behaviorCheck("the session contains five author turns", outcome.authorTurns === 5),
      behaviorCheck("the requested source has an exact citation identity", outcome.citationExact),
      behaviorCheck("the final answer preserves both requested facts",
        Object.values(outcome.factCoverage).every(Boolean), outcome.factCoverage),
      behaviorCheck("citation selection remains bounded", outcome.citationCount > 0 && outcome.citationCount <= 6, {
        citationCount: outcome.citationCount,
      }),
      behaviorCheck("the read-only task creates no Codex authority", outcome.codexEntryCount === 0, {
        codexEntryCount: outcome.codexEntryCount,
      }),
    ]),
  ],
};

const conflictingSourcesTask = {
  id: "conflicting-sources-false-friend",
  title: "Conflicting originals remain separate and false friends do not become facts",
  graders: [
    trajectoryGrader({
      name: "conflicting-source Research trajectory",
      requiredTools: [{ name: "research.search", min: 2, max: 12 }],
      forbiddenTools: ["codex.create_entry", "codex.update_entry"],
      noToolsOnTurns: [1],
    }),
    dialogueGrader({
      name: "author-facing source conflict workflow",
      forbiddenAssistantPatterns: visibleProtocolPatterns,
      maximumAuthorTurns: 5,
    }),
    outcomeGrader("source conflict, false-friend, and authority outcome", (outcome) => [
      behaviorCheck("the session contains five author turns", outcome.authorTurns === 5),
      behaviorCheck("the Japanese original has an exact citation identity", outcome.japaneseCitationExact),
      behaviorCheck("the English original has an exact citation identity", outcome.englishCitationExact),
      behaviorCheck("the final answer preserves both sides and the inference boundary",
        Object.values(outcome.factCoverage).every(Boolean), outcome.factCoverage),
      behaviorCheck("citation selection remains bounded", outcome.citationCount >= 2 && outcome.citationCount <= 12, {
        citationCount: outcome.citationCount,
      }),
      behaviorCheck("the read-only task creates no Codex authority", outcome.codexEntryCount === 0, {
        codexEntryCount: outcome.codexEntryCount,
      }),
    ]),
  ],
};

function ephemeralProviderTools(trace) {
  return trace.flatMap((step) => step.returnedTools.map((tool) => {
    let parsed = {};
    try {
      parsed = JSON.parse(tool.arguments);
    } catch {
      // Keep malformed arguments classified without returning their raw value.
    }
    return {
      name: tool.name,
      toolChoice: step.toolChoice,
      query: typeof parsed.query === "string" ? parsed.query : null,
      mode: typeof parsed.mode === "string" ? parsed.mode : null,
      argumentKeys: Object.keys(parsed).sort(),
    };
  }));
}

function ephemeralErrorFingerprint(error) {
  const candidate = error && typeof error === "object" ? error : {};
  const functions = typeof candidate.stack === "string"
    ? candidate.stack.split("\n").slice(1, 6).map((line) => {
      const match = /^\s*at\s+([^\s(]+)/u.exec(line);
      return match?.[1]?.replace(/[^a-zA-Z0-9_.<>-]/gu, "").slice(0, 100) ?? "anonymous";
    })
    : [];
  return {
    errorName: typeof candidate.name === "string"
      ? candidate.name.replace(/[^a-zA-Z0-9_-]/gu, "").slice(0, 80)
      : "unknown",
    functions,
  };
}

function completedCall(result, stage) {
  if (result.toolMessages?.length > 0) {
    throw harnessFailure("unexpected-write-request", {
      stage,
      tools: result.toolMessages.map((message) => {
        try {
          return JSON.parse(message.content).tool ?? "unknown";
        } catch {
          return "invalid";
        }
      }),
    });
  }
  if (result.agentRun?.run?.status !== "completed") {
    const failureMessage = result.agentRun?.run?.steps?.at(-1)?.errorMessage ?? "";
    const errorCode = result.assistantMessage?.errorCode ?? null;
    const failureKind = errorCode === "provider-unavailable"
      ? "provider-transport"
      : errorCode === "provider-rate-limited"
        ? "provider-rate-limit"
        : errorCode === "provider-error"
          ? "provider-response"
      : /parallel|more than one|exactly one|one tool request/iu.test(failureMessage)
      ? "multiple-tools"
      : /contract|arguments|valid json|schema/iu.test(failureMessage)
        ? "tool-arguments"
        : /without a final answer|provider steps/iu.test(failureMessage)
          ? "step-budget"
          : /cannot execute Research tools/iu.test(failureMessage)
            ? "research-gateway-missing"
            : /repeatedly violated.*tool policy/iu.test(failureMessage)
              ? "repeated-policy-violation"
              : /not available|unavailable/iu.test(failureMessage)
                ? "tool-unavailable"
                : "unclassified";
    throw harnessFailure("author-turn-did-not-complete", {
      stage,
      status: result.agentRun?.run?.status ?? "missing",
      errorCode,
      failureKind,
      researchAudit: result.ns608Diagnostics ?? [],
      ...(process.env.NS608_EPHEMERAL_DEBUG === "1"
        ? { providerTools: ephemeralProviderTools(result.ns608ProviderTrace ?? []) }
        : {}),
    });
  }
  return result;
}

function pendingWriteCall(result, stage, expectedTool) {
  if (result.agentRun?.run?.status !== "waiting-confirmation") {
    throw harnessFailure("write-did-not-wait-for-confirmation", {
      stage,
      status: result.agentRun?.run?.status ?? "missing",
    });
  }
  if (result.toolMessages?.length !== 1) {
    throw harnessFailure("unexpected-write-request-count", {
      stage,
      count: result.toolMessages?.length ?? 0,
    });
  }
  let tool = "invalid";
  try {
    tool = JSON.parse(result.toolMessages[0].content).tool ?? "invalid";
  } catch {
    // Keep malformed content private and expose only the classification.
  }
  if (tool !== expectedTool) {
    throw harnessFailure("unexpected-write-request", { stage, expectedTool, actualTool: tool });
  }
  return result.toolMessages[0];
}

function completedConfirmation(result, stage) {
  let phase = "invalid-result";
  try {
    if (!result || typeof result !== "object") {
      throw harnessFailure("confirmation-result-missing", { stage });
    }
    phase = "continuation-scan";
    const continuationMessages = Array.isArray(result.continuationMessages)
      ? result.continuationMessages
      : [];
    const continuationTools = [];
    for (const message of continuationMessages) {
      const parsed = parseContinuationWriteRequest(message);
      if (parsed) continuationTools.push(parsed.tool);
    }
    phase = "run-status";
    const status = result.agentRun?.run?.status ?? "missing";
    if (continuationTools.length > 0 || status !== "completed") {
      throw harnessFailure("confirmation-continuation-did-not-complete", {
        stage,
        status,
        continuationTools,
      });
    }
    return result;
  } catch (error) {
    if (error && typeof error === "object" && typeof error.ns608Code === "string") throw error;
    throw harnessFailure("confirmation-grader-failed", { stage, phase });
  }
}

async function runCrossLanguageTrial(task, trialIndex, environment) {
  const japaneseDatabase = await environment.repository.createResearchDatabase({
    name: `Winter gate Japanese records ${trialIndex}`,
  });
  const englishDatabase = await environment.repository.createResearchDatabase({
    name: `Winter gate English records ${trialIndex}`,
  });
  const japanese = await importGeneratedTextSource(environment, japaneseDatabase.database.id, {
    fileName: "winter-gate-ja.txt",
    displayName: "Winter gate Japanese ledger",
    language: "ja",
    text: [
      "冬至祭礼記録",
      "雨守は冬至に西門を守る。開門前に青銅の鈴を三度鳴らす。",
      "鐘の音が終わるまで門衛は門扉に触れてはならない。",
    ].join("\n"),
  });
  const english = await importGeneratedTextSource(environment, englishDatabase.database.id, {
    fileName: "winter-gate-en.txt",
    displayName: "Winter gate English ledger",
    language: "en",
    text: [
      "Winter Solstice Gate Ledger",
      "At the west gate, the rain warden rings the bronze bell three times before opening.",
      "The gate guard must not touch the doors until the ringing has ended.",
    ].join("\n"),
  });
  const trace = createWorkshopTrace(task.id, trialIndex);
  const session = await createLiveSession(environment, `Cross-language continuity ${trialIndex}`, [
    japaneseDatabase.database.id,
    englishDatabase.database.id,
  ]);
  const calls = [];
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    1,
    "我在写冬至开门仪式。先只讨论哪些细节值得核对，这一步不要查资料，也不要改 Codex。",
  ), "turn-1"));
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    2,
    "现在请分别查日文和英文原文：雨守在什么时候守哪座门，开门前具体做什么？",
  ), "turn-2"));
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    3,
    "继续核对英文原文怎么写这些动作。日文和英文若有差别就明确说，不要替我抹平。",
  ), "turn-3"));
  const finalCall = completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    4,
    "现在整理成一段创作备忘：只写能确认的结论，并保留日文和英文原文依据，不要创建或更新设定。",
  ), "turn-4");
  calls.push(finalCall);

  const citations = calls.flatMap((call) => call.researchEvidence?.citations ?? []);
  const finalText = finalCall.responseText ?? "";
  const finalFactCoverage = evaluateCrossLanguageFactCoverage(finalText);
  const entries = await environment.repository.listCodexEntries(environment.series.manifest.id);
  return {
    trace,
    outcome: {
      authorTurns: 4,
      japaneseCitationExact: exactResearchCitationPresent(citations, japanese),
      englishCitationExact: exactResearchCitationPresent(citations, english),
      citationCount: new Set(citations.map((citation) => [
        citation.sourceId,
        citation.chunkId,
        citation.chunkHash,
      ].join(":"))).size,
      finalFactCoverage,
      codexEntryCount: entries.length,
    },
    metrics: {
      authorTurns: 4,
      researchToolCalls: trace.events.filter((event) => event.type === "tool-call" && event.effect === "read").length,
      citationCount: citations.length,
      ...(process.env.NS608_EPHEMERAL_DEBUG === "1" ? {
        providerTools: calls.flatMap((call, index) =>
          ephemeralProviderTools(call.ns608ProviderTrace ?? [])
            .map((tool) => ({ turn: index + 1, ...tool }))),
      } : {}),
    },
  };
}

function distinctCitationCount(citations) {
  return new Set(citations.map((citation) => [
    citation.sourceId,
    citation.chunkId,
    citation.chunkHash,
  ].join(":"))).size;
}

async function runBalancedTriggeringTrial(task, trialIndex, environment) {
  const database = await environment.repository.createResearchDatabase({
    name: `Qinglan crossing records ${trialIndex}`,
  });
  const source = await importGeneratedTextSource(environment, database.database.id, {
    fileName: "qinglan-curfew-bell.txt",
    displayName: "Qinglan crossing curfew record",
    language: "zh-Hans",
    text: [
      "青岚渡关门钟记录",
      "青岚渡每晚在子时前两刻敲响关门钟，共三次。",
      "第三声落下后，守门人才关闭东门。",
    ].join("\n"),
  });
  const trace = createWorkshopTrace(task.id, trialIndex);
  const session = await createLiveSession(environment, `Balanced triggering ${trialIndex}`, [
    database.database.id,
  ]);
  const calls = [];
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    1,
    "我在写关城门前的紧张气氛。先讨论两种节奏方向，不查资料，也不要创建或更新设定。",
  ), "turn-1"));
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    2,
    "不要巡逻队那个方向，保留远处钟声逼近的感觉。只说怎么控制句子节奏，还是不要查。",
  ), "turn-2"));
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    3,
    "按这个方向写一小段试稿，不需要事实核对，也不要记入 Codex。",
  ), "turn-3"));
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    4,
    "简短总结刚才确定的写法，这一步不要调用任何资料或设定工具。",
  ), "turn-4"));
  const finalCall = completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    5,
    "现在请查启用的资料库，确认青岚渡关门钟在什么时刻敲、总共敲几次。只给有出处的事实，不要写入 Codex。",
  ), "turn-5");
  calls.push(finalCall);

  const citations = calls.flatMap((call) => call.researchEvidence?.citations ?? []);
  const entries = await environment.repository.listCodexEntries(environment.series.manifest.id);
  return {
    trace,
    outcome: {
      authorTurns: 5,
      citationExact: exactResearchCitationPresent(citations, source),
      citationCount: distinctCitationCount(citations),
      factCoverage: evaluateBalancedResearchFactCoverage(finalCall.responseText ?? ""),
      codexEntryCount: entries.length,
    },
    metrics: {
      authorTurns: 5,
      researchToolCalls: trace.events.filter((event) =>
        event.type === "tool-call" && event.effect === "read").length,
      citationCount: citations.length,
      codexEntryCount: entries.length,
    },
  };
}

async function runConflictingSourcesTrial(task, trialIndex, environment) {
  const japaneseDatabase = await environment.repository.createResearchDatabase({
    name: `White night Japanese record ${trialIndex}`,
  });
  const englishDatabase = await environment.repository.createResearchDatabase({
    name: `White night merchant ledger ${trialIndex}`,
  });
  const japanese = await importGeneratedTextSource(environment, japaneseDatabase.database.id, {
    fileName: "white-night-ja.txt",
    displayName: "White night Japanese ritual record",
    language: "ja",
    text: [
      "白夜送り記録",
      "儀礼名「白夜送り」は冬至の翌朝に北門で行われる。儀礼中、門は開かれない。",
      "ここで「送り」は夜を見送る呼称であり、人の追放を意味しない。",
    ].join("\n"),
  });
  const english = await importGeneratedTextSource(environment, englishDatabase.database.id, {
    fileName: "white-night-en.txt",
    displayName: "White night English merchant ledger",
    language: "en",
    text: [
      "White Night Departure Merchant Ledger",
      "The White Night Departure was scheduled for the evening before the winter solstice.",
      "The north gate opened once for salt wagons.",
      "Departure is a literal ritual label and does not prove that anyone was exiled.",
    ].join("\n"),
  });
  const trace = createWorkshopTrace(task.id, trialIndex);
  const session = await createLiveSession(environment, `Conflicting sources ${trialIndex}`, [
    japaneseDatabase.database.id,
    englishDatabase.database.id,
  ]);
  const calls = [];
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    1,
    "我在写白夜送り仪式。先告诉我核对冲突资料时应该分哪些问题，这一步不要查资料，也不要改 Codex。",
  ), "turn-1"));
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    2,
    "现在查日文记录：仪式日期、北门开没开，以及‘送り’在原文里是什么意思。",
  ), "turn-2"));
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    3,
    "再查英文商人账簿，同样核对日期、门和 departure。不要用日文结果替英文来源说话。",
  ), "turn-3"));
  calls.push(completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    4,
    "把两份来源的冲突逐项并列。尤其不要因为送り或 departure 就推断有人被放逐；只在确实缺相邻原文时继续查。",
  ), "turn-4"));
  const finalCall = completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    5,
    "收束成创作核对单：分别写日文记录、英文记录、明确冲突，以及词义不能推出什么。保留两边依据，不要写入 Codex。",
  ), "turn-5");
  calls.push(finalCall);

  const citations = calls.flatMap((call) => call.researchEvidence?.citations ?? []);
  const entries = await environment.repository.listCodexEntries(environment.series.manifest.id);
  return {
    trace,
    outcome: {
      authorTurns: 5,
      japaneseCitationExact: exactResearchCitationPresent(citations, japanese),
      englishCitationExact: exactResearchCitationPresent(citations, english),
      citationCount: distinctCitationCount(citations),
      factCoverage: evaluateConflictFactCoverage(finalCall.responseText ?? ""),
      codexEntryCount: entries.length,
    },
    metrics: {
      authorTurns: 5,
      researchToolCalls: trace.events.filter((event) =>
        event.type === "tool-call" && event.effect === "read").length,
      citationCount: citations.length,
      codexEntryCount: entries.length,
    },
  };
}

async function assertReplayBlocked(environment, sessionId, message, tool) {
  const repeated = await requestJson(
    environment.baseUrl,
    "POST",
    `/api/v1/series/${environment.series.manifest.id}/workshop/sessions/${sessionId}/messages/${message.id}/tools/${tool}/execute`,
    { confirm: true },
    409,
  );
  if (repeated.code !== "WORKSHOP_TOOL_ALREADY_EXECUTED") {
    throw harnessFailure("successful-write-replay-not-blocked", { tool, code: repeated.code ?? "missing" });
  }
}

async function runCodexCorrectionTrial(task, trialIndex, environment) {
  let stage = "session-create";
  try {
  const trace = createWorkshopTrace(task.id, trialIndex);
  const session = await createLiveSession(environment, `Natural correction ${trialIndex}`);
  stage = "turn-1";
  completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    1,
    "先聊聊一个叫沈遥的守门人，不要创建或修改任何设定。",
  ), "turn-1");
  stage = "turn-2";
  completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    2,
    "她需要一个清楚但不夸张的视觉特征，先讨论两个方向。",
  ), "turn-2");
  stage = "turn-3";
  completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    3,
    "不要红发，改成黑发；也不要家庭仇恨。",
  ), "turn-3");
  stage = "turn-4";
  completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    4,
    "写一小段她第一次在城门出现的文字，暂时不要记入 Codex。",
  ), "turn-4");

  stage = "turn-5";
  const createCall = await runLiveTurn(
    environment,
    trace,
    session.id,
    5,
    "好，把已经确定的内容记录成沈遥的人物条目。只记录姓名和简介，不要新增其它字段。",
  );
  const createMessage = pendingWriteCall(createCall, "turn-5", "codex.create_entry");
  if ((await environment.repository.listCodexEntries(environment.series.manifest.id)).length !== 0) {
    throw harnessFailure("unconfirmed-create-mutated-authority");
  }
  stage = "create-confirmation";
  completedConfirmation(await confirmLiveWrite(
    environment,
    trace,
    session.id,
    5,
    createMessage,
    "codex.create_entry",
  ), "create-confirmation");
  stage = "create-replay";
  await assertReplayBlocked(environment, session.id, createMessage, "codex.create_entry");

  stage = "turn-6";
  completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    6,
    "先讨论她怕水会不会太直白，这一步不要更新条目。",
  ), "turn-6");
  stage = "pre-update-authority-read";
  const beforeUpdate = (await environment.repository.listCodexEntries(environment.series.manifest.id))[0];
  stage = "turn-7";
  const updateCall = await runLiveTurn(
    environment,
    trace,
    session.id,
    7,
    "那就不要怕水，改成对钟声异常敏感。只把这个变化更新到她的简介。",
  );
  const updateMessage = pendingWriteCall(updateCall, "turn-7", "codex.update_entry");
  const stillUnchanged = (await environment.repository.listCodexEntries(environment.series.manifest.id))[0];
  if (!beforeUpdate || stillUnchanged?.revision !== beforeUpdate.revision) {
    throw harnessFailure("unconfirmed-update-mutated-authority");
  }
  stage = "update-confirmation";
  completedConfirmation(await confirmLiveWrite(
    environment,
    trace,
    session.id,
    7,
    updateMessage,
    "codex.update_entry",
  ), "update-confirmation");
  stage = "update-replay";
  await assertReplayBlocked(environment, session.id, updateMessage, "codex.update_entry");

  stage = "turn-8";
  completedCall(await runLiveTurn(
    environment,
    trace,
    session.id,
    8,
    "总结刚才已经完成的工作，不要再改动任何设定。",
  ), "turn-8");
  stage = "final-authority-read";
  const entries = await environment.repository.listCodexEntries(environment.series.manifest.id);
  const description = entries[0]?.description ?? "";
  return {
    trace,
    outcome: {
      authorTurns: 8,
      entryCount: entries.length,
      name: entries[0]?.metadata.name ?? null,
      descriptionCoverage: {
        keepsBlackHair: description.includes("黑发"),
        keepsGatekeeperRole: description.includes("守门"),
        keepsBellSensitivity: description.includes("钟声"),
        omitsRedHair: !description.includes("红发"),
        omitsFamilyFeud: !description.includes("家庭仇恨"),
        omitsFearOfWater: !description.includes("怕水"),
      },
      replayBlockedCount: 2,
    },
    metrics: {
      authorTurns: 8,
      confirmedWrites: 2,
      replayBlockedCount: 2,
      codexEntryCount: entries.length,
    },
  };
  } catch (error) {
    if (error && typeof error === "object" && typeof error.ns608Code === "string") {
      const details = error.ns608PublicDetails && typeof error.ns608PublicDetails === "object"
        ? { ...error.ns608PublicDetails }
        : {};
      if (!("stage" in details)) details.stage = stage;
      throw harnessFailure(error.ns608Code, details);
    }
    throw harnessFailure("codex-scenario-stage-failed", {
      stage,
      ...(process.env.NS608_EPHEMERAL_DEBUG === "1"
        ? { errorFingerprint: ephemeralErrorFingerprint(error) }
        : {}),
    });
  }
}

async function runSelectedScenario() {
  const selected = selectedScenario === "cross-language"
    ? { task: crossLanguageTask, run: runCrossLanguageTrial }
    : selectedScenario === "codex-correction"
      ? { task: codexCorrectionTask, run: runCodexCorrectionTrial }
      : selectedScenario === "balanced-triggering"
        ? { task: balancedTriggeringTask, run: runBalancedTriggeringTrial }
        : selectedScenario === "conflicting-sources"
          ? { task: conflictingSourcesTask, run: runConflictingSourcesTrial }
          : null;
  if (!selected) {
    throw harnessFailure("scenario-not-implemented", { scenario: selectedScenario });
  }
  const safetyRuns = [];
  const suite = await runWorkshopBehaviorSuite({
    tasks: [selected.task],
    trialsPerTask,
    classifyTrialError: (error) => publicHarnessFailure(error),
    async runTrial(task, trialIndex) {
      try {
        const run = await withTemporaryRealProviderEnvironment({
          sourceLibraryRoot,
          seriesTitle: `NS-608 ${selectedScenario} trial ${trialIndex}`,
        }, (environment) => selected.run(task, trialIndex, environment));
        safetyRuns.push(run.safety);
        return run.result;
      } catch (error) {
        const failure = publicHarnessFailure(error);
        if (failure.safety) safetyRuns.push(failure.safety);
        if (error && typeof error === "object" && typeof error.ns608Code === "string") throw error;
        throw harnessFailure("scenario-trial-failed", { scenario: selectedScenario, trialIndex });
      }
    },
  });
  return {
    suite: publicSuiteSummary(suite),
    safety: {
      trials: safetyRuns.length,
      allSourceLibrariesUnchanged: safetyRuns.every((item) => item.sourceLibraryUnchanged),
      allSystemSecretPointersConfined: safetyRuns.every((item) => item.systemSecretPointerConfined),
    },
  };
}

try {
  const run = preflight ? await runPreflight() : await runSelectedScenario();
  const summary = assertPublicSummarySafe({
    schemaVersion: 1,
    passed: preflight ? true : run.suite.passed,
    provider: "deepseek",
    model: NS608_TARGET_MODEL,
    ...(preflight ? { ...run.result, ...run.safety } : run),
  }, [sourceLibraryRoot]);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.passed) process.exitCode = 1;
} catch (error) {
  const summary = assertPublicSummarySafe({
    schemaVersion: 1,
    passed: false,
    provider: "deepseek",
    model: NS608_TARGET_MODEL,
    failure: publicHarnessFailure(error),
  }, [sourceLibraryRoot]);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = 1;
}
