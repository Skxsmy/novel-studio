import type {
  CloudPolicy,
  ModelProfile,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  SeriesDetail,
} from "@novel-studio/contracts";
import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../../api";
import {
  cloudPolicyOptions,
  connectionSummary,
  emptyModelProfileForm,
  formFromProfile,
  modelProfileInputFromForm,
  modelsSummary,
  profileStatusClass,
  profileStatusLabel,
  providerOptions,
  updateModelProfileInputFromForm,
  type ModelProfileForm,
} from "./settingsViewModel";

type SettingsSection = "project" | "models";

export interface SettingsWorkspaceProps {
  onUpdateCloudPolicy: (cloudPolicy: CloudPolicy) => Promise<void>;
  series: SeriesDetail | null;
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

export function SettingsWorkspace({ onUpdateCloudPolicy, series }: SettingsWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("models");
  const [connectionResult, setConnectionResult] = useState<ProviderConnectionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ModelProfileForm>(emptyModelProfileForm);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [models, setModels] = useState<ProviderModelDescriptor[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [projectCloudPolicy, setProjectCloudPolicy] = useState<CloudPolicy>(
    series?.manifest.cloudPolicy ?? "local-only",
  );
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  useEffect(() => {
    setProjectCloudPolicy(series?.manifest.cloudPolicy ?? "local-only");
  }, [series?.manifest.cloudPolicy]);

  useEffect(() => {
    let cancelled = false;
    setConnectionResult(null);
    setErrorMessage(null);
    setModels([]);
    setProfiles([]);
    setResultMessage(null);
    setSelectedProfileId(null);

    if (!series) {
      setForm(emptyModelProfileForm);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingProfiles(true);
    void api.ai.listModelProfiles(series.manifest.id)
      .then((loadedProfiles) => {
        if (cancelled) return;
        setProfiles(loadedProfiles);
        const firstProfile = loadedProfiles[0] ?? null;
        setSelectedProfileId(firstProfile?.id ?? null);
        setForm(firstProfile ? formFromProfile(firstProfile) : emptyModelProfileForm);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(formatError(error, "Failed to load model profiles"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProfiles(false);
      });

    return () => {
      cancelled = true;
    };
  }, [series]);

  function updateForm<K extends keyof ModelProfileForm>(field: K, value: ModelProfileForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startNewModel() {
    setActiveSection("models");
    setConnectionResult(null);
    setErrorMessage(null);
    setForm(emptyModelProfileForm);
    setModels([]);
    setResultMessage(null);
    setSelectedProfileId(null);
  }

  function selectProfile(profile: ModelProfile) {
    setConnectionResult(null);
    setErrorMessage(null);
    setForm(formFromProfile(profile));
    setModels([]);
    setResultMessage(null);
    setSelectedProfileId(profile.id);
  }

  async function saveProjectPolicy() {
    if (!series) return;
    setIsSavingPolicy(true);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      await onUpdateCloudPolicy(projectCloudPolicy);
      setResultMessage("Project cloud policy saved.");
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to save project cloud policy"));
    } finally {
      setIsSavingPolicy(false);
    }
  }

  async function saveModelProfile() {
    if (!series) return;
    setIsSaving(true);
    setConnectionResult(null);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      let saved = form.id
        ? await api.ai.updateModelProfile(series.manifest.id, form.id, updateModelProfileInputFromForm(form))
        : await api.ai.createModelProfile(series.manifest.id, modelProfileInputFromForm(form));
      if (form.secret.trim()) {
        const credential = await api.ai.saveModelCredential(series.manifest.id, saved.id, {
          secret: form.secret.trim(),
        });
        saved = credential.modelProfile;
      }
      setProfiles((current) => replaceProfile(current, saved));
      setSelectedProfileId(saved.id);
      setForm(formFromProfile(saved));
      setResultMessage(form.secret.trim() ? "Model and key saved." : "Model saved.");
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to save model profile"));
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    if (!series || !form.id) {
      setErrorMessage("Save the model profile before testing.");
      return;
    }
    setIsTesting(true);
    setConnectionResult(null);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      const result = await api.ai.testModelProfile(series.manifest.id, form.id);
      setConnectionResult(result);
      setModels(result.models);
      setResultMessage(result.ok ? "Connection ok." : "Connection failed.");
    } catch (error) {
      setErrorMessage(formatError(error, "Connection test failed"));
    } finally {
      setIsTesting(false);
    }
  }

  async function fetchModels() {
    if (!series || !form.id) {
      setErrorMessage("Save the model profile before fetching models.");
      return;
    }
    setIsFetchingModels(true);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      setModels(await api.ai.listProviderModels(series.manifest.id, form.id));
      setResultMessage("Provider model list updated.");
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to fetch provider models"));
    } finally {
      setIsFetchingModels(false);
    }
  }

  const formDisabled = !series || isSaving;
  const savedProfileRequired = !series || !form.id;

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Configure project policy and model connections.</p>
        </div>
        <button className="btn primary" disabled={!series} onClick={startNewModel} type="button">
          New Model
        </button>
      </div>

      <div className="settings-grid">
        <aside className="panel no-shadow">
          <div className="panel-body settings-nav">
            <button
              className={`btn${activeSection === "project" ? " primary" : ""}`}
              onClick={() => setActiveSection("project")}
              type="button"
            >
              Project
            </button>
            <button
              className={`btn${activeSection === "models" ? " primary" : ""}`}
              onClick={() => setActiveSection("models")}
              type="button"
            >
              Models
            </button>
          </div>
        </aside>

        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">{activeSection === "project" ? "Project Settings" : "Model Connections"}</div>
              <div className="panel-kicker">
                {series ? series.manifest.title : "Open a project before editing settings"}
              </div>
            </div>
            {activeSection === "models" ? (
              <button className="btn" disabled={!series || isLoadingProfiles} onClick={startNewModel} type="button">
                Add
              </button>
            ) : (
              <button className="btn primary" disabled={!series || isSavingPolicy} onClick={saveProjectPolicy} type="button">
                Save Policy
              </button>
            )}
          </div>

          {!series ? (
            <div className="panel-body">
              <div className="large-note">
                <strong>No project open</strong>
                <p>Open or create a project from the library before editing settings.</p>
              </div>
            </div>
          ) : activeSection === "project" ? (
            <div className="panel-body stack">
              <div className="form-grid">
                <div className="field wide">
                  <label htmlFor="project-cloud-policy">Project cloud policy</label>
                  <select
                    className="select"
                    disabled={isSavingPolicy}
                    id="project-cloud-policy"
                    onChange={(event) => setProjectCloudPolicy(event.target.value as CloudPolicy)}
                    value={projectCloudPolicy}
                  >
                    {cloudPolicyOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row-list">
                {cloudPolicyOptions.map((option) => (
                  <div className="data-row" key={option.value}>
                    <div>
                      <div className="row-title">{option.label}</div>
                      <div className="row-meta">{option.description}</div>
                    </div>
                    <span className={option.value === projectCloudPolicy ? "pill green" : "pill"}>{option.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="panel-body stack">
              {isLoadingProfiles ? <div className="large-note">Loading model profiles...</div> : null}
              {!isLoadingProfiles && profiles.length === 0 ? (
                <div className="large-note">
                  <strong>No model profiles yet</strong>
                  <p>Create the first model profile, save it, then test the connection.</p>
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
                    <div className="row-meta">{profile.provider} / {profile.model}</div>
                  </div>
                  <span className={profileStatusClass(profile)}>{profileStatusLabel(profile)}</span>
                </button>
              ))}
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="model-title">Model title</label>
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
                    onChange={(event) => updateForm("provider", event.target.value as ModelProfileForm["provider"])}
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
                  <label htmlFor="model-cloud-policy">Model cloud policy</label>
                  <select
                    className="select"
                    disabled={formDisabled}
                    id="model-cloud-policy"
                    onChange={(event) => updateForm("cloudPolicy", event.target.value as CloudPolicy)}
                    value={form.cloudPolicy}
                  >
                    {cloudPolicyOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field wide">
                  <label htmlFor="base-url">Base URL</label>
                  <input
                    className="input"
                    disabled={formDisabled}
                    id="base-url"
                    onChange={(event) => updateForm("baseUrl", event.target.value)}
                    placeholder="Optional provider endpoint"
                    value={form.baseUrl}
                  />
                </div>
                <div className="field wide">
                  <label htmlFor="service-key">Service key</label>
                  <input
                    className="input"
                    disabled={formDisabled}
                    id="service-key"
                    onChange={(event) => updateForm("secret", event.target.value)}
                    placeholder={selectedProfile?.credentialRef ? "Leave blank to keep saved key" : "Paste key for this service"}
                    type="password"
                    value={form.secret}
                  />
                </div>
              </div>
              <div className="top-actions">
                <button className="btn" disabled={savedProfileRequired || isTesting} onClick={testConnection} type="button">
                  Test Connection
                </button>
                <button className="btn" disabled={savedProfileRequired || isFetchingModels} onClick={fetchModels} type="button">
                  Fetch Models
                </button>
                <button className="btn primary" disabled={!series || isSaving} onClick={saveModelProfile} type="button">
                  Save Model
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Status</div>
              <div className="panel-kicker">Last operation</div>
            </div>
          </div>
          <div className="panel-body stack">
            {errorMessage ? <div className="large-note is-error">{errorMessage}</div> : null}
            {resultMessage ? <div className="large-note is-success">{resultMessage}</div> : null}
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
              <span className="pill">{models.length}</span>
            </div>
            {models.map((model) => (
              <div className="data-row" key={model.id}>
                <div>
                  <div className="row-title">{model.title}</div>
                  <div className="row-meta">{model.id}</div>
                </div>
                <span className="pill">{model.contextWindowTokens.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
