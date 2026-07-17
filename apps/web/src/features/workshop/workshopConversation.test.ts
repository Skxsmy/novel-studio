import { describe, expect, it } from "vitest";
import type { SeriesDetail, WorkshopContextItemKind, WorkshopContextItemRef, WorkshopMessage } from "@novel-studio/contracts";
import { isEligibleWorkshopBranchSource, workshopGeneralChatTurn } from "./workshopConversation";
import { selectedScopeTexts } from "./workshopViewModel";

function message(input: Partial<WorkshopMessage> & Pick<WorkshopMessage, "id" | "role">): WorkshopMessage {
  return {
    schemaVersion: 2,
    seriesId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    mode: "general-chat",
    status: "succeeded",
    content: "Message",
    reasoningContent: "",
    reasoningOutputKind: "none",
    contextBundleId: null,
    modelCallId: null,
    proposalIds: [],
    attachmentIds: [],
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-07-13T00:00:00.000Z",
    ...input,
  };
}

describe("Workshop conversation policy", () => {
  it("returns the complete settled General Chat turn for either message", () => {
    const firstAuthor = message({ id: "33333333-3333-4333-8333-333333333333", role: "author" });
    const firstAssistant = message({ id: "44444444-4444-4444-8444-444444444444", role: "assistant" });
    const secondAuthor = message({ id: "55555555-5555-4555-8555-555555555555", role: "author" });
    const messages = [firstAuthor, firstAssistant, secondAuthor];
    expect(workshopGeneralChatTurn(messages, 0)?.map((item) => item.id)).toEqual([
      firstAuthor.id,
      firstAssistant.id,
    ]);
    expect(workshopGeneralChatTurn(messages, 1)?.map((item) => item.id)).toEqual([
      firstAuthor.id,
      firstAssistant.id,
    ]);
  });

  it("rejects protected turns and incomplete Agent branch prefixes", () => {
    const protectedTurn = [
      message({ id: "66666666-6666-4666-8666-666666666666", role: "author" }),
      message({
        id: "77777777-7777-4777-8777-777777777777",
        role: "assistant",
        proposalIds: ["88888888-8888-4888-8888-888888888888"],
      }),
    ];
    expect(workshopGeneralChatTurn(protectedTurn, 0)).toBeNull();

    const author = message({
      id: "99999999-9999-4999-8999-999999999999",
      role: "author",
      mode: "agent",
    });
    const tool = message({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      role: "tool",
      mode: "agent",
      toolExecution: {
        requestHash: "a".repeat(64),
        status: "running",
        attempt: 1,
        retryable: false,
        resultMessageId: null,
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
    expect(isEligibleWorkshopBranchSource([author, tool], 1)).toBe(false);
  });
});

describe("Workshop selected story scope", () => {
  const volumeId = "11111111-1111-4111-8111-111111111111";
  const storedActId = "22222222-2222-4222-8222-222222222222";
  const storedChapterId = "33333333-3333-4333-8333-333333333333";
  const series = {
    books: [{ id: volumeId, title: "Volume One", order: 1 }],
    acts: [{ id: storedActId, bookId: volumeId, title: "Chapter One", order: 1 }],
    chapters: [{ id: storedChapterId, actId: storedActId, title: "Act One", order: 1 }],
    scenes: [{
      metadata: {
        id: "44444444-4444-4444-8444-444444444444",
        chapterId: storedChapterId,
        title: "Scene One",
        order: 1,
        summary: "The brass observatory opens.",
        goal: "Enter the observatory.",
        conflict: "The lock is frozen.",
        outcome: "The lock opens.",
        beats: [],
      },
      plainText: "Mara enters the brass observatory.",
      content: "Mara enters the brass observatory.",
    }],
  } as unknown as SeriesDetail;

  function contextItem(kind: WorkshopContextItemKind, sourceId: string): WorkshopContextItemRef {
    return {
      id: crypto.randomUUID(),
      kind,
      sourceId,
      label: kind,
      pinned: false,
      note: "",
      createdAt: "2026-07-17T00:00:00.000Z",
    };
  }

  it.each([
    ["volume", volumeId],
    ["chapter", storedActId],
    ["act", storedChapterId],
  ] as const)("maps the public %s selection to its compatible stored hierarchy", (kind, sourceId) => {
    expect(selectedScopeTexts(series, [contextItem(kind, sourceId)]).join("\n"))
      .toContain("Mara enters the brass observatory.");
  });
});
