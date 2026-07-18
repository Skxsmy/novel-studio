// @vitest-environment jsdom

import type { ModelProfile, ProviderModelDescriptor } from "@novel-studio/contracts";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api";
import { ReferenceSettingsWorkspace } from "./ReferenceSettingsWorkspace";

const profileId = "11111111-1111-4111-8111-111111111111";
const timestamp = "2026-07-18T02:00:00.000Z";

function profile(overrides: Partial<ModelProfile> = {}): ModelProfile {
  return {
    schemaVersion: 2,
    id: profileId,
    title: "Real DeepSeek",
    provider: "deepseek",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
    credentialRef: `novel-studio/model-profile/${profileId}`,
    defaultParameters: {},
    reasoningPreference: null,
    capabilities: { embeddings: false, modelList: true, streamText: true, structuredOutput: true, tokenEstimate: true },
    contextWindowTokens: 64000,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
    ...overrides,
  };
}

function modelDescriptor(): ProviderModelDescriptor {
  return {
    id: "deepseek-reasoner",
    title: "DeepSeek Reasoner",
    contextWindowTokens: 64000,
    capabilities: { embeddings: false, modelList: true, streamText: true, structuredOutput: true, tokenEstimate: true },
    reasoning: { kind: "toggle", defaultEnabled: true, canDisable: true },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NS-514 Settings connection recovery", () => {
  it("uses real model profiles and credential controls without fixture connection data", async () => {
    let saved = profile();
    vi.spyOn(api.ai, "listModelProfiles").mockResolvedValue([saved]);
    vi.spyOn(api.ai, "getModelCredentialStatus").mockImplementation(async () => ({
      credentialRef: saved.credentialRef,
      exists: Boolean(saved.credentialRef),
      modelProfile: saved,
      storeKind: "windows-credential-manager",
    }));
    const update = vi.spyOn(api.ai, "updateModelProfile").mockImplementation(async (_id, input) => {
      saved = profile({
        baseUrl: input.baseUrl === undefined ? saved.baseUrl : input.baseUrl,
        capabilities: input.capabilities ?? saved.capabilities,
        contextWindowTokens: input.contextWindowTokens ?? saved.contextWindowTokens,
        credentialRef: saved.credentialRef,
        defaultParameters: input.defaultParameters ?? saved.defaultParameters,
        model: input.model ?? saved.model,
        provider: input.provider ?? saved.provider,
        reasoningPreference: input.reasoningPreference === undefined ? saved.reasoningPreference : input.reasoningPreference,
        title: input.title ?? saved.title,
      });
      return saved;
    });
    const saveCredential = vi.spyOn(api.ai, "saveModelCredential").mockImplementation(async (_id, input) => {
      expect(input.secret).toBe("replacement-secret");
      saved = profile({ credentialRef: `novel-studio/model-profile/${profileId}` });
      return { credentialRef: saved.credentialRef!, modelProfile: saved, storeKind: "windows-credential-manager" };
    });
    const deleteCredential = vi.spyOn(api.ai, "deleteModelCredential").mockImplementation(async () => {
      saved = profile({ credentialRef: null });
      return { deleted: true, modelProfile: saved, storeKind: "windows-credential-manager" };
    });
    const listModels = vi.spyOn(api.ai, "listProviderModels").mockResolvedValue([modelDescriptor()]);
    vi.spyOn(api.ai, "testModelProfile").mockResolvedValue({
      capabilities: saved.capabilities,
      error: null,
      modelProfileId: profileId,
      models: [modelDescriptor()],
      ok: true,
      provider: "deepseek",
    });

    const { container, findByRole } = render(<ReferenceSettingsWorkspace connected />);
    container.querySelector<HTMLElement>("#settings-workspace")!.hidden = false;
    const connected = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".st7-connected-settings");
      expect(element).toBeTruthy();
      return element!;
    });
    expect(connected.textContent).toContain("Real DeepSeek");
    expect(connected.textContent).not.toContain("DeepSeek Primary");
    expect((within(connected).getByLabelText("Service key") as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(connected.textContent).toContain("Saved in the system credential store."));

    fireEvent.click(within(connected).getByRole("button", { name: "Browse models" }));
    await waitFor(() => expect(listModels).toHaveBeenCalledWith(profileId));
    fireEvent.click(await findByRole("button", { name: /DeepSeek Reasoner/ }));
    expect((within(connected).getByLabelText("Model") as HTMLInputElement).value).toBe("deepseek-reasoner");

    fireEvent.change(within(connected).getByLabelText("Service key"), { target: { value: "replacement-secret" } });
    fireEvent.click(within(connected).getByRole("button", { name: "Save or replace key" }));
    await waitFor(() => expect(saveCredential).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalled();
    expect((within(connected).getByLabelText("Service key") as HTMLInputElement).value).toBe("");

    fireEvent.click(within(connected).getByRole("button", { name: "Delete key" }));
    await waitFor(() => expect(deleteCredential).toHaveBeenCalledWith(profileId));
    expect(within(connected).getByText("Service key removed.")).toBeTruthy();

    const embeddings = container.querySelector<HTMLElement>("[data-st7-page='embeddings']")!;
    expect(embeddings.getAttribute("aria-disabled")).toBe("true");
    expect([...embeddings.querySelectorAll<HTMLInputElement | HTMLButtonElement>("button, input")].every((control) => control.disabled)).toBe(true);
  });
});
