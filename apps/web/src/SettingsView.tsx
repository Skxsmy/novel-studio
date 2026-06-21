import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AiProvider,
  ModelProfile,
  ModelProfileCredentialStatus,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  SeriesDetail,
  SeriesManifest,
} from "@novel-studio/contracts";
import { ApiError, api } from "./api";
import { PromptSettingsPanel } from "./PromptSettingsPanel";

const providerLabels: Record<AiProvider, string> = {
  mock: "测试模型",
  openai: "OpenAI",
  anthropic: "Claude",
  google: "Gemini",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  deepseek: "DeepSeek",
  "openai-compatible": "OpenAI 兼容服务",
};

const servicePresets = {
  deepseek: {
    label: "DeepSeek",
    description: "官方 OpenAI 兼容接口",
    provider: "deepseek" as const,
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    contextWindowTokens: 1_000_000,
  },
  custom: {
    label: "自定义兼容服务",
    description: "填写服务商提供的 OpenAI 格式地址",
    provider: "openai-compatible" as const,
    baseUrl: "",
    model: "填写模型代号",
    contextWindowTokens: 8192,
  },
} as const;

type ServicePresetId = keyof typeof servicePresets;

const providerDescriptions: Record<AiProvider, string> = {
  mock: "用于自动化验收，不连接真实模型。",
  openai: "OpenAI 官方接口。",
  anthropic: "Claude 官方接口。",
  google: "Gemini 官方接口。",
  openrouter: "OpenRouter 聚合接口。",
  ollama: "本机 Ollama 服务。",
  deepseek: "DeepSeek 官方接口。服务地址、模型列表和错误码按 DeepSeek 文档适配。",
  "openai-compatible": "使用 OpenAI 格式接口。服务地址以模型提供商官方文档为准。",
};

function providerDescription(provider: AiProvider): string {
  return providerDescriptions[provider];
}

function connectionMessage(result: ProviderConnectionResult | null, error: string): string {
  if (error) return error;
  if (!result) return "尚未测试";
  if (result.ok) return `连接正常，可识别 ${result.models.length} 个模型。`;
  return result.error?.message ?? "连接失败，请检查服务地址、模型名称和密钥。";
}

function credentialLabel(profile: ModelProfile): string {
  return `${profile.title} 的密钥`;
}

function providerMark(provider: AiProvider): string {
  if (provider === "deepseek") return "DS";
  if (provider === "mock") return "验";
  if (provider === "openai-compatible") return "API";
  return "AI";
}

export function SettingsView({
  detail,
  onSeriesManifestUpdated,
}: {
  detail: SeriesDetail;
  onSeriesManifestUpdated: (manifest: SeriesManifest) => void;
}) {
  void onSeriesManifestUpdated;
  const [settingsSection, setSettingsSection] = useState<"models" | "prompts">("models");
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [servicePreset, setServicePreset] = useState<ServicePresetId>("deepseek");
  const [profileDraft, setProfileDraft] = useState({
    title: "",
    baseUrl: "",
    model: "",
    credentialRef: "",
  });
  const [credentialSecret, setCredentialSecret] = useState("");
  const [credentialStatus, setCredentialStatus] = useState<Record<string, ModelProfileCredentialStatus | null>>({});
  const [availableModels, setAvailableModels] = useState<Record<string, ProviderModelDescriptor[]>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [testResults, setTestResults] = useState<Record<string, ProviderConnectionResult | null>>({});
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0] ?? null,
    [profiles, selectedProfileId],
  );

  const loadProfiles = useCallback(async () => {
    const nextProfiles = await api.listModelProfiles(detail.manifest.id);
    setProfiles(nextProfiles);
    setSelectedProfileId((current) =>
      current && nextProfiles.some((profile) => profile.id === current)
        ? current
        : nextProfiles[0]?.id ?? null,
    );
  }, [detail.manifest.id]);

  useEffect(() => {
    void loadProfiles().catch((caught) => {
      setMessage(caught instanceof Error ? caught.message : "无法读取模型设置");
    });
  }, [loadProfiles]);

  useEffect(() => {
    if (!selectedProfile) return;
    setProfileDraft({
      title: selectedProfile.title,
      baseUrl: selectedProfile.baseUrl ?? "",
      model: selectedProfile.model,
      credentialRef: selectedProfile.credentialRef ?? "",
    });
    setCredentialSecret("");
    void api.getModelProfileCredential(detail.manifest.id, selectedProfile.id)
      .then((status) => setCredentialStatus((current) => ({ ...current, [selectedProfile.id]: status })))
      .catch(() => setCredentialStatus((current) => ({ ...current, [selectedProfile.id]: null })));
  }, [detail.manifest.id, selectedProfile]);

  async function createServiceProfile() {
    const preset = servicePresets[servicePreset];
    setBusy("create-service");
    setMessage("");
    try {
      const created = await api.createModelProfile(detail.manifest.id, {
        title: servicePreset === "deepseek" ? "DeepSeek 写作模型" : "自定义兼容服务",
        provider: preset.provider,
        baseUrl: preset.baseUrl || null,
        model: preset.model,
        cloudPolicy: "cloud-allowed",
        capabilities: {
          streamText: true,
          structuredOutput: true,
          embeddings: false,
          tokenEstimate: true,
          modelList: true,
        },
        contextWindowTokens: preset.contextWindowTokens,
      });
      await loadProfiles();
      setSelectedProfileId(created.id);
      setMessage("已建立连接。保存密钥后可获取模型列表。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "建立连接失败");
    } finally {
      setBusy("");
    }
  }

  async function saveSelectedProfile(): Promise<ModelProfile | null> {
    if (!selectedProfile) return null;
    setBusy(`update-${selectedProfile.id}`);
    setMessage("");
    try {
      const updated = await api.updateModelProfile(detail.manifest.id, selectedProfile.id, {
        title: profileDraft.title,
        baseUrl: profileDraft.baseUrl.trim() || null,
        model: profileDraft.model,
        credentialRef: profileDraft.credentialRef.trim() || null,
      });
      setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile));
      setMessage("模型配置已保存。");
      return updated;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "保存模型配置失败");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function saveSelectedCredential() {
    if (!selectedProfile) return;
    if (!credentialSecret.trim()) {
      setMessage("请先输入要保存的 API Key。");
      return;
    }
    setBusy(`credential-${selectedProfile.id}`);
    setMessage("");
    try {
      const result = await api.saveModelProfileCredential(detail.manifest.id, selectedProfile.id, {
        secret: credentialSecret,
      });
      setCredentialSecret("");
      setProfiles((current) => current.map((profile) =>
        profile.id === result.modelProfile.id ? result.modelProfile : profile,
      ));
      setProfileDraft((current) => ({ ...current, credentialRef: result.credentialRef }));
      setCredentialStatus((current) => ({
        ...current,
        [selectedProfile.id]: {
          credentialRef: result.credentialRef,
          storeKind: result.storeKind,
          exists: true,
          modelProfile: result.modelProfile,
        },
      }));
      setMessage("密钥已保存。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "保存密钥失败");
    } finally {
      setBusy("");
    }
  }

  async function deleteSelectedCredential() {
    if (!selectedProfile) return;
    setBusy(`credential-delete-${selectedProfile.id}`);
    setMessage("");
    try {
      const result = await api.deleteModelProfileCredential(detail.manifest.id, selectedProfile.id);
      setProfiles((current) => current.map((profile) =>
        profile.id === result.modelProfile.id ? result.modelProfile : profile,
      ));
      setProfileDraft((current) => ({ ...current, credentialRef: "" }));
      setCredentialStatus((current) => ({
        ...current,
        [selectedProfile.id]: {
          credentialRef: null,
          storeKind: result.storeKind,
          exists: false,
          modelProfile: result.modelProfile,
        },
      }));
      await loadProfiles();
      setMessage(result.deleted ? "密钥已删除。" : "已清除当前模型的密钥。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "删除密钥失败");
    } finally {
      setBusy("");
    }
  }

  async function loadProviderModels(profile: ModelProfile) {
    setBusy(`models-${profile.id}`);
    setMessage("");
    setTestErrors((current) => ({ ...current, [profile.id]: "" }));
    try {
      const models = await api.listProviderModels(detail.manifest.id, profile.id);
      setAvailableModels((current) => ({ ...current, [profile.id]: models }));
      if (models.length > 0 && !models.some((model) => model.id === profileDraft.model)) {
        setProfileDraft((current) => ({ ...current, model: models[0]!.id }));
      }
      setMessage(models.length ? "模型列表已更新。" : "服务没有返回可选模型。");
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "获取模型列表失败";
      setTestErrors((current) => ({ ...current, [profile.id]: text }));
      setMessage(text);
    } finally {
      setBusy("");
    }
  }

  async function testProfile(profile: ModelProfile) {
    const updated = await saveSelectedProfile();
    const target = updated ?? profile;
    setBusy(`test-${profile.id}`);
    setMessage("");
    setTestErrors((current) => ({ ...current, [profile.id]: "" }));
    try {
      const result = await api.testModelProfile(detail.manifest.id, target.id);
      setTestResults((current) => ({ ...current, [target.id]: result }));
      if (result.models.length > 0) {
        setAvailableModels((current) => ({ ...current, [target.id]: result.models }));
        if (!result.models.some((model) => model.id === profileDraft.model)) {
          setProfileDraft((current) => ({ ...current, model: result.models[0]!.id }));
        }
      }
    } catch (caught) {
      const fallback = caught instanceof ApiError && typeof caught.body === "object"
        ? JSON.stringify(caught.body)
        : "";
      setTestResults((current) => ({ ...current, [target.id]: null }));
      setTestErrors((current) => ({
        ...current,
        [target.id]: caught instanceof Error ? caught.message : fallback || "连接测试失败",
      }));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="content-page settings-page">
      <header className="settings-hero">
        <div>
          <p className="eyebrow">设置</p>
          <h2>{settingsSection === "models" ? "模型连接" : "角色与提示词"}</h2>
          <p>
            {settingsSection === "models"
              ? "选择模型服务，保存密钥，并把常用模型加入写作流程。"
              : "这里管理智能编辑的职责边界、提示词模板和版本。模板预览不调用模型，也不会写入正文。"}
          </p>
        </div>
        <span className="phase-chip">本机保存</span>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="设置分区">
        <button className={settingsSection === "models" ? "active" : ""} onClick={() => setSettingsSection("models")} type="button">
          模型连接
        </button>
        <button className={settingsSection === "prompts" ? "active" : ""} onClick={() => setSettingsSection("prompts")} type="button">
          角色与提示词
        </button>
      </div>

      {settingsSection === "models" ? (
        <div className="settings-layout settings-model-workbench">
          <aside className="panel model-list">
            <div className="settings-quick-card provider-add-card">
              <button onClick={() => void createServiceProfile()} disabled={busy === "create-service"}>
                ＋ 新增连接
              </button>
              <label className="provider-preset-picker">
                服务
                <select value={servicePreset} onChange={(event) => setServicePreset(event.target.value as ServicePresetId)}>
                  {Object.entries(servicePresets).map(([value, preset]) => (
                    <option key={value} value={value}>{preset.label}</option>
                  ))}
                </select>
              </label>
              <small>{servicePresets[servicePreset].description}</small>
            </div>

            <div className="panel-title">
              <h3>模型列表</h3>
              <span>{profiles.length} 项</span>
            </div>
            {profiles.map((profile) => (
              <button className={selectedProfile?.id === profile.id ? "selected" : ""} key={profile.id} onClick={() => setSelectedProfileId(profile.id)}>
                <strong>{profile.title}</strong>
                <span>{providerLabels[profile.provider]} · {profile.model}</span>
              </button>
            ))}
            {!profiles.length && <p className="empty-side">还没有模型连接。先新增一个连接。</p>}
          </aside>

          <article className="panel model-editor">
            {selectedProfile ? (
              <>
                <div className="model-editor-heading">
                  <div className="model-profile-identity">
                    <span className="model-provider-mark">{providerMark(selectedProfile.provider)}</span>
                    <div>
                      <p className="eyebrow">{providerLabels[selectedProfile.provider]}</p>
                      <h3>{selectedProfile.title}</h3>
                    </div>
                  </div>
                  <div className="model-editor-actions">
                    <button onClick={() => void saveSelectedProfile()} disabled={busy === `update-${selectedProfile.id}`}>保存配置</button>
                    <button onClick={() => void testProfile(selectedProfile)} disabled={busy === `test-${selectedProfile.id}`}>测试连接</button>
                  </div>
                </div>

                <div className="model-editor-body">
                  <div className="model-form-column">
                    <p>{providerDescription(selectedProfile.provider)}</p>
                    <div className="model-form-grid">
                      <label>
                        显示名称
                        <input value={profileDraft.title} onChange={(event) => setProfileDraft((current) => ({ ...current, title: event.target.value }))} />
                      </label>
                      <label>
                        服务地址
                        <input
                          value={profileDraft.baseUrl}
                          placeholder={selectedProfile.provider === "deepseek"
                            ? "https://api.deepseek.com"
                            : selectedProfile.provider === "openai-compatible"
                              ? "填写服务商提供的接口地址"
                              : "本机验收模型无需填写"}
                          onChange={(event) => setProfileDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                          disabled={selectedProfile.provider === "mock"}
                        />
                      </label>
                      <div className="model-picker">
                        <label>
                          模型
                          {availableModels[selectedProfile.id]?.length ? (
                            <select value={profileDraft.model} onChange={(event) => setProfileDraft((current) => ({ ...current, model: event.target.value }))}>
                              {availableModels[selectedProfile.id]!.map((model) => (
                                <option key={model.id} value={model.id}>{model.title || model.id}</option>
                              ))}
                            </select>
                          ) : (
                            <input value={profileDraft.model} onChange={(event) => setProfileDraft((current) => ({ ...current, model: event.target.value }))} />
                          )}
                        </label>
                        {selectedProfile.provider !== "mock" && (
                          <button type="button" onClick={() => void loadProviderModels(selectedProfile)} disabled={busy === `models-${selectedProfile.id}`}>
                            获取模型
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedProfile.provider !== "mock" && (
                      <div className="credential-save-card">
                        <div>
                          <strong>服务密钥</strong>
                          <small>
                            {credentialStatus[selectedProfile.id]?.exists || profileDraft.credentialRef
                              ? "当前连接已有密钥。可以替换、删除，或改用其他已保存密钥。"
                              : "尚未保存密钥。"}
                          </small>
                        </div>
                        {profiles.some((profile) => profile.credentialRef && profile.credentialRef !== profileDraft.credentialRef) && (
                          <label className="credential-ref-picker">
                            使用已有密钥
                            <select value={profileDraft.credentialRef} onChange={(event) => setProfileDraft((current) => ({ ...current, credentialRef: event.target.value }))}>
                              <option value="">不使用</option>
                              {profiles.filter((profile) => profile.credentialRef).map((profile) => (
                                <option key={`${profile.id}:${profile.credentialRef}`} value={profile.credentialRef ?? ""}>{credentialLabel(profile)}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        <div>
                          <input
                            type="password"
                            value={credentialSecret}
                            placeholder={profileDraft.credentialRef ? "粘贴新 API Key 可替换" : "粘贴 API Key"}
                            autoComplete="off"
                            onChange={(event) => setCredentialSecret(event.target.value)}
                          />
                          <button onClick={() => void saveSelectedCredential()} disabled={busy === `credential-${selectedProfile.id}`}>
                            {profileDraft.credentialRef ? "替换密钥" : "保存密钥"}
                          </button>
                          <button type="button" onClick={() => void deleteSelectedCredential()} disabled={!profileDraft.credentialRef || busy === `credential-delete-${selectedProfile.id}`}>
                            删除密钥
                          </button>
                        </div>
                      </div>
                    )}

                    <div className={`connection-result ${testResults[selectedProfile.id]?.ok ? "ok" : ""}`}>
                      <strong>连接状态</strong>
                      <p>{connectionMessage(testResults[selectedProfile.id] ?? null, testErrors[selectedProfile.id] ?? "")}</p>
                    </div>

                    <details className="model-advanced">
                      <summary>高级信息</summary>
                      <label>
                        系统凭据引用
                        <input
                          value={profileDraft.credentialRef}
                          placeholder="保存密钥后自动生成；也可填写已有系统凭据引用"
                          onChange={(event) => setProfileDraft((current) => ({ ...current, credentialRef: event.target.value }))}
                        />
                      </label>
                      <dl className="model-capabilities">
                        <div><dt>上下文窗口</dt><dd>{selectedProfile.contextWindowTokens.toLocaleString("zh-CN")} tokens</dd></div>
                        <div><dt>流式文本</dt><dd>{selectedProfile.capabilities.streamText ? "支持" : "未声明"}</dd></div>
                        <div><dt>结构化输出</dt><dd>{selectedProfile.capabilities.structuredOutput ? "支持" : "未声明"}</dd></div>
                        <div><dt>Token 估算</dt><dd>{selectedProfile.capabilities.tokenEstimate ? "支持" : "未声明"}</dd></div>
                      </dl>
                    </details>
                  </div>
                </div>

                <footer className="model-save-footer">
                  <span>{message || "配置变更后记得保存。"}</span>
                  <button onClick={() => void saveSelectedProfile()} disabled={busy === `update-${selectedProfile.id}`}>保存配置</button>
                </footer>
              </>
            ) : (
              <div className="empty-settings">
                <h3>还没有可编辑的模型</h3>
                <p>先添加一个模型连接，确认设置、上下文预览和调用记录的骨架能跑通。</p>
              </div>
            )}
          </article>
        </div>
      ) : (
        <PromptSettingsPanel seriesId={detail.manifest.id} onMessage={setMessage} />
      )}

      {message && settingsSection !== "models" && <p className="settings-message">{message}</p>}
    </section>
  );
}
