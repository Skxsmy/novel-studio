import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AiProvider,
  CloudPolicy,
  ModelProfile,
  ProviderConnectionResult,
  SeriesDetail,
  SeriesManifest,
} from "@novel-studio/contracts";
import { ApiError, api } from "./api";
import { PromptSettingsPanel } from "./PromptSettingsPanel";

const providerLabels: Record<AiProvider, string> = {
  mock: "本机测试模型",
  openai: "OpenAI",
  anthropic: "Claude",
  google: "Gemini",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  "openai-compatible": "OpenAI 兼容服务",
};

const cloudPolicyLabels: Record<CloudPolicy, string> = {
  "local-only": "只允许本机模型",
  "cloud-allowed": "允许使用云端模型",
};

function providerDescription(provider: AiProvider): string {
  if (provider === "mock") return "用于验收流程，不会产生网络调用。";
  if (provider === "ollama") return "面向本机部署模型，后续接入真实流式调用。";
  if (provider === "openai-compatible") return "适用于 DeepSeek 或其他 OpenAI 格式服务。密钥只保存在本机系统里。";
  return "需要先允许云端调用，并保存服务密钥。";
}

function connectionMessage(result: ProviderConnectionResult | null, error: string): string {
  if (error) return "连接失败，请检查服务地址、模型名称和密钥。";
  if (!result) return "尚未测试";
  if (result.ok) return `连接正常，可识别 ${result.models.length} 个模型。`;
  return "连接失败，请检查服务地址、模型名称和密钥。";
}

export function SettingsView({
  detail,
  onSeriesManifestUpdated,
}: {
  detail: SeriesDetail;
  onSeriesManifestUpdated: (manifest: SeriesManifest) => void;
}) {
  const [cloudPolicy, setCloudPolicy] = useState<CloudPolicy>(detail.manifest.cloudPolicy);
  const [settingsSection, setSettingsSection] = useState<"models" | "prompts">("models");
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    title: "",
    baseUrl: "",
    model: "",
    cloudPolicy: "local-only" as CloudPolicy,
    credentialRef: "",
  });
  const [credentialSecret, setCredentialSecret] = useState("");
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
    setCloudPolicy(detail.manifest.cloudPolicy);
  }, [detail.manifest.cloudPolicy]);

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
      cloudPolicy: selectedProfile.cloudPolicy,
      credentialRef: selectedProfile.credentialRef ?? "",
    });
    setCredentialSecret("");
  }, [selectedProfile]);

  async function saveCloudPolicy(nextPolicy: CloudPolicy) {
    setCloudPolicy(nextPolicy);
    setBusy("cloud-policy");
    setMessage("");
    try {
      const updated = await api.updateSeriesCloudPolicy(detail.manifest.id, {
        cloudPolicy: nextPolicy,
      });
      onSeriesManifestUpdated(updated);
      setMessage("作品的模型权限已保存。");
    } catch (caught) {
      setCloudPolicy(detail.manifest.cloudPolicy);
      setMessage(caught instanceof Error ? caught.message : "保存模型权限失败");
    } finally {
      setBusy("");
    }
  }

  async function createMockProfile() {
    setBusy("create-mock");
    setMessage("");
    try {
      const created = await api.createModelProfile(detail.manifest.id, {
        title: "本机验收模型",
        provider: "mock",
        model: "mock-continuity-v1",
        cloudPolicy: "local-only",
      });
      await loadProfiles();
      setSelectedProfileId(created.id);
      setMessage("已添加本机验收模型，可用于上下文预览和自动化测试。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "添加模型失败");
    } finally {
      setBusy("");
    }
  }

  async function createCloudPlaceholder(provider: AiProvider) {
    setBusy(`create-${provider}`);
    setMessage("");
    try {
      const created = await api.createModelProfile(detail.manifest.id, {
        title: `${providerLabels[provider]} 配置`,
        provider,
        baseUrl: provider === "openai-compatible" ? "https://api.deepseek.com" : null,
        model: provider === "openrouter" ? "openrouter/model-id" : "待填写模型代号",
        cloudPolicy: provider === "ollama" ? "local-only" : "cloud-allowed",
      });
      await loadProfiles();
      setSelectedProfileId(created.id);
      setMessage("已建立配置占位。真实调用前仍需补齐模型代号和凭据引用。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "建立配置失败");
    } finally {
      setBusy("");
    }
  }

  async function createDeepSeekProfile() {
    setBusy("create-deepseek");
    setMessage("");
    try {
      const created = await api.createModelProfile(detail.manifest.id, {
        title: "DeepSeek 写作模型",
        provider: "openai-compatible",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
        cloudPolicy: "cloud-allowed",
        capabilities: {
          streamText: true,
          structuredOutput: true,
          embeddings: false,
          tokenEstimate: true,
          modelList: true,
        },
        contextWindowTokens: 1_000_000,
      });
      await loadProfiles();
      setSelectedProfileId(created.id);
      setMessage("已建立 DeepSeek 配置。请允许云端模型，并把 API Key 保存到系统凭据后再测试连接。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "建立 DeepSeek 配置失败");
    } finally {
      setBusy("");
    }
  }

  async function saveSelectedProfile() {
    if (!selectedProfile) return;
    setBusy(`update-${selectedProfile.id}`);
    setMessage("");
    try {
      const updated = await api.updateModelProfile(detail.manifest.id, selectedProfile.id, {
        title: profileDraft.title,
        baseUrl: profileDraft.baseUrl.trim() || null,
        model: profileDraft.model,
        cloudPolicy: profileDraft.cloudPolicy,
        credentialRef: profileDraft.credentialRef.trim() || null,
      });
      setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile));
      setMessage("模型配置已保存。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "保存模型配置失败");
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
      setMessage("密钥已保存到系统凭据。作品文件、日志和 Git 不会保存明文密钥。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "保存密钥失败");
    } finally {
      setBusy("");
    }
  }

  async function testProfile(profile: ModelProfile) {
    setBusy(`test-${profile.id}`);
    setMessage("");
    setTestErrors((current) => ({ ...current, [profile.id]: "" }));
    try {
      const result = await api.testModelProfile(detail.manifest.id, profile.id);
      setTestResults((current) => ({ ...current, [profile.id]: result }));
    } catch (caught) {
      const fallback = caught instanceof ApiError && typeof caught.body === "object"
        ? JSON.stringify(caught.body)
        : "";
      setTestResults((current) => ({ ...current, [profile.id]: null }));
      setTestErrors((current) => ({
        ...current,
        [profile.id]: caught instanceof Error ? caught.message : fallback || "连接测试失败",
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
          <h2>{settingsSection === "models" ? "模型与资料权限" : "角色与提示词"}</h2>
          <p>
            {settingsSection === "models"
              ? "这里只管理模型入口和资料边界。真正调用前仍会预览上下文，智能编辑也不能直接改写正文或已确认设定。"
              : "这里管理智能编辑的职责边界、提示词模板和版本。模板预览不调用模型，也不会写入正文。"}
          </p>
        </div>
        <span className="phase-chip">M4</span>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="设置分区">
        <button
          className={settingsSection === "models" ? "active" : ""}
          onClick={() => setSettingsSection("models")}
          type="button"
        >
          模型连接
        </button>
        <button
          className={settingsSection === "prompts" ? "active" : ""}
          onClick={() => setSettingsSection("prompts")}
          type="button"
        >
          角色与提示词
        </button>
      </div>

      {settingsSection === "models" ? (
        <>
          <div className="settings-command-bar">
            <div className="settings-cloud-card">
              <div>
                <span>作品级权限</span>
                <strong>{cloudPolicyLabels[cloudPolicy]}</strong>
                <small>云端未打开时，服务端会拒绝云端模型连接和调用。</small>
              </div>
              <select
                value={cloudPolicy}
                disabled={busy === "cloud-policy"}
                onChange={(event) => void saveCloudPolicy(event.target.value as CloudPolicy)}
                aria-label="当前权限"
              >
                {Object.entries(cloudPolicyLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="settings-quick-card">
              <div>
                <span>快速添加</span>
                <strong>建立模型配置</strong>
              </div>
              <div className="settings-actions">
                <button onClick={() => void createMockProfile()} disabled={busy === "create-mock"}>
                  添加本机验收模型
                </button>
                <button onClick={() => void createDeepSeekProfile()} disabled={busy === "create-deepseek"}>
                  添加 DeepSeek 配置
                </button>
                <button onClick={() => void createCloudPlaceholder("openai-compatible")} disabled={busy === "create-openai-compatible"}>
                  添加兼容服务
                </button>
              </div>
            </div>
          </div>

          <div className="settings-layout">
            <aside className="panel model-list">
              <div className="panel-title">
                <h3>模型列表</h3>
                <span>{profiles.length} 项</span>
              </div>
              {profiles.map((profile) => (
                <button
                  className={selectedProfile?.id === profile.id ? "selected" : ""}
                  key={profile.id}
                  onClick={() => setSelectedProfileId(profile.id)}
                >
                  <strong>{profile.title}</strong>
                  <span>{providerLabels[profile.provider]} · {profile.model}</span>
                </button>
              ))}
              {!profiles.length && <p className="empty-side">还没有模型配置。先添加一个本机验收模型即可测试上下文流程。</p>}
            </aside>

            <article className="panel model-editor">
              {selectedProfile ? (
                <>
                  <div className="model-editor-heading">
                    <div>
                      <p className="eyebrow">{providerLabels[selectedProfile.provider]}</p>
                      <h3>{selectedProfile.title}</h3>
                    </div>
                    <div className="model-editor-actions">
                      <button onClick={() => void saveSelectedProfile()} disabled={busy === `update-${selectedProfile.id}`}>
                        保存配置
                      </button>
                      <button onClick={() => void testProfile(selectedProfile)} disabled={busy === `test-${selectedProfile.id}`}>
                        测试连接
                      </button>
                    </div>
                  </div>
                  <div className="model-editor-body">
                    <div className="model-form-column">
                      <p>{providerDescription(selectedProfile.provider)}</p>
                      <div className="model-form-grid">
                        <label>
                          显示名称
                          <input
                            value={profileDraft.title}
                            onChange={(event) => setProfileDraft((current) => ({ ...current, title: event.target.value }))}
                          />
                        </label>
                        <label>
                          模型代号
                          <input
                            value={profileDraft.model}
                            onChange={(event) => setProfileDraft((current) => ({ ...current, model: event.target.value }))}
                          />
                        </label>
                        <label>
                          服务地址
                          <input
                            value={profileDraft.baseUrl}
                            placeholder={selectedProfile.provider === "openai-compatible" ? "https://api.deepseek.com" : "本机验收模型无需填写"}
                            onChange={(event) => setProfileDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                            disabled={selectedProfile.provider === "mock"}
                          />
                        </label>
                        <label>
                          调用权限
                          <select
                            value={profileDraft.cloudPolicy}
                            onChange={(event) => setProfileDraft((current) => ({ ...current, cloudPolicy: event.target.value as CloudPolicy }))}
                          >
                            {Object.entries(cloudPolicyLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {selectedProfile.provider !== "mock" && (
                        <div className="credential-save-card">
                          <div>
                            <strong>服务密钥</strong>
                            <small>只保存在系统凭据中，保存后会清空输入框。</small>
                          </div>
                          <div>
                            <input
                              type="password"
                              value={credentialSecret}
                              placeholder="粘贴 API Key"
                              autoComplete="off"
                              onChange={(event) => setCredentialSecret(event.target.value)}
                            />
                            <button
                              onClick={() => void saveSelectedCredential()}
                              disabled={busy === `credential-${selectedProfile.id}`}
                            >
                              保存密钥
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
                </>
              ) : (
                <div className="empty-settings">
                  <h3>还没有可编辑的模型</h3>
                  <p>先添加本机验收模型，确认权限、上下文预览和调用记录的骨架能跑通。</p>
                </div>
              )}
            </article>
          </div>
        </>
      ) : (
        <PromptSettingsPanel seriesId={detail.manifest.id} onMessage={setMessage} />
      )}

      {message && <p className="settings-message">{message}</p>}
    </section>
  );
}
