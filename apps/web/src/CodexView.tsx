import { useEffect, useMemo, useState } from "react";
import type {
  CodexAiContextPolicy,
  CodexCategoryDocument,
  CodexCategoryId,
  CodexContextPreview,
  CodexEffectiveState,
  CodexEntryDocument,
  CodexKnowledgeDocument,
  CodexKnowledgeStance,
  CodexRelationDocument,
  CodexMention,
  CodexProgressionChangeKind,
  CodexProgressionDocument,
  SceneDocument,
} from "@novel-studio/contracts";
import { api } from "./api";
import {
  codexPolicyLabels,
  contextExclusionLabels,
  knowledgeStanceLabels,
  progressionChangeLabels,
} from "./copy";

type DetailTab = "canon" | "research" | "details" | "relations" | "progressions" | "knowledge" | "mentions";

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
  const [progressions, setProgressions] = useState<CodexProgressionDocument[]>([]);
  const [knowledge, setKnowledge] = useState<CodexKnowledgeDocument[]>([]);
  const [mentions, setMentions] = useState<CodexMention[]>([]);
  const [context, setContext] = useState<CodexContextPreview | null>(null);
  const [effectiveState, setEffectiveState] = useState<CodexEffectiveState | null>(null);
  const [relationTarget, setRelationTarget] = useState("");
  const [relationType, setRelationType] = useState("关联");
  const [relationDirected, setRelationDirected] = useState(true);
  const [progressionField, setProgressionField] = useState("状态");
  const [progressionKind, setProgressionKind] = useState<CodexProgressionChangeKind>("addition");
  const [progressionSummary, setProgressionSummary] = useState("");
  const [viewerEntryId, setViewerEntryId] = useState(
    entry.metadata.categoryId === "character" ? entry.metadata.id : "",
  );
  const [knowledgeCharacterId, setKnowledgeCharacterId] = useState(
    entry.metadata.categoryId === "character" ? entry.metadata.id : "",
  );
  const [knowledgeStance, setKnowledgeStance] = useState<CodexKnowledgeStance>("knows");
  const [knowledgeSummary, setKnowledgeSummary] = useState("");
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
    setEffectiveState(null);
    setProgressionField("状态");
    setProgressionKind("addition");
    setProgressionSummary("");
    setViewerEntryId(entry.metadata.categoryId === "character" ? entry.metadata.id : "");
    setKnowledgeCharacterId(entry.metadata.categoryId === "character" ? entry.metadata.id : "");
    setKnowledgeStance("knows");
    setKnowledgeSummary("");
  }, [entry.metadata.id, entry.revision, entry.research.revision]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listCodexRelations(
        seriesId,
        { entryId: entry.metadata.id, includeArchived: true },
      ),
      api.listCodexProgressions(
        seriesId,
        { entryId: entry.metadata.id, includeArchived: true },
      ),
      api.listCodexKnowledge(
        seriesId,
        { includeArchived: true },
      ),
      api.listCodexMentionsForEntry(
        seriesId,
        entry.metadata.id,
      ),
    ]).then(([loadedRelations, loadedProgressions, loadedKnowledge, loadedMentions]) => {
      if (!cancelled) {
        setRelations(loadedRelations);
        setProgressions(loadedProgressions);
        setKnowledge(loadedKnowledge.filter((document) =>
          document.knowledge.subjectEntryId === entry.metadata.id ||
          document.knowledge.characterEntryId === entry.metadata.id ||
          loadedRelations.some((relation) => relation.relation.id === document.knowledge.relationId),
        ));
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
  const characterEntries = useMemo(
    () => entries.filter((item) => item.metadata.categoryId === "character" && !item.metadata.archivedAt),
    [entries],
  );

  useEffect(() => {
    let cancelled = false;
    if (!activeSceneId) {
      setEffectiveState(null);
      return () => { cancelled = true; };
    }
    api.getCodexEffectiveState(
      seriesId,
      activeSceneId,
      entry.metadata.id,
      viewerEntryId || undefined,
    ).then((state) => {
      if (!cancelled) setEffectiveState(state);
    }).catch((error: unknown) => {
      if (!cancelled) {
        setEffectiveState(null);
        setMessage(error instanceof Error ? error.message : "读取此刻有效状态失败");
      }
    });
    return () => { cancelled = true; };
  }, [seriesId, activeSceneId, entry.metadata.id, viewerEntryId, progressions.length, knowledge.length]);

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

  async function refreshProgressionsAndKnowledge() {
    const [loadedRelations, loadedProgressions, loadedKnowledge] = await Promise.all([
      api.listCodexRelations(seriesId, {
        entryId: entry.metadata.id,
        includeArchived: true,
      }),
      api.listCodexProgressions(seriesId, {
        entryId: entry.metadata.id,
        includeArchived: true,
      }),
      api.listCodexKnowledge(seriesId, { includeArchived: true }),
    ]);
    setRelations(loadedRelations);
    setProgressions(loadedProgressions);
    setKnowledge(loadedKnowledge.filter((document) =>
      document.knowledge.subjectEntryId === entry.metadata.id ||
      document.knowledge.characterEntryId === entry.metadata.id ||
      loadedRelations.some((relation) => relation.relation.id === document.knowledge.relationId),
    ));
    if (activeSceneId) {
      setEffectiveState(await api.getCodexEffectiveState(
        seriesId,
        activeSceneId,
        entry.metadata.id,
        viewerEntryId || undefined,
      ));
    }
  }

  async function createProgression() {
    const fromSceneId = activeSceneId ?? scenes[0]?.metadata.id;
    if (!fromSceneId || !progressionSummary.trim()) return;
    await run(async () => {
      await api.createCodexProgression(seriesId, {
        target: { kind: "entry", entryId: entry.metadata.id, relationId: null },
        fieldKey: progressionField.trim() || "状态",
        changeKind: progressionKind,
        summary: progressionSummary,
        effectiveFromSceneId: fromSceneId,
        evidence: [{
          sourceType: "scene",
          sourceId: fromSceneId,
          note: "作者手动记录的故事状态变化。",
        }],
      });
      setProgressionSummary("");
      await refreshProgressionsAndKnowledge();
    });
  }

  async function toggleProgression(document: CodexProgressionDocument) {
    await run(async () => {
      if (document.progression.archivedAt) {
        await api.restoreCodexProgression(seriesId, document.progression.id, {
          baseRevision: document.revision,
        });
      } else {
        await api.archiveCodexProgression(seriesId, document.progression.id, {
          baseRevision: document.revision,
        });
      }
      await refreshProgressionsAndKnowledge();
    });
  }

  async function createKnowledge() {
    const fromSceneId = activeSceneId ?? scenes[0]?.metadata.id;
    if (!fromSceneId || !knowledgeCharacterId || !knowledgeSummary.trim()) return;
    await run(async () => {
      await api.createCodexKnowledge(seriesId, {
        characterEntryId: knowledgeCharacterId,
        subjectEntryId: entry.metadata.id,
        relationId: null,
        stance: knowledgeStance,
        summary: knowledgeSummary,
        effectiveFromSceneId: fromSceneId,
        evidence: [{
          sourceType: "scene",
          sourceId: fromSceneId,
          note: "作者手动记录的角色所知。",
        }],
      });
      setKnowledgeSummary("");
      await refreshProgressionsAndKnowledge();
    });
  }

  async function toggleKnowledge(document: CodexKnowledgeDocument) {
    await run(async () => {
      if (document.knowledge.archivedAt) {
        await api.restoreCodexKnowledge(seriesId, document.knowledge.id, {
          baseRevision: document.revision,
        });
      } else {
        await api.archiveCodexKnowledge(seriesId, document.knowledge.id, {
          baseRevision: document.revision,
        });
      }
      await refreshProgressionsAndKnowledge();
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

      {activeSceneId && <section className="effective-state-panel">
        <div className="effective-state-header">
          <div>
            <strong>此刻有效</strong>
            <small>{scenes.find((scene) => scene.metadata.id === activeSceneId)?.metadata.title ?? "当前场景"}</small>
          </div>
          <label>观察角色<select value={viewerEntryId} onChange={(event) => setViewerEntryId(event.target.value)}>
            <option value="">只看世界事实</option>
            {characterEntries.map((item) => <option value={item.metadata.id} key={item.metadata.id}>{item.metadata.name}</option>)}
          </select></label>
        </div>
        {effectiveState ? <div className="effective-state-grid">
          <article>
            <span>世界事实</span>
            {effectiveState.worldFacts.length
              ? effectiveState.worldFacts.map((document) => <p key={document.progression.id}>{document.progression.summary}</p>)
              : <p>此刻没有额外进展记录。</p>}
          </article>
          <article>
            <span>关系变化</span>
            {effectiveState.relationStates.flatMap((state) => state.progressions).length
              ? effectiveState.relationStates.map((state) => state.progressions.map((document) => <p key={document.progression.id}>{entryNames[state.relation.relation.sourceEntryId] ?? "条目"} / {entryNames[state.relation.relation.targetEntryId] ?? "条目"}：{document.progression.summary}</p>))
              : <p>此刻没有关系进展。</p>}
          </article>
          <article>
            <span>角色所知</span>
            {effectiveState.characterKnowledge.length
              ? effectiveState.characterKnowledge.map((document) => <p key={document.knowledge.id}>{entryNames[document.knowledge.characterEntryId] ?? "角色"}{knowledgeStanceLabels[document.knowledge.stance]}：{document.knowledge.summary}</p>)
              : <p>{viewerEntryId ? "此刻没有这名角色的相关所知。" : "选择观察角色后显示主观所知。"}</p>}
          </article>
        </div> : <p className="empty-side">正在计算当前场景状态…</p>}
        {effectiveState && (effectiveState.hiddenFutureProgressionCount > 0 || effectiveState.hiddenFutureKnowledgeCount > 0) && <p className="future-hidden-note">
          后文还有 {effectiveState.hiddenFutureProgressionCount + effectiveState.hiddenFutureKnowledgeCount} 条变化尚未到达当前场景，内容已隐藏。
        </p>}
      </section>}

      <nav className="codex-tabs">
        {([
          ["canon", "已确认设定"],
          ["research", "参考笔记"],
          ["details", "识别规则"],
          ["relations", "关系"],
          ["progressions", "进展记录"],
          ["knowledge", "角色所知"],
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

      {tab === "progressions" && <div className="codex-tab-body">
        <p className="codex-safety-note">进展记录从指定场景起生效；它不会改写已确认设定正文，只会参与“此刻有效”的状态计算。</p>
        <div className="progression-create">
          <label>状态槽<input value={progressionField} onChange={(event) => setProgressionField(event.target.value)} placeholder="外貌、持有物、关系状态…" /></label>
          <label>变化方式<select value={progressionKind} onChange={(event) => setProgressionKind(event.target.value as CodexProgressionChangeKind)}>
            {Object.entries(progressionChangeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
          <label>从当前场景起发生什么<textarea value={progressionSummary} onChange={(event) => setProgressionSummary(event.target.value)} placeholder="例如：林岚失去旧钥匙。" /></label>
          <button disabled={!activeSceneId || !progressionSummary.trim() || busy} onClick={() => void createProgression()}>记录进展</button>
        </div>
        <div className="relation-list">
          {progressions.map((document) => <article className={document.progression.archivedAt ? "archived" : ""} key={document.progression.id}>
            <strong>{progressionChangeLabels[document.progression.changeKind]} · {document.progression.fieldKey}</strong>
            <span>{document.progression.summary}</span>
            <small>自 {scenes.find((scene) => scene.metadata.id === document.progression.effectiveFromSceneId)?.metadata.title ?? "未知场景"} 起生效 · {document.progression.evidence.length} 条证据</small>
            <button onClick={() => void toggleProgression(document)}>{document.progression.archivedAt ? "恢复" : "归档"}</button>
          </article>)}
          {!progressions.length && <p className="empty-side">尚无进展记录。人物状态、物件归属或关系变化都可以从这里追加历史。</p>}
        </div>
      </div>}

      {tab === "knowledge" && <div className="codex-tab-body">
        <p className="codex-safety-note">角色所知描述“某个角色此刻怎么理解这件事”。误解可以和世界事实并存，不会被系统自动纠正。</p>
        <div className="progression-create">
          <label>知道者<select value={knowledgeCharacterId} onChange={(event) => setKnowledgeCharacterId(event.target.value)}>
            <option value="">选择人物</option>
            {characterEntries.map((item) => <option value={item.metadata.id} key={item.metadata.id}>{item.metadata.name}</option>)}
          </select></label>
          <label>立场<select value={knowledgeStance} onChange={(event) => setKnowledgeStance(event.target.value as CodexKnowledgeStance)}>
            {Object.entries(knowledgeStanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
          <label>这个角色以为什么<textarea value={knowledgeSummary} onChange={(event) => setKnowledgeSummary(event.target.value)} placeholder="例如：林岚误以为周野已经背叛。" /></label>
          <button disabled={!activeSceneId || !knowledgeCharacterId || !knowledgeSummary.trim() || busy} onClick={() => void createKnowledge()}>记录所知</button>
        </div>
        <div className="relation-list">
          {knowledge.map((document) => <article className={document.knowledge.archivedAt ? "archived" : ""} key={document.knowledge.id}>
            <strong>{entryNames[document.knowledge.characterEntryId] ?? "角色"} · {knowledgeStanceLabels[document.knowledge.stance]}</strong>
            <span>{document.knowledge.summary}</span>
            <small>自 {scenes.find((scene) => scene.metadata.id === document.knowledge.effectiveFromSceneId)?.metadata.title ?? "未知场景"} 起生效 · 涉及 {document.knowledge.subjectEntryId ? (entryNames[document.knowledge.subjectEntryId] ?? "条目") : "关系"}</small>
            <button onClick={() => void toggleKnowledge(document)}>{document.knowledge.archivedAt ? "恢复" : "归档"}</button>
          </article>)}
          {!knowledge.length && <p className="empty-side">尚无角色所知。这里适合记录秘密、误会、错误判断和角色何时得知真相。</p>}
        </div>
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
