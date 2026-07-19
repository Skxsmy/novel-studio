import path from "node:path";
import {
  NS608_TARGET_MODEL,
  assertPublicSummarySafe,
  createLiveSession,
  evaluateCrossLanguageFactCoverage,
  exactResearchCitationPresent,
  harnessFailure,
  importGeneratedTextSource,
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
    const failureKind = /parallel|more than one|exactly one|one tool request/iu.test(failureMessage)
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
      errorCode: result.assistantMessage?.errorCode ?? null,
      failureKind,
      researchAudit: result.ns608Diagnostics ?? [],
      ...(process.env.NS608_EPHEMERAL_DEBUG === "1"
        ? { providerTools: ephemeralProviderTools(result.ns608ProviderTrace ?? []) }
        : {}),
    });
  }
  return result;
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

async function runSelectedScenario() {
  if (selectedScenario !== "cross-language") {
    throw harnessFailure("scenario-not-implemented", { scenario: selectedScenario });
  }
  const safetyRuns = [];
  const suite = await runWorkshopBehaviorSuite({
    tasks: [crossLanguageTask],
    trialsPerTask,
    async runTrial(task, trialIndex) {
      try {
        const run = await withTemporaryRealProviderEnvironment({
          sourceLibraryRoot,
          seriesTitle: `NS-608 cross-language trial ${trialIndex}`,
        }, (environment) => runCrossLanguageTrial(task, trialIndex, environment));
        safetyRuns.push(run.safety);
        return run.result;
      } catch (error) {
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
