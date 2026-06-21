import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AgentRole,
  PromptPreset,
  PromptTemplate,
  PromptTemplatePreviewResult,
} from "@novel-studio/contracts";
import { api } from "./api";

function versionLabel(template: PromptTemplate): string {
  return `v${template.version} · ${template.status === "active" ? "启用" : template.status === "draft" ? "草稿" : "归档"}`;
}

function roleSummary(role: AgentRole | null): string {
  if (!role) return "";
  return [
    role.description,
    role.duties.length ? `职责：${role.duties.join("；")}` : "",
    role.challengeObligation ? `反对义务：${role.challengeObligation}` : "",
  ].filter(Boolean).join("\n");
}

export function PromptSettingsPanel({
  seriesId,
  onMessage,
}: {
  seriesId: string;
  onMessage: (message: string) => void;
}) {
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [previewInput, setPreviewInput] = useState("请检查当前场景的连续性风险。");
  const [preview, setPreview] = useState<PromptTemplatePreviewResult | null>(null);
  const [instructionsDraft, setInstructionsDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState({
    title: "",
    persona: "",
    challengeObligation: "",
  });
  const [busy, setBusy] = useState("");

  const loadPromptData = useCallback(async () => {
    const [nextRoles, nextTemplates, nextPresets] = await Promise.all([
      api.listAgentRoles(seriesId),
      api.listPromptTemplates(seriesId),
      api.listPromptPresets(seriesId),
    ]);
    setRoles(nextRoles);
    setTemplates(nextTemplates);
    setPresets(nextPresets);
    setSelectedRoleId((current) =>
      current && nextRoles.some((role) => role.id === current)
        ? current
        : nextRoles.find((role) => role.id === "continuity-editor")?.id ?? nextRoles[0]?.id ?? "",
    );
  }, [seriesId]);

  useEffect(() => {
    void loadPromptData().catch((caught) => {
      onMessage(caught instanceof Error ? caught.message : "无法读取角色与提示词");
    });
  }, [loadPromptData, onMessage]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const roleTemplates = useMemo(
    () => templates.filter((template) => template.roleId === selectedRoleId),
    [selectedRoleId, templates],
  );

  const selectedTemplate = useMemo(() => {
    const [templateId, versionText] = selectedTemplateKey.split(":");
    const version = Number(versionText);
    return roleTemplates.find((template) => template.id === templateId && template.version === version)
      ?? roleTemplates.find((template) => template.status === "active")
      ?? roleTemplates[0]
      ?? null;
  }, [roleTemplates, selectedTemplateKey]);

  useEffect(() => {
    if (!selectedRole) return;
    setRoleDraft({
      title: selectedRole.title,
      persona: selectedRole.persona,
      challengeObligation: selectedRole.challengeObligation,
    });
  }, [selectedRole]);

  useEffect(() => {
    if (!selectedTemplate) {
      setSelectedTemplateKey("");
      setInstructionsDraft("");
      setPreview(null);
      return;
    }
    const key = `${selectedTemplate.id}:${selectedTemplate.version}`;
    setSelectedTemplateKey((current) =>
      current && roleTemplates.some((template) => `${template.id}:${template.version}` === current)
        ? current
        : key,
    );
    setInstructionsDraft(selectedTemplate.instructions);
    setPreview(null);
  }, [roleTemplates, selectedTemplate]);

  async function cloneRole() {
    if (!selectedRole) return;
    setBusy("clone-role");
    onMessage("");
    try {
      const cloned = await api.cloneAgentRole(seriesId, selectedRole.id, {
        title: `我的${selectedRole.title}`,
      });
      await loadPromptData();
      setSelectedRoleId(cloned.id);
      onMessage("已复制为自定义角色，可以按你的写作习惯调整。");
    } catch (caught) {
      onMessage(caught instanceof Error ? caught.message : "复制角色失败");
    } finally {
      setBusy("");
    }
  }

  async function saveRole() {
    if (!selectedRole || selectedRole.builtIn) return;
    setBusy("save-role");
    onMessage("");
    try {
      const updated = await api.updateAgentRole(seriesId, selectedRole.id, {
        title: roleDraft.title,
        persona: roleDraft.persona,
        challengeObligation: roleDraft.challengeObligation,
      });
      setRoles((current) => current.map((role) => role.id === updated.id ? updated : role));
      onMessage("自定义角色已保存。");
    } catch (caught) {
      onMessage(caught instanceof Error ? caught.message : "保存角色失败");
    } finally {
      setBusy("");
    }
  }

  async function previewTemplate() {
    if (!selectedTemplate) return;
    setBusy("preview-template");
    onMessage("");
    try {
      const rendered = await api.previewPromptTemplate(seriesId, selectedTemplate.id, {
        version: selectedTemplate.version,
        inputs: {
          user_request: previewInput,
          scene_title: "当前场景",
          selected_text: "",
          context_summary: "这里显示上下文装配器会提供的资料摘要。",
        },
      });
      setPreview(rendered);
      onMessage("提示词预览已生成；这一步不调用模型。");
    } catch (caught) {
      setPreview(null);
      onMessage(caught instanceof Error ? caught.message : "生成提示词预览失败");
    } finally {
      setBusy("");
    }
  }

  async function createVersion() {
    if (!selectedTemplate) return;
    setBusy("create-version");
    onMessage("");
    try {
      const created = await api.createPromptTemplateVersion(seriesId, selectedTemplate.id, {
        baseVersion: selectedTemplate.version,
        instructions: instructionsDraft,
        status: "active",
      });
      await loadPromptData();
      setSelectedTemplateKey(`${created.id}:${created.version}`);
      onMessage(`已保存为 ${versionLabel(created)}；旧版本仍会保留给历史调用审计。`);
    } catch (caught) {
      onMessage(caught instanceof Error ? caught.message : "保存新版本失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="prompt-settings">
      <aside className="panel prompt-role-list">
        <div className="panel-title">
          <h3>编辑角色</h3>
          <span>{roles.length} 位</span>
        </div>
        {roles.map((role) => (
          <button
            key={role.id}
            className={role.id === selectedRoleId ? "selected" : ""}
            onClick={() => setSelectedRoleId(role.id)}
          >
            <strong>{role.title}</strong>
            <span>{role.builtIn ? "内置角色" : "自定义角色"}</span>
          </button>
        ))}
      </aside>

      <section className="panel prompt-role-editor">
        {selectedRole ? (
          <>
            <div className="prompt-section-heading">
              <div>
                <p className="eyebrow">角色边界</p>
                <h3>{selectedRole.title}</h3>
              </div>
              <button onClick={() => void cloneRole()} disabled={busy === "clone-role"}>
                复制成我的角色
              </button>
            </div>
            <p className="prompt-role-summary">{roleSummary(selectedRole)}</p>
            <div className="prompt-role-form">
              <label>
                角色名称
                <input
                  value={roleDraft.title}
                  disabled={selectedRole.builtIn}
                  onChange={(event) => setRoleDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </label>
              <label>
                工作人格
                <textarea
                  value={roleDraft.persona}
                  disabled={selectedRole.builtIn}
                  onChange={(event) => setRoleDraft((current) => ({ ...current, persona: event.target.value }))}
                />
              </label>
              <label>
                反对义务
                <textarea
                  value={roleDraft.challengeObligation}
                  disabled={selectedRole.builtIn}
                  onChange={(event) => setRoleDraft((current) => ({ ...current, challengeObligation: event.target.value }))}
                />
              </label>
              <button onClick={() => void saveRole()} disabled={selectedRole.builtIn || busy === "save-role"}>
                保存自定义角色
              </button>
              {selectedRole.builtIn && <small>内置角色只读。需要改动时，请先复制成你的角色。</small>}
            </div>

            <div className="prompt-template-box">
              <div className="prompt-section-heading">
                <div>
                  <p className="eyebrow">提示词模板</p>
                  <h3>{selectedTemplate?.name ?? "暂无模板"}</h3>
                </div>
                <span>{roleTemplates.length} 个版本</span>
              </div>
              <label>
                模板版本
                <select
                  value={selectedTemplateKey}
                  onChange={(event) => setSelectedTemplateKey(event.target.value)}
                >
                  {roleTemplates.map((template) => (
                    <option key={`${template.id}:${template.version}`} value={`${template.id}:${template.version}`}>
                      {template.name} · {versionLabel(template)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                工作指令
                <textarea
                  value={instructionsDraft}
                  onChange={(event) => setInstructionsDraft(event.target.value)}
                />
              </label>
              <button onClick={() => void createVersion()} disabled={!selectedTemplate || busy === "create-version"}>
                保存为新版本
              </button>
              <small>模板采用声明式占位符，例如 {"{{user_request}}"}；不会执行 JavaScript 表达式。</small>
            </div>
          </>
        ) : (
          <div className="empty-settings">
            <h3>还没有编辑角色</h3>
            <p>内置角色会在读取时自动补齐；如果这里为空，说明项目文件需要检查。</p>
          </div>
        )}
      </section>

      <aside className="panel prompt-preview-card">
        <div className="panel-title">
          <h3>提示词预览</h3>
          <span>{presets.length} 个预设</span>
        </div>
        <label>
          作者要求
          <textarea
            value={previewInput}
            onChange={(event) => setPreviewInput(event.target.value)}
          />
        </label>
        <button onClick={() => void previewTemplate()} disabled={!selectedTemplate || busy === "preview-template"}>
          预览提示词
        </button>
        {preview ? (
          <div className="prompt-preview-result">
            <span>模板 {preview.promptTemplateId} · v{preview.promptTemplateVersion}</span>
            <strong>最终提示词</strong>
            <pre>{preview.finalPrompt}</pre>
          </div>
        ) : (
          <p>预览会展开模板、组件和输入项，但不会调用模型，也不会写入正文。</p>
        )}
      </aside>
    </div>
  );
}
