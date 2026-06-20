import { useEffect, useState } from "react";
import type {
  CodexCategoryDocument,
  CodexCategoryId,
  CodexEntryDocument,
  SceneDocument,
} from "@novel-studio/contracts";
import { api } from "./api";
import { EntryEditor } from "./CodexEntryEditor";
import { codexPolicyLabels } from "./copy";

export { formatDetailLines, parseDetailLines } from "./CodexEntryEditor";

export function CodexView({
  seriesId,
  scenes,
  activeSceneId,
  onCodexChanged,
}: {
  seriesId: string;
  scenes: SceneDocument[];
  activeSceneId: string | null;
  onCodexChanged: () => Promise<void>;
}) {
  const [categories, setCategories] = useState<CodexCategoryDocument[]>([]);
  const [entries, setEntries] = useState<CodexEntryDocument[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<CodexCategoryId | "all">("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  async function load(preferredEntryId?: string) {
    setBusy(true);
    setMessage("");
    try {
      const [loadedCategories, loadedEntries] = await Promise.all([
        api.listCodexCategories(seriesId, true),
        api.listCodexEntries(seriesId, { includeArchived: true }),
      ]);
      setCategories(loadedCategories);
      setEntries(loadedEntries);
      const candidate = preferredEntryId ?? selectedEntryId;
      setSelectedEntryId(
        candidate && loadedEntries.some((entry) => entry.metadata.id === candidate)
          ? candidate
          : loadedEntries[0]?.metadata.id ?? null,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取设定库失败");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [seriesId]);

  const visibleCategories = categories.filter(
    (category) => showArchived || !category.category.archivedAt,
  );
  const visibleEntries = entries.filter((entry) =>
    (showArchived || !entry.metadata.archivedAt) &&
    (selectedCategoryId === "all" || entry.metadata.categoryId === selectedCategoryId) &&
    (!search.trim() ||
      [entry.metadata.name, ...entry.metadata.aliases, ...entry.metadata.tags]
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(search.trim().toLocaleLowerCase("zh-CN"))),
  );
  const selectedEntry = entries.find((entry) => entry.metadata.id === selectedEntryId) ?? null;

  async function createEntry() {
    const categoryId = selectedCategoryId === "all" ? "character" : selectedCategoryId;
    setBusy(true);
    try {
      const created = await api.createCodexEntry(seriesId, {
        categoryId,
        name: "新条目",
        description: "",
        research: "",
      });
      await load(created.metadata.id);
      await onCodexChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建条目失败");
      setBusy(false);
    }
  }

  async function createCategory() {
    if (!categoryName.trim()) return;
    setBusy(true);
    try {
      const created = await api.createCodexCategory(seriesId, {
        name: categoryName,
        icon: "◇",
      });
      setCategoryName("");
      await load();
      setSelectedCategoryId(created.category.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建类别失败");
      setBusy(false);
    }
  }

  async function toggleCategory(category: CodexCategoryDocument) {
    if (category.category.builtIn || !category.revision) return;
    setBusy(true);
    try {
      if (category.category.archivedAt) {
        await api.restoreCodexCategory(seriesId, category.category.id, {
          baseRevision: category.revision,
        });
      } else {
        await api.archiveCodexCategory(seriesId, category.category.id, {
          baseRevision: category.revision,
        });
      }
      setSelectedCategoryId("all");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新类别失败");
      setBusy(false);
    }
  }

  return (
    <section className="codex-workspace">
      <aside className="codex-categories">
        <div className="codex-panel-heading"><div><p className="eyebrow">故事资料</p><h2>设定库</h2></div><span>{entries.filter((entry) => !entry.metadata.archivedAt).length}</span></div>
        <button className={selectedCategoryId === "all" ? "active" : ""} onClick={() => setSelectedCategoryId("all")}><span>全</span><strong>全部条目</strong></button>
        {visibleCategories.map((category) => <div className="category-row" key={category.category.id}>
          <button className={selectedCategoryId === category.category.id ? "active" : ""} onClick={() => setSelectedCategoryId(category.category.id)}>
            <span>{category.category.icon}</span><strong>{category.category.name}</strong>
            <small>{entries.filter((entry) => entry.metadata.categoryId === category.category.id && !entry.metadata.archivedAt).length}</small>
          </button>
          {!category.category.builtIn && <button className="category-archive" title={category.category.archivedAt ? "恢复类别" : "归档类别"} onClick={() => void toggleCategory(category)}>{category.category.archivedAt ? "↺" : "–"}</button>}
        </div>)}
        <div className="category-create"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="新自定义类别" /><button disabled={!categoryName.trim() || busy} onClick={() => void createCategory()}>+</button></div>
        <label className="show-archived"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> 显示已归档</label>
      </aside>

      <section className="codex-entry-list">
        <header><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="筛选名称、别名或标签" /><button disabled={busy} onClick={() => void createEntry()}>新建条目</button></header>
        {visibleEntries.map((entry) => <button className={`${selectedEntryId === entry.metadata.id ? "active" : ""} ${entry.metadata.archivedAt ? "archived" : ""}`} onClick={() => setSelectedEntryId(entry.metadata.id)} key={entry.metadata.id}>
          <strong>{entry.metadata.name}</strong>
          <span>{entry.metadata.aliases.slice(0, 2).join(" · ") || codexPolicyLabels[entry.metadata.aiContextPolicy]}</span>
          <small>{entry.description.slice(0, 56) || "尚无已确认设定"}</small>
        </button>)}
        {!visibleEntries.length && <p className="empty-side">{busy ? "正在读取设定库…" : "这个类别还没有条目。"}</p>}
      </section>

      {selectedEntry ? <EntryEditor
        seriesId={seriesId}
        entry={selectedEntry}
        entries={entries}
        scenes={scenes}
        activeSceneId={activeSceneId}
        onSaved={(updated) => {
          setEntries((current) => current.map((item) => item.metadata.id === updated.metadata.id ? updated : item));
          void onCodexChanged();
        }}
        onArchived={() => void load(selectedEntry.metadata.id)}
      /> : <section className="codex-empty-detail"><span>◇</span><h3>建立故事资料</h3><p>先创建人物、地点或设定。已确认设定和参考笔记会分开保存，不会互相冒充。</p></section>}
      {message && <div className="codex-global-message">{message}</div>}
    </section>
  );
}
