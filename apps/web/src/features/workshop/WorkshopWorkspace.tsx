import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  CodexCategoryDocument,
  CodexDetailTypeDocument,
  CodexEntryDocument,
  ModelProfile,
  ProviderModelDescriptor,
  ProposalDocument,
  PromptTemplate,
  SceneDocument,
  SeriesDetail,
  WorkshopContextBasket,
  WorkshopContextItemRef,
  WorkshopCallStreamEvent,
  WorkshopMessageAttachment,
  WorkshopMessage,
  WorkshopMode,
  WorkshopSession,
} from "@novel-studio/contracts";
import { ApiError, api } from "../../api";
import { uiText } from "../../app/uiText";
import { categoryLabel } from "../codex/codexViewModel";
import "./workshop-workspace.css";

export interface WorkshopWorkspaceProps {
  onOpenProposal: (proposalId: string) => void;
  selectedMessageId: string | null;
  selectedScene: SceneDocument | null;
  selectedSessionId: string | null;
  series: SeriesDetail;
}

type ContextMenuView =
  | { kind: "root" }
  | { kind: "acts" }
  | { kind: "chapters" }
  | { kind: "scenes" }
  | { kind: "codexEntries" }
  | { kind: "entryTypes" }
  | { kind: "entryTypeEntries"; categoryId: string; label: string }
  | { kind: "entryDetails" }
  | { kind: "entryDetailEntries"; detailTypeId: string; label: string }
  | { kind: "entryCategories" }
  | { kind: "entryCategoryEntries"; categoryId: string; label: string };

type ComposerAttachment = Omit<WorkshopMessageAttachment, "parseStatus"> & {
  parseStatus: WorkshopMessageAttachment["parseStatus"] | "parsing";
};

const LINKED_CODEX_NOTE = "Linked from selected context.";

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const payload = error.payload as { message?: unknown } | string;
    if (typeof payload === "object" && typeof payload.message === "string") return payload.message;
    if (typeof payload === "string") return payload;
  }
  return error instanceof Error ? error.message : "Request failed";
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function statusClass(status: ProposalDocument["proposal"]["status"]) {
  if (status === "pending") return "pill blue";
  if (status === "accepted" || status === "edited") return "pill green";
  if (status === "stale") return "pill amber";
  return "pill muted";
}

function targetKindLabel(kind: ProposalDocument["proposal"]["target"]["kind"]) {
  if (kind.startsWith("scene")) return "Manuscript";
  if (kind.startsWith("codex") || kind === "detail-type") return "Codex";
  if (kind === "planning") return "Planning";
  return "Research";
}

function newestTemplateForRole(templates: PromptTemplate[], roleId: string): PromptTemplate | null {
  const candidates = templates
    .filter((template) => template.roleId === roleId && template.archivedAt === null)
    .sort((left, right) => right.version - left.version);
  return candidates.find((template) => template.status === "active") ?? candidates[0] ?? null;
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

function codexEntryMentionedInText(entry: CodexEntryDocument, content: string): boolean {
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
  return [
    sceneOutlineText(scene),
    scene.plainText || scene.content,
  ].filter(Boolean).join("\n\n");
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

function selectedScopeTexts(
  series: SeriesDetail,
  items: WorkshopContextItemRef[],
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
    if (item.kind === "act" && item.sourceId) {
      texts.push(scenesForAct(series, item.sourceId).map(sceneScopeText).join("\n\n"));
    }
    if (item.kind === "chapter" && item.sourceId) {
      texts.push(scenesForChapter(series, item.sourceId).map(sceneScopeText).join("\n\n"));
    }
    if (item.kind === "scene" && item.sourceId) {
      selectedSceneIds.add(item.sourceId);
    }
  }
  for (const sceneId of selectedSceneIds) {
    const scene = series.scenes.find((item) => item.metadata.id === sceneId);
    if (scene) texts.push(sceneScopeText(scene));
  }
  return texts.filter((value) => value.trim().length > 0);
}

function attachmentStatusLabel(
  status: ComposerAttachment["parseStatus"] | WorkshopMessageAttachment["parseStatus"],
  text: typeof uiText.workshop,
): string {
  if (status === "parsing") return text.labels.attachmentParsing;
  if (status === "parsed") return text.labels.attachmentReady;
  if (status === "rejected") return text.labels.attachmentRejected;
  return text.labels.attachmentFailed;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  return btoa(binary);
}

export function WorkshopWorkspace({
  onOpenProposal,
  selectedMessageId,
  selectedSessionId,
  series,
}: WorkshopWorkspaceProps) {
  const text = uiText.workshop;
  const seriesId = series.manifest.id;
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkshopMessage[]>([]);
  const [attachments, setAttachments] = useState<WorkshopMessageAttachment[]>([]);
  const [draftAttachments, setDraftAttachments] = useState<ComposerAttachment[]>([]);
  const [draftToken, setDraftToken] = useState(() => randomId());
  const [proposalDocuments, setProposalDocuments] = useState<ProposalDocument[]>([]);
  const [codexCategories, setCodexCategories] = useState<CodexCategoryDocument[]>([]);
  const [codexDetailTypes, setCodexDetailTypes] = useState<CodexDetailTypeDocument[]>([]);
  const [codexEntries, setCodexEntries] = useState<CodexEntryDocument[]>([]);
  const [basket, setBasket] = useState<WorkshopContextBasket | null>(null);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuView, setContextMenuView] = useState<ContextMenuView>({ kind: "root" });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([]);
  const [selectedModelProfileId, setSelectedModelProfileId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [providerModels, setProviderModels] = useState<ProviderModelDescriptor[]>([]);
  const [providerModelsProfileId, setProviderModelsProfileId] = useState<string | null>(null);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [workshopMode, setWorkshopMode] = useState<WorkshopMode>("general-chat");
  const [generalSystemPrompt, setGeneralSystemPrompt] = useState<string>(text.defaultGeneralSystemPrompt);
  const [composer, setComposer] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isFetchingProviderModels, setIsFetchingProviderModels] = useState(false);
  const [creatingProposalMessageId, setCreatingProposalMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [reasoningOverrideIds, setReasoningOverrideIds] = useState<Set<string>>(() => new Set());
  const [useStreamingResponses, setUseStreamingResponses] = useState(true);
  const [showReasoningByDefault, setShowReasoningByDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachmentInputId = useMemo(() => `workshop-attachment-${randomId()}`, []);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const callAbortRef = useRef<AbortController | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const proposalMap = useMemo(
    () => new Map(proposalDocuments.map((document) => [document.proposal.id, document])),
    [proposalDocuments],
  );
  const attachmentMap = useMemo(
    () => new Map(attachments.map((attachment) => [attachment.id, attachment])),
    [attachments],
  );
  const activeModelProfiles = useMemo(
    () => modelProfiles.filter((profile) => profile.archivedAt === null),
    [modelProfiles],
  );
  const selectedModelProfile = useMemo(
    () =>
      activeModelProfiles.find((profile) => profile.id === selectedModelProfileId) ??
      activeModelProfiles[0] ??
      null,
    [activeModelProfiles, selectedModelProfileId],
  );
  const modelOptions = useMemo(() => {
    const options = new Map<string, string>();
    if (selectedModelProfile) {
      options.set(selectedModelProfile.model, selectedModelProfile.model);
    }
    if (providerModelsProfileId === selectedModelProfile?.id) {
      for (const model of providerModels) {
        options.set(model.id, model.title || model.id);
      }
    }
    if (selectedModelId) {
      options.set(selectedModelId, options.get(selectedModelId) ?? selectedModelId);
    }
    return Array.from(options, ([value, label]) => ({ value, label }));
  }, [providerModels, providerModelsProfileId, selectedModelId, selectedModelProfile]);
  const continuityPromptTemplate = useMemo(
    () =>
      newestTemplateForRole(promptTemplates, "continuity-editor") ??
      promptTemplates.find((template) => template.archivedAt === null) ??
      null,
    [promptTemplates],
  );
  const generalPromptTemplate = useMemo(
    () =>
      newestTemplateForRole(promptTemplates, "lead-writing-partner") ??
      promptTemplates.find((template) => template.archivedAt === null) ??
      null,
    [promptTemplates],
  );
  const selectedPromptTemplate = workshopMode === "general-chat"
    ? generalPromptTemplate
    : continuityPromptTemplate;
  const contextItems = basket?.items ?? [];
  const contextScene = useMemo(() => {
    if (basket?.sceneId) {
      return series.scenes.find((scene) => scene.metadata.id === basket.sceneId) ?? null;
    }
    const selectedSceneIds = contextItems
      .filter((item) => item.kind === "scene" && item.sourceId)
      .map((item) => item.sourceId!);
    const uniqueSceneIds = [...new Set(selectedSceneIds)];
    if (uniqueSceneIds.length !== 1) return null;
    return series.scenes.find((scene) => scene.metadata.id === uniqueSceneIds[0]) ?? null;
  }, [basket?.sceneId, contextItems, series.scenes]);
  const activeCodexEntries = useMemo(
    () => codexEntries.filter((entry) => !entry.metadata.archivedAt),
    [codexEntries],
  );
  const activeCodexCategories = useMemo(
    () => codexCategories.filter((document) => !document.category.archivedAt),
    [codexCategories],
  );
  const activeCodexDetailTypes = useMemo(
    () => codexDetailTypes.filter((document) => {
      const category = activeCodexCategories.find((item) => item.category.id === document.detailType.categoryId);
      return Boolean(category);
    }),
    [activeCodexCategories, codexDetailTypes],
  );
  const categoryGroups = useMemo(
    () => activeCodexCategories
      .map((document) => ({
        categoryId: document.category.id,
        count: activeCodexEntries.filter((entry) => entry.metadata.categoryId === document.category.id).length,
        label: categoryLabel(document.category.id, activeCodexCategories),
      }))
      .filter((group) => group.count > 0),
    [activeCodexCategories, activeCodexEntries],
  );
  const detailTypeGroups = useMemo(
    () => activeCodexDetailTypes
      .map((document) => {
        const { id, name } = document.detailType;
        const entries = activeCodexEntries.filter((entry) =>
          Object.prototype.hasOwnProperty.call(entry.metadata.details, id) ||
          Object.prototype.hasOwnProperty.call(entry.metadata.details, name),
        );
        return {
          count: entries.length,
          detailTypeId: id,
          label: name,
        };
      })
      .filter((group) => group.count > 0),
    [activeCodexDetailTypes, activeCodexEntries],
  );
  const contextChips = useMemo(() => {
    const chips: string[] = [];
    const hasCurrentScene = Boolean(basket?.sceneId);
    const hasFullNovel = contextItems.some((item) => item.kind === "full-novel");
    const hasFullOutline = contextItems.some((item) => item.kind === "full-outline");
    const actCount = contextItems.filter((item) => item.kind === "act").length;
    const chapterCount = contextItems.filter((item) => item.kind === "chapter").length;
    const sceneCount = contextItems.filter((item) => item.kind === "scene").length;
    const codexCount = contextItems.filter((item) => item.kind === "codex-entry").length;
    const proposalCount = contextItems.filter((item) => item.kind === "proposal-source").length;
    const otherCount = contextItems.filter((item) =>
      item.kind !== "full-novel" &&
      item.kind !== "full-outline" &&
      item.kind !== "act" &&
      item.kind !== "chapter" &&
      item.kind !== "scene" &&
      item.kind !== "codex-entry" &&
      item.kind !== "proposal-source",
    ).length;
    if (hasFullNovel) chips.push(text.labels.fullNovelChip);
    if (hasFullOutline) chips.push(text.labels.fullOutlineChip);
    if (actCount > 0) chips.push(`${actCount} ${text.labels.actChipPlural}`);
    if (chapterCount > 0) chips.push(`${chapterCount} ${text.labels.chapterChipPlural}`);
    if (hasCurrentScene) chips.push(text.labels.currentSceneChip);
    if (sceneCount > 0) chips.push(`${sceneCount} ${text.labels.sceneChipPlural}`);
    if (codexCount > 0) {
      chips.push(codexCount === 1 ? text.labels.relevantCodexChip : `${codexCount} ${text.labels.codexChipPlural}`);
    }
    if (proposalCount > 0) chips.push(`${proposalCount} ${text.labels.proposalChipPlural}`);
    if (otherCount > 0) chips.push(`${otherCount} ${text.labels.contextChipPlural}`);
    return chips;
  }, [
    basket?.sceneId,
    contextItems,
    text.labels.actChipPlural,
    text.labels.chapterChipPlural,
    text.labels.codexChipPlural,
    text.labels.contextChipPlural,
    text.labels.currentSceneChip,
    text.labels.fullNovelChip,
    text.labels.fullOutlineChip,
    text.labels.proposalChipPlural,
    text.labels.relevantCodexChip,
    text.labels.sceneChipPlural,
  ]);
  const hasSelectedContext = Boolean(
    basket?.sceneId ||
    basket?.blockId ||
    basket?.selection ||
    contextItems.length > 0,
  );
  const hasBlockedDraftAttachment = draftAttachments.some((attachment) => attachment.parseStatus !== "parsed");
  const hasComposerText = composer.trim().length > 0;
  const hasParsedDraftAttachment = draftAttachments.some((attachment) => attachment.parseStatus === "parsed");
  const canCall = Boolean(
    activeSession &&
    activeSession.status === "active" &&
    selectedPromptTemplate &&
    selectedModelProfile &&
    selectedModelId &&
    (hasComposerText || hasParsedDraftAttachment) &&
    !hasBlockedDraftAttachment &&
    !isCalling,
  );
  const selectedModelLabel =
    modelOptions.find((option) => option.value === selectedModelId)?.label ??
    selectedModelProfile?.model ??
    text.labels.modelProfileMissing;

  function updateSessionFromMessage(message: WorkshopMessage) {
    setSessions((current) => current.map((session) => (
      session.id === message.sessionId
        ? {
          ...session,
          lastMessageAt: message.createdAt,
          updatedAt: message.createdAt,
        }
        : session
    )));
  }

  function replaceMessageByIdentity(
    current: WorkshopMessage[],
    localId: string,
    message: WorkshopMessage,
  ): WorkshopMessage[] {
    const targetIds = new Set([localId, message.id]);
    const firstIndex = current.findIndex((item) => targetIds.has(item.id));
    if (firstIndex < 0) return [...current, message];
    const next = current.filter((item) => !targetIds.has(item.id));
    next.splice(firstIndex, 0, message);
    return next;
  }

  function patchMessage(
    current: WorkshopMessage[],
    messageId: string,
    patch: Partial<WorkshopMessage>,
  ): WorkshopMessage[] {
    return current.map((message) => (
      message.id === messageId ? { ...message, ...patch } : message
    ));
  }

  function applyCallResult(
    result: { authorMessage: WorkshopMessage; assistantMessage: WorkshopMessage },
    localAuthorId = result.authorMessage.id,
    localAssistantId = result.assistantMessage.id,
  ) {
    setMessages((current) => {
      const withAuthor = replaceMessageByIdentity(current, localAuthorId, result.authorMessage);
      return replaceMessageByIdentity(withAuthor, localAssistantId, result.assistantMessage);
    });
    bindAttachmentsToMessage(result.authorMessage);
    updateSessionFromMessage(result.assistantMessage);
  }

  function bindAttachmentsToMessage(message: WorkshopMessage) {
    const boundIds = new Set(message.attachmentIds ?? []);
    if (boundIds.size === 0) return;
    setAttachments((current) => current.map((attachment) => (
      boundIds.has(attachment.id) ? { ...attachment, messageId: message.id } : attachment
    )));
  }

  async function loadShell(preferredSessionId?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const [nextSessions, nextProfiles, nextTemplates] = await Promise.all([
        api.workshop.listSessions(seriesId),
        api.ai.listModelProfiles(),
        api.ai.listPromptTemplates(seriesId),
      ]);
      const nextActiveProfiles = nextProfiles.filter((profile) => profile.archivedAt === null);
      const nextProfile =
        nextActiveProfiles.find((profile) => profile.id === selectedModelProfileId) ??
        nextActiveProfiles[0] ??
        null;
      setSessions(nextSessions);
      setModelProfiles(nextProfiles);
      setSelectedModelProfileId(nextProfile?.id ?? null);
      setSelectedModelId((current) => (
        nextProfile && nextProfile.id === selectedModelProfileId
          ? (current || nextProfile.model)
          : nextProfile?.model ?? ""
      ));
      setPromptTemplates(nextTemplates);
      const nextActive =
        preferredSessionId ??
        (activeSessionId && nextSessions.some((session) => session.id === activeSessionId)
          ? activeSessionId
          : nextSessions.find((session) => session.status === "active")?.id ?? nextSessions[0]?.id ?? null);
      setActiveSessionId(nextActive);
      setIsSettingsOpen(false);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }

  function selectModelProfile(profileId: string) {
    const profile = activeModelProfiles.find((item) => item.id === profileId) ?? null;
    setSelectedModelProfileId(profile?.id ?? null);
    setSelectedModelId(profile?.model ?? "");
    setProviderModels([]);
    setProviderModelsProfileId(null);
  }

  async function fetchProviderModels() {
    if (!selectedModelProfile) return;
    setIsFetchingProviderModels(true);
    setError(null);
    try {
      const models = await api.ai.listProviderModels(selectedModelProfile.id);
      setProviderModels(models);
      setProviderModelsProfileId(selectedModelProfile.id);
      setSelectedModelId((current) => current || selectedModelProfile.model);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setIsFetchingProviderModels(false);
    }
  }

  async function loadSession(sessionId: string) {
    setIsDetailLoading(true);
    setError(null);
    try {
      const [detail, inbox, nextCodexCategories, nextCodexDetailTypes, nextCodexEntries] = await Promise.all([
        api.workshop.getSession(seriesId, sessionId),
        api.proposals.list(seriesId),
        api.codex.listCategories(seriesId),
        api.codex.listDetailTypes(seriesId),
        api.codex.listEntries(seriesId, { includeArchived: false }),
      ]);
      setBasket(detail.basket);
      setMessages(detail.messages);
      setAttachments(detail.attachments ?? []);
      setDraftAttachments([]);
      setDraftToken(randomId());
      setProposalDocuments(inbox.items);
      setCodexCategories(nextCodexCategories);
      setCodexDetailTypes(nextCodexDetailTypes);
      setCodexEntries(nextCodexEntries);
      setIsContextMenuOpen(false);
      setContextMenuView({ kind: "root" });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadShell(selectedSessionId ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  useEffect(() => {
    if (selectedSessionId && selectedSessionId !== activeSessionId) {
      setActiveSessionId(selectedSessionId);
    }
  }, [activeSessionId, selectedSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      setBasket(null);
      setMessages([]);
      setIsContextMenuOpen(false);
      return;
    }
    void loadSession(activeSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, seriesId]);

  async function createSession() {
    setError(null);
    try {
      const created = await api.workshop.createSession(seriesId, {
        title: text.defaultSessionTitle,
        sceneId: null,
      });
      await loadShell(created.id);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function archiveSession() {
    if (!activeSession) return;
    setError(null);
    try {
      const updated = activeSession.status === "archived"
        ? await api.workshop.restoreSession(seriesId, activeSession.id)
        : await api.workshop.archiveSession(seriesId, activeSession.id);
      await loadShell(updated.id);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function branchFromLastMessage() {
    if (!activeSession || messages.length === 0) return;
    const source = messages[messages.length - 1]!;
    setError(null);
    try {
      const result = await api.workshop.branchSession(seriesId, activeSession.id, {
        sourceMessageId: source.id,
        title: `${activeSession.title} branch`,
      });
      await loadShell(result.session.id);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function updateBasket(input: Partial<WorkshopContextBasket>) {
    if (!activeSession || !basket) return;
    const updated = await api.workshop.updateContextBasket(seriesId, activeSession.id, input);
    setBasket(updated);
  }

  function linkedCodexEntriesForItems(items: WorkshopContextItemRef[]) {
    const texts = selectedScopeTexts(series, items);
    if (texts.length === 0) return [];
    const combined = texts.join("\n\n");
    return activeCodexEntries.filter((entry) => (
      entry.metadata.aiContextPolicy === "always" ||
      (entry.metadata.aiContextPolicy === "on-mention" && codexEntryMentionedInText(entry, combined))
    ));
  }

  function materializeLinkedCodexItems(items: WorkshopContextItemRef[]) {
    const linkedEntries = linkedCodexEntriesForItems(items);
    const linkedIds = new Set(linkedEntries.map((entry) => entry.metadata.id));
    const sourceItems = items.filter((item) =>
      !(item.kind === "codex-entry" && item.note === LINKED_CODEX_NOTE && !linkedIds.has(item.sourceId ?? "")),
    );
    const existingCodexIds = new Set(sourceItems
      .filter((item) => item.kind === "codex-entry" && item.sourceId)
      .map((item) => item.sourceId!));
    const now = new Date().toISOString();
    return [
      ...sourceItems,
      ...linkedEntries
        .filter((entry) => !existingCodexIds.has(entry.metadata.id))
        .map((entry) => ({
          id: randomId(),
          kind: "codex-entry" as const,
          sourceId: entry.metadata.id,
          label: entry.metadata.name,
          pinned: true,
          note: LINKED_CODEX_NOTE,
          createdAt: now,
        })),
    ];
  }

  async function toggleSceneContext(scene: SceneDocument) {
    await toggleContextItem("scene", scene.metadata.id, scene.metadata.title);
  }

  async function addCodexEntryContext(entry: CodexEntryDocument) {
    if (!activeSession || !basket) return;
    setError(null);
    const existing = basket.items.some((item) =>
      item.kind === "codex-entry" && item.sourceId === entry.metadata.id,
    );
    const nextItems = existing
      ? basket.items
      : [
        ...basket.items,
        {
          id: randomId(),
          kind: "codex-entry" as const,
          sourceId: entry.metadata.id,
          label: entry.metadata.name,
          pinned: true,
          note: "",
          createdAt: new Date().toISOString(),
        },
      ];
    try {
      await updateBasket({ items: materializeLinkedCodexItems(nextItems) });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function toggleContextItem(kind: WorkshopContextItemRef["kind"], sourceId: string, label: string) {
    if (!activeSession || !basket) return;
    setError(null);
    const existing = basket.items.find((item) => item.kind === kind && item.sourceId === sourceId);
    const nextItems = existing
      ? basket.items.filter((item) => item.id !== existing.id)
      : [
        ...basket.items,
        {
          id: randomId(),
          kind,
          sourceId,
          label,
          pinned: true,
          note: "",
          createdAt: new Date().toISOString(),
        },
      ];
    try {
      await updateBasket({ items: materializeLinkedCodexItems(nextItems) });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function toggleCodexEntryContext(entry: CodexEntryDocument) {
    if (!activeSession || !basket) return;
    setError(null);
    const existing = basket.items.find((item) =>
      item.kind === "codex-entry" && item.sourceId === entry.metadata.id,
    );
    if (!existing) {
      await addCodexEntryContext(entry);
      return;
    }
    try {
      await updateBasket({ items: materializeLinkedCodexItems(basket.items.filter((item) => item.id !== existing.id)) });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function clearBasket() {
    if (!basket) return;
    try {
      await updateBasket({
        blockId: null,
        items: [],
        sceneId: null,
        selection: null,
      });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function clearContextFromMenu() {
    await clearBasket();
  }

  function isContextItemSelected(kind: WorkshopContextItemRef["kind"], sourceId: string) {
    return contextItems.some((item) => item.kind === kind && item.sourceId === sourceId);
  }

  function isSceneContextSelected(sceneId: string) {
    return isContextItemSelected("scene", sceneId);
  }

  function toggleContextMenu() {
    setIsContextMenuOpen((current) => {
      const next = !current;
      if (next) setContextMenuView({ kind: "root" });
      return next;
    });
  }

  function previewPayload(userRequest = composer.trim() || text.labels.defaultRequest) {
    if (!selectedPromptTemplate) throw new Error(text.labels.noPrompt);
    const isGeneralChat = workshopMode === "general-chat";
    return {
      mode: workshopMode,
      userRequest,
      roleId: selectedPromptTemplate.roleId,
      taskKind: isGeneralChat ? "analysis" as const : "continuity-check" as const,
      promptTemplateId: selectedPromptTemplate.id,
      promptTemplateVersion: selectedPromptTemplate.version,
      systemPrompt: isGeneralChat ? generalSystemPrompt.trim() : "",
      modelProfileId: selectedModelProfile?.id ?? null,
      modelOverride:
        selectedModelProfile && selectedModelId && selectedModelId !== selectedModelProfile.model
          ? selectedModelId
          : null,
    };
  }

  async function uploadComposerFile(file: File) {
    if (!activeSession) return;
    const localId = randomId();
    const mediaType = file.type || "application/octet-stream";
    const pending: ComposerAttachment = {
      schemaVersion: 1,
      id: localId,
      seriesId,
      sessionId: activeSession.id,
      messageId: null,
      draftToken,
      fileName: file.name,
      mediaType,
      sizeBytes: file.size,
      textHash: null,
      extractedText: "",
      parseStatus: "parsing",
      parseWarnings: [],
      parseError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDraftAttachments((current) => [...current, pending]);
    setError(null);
    try {
      const uploaded = await api.workshop.uploadAttachment(seriesId, activeSession.id, {
        draftToken,
        fileName: file.name,
        mediaType,
        sizeBytes: file.size,
        base64Content: await fileToBase64(file),
      });
      setDraftAttachments((current) => current.map((attachment) =>
        attachment.id === localId ? uploaded : attachment,
      ));
      setAttachments((current) => [
        ...current.filter((attachment) => attachment.id !== uploaded.id),
        uploaded,
      ]);
    } catch (caught) {
      const message = apiErrorMessage(caught);
      setDraftAttachments((current) => current.map((attachment) =>
        attachment.id === localId
          ? {
            ...attachment,
            parseStatus: "failed",
            parseError: message,
            updatedAt: new Date().toISOString(),
          }
          : attachment,
      ));
      setError(message);
    }
  }

  function handleAttachmentInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    for (const file of files) {
      void uploadComposerFile(file);
    }
  }

  async function removeDraftAttachment(attachment: ComposerAttachment) {
    setDraftAttachments((current) => current.filter((item) => item.id !== attachment.id));
    if (attachment.parseStatus === "parsing" || !attachmentMap.has(attachment.id)) return;
    try {
      await api.workshop.deleteAttachment(seriesId, attachment.sessionId, attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  function isAbortError(caught: unknown): boolean {
    return caught instanceof DOMException && caught.name === "AbortError";
  }

  function stopSending() {
    callAbortRef.current?.abort();
  }

  async function sendMessage() {
    if (!activeSession || !selectedModelProfile || !selectedPromptTemplate || isCalling) return;
    const parsedDraftAttachments = draftAttachments.filter((attachment) => attachment.parseStatus === "parsed");
    if (parsedDraftAttachments.length !== draftAttachments.length) return;
    if (!composer.trim() && parsedDraftAttachments.length === 0) return;
    const sentAttachmentIds = parsedDraftAttachments.map((attachment) => attachment.id);
    const sentDraftToken = sentAttachmentIds.length ? draftToken : null;
    const requestText = composer.trim() || text.labels.attachmentOnlyRequest;
    const abortController = new AbortController();
    callAbortRef.current = abortController;
    const payload = {
      ...previewPayload(requestText),
      modelProfileId: selectedModelProfile.id,
      draftToken: sentDraftToken,
      attachmentIds: sentAttachmentIds,
    };
    const now = new Date().toISOString();
    const localAuthorMessage: WorkshopMessage = {
      schemaVersion: 1,
      id: randomId(),
      seriesId,
      sessionId: activeSession.id,
      role: "author",
      mode: payload.mode,
      status: "succeeded",
      content: requestText,
      reasoningContent: "",
      contextBundleId: null,
      modelCallId: null,
      proposalIds: [],
      attachmentIds: sentAttachmentIds,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
    };
    setIsCalling(true);
    setError(null);
    setMessages((current) => [...current, localAuthorMessage]);
    setComposer("");
    setDraftAttachments([]);
    setDraftToken(randomId());
    setIsContextMenuOpen(false);
    setIsSettingsOpen(false);
    try {
      if (payload.mode === "general-chat" && useStreamingResponses) {
        const localAssistantId = randomId();
        let assistantMessageId = localAssistantId;
        const localAssistantMessage: WorkshopMessage = {
          schemaVersion: 1,
          id: localAssistantId,
          seriesId,
          sessionId: activeSession.id,
          role: "assistant",
          mode: payload.mode,
          status: "pending",
          content: "",
          reasoningContent: "",
          contextBundleId: null,
          modelCallId: null,
          proposalIds: [],
          attachmentIds: [],
          errorCode: null,
          errorMessage: null,
          createdAt: now,
        };
        setMessages((current) => [...current, localAssistantMessage]);
        await api.workshop.runCallStream(
          seriesId,
          activeSession.id,
          payload,
          (event: WorkshopCallStreamEvent) => {
            if (event.type === "author-message") {
              setMessages((current) => replaceMessageByIdentity(current, localAuthorMessage.id, event.message));
              bindAttachmentsToMessage(event.message);
              return;
            }
            if (event.type === "metadata") {
              setMessages((current) => patchMessage(current, assistantMessageId, {
                contextBundleId: event.contextBundleId,
                modelCallId: event.modelCallId,
              }));
              return;
            }
            if (event.type === "delta") {
              setMessages((current) => current.map((message) => (
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${event.text}` }
                  : message
              )));
              return;
            }
            if (event.type === "reasoning-delta") {
              setMessages((current) => current.map((message) => (
                message.id === assistantMessageId
                  ? { ...message, reasoningContent: `${message.reasoningContent ?? ""}${event.text}` }
                  : message
              )));
              return;
            }
            if (event.type === "assistant-message") {
              setMessages((current) => replaceMessageByIdentity(current, assistantMessageId, event.message));
              assistantMessageId = event.message.id;
              updateSessionFromMessage(event.message);
              return;
            }
            if (event.type === "error") {
              setError(event.message);
              if (event.assistantMessage) {
                setMessages((current) => replaceMessageByIdentity(current, assistantMessageId, event.assistantMessage!));
                assistantMessageId = event.assistantMessage.id;
                updateSessionFromMessage(event.assistantMessage);
              }
              return;
            }
            if (event.type === "done") {
              applyCallResult(event.result, localAuthorMessage.id, localAssistantId);
            }
          },
          abortController.signal,
        );
        return;
      }
      const result = await api.workshop.runCall(seriesId, activeSession.id, payload, abortController.signal);
      applyCallResult(result, localAuthorMessage.id);
    } catch (caught) {
      if (isAbortError(caught)) {
        setError(null);
        setMessages((current) => {
          const stopped = {
            schemaVersion: 1 as const,
            id: randomId(),
            seriesId,
            sessionId: activeSession.id,
            role: "assistant" as const,
            mode: payload.mode,
            status: "failed" as const,
            content: "",
            reasoningContent: "",
            contextBundleId: null,
            modelCallId: null,
            proposalIds: [],
            attachmentIds: [],
            errorCode: "WORKSHOP_CALL_ABORTED",
            errorMessage: text.labels.sendingStopped,
            createdAt: new Date().toISOString(),
          };
          const pendingIndex = current.findIndex((message) =>
            message.role === "assistant" &&
            message.status === "pending" &&
            message.sessionId === activeSession.id,
          );
          if (pendingIndex < 0) return [...current, stopped];
          return current.map((message, index) => index === pendingIndex ? stopped : message);
        });
        return;
      }
      const message = apiErrorMessage(caught);
      setError(message);
      setMessages((current) => [
        ...current,
        {
          schemaVersion: 1,
          id: randomId(),
          seriesId,
          sessionId: activeSession.id,
          role: "assistant",
          mode: payload.mode,
          status: "failed",
          content: text.labels.assistantFailed,
          reasoningContent: "",
          contextBundleId: null,
          modelCallId: null,
          proposalIds: [],
          attachmentIds: [],
          errorCode: "WORKSHOP_CALL_FAILED",
          errorMessage: message,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsCalling(false);
      if (callAbortRef.current === abortController) {
        callAbortRef.current = null;
      }
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    if (event.ctrlKey) return;
    if ((event.nativeEvent as { isComposing?: boolean }).isComposing) return;
    event.preventDefault();
    if (canCall) void sendMessage();
  }

  function proposalInputFromMessage(message: WorkshopMessage) {
    const targetScene = contextScene;
    if (!targetScene) throw new Error(text.labels.noScene);
    const candidateText = message.content.trim();
    const target = {
      kind: "scene-content" as const,
      targetId: targetScene.metadata.id,
      label: targetScene.metadata.title,
      baseRevision: targetScene.revision,
      fieldPath: [],
      blockId: null,
      range: null,
    };
    const title = candidateText.split(/\n/u).find((line) => line.trim())?.trim().slice(0, 120) ||
      text.proposals.defaultTitle;
    const summary = candidateText.length > 220 ? `${candidateText.slice(0, 217)}...` : candidateText;
    return {
      type: "text-insertion" as const,
      title,
      summary,
      target,
      riskLevel: "medium" as const,
      confidence: null,
      reason: text.proposals.defaultReason,
      patches: [{
        id: randomId(),
        target,
        action: "insert-text" as const,
        before: null,
        after: candidateText,
        unifiedDiff: `+${candidateText.slice(0, 399999)}`,
      }],
      evidence: [{
        sourceType: "workshop-message" as const,
        sourceId: message.id,
        revision: null,
        quote: "",
        note: text.proposals.evidenceNote,
      }],
    };
  }

  async function createProposalFromMessage(message: WorkshopMessage) {
    if (!activeSession) return;
    setCreatingProposalMessageId(message.id);
    setError(null);
    try {
      const result = await api.workshop.createMessageProposal(
        seriesId,
        activeSession.id,
        message.id,
        proposalInputFromMessage(message),
      );
      setMessages((current) => current.map((item) => item.id === result.message.id ? result.message : item));
      setProposalDocuments((current) => [
        result.proposal,
        ...current.filter((item) => item.proposal.id !== result.proposal.proposal.id),
      ]);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setCreatingProposalMessageId(null);
    }
  }

  async function deleteMessage(message: WorkshopMessage) {
    if (!activeSession) return;
    setDeletingMessageId(message.id);
    setError(null);
    try {
      const result = await api.workshop.deleteMessage(seriesId, activeSession.id, message.id);
      setMessages((current) => current.filter((item) => item.id !== result.deletedId));
      setAttachments((current) => current.filter((attachment) =>
        !result.deletedAttachmentIds.includes(attachment.id),
      ));
      setSessions((current) => current.map((session) => (
        session.id === result.session.id ? result.session : session
      )));
      setReasoningOverrideIds((current) => {
        const next = new Set(current);
        next.delete(result.deletedId);
        return next;
      });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setDeletingMessageId(null);
    }
  }

  function toggleReasoning(messageId: string) {
    setReasoningOverrideIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }

  function setShowReasoningDefault(nextValue: boolean) {
    setShowReasoningByDefault(nextValue);
    setReasoningOverrideIds(new Set());
  }

  function entriesForCategory(categoryId: string) {
    return activeCodexEntries.filter((entry) => entry.metadata.categoryId === categoryId);
  }

  function entriesForDetailType(detailTypeId: string) {
    const detailType = activeCodexDetailTypes.find((document) => document.detailType.id === detailTypeId)?.detailType;
    if (!detailType) return [];
    return activeCodexEntries.filter((entry) =>
      Object.prototype.hasOwnProperty.call(entry.metadata.details, detailType.id) ||
      Object.prototype.hasOwnProperty.call(entry.metadata.details, detailType.name),
    );
  }

  function renderMenuBack(title: string) {
    return (
      <button
        className="workshop-menu-header"
        onClick={() => setContextMenuView({ kind: "root" })}
        type="button"
      >
        <span aria-hidden="true">&lt;</span>
        <strong>{title}</strong>
      </button>
    );
  }

  function renderMenuBranch(
    label: string,
    onClick: () => void,
    options: { body?: string; count?: number; disabled?: boolean } = {},
  ) {
    return (
      <button
        className="workshop-menu-item"
        disabled={options.disabled}
        onClick={onClick}
        role="menuitem"
        type="button"
      >
        <span>
          <strong>{label}</strong>
          {options.body ? <small>{options.body}</small> : null}
        </span>
        <span aria-hidden="true">{options.count === undefined ? ">" : `${options.count} >`}</span>
      </button>
    );
  }

  function renderMenuToggle(
    label: string,
    isSelected: boolean,
    onClick: () => void,
    options: { body?: string } = {},
  ) {
    return (
      <button
        className="workshop-menu-item"
        onClick={onClick}
        role="menuitem"
        type="button"
      >
        <span>
          <strong>{label}</strong>
          {options.body ? <small>{options.body}</small> : null}
        </span>
        <span className={isSelected ? "pill green" : "pill muted"}>
          {isSelected ? text.labels.inContext : text.insert}
        </span>
      </button>
    );
  }

  function renderActRows() {
    if (series.acts.length === 0) {
      return <p className="workshop-menu-empty">{text.labels.noContextSources}</p>;
    }
    return (
      <div className="workshop-menu-list">
        {[...series.acts].sort((left, right) => left.order - right.order).map((act) => {
          const book = series.books.find((item) => item.id === act.bookId);
          const isSelected = isContextItemSelected("act", act.id);
          return (
            <button
              className="workshop-menu-entry"
              key={act.id}
              onClick={() => void toggleContextItem("act", act.id, act.title)}
              role="menuitem"
              type="button"
            >
              <span className="workshop-menu-entry-copy">
                <strong>{act.title}</strong>
                <small>{book?.title ?? text.contextMenu.acts}</small>
              </span>
              <span className={isSelected ? "pill green" : "pill muted"}>
                {isSelected ? text.labels.inContext : text.insert}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderChapterRows() {
    if (series.chapters.length === 0) {
      return <p className="workshop-menu-empty">{text.labels.noContextSources}</p>;
    }
    return (
      <div className="workshop-menu-list">
        {[...series.chapters].sort((left, right) => left.order - right.order).map((chapter) => {
          const act = series.acts.find((item) => item.id === chapter.actId);
          const isSelected = isContextItemSelected("chapter", chapter.id);
          return (
            <button
              className="workshop-menu-entry"
              key={chapter.id}
              onClick={() => void toggleContextItem("chapter", chapter.id, chapter.title)}
              role="menuitem"
              type="button"
            >
              <span className="workshop-menu-entry-copy">
                <strong>{chapter.title}</strong>
                <small>{act?.title ?? text.contextMenu.chapters}</small>
              </span>
              <span className={isSelected ? "pill green" : "pill muted"}>
                {isSelected ? text.labels.inContext : text.insert}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderSceneRows() {
    if (series.scenes.length === 0) {
      return <p className="workshop-menu-empty">{text.labels.noScene}</p>;
    }
    return (
      <div className="workshop-menu-list">
        {series.scenes.map((scene) => {
          const isSelected = isSceneContextSelected(scene.metadata.id);
          return (
            <button
              className="workshop-menu-entry"
              key={scene.metadata.id}
              onClick={() => void toggleSceneContext(scene)}
              role="menuitem"
              type="button"
            >
              <span className="workshop-menu-entry-copy">
                <strong>{scene.metadata.title}</strong>
                <small>{scene.metadata.status}</small>
              </span>
              <span className={isSelected ? "pill green" : "pill muted"}>
                {isSelected ? text.labels.inContext : text.insert}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderCodexEntryRows(entries: CodexEntryDocument[]) {
    if (entries.length === 0) {
      return <p className="workshop-menu-empty">{text.labels.noContextSources}</p>;
    }
    return (
      <div className="workshop-menu-list">
        {entries.map((entry) => {
          const isSelected = isContextItemSelected("codex-entry", entry.metadata.id);
          return (
            <button
              className="workshop-menu-entry"
              key={entry.metadata.id}
              onClick={() => void toggleCodexEntryContext(entry)}
              role="menuitem"
              type="button"
            >
              <span className="workshop-menu-entry-copy">
                <strong>{entry.metadata.name}</strong>
                <small>{categoryLabel(entry.metadata.categoryId, activeCodexCategories)}</small>
              </span>
              <span className={isSelected ? "pill green" : "pill muted"}>
                {isSelected ? text.labels.inContext : text.insert}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderContextMenuContent() {
    if (contextMenuView.kind === "acts") {
      return (
        <>
          {renderMenuBack(text.contextMenu.acts)}
          {renderActRows()}
        </>
      );
    }
    if (contextMenuView.kind === "chapters") {
      return (
        <>
          {renderMenuBack(text.contextMenu.chapters)}
          {renderChapterRows()}
        </>
      );
    }
    if (contextMenuView.kind === "scenes") {
      return (
        <>
          {renderMenuBack(text.contextMenu.scenes)}
          {renderSceneRows()}
        </>
      );
    }
    if (contextMenuView.kind === "codexEntries") {
      return (
        <>
          {renderMenuBack(text.contextMenu.codexEntries)}
          {renderCodexEntryRows(activeCodexEntries)}
        </>
      );
    }
    if (contextMenuView.kind === "entryTypes") {
      return (
        <>
          {renderMenuBack(text.contextMenu.entriesByType)}
          <div className="workshop-menu-list">
            {categoryGroups.map((group) => renderMenuBranch(
              group.label,
              () => setContextMenuView({ kind: "entryTypeEntries", categoryId: group.categoryId, label: group.label }),
              { count: group.count },
            ))}
          </div>
        </>
      );
    }
    if (contextMenuView.kind === "entryTypeEntries") {
      return (
        <>
          {renderMenuBack(contextMenuView.label)}
          {renderCodexEntryRows(entriesForCategory(contextMenuView.categoryId))}
        </>
      );
    }
    if (contextMenuView.kind === "entryDetails") {
      return (
        <>
          {renderMenuBack(text.contextMenu.entriesByDetail)}
          <div className="workshop-menu-list">
            {detailTypeGroups.map((group) => renderMenuBranch(
              group.label,
              () => setContextMenuView({
                kind: "entryDetailEntries",
                detailTypeId: group.detailTypeId,
                label: group.label,
              }),
              { count: group.count },
            ))}
          </div>
        </>
      );
    }
    if (contextMenuView.kind === "entryDetailEntries") {
      return (
        <>
          {renderMenuBack(contextMenuView.label)}
          {renderCodexEntryRows(entriesForDetailType(contextMenuView.detailTypeId))}
        </>
      );
    }
    if (contextMenuView.kind === "entryCategories") {
      return (
        <>
          {renderMenuBack(text.contextMenu.entriesByCategory)}
          <div className="workshop-menu-list">
            {categoryGroups.map((group) => renderMenuBranch(
              group.label,
              () => setContextMenuView({
                kind: "entryCategoryEntries",
                categoryId: group.categoryId,
                label: group.label,
              }),
              { count: group.count },
            ))}
          </div>
        </>
      );
    }
    if (contextMenuView.kind === "entryCategoryEntries") {
      return (
        <>
          {renderMenuBack(contextMenuView.label)}
          {renderCodexEntryRows(entriesForCategory(contextMenuView.categoryId))}
        </>
      );
    }
    return (
      <>
        {renderMenuToggle(
          text.contextMenu.fullNovel,
          isContextItemSelected("full-novel", seriesId),
          () => void toggleContextItem("full-novel", seriesId, text.contextMenu.fullNovel),
          { body: text.contextMenu.fullNovelBody },
        )}
        {renderMenuToggle(
          text.contextMenu.fullOutline,
          isContextItemSelected("full-outline", seriesId),
          () => void toggleContextItem("full-outline", seriesId, text.contextMenu.fullOutline),
          { body: text.contextMenu.fullOutlineBody },
        )}
        <div className="workshop-menu-divider" />
        {renderMenuBranch(
          text.contextMenu.acts,
          () => setContextMenuView({ kind: "acts" }),
          { count: series.acts.length, disabled: series.acts.length === 0 },
        )}
        {renderMenuBranch(
          text.contextMenu.chapters,
          () => setContextMenuView({ kind: "chapters" }),
          { count: series.chapters.length, disabled: series.chapters.length === 0 },
        )}
        {renderMenuBranch(
          text.contextMenu.scenes,
          () => setContextMenuView({ kind: "scenes" }),
          { count: series.scenes.length, disabled: series.scenes.length === 0 },
        )}
        <div className="workshop-menu-divider" />
        {renderMenuBranch(
          text.contextMenu.codexEntries,
          () => setContextMenuView({ kind: "codexEntries" }),
          { count: activeCodexEntries.length, disabled: activeCodexEntries.length === 0 },
        )}
        {renderMenuBranch(
          text.contextMenu.entriesByType,
          () => setContextMenuView({ kind: "entryTypes" }),
          { count: categoryGroups.length, disabled: categoryGroups.length === 0 },
        )}
        {renderMenuBranch(
          text.contextMenu.entriesByDetail,
          () => setContextMenuView({ kind: "entryDetails" }),
          { count: detailTypeGroups.length, disabled: detailTypeGroups.length === 0 },
        )}
        {renderMenuBranch(
          text.contextMenu.entriesByCategory,
          () => setContextMenuView({ kind: "entryCategories" }),
          { count: categoryGroups.length, disabled: categoryGroups.length === 0 },
        )}
        <div className="workshop-menu-divider" />
        <button
          className="workshop-menu-clear"
          disabled={!hasSelectedContext}
          onClick={() => void clearContextFromMenu()}
          role="menuitem"
          type="button"
        >
          <span aria-hidden="true">x</span>
          {text.contextMenu.clear}
        </button>
      </>
    );
  }

  function renderSettingsDialog() {
    if (!isSettingsOpen) return null;
    return (
      <div className="workshop-settings-backdrop" role="presentation">
        <section
          aria-labelledby="workshop-settings-title"
          aria-modal="true"
          className="workshop-settings-dialog"
          role="dialog"
        >
          <div className="workshop-settings-head">
            <div>
              <h3 id="workshop-settings-title">{text.labels.settingsTitle}</h3>
              <p>{selectedModelLabel}</p>
            </div>
            <button
              aria-label={text.labels.closeSettings}
              className="btn compact"
              onClick={() => setIsSettingsOpen(false)}
              type="button"
            >
              {text.labels.closeSettings}
            </button>
          </div>
          <div className="workshop-settings-body">
            <label className="workshop-settings-field">
              <span>{text.labels.mode}</span>
              <select
                aria-label={text.labels.mode}
                className="input"
                disabled={!activeSession || activeSession.status !== "active"}
                onChange={(event) => setWorkshopMode(event.target.value as WorkshopMode)}
                value={workshopMode}
              >
                <option value="general-chat">{text.modes.generalChat}</option>
                <option value="continuity-check">{text.modes.continuityCheck}</option>
              </select>
            </label>
            <label className="workshop-settings-field">
              <span>{text.labels.modelSetting}</span>
              <select
                aria-label={text.labels.modelSetting}
                className="input"
                disabled={activeModelProfiles.length === 0}
                onChange={(event) => selectModelProfile(event.target.value)}
                value={selectedModelProfile?.id ?? ""}
              >
                {activeModelProfiles.length === 0 ? (
                  <option value="">{text.labels.modelProfileMissing}</option>
                ) : null}
                {activeModelProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="workshop-settings-row">
              <label className="workshop-settings-field">
                <span>{text.labels.model}</span>
                <select
                  aria-label={text.labels.model}
                  className="input"
                  disabled={!selectedModelProfile}
                  onChange={(event) => setSelectedModelId(event.target.value)}
                  value={selectedModelId}
                >
                  {!selectedModelProfile ? (
                    <option value="">{text.labels.modelProfileMissing}</option>
                  ) : null}
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button
                className="btn compact workshop-settings-fetch"
                disabled={!selectedModelProfile || isFetchingProviderModels}
                onClick={() => void fetchProviderModels()}
                type="button"
              >
                {isFetchingProviderModels ? text.labels.modelListLoading : text.fetchModels}
              </button>
            </div>
            <label className="workshop-settings-field">
              <span>{text.labels.generalSystemPrompt}</span>
              <textarea
                aria-label={text.labels.generalSystemPrompt}
                className="input workshop-settings-prompt"
                disabled={workshopMode !== "general-chat"}
                onChange={(event) => setGeneralSystemPrompt(event.target.value)}
                value={generalSystemPrompt}
              />
            </label>
            <label className="workshop-settings-toggle">
              <input
                checked={useStreamingResponses}
                onChange={(event) => setUseStreamingResponses(event.target.checked)}
                type="checkbox"
              />
              <span>{text.labels.streamResponses}</span>
            </label>
            <label className="workshop-settings-toggle">
              <input
                checked={showReasoningByDefault}
                onChange={(event) => setShowReasoningDefault(event.target.checked)}
                type="checkbox"
              />
              <span>{text.labels.showReasoningByDefault}</span>
            </label>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">{text.title}</h2>
          <p className="page-subtitle">{text.subtitle}</p>
        </div>
      </div>
      {renderSettingsDialog()}
      {error ? <p className="alert">{error}</p> : null}
      <div className="workshop-grid">
        <aside className="panel no-shadow workshop-sessions">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.sessionsTitle}</div>
              <div className="panel-kicker">{text.sessionsKicker}</div>
            </div>
            <button className="btn compact" onClick={createSession} type="button">{text.insert}</button>
          </div>
          <div className="panel-body workshop-session-list">
            {isLoading ? <p className="brief-text">{text.labels.loadingWorkshop}</p> : null}
            {!isLoading && sessions.length === 0 ? (
              <div className="unavailable-note">
                <h2>{text.sessionsEmptyTitle}</h2>
                <p>{text.sessionsEmptyBody}</p>
              </div>
            ) : null}
            {sessions.map((session) => (
              <button
                className={`workshop-session-row${session.id === activeSessionId ? " is-active" : ""}`}
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                type="button"
              >
                <span className="workshop-session-copy">
                  <span className="row-title">{session.title}</span>
                  <span className="row-meta">
                    {session.branchOfMessageId ? text.labels.branchSession : text.labels.threadSession}
                    {session.lastMessageAt ? ` / ${formatDate(session.lastMessageAt)}` : ""}
                  </span>
                </span>
                <span className={session.status === "active" ? "pill blue" : "pill muted"}>
                  {text.statusLabels[session.status]}
                </span>
              </button>
            ))}
          </div>
          <div className="workshop-session-foot">
            <div className="workshop-session-tools">
              <button
                className="btn compact"
                disabled={!activeSession}
                onClick={archiveSession}
                type="button"
              >
                {activeSession?.status === "archived" ? text.restore : text.archive}
              </button>
              <button
                className="btn compact"
                disabled={!activeSession || messages.length === 0}
                onClick={branchFromLastMessage}
                type="button"
              >
                {text.branch}
              </button>
            </div>
            <button className="btn workshop-import-thread" disabled type="button">{text.importThread}</button>
          </div>
        </aside>

        <section className="panel chat workshop-chat">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.conversationTitle}</div>
              <div className="panel-kicker">{text.conversationKicker}</div>
            </div>
            <div className="workshop-head-controls">
              <button
                aria-expanded={isSettingsOpen}
                className="btn compact workshop-settings-trigger"
                onClick={() => setIsSettingsOpen(true)}
                type="button"
              >
                {text.labels.settings}
              </button>
            </div>
          </div>
          <div className="message-stack">
            {isDetailLoading ? <p className="brief-text">{text.labels.loadingSession}</p> : null}
            {!activeSession ? (
              <div className="unavailable-note">
                <h2>{text.conversationEmptyTitle}</h2>
                <p>{text.sessionsEmptyBody}</p>
              </div>
            ) : null}
            {activeSession && messages.length === 0 && !isDetailLoading ? (
              <div className="unavailable-note">
                <h2>{text.conversationEmptyTitle}</h2>
                <p>{text.conversationEmptyBody}</p>
              </div>
            ) : null}
            {messages.map((message) => {
              const reasoningContent = (message.reasoningContent ?? "").trim();
              const messageAttachments = (message.attachmentIds ?? [])
                .map((attachmentId) => attachmentMap.get(attachmentId))
                .filter((attachment): attachment is WorkshopMessageAttachment => Boolean(attachment));
              const hasReasoningOverride = reasoningOverrideIds.has(message.id);
              const isReasoningExpanded = showReasoningByDefault
                ? !hasReasoningOverride
                : hasReasoningOverride;
              const canDeleteMessage = activeSession?.status === "active" &&
                message.mode === "general-chat" &&
                message.proposalIds.length === 0 &&
                message.status !== "pending";
              return (
                <article
                  className={`message${message.role === "author" ? " user" : ""}${message.status === "failed" ? " is-failed" : ""}${message.status === "pending" ? " is-streaming" : ""}${message.id === selectedMessageId ? " is-target" : ""}`}
                  key={message.id}
                >
                  <div className="message-meta">
                    <span className={message.status === "failed" ? "pill amber" : message.status === "pending" ? "pill blue" : "pill muted"}>
                      {message.status === "pending" ? text.statusLabels.pending : text.roles[message.role]}
                    </span>
                    <span>{formatDate(message.createdAt)}</span>
                    <div className="message-toolbar">
                      {reasoningContent ? (
                        <button
                          aria-expanded={isReasoningExpanded}
                          className="btn compact subtle message-reasoning-toggle"
                          onClick={() => toggleReasoning(message.id)}
                          type="button"
                        >
                          {isReasoningExpanded ? text.labels.hideReasoning : text.labels.showReasoning}
                        </button>
                      ) : null}
                      {canDeleteMessage ? (
                        <button
                          className="btn compact subtle"
                          disabled={deletingMessageId !== null}
                          onClick={() => void deleteMessage(message)}
                          type="button"
                        >
                          {deletingMessageId === message.id ? text.labels.deletingMessage : text.labels.deleteMessage}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {reasoningContent && isReasoningExpanded ? (
                    <div className="message-reasoning">
                      <div>{text.labels.reasoning}</div>
                      <p>{reasoningContent}</p>
                    </div>
                  ) : reasoningContent ? (
                    <div className="message-reasoning-collapsed">
                      {text.labels.reasoningAvailable}
                    </div>
                  ) : null}
                  {message.content || message.status === "pending" ? (
                    <p>{message.content || text.labels.streaming}</p>
                  ) : null}
                {messageAttachments.length ? (
                  <div className="message-attachments" aria-label={text.labels.messageAttachments}>
                    {messageAttachments.map((attachment) => (
                      <span className="pill muted message-attachment-pill" key={attachment.id}>
                        {attachment.fileName}
                      </span>
                    ))}
                  </div>
                ) : null}
                {message.status === "failed" ? (
                  <p className="message-error">{message.errorMessage ?? text.labels.assistantFailed}</p>
                ) : null}
                {message.proposalIds.length ? (
                  <div className="message-proposals" aria-label={text.proposals.cardsLabel}>
                    {message.proposalIds.map((proposalId) => {
                      const document = proposalMap.get(proposalId);
                      if (!document) {
                        return (
                          <div className="proposal-row workshop-proposal-card is-unavailable" key={proposalId}>
                            <div className="proposal-row-pills">
                              <span className="pill amber">{text.proposals.unavailable}</span>
                            </div>
                            <div>
                              <strong>{text.proposals.unavailableTitle}</strong>
                              <span>{text.proposals.unavailableBody}</span>
                            </div>
                            <button className="btn compact" disabled type="button">
                              {text.proposals.open}
                            </button>
                            <button
                              className="btn compact"
                              disabled={!activeSessionId || isDetailLoading}
                              onClick={() => activeSessionId ? void loadSession(activeSessionId) : undefined}
                              type="button"
                            >
                              {text.refresh}
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="proposal-row workshop-proposal-card" key={document.proposal.id}>
                          <div className="proposal-row-pills">
                            <span className={statusClass(document.proposal.status)}>
                              {uiText.review.statusLabels[document.proposal.status]}
                            </span>
                            <span className="pill blue">{targetKindLabel(document.proposal.target.kind)}</span>
                            {!document.sourceAvailability.available || !document.targetAvailability.available ? (
                              <span className="pill amber">{text.proposals.unavailable}</span>
                            ) : null}
                          </div>
                          <div>
                            <strong>{document.proposal.title}</strong>
                            <span>{document.proposal.summary}</span>
                          </div>
                          <button
                            className="btn primary compact"
                            onClick={() => onOpenProposal(document.proposal.id)}
                            type="button"
                          >
                            {text.proposals.open}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {activeSession?.status === "active" &&
                message.role !== "author" &&
                message.mode !== "general-chat" &&
                message.status === "succeeded" &&
                message.content.trim() &&
                message.proposalIds.length === 0 ? (
                  <div className="message-actions">
                    <button
                      className="btn compact"
                      disabled={creatingProposalMessageId !== null}
                      onClick={() => void createProposalFromMessage(message)}
                      type="button"
                    >
                      {creatingProposalMessageId === message.id
                        ? text.proposals.creating
                        : text.proposals.create}
                    </button>
                  </div>
                ) : null}
                </article>
              );
            })}
          </div>
          <div className="composer workshop-composer">
            <div className="workshop-composer-context">
              <button
                aria-expanded={isContextMenuOpen}
                className="btn compact workshop-context-trigger"
                disabled={!activeSession || !basket}
                onClick={toggleContextMenu}
                type="button"
              >
                {text.contextTrigger}
              </button>
              <div className="workshop-context-chips" aria-label={text.labels.selectedContext}>
                {contextChips.length === 0 ? (
                  <span className="pill muted">{text.labels.noContextChip}</span>
                ) : contextChips.map((chip) => (
                  <span className="pill green" key={chip}>{chip}</span>
                ))}
              </div>
              {isContextMenuOpen ? (
                <div className="workshop-context-menu" role="menu">
                  {renderContextMenuContent()}
                </div>
              ) : null}
            </div>
            <textarea
              aria-label="Workshop message"
              className="input workshop-composer-input"
              disabled={!activeSession || activeSession.status !== "active"}
              onKeyDown={handleComposerKeyDown}
              onChange={(event) => setComposer(event.target.value)}
              placeholder={text.inputPlaceholder}
              value={composer}
            />
            <div className="workshop-composer-foot">
              <div className="workshop-footer-controls">
                <input
                  accept=".txt,.md,.markdown,.doc,.docx,.pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  aria-label={text.labels.attachmentInput}
                  className="workshop-attachment-input"
                  disabled={!activeSession || activeSession.status !== "active" || isCalling}
                  id={attachmentInputId}
                  multiple
                  onChange={handleAttachmentInputChange}
                  ref={attachmentInputRef}
                  type="file"
                />
                <button
                  aria-label={text.labels.attachFile}
                  className="btn compact workshop-attachment-button"
                  disabled={!activeSession || activeSession.status !== "active" || isCalling}
                  onClick={() => attachmentInputRef.current?.click()}
                  title={text.labels.attachFile}
                  type="button"
                >
                  <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
                    <path
                      d="M8.5 12.5 13 8a3.5 3.5 0 0 1 5 5l-6.5 6.5a5 5 0 0 1-7-7L11 6"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>
                {draftAttachments.length ? (
                  <div className="workshop-attachment-chips" aria-label={text.labels.draftAttachments}>
                    {draftAttachments.map((attachment) => {
                      const status = attachmentStatusLabel(attachment.parseStatus, text);
                      const chipClass = attachment.parseStatus === "parsed"
                        ? "pill green"
                        : attachment.parseStatus === "parsing"
                          ? "pill blue"
                          : "pill amber";
                      return (
                        <span className="workshop-attachment-chip" key={attachment.id}>
                          <span className="workshop-attachment-name">{attachment.fileName}</span>
                          <span className={chipClass}>{status}</span>
                          <button
                            aria-label={`${text.labels.removeAttachment}: ${attachment.fileName}`}
                            className="workshop-attachment-remove"
                            onClick={() => void removeDraftAttachment(attachment)}
                            type="button"
                          >
                            x
                          </button>
                          {attachment.parseStatus !== "parsed" && attachment.parseStatus !== "parsing" && attachment.parseError ? (
                            <span className="workshop-attachment-error">{attachment.parseError}</span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="workshop-composer-actions">
                {isCalling ? (
                  <button className="btn workshop-stop-button" onClick={stopSending} type="button">
                    {text.labels.stopSending}
                  </button>
                ) : null}
                <button className="btn primary workshop-send-button" disabled={!canCall} onClick={sendMessage} type="button">
                  {isCalling ? text.labels.sending : text.send}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
