import { useEffect, useMemo, useState } from "react";
import type {
  CodexAiContextPolicy,
  CodexCategoryDocument,
  CodexCategoryId,
  CodexContextPreview,
  CodexEntryDocument,
  CodexRelationDocument,
  CodexMention,
  SceneDocument,
} from "@novel-studio/contracts";
import { api } from "./api";
import { codexPolicyLabels, contextExclusionLabels } from "./copy";

type DetailTab = "canon" | "research" | "details" | "relations" | "mentions";

export function parseDetailLines(value: string): Record<string, string> {
  const details: Record<string, string> = {};
  for (const line of value.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const detail = line.slice(separator + 1).trim();
    if (key) details[key] = detail;
  }
  return details;
}

export function formatDetailLines(details: Record<string, string>): string {
  return Object.entries(details).map(([key, value]) => `${key}: ${value}`).join("\n");
}

function EntryEditor({
  seriesId,
  entry,
  entries,
  scenes,
  activeSceneId,
  onSaved,
  onArchived,
}: {
  seriesId: string;
  entry: CodexEntryDocument;
  entries: CodexEntryDocument[];
  scenes: SceneDocument[];
  activeSceneId: string | null;
  onSaved: (entry: CodexEntryDocument) => void;
  onArchived: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("canon");
  const [name, setName] = useState(entry.metadata.name);
  const [aliases, setAliases] = useState(entry.metadata.aliases.join("，"));
  const [tags, setTags] = useState(entry.metadata.tags.join("，"));
  const [description, setDescription] = useState(entry.description);
  const [research, setResearch] = useState(entry.research.content);
  const [details, setDetails] = useState(formatDetailLines(entry.metadata.details));
  const [policy, setPolicy] = useState(entry.metadata.aiContextPolicy);
  const [caseSensitive, setCaseSensitive] = useState(entry.metadata.mention.caseSensitive);
  const [matchAliases, setMatchAliases] = useState(entry.metadata.mention.matchAliases);
  const [automaticPlural, setAutomaticPlural] = useState(entry.metadata.mention.automaticPlural);
  const [excludedTerms, setExcludedTerms] = useState(entry.metadata.mention.excludedTerms.join("\n"));
  const [relations, setRelations] = useState<CodexRelationDocument[]>([]);
  const [mentions, setMentions] = useState<CodexMention[]>([]);
  const [context, setContext] = useState<CodexContextPreview | null>(null);
  const [relationTarget, setRelationTarget] = useState("");
  const [relationType, setRelationType] = useState("关联");
  const [relationDirected, setRelationDirected] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTab("canon");
    setName(entry.metadata.name);
    setAliases(entry.metadata.aliases.join("，"));
    setTags(entry.metadata.tags.join("，"));
    setDescription(entry.description);
    setResearch(entry.research.content);
    setDetails(formatDetailLines(entry.metadata.details));
    setPolicy(entry.metadata.aiContextPolicy);
    setCaseSensitive(entry.metadata.mention.caseSensitive);
    setMatchAliases(entry.metadata.mention.matchAliases);
    setAutomaticPlural(entry.metadata.mention.automaticPlural);
    setExcludedTerms(entry.metadata.mention.excludedTerms.join("\n"));
    setContext(null);
  }, [entry.metadata.id, entry.revision, entry.research.revision]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listCodexRelations(
        seriesId,
        { entryId: entry.metadata.id, includeArchived: true },
      ),
      api.listCodexMentionsForEntry(
        seriesId,
        entry.metadata.id,
      ),
    ]).then(([loadedRelations, loadedMentions]) => {
      if (!cancelled) {
        setRelations(loadedRelations);
        setMentions(loadedMentions);
      }
    }).catch((error: unknown) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : "读取条目附属信息失败");
    });
    return () => { cancelled = true; };
  }, [seriesId, entry.metadata.id, entry.revision]);
  const entryNames = useMemo(
    () => Object.fromEntries(entries.map((item) => [item.metadata.id, item.metadata.name])),
    [entries],
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  function splitList(value: string): string[] {
    return value.split(/[，,\n]/u).map((item) => item.trim()).filter(Boolean);
  }

  async function save() {
    await run(async () => {
      const updated = await api.updateCodexEntry(seriesId, entry.metadata.id, {
        baseRevision: entry.revision,
        baseResearchRevision: entry.research.revision,
        name,
        aliases: splitList(aliases),
        tags: splitList(tags),
        description,
        research,
        details: parseDetailLines(details),
        aiContextPolicy: policy,
        mention: {
          caseSensitive,
          matchAliases,
          automaticPlural,
          excludedTerms: splitList(excludedTerms),
        },
      });
      onSaved(updated);
      setMessage("条目与参考笔记已分别保存");
    });
  }

  async function createRelation() {
    if (!relationTarget || !relationType.trim()) return;
    await run(async () => {
      await api.createCodexRelation(seriesId, {
        sourceEntryId: entry.metadata.id,
        targetEntryId: relationTarget,
        type: relationType,
        directed: relationDirected,
      });
      setRelations(await api.listCodexRelations(seriesId, {
        entryId: entry.metadata.id,
        includeArchived: true,
      }));
      setRelationTarget("");
    });
  }

  async function toggleRelation(relation: CodexRelationDocument) {
    await run(async () => {
      const updated = relation.relation.archivedAt
        ? await api.restoreCodexRelation(seriesId, relation.relation.id, {
            baseRevision: relation.revision,
          })
        : await api.archiveCodexRelation(seriesId, relation.relation.id, {
            baseRevision: relation.revision,
          });
      setRelations((current) =>
        current.map((item) =>
          item.relation.id === updated.relation.id ? updated : item,
        ),
      );
    });
  }

  async function previewContext(pinned: boolean) {
    if (!activeSceneId) return;
    await run(async () => {
      setContext(
        await api.previewCodexContext(
          seriesId,
          activeSceneId,
          pinned ? [entry.metadata.id] : [],
        ),
      );
    });
  }

  return (
    <section className="codex-detail">
      <header>
        <div>
          <p className="eyebrow">资料条目</p>
          <input
            aria-label="条目名称"
            className="codex-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={Boolean(entry.metadata.archivedAt)}
          />
        </div>
        <div className="codex-detail-actions">
          <button disabled={busy || Boolean(entry.metadata.archivedAt)} onClick={() => void save()}>保存</button>
          <button disabled={busy} onClick={() => void run(async () => {
            const updated = entry.metadata.archivedAt
              ? await api.restoreCodexEntry(seriesId, entry.metadata.id, { baseRevision: entry.revision })
              : await api.archiveCodexEntry(seriesId, entry.metadata.id, { baseRevision: entry.revision });
            onSaved(updated);
            onArchived();
          })}>
            {entry.metadata.archivedAt ? "恢复" : "归档"}
          </button>
        </div>
      </header>

      <div className="codex-summary-fields">
        <label>别名<input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="用逗号分隔" /></label>
        <label>标签<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="主角，调查组" /></label>
        <label>模型可读范围<select value={policy} onChange={(event) => setPolicy(event.target.value as CodexAiContextPolicy)}>
          {Object.entries(codexPolicyLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select></label>
      </div>

      <nav className="codex-tabs">
        {([
          ["canon", "已确认设定"],
          ["research", "参考笔记"],
          ["details", "识别规则"],
          ["relations", "关系"],
          ["mentions", "正文提及"],
        ] as Array<[DetailTab, string]>).map(([value, label]) => (
          <button className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>
        ))}
      </nav>

      {tab === "canon" && <div className="codex-tab-body">
        <p className="codex-safety-note">这里记录你已经确认的故事设定，后续整理资料时会把它当作事实来源。</p>
        <textarea aria-label="已确认设定" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="这个人物、地点或设定在故事里已经确定了什么？" />
      </div>}

      {tab === "research" && <div className="codex-tab-body">
        <p className="codex-safety-note research">参考笔记会单独保存；它可以启发写作，但不会自动变成已确认设定。</p>
        <textarea aria-label="参考笔记" value={research} onChange={(event) => setResearch(event.target.value)} placeholder="灵感、现实资料、待核实想法……" />
      </div>}

      {tab === "details" && <div className="codex-tab-body codex-details-tab">
        <label>补充字段 <small>每行写成“字段：内容”</small><textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder={"年龄：28\n职业：调查员"} /></label>
        <fieldset>
          <legend>提及规则</legend>
          <label><input type="checkbox" checked={matchAliases} onChange={(event) => setMatchAliases(event.target.checked)} /> 正文中出现别名时也算提及</label>
          <label><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} /> 区分大小写</label>
          <label><input type="checkbox" checked={automaticPlural} onChange={(event) => setAutomaticPlural(event.target.checked)} /> 英文名称允许复数形式</label>
          <label>排除用词<textarea value={excludedTerms} onChange={(event) => setExcludedTerms(event.target.value)} placeholder="每行一个；用于避免短名称误命中长词" /></label>
        </fieldset>
        <div className="context-preview-box">
          <strong>当前场景的资料提供范围</strong>
          <div><button disabled={!activeSceneId || busy} onClick={() => void previewContext(false)}>查看默认范围</button><button disabled={!activeSceneId || busy} onClick={() => void previewContext(true)}>试算主动选择</button></div>
          {context && <p>{context.included.some((item) => item.metadata.id === entry.metadata.id)
            ? "当前会提供这条资料"
            : `不会提供：${contextExclusionLabels[context.excluded.find((item) => item.entryId === entry.metadata.id)?.reason ?? "not-mentioned"]}`}</p>}
        </div>
      </div>}

      {tab === "relations" && <div className="codex-tab-body">
        <div className="relation-create">
          <select value={relationTarget} onChange={(event) => setRelationTarget(event.target.value)}>
            <option value="">选择关系目标</option>
            {entries.filter((item) => item.metadata.id !== entry.metadata.id && !item.metadata.archivedAt).map((item) => <option value={item.metadata.id} key={item.metadata.id}>{item.metadata.name}</option>)}
          </select>
          <input value={relationType} onChange={(event) => setRelationType(event.target.value)} placeholder="关系类型" />
          <label><input type="checkbox" checked={relationDirected} onChange={(event) => setRelationDirected(event.target.checked)} /> 区分方向</label>
          <button disabled={!relationTarget || busy} onClick={() => void createRelation()}>添加关系</button>
        </div>
        <div className="relation-list">
          {relations.map((relation) => {
            const outgoing = relation.relation.sourceEntryId === entry.metadata.id;
            const otherId = outgoing ? relation.relation.targetEntryId : relation.relation.sourceEntryId;
            const arrow = relation.relation.directed ? (outgoing ? "→" : "←") : "↔";
            return <article className={relation.relation.archivedAt ? "archived" : ""} key={relation.relation.id}>
              <strong>{arrow} {entryNames[otherId] ?? otherId.slice(0, 8)}</strong>
              <span>{relation.relation.type}</span>
              <small>{relation.relation.directed ? "只表示这个方向" : "不区分方向；两端看到同一条关系"}</small>
              <button onClick={() => void toggleRelation(relation)}>{relation.relation.archivedAt ? "恢复" : "归档"}</button>
            </article>;
          })}
          {!relations.length && <p className="empty-side">尚无关系。A→B 不会被系统自动解释为 B→A。</p>}
        </div>
        <p className="milestone-notice">关系随剧情发生变化时，会在后续的“进展记录”里追加历史；本页不会覆盖旧状态。</p>
      </div>}

      {tab === "mentions" && <div className="codex-tab-body">
        <p className="codex-safety-note">正文提及只表示名称出现过，不等于人物参与场景，也不等于设定已经成立。</p>
        {mentions.map((mention) => <article className="mention-row" key={`${mention.sceneId}-${mention.start}`}>
          <strong>{scenes.find((scene) => scene.metadata.id === mention.sceneId)?.metadata.title ?? mention.sceneId.slice(0, 8)}</strong>
          <span>“{mention.matchedText}”</span>
          <small>{mention.isAlias ? "别名" : "名称"} · 字符 {mention.start}–{mention.end}</small>
        </article>)}
        {!mentions.length && <p className="empty-side">当前没有明确提及。同名歧义会先留空，避免系统替你猜。</p>}
      </div>}

      {message && <div className="codex-message">{message}</div>}
    </section>
  );
}

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
