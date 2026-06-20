import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActManifest, ChapterManifest, PlanningBoard, SceneDocument, SearchResult, SeriesDetail, SeriesSummary } from "@novel-studio/contracts";
import { ApiError, api } from "./api";
import { PlanView } from "./PlanView";

type WorkspaceView = "overview" | "plan" | "write" | "codex" | "workshop" | "review";
type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";

const navigation: Array<{ id: WorkspaceView; icon: string; label: string }> = [
  { id: "overview", icon: "⌂", label: "概览" },
  { id: "plan", icon: "▦", label: "规划" },
  { id: "write", icon: "✎", label: "写作" },
  { id: "codex", icon: "◇", label: "Codex" },
  { id: "workshop", icon: "✦", label: "工作坊" },
  { id: "review", icon: "✓", label: "审阅" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));
}

function statusLabel(state: SaveState): string {
  return {
    saved: "已保存",
    dirty: "等待保存",
    saving: "正在保存…",
    conflict: "检测到版本冲突",
    error: "保存失败",
  }[state];
}

function EmptyLibrary({ onCreated }: { onCreated: (series: SeriesDetail) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      onCreated(await api.createSeries({ title, description, firstBookTitle: "第一部" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="welcome-shell">
      <header className="welcome-header">
        <div className="brand-mark">NS</div>
        <div>
          <p className="eyebrow">LOCAL STORY WORKSPACE</p>
          <h1>Novel Studio</h1>
        </div>
        <span className="local-badge">仅本机</span>
      </header>

      <section className="welcome-grid">
        <div className="welcome-copy">
          <p className="eyebrow">让故事保持清醒</p>
          <h2>写作时只看文字，<br />需要时再召集整间编辑室。</h2>
          <p>
            原稿始终是你能直接打开的 Markdown 文件。规划、人物状态和 AI 建议围绕它工作，而不是把作品锁进黑箱。
          </p>
          <div className="principle-row">
            <span>文件为真</span><span>建议先确认</span><span>上下文可检查</span>
          </div>
        </div>

        <form className="create-card" onSubmit={submit}>
          <div className="card-number">01</div>
          <p className="eyebrow">创建第一个系列</p>
          <label>
            系列名称
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：雾港纪事" autoFocus />
          </label>
          <label>
            一句话说明 <span className="optional">可选</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="这个故事最令你着迷的是什么？" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={creating || !title.trim()}>
            {creating ? "正在建立作品目录…" : "进入写作室"}
          </button>
          <p className="fine-print">会同时创建一部书和一个空白开篇场景。</p>
        </form>
      </section>
    </main>
  );
}

function Overview({ detail }: { detail: SeriesDetail }) {
  const characters = detail.scenes.reduce((sum, scene) => sum + scene.characterCount, 0);
  return (
    <section className="content-page overview-page">
      <div className="page-heading">
        <div><p className="eyebrow">PROJECT PULSE</p><h2>{detail.manifest.title}</h2></div>
        <span className="phase-chip">M1 · 交互骨架</span>
      </div>
      <div className="metric-grid">
        <article><span>正文字符</span><strong>{characters.toLocaleString("zh-CN")}</strong><small>本系列当前总量</small></article>
        <article><span>场景</span><strong>{detail.scenes.length}</strong><small>{detail.scenes.filter((scene) => scene.metadata.status === "draft").length} 个草稿</small></article>
        <article><span>候选更新</span><strong>0</strong><small>AI 不会自动改写 Canon</small></article>
      </div>
      <div className="two-column">
        <article className="panel recent-panel">
          <div className="panel-title"><h3>最近场景</h3><span>按叙事顺序</span></div>
          {detail.scenes.map((scene, index) => (
            <div className="recent-row" key={scene.metadata.id}>
              <span className="scene-index">{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{scene.metadata.title}</strong><small>{scene.characterCount} 字符 · {scene.metadata.status}</small></div>
              <span>{formatDate(scene.metadata.updatedAt)}</span>
            </div>
          ))}
        </article>
        <article className="panel next-panel">
          <p className="eyebrow">NEXT SESSION</p>
          <h3>回到开篇场景</h3>
          <p>先写下一段真实发生的事。人物库、连续性和编辑会审会在后续里程碑接入。</p>
          <div className="quote-line">“大纲允许被人物说服。”</div>
        </article>
      </div>
    </section>
  );
}

function CodexView() {
  const types = [
    ["人物", "记录动机、知识与随剧情变化的状态", "林"],
    ["地点", "让环境规则在每次出现时保持一致", "港"],
    ["情节线", "追踪承诺、推进和仍未回收的伏笔", "线"],
  ];
  return (
    <section className="content-page">
      <div className="page-heading"><div><p className="eyebrow">STORY MEMORY</p><h2>Codex</h2></div><span className="phase-chip">计划于 M3</span></div>
      <div className="codex-intro"><h3>故事事实应该有出处，也应该有生效时间。</h3><p>这里将容纳人物、地点、物件、世界设定与情节线。当前页面用于验证入口和信息密度，尚未写入真实 Codex 文件。</p></div>
      <div className="codex-grid">{types.map(([title, copy, mark]) => <article key={title}><span>{mark}</span><h3>{title}</h3><p>{copy}</p><button disabled>新建{title}</button></article>)}</div>
    </section>
  );
}

function WorkshopView() {
  return (
    <section className="content-page workshop-page">
      <div className="page-heading"><div><p className="eyebrow">EDITORIAL ROOM</p><h2>工作坊</h2></div><span className="phase-chip">计划于 M4–M5</span></div>
      <div className="workshop-layout">
        <aside className="agent-list">
          {[["主", "主笔伙伴"], ["构", "结构编辑"], ["人", "人物编辑"], ["冷", "冷酷读者"]].map(([mark, name], index) => <button className={index === 0 ? "selected" : ""} key={name}><span>{mark}</span><div><strong>{name}</strong><small>{index === 0 ? "共同构思与落笔" : "独立判断，不负责附和"}</small></div></button>)}
        </aside>
        <div className="chat-placeholder">
          <div className="context-strip"><span>上下文尚未装配</span><span>0 tokens</span><span>本地优先</span></div>
          <div className="empty-conversation"><span>✦</span><h3>把问题交给合适的编辑</h3><p>模型连接前，此处不会伪造 AI 回答。M4 将先实现上下文预览和调用记录。</p></div>
          <div className="composer"><textarea disabled placeholder="选择模型后与编辑讨论……" /><button disabled>发送</button></div>
        </div>
      </div>
    </section>
  );
}

function ReviewView() {
  return (
    <section className="content-page review-page">
      <div className="page-heading"><div><p className="eyebrow">PROPOSAL INBOX</p><h2>审阅收件箱</h2></div><span className="count-chip">0 项待处理</span></div>
      <div className="empty-review"><div className="shield">✓</div><h3>作品目前没有待确认的更改</h3><p>以后所有 AI 摘要、人物状态、伏笔和正文修改都会先来到这里。只有你的接受动作能改变原稿和 Canon。</p><div className="review-rules"><span>带证据</span><span>带基础版本</span><span>可拒绝</span><span>可逐项修改</span></div></div>
    </section>
  );
}

interface WriteViewProps {
  detail: SeriesDetail;
  acts: ActManifest[];
  chapters: ChapterManifest[];
  activeScene: SceneDocument;
  onSelectScene: (sceneId: string) => void;
  onSceneUpdated: (scene: SceneDocument) => void;
  onCreateScene: () => Promise<void>;
  rightOpen: boolean;
}

function WriteView({ detail, acts, chapters, activeScene, onSelectScene, onSceneUpdated, onCreateScene, rightOpen }: WriteViewProps) {
  const [title, setTitle] = useState(activeScene.metadata.title);
  const [content, setContent] = useState(activeScene.content);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTitle(activeScene.metadata.title);
    setContent(activeScene.content);
    setSaveState("saved");
    setMessage("");
  }, [activeScene.metadata.id, activeScene.metadata.title, activeScene.content]);

  const save = useCallback(async () => {
    if (saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    try {
      const updated = await api.updateScene(detail.manifest.id, activeScene.metadata.id, {
        baseRevision: activeScene.revision,
        title,
        content,
      });
      onSceneUpdated(updated);
      setSaveState("saved");
      setMessage("");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setSaveState("conflict");
        setMessage("磁盘上的场景已有新版本。为避免覆盖，本次修改尚未写入。");
      } else {
        setSaveState("error");
        setMessage(caught instanceof Error ? caught.message : "保存失败");
      }
    }
  }, [activeScene.metadata.id, activeScene.revision, content, detail.manifest.id, onSceneUpdated, saveState, title]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void save(), 900);
    return () => window.clearTimeout(timer);
  }, [content, save, saveState, title]);

  function changeContent(value: string) { setContent(value); setSaveState("dirty"); }
  function changeTitle(value: string) { setTitle(value); setSaveState("dirty"); }

  const characterCount = Array.from(content.replace(/\s/g, "")).length;
  const paragraphCount = content.trim() ? content.trim().split(/\n\s*\n/u).length : 0;

  const activeChapter = chapters.find((c) => c.id === activeScene.metadata.chapterId);
  const activeAct = acts.find((a) => activeChapter ? a.chapterIds.includes(activeChapter.id) : false);
  const book = detail.books[0];
  const bookTitle = book?.title ?? "第一部";

  const chapterGroups = new Map<string, SceneDocument[]>();
  for (const chapter of chapters) chapterGroups.set(chapter.id, []);
  for (const scene of detail.scenes) {
    chapterGroups.get(scene.metadata.chapterId)?.push(scene);
  }
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  return (
    <section className={`write-workspace ${rightOpen ? "with-inspector" : ""}`}>
      <aside className="scene-drawer">
        <div className="drawer-heading"><span>{bookTitle}</span><button onClick={() => void onCreateScene()} title="添加场景">＋</button></div>
        {[...acts].sort((a, b) => a.order - b.order).map((act) => (
          <div key={act.id}>
            <p className="eyebrow">{act.title}</p>
            {act.chapterIds.map((chapterId) => {
              const chapter = chaptersById.get(chapterId);
              if (!chapter) return null;
              const scenes = [...(chapterGroups.get(chapterId) ?? [])].sort(
                (a, b) => a.metadata.order - b.metadata.order,
              );
              return (
                <div key={chapterId}>
                  <p className="chapter-label">{chapter.title}</p>
                  {scenes.map((scene, index) => (
                    <button className={`scene-nav-item ${scene.metadata.id === activeScene.metadata.id ? "active" : ""}`} onClick={() => onSelectScene(scene.metadata.id)} key={scene.metadata.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{scene.metadata.title}</strong><small>{scene.characterCount} 字符</small></div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </aside>
      <article className="editor-shell">
        <div className="editor-breadcrumb">{bookTitle}&nbsp;&nbsp;/&nbsp;&nbsp;{activeAct?.title ?? "幕"}&nbsp;&nbsp;/&nbsp;&nbsp;{activeChapter?.title ?? "章"}</div>
        <input className="scene-title-input" value={title} onChange={(event) => changeTitle(event.target.value)} aria-label="场景标题" />
        <textarea className="manuscript-editor" value={content} onChange={(event) => changeContent(event.target.value)} placeholder="从一个动作、一句话，或者某个不肯离开的画面开始……" spellCheck />
        {message && <div className={`save-message ${saveState}`}>{message}</div>}
        <footer className="editor-status"><span className={`save-state ${saveState}`}>● {statusLabel(saveState)}</span><span>{characterCount} 字符</span><span>{paragraphCount} 段</span><span>Markdown 原稿</span></footer>
      </article>
      {rightOpen && <aside className="inspector"><p className="eyebrow">SCENE CONTEXT</p><h3>场景资料</h3><dl><dt>状态</dt><dd>{activeScene.metadata.status}</dd><dt>POV</dt><dd>{activeScene.metadata.pov || "未设置"}</dd><dt>目标</dt><dd>{activeScene.metadata.goal || "尚未填写"}</dd><dt>摘要</dt><dd>{activeScene.metadata.summary || "等待作者确认"}</dd></dl><div className="inspector-note"><strong>上下文保护</strong><p>AI 模块尚未接入；当前不会把正文发送到任何外部服务。</p></div></aside>}
    </section>
  );
}

export function App() {
  const [seriesList, setSeriesList] = useState<SeriesSummary[]>([]);
  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [acts, setActs] = useState<ActManifest[]>([]);
  const [chapters, setChapters] = useState<ChapterManifest[]>([]);
  const [planningBoard, setPlanningBoard] = useState<PlanningBoard | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    api.listSeries().then(setSeriesList).catch((error: unknown) => setFatalError(error instanceof Error ? error.message : "无法连接本地服务")).finally(() => setLoading(false));
  }, []);

  const loadHierarchy = useCallback(async (loaded: SeriesDetail) => {
    const loadedActs: ActManifest[] = [];
    const loadedChapters: ChapterManifest[] = [];
    for (const book of [...loaded.books].sort((a, b) => a.order - b.order)) {
      const bookActs = await api.listActs(loaded.manifest.id, book.id);
      loadedActs.push(...bookActs);
      for (const act of bookActs) {
        loadedChapters.push(...(await api.listChapters(loaded.manifest.id, act.id)));
      }
    }
    setActs(loadedActs);
    setChapters(loadedChapters);
  }, []);

  const openSeries = useCallback(async (seriesId: string) => {
    setLoading(true);
    try {
      const loaded = await api.getSeries(seriesId);
      const [, board] = await Promise.all([
        loadHierarchy(loaded),
        api.getPlanningBoard(seriesId),
      ]);
      setDetail(loaded);
      setPlanningBoard(board);
      setActiveSceneId(loaded.scenes[0]?.metadata.id ?? null);
      setActiveView("overview");
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "打开系列失败");
    } finally {
      setLoading(false);
    }
  }, [loadHierarchy]);

  async function acceptCreatedSeries(created: SeriesDetail) {
    try {
      const [, board] = await Promise.all([
        loadHierarchy(created),
        api.getPlanningBoard(created.manifest.id),
      ]);
      setDetail(created);
      setPlanningBoard(board);
      setSeriesList([{ id: created.manifest.id, title: created.manifest.title, description: created.manifest.description, updatedAt: created.manifest.updatedAt, archived: false, bookCount: created.books.length, sceneCount: created.scenes.length, directoryName: "" }]);
      setActiveSceneId(created.scenes[0]?.metadata.id ?? null);
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "读取新作品层级失败");
    }
  }

  const activeScene = useMemo(() => detail?.scenes.find((scene) => scene.metadata.id === activeSceneId) ?? detail?.scenes[0] ?? null, [activeSceneId, detail]);

  const reloadProject = useCallback(async () => {
    if (!detail) return;
    const loaded = await api.getSeries(detail.manifest.id);
    const [, board] = await Promise.all([
      loadHierarchy(loaded),
      api.getPlanningBoard(detail.manifest.id),
    ]);
    setDetail(loaded);
    setPlanningBoard(board);
  }, [detail?.manifest.id, loadHierarchy]);

  async function createScene() {
    if (!detail) return;
    const scene = await api.createScene(detail.manifest.id, { title: `场景 ${detail.scenes.length + 1}`, content: "" });
    await reloadProject();
    setActiveSceneId(scene.metadata.id);
    setActiveView("write");
  }

  function sceneUpdated(scene: SceneDocument) {
    setDetail((current) => current ? { ...current, scenes: current.scenes.map((item) => item.metadata.id === scene.metadata.id ? scene : item) } : current);
    if (detail) void api.getPlanningBoard(detail.manifest.id).then(setPlanningBoard);
  }

  useEffect(() => {
    if (!detail || !searchQuery.trim()) { setSearchResults([]); return; }
    const timer = window.setTimeout(() => void api.search(detail.manifest.id, searchQuery).then(setSearchResults).catch(() => setSearchResults([])), 300);
    return () => window.clearTimeout(timer);
  }, [detail, searchQuery]);

  if (loading && !detail && seriesList.length === 0) return <div className="loading-screen"><span>NS</span><p>正在打开本地写作室…</p></div>;
  if (fatalError) return <div className="fatal-screen"><h1>本地服务没有准备好</h1><p>{fatalError}</p><button onClick={() => window.location.reload()}>重新连接</button></div>;
  if (!detail) {
    if (seriesList.length === 0) return <EmptyLibrary onCreated={(created) => void acceptCreatedSeries(created)} />;
    return <main className="library-picker"><div className="brand-mark">NS</div><p className="eyebrow">YOUR STORY LIBRARY</p><h1>选择一个系列</h1><div>{seriesList.map((series) => <button onClick={() => void openSeries(series.id)} key={series.id}><strong>{series.title}</strong><span>{series.sceneCount} 个场景 · 更新于 {formatDate(series.updatedAt)}</span></button>)}</div></main>;
  }

  return (
    <div className={`app-shell ${focusMode ? "focus-mode" : ""} ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand"><div className="brand-mark small">NS</div><div><strong>Novel Studio</strong><small>本地写作室</small></div></div>
        <button className="series-switcher" onClick={() => { setDetail(null); setActs([]); setChapters([]); setPlanningBoard(null); }}><span>{detail.manifest.title.slice(0, 1)}</span><div><strong>{detail.manifest.title}</strong><small>切换作品</small></div><b>⌄</b></button>
        <nav>{navigation.map((item) => <button className={activeView === item.id ? "active" : ""} onClick={() => setActiveView(item.id)} key={item.id}><span>{item.icon}</span><b>{item.label}</b>{item.id === "review" && <i>0</i>}</button>)}</nav>
        <div className="sidebar-footer"><button><span>⚙</span><b>设置</b></button><div className="local-status"><span /> 本地数据已连接</div></div>
      </aside>

      <div className="main-stage">
        <header className="topbar">
          <button className="icon-button" onClick={() => setSidebarOpen((value) => !value)} title="收起导航">☰</button>
          <div className="topbar-title"><strong>{navigation.find((item) => item.id === activeView)?.label}</strong><span>/ {detail.manifest.title}</span></div>
          <div className="search-box"><span>⌕</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索当前作品" /></div>
          <button className={`text-button ${focusMode ? "active" : ""}`} onClick={() => setFocusMode((value) => !value)}>专注模式</button>
          <button className={`icon-button ${rightOpen ? "active" : ""}`} onClick={() => setRightOpen((value) => !value)} title="场景资料">◫</button>
          {searchQuery && <div className="search-popover">{searchResults.length ? searchResults.map((result) => <button key={result.sceneId} onClick={() => { setActiveSceneId(result.sceneId); setActiveView("write"); setSearchQuery(""); }}><strong>{result.title}</strong><span dangerouslySetInnerHTML={{ __html: result.excerpt }} /></button>) : <p>没有找到匹配场景</p>}</div>}
        </header>

        {activeView === "overview" && <Overview detail={detail} />}
        {activeView === "plan" && planningBoard && <PlanView
          board={planningBoard}
          onReload={reloadProject}
          onOpenScene={(sceneId) => { setActiveSceneId(sceneId); setActiveView("write"); }}
        />}
        {activeView === "write" && activeScene && <WriteView detail={detail} acts={acts} chapters={chapters} activeScene={activeScene} onSelectScene={setActiveSceneId} onSceneUpdated={sceneUpdated} onCreateScene={createScene} rightOpen={rightOpen} />}
        {activeView === "codex" && <CodexView />}
        {activeView === "workshop" && <WorkshopView />}
        {activeView === "review" && <ReviewView />}
      </div>
    </div>
  );
}
