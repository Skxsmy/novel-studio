import path from "node:path";
import {
  NS608_TARGET_MODEL,
  assertPublicSummarySafe,
  harnessFailure,
  publicHarnessFailure,
  requestJson,
  withTemporaryRealProviderEnvironment,
} from "./harness/ns-608-live-workshop.mjs";

const preflight = process.argv.includes("--preflight");
if (!preflight) throw new Error("NS-608 real author scenarios are not implemented yet; use --preflight");

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

try {
  const run = await runPreflight();
  const summary = assertPublicSummarySafe({
    schemaVersion: 1,
    passed: true,
    provider: "deepseek",
    model: NS608_TARGET_MODEL,
    ...run.result,
    ...run.safety,
  }, [sourceLibraryRoot]);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
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
