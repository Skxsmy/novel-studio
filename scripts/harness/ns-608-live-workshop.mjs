import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProviderRegistry, createDefaultProviderRegistry } from "@novel-studio/ai";
import { ModelProfileSchema, ResearchSourcePropertiesSchema } from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { buildApp } from "../../apps/server/dist/app.js";
import { parseResearchFile } from "../../apps/server/dist/researchParsers.js";

export const NS608_TARGET_MODEL = "deepseek-v4-pro";

export function harnessFailure(code, publicDetails = {}) {
  const error = new Error(code);
  Object.defineProperties(error, {
    ns608Code: { value: code, enumerable: false },
    ns608PublicDetails: { value: publicDetails, enumerable: false },
  });
  return error;
}

export function publicHarnessFailure(error) {
  const candidate = error && typeof error === "object" ? error : {};
  return {
    code: typeof candidate.ns608Code === "string" ? candidate.ns608Code : "unexpected-harness-failure",
    ...(candidate.ns608PublicDetails && typeof candidate.ns608PublicDetails === "object"
      ? candidate.ns608PublicDetails
      : {}),
    ...(candidate.ns608Safety && typeof candidate.ns608Safety === "object"
      ? { safety: candidate.ns608Safety }
      : {}),
  };
}

async function filesUnder(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error("NS-608 safety fingerprint refuses symbolic links");
    if (entry.isDirectory()) files.push(...await filesUnder(root, child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

export async function fingerprintDirectory(root) {
  const files = await filesUnder(root);
  const hash = createHash("sha256");
  let totalBytes = 0;
  for (const relative of files) {
    const bytes = await readFile(path.join(root, relative));
    const normalized = relative.split(path.sep).join("/");
    totalBytes += bytes.byteLength;
    hash.update(`${normalized}\0${bytes.byteLength}\0`, "utf8");
    hash.update(bytes);
    hash.update("\0", "utf8");
  }
  return { fileCount: files.length, totalBytes, digest: hash.digest("hex") };
}

export function selectSavedDeepseekProfile(profiles) {
  const eligible = profiles.filter((profile) =>
    profile.provider === "deepseek" &&
    profile.archivedAt === null &&
    typeof profile.credentialRef === "string" &&
    profile.credentialRef.length > 0);
  assert.equal(
    eligible.length,
    1,
    `NS-608 requires exactly one active credential-configured DeepSeek profile; found ${eligible.length}`,
  );
  return eligible[0];
}

export function projectDeepseekV4ProProfile(sourceProfile) {
  return ModelProfileSchema.parse({
    ...sourceProfile,
    model: NS608_TARGET_MODEL,
  });
}

export function assertPublicSummarySafe(summary, forbiddenValues = []) {
  const serialized = JSON.stringify(summary);
  const forbiddenPatterns = [
    /authorization/iu,
    /bearer\s+/iu,
    /credentialref/iu,
    /cookie/iu,
    /sk-[a-z0-9_-]{8,}/iu,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(serialized), false, `Public NS-608 summary contains forbidden material: ${pattern}`);
  }
  for (const value of forbiddenValues.filter((item) => typeof item === "string" && item.length > 0)) {
    assert.equal(serialized.includes(value), false, "Public NS-608 summary contains a private runtime value");
  }
  return summary;
}

export function exactResearchCitationPresent(citations, sourceDetail) {
  const expected = new Set(
    sourceDetail.content.chunks.map((chunk) => `${chunk.id}:${chunk.textHash}`),
  );
  return citations.some((citation) =>
    citation.sourceId === sourceDetail.source.id &&
    expected.has(`${citation.chunkId}:${citation.chunkHash}`));
}

export function evaluateCrossLanguageFactCoverage(text) {
  return {
    winterSolstice: /冬至|winter\s+solstice/iu.test(text),
    westGate: /西[門门]|west\s+gate/iu.test(text),
    bronzeBell: /青[銅铜].{0,4}[鈴铃]|bronze\s+bell/iu.test(text),
    ringsThreeTimes: /三(?:次|度|遍|声)|3\s*(?:次|遍|声)|three\s+times/iu.test(text),
    beforeOpening: /[開开]門前|before\s+opening/iu.test(text),
    noDoorTouchUntilRingingEnds:
      /(?:鐘|钟|鈴|铃).{0,20}(?:終|结).{0,20}(?:門|门).{0,8}(?:触|碰)/iu.test(text) ||
      /(?:門|门).{0,8}(?:触|碰).{0,20}(?:鐘|钟|鈴|铃).{0,20}(?:終|结)/iu.test(text) ||
      /(?:not|mustn['’]?t|cannot).{0,20}touch.{0,20}(?:door|gate).{0,30}(?:ringing|bell).{0,20}(?:end|ended)/iu.test(text),
  };
}

export function evaluateBalancedResearchFactCoverage(text) {
  return {
    beforeMidnight: /子时前两刻|子時前兩刻|two\s+quarters?\s+before\s+midnight/iu.test(text),
    threeChimes: /三(?:次|遍|声)|3\s*(?:次|遍|声)|three\s+(?:times|chimes)/iu.test(text),
  };
}

export function evaluateConflictFactCoverage(text) {
  return {
    japaneseAfterSolsticeMorning:
      /冬至.{0,8}(?:翌朝|次日(?:清晨|早晨|早上))/iu.test(text) ||
      /(?:翌朝|次日(?:清晨|早晨|早上)).{0,8}冬至/iu.test(text),
    japaneseGateClosed:
      /(?:日文|日本|北门|北門).{0,30}(?:不开门|不開門|未开门|未開門|门不开|門不開)/iu.test(text) ||
      /(?:不开门|不開門|未开门|未開門|门不开|門不開).{0,30}(?:日文|日本|北门|北門)/iu.test(text),
    englishBeforeSolsticeEvening:
      /(?:英文|商人|账簿|帳簿).{0,40}(?:冬至前夕|冬至前夜|冬至前(?:的)?(?:傍晚|晚上)|冬至前一晚|冬至前一天(?:晚上|傍晚))/iu.test(text) ||
      /(?:冬至前夕|冬至前夜|冬至前(?:的)?(?:傍晚|晚上|黄昏|晚间|夜晚)|冬至前一(?:天|日)(?:晚上|傍晚|黄昏|晚间)).{0,40}(?:英文|商人|账簿|帳簿)/iu.test(text) ||
      /evening\s+before\s+the\s+winter\s+solstice/iu.test(text),
    englishGateOpenedForSaltWagons:
      /(?:盐车|鹽車|运盐|運鹽|载盐|載鹽|盐商.{0,4}(?:车|車|车队|車隊)|鹽商.{0,4}(?:車|車隊)|salt\s+wagons?).{0,30}(?:开门|開門|开启|開啟|开放|開放|放行|opened?)/iu.test(text) ||
      /(?:开门|開門|开启|開啟|开放|開放|放行|opened?).{0,30}(?:盐车|鹽車|运盐|運鹽|载盐|載鹽|盐商.{0,4}(?:车|車|车队|車隊)|鹽商.{0,4}(?:車|車隊)|salt\s+wagons?)/iu.test(text),
    conflictExplicit: /冲突|衝突|矛盾|不一致|分歧|无法同时成立|無法同時成立/iu.test(text),
    noExileInference:
      /(?:不能|不可|不足以|无法|無法).{0,30}(?:推出|证明|證明|说明|說明).{0,20}(?:放逐|驱逐|驅逐|流放)/iu.test(text) ||
      /(?:不能|不可|不应|不應|不宜|无法|無法|不足以).{0,30}(?:理解|解读|解讀|解释|解釋|视为|視為|当作|當作|等同).{0,20}(?:放逐|驱逐|驅逐|流放)/iu.test(text) ||
      /(?:送り|departure|两者|兩者|词义|詞義).{0,30}(?:不等于|不等於|不是|并非|並非|不能|不可).{0,20}(?:放逐|驱逐|驅逐|流放|exile)/iu.test(text) ||
      /(?:放逐|驱逐|驅逐|流放).{0,20}(?:没有|沒有|缺乏|无|無).{0,12}(?:依据|依據|证据|證據)/iu.test(text) ||
      /(?:does\s+not|doesn['’]t|cannot|can['’]t).{0,24}(?:prove|show|mean|imply).{0,30}(?:exile|exiled)/iu.test(text),
  };
}

export function parseContinuationWriteRequest(message) {
  if (!message || message.role !== "tool" || typeof message.content !== "string") return null;
  try {
    const parsed = JSON.parse(message.content);
    return typeof parsed.tool === "string" && parsed.draft && typeof parsed.draft === "object"
      ? { tool: parsed.tool, draft: parsed.draft }
      : null;
  } catch {
    return null;
  }
}

async function credentialReferenceLocations(root, credentialRef) {
  const matches = [];
  for (const relative of await filesUnder(root)) {
    const bytes = await readFile(path.join(root, relative));
    if (bytes.includes(Buffer.from(credentialRef, "utf8"))) matches.push(relative.split(path.sep).join("/"));
  }
  return matches;
}

export async function requestJson(baseUrl, method, pathname, payload, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: payload === undefined ? undefined : { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  if (response.status !== expectedStatus) {
    const code = body && typeof body === "object" && "code" in body ? body.code : "HTTP_FAILURE";
    throw harnessFailure("request-failed", {
      status: response.status,
      providerCode: String(code).replace(/[^A-Z0-9_-]/giu, "").slice(0, 80),
    });
  }
  return body;
}

function requestIdentity(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function traceProvider(adapter, trace) {
  return new Proxy(adapter, {
    get(target, property) {
      if (property === "streamChat") {
        return async function* tracedStreamChat(request) {
          for await (const event of target.streamChat(request)) {
            if (event.type === "done") {
              trace.push({
                toolChoice: request.toolChoice ?? null,
                availableTools: request.tools?.map((tool) => tool.name) ?? [],
                returnedTools: event.result.toolCalls.map((call) => ({
                  name: call.name,
                  arguments: call.arguments,
                })),
              });
            }
            yield event;
          }
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export async function createLiveSession(environment, title, databaseIds = []) {
  const session = await requestJson(
    environment.baseUrl,
    "POST",
    `/api/v1/series/${environment.series.manifest.id}/workshop/sessions`,
    { kind: "agent", title },
    201,
  );
  if (databaseIds.length === 0) return session;
  return requestJson(
    environment.baseUrl,
    "PUT",
    `/api/v1/series/${environment.series.manifest.id}/workshop/sessions/${session.id}`,
    { activeResearchDatabaseIds: databaseIds },
  );
}

export async function runLiveTurn(environment, trace, sessionId, turn, content) {
  trace.add({ type: "author", turn, content });
  const providerTraceStart = environment.providerTrace?.length ?? 0;
  const result = await requestJson(
    environment.baseUrl,
    "POST",
    `/api/v1/series/${environment.series.manifest.id}/workshop/sessions/${sessionId}/calls`,
    {
      mode: "agent",
      modelProfileId: environment.profile.id,
      userRequest: content,
    },
  );
  const audits = result.modelCallId
    ? await environment.repository.listResearchToolAuditEvents(
      environment.series.manifest.id,
      result.modelCallId,
    )
    : [];
  for (const audit of audits) {
    trace.add({
      type: "tool-call",
      turn,
      callId: audit.id,
      name: audit.tool,
      effect: "read",
      arguments: audit.argumentSummary,
    });
    trace.add({
      type: "tool-result",
      turn,
      callId: audit.id,
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
  Object.defineProperty(result, "ns608Diagnostics", {
    value: audits.map((audit) => ({
      tool: audit.tool,
      status: audit.status,
      errorCode: audit.errorCode,
      madeProgress: audit.madeProgress,
      exhaustedReason: audit.budgetAfter.exhaustedReason,
    })),
    enumerable: false,
  });
  Object.defineProperty(result, "ns608ProviderTrace", {
    value: (environment.providerTrace ?? []).slice(providerTraceStart),
    enumerable: false,
  });
  return result;
}

export async function confirmLiveWrite(environment, trace, sessionId, turn, message, tool) {
  let phase = "record-confirmation";
  try {
    trace.add({ type: "confirmation", turn, callId: message.id, name: tool, status: "approved" });
    phase = "execute-request";
    const result = await requestJson(
      environment.baseUrl,
      "POST",
      `/api/v1/series/${environment.series.manifest.id}/workshop/sessions/${sessionId}/messages/${message.id}/tools/${tool}/execute`,
      { confirm: true },
      201,
    );
    phase = "record-result";
    trace.add({
      type: "tool-result",
      turn,
      callId: message.id,
      name: tool,
      effect: "write",
      status: "succeeded",
    });
    phase = "classify-continuation";
    for (const continuation of result.continuationMessages ?? []) {
      if (continuation.role === "assistant") {
        trace.add({ type: "assistant", turn, content: continuation.content, status: continuation.status });
      } else if (continuation.role === "tool") {
        const parsed = parseContinuationWriteRequest(continuation);
        if (parsed) {
          trace.add({
            type: "tool-call",
            turn,
            callId: continuation.id,
            name: parsed.tool,
            effect: "write",
            arguments: parsed.draft,
            requestIdentity: requestIdentity(continuation.content),
          });
        }
      }
    }
    return result;
  } catch (error) {
    if (error && typeof error === "object" && typeof error.ns608Code === "string") {
      const details = error.ns608PublicDetails && typeof error.ns608PublicDetails === "object"
        ? { ...error.ns608PublicDetails, phase, tool }
        : { phase, tool };
      throw harnessFailure(error.ns608Code, details);
    }
    throw harnessFailure("confirm-live-write-failed", { phase, tool });
  }
}

export async function importGeneratedTextSource(environment, databaseId, fixture) {
  const bytes = Buffer.from(fixture.text, "utf8");
  const parsed = await parseResearchFile({
    contentBase64: bytes.toString("base64"),
    fileName: fixture.fileName,
    mediaType: "text/plain",
    sizeBytes: bytes.byteLength,
  });
  return environment.repository.importResearchSource(databaseId, {
    kind: parsed.parsed.kind,
    mediaType: "text/plain",
    originalFileName: fixture.fileName,
    originalBytes: parsed.bytes,
    sizeBytes: parsed.bytes.byteLength,
    contentHash: parsed.contentHash,
    properties: ResearchSourcePropertiesSchema.parse({
      displayName: fixture.displayName,
      declaredLanguage: fixture.language,
      aiPermission: fixture.aiPermission ?? "allowed",
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

export async function withTemporaryRealProviderEnvironment(options, run) {
  const sourceLibraryRoot = path.resolve(options.sourceLibraryRoot);
  const sourceBefore = await fingerprintDirectory(sourceLibraryRoot);
  const sourceRepository = new ProjectRepository(sourceLibraryRoot);
  const sourceProfile = selectSavedDeepseekProfile(await sourceRepository.listModelProfiles());
  const projectedProfile = projectDeepseekV4ProProfile(sourceProfile);
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-ns-608-"));
  const providerTrace = [];
  let app = null;
  let result;
  let runError = null;
  let referenceConfined = false;
  try {
    const repository = new ProjectRepository(temporaryRoot);
    await repository.initialize();
    await repository.saveModelProfile(projectedProfile);
    const series = await repository.createSeries({ title: options.seriesTitle ?? "NS-608 saved-key trial" });
    const defaultRegistry = createDefaultProviderRegistry();
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(traceProvider(defaultRegistry.get("deepseek"), providerTrace));
    app = await buildApp({
      libraryRoot: temporaryRoot,
      logger: false,
      providerRegistry,
      version: "0.1.0-ns608-real",
      commit: "ns608-real-provider",
      workspaceRoot: process.cwd(),
    });
    const baseUrl = await app.listen({ host: "127.0.0.1", port: 0 });
    result = await run({ repository, series, profile: projectedProfile, baseUrl, providerTrace });
  } catch (error) {
    runError = error;
  } finally {
    try {
      const locations = await credentialReferenceLocations(temporaryRoot, sourceProfile.credentialRef);
      const expected = `.studio/model-profiles/${sourceProfile.id}.json`;
      referenceConfined = locations.length === 1 && locations[0] === expected;
      assert.equal(referenceConfined, true, "Credential reference escaped the temporary model profile");
    } catch (error) {
      runError ??= error;
    }
    if (app) await app.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
  const sourceAfter = await fingerprintDirectory(sourceLibraryRoot);
  assert.deepEqual(sourceAfter, sourceBefore, "NS-608 changed the real library while running a temporary trial");
  const safety = {
    systemSecretPointerConfined: referenceConfined,
    sourceLibraryUnchanged: true,
    sourceFileCount: sourceBefore.fileCount,
    sourceTotalBytes: sourceBefore.totalBytes,
  };
  if (runError) {
    Object.defineProperty(runError, "ns608Safety", { value: safety, enumerable: false });
    throw runError;
  }
  return {
    result,
    safety,
  };
}
