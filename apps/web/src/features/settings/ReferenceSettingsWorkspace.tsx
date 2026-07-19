import type {
  AiProvider,
  ModelProfile,
  ModelProfileCredentialStatus,
  ProviderConnectionResult,
  ProviderModelDescriptor,
} from "@novel-studio/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, api } from "../../api";
import { ReferenceSurface } from "../../ui/ReferenceSurface";
import {
  credentialSummary,
  defaultFormForProvider,
  emptyModelProfileForm,
  formFromProfile,
  modelProfileInputFromForm,
  providerDefaultsForSelection,
  providerLabel,
  providerOptions,
  requiresServiceKey,
  updateModelProfileInputFromForm,
  visibleSettingsProfile,
  type ModelProfileForm,
} from "./settingsViewModel";
import "./reference-settings.css";

export interface ReferenceSettingsWorkspaceProps {
  connected?: boolean;
  onModelProfilesChanged?: () => void;
}

function formatError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const payload = error.payload;
    if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
      return payload.message;
    }
    if (payload && typeof payload === "object" && "error" in payload) {
      const nested = payload.error;
      if (nested && typeof nested === "object" && "message" in nested && typeof nested.message === "string") {
        return nested.message;
      }
    }
    return `${fallback} (${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function replaceProfile(profiles: ModelProfile[], profile: ModelProfile) {
  const found = profiles.some((candidate) => candidate.id === profile.id);
  return found
    ? profiles.map((candidate) => candidate.id === profile.id ? profile : candidate)
    : [profile, ...profiles];
}

function ReferenceModelConnections({ onModelProfilesChanged }: Pick<ReferenceSettingsWorkspaceProps, "onModelProfilesChanged">) {
  const serviceKeyInputRef = useRef<HTMLInputElement | null>(null);
  const [connectionResult, setConnectionResult] = useState<ProviderConnectionResult | null>(null);
  const [credentialStatus, setCredentialStatus] = useState<ModelProfileCredentialStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ModelProfileForm>(emptyModelProfileForm);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [isModelsExpanded, setIsModelsExpanded] = useState(false);
  const [models, setModels] = useState<ProviderModelDescriptor[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );
  const credentialProfile = selectedProfile ?? credentialStatus?.modelProfile ?? null;
  const keyRequired = requiresServiceKey(form.provider);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingProfiles(true);
    void api.ai.listModelProfiles()
      .then((loadedProfiles) => {
        if (cancelled) return;
        const visibleProfiles = loadedProfiles.filter(visibleSettingsProfile);
        const firstProfile = visibleProfiles[0] ?? null;
        setProfiles(visibleProfiles);
        setSelectedProfileId(firstProfile?.id ?? null);
        setForm(firstProfile ? formFromProfile(firstProfile) : emptyModelProfileForm);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(formatError(error, "Failed to load model connections"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProfiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCredentialStatus(null);
    if (!selectedProfileId) return () => {
      cancelled = true;
    };
    void api.ai.getModelCredentialStatus(selectedProfileId)
      .then((status) => {
        if (cancelled) return;
        setCredentialStatus(status);
        if (visibleSettingsProfile(status.modelProfile)) {
          setProfiles((current) => replaceProfile(current, status.modelProfile));
        }
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(formatError(error, "Failed to check the saved service key"));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  function updateForm<K extends keyof ModelProfileForm>(field: K, value: ModelProfileForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function clearResults() {
    setConnectionResult(null);
    setErrorMessage(null);
    setResultMessage(null);
  }

  function startNewConnection() {
    clearResults();
    setCredentialStatus(null);
    setForm(defaultFormForProvider("deepseek"));
    setIsArchiveConfirmOpen(false);
    setIsModelsExpanded(false);
    setModels([]);
    setSelectedProfileId(null);
  }

  function selectProfile(profile: ModelProfile) {
    clearResults();
    setCredentialStatus(null);
    setForm(formFromProfile(profile));
    setIsArchiveConfirmOpen(false);
    setIsModelsExpanded(false);
    setModels([]);
    setSelectedProfileId(profile.id);
  }

  function changeProvider(provider: AiProvider) {
    const defaults = providerDefaultsForSelection(provider);
    clearResults();
    setCredentialStatus(null);
    setModels([]);
    setIsModelsExpanded(false);
    setForm((current) => ({
      ...current,
      baseUrl: defaults.baseUrl,
      capabilities: defaults.capabilities,
      contextWindowTokens: defaults.contextWindowTokens,
      model: defaults.model,
      provider,
      title: current.id ? current.title : defaults.title,
    }));
  }

  async function persistCurrentProfile(saveSecret: boolean) {
    let saved = form.id
      ? await api.ai.updateModelProfile(form.id, updateModelProfileInputFromForm(form))
      : await api.ai.createModelProfile(modelProfileInputFromForm(form));
    const secret = serviceKeyInputRef.current?.value.trim() ?? "";
    if (saveSecret && secret) {
      const result = await api.ai.saveModelCredential(saved.id, { secret });
      saved = result.modelProfile;
    }
    const status = await api.ai.getModelCredentialStatus(saved.id);
    setCredentialStatus(status);
    setProfiles((current) => replaceProfile(current, status.modelProfile));
    setSelectedProfileId(saved.id);
    setForm(formFromProfile(status.modelProfile));
    if (serviceKeyInputRef.current) serviceKeyInputRef.current.value = "";
    onModelProfilesChanged?.();
    return status.modelProfile;
  }

  async function runBusy(action: () => Promise<void>, fallback: string) {
    setIsBusy(true);
    clearResults();
    try {
      await action();
    } catch (error) {
      setErrorMessage(formatError(error, fallback));
    } finally {
      setIsBusy(false);
    }
  }

  function saveConnection() {
    void runBusy(async () => {
      const hasSecret = Boolean(serviceKeyInputRef.current?.value.trim());
      await persistCurrentProfile(hasSecret);
      setResultMessage(hasSecret
        ? "Connection saved. The new service key is stored in the system credential store."
        : "Connection saved.");
    }, "Failed to save the model connection");
  }

  function saveCredential() {
    const secret = serviceKeyInputRef.current?.value.trim() ?? "";
    if (!secret) {
      setErrorMessage("Paste a service key before saving it.");
      return;
    }
    void runBusy(async () => {
      await persistCurrentProfile(true);
      setResultMessage("Service key saved in the system credential store.");
    }, "Failed to save the service key");
  }

  function deleteCredential() {
    if (!form.id) return;
    void runBusy(async () => {
      const result = await api.ai.deleteModelCredential(form.id!);
      setCredentialStatus({
        credentialRef: result.modelProfile.credentialRef,
        exists: false,
        modelProfile: result.modelProfile,
        storeKind: result.storeKind,
      });
      setProfiles((current) => replaceProfile(current, result.modelProfile));
      setForm(formFromProfile(result.modelProfile));
      setResultMessage(result.deleted ? "Service key removed." : "The missing service-key reference was cleared.");
      onModelProfilesChanged?.();
    }, "Failed to remove the service key");
  }

  function fetchModels() {
    void runBusy(async () => {
      const secret = serviceKeyInputRef.current?.value.trim() ?? "";
      if (keyRequired && !secret && !credentialProfile?.credentialRef) {
        throw new Error("Save a service key before browsing provider models.");
      }
      const profile = form.id && !secret ? selectedProfile : await persistCurrentProfile(Boolean(secret));
      if (!profile) throw new Error("Save this connection before browsing provider models.");
      const loaded = await api.ai.listProviderModels(profile.id);
      setModels(loaded);
      setIsModelsExpanded(true);
      setResultMessage(loaded.length === 0 ? "The provider returned no models." : `${loaded.length} provider models available.`);
    }, "Failed to browse provider models");
  }

  function testConnection() {
    void runBusy(async () => {
      const secret = serviceKeyInputRef.current?.value.trim() ?? "";
      if (keyRequired && !secret && !credentialProfile?.credentialRef) {
        throw new Error("Save a service key before testing this connection.");
      }
      const profile = form.id && !secret ? selectedProfile : await persistCurrentProfile(Boolean(secret));
      if (!profile) throw new Error("Save this connection before testing it.");
      const result = await api.ai.testModelProfile(profile.id);
      setConnectionResult(result);
      setModels(result.models);
      setResultMessage(result.ok ? "Connection available." : "Connection unavailable.");
    }, "Connection test failed");
  }

  function archiveConnection() {
    if (!form.id) return;
    void runBusy(async () => {
      await api.ai.archiveModelProfile(form.id!);
      const remaining = profiles.filter((profile) => profile.id !== form.id);
      const next = remaining[0] ?? null;
      setProfiles(remaining);
      setSelectedProfileId(next?.id ?? null);
      setForm(next ? formFromProfile(next) : emptyModelProfileForm);
      setCredentialStatus(null);
      setModels([]);
      setIsArchiveConfirmOpen(false);
      setResultMessage("Connection archived.");
      onModelProfilesChanged?.();
    }, "Failed to archive the model connection");
  }

  function selectProviderModel(model: ProviderModelDescriptor) {
    setForm((current) => ({
      ...current,
      capabilities: model.capabilities,
      contextWindowTokens: model.contextWindowTokens,
      model: model.id,
    }));
    setIsModelsExpanded(false);
    setResultMessage("Model selected. Save changes to use it.");
  }

  const credentialExists = credentialStatus?.exists ?? Boolean(credentialProfile?.credentialRef);
  const connectionReady = connectionResult?.ok ?? (!keyRequired || credentialExists);
  const statusLabel = isLoadingProfiles ? "Loading" : !form.id ? "New" : connectionReady ? "Configured" : "Needs key";

  return <div className="st7-connected-settings">
    <header className="st7-page-head">
      <div>
        <h2>Model connections</h2>
        <p>Add provider connections once, then choose any configured model in Workshop. Service keys remain separate from project files.</p>
      </div>
    </header>

    <div className="st7-connection-workspace">
      <aside aria-label="Saved model connections" className="st7-connection-browser">
        <div className="st7-section-head st7-connection-browser-head">
          <div><h3>Connections</h3><p>{profiles.length === 1 ? "1 configured connection" : `${profiles.length} configured connections`}</p></div>
          <button className="st7-button" disabled={isBusy || !form.id} onClick={startNewConnection} type="button">New connection</button>
        </div>
        <div aria-label="Model connections" className="st7-connection-list">
          {isLoadingProfiles ? <span className="st7-connection-empty">Loading model connections…</span> : null}
          {!isLoadingProfiles && profiles.length === 0 ? <span className="st7-connection-empty">No model connections configured.</span> : null}
          {profiles.map((profile) => <button
            aria-pressed={profile.id === selectedProfileId}
            className={`st7-connection${profile.id === selectedProfileId ? " is-active" : ""}`}
            key={profile.id}
            onClick={() => selectProfile(profile)}
            title={`${profile.title} · ${providerLabel(profile.provider)} · ${profile.model}`}
            type="button"
          >
            <span className={`st7-dot${profile.credentialRef || !requiresServiceKey(profile.provider) ? " ready" : " draft"}`} aria-hidden="true" />
            <span className="st7-connection-copy">
              <strong>{profile.title}</strong>
              <span className="st7-connection-provider">{providerLabel(profile.provider)}</span>
              <span className="st7-connection-model">{profile.model}</span>
            </span>
          </button>)}
        </div>
      </aside>

      <section aria-label={form.id ? `Edit ${form.title}` : "New model connection"} className="st7-connection-editor">
        <div className="st7-section-head st7-editor-head">
          <div><h3>{form.id ? form.title : "New connection"}</h3><p>{form.id ? `${providerLabel(form.provider)} · ${form.model}` : "Choose a provider and model, then add this connection."}</p></div>
          <span className={`st7-status${connectionReady && form.id ? " ready" : !form.id ? "" : " attention"}`}>{statusLabel}</span>
        </div>
        <div className="st7-form-grid">
          <label className="st7-field"><span>Connection name</span><input aria-label="Connection name" className="st7-input" disabled={isBusy} onChange={(event) => updateForm("title", event.target.value)} value={form.title} /></label>
          <label className="st7-field"><span>Provider</span><select aria-label="Provider" className="st7-select" disabled={isBusy} onChange={(event) => changeProvider(event.target.value as AiProvider)} value={form.provider}>{providerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="st7-field wide"><span>Model</span><span className="st7-input-row"><input aria-label="Model" className="st7-input" disabled={isBusy} onChange={(event) => updateForm("model", event.target.value)} value={form.model} /><button aria-expanded={isModelsExpanded} className="st7-button" disabled={isBusy} onClick={fetchModels} type="button">Browse models</button></span></label>
          <div className="st7-models wide" hidden={!isModelsExpanded}>
            {models.length === 0 ? <span className="st7-model-empty">No provider models returned.</span> : models.map((model) => <button className="st7-model-row" key={model.id} onClick={() => selectProviderModel(model)} type="button"><strong>{model.title}</strong><span>{model.contextWindowTokens.toLocaleString()} context</span></button>)}
          </div>
          <label className="st7-field"><span>Base URL</span><input aria-label="Base URL" className="st7-input" disabled={isBusy} onChange={(event) => updateForm("baseUrl", event.target.value)} type="url" value={form.baseUrl} /></label>
          <label className="st7-field"><span>Context window</span><input aria-label="Context window" className="st7-input" disabled={isBusy} min={1} onChange={(event) => updateForm("contextWindowTokens", Number(event.target.value) || 1)} type="number" value={form.contextWindowTokens} /></label>
          <label className="st7-field wide"><span>Service key</span><input aria-label="Service key" className="st7-input" disabled={isBusy || !keyRequired} placeholder={credentialProfile?.credentialRef ? "Paste a new key to replace the saved key" : "Paste service key"} ref={serviceKeyInputRef} type="password" /><small>{keyRequired ? credentialSummary(credentialProfile, credentialStatus) : "This provider does not require a service key."} The key is never written into project files or returned to this page.</small></label>
          {keyRequired && form.id ? <div className="st7-key-actions wide">
            <button className="st7-button" disabled={isBusy} onClick={saveCredential} type="button">Save or replace key</button>
            <button className="st7-button" disabled={isBusy || !form.id || !credentialExists} onClick={deleteCredential} type="button">Delete key</button>
          </div> : null}
        </div>

        <div className="st7-inline-status st7-real-status">
          <div><strong>Connection check</strong><span>{errorMessage ?? resultMessage ?? (connectionResult ? (connectionResult.ok ? "The provider and model are available." : connectionResult.error?.message ?? "The connection failed.") : "Test this saved connection to verify provider access.")}</span></div>
          <span className={`st7-status${errorMessage || connectionResult?.ok === false ? " attention" : connectionResult?.ok ? " ready" : ""}`}>{errorMessage ? "Error" : connectionResult?.ok ? "Available" : "Not tested"}</span>
        </div>

        <div className="st7-editor-actions">
          <div className="st7-editor-primary-actions">
            <button className="st7-button primary" disabled={isBusy} onClick={saveConnection} type="button">{form.id ? "Save changes" : "Add connection"}</button>
            <button className="st7-button" disabled={isBusy} onClick={testConnection} type="button">Test connection</button>
          </div>
          <button className="st7-button danger" disabled={isBusy || !form.id} onClick={() => setIsArchiveConfirmOpen(true)} type="button">Archive</button>
        </div>
        <div className="st7-inline-status st7-archive-confirm" hidden={!isArchiveConfirmOpen}>
          <div><strong>Archive this connection?</strong><span>It will no longer be available to Workshop or writing actions.</span></div>
          <div className="st7-actions st7-confirm-actions"><button className="st7-button" disabled={isBusy} onClick={() => setIsArchiveConfirmOpen(false)} type="button">Cancel</button><button className="st7-button danger" disabled={isBusy} onClick={archiveConnection} type="button">Archive connection</button></div>
        </div>
      </section>
    </div>
  </div>;
}

export function ReferenceSettingsWorkspace({ connected = false, onModelProfilesChanged }: ReferenceSettingsWorkspaceProps = {}) {
  const connectedRootRef = useRef<HTMLElement | null>(null);
  const [activeSection, setActiveSection] = useState("connections");

  useEffect(() => {
    if (!connected || !connectedRootRef.current) return;
    const root = connectedRootRef.current;
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-st7-section]")) {
      const active = button.dataset.st7Section === activeSection;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const page of root.querySelectorAll<HTMLElement>("[data-st7-page]:not([data-st7-page='connections'])")) {
      page.setAttribute("aria-disabled", "true");
      for (const control of page.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>("button, input, select, textarea")) {
        control.disabled = true;
      }
    }
  }, [activeSection, connected]);

  if (!connected) return <ReferenceSurface selector="#settings-workspace" />;

  const handleNavigation: React.MouseEventHandler<HTMLElement> = (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-st7-section]");
    if (button?.dataset.st7Section) setActiveSection(button.dataset.st7Section);
  };
  const unsupportedSections = ["embeddings", "roles", "prompts", "files", "privacy", "appearance"];

  return <section
    aria-label="Settings workspace"
    className="st7 workspace-view"
    data-workspace-view="Settings"
    hidden
    id="settings-workspace"
    ref={connectedRootRef}
  >
    <header className="st7-head"><div><h1>Settings</h1><p>Shared across the project library</p></div><span className="st7-save-state">Library settings</span></header>
    <div className="st7-layout">
      <ReferenceSurface onClick={handleNavigation} selector="#settings-workspace .st7-nav" />
      <div className="st7-content" id="st7-content">
        <section className="st7-page is-connected" data-st7-page="connections" hidden={activeSection !== "connections"}><ReferenceModelConnections {...(onModelProfilesChanged ? { onModelProfilesChanged } : {})} /></section>
        {unsupportedSections.map((section) => <ReferenceSurface hidden={activeSection !== section} key={section} selector={`[data-st7-page='${section}']`} />)}
      </div>
    </div>
    <ReferenceSurface selector="#st7-library-dialog" />
    <ReferenceSurface selector="#st7-toast" />
  </section>;
}
