import { type ChangeEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type {
  CodexCategoryDocument,
  CodexDetailTypeDocument,
  CodexEntryDocument,
  ModelProfile,
  ProviderModelDescriptor,
  ProposalDocument,
  SceneDocument,
  SeriesDetail,
  WorkshopContextBasket,
  WorkshopContextItemRef,
  WorkshopConversationKind,
  WorkshopAgentRunDocument,
  WorkshopCallStreamEvent,
  WorkshopCodexCreateEntryToolError,
  WorkshopMessageAttachment,
  WorkshopMessage,
  WorkshopSession,
} from "@novel-studio/contracts";
import { ApiError, api } from "../../api";
import { uiText } from "../../app/uiText";
import { categoryLabel } from "../codex/codexViewModel";
import { isEligibleWorkshopBranchSource, workshopGeneralChatTurn } from "./workshopConversation";
import {
  attachmentStatusLabel,
  codexEntryMentionedInText,
  fileToBase64,
  formatWorkshopDate,
  proposalStatusClass,
  proposalTargetKindLabel,
  selectedScopeTexts,
  titleFromChatStart,
  workshopExportFileName,
  type ComposerAttachment,
} from "./workshopViewModel";
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
  | { kind: "entryDetails" }
  | { kind: "entryDetailEntries"; detailTypeId: string; label: string }
  | { kind: "entryCategories" }
  | { kind: "entryCategoryEntries"; categoryId: string; label: string };

type ContextRootTab = "story" | "scenes" | "codex" | "files";

interface CodexDraftResolutionState {
  availableDetailTypes: WorkshopCodexCreateEntryToolError["availableDetailTypes"];
  choices: Record<string, CodexDraftResolutionChoice | undefined>;
  messageId: string;
  missingDetailTypes: WorkshopCodexCreateEntryToolError["missingDetailTypes"];
  planner: WorkshopCodexCreateEntryToolError["planner"];
  toolName: CodexToolName;
}

type CodexDraftResolutionChoice =
  | { kind: "map"; detailTypeId: string }
  | { kind: "create"; name: string; nsfw: boolean };

type CodexToolName = "codex.create_entry" | "codex.update_entry";

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
  return error instanceof Error ? error.message : uiText.workshop.errors.requestFailed;
}

function codexCreateEntryToolError(error: unknown): WorkshopCodexCreateEntryToolError | null {
  if (!(error instanceof ApiError) || typeof error.payload !== "object" || error.payload === null) {
    return null;
  }
  const payload = error.payload as Partial<WorkshopCodexCreateEntryToolError>;
  if (
    payload.code === "CODEX_DETAIL_TYPE_CREATION_REQUIRED" &&
    Array.isArray(payload.missingDetailTypes) &&
    Array.isArray(payload.availableDetailTypes) &&
    typeof payload.planner === "object" &&
    payload.planner !== null &&
    typeof payload.message === "string"
  ) {
    return payload as WorkshopCodexCreateEntryToolError;
  }
  return null;
}

function codexToolRequestName(content: string): CodexToolName | null {
  try {
    const parsed = JSON.parse(content) as { schemaVersion?: unknown; tool?: unknown };
    if (
      parsed.schemaVersion === 1 &&
      (parsed.tool === "codex.create_entry" || parsed.tool === "codex.update_entry")
    ) {
      return parsed.tool;
    }
  } catch {
    return null;
  }
  return null;
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
  const [agentRuns, setAgentRuns] = useState<WorkshopAgentRunDocument[]>([]);
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
  const [contextRootTab, setContextRootTab] = useState<ContextRootTab>("story");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionCreateOpen, setIsSessionCreateOpen] = useState(false);
  const [isSessionActionsOpen, setIsSessionActionsOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([]);
  const [selectedModelProfileId, setSelectedModelProfileId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [providerModels, setProviderModels] = useState<ProviderModelDescriptor[]>([]);
  const [providerModelsProfileId, setProviderModelsProfileId] = useState<string | null>(null);
  const [generalSystemPrompt, setGeneralSystemPrompt] = useState("");
  const [isSavingGeneralSystemPrompt, setIsSavingGeneralSystemPrompt] = useState(false);
  const [composer, setComposer] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isFetchingProviderModels, setIsFetchingProviderModels] = useState(false);
  const [applyingCodexDraftMessageId, setApplyingCodexDraftMessageId] = useState<string | null>(null);
  const [recoveringAgentRunId, setRecoveringAgentRunId] = useState<string | null>(null);
  const [codexDraftResolution, setCodexDraftResolution] = useState<CodexDraftResolutionState | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [resendingMessageId, setResendingMessageId] = useState<string | null>(null);
  const [isExportingSession, setIsExportingSession] = useState(false);
  const [includeReasoningInExport, setIncludeReasoningInExport] = useState(false);
  const [includePromptAuditInExport, setIncludePromptAuditInExport] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [reasoningOverrideIds, setReasoningOverrideIds] = useState<Set<string>>(() => new Set());
  const [useStreamingResponses, setUseStreamingResponses] = useState(true);
  const [showReasoningByDefault, setShowReasoningByDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const attachmentInputId = useMemo(() => `workshop-attachment-${randomId()}`, []);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const callAbortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  const liveSessionMessagesRef = useRef<Record<string, WorkshopMessage[]>>({});

  function closeFloatingSurfaces() {
    setIsContextMenuOpen(false);
    setIsSessionCreateOpen(false);
    setIsSessionActionsOpen(false);
    setOpenMessageMenuId(null);
    setIsSettingsOpen(false);
  }

  useEffect(() => {
    if (
      !isContextMenuOpen &&
      !isSessionCreateOpen &&
      !isSessionActionsOpen &&
      !openMessageMenuId &&
      !isSettingsOpen
    ) {
      return;
    }

    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-workshop-floating-root]")) {
        return;
      }
      closeFloatingSurfaces();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        closeFloatingSurfaces();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isContextMenuOpen, isSessionCreateOpen, isSessionActionsOpen, openMessageMenuId, isSettingsOpen]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const latestAgentRun = agentRuns.at(-1) ?? null;
  function sessionPillClass(session: WorkshopSession) {
    if (session.status === "archived") return "pill muted";
    return session.kind === "agent" ? "pill amber" : "pill blue";
  }

  function sessionPillLabel(session: WorkshopSession) {
    return session.status === "archived"
      ? text.statusLabels[session.status]
      : text.sessionKinds[session.kind];
  }

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
    if (hasFullNovel) chips.push(text.labels.fullNovelChip);
    if (hasFullOutline) chips.push(text.labels.fullOutlineChip);
    if (actCount > 0) chips.push(`${actCount} ${text.labels.actChipPlural}`);
    if (chapterCount > 0) chips.push(`${chapterCount} ${text.labels.chapterChipPlural}`);
    if (hasCurrentScene) chips.push(text.labels.currentSceneChip);
    if (sceneCount > 0) chips.push(`${sceneCount} ${text.labels.sceneChipPlural}`);
    if (codexCount > 0) {
      chips.push(codexCount === 1 ? text.labels.relevantCodexChip : `${codexCount} ${text.labels.codexChipPlural}`);
    }
    return chips;
  }, [
    basket?.sceneId,
    contextItems,
    text.labels.actChipPlural,
    text.labels.chapterChipPlural,
    text.labels.codexChipPlural,
    text.labels.currentSceneChip,
    text.labels.fullNovelChip,
    text.labels.fullOutlineChip,
    text.labels.relevantCodexChip,
    text.labels.sceneChipPlural,
  ]);
  const hasSelectedContext = Boolean(
    basket?.sceneId ||
    basket?.blockId ||
    basket?.selection ||
    contextItems.length > 0,
  );
  const contextRootTabCounts = useMemo(() => ({
    codex: contextItems.filter((item) => item.kind === "codex-entry").length,
    files: draftAttachments.length,
    scenes: contextItems.filter((item) =>
      item.kind === "act" || item.kind === "chapter" || item.kind === "scene",
    ).length + (basket?.sceneId ? 1 : 0),
    story: contextItems.filter((item) => item.kind === "full-novel" || item.kind === "full-outline").length,
  }), [basket?.sceneId, contextItems, draftAttachments.length]);
  const hasBlockedDraftAttachment = draftAttachments.some((attachment) => attachment.parseStatus !== "parsed");
  const hasComposerText = composer.trim().length > 0;
  const hasParsedDraftAttachment = draftAttachments.some((attachment) => attachment.parseStatus === "parsed");
  const canCall = Boolean(
    activeSession &&
    activeSession.status === "active" &&
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

  function activateSession(sessionId: string | null) {
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    setIsSessionCreateOpen(false);
    setIsSessionActionsOpen(false);
    setIsContextMenuOpen(false);
    setOpenMessageMenuId(null);
  }

  function mergeMessagesById(
    storedMessages: WorkshopMessage[],
    liveMessages: WorkshopMessage[],
  ): WorkshopMessage[] {
    const merged = [...storedMessages];
    for (const liveMessage of liveMessages) {
      const existingIndex = merged.findIndex((message) => message.id === liveMessage.id);
      if (existingIndex >= 0) {
        merged[existingIndex] = liveMessage;
      } else {
        merged.push(liveMessage);
      }
    }
    return merged.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  function appendLiveSessionMessages(sessionId: string, nextMessages: WorkshopMessage[]) {
    liveSessionMessagesRef.current = {
      ...liveSessionMessagesRef.current,
      [sessionId]: [
        ...(liveSessionMessagesRef.current[sessionId] ?? []),
        ...nextMessages,
      ],
    };
    if (activeSessionIdRef.current === sessionId) {
      setMessages((current) => [...current, ...nextMessages]);
    }
  }

  function updateSessionMessages(
    sessionId: string,
    updater: (current: WorkshopMessage[]) => WorkshopMessage[],
  ) {
    liveSessionMessagesRef.current = {
      ...liveSessionMessagesRef.current,
      [sessionId]: updater(liveSessionMessagesRef.current[sessionId] ?? []),
    };
    if (activeSessionIdRef.current === sessionId) {
      setMessages(updater);
    }
  }

  function clearLiveSessionMessages(sessionId: string) {
    const remaining = { ...liveSessionMessagesRef.current };
    delete remaining[sessionId];
    liveSessionMessagesRef.current = remaining;
  }

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

  function applySessionUpdate(updated: WorkshopSession) {
    setSessions((current) => current.map((session) => (
      session.id === updated.id ? updated : session
    )));
  }

  async function updateSessionTitle(sessionId: string, title: string): Promise<WorkshopSession | null> {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const updated = await api.workshop.updateSession(seriesId, sessionId, { title: trimmed });
    applySessionUpdate(updated);
    return updated;
  }

  async function persistGeneralSystemPrompt(
    session: WorkshopSession,
    prompt = generalSystemPrompt,
  ): Promise<WorkshopSession> {
    if (session.kind !== "chat") return session;
    const nextPrompt = prompt.trim();
    if (nextPrompt === session.generalChatSystemPrompt) return session;
    setIsSavingGeneralSystemPrompt(true);
    try {
      const updated = await api.workshop.updateSession(seriesId, session.id, {
        generalChatSystemPrompt: nextPrompt,
      });
      applySessionUpdate(updated);
      return updated;
    } finally {
      setIsSavingGeneralSystemPrompt(false);
    }
  }

  async function autoNameSessionFromStart(
    session: WorkshopSession,
    requestText: string,
    sentAttachments: Array<{ fileName: string }>,
    messageCountBeforeSend: number,
  ) {
    if (messageCountBeforeSend > 0) return;
    if (session.title.trim() !== text.defaultSessionTitle) return;
    const title = titleFromChatStart(
      requestText,
      sentAttachments,
      text.labels.attachmentOnlyRequest,
      text.defaultSessionTitle,
    );
    if (!title || title === session.title) return;
    try {
      await updateSessionTitle(session.id, title);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  function startSessionTitleEdit(session: WorkshopSession) {
    activateSession(session.id);
    setEditingSessionId(session.id);
    setEditingSessionTitle(session.title);
  }

  function cancelSessionTitleEdit() {
    setEditingSessionId(null);
    setEditingSessionTitle("");
  }

  async function commitSessionTitleEdit() {
    if (!editingSessionId) return;
    const session = sessions.find((item) => item.id === editingSessionId);
    const nextTitle = editingSessionTitle.trim();
    if (!session || !nextTitle || nextTitle === session.title) {
      cancelSessionTitleEdit();
      return;
    }
    try {
      await updateSessionTitle(session.id, nextTitle);
      cancelSessionTitleEdit();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  function handleSessionTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelSessionTitleEdit();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void commitSessionTitleEdit();
    }
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
    sessionId: string,
    result: {
      authorMessage: WorkshopMessage;
      assistantMessage: WorkshopMessage;
      toolMessages?: WorkshopMessage[];
      agentRun?: WorkshopAgentRunDocument | null;
    },
    localAuthorId = result.authorMessage.id,
    localAssistantId = result.assistantMessage.id,
  ) {
    updateSessionMessages(sessionId, (current) => {
      const withAuthor = replaceMessageByIdentity(current, localAuthorId, result.authorMessage);
      const withAssistant = replaceMessageByIdentity(withAuthor, localAssistantId, result.assistantMessage);
      const toolMessages = result.toolMessages ?? [];
      return toolMessages.reduce(
        (next, message) => replaceMessageByIdentity(next, message.id, message),
        withAssistant,
      );
    });
    clearLiveSessionMessages(sessionId);
    bindAttachmentsToMessage(result.authorMessage);
    updateSessionFromMessage(result.assistantMessage);
    if (result.agentRun && activeSessionIdRef.current === sessionId) {
      setAgentRuns((current) => [
        ...current.filter((document) => document.run.id !== result.agentRun!.run.id),
        result.agentRun!,
      ].sort((left, right) => left.run.createdAt.localeCompare(right.run.createdAt)));
    }
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
      const [nextSessions, nextProfiles] = await Promise.all([
        api.workshop.listSessions(seriesId),
        api.ai.listModelProfiles(),
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
      const nextActive =
        preferredSessionId ??
        (activeSessionId && nextSessions.some((session) => session.id === activeSessionId)
          ? activeSessionId
          : nextSessions.find((session) => session.status === "active")?.id ?? nextSessions[0]?.id ?? null);
      activateSession(nextActive);
      setIsSettingsOpen(false);
      setIsSessionCreateOpen(false);
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
      if (activeSessionIdRef.current !== sessionId) return;
      setBasket(detail.basket);
      setMessages(mergeMessagesById(detail.messages, liveSessionMessagesRef.current[sessionId] ?? []));
      setAgentRuns(detail.agentRuns?.runs ?? []);
      setAttachments(detail.attachments ?? []);
      setDraftAttachments([]);
      setDraftToken(randomId());
      setProposalDocuments(inbox.items);
      setCodexCategories(nextCodexCategories);
      setCodexDetailTypes(nextCodexDetailTypes);
      setCodexEntries(nextCodexEntries);
      setIsContextMenuOpen(false);
      setContextMenuView({ kind: "root" });
      setCodexDraftResolution(null);
      setEditingMessageContent("");
      setEditingMessageId(null);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      if (activeSessionIdRef.current === sessionId) {
        setIsDetailLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadShell(selectedSessionId ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    setGeneralSystemPrompt(
      activeSession?.kind === "chat" ? activeSession.generalChatSystemPrompt : "",
    );
  }, [activeSession?.generalChatSystemPrompt, activeSession?.id, activeSession?.kind]);

  useEffect(() => {
    if (selectedSessionId && selectedSessionId !== activeSessionId) {
      activateSession(selectedSessionId);
    }
  }, [activeSessionId, selectedSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      setBasket(null);
      setMessages([]);
      setAgentRuns([]);
      setIsDetailLoading(false);
      setIsContextMenuOpen(false);
      setCodexDraftResolution(null);
      setEditingMessageContent("");
      setEditingMessageId(null);
      return;
    }
    void loadSession(activeSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, seriesId]);

  async function createSession(kind: WorkshopConversationKind) {
    setError(null);
    setIsSessionCreateOpen(false);
    try {
      const created = await api.workshop.createSession(seriesId, {
        title: text.defaultSessionTitle,
        kind,
        sceneId: null,
      });
      await loadShell(created.id);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function archiveSession() {
    if (!activeSession) return;
    setIsSessionActionsOpen(false);
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

  async function deleteSessionPermanently() {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    const confirmed = globalThis.confirm?.(text.labels.deleteSessionConfirm) ?? false;
    if (!confirmed) {
      setIsSessionActionsOpen(false);
      return;
    }
    setDeletingSessionId(sessionId);
    setError(null);
    try {
      const result = await api.workshop.deleteSession(seriesId, sessionId);
      clearLiveSessionMessages(result.deletedId);
      setReasoningOverrideIds((current) => {
        const next = new Set(current);
        for (const messageId of result.deletedMessageIds) next.delete(messageId);
        return next;
      });
      const remainingSessions = sessions.filter((session) => session.id !== result.deletedId);
      const nextActive =
        remainingSessions.find((session) => session.status === "active") ??
        remainingSessions[0] ??
        null;
      setBasket(null);
      setMessages([]);
      setAttachments([]);
      setDraftAttachments([]);
      setDraftToken(randomId());
      await loadShell(nextActive?.id);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setDeletingSessionId(null);
      setIsSessionActionsOpen(false);
    }
  }

  async function branchFromMessage(source: WorkshopMessage) {
    if (!activeSession) return;
    const sourceIndex = messages.findIndex((message) => message.id === source.id);
    if (!isEligibleWorkshopBranchSource(messages, sourceIndex)) return;
    setIsSessionActionsOpen(false);
    setOpenMessageMenuId(null);
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
    setIsSessionCreateOpen(false);
    setIsSessionActionsOpen(false);
    setIsSettingsOpen(false);
    setOpenMessageMenuId(null);
    setIsContextMenuOpen((current) => {
      const next = !current;
      if (next) setContextMenuView({ kind: "root" });
      return next;
    });
  }

  function previewPayload(userRequest = composer.trim() || text.labels.defaultRequest) {
    if (!activeSession) throw new Error(text.labels.noSession);
    const isAgent = activeSession.kind === "agent";
    return {
      mode: isAgent ? "agent" as const : "general-chat" as const,
      userRequest,
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
    if (!activeSession || !selectedModelProfile || isCalling) return;
    const parsedDraftAttachments = draftAttachments.filter((attachment) => attachment.parseStatus === "parsed");
    if (parsedDraftAttachments.length !== draftAttachments.length) return;
    if (!composer.trim() && parsedDraftAttachments.length === 0) return;
    try {
      await persistGeneralSystemPrompt(activeSession);
    } catch (caught) {
      setError(apiErrorMessage(caught));
      return;
    }
    const sentAttachmentIds = parsedDraftAttachments.map((attachment) => attachment.id);
    const sentDraftToken = sentAttachmentIds.length ? draftToken : null;
    const requestText = composer.trim() || text.labels.attachmentOnlyRequest;
    const messageCountBeforeSend = messages.length;
    const callSessionId = activeSession.id;
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
      sessionId: callSessionId,
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
    setStatusMessage(null);
    appendLiveSessionMessages(callSessionId, [localAuthorMessage]);
    setComposer("");
    setDraftAttachments([]);
    setDraftToken(randomId());
    setIsContextMenuOpen(false);
    setIsSettingsOpen(false);
    void autoNameSessionFromStart(
      activeSession,
      requestText,
      parsedDraftAttachments,
      messageCountBeforeSend,
    );
    try {
      if ((payload.mode === "general-chat" || payload.mode === "agent") && useStreamingResponses) {
        const localAssistantId = randomId();
        let assistantMessageId = localAssistantId;
        const localAssistantMessage: WorkshopMessage = {
          schemaVersion: 1,
          id: localAssistantId,
          seriesId,
          sessionId: callSessionId,
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
        appendLiveSessionMessages(callSessionId, [localAssistantMessage]);
        await api.workshop.runCallStream(
          seriesId,
          callSessionId,
          payload,
          (event: WorkshopCallStreamEvent) => {
            if (event.type === "author-message") {
              updateSessionMessages(
                callSessionId,
                (current) => replaceMessageByIdentity(current, localAuthorMessage.id, event.message),
              );
              bindAttachmentsToMessage(event.message);
              return;
            }
            if (event.type === "metadata") {
              updateSessionMessages(callSessionId, (current) => patchMessage(current, assistantMessageId, {
                contextBundleId: event.contextBundleId,
                modelCallId: event.modelCallId,
              }));
              return;
            }
            if (event.type === "delta") {
              updateSessionMessages(callSessionId, (current) => current.map((message) => (
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${event.text}` }
                  : message
              )));
              return;
            }
            if (event.type === "reasoning-delta") {
              updateSessionMessages(callSessionId, (current) => current.map((message) => (
                message.id === assistantMessageId
                  ? { ...message, reasoningContent: `${message.reasoningContent ?? ""}${event.text}` }
                  : message
              )));
              return;
            }
            if (event.type === "assistant-message") {
              updateSessionMessages(
                callSessionId,
                (current) => replaceMessageByIdentity(current, assistantMessageId, event.message),
              );
              assistantMessageId = event.message.id;
              updateSessionFromMessage(event.message);
              return;
            }
            if (event.type === "error") {
              setError(event.message);
              if (event.assistantMessage) {
                updateSessionMessages(
                  callSessionId,
                  (current) => replaceMessageByIdentity(current, assistantMessageId, event.assistantMessage!),
                );
                assistantMessageId = event.assistantMessage.id;
                updateSessionFromMessage(event.assistantMessage);
              }
              return;
            }
            if (event.type === "done") {
              applyCallResult(callSessionId, event.result, localAuthorMessage.id, localAssistantId);
            }
          },
          abortController.signal,
        );
        return;
      }
      const result = await api.workshop.runCall(seriesId, callSessionId, payload, abortController.signal);
      applyCallResult(callSessionId, result, localAuthorMessage.id);
    } catch (caught) {
      if (isAbortError(caught)) {
        setError(null);
        updateSessionMessages(callSessionId, (current) => {
          const stopped = {
            schemaVersion: 1 as const,
            id: randomId(),
            seriesId,
            sessionId: callSessionId,
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
            message.sessionId === callSessionId,
          );
          if (pendingIndex < 0) return [...current, stopped];
          return current.map((message, index) => index === pendingIndex ? stopped : message);
        });
        return;
      }
      const message = apiErrorMessage(caught);
      setError(message);
      updateSessionMessages(callSessionId, (current) => [
        ...current,
        {
          schemaVersion: 1,
          id: randomId(),
          seriesId,
          sessionId: callSessionId,
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

  async function executeCodexToolFromMessage(
    message: WorkshopMessage,
    resolution: {
      detailCreations: Array<{ label: string; name: string; nsfw: boolean }>;
      detailMappings: Array<{ label: string; detailTypeId: string }>;
    } | null = null,
    requireConfirm = true,
  ) {
    if (!activeSession) return;
    const toolName = codexToolRequestName(message.content);
    if (!toolName) return;
    const confirmMessage = toolName === "codex.create_entry"
      ? text.codexDraft.confirmCreate
      : text.codexDraft.confirmUpdate;
    if (requireConfirm && !window.confirm(confirmMessage)) return;
    setApplyingCodexDraftMessageId(message.id);
    setError(null);
    setStatusMessage(null);
    try {
      const result = toolName === "codex.create_entry"
        ? await api.workshop.executeCodexCreateEntryTool(seriesId, activeSession.id, message.id, {
          confirm: true,
          createMissingDetailTypes: Boolean(resolution?.detailCreations.length),
          detailCreations: resolution?.detailCreations ?? [],
          detailMappings: resolution?.detailMappings ?? [],
        })
        : await api.workshop.executeCodexUpdateEntryTool(seriesId, activeSession.id, message.id, {
          confirm: true,
          createMissingDetailTypes: Boolean(resolution?.detailCreations.length),
          detailCreations: resolution?.detailCreations ?? [],
          detailMappings: resolution?.detailMappings ?? [],
        });
      if (result.createdDetailTypes.length) {
        setCodexDetailTypes((current) => [
          ...current,
          ...result.createdDetailTypes.filter((created) =>
            !current.some((existing) => existing.detailType.id === created.detailType.id),
          ),
        ]);
      }
      setCodexEntries((current) => [
        result.entry,
        ...current.filter((entry) => entry.metadata.id !== result.entry.metadata.id),
      ]);
      setMessages((current) => {
        const withUpdatedSource = current.map((item) => item.id === result.message.id ? result.message : item);
        const additions = [result.resultMessage, ...(result.continuationMessages ?? [])];
        return additions.reduce(
          (next, addition) => replaceMessageByIdentity(next, addition.id, addition),
          withUpdatedSource,
        ).sort((left, right) =>
          left.createdAt.localeCompare(right.createdAt),
        );
      });
      if (result.agentRun) {
        setAgentRuns((current) => [
          ...current.filter((document) => document.run.id !== result.agentRun!.run.id),
          result.agentRun!,
        ].sort((left, right) => left.run.createdAt.localeCompare(right.run.createdAt)));
      }
      updateSessionFromMessage(result.continuationMessages?.at(-1) ?? result.resultMessage);
      setCodexDraftResolution(null);
      setStatusMessage(
        toolName === "codex.create_entry"
          ? text.codexDraft.created(result.entry.metadata.name)
          : text.codexDraft.updated(result.entry.metadata.name),
      );
    } catch (caught) {
      const mappingError = codexCreateEntryToolError(caught);
      if (mappingError) {
        const choices = Object.fromEntries(mappingError.missingDetailTypes.map((detail) => {
          const recommended = detail.suggestions.find((suggestion) => suggestion.recommended);
          return [
            detail.label,
            recommended ? { kind: "map" as const, detailTypeId: recommended.detailTypeId } : undefined,
          ];
        }));
        setCodexDraftResolution({
          availableDetailTypes: mappingError.availableDetailTypes,
          choices,
          messageId: message.id,
          missingDetailTypes: mappingError.missingDetailTypes,
          planner: mappingError.planner,
          toolName,
        });
        setError(null);
        return;
      }
      const executionError = apiErrorMessage(caught);
      const executionSessionId = activeSession.id;
      await loadSession(executionSessionId);
      if (activeSessionIdRef.current === executionSessionId) {
        setError(executionError);
      }
    } finally {
      setApplyingCodexDraftMessageId(null);
    }
  }

  async function applyResolvedCodexDraft() {
    if (!codexDraftResolution) return;
    const message = messages.find((item) => item.id === codexDraftResolution.messageId);
    if (!message) {
      setCodexDraftResolution(null);
      setError(text.codexDraft.creationMessageMissing);
      return;
    }
    const detailMappings: Array<{ label: string; detailTypeId: string }> = [];
    const detailCreations: Array<{ label: string; name: string; nsfw: boolean }> = [];
    for (const detail of codexDraftResolution.missingDetailTypes) {
      const choice = codexDraftResolution.choices[detail.label];
      if (!choice) return;
      if (choice.kind === "map") {
        detailMappings.push({ label: detail.label, detailTypeId: choice.detailTypeId });
      } else {
        if (!choice.name.trim()) return;
        detailCreations.push({ label: detail.label, name: choice.name.trim(), nsfw: choice.nsfw });
      }
    }
    await executeCodexToolFromMessage(message, { detailCreations, detailMappings }, false);
  }

  async function retryAgentRun(document: WorkshopAgentRunDocument) {
    if (!activeSession || recoveringAgentRunId) return;
    setRecoveringAgentRunId(document.run.id);
    setError(null);
    try {
      const result = await api.workshop.retryAgentRun(seriesId, activeSession.id, document.run.id, {
        baseRevision: document.revision,
      });
      setAgentRuns((current) => [
        ...current.filter((item) => item.run.id !== result.agentRun.run.id),
        result.agentRun,
      ].sort((left, right) => left.run.createdAt.localeCompare(right.run.createdAt)));
      setMessages((current) => [result.assistantMessage, ...result.toolMessages].reduce(
        (next, message) => replaceMessageByIdentity(next, message.id, message),
        current,
      ).sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
      updateSessionFromMessage(result.toolMessages.at(-1) ?? result.assistantMessage);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setRecoveringAgentRunId(null);
    }
  }

  async function abandonAgentRun(document: WorkshopAgentRunDocument) {
    if (!activeSession || recoveringAgentRunId) return;
    if (!(globalThis.confirm?.(text.agentRun.abandonConfirm) ?? false)) return;
    setRecoveringAgentRunId(document.run.id);
    setError(null);
    try {
      const abandoned = await api.workshop.abandonAgentRun(seriesId, activeSession.id, document.run.id, {
        baseRevision: document.revision,
        reason: text.agentRun.abandonedByAuthor,
      });
      setAgentRuns((current) => [
        ...current.filter((item) => item.run.id !== abandoned.run.id),
        abandoned,
      ].sort((left, right) => left.run.createdAt.localeCompare(right.run.createdAt)));
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setRecoveringAgentRunId(null);
    }
  }

  function updateCodexResolutionChoice(label: string, value: string) {
    if (!codexDraftResolution) return;
    const choice: CodexDraftResolutionChoice | undefined = value === "create"
      ? { kind: "create", name: label, nsfw: false }
      : value.startsWith("map:")
        ? { kind: "map", detailTypeId: value.slice(4) }
        : undefined;
    setCodexDraftResolution({
      ...codexDraftResolution,
      choices: { ...codexDraftResolution.choices, [label]: choice },
    });
  }

  function updateCodexCreationChoice(
    label: string,
    patch: Partial<Extract<CodexDraftResolutionChoice, { kind: "create" }>>,
  ) {
    if (!codexDraftResolution) return;
    const current = codexDraftResolution.choices[label];
    if (!current || current.kind !== "create") return;
    setCodexDraftResolution({
      ...codexDraftResolution,
      choices: {
        ...codexDraftResolution.choices,
        [label]: { ...current, ...patch },
      },
    });
  }

  const codexResolutionComplete = codexDraftResolution?.missingDetailTypes.every((detail) => {
    const choice = codexDraftResolution.choices[detail.label];
    return choice?.kind === "map" || (choice?.kind === "create" && Boolean(choice.name.trim()));
  }) ?? false;

  function beginEditMessage(message: WorkshopMessage) {
    setEditingMessageId(message.id);
    setEditingMessageContent(message.content);
    setError(null);
    setStatusMessage(null);
  }

  function cancelEditMessage() {
    setEditingMessageId(null);
    setEditingMessageContent("");
  }

  async function exportActiveSession() {
    if (!activeSession || isExportingSession) return;
    setIsSessionActionsOpen(false);
    setIsExportingSession(true);
    setError(null);
    setStatusMessage(null);
    try {
      const markdown = await api.workshop.exportSession(seriesId, activeSession.id, {
        includePromptAudit: includePromptAuditInExport,
        includeReasoning: includeReasoningInExport,
      });
      const markdownWithBom = markdown.startsWith("\uFEFF") ? markdown : `\uFEFF${markdown}`;
      const blob = new Blob([markdownWithBom], { type: "text/markdown;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = workshopExportFileName(activeSession);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setStatusMessage(text.labels.exportReady);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setIsExportingSession(false);
    }
  }

  async function resendGeneralChatMessage(message: WorkshopMessage, content = message.content) {
    if (!activeSession || activeSession.kind !== "chat" || !selectedModelProfile) return;
    const nextContent = content.trim();
    if (!nextContent) return;
    setResendingMessageId(message.id);
    setError(null);
    setStatusMessage(null);
    try {
      await persistGeneralSystemPrompt(activeSession);
      const result = await api.workshop.resendMessage(seriesId, activeSession.id, message.id, {
        content: nextContent,
        modelProfileId: selectedModelProfile.id,
        modelOverride:
          selectedModelId && selectedModelId !== selectedModelProfile.model
            ? selectedModelId
            : null,
      });
      const deletedMessageIds = new Set(result.deletedMessageIds);
      setMessages((current) => {
        const kept = current.filter((item) => !deletedMessageIds.has(item.id));
        const withAuthor = replaceMessageByIdentity(kept, message.id, result.authorMessage);
        const withAssistant = replaceMessageByIdentity(withAuthor, result.assistantMessage.id, result.assistantMessage);
        return (result.toolMessages ?? []).reduce(
          (next, item) => replaceMessageByIdentity(next, item.id, item),
          withAssistant,
        ).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      });
      setAttachments((current) => current.filter((attachment) =>
        !result.deletedAttachmentIds.includes(attachment.id),
      ));
      setCodexDraftResolution((current) =>
        current && deletedMessageIds.has(current.messageId) ? null : current,
      );
      bindAttachmentsToMessage(result.authorMessage);
      updateSessionFromMessage(result.assistantMessage);
      setEditingMessageId(null);
      setEditingMessageContent("");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setResendingMessageId(null);
    }
  }

  async function deleteMessage(message: WorkshopMessage) {
    if (!activeSession || activeSession.kind !== "chat") return;
    const messageIndex = messages.findIndex((candidate) => candidate.id === message.id);
    if (!workshopGeneralChatTurn(messages, messageIndex)) return;
    if (!globalThis.confirm(text.labels.deleteTurnConfirm)) return;
    setDeletingMessageId(message.id);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await api.workshop.deleteMessage(seriesId, activeSession.id, message.id);
      const deletedMessageIds = new Set(result.deletedMessageIds);
      setMessages((current) => current.filter((item) => !deletedMessageIds.has(item.id)));
      setCodexDraftResolution((current) =>
        current && deletedMessageIds.has(current.messageId) ? null : current,
      );
      setAttachments((current) => current.filter((attachment) =>
        !result.deletedAttachmentIds.includes(attachment.id),
      ));
      setSessions((current) => current.map((session) => {
        if (session.id === result.session.id) return result.session;
        return session.branchOfMessageId && deletedMessageIds.has(session.branchOfMessageId)
          ? { ...session, branchOfMessageId: null }
          : session;
      }));
      setReasoningOverrideIds((current) => {
        const next = new Set(current);
        for (const deletedMessageId of deletedMessageIds) next.delete(deletedMessageId);
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

  function renderContextRootTabButton(tab: ContextRootTab, label: string, count: number) {
    const isActive = contextRootTab === tab;
    return (
      <button
        aria-selected={isActive}
        className={`workshop-context-tab${isActive ? " is-active" : ""}`}
        onClick={() => setContextRootTab(tab)}
        role="tab"
        type="button"
      >
        <span>{label}</span>
        <strong>{count}</strong>
      </button>
    );
  }

  function renderContextPane(
    title: string,
    count: number,
    children: ReactNode,
  ) {
    return (
      <section
        aria-label={title}
        className="workshop-context-pane"
        role="tabpanel"
      >
        <div className="workshop-context-pane-head">
          <div>
            <strong>{title}</strong>
            <span>{text.labels.contextSelectedCount(count)}</span>
          </div>
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
        </div>
        <div className="workshop-context-options">
          {children}
        </div>
      </section>
    );
  }

  function renderDraftAttachmentRows() {
    if (draftAttachments.length === 0) {
      return <p className="workshop-menu-empty">{text.labels.noDraftAttachments}</p>;
    }
    return draftAttachments.map((attachment) => {
      const status = attachmentStatusLabel(attachment.parseStatus, text);
      const chipClass = attachment.parseStatus === "parsed"
        ? "pill green"
        : attachment.parseStatus === "parsing"
          ? "pill blue"
          : "pill amber";
      return (
        <div className="workshop-context-file-row" key={attachment.id}>
          <span>
            <strong>{attachment.fileName}</strong>
            {attachment.parseError ? <small>{attachment.parseError}</small> : null}
          </span>
          <span className={chipClass}>{status}</span>
        </div>
      );
    });
  }

  function renderContextRootPanel() {
    if (contextRootTab === "scenes") {
      return renderContextPane(text.contextMenu.structureScope, contextRootTabCounts.scenes, (
        <>
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
        </>
      ));
    }
    if (contextRootTab === "codex") {
      return renderContextPane(text.contextMenu.codexScope, contextRootTabCounts.codex, (
        <>
          {renderMenuBranch(
            text.contextMenu.codexEntries,
            () => setContextMenuView({ kind: "codexEntries" }),
            { count: activeCodexEntries.length, disabled: activeCodexEntries.length === 0 },
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
        </>
      ));
    }
    if (contextRootTab === "files") {
      return renderContextPane(text.contextMenu.filesScope, contextRootTabCounts.files, (
        <>
          <button
            className="workshop-menu-item"
            disabled={!activeSession || activeSession.status !== "active" || isCalling}
            onClick={() => attachmentInputRef.current?.click()}
            role="menuitem"
            type="button"
          >
            <span>
              <strong>{text.labels.attachFile}</strong>
              <small>{text.contextMenu.filesBody}</small>
            </span>
            <span aria-hidden="true">+</span>
          </button>
          {renderDraftAttachmentRows()}
        </>
      ));
    }
    return renderContextPane(text.contextMenu.storyScope, contextRootTabCounts.story, (
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
      </>
    ));
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
      <div className="workshop-context-panel">
        <div
          aria-label={text.labels.contextTabs}
          className="workshop-context-tabs"
          role="tablist"
        >
          {renderContextRootTabButton("story", text.contextMenu.storyScope, contextRootTabCounts.story)}
          {renderContextRootTabButton("scenes", text.contextMenu.structureScope, contextRootTabCounts.scenes)}
          {renderContextRootTabButton("codex", text.contextMenu.codexScope, contextRootTabCounts.codex)}
          {renderContextRootTabButton("files", text.contextMenu.filesScope, contextRootTabCounts.files)}
        </div>
        {renderContextRootPanel()}
      </div>
    );
  }

  function renderSessionCreateControl() {
    return (
      <div className="workshop-session-create" data-workshop-floating-root>
        <button
          aria-expanded={isSessionCreateOpen}
          aria-label={text.labels.addSession}
          className="btn workshop-session-create-trigger"
          onClick={() => {
            setIsContextMenuOpen(false);
            setIsSessionActionsOpen(false);
            setOpenMessageMenuId(null);
            setIsSettingsOpen(false);
            setIsSessionCreateOpen((current) => !current);
          }}
          type="button"
        >
          {text.addSession}
        </button>
        {isSessionCreateOpen ? (
          <div className="workshop-session-create-menu" role="menu">
            <button onClick={() => void createSession("chat")} role="menuitem" type="button">
              <span>{text.sessionKinds.chat}</span>
              <small>{text.sessionKindDescriptions.chat}</small>
            </button>
            <button onClick={() => void createSession("agent")} role="menuitem" type="button">
              <span>{text.sessionKinds.agent}</span>
              <small>{text.sessionKindDescriptions.agent}</small>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderSessionActionsControl() {
    return (
      <div className="workshop-session-actions" data-workshop-floating-root>
        <button
          aria-expanded={isSessionActionsOpen}
          aria-label={text.labels.sessionActions}
          className="btn workshop-session-actions-trigger"
          disabled={!activeSession || deletingSessionId !== null || isCalling}
          onClick={() => {
            setIsContextMenuOpen(false);
            setIsSessionCreateOpen(false);
            setOpenMessageMenuId(null);
            setIsSettingsOpen(false);
            setIsSessionActionsOpen((current) => !current);
          }}
          type="button"
        >
          {text.sessionMenu.more}
        </button>
        {isSessionActionsOpen ? (
          <div className="workshop-session-action-menu" role="menu">
            <div className="workshop-session-menu-section">
              <div className="workshop-session-menu-label">{text.sessionMenu.thread}</div>
              <button
                disabled={!activeSession || deletingSessionId !== null || isCalling}
                onClick={archiveSession}
                role="menuitem"
                type="button"
              >
                {activeSession?.status === "archived" ? text.restore : text.archive}
              </button>
              <button
                disabled={
                  !activeSession ||
                  messages.length === 0 ||
                  !isEligibleWorkshopBranchSource(messages, messages.length - 1) ||
                  deletingSessionId !== null ||
                  isCalling
                }
                onClick={() => {
                  const source = messages.at(-1);
                  if (source) void branchFromMessage(source);
                }}
                role="menuitem"
                type="button"
              >
                {text.branch}
              </button>
              <button
                className="danger"
                disabled={!activeSession || deletingSessionId !== null || isCalling}
                onClick={() => void deleteSessionPermanently()}
                role="menuitem"
                type="button"
              >
                {deletingSessionId === activeSession?.id
                  ? text.labels.deletingSession
                  : text.labels.deleteSession}
              </button>
              <button disabled role="menuitem" type="button">{text.importThread}</button>
            </div>
            <div className="workshop-session-menu-section">
              <div className="workshop-session-menu-label">{text.sessionMenu.export}</div>
              <label className="workshop-export-toggle">
                <input
                  checked={includeReasoningInExport}
                  disabled={!activeSession || isExportingSession}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setIncludeReasoningInExport(event.target.checked)}
                  type="checkbox"
                />
                <span>{text.labels.includeReasoningInExport}</span>
              </label>
              <label className="workshop-export-toggle">
                <input
                  checked={includePromptAuditInExport}
                  disabled={!activeSession || isExportingSession}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setIncludePromptAuditInExport(event.target.checked)}
                  type="checkbox"
                />
                <span>{text.labels.includePromptAuditInExport}</span>
              </label>
              <button
                disabled={!activeSession || isDetailLoading || isExportingSession || isCalling}
                onClick={() => void exportActiveSession()}
                role="menuitem"
                type="button"
              >
                {isExportingSession ? text.labels.exportingSession : text.labels.exportSession}
              </button>
            </div>
          </div>
        ) : null}
      </div>
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
          data-workshop-floating-root
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
                disabled={activeSession?.kind !== "chat" || isSavingGeneralSystemPrompt}
                onChange={(event) => setGeneralSystemPrompt(event.target.value)}
                onBlur={() => {
                  if (activeSession?.kind !== "chat") return;
                  void persistGeneralSystemPrompt(activeSession).catch((caught) => {
                    setError(apiErrorMessage(caught));
                  });
                }}
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
    <section className="workshop-shell">
      <header className="workshop-topbar">
        <div className="workshop-topbar-title">
          <h1>{text.title}</h1>
          <span>{activeSession?.title ?? text.conversationTitle}</span>
        </div>
        <div className="workshop-topbar-actions">
          {renderSessionCreateControl()}
          {renderSessionActionsControl()}
        </div>
      </header>
      {renderSettingsDialog()}
      {error ? <p className="alert">{error}</p> : null}
      {statusMessage ? <p className="workshop-status-message">{statusMessage}</p> : null}
      {codexDraftResolution ? (
        <section className="workshop-codex-resolution" aria-label={text.codexDraft.creationTitle}>
          <div>
            <strong>{text.codexDraft.creationTitle}</strong>
            <p>{text.codexDraft.creationBody}</p>
            <p className={`workshop-codex-planner-state is-${codexDraftResolution.planner.status}`}>
              {codexDraftResolution.planner.message}
            </p>
          </div>
          <div className="workshop-codex-resolution-list">
            {codexDraftResolution.missingDetailTypes.map((detail) => {
              const choice = codexDraftResolution.choices[detail.label];
              const suggestedIds = new Set(detail.suggestions.map((suggestion) => suggestion.detailTypeId));
              const orderedTypes = [
                ...detail.suggestions.flatMap((suggestion) => {
                  const document = codexDraftResolution.availableDetailTypes.find(
                    (item) => item.detailType.id === suggestion.detailTypeId,
                  );
                  return document ? [document] : [];
                }),
                ...codexDraftResolution.availableDetailTypes.filter(
                  (document) => !suggestedIds.has(document.detailType.id),
                ),
              ];
              return (
                <div className="workshop-codex-resolution-row" key={detail.label}>
                  <span>
                    <strong>{detail.label}</strong>
                    {detail.valuePreview ? <small>{detail.valuePreview}</small> : null}
                  </span>
                  <div className="workshop-codex-resolution-control">
                    <select
                      aria-label={text.codexDraft.choiceLabel(detail.label)}
                      onChange={(event) => updateCodexResolutionChoice(detail.label, event.target.value)}
                      value={choice?.kind === "map" ? `map:${choice.detailTypeId}` : choice?.kind === "create" ? "create" : ""}
                    >
                      <option value="">{text.codexDraft.choicePlaceholder}</option>
                      {orderedTypes.map((document) => {
                        const suggestion = detail.suggestions.find(
                          (item) => item.detailTypeId === document.detailType.id,
                        );
                        return (
                          <option key={document.detailType.id} value={`map:${document.detailType.id}`}>
                            {suggestion?.recommended
                              ? text.codexDraft.recommendedType(document.detailType.name)
                              : document.detailType.name}
                          </option>
                        );
                      })}
                      <option value="create">{text.codexDraft.createNewType}</option>
                    </select>
                    {choice?.kind === "create" ? (
                      <div className="workshop-codex-creation-fields">
                        <input
                          aria-label={text.codexDraft.newTypeName(detail.label)}
                          onChange={(event) => updateCodexCreationChoice(detail.label, { name: event.target.value })}
                          value={choice.name}
                        />
                        <label>
                          <input
                            checked={choice.nsfw}
                            onChange={(event) => updateCodexCreationChoice(detail.label, { nsfw: event.target.checked })}
                            type="checkbox"
                          />
                          <span>{text.codexDraft.nsfw}</span>
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="workshop-codex-resolution-actions">
            <button
              className="btn compact subtle"
              onClick={() => setCodexDraftResolution(null)}
              type="button"
            >
              {text.codexDraft.creationCancel}
            </button>
            <button
              className="btn compact"
              disabled={applyingCodexDraftMessageId !== null || !codexResolutionComplete}
              onClick={() => void applyResolvedCodexDraft()}
              type="button"
            >
              {applyingCodexDraftMessageId === codexDraftResolution.messageId
                ? text.codexDraft.applying
                : text.codexDraft.creationApply}
            </button>
          </div>
        </section>
      ) : null}
      <div className="workshop-grid">
        <aside className="panel no-shadow workshop-sessions workshop-thread-dock">
          <div className="panel-head workshop-session-dock-head">
            <div className="workshop-session-dock-title">
              <div className="panel-title">{text.sessionsTitle}</div>
              <div className="panel-kicker">{text.sessionsKicker}</div>
            </div>
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
              editingSessionId === session.id ? (
                <form
                  className={`workshop-session-row is-editing${session.id === activeSessionId ? " is-active" : ""}`}
                  key={session.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void commitSessionTitleEdit();
                  }}
                >
                  <span className="workshop-session-copy">
                    <input
                      aria-label={text.labels.sessionTitle}
                      autoFocus
                      className="workshop-session-title-input"
                      onBlur={() => void commitSessionTitleEdit()}
                      onChange={(event) => setEditingSessionTitle(event.currentTarget.value)}
                      onKeyDown={handleSessionTitleKeyDown}
                      value={editingSessionTitle}
                    />
                    <span className="row-meta">
                      {text.sessionKinds[session.kind]}
                      {" / "}
                      {session.branchOfMessageId ? text.labels.branchSession : text.labels.threadSession}
                      {session.lastMessageAt ? ` / ${formatWorkshopDate(session.lastMessageAt)}` : ""}
                    </span>
                  </span>
                  <span className={sessionPillClass(session)}>
                    {sessionPillLabel(session)}
                  </span>
                </form>
              ) : (
                <button
                  className={`workshop-session-row${session.id === activeSessionId ? " is-active" : ""}`}
                  key={session.id}
                  onClick={() => activateSession(session.id)}
                  onDoubleClick={() => startSessionTitleEdit(session)}
                  type="button"
                >
                  <span className="workshop-session-copy">
                    <span className="row-title">{session.title}</span>
                    <span className="row-meta">
                      {text.sessionKinds[session.kind]}
                      {" / "}
                      {session.branchOfMessageId ? text.labels.branchSession : text.labels.threadSession}
                      {session.lastMessageAt ? ` / ${formatWorkshopDate(session.lastMessageAt)}` : ""}
                    </span>
                  </span>
                  <span className={sessionPillClass(session)}>
                    {sessionPillLabel(session)}
                  </span>
                </button>
              )
            ))}
          </div>
        </aside>

        <section className="panel chat workshop-chat" aria-label={text.conversationTitle}>
          <div className="panel-head workshop-conversation-head">
            <div className="workshop-thread-title">
              <h2>{activeSession?.title ?? text.conversationTitle}</h2>
              <div className="workshop-thread-meta">
                {activeSession ? (
                  <>
                    <span className={activeSession.kind === "agent" ? "pill amber" : "pill blue"}>
                      {text.sessionKinds[activeSession.kind]}
                    </span>
                    <span className={activeSession.status === "active" ? "pill green" : "pill muted"}>
                      {text.statusLabels[activeSession.status]}
                    </span>
                  </>
                ) : (
                  <span className="pill muted">{text.sessionsEmptyTitle}</span>
                )}
                {selectedModelProfile ? (
                  <span className="pill muted">{selectedModelProfile.title}</span>
                ) : null}
                {latestAgentRun ? (
                  <>
                    <span className={`pill ${latestAgentRun.run.status === "completed" ? "green" : latestAgentRun.run.status === "waiting-confirmation" ? "amber" : "muted"}`}>
                      {text.agentRun.status[latestAgentRun.run.status]}
                    </span>
                    {latestAgentRun.run.degradedStructuredOutput ? (
                      <span className="pill amber">{text.agentRun.degraded}</span>
                    ) : null}
                    {latestAgentRun.run.retryable ? (
                      <button
                        className="btn compact"
                        disabled={recoveringAgentRunId !== null}
                        onClick={() => void retryAgentRun(latestAgentRun)}
                        type="button"
                      >
                        {recoveringAgentRunId === latestAgentRun.run.id ? text.agentRun.retrying : text.agentRun.retry}
                      </button>
                    ) : null}
                    {latestAgentRun.run.status === "interrupted" || latestAgentRun.run.status === "failed" ? (
                      <button
                        className="btn compact"
                        disabled={recoveringAgentRunId !== null}
                        onClick={() => void abandonAgentRun(latestAgentRun)}
                        type="button"
                      >
                        {text.agentRun.abandon}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
            <div className="workshop-head-controls">
              <button
                aria-expanded={isSettingsOpen}
                className="btn compact workshop-settings-trigger"
                onClick={() => {
                  setIsContextMenuOpen(false);
                  setIsSessionCreateOpen(false);
                  setIsSessionActionsOpen(false);
                  setOpenMessageMenuId(null);
                  setIsSettingsOpen(true);
                }}
                type="button"
              >
                {text.labels.callSettings}
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
            {messages.map((message, messageIndex) => {
              const reasoningContent = (message.reasoningContent ?? "").trim();
              const messageAttachments = (message.attachmentIds ?? [])
                .map((attachmentId) => attachmentMap.get(attachmentId))
                .filter((attachment): attachment is WorkshopMessageAttachment => Boolean(attachment));
              const hasReasoningOverride = reasoningOverrideIds.has(message.id);
              const isReasoningExpanded = showReasoningByDefault
                ? !hasReasoningOverride
                : hasReasoningOverride;
              const canDeleteMessage = activeSession?.status === "active" &&
                activeSession.kind === "chat" &&
                workshopGeneralChatTurn(messages, messageIndex) !== null &&
                !isCalling;
              const canEditMessage = activeSession?.status === "active" &&
                activeSession.kind === "chat" &&
                message.role === "author" &&
                message.mode === "general-chat" &&
                message.status === "succeeded" &&
                message.proposalIds.length === 0 &&
                !isCalling;
              const canBranchMessage = isEligibleWorkshopBranchSource(messages, messageIndex) &&
                deletingSessionId === null &&
                !isCalling;
              const hasMessageActions = Boolean(
                reasoningContent || canBranchMessage || canDeleteMessage || canEditMessage,
              );
              const isMessageMenuOpen = openMessageMenuId === message.id;
              const isEditingMessage = editingMessageId === message.id;
              const codexToolName = message.role === "tool" && message.mode === "agent"
                ? codexToolRequestName(message.content)
                : null;
              return (
                <article
                  className={`message${message.role === "author" ? " author user" : message.role === "tool" ? " tool" : message.role === "assistant" ? " agent" : ""}${message.status === "failed" ? " is-failed" : ""}${message.status === "pending" ? " is-streaming" : ""}${message.id === selectedMessageId ? " is-target" : ""}`}
                  key={message.id}
                >
                  <div className="message-meta">
                    <span className={message.status === "failed" ? "pill amber" : message.status === "pending" ? "pill blue" : "pill muted"}>
                      {message.status === "pending" ? text.statusLabels.pending : text.roles[message.role]}
                    </span>
                    <span>{formatWorkshopDate(message.createdAt)}</span>
                    {hasMessageActions ? (
                      <div className="message-toolbar" data-workshop-floating-root>
                        <button
                          aria-expanded={isMessageMenuOpen}
                          aria-label={text.labels.messageActions}
                          className="btn compact subtle message-action-trigger"
                          onClick={() => {
                            setIsContextMenuOpen(false);
                            setIsSessionCreateOpen(false);
                            setIsSessionActionsOpen(false);
                            setIsSettingsOpen(false);
                            setOpenMessageMenuId(isMessageMenuOpen ? null : message.id);
                          }}
                          type="button"
                        >
                          {text.labels.messageActions}
                        </button>
                        {isMessageMenuOpen ? (
                          <div className="message-action-menu" role="menu">
                            {reasoningContent ? (
                              <button
                                aria-expanded={isReasoningExpanded}
                                className="btn compact subtle message-reasoning-toggle"
                                onClick={() => {
                                  toggleReasoning(message.id);
                                  setOpenMessageMenuId(null);
                                }}
                                role="menuitem"
                                type="button"
                              >
                                {isReasoningExpanded ? text.labels.hideReasoning : text.labels.showReasoning}
                              </button>
                            ) : null}
                            {canEditMessage && !isEditingMessage ? (
                              <button
                                className="btn compact subtle"
                                disabled={resendingMessageId !== null}
                                onClick={() => {
                                  beginEditMessage(message);
                                  setOpenMessageMenuId(null);
                                }}
                                role="menuitem"
                                type="button"
                              >
                                {text.labels.editMessage}
                              </button>
                            ) : null}
                            {canEditMessage && !isEditingMessage ? (
                              <button
                                className="btn compact subtle"
                                disabled={resendingMessageId !== null}
                                onClick={() => {
                                  setOpenMessageMenuId(null);
                                  void resendGeneralChatMessage(message);
                                }}
                                role="menuitem"
                                type="button"
                              >
                                {resendingMessageId === message.id
                                  ? text.labels.resendingMessage
                                  : text.labels.resendMessage}
                              </button>
                            ) : null}
                            {canBranchMessage ? (
                              <button
                                className="btn compact subtle"
                                onClick={() => void branchFromMessage(message)}
                                role="menuitem"
                                type="button"
                              >
                                {text.branch}
                              </button>
                            ) : null}
                            {canDeleteMessage ? (
                              <button
                                className="btn compact subtle"
                                disabled={deletingMessageId !== null}
                                onClick={() => {
                                  setOpenMessageMenuId(null);
                                  void deleteMessage(message);
                                }}
                                role="menuitem"
                                type="button"
                              >
                                {deletingMessageId === message.id
                                  ? text.labels.deletingTurn
                                  : text.labels.deleteTurn}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
                  {isEditingMessage ? (
                    <div className="workshop-message-edit">
                      <textarea
                        aria-label={text.labels.editMessageLabel}
                        className="input workshop-message-edit-input"
                        onChange={(event) => setEditingMessageContent(event.target.value)}
                        value={editingMessageContent}
                      />
                      <div className="workshop-message-edit-actions">
                        <button
                          className="btn primary compact"
                          disabled={resendingMessageId !== null || !editingMessageContent.trim()}
                          onClick={() => void resendGeneralChatMessage(message, editingMessageContent)}
                          type="button"
                        >
                          {resendingMessageId === message.id
                            ? text.labels.resendingMessage
                            : text.labels.resendMessage}
                        </button>
                        <button
                          className="btn compact"
                          disabled={resendingMessageId !== null}
                          onClick={cancelEditMessage}
                          type="button"
                        >
                          {text.labels.cancelEditMessage}
                        </button>
                      </div>
                    </div>
                  ) : (message.role !== "tool" && message.content) || message.status === "pending" ? (
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
                            <span className={proposalStatusClass(document.proposal.status)}>
                              {uiText.review.statusLabels[document.proposal.status]}
                            </span>
                            <span className="pill blue">{proposalTargetKindLabel(document.proposal.target.kind)}</span>
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
                message.role === "tool" &&
                message.mode === "agent" &&
                message.status === "succeeded" &&
                codexToolName ? (
                  <div className="workshop-tool-call" aria-label={text.codexDraft.toolCallTitle}>
                    <div>
                      <strong>{text.codexDraft.toolCallTitle}</strong>
                      <span>
                        {codexToolName === "codex.create_entry"
                          ? text.codexDraft.toolNameCreateEntry
                          : text.codexDraft.toolNameUpdateEntry}
                      </span>
                    </div>
                    {message.toolExecution && !(message.toolExecution.status === "interrupted" && message.toolExecution.retryable) ? (
                      <span className={`pill ${message.toolExecution.status === "succeeded" ? "green" : message.toolExecution.status === "interrupted" ? "amber" : "muted"}`}>
                        {message.toolExecution.status === "succeeded"
                          ? text.codexDraft.executionSucceeded
                          : message.toolExecution.status === "running"
                            ? text.codexDraft.executionRunning
                            : message.toolExecution.status === "interrupted"
                              ? text.codexDraft.executionInterrupted
                              : text.codexDraft.executionFailed}
                      </span>
                    ) : (
                      <button
                        className="btn success compact"
                        disabled={applyingCodexDraftMessageId !== null}
                        onClick={() => void executeCodexToolFromMessage(message)}
                        type="button"
                      >
                        {applyingCodexDraftMessageId === message.id
                          ? text.codexDraft.applying
                          : message.toolExecution?.status === "interrupted"
                            ? text.codexDraft.retry
                            : text.codexDraft.apply}
                      </button>
                    )}
                  </div>
                ) : null}
                </article>
              );
            })}
          </div>
          <div className="composer workshop-composer">
            <div className="workshop-composer-context" data-workshop-floating-root>
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
                <div
                  aria-label={text.labels.contextTabs}
                  className={`workshop-context-menu${contextMenuView.kind === "root" ? " is-root" : " is-list"}`}
                  role="dialog"
                >
                  {renderContextMenuContent()}
                </div>
              ) : null}
            </div>
            <textarea
              aria-label={text.labels.messageInput}
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
    </section>
  );
}
