import type {
  CodexEntryDocument,
  ProposalDocument,
  SceneDocument,
  SeriesDetail,
  WorkshopContextItemRef,
  WorkshopMessageAttachment,
  WorkshopSession,
} from "@novel-studio/contracts";
import { uiText, WORKSHOP_UI_LOCALE } from "../../app/uiText";

export type ComposerAttachment = Omit<WorkshopMessageAttachment, "parseStatus"> & {
  parseStatus: WorkshopMessageAttachment["parseStatus"] | "parsing";
};

const AUTO_SESSION_TITLE_MAX = 56;

export function formatWorkshopDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(WORKSHOP_UI_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function workshopExportFileName(session: WorkshopSession): string {
  const safeTitle = session.title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "-")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/[. -]+$/gu, "")
    .slice(0, 64);
  return `workshop-${safeTitle || "session"}-${session.id.slice(0, 8)}.md`;
}

export function proposalStatusClass(status: ProposalDocument["proposal"]["status"]): string {
  if (status === "pending") return "pill blue";
  if (status === "accepted" || status === "edited") return "pill green";
  if (status === "stale") return "pill amber";
  return "pill muted";
}

export function proposalTargetKindLabel(kind: ProposalDocument["proposal"]["target"]["kind"]): string {
  if (kind.startsWith("scene")) return uiText.workshop.targetKinds.manuscript;
  if (kind.startsWith("codex") || kind === "detail-type") return uiText.workshop.targetKinds.codex;
  if (kind === "planning") return uiText.workshop.targetKinds.planning;
  return uiText.workshop.targetKinds.research;
}

function pluralVariants(term: string): string[] {
  if (!/^[A-Za-z][A-Za-z'-]*$/u.test(term)) return [];
  if (/[^aeiou]y$/iu.test(term)) return [`${term.slice(0, -1)}ies`];
  if (/(?:s|x|z|ch|sh)$/iu.test(term)) return [`${term}es`];
  return [`${term}s`];
}

function regexRanges(content: string, term: string, caseSensitive: boolean) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const regex = new RegExp(escaped, caseSensitive ? "gu" : "giu");
  const ranges: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    regex.lastIndex = match.index + Math.max(match[0].length, 1);
  }
  return ranges;
}

function rangeInside(range: { start: number; end: number }, blockers: Array<{ start: number; end: number }>) {
  return blockers.some((blocker) => range.start >= blocker.start && range.end <= blocker.end);
}

export function codexEntryMentionedInText(entry: CodexEntryDocument, content: string): boolean {
  const rules = entry.metadata.mention;
  const excludedTerms = rules.excludedTerms.map((term) => term.trim()).filter(Boolean);
  const blockers = excludedTerms.flatMap((term) => regexRanges(content, term, rules.caseSensitive));
  const excludedKeys = new Set(excludedTerms.map((term) =>
    rules.caseSensitive ? term : term.toLocaleLowerCase("und"),
  ));
  const candidates = [
    entry.metadata.name,
    ...(rules.matchAliases ? entry.metadata.aliases : []),
  ].flatMap((term) => [
    term,
    ...(rules.automaticPlural ? pluralVariants(term) : []),
  ]);
  for (const candidate of candidates) {
    const term = candidate.trim();
    if (!term) continue;
    const normalized = rules.caseSensitive ? term : term.toLocaleLowerCase("und");
    if (excludedKeys.has(normalized)) continue;
    for (const range of regexRanges(content, term, rules.caseSensitive)) {
      if (!rangeInside(range, blockers)) return true;
    }
  }
  return false;
}

function sceneOutlineText(scene: SceneDocument): string {
  return [
    scene.metadata.title,
    scene.metadata.summary,
    scene.metadata.goal,
    scene.metadata.conflict,
    scene.metadata.outcome,
    scene.metadata.beats.join("\n"),
  ].filter(Boolean).join("\n");
}

function sceneScopeText(scene: SceneDocument): string {
  return [sceneOutlineText(scene), scene.plainText || scene.content].filter(Boolean).join("\n\n");
}

function byOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order);
}

function scenesForChapter(series: SeriesDetail, chapterId: string) {
  return byOrder(series.scenes
    .filter((scene) => scene.metadata.chapterId === chapterId)
    .map((scene) => ({ ...scene, order: scene.metadata.order })));
}

function chaptersForAct(series: SeriesDetail, actId: string) {
  return byOrder(series.chapters.filter((chapter) => chapter.actId === actId));
}

function scenesForAct(series: SeriesDetail, actId: string) {
  return chaptersForAct(series, actId).flatMap((chapter) => scenesForChapter(series, chapter.id));
}

function scenesForVolume(series: SeriesDetail, volumeId: string) {
  return byOrder(series.acts.filter((chapter) => chapter.bookId === volumeId))
    .flatMap((chapter) => scenesForAct(series, chapter.id));
}

function scenesInSeriesOrder(series: SeriesDetail) {
  const ordered: SceneDocument[] = [];
  const seen = new Set<string>();
  for (const book of byOrder(series.books)) {
    for (const act of byOrder(series.acts.filter((item) => item.bookId === book.id))) {
      for (const scene of scenesForAct(series, act.id)) {
        ordered.push(scene);
        seen.add(scene.metadata.id);
      }
    }
  }
  ordered.push(...byOrder(series.scenes
    .filter((scene) => !seen.has(scene.metadata.id))
    .map((scene) => ({ ...scene, order: scene.metadata.order }))));
  return ordered;
}

export function selectedScopeTexts(
  series: SeriesDetail,
  items: WorkshopContextItemRef[],
  hierarchy: "author-facing" | "legacy-storage-hierarchy" = "author-facing",
): string[] {
  const texts: string[] = [];
  const selectedSceneIds = new Set<string>();
  for (const item of items) {
    if (item.kind === "full-novel") {
      texts.push(scenesInSeriesOrder(series).map(sceneScopeText).join("\n\n"));
    }
    if (item.kind === "full-outline") {
      texts.push(scenesInSeriesOrder(series).map(sceneOutlineText).join("\n\n"));
    }
    if (item.kind === "volume" && item.sourceId) {
      texts.push(scenesForVolume(series, item.sourceId).map(sceneScopeText).join("\n\n"));
    }
    if (item.kind === "chapter" && item.sourceId) {
      const scenes = hierarchy === "legacy-storage-hierarchy"
        ? scenesForChapter(series, item.sourceId)
        : scenesForAct(series, item.sourceId);
      texts.push(scenes.map(sceneScopeText).join("\n\n"));
    }
    if (item.kind === "act" && item.sourceId) {
      const scenes = hierarchy === "legacy-storage-hierarchy"
        ? scenesForAct(series, item.sourceId)
        : scenesForChapter(series, item.sourceId);
      texts.push(scenes.map(sceneScopeText).join("\n\n"));
    }
    if (item.kind === "scene" && item.sourceId) selectedSceneIds.add(item.sourceId);
  }
  for (const sceneId of selectedSceneIds) {
    const scene = series.scenes.find((item) => item.metadata.id === sceneId);
    if (scene) texts.push(sceneScopeText(scene));
  }
  return texts.filter((value) => value.trim().length > 0);
}

export function titleFromChatStart(
  requestText: string,
  attachments: Array<{ fileName: string }>,
  attachmentOnlyRequest: string,
  defaultSessionTitle: string,
): string {
  const normalizedRequest = requestText.replace(/\s+/gu, " ").trim();
  const attachmentNames = attachments.map((attachment) => attachment.fileName.trim()).filter(Boolean).join(", ");
  const source = normalizedRequest && normalizedRequest !== attachmentOnlyRequest
    ? normalizedRequest
    : attachmentNames || normalizedRequest;
  if (!source) return defaultSessionTitle;
  return source.length > AUTO_SESSION_TITLE_MAX
    ? `${source.slice(0, AUTO_SESSION_TITLE_MAX - 3).trimEnd()}...`
    : source;
}

export function attachmentStatusLabel(
  status: ComposerAttachment["parseStatus"] | WorkshopMessageAttachment["parseStatus"],
  text: typeof uiText.workshop,
): string {
  if (status === "parsing") return text.labels.attachmentParsing;
  if (status === "parsed") return text.labels.attachmentReady;
  if (status === "rejected") return text.labels.attachmentRejected;
  return text.labels.attachmentFailed;
}

export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  return btoa(binary);
}
