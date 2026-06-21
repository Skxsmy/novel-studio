import type {
  ActManifest,
  ChapterManifest,
  ResolvedReviewAnchor,
  SceneDocument,
  SceneSectionAiPolicy,
  SceneSectionDocument,
  SceneSectionKind,
  SeriesDetail,
} from "@novel-studio/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "./api";
import { readableSceneStatus, sectionPolicyLabels } from "./copy";
import { MarkdownEditor, type MarkdownSelection, type MarkdownTextSelectionRequest } from "./MarkdownEditor";
import {
  clearRecoveryDraft,
  loadRecoveryDraft,
  recoveryDecision,
  saveRecoveryDraft,
  type RecoveryDecision,
  type RecoveryDraft,
} from "./recoveryDraft";
import { SceneAiPanel, type InlineAiCandidateInput } from "./SceneAiPanel";
import { SceneContextPanel } from "./SceneContextPanel";

type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error" | "candidate";
type InspectorTab = "context" | "ai" | "sections" | "anchors";
interface SceneCreateLocation {
  bookId: string;
  actId: string;
  chapterId: string;
}

const sectionKindLabels: Record<SceneSectionKind, string> = {
  "author-note": "作者备注",
  candidate: "候选版本",
  research: "参考资料",
  sensitive: "敏感资料",
  temporary: "临时草稿",
};

const anchorStatusLabels: Record<string, string> = {
  attached: "已定位",
  relocated: "已重定位",
  orphaned: "未找到原文",
};

function statusLabel(state: SaveState): string {
  return {
    saved: "已保存",
    dirty: "等待保存",
    saving: "正在保存…",
    conflict: "检测到版本冲突",
    error: "保存失败",
  candidate: "候选待确认",
  }[state];
}

interface WriteViewProps {
  detail: SeriesDetail;
  acts: ActManifest[];
  chapters: ChapterManifest[];
  activeScene: SceneDocument;
  onSelectScene: (sceneId: string) => void;
  onSceneUpdated: (scene: SceneDocument) => void;
  onCreateScene: (location?: SceneCreateLocation) => Promise<void>;
  onCreateBook: () => Promise<void>;
  onCreateAct: (bookId: string) => Promise<void>;
  onCreateChapter: (actId: string) => Promise<void>;
  rightOpen: boolean;
  focusMode: boolean;
  onExitFocus: () => void;
}

interface RecoveryPrompt {
  draft: RecoveryDraft;
  decision: Exclude<RecoveryDecision, "none">;
}

interface InlineCandidateState {
  id: string;
  baseRevision: string;
  beforeContent: string;
  afterContent: string;
  candidateText: string;
  replacedText: string;
  sourceCallId: string;
  start: number;
  end: number;
}

export function WriteView({
  detail,
  acts,
  chapters,
  activeScene,
  onSelectScene,
  onSceneUpdated,
  onCreateScene,
  onCreateBook,
  onCreateAct,
  onCreateChapter,
  rightOpen,
  focusMode,
  onExitFocus,
}: WriteViewProps) {
  const [title, setTitle] = useState(activeScene.metadata.title);
  const [content, setContent] = useState(activeScene.content);
  const [editingBaseRevision, setEditingBaseRevision] = useState(activeScene.revision);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [editorVersion, setEditorVersion] = useState(0);
  const [recoveryPrompt, setRecoveryPrompt] = useState<RecoveryPrompt | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("context");
  const [sections, setSections] = useState<SceneSectionDocument[]>([]);
  const [anchors, setAnchors] = useState<ResolvedReviewAnchor[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [sideMessage, setSideMessage] = useState("");
  const [inlineCandidate, setInlineCandidate] = useState<InlineCandidateState | null>(null);
  const [selectTextRequest, setSelectTextRequest] = useState<MarkdownTextSelectionRequest | null>(null);

  useEffect(() => {
    setTitle(activeScene.metadata.title);
    setContent(activeScene.content);
    setEditingBaseRevision(activeScene.revision);
    setSaveState("saved");
    setMessage("");
    setSelectedText("");
    setSideMessage("");
    setInlineCandidate(null);
    setEditorVersion((value) => value + 1);
    const draft = loadRecoveryDraft(
      window.localStorage,
      detail.manifest.id,
      activeScene.metadata.id,
    );
    const decision = recoveryDecision(
      draft,
      activeScene.revision,
      activeScene.metadata.title,
      activeScene.content,
    );
    setRecoveryPrompt(draft && decision !== "none" ? { draft, decision } : null);
  }, [activeScene.metadata.id, activeScene.metadata.title, activeScene.content, activeScene.revision, detail.manifest.id]);

  const refreshSideData = useCallback(async () => {
    try {
      const [nextSections, nextAnchors] = await Promise.all([
        api.listSceneSections(detail.manifest.id, activeScene.metadata.id),
        api.listReviewAnchors(detail.manifest.id, activeScene.metadata.id),
      ]);
      setSections(nextSections);
      setAnchors(nextAnchors);
    } catch (caught) {
      setSideMessage(caught instanceof Error ? caught.message : "无法读取场景附属资料");
    }
  }, [activeScene.metadata.id, detail.manifest.id]);

  useEffect(() => {
    void refreshSideData();
  }, [refreshSideData, activeScene.content]);

  const persistDraft = useCallback((nextTitle: string, nextContent: string) => {
    saveRecoveryDraft(window.localStorage, {
      schemaVersion: 1,
      seriesId: detail.manifest.id,
      sceneId: activeScene.metadata.id,
      baseRevision: editingBaseRevision,
      title: nextTitle,
      content: nextContent,
      updatedAt: new Date().toISOString(),
    });
  }, [activeScene.metadata.id, detail.manifest.id, editingBaseRevision]);

  const save = useCallback(async () => {
    if (saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    try {
      const updated = await api.updateScene(detail.manifest.id, activeScene.metadata.id, {
        baseRevision: editingBaseRevision,
        title,
        content,
      });
      clearRecoveryDraft(window.localStorage, detail.manifest.id, activeScene.metadata.id);
      setEditingBaseRevision(updated.revision);
      setRecoveryPrompt(null);
      onSceneUpdated(updated);
      setSaveState("saved");
      setMessage("");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setSaveState("conflict");
        setMessage("磁盘上的场景已有新版本。当前草稿仍在本机，未覆盖磁盘内容。");
      } else {
        setSaveState("error");
        setMessage(caught instanceof Error ? caught.message : "保存失败");
      }
    }
  }, [activeScene.metadata.id, content, detail.manifest.id, editingBaseRevision, onSceneUpdated, saveState, title]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void save(), 900);
    return () => window.clearTimeout(timer);
  }, [content, save, saveState, title]);

  function changeContent(value: string) {
    if (inlineCandidate) {
      setContent(value);
      if (value === inlineCandidate.afterContent) return;
      setInlineCandidate(null);
      setSaveState("dirty");
      persistDraft(title, value);
      setMessage("已手动编辑 AI 候选，后续按作者草稿保存。");
      return;
    }
    setContent(value);
    setSaveState("dirty");
    persistDraft(title, value);
  }

  function changeTitle(value: string) {
    if (inlineCandidate) {
      setMessage("请先保留或撤回 AI 候选，再修改场景标题。");
      return;
    }
    setTitle(value);
    setSaveState("dirty");
    persistDraft(value, content);
  }

  function discardDraft() {
    clearRecoveryDraft(window.localStorage, detail.manifest.id, activeScene.metadata.id);
    setRecoveryPrompt(null);
    setTitle(activeScene.metadata.title);
    setContent(activeScene.content);
    setEditingBaseRevision(activeScene.revision);
    setSaveState("saved");
    setMessage("");
    setEditorVersion((value) => value + 1);
  }

  async function reloadDiskVersion() {
    try {
      const diskScene = await api.getScene(detail.manifest.id, activeScene.metadata.id);
      clearRecoveryDraft(window.localStorage, detail.manifest.id, activeScene.metadata.id);
      setRecoveryPrompt(null);
      setTitle(diskScene.metadata.title);
      setContent(diskScene.content);
      setEditingBaseRevision(diskScene.revision);
      setSaveState("saved");
      setMessage("");
      setEditorVersion((value) => value + 1);
      onSceneUpdated(diskScene);
    } catch (caught) {
      setSaveState("error");
      setMessage(caught instanceof Error ? caught.message : "重新载入磁盘版本失败");
    }
  }

  function restoreDraft(prompt: RecoveryPrompt) {
    setTitle(prompt.draft.title);
    setContent(prompt.draft.content);
    setEditingBaseRevision(prompt.draft.baseRevision);
    setRecoveryPrompt(null);
    setSaveState("dirty");
    setMessage(prompt.decision === "stale" ? "这是基于旧磁盘版本的草稿；保存时会先进行冲突检查。" : "已恢复未保存草稿。");
    setEditorVersion((value) => value + 1);
  }

  function placeInlineCandidate(candidate: InlineAiCandidateInput) {
    if (saveState !== "saved") {
      setSideMessage("请先等待当前正文保存完成，再放入 AI 候选。");
      return;
    }
    const { start, end, text } = candidate.selection;
    if (content.slice(start, end) !== text) {
      setSideMessage("正文选区已经变化，AI 候选没有放入正文。请重新选择后再试。");
      return;
    }
    const nextContent = `${content.slice(0, start)}${candidate.text}${content.slice(end)}`;
    const candidateId = `${candidate.sourceCallId}:${Date.now()}`;
    setInlineCandidate({
      id: candidateId,
      baseRevision: editingBaseRevision,
      beforeContent: content,
      afterContent: nextContent,
      candidateText: candidate.text,
      replacedText: text,
      sourceCallId: candidate.sourceCallId,
      start,
      end: start + candidate.text.length,
    });
    setSelectTextRequest({
      key: candidateId,
      text: candidate.text,
    });
    setContent(nextContent);
    setSaveState("candidate");
    setMessage("候选已放入正文并选中，确认后保存。");
    setEditorVersion((value) => value + 1);
  }

  function acceptInlineCandidate() {
    if (!inlineCandidate) return;
    setInlineCandidate(null);
    setSaveState("dirty");
    persistDraft(title, content);
    setMessage("已保留 AI 候选，正在保存到 Markdown 原稿。");
  }

  function rejectInlineCandidate() {
    if (!inlineCandidate) return;
    setContent(inlineCandidate.beforeContent);
    setInlineCandidate(null);
    setSaveState("saved");
    setMessage("已撤回 AI 候选，正文恢复到生成前。");
    setEditorVersion((value) => value + 1);
  }

  const characterCount = Array.from(content.replace(/\s/gu, "")).length;
  const paragraphCount = content.trim() ? content.trim().split(/\n\s*\n/u).length : 0;
  const activeChapter = chapters.find((chapter) => chapter.id === activeScene.metadata.chapterId);
  const activeAct = acts.find((act) => activeChapter ? act.chapterIds.includes(activeChapter.id) : false);
  const activeBook = detail.books.find((book) => book.id === activeScene.metadata.bookId);
  const bookTitle = activeBook?.title ?? detail.books[0]?.title ?? "第一部";
  const activeLocation = {
    bookId: activeScene.metadata.bookId,
    actId: activeScene.metadata.actId,
    chapterId: activeScene.metadata.chapterId,
  };
  const chapterGroups = useMemo(() => {
    const groups = new Map<string, SceneDocument[]>();
    for (const chapter of chapters) groups.set(chapter.id, []);
    for (const scene of detail.scenes) groups.get(scene.metadata.chapterId)?.push(scene);
    return groups;
  }, [chapters, detail.scenes]);
  const chaptersById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );
  const actsById = useMemo(
    () => new Map(acts.map((act) => [act.id, act])),
    [acts],
  );

  async function createSection(kind: SceneSectionKind) {
    setSideMessage("");
    try {
      const created = await api.createSceneSection(detail.manifest.id, activeScene.metadata.id, {
        title: sectionKindLabels[kind],
        kind,
        content: "",
      });
      setSections((current) => [...current, created]);
    } catch (caught) {
      setSideMessage(caught instanceof Error ? caught.message : "创建附属文档失败");
    }
  }

  async function updateSection(section: SceneSectionDocument, changes: Partial<Pick<SceneSectionDocument["metadata"], "title" | "aiPolicy">> & { content?: string }) {
    try {
      const updated = await api.updateSceneSection(detail.manifest.id, section.metadata.id, {
        baseRevision: section.revision,
        ...changes,
      });
      setSections((current) => current.map((item) => item.metadata.id === updated.metadata.id ? updated : item));
      setSideMessage("附属文档已保存");
    } catch (caught) {
      setSideMessage(caught instanceof Error ? caught.message : "保存附属文档失败");
    }
  }

  async function archiveSection(section: SceneSectionDocument) {
    try {
      const archived = await api.archiveSceneSection(detail.manifest.id, section.metadata.id, {
        baseRevision: section.revision,
      });
      setSections((current) => current.map((item) => item.metadata.id === archived.metadata.id ? archived : item));
      setSideMessage("附属文档已归档");
    } catch (caught) {
      setSideMessage(caught instanceof Error ? caught.message : "归档附属文档失败");
    }
  }

  async function restoreSection(section: SceneSectionDocument) {
    try {
      const restored = await api.restoreSceneSection(detail.manifest.id, section.metadata.id, {
        baseRevision: section.revision,
      });
      setSections((current) => current.map((item) => item.metadata.id === restored.metadata.id ? restored : item));
      setSideMessage("附属文档已恢复");
    } catch (caught) {
      setSideMessage(caught instanceof Error ? caught.message : "恢复附属文档失败");
    }
  }

  async function createAnchor() {
    if (!selectedText) return;
    if (saveState !== "saved") {
      setSideMessage("请等待正文保存完成，再建立基于磁盘版本的锚点。");
      return;
    }
    const first = content.indexOf(selectedText);
    const repeated = first >= 0 && content.indexOf(selectedText, first + selectedText.length) >= 0;
    if (first < 0 || repeated) {
      setSideMessage("所选文字在 Markdown 原稿中无法唯一定位；请扩大选择范围后重试。");
      return;
    }
    try {
      const created = await api.createReviewAnchor(detail.manifest.id, activeScene.metadata.id, {
        baseRevision: editingBaseRevision,
        exactQuote: selectedText,
        start: first,
        end: first + selectedText.length,
      });
      setAnchors((current) => [...current, created]);
      setSelectedText("");
      setSideMessage("审阅锚点已建立");
    } catch (caught) {
      setSideMessage(caught instanceof Error ? caught.message : "建立锚点失败");
    }
  }

  return (
    <section className={`write-workspace ${rightOpen ? "with-inspector" : ""}`}>
      <aside className="scene-drawer">
        <div className="drawer-heading">
          <div>
            <span>作品结构</span>
            <small>{detail.books.length} 部 · {detail.scenes.length} 场景</small>
          </div>
          <div className="drawer-actions">
            <button className="drawer-action-primary" onClick={() => void onCreateScene(activeLocation)} title="在当前章节添加场景">本章新场景</button>
            <button className="drawer-action-secondary" onClick={() => void onCreateBook()} title="添加部">新部</button>
          </div>
        </div>
        {[...detail.books].sort((left, right) => left.order - right.order).map((book) => (
          <section className="book-drawer-section" key={book.id}>
            <div className="book-drawer-heading">
              <strong>{book.title}</strong>
              <button onClick={() => void onCreateAct(book.id)}>新幕</button>
            </div>
            {!book.actIds.length && <button className="empty-chapter-action" onClick={() => void onCreateAct(book.id)}>给这一部添加第一幕</button>}
            {book.actIds.map((actId) => {
              const act = actsById.get(actId);
              if (!act) return null;
              return (
                <div key={act.id}>
                  <div className="act-drawer-heading">
                    <p className="eyebrow">{act.title}</p>
                    <button onClick={() => void onCreateChapter(act.id)}>新章</button>
                  </div>
                  {!act.chapterIds.length && <button className="empty-chapter-action" onClick={() => void onCreateChapter(act.id)}>给这一幕添加第一章</button>}
                  {act.chapterIds.map((chapterId) => {
                    const chapter = chaptersById.get(chapterId);
                    if (!chapter) return null;
                    const scenes = [...(chapterGroups.get(chapterId) ?? [])].sort(
                      (left, right) => left.metadata.order - right.metadata.order,
                    );
                    const chapterLocation = { bookId: book.id, actId: act.id, chapterId: chapter.id };
                    return (
                      <div className="chapter-drawer-block" key={chapterId}>
                        <div className="chapter-drawer-heading">
                          <div>
                            <p className="chapter-label">{chapter.title}</p>
                            <small>{scenes.length} 场景</small>
                          </div>
                          <button onClick={() => void onCreateScene(chapterLocation)}>新场景</button>
                        </div>
                        {scenes.map((scene, index) => (
                          <button className={`scene-nav-item ${scene.metadata.id === activeScene.metadata.id ? "active" : ""}`} onClick={() => onSelectScene(scene.metadata.id)} key={scene.metadata.id}>
                            <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{scene.metadata.title}</strong><small>{scene.characterCount} 字</small></div>
                          </button>
                        ))}
                        {!scenes.length && <button className="empty-chapter-action" onClick={() => void onCreateScene(chapterLocation)}>给这一章添加第一个场景</button>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>
        ))}
      </aside>
      <article className="editor-shell">
        {focusMode && <button className="focus-exit" onClick={onExitFocus}>退出专注模式</button>}
        <div className="editor-breadcrumb">{bookTitle}&nbsp;&nbsp;/&nbsp;&nbsp;{activeAct?.title ?? "幕"}&nbsp;&nbsp;/&nbsp;&nbsp;{activeChapter?.title ?? "章"}</div>
        <input className="scene-title-input" value={title} disabled={Boolean(inlineCandidate)} onChange={(event) => changeTitle(event.target.value)} aria-label="场景标题" />
        {recoveryPrompt && (
          <div className={`recovery-banner ${recoveryPrompt.decision}`}>
            <div><strong>{recoveryPrompt.decision === "stale" ? "发现基于旧版本的恢复草稿" : "发现未保存草稿"}</strong><span>{new Date(recoveryPrompt.draft.updatedAt).toLocaleString("zh-CN")}</span></div>
            <button onClick={() => restoreDraft(recoveryPrompt)}>恢复草稿</button>
            <button onClick={discardDraft}>使用磁盘版本</button>
          </div>
        )}
        {inlineCandidate && (
          <div className="inline-candidate-banner">
            <div>
              <strong>候选待确认</strong>
            </div>
            <button onClick={acceptInlineCandidate}>保留</button>
            <button onClick={rejectInlineCandidate}>撤回</button>
          </div>
        )}
        <div className="markdown-editor" data-testid="markdown-editor">
          <MarkdownEditor
            key={`${activeScene.metadata.id}:${editorVersion}`}
            initialValue={content}
            onChange={changeContent}
            onSelectionChange={(selection: MarkdownSelection | null) => setSelectedText(selection?.text ?? "")}
            selectTextRequest={selectTextRequest}
          />
        </div>
        {message && <div className={`save-message ${saveState}`}>{message}{saveState === "conflict" && <button onClick={() => void reloadDiskVersion()}>重新载入磁盘版本</button>}</div>}
        <footer className="editor-status"><span className={`save-state ${saveState}`}>● {statusLabel(saveState)}</span><span>{characterCount} 字</span><span>{paragraphCount} 段</span><span>Markdown 原稿</span></footer>
      </article>
      {rightOpen && (
        <aside className="inspector writing-inspector">
          <div className="inspector-tabs">
            <button className={inspectorTab === "context" ? "active" : ""} onClick={() => setInspectorTab("context")}>场景</button>
            <button className={inspectorTab === "ai" ? "active" : ""} onClick={() => setInspectorTab("ai")}>AI 审阅</button>
            <button className={inspectorTab === "sections" ? "active" : ""} onClick={() => setInspectorTab("sections")}>附属文档</button>
            <button className={inspectorTab === "anchors" ? "active" : ""} onClick={() => setInspectorTab("anchors")}>锚点</button>
          </div>
          {inspectorTab === "context" && <SceneContextPanel
            detail={detail}
            activeScene={activeScene}
            content={content}
            selectedText={selectedText}
            rightOpen={rightOpen}
            onMessage={setSideMessage}
          />}
          {inspectorTab === "ai" && <SceneAiPanel
            detail={detail}
            activeScene={activeScene}
            content={content}
            selectedText={selectedText}
            rightOpen={rightOpen}
            canCreateInlineCandidate={saveState === "saved" && !inlineCandidate}
            onInlineCandidate={placeInlineCandidate}
            onMessage={setSideMessage}
          />}
          {inspectorTab === "sections" && <SectionPanel sections={sections} onCreate={createSection} onUpdate={updateSection} onArchive={archiveSection} onRestore={restoreSection} />}
          {inspectorTab === "anchors" && <AnchorPanel anchors={anchors} selectedText={selectedText} canCreate={saveState === "saved"} onCreate={createAnchor} />}
          {sideMessage && <p className="side-message">{sideMessage}</p>}
        </aside>
      )}
    </section>
  );
}

function SectionPanel({
  sections,
  onCreate,
  onUpdate,
  onArchive,
  onRestore,
}: {
  sections: SceneSectionDocument[];
  onCreate: (kind: SceneSectionKind) => Promise<void>;
  onUpdate: (section: SceneSectionDocument, changes: { title?: string; aiPolicy?: SceneSectionAiPolicy; content?: string }) => Promise<void>;
  onArchive: (section: SceneSectionDocument) => Promise<void>;
  onRestore: (section: SceneSectionDocument) => Promise<void>;
}) {
  const [newKind, setNewKind] = useState<SceneSectionKind>("author-note");
  return <div className="section-panel">
    <p className="eyebrow">附属文档</p>
    <div className="section-create"><select value={newKind} onChange={(event) => setNewKind(event.target.value as SceneSectionKind)}>{Object.entries(sectionKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button onClick={() => void onCreate(newKind)}>新建</button></div>
    {sections.filter((section) => !section.metadata.archivedAt).map((section) => <SectionCard key={section.metadata.id} section={section} onUpdate={onUpdate} onArchive={onArchive} />)}
    {!sections.some((section) => !section.metadata.archivedAt) && <p className="empty-side">本场景还没有附属文档。</p>}
    {sections.filter((section) => section.metadata.archivedAt).map((section) => <div className="archived-section" key={section.metadata.id}><span>{section.metadata.title}</span><button onClick={() => void onRestore(section)}>恢复</button></div>)}
  </div>;
}

function SectionCard({ section, onUpdate, onArchive }: {
  section: SceneSectionDocument;
  onUpdate: (section: SceneSectionDocument, changes: { title?: string; aiPolicy?: SceneSectionAiPolicy; content?: string }) => Promise<void>;
  onArchive: (section: SceneSectionDocument) => Promise<void>;
}) {
  const [title, setTitle] = useState(section.metadata.title);
  const [content, setContent] = useState(section.content);
  const [aiPolicy, setAiPolicy] = useState(section.metadata.aiPolicy);
  useEffect(() => { setTitle(section.metadata.title); setContent(section.content); setAiPolicy(section.metadata.aiPolicy); }, [section]);
  return <article className="section-card">
    <span>{sectionKindLabels[section.metadata.kind]}</span>
    <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="附属文档标题" />
    <textarea value={content} onChange={(event) => setContent(event.target.value)} aria-label={`${title}内容`} placeholder="这份资料不会混入正文……" />
    <select value={aiPolicy} onChange={(event) => setAiPolicy(event.target.value as SceneSectionAiPolicy)}>{Object.entries(sectionPolicyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <footer><button onClick={() => void onUpdate(section, { title, content, aiPolicy })}>保存</button><button onClick={() => void onArchive(section)}>归档</button></footer>
  </article>;
}

function AnchorPanel({ anchors, selectedText, canCreate, onCreate }: {
  anchors: ResolvedReviewAnchor[];
  selectedText: string;
  canCreate: boolean;
  onCreate: () => Promise<void>;
}) {
  return <div className="anchor-panel">
    <p className="eyebrow">审阅依据</p>
    <div className="selection-preview">{selectedText ? `“${selectedText.slice(0, 80)}”` : "先在正文中选择一段文字"}</div>
    <button className="anchor-create" disabled={!selectedText || !canCreate} onClick={() => void onCreate()}>建立审阅锚点</button>
    {anchors.map(({ anchor, resolution }) => <article className={`anchor-card ${resolution.status}`} key={anchor.id}><span>{anchorStatusLabels[resolution.status] ?? resolution.status}</span><blockquote>{anchor.exactQuote}</blockquote><small>{resolution.reason}</small></article>)}
    {!anchors.length && <p className="empty-side">尚无审阅锚点。</p>}
  </div>;
}
