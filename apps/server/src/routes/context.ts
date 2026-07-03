import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  ContextBundleSchema,
  ContextPreviewInputSchema,
  type ActManifest,
  type ChapterManifest,
  type CodexEntryDocument,
  type ContextBundle,
  type ContextExclusion,
  type ContextItem,
  type ContextItemKind,
  type ContextSource,
  type ContextSourceType,
  type ModelProfile,
  type SceneBlock,
  type SceneDocument,
  type SceneSectionDocument,
  type SeriesDetail,
} from "@novel-studio/contracts";
import type { ProviderRegistry } from "@novel-studio/ai";
import { StorageError, type ProjectRepository } from "@novel-studio/storage";
import {
  ensureCredentialBoundary,
} from "../ai/policy.js";
import { ensureBuiltInPrompts } from "../prompts/builtIns.js";
import { PromptRenderError, renderPromptTemplate } from "../prompts/render.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTEXT_ITEM_CONTENT_LIMIT = 399000;

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function estimateTokens(value: string): number {
  return Math.ceil(Array.from(value).length / 2);
}

function contextItem(input: {
  kind: ContextItemKind;
  sourceType: ContextSourceType;
  sourceId?: string | null;
  sourceRevision?: string | null;
  sourceLabel?: string;
  title: string;
  content: string;
  inclusion?: "required" | "selected" | "derived";
  inclusionReason: string;
  contextPolicy?: ContextItem["contextPolicy"];
  manuallySelected?: boolean;
  sourceRefs?: ContextSource[];
}): ContextItem {
  return {
    id: `${input.kind}:${input.sourceId ?? randomUUID()}`,
    kind: input.kind,
    source: {
      type: input.sourceType,
      id: input.sourceId ?? null,
      revision: input.sourceRevision ?? null,
      label: input.sourceLabel ?? input.title,
    },
    title: input.title,
    content: input.content,
    inclusion: input.inclusion ?? "selected",
    inclusionReason: input.inclusionReason,
    contextPolicy: input.contextPolicy ?? null,
    tokenEstimate: estimateTokens(input.content),
    manuallySelected: input.manuallySelected ?? false,
    textHash: hashText(input.content),
    sourceRefs: input.sourceRefs ?? [],
  };
}

function exclusion(input: {
  sourceType: ContextSourceType;
  sourceId?: string | null;
  sourceRevision?: string | null;
  sourceLabel?: string;
  title: string;
  reason: ContextExclusion["reason"];
  note: string;
}): ContextExclusion {
  return {
    source: {
      type: input.sourceType,
      id: input.sourceId ?? null,
      revision: input.sourceRevision ?? null,
      label: input.sourceLabel ?? input.title,
    },
    reason: input.reason,
    title: input.title,
    note: input.note,
  };
}

function sceneBlockPlainText(block: SceneBlock): string {
  switch (block.kind) {
    case "paragraph":
    case "heading":
    case "quote":
      return block.text;
    case "sceneBreak":
    case "codexProgression":
      return "";
  }
}

function scenePlainTextUntilBlock(scene: SceneDocument, blockId: string | null): string {
  if (!blockId) return scene.plainText;
  const blockIndex = scene.document.blocks.findIndex((block) => block.id === blockId);
  if (blockIndex < 0) {
    throw new StorageError("Context preview references an unknown scene block", "INVALID_DATA", {
      sceneId: scene.metadata.id,
      blockId,
    });
  }
  return scene.document.blocks
    .slice(0, blockIndex + 1)
    .map((block) => sceneBlockPlainText(block))
    .filter((segment) => segment.trim().length > 0)
    .join("\n\n");
}

function sceneContextWithBody(scene: SceneDocument, body: string): string {
  const parts = [
    `场景标题：${scene.metadata.title}`,
    scene.metadata.goal ? `场景目标：${scene.metadata.goal}` : "",
    scene.metadata.conflict ? `冲突：${scene.metadata.conflict}` : "",
    scene.metadata.outcome ? `结果：${scene.metadata.outcome}` : "",
    scene.metadata.summary ? `作者摘要：${scene.metadata.summary}` : "",
    scene.metadata.beats.length ? `节拍：\n${scene.metadata.beats.map((beat, index) => `${index + 1}. ${beat}`).join("\n")}` : "",
    `Manuscript:\n${body}`,
  ].filter(Boolean);
  return parts.join("\n\n");
}

function selectedSceneContextContent(scene: SceneDocument): string {
  return boundedContextContent([
    sceneOutlineContent(scene),
    "",
    sceneManuscriptContent(scene),
  ].join("\n"));
}

function previousSceneSummary(scene: SceneDocument): string {
  if (scene.metadata.summary) return scene.metadata.summary;
  return scene.plainText.trim().slice(0, 300) || "Previous scene has no summary or manuscript text yet.";
}

function manualIdMatches(
  manualIds: Set<string>,
  kind: "section" | "codex" | "full-novel" | "full-outline" | "act" | "chapter" | "scene",
  id: string,
): boolean {
  return manualIds.has(id) || manualIds.has(`${kind}:${id}`);
}

function boundedContextContent(content: string): string {
  if (content.length <= CONTEXT_ITEM_CONTENT_LIMIT) return content;
  return `${content.slice(0, CONTEXT_ITEM_CONTENT_LIMIT)}\n\n[Context truncated to fit the maximum item size.]`;
}

function sortedByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order);
}

function scenesInChapter(series: SeriesDetail, chapterId: string): SceneDocument[] {
  return sortedByOrder(series.scenes
    .filter((scene) => scene.metadata.chapterId === chapterId)
    .map((scene) => ({ ...scene, order: scene.metadata.order })));
}

function chaptersInAct(series: SeriesDetail, actId: string): ChapterManifest[] {
  return sortedByOrder(series.chapters.filter((chapter) => chapter.actId === actId));
}

function actsInBook(series: SeriesDetail, bookId: string): ActManifest[] {
  return sortedByOrder(series.acts.filter((act) => act.bookId === bookId));
}

function scenesInSeriesOrder(series: SeriesDetail): SceneDocument[] {
  const ordered: SceneDocument[] = [];
  const seen = new Set<string>();
  for (const book of sortedByOrder(series.books)) {
    for (const act of actsInBook(series, book.id)) {
      for (const chapter of chaptersInAct(series, act.id)) {
        for (const scene of scenesInChapter(series, chapter.id)) {
          ordered.push(scene);
          seen.add(scene.metadata.id);
        }
      }
    }
  }
  ordered.push(...sortedByOrder(series.scenes
    .filter((scene) => !seen.has(scene.metadata.id))
    .map((scene) => ({ ...scene, order: scene.metadata.order }))));
  return ordered;
}

function sceneOutlineContent(scene: SceneDocument): string {
  return [
    `Scene: ${scene.metadata.title}`,
    `Status: ${scene.metadata.status}`,
    scene.metadata.summary ? `Summary: ${scene.metadata.summary}` : "",
    scene.metadata.goal ? `Goal: ${scene.metadata.goal}` : "",
    scene.metadata.conflict ? `Conflict: ${scene.metadata.conflict}` : "",
    scene.metadata.outcome ? `Outcome: ${scene.metadata.outcome}` : "",
    scene.metadata.beats.length ? `Beats:\n${scene.metadata.beats.map((beat, index) => `${index + 1}. ${beat}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

function sceneManuscriptContent(scene: SceneDocument): string {
  const body = scene.plainText.trim() || scene.content.trim() || "[No manuscript text.]";
  return `## ${scene.metadata.title}\n\n${body}`;
}

function fullNovelTextContent(series: SeriesDetail): string {
  return boundedContextContent([
    `Novel: ${series.manifest.title}`,
    series.manifest.description ? `Description: ${series.manifest.description}` : "",
    ...scenesInSeriesOrder(series).map(sceneManuscriptContent),
  ].filter(Boolean).join("\n\n"));
}

function fullOutlineContent(series: SeriesDetail): string {
  const lines = [
    `Novel outline: ${series.manifest.title}`,
    series.manifest.description ? `Description: ${series.manifest.description}` : "",
  ];
  for (const book of sortedByOrder(series.books)) {
    lines.push(`\nVolume: ${book.title}`);
    for (const act of actsInBook(series, book.id)) {
      lines.push(`  Act: ${act.title}`);
      for (const chapter of chaptersInAct(series, act.id)) {
        lines.push(`    Chapter: ${chapter.title}`);
        for (const scene of scenesInChapter(series, chapter.id)) {
          lines.push(`      ${sceneOutlineContent(scene).replace(/\n/gu, "\n      ")}`);
        }
      }
    }
  }
  return boundedContextContent(lines.filter(Boolean).join("\n"));
}

function chapterContextContent(series: SeriesDetail, chapter: ChapterManifest): string {
  const act = series.acts.find((item) => item.id === chapter.actId);
  return boundedContextContent([
    `Chapter: ${chapter.title}`,
    act ? `Act: ${act.title}` : "",
    ...scenesInChapter(series, chapter.id).map((scene) => [
      sceneOutlineContent(scene),
      "",
      sceneManuscriptContent(scene),
    ].join("\n")),
  ].filter(Boolean).join("\n\n"));
}

function actContextContent(series: SeriesDetail, act: ActManifest): string {
  const book = series.books.find((item) => item.id === act.bookId);
  return boundedContextContent([
    `Act: ${act.title}`,
    book ? `Volume: ${book.title}` : "",
    ...chaptersInAct(series, act.id).map((chapter) => chapterContextContent(series, chapter)),
  ].filter(Boolean).join("\n\n"));
}

function providerTokenEstimate(
  registry: ProviderRegistry,
  profile: ModelProfile | null,
  content: string,
): number {
  if (!profile) return estimateTokens(content);
  try {
    return registry.get(profile.provider).estimateTokens(content).inputTokens;
  } catch {
    return estimateTokens(content);
  }
}

function applyBudget(
  items: ContextItem[],
  excluded: ContextExclusion[],
  budget: number | null,
): { items: ContextItem[]; excluded: ContextExclusion[] } {
  if (!budget) return { items, excluded };
  const kept: ContextItem[] = [];
  const nextExcluded = [...excluded];
  let total = 0;
  for (const item of items) {
    const nextTotal = total + item.tokenEstimate;
    if (item.inclusion === "required" || nextTotal <= budget) {
      kept.push(item);
      total = nextTotal;
      continue;
    }
    nextExcluded.push(exclusion({
      sourceType: item.source.type,
      sourceId: item.source.id,
      sourceRevision: item.source.revision,
      sourceLabel: item.source.label,
      title: item.title,
      reason: "over-budget",
      note: `上下文预算为 ${budget} tokens，已优先保留角色、作者要求和当前场景。`,
    }));
  }
  return { items: kept, excluded: nextExcluded };
}

function detailAllowsContext(entry: CodexEntryDocument, key: string, label: string): boolean {
  return entry.metadata.detailAiContext[key] !== false && entry.metadata.detailAiContext[label] !== false;
}

async function codexEntryContextContent(
  repository: ProjectRepository,
  seriesId: string,
  entry: CodexEntryDocument,
): Promise<string> {
  const detailTypes = await repository.listCodexDetailTypes(seriesId, {
    categoryId: entry.metadata.categoryId,
  });
  const handledDetailKeys = new Set<string>();
  const detailLines: string[] = [];
  for (const document of detailTypes) {
    const detailType = document.detailType;
    handledDetailKeys.add(detailType.id);
    handledDetailKeys.add(detailType.name);
    const value = entry.metadata.details[detailType.id] ?? entry.metadata.details[detailType.name] ?? "";
    if (!value.trim() || !detailAllowsContext(entry, detailType.id, detailType.name)) continue;
    detailLines.push(`${detailType.name}: ${value}`);
  }
  for (const [key, value] of Object.entries(entry.metadata.details)) {
    if (handledDetailKeys.has(key) || !value.trim() || entry.metadata.detailAiContext[key] === false) continue;
    detailLines.push(`${key}: ${value}`);
  }
  return [
    `Name: ${entry.metadata.name}`,
    entry.description.trim() ? `Confirmed setting:\n${entry.description}` : "",
    detailLines.length ? `Details:\n${detailLines.join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

export async function buildContextBundle(
  repository: ProjectRepository,
  registry: ProviderRegistry,
  seriesId: string,
  rawInput: unknown,
): Promise<ContextBundle> {
  const input = ContextPreviewInputSchema.parse(rawInput);
  await ensureBuiltInPrompts(repository, seriesId);
  const [series, currentScene, modelProfile, promptTemplate] = await Promise.all([
    repository.getSeries(seriesId),
    input.sceneId ? repository.getScene(seriesId, input.sceneId) : Promise.resolve(null),
    input.modelProfileId ? repository.getModelProfile(input.modelProfileId) : Promise.resolve(null),
    repository.getPromptTemplate(seriesId, input.promptTemplateId, input.promptTemplateVersion),
  ]);

  if (modelProfile) {
    const blocked = ensureCredentialBoundary(modelProfile);
    if (blocked) {
      const error = new Error(blocked.message);
      error.name = "MODEL_CONTEXT_BLOCKED:403";
      throw error;
    }
  }

  const manualIds = new Set(input.manualContextIds);
  const items: ContextItem[] = [];
  const excluded: ContextExclusion[] = [];
  if (input.selection && !currentScene) {
    throw new StorageError("Context selection requires an explicit scene", "INVALID_DATA");
  }
  const selectionText = input.selection && currentScene
    ? input.selection.text || currentScene.content.slice(input.selection.start, input.selection.end)
    : "";

  const role = await repository.getAgentRole(seriesId, input.roleId);
  const hasSystemPromptOverride = input.systemPromptOverride !== null;
  const customSystemPrompt = input.systemPromptOverride?.trim() ?? "";
  const roleInstruction = hasSystemPromptOverride ? customSystemPrompt : [
    `角色：${role.title}`,
    role.description,
    role.persona ? `工作人格：${role.persona}` : "",
    role.duties.length ? `职责：\n${role.duties.map((duty) => `- ${duty}`).join("\n")}` : "",
    role.nonDuties.length ? `不负责：\n${role.nonDuties.map((item) => `- ${item}`).join("\n")}` : "",
    role.challengeObligation ? `反对义务：${role.challengeObligation}` : "",
    role.forbiddenActions.length ? `禁止行为：\n${role.forbiddenActions.map((item) => `- ${item}`).join("\n")}` : "",
    role.outputContract ? `输出约束：${role.outputContract}` : "",
  ].filter(Boolean).join("\n\n");
  const renderedPrompt = hasSystemPromptOverride
    ? null
    : renderPromptTemplate(promptTemplate, {
      user_request: input.userRequest,
      scene_title: currentScene?.metadata.title ?? "",
      selected_text: selectionText,
      context_summary: currentScene?.metadata.summary ?? "",
    });
  items.push(contextItem({
    kind: "role-instruction",
    sourceType: hasSystemPromptOverride ? "user-input" : "system",
    sourceId: input.roleId,
    title: hasSystemPromptOverride ? "General Chat system prompt" : "角色职责",
    content: roleInstruction,
    inclusion: "required",
    inclusionReason: hasSystemPromptOverride
      ? "The author supplied this custom General Chat system prompt."
      : "模型调用必须先说明角色职责和禁止行为。",
  }));

  if (renderedPrompt) {
    items.push(contextItem({
      kind: "prompt-template",
      sourceType: "prompt-template",
      sourceId: promptTemplate.id,
      sourceLabel: `${promptTemplate.name} v${promptTemplate.version}`,
      title: `提示词模板：${promptTemplate.name} v${promptTemplate.version}`,
      content: [
        `模板 ID：${renderedPrompt.promptTemplateId}`,
        `模板版本：${renderedPrompt.promptTemplateVersion}`,
        renderedPrompt.finalPrompt,
      ].join("\n\n"),
      inclusion: "required",
      inclusionReason: "用于审计本次上下文预览采用的提示词版本。",
    }));
  }

  items.push(contextItem({
    kind: "user-request",
    sourceType: "user-input",
    title: "作者当前要求",
    content: input.userRequest,
    inclusion: "required",
    inclusionReason: "作者本次提出的明确任务。",
  }));

  if (input.selection && currentScene) {
    items.push(contextItem({
      kind: "scene-selection",
      sourceType: "scene",
      sourceId: currentScene.metadata.id,
      sourceRevision: currentScene.revision,
      sourceLabel: currentScene.metadata.title,
      title: "当前正文选区",
      content: selectionText,
      inclusion: "required",
      inclusionReason: "作者主动选择的正文范围。",
    }));
  }

  if (currentScene) {
    items.push(contextItem({
      kind: "scene",
      sourceType: "scene",
      sourceId: currentScene.metadata.id,
      sourceRevision: currentScene.revision,
      sourceLabel: currentScene.metadata.title,
      title: "当前场景",
      content: sceneContextWithBody(currentScene, scenePlainTextUntilBlock(currentScene, input.blockId)),
      inclusion: "required",
      inclusionReason: "当前写作场景是本次任务的核心上下文。",
    }));

    const currentIndex = series.scenes.findIndex((scene) => scene.metadata.id === currentScene.metadata.id);
    if (currentIndex > 0) {
      const previous = series.scenes[currentIndex - 1]!;
      items.push(contextItem({
        kind: "adjacent-scene",
        sourceType: "scene",
        sourceId: previous.metadata.id,
        sourceRevision: previous.revision,
        sourceLabel: previous.metadata.title,
        title: "前一场景摘要",
        content: previousSceneSummary(previous),
        inclusion: "derived",
        inclusionReason: "用于理解当前场景之前的叙事状态。",
      }));
    }
    const next = series.scenes[currentIndex + 1];
    if (next) {
      excluded.push(exclusion({
        sourceType: "scene",
        sourceId: next.metadata.id,
        sourceRevision: next.revision,
        sourceLabel: next.metadata.title,
        title: "后一场景",
        reason: "future-information",
        note: "当前场景之后的正文和摘要默认不提供给模型。",
      }));
    }
  }

  const selectedScopeTexts: string[] = [];

  if (manualIdMatches(manualIds, "full-novel", series.manifest.id)) {
    const content = fullNovelTextContent(series);
    selectedScopeTexts.push(content);
    items.push(contextItem({
      kind: "full-novel",
      sourceType: "series",
      sourceId: series.manifest.id,
      sourceRevision: hashText(content),
      sourceLabel: series.manifest.title,
      title: "Full novel text",
      content,
      inclusion: "selected",
      inclusionReason: "The author selected the full novel text.",
      manuallySelected: true,
    }));
  }

  if (manualIdMatches(manualIds, "full-outline", series.manifest.id)) {
    const content = fullOutlineContent(series);
    selectedScopeTexts.push(content);
    items.push(contextItem({
      kind: "full-outline",
      sourceType: "series",
      sourceId: series.manifest.id,
      sourceRevision: hashText(content),
      sourceLabel: series.manifest.title,
      title: "Full outline",
      content,
      inclusion: "selected",
      inclusionReason: "The author selected the full outline.",
      manuallySelected: true,
    }));
  }

  for (const act of sortedByOrder(series.acts)) {
    if (!manualIdMatches(manualIds, "act", act.id)) continue;
    const content = actContextContent(series, act);
    selectedScopeTexts.push(content);
    items.push(contextItem({
      kind: "act",
      sourceType: "act",
      sourceId: act.id,
      sourceRevision: hashText(content),
      sourceLabel: act.title,
      title: `Act: ${act.title}`,
      content,
      inclusion: "selected",
      inclusionReason: "The author selected this act.",
      manuallySelected: true,
    }));
  }

  for (const chapter of sortedByOrder(series.chapters)) {
    if (!manualIdMatches(manualIds, "chapter", chapter.id)) continue;
    const content = chapterContextContent(series, chapter);
    selectedScopeTexts.push(content);
    items.push(contextItem({
      kind: "chapter",
      sourceType: "chapter",
      sourceId: chapter.id,
      sourceRevision: hashText(content),
      sourceLabel: chapter.title,
      title: `Chapter: ${chapter.title}`,
      content,
      inclusion: "selected",
      inclusionReason: "The author selected this chapter.",
      manuallySelected: true,
    }));
  }

  for (const scene of scenesInSeriesOrder(series)) {
    if (currentScene && scene.metadata.id === currentScene.metadata.id) continue;
    if (!manualIdMatches(manualIds, "scene", scene.metadata.id)) continue;
    const content = selectedSceneContextContent(scene);
    selectedScopeTexts.push(content);
    items.push(contextItem({
      kind: "scene",
      sourceType: "scene",
      sourceId: scene.metadata.id,
      sourceRevision: scene.revision,
      sourceLabel: scene.metadata.title,
      title: `Selected scene: ${scene.metadata.title}`,
      content,
      inclusion: "selected",
      inclusionReason: "The author selected this scene.",
      manuallySelected: true,
    }));
  }

  if (currentScene) {
    const sections = await repository.listSceneSections(seriesId, currentScene.metadata.id);
    for (const section of sections) {
      if (section.metadata.archivedAt) {
        excluded.push(sectionExclusion(section, "archived", "已归档附属文档不会进入上下文。"));
        continue;
      }
      const selected = manualIdMatches(manualIds, "section", section.metadata.id);
      if (section.metadata.aiPolicy === "never") {
        excluded.push(sectionExclusion(section, "hidden-section", "该附属文档被标记为禁止提供给模型，即使主动选择也会排除。"));
        continue;
      }
      if (!selected) {
        excluded.push(sectionExclusion(section, "not-selected", "附属文档默认不提供，需要作者主动选择。"));
        continue;
      }
      items.push(contextItem({
        kind: "scene-section",
        sourceType: "scene-section",
        sourceId: section.metadata.id,
        sourceRevision: section.revision,
        sourceLabel: section.metadata.title,
        title: `附属文档：${section.metadata.title}`,
        content: section.content,
        inclusion: "selected",
        inclusionReason: "作者主动选择的附属文档。",
        contextPolicy: section.metadata.aiPolicy,
        manuallySelected: true,
      }));
    }
  }

  const pinnedCodexIds = input.manualContextIds
    .filter((id) => id.startsWith("codex:"))
    .map((id) => id.slice("codex:".length))
    .filter((id) => UUID_PATTERN.test(id));
  if (currentScene) {
    const codexPreview = await repository.previewCodexContext(
      seriesId,
      currentScene.metadata.id,
      pinnedCodexIds,
      input.blockId,
    );
    for (const entry of codexPreview.included) {
      const selected = manualIdMatches(manualIds, "codex", entry.metadata.id);
      const effectiveEntry = await repository.getCodexEffectiveEntry(
        seriesId,
        entry.metadata.id,
        currentScene.metadata.id,
        input.blockId,
      );
      const projectedEntry = effectiveEntry.entry;
      const content = await codexEntryContextContent(repository, seriesId, projectedEntry);
      const fieldProgressionRefs = await Promise.all(
        [...new Set(effectiveEntry.fieldStates
          .map((state) => state.lastProgressionId)
          .filter((id): id is string => Boolean(id)))]
          .map(async (progressionId) => {
            const document = await repository.getCodexProgression(seriesId, progressionId);
            return {
              type: "codex-progression" as const,
              id: document.progression.id,
              revision: document.revision,
              label: document.progression.summary,
            };
          }),
      );
      const codexSourceRefs: ContextSource[] = [
        {
          type: "codex-entry",
          id: projectedEntry.metadata.id,
          revision: projectedEntry.revision,
          label: projectedEntry.metadata.name,
        },
        ...fieldProgressionRefs,
      ];
      items.push(contextItem({
        kind: "codex-entry",
        sourceType: "codex-entry",
        sourceId: projectedEntry.metadata.id,
        sourceRevision: hashText(JSON.stringify(codexSourceRefs) + content),
        sourceLabel: projectedEntry.metadata.name,
        title: `Codex entry: ${projectedEntry.metadata.name}`,
        content,
        inclusion: selected ? "selected" : "derived",
        inclusionReason: selected
          ? "The author selected this Codex entry."
          : "Included by model-readable scope and current scene mentions.",
        contextPolicy: projectedEntry.metadata.aiContextPolicy,
        manuallySelected: selected,
        sourceRefs: codexSourceRefs,
      }));
      if (effectiveEntry.hiddenFutureFieldProgressionCount > 0) {
        excluded.push(exclusion({
          sourceType: "codex-progression",
          sourceId: projectedEntry.metadata.id,
          sourceLabel: projectedEntry.metadata.name,
          title: `Future Codex fields: ${projectedEntry.metadata.name}`,
          reason: "future-information",
          note: `${effectiveEntry.hiddenFutureFieldProgressionCount} future field progression record(s) were hidden.`,
        }));
      }

      const viewerEntryId = UUID_PATTERN.test(currentScene.metadata.pov ?? "")
        ? currentScene.metadata.pov!
        : currentScene.metadata.characterIds[0] ?? undefined;
      const effective = await repository.getCodexEffectiveState(
        seriesId,
        currentScene.metadata.id,
        projectedEntry.metadata.id,
        viewerEntryId,
        input.blockId,
      );
      const effectiveLines = [
        ...effective.worldFacts.map((document) => `World fact: ${document.progression.summary}`),
        ...effective.relationStates.flatMap((state) =>
          state.progressions.map((document) =>
            `Relation change (${state.relation.relation.type}): ${document.progression.summary}`,
          ),
        ),
      ];
      if (effectiveLines.length) {
        const effectiveProgressions = [
          ...effective.worldFacts,
          ...effective.relationStates.flatMap((state) => state.progressions),
        ];
        const effectiveSourceRefs: ContextSource[] = effectiveProgressions.map((document) => ({
          type: "codex-progression",
          id: document.progression.id,
          revision: document.revision,
          label: document.progression.summary,
        }));
        const effectiveContent = effectiveLines.join("\n");
        items.push(contextItem({
          kind: "codex-effective-state",
          sourceType: "codex-entry",
          sourceId: projectedEntry.metadata.id,
          sourceRevision: hashText(JSON.stringify(effectiveSourceRefs) + effectiveContent),
          sourceLabel: projectedEntry.metadata.name,
          title: `Effective state: ${projectedEntry.metadata.name}`,
          content: effectiveContent,
          inclusion: "derived",
          inclusionReason: "Only story state effective at the current narrative scene is included.",
          sourceRefs: effectiveSourceRefs,
        }));
      }
      if (effective.characterKnowledge.length) {
        const knowledgeContent = effective.characterKnowledge.map((document) =>
          `${document.knowledge.stance}: ${document.knowledge.summary}`,
        ).join("\n");
        const knowledgeSourceRefs: ContextSource[] = effective.characterKnowledge.map((document) => ({
          type: "codex-knowledge",
          id: document.knowledge.id,
          revision: document.revision,
          label: document.knowledge.summary,
        }));
        items.push(contextItem({
          kind: "character-knowledge",
          sourceType: "codex-knowledge",
          sourceId: viewerEntryId ?? null,
          sourceRevision: hashText(JSON.stringify(knowledgeSourceRefs) + knowledgeContent),
          sourceLabel: "Character knowledge at this position",
          title: `Character knowledge: ${projectedEntry.metadata.name}`,
          content: knowledgeContent,
          inclusion: "derived",
          inclusionReason: "Only what the viewpoint character already knows, believes, or misunderstands is included.",
          sourceRefs: knowledgeSourceRefs,
        }));
      }
      if (effective.hiddenFutureProgressionCount > 0) {
        excluded.push(exclusion({
          sourceType: "codex-progression",
          sourceId: projectedEntry.metadata.id,
          sourceLabel: projectedEntry.metadata.name,
          title: `Future story state: ${projectedEntry.metadata.name}`,
          reason: "future-information",
          note: `${effective.hiddenFutureProgressionCount} future story state record(s) were hidden.`,
        }));
      }
      if (effective.hiddenFutureKnowledgeCount > 0) {
        excluded.push(exclusion({
          sourceType: "codex-knowledge",
          sourceId: projectedEntry.metadata.id,
          sourceLabel: projectedEntry.metadata.name,
          title: `Future character knowledge: ${projectedEntry.metadata.name}`,
          reason: "future-information",
          note: `${effective.hiddenFutureKnowledgeCount} future character knowledge record(s) were hidden.`,
        }));
      }
    }
    for (const item of codexPreview.excluded) {
      const reason = item.reason === "never"
        ? "context-policy-never"
        : item.reason === "manual-only"
          ? "not-selected"
          : item.reason;
      excluded.push(exclusion({
        sourceType: "codex-entry",
        sourceId: item.entryId,
        sourceLabel: item.name,
        title: `设定条目：${item.name}`,
        reason,
        note: item.reason === "never"
          ? "该设定条目标记为永不提供给模型，即使主动选择也会排除。"
          : "该设定条目未满足当前模型可读范围。",
      }));
    }
  } else {
    for (const entryId of [...new Set(pinnedCodexIds)]) {
      const entry = await repository.getCodexEntry(seriesId, entryId);
      if (entry.metadata.archivedAt) {
        excluded.push(exclusion({
          sourceType: "codex-entry",
          sourceId: entry.metadata.id,
          sourceRevision: entry.revision,
          sourceLabel: entry.metadata.name,
          title: `Codex entry: ${entry.metadata.name}`,
          reason: "archived",
          note: "Archived Codex entries are not sent to the model.",
        }));
        continue;
      }
      if (entry.metadata.aiContextPolicy === "never") {
        excluded.push(exclusion({
          sourceType: "codex-entry",
          sourceId: entry.metadata.id,
          sourceRevision: entry.revision,
          sourceLabel: entry.metadata.name,
          title: `Codex entry: ${entry.metadata.name}`,
          reason: "context-policy-never",
          note: "This Codex entry is marked never include, even when selected.",
        }));
        continue;
      }
      const content = await codexEntryContextContent(repository, seriesId, entry);
      items.push(contextItem({
        kind: "codex-entry",
        sourceType: "codex-entry",
        sourceId: entry.metadata.id,
        sourceRevision: hashText(entry.revision + content),
        sourceLabel: entry.metadata.name,
        title: `Codex entry: ${entry.metadata.name}`,
        content,
        inclusion: "selected",
        inclusionReason: "The author selected this Codex entry.",
        contextPolicy: entry.metadata.aiContextPolicy,
        manuallySelected: true,
        sourceRefs: [{
          type: "codex-entry",
          id: entry.metadata.id,
          revision: entry.revision,
          label: entry.metadata.name,
        }],
      }));
    }
  }

  for (const item of items) {
    item.tokenEstimate = modelProfile
      ? providerTokenEstimate(registry, modelProfile, item.content)
      : estimateTokens(item.content);
  }
  const budget = input.tokenBudget ?? modelProfile?.contextWindowTokens ?? null;
  const budgeted = applyBudget(items, excluded, budget);
  const totalInput = budgeted.items.reduce((sum, item) => sum + item.tokenEstimate, 0);
  const bundle = ContextBundleSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    seriesId,
    sceneId: currentScene?.metadata.id ?? null,
    roleId: input.roleId,
    taskKind: input.taskKind,
    userRequest: input.userRequest,
    promptTemplateId: input.promptTemplateId,
    promptTemplateVersion: input.promptTemplateVersion,
    items: budgeted.items,
    excluded: budgeted.excluded,
    estimatedUsage: {
      inputTokens: totalInput,
      outputTokens: 0,
      totalTokens: totalInput,
    },
    createdAt: new Date().toISOString(),
  });
  return repository.saveContextBundle(seriesId, bundle);
}

function sectionExclusion(
  section: SceneSectionDocument,
  reason: ContextExclusion["reason"],
  note: string,
): ContextExclusion {
  return exclusion({
    sourceType: "scene-section",
    sourceId: section.metadata.id,
    sourceRevision: section.revision,
    sourceLabel: section.metadata.title,
    title: `附属文档：${section.metadata.title}`,
    reason,
    note,
  });
}

export function registerContextRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
  options: { providerRegistry: ProviderRegistry },
): void {
  const { providerRegistry } = options;
  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/context/preview",
    async (request, reply) => {
      try {
        return await buildContextBundle(repository, providerRegistry, request.params.seriesId, request.body);
      } catch (error) {
        if (error instanceof Error && error.name.startsWith("MODEL_CONTEXT_BLOCKED:")) {
          const status = Number(error.name.split(":")[1] ?? 403);
          return reply.status(status).send({
            code: "PROVIDER_ERROR",
            message: error.message,
          });
        }
        if (error instanceof PromptRenderError) {
          return reply.status(error.code === "PROMPT_INPUT_MISSING" ? 400 : 422).send({
            code: error.code,
            message: error.message,
            details: error.details,
          });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { seriesId: string; contextBundleId: string } }>(
    "/api/v1/series/:seriesId/context/:contextBundleId",
    async (request) =>
      repository.getContextBundle(request.params.seriesId, request.params.contextBundleId),
  );
}
