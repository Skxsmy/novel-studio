import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EmbeddingRouter,
  MockProvider,
  ProviderRegistry,
} from "@novel-studio/ai";
import { ResearchSourcePropertiesSchema } from "@novel-studio/contracts";
import {
  ProjectRepository,
  researchDatabaseRoot,
} from "@novel-studio/storage";
import { buildApp } from "../apps/server/dist/app.js";
import { parseResearchFile } from "../apps/server/dist/researchParsers.js";

const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ns-607-harness-"));
const forbiddenLibraryRoot = path.resolve("data", "library");
assert.notEqual(path.resolve(root), forbiddenLibraryRoot);

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

function toolResult(name, argumentsValue) {
  return (request) => ({
    text: "",
    reasoningContent: "",
    reasoningOutputKind: "none",
    toolCalls: [{
      id: randomUUID(),
      name,
      arguments: JSON.stringify(
        typeof argumentsValue === "function" ? argumentsValue(request) : argumentsValue,
      ),
    }],
    finishReason: "tool_calls",
    usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
    rawResponseText: JSON.stringify({ tool: name }),
  });
}

function lastToolResult(request) {
  const message = request.history?.at(-1);
  assert.equal(message?.role, "tool", "Expected the previous tool result in Provider history");
  return JSON.parse(message.content);
}

class ScriptedProvider extends MockProvider {
  requests = [];
  stepIndex = 0;

  constructor(steps, { nativeToolCalls = true } = {}) {
    super();
    this.steps = steps;
    this.chatCapabilities = { ...this.chatCapabilities, nativeToolCalls };
  }

  remainingSteps() {
    return this.steps.length - this.stepIndex;
  }

  assertExhausted() {
    assert.equal(this.remainingSteps(), 0, `${this.remainingSteps()} Provider step(s) were not consumed`);
  }

  async waitForRequests(count, timeoutMs = 2_000) {
    const startedAt = Date.now();
    while (this.requests.length < count) {
      assert(Date.now() - startedAt < timeoutMs, `Timed out waiting for ${count} Provider requests`);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  async *streamChat(request) {
    const step = this.steps[this.stepIndex];
    assert(step, `Unexpected Provider request ${this.stepIndex + 1}`);
    this.stepIndex += 1;
    this.requests.push(request);
    await step.expect?.(request);
    if (step.waitForAbort) {
      await new Promise((resolve, reject) => {
        const abort = () => {
          const error = new Error("Scripted Provider request aborted");
          error.name = "AbortError";
          reject(error);
        };
        if (request.abortSignal?.aborted) abort();
        else request.abortSignal?.addEventListener("abort", abort, { once: true });
      });
    }
    if (step.error) throw step.error;
    const result = typeof step.result === "function" ? step.result(request) : step.result;
    assert(result, `Provider step "${step.name}" has no result`);
    if (result.text) yield { type: "answer-delta", text: result.text };
    yield { type: "done", result };
  }
}

function researchTurnSteps({ answerText, databaseId, marker, query, name }) {
  return [
    {
      name: `${name}: search`,
      expect(request) {
        assert(request.tools?.some((tool) => tool.name === "research.search"));
        assert(!JSON.stringify(request.prompt).includes(marker));
        assert(!JSON.stringify(request.contextBundle).includes(marker));
      },
      result: toolResult("research.search", {
        query,
        databaseIds: [databaseId],
        mode: "exact",
      }),
    },
    {
      name: `${name}: open`,
      result: toolResult("research.open_passage", (request) => {
        const citation = lastToolResult(request).results?.[0];
        assert(citation, `${name} search returned no citation`);
        assert(String(citation.originalText).includes(marker), `${name} did not retrieve the expected original text`);
        return {
          databaseId: citation.researchDatabaseId,
          sourceId: citation.sourceId,
          chunkId: citation.chunkId,
          sourceRevision: citation.sourceRevision,
          chunkHash: citation.chunkHash,
        };
      }),
    },
    {
      name: `${name}: answer`,
      expect(request) {
        const opened = lastToolResult(request).passages ?? [];
        assert(opened.some((passage) => String(passage.originalText).includes(marker)));
      },
      result: answer(answerText),
    },
  ];
}

async function importText(repository, databaseId, { fileName, language, text }) {
  const bytes = Buffer.from(text, "utf8");
  const parsed = await parseResearchFile({
    contentBase64: bytes.toString("base64"),
    fileName,
    mediaType: "text/plain",
    sizeBytes: bytes.byteLength,
  });
  return repository.importResearchSource(databaseId, {
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

async function authorityHash(databaseRoot) {
  const digest = createHash("sha256");
  async function visit(directory, relativeDirectory = "") {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.name !== ".studio")
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolutePath, relativePath);
      else if (entry.isFile()) {
        digest.update(relativePath, "utf8");
        digest.update("\0", "utf8");
        digest.update(await readFile(absolutePath));
        digest.update("\0", "utf8");
      } else {
        assert.fail(`Unexpected Research authority entry: ${relativePath}`);
      }
    }
  }
  await visit(databaseRoot);
  return digest.digest("hex");
}

async function startServer(provider) {
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(provider);
  const app = await buildApp({
    libraryRoot: root,
    providerRegistry,
    embeddingRouter: new EmbeddingRouter(),
  });
  const baseUrl = await app.listen({ host: "127.0.0.1", port: 0 });
  return { app, baseUrl };
}

async function request(baseUrl, method, pathname, payload, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: payload === undefined ? undefined : { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const raw = await response.text();
  let body = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  assert.equal(response.status, expectedStatus, `${method} ${pathname}: ${response.status} ${raw}`);
  return body;
}

async function createSession(baseUrl, seriesId, kind, title, databaseIds) {
  const session = await request(
    baseUrl,
    "POST",
    `/api/v1/series/${seriesId}/workshop/sessions`,
    { kind, title },
    201,
  );
  assert.deepEqual(session.activeResearchDatabaseIds, []);
  return request(
    baseUrl,
    "PUT",
    `/api/v1/series/${seriesId}/workshop/sessions/${session.id}`,
    { activeResearchDatabaseIds: databaseIds },
  );
}

async function runTurn(baseUrl, seriesId, sessionId, profileId, mode, userRequest) {
  return request(
    baseUrl,
    "POST",
    `/api/v1/series/${seriesId}/workshop/sessions/${sessionId}/calls`,
    { mode, userRequest, modelProfileId: profileId },
  );
}

const japaneseFacts = [
  { marker: "雨守は冬至に西門を守る", query: "雨守は冬至に西門を守る", answer: "雨守守卫西门的时间应固定在冬至。" },
  { marker: "青銅の鈴を三度鳴らす", query: "青銅の鈴を三度鳴らす", answer: "进入仪式前应让青铜铃响三次。" },
  { marker: "白い椿は月のない夜に咲く", query: "白い椿は月のない夜に咲く", answer: "白椿只应在无月之夜开放。" },
];
const englishFacts = [
  { marker: "Harbor bell rings three times at low tide", query: "Harbor bell rings three times at low tide", answer: "港钟应在低潮时敲响三次。" },
  { marker: "silver key rests beneath the seventh stair", query: "silver key rests beneath the seventh stair", answer: "银钥匙应藏在第七级台阶下面。" },
  { marker: "north archive closes during eclipses", query: "north archive closes during eclipses", answer: "北档案馆在日食期间必须关闭。" },
];

let activeServer = null;
try {
  const repository = new ProjectRepository(root);
  await repository.initialize();
  const series = await repository.createSeries({ title: "NS-607 多语言作者工作流" });
  const japaneseDatabase = await repository.createResearchDatabase({ name: "Japanese folklore references" });
  const englishDatabase = await repository.createResearchDatabase({ name: "English setting references" });
  await importText(repository, japaneseDatabase.database.id, {
    fileName: "ritual-notes-ja.txt",
    language: "ja",
    text: japaneseFacts.map((fact) => fact.marker).join("。\n\n"),
  });
  await importText(repository, englishDatabase.database.id, {
    fileName: "harbor-notes-en.txt",
    language: "en",
    text: englishFacts.map((fact) => fact.marker).join(".\n\n"),
  });
  const databaseRoots = [japaneseDatabase, englishDatabase].map((database) =>
    researchDatabaseRoot(repository.libraryRoot, database.database.id));
  const authorityBefore = await Promise.all(databaseRoots.map(authorityHash));

  const primarySteps = [
    ...japaneseFacts.flatMap((fact, index) => researchTurnSteps({
      answerText: fact.answer,
      databaseId: japaneseDatabase.database.id,
      marker: fact.marker,
      query: fact.query,
      name: `Chinese author Japanese session turn ${index + 1}`,
    })),
    ...englishFacts.flatMap((fact, index) => researchTurnSteps({
      answerText: fact.answer,
      databaseId: englishDatabase.database.id,
      marker: fact.marker,
      query: fact.query,
      name: `Chinese author English session turn ${index + 1}`,
    })),
    ...researchTurnSteps({
      answerText: "Agent 已核对雨守的冬至职责。",
      databaseId: japaneseDatabase.database.id,
      marker: japaneseFacts[0].marker,
      query: japaneseFacts[0].query,
      name: "Agent turn 1",
    }),
    ...researchTurnSteps({
      answerText: "Agent 已核对港钟在低潮时敲三次。",
      databaseId: englishDatabase.database.id,
      marker: englishFacts[0].marker,
      query: englishFacts[0].query,
      name: "Agent turn 2",
    }),
    {
      name: "Agent turn 3 search before write",
      result: toolResult("research.search", {
        query: japaneseFacts[0].query,
        databaseIds: [japaneseDatabase.database.id],
        mode: "exact",
      }),
    },
    {
      name: "Agent turn 3 open before write",
      result: toolResult("research.open_passage", (requestValue) => {
        const citation = lastToolResult(requestValue).results?.[0];
        assert(citation);
        return {
          databaseId: citation.researchDatabaseId,
          sourceId: citation.sourceId,
          chunkId: citation.chunkId,
          sourceRevision: citation.sourceRevision,
          chunkHash: citation.chunkHash,
        };
      }),
    },
    {
      name: "Agent turn 3 requests confirmed Codex write",
      expect(requestValue) {
        assert(lastToolResult(requestValue).passages?.some((passage) =>
          String(passage.originalText).includes(japaneseFacts[0].marker)));
      },
      result: toolResult("codex.create_entry", {
        message: "已根据资料准备雨守条目，等待作者确认。",
        draft: {
          categoryId: "character",
          name: "雨守",
          aliases: [],
          description: "冬至时守卫西门的人。",
          details: [],
          research: "来自作者激活的日文资料库。",
        },
      }),
    },
    { name: "Agent confirmed-write continuation", result: answer("雨守条目已经写入 Codex。") },
    { name: "Agent turn 4", result: answer("这四轮任务已经完成，可以继续处理下一处设定。") },
    {
      name: "Cancellation search",
      result: toolResult("research.search", {
        query: japaneseFacts[1].query,
        databaseIds: [japaneseDatabase.database.id],
        mode: "exact",
      }),
    },
    { name: "Cancellation barrier", waitForAbort: true },
  ];
  const primaryProvider = new ScriptedProvider(primarySteps);
  activeServer = await startServer(primaryProvider);
  const { app: primaryApp, baseUrl: primaryBaseUrl } = activeServer;
  const profile = await request(primaryBaseUrl, "POST", "/api/v1/ai/model-profiles", {
    title: "NS-607 deterministic author model",
    provider: "mock",
    model: "mock-author-research-v1",
  }, 201);

  const japaneseSession = await createSession(
    primaryBaseUrl,
    series.manifest.id,
    "chat",
    "中文作者核对日文资料",
    [japaneseDatabase.database.id],
  );
  const englishSession = await createSession(
    primaryBaseUrl,
    series.manifest.id,
    "chat",
    "中文作者核对英文资料",
    [englishDatabase.database.id],
  );
  const chatResults = [];
  for (const [index, fact] of japaneseFacts.entries()) {
    const result = await runTurn(
      primaryBaseUrl,
      series.manifest.id,
      japaneseSession.id,
      profile.id,
      "general-chat",
      `第 ${index + 1} 轮：请核对日文资料并用中文回答，不要靠我写复杂提示词。`,
    );
    assert.equal(result.status, "succeeded", JSON.stringify({
      errorCode: result.assistantMessage?.errorCode,
      errorMessage: result.assistantMessage?.errorMessage,
      status: result.status,
      turn: `ja-${index + 1}`,
    }));
    assert(result.responseText.includes(fact.answer));
    assert(result.researchEvidence?.citations.length > 0);
    chatResults.push(result);
  }
  for (const [index, fact] of englishFacts.entries()) {
    const result = await runTurn(
      primaryBaseUrl,
      series.manifest.id,
      englishSession.id,
      profile.id,
      "general-chat",
      `第 ${index + 1} 轮：请核对英文资料并用中文回答当前写作问题。`,
    );
    assert.equal(result.status, "succeeded", JSON.stringify({
      errorCode: result.assistantMessage?.errorCode,
      errorMessage: result.assistantMessage?.errorMessage,
      status: result.status,
      turn: `en-${index + 1}`,
    }));
    assert(result.responseText.includes(fact.answer));
    assert(result.researchEvidence?.citations.length > 0);
    chatResults.push(result);
  }

  const listedSessions = await request(
    primaryBaseUrl,
    "GET",
    `/api/v1/series/${series.manifest.id}/workshop/sessions`,
  );
  assert.deepEqual(
    listedSessions.sessions.find((session) => session.id === japaneseSession.id).activeResearchDatabaseIds,
    [japaneseDatabase.database.id],
  );
  assert.deepEqual(
    listedSessions.sessions.find((session) => session.id === englishSession.id).activeResearchDatabaseIds,
    [englishDatabase.database.id],
  );

  const exactCitation = chatResults[0].researchEvidence.citations.find(
    (citation) => citation.relationship === "target",
  );
  assert(exactCitation);
  const exactQuery = new URLSearchParams({
    sourceRevision: exactCitation.sourceRevision,
    chunkId: exactCitation.chunkId,
    chunkHash: exactCitation.chunkHash,
  });
  const exactPage = await request(
    primaryBaseUrl,
    "GET",
    `/api/v1/research/databases/${exactCitation.researchDatabaseId}/sources/${exactCitation.sourceId}/content/blocks/${exactCitation.blockId}?${exactQuery}`,
  );
  assert(exactPage.blocks.some((block) => block.id === exactCitation.blockId));

  const branch = await request(
    primaryBaseUrl,
    "POST",
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${japaneseSession.id}/branch`,
    { sourceMessageId: chatResults[0].authorMessage.id, title: "雨守资料分支" },
    201,
  );
  assert.deepEqual(branch.session.activeResearchDatabaseIds, [japaneseDatabase.database.id]);
  await request(
    primaryBaseUrl,
    "POST",
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${branch.session.id}/archive`,
  );

  const agentSession = await createSession(
    primaryBaseUrl,
    series.manifest.id,
    "agent",
    "Agent 先查资料再写 Codex",
    [japaneseDatabase.database.id, englishDatabase.database.id],
  );
  const agentTurn1 = await runTurn(primaryBaseUrl, series.manifest.id, agentSession.id, profile.id, "agent", "先查日文资料，完成雨守时间核对。");
  const agentTurn2 = await runTurn(primaryBaseUrl, series.manifest.id, agentSession.id, profile.id, "agent", "再查英文资料，完成港钟时机核对。");
  assert.equal(agentTurn1.agentRun.run.status, "completed");
  assert.equal(agentTurn2.agentRun.run.status, "completed");
  const agentTurn3 = await runTurn(primaryBaseUrl, series.manifest.id, agentSession.id, profile.id, "agent", "查资料后准备雨守 Codex 条目，但不要未经确认写入。");
  assert.equal(agentTurn3.agentRun.run.status, "waiting-confirmation");
  assert.equal((await repository.listCodexEntries(series.manifest.id)).length, 0);
  const writeMessage = agentTurn3.toolMessages.find((message) =>
    JSON.parse(message.content).tool === "codex.create_entry");
  assert(writeMessage);
  const confirmed = await request(
    primaryBaseUrl,
    "POST",
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${agentSession.id}/messages/${writeMessage.id}/tools/codex.create_entry/execute`,
    { confirm: true },
    201,
  );
  assert.equal(confirmed.agentRun.run.status, "completed");
  assert.equal((await repository.listCodexEntries(series.manifest.id)).length, 1);
  const agentTurn4 = await runTurn(primaryBaseUrl, series.manifest.id, agentSession.id, profile.id, "agent", "确认写入后总结这次工作是否完成。");
  assert.equal(agentTurn4.agentRun.run.status, "completed");
  const agentDetail = await request(
    primaryBaseUrl,
    "GET",
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${agentSession.id}`,
  );
  assert.equal(agentDetail.messages.filter((message) => message.role === "author").length, 4);

  const cancellationSession = await createSession(
    primaryBaseUrl,
    series.manifest.id,
    "chat",
    "取消与重启",
    [japaneseDatabase.database.id],
  );
  const operationId = randomUUID();
  const cancellationRequestCount = primaryProvider.requests.length;
  const cancelledCallPromise = request(
    primaryBaseUrl,
    "POST",
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${cancellationSession.id}/calls`,
    {
      operationId,
      mode: "general-chat",
      userRequest: "先搜索资料；我发出停止时必须立即停止。",
      modelProfileId: profile.id,
    },
  );
  await primaryProvider.waitForRequests(cancellationRequestCount + 2);
  const blockedMutation = await fetch(
    `${primaryBaseUrl}/api/v1/series/${series.manifest.id}/workshop/sessions/${cancellationSession.id}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activeResearchDatabaseIds: [] }),
    },
  );
  assert.equal(blockedMutation.status, 409);
  await request(
    primaryBaseUrl,
    "POST",
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${cancellationSession.id}/calls/${operationId}/cancel`,
  );
  const cancelledCall = await cancelledCallPromise;
  assert.equal(cancelledCall.status, "cancelled");
  assert.equal(cancelledCall.researchEvidence, null);
  primaryProvider.assertExhausted();
  await primaryApp.close();
  activeServer = null;

  const retryProvider = new ScriptedProvider(researchTurnSteps({
    answerText: "重启后的新请求已完成，没有自动重放旧请求。",
    databaseId: japaneseDatabase.database.id,
    marker: japaneseFacts[1].marker,
    query: japaneseFacts[1].query,
    name: "Explicit retry after restart",
  }));
  activeServer = await startServer(retryProvider);
  const { app: retryApp, baseUrl: retryBaseUrl } = activeServer;
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(retryProvider.requests.length, 0);
  const cancelledDetail = await request(
    retryBaseUrl,
    "GET",
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${cancellationSession.id}`,
  );
  assert.deepEqual(cancelledDetail.session.activeResearchDatabaseIds, [japaneseDatabase.database.id]);
  assert.deepEqual(cancelledDetail.researchEvidence, []);
  const retryResult = await runTurn(
    retryBaseUrl,
    series.manifest.id,
    cancellationSession.id,
    profile.id,
    "general-chat",
    "这是重启后的新一轮，请重新查证青铜铃。",
  );
  assert.equal(retryResult.status, "succeeded");
  assert(retryResult.researchEvidence?.citations.length > 0);
  retryProvider.assertExhausted();
  await retryApp.close();
  activeServer = null;

  const unsupportedSteps = Array.from({ length: 4 }, (_, index) => ({
    name: `Unsupported ordinary chat ${index + 1}`,
    expect(requestValue) {
      assert.equal(requestValue.tools?.length ?? 0, 0);
    },
    result: answer(`没有原生工具时的普通对话 ${index + 1}`),
  }));
  const unsupportedProvider = new ScriptedProvider(unsupportedSteps, { nativeToolCalls: false });
  activeServer = await startServer(unsupportedProvider);
  const { app: unsupportedApp, baseUrl: unsupportedBaseUrl } = activeServer;
  const unsupportedSessions = [
    await createSession(unsupportedBaseUrl, series.manifest.id, "chat", "无工具模型会话一", [japaneseDatabase.database.id]),
    await createSession(unsupportedBaseUrl, series.manifest.id, "chat", "无工具模型会话二", [englishDatabase.database.id]),
  ];
  const unsupportedResults = [];
  for (const [sessionIndex, session] of unsupportedSessions.entries()) {
    for (let turnIndex = 0; turnIndex < 2; turnIndex += 1) {
      const result = await runTurn(
        unsupportedBaseUrl,
        series.manifest.id,
        session.id,
        profile.id,
        "general-chat",
        `无工具模型会话 ${sessionIndex + 1} 第 ${turnIndex + 1} 轮普通讨论。`,
      );
      assert.equal(result.status, "succeeded");
      assert.equal(result.researchEvidence, null);
      assert.deepEqual(
        await repository.listResearchToolAuditEvents(series.manifest.id, result.modelCallId),
        [],
      );
      unsupportedResults.push(result);
    }
  }
  unsupportedProvider.assertExhausted();

  const blockedJapaneseDeletion = await request(
    unsupportedBaseUrl,
    "GET",
    `/api/v1/research/databases/${japaneseDatabase.database.id}/deletion-blockers`,
  );
  assert.equal(blockedJapaneseDeletion.blocked, true);
  assert(blockedJapaneseDeletion.workshopReferences.some((reference) =>
    reference.sessionTitle === "雨守资料分支" && reference.sessionStatus === "archived"));

  const sessionsToDeactivate = [
    japaneseSession,
    englishSession,
    agentSession,
    cancellationSession,
    ...unsupportedSessions,
  ];
  for (const session of sessionsToDeactivate) {
    await request(
      unsupportedBaseUrl,
      "PUT",
      `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
      { activeResearchDatabaseIds: [] },
    );
  }
  await request(
    unsupportedBaseUrl,
    "DELETE",
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${branch.session.id}`,
  );
  for (const database of [japaneseDatabase, englishDatabase]) {
    const blockers = await request(
      unsupportedBaseUrl,
      "GET",
      `/api/v1/research/databases/${database.database.id}/deletion-blockers`,
    );
    assert.equal(blockers.blocked, false);
    assert.deepEqual(blockers.workshopReferences, []);
  }

  const allModelCallIds = [
    ...chatResults.map((result) => result.modelCallId),
    agentTurn1.modelCallId,
    agentTurn2.modelCallId,
    agentTurn3.modelCallId,
    retryResult.modelCallId,
  ];
  let auditEventCount = 0;
  for (const modelCallId of allModelCallIds) {
    const audits = await repository.listResearchToolAuditEvents(series.manifest.id, modelCallId);
    const serialized = JSON.stringify(audits);
    auditEventCount += audits.length;
    for (const fact of [...japaneseFacts, ...englishFacts]) {
      assert(!serialized.includes(fact.marker), "Research audit leaked original passage text");
    }
    assert(!serialized.includes("originalText"));
    assert(!serialized.includes("queryText"));
  }
  const authorityAfter = await Promise.all(databaseRoots.map(authorityHash));
  assert.deepEqual(authorityAfter, authorityBefore);
  await unsupportedApp.close();
  activeServer = null;

  process.stdout.write(`${JSON.stringify({
    ok: true,
    temporaryLibraryRoot: true,
    chineseAuthorSessions: 2,
    chineseAuthorTurnsPerSession: 3,
    originalLanguages: ["ja", "en"],
    agentAuthorTurns: 4,
    codexWriteRequiredConfirmation: true,
    unsupportedSessions: 2,
    unsupportedTurnsPerSession: 2,
    unsupportedResearchCalls: 0,
    cancellationPersistedEvidence: 0,
    restartAutomaticProviderCalls: 0,
    exactCitationNavigation: true,
    branchActivationSnapshot: true,
    archivedDeletionBlocker: true,
    blockersClearedAfterExplicitLifecycleActions: true,
    auditEventCount,
    auditContainsPrivateText: false,
    researchAuthorityUnchanged: true,
  }, null, 2)}\n`);
} finally {
  if (activeServer) await activeServer.app.close().catch(() => undefined);
  await rm(root, { recursive: true, force: true });
}
