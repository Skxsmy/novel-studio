import type {
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
import {
  knowledgeStanceLabels,
  progressionChangeLabels,
} from "./copy";

type EntryNames = Record<string, string>;

export function CodexEffectiveStatePanel({
  activeSceneId,
  scenes,
  effectiveState,
  viewerEntryId,
  characterEntries,
  entryNames,
  onViewerEntryChange,
}: {
  activeSceneId: string;
  scenes: SceneDocument[];
  effectiveState: CodexEffectiveState | null;
  viewerEntryId: string;
  characterEntries: CodexEntryDocument[];
  entryNames: EntryNames;
  onViewerEntryChange: (value: string) => void;
}) {
  return <section className="effective-state-panel">
    <div className="effective-state-header">
      <div>
        <strong>此刻有效</strong>
        <small>{scenes.find((scene) => scene.metadata.id === activeSceneId)?.metadata.title ?? "当前场景"}</small>
      </div>
      <label>观察角色<select value={viewerEntryId} onChange={(event) => onViewerEntryChange(event.target.value)}>
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
  </section>;
}

export function CodexRelationsPanel({
  entryId,
  entries,
  relations,
  entryNames,
  relationTarget,
  relationType,
  relationDirected,
  busy,
  onRelationTargetChange,
  onRelationTypeChange,
  onRelationDirectedChange,
  onCreateRelation,
  onToggleRelation,
}: {
  entryId: string;
  entries: CodexEntryDocument[];
  relations: CodexRelationDocument[];
  entryNames: EntryNames;
  relationTarget: string;
  relationType: string;
  relationDirected: boolean;
  busy: boolean;
  onRelationTargetChange: (value: string) => void;
  onRelationTypeChange: (value: string) => void;
  onRelationDirectedChange: (value: boolean) => void;
  onCreateRelation: () => Promise<void>;
  onToggleRelation: (relation: CodexRelationDocument) => Promise<void>;
}) {
  return <div className="codex-tab-body progression-tab-body">
    <div className="relation-create">
      <select value={relationTarget} onChange={(event) => onRelationTargetChange(event.target.value)}>
        <option value="">选择关系目标</option>
        {entries.filter((item) => item.metadata.id !== entryId && !item.metadata.archivedAt).map((item) => <option value={item.metadata.id} key={item.metadata.id}>{item.metadata.name}</option>)}
      </select>
      <input value={relationType} onChange={(event) => onRelationTypeChange(event.target.value)} placeholder="关系类型" />
      <label><input type="checkbox" checked={relationDirected} onChange={(event) => onRelationDirectedChange(event.target.checked)} /> 区分方向</label>
      <button disabled={!relationTarget || busy} onClick={() => void onCreateRelation()}>添加关系</button>
    </div>
    <div className="relation-list">
      {relations.map((relation) => {
        const outgoing = relation.relation.sourceEntryId === entryId;
        const otherId = outgoing ? relation.relation.targetEntryId : relation.relation.sourceEntryId;
        const arrow = relation.relation.directed ? (outgoing ? "→" : "←") : "↔";
        return <article className={relation.relation.archivedAt ? "archived" : ""} key={relation.relation.id}>
          <strong>{arrow} {entryNames[otherId] ?? otherId.slice(0, 8)}</strong>
          <span>{relation.relation.type}</span>
          <small>{relation.relation.directed ? "只表示这个方向" : "不区分方向；两端看到同一条关系"}</small>
          <button onClick={() => void onToggleRelation(relation)}>{relation.relation.archivedAt ? "恢复" : "归档"}</button>
        </article>;
      })}
      {!relations.length && <p className="empty-side">尚无关系。A→B 不会被系统自动解释为 B→A。</p>}
    </div>
    <p className="milestone-notice">关系随剧情发生变化时，会在后续的“进展记录”里追加历史；本页不会覆盖旧状态。</p>
  </div>;
}

export function CodexProgressionsPanel({
  activeSceneId,
  scenes,
  progressions,
  progressionField,
  progressionKind,
  progressionSummary,
  busy,
  onProgressionFieldChange,
  onProgressionKindChange,
  onProgressionSummaryChange,
  onCreateProgression,
  onToggleProgression,
}: {
  activeSceneId: string | null;
  scenes: SceneDocument[];
  progressions: CodexProgressionDocument[];
  progressionField: string;
  progressionKind: CodexProgressionChangeKind;
  progressionSummary: string;
  busy: boolean;
  onProgressionFieldChange: (value: string) => void;
  onProgressionKindChange: (value: CodexProgressionChangeKind) => void;
  onProgressionSummaryChange: (value: string) => void;
  onCreateProgression: () => Promise<void>;
  onToggleProgression: (document: CodexProgressionDocument) => Promise<void>;
}) {
  return <div className="codex-tab-body progression-tab-body knowledge-tab-body">
    <p className="codex-safety-note">进展记录从指定场景起生效；它不会改写已确认设定正文，只会参与“此刻有效”的状态计算。</p>
    <div className="progression-create">
      <label>状态槽<input value={progressionField} onChange={(event) => onProgressionFieldChange(event.target.value)} placeholder="外貌、持有物、关系状态…" /></label>
      <label>变化方式<select value={progressionKind} onChange={(event) => onProgressionKindChange(event.target.value as CodexProgressionChangeKind)}>
        {Object.entries(progressionChangeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>
      <label>从当前场景起发生什么<textarea value={progressionSummary} onChange={(event) => onProgressionSummaryChange(event.target.value)} placeholder="例如：林岚失去旧钥匙。" /></label>
      <button disabled={!activeSceneId || !progressionSummary.trim() || busy} onClick={() => void onCreateProgression()}>记录进展</button>
    </div>
    <div className="relation-list">
      {progressions.map((document) => <article className={document.progression.archivedAt ? "archived" : ""} key={document.progression.id}>
        <strong>{progressionChangeLabels[document.progression.changeKind]} · {document.progression.fieldKey}</strong>
        <span>{document.progression.summary}</span>
        <small>自 {scenes.find((scene) => scene.metadata.id === document.progression.effectiveFromSceneId)?.metadata.title ?? "未知场景"} 起生效 · {document.progression.evidence.length} 条证据</small>
        <button onClick={() => void onToggleProgression(document)}>{document.progression.archivedAt ? "恢复" : "归档"}</button>
      </article>)}
      {!progressions.length && <p className="empty-side">尚无进展记录。人物状态、物件归属或关系变化都可以从这里追加历史。</p>}
    </div>
  </div>;
}

export function CodexKnowledgePanel({
  activeSceneId,
  characterEntries,
  scenes,
  knowledge,
  entryNames,
  knowledgeCharacterId,
  knowledgeStance,
  knowledgeSummary,
  busy,
  onKnowledgeCharacterChange,
  onKnowledgeStanceChange,
  onKnowledgeSummaryChange,
  onCreateKnowledge,
  onToggleKnowledge,
}: {
  activeSceneId: string | null;
  characterEntries: CodexEntryDocument[];
  scenes: SceneDocument[];
  knowledge: CodexKnowledgeDocument[];
  entryNames: EntryNames;
  knowledgeCharacterId: string;
  knowledgeStance: CodexKnowledgeStance;
  knowledgeSummary: string;
  busy: boolean;
  onKnowledgeCharacterChange: (value: string) => void;
  onKnowledgeStanceChange: (value: CodexKnowledgeStance) => void;
  onKnowledgeSummaryChange: (value: string) => void;
  onCreateKnowledge: () => Promise<void>;
  onToggleKnowledge: (document: CodexKnowledgeDocument) => Promise<void>;
}) {
  return <div className="codex-tab-body">
    <p className="codex-safety-note">角色所知描述“某个角色此刻怎么理解这件事”。误解可以和世界事实并存，不会被系统自动纠正。</p>
    <div className="progression-create">
      <label>知道者<select value={knowledgeCharacterId} onChange={(event) => onKnowledgeCharacterChange(event.target.value)}>
        <option value="">选择人物</option>
        {characterEntries.map((item) => <option value={item.metadata.id} key={item.metadata.id}>{item.metadata.name}</option>)}
      </select></label>
      <label>立场<select value={knowledgeStance} onChange={(event) => onKnowledgeStanceChange(event.target.value as CodexKnowledgeStance)}>
        {Object.entries(knowledgeStanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>
      <label>这个角色以为什么<textarea value={knowledgeSummary} onChange={(event) => onKnowledgeSummaryChange(event.target.value)} placeholder="例如：林岚误以为周野已经背叛。" /></label>
      <button disabled={!activeSceneId || !knowledgeCharacterId || !knowledgeSummary.trim() || busy} onClick={() => void onCreateKnowledge()}>记录所知</button>
    </div>
    <div className="relation-list">
      {knowledge.map((document) => <article className={document.knowledge.archivedAt ? "archived" : ""} key={document.knowledge.id}>
        <strong>{entryNames[document.knowledge.characterEntryId] ?? "角色"} · {knowledgeStanceLabels[document.knowledge.stance]}</strong>
        <span>{document.knowledge.summary}</span>
        <small>自 {scenes.find((scene) => scene.metadata.id === document.knowledge.effectiveFromSceneId)?.metadata.title ?? "未知场景"} 起生效 · 涉及 {document.knowledge.subjectEntryId ? (entryNames[document.knowledge.subjectEntryId] ?? "条目") : "关系"}</small>
        <button onClick={() => void onToggleKnowledge(document)}>{document.knowledge.archivedAt ? "恢复" : "归档"}</button>
      </article>)}
      {!knowledge.length && <p className="empty-side">尚无角色所知。这里适合记录秘密、误会、错误判断和角色何时得知真相。</p>}
    </div>
  </div>;
}

export function CodexMentionsPanel({
  mentions,
  scenes,
}: {
  mentions: CodexMention[];
  scenes: SceneDocument[];
}) {
  return <div className="codex-tab-body">
    <p className="codex-safety-note">正文提及只表示名称出现过，不等于人物参与场景，也不等于设定已经成立。</p>
    {mentions.map((mention) => <article className="mention-row" key={`${mention.sceneId}-${mention.start}`}>
      <strong>{scenes.find((scene) => scene.metadata.id === mention.sceneId)?.metadata.title ?? mention.sceneId.slice(0, 8)}</strong>
      <span>“{mention.matchedText}”</span>
      <small>{mention.isAlias ? "别名" : "名称"} · 字符 {mention.start}–{mention.end}</small>
    </article>)}
    {!mentions.length && <p className="empty-side">当前没有明确提及。同名歧义会先留空，避免系统替你猜。</p>}
  </div>;
}
