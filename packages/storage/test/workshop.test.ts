import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository, StorageError } from "../src/index.js";
import {
  workshopAgentRunPath,
  workshopContextBasketPath,
  workshopMessagePath,
} from "../src/workshopFiles.js";

const temporaryDirectories: string[] = [];

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-workshop-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

function seriesRoot(store: ProjectRepository, title: string, seriesId: string): string {
  return path.join(store.libraryRoot, `${title}-${seriesId.slice(0, 8)}`);
}

function textHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function workshopAttachment(overrides: Partial<Record<string, unknown>> = {}) {
  const text = typeof overrides.extractedText === "string"
    ? overrides.extractedText
    : "Parsed attachment text.";
  const parseStatus = typeof overrides.parseStatus === "string" ? overrides.parseStatus : "parsed";
  return {
    schemaVersion: 1,
    id: randomUUID(),
    seriesId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    messageId: null,
    draftToken: "draft-1",
    fileName: "notes.md",
    mediaType: "text/markdown",
    sizeBytes: 24,
    textHash: parseStatus === "parsed" ? textHash(text) : null,
    extractedText: parseStatus === "parsed" ? text : "",
    parseStatus,
    parseWarnings: [],
    parseError: parseStatus === "parsed" ? null : "Attachment did not parse.",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    ...overrides,
  };
}

function agentRun(input: {
  seriesId: string;
  sessionId: string;
  authorMessageId: string;
  status?: "running" | "completed";
}) {
  const timestamp = "2026-07-13T00:00:00.000Z";
  const completed = input.status === "completed";
  const stepId = randomUUID();
  return {
    schemaVersion: 1 as const,
    id: randomUUID(),
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    authorMessageId: input.authorMessageId,
    status: completed ? "completed" as const : "running" as const,
    modelProfileId: randomUUID(),
    modelOverride: null,
    parameters: {},
    contextBundleId: randomUUID(),
    promptTemplateId: randomUUID(),
    promptTemplateVersion: 1,
    promptSnapshot: {
      system: "Workshop Agent",
      instructions: "Return one structured step.",
      user: "Talk through this scene.",
      hash: textHash("Workshop Agent\nReturn one structured step.\nTalk through this scene."),
    },
    activeStepId: completed ? null : stepId,
    steps: [{
      schemaVersion: 1 as const,
      id: stepId,
      index: 0,
      kind: "model" as const,
      status: completed ? "succeeded" as const : "running" as const,
      attempt: 1,
      modelCallId: randomUUID(),
      promptSnapshot: {
        system: "Workshop Agent",
        instructions: "Return one structured step.",
        user: "Talk through this scene.",
        hash: textHash("Workshop Agent\nReturn one structured step.\nTalk through this scene."),
      },
      messageId: completed ? randomUUID() : null,
      inputMessageIds: [input.authorMessageId],
      degradedStructuredOutput: false,
      retryable: false,
      errorCode: null,
      errorMessage: null,
      startedAt: timestamp,
      completedAt: completed ? timestamp : null,
    }],
    degradedStructuredOutput: false,
    retryable: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: completed ? timestamp : null,
  };
}

async function saveServerWorkshopMessage(
  store: ProjectRepository,
  seriesId: string,
  sessionId: string,
  input: {
    role: "assistant" | "system" | "tool" | "result";
    mode?: "general-chat" | "agent";
    content: string;
    createdAt?: string;
    proposalIds?: string[];
    status?: "pending" | "succeeded" | "failed";
  },
) {
  return store.saveWorkshopMessage(seriesId, {
    schemaVersion: 1,
    id: randomUUID(),
    seriesId,
    sessionId,
    role: input.role,
    mode: input.mode ?? "general-chat",
    status: input.status ?? "succeeded",
    content: input.content,
    reasoningContent: "",
    contextBundleId: null,
    modelCallId: null,
    proposalIds: input.proposalIds ?? [],
    attachmentIds: [],
    errorCode: null,
    errorMessage: null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("M5 Workshop storage", () => {
  it("isolates a routeable schema-invalid Workshop message to its owning session", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopMessageSessionIsolation" });
    const validSession = await store.createWorkshopSession(series.manifest.id, {
      title: "Valid session",
    });
    const damagedSession = await store.createWorkshopSession(series.manifest.id, {
      title: "Legacy damaged session",
    });
    const validMessage = await store.createWorkshopMessage(
      series.manifest.id,
      validSession.id,
      {
        role: "author",
        mode: "general-chat",
        content: "This session remains readable.",
      },
    );
    const root = seriesRoot(store, "WorkshopMessageSessionIsolation", series.manifest.id);
    const damagedMessageId = randomUUID();
    const damagedPath = workshopMessagePath(root, damagedMessageId);
    const damagedRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: damagedMessageId,
      seriesId: series.manifest.id,
      sessionId: damagedSession.id,
      role: "assistant",
      mode: "codex-creation",
      content: "Legacy message with a removed mode.",
      createdAt: "2026-07-18T00:00:00.000Z",
    }, null, 2)}\n`;
    await writeFile(damagedPath, damagedRaw, "utf8");

    await expect(store.listWorkshopMessages(series.manifest.id, validSession.id))
      .resolves.toEqual([expect.objectContaining({ id: validMessage.id })]);
    await expect(store.listWorkshopMessages(series.manifest.id, damagedSession.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(damagedPath, "utf8")).toBe(damagedRaw);
  });

  it("persists isolated General Chat prompts and rejects Agent prompt updates", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopPromptIsolation" });
    const first = await store.createWorkshopSession(series.manifest.id, {
      title: "First chat",
      generalChatSystemPrompt: "First prompt.",
    });
    const second = await store.createWorkshopSession(series.manifest.id, {
      title: "Second chat",
      generalChatSystemPrompt: "Second prompt.",
    });
    const agent = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Agent",
    });

    expect(first).toMatchObject({
      schemaVersion: 3,
      generalChatSystemPrompt: "First prompt.",
      activeResearchDatabaseIds: [],
    });
    expect(second.generalChatSystemPrompt).toBe("Second prompt.");
    expect(agent.generalChatSystemPrompt).toBeNull();

    const updated = await store.updateWorkshopSession(series.manifest.id, first.id, {
      generalChatSystemPrompt: "Updated first prompt.",
    });
    expect(updated.generalChatSystemPrompt).toBe("Updated first prompt.");
    expect((await store.getWorkshopSession(series.manifest.id, second.id)).generalChatSystemPrompt)
      .toBe("Second prompt.");
    await expect(store.updateWorkshopSession(series.manifest.id, agent.id, {
      generalChatSystemPrompt: "Invalid Agent prompt.",
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Agent sessions cannot own a General Chat system prompt",
    });

    const manuallyRenamed = await store.updateWorkshopSession(series.manifest.id, first.id, {
      title: "Manual title",
    });
    const staleAutomaticRename = await store.updateWorkshopSession(series.manifest.id, first.id, {
      title: "Automatic title",
      expectedTitle: "First chat",
    });
    expect(staleAutomaticRename).toEqual(manuallyRenamed);
    expect((await store.getWorkshopSession(series.manifest.id, first.id)).title).toBe("Manual title");
  });

  it("keeps archived Workshop sessions read-only while preserving read, restore, and permanent delete paths", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ArchivedWorkshopReadOnly" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Archived chat",
      generalChatSystemPrompt: "Original prompt.",
    });
    const authorMessage = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Keep this archived history readable.",
    });
    const attachment = await store.createWorkshopAttachment(
      series.manifest.id,
      session.id,
      workshopAttachment({
        seriesId: series.manifest.id,
        sessionId: session.id,
        draftToken: "archived-draft",
      }),
    );
    const basketBeforeArchive = await store.getWorkshopContextBasket(series.manifest.id, session.id);
    const archived = await store.archiveWorkshopSession(series.manifest.id, session.id);

    await expect(store.updateWorkshopSession(series.manifest.id, session.id, {
      title: "Renamed while archived",
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Archived Workshop session cannot be updated",
    });
    await expect(store.updateWorkshopSession(series.manifest.id, session.id, {
      generalChatSystemPrompt: "Changed while archived.",
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Archived Workshop session cannot be updated",
    });
    await expect(store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: authorMessage.id,
      title: "Forbidden archived branch",
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Archived Workshop session cannot be branched",
    });
    await expect(store.updateWorkshopContextBasket(series.manifest.id, session.id, {
      items: [],
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Archived Workshop session cannot update context",
    });
    await expect(store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Forbidden archived message.",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      content: "Forbidden archived assistant message.",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.createWorkshopAttachment(
      series.manifest.id,
      session.id,
      workshopAttachment({
        seriesId: series.manifest.id,
        sessionId: session.id,
        draftToken: "forbidden-archived-draft",
      }),
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.deleteWorkshopAttachment(series.manifest.id, session.id, attachment.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.deleteWorkshopMessage(series.manifest.id, session.id, authorMessage.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.replaceWorkshopGeneralChatAuthorMessage(
      series.manifest.id,
      session.id,
      authorMessage.id,
      "Forbidden archived resend.",
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    expect(await store.getWorkshopSession(series.manifest.id, session.id)).toEqual(archived);
    expect(await store.listWorkshopMessages(series.manifest.id, session.id)).toEqual([authorMessage]);
    expect(await store.listWorkshopAttachments(series.manifest.id, session.id)).toEqual([attachment]);
    expect(await store.getWorkshopContextBasket(series.manifest.id, session.id)).toEqual(basketBeforeArchive);
    expect(await store.listWorkshopBranches(series.manifest.id)).toEqual([]);

    await expect(store.restoreWorkshopSession(series.manifest.id, session.id)).resolves.toMatchObject({
      status: "active",
      archivedAt: null,
    });
    await expect(store.updateWorkshopSession(series.manifest.id, session.id, {
      title: "Restored chat",
      generalChatSystemPrompt: "Restored prompt.",
    })).resolves.toMatchObject({
      title: "Restored chat",
      generalChatSystemPrompt: "Restored prompt.",
    });
    await expect(store.updateWorkshopContextBasket(series.manifest.id, session.id, {
      items: [],
    })).resolves.toMatchObject({ sessionId: session.id, items: [] });

    await store.archiveWorkshopSession(series.manifest.id, session.id);
    const deleted = await store.deleteWorkshopSession(series.manifest.id, session.id);
    expect(deleted).toMatchObject({
      deletedId: session.id,
      deletedMessageIds: [authorMessage.id],
      deletedAttachmentIds: [attachment.id],
    });
    await expect(store.getWorkshopSession(series.manifest.id, session.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });

  it("rejects direct Agent run updates after the owning Workshop session is archived", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ArchivedWorkshopAgentRun" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Archived Agent",
    });
    const authorMessage = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "agent",
      content: "Complete this run before archival.",
    });
    const createdRun = await store.createWorkshopAgentRun(series.manifest.id, agentRun({
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessageId: authorMessage.id,
      status: "completed",
    }));
    await store.archiveWorkshopSession(series.manifest.id, session.id);

    await expect(store.updateWorkshopAgentRun(
      series.manifest.id,
      session.id,
      createdRun.run.id,
      createdRun.revision,
      createdRun.run,
    )).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Archived Workshop session cannot update Agent runs",
    });
    expect(await store.getWorkshopAgentRun(series.manifest.id, session.id, createdRun.run.id))
      .toEqual(createdRun);
  });

  it("persists sessions and messages as reloadable JSON authority", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopStorage" });
    const scene = series.scenes[0]!;
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Reloadable chat",
      sceneId: scene.metadata.id,
    });
    const message = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      content: "Check this scene for continuity.",
    });

    const reloaded = new ProjectRepository(store.libraryRoot);
    const sessions = await reloaded.listWorkshopSessions(series.manifest.id);
    expect(sessions.map((item) => item.id)).toContain(session.id);
    expect(sessions.find((item) => item.id === session.id)?.lastMessageAt).toBe(message.createdAt);
    const messages = await reloaded.listWorkshopMessages(series.manifest.id, session.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: message.id,
      role: "author",
      content: "Check this scene for continuity.",
      proposalIds: [],
    });
  });

  it("persists revision-bound Workshop Agent runs across repository restart", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "AgentRunPersistence" });
    const session = await store.createWorkshopSession(series.manifest.id, { kind: "agent", title: "Agent run" });
    const author = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "agent",
      content: "Talk through this scene.",
    });
    const created = await store.createWorkshopAgentRun(series.manifest.id, agentRun({
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessageId: author.id,
    }));

    const reloaded = new ProjectRepository(store.libraryRoot);
    const loaded = await reloaded.getWorkshopAgentRun(series.manifest.id, session.id, created.run.id);
    expect(loaded).toEqual(created);
    const completedAt = new Date(Date.parse(author.createdAt) + 1_000).toISOString();
    const completedRun = {
      ...loaded.run,
      status: "completed" as const,
      activeStepId: null,
      steps: loaded.run.steps.map((step) => ({
        ...step,
        status: "succeeded" as const,
        messageId: randomUUID(),
        completedAt,
      })),
      updatedAt: completedAt,
      completedAt,
    };
    const updated = await reloaded.updateWorkshopAgentRun(
      series.manifest.id,
      session.id,
      loaded.run.id,
      loaded.revision,
      completedRun,
    );
    expect(updated.run.status).toBe("completed");
    await expect(reloaded.updateWorkshopAgentRun(
      series.manifest.id,
      session.id,
      loaded.run.id,
      loaded.revision,
      completedRun,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    await expect(reloaded.updateWorkshopAgentRun(
      series.manifest.id,
      session.id,
      updated.run.id,
      updated.revision,
      { ...updated.run, modelOverride: "different-model" },
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    const restartedAt = new Date(Date.parse(completedAt) + 1_000).toISOString();
    const appendedStep = {
      ...updated.run.steps[0]!,
      id: randomUUID(),
      index: 1,
      kind: "continuation" as const,
      status: "running" as const,
      attempt: 2,
      modelCallId: randomUUID(),
      messageId: null,
      inputMessageIds: [updated.run.steps[0]!.messageId!],
      retryable: false,
      errorCode: null,
      errorMessage: null,
      startedAt: restartedAt,
      completedAt: null,
    };
    await expect(reloaded.updateWorkshopAgentRun(
      series.manifest.id,
      session.id,
      updated.run.id,
      updated.revision,
      {
        ...updated.run,
        status: "running",
        activeStepId: appendedStep.id,
        steps: [...updated.run.steps, appendedStep],
        updatedAt: restartedAt,
        completedAt: null,
      },
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("detaches Agent run links when branching and deletes runs with their source session", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "AgentRunLifecycle" });
    const session = await store.createWorkshopSession(series.manifest.id, { kind: "agent", title: "Source" });
    const author = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "agent",
      content: "Discuss the scene.",
    });
    const created = await store.createWorkshopAgentRun(series.manifest.id, agentRun({
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessageId: author.id,
    }));
    const assistantMessageId = randomUUID();
    const completedAt = new Date(Date.parse(author.createdAt) + 1_000).toISOString();
    const completedRun = {
      ...created.run,
      status: "completed" as const,
      activeStepId: null,
      steps: created.run.steps.map((step) => ({
        ...step,
        status: "succeeded" as const,
        messageId: assistantMessageId,
        completedAt,
      })),
      updatedAt: completedAt,
      completedAt,
    };
    await store.commitWorkshopAgentRunEffects(
      series.manifest.id,
      session.id,
      created.run.id,
      created.revision,
      completedRun,
      [{
        schemaVersion: 1,
        id: assistantMessageId,
        seriesId: series.manifest.id,
        sessionId: session.id,
        role: "assistant",
        mode: "agent",
        status: "succeeded",
        content: "The scene can proceed without a Codex change.",
        reasoningContent: "",
        contextBundleId: created.run.contextBundleId,
        modelCallId: created.run.steps[0]!.modelCallId,
        agentRunId: created.run.id,
        agentStepId: created.run.steps[0]!.id,
        proposalIds: [],
        attachmentIds: [],
        errorCode: null,
        errorMessage: null,
        createdAt: completedAt,
      }],
    );

    const branch = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: assistantMessageId,
      title: "Independent branch",
    });
    const branchMessages = await store.listWorkshopMessages(series.manifest.id, branch.session.id);
    expect(branchMessages).toHaveLength(2);
    expect(branchMessages.every((message) => message.agentRunId === null && message.agentStepId === null)).toBe(true);

    await store.deleteWorkshopSession(series.manifest.id, session.id);
    await expect(store.getWorkshopAgentRun(series.manifest.id, session.id, created.run.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    expect(await store.listWorkshopMessages(series.manifest.id, branch.session.id)).toHaveLength(2);
  });

  it("rejects stale and cross-session Agent run updates", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "AgentRunOwnership" });
    const session = await store.createWorkshopSession(series.manifest.id, { kind: "agent", title: "First" });
    const other = await store.createWorkshopSession(series.manifest.id, { kind: "agent", title: "Second" });
    const author = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "agent",
      content: "Continue.",
    });
    const created = await store.createWorkshopAgentRun(series.manifest.id, agentRun({
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessageId: author.id,
    }));
    await expect(store.getWorkshopAgentRun(series.manifest.id, other.id, created.run.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.updateWorkshopAgentRun(
      series.manifest.id,
      other.id,
      created.run.id,
      created.revision,
      { ...created.run, sessionId: other.id },
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("isolates damaged Agent run records without rewriting them", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "AgentRunDamage" });
    const session = await store.createWorkshopSession(series.manifest.id, { kind: "agent", title: "Damage" });
    const author = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "agent",
      content: "Continue.",
    });
    const created = await store.createWorkshopAgentRun(series.manifest.id, agentRun({
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessageId: author.id,
      status: "completed",
    }));
    const root = seriesRoot(store, "AgentRunDamage", series.manifest.id);
    const damagedId = randomUUID();
    await writeFile(workshopAgentRunPath(root, damagedId), "{not-json\n", "utf8");

    const listed = await store.listWorkshopAgentRuns(series.manifest.id, session.id);
    expect(listed.runs.map((document) => document.run.id)).toEqual([created.run.id]);
    expect(listed.diagnostics).toEqual([expect.objectContaining({
      fileName: `${damagedId}.json`,
      code: "INVALID_DATA",
    })]);
    await expect(store.getWorkshopAgentRun(series.manifest.id, session.id, damagedId))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("reconciles unfinished Agent runs and running tools without replay", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "AgentRunRecovery" });
    const session = await store.createWorkshopSession(series.manifest.id, { kind: "agent", title: "Recovery" });
    const author = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "agent",
      content: "Create the keeper.",
    });
    const created = await store.createWorkshopAgentRun(series.manifest.id, agentRun({
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessageId: author.id,
    }));
    const toolMessage = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "tool",
      mode: "agent",
      content: JSON.stringify({ schemaVersion: 1, tool: "codex.create_entry", draft: { name: "Keeper" } }),
    });
    await store.claimWorkshopMessageToolExecution(
      series.manifest.id,
      session.id,
      toolMessage.id,
      textHash(toolMessage.content),
    );

    const restarted = new ProjectRepository(store.libraryRoot);
    const reconciled = await restarted.reconcileWorkshopAgentRuns(series.manifest.id, session.id);
    const run = reconciled.runs.find((document) => document.run.id === created.run.id)?.run;
    expect(run).toMatchObject({ status: "interrupted", retryable: true, activeStepId: null });
    expect(run?.steps[0]).toMatchObject({ status: "interrupted", retryable: true });
    const messages = await restarted.listWorkshopMessages(series.manifest.id, session.id);
    expect(messages.find((message) => message.id === toolMessage.id)?.toolExecution).toMatchObject({
      status: "interrupted",
      retryable: true,
      attempt: 1,
    });
    expect(messages.filter((message) => message.role === "result")).toHaveLength(0);
    const reclaimed = await restarted.claimWorkshopMessageToolExecution(
      series.manifest.id,
      session.id,
      toolMessage.id,
      textHash(toolMessage.content),
    );
    expect(reclaimed.status).toBe("claimed");
    expect(reclaimed.message.toolExecution).toMatchObject({
      status: "running",
      retryable: false,
      attempt: 2,
    });
  });

  it("persists author-cancelled Agent runs without failure details or retry eligibility", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "AgentRunCancellation" });
    const session = await store.createWorkshopSession(series.manifest.id, { kind: "agent", title: "Cancellation" });
    const author = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "agent",
      content: "Stop this run.",
    });
    const created = await store.createWorkshopAgentRun(series.manifest.id, agentRun({
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessageId: author.id,
    }));
    const cancelledAt = new Date().toISOString();
    const cancelled = await store.updateWorkshopAgentRun(
      series.manifest.id,
      session.id,
      created.run.id,
      created.revision,
      {
        ...created.run,
        status: "cancelled",
        activeStepId: null,
        steps: created.run.steps.map((step) => ({
          ...step,
          status: "cancelled",
          retryable: false,
          errorCode: null,
          errorMessage: null,
          completedAt: cancelledAt,
        })),
        retryable: false,
        updatedAt: cancelledAt,
        completedAt: cancelledAt,
      },
    );
    expect(cancelled.run).toMatchObject({ schemaVersion: 2, status: "cancelled", retryable: false });
    expect(cancelled.run.steps[0]).toMatchObject({
      schemaVersion: 2,
      status: "cancelled",
      errorCode: null,
      errorMessage: null,
    });
  });

  it("migrates Workshop message and Agent run authority to version 2 and restores exact version 1 files", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopV2Migration" });
    const session = await store.createWorkshopSession(series.manifest.id, { kind: "agent", title: "Migration" });
    const author = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "agent",
      content: "Migrate this history.",
    });
    const root = seriesRoot(store, "WorkshopV2Migration", series.manifest.id);
    const legacyMessageId = randomUUID();
    const legacyMessagePath = workshopMessagePath(root, legacyMessageId);
    await mkdir(path.dirname(legacyMessagePath), { recursive: true });
    const legacyMessageRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: legacyMessageId,
      seriesId: series.manifest.id,
      sessionId: session.id,
      role: "assistant",
      mode: "agent",
      status: "succeeded",
      content: "Legacy answer.",
      reasoningContent: "Legacy reasoning.",
      contextBundleId: null,
      modelCallId: null,
      agentRunId: null,
      agentStepId: null,
      proposalIds: [],
      attachmentIds: [],
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-07-13T00:00:00.000Z",
    }, null, 2)}\n`;
    await writeFile(legacyMessagePath, legacyMessageRaw, "utf8");
    const legacyRun = agentRun({
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessageId: author.id,
      status: "completed",
    });
    const legacyRunPath = workshopAgentRunPath(root, legacyRun.id);
    await mkdir(path.dirname(legacyRunPath), { recursive: true });
    const legacyRunRaw = `${JSON.stringify(legacyRun, null, 2)}\n`;
    await writeFile(legacyRunPath, legacyRunRaw, "utf8");

    const migration = await store.migrateWorkshopAuthorityToV2(series.manifest.id);
    expect(migration.migratedMessageIds).toEqual([legacyMessageId]);
    expect(migration.migratedAgentRunIds).toEqual([legacyRun.id]);
    expect(JSON.parse(await readFile(legacyMessagePath, "utf8"))).toMatchObject({
      schemaVersion: 2,
      reasoningOutputKind: "unknown",
    });
    expect(JSON.parse(await readFile(legacyRunPath, "utf8"))).toMatchObject({ schemaVersion: 2 });

    const rollback = await store.rollbackWorkshopAuthorityV2Migration(
      series.manifest.id,
      migration.migrationId,
    );
    expect(rollback.restoredMessageIds).toEqual([legacyMessageId]);
    expect(rollback.restoredAgentRunIds).toEqual([legacyRun.id]);
    expect(await readFile(legacyMessagePath, "utf8")).toBe(legacyMessageRaw);
    expect(await readFile(legacyRunPath, "utf8")).toBe(legacyRunRaw);

    const secondMigration = await store.migrateWorkshopAuthorityToV2(series.manifest.id);
    await writeFile(legacyMessagePath, `${await readFile(legacyMessagePath, "utf8")} `, "utf8");
    await expect(store.rollbackWorkshopAuthorityV2Migration(
      series.manifest.id,
      secondMigration.migrationId,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    await writeFile(legacyMessagePath, legacyMessageRaw, "utf8");
    const missingTargetMigration = await store.migrateWorkshopAuthorityToV2(series.manifest.id);
    await rm(legacyMessagePath);
    await expect(store.rollbackWorkshopAuthorityV2Migration(
      series.manifest.id,
      missingTargetMigration.migrationId,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
  });

  it("rejects damaged Workshop migration input without rewriting valid version 1 authority", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopV2Damage" });
    const session = await store.createWorkshopSession(series.manifest.id, { title: "Damage" });
    const root = seriesRoot(store, "WorkshopV2Damage", series.manifest.id);
    const validId = randomUUID();
    const validPath = workshopMessagePath(root, validId);
    await mkdir(path.dirname(validPath), { recursive: true });
    const validRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: validId,
      seriesId: series.manifest.id,
      sessionId: session.id,
      role: "assistant",
      content: "Still valid.",
      createdAt: "2026-07-13T00:00:00.000Z",
    }, null, 2)}\n`;
    await writeFile(validPath, validRaw, "utf8");
    await writeFile(workshopMessagePath(root, randomUUID()), "{damaged-json\n", "utf8");
    await expect(store.migrateWorkshopAuthorityToV2(series.manifest.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(validPath, "utf8")).toBe(validRaw);
  });

  it("migrates public Workshop Context Basket hierarchy to version 2 and restores exact version 1 authority", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopBasketV2Migration" });
    const session = await store.createWorkshopSession(series.manifest.id, { title: "Legacy basket" });
    const root = seriesRoot(store, "WorkshopBasketV2Migration", series.manifest.id);
    const basketPath = workshopContextBasketPath(root, session.id);
    const basket = await store.getWorkshopContextBasket(series.manifest.id, session.id);
    const now = "2026-07-17T00:00:00.000Z";
    const storedActId = randomUUID();
    const storedChapterId = randomUUID();
    const legacyRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: basket.id,
      seriesId: series.manifest.id,
      sessionId: session.id,
      sceneId: null,
      blockId: null,
      selection: null,
      items: [
        {
          id: randomUUID(),
          kind: "act",
          sourceId: storedActId,
          label: "Legacy stored ActManifest",
          pinned: false,
          note: "",
          createdAt: now,
        },
        {
          id: randomUUID(),
          kind: "chapter",
          sourceId: storedChapterId,
          label: "Legacy stored ChapterManifest",
          pinned: true,
          note: "",
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }, null, 2)}\n`;
    await writeFile(basketPath, legacyRaw, "utf8");

    expect((await store.getWorkshopContextBasket(series.manifest.id, session.id)).items).toMatchObject([
      { kind: "chapter", sourceId: storedActId },
      { kind: "act", sourceId: storedChapterId },
    ]);
    expect(await readFile(basketPath, "utf8")).toBe(legacyRaw);

    const migration = await store.migrateWorkshopAuthorityToV2(series.manifest.id);
    expect(migration.migratedContextBasketIds).toEqual([basket.id]);
    expect(JSON.parse(await readFile(basketPath, "utf8"))).toMatchObject({
      schemaVersion: 2,
      items: [
        { kind: "chapter", sourceId: storedActId },
        { kind: "act", sourceId: storedChapterId },
      ],
    });
    expect((await store.rollbackWorkshopAuthorityV2Migration(
      series.manifest.id,
      migration.migrationId,
    )).restoredContextBasketIds).toEqual([basket.id]);
    expect(await readFile(basketPath, "utf8")).toBe(legacyRaw);

    const changedMigration = await store.migrateWorkshopAuthorityToV2(series.manifest.id);
    await writeFile(basketPath, `${await readFile(basketPath, "utf8")} `, "utf8");
    await expect(store.rollbackWorkshopAuthorityV2Migration(
      series.manifest.id,
      changedMigration.migrationId,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    await writeFile(basketPath, legacyRaw, "utf8");
    const missingMigration = await store.migrateWorkshopAuthorityToV2(series.manifest.id);
    await rm(basketPath);
    await expect(store.rollbackWorkshopAuthorityV2Migration(
      series.manifest.id,
      missingMigration.migrationId,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
  });

  it("rejects damaged Workshop Context Basket migration input without rewriting valid version 1 authority", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopBasketV2Damage" });
    const validSession = await store.createWorkshopSession(series.manifest.id, { title: "Valid basket" });
    const damagedSession = await store.createWorkshopSession(series.manifest.id, { title: "Damaged basket" });
    const root = seriesRoot(store, "WorkshopBasketV2Damage", series.manifest.id);
    const validPath = workshopContextBasketPath(root, validSession.id);
    const damagedPath = workshopContextBasketPath(root, damagedSession.id);
    const validBasket = await store.getWorkshopContextBasket(series.manifest.id, validSession.id);
    const now = "2026-07-17T00:00:00.000Z";
    const validRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: validBasket.id,
      seriesId: series.manifest.id,
      sessionId: validSession.id,
      sceneId: null,
      blockId: null,
      selection: null,
      items: [],
      createdAt: now,
      updatedAt: now,
    }, null, 2)}\n`;
    await writeFile(validPath, validRaw, "utf8");
    await writeFile(damagedPath, "{damaged-json\n", "utf8");

    await expect(store.migrateWorkshopAuthorityToV2(series.manifest.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(validPath, "utf8")).toBe(validRaw);
    expect(await readFile(damagedPath, "utf8")).toBe("{damaged-json\n");
  });

  it("atomically claims Agent tool execution and blocks destructive session changes while running", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopToolClaim" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Agent tool claim",
    });
    const toolMessage = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "tool",
      mode: "agent",
      content: JSON.stringify({ schemaVersion: 1, tool: "codex.create_entry", draft: { name: "Alice" } }),
    });
    const requestHash = textHash(toolMessage.content);

    const claims = await Promise.all([
      store.claimWorkshopMessageToolExecution(series.manifest.id, session.id, toolMessage.id, requestHash),
      store.claimWorkshopMessageToolExecution(series.manifest.id, session.id, toolMessage.id, requestHash),
    ]);
    expect(claims.map((claim) => claim.status).sort()).toEqual(["claimed", "existing"]);
    const claimed = claims.find((claim) => claim.status === "claimed");
    expect(claimed?.message.toolExecution).toMatchObject({ requestHash, status: "running" });
    if (!claimed?.message.toolExecution) throw new Error("Expected a claimed Workshop tool execution");

    await expect(store.archiveWorkshopSession(series.manifest.id, session.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    await expect(store.deleteWorkshopSession(series.manifest.id, session.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    await expect(store.deleteWorkshopMessage(series.manifest.id, session.id, toolMessage.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const completedAt = new Date().toISOString();
    const failedMessage = await store.updateWorkshopMessageToolExecution(
      series.manifest.id,
      session.id,
      toolMessage.id,
      {
        ...claimed.message.toolExecution,
        status: "failed",
        completedAt,
        errorCode: "TEST_FAILURE",
        errorMessage: "Injected failure after execution claim.",
      },
    );
    expect(failedMessage.toolExecution).toMatchObject({
      status: "failed",
      completedAt,
      errorCode: "TEST_FAILURE",
    });
    await expect(store.archiveWorkshopSession(series.manifest.id, session.id)).resolves.toMatchObject({
      status: "archived",
    });
  });

  it("preserves successful Agent tool result links across deletion and branching", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopToolResultLink" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Agent tool result",
    });
    const toolMessage = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "tool",
      mode: "agent",
      content: JSON.stringify({ schemaVersion: 1, tool: "codex.create_entry", draft: { name: "Alice" } }),
    });
    const claim = await store.claimWorkshopMessageToolExecution(
      series.manifest.id,
      session.id,
      toolMessage.id,
      textHash(toolMessage.content),
    );
    expect(claim.status).toBe("claimed");
    if (!claim.message.toolExecution) throw new Error("Expected a claimed Workshop tool execution");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const resultMessage = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "result",
      mode: "agent",
      content: "codex.create_entry created Codex entry: Alice",
    });
    const succeededToolMessage = await store.updateWorkshopMessageToolExecution(
      series.manifest.id,
      session.id,
      toolMessage.id,
      {
        ...claim.message.toolExecution,
        status: "succeeded",
        completedAt: new Date().toISOString(),
        resultMessageId: resultMessage.id,
      },
    );
    expect(succeededToolMessage.toolExecution?.resultMessageId).toBe(resultMessage.id);

    await expect(store.deleteWorkshopMessage(series.manifest.id, session.id, resultMessage.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: toolMessage.id,
      title: "Incomplete tool history",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const branch = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: resultMessage.id,
      title: "Complete tool history",
    });
    const branchedMessages = await store.listWorkshopMessages(series.manifest.id, branch.session.id);
    const branchedTool = branchedMessages.find((message) => message.role === "tool");
    const branchedResult = branchedMessages.find((message) => message.role === "result");
    expect(branchedTool?.toolExecution).toMatchObject({
      status: "succeeded",
      resultMessageId: branchedResult?.id,
    });
    expect(branchedTool?.toolExecution?.resultMessageId).not.toBe(resultMessage.id);

    await store.deleteWorkshopSession(series.manifest.id, session.id);
    const reloadedBranchMessages = await store.listWorkshopMessages(series.manifest.id, branch.session.id);
    const reloadedTool = reloadedBranchMessages.find((message) => message.role === "tool");
    expect(reloadedBranchMessages.some((message) => message.id === reloadedTool?.toolExecution?.resultMessageId))
      .toBe(true);
  });

  it("accepts only author-authored messages through the public create helper", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopMessageAuthorOnly" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Author-only thread",
    });

    await expect(store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Forged assistant reply.",
    } as Parameters<ProjectRepository["createWorkshopMessage"]>[2])).rejects.toThrow();
    expect(await store.listWorkshopMessages(series.manifest.id, session.id)).toEqual([]);
  });

  it("creates a branch session from a source message", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopBranch" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Original thread",
      sceneId: series.scenes[0]!.metadata.id,
      generalChatSystemPrompt: "Branch-owned prompt.",
    });
    const attachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "branch-draft",
      extractedText: "Attachment copied into a branch.",
      textHash: textHash("Attachment copied into a branch."),
    }));
    const authorMessage = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Use this source attachment.",
      attachmentIds: [attachment.id],
      draftToken: "branch-draft",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const message = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Branch from this answer.",
    });

    const result = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: message.id,
      title: "Alternative thread",
    });
    expect(result.session.title).toBe("Alternative thread");
    expect(result.session.branchOfMessageId).toBe(message.id);
    expect(result.branch).toMatchObject({
      sourceSessionId: session.id,
      sourceMessageId: message.id,
      sessionId: result.session.id,
    });
    expect(result.session.lastMessageAt).toBe(message.createdAt);
    expect(result.session.generalChatSystemPrompt).toBe("Branch-owned prompt.");
    const branchedMessages = await store.listWorkshopMessages(series.manifest.id, result.session.id);
    expect(branchedMessages.map((item) => item.content)).toEqual([
      "Use this source attachment.",
      "Branch from this answer.",
    ]);
    expect(branchedMessages.map((item) => item.id)).not.toEqual([authorMessage.id, message.id]);
    expect(branchedMessages.every((item) => item.sessionId === result.session.id)).toBe(true);
    expect(branchedMessages.every((item) => item.proposalIds.length === 0)).toBe(true);

    const branchedAttachments = await store.listWorkshopAttachments(series.manifest.id, result.session.id);
    expect(branchedAttachments).toHaveLength(1);
    expect(branchedAttachments[0]).toMatchObject({
      sessionId: result.session.id,
      messageId: branchedMessages[0]!.id,
      extractedText: "Attachment copied into a branch.",
      parseStatus: "parsed",
    });
    expect(branchedAttachments[0]?.id).not.toBe(attachment.id);
    expect(branchedMessages[0]?.attachmentIds).toEqual([branchedAttachments[0]?.id]);
  });

  it("permanently deletes unlinked Workshop sessions and clears branch source pointers", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopDeleteSession" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Delete this thread",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const attachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "delete-session-draft",
      extractedText: "Session attachment should be deleted.",
      textHash: textHash("Session attachment should be deleted."),
    }));
    await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Delete this source question.",
      attachmentIds: [attachment.id],
      draftToken: "delete-session-draft",
    });
    const assistant = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Delete this source answer.",
    });
    const branch = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: assistant.id,
      title: "Keep branch copy",
    });

    const deleted = await store.deleteWorkshopSession(series.manifest.id, session.id);
    expect(deleted.deletedId).toBe(session.id);
    expect(deleted.deletedMessageIds).toEqual(expect.arrayContaining([assistant.id]));
    expect(deleted.deletedAttachmentIds).toEqual([attachment.id]);
    expect(deleted.deletedBranchIds).toEqual([branch.branch.id]);
    await expect(store.getWorkshopSession(series.manifest.id, session.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    await expect(store.getWorkshopAttachment(series.manifest.id, attachment.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    expect(await store.listWorkshopBranches(series.manifest.id)).toEqual([]);
    const branchSession = await store.getWorkshopSession(series.manifest.id, branch.session.id);
    expect(branchSession.title).toBe("Keep branch copy");
    expect(branchSession.branchOfMessageId).toBeNull();
    expect(await store.listWorkshopMessages(series.manifest.id, branch.session.id)).toHaveLength(2);
  });

  it("deletes complete General Chat turns without orphaning attachments, branches, or history", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopDeleteMessage" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "General chat thread",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const firstAuthor = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Delete this question with its answer.",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const firstAssistant = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Delete this answer.",
    });
    const branch = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: firstAssistant.id,
      title: "Detached after source turn deletion",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondAuthor = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Keep this later question.",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondAssistant = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Keep this later answer.",
    });

    const deleted = await store.deleteWorkshopMessage(series.manifest.id, session.id, firstAssistant.id);
    expect(deleted.deletedMessageIds).toEqual([firstAuthor.id, firstAssistant.id]);
    expect(deleted.deletedBranchIds).toEqual([branch.branch.id]);
    expect(deleted.session.lastMessageAt).toBe(secondAssistant.createdAt);
    expect((await store.listWorkshopMessages(series.manifest.id, session.id)).map((message) => message.id))
      .toEqual([secondAuthor.id, secondAssistant.id]);
    expect(await store.listWorkshopBranches(series.manifest.id)).toEqual([]);
    expect((await store.getWorkshopSession(series.manifest.id, branch.session.id)).branchOfMessageId).toBeNull();

    const deletedSecondTurn = await store.deleteWorkshopMessage(series.manifest.id, session.id, secondAuthor.id);
    expect(deletedSecondTurn.deletedMessageIds).toEqual([secondAuthor.id, secondAssistant.id]);
    expect(deletedSecondTurn.session.lastMessageAt).toBeNull();
    expect(await store.listWorkshopMessages(series.manifest.id, session.id)).toEqual([]);

    const agentSession = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Protected Agent history",
    });
    const agentAuthor = await store.createWorkshopMessage(series.manifest.id, agentSession.id, {
      role: "author",
      mode: "agent",
      content: "Keep this Agent turn.",
    });
    await expect(store.deleteWorkshopMessage(series.manifest.id, agentSession.id, agentAuthor.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const protectedSession = await store.createWorkshopSession(series.manifest.id, {
      title: "Proposal-linked turn",
    });
    const protectedAuthor = await store.createWorkshopMessage(series.manifest.id, protectedSession.id, {
      role: "author",
      mode: "general-chat",
      content: "Keep this linked turn.",
    });
    await saveServerWorkshopMessage(store, series.manifest.id, protectedSession.id, {
      role: "assistant",
      mode: "general-chat",
      content: "This answer is linked.",
      proposalIds: ["88888888-8888-4888-8888-888888888888"],
    });
    await expect(store.deleteWorkshopMessage(series.manifest.id, protectedSession.id, protectedAuthor.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("resends a General Chat author message by replacing it and truncating later history", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopResendMessage" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "General chat thread",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const first = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Original question.",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const firstAnswer = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Original answer.",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const laterAttachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "resend-draft",
      extractedText: "Later attachment should be removed.",
      textHash: textHash("Later attachment should be removed."),
    }));
    const laterQuestion = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Later question.",
      attachmentIds: [laterAttachment.id],
      draftToken: "resend-draft",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const laterAnswer = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Later answer.",
    });
    const branch = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: firstAnswer.id,
      title: "Old answer branch",
    });

    const result = await store.replaceWorkshopGeneralChatAuthorMessage(
      series.manifest.id,
      session.id,
      first.id,
      "  Updated question.  ",
    );

    expect(result.message).toMatchObject({
      id: first.id,
      content: "Updated question.",
      role: "author",
      mode: "general-chat",
    });
    expect(result.session.lastMessageAt).toBe(first.createdAt);
    expect(result.deletedMessageIds).toEqual([firstAnswer.id, laterQuestion.id, laterAnswer.id]);
    expect(result.deletedAttachmentIds).toEqual([laterAttachment.id]);
    expect(result.deletedBranchIds).toEqual([branch.branch.id]);
    expect((await store.listWorkshopMessages(series.manifest.id, session.id)).map((message) => message.content))
      .toEqual(["Updated question."]);
    await expect(store.getWorkshopAttachment(series.manifest.id, laterAttachment.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    expect(await store.listWorkshopBranches(series.manifest.id)).toEqual([]);
    expect((await store.getWorkshopSession(series.manifest.id, branch.session.id)).branchOfMessageId).toBeNull();
    expect(await store.listWorkshopMessages(series.manifest.id, branch.session.id)).toHaveLength(2);
  });

  it("serializes General Chat resend truncation with branching so no branch can reference deleted history", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopResendBranchRace" });
    const session = await store.createWorkshopSession(series.manifest.id, { title: "Concurrent history" });
    const firstAuthor = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Rewrite this first question.",
    });
    await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "First answer.",
    });
    const laterAuthor = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Later question.",
    });
    const laterAssistant = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Later answer.",
    });

    const [resend, branch] = await Promise.allSettled([
      store.replaceWorkshopGeneralChatAuthorMessage(
        series.manifest.id,
        session.id,
        firstAuthor.id,
        "Rewritten first question.",
      ),
      store.branchWorkshopSession(series.manifest.id, session.id, {
        sourceMessageId: laterAssistant.id,
        title: "Concurrent branch",
      }),
    ]);

    expect(resend.status).toBe("fulfilled");
    expect((await store.listWorkshopMessages(series.manifest.id, session.id)).map((message) => message.id))
      .toEqual([firstAuthor.id]);
    const sourceMessageIds = new Set(
      (await store.listWorkshopMessages(series.manifest.id, session.id)).map((message) => message.id),
    );
    expect((await store.listWorkshopBranches(series.manifest.id)).every((record) =>
      sourceMessageIds.has(record.sourceMessageId),
    )).toBe(true);
    expect((await store.listWorkshopSessions(series.manifest.id)).every((candidate) =>
      candidate.branchOfMessageId === null || sourceMessageIds.has(candidate.branchOfMessageId),
    )).toBe(true);
    if (branch.status === "fulfilled") {
      expect((await store.getWorkshopSession(series.manifest.id, branch.value.session.id)).branchOfMessageId)
        .toBeNull();
    }
    expect(laterAuthor.id).not.toBe(firstAuthor.id);
  });

  it("rejects resend outside General Chat and when later protected records would be erased", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopResendGuard" });
    const chatSession = await store.createWorkshopSession(series.manifest.id, {
      title: "Guarded chat",
    });
    const first = await store.createWorkshopMessage(series.manifest.id, chatSession.id, {
      role: "author",
      mode: "general-chat",
      content: "Original question.",
    });
    const protectedResult = await store.saveWorkshopMessage(series.manifest.id, {
      schemaVersion: 1,
      id: randomUUID(),
      seriesId: series.manifest.id,
      sessionId: chatSession.id,
      role: "result",
      mode: "general-chat",
      status: "succeeded",
      content: "Protected tool result.",
      reasoningContent: "",
      contextBundleId: null,
      modelCallId: null,
      proposalIds: [],
      attachmentIds: [],
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(new Date(first.createdAt).getTime() + 1_000).toISOString(),
    });
    await expect(store.replaceWorkshopGeneralChatAuthorMessage(
      series.manifest.id,
      chatSession.id,
      first.id,
      "Updated question.",
    )).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Workshop history after this message contains protected records",
    });
    expect((await store.listWorkshopMessages(series.manifest.id, chatSession.id)).map((message) => message.id))
      .toEqual([first.id, protectedResult.id]);

    const agentSession = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Agent thread",
    });
    const agentAuthor = await store.createWorkshopMessage(series.manifest.id, agentSession.id, {
      role: "author",
      mode: "agent",
      content: "Draft a Codex entry.",
    });
    await expect(store.replaceWorkshopGeneralChatAuthorMessage(
      series.manifest.id,
      agentSession.id,
      agentAuthor.id,
      "Updated Agent request.",
    )).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Only General Chat sessions can resend messages",
    });
  });

  it("persists and deletes draft Workshop message attachments", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopAttachmentDraft" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Attachment draft",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const created = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      extractedText: "This markdown attachment is ready.",
      textHash: textHash("This markdown attachment is ready."),
    }));

    const reloaded = new ProjectRepository(store.libraryRoot);
    const attachments = await reloaded.listWorkshopAttachments(series.manifest.id, session.id, {
      draftToken: "draft-1",
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      id: created.id,
      messageId: null,
      parseStatus: "parsed",
      extractedText: "This markdown attachment is ready.",
    });

    const deleted = await reloaded.deleteWorkshopAttachment(series.manifest.id, session.id, created.id);
    expect(deleted.deletedId).toBe(created.id);
    expect(await reloaded.listWorkshopAttachments(series.manifest.id, session.id)).toEqual([]);
  });

  it("binds parsed draft attachments to messages and cascades unlinked message deletion", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopAttachmentBind" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Attachment bind",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const attachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "draft-bind",
      extractedText: "Bound attachment text.",
      textHash: textHash("Bound attachment text."),
    }));
    const failedAttachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "draft-failed",
      fileName: "scan.pdf",
      mediaType: "application/pdf",
      parseStatus: "failed",
      textHash: null,
      extractedText: "",
      parseError: "PDF has no extractable text; OCR is required.",
    }));
    const otherSession = await store.createWorkshopSession(series.manifest.id, {
      title: "Other session",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const otherAttachment = await store.createWorkshopAttachment(series.manifest.id, otherSession.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: otherSession.id,
      draftToken: "draft-bind",
    }));

    await expect(store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Wrong draft token.",
      attachmentIds: [attachment.id],
      draftToken: "other-draft",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Failed attachment.",
      attachmentIds: [failedAttachment.id],
      draftToken: "draft-failed",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Cross-session attachment.",
      attachmentIds: [otherAttachment.id],
      draftToken: "draft-bind",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const message = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Use the attachment.",
      attachmentIds: [attachment.id],
      draftToken: "draft-bind",
    });
    expect(message.attachmentIds).toEqual([attachment.id]);
    const boundAttachment = await store.getWorkshopAttachment(series.manifest.id, attachment.id);
    expect(boundAttachment.messageId).toBe(message.id);
    await expect(store.deleteWorkshopAttachment(series.manifest.id, session.id, attachment.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const deleted = await store.deleteWorkshopMessage(series.manifest.id, session.id, message.id);
    expect(deleted.deletedAttachmentIds).toEqual([attachment.id]);
    await expect(store.getWorkshopAttachment(series.manifest.id, attachment.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });

  it("updates context basket refs and rejects missing scene targets", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopBasket" });
    const volume = series.books[0]!;
    const act = series.acts[0]!;
    const chapter = series.chapters[0]!;
    const scene = series.scenes[0]!;
    const codexEntry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Captain Veyr",
      aiContextPolicy: "manual",
    });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Context thread",
      sceneId: scene.metadata.id,
    });
    const createdAt = "2026-07-01T00:00:00.000Z";
    const items = [
      { id: "11111111-1111-4111-8111-111111111111", kind: "full-novel" as const, sourceId: series.manifest.id, label: "Full novel", pinned: false, note: "", createdAt },
      { id: "22222222-2222-4222-8222-222222222222", kind: "full-outline" as const, sourceId: series.manifest.id, label: "Full outline", pinned: false, note: "", createdAt },
      { id: "33333333-3333-4333-8333-333333333333", kind: "volume" as const, sourceId: volume.id, label: volume.title, pinned: false, note: "", createdAt },
      { id: "44444444-4444-4444-8444-444444444444", kind: "chapter" as const, sourceId: act.id, label: act.title, pinned: false, note: "", createdAt },
      { id: "55555555-5555-4555-8555-555555555555", kind: "act" as const, sourceId: chapter.id, label: chapter.title, pinned: false, note: "", createdAt },
      { id: "66666666-6666-4666-8666-666666666666", kind: "scene" as const, sourceId: scene.metadata.id, label: scene.metadata.title, pinned: false, note: "", createdAt },
      { id: "77777777-7777-4777-8777-777777777777", kind: "codex-entry" as const, sourceId: codexEntry.metadata.id, label: codexEntry.metadata.name, pinned: false, note: "", createdAt },
    ];

    const basket = await store.updateWorkshopContextBasket(series.manifest.id, session.id, {
      items,
    });
    expect(basket.items.map((item) => item.kind)).toEqual([
      "full-novel",
      "full-outline",
      "volume",
      "chapter",
      "act",
      "scene",
      "codex-entry",
    ]);
    const basketAuthority = JSON.parse(await readFile(
      workshopContextBasketPath(
        seriesRoot(store, "WorkshopBasket", series.manifest.id),
        session.id,
      ),
      "utf8",
    )) as { schemaVersion: number; items: Array<{ kind: string }> };
    expect(basketAuthority.schemaVersion).toBe(2);
    expect(basketAuthority.items.map((item) => item.kind)).toEqual([
      "full-novel",
      "full-outline",
      "volume",
      "chapter",
      "act",
      "scene",
      "codex-entry",
    ]);

    const pinned = await store.updateWorkshopContextBasket(series.manifest.id, session.id, {
      items: items.map((item) => item.kind === "scene" ? { ...item, pinned: true } : item),
    });
    expect(pinned.items.find((item) => item.kind === "scene")).toMatchObject({ pinned: true });

    await expect(store.updateWorkshopContextBasket(series.manifest.id, session.id, {
      items: items.map((item) => item.kind === "scene"
        ? { ...item, sourceId: "77777777-7777-4777-8777-777777777777" }
        : item),
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });

  it("keeps Workshop Agent and chat messages isolated by session kind", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopAgentIsolation" });
    const chatSession = await store.createWorkshopSession(series.manifest.id, {
      title: "Chat thread",
    });
    const agentSession = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Agent thread",
    });

    await expect(store.createWorkshopMessage(series.manifest.id, chatSession.id, {
      role: "author",
      mode: "agent",
      content: "Create a Codex entry.",
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "General Workshop chat sessions cannot receive Agent messages",
    });

    await expect(store.createWorkshopMessage(series.manifest.id, agentSession.id, {
      role: "author",
      mode: "general-chat",
      content: "Talk normally.",
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Agent Workshop sessions can only receive Agent messages",
    });

    const message = await store.createWorkshopMessage(series.manifest.id, agentSession.id, {
      role: "author",
      mode: "agent",
      content: "Create a Codex entry.",
    });
    expect(message.mode).toBe("agent");
  });

});
