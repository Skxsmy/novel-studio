import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EmbeddingRouter, MockProvider, ProviderRegistry } from "@novel-studio/ai";
import { ResearchSourcePropertiesSchema } from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { buildApp } from "../apps/server/dist/app.js";
import { parseResearchFile } from "../apps/server/dist/researchParsers.js";

const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-ns-607-browser-"));
const repository = new ProjectRepository(libraryRoot);
await repository.initialize();
const series = await repository.createSeries({ title: "NS-607 Browser Acceptance" });
const japaneseDatabase = await repository.createResearchDatabase({ name: "Japanese ritual references" });
const englishDatabase = await repository.createResearchDatabase({ name: "English harbor references" });

async function importText(databaseId, fileName, language, text) {
  const bytes = Buffer.from(text, "utf8");
  const parsed = await parseResearchFile({
    contentBase64: bytes.toString("base64"),
    fileName,
    mediaType: "text/plain",
    sizeBytes: bytes.byteLength,
  });
  await repository.importResearchSource(databaseId, {
    kind: parsed.parsed.kind,
    mediaType: "text/plain",
    originalFileName: fileName,
    originalBytes: parsed.bytes,
    sizeBytes: parsed.bytes.byteLength,
    contentHash: parsed.contentHash,
    properties: ResearchSourcePropertiesSchema.parse({
      displayName: fileName,
      declaredLanguage: language,
      aiPermission: "allowed",
    }),
    origin: { type: "file" },
    content: {
      title: parsed.parsed.title,
      parserName: parsed.parsed.parserName,
      parserVersion: parsed.parsed.parserVersion,
      warnings: parsed.parsed.warnings,
      sections: parsed.parsed.sections,
      blocks: parsed.parsed.blocks,
    },
  });
}

await importText(
  japaneseDatabase.database.id,
  "ame-mori-ja.txt",
  "ja",
  "雨守は冬至に西門を守る。青銅の鈴を三度鳴らしてから門を開く。",
);
await importText(
  englishDatabase.database.id,
  "harbor-bell-en.txt",
  "en",
  "The harbor bell rings three times at low tide. The silver key rests beneath the seventh stair.",
);

const firstSession = await repository.createWorkshopSession(series.manifest.id, {
  kind: "chat",
  title: "Ritual continuity",
});
const secondSession = await repository.createWorkshopSession(series.manifest.id, {
  kind: "chat",
  title: "Cancellation check",
});

function toolResult(name, argumentsValue) {
  return {
    text: "",
    reasoningContent: "",
    reasoningOutputKind: "none",
    toolCalls: [{ id: randomUUID(), name, arguments: JSON.stringify(argumentsValue) }],
    finishReason: "tool_calls",
    usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
    rawResponseText: JSON.stringify({ tool: name }),
  };
}

function answer(text) {
  return {
    text,
    reasoningContent: "",
    reasoningOutputKind: "none",
    toolCalls: [],
    finishReason: "stop",
    usage: { inputTokens: 24, outputTokens: 12, totalTokens: 36 },
    rawResponseText: JSON.stringify({ answer: text }),
  };
}

function lastToolResult(request) {
  const message = request.history?.at(-1);
  assert.equal(message?.role, "tool");
  return JSON.parse(message.content);
}

class BrowserFixtureProvider extends MockProvider {
  async *streamChat(request) {
    const userRequest = request.prompt.user;
    if (userRequest.includes("停止测试")) {
      await new Promise((resolve, reject) => {
        const abort = () => {
          const error = new Error("Browser fixture call stopped by author");
          error.name = "AbortError";
          reject(error);
        };
        if (request.abortSignal?.aborted) abort();
        else request.abortSignal?.addEventListener("abort", abort, { once: true });
      });
      return;
    }

    const history = request.history ?? [];
    let result;
    if (history.length === 0) {
      result = toolResult("research.search", {
        query: "雨守は冬至に西門を守る",
        databaseIds: [japaneseDatabase.database.id],
        mode: "exact",
      });
    } else if (history.length === 2) {
      const citation = lastToolResult(request).results?.[0];
      assert(citation, "Browser fixture search returned no citation");
      result = toolResult("research.open_passage", {
        databaseId: citation.researchDatabaseId,
        sourceId: citation.sourceId,
        chunkId: citation.chunkId,
        sourceRevision: citation.sourceRevision,
        chunkHash: citation.chunkHash,
      });
    } else {
      assert(lastToolResult(request).passages?.some((passage) =>
        String(passage.originalText).includes("雨守は冬至に西門を守る")));
      result = answer("资料确认：雨守在冬至守卫西门，开门前青铜铃应响三次。");
    }
    if (result.text) yield { type: "answer-delta", text: result.text };
    yield { type: "done", result };
  }
}

const providerRegistry = new ProviderRegistry();
providerRegistry.register(new BrowserFixtureProvider());
const app = await buildApp({
  libraryRoot,
  webRoot: path.resolve("apps", "web", "dist"),
  providerRegistry,
  embeddingRouter: new EmbeddingRouter(),
  version: "0.1.0-ns607-browser",
  commit: "ns607-browser-fixture",
  workspaceRoot: path.resolve("."),
});
const profileResponse = await app.inject({
  method: "POST",
  url: "/api/v1/ai/model-profiles",
  payload: {
    title: "NS-607 browser model",
    provider: "mock",
    model: "mock-continuity-v1",
  },
});
assert.equal(profileResponse.statusCode, 201, profileResponse.payload);

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close().catch(() => undefined);
  await rm(libraryRoot, { recursive: true, force: true });
}
process.once("SIGINT", () => void close().finally(() => process.exit(0)));
process.once("SIGTERM", () => void close().finally(() => process.exit(0)));

await app.listen({ host: "127.0.0.1", port: 4317 });
process.stdout.write(`${JSON.stringify({
  ok: true,
  url: "http://127.0.0.1:4317/",
  temporaryLibraryRoot: true,
  seriesId: series.manifest.id,
  firstSessionId: firstSession.id,
  secondSessionId: secondSession.id,
  japaneseDatabaseId: japaneseDatabase.database.id,
  englishDatabaseId: englishDatabase.database.id,
})}\n`);
