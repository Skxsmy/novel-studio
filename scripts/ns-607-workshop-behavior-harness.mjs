import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EmbeddingRouter, MockProvider, ProviderRegistry } from "@novel-studio/ai";
import { ResearchSourcePropertiesSchema } from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { buildApp } from "../apps/server/dist/app.js";
import { parseResearchFile } from "../apps/server/dist/researchParsers.js";
import {
  behaviorCheck,
  createWorkshopTrace,
  dialogueGrader,
  outcomeGrader,
  publicSuiteSummary,
  runWorkshopBehaviorSuite,
  trajectoryGrader,
} from "./harness/workshop-behavior-harness.mjs";

function answer(text) {
  return {
    text,
    reasoningContent: "",
    reasoningOutputKind: "none",
    toolCalls: [],
    finishReason: "stop",
    usage: { inputTokens: 30, outputTokens: 12, totalTokens: 42 },
    rawResponseText: JSON.stringify({ answer: text }),
  };
}

function toolCall(name, argumentsValue) {
  return (request) => ({
    text: "",
    reasoningContent: "",
    reasoningOutputKind: "none",
    toolCalls: [{
      id: randomUUID(),
      name,
      arguments: JSON.stringify(typeof argumentsValue === "function"
        ? argumentsValue(request)
        : argumentsValue),
    }],
    finishReason: "tool_calls",
    usage: { inputTokens: 30, outputTokens: 12, totalTokens: 42 },
    rawResponseText: JSON.stringify({ tool: name }),
  });
}

function lastToolResult(request) {
  const message = request.history?.at(-1);
  assert.equal(message?.role, "tool");
  return JSON.parse(message.content);
}

class BehaviorProvider extends MockProvider {
  requests = [];
  index = 0;

  constructor(steps) {
    super();
    this.steps = steps;
  }

  async *streamChat(request) {
    const step = this.steps[this.index];
    assert(step, `Unexpected Provider call ${this.index + 1}`);
    this.index += 1;
    this.requests.push(request);
    await step.expect?.(request);
    const result = typeof step.result === "function" ? step.result(request) : step.result;
    assert(result, `Provider step ${step.name} has no result`);
    if (result.text) yield { type: "answer-delta", text: result.text };
    yield { type: "done", result };
  }

  assertExhausted() {
    assert.equal(this.index, this.steps.length, `${this.steps.length - this.index} Provider step(s) remain`);
  }
}

async function request(baseUrl, method, pathname, payload, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: payload === undefined ? undefined : { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;
  assert.equal(response.status, expectedStatus, `${method} ${pathname}: ${response.status} ${raw}`);
  return body;
}

function requestIdentity(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function createEnvironment(provider, title) {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ns-607-behavior-"));
  const repository = new ProjectRepository(root);
  await repository.initialize();
  const series = await repository.createSeries({ title });
  const registry = new ProviderRegistry();
  registry.register(provider);
  const app = await buildApp({
    libraryRoot: root,
    providerRegistry: registry,
    embeddingRouter: new EmbeddingRouter(),
  });
  const baseUrl = await app.listen({ host: "127.0.0.1", port: 0 });
  const profile = await request(baseUrl, "POST", "/api/v1/ai/model-profiles", {
    title: "NS-607 behavior reference model",
    provider: "mock",
    model: "mock-behavior-v1",
  }, 201);
  return { root, repository, series, app, baseUrl, profile };
}

async function closeEnvironment(environment) {
  await environment.app.close();
  await rm(environment.root, { recursive: true, force: true });
}

async function createSession(environment, title, databaseIds = []) {
  const session = await request(
    environment.baseUrl,
    "POST",
    `/api/v1/series/${environment.series.manifest.id}/workshop/sessions`,
    { kind: "agent", title },
    201,
  );
  if (databaseIds.length === 0) return session;
  return request(
    environment.baseUrl,
    "PUT",
    `/api/v1/series/${environment.series.manifest.id}/workshop/sessions/${session.id}`,
    { activeResearchDatabaseIds: databaseIds },
  );
}

async function runTurn(environment, trace, sessionId, turn, content) {
  trace.add({ type: "author", turn, content });
  const result = await request(
    environment.baseUrl,
    "POST",
    `/api/v1/series/${environment.series.manifest.id}/workshop/sessions/${sessionId}/calls`,
    { mode: "agent", userRequest: content, modelProfileId: environment.profile.id },
  );
  const audits = result.modelCallId
    ? await environment.repository.listResearchToolAuditEvents(
      environment.series.manifest.id,
      result.modelCallId,
    )
    : [];
  for (const audit of audits) {
    const callId = audit.id;
    trace.add({
      type: "tool-call",
      turn,
      callId,
      name: audit.tool,
      effect: "read",
      arguments: audit.argumentSummary,
    });
    trace.add({
      type: "tool-result",
      turn,
      callId,
      name: audit.tool,
      effect: "read",
      status: audit.status,
    });
  }
  if (result.responseText) {
    trace.add({ type: "assistant", turn, content: result.responseText, status: result.status });
  }
  for (const message of result.toolMessages ?? []) {
    const parsed = JSON.parse(message.content);
    trace.add({
      type: "tool-call",
      turn,
      callId: message.id,
      name: parsed.tool,
      effect: "write",
      arguments: parsed.draft,
      requestIdentity: requestIdentity(message.content),
    });
  }
  return result;
}

async function confirmWrite(environment, trace, sessionId, turn, message, tool) {
  trace.add({ type: "confirmation", turn, callId: message.id, name: tool, status: "approved" });
  const result = await request(
    environment.baseUrl,
    "POST",
    `/api/v1/series/${environment.series.manifest.id}/workshop/sessions/${sessionId}/messages/${message.id}/tools/${tool}/execute`,
    { confirm: true },
    201,
  );
  trace.add({
    type: "tool-result",
    turn,
    callId: message.id,
    name: tool,
    effect: "write",
    status: "succeeded",
  });
  for (const continuation of result.continuationMessages ?? []) {
    if (continuation.role === "assistant") {
      trace.add({ type: "assistant", turn, content: continuation.content, status: continuation.status });
    }
  }
  return result;
}

async function importReference(environment, databaseId, text) {
  const bytes = Buffer.from(text, "utf8");
  const parsed = await parseResearchFile({
    contentBase64: bytes.toString("base64"),
    fileName: "ritual-ja.txt",
    mediaType: "text/plain",
    sizeBytes: bytes.byteLength,
  });
  return environment.repository.importResearchSource(databaseId, {
    kind: parsed.parsed.kind,
    mediaType: "text/plain",
    originalFileName: "ritual-ja.txt",
    originalBytes: parsed.bytes,
    sizeBytes: parsed.bytes.byteLength,
    contentHash: parsed.contentHash,
    properties: ResearchSourcePropertiesSchema.parse({
      displayName: "Japanese ritual notes",
      declaredLanguage: "ja",
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

async function runCodexCorrectionTrial(task, trialIndex) {
  const provider = new BehaviorProvider([
    { name: "brainstorm", result: answer("先讨论她在城门口承担的职责。") },
    { name: "candidate", result: answer("可以先确定外观与职责，再决定是否记录。") },
    { name: "short correction", result: answer("收到，这项纠正会延续到后面的草稿。") },
    { name: "prose only", result: answer("黑发的守门人站在门洞阴影里，先听见远处的钟声。") },
    {
      name: "create",
      result: toolCall("codex.create_entry", {
        message: "已根据确认内容准备创建条目。",
        draft: {
          categoryId: "character",
          name: "沈遥",
          aliases: [],
          description: "黑发的守门人。",
          details: [],
          research: "来自当前作者会话中已经确认的设定。",
        },
      }),
    },
    { name: "create continuation", result: answer("沈遥的条目已经创建。") },
    { name: "discuss without update", result: answer("把弱点直接设成恐惧可能过于直白，可以继续讨论而不改动条目。") },
    {
      name: "update",
      result: toolCall("codex.update_entry", {
        message: "已按最新决定准备更新条目。",
        draft: {
          target: { name: "沈遥" },
          patch: { description: "黑发的守门人，对钟声异常敏感。" },
        },
      }),
    },
    { name: "update continuation", result: answer("沈遥的条目已经按最新决定更新。") },
    { name: "summary", result: answer("已完成角色讨论、创建和一次明确更新。") },
  ]);
  const environment = await createEnvironment(provider, `Codex correction trial ${trialIndex}`);
  try {
    const trace = createWorkshopTrace(task.id, trialIndex);
    const session = await createSession(environment, "自然纠正与 Codex 写入");
    await runTurn(environment, trace, session.id, 1, "先聊聊守门人这个角色，不要创建任何东西。");
    await runTurn(environment, trace, session.id, 2, "她看起来需要一个更清楚的视觉特征。先讨论。");
    await runTurn(environment, trace, session.id, 3, "不要红发，改成黑发；也不要家庭仇恨。");
    await runTurn(environment, trace, session.id, 4, "写一小段她第一次出场，暂时不要记入 Codex。");
    const create = await runTurn(environment, trace, session.id, 5, "好，把已经确定的内容记录成沈遥的 Codex 条目。");
    assert.equal(create.agentRun.run.status, "waiting-confirmation");
    const createMessage = create.toolMessages[0];
    assert(createMessage);
    await confirmWrite(environment, trace, session.id, 5, createMessage, "codex.create_entry");
    await runTurn(environment, trace, session.id, 6, "先讨论她怕水会不会太直白，暂时不要更新。");
    const update = await runTurn(environment, trace, session.id, 7, "那就不要怕水，改成对钟声敏感。把这个变化记录下来。");
    assert.equal(update.agentRun.run.status, "waiting-confirmation");
    const updateMessage = update.toolMessages[0];
    assert(updateMessage);
    await confirmWrite(environment, trace, session.id, 7, updateMessage, "codex.update_entry");
    await runTurn(environment, trace, session.id, 8, "总结一下刚才已经完成的工作，不要再改动。");
    provider.assertExhausted();
    const entries = await environment.repository.listCodexEntries(environment.series.manifest.id);
    return {
      trace,
      outcome: {
        entryCount: entries.length,
        name: entries[0]?.metadata.name ?? null,
        description: entries[0]?.description ?? null,
      },
      metrics: { authorTurns: 8, providerCalls: provider.requests.length },
    };
  } finally {
    await closeEnvironment(environment);
  }
}

async function runResearchThenUpdateTrial(task, trialIndex) {
  const fact = "雨守は冬至に西門を守り、開門前に青銅の鈴を三度鳴らす。";
  let databaseId = null;
  const provider = new BehaviorProvider([
    {
      name: "no unnecessary research",
      expect(requestValue) {
        assert(requestValue.tools?.some((tool) => tool.name === "research.search"));
        assert(requestValue.tools?.some((tool) => tool.name === "codex.update_entry"));
      },
      result: answer("先只讨论雨守在场景中的压迫感，不检索也不改动条目。"),
    },
    { name: "list", result: toolCall("research.list_sources", () => ({ databaseId })) },
    {
      name: "search",
      result: toolCall("research.search", () => ({
        query: fact,
        databaseIds: [databaseId],
        mode: "exact",
      })),
    },
    {
      name: "open",
      result: toolCall("research.open_passage", (requestValue) => {
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
      name: "evidence answer",
      expect(requestValue) {
        assert(lastToolResult(requestValue).passages?.some((passage) =>
          String(passage.originalText).includes("青銅の鈴を三度")));
      },
      result: answer("资料确认：雨守在冬至守西门，开门前青铜铃响三次。"),
    },
    {
      name: "update from settled evidence",
      result: toolCall("codex.update_entry", {
        message: "已根据刚才核对的资料准备更新。",
        draft: {
          target: { name: "雨守" },
          patch: { description: "冬至守卫西门，开门前让青铜铃响三次。" },
        },
      }),
    },
    { name: "update continuation", result: answer("雨守条目已经按核对结果更新。") },
    { name: "no replay summary", result: answer("检索和一次确认更新均已完成。") },
  ]);
  const environment = await createEnvironment(provider, `Research behavior trial ${trialIndex}`);
  try {
    await environment.repository.createCodexEntry(environment.series.manifest.id, {
      categoryId: "character",
      name: "雨守",
      description: "守门人，具体职责待核对。",
      research: "行为评测初始 fixture。",
    });
    const database = await environment.repository.createResearchDatabase({ name: "Japanese ritual references" });
    databaseId = database.database.id;
    await importReference(environment, databaseId, fact);
    const trace = createWorkshopTrace(task.id, trialIndex);
    const session = await createSession(environment, "Research 后更新 Codex", [databaseId]);
    await runTurn(environment, trace, session.id, 1, "先只讨论雨守的气氛，不用查资料，也不要更新。");
    const researched = await runTurn(environment, trace, session.id, 2, "现在请查日文资料，确认她守哪座门以及开门前做什么。");
    assert.equal(researched.agentRun.run.status, "completed", JSON.stringify({
      errorCode: researched.assistantMessage?.errorCode,
      errorMessage: researched.assistantMessage?.errorMessage,
      responseText: researched.responseText,
    }));
    assert(researched.researchEvidence?.citations.length > 0);
    const update = await runTurn(environment, trace, session.id, 3, "把刚才已经确认的事实更新到雨守条目。");
    assert.equal(update.agentRun.run.status, "waiting-confirmation");
    const updateMessage = update.toolMessages[0];
    assert(updateMessage);
    await confirmWrite(environment, trace, session.id, 3, updateMessage, "codex.update_entry");
    await runTurn(environment, trace, session.id, 4, "只总结，不要重复更新。");
    provider.assertExhausted();
    const entries = await environment.repository.listCodexEntries(environment.series.manifest.id);
    return {
      trace,
      outcome: {
        entryCount: entries.length,
        description: entries[0]?.description ?? null,
        evidenceCount: researched.researchEvidence.citations.length,
      },
      metrics: { authorTurns: 4, providerCalls: provider.requests.length },
    };
  } finally {
    await closeEnvironment(environment);
  }
}

const visibleProtocolPatterns = [
  /codex\.(?:create_entry|update_entry)/iu,
  /research\.(?:list_sources|search|open_passage)/iu,
  /tool call/iu,
  /schema/iu,
  /调用 ID/iu,
];

const tasks = [
  {
    id: "codex-natural-correction",
    title: "Natural author correction constrains Codex creation and update",
    graders: [
      trajectoryGrader({
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
        forbiddenAssistantPatterns: visibleProtocolPatterns,
        maximumAuthorTurns: 8,
        persistedBoundaries: [
          { afterTurn: 3, include: ["黑发"], exclude: ["红发", "家庭仇恨"] },
          { afterTurn: 6, include: ["钟声"], exclude: ["怕水"] },
        ],
      }),
      outcomeGrader("Codex authority", (outcome) => [
        behaviorCheck("exactly one entry exists", outcome.entryCount === 1, { entryCount: outcome.entryCount }),
        behaviorCheck("the intended entry exists", outcome.name === "沈遥", { name: outcome.name }),
        behaviorCheck("the corrected values are authoritative",
          outcome.description === "黑发的守门人，对钟声异常敏感。",
          { description: outcome.description }),
      ]),
    ],
  },
  {
    id: "research-then-confirmed-update",
    title: "All Research reads precede one separately confirmed Codex update",
    graders: [
      trajectoryGrader({
        requiredTools: [
          { name: "research.list_sources", min: 1, max: 1 },
          { name: "research.search", min: 1, max: 1 },
          { name: "research.open_passage", min: 1, max: 1 },
          { name: "codex.update_entry", min: 1, max: 1 },
        ],
        forbiddenTools: ["codex.create_entry"],
        noToolsOnTurns: [1, 4],
        orderedTools: [
          "research.list_sources",
          "research.search",
          "research.open_passage",
          "codex.update_entry",
        ],
        confirmWrites: true,
        noDuplicateSuccessfulWrites: true,
      }),
      dialogueGrader({
        forbiddenAssistantPatterns: visibleProtocolPatterns,
        maximumAuthorTurns: 4,
      }),
      outcomeGrader("Research and Codex authority", (outcome) => [
        behaviorCheck("Research evidence is persisted", outcome.evidenceCount > 0, {
          evidenceCount: outcome.evidenceCount,
        }),
        behaviorCheck("the existing entry is updated once", outcome.entryCount === 1, {
          entryCount: outcome.entryCount,
        }),
        behaviorCheck("the exact sourced fact reaches Codex authority",
          outcome.description === "冬至守卫西门，开门前让青铜铃响三次。",
          { description: outcome.description }),
      ]),
    ],
  },
];

const result = await runWorkshopBehaviorSuite({
  tasks,
  trialsPerTask: 1,
  runTrial(task, trialIndex) {
    if (task.id === "codex-natural-correction") return runCodexCorrectionTrial(task, trialIndex);
    if (task.id === "research-then-confirmed-update") return runResearchThenUpdateTrial(task, trialIndex);
    throw new Error(`Unknown behavior task ${task.id}`);
  },
});

process.stdout.write(`${JSON.stringify(publicSuiteSummary(result), null, 2)}\n`);
assert.equal(result.passed, true, "Workshop behavior harness found a failed trial");
