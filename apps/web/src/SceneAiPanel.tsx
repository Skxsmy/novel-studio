import { useEffect, useMemo, useState } from "react";
import type {
  ContextPreviewSelection,
  ModelProfile,
  SceneDocument,
  SeriesDetail,
} from "@novel-studio/contracts";
import { api } from "./api";

const CONTINUITY_PROMPT_TEMPLATE_ID = "00000000-0000-4000-8000-000000000405";
const WRITING_PROMPT_TEMPLATE_ID = "00000000-0000-4000-8000-000000000406";

type AiPanelMode = "review" | "rewrite-selection";
type CallState = "idle" | "building-context" | "streaming" | "done" | "error";

export interface InlineAiCandidateInput {
  text: string;
  sourceCallId: string;
  selection: ContextPreviewSelection;
}

interface SceneAiPanelProps {
  detail: SeriesDetail;
  activeScene: SceneDocument;
  content: string;
  selectedText: string;
  rightOpen: boolean;
  canCreateInlineCandidate: boolean;
  onInlineCandidate: (candidate: InlineAiCandidateInput) => void;
  onMessage: (message: string) => void;
}

const defaultRequests: Record<AiPanelMode, string> = {
  review: "请检查当前场景的连续性风险，只指出问题、证据和建议，不要改写正文或设定。",
  "rewrite-selection": "请在不改变事实、不新增设定的前提下，改写当前选区，使中文表达更自然、节奏更稳。",
};

function selectedTextRange(content: string, selectedText: string): ContextPreviewSelection | null {
  if (!selectedText.trim()) return null;
  const start = content.indexOf(selectedText);
  if (start < 0) return null;
  if (content.indexOf(selectedText, start + selectedText.length) >= 0) return null;
  return { start, end: start + selectedText.length, text: selectedText };
}

export function SceneAiPanel({
  detail,
  activeScene,
  content,
  selectedText,
  rightOpen,
  canCreateInlineCandidate,
  onInlineCandidate,
  onMessage,
}: SceneAiPanelProps) {
  const [mode, setMode] = useState<AiPanelMode>("review");
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([]);
  const [selectedModelProfileId, setSelectedModelProfileId] = useState("");
  const [requestText, setRequestText] = useState(defaultRequests.review);
  const [callState, setCallState] = useState<CallState>("idle");
  const [analysisText, setAnalysisText] = useState("");
  const [generatedLength, setGeneratedLength] = useState(0);

  const selection = useMemo(
    () => selectedTextRange(content, selectedText),
    [content, selectedText],
  );
  const selectedModelProfile = modelProfiles.find((profile) => profile.id === selectedModelProfileId);
  const canRunRewrite = Boolean(canCreateInlineCandidate && selection && selectedModelProfileId && callState !== "streaming" && callState !== "building-context");
  const canRunReview = Boolean(selectedModelProfileId && callState !== "streaming" && callState !== "building-context");

  useEffect(() => {
    setAnalysisText("");
    setGeneratedLength(0);
    setCallState("idle");
  }, [activeScene.metadata.id]);

  useEffect(() => {
    if (!rightOpen) return;
    let cancelled = false;
    async function load() {
      try {
        const profiles = await api.listModelProfiles(detail.manifest.id);
        if (cancelled) return;
        setModelProfiles(profiles);
        setSelectedModelProfileId((current) =>
          current && profiles.some((profile) => profile.id === current)
            ? current
            : profiles[0]?.id ?? "",
        );
      } catch (caught) {
        if (!cancelled) onMessage(caught instanceof Error ? caught.message : "无法读取智能编辑记录");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [detail.manifest.id, onMessage, rightOpen]);

  function switchMode(nextMode: AiPanelMode) {
    setMode(nextMode);
    setRequestText(defaultRequests[nextMode]);
    setAnalysisText("");
    setGeneratedLength(0);
    setCallState("idle");
    onMessage("");
  }

  async function run(modeToRun: AiPanelMode) {
    if (!selectedModelProfileId) {
      onMessage("请先在设置中添加模型配置。");
      return;
    }
    if (modeToRun === "rewrite-selection" && !canCreateInlineCandidate) {
      onMessage("请先等待当前正文保存完成，再生成正文候选。");
      return;
    }
    if (modeToRun === "rewrite-selection" && !selection) {
      onMessage("请先在正文中选择一段唯一出现的文字，再生成改写候选。");
      return;
    }

    const isRewrite = modeToRun === "rewrite-selection";
    const roleId = isRewrite ? "lead-writing-partner" : "continuity-editor";
    const taskKind = isRewrite ? "rewrite" : "continuity-check";
    const promptTemplateId = isRewrite ? WRITING_PROMPT_TEMPLATE_ID : CONTINUITY_PROMPT_TEMPLATE_ID;
    const userRequest = isRewrite
      ? `${requestText}\n\n输出要求：只输出可直接替换选区的 Markdown 正文。不要解释，不要加标题，不要写“候选稿”。`
      : requestText;
    let callId = "";
    let generated = "";

    setCallState("building-context");
    setAnalysisText("");
    setGeneratedLength(0);
    onMessage("");

    try {
      const contextBundle = await api.previewContext(detail.manifest.id, {
        sceneId: activeScene.metadata.id,
        roleId,
        taskKind,
        userRequest,
        promptTemplateId,
        promptTemplateVersion: 1,
        selection: isRewrite ? selection : null,
        manualContextIds: [],
        modelProfileId: selectedModelProfileId,
        tokenBudget: null,
      });

      setCallState("streaming");
      await api.streamModelCall(detail.manifest.id, {
        contextBundleId: contextBundle.id,
        modelProfileId: selectedModelProfileId,
        roleId,
        taskKind,
        promptTemplateId,
        promptTemplateVersion: 1,
        parameters: {},
      }, {
        onEvent: (event) => {
          if (event.type === "metadata") callId = event.callId;
          if (event.type === "done") callId = event.callId;
        },
        onDelta: (text) => {
          generated += text;
          if (isRewrite) {
            setGeneratedLength(Array.from(generated).length);
          } else {
            setAnalysisText((current) => current + text);
          }
        },
      });

      if (isRewrite && callId && selection) {
        const candidateText = generated.trim();
        if (!candidateText) throw new Error("模型没有返回可放入正文的候选内容。");
        onInlineCandidate({ text: candidateText, sourceCallId: callId, selection });
        onMessage("候选已进入正文，整段已选中。保留前不会保存。");
      } else {
        onMessage("审稿完成。");
      }
      setCallState("done");
    } catch (caught) {
      setCallState("error");
      onMessage(caught instanceof Error ? caught.message : "智能编辑调用失败");
    }
  }

  return (
    <div className="scene-ai-panel">
      <header className="ai-panel-head">
        <div>
          <p className="eyebrow">智能编辑</p>
          <h3>{mode === "review" ? "审稿" : "改写"}</h3>
        </div>
      </header>

      <div className="ai-mode-tabs">
        <button className={mode === "review" ? "active" : ""} onClick={() => switchMode("review")}>审稿</button>
        <button className={mode === "rewrite-selection" ? "active" : ""} onClick={() => switchMode("rewrite-selection")}>改写</button>
      </div>

      <section className="ai-command-card">
        <label className="ai-field">
          要求
          <textarea
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
          />
        </label>

        <div className="ai-model-row">
          <select
            aria-label="模型"
            value={selectedModelProfileId}
            onChange={(event) => setSelectedModelProfileId(event.target.value)}
          >
            <option value="">选择模型</option>
            {modelProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.title} · {profile.model}</option>
            ))}
          </select>
          <button
            className="ai-run-button"
            disabled={mode === "review" ? !canRunReview : !canRunRewrite}
            onClick={() => void run(mode)}
          >
            {callState === "building-context" ? "准备中" : callState === "streaming" ? "生成中" : mode === "review" ? "开始" : "生成"}
          </button>
        </div>
      </section>

      {mode === "rewrite-selection" && (
        <div className={`ai-selection-card ${selection ? "" : "invalid"}`}>
          <strong>{!canCreateInlineCandidate ? "已有候选待处理" : selection ? "将改写选区" : "先选中正文"}</strong>
          <p>{!canCreateInlineCandidate ? "保留或撤回后再继续。" : selection ? `“${selection.text.slice(0, 90)}${selection.text.length > 90 ? "…" : ""}”` : "在正文里选中一段文字即可。"}</p>
        </div>
      )}

      {mode === "review" && (
        <div className="ai-response-card" aria-live="polite">
          <strong>结果</strong>
          <pre>{analysisText || "结果会出现在这里。"}</pre>
        </div>
      )}

      {mode === "rewrite-selection" && (
        <div className="ai-inline-status" aria-live="polite">
          <strong>{generatedLength ? `已生成 ${generatedLength.toLocaleString("zh-CN")} 字` : "候选会放进正文"}</strong>
          <p>生成后直接选中，方便保留或撤回。</p>
        </div>
      )}
    </div>
  );
}
