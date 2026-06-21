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
  return "需要作品允许云端调用，并配置系统凭据引用。";
}

function connectionMessage(result: ProviderConnectionResult | null, error: string): string {
  if (error) return error;
  if (!result) return "尚未测试";
  if (result.ok) return `连接正常，可识别 ${result.models.length} 个模型。`;
  return result.error?.message ?? "连接失败";
}

export function SettingsView({
  detail,
  onSeriesManifestUpdated,
}: {
  detail: SeriesDetail;
  onSeriesManifestUpdated: (manifest: SeriesManifest) => void;
}) {
  const [cloudPolicy, setCloudPolicy] = useState<CloudPolicy>(detail.manifest.cloudPolicy);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    title: "",
    model: "",
    cloudPolicy: "local-only" as CloudPolicy,
    credentialRef: "",
  });
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
      model: selectedProfile.model,
      cloudPolicy: selectedProfile.cloudPolicy,
      credentialRef: selectedProfile.credentialRef ?? "",
    });
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

  async function saveSelectedProfile() {
    if (!selectedProfile) return;
    setBusy(`update-${selectedProfile.id}`);
    setMessage("");
    try {
      const updated = await api.updateModelProfile(detail.manifest.id, selectedProfile.id, {
        title: profileDraft.title,
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
      <div className="page-heading">
        <div>
          <p className="eyebrow">设置</p>
          <h2>模型与资料权限</h2>
        </div>
        <span className="phase-chip">M4</span>
      </div>

      <div className="settings-grid">
        <article className="panel settings-card">
          <p className="eyebrow">作品级权限</p>
          <h3>云端模型开关</h3>
          <p>
            默认只允许本机模型。即使某个角色或任务配置了云端模型，只要这里没有打开，服务端也会拒绝调用。
          </p>
          <label>
            当前权限
            <select
              value={cloudPolicy}
              disabled={busy === "cloud-policy"}
              onChange={(event) => void saveCloudPolicy(event.target.value as CloudPolicy)}
            >
              {Object.entries(cloudPolicyLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <small>密钥只允许保存为系统凭据引用，不能写进作品目录、日志或 Git。</small>
        </article>

        <article className="panel settings-card">
          <p className="eyebrow">快速添加</p>
          <h3>模型配置</h3>
          <div className="settings-actions">
            <button onClick={() => void createMockProfile()} disabled={busy === "create-mock"}>
              添加本机验收模型
            </button>
            <button onClick={() => void createCloudPlaceholder("openai")} disabled={busy === "create-openai"}>
              添加 OpenAI 配置
            </button>
            <button onClick={() => void createCloudPlaceholder("ollama")} disabled={busy === "create-ollama"}>
              添加 Ollama 配置
            </button>
          </div>
          <small>真实供应商调用仍处于后续任务；这里先建立可审计的配置边界。</small>
        </article>
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
                <label>
                  系统凭据引用
                  <input
                    value={profileDraft.credentialRef}
                    placeholder="例如：novel-studio/openai/main"
                    onChange={(event) => setProfileDraft((current) => ({ ...current, credentialRef: event.target.value }))}
                  />
                </label>
              </div>
              <div className={`connection-result ${testResults[selectedProfile.id]?.ok ? "ok" : ""}`}>
                <strong>连接结果</strong>
                <p>{connectionMessage(testResults[selectedProfile.id] ?? null, testErrors[selectedProfile.id] ?? "")}</p>
                <small>不会因为失败而改用其他供应商；回退策略必须另行显式配置。</small>
              </div>
              <dl className="model-capabilities">
                <dt>上下文窗口</dt>
                <dd>{selectedProfile.contextWindowTokens.toLocaleString("zh-CN")} tokens</dd>
                <dt>流式文本</dt>
                <dd>{selectedProfile.capabilities.streamText ? "支持" : "未声明"}</dd>
                <dt>结构化输出</dt>
                <dd>{selectedProfile.capabilities.structuredOutput ? "支持" : "未声明"}</dd>
                <dt>Token 估算</dt>
                <dd>{selectedProfile.capabilities.tokenEstimate ? "支持" : "未声明"}</dd>
              </dl>
            </>
          ) : (
            <div className="empty-settings">
              <h3>还没有可编辑的模型</h3>
              <p>先添加本机验收模型，确认权限、上下文预览和调用记录的骨架能跑通。</p>
            </div>
          )}
        </article>
      </div>

      {message && <p className="settings-message">{message}</p>}
    </section>
  );
}
