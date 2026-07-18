// @vitest-environment jsdom

import type {
  ModelProfile,
  ProviderModelDescriptor,
  WorkshopCallResult,
  WorkshopContextBasket,
  WorkshopMessage,
  WorkshopSession,
} from "@novel-studio/contracts";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api";
import type { ProjectSessionState } from "../../app/useProjectSession";
import { ReferenceWorkshopWorkspace } from "./ReferenceWorkshopWorkspace";

const seriesId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const profileId = "33333333-3333-4333-8333-333333333333";
const authorId = "44444444-4444-4444-8444-444444444444";
const assistantId = "55555555-5555-4555-8555-555555555555";
const timestamp = "2026-07-18T02:00:00.000Z";

function workshopSession(): WorkshopSession {
  return {
    schemaVersion: 2,
    id: sessionId,
    seriesId,
    kind: "chat",
    generalChatSystemPrompt: "Keep the author's intent.",
    title: "Zero-model draft",
    status: "active",
    branchOfMessageId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
    lastMessageAt: timestamp,
  };
}

function message(role: "author" | "assistant", content: string, id: string, createdAt = timestamp): WorkshopMessage {
  return {
    schemaVersion: 2,
    id,
    seriesId,
    sessionId,
    role,
    mode: "general-chat",
    status: "succeeded",
    content,
    reasoningContent: "",
    reasoningOutputKind: "none",
    contextBundleId: null,
    modelCallId: null,
    proposalIds: [],
    attachmentIds: [],
    errorCode: null,
    errorMessage: null,
    createdAt,
  };
}

function profile(): ModelProfile {
  return {
    schemaVersion: 2,
    id: profileId,
    title: "Mock regression model",
    provider: "mock",
    model: "mock-regression-v1",
    baseUrl: null,
    credentialRef: null,
    defaultParameters: {},
    reasoningPreference: null,
    capabilities: { embeddings: false, modelList: true, streamText: true, structuredOutput: false, tokenEstimate: true },
    contextWindowTokens: 8192,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  };
}

function descriptor(): ProviderModelDescriptor {
  return {
    id: "mock-regression-v1",
    title: "Mock regression model",
    contextWindowTokens: 8192,
    capabilities: { embeddings: false, modelList: true, streamText: true, structuredOutput: false, tokenEstimate: true },
    reasoning: { kind: "unsupported" },
  };
}

const basket: WorkshopContextBasket = {
  schemaVersion: 2,
  id: "66666666-6666-4666-8666-666666666666",
  seriesId,
  sessionId,
  sceneId: null,
  blockId: null,
  selection: null,
  items: [],
  createdAt: timestamp,
  updatedAt: timestamp,
};

const projectSession = {
  activeSeries: {
    manifest: { id: seriesId, title: "Saltwake" },
    books: [{ id: "77777777-7777-4777-8777-777777777777", title: "Volume One", order: 1 }],
    acts: [],
    chapters: [],
    scenes: [],
  },
  selectedScene: null,
  seriesList: [],
  isLibraryLoading: false,
  isOpeningSeries: false,
} as unknown as ProjectSessionState;

function setup(options: { profiles?: ModelProfile[]; messages?: WorkshopMessage[]; onOpenProviderSettings?: (sessionId: string | null) => void } = {}) {
  const currentSession = workshopSession();
  vi.spyOn(api.workshop, "listSessions").mockResolvedValue([currentSession]);
  vi.spyOn(api.workshop, "getSession").mockResolvedValue({
    session: currentSession,
    basket,
    messages: options.messages ?? [],
    attachments: [],
    agentRuns: { runs: [], diagnostics: [] },
  } as unknown as Awaited<ReturnType<typeof api.workshop.getSession>>);
  vi.spyOn(api.ai, "listModelProfiles").mockResolvedValue(options.profiles ?? []);
  vi.spyOn(api.ai, "listProviderModels").mockResolvedValue([descriptor()]);
  vi.spyOn(api.proposals, "list").mockResolvedValue({ items: [], diagnostics: [] } as unknown as Awaited<ReturnType<typeof api.proposals.list>>);
  vi.spyOn(api.codex, "listCategories").mockResolvedValue([]);
  vi.spyOn(api.codex, "listDetailTypes").mockResolvedValue([]);
  vi.spyOn(api.codex, "listEntries").mockResolvedValue([]);
  const rendered = render(<ReferenceWorkshopWorkspace
    {...(options.onOpenProviderSettings ? { onOpenProviderSettings: options.onOpenProviderSettings } : {})}
    session={projectSession}
  />);
  rendered.container.querySelector<HTMLElement>("#workshop-workspace")!.hidden = false;
  return rendered;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NS-514 Workshop zero-model and composer regression", () => {
  it("keeps non-model Workshop controls usable without a configured model", async () => {
    const onOpenProviderSettings = vi.fn();
    const author = message("author", "Check the weather door.", authorId);
    const assistant = message("assistant", "The pressure plate controls it.", assistantId, "2026-07-18T02:01:00.000Z");
    const { container } = setup({ messages: [author, assistant], onOpenProviderSettings });
    const composer = await waitFor(() => {
      const control = within(container).getByLabelText("Workshop message") as HTMLTextAreaElement;
      expect(control.disabled).toBe(false);
      return control;
    });

    fireEvent.change(composer, { target: { value: "A draft that must remain editable." } });
    expect(composer.value).toBe("A draft that must remain editable.");
    expect(within(container).getByText(/Configure a model connection in Settings before sending or resending/u)).toBeTruthy();
    expect(within(container).getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
    expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", true);
    expect(within(container).getByRole("button", { name: /Context/u })).toHaveProperty("disabled", false);
    expect(within(container).getByRole("button", { name: "Attach file" })).toHaveProperty("disabled", false);
    expect((within(container).getByLabelText("Choose Workshop attachment") as HTMLInputElement).disabled).toBe(false);
    expect(within(container).getByRole("button", { name: "New conversation" })).toHaveProperty("disabled", false);

    fireEvent.click(within(container).getByRole("button", { name: /No model configured/u }));
    const modelDialog = within(container).getByRole("dialog", { name: "Choose model" });
    expect(modelDialog.textContent).toContain("No model configured");
    fireEvent.click(within(modelDialog).getByRole("button", { name: "Open Model connections" }));
    expect(onOpenProviderSettings).toHaveBeenCalledWith(sessionId);

    const authorArticle = container.querySelector<HTMLElement>(`[data-message-id='${authorId}']`)!;
    fireEvent.click(within(authorArticle).getByRole("button", { name: "Open message actions" }));
    expect(within(authorArticle).getByRole("menuitem", { name: "Edit and resend" })).toHaveProperty("disabled", true);
    expect(within(authorArticle).getByRole("menuitem", { name: "Resend" })).toHaveProperty("disabled", true);
    expect(within(authorArticle).getByRole("menuitem", { name: "Branch" })).toHaveProperty("disabled", false);
    expect(within(authorArticle).getByRole("menuitem", { name: "Delete turn" })).toHaveProperty("disabled", false);
  });

  it("preserves Shift Enter newlines and sends with Enter after model selection", async () => {
    const runCall = vi.spyOn(api.workshop, "runCallStream").mockImplementation(async (_seriesId, _sessionId, input, onEvent) => {
      const author = message("author", input.userRequest, authorId);
      const assistant = message("assistant", "Response", assistantId, "2026-07-18T02:01:00.000Z");
      const result: WorkshopCallResult = {
        operationId: input.operationId!,
        authorMessage: author,
        assistantMessage: assistant,
        toolMessages: [],
        contextBundleId: "88888888-8888-4888-8888-888888888888",
        modelCallId: "99999999-9999-4999-8999-999999999999",
        status: "succeeded",
        responseText: assistant.content,
        estimatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        actualUsage: null,
        agentRun: null,
      };
      onEvent({ type: "done", result });
    });
    const { container } = setup({ profiles: [profile()] });
    const composer = await waitFor(() => {
      const control = within(container).getByLabelText("Workshop message") as HTMLTextAreaElement;
      expect(within(container).getByRole("button", { name: "Model options" })).toHaveProperty("disabled", false);
      return control;
    });
    fireEvent.change(composer, { target: { value: "First line\nSecond line" } });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    expect(runCall).not.toHaveBeenCalled();
    expect(composer.value).toBe("First line\nSecond line");
    fireEvent.keyDown(composer, { key: "Enter" });
    await waitFor(() => expect(runCall).toHaveBeenCalledTimes(1));
    expect(runCall.mock.calls[0]![2].userRequest).toBe("First line\nSecond line");
  });
});
