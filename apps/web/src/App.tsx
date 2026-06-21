import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActManifest, BookManifest, ChapterManifest, PlanningBoard, SceneDocument, SearchResult, SeriesDetail, SeriesSummary } from "@novel-studio/contracts";
import { api } from "./api";
import { CodexView } from "./CodexView";
import { appName, readableSceneStatus } from "./copy";
import { PlanView } from "./PlanView";
import { SettingsView } from "./SettingsView";
import { WriteView } from "./WriteView";

type WorkspaceView = "overview" | "plan" | "write" | "codex" | "workshop" | "review" | "settings";
interface SceneCreateLocation {
  bookId: string;
  actId: string;
  chapterId: string;
}

const navigation: Array<{ id: WorkspaceView; icon: string; label: string }> = [
  { id: "overview", icon: "⌂", label: "概览" },
  { id: "plan", icon: "▦", label: "规划" },
  { id: "write", icon: "✎", label: "写作" },
  { id: "codex", icon: "◇", label: "设定库" },
  { id: "workshop", icon: "✦", label: "编辑室" },
  { id: "review", icon: "✓", label: "待确认" },
  { id: "settings", icon: "⚙", label: "设置" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));
}

export function seriesDetailToSummary(detail: SeriesDetail): SeriesSummary {
  return {
    id: detail.manifest.id,
    title: detail.manifest.title,
    description: detail.manifest.description,
    updatedAt: detail.manifest.updatedAt,
    archived: detail.manifest.archivedAt !== null,
    bookCount: detail.books.length,
    sceneCount: detail.scenes.length,
    directoryName: "",
  };
}

export function nextActTitle(acts: ActManifest[]): string {
  return `第${toChineseNumber(acts.length + 1)}幕`;
}

export function nextBookTitle(books: BookManifest[]): string {
  return `第${toChineseNumber(books.length + 1)}部`;
}

export function nextChapterTitle(act: ActManifest | undefined, chapters: ChapterManifest[]): string {
  const count = act ? chapters.filter((chapter) => chapter.actId === act.id).length : 0;
  return `第${toChineseNumber(count + 1)}章`;
}

function toChineseNumber(value: number): string {
  if (!Number.isInteger(value) || value <= 0 || value >= 10000) return String(value);
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const units = ["", "十", "百", "千"];
  const parts = String(value).split("").map(Number);
  let result = "";
  let pendingZero = false;
  for (let index = 0; index < parts.length; index += 1) {
    const digit = parts[index]!;
    const unitIndex = parts.length - index - 1;
    if (digit === 0) {
      if (result) pendingZero = true;
      continue;
    }
    if (pendingZero) {
      result += "零";
      pendingZero = false;
    }
    if (!(digit === 1 && unitIndex === 1 && result === "")) result += digits[digit];
    result += units[unitIndex];
  }
  return result;
}

function CreateSeriesForm({
  onCreated,
  compact = false,
}: {
  onCreated: (series: SeriesDetail) => void;
  compact?: boolean;
}) {
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
    <form className={`create-card ${compact ? "library-create-card" : ""}`} onSubmit={submit}>
      <div className="card-number">{compact ? "＋" : "01"}</div>
      <p className="eyebrow">{compact ? "新建系列" : "开始一个系列"}</p>
      <label>
        系列名称
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：雾港纪事" autoFocus={!compact} />
      </label>
      <label>
        一句话说明 <span className="optional">可选</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="这个故事最令你着迷的是什么？" />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button" disabled={creating || !title.trim()}>
        {creating ? "正在建立作品目录…" : compact ? "创建并打开" : "进入写作室"}
      </button>
      <p className="fine-print">会同时创建一部书和一个空白开篇场景。</p>
    </form>
  );
}

function EmptyLibrary({ onCreated }: { onCreated: (series: SeriesDetail) => void }) {
  return (
    <main className="welcome-shell">
      <header className="welcome-header">
        <div className="brand-mark">书</div>
        <div>
          <p className="eyebrow">本地写作工作台</p>
          <h1>{appName}</h1>
        </div>
        <span className="local-badge">仅本机</span>
      </header>

      <section className="welcome-grid">
        <div className="welcome-copy">
          <p className="eyebrow">让故事保持清醒</p>
          <h2>写作时只看文字，<br />需要时再打开辅助资料。</h2>
          <p>
            原稿始终是你能直接打开的 Markdown 文件。规划、人物状态和智能编辑建议都围绕它工作，不会把作品藏进专有格式里。
          </p>
          <div className="principle-row">
            <span>文件为真</span><span>建议先确认</span><span>资料范围可查</span>
          </div>
        </div>

        <CreateSeriesForm onCreated={onCreated} />
      </section>
    </main>
  );
}

function LibraryPicker({
  seriesList,
  onOpen,
  onCreated,
}: {
  seriesList: SeriesSummary[];
  onOpen: (seriesId: string) => void;
  onCreated: (series: SeriesDetail) => void;
}) {
  return (
    <main className="library-picker">
      <section className="library-list-card">
        <div className="brand-mark">书</div>
        <p className="eyebrow">作品库</p>
        <h1>选择一个系列</h1>
        <div className="series-list-grid">
          {seriesList.map((series) => (
            <button onClick={() => onOpen(series.id)} key={series.id}>
              <strong>{series.title}</strong>
              <span>{series.sceneCount} 个场景 · 更新于 {formatDate(series.updatedAt)}</span>
            </button>
          ))}
        </div>
      </section>
      <CreateSeriesForm compact onCreated={onCreated} />
    </main>
  );
}

function Overview({ detail }: { detail: SeriesDetail }) {
  const characters = detail.scenes.reduce((sum, scene) => sum + scene.characterCount, 0);
  return (
    <section className="content-page overview-page">
      <div className="page-heading">
        <div><p className="eyebrow">作品概览</p><h2>{detail.manifest.title}</h2></div>
        <span className="phase-chip">本地基础版</span>
      </div>
      <div className="metric-grid">
        <article><span>正文字数</span><strong>{characters.toLocaleString("zh-CN")}</strong><small>全系列当前字数</small></article>
        <article><span>场景</span><strong>{detail.scenes.length}</strong><small>{detail.scenes.filter((scene) => scene.metadata.status === "draft").length} 个草稿</small></article>
        <article><span>待确认修改</span><strong>0</strong><small>智能编辑不会自动改写已确认设定</small></article>
      </div>
      <div className="two-column">
        <article className="panel recent-panel">
          <div className="panel-title"><h3>最近场景</h3><span>按叙事顺序</span></div>
          {detail.scenes.map((scene, index) => (
            <div className="recent-row" key={scene.metadata.id}>
              <span className="scene-index">{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{scene.metadata.title}</strong><small>{scene.characterCount} 字 · {readableSceneStatus(scene.metadata.status)}</small></div>
              <span>{formatDate(scene.metadata.updatedAt)}</span>
            </div>
          ))}
        </article>
        <article className="panel next-panel">
          <p className="eyebrow">下次继续</p>
          <h3>回到开篇场景</h3>
          <p>先写下一段真实发生的事。设定库、连续性检查和编辑会审会在后续接入。</p>
          <div className="quote-line">“大纲允许被人物说服。”</div>
        </article>
      </div>
    </section>
  );
}

function WorkshopView() {
  return (
    <section className="content-page workshop-page">
      <div className="page-heading"><div><p className="eyebrow">编辑室</p><h2>编辑室</h2></div><span className="phase-chip">后续接入</span></div>
      <div className="workshop-layout">
        <aside className="agent-list">
          {[["主", "主笔伙伴"], ["构", "结构编辑"], ["人", "人物编辑"], ["冷", "冷酷读者"]].map(([mark, name], index) => <button className={index === 0 ? "selected" : ""} key={name}><span>{mark}</span><div><strong>{name}</strong><small>{index === 0 ? "共同构思与落笔" : "独立判断，不负责附和"}</small></div></button>)}
        </aside>
        <div className="chat-placeholder">
          <div className="context-strip"><span>资料范围尚未整理</span><span>0 字资料</span><span>本地优先</span></div>
          <div className="empty-conversation"><span>✦</span><h3>把问题交给合适的编辑</h3><p>模型连接前，此处不会假装已经有编辑回复。后续会先实现资料范围预览和调用记录。</p></div>
          <div className="composer"><textarea disabled placeholder="选择模型后与编辑讨论……" /><button disabled>发送</button></div>
        </div>
      </div>
    </section>
  );
}

function ReviewView() {
  return (
    <section className="content-page review-page">
      <div className="page-heading"><div><p className="eyebrow">待确认修改</p><h2>待确认</h2></div><span className="count-chip">0 项待处理</span></div>
      <div className="empty-review"><div className="shield">✓</div><h3>作品目前没有待确认的更改</h3><p>以后所有智能编辑生成的摘要、人物状态、伏笔和正文修改都会先来到这里。只有你的接受动作能改变原稿和已确认设定。</p><div className="review-rules"><span>带证据</span><span>带基础版本</span><span>可拒绝</span><span>可逐项修改</span></div></div>
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
      const summary = seriesDetailToSummary(created);
      setSeriesList((current) => [summary, ...current.filter((item) => item.id !== summary.id)]);
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

  async function createScene(location?: SceneCreateLocation) {
    if (!detail) return;
    const fallbackLocation = activeScene
      ? {
          bookId: activeScene.metadata.bookId,
          actId: activeScene.metadata.actId,
          chapterId: activeScene.metadata.chapterId,
        }
      : undefined;
    const scene = await api.createScene(detail.manifest.id, {
      title: `场景 ${detail.scenes.length + 1}`,
      content: "",
      ...(location ?? fallbackLocation),
    });
    await reloadProject();
    setActiveSceneId(scene.metadata.id);
    setActiveView("write");
  }

  async function createBook() {
    if (!detail) return;
    await api.createBook(detail.manifest.id, { title: nextBookTitle(detail.books) });
    await reloadProject();
    setActiveView("write");
  }

  async function createAct(bookId: string) {
    if (!detail) return;
    const bookActs = acts.filter((act) => act.bookId === bookId);
    await api.createAct(detail.manifest.id, bookId, { title: nextActTitle(bookActs) });
    await reloadProject();
    setActiveView("write");
  }

  async function createChapter(actId: string) {
    if (!detail) return;
    const act = acts.find((item) => item.id === actId);
    await api.createChapter(detail.manifest.id, actId, { title: nextChapterTitle(act, chapters) });
    await reloadProject();
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

  if (loading && !detail && seriesList.length === 0) return <div className="loading-screen"><span>书</span><p>正在打开本地写作室…</p></div>;
  if (fatalError) return <div className="fatal-screen"><h1>本地服务没有准备好</h1><p>{fatalError}</p><button onClick={() => window.location.reload()}>重新连接</button></div>;
  if (!detail) {
    if (seriesList.length === 0) return <EmptyLibrary onCreated={(created) => void acceptCreatedSeries(created)} />;
    return <LibraryPicker
      seriesList={seriesList}
      onOpen={(seriesId) => void openSeries(seriesId)}
      onCreated={(created) => void acceptCreatedSeries(created)}
    />;
  }

  return (
    <div className={`app-shell ${focusMode ? "focus-mode" : ""} ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand"><div className="brand-mark small">书</div><div><strong>{appName}</strong><small>本地写作台</small></div></div>
        <button className="series-switcher" onClick={() => { setDetail(null); setActs([]); setChapters([]); setPlanningBoard(null); }}><span>{detail.manifest.title.slice(0, 1)}</span><div><strong>{detail.manifest.title}</strong><small>切换作品</small></div><b>⌄</b></button>
        <nav>{navigation.filter((item) => item.id !== "settings").map((item) => <button className={activeView === item.id ? "active" : ""} onClick={() => setActiveView(item.id)} key={item.id}><span>{item.icon}</span><b>{item.label}</b>{item.id === "review" && <i>0</i>}</button>)}</nav>
        <div className="sidebar-footer"><button className={activeView === "settings" ? "active" : ""} onClick={() => setActiveView("settings")}><span>⚙</span><b>设置</b></button><div className="local-status"><span /> 本地数据已连接</div></div>
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
        {activeView === "write" && activeScene && <WriteView detail={detail} acts={acts} chapters={chapters} activeScene={activeScene} onSelectScene={setActiveSceneId} onSceneUpdated={sceneUpdated} onCreateScene={createScene} onCreateBook={createBook} onCreateAct={createAct} onCreateChapter={createChapter} rightOpen={rightOpen} focusMode={focusMode} onExitFocus={() => setFocusMode(false)} />}
        {activeView === "codex" && <CodexView
          seriesId={detail.manifest.id}
          scenes={detail.scenes}
          activeSceneId={activeSceneId}
          onCodexChanged={reloadProject}
        />}
        {activeView === "workshop" && <WorkshopView />}
        {activeView === "review" && <ReviewView />}
        {activeView === "settings" && <SettingsView
          detail={detail}
          onSeriesManifestUpdated={(manifest) => setDetail((current) => current ? { ...current, manifest } : current)}
        />}
      </div>
    </div>
  );
}
