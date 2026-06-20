import { useEffect, useMemo, useState } from "react";
import type {
  CodexAiContextPolicy,
  CodexContextPreview,
  CodexEffectiveState,
  CodexEntryDocument,
  CodexKnowledgeDocument,
  CodexKnowledgeStance,
  CodexMention,
  CodexProgressionChangeKind,
  CodexProgressionDocument,
  CodexRelationDocument,
  SceneDocument,
} from "@novel-studio/contracts";
import { api } from "./api";
import {
  CodexEffectiveStatePanel,
  CodexKnowledgePanel,
  CodexMentionsPanel,
  CodexProgressionsPanel,
  CodexRelationsPanel,
} from "./CodexEntryPanels";
import {
  codexPolicyLabels,
  contextExclusionLabels,
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

export function EntryEditor({
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

      {activeSceneId && <CodexEffectiveStatePanel
        activeSceneId={activeSceneId}
        scenes={scenes}
        effectiveState={effectiveState}
        viewerEntryId={viewerEntryId}
        characterEntries={characterEntries}
        entryNames={entryNames}
        onViewerEntryChange={setViewerEntryId}
      />}

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

      {tab === "relations" && <CodexRelationsPanel
        entryId={entry.metadata.id}
        entries={entries}
        relations={relations}
        entryNames={entryNames}
        relationTarget={relationTarget}
        relationType={relationType}
        relationDirected={relationDirected}
        busy={busy}
        onRelationTargetChange={setRelationTarget}
        onRelationTypeChange={setRelationType}
        onRelationDirectedChange={setRelationDirected}
        onCreateRelation={createRelation}
        onToggleRelation={toggleRelation}
      />}

      {tab === "progressions" && <CodexProgressionsPanel
        activeSceneId={activeSceneId}
        scenes={scenes}
        progressions={progressions}
        progressionField={progressionField}
        progressionKind={progressionKind}
        progressionSummary={progressionSummary}
        busy={busy}
        onProgressionFieldChange={setProgressionField}
        onProgressionKindChange={setProgressionKind}
        onProgressionSummaryChange={setProgressionSummary}
        onCreateProgression={createProgression}
        onToggleProgression={toggleProgression}
      />}

      {tab === "knowledge" && <CodexKnowledgePanel
        activeSceneId={activeSceneId}
        characterEntries={characterEntries}
        scenes={scenes}
        knowledge={knowledge}
        entryNames={entryNames}
        knowledgeCharacterId={knowledgeCharacterId}
        knowledgeStance={knowledgeStance}
        knowledgeSummary={knowledgeSummary}
        busy={busy}
        onKnowledgeCharacterChange={setKnowledgeCharacterId}
        onKnowledgeStanceChange={setKnowledgeStance}
        onKnowledgeSummaryChange={setKnowledgeSummary}
        onCreateKnowledge={createKnowledge}
        onToggleKnowledge={toggleKnowledge}
      />}

      {tab === "mentions" && <CodexMentionsPanel mentions={mentions} scenes={scenes} />}

      {message && <div className="codex-message">{message}</div>}
    </section>
  );
}
