import { readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ModelProfileSchema } from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { buildApp } from "../apps/server/dist/app.js";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function requireArgument(name) {
  const value = argument(name)?.trim();
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function parseToolMessages(messages) {
  return messages.map((message) => {
    const request = JSON.parse(message.content);
    return { message, request };
  });
}

const sourceProfilePath = path.resolve(requireArgument("source-profile"));
const sourceProfile = ModelProfileSchema.parse(JSON.parse(await readFile(sourceProfilePath, "utf8")));
const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-ns510-real-agent-"));
const repository = new ProjectRepository(libraryRoot);
await repository.initialize();
await repository.saveModelProfile(sourceProfile);
const series = await repository.createSeries({ title: "NS-510 Synthetic Agent Test" });
await repository.createCodexEntry(series.manifest.id, {
  categoryId: "character",
  name: "Mara Quill",
  description: "Mara Quill is a capable harbor pilot whose personal stakes are not yet defined.",
  research: "Synthetic NS-510 real-Provider test fixture.",
});
const seriesId = series.manifest.id;
const modelProfileId = sourceProfile.id;
const prompts = [
  "I want to work on Mara Quill for a bit.",
  "She's a harbor pilot, but she feels too competent right now.",
  "Give her a personal debt.",
  "Make it something she can't solve by being good at her job.",
  "Not family. Maybe she owes the lighthouse keeper.",
  "Give me two versions of that history.",
  "The second one. Keep it understated.",
  "How should it affect her first scene?",
  "Write a short paragraph for that entrance.",
  "Good. Update Mara Quill's Codex description with what we agreed.",
];

const app = await buildApp({ libraryRoot });
try {
  const created = await app.inject({
    method: "POST",
    url: `/api/v1/series/${seriesId}/workshop/sessions`,
    payload: { kind: "agent", title: `NS-510 real Agent ${new Date().toISOString()}` },
  });
  if (created.statusCode !== 201) {
    throw new Error(`Session creation failed (${created.statusCode}): ${created.payload}`);
  }
  const session = created.json();
  console.log(`SESSION ${session.id}`);

  let finalTool = null;
  for (const [index, userRequest] of prompts.entries()) {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/workshop/sessions/${session.id}/calls`,
      payload: { mode: "agent", userRequest, modelProfileId },
    });
    if (response.statusCode !== 200) {
      throw new Error(`Turn ${index + 1} failed (${response.statusCode}): ${response.payload}`);
    }
    const result = response.json();
    const tools = parseToolMessages(result.toolMessages ?? []);
    console.log(`\nTURN ${index + 1}`);
    console.log(`USER: ${userRequest}`);
    console.log(`ASSISTANT: ${result.assistantMessage.content}`);
    console.log(`RUN: ${result.agentRun?.run?.status ?? "none"}`);

    if (index < prompts.length - 1 && tools.length > 0) {
      throw new Error(`Turn ${index + 1} invoked ${tools[0].request.tool} before the author expressed Codex intent.`);
    }
    if (index === prompts.length - 1) {
      if (tools.length !== 1 || tools[0].request.tool !== "codex.update_entry") {
        throw new Error(`Final turn did not produce one codex.update_entry call: ${JSON.stringify(tools.map((item) => item.request.tool))}`);
      }
      finalTool = tools[0];
    }
  }

  let execution = await app.inject({
    method: "POST",
    url: `/api/v1/series/${seriesId}/workshop/sessions/${session.id}/messages/${finalTool.message.id}/tools/codex.update_entry/execute`,
    payload: { confirm: true },
  });
  console.log(`\nCONFIRM: ${execution.statusCode}`);
  if (execution.statusCode === 409 && execution.json().code === "CODEX_DETAIL_TYPE_CREATION_REQUIRED") {
    const missing = execution.json().missingDetailTypes;
    console.log("CONFIRMATION PAUSED: missing detail-type decisions require explicit author input.");
    console.log(JSON.stringify(missing, null, 2));
    if (process.argv.includes("--confirm-synthetic-details")) {
      execution = await app.inject({
        method: "POST",
        url: `/api/v1/series/${seriesId}/workshop/sessions/${session.id}/messages/${finalTool.message.id}/tools/codex.update_entry/execute`,
        payload: {
          confirm: true,
          createMissingDetailTypes: true,
          detailCreations: missing.map((detail) => ({
            label: detail.label,
            name: detail.label,
            nsfw: false,
          })),
        },
      });
      console.log(`SYNTHETIC DETAIL CONFIRM: ${execution.statusCode}`);
    } else {
      process.exitCode = 2;
    }
  }
  if (process.exitCode !== 2 && ![200, 201].includes(execution.statusCode)) {
    throw new Error(`Tool confirmation failed (${execution.statusCode}): ${execution.payload}`);
  }
  if ([200, 201].includes(execution.statusCode)) {
    const confirmed = execution.json();
    for (const message of confirmed.continuationMessages ?? []) {
      console.log(`${message.role.toUpperCase()}: ${message.content}`);
    }
    console.log(`FINAL RUN: ${confirmed.agentRun?.run?.status ?? "unknown"}`);
    if (confirmed.agentRun?.run?.status !== "completed") {
      throw new Error("Confirmed tool result did not complete the Agent continuation.");
    }
  }
} finally {
  await app.close();
  if (process.argv.includes("--keep")) {
    console.log(`TEST ROOT: ${libraryRoot}`);
  } else {
    await rm(libraryRoot, { recursive: true, force: true });
  }
}
