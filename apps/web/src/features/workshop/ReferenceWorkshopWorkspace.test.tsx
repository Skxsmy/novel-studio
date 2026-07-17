// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ModelProfile,
  ProviderModelDescriptor,
  SeriesDetail,
  WorkshopCallResult,
  WorkshopCallStreamEvent,
  WorkshopContextBasket,
  WorkshopMessage,
  WorkshopMessageAttachment,
  WorkshopSession,
} from "@novel-studio/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api";
import { ApiError } from "../../api/client";
import { getReferenceElementSnapshot, getReferenceStyleText } from "../../app/reference-source";
import type { ProjectSessionState } from "../../app/useProjectSession";
import { ReferenceWorkshopWorkspace, type ReferenceWorkshopWorkspaceProps } from "./ReferenceWorkshopWorkspace";

const seriesId = "11111111-1111-4111-8111-111111111111";
const chatId = "22222222-2222-4222-8222-222222222222";
const agentId = "33333333-3333-4333-8333-333333333333";
const archivedId = "44444444-4444-4444-8444-444444444444";
const profileAId = "55555555-5555-4555-8555-555555555555";
const profileBId = "66666666-6666-4666-8666-666666666666";
const contextBundleId = "77777777-7777-4777-8777-777777777777";
const modelCallId = "88888888-8888-4888-8888-888888888888";
const assistantId = "99999999-9999-4999-8999-999999999999";
const timestamp = "2026-07-17T02:00:00.000Z";
const connectedWorkshopCss = readFileSync(resolve(import.meta.dirname, "reference-workshop.css"), "utf8");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function workshopSession(overrides: Partial<WorkshopSession> = {}): WorkshopSession {
  const kind = overrides.kind ?? "chat";
  return {
    schemaVersion: 2,
    id: chatId,
    seriesId,
    kind,
    generalChatSystemPrompt: kind === "chat" ? "Only this conversation prompt." : null,
    title: "Weather-door dialogue",
    status: "active",
    branchOfMessageId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
    lastMessageAt: timestamp,
    ...overrides,
  } as WorkshopSession;
}

function workshopMessage(overrides: Partial<WorkshopMessage> = {}): WorkshopMessage {
  return {
    schemaVersion: 2,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    seriesId,
    sessionId: chatId,
    role: "author",
    mode: "general-chat",
    status: "succeeded",
    content: "Check the weather door.",
    reasoningContent: "",
    reasoningOutputKind: "none",
    contextBundleId: null,
    modelCallId: null,
    proposalIds: [],
    attachmentIds: [],
    errorCode: null,
    errorMessage: null,
    createdAt: timestamp,
    ...overrides,
  };
}

function modelProfile(id: string, model: string, reasoningPreference: ModelProfile["reasoningPreference"] = null): ModelProfile {
  return {
    schemaVersion: 2,
    id,
    title: id === profileAId ? "Provider A profile" : "Provider B profile",
    provider: "mock",
    model,
    baseUrl: null,
    credentialRef: null,
    defaultParameters: {},
    reasoningPreference,
    capabilities: { embeddings: false, modelList: true, streamText: true, structuredOutput: false, tokenEstimate: true },
    contextWindowTokens: 8192,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  };
}

function descriptor(id: string, reasoning: ProviderModelDescriptor["reasoning"]): ProviderModelDescriptor {
  return {
    id,
    title: `${id} descriptor`,
    contextWindowTokens: 8192,
    capabilities: { embeddings: false, modelList: true, streamText: true, structuredOutput: false, tokenEstimate: true },
    reasoning,
  };
}

function callResult(
  operationId: string,
  authorMessage: WorkshopMessage,
  assistantMessage: WorkshopMessage,
  status: WorkshopCallResult["status"] = "succeeded",
): WorkshopCallResult {
  return {
    operationId,
    authorMessage,
    assistantMessage,
    toolMessages: [],
    contextBundleId,
    modelCallId,
    status,
    responseText: assistantMessage.content,
    estimatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    actualUsage: null,
    agentRun: null,
  };
}

const series = {
  manifest: { id: seriesId, title: "Saltwake" },
  books: [{ id: "10101010-1010-4010-8010-101010101010", title: "Saltwake", order: 1 }],
  acts: [{ id: "20202020-2020-4020-8020-202020202020", bookId: "10101010-1010-4010-8010-101010101010", title: "The Harbor Opens", order: 1 }],
  chapters: [{ id: "30303030-3030-4030-8030-303030303030", actId: "20202020-2020-4020-8020-202020202020", title: "Pressure Door", order: 1 }],
  scenes: [{
    metadata: {
      id: "40404040-4040-4040-8040-404040404040",
      chapterId: "30303030-3030-4030-8030-303030303030",
      title: "A Weather Door",
      order: 1,
      summary: "",
      goal: "",
      conflict: "",
      outcome: "",
      beats: [],
    },
    plainText: "",
    content: "",
  }],
} as unknown as SeriesDetail;

const projectSession = {
  activeSeries: series,
  selectedScene: null,
  seriesList: [],
  isLibraryLoading: false,
  isOpeningSeries: false,
} as unknown as ProjectSessionState;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

function projectSessionFor(id: string, title: string): ProjectSessionState {
  return {
    ...projectSession,
    activeSeries: {
      ...series,
      manifest: { ...series.manifest, id, title },
    },
  } as unknown as ProjectSessionState;
}

function workshopDetail(
  session: WorkshopSession,
  messages: WorkshopMessage[] = [],
): Awaited<ReturnType<typeof api.workshop.getSession>> {
  return {
    session,
    basket: {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      seriesId: session.seriesId,
      sessionId: session.id,
      sceneId: null,
      blockId: null,
      selection: null,
      items: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    messages,
    attachments: [],
    agentRuns: { runs: [], diagnostics: [] },
  } as unknown as Awaited<ReturnType<typeof api.workshop.getSession>>;
}

function setupConnected(options: {
  componentProps?: {
    onOpenProviderSettings?: ReferenceWorkshopWorkspaceProps["onOpenProviderSettings"];
    requestedSessionId?: ReferenceWorkshopWorkspaceProps["requestedSessionId"];
  };
  descriptorLoader?: (profileId: string) => Promise<ProviderModelDescriptor[]>;
  descriptors?: Record<string, ProviderModelDescriptor[]>;
  messages?: Record<string, WorkshopMessage[]>;
  profiles?: ModelProfile[];
  projectSession?: ProjectSessionState;
  sessionLoader?: (targetSeriesId: string, sessionId: string) => Promise<Awaited<ReturnType<typeof api.workshop.getSession>>>;
  sessions?: WorkshopSession[];
  sessionsLoader?: (targetSeriesId: string) => Promise<WorkshopSession[]>;
} = {}) {
  const sessions = options.sessions ?? [workshopSession()];
  const profiles = options.profiles ?? [modelProfile(profileAId, "reasoning-model")];
  const baskets = new Map<string, WorkshopContextBasket>(sessions.map((item) => [item.id, {
    schemaVersion: 2 as const,
    id: crypto.randomUUID(),
    seriesId,
    sessionId: item.id,
    sceneId: null,
    blockId: null,
    selection: null,
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }]));
  vi.spyOn(api.workshop, "listSessions").mockImplementation((targetSeriesId) =>
    options.sessionsLoader?.(targetSeriesId) ?? Promise.resolve(sessions));
  vi.spyOn(api.workshop, "getSession").mockImplementation((targetSeriesId, sessionId) =>
    options.sessionLoader?.(targetSeriesId, sessionId) ?? Promise.resolve({
      session: sessions.find((item) => item.id === sessionId)!,
      basket: baskets.get(sessionId)!,
      messages: options.messages?.[sessionId] ?? [],
      attachments: [],
      agentRuns: { runs: [], diagnostics: [] },
    } as unknown as Awaited<ReturnType<typeof api.workshop.getSession>>));
  vi.spyOn(api.workshop, "updateContextBasket").mockImplementation(async (_seriesId, sessionId, input) => {
    const current = baskets.get(sessionId)!;
    const updated: WorkshopContextBasket = {
      ...current,
      sceneId: input.sceneId === undefined ? current.sceneId : input.sceneId,
      blockId: input.blockId === undefined ? current.blockId : input.blockId,
      selection: input.selection === undefined ? current.selection : input.selection,
      items: input.items === undefined ? current.items : input.items,
      updatedAt: new Date().toISOString(),
    };
    baskets.set(sessionId, updated);
    return updated;
  });
  vi.spyOn(api.ai, "listModelProfiles").mockResolvedValue(profiles);
  vi.spyOn(api.ai, "listProviderModels").mockImplementation((profileId) => options.descriptorLoader?.(profileId) ?? Promise.resolve(
    options.descriptors?.[profileId] ?? [descriptor("reasoning-model", {
      kind: "effort",
      efforts: ["low", "medium", "high"],
      defaultEffort: "medium",
      canDisable: true,
    })]
  ));
  vi.spyOn(api.proposals, "list").mockResolvedValue({ items: [], diagnostics: [] } as unknown as Awaited<ReturnType<typeof api.proposals.list>>);
  vi.spyOn(api.codex, "listCategories").mockResolvedValue([]);
  vi.spyOn(api.codex, "listDetailTypes").mockResolvedValue([]);
  vi.spyOn(api.codex, "listEntries").mockResolvedValue([]);
  const rendered = render(<ReferenceWorkshopWorkspace
    {...(options.componentProps?.onOpenProviderSettings
      ? { onOpenProviderSettings: options.componentProps.onOpenProviderSettings }
      : {})}
    {...(options.componentProps?.requestedSessionId !== undefined
      ? { requestedSessionId: options.componentProps.requestedSessionId }
      : {})}
    session={options.projectSession ?? projectSession}
  />);
  rendered.container.querySelector<HTMLElement>("#workshop-workspace")!.hidden = false;
  return rendered;
}

describe("NS-514 P3 Workshop reference workspace", () => {
  it("matches the NS-514 manifest for Workshop", () => {
    const { container } = render(<ReferenceWorkshopWorkspace />);
    const root = container.querySelector<HTMLElement>("#workshop-workspace")!;
    expect(root.className).toBe("wr5 workspace-view");
    expect(root.hidden).toBe(true);
    expect(root.innerHTML).toBe(getReferenceElementSnapshot("#workshop-workspace").innerHtml);
    expect([...root.children].map((child) => `${child.tagName.toLowerCase()}.${child.className}`)).toEqual([
      "aside.wr5-sessions",
      "main.wr5-conversation",
    ]);
    expect(root.querySelectorAll("button,input,textarea,select")).toHaveLength(76);
    expect(root.querySelector<HTMLElement>("[data-wr5-filter='all']")?.classList.contains("is-active")).toBe(true);
    expect(root.querySelector<HTMLElement>(".wr5-session.is-active")?.dataset.wr5Thread).toBe("main");
    for (const anchor of ["Harbor lock continuity", "Pressure logic branch", "lock-notes.docx", "Claude Sonnet 4", "Update Rin Vale"]) {
      expect(root.textContent).toContain(anchor);
    }
    const css = getReferenceStyleText();
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(".wr5 { grid-template-columns: minmax(0,1fr); }");
    expect(css).toContain("@media (max-height: 760px)");
  });
});

describe("NS-514 A29-A34 connected Workshop workspace", () => {
  it("keeps the New conversation entry point available when the Series has no Workshop sessions", async () => {
    const createdChat = workshopSession({
      id: "17171717-1717-4717-8717-171717171717",
      title: "First Workshop conversation",
    });
    const createSession = vi.spyOn(api.workshop, "createSession").mockResolvedValue(createdChat);
    const { container } = setupConnected({
      sessions: [],
      sessionLoader: async () => workshopDetail(createdChat),
    });

    const newConversation = within(container).getByRole("button", { name: "New conversation" }) as HTMLButtonElement;
    await waitFor(() => expect(newConversation.disabled).toBe(false));
    expect(container.querySelector("aside.wr5-sessions")).toBeTruthy();
    expect(container.querySelector("main.wr5-conversation")?.textContent).toContain(
      "Create or select a Workshop session before sending.",
    );

    fireEvent.click(newConversation);
    expect(within(container).getByRole("menu").classList.contains("is-open")).toBe(true);
    fireEvent.click(within(container).getByRole("menuitem", { name: "General Chat" }));
    await waitFor(() => expect(createSession).toHaveBeenCalledWith(seriesId, {
      kind: "chat",
      sceneId: null,
      title: "New chat",
    }));
    await waitFor(() => expect(container.textContent).toContain("First Workshop conversation"));
  });

  it("creates General Chat and Agent conversations through the single New conversation menu with the exact API kind", async () => {
    const createdChat = workshopSession({ id: "18181818-1818-4818-8818-181818181818", title: "New chat" });
    const createdAgent = workshopSession({
      id: "19191919-1919-4919-8919-191919191919",
      kind: "agent",
      generalChatSystemPrompt: null,
      title: "New chat",
    });
    const createSession = vi.spyOn(api.workshop, "createSession")
      .mockResolvedValueOnce(createdChat)
      .mockResolvedValueOnce(createdAgent);
    const { container } = setupConnected();
    await waitFor(() => expect(container.textContent).toContain("Weather-door dialogue"));

    fireEvent.click(within(container).getByRole("button", { name: "New conversation" }));
    fireEvent.click(within(container).getByRole("menuitem", { name: "General Chat" }));
    await waitFor(() => expect(createSession).toHaveBeenNthCalledWith(1, seriesId, {
      kind: "chat",
      sceneId: null,
      title: "New chat",
    }));

    fireEvent.click(within(container).getByRole("button", { name: "New conversation" }));
    fireEvent.click(within(container).getByRole("menuitem", { name: "Agent conversation" }));
    await waitFor(() => expect(createSession).toHaveBeenNthCalledWith(2, seriesId, {
      kind: "agent",
      sceneId: null,
      title: "New chat",
    }));
  });

  it("searches active sessions and separates All, Chat, Agent, and Archived without fake counts", async () => {
    const sessions = [
      workshopSession(),
      workshopSession({ id: agentId, kind: "agent", generalChatSystemPrompt: null, title: "Harbor continuity" }),
      workshopSession({ id: archivedId, status: "archived", archivedAt: timestamp, title: "Old planning chat" }),
    ];
    const { container } = setupConnected({ sessions });
    await waitFor(() => expect(container.querySelector(".wr5-session-list")?.textContent).toContain("Weather-door dialogue"));
    expect(container.querySelector(".wr5-session-list")?.textContent).toContain("Harbor continuity");
    expect(container.querySelector(".wr5-session-list")?.textContent).not.toContain("Old planning chat");

    fireEvent.click(within(container).getByRole("button", { name: "Archived" }));
    await waitFor(() => expect(container.querySelector(".wr5-session-list")?.textContent).toContain("Old planning chat"));
    expect(container.querySelector(".wr5-session-list")?.textContent).not.toContain("Weather-door dialogue");
    expect(within(container).queryByText(/Archived \d/u)).toBeNull();

    fireEvent.change(within(container).getByLabelText("Search conversations"), { target: { value: "missing" } });
    expect(container.textContent).toContain("No conversations match this search and filter.");
  });

  it("opens session lifecycle actions only from the context menu, doubleClick does not enter Rename, and keeps Archived conversations read-only", async () => {
    const archived = workshopSession({
      id: archivedId,
      kind: "agent",
      generalChatSystemPrompt: null,
      status: "archived",
      archivedAt: timestamp,
      title: "Archived agent",
    });
    const tool = workshopMessage({
      id: "abababab-abab-4aba-8aba-abababababab",
      sessionId: archivedId,
      role: "tool",
      mode: "agent",
      content: JSON.stringify({ schemaVersion: 1, tool: "codex.create_entry" }),
      toolExecution: undefined,
    });
    const { container } = setupConnected({ sessions: [workshopSession(), archived], messages: { [archivedId]: [tool] } });
    await waitFor(() => expect(container.textContent).toContain("Weather-door dialogue"));
    const activeRow = within(container).getByRole("button", { name: /Weather-door dialogue/u });

    fireEvent.doubleClick(activeRow);
    expect(container.querySelector(".wr5-session-context-menu")).toBeNull();
    fireEvent.keyDown(activeRow, { key: "F10", shiftKey: true });
    expect(container.querySelector(".wr5-session-context-menu")?.textContent).toContain("Rename");
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(within(container).getByRole("button", { name: "Archived" }));
    const archivedRow = await within(container).findByRole("button", { name: /Archived agent/u });
    fireEvent.contextMenu(archivedRow, { clientX: 30, clientY: 30 });
    const menu = container.querySelector<HTMLElement>(".wr5-session-context-menu")!;
    expect(menu.textContent).toContain("Export");
    expect(menu.textContent).toContain("Restore");
    expect(menu.textContent).toContain("Delete permanently");
    expect(menu.textContent).not.toContain("Rename");
    expect(menu.textContent).not.toContain("system prompt");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(3);
    await waitFor(() => expect(container.querySelector(".wr5-conversation h2")?.textContent).toBe("Archived agent"));
    expect(container.textContent).not.toContain("Review request");
    expect(within(container).queryByRole("button", { name: "Retry" })).toBeNull();
    expect(within(container).queryByRole("button", { name: "Open message actions" })).toBeNull();
    expect(within(container).getByRole("button", { name: "Branch" })).toHaveProperty("disabled", true);
    expect(within(container).getByRole("button", { name: /Context/u })).toHaveProperty("disabled", true);
    expect(within(container).getByRole("button", { name: /reasoning-model/u })).toHaveProperty("disabled", true);
    expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", true);
    expect(within(container).getByRole("button", { name: "Provider settings" })).toHaveProperty("disabled", true);
    expect(within(container).getByRole("button", { name: "Attach file" })).toHaveProperty("disabled", true);
    expect(within(container).getByLabelText("Workshop message")).toHaveProperty("disabled", true);
    expect(within(container).getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
  });

  it("archives, restores, exports, renames, saves the General Chat prompt, and confirms permanent deletion from the session context menu", async () => {
    let current = workshopSession();
    vi.spyOn(api.workshop, "updateSession").mockImplementation(async (_seriesId, _sessionId, input) => {
      current = { ...current, ...input } as WorkshopSession;
      return current;
    });
    vi.spyOn(api.workshop, "exportSession").mockResolvedValue("# Exported conversation");
    vi.spyOn(api.workshop, "archiveSession").mockImplementation(async () => {
      current = { ...current, status: "archived", archivedAt: timestamp } as WorkshopSession;
      return current;
    });
    vi.spyOn(api.workshop, "restoreSession").mockImplementation(async () => {
      current = { ...current, status: "active", archivedAt: null } as WorkshopSession;
      return current;
    });
    vi.spyOn(api.workshop, "deleteSession").mockResolvedValue({
      deletedId: chatId,
      deletedMessageIds: [],
      deletedAttachmentIds: [],
      deletedBranchIds: [],
    });
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:workshop"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const { container } = setupConnected({ sessions: [current] });
    await waitFor(() => expect(container.textContent).toContain("Weather-door dialogue"));

    const row = () => within(container).getByRole("button", { name: /Weather-door dialogue|Renamed conversation/u });
    const openMenu = () => fireEvent.contextMenu(row(), { clientX: 40, clientY: 40 });
    openMenu();
    fireEvent.click(within(container).getByRole("menuitem", { name: "Rename" }));
    const rename = within(container).getByLabelText("Conversation title");
    fireEvent.change(rename, { target: { value: "Renamed conversation" } });
    fireEvent.submit(rename.closest("form")!);
    await waitFor(() => expect(api.workshop.updateSession).toHaveBeenCalledWith(seriesId, chatId, { title: "Renamed conversation" }));
    await waitFor(() => expect(document.activeElement).toBe(row()));

    openMenu();
    fireEvent.click(within(container).getByRole("menuitem", { name: "General Chat system prompt" }));
    const prompt = within(container).getByLabelText("General Chat system prompt");
    expect((prompt as HTMLTextAreaElement).value).toBe("Only this conversation prompt.");
    fireEvent.change(prompt, { target: { value: "Updated prompt for this conversation." } });
    fireEvent.click(within(container).getByRole("button", { name: "Save prompt" }));
    await waitFor(() => expect(api.workshop.updateSession).toHaveBeenCalledWith(seriesId, chatId, { generalChatSystemPrompt: "Updated prompt for this conversation." }));
    await waitFor(() => expect(document.activeElement).toBe(row()));

    openMenu();
    fireEvent.click(within(container).getByRole("menuitem", { name: "Export" }));
    fireEvent.click(within(container).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(api.workshop.exportSession).toHaveBeenCalledWith(seriesId, chatId, { includePromptAudit: false, includeReasoning: false }));
    await waitFor(() => expect(document.activeElement).toBe(row()));

    openMenu();
    fireEvent.click(within(container).getByRole("menuitem", { name: "Archive" }));
    await waitFor(() => expect(api.workshop.archiveSession).toHaveBeenCalledWith(seriesId, chatId));
    await waitFor(() => expect(document.activeElement).toBe(row()));
    openMenu();
    fireEvent.click(within(container).getByRole("menuitem", { name: "Restore" }));
    await waitFor(() => expect(api.workshop.restoreSession).toHaveBeenCalledWith(seriesId, chatId));
    await waitFor(() => expect(document.activeElement).toBe(row()));

    openMenu();
    fireEvent.click(within(container).getByRole("menuitem", { name: "Delete permanently" }));
    await waitFor(() => expect(api.workshop.deleteSession).toHaveBeenCalledWith(seriesId, chatId));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Renamed conversation"));
  });

  it("cancels Rename with Escape without submitting the changed title and returns focus to the same conversation", async () => {
    const updateSession = vi.spyOn(api.workshop, "updateSession");
    const { container } = setupConnected();
    await waitFor(() => expect(container.textContent).toContain("Weather-door dialogue"));
    const row = within(container).getByRole("button", { name: /Weather-door dialogue/u });
    fireEvent.contextMenu(row, { clientX: 40, clientY: 40 });
    fireEvent.click(within(container).getByRole("menuitem", { name: "Rename" }));
    const rename = within(container).getByLabelText("Conversation title");
    fireEvent.change(rename, { target: { value: "This title must not be saved" } });
    fireEvent.keyDown(rename, { key: "Escape" });
    await waitFor(() => expect(within(container).queryByLabelText("Conversation title")).toBeNull());
    expect(updateSession).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(
      within(container).getByRole("button", { name: /Weather-door dialogue/u }),
    ));
  });

  it("returns focus to the originating conversation when the General Chat prompt dialog is cancelled", async () => {
    const { container } = setupConnected();
    await waitFor(() => expect(container.textContent).toContain("Weather-door dialogue"));
    const row = within(container).getByRole("button", { name: /Weather-door dialogue/u });
    fireEvent.contextMenu(row, { clientX: 40, clientY: 40 });
    fireEvent.click(within(container).getByRole("menuitem", { name: "General Chat system prompt" }));
    fireEvent.click(within(container).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(within(container).queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it("opens the session menu with Menu, Shift+F10, and touch long press, returns focus on Escape, and exposes no header action menu", async () => {
    const { container } = setupConnected();
    await waitFor(() => expect(container.textContent).toContain("Weather-door dialogue"));
    const row = within(container).getByRole("button", { name: /Weather-door dialogue/u });
    expect(container.querySelector(".wr5-head-actions .wr5-icon-button")).toBeNull();

    row.focus();
    fireEvent.keyDown(row, { key: "ContextMenu" });
    expect(container.querySelector(".wr5-session-context-menu")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(row));
    fireEvent.keyDown(row, { key: "F10", shiftKey: true });
    expect(container.querySelector(".wr5-session-context-menu")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });

    vi.useFakeTimers();
    fireEvent.pointerDown(row, { clientX: 64, clientY: 64, pointerType: "touch" });
    act(() => vi.advanceTimersByTime(560));
    expect(container.querySelector(".wr5-session-context-menu")).not.toBeNull();
    fireEvent.pointerUp(row, { pointerType: "touch" });
  });

  it("sends the public Volume, Chapter, Act, and Scene context kinds without exposing storage names", async () => {
    const { container } = setupConnected();
    await waitFor(() => expect(within(container).getByRole("button", { name: /Context/u })).toHaveProperty("disabled", false));
    const update = vi.mocked(api.workshop.updateContextBasket);
    for (const [group, item, kind] of [
      ["Volumes", "Saltwake", "volume"],
      ["Chapters", "The Harbor Opens", "chapter"],
      ["Acts", "Pressure Door", "act"],
      ["Scenes", "A Weather Door", "scene"],
    ] as const) {
      fireEvent.click(within(container).getByRole("button", { name: /Context/u }));
      fireEvent.click(within(container).getByRole("tab", { name: "Structure" }));
      fireEvent.click(within(container).getByRole("button", { name: new RegExp(group, "u") }));
      const callCount = update.mock.calls.length;
      fireEvent.click(within(container).getByRole("button", { name: new RegExp(item, "u") }));
      await waitFor(() => expect(update.mock.calls.length).toBe(callCount + 1));
      const input = update.mock.calls.at(-1)?.[2];
      expect(input?.items?.at(-1)?.kind).toBe(kind);
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(within(container).queryByRole("dialog", { name: "Choose context" })).toBeNull());
    }
    expect(container.textContent).not.toContain("bookId");
    expect(container.textContent).not.toContain("chapterId");

    fireEvent.click(within(container).getByRole("button", { name: /Context/u }));
    fireEvent.click(within(container).getByRole("tab", { name: "Series" }));
    const contextDialog = within(container).getByRole("dialog", { name: "Choose context" });
    expect(contextDialog.classList.contains("is-open")).toBe(true);
    expect(contextDialog.textContent).toContain(
      "Full outline of the novel, including all volumes, chapters, acts, and scenes.",
    );
  });

  it("places eligible message actions behind the bottom-right icon and renders reasoning above the answer expanded", async () => {
    const author = workshopMessage();
    const assistant = workshopMessage({
      id: assistantId,
      role: "assistant",
      content: "The pressure plate controls the door.",
      reasoningContent: "Compared the current Scene and Codex context.",
      reasoningOutputKind: "summary",
      createdAt: "2026-07-17T02:01:00.000Z",
    });
    const { container } = setupConnected({ messages: { [chatId]: [author, assistant] } });
    await waitFor(() => expect(container.textContent).toContain("The pressure plate controls the door."));
    const assistantArticle = container.querySelector<HTMLElement>(`[data-message-id='${assistantId}']`)!;
    const reasoning = assistantArticle.querySelector<HTMLDetailsElement>(".wr5-reasoning")!;
    const prose = assistantArticle.querySelector<HTMLElement>(".wr5-prose")!;
    expect(reasoning.open).toBe(true);
    expect(reasoning.compareDocumentPosition(prose) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const authorArticle = container.querySelector<HTMLElement>(`[data-message-id='${author.id}']`)!;
    fireEvent.click(within(authorArticle).getByRole("button", { name: "Open message actions" }));
    const menu = authorArticle.querySelector<HTMLElement>(".wr5-message-menu")!;
    expect(menu.classList.contains("opens-below")).toBe(true);
    expect(menu.textContent).toContain("Edit and resend");
    expect(menu.textContent).toContain("Resend");
    expect(menu.textContent).toContain("Branch");
    expect(menu.textContent).toContain("Delete turn");
    expect(menu.textContent).not.toContain("Reasoning");
    fireEvent.click(within(reasoning).getByText("Reasoning summary"));
    expect(reasoning.open).toBe(false);
  });

  it("edits and resends or directly resends only an eligible settled General Chat author turn", async () => {
    const author = workshopMessage();
    const assistant = workshopMessage({ id: assistantId, role: "assistant", content: "Original answer", createdAt: "2026-07-17T02:01:00.000Z" });
    vi.spyOn(api.workshop, "resendMessage").mockImplementation(async (_seriesId, _sessionId, _messageId, input) => {
      const nextContent = input.content ?? author.content;
      const nextAuthor = { ...author, content: nextContent };
      const nextAssistant = { ...assistant, content: `Answer for: ${nextContent}`, createdAt: "2026-07-17T02:02:00.000Z" };
      return {
        ...callResult(input.operationId!, nextAuthor, nextAssistant),
        deletedMessageIds: [assistant.id],
        deletedAttachmentIds: [],
        deletedBranchIds: [],
      };
    });
    const { container } = setupConnected({ messages: { [chatId]: [author, assistant] } });
    await waitFor(() => expect(container.textContent).toContain("Original answer"));
    const openAuthorMenu = () => fireEvent.click(within(container.querySelector<HTMLElement>(`[data-message-id='${author.id}']`)!).getByRole("button", { name: "Open message actions" }));

    openAuthorMenu();
    fireEvent.click(within(container).getByRole("menuitem", { name: "Edit and resend" }));
    fireEvent.change(within(container).getByLabelText("Edit message"), { target: { value: "Edited request" } });
    fireEvent.click(within(container).getByRole("button", { name: "Edit and resend" }));
    await waitFor(() => expect(api.workshop.resendMessage).toHaveBeenCalledWith(
      seriesId,
      chatId,
      author.id,
      expect.objectContaining({ content: "Edited request", operationId: expect.any(String) }),
    ));
    await waitFor(() => expect(container.textContent).toContain("Answer for: Edited request"));

    openAuthorMenu();
    fireEvent.click(within(container).getByRole("menuitem", { name: "Resend" }));
    await waitFor(() => expect(api.workshop.resendMessage).toHaveBeenCalledTimes(2));
  });

  it("branches eligible settled boundaries and deletes only a complete unprotected General Chat turn", async () => {
    const author = workshopMessage();
    const assistant = workshopMessage({ id: assistantId, role: "assistant", content: "Settled answer", createdAt: "2026-07-17T02:01:00.000Z" });
    const nextSession = workshopSession({ id: agentId, title: "Weather-door dialogue branch" });
    vi.spyOn(api.workshop, "branchSession").mockResolvedValue({
      branch: {
        schemaVersion: 1,
        id: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
        seriesId,
        sourceSessionId: chatId,
        sourceMessageId: assistant.id,
        sessionId: nextSession.id,
        title: nextSession.title,
        createdAt: timestamp,
      },
      session: nextSession,
    });
    vi.spyOn(api.workshop, "deleteMessage").mockResolvedValue({
      deletedMessageIds: [author.id, assistant.id],
      deletedAttachmentIds: [],
      deletedBranchIds: [],
      session: workshopSession(),
    });
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { container } = setupConnected({ messages: { [chatId]: [author, assistant] } });
    await waitFor(() => expect(container.textContent).toContain("Settled answer"));

    const assistantArticle = container.querySelector<HTMLElement>(`[data-message-id='${assistant.id}']`)!;
    fireEvent.click(within(assistantArticle).getByRole("button", { name: "Open message actions" }));
    expect(within(assistantArticle).queryByRole("menuitem", { name: "Resend" })).toBeNull();
    fireEvent.click(within(assistantArticle).getByRole("menuitem", { name: "Branch" }));
    await waitFor(() => expect(api.workshop.branchSession).toHaveBeenCalledWith(seriesId, chatId, {
      sourceMessageId: assistant.id,
      title: "Weather-door dialogue branch",
    }));

    cleanup();
    const rerendered = setupConnected({ messages: { [chatId]: [author, assistant] } });
    vi.mocked(api.workshop.deleteMessage).mockResolvedValue({ deletedMessageIds: [author.id, assistant.id], deletedAttachmentIds: [], deletedBranchIds: [], session: workshopSession() });
    await waitFor(() => expect(rerendered.container.textContent).toContain("Settled answer"));
    const authorArticle = rerendered.container.querySelector<HTMLElement>(`[data-message-id='${author.id}']`)!;
    fireEvent.click(within(authorArticle).getByRole("button", { name: "Open message actions" }));
    fireEvent.click(within(authorArticle).getByRole("menuitem", { name: "Delete turn" }));
    await waitFor(() => expect(api.workshop.deleteMessage).toHaveBeenCalledWith(seriesId, chatId, author.id));
    expect(confirm).toHaveBeenCalled();
  });

  it("does not expose edit or resend for Agent messages", async () => {
    const agentSession = workshopSession({ id: agentId, kind: "agent", generalChatSystemPrompt: null, title: "Agent work" });
    const author = workshopMessage({ sessionId: agentId, mode: "agent" });
    const assistant = workshopMessage({ id: assistantId, sessionId: agentId, role: "assistant", mode: "agent", content: "Agent answer", createdAt: "2026-07-17T02:01:00.000Z" });
    const { container } = setupConnected({ sessions: [agentSession], messages: { [agentId]: [author, assistant] } });
    await waitFor(() => expect(container.textContent).toContain("Agent answer"));
    const authorArticle = container.querySelector<HTMLElement>(`[data-message-id='${author.id}']`)!;
    fireEvent.click(within(authorArticle).getByRole("button", { name: "Open message actions" }));
    expect(authorArticle.querySelector(".wr5-message-menu")?.textContent).toBe("Branch");
  });

  it("keeps Not now local and reopens the unchanged pending tool request", async () => {
    const toolMessageId = "14141414-1414-4414-8414-141414141414";
    const agentSession = workshopSession({ id: agentId, kind: "agent", generalChatSystemPrompt: null, title: "Codex agent" });
    const tool = workshopMessage({
      id: toolMessageId,
      sessionId: agentId,
      role: "tool",
      mode: "agent",
      content: JSON.stringify({ schemaVersion: 1, tool: "codex.create_entry", input: { name: "Rin Vale" } }),
      toolExecution: undefined,
    });
    const executeCreate = vi.spyOn(api.workshop, "executeCodexCreateEntryTool");
    const executeUpdate = vi.spyOn(api.workshop, "executeCodexUpdateEntryTool");
    const updateEntry = vi.spyOn(api.codex, "updateEntry");
    const rejectProposal = vi.spyOn(api.proposals, "reject");
    const deleteEntry = vi.spyOn(api.codex, "deleteEntry");
    const deleteMessage = vi.spyOn(api.workshop, "deleteMessage");
    const { container } = setupConnected({ sessions: [agentSession], messages: { [agentId]: [tool] } });
    await waitFor(() => expect(within(container).getByRole("button", { name: "Review request" })).toBeTruthy());

    fireEvent.click(within(container).getByRole("button", { name: "Review request" }));
    const firstReviewContent = within(container).getByRole("dialog").textContent;
    expect(firstReviewContent).toContain(tool.content);
    fireEvent.click(within(container).getByRole("button", { name: "Not now" }));
    expect(executeCreate).not.toHaveBeenCalled();
    expect(executeUpdate).not.toHaveBeenCalled();
    expect(updateEntry).not.toHaveBeenCalled();
    expect(rejectProposal).not.toHaveBeenCalled();
    expect(deleteEntry).not.toHaveBeenCalled();
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(within(container).getByRole("button", { name: "Review request" })).toBeTruthy();

    fireEvent.click(within(container).getByRole("button", { name: "Review request" }));
    expect(within(container).getByRole("dialog").textContent).toBe(firstReviewContent);
    expect(executeCreate).not.toHaveBeenCalled();
    expect(executeUpdate).not.toHaveBeenCalled();
    expect(updateEntry).not.toHaveBeenCalled();
    expect(rejectProposal).not.toHaveBeenCalled();
    expect(deleteEntry).not.toHaveBeenCalled();
    expect(deleteMessage).not.toHaveBeenCalled();
  });

  it("reviews and confirms the exact pending tool request without bypassing server validation", async () => {
    const toolMessageId = "14141414-1414-4414-8414-141414141414";
    const resultMessageId = "15151515-1515-4515-8515-151515151515";
    const agentSession = workshopSession({ id: agentId, kind: "agent", generalChatSystemPrompt: null, title: "Codex agent" });
    const tool = workshopMessage({
      id: toolMessageId,
      sessionId: agentId,
      role: "tool",
      mode: "agent",
      content: JSON.stringify({ schemaVersion: 1, tool: "codex.create_entry", input: { name: "Rin Vale" } }),
      toolExecution: undefined,
    });
    const resultMessage = workshopMessage({
      id: resultMessageId,
      sessionId: agentId,
      role: "tool",
      mode: "agent",
      content: "Created Rin Vale.",
      createdAt: "2026-07-17T02:01:00.000Z",
    });
    const executeCreate = vi.spyOn(api.workshop, "executeCodexCreateEntryTool").mockResolvedValue({
      createdDetailTypes: [],
      message: { ...tool, status: "succeeded" as const },
      resultMessage,
      entry: { metadata: { id: "16161616-1616-4616-8616-161616161616", name: "Rin Vale" } },
      continuationMessages: [],
      agentRun: null,
    } as unknown as Awaited<ReturnType<typeof api.workshop.executeCodexCreateEntryTool>>);
    const executeUpdate = vi.spyOn(api.workshop, "executeCodexUpdateEntryTool");
    const nativeConfirm = vi.fn(() => true);
    vi.stubGlobal("confirm", nativeConfirm);
    const { container } = setupConnected({ sessions: [agentSession], messages: { [agentId]: [tool] } });
    await waitFor(() => expect(within(container).getByRole("button", { name: "Review request" })).toBeTruthy());
    fireEvent.click(within(container).getByRole("button", { name: "Review request" }));
    expect(within(container).getByRole("dialog").textContent).toContain(tool.content);
    fireEvent.click(within(container).getByRole("button", { name: "Confirm and run" }));
    await waitFor(() => expect(executeCreate).toHaveBeenCalledWith(seriesId, agentId, toolMessageId, {
      confirm: true,
      createMissingDetailTypes: false,
      detailCreations: [],
      detailMappings: [],
    }));
    expect(executeCreate).toHaveBeenCalledTimes(1);
    expect(executeUpdate).not.toHaveBeenCalled();
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it("collapses and expands each reasoning section independently without adding a reasoning message action", async () => {
    const first = workshopMessage({ id: assistantId, role: "assistant", content: "First answer", reasoningContent: "First reasoning", reasoningOutputKind: "full" });
    const second = workshopMessage({ id: "dededede-dede-4ede-8ede-dededededede", role: "assistant", content: "Second answer", reasoningContent: "Second reasoning", reasoningOutputKind: "summary", createdAt: "2026-07-17T02:02:00.000Z" });
    const { container } = setupConnected({ messages: { [chatId]: [first, second] } });
    await waitFor(() => expect(container.textContent).toContain("Second reasoning"));
    const details = [...container.querySelectorAll<HTMLDetailsElement>(".wr5-reasoning")];
    expect(details).toHaveLength(2);
    expect(details.every((item) => item.open)).toBe(true);
    fireEvent.click(within(details[0]!).getByText("Reasoning"));
    expect(details[0]!.open).toBe(false);
    expect(details[1]!.open).toBe(true);
    fireEvent.click(within(details[0]!).getByText("Reasoning"));
    expect(details[0]!.open).toBe(true);
    expect(container.querySelectorAll(".wr5-message-menu")).toHaveLength(0);
  });

  it("selects model names only and resets an invalid stored reasoning choice to the exact model default", async () => {
    const profiles = [
      modelProfile(profileAId, "reasoning-model", { mode: "effort", effort: "xhigh" }),
      modelProfile(profileBId, "toggle-model"),
    ];
    const { container } = setupConnected({
      profiles,
      descriptors: {
        [profileAId]: [descriptor("reasoning-model", { kind: "effort", efforts: ["low", "medium", "high"], defaultEffort: "medium", canDisable: true })],
        [profileBId]: [descriptor("toggle-model", { kind: "toggle", defaultEnabled: true, canDisable: true })],
      },
    });
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.click(within(container).getByRole("button", { name: /reasoning-model/u }));
    const modelDialog = within(container).getByRole("dialog", { name: "Choose model" });
    expect(modelDialog.classList.contains("is-open")).toBe(true);
    expect(modelDialog.textContent).toContain("reasoning-model");
    expect(modelDialog.textContent).toContain("toggle-model");
    expect(modelDialog.textContent).not.toContain("Provider A profile");

    fireEvent.click(within(container).getByRole("button", { name: "Model options" }));
    expect(within(container).getByRole("dialog", { name: "Model options" }).classList.contains("is-open")).toBe(true);
    const effort = within(container).getByLabelText("Reasoning effort") as HTMLSelectElement;
    expect(effort.value).toBe("medium");
    expect([...effort.options].map((option) => option.value)).toEqual(["disabled", "low", "medium", "high"]);
  });

  it("does not reuse the previous model descriptor while the newly selected exact model is loading", async () => {
    let resolveSecond!: (models: ProviderModelDescriptor[]) => void;
    const secondModels = new Promise<ProviderModelDescriptor[]>((resolve) => { resolveSecond = resolve; });
    const profiles = [modelProfile(profileAId, "reasoning-model"), modelProfile(profileBId, "toggle-model")];
    setupConnected({
      profiles,
      descriptorLoader: (profileId) => profileId === profileBId
        ? secondModels
        : Promise.resolve([descriptor("reasoning-model", { kind: "effort", efforts: ["medium"], defaultEffort: "medium", canDisable: false })]),
    });
    const root = document.querySelector<HTMLElement>("#workshop-workspace")!;
    await waitFor(() => expect(within(root).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.click(within(root).getByRole("button", { name: /reasoning-model/u }));
    fireEvent.click(within(root).getByLabelText("toggle-model"));
    expect(within(root).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", true);
    fireEvent.change(within(root).getByLabelText("Workshop message"), { target: { value: "Do not send with old reasoning." } });
    expect(within(root).getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
    await act(async () => resolveSecond([descriptor("toggle-model", { kind: "toggle", defaultEnabled: true, canDisable: true })]));
    await waitFor(() => expect(within(root).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
  });

  it("persists each exact model reasoning choice and restores the effort choice after switching away and back", async () => {
    const profiles = [
      modelProfile(profileAId, "reasoning-model", { mode: "effort", effort: "medium" }),
      modelProfile(profileBId, "toggle-model", { mode: "enabled" }),
    ];
    const updateModelProfile = vi.spyOn(api.ai, "updateModelProfile").mockImplementation(async (profileId, input) => {
      const index = profiles.findIndex((profile) => profile.id === profileId);
      profiles[index] = { ...profiles[index]!, reasoningPreference: input.reasoningPreference ?? null };
      return profiles[index]!;
    });
    const { container } = setupConnected({
      profiles,
      descriptors: {
        [profileAId]: [descriptor("reasoning-model", { kind: "effort", efforts: ["low", "medium", "high"], defaultEffort: "medium", canDisable: true })],
        [profileBId]: [descriptor("toggle-model", { kind: "toggle", defaultEnabled: true, canDisable: true })],
      },
    });
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.click(within(container).getByRole("button", { name: "Model options" }));
    fireEvent.change(within(container).getByLabelText("Reasoning effort"), { target: { value: "high" } });
    await waitFor(() => expect(updateModelProfile).toHaveBeenCalledWith(profileAId, {
      reasoningPreference: { mode: "effort", effort: "high" },
    }));

    fireEvent.click(within(container).getByRole("button", { name: /reasoning-model/u }));
    fireEvent.click(within(container).getByLabelText("toggle-model"));
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.click(within(container).getByRole("button", { name: "Model options" }));
    expect(within(container).getByLabelText("Reasoning enabled")).toHaveProperty("type", "checkbox");
    expect(within(container).queryByLabelText("Reasoning effort")).toBeNull();

    fireEvent.click(within(container).getByRole("button", { name: /toggle-model/u }));
    fireEvent.click(within(container).getByLabelText("reasoning-model"));
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.click(within(container).getByRole("button", { name: "Model options" }));
    expect((within(container).getByLabelText("Reasoning effort") as HTMLSelectElement).value).toBe("high");
  });

  it("renders only the exact budget modes supported by the selected model and rejects an empty or out-of-range fixed token budget", async () => {
    const profiles = [modelProfile(profileAId, "budget-model", { mode: "enabled" })];
    const updateModelProfile = vi.spyOn(api.ai, "updateModelProfile").mockImplementation(async (_profileId, input) => {
      profiles[0] = { ...profiles[0]!, reasoningPreference: input.reasoningPreference ?? null };
      return profiles[0]!;
    });
    const { container } = setupConnected({
      profiles,
      descriptors: {
        [profileAId]: [descriptor("budget-model", {
          kind: "budget",
          minimumTokens: 1024,
          maximumTokens: 8192,
          defaultBudgetTokens: null,
          supportsDynamicBudget: true,
          canDisable: true,
        })],
      },
    });
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.click(within(container).getByRole("button", { name: "Model options" }));
    const mode = within(container).getByLabelText("Reasoning token budget") as HTMLSelectElement;
    expect([...mode.options].map((option) => option.value)).toEqual(["disabled", "dynamic", "fixed"]);
    expect(mode.value).toBe("dynamic");
    fireEvent.change(mode, { target: { value: "fixed" } });
    await waitFor(() => expect(updateModelProfile).toHaveBeenCalledWith(profileAId, {
      reasoningPreference: { mode: "budget", budgetTokens: 1024 },
    }));
    const budget = within(container).getByRole("spinbutton") as HTMLInputElement;
    expect(budget.min).toBe("1024");
    expect(budget.max).toBe("8192");
    const callsBeforeInvalidBlur = updateModelProfile.mock.calls.length;
    fireEvent.change(budget, { target: { value: "" } });
    fireEvent.blur(budget);
    expect(updateModelProfile).toHaveBeenCalledTimes(callsBeforeInvalidBlur);
    expect(budget.value).toBe("1024");
    fireEvent.change(budget, { target: { value: "9000" } });
    fireEvent.blur(budget);
    expect(updateModelProfile).toHaveBeenCalledTimes(callsBeforeInvalidBlur);
    expect(budget.value).toBe("1024");
  });

  it("keeps a call owned by its originating session and allows a different Chat or Agent session to present its own control", async () => {
    const callbacks = new Map<string, (event: WorkshopCallStreamEvent) => void>();
    const payloads: Array<{ mode: string; sessionId: string }> = [];
    vi.spyOn(api.workshop, "runCallStream").mockImplementation(async (_seriesId, sessionId, input, onEvent) => {
      callbacks.set(sessionId, onEvent);
      payloads.push({ mode: input.mode ?? "general-chat", sessionId });
      await new Promise(() => undefined);
    });
    const chat = workshopSession({ title: "Foreground chat" });
    const agent = workshopSession({ id: agentId, kind: "agent", generalChatSystemPrompt: null, title: "Independent agent" });
    const settledAuthor = workshopMessage({
      id: "71717171-7171-4717-8717-717171717171",
      content: "Settled request before the active call.",
    });
    const settledAssistant = workshopMessage({
      id: "72727272-7272-4727-8727-727272727272",
      role: "assistant",
      content: "Settled answer before the active call.",
      createdAt: "2026-07-17T02:01:00.000Z",
    });
    const { container } = setupConnected({
      sessions: [chat, agent],
      messages: { [chatId]: [settledAuthor, settledAssistant] },
    });
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Chat request" } });
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(payloads).toHaveLength(1));
    const chatOperationId = vi.mocked(api.workshop.runCallStream).mock.calls[0]![2].operationId!;
    act(() => callbacks.get(chatId)?.({ type: "assistant-start", operationId: chatOperationId, assistantMessageId: assistantId, contextBundleId, modelCallId, attempt: 1, reset: false }));
    expect(within(container).getByRole("button", { name: "Stop" })).toBeTruthy();
    fireEvent.contextMenu(within(container).getByRole("button", { name: /Foreground chat/u }), { clientX: 40, clientY: 40 });
    expect(within(document.body).getByRole("menuitem", { name: "Archive" })).toHaveProperty("disabled", true);
    expect(within(document.body).getByRole("menuitem", { name: "Delete permanently" })).toHaveProperty("disabled", true);
    fireEvent.keyDown(document, { key: "Escape" });
    const settledAuthorArticle = container.querySelector<HTMLElement>(`[data-message-id='${settledAuthor.id}']`)!;
    fireEvent.click(within(settledAuthorArticle).getByRole("button", { name: "Open message actions" }));
    expect(within(settledAuthorArticle).getByRole("menuitem", { name: "Edit and resend" })).toHaveProperty("disabled", true);
    expect(within(settledAuthorArticle).getByRole("menuitem", { name: "Resend" })).toHaveProperty("disabled", true);
    expect(within(settledAuthorArticle).getByRole("menuitem", { name: "Delete turn" })).toHaveProperty("disabled", true);
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(within(container).getByRole("button", { name: /Independent agent/u }));
    await waitFor(() => expect(container.querySelector(".wr5-conversation h2")?.textContent).toBe("Independent agent"));
    expect(within(container).queryByRole("button", { name: "Stop" })).toBeNull();
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Agent request" } });
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(payloads).toEqual([
      { mode: "general-chat", sessionId: chatId },
      { mode: "agent", sessionId: agentId },
    ]));
    act(() => callbacks.get(chatId)?.({ type: "error", operationId: chatOperationId, code: "LATE", message: "Background failure" }));
    expect(container.textContent).not.toContain("Background failure");
  });

  it("uses one Send, Sending, Stop, and Stopping control and disables motion under the reduced-motion preference", async () => {
    let streamEvent!: (event: WorkshopCallStreamEvent) => void;
    let operationId = "";
    let resolveCancel!: (value: { operationId: string; result: WorkshopCallResult }) => void;
    const cancelResult = new Promise<{ operationId: string; result: WorkshopCallResult }>((resolve) => { resolveCancel = resolve; });
    vi.spyOn(api.workshop, "runCallStream").mockImplementation(async (_seriesId, _sessionId, input, onEvent) => {
      operationId = input.operationId!;
      streamEvent = onEvent;
      await new Promise(() => undefined);
    });
    vi.spyOn(api.workshop, "cancelCall").mockImplementation(() => cancelResult);
    const { container } = setupConnected();
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Animate the state." } });
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(within(container).getByRole("button", { name: "Sending" })).toBeTruthy());
    expect(container.querySelectorAll(".wr5-send-actions button")).toHaveLength(1);
    act(() => streamEvent({ type: "assistant-start", operationId, assistantMessageId: assistantId, contextBundleId, modelCallId, attempt: 1, reset: false }));
    fireEvent.click(within(container).getByRole("button", { name: "Stop" }));
    expect(within(container).getByRole("button", { name: "Stopping" })).toHaveProperty("disabled", true);
    const author = workshopMessage({ content: "Animate the state." });
    const assistant = workshopMessage({ id: assistantId, role: "assistant", status: "cancelled", content: "", createdAt: "2026-07-17T02:01:00.000Z" });
    await act(async () => resolveCancel({ operationId, result: callResult(operationId, author, assistant, "cancelled") }));
    await waitFor(() => expect(within(container).getByRole("button", { name: "Send" })).toBeTruthy());
    expect(connectedWorkshopCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(connectedWorkshopCss).toContain("animation-duration: .01ms !important");
  });

  it("returns to Send when the request settles before a late cancel conflict", async () => {
    const stream = deferred<void>();
    const cancel = deferred<Awaited<ReturnType<typeof api.workshop.cancelCall>>>();
    vi.spyOn(api.workshop, "runCallStream").mockImplementation(async () => stream.promise);
    vi.spyOn(api.workshop, "cancelCall").mockImplementation(() => cancel.promise);
    const { container } = setupConnected();
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Race cancellation with failure." } });
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(within(container).getByRole("button", { name: "Sending" })).toBeTruthy());
    fireEvent.click(within(container).getByRole("button", { name: "Sending" }));
    expect(within(container).getByRole("button", { name: "Stopping" })).toHaveProperty("disabled", true);

    await act(async () => stream.reject(new Error("Provider stream failed first.")));
    await act(async () => cancel.reject(new Error("The call already completed.")));

    await waitFor(() => expect(within(container).getByRole("button", { name: "Send" })).toBeTruthy());
    expect(container.querySelectorAll(".wr5-message")).toHaveLength(0);
    expect(container.textContent).toContain("The call already completed.");
  });

  it("waits for the exact-model reasoning preference save before sending with the saved value", async () => {
    const profile = modelProfile(profileAId, "reasoning-model", { mode: "effort", effort: "medium" });
    const save = deferred<ModelProfile>();
    const updateModelProfile = vi.spyOn(api.ai, "updateModelProfile").mockImplementation(() => save.promise);
    const runCallStream = vi.spyOn(api.workshop, "runCallStream").mockImplementation(async (_seriesId, _sessionId, input, onEvent) => {
      const author = workshopMessage({ content: input.userRequest });
      const assistant = workshopMessage({
        id: assistantId,
        role: "assistant",
        content: "Saved preference applied.",
        createdAt: "2026-07-17T02:01:00.000Z",
      });
      onEvent({ type: "done", result: callResult(input.operationId!, author, assistant) });
    });
    const { container } = setupConnected({ profiles: [profile] });
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Use the saved reasoning effort." } });
    fireEvent.click(within(container).getByRole("button", { name: "Model options" }));
    const effort = within(container).getByLabelText("Reasoning effort") as HTMLSelectElement;
    fireEvent.change(effort, { target: { value: "high" } });
    expect(updateModelProfile).toHaveBeenCalledWith(profileAId, {
      reasoningPreference: { mode: "effort", effort: "high" },
    });
    expect(effort.disabled).toBe(true);
    expect(within(container).getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    expect(runCallStream).not.toHaveBeenCalled();

    await act(async () => save.resolve({
      ...profile,
      reasoningPreference: { mode: "effort", effort: "high" },
      updatedAt: "2026-07-17T02:02:00.000Z",
    }));
    await waitFor(() => expect(within(container).getByRole("button", { name: "Send" })).toHaveProperty("disabled", false));
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(runCallStream).toHaveBeenCalled());
    expect(runCallStream.mock.calls[0]![2].parameters).toEqual({
      reasoning: { mode: "effort", effort: "high" },
    });
  });

  it("stops before the first stream event without leaving duplicate or pending optimistic messages and keeps the attachment on the persisted author message", async () => {
    const attachmentId = "12121212-1212-4212-8212-121212121212";
    const serverAuthorId = "13131313-1313-4313-8313-131313131313";
    const uploaded: WorkshopMessageAttachment = {
      schemaVersion: 1,
      id: attachmentId,
      seriesId,
      sessionId: chatId,
      messageId: null,
      draftToken: "draft-attachment-stop",
      fileName: "pressure-notes.txt",
      mediaType: "text/plain",
      sizeBytes: 5,
      textHash: "a".repeat(64),
      extractedText: "notes",
      parseStatus: "parsed",
      parseWarnings: [],
      parseError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    vi.spyOn(api.workshop, "uploadAttachment").mockResolvedValue(uploaded);
    vi.spyOn(api.workshop, "runCallStream").mockImplementation(async () => new Promise(() => undefined));
    vi.spyOn(api.workshop, "cancelCall").mockImplementation(async (_seriesId, _sessionId, operationId) => {
      const author = workshopMessage({
        id: serverAuthorId,
        content: "Review the attached files.",
        attachmentIds: [attachmentId],
      });
      const assistant = workshopMessage({
        id: assistantId,
        role: "assistant",
        status: "cancelled",
        content: "",
        createdAt: "2026-07-17T02:01:00.000Z",
      });
      return { operationId, result: callResult(operationId, author, assistant, "cancelled") };
    });
    const { container } = setupConnected();
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    const file = new File(["notes"], "pressure-notes.txt", { type: "text/plain" });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: async () => new TextEncoder().encode("notes").buffer,
    });
    fireEvent.change(within(container).getByLabelText("Choose Workshop attachment"), { target: { files: [file] } });
    await waitFor(() => expect(container.textContent).toContain("pressure-notes.txt"));
    await waitFor(() => expect(within(container).getByRole("button", { name: "Send" })).toHaveProperty("disabled", false));
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(within(container).getByRole("button", { name: "Sending" })).toBeTruthy());
    fireEvent.click(within(container).getByRole("button", { name: "Sending" }));
    await waitFor(() => expect(container.textContent).toContain("Cancelled"));

    const messages = [...container.querySelectorAll<HTMLElement>(".wr5-message")];
    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.dataset.messageId)).toEqual([serverAuthorId, assistantId]);
    expect(messages.map((message) => message.dataset.status)).toEqual(["succeeded", "cancelled"]);
    expect(container.querySelector(".wr5-message[data-status='pending']")).toBeNull();
    expect(container.querySelector<HTMLElement>(`[data-message-id='${serverAuthorId}']`)?.textContent).toContain("pressure-notes.txt");
  });

  it("does not insert a completed attachment upload into a different conversation after the author switches sessions", async () => {
    let resolveUpload!: (attachment: WorkshopMessageAttachment) => void;
    const pendingUpload = new Promise<WorkshopMessageAttachment>((resolve) => { resolveUpload = resolve; });
    vi.spyOn(api.workshop, "uploadAttachment").mockImplementation(() => pendingUpload);
    const second = workshopSession({ id: agentId, kind: "agent", generalChatSystemPrompt: null, title: "Different conversation" });
    const { container } = setupConnected({ sessions: [workshopSession(), second] });
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    const file = new File(["notes"], "late-upload.txt", { type: "text/plain" });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: async () => new TextEncoder().encode("notes").buffer,
    });
    fireEvent.change(within(container).getByLabelText("Choose Workshop attachment"), { target: { files: [file] } });
    await waitFor(() => expect(container.textContent).toContain("late-upload.txt"));
    fireEvent.click(within(container).getByRole("button", { name: /Different conversation/u }));
    await waitFor(() => expect(container.querySelector(".wr5-conversation h2")?.textContent).toBe("Different conversation"));
    await act(async () => resolveUpload({
      schemaVersion: 1,
      id: "17171717-1717-4717-8717-171717171717",
      seriesId,
      sessionId: chatId,
      messageId: null,
      draftToken: "late-draft",
      fileName: "late-upload.txt",
      mediaType: "text/plain",
      sizeBytes: 5,
      textHash: "b".repeat(64),
      extractedText: "notes",
      parseStatus: "parsed",
      parseWarnings: [],
      parseError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    await waitFor(() => expect(container.querySelector(".wr5-conversation h2")?.textContent).toBe("Different conversation"));
    expect(container.querySelector(".wr5-draft-attachments")?.textContent ?? "").not.toContain("late-upload.txt");
  });

  it("uses one send control, ignores an older attempt after reset, and converges from the cancel command", async () => {
    let streamEvent!: (event: WorkshopCallStreamEvent) => void;
    let streamSignal: AbortSignal | undefined;
    let operationId = "";
    vi.spyOn(api.workshop, "runCallStream").mockImplementation(async (_series, _session, input, onEvent, signal) => {
      operationId = input.operationId!;
      streamEvent = onEvent;
      streamSignal = signal;
      await new Promise(() => undefined);
    });
    vi.spyOn(api.workshop, "cancelCall").mockImplementation(async () => {
      const author = workshopMessage();
      const assistant = workshopMessage({ id: assistantId, role: "assistant", status: "cancelled", content: "Partial answer", createdAt: "2026-07-17T02:01:00.000Z" });
      const result: WorkshopCallResult = {
        operationId,
        authorMessage: author,
        assistantMessage: assistant,
        toolMessages: [],
        contextBundleId,
        modelCallId,
        status: "cancelled",
        responseText: "Partial answer",
        estimatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        actualUsage: null,
        agentRun: null,
      };
      return { operationId, result };
    });
    const { container } = setupConnected();
    await waitFor(() => expect(within(container).getByRole("button", { name: "Send" })).toHaveProperty("disabled", true));
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Check pressure." } });
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(operationId).not.toBe(""));
    act(() => streamEvent({ type: "assistant-start", operationId, assistantMessageId: assistantId, contextBundleId, modelCallId, attempt: 1, reset: false }));
    act(() => streamEvent({ type: "reasoning-delta", operationId, assistantMessageId: assistantId, modelCallId, attempt: 1, outputKind: "summary", text: "old" }));
    const secondCallId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    act(() => streamEvent({ type: "assistant-start", operationId, assistantMessageId: assistantId, contextBundleId, modelCallId: secondCallId, attempt: 2, reset: true }));
    act(() => streamEvent({ type: "reasoning-delta", operationId, assistantMessageId: assistantId, modelCallId, attempt: 1, outputKind: "summary", text: "late-old" }));
    act(() => streamEvent({ type: "reasoning-delta", operationId, assistantMessageId: assistantId, modelCallId: secondCallId, attempt: 2, outputKind: "summary", text: "new" }));
    expect(container.textContent).toContain("new");
    expect(container.textContent).not.toContain("late-old");
    const streamedArticle = container.querySelector<HTMLElement>(`[data-message-id='${assistantId}']`)!;
    const streamedReasoning = streamedArticle.querySelector<HTMLDetailsElement>(".wr5-reasoning")!;
    const streamedProse = streamedArticle.querySelector<HTMLElement>(".wr5-prose")!;
    expect(streamedReasoning.open).toBe(true);
    expect(streamedReasoning.compareDocumentPosition(streamedProse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(streamedProse.textContent).toBe("Writing...");
    expect(within(container).getByRole("button", { name: "Stop" })).toHaveProperty("disabled", false);
    fireEvent.click(within(container).getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(container.textContent).toContain("Cancelled"));
    expect(within(container).getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
    expect(streamSignal?.aborted).toBe(false);
  });

  it("does not surface a late cancel conflict after the same streamed operation has already reached its successful terminal result", async () => {
    let streamEvent!: (event: WorkshopCallStreamEvent) => void;
    let operationId = "";
    let rejectCancel!: (reason?: unknown) => void;
    const pendingCancel = new Promise<Awaited<ReturnType<typeof api.workshop.cancelCall>>>((_resolve, reject) => {
      rejectCancel = reject;
    });
    vi.spyOn(api.workshop, "runCallStream").mockImplementation(async (_seriesId, _sessionId, input, onEvent) => {
      operationId = input.operationId!;
      streamEvent = onEvent;
      await new Promise(() => undefined);
    });
    vi.spyOn(api.workshop, "cancelCall").mockImplementation(() => pendingCancel);
    const { container } = setupConnected();
    await waitFor(() => expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false));
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Finish while cancellation races." } });
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(operationId).not.toBe(""));
    act(() => streamEvent({
      type: "assistant-start",
      operationId,
      assistantMessageId: assistantId,
      contextBundleId,
      modelCallId,
      attempt: 1,
      reset: false,
    }));
    fireEvent.click(within(container).getByRole("button", { name: "Stop" }));
    const author = workshopMessage({ content: "Finish while cancellation races." });
    const assistant = workshopMessage({
      id: assistantId,
      role: "assistant",
      content: "The operation completed before cancellation.",
      createdAt: "2026-07-17T02:01:00.000Z",
    });
    act(() => streamEvent({ type: "done", result: callResult(operationId, author, assistant) }));
    await waitFor(() => expect(container.textContent).toContain("The operation completed before cancellation."));
    await act(async () => rejectCancel(new Error("already completed")));
    expect(container.textContent).not.toContain("already completed");
    expect(within(container).getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("restores an explicitly requested Workshop session after leaving for model connections", async () => {
    const first = workshopSession({ title: "First conversation" });
    const second = workshopSession({ id: agentId, kind: "agent", generalChatSystemPrompt: null, title: "Exact return conversation" });
    const onOpenProviderSettings = vi.fn();
    const { container, rerender } = setupConnected({
      sessions: [first, second],
      componentProps: { onOpenProviderSettings },
    });
    await waitFor(() => expect(container.textContent).toContain("First conversation"));
    fireEvent.click(within(container).getByRole("button", { name: /Exact return conversation/u }));
    await waitFor(() => expect(container.querySelector(".wr5-conversation h2")?.textContent).toBe("Exact return conversation"));
    fireEvent.click(within(container).getByRole("button", { name: "Provider settings" }));
    expect(onOpenProviderSettings).toHaveBeenCalledWith(agentId);
    fireEvent.click(within(container).getByRole("button", { name: /First conversation/u }));
    rerender(<ReferenceWorkshopWorkspace onOpenProviderSettings={onOpenProviderSettings} requestedSessionId={agentId} session={projectSession} />);
    await waitFor(() => expect(container.querySelector(".wr5-conversation h2")?.textContent).toBe("Exact return conversation"));
  });

  it("ignores a stale Series list and a stale conversation detail after the author opens another Series", async () => {
    const seriesBId = "21212121-2121-4212-8212-212121212121";
    const seriesCId = "31313131-3131-4313-8313-313131313131";
    const sessionBId = "41414141-4141-4414-8414-414141414141";
    const sessionCId = "51515151-5151-4515-8515-515151515151";
    const sessionA = workshopSession({ title: "Stale Series A conversation" });
    const sessionB = workshopSession({ id: sessionBId, seriesId: seriesBId, title: "Series B conversation" });
    const sessionC = workshopSession({ id: sessionCId, seriesId: seriesCId, title: "Series C conversation" });
    const staleList = deferred<WorkshopSession[]>();
    const staleDetail = deferred<Awaited<ReturnType<typeof api.workshop.getSession>>>();
    const sessionsLoader = vi.fn((targetSeriesId: string) => {
      if (targetSeriesId === seriesId) return staleList.promise;
      if (targetSeriesId === seriesBId) return Promise.resolve([sessionB]);
      return Promise.resolve([sessionC]);
    });
    const sessionLoader = vi.fn((targetSeriesId: string, sessionId: string) => {
      if (targetSeriesId === seriesBId) return staleDetail.promise;
      expect([seriesCId, seriesId]).toContain(targetSeriesId);
      return Promise.resolve(workshopDetail(sessionId === sessionCId ? sessionC : sessionA, [
        workshopMessage({
          content: targetSeriesId === seriesCId ? "Only Series C content" : "Only Series A content",
          ...(targetSeriesId === seriesCId ? { id: "61616161-6161-4616-8616-616161616161" } : {}),
          seriesId: targetSeriesId,
          sessionId,
        }),
      ]));
    });
    const { container, rerender } = setupConnected({
      projectSession: projectSessionFor(seriesId, "Series A"),
      sessionLoader,
      sessionsLoader,
    });
    await waitFor(() => expect(sessionsLoader).toHaveBeenCalledWith(seriesId));

    rerender(<ReferenceWorkshopWorkspace session={projectSessionFor(seriesBId, "Series B")} />);
    container.querySelector<HTMLElement>("#workshop-workspace")!.hidden = false;
    await waitFor(() => expect(container.textContent).toContain("Series B conversation"));
    await waitFor(() => expect(sessionLoader).toHaveBeenCalledWith(seriesBId, sessionBId));
    await act(async () => staleList.resolve([sessionA]));
    expect(container.textContent).toContain("Series B conversation");
    expect(container.textContent).not.toContain("Stale Series A conversation");

    rerender(<ReferenceWorkshopWorkspace session={projectSessionFor(seriesCId, "Series C")} />);
    container.querySelector<HTMLElement>("#workshop-workspace")!.hidden = false;
    await waitFor(() => expect(container.textContent).toContain("Only Series C content"));
    await act(async () => staleDetail.resolve(workshopDetail(sessionB, [
      workshopMessage({
        content: "Late Series B detail",
        id: "71717171-7171-4717-8717-717171717171",
        seriesId: seriesBId,
        sessionId: sessionBId,
      }),
    ])));
    expect(container.textContent).toContain("Only Series C content");
    expect(container.textContent).not.toContain("Late Series B detail");
    expect(container.textContent).not.toContain("Series B conversation");
  });

  it("clears the previous conversation immediately, blocks sending until the target is ready, and keeps unsent drafts session-owned", async () => {
    const second = workshopSession({ id: agentId, kind: "chat", title: "Second conversation" });
    const firstMessage = workshopMessage({ content: "First conversation history" });
    const secondDetail = deferred<Awaited<ReturnType<typeof api.workshop.getSession>>>();
    let secondLoads = 0;
    const sessionLoader = vi.fn((_targetSeriesId: string, sessionId: string) => {
      if (sessionId === agentId && secondLoads++ === 0) return secondDetail.promise;
      return Promise.resolve(workshopDetail(
        sessionId === agentId ? second : workshopSession(),
        sessionId === chatId ? [firstMessage] : [],
      ));
    });
    vi.spyOn(api.workshop, "runCallStream").mockImplementation(async (_targetSeriesId, sessionId, input, onEvent) => {
      const author = workshopMessage({ content: input.userRequest, id: "81818181-8181-4818-8818-818181818181", sessionId });
      const assistant = workshopMessage({
        content: "Persisted answer",
        createdAt: "2026-07-17T02:01:00.000Z",
        id: assistantId,
        role: "assistant",
        sessionId,
      });
      onEvent({ type: "done", result: callResult(input.operationId!, author, assistant) });
    });
    const { container } = setupConnected({ sessionLoader, sessions: [workshopSession(), second] });
    await waitFor(() => expect(container.textContent).toContain("First conversation history"));
    const composer = within(container).getByLabelText("Workshop message") as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: "Unsent first draft" } });

    fireEvent.click(within(container).getByRole("button", { name: /Second conversation/u }));
    expect(container.textContent).not.toContain("First conversation history");
    expect(composer.value).toBe("");
    expect(composer.disabled).toBe(true);
    expect(within(container).getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
    await act(async () => secondDetail.resolve(workshopDetail(second)));
    await waitFor(() => expect(composer.disabled).toBe(false));
    fireEvent.change(composer, { target: { value: "Unsent second draft" } });

    fireEvent.click(within(container).getByRole("button", { name: /Weather-door dialogue/u }));
    expect(composer.value).toBe("Unsent first draft");
    expect(composer.disabled).toBe(true);
    await waitFor(() => expect(composer.disabled).toBe(false));
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(container.textContent).toContain("Persisted answer"));
    expect(composer.value).toBe("");

    fireEvent.click(within(container).getByRole("button", { name: /Second conversation/u }));
    await waitFor(() => expect(composer.disabled).toBe(false));
    expect(composer.value).toBe("Unsent second draft");
    fireEvent.click(within(container).getByRole("button", { name: /Weather-door dialogue/u }));
    await waitFor(() => expect(composer.disabled).toBe(false));
    expect(composer.value).toBe("");
    expect(container.textContent).not.toContain("Unsent first draft");
  });

  it("removes optimistic author and assistant rows when streamed and non-streamed calls reject before a terminal result and reconciliation also fails", async () => {
    const second = workshopSession({ id: agentId, kind: "chat", title: "Failure isolation conversation" });
    const streamFailure = deferred<void>();
    const loadCounts = new Map<string, number>();
    const sessionLoader = vi.fn((_targetSeriesId: string, sessionId: string) => {
      const count = (loadCounts.get(sessionId) ?? 0) + 1;
      loadCounts.set(sessionId, count);
      if ((sessionId === chatId && count === 2) || (sessionId === agentId && count === 2)) {
        return Promise.reject(new Error("reconciliation unavailable"));
      }
      return Promise.resolve(workshopDetail(sessionId === chatId ? workshopSession() : second));
    });
    vi.spyOn(api.workshop, "runCallStream").mockImplementation(async (_targetSeriesId, _sessionId, input, onEvent) => {
      onEvent({
        type: "assistant-start",
        operationId: input.operationId!,
        assistantMessageId: assistantId,
        contextBundleId,
        modelCallId,
        attempt: 1,
        reset: false,
      });
      await streamFailure.promise;
    });
    vi.spyOn(api.workshop, "runCall").mockRejectedValue(new Error("non-streamed request rejected"));
    const { container } = setupConnected({ sessionLoader, sessions: [workshopSession(), second] });
    await waitFor(() => expect(within(container).getByLabelText("Workshop message")).toHaveProperty("disabled", false));
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Streamed request that must be removed" } });
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(container.textContent).toContain("Writing..."));
    fireEvent.click(within(container).getByRole("button", { name: /Failure isolation conversation/u }));
    await waitFor(() => expect(within(container).getByLabelText("Workshop message")).toHaveProperty("disabled", false));
    await act(async () => streamFailure.reject(new Error("stream rejected before terminal")));
    await waitFor(() => expect(loadCounts.get(chatId)).toBe(2));

    fireEvent.click(within(container).getByRole("button", { name: "Model options" }));
    fireEvent.click(within(container).getByLabelText("Stream responses"));
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Non-streamed request that must be removed" } });
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(loadCounts.get(agentId)).toBe(2));
    expect(container.textContent).not.toContain("Non-streamed request that must be removed");
    expect(container.querySelector(".wr5-message[data-status='pending']")).toBeNull();
    expect(container.textContent).not.toContain("Writing...");

    fireEvent.click(within(container).getByRole("button", { name: /Weather-door dialogue/u }));
    await waitFor(() => expect(within(container).getByLabelText("Workshop message")).toHaveProperty("disabled", false));
    expect(container.textContent).not.toContain("Streamed request that must be removed");
    expect(container.querySelector(".wr5-message[data-status='pending']")).toBeNull();
    expect(container.textContent).not.toContain("Writing...");
  });

  it("makes Prompt and Export true modal dialogs with trapped focus, inert background, Escape cancellation, and focus return", async () => {
    const updateSession = vi.spyOn(api.workshop, "updateSession");
    const exportSession = vi.spyOn(api.workshop, "exportSession");
    const { container } = setupConnected();
    await waitFor(() => expect(container.textContent).toContain("Weather-door dialogue"));
    const row = within(container).getByRole("button", { name: /Weather-door dialogue/u });
    const workspace = container.querySelector<HTMLElement>("#workshop-workspace")!;

    fireEvent.contextMenu(row);
    fireEvent.click(within(container).getByRole("menuitem", { name: "General Chat system prompt" }));
    const promptDialog = within(container).getByRole("dialog", { name: "General Chat system prompt dialog" });
    const prompt = within(promptDialog).getByLabelText("General Chat system prompt");
    const savePrompt = within(promptDialog).getByRole("button", { name: "Save prompt" });
    await waitFor(() => expect(promptDialog.contains(document.activeElement)).toBe(true));
    expect(workspace.inert).toBe(true);
    savePrompt.focus();
    fireEvent.keyDown(savePrompt, { key: "Tab" });
    expect(document.activeElement).toBe(prompt);
    fireEvent.keyDown(prompt, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(savePrompt);
    fireEvent.change(prompt, { target: { value: "Must not be persisted" } });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(within(container).queryByRole("dialog", { name: "General Chat system prompt dialog" })).toBeNull());
    expect(updateSession).not.toHaveBeenCalled();
    expect(workspace.inert).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(row));

    fireEvent.contextMenu(row);
    fireEvent.click(within(container).getByRole("menuitem", { name: "Export" }));
    const exportDialog = within(container).getByRole("dialog", { name: "Export conversation dialog" });
    const firstExportOption = within(exportDialog).getByLabelText("Include reasoning");
    const exportButton = within(exportDialog).getByRole("button", { name: "Export" });
    await waitFor(() => expect(exportDialog.contains(document.activeElement)).toBe(true));
    expect(workspace.inert).toBe(true);
    exportButton.focus();
    fireEvent.keyDown(exportButton, { key: "Tab" });
    expect(document.activeElement).toBe(firstExportOption);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(within(container).queryByRole("dialog", { name: "Export conversation dialog" })).toBeNull());
    expect(exportSession).not.toHaveBeenCalled();
    expect(workspace.inert).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it("prevents duplicate conversation creation and ignores a created conversation returned after the author opens another Series", async () => {
    const seriesBId = "91919191-9191-4919-8919-919191919191";
    const sessionB = workshopSession({
      id: "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1",
      seriesId: seriesBId,
      title: "Series B current conversation",
    });
    const createResult = deferred<WorkshopSession>();
    const createSession = vi.spyOn(api.workshop, "createSession").mockImplementation(() => createResult.promise);
    const { container, rerender } = setupConnected({
      projectSession: projectSessionFor(seriesId, "Series A"),
      sessionLoader: async (targetSeriesId, sessionId) => workshopDetail(
        targetSeriesId === seriesBId ? sessionB : workshopSession({ id: sessionId }),
      ),
      sessionsLoader: async (targetSeriesId) => targetSeriesId === seriesBId ? [sessionB] : [workshopSession()],
    });
    await waitFor(() => expect(container.textContent).toContain("Weather-door dialogue"));
    fireEvent.click(within(container).getByRole("button", { name: "New conversation" }));
    fireEvent.click(within(container).getByRole("menuitem", { name: "General Chat" }));
    const pendingCreateButton = within(container).getByRole("button", { name: "New conversation" });
    expect(pendingCreateButton).toHaveProperty("disabled", true);
    fireEvent.click(pendingCreateButton);
    expect(createSession).toHaveBeenCalledTimes(1);

    rerender(<ReferenceWorkshopWorkspace session={projectSessionFor(seriesBId, "Series B")} />);
    container.querySelector<HTMLElement>("#workshop-workspace")!.hidden = false;
    await waitFor(() => expect(container.textContent).toContain("Series B current conversation"));
    await act(async () => createResult.resolve(workshopSession({
      id: "b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1",
      title: "Late Series A created conversation",
    })));
    expect(container.textContent).toContain("Series B current conversation");
    expect(container.textContent).not.toContain("Late Series A created conversation");
  });

  it("keeps Tool Review and real Detail resolution modal, Escape-safe, focus-trapped, inert, and focused back on the review trigger", async () => {
    const toolMessageId = "c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1";
    const agentSession = workshopSession({ id: agentId, kind: "agent", generalChatSystemPrompt: null, title: "Mapping review" });
    const tool = workshopMessage({
      id: toolMessageId,
      sessionId: agentId,
      role: "tool",
      mode: "agent",
      content: JSON.stringify({ schemaVersion: 1, tool: "codex.create_entry", input: { name: "Rin Vale" } }),
      toolExecution: undefined,
    });
    const executeCreate = vi.spyOn(api.workshop, "executeCodexCreateEntryTool").mockRejectedValue(new ApiError(
      "Detail type mapping is required",
      409,
      {
        code: "CODEX_DETAIL_TYPE_CREATION_REQUIRED",
        message: "Choose how to resolve the missing detail type.",
        missingDetailTypes: [{ label: "Eye color", valuePreview: "storm grey", suggestions: [] }],
        availableDetailTypes: [],
        planner: { status: "unavailable", message: "Manual mapping is required." },
      },
    ));
    const { container } = setupConnected({ sessions: [agentSession], messages: { [agentId]: [tool] } });
    await waitFor(() => expect(within(container).getByRole("button", { name: "Review request" })).toBeTruthy());
    const reviewTrigger = within(container).getByRole("button", { name: "Review request" });
    const workspace = container.querySelector<HTMLElement>("#workshop-workspace")!;

    reviewTrigger.focus();
    fireEvent.click(reviewTrigger);
    const firstReview = within(container).getByRole("dialog", { name: "Request review" });
    await waitFor(() => expect(firstReview.contains(document.activeElement)).toBe(true));
    expect(workspace.inert).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(within(container).queryByRole("dialog", { name: "Request review" })).toBeNull());
    expect(executeCreate).not.toHaveBeenCalled();
    expect(workspace.inert).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(reviewTrigger));

    fireEvent.click(reviewTrigger);
    fireEvent.click(within(container).getByRole("button", { name: "Confirm and run" }));
    const resolution = await within(container).findByRole("dialog", { name: "Resolve Detail Types" });
    expect(resolution.textContent).toContain("Eye color");
    expect(resolution.textContent).toContain("Manual mapping is required.");
    await waitFor(() => expect(resolution.contains(document.activeElement)).toBe(true));
    expect(workspace.inert).toBe(true);
    const cancelButtons = within(resolution).getAllByRole("button", { name: "Cancel" });
    const firstCancel = cancelButtons[0]!;
    const lastCancel = cancelButtons.at(-1)!;
    lastCancel.focus();
    fireEvent.keyDown(lastCancel, { key: "Tab" });
    expect(document.activeElement).toBe(firstCancel);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(within(container).queryByRole("dialog", { name: "Resolve Detail Types" })).toBeNull());
    expect(executeCreate).toHaveBeenCalledTimes(1);
    expect(workspace.inert).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(reviewTrigger));
  });

  it("does not let a late conversation detail overwrite a dirty General Chat prompt and saves to the originating conversation", async () => {
    const pendingDetail = deferred<Awaited<ReturnType<typeof api.workshop.getSession>>>();
    const updateSession = vi.spyOn(api.workshop, "updateSession").mockImplementation(async (_targetSeriesId, _sessionId, input) => ({
      ...workshopSession(),
      generalChatSystemPrompt: input.generalChatSystemPrompt ?? "",
    } as WorkshopSession));
    const { container } = setupConnected({ sessionLoader: () => pendingDetail.promise });
    await waitFor(() => expect(container.textContent).toContain("Weather-door dialogue"));
    const row = within(container).getByRole("button", { name: /Weather-door dialogue/u });
    fireEvent.contextMenu(row);
    fireEvent.click(within(container).getByRole("menuitem", { name: "General Chat system prompt" }));
    const prompt = within(container).getByLabelText("General Chat system prompt") as HTMLTextAreaElement;
    fireEvent.change(prompt, { target: { value: "Unsaved author prompt must survive" } });

    await act(async () => pendingDetail.resolve(workshopDetail(workshopSession({
      generalChatSystemPrompt: "Late server prompt must not replace the draft",
    }))));
    expect(prompt.value).toBe("Unsaved author prompt must survive");
    fireEvent.click(within(container).getByRole("button", { name: "Save prompt" }));
    await waitFor(() => expect(updateSession).toHaveBeenCalledWith(seriesId, chatId, {
      generalChatSystemPrompt: "Unsaved author prompt must survive",
    }));
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("does not let a late automatic title response overwrite a manual Rename completed after sending", async () => {
    const untitled = workshopSession({ title: "New chat" });
    const automaticRename = deferred<WorkshopSession>();
    const updateSession = vi.spyOn(api.workshop, "updateSession").mockImplementation(async (_targetSeriesId, _sessionId, input) => {
      if (input.title === "Manual title wins") return { ...untitled, title: input.title };
      return automaticRename.promise;
    });
    vi.spyOn(api.workshop, "runCallStream").mockImplementation(async (_targetSeriesId, sessionId, input, onEvent) => {
      const author = workshopMessage({ content: input.userRequest, id: "d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1", sessionId });
      const assistant = workshopMessage({
        content: "Completed response",
        createdAt: "2026-07-17T02:01:00.000Z",
        id: assistantId,
        role: "assistant",
        sessionId,
      });
      onEvent({ type: "done", result: callResult(input.operationId!, author, assistant) });
    });
    const { container } = setupConnected({ sessions: [untitled] });
    await waitFor(() => expect(within(container).getByLabelText("Workshop message")).toHaveProperty("disabled", false));
    fireEvent.change(within(container).getByLabelText("Workshop message"), { target: { value: "Name this storm crossing conversation" } });
    fireEvent.click(within(container).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(updateSession).toHaveBeenCalledTimes(1));
    const automaticTitle = updateSession.mock.calls[0]![2].title!;
    expect(automaticTitle).not.toBe("New chat");
    expect(updateSession).toHaveBeenNthCalledWith(1, seriesId, chatId, {
      expectedTitle: "New chat",
      title: automaticTitle,
    });

    const row = within(container).getByRole("button", { name: /New chat/u });
    fireEvent.contextMenu(row);
    fireEvent.click(within(container).getByRole("menuitem", { name: "Rename" }));
    const rename = within(container).getByLabelText("Conversation title");
    fireEvent.change(rename, { target: { value: "Manual title wins" } });
    fireEvent.submit(rename.closest("form")!);
    await waitFor(() => expect(container.textContent).toContain("Manual title wins"));
    expect(updateSession).toHaveBeenCalledTimes(2);

    await act(async () => automaticRename.resolve({ ...untitled, title: automaticTitle }));
    expect(container.querySelector(".wr5-conversation h2")?.textContent).toBe("Manual title wins");
    expect(within(container).getByRole("button", { name: /Manual title wins/u })).toBeTruthy();
  });
});
