import path from "node:path";
import { buildApp } from "../apps/server/dist/app.js";

const port = 4328;
const base = `http://127.0.0.1:${port}/api/v1`;
const seriesId = "48884982-7ecf-4adf-a3de-ad47f6107f91";
const cleanupOnly = process.argv.includes("--cleanup-only");
const oldTerms = [
  "lead-writing-partner",
  "researcher",
  "\u4e3b\u7b14\u4f19\u4f34",
  "\u89d2\u8272\uff1a\u5c0f\u8bf4\u8d44\u6599\u7814\u7a76\u5458",
  "\u4e3b\u7b14\u4f19\u4f34\u65e5\u5e38\u534f\u4f5c",
];

function hasOldPrompt(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return oldTerms.some((term) => text.includes(term));
}

function short(value, max = 260) {
  if (value == null) return null;
  const text = String(value);
  return text.length <= max ? text : text.slice(0, max);
}

function compactTurn(result) {
  return {
    turn: result.turn,
    toolCount: result.toolCount,
    assistantStatus: result.assistantStatus,
    contextRoleId: result.contextRoleId,
    contextPromptTemplateId: result.contextPromptTemplateId,
    hasPendingDraftContext: result.contextKinds.includes("pending-codex-draft"),
    contextContainsOldPrompt: result.contextContainsOldPrompt,
  };
}

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!response.ok) {
    const error = new Error(`${method} ${url} -> ${response.status}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }
  return json;
}

async function deleteRealApiCleanSessions() {
  const sessions = await request("GET", `${base}/series/${seriesId}/workshop/sessions`);
  const targets = sessions.filter((session) => String(session.title).startsWith("Real API Clean"));
  const deletedSessionIds = [];
  for (const session of targets) {
    await request("DELETE", `${base}/series/${seriesId}/workshop/sessions/${session.id}`);
    deletedSessionIds.push(session.id);
  }
  return deletedSessionIds;
}

async function main() {
  const app = await buildApp({
    libraryRoot: path.resolve("data/library"),
    webRoot: path.resolve("apps/web/dist"),
    logger: false,
    version: "real-api-test",
    commit: "working-tree-current-source",
    workspaceRoot: process.cwd(),
  });

  await app.listen({ host: "127.0.0.1", port });
  try {
    if (cleanupOnly) {
      const deletedSessionIds = await deleteRealApiCleanSessions();
      console.log(JSON.stringify({
        ok: true,
        cleanupOnly: true,
        deletedSessionIds,
        deletedSessionCount: deletedSessionIds.length,
      }, null, 2));
      return;
    }

    const health = await request("GET", `${base}/health`);
    const profiles = await request("GET", `${base}/ai/model-profiles`);
    const profile = profiles.find((item) => item.title === "DeepSeek") ?? profiles[0];
    if (!profile) throw new Error("No model profiles available.");
    const credential = await request("GET", `${base}/ai/model-profiles/${profile.id}/credential`);
    const session = await request("POST", `${base}/series/${seriesId}/workshop/sessions`, {
      title: `Real API Clean Multi Turn Agent ${new Date().toISOString()}`,
      kind: "agent",
    });
    const scenario = process.env.WORKSHOP_REAL_API_SCENARIO ?? "english";
    const turns = scenario === "chinese"
      ? [
        "\u661f\u5760\u6676\u8fd9\u4e2a\u540d\u5b57\u6709\u70b9\u571f\u3002",
        "\u6362\u4e2a\u66f4\u75bc\u4e00\u70b9\u7684\u540d\u5b57\uff1f",
        "\u6ce3\u661f\u788e\u7247\u8fd8\u884c\u3002\u5b83\u662f\u84dd\u76d0\u94a5\u5319\u7684\u8bef\u5bfc\u7ebf\u7d22\u3002\u5148\u8bb0\u5230codex\u8349\u7a3f\u91cc\u3002",
        "\u522b\u5199\u5165\uff0c\u7b49\u6211\u770b\u3002",
        "\u518d\u52a0\u4e00\u53e5\uff1a\u53ea\u5728\u949f\u697c\u9f7f\u8f6e\u9644\u8fd1\u51dd\u7ed3\u3002",
      ]
      : [
        "Starfall crystal sounds too generic.",
        "Can you make the name hurt more?",
        "I like Weeping Star Shard. It is a false lead for the blue-salt key. Put that into a Codex draft.",
        "Do not write it yet. I want to review it.",
        "Add one more bit: it only forms near clocktower gears.",
        "Cut any cosmic myth if you added one.",
        "Keep it as an object, not a lore entry.",
        "Use only one alias: WSS.",
        "Show me the current draft in plain English.",
        "Now refresh the Codex draft request one more time.",
      ];
    const results = [];
    for (let index = 0; index < turns.length; index += 1) {
      const call = await request(
        "POST",
        `${base}/series/${seriesId}/workshop/sessions/${session.id}/calls`,
        {
          mode: "agent",
          userRequest: turns[index],
          roleId: "lead-writing-partner",
          taskKind: "custom",
          promptTemplateId: "00000000-0000-4000-8000-000000000406",
          promptTemplateVersion: 1,
          modelProfileId: profile.id,
          attachmentIds: [],
          draftToken: null,
          parameters: {},
        },
      );
      const context = await request("GET", `${base}/series/${seriesId}/context/${call.contextBundleId}`);
      results.push({
        turn: index + 1,
        user: turns[index],
        assistantStatus: call.assistantMessage.status,
        assistantRole: call.assistantMessage.role,
        toolCount: call.toolMessages.length,
        toolRoles: call.toolMessages.map((message) => message.role),
        assistantStart: short(call.assistantMessage.content, 360),
        toolStart: call.toolMessages[0] ? short(call.toolMessages[0].content, 360) : null,
        contextRoleId: context.roleId,
        contextPromptTemplateId: context.promptTemplateId,
        contextKinds: context.items.map((item) => item.kind),
        contextContainsOldPrompt: hasOldPrompt(context),
      });
    }
    const messages = await request("GET", `${base}/series/${seriesId}/workshop/sessions/${session.id}/messages`);
    const exported = await request(
      "GET",
      `${base}/series/${seriesId}/workshop/sessions/${session.id}/export?includeReasoning=false&includePromptAudit=false`,
    );
    const totalToolMessages = messages.filter((message) => message.role === "tool").length;
    const revisionToolMessages = results.slice(3).reduce((sum, result) => sum + result.toolCount, 0);
    const requiredToolTurns = scenario === "english" ? [3, 5, 6, 8, 10] : [3, 5];
    const missingRequiredToolTurns = requiredToolTurns.filter((turn) => (results[turn - 1]?.toolCount ?? 0) === 0);
    const oldPromptLeaked = results.some((result) => result.contextContainsOldPrompt) || hasOldPrompt(messages) ||
      hasOldPrompt(exported);
    const rawToolJsonInAssistant = results.some((result) =>
      result.toolCount === 0 && /"tool"\s*:\s*"codex\./u.test(result.assistantStart ?? "")
    );
    const pass = credential.exists &&
      results.every((result) => result.contextRoleId === "workshop-agent") &&
      results.every((result) => result.contextPromptTemplateId === "00000000-0000-4000-8000-000000000422") &&
      !oldPromptLeaked &&
      !(/reasoningContent|Reasoning/.test(exported) || exported.includes("\u601d\u7ef4\u94fe")) &&
      !rawToolJsonInAssistant &&
      missingRequiredToolTurns.length === 0 &&
      totalToolMessages >= 2 &&
      revisionToolMessages >= 1;
    const deletedSessionIds = pass && process.env.WORKSHOP_REAL_API_KEEP_SESSION !== "1"
      ? await deleteRealApiCleanSessions()
      : [];
    console.log(JSON.stringify({
      ok: true,
      pass,
      tempServerCommit: health.commit,
      usedProfileTitle: profile.title,
      usedProvider: profile.provider,
      usedModel: profile.model,
      credentialExists: credential.exists,
      scenario,
      sessionId: session.id,
      deletedSessionIds,
      sessionKind: session.kind,
      turnCount: turns.length,
      turns: process.env.WORKSHOP_REAL_API_VERBOSE === "1" ? results : results.map(compactTurn),
      persistedMessageCount: messages.length,
      persistedRoles: messages.map((message) => message.role),
      totalToolMessages,
      revisionToolMessages,
      missingRequiredToolTurns,
      rawToolJsonInAssistant,
      messagesContainOldPrompt: hasOldPrompt(messages),
      exportContainsReasoning: /reasoningContent|Reasoning/.test(exported) || exported.includes("\u601d\u7ef4\u94fe"),
      exportContainsOldPrompt: hasOldPrompt(exported),
    }, null, 2));
    if (!pass) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    message: error.message,
    status: error.status ?? null,
    body: error.body ? short(error.body, 2000) : null,
  }, null, 2));
  process.exitCode = 1;
});
