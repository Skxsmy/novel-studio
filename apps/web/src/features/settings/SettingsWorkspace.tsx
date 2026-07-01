import type {
  AiProvider,
  ModelProfile,
  ModelProfileCredentialStatus,
  ProviderConnectionResult,
  ProviderModelDescriptor,
} from "@novel-studio/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../../api";
import {
  connectionSummary,
  credentialStatusClass,
  credentialStatusLabel,
  credentialSummary,
  defaultFormForProvider,
  emptyModelProfileForm,
  formFromProfile,
  modelProfileInputFromForm,
  modelsSummary,
  profileStatusClass,
  profileStatusLabel,
  providerDefaultsForSelection,
  providerLabel,
  providerOptions,
  requiresServiceKey,
  updateModelProfileInputFromForm,
  visibleSettingsProfile,
  type ModelProfileForm,
} from "./settingsViewModel";

export interface SettingsWorkspaceProps {
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

  if (error instanceof Error) return error.message;
  return fallback;
}

function replaceProfile(profiles: ModelProfile[], profile: ModelProfile) {
  const index = profiles.findIndex((candidate) => candidate.id === profile.id);
  if (index === -1) return [profile, ...profiles];
  return profiles.map((candidate) => (candidate.id === profile.id ? profile : candidate));
}

function profileSubtitle(profile: ModelProfile) {
  return `${providerLabel(profile.provider)} / ${profile.model}`;
}

export function SettingsWorkspace({}: SettingsWorkspaceProps = {}) {
  const serviceKeyInputRef = useRef<HTMLInputElement | null>(null);
  const [connectionResult, setConnectionResult] = useState<ProviderConnectionResult | null>(null);
  const [credentialStatus, setCredentialStatus] = useState<ModelProfileCredentialStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ModelProfileForm>(emptyModelProfileForm);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeletingCredential, setIsDeletingCredential] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isModelsExpanded, setIsModelsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCredential, setIsSavingCredential] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [models, setModels] = useState<ProviderModelDescriptor[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );
  const credentialProfile = selectedProfile ?? credentialStatus?.modelProfile ?? null;

  useEffect(() => {
    let cancelled = false;
    setConnectionResult(null);
    setCredentialStatus(null);
    setErrorMessage(null);
    setModels([]);
    setIsModelsExpanded(false);
    setProfiles([]);
    setResultMessage(null);
    setSelectedProfileId(null);

    setIsLoadingProfiles(true);
    void api.ai.listModelProfiles()
      .then((loadedProfiles) => {
        if (cancelled) return;
        const visibleProfiles = loadedProfiles.filter(visibleSettingsProfile);
        setProfiles(visibleProfiles);
        const firstProfile = visibleProfiles[0] ?? null;
        setSelectedProfileId(firstProfile?.id ?? null);
        setForm(firstProfile ? formFromProfile(firstProfile) : emptyModelProfileForm);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(formatError(error, "Failed to load model settings"));
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
    if (!selectedProfileId) {
      return () => {
        cancelled = true;
      };
    }

    void api.ai.getModelCredentialStatus(selectedProfileId)
      .then((status) => {
        if (cancelled) return;
        setCredentialStatus(status);
        if (visibleSettingsProfile(status.modelProfile)) {
          setProfiles((current) => replaceProfile(current, status.modelProfile));
          setForm((current) => (
            current.id === status.modelProfile.id ? formFromProfile(status.modelProfile) : current
          ));
        }
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(formatError(error, "Failed to load service key status"));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  function updateForm<K extends keyof ModelProfileForm>(field: K, value: ModelProfileForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function currentServiceKeySecret() {
    return (serviceKeyInputRef.current?.value ?? form.secret).trim();
  }

  function updateSecretInput(value: string) {
    updateForm("secret", value);
  }

  function changeProvider(provider: AiProvider) {
    const defaults = providerDefaultsForSelection(provider);
    setConnectionResult(null);
    setCredentialStatus(null);
    setModels([]);
    setResultMessage(null);
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

  function startNewModel() {
    setConnectionResult(null);
    setCredentialStatus(null);
    setErrorMessage(null);
    setForm(defaultFormForProvider("deepseek"));
    setIsArchiveConfirmOpen(false);
    setModels([]);
    setIsModelsExpanded(false);
    setResultMessage(null);
    setSelectedProfileId(null);
  }

  function selectProfile(profile: ModelProfile) {
    setConnectionResult(null);
    setCredentialStatus(null);
    setErrorMessage(null);
    setForm(formFromProfile(profile));
    setIsArchiveConfirmOpen(false);
    setModels([]);
    setIsModelsExpanded(false);
    setResultMessage(null);
    setSelectedProfileId(profile.id);
  }

  async function persistCurrentProfile(options: { saveSecret: boolean; secret?: string }): Promise<ModelProfile> {
    let saved = form.id
      ? await api.ai.updateModelProfile(form.id, updateModelProfileInputFromForm(form))
      : await api.ai.createModelProfile(modelProfileInputFromForm(form));
    if (options.saveSecret) {
      const secret = (options.secret ?? currentServiceKeySecret()).trim();
      if (secret) {
        const credential = await api.ai.saveModelCredential(saved.id, {
          secret,
        });
        saved = credential.modelProfile;
        setCredentialStatus(await api.ai.getModelCredentialStatus(saved.id));
      }
    } else if (!saved.credentialRef) {
      setCredentialStatus(null);
    }
    setProfiles((current) => replaceProfile(current, saved));
    setSelectedProfileId(saved.id);
    setForm(formFromProfile(saved));
    return saved;
  }

  async function saveModelProfile() {
    setIsSaving(true);
    setConnectionResult(null);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      const secret = currentServiceKeySecret();
      await persistCurrentProfile({ saveSecret: true, secret });
      setResultMessage(secret
        ? "Model setting saved. Service key stored and verified."
        : "Model setting saved.");
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to save model setting"));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCredential() {
    const secret = currentServiceKeySecret();
    if (!secret) {
      setErrorMessage("Paste a service key before saving it.");
      return;
    }
    setIsSavingCredential(true);
    setConnectionResult(null);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      await persistCurrentProfile({ saveSecret: true, secret });
      setResultMessage("Service key stored and verified.");
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to save service key"));
    } finally {
      setIsSavingCredential(false);
    }
  }

  async function deleteCredential() {
    if (!form.id) return;
    setIsDeletingCredential(true);
    setConnectionResult(null);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      const result = await api.ai.deleteModelCredential(form.id);
      setProfiles((current) => replaceProfile(current, result.modelProfile));
      setForm(formFromProfile(result.modelProfile));
      setCredentialStatus({
        credentialRef: result.modelProfile.credentialRef,
        exists: false,
        modelProfile: result.modelProfile,
        storeKind: result.storeKind,
      });
      setResultMessage(result.deleted ? "Service key removed." : "Service key reference cleared.");
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to remove service key"));
    } finally {
      setIsDeletingCredential(false);
    }
  }

  async function archiveModelProfile() {
    if (!form.id) return;
    setIsArchiving(true);
    setConnectionResult(null);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      await api.ai.archiveModelProfile(form.id);
      const nextProfiles = profiles.filter((profile) => profile.id !== form.id);
      const nextProfile = nextProfiles[0] ?? null;
      setProfiles(nextProfiles);
      setSelectedProfileId(nextProfile?.id ?? null);
      setForm(nextProfile ? formFromProfile(nextProfile) : emptyModelProfileForm);
      setCredentialStatus(null);
      setIsArchiveConfirmOpen(false);
      setModels([]);
      setResultMessage("Model setting archived.");
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to archive model setting"));
    } finally {
      setIsArchiving(false);
    }
  }

  async function testConnection() {
    setIsTesting(true);
    setConnectionResult(null);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      const secret = currentServiceKeySecret();
      if (keyRequired && !secret && !credentialProfile?.credentialRef) {
        setErrorMessage("Paste or save a service key before testing this provider.");
        return;
      }
      const profileId = form.id && !secret
        ? form.id
        : (await persistCurrentProfile({ saveSecret: true, secret })).id;
      const result = await api.ai.testModelProfile(profileId);
      setConnectionResult(result);
      setModels(result.models);
      setIsModelsExpanded(result.models.length > 0 && result.models.length <= 12);
      setResultMessage(result.ok ? "Connection ok." : "Connection failed.");
    } catch (error) {
      setErrorMessage(formatError(error, "Connection test failed"));
    } finally {
      setIsTesting(false);
    }
  }

  async function fetchModels() {
    setIsFetchingModels(true);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      const secret = currentServiceKeySecret();
      if (keyRequired && !secret && !credentialProfile?.credentialRef) {
        setErrorMessage("Paste or save a service key before fetching provider models.");
        return;
      }
      const profileId = form.id && !secret
        ? form.id
        : (await persistCurrentProfile({ saveSecret: true, secret })).id;
      const providerModels = await api.ai.listProviderModels(profileId);
      setModels(providerModels);
      setIsModelsExpanded(providerModels.length > 0 && providerModels.length <= 12);
      setResultMessage("Provider model list updated.");
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to fetch provider models"));
    } finally {
      setIsFetchingModels(false);
    }
  }

  function selectProviderModel(model: ProviderModelDescriptor) {
    setForm((current) => ({
      ...current,
      capabilities: model.capabilities,
      contextWindowTokens: model.contextWindowTokens,
      model: model.id,
    }));
    setIsModelsExpanded(false);
    setResultMessage("Model selected. Save the setting to use it.");
  }

  const formDisabled = isSaving || isSavingCredential || isArchiving || isDeletingCredential || isTesting || isFetchingModels;
  const savedProfileRequired = !form.id;
  const keyRequired = requiresServiceKey(form.provider);

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Model connections and service keys.</p>
        </div>
        <button className="btn primary" onClick={startNewModel} type="button">
          New Connection
        </button>
      </div>

      <div className="settings-grid">
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Connections</div>
              <div className="panel-kicker">{profiles.length} saved</div>
            </div>
            <button className="btn compact" disabled={isLoadingProfiles} onClick={startNewModel} type="button">
              Add
            </button>
          </div>
          <div className="panel-body stack">
            {isLoadingProfiles ? <div className="large-note">Loading model settings...</div> : null}
            {!isLoadingProfiles && profiles.length === 0 ? (
              <div className="large-note">
                <strong>No model settings yet</strong>
                <p>Create a provider connection and save a service key.</p>
              </div>
            ) : null}
            {profiles.map((profile) => (
              <button
                aria-pressed={profile.id === selectedProfileId}
                className={`model-row${profile.id === selectedProfileId ? " is-active" : ""}`}
                key={profile.id}
                onClick={() => selectProfile(profile)}
                type="button"
              >
                <div>
                  <div className="row-title">{profile.title}</div>
                  <div className="row-meta">{profileSubtitle(profile)}</div>
                </div>
                <span className={profileStatusClass(profile)}>{profileStatusLabel(profile)}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">{form.id ? "Edit Model Setting" : "New Model Setting"}</div>
              <div className="panel-kicker">
                Shared across all projects
              </div>
            </div>
            <button className="btn primary" disabled={formDisabled} onClick={saveModelProfile} type="button">
              Save Setting
            </button>
          </div>
          <div className="panel-body stack">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="model-title">Setting name</label>
                <input
                  className="input"
                  disabled={formDisabled}
                  id="model-title"
                  onChange={(event) => updateForm("title", event.target.value)}
                  value={form.title}
                />
              </div>
              <div className="field">
                <label htmlFor="settings-provider">Provider</label>
                <select
                  className="select"
                  disabled={formDisabled}
                  id="settings-provider"
                  onChange={(event) => changeProvider(event.target.value as AiProvider)}
                  value={form.provider}
                >
                  {providerOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="model-id">Model id</label>
                <input
                  className="input"
                  disabled={formDisabled}
                  id="model-id"
                  onChange={(event) => updateForm("model", event.target.value)}
                  value={form.model}
                />
              </div>
              <div className="field">
                <label htmlFor="context-window">Context window</label>
                <input
                  className="input"
                  disabled={formDisabled}
                  id="context-window"
                  min={1}
                  onChange={(event) => updateForm("contextWindowTokens", Number(event.target.value) || 1)}
                  type="number"
                  value={form.contextWindowTokens}
                />
              </div>
              <div className="field wide">
                <label htmlFor="base-url">Base URL</label>
                <input
                  className="input"
                  disabled={formDisabled}
                  id="base-url"
                  onChange={(event) => updateForm("baseUrl", event.target.value)}
                  placeholder="Provider default"
                  value={form.baseUrl}
                />
              </div>
              <div className="field wide">
                <label htmlFor="service-key">Service key</label>
                <input
                  className="input"
                  disabled={formDisabled || !keyRequired}
                  id="service-key"
                  onChange={(event) => updateSecretInput(event.target.value)}
                  onInput={(event) => updateSecretInput(event.currentTarget.value)}
                  placeholder={credentialProfile?.credentialRef ? "Paste a new key to replace the saved key" : "Paste service key"}
                  ref={serviceKeyInputRef}
                  type="password"
                  value={form.secret}
                />
                <div className="field-hint">{credentialSummary(credentialProfile, credentialStatus)}</div>
              </div>
            </div>
            <div className="model-row">
              <div>
                <div className="row-title">Provider</div>
                <div className="row-meta">
                  {keyRequired ? "This provider uses a saved service key." : "This provider can run without a service key."}
                </div>
              </div>
              <span className={keyRequired && !credentialProfile?.credentialRef ? "pill amber" : "pill green"}>
                {providerLabel(form.provider)}
              </span>
            </div>
            <div className="top-actions">
              <button className="btn" disabled={formDisabled} onClick={testConnection} type="button">
                Test Connection
              </button>
              <button className="btn" disabled={formDisabled} onClick={fetchModels} type="button">
                Fetch Models
              </button>
              <button
                className="btn"
                disabled={formDisabled || !keyRequired}
                onClick={() => void saveCredential()}
                type="button"
              >
                Save / Replace Key
              </button>
              {!savedProfileRequired ? (
                <>
                  <button
                    className="btn"
                    disabled={formDisabled || !credentialProfile?.credentialRef}
                    onClick={() => void deleteCredential()}
                    type="button"
                  >
                    Delete Key
                  </button>
                  <button
                    className="btn danger"
                    disabled={formDisabled}
                    onClick={() => setIsArchiveConfirmOpen(true)}
                    type="button"
                  >
                    Archive Setting
                  </button>
                </>
              ) : null}
            </div>
            {isArchiveConfirmOpen ? (
              <div className="inline-confirm">
                <div>
                  <div className="confirm-title">Archive this setting?</div>
                  <div className="confirm-copy">Archived settings leave the active connection list.</div>
                </div>
                <div className="confirm-actions">
                  <button className="btn compact" disabled={isArchiving} onClick={() => setIsArchiveConfirmOpen(false)} type="button">
                    Cancel
                  </button>
                  <button className="btn compact danger" disabled={isArchiving} onClick={() => void archiveModelProfile()} type="button">
                    Archive Setting
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Key And Connection</div>
              <div className="panel-kicker">Current setting</div>
            </div>
          </div>
          <div className="panel-body stack">
            {errorMessage ? <div className="large-note is-error">{errorMessage}</div> : null}
            {resultMessage ? <div className="large-note is-success">{resultMessage}</div> : null}
            <div className="model-row">
              <div>
                <div className="row-title">Service key</div>
                <div className="row-meta">{credentialSummary(credentialProfile, credentialStatus)}</div>
              </div>
              <span className={credentialStatusClass(credentialProfile, credentialStatus)}>
                {credentialStatusLabel(credentialProfile, credentialStatus)}
              </span>
            </div>
            <div className="model-row">
              <div>
                <div className="row-title">Connection</div>
                <div className="row-meta">{connectionSummary(connectionResult)}</div>
              </div>
              <span className={connectionResult?.ok ? "pill green" : "pill"}>{connectionResult?.ok ? "OK" : "Idle"}</span>
            </div>
            <div className="model-row">
              <div>
                <div className="row-title">Provider models</div>
                <div className="row-meta">{modelsSummary(models)}</div>
              </div>
              <div className="row-actions">
                <span className="pill">{models.length}</span>
                {models.length > 0 ? (
                  <button
                    className="btn compact"
                    onClick={() => setIsModelsExpanded((value) => !value)}
                    type="button"
                  >
                    {isModelsExpanded ? "Hide Models" : "Show Models"}
                  </button>
                ) : null}
              </div>
            </div>
            {models.length > 0 && isModelsExpanded ? (
              <div aria-label="Provider model list" className="provider-models-list">
                {models.map((model) => (
                  <button
                    className="data-row"
                    disabled={formDisabled}
                    key={model.id}
                    onClick={() => selectProviderModel(model)}
                    type="button"
                  >
                    <div>
                      <div className="row-title">{model.title}</div>
                      <div className="row-meta">{model.id}</div>
                    </div>
                    <span className="pill">{model.contextWindowTokens.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}
