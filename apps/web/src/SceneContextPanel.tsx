import { useEffect, useState } from "react";
import type {
  ContextBundle,
  ContextExclusionReason,
  ContextItemKind,
  ModelProfile,
  SceneDocument,
  SeriesDetail,
} from "@novel-studio/contracts";
import { api } from "./api";
import { readableSceneStatus } from "./copy";

const DEFAULT_CONTEXT_PROMPT_TEMPLATE_ID = "00000000-0000-4000-8000-000000000405";

const contextItemLabels: Partial<Record<ContextItemKind, string>> = {
  "role-instruction": "编辑职责",
  "prompt-template": "提示词模板",
  "user-request": "当前请求",
  "scene-selection": "正文选区",
  scene: "当前场景",
  "adjacent-scene": "相邻场景",
  "scene-summary": "场景摘要",
  "codex-entry": "设定条目",
  "codex-effective-state": "当前有效状态",
  "character-knowledge": "角色所知",
  "plot-thread": "情节线",
  "scene-section": "附属文档",
  "research-note": "研究笔记",
  "style-profile": "风格档案",
  "pinned-note": "指定资料",
};

const contextExclusionLabels: Record<ContextExclusionReason, string> = {
  future: "后文内容",
  "future-information": "后文信息",
  "hidden-section": "隐藏资料",
  "policy-never": "资料规则禁止",
  "context-policy-never": "设定规则禁止",
  "policy-local-only": "仅限本机模型",
  "cloud-disabled": "作品未允许云端",
  "not-mentioned": "当前场景未提及",
  archived: "已归档",
  "not-selected": "未选择",
  "over-budget": "超出预算",
  "permission-denied": "权限不足",
};

export function SceneContextPanel({
  detail,
  activeScene,
  content,
  selectedText,
  rightOpen,
  onMessage,
}: {
  detail: SeriesDetail;
  activeScene: SceneDocument;
  content: string;
  selectedText: string;
  rightOpen: boolean;
  onMessage: (message: string) => void;
}) {
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([]);
  const [selectedModelProfileId, setSelectedModelProfileId] = useState("");
  const [contextBundle, setContextBundle] = useState<ContextBundle | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  useEffect(() => {
    setContextBundle(null);
  }, [activeScene.metadata.id]);

  useEffect(() => {
    if (!rightOpen) return;
    let cancelled = false;
    api.listModelProfiles(detail.manifest.id)
      .then((profiles) => {
        if (cancelled) return;
        setModelProfiles(profiles);
        setSelectedModelProfileId((current) =>
          current && profiles.some((profile) => profile.id === current)
            ? current
            : profiles[0]?.id ?? "",
        );
      })
      .catch((caught: unknown) => {
        if (!cancelled) onMessage(caught instanceof Error ? caught.message : "无法读取模型配置");
      });
    return () => {
      cancelled = true;
    };
  }, [detail.manifest.id, onMessage, rightOpen]);

  function selectedTextRange() {
    if (!selectedText) return null;
    const start = content.indexOf(selectedText);
    if (start < 0 || content.indexOf(selectedText, start + selectedText.length) >= 0) return null;
    return { start, end: start + selectedText.length, text: selectedText };
  }

  async function previewContext() {
    setContextLoading(true);
    onMessage("");
    try {
      const bundle = await api.previewContext(detail.manifest.id, {
        sceneId: activeScene.metadata.id,
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        userRequest: "请检查当前场景的连续性，只指出风险、证据和建议，不要直接改写正文或设定。",
        promptTemplateId: DEFAULT_CONTEXT_PROMPT_TEMPLATE_ID,
        promptTemplateVersion: 1,
        selection: selectedTextRange(),
        manualContextIds: [],
        modelProfileId: selectedModelProfileId || null,
        tokenBudget: null,
      });
      setContextBundle(bundle);
      onMessage("上下文预览已生成；这里只展示将被纳入和被排除的资料。");
    } catch (caught) {
      onMessage(caught instanceof Error ? caught.message : "生成上下文预览失败");
    } finally {
      setContextLoading(false);
    }
  }

  return (
    <div className="scene-context-panel">
      <p className="eyebrow">场景资料</p>
      <h3>场景资料</h3>
      <dl>
        <dt>状态</dt>
        <dd>{readableSceneStatus(activeScene.metadata.status)}</dd>
        <dt>视角</dt>
        <dd>{activeScene.metadata.pov || "未设置"}</dd>
        <dt>目标</dt>
        <dd>{activeScene.metadata.goal || "尚未填写"}</dd>
        <dt>摘要</dt>
        <dd>{activeScene.metadata.summary || "等待作者确认"}</dd>
      </dl>

      <div className="inspector-note">
        <strong>资料保护</strong>
        <p>预览只生成资料包，不调用模型，不修改正文，也不会把被隐藏、被禁止或后文才出现的信息塞进去。</p>
      </div>

      <div className="context-preview-panel">
        <label>
          参考模型
          <select
            value={selectedModelProfileId}
            onChange={(event) => setSelectedModelProfileId(event.target.value)}
          >
            <option value="">不指定模型，只检查资料范围</option>
            {modelProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.title} · {profile.model}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => void previewContext()} disabled={contextLoading}>
          {contextLoading ? "正在生成预览…" : "生成上下文预览"}
        </button>
        {!modelProfiles.length && (
          <small>可以先去“设置”添加本机验收模型；不指定模型也能预览基础资料包。</small>
        )}
      </div>

      {contextBundle && (
        <div className="context-result">
          <div className="context-result-summary">
            <span>{contextBundle.items.length} 项纳入</span>
            <span>{contextBundle.excluded.length} 项排除</span>
            <span>约 {contextBundle.estimatedUsage.inputTokens.toLocaleString("zh-CN")} tokens</span>
          </div>
          <h4>纳入资料</h4>
          <div className="context-list">
            {contextBundle.items.slice(0, 8).map((item) => (
              <article key={item.id}>
                <span>{contextItemLabels[item.kind] ?? item.kind}</span>
                <strong>{item.title}</strong>
                <p>{item.inclusionReason || "按上下文规则纳入。"}</p>
              </article>
            ))}
            {contextBundle.items.length > 8 && <small>还有 {contextBundle.items.length - 8} 项未展开。</small>}
          </div>
          <h4>排除资料</h4>
          <div className="context-list excluded">
            {contextBundle.excluded.slice(0, 8).map((item, index) => (
              <article key={`${item.source.type}:${item.source.id ?? index}:${item.reason}`}>
                <span>{contextExclusionLabels[item.reason]}</span>
                <strong>{item.title || item.source.label || "未命名资料"}</strong>
                <p>{item.note || "按权限或时间线规则排除。"}</p>
              </article>
            ))}
            {!contextBundle.excluded.length && <small>本次没有被排除的资料。</small>}
            {contextBundle.excluded.length > 8 && <small>还有 {contextBundle.excluded.length - 8} 项未展开。</small>}
          </div>
        </div>
      )}
    </div>
  );
}
