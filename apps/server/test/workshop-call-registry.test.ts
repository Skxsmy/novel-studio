import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  WorkshopCallResultSchema,
  type WorkshopCallResult,
  type WorkshopMessageStatus,
} from "@novel-studio/contracts";
import { StorageError } from "@novel-studio/storage";
import { WorkshopCallRegistry } from "../src/workshop/workshopCallRegistry.js";

function terminalResult(input: {
  operationId: string;
  seriesId: string;
  sessionId: string;
  status: WorkshopMessageStatus;
}): WorkshopCallResult {
  const now = "2026-07-17T00:00:00.000Z";
  const message = (role: "author" | "assistant", status: WorkshopMessageStatus) => ({
    schemaVersion: 2 as const,
    id: randomUUID(),
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    role,
    mode: "general-chat" as const,
    status,
    content: role === "author" ? "Keep the author request." : "Partial assistant output.",
    reasoningContent: "",
    reasoningOutputKind: "none" as const,
    contextBundleId: null,
    modelCallId: null,
    agentRunId: null,
    agentStepId: null,
    proposalIds: [],
    attachmentIds: [],
    errorCode: status === "failed" ? "provider-error" : null,
    errorMessage: status === "failed" ? "Provider failed." : null,
    createdAt: now,
  });
  return WorkshopCallResultSchema.parse({
    operationId: input.operationId,
    authorMessage: message("author", "succeeded"),
    assistantMessage: message("assistant", input.status),
    toolMessages: [],
    contextBundleId: randomUUID(),
    modelCallId: randomUUID(),
    status: input.status,
    responseText: "Partial assistant output.",
    estimatedUsage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
    actualUsage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
    agentRun: null,
  });
}

describe("WorkshopCallRegistry", () => {
  it("settles an active cancellation once and returns the same cancelled terminal result for repeated Stop commands", async () => {
    const registry = new WorkshopCallRegistry();
    const operationId = randomUUID();
    const seriesId = randomUUID();
    const sessionId = randomUUID();
    const handle = registry.begin(operationId, seriesId, sessionId);
    const cancellation = registry.cancel(operationId, seriesId, sessionId);
    expect(handle.abortSignal.aborted).toBe(true);
    const result = terminalResult({ operationId, seriesId, sessionId, status: "cancelled" });
    handle.complete(result);

    await expect(cancellation).resolves.toEqual(result);
    await expect(registry.cancel(operationId, seriesId, sessionId)).resolves.toEqual(result);
  });

  it("returns an already completed successful terminal result when Stop races with completion", async () => {
    const registry = new WorkshopCallRegistry();
    const operationId = randomUUID();
    const seriesId = randomUUID();
    const sessionId = randomUUID();
    const handle = registry.begin(operationId, seriesId, sessionId);
    const result = terminalResult({ operationId, seriesId, sessionId, status: "succeeded" });
    handle.complete(result);
    handle.release();

    await expect(registry.cancel(operationId, seriesId, sessionId)).resolves.toEqual(result);
  });

  it("rejects reuse of an operation identity while active or retained", () => {
    const registry = new WorkshopCallRegistry();
    const operationId = randomUUID();
    const seriesId = randomUUID();
    const sessionId = randomUUID();
    const handle = registry.begin(operationId, seriesId, sessionId);
    expect(() => registry.begin(operationId, seriesId, sessionId))
      .toThrowError(StorageError);
    handle.complete(terminalResult({ operationId, seriesId, sessionId, status: "cancelled" }));
    expect(() => registry.begin(operationId, seriesId, sessionId))
      .toThrowError(StorageError);
  });

  it("allows only one active model call per Workshop session", () => {
    const registry = new WorkshopCallRegistry();
    const seriesId = randomUUID();
    const sessionId = randomUUID();
    const activeOperationId = randomUUID();
    const active = registry.begin(activeOperationId, seriesId, sessionId);

    expect(() => registry.begin(randomUUID(), seriesId, sessionId))
      .toThrowError(StorageError);

    active.complete(terminalResult({
      operationId: activeOperationId,
      seriesId,
      sessionId,
      status: "cancelled",
    }));
    expect(() => registry.begin(randomUUID(), seriesId, sessionId)).not.toThrow();
  });

  it("serializes session lifecycle changes against model-call registration", async () => {
    const registry = new WorkshopCallRegistry();
    const seriesId = randomUUID();
    const sessionId = randomUUID();
    const activeOperationId = randomUUID();
    const active = registry.begin(activeOperationId, seriesId, sessionId);
    await expect(registry.guardSessionLifecycle(seriesId, sessionId, async () => "archived"))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    active.complete(terminalResult({
      operationId: activeOperationId,
      seriesId,
      sessionId,
      status: "cancelled",
    }));

    let releaseMutation!: () => void;
    const mutationGate = new Promise<void>((resolve) => { releaseMutation = resolve; });
    const guarded = registry.guardSessionLifecycle(seriesId, sessionId, async () => {
      await mutationGate;
      return "archived";
    });
    expect(() => registry.begin(randomUUID(), seriesId, sessionId))
      .toThrowError(StorageError);
    releaseMutation();
    await expect(guarded).resolves.toBe("archived");
  });

  it("serializes Agent retry and tool-continuation activity against calls and lifecycle changes", async () => {
    const registry = new WorkshopCallRegistry();
    const seriesId = randomUUID();
    const sessionId = randomUUID();
    let releaseActivity!: () => void;
    const activityGate = new Promise<void>((resolve) => { releaseActivity = resolve; });
    const activity = registry.guardSessionActivity(seriesId, sessionId, async () => {
      await activityGate;
      return "continued";
    });

    expect(() => registry.begin(randomUUID(), seriesId, sessionId)).toThrowError(StorageError);
    await expect(registry.guardSessionLifecycle(seriesId, sessionId, async () => "deleted"))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    releaseActivity();
    await expect(activity).resolves.toBe("continued");
    const next = registry.begin(randomUUID(), seriesId, sessionId);
    next.complete(terminalResult({
      operationId: next.operationId,
      seriesId,
      sessionId,
      status: "succeeded",
    }));
  });
});
