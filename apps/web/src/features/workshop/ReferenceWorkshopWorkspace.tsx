import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type {
  CodexCategoryDocument,
  CodexDetailTypeDocument,
  CodexEntryDocument,
  ModelParameters,
  ModelProfile,
  ProviderModelDescriptor,
  ProviderReasoningControl,
  ProposalDocument,
  ReasoningConfiguration,
  SceneDocument,
  SeriesDetail,
  WorkshopAgentRunDocument,
  WorkshopCallResult,
  WorkshopCallStreamEvent,
  WorkshopCodexCreateEntryToolError,
  WorkshopContextBasket,
  WorkshopContextItemKind,
  WorkshopContextItemRef,
  WorkshopConversationKind,
  WorkshopMessage,
  WorkshopMessageAttachment,
  WorkshopSession,
} from "@novel-studio/contracts";
import { normalizeReasoningConfigurationForModel } from "@novel-studio/contracts";

import { ApiError, api } from "../../api";
import type { ProjectSessionState } from "../../app/useProjectSession";
import { uiText } from "../../app/uiText";
import { ReferenceSurface } from "../../ui/ReferenceSurface";
import { categoryLabel } from "../codex/codexViewModel";
import { isEligibleWorkshopBranchSource, workshopGeneralChatTurn } from "./workshopConversation";
import {
  attachmentStatusLabel,
  codexEntryMentionedInText,
  fileToBase64,
  formatWorkshopDate,
  selectedScopeTexts,
  titleFromChatStart,
  workshopExportFileName,
  type ComposerAttachment,
} from "./workshopViewModel";
import "./reference-workshop.css";

type SessionFilter = "all" | "chat" | "agent" | "archived";
type ContextTab = "story" | "structure" | "codex" | "files";
type ContextList = "volumes" | "chapters" | "acts" | "scenes" | "entries" | "details" | "categories" | null;
type SendState = "idle" | "sending" | "active" | "stopping";
type SessionDialog = "prompt" | "export" | null;
type CodexToolName = "codex.create_entry" | "codex.update_entry";

interface SessionContextMenu {
  sessionId: string;
  x: number;
  y: number;
}

interface ActiveOperation {
  id: string;
  kind: "call" | "resend";
  localAssistantId: string | null;
  localAuthorId: string | null;
  serverAuthorId: string | null;
  seriesGeneration: number;
  seriesId: string;
  sessionId: string;
  requestSettled: boolean;
  state: Exclude<SendState, "idle">;
  streaming: boolean;
  suppressLateEvents: boolean;
}

interface StreamTarget {
  assistantMessageId: string;
  attempt: number;
  modelCallId: string;
  operationId: string;
}

interface CodexDraftResolutionState {
  availableDetailTypes: WorkshopCodexCreateEntryToolError["availableDetailTypes"];
  choices: Record<string, { kind: "map"; detailTypeId: string } | { kind: "create"; name: string; nsfw: boolean } | undefined>;
  messageId: string;
  missingDetailTypes: WorkshopCodexCreateEntryToolError["missingDetailTypes"];
  planner: WorkshopCodexCreateEntryToolError["planner"];
  toolName: CodexToolName;
}

export interface ReferenceWorkshopWorkspaceProps {
  onActiveSessionChange?: (sessionId: string | null) => void;
  onOpenProviderSettings?: (sessionId: string | null) => void;
  onOpenProposal?: (proposalId: string) => void;
  requestedSessionId?: string | null;
  selectedMessageId?: string | null;
  session?: ProjectSessionState;
}

const text = uiText.workshop;
const LONG_PRESS_MS = 560;
const LINKED_CODEX_NOTE = "Linked from selected context.";
const MODAL_FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function workshopSessionKey(seriesId: string, sessionId: string) {
  return `${seriesId}:${sessionId}`;
}

function modalFocusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("*"))
    .filter((element) => (
      element.matches(MODAL_FOCUSABLE_SELECTOR)
      && !element.hidden
      && element.getAttribute("aria-hidden") !== "true"
    ));
}

function apiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const payload = error.payload as { message?: unknown } | string;
    if (typeof payload === "object" && typeof payload.message === "string") return payload.message;
    if (typeof payload === "string") return payload;
  }
  return error instanceof Error ? error.message : text.errors.requestFailed;
}

function codexToolRequestName(content: string): CodexToolName | null {
  try {
    const parsed = JSON.parse(content) as { schemaVersion?: unknown; tool?: unknown };
    return parsed.schemaVersion === 1 && (parsed.tool === "codex.create_entry" || parsed.tool === "codex.update_entry")
      ? parsed.tool
      : null;
  } catch {
    return null;
  }
}

function codexDraftError(error: unknown): WorkshopCodexCreateEntryToolError | null {
  if (!(error instanceof ApiError) || typeof error.payload !== "object" || !error.payload) return null;
  const payload = error.payload as Partial<WorkshopCodexCreateEntryToolError>;
  return payload.code === "CODEX_DETAIL_TYPE_CREATION_REQUIRED" &&
    Array.isArray(payload.missingDetailTypes) &&
    Array.isArray(payload.availableDetailTypes) &&
    payload.planner !== undefined
    ? payload as WorkshopCodexCreateEntryToolError
    : null;
}

function sessionMark(session: WorkshopSession) {
  return session.kind === "agent" ? "AG" : "CH";
}

function sessionSecondary(session: WorkshopSession) {
  if (session.status === "archived") return text.statusLabels.archived;
  return session.kind === "agent" ? text.sessionKinds.agent : text.sessionKinds.chat;
}

function controlForDescriptor(descriptor: ProviderModelDescriptor | null): ProviderReasoningControl {
  return descriptor?.reasoning ?? { kind: "unsupported" };
}

function effectiveReasoningPreference(
  control: ProviderReasoningControl,
  preference: ReasoningConfiguration | null,
) {
  try {
    return normalizeReasoningConfigurationForModel(control, preference);
  } catch {
    return normalizeReasoningConfigurationForModel(control, null);
  }
}

function reasoningValue(value: ReasoningConfiguration | null) {
  if (!value) return "unsupported";
  if (value.mode === "effort") return `effort:${value.effort}`;
  if (value.mode === "budget") return `budget:${value.budgetTokens}`;
  return value.mode;
}

function replaceMessage(current: WorkshopMessage[], localId: string, message: WorkshopMessage) {
  const targetIds = new Set([localId, message.id]);
  const firstIndex = current.findIndex((item) => targetIds.has(item.id));
  if (firstIndex < 0) return [...current, message];
  const next = current.filter((item) => !targetIds.has(item.id));
  next.splice(firstIndex, 0, message);
  return next;
}

function messageStatus(message: WorkshopMessage) {
  return String(message.status);
}

function Icon({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <svg aria-hidden={label ? undefined : true} aria-label={label} viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

export function ReferenceWorkshopWorkspace(props: ReferenceWorkshopWorkspaceProps = {}) {
  if (!props.session) return <ReferenceSurface selector="#workshop-workspace" />;
  return <ConnectedReferenceWorkshopWorkspace {...props} session={props.session} />;
}

function ConnectedReferenceWorkshopWorkspace({
  onActiveSessionChange,
  onOpenProviderSettings,
  onOpenProposal,
  requestedSessionId = null,
  selectedMessageId = null,
  session: projectSession,
}: ReferenceWorkshopWorkspaceProps & { session: ProjectSessionState }) {
  const series = projectSession.activeSeries;
  const seriesId = series?.manifest.id ?? null;
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkshopMessage[]>([]);
  const [attachments, setAttachments] = useState<WorkshopMessageAttachment[]>([]);
  const [draftAttachments, setDraftAttachments] = useState<ComposerAttachment[]>([]);
  const [agentRuns, setAgentRuns] = useState<WorkshopAgentRunDocument[]>([]);
  const [basket, setBasket] = useState<WorkshopContextBasket | null>(null);
  const [proposals, setProposals] = useState<ProposalDocument[]>([]);
  const [codexCategories, setCodexCategories] = useState<CodexCategoryDocument[]>([]);
  const [codexDetailTypes, setCodexDetailTypes] = useState<CodexDetailTypeDocument[]>([]);
  const [codexEntries, setCodexEntries] = useState<CodexEntryDocument[]>([]);
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([]);
  const [selectedModelProfileId, setSelectedModelProfileId] = useState<string | null>(null);
  const [pendingReasoningPreferences, setPendingReasoningPreferences] = useState<Record<string, ReasoningConfiguration>>({});
  const [selectedModelDescriptor, setSelectedModelDescriptor] = useState<ProviderModelDescriptor | null>(null);
  const [descriptorProfileId, setDescriptorProfileId] = useState<string | null>(null);
  const [descriptorLoading, setDescriptorLoading] = useState(false);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [sessionSearch, setSessionSearch] = useState("");
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [sessionContextMenu, setSessionContextMenu] = useState<SessionContextMenu | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const [sessionDialog, setSessionDialog] = useState<SessionDialog>(null);
  const [sessionDialogReturnFocusId, setSessionDialogReturnFocusId] = useState<string | null>(null);
  const [pendingSessionFocusId, setPendingSessionFocusId] = useState<string | null>(null);
  const [generalSystemPrompt, setGeneralSystemPrompt] = useState("");
  const [generalSystemPromptTargetId, setGeneralSystemPromptTargetId] = useState<string | null>(null);
  const [includeReasoningInExport, setIncludeReasoningInExport] = useState(false);
  const [includePromptAuditInExport, setIncludePromptAuditInExport] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextTab, setContextTab] = useState<ContextTab>("story");
  const [contextList, setContextList] = useState<ContextList>(null);
  const [contextEntryFilter, setContextEntryFilter] = useState<{ kind: "category" | "detail"; id: string; label: string } | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [runtimeOptionsOpen, setRuntimeOptionsOpen] = useState(false);
  const [useStreamingResponses, setUseStreamingResponses] = useState(true);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [messageMenuPlacement, setMessageMenuPlacement] = useState<"above" | "below">("above");
  const [collapsedReasoningIds, setCollapsedReasoningIds] = useState<Set<string>>(() => new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState("");
  const [composer, setComposer] = useState("");
  const [draftToken, setDraftToken] = useState(randomId);
  const [operationsBySession, setOperationsBySession] = useState<Record<string, ActiveOperation>>({});
  const [backgroundActivityBySession, setBackgroundActivityBySession] = useState<Record<string, true>>({});
  const [toolReviewMessageId, setToolReviewMessageId] = useState<string | null>(null);
  const [codexDraftResolution, setCodexDraftResolution] = useState<CodexDraftResolutionState | null>(null);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [readySessionKey, setReadySessionKey] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionDialogRef = useRef<HTMLElement>(null);
  const toolReviewDialogRef = useRef<HTMLElement>(null);
  const codexResolutionDialogRef = useRef<HTMLElement>(null);
  const modalReturnFocusRef = useRef<HTMLElement | null>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const sessionRowsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const cancelSessionRenameRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOpenedRef = useRef(false);
  const liveMessagesRef = useRef<Record<string, WorkshopMessage[]>>({});
  const activeSessionIdRef = useRef<string | null>(null);
  const composerRef = useRef(composer);
  const composerDraftsRef = useRef<Record<string, string>>({});
  const sessionsRef = useRef<WorkshopSession[]>([]);
  const sessionsSeriesIdRef = useRef<string | null>(null);
  const seriesIdRef = useRef<string | null>(seriesId);
  const seriesGenerationRef = useRef(0);
  const sessionLoadGenerationRef = useRef(0);
  const createSessionRequestRef = useRef<{ id: string; seriesGeneration: number; seriesId: string } | null>(null);
  const generalSystemPromptDirtyRef = useRef(false);
  const generalSystemPromptTargetIdRef = useRef<string | null>(null);
  const draftTokenRef = useRef(draftToken);
  const operationsBySessionRef = useRef<Record<string, ActiveOperation>>({});
  const backgroundActivityBySessionRef = useRef<Record<string, true>>({});
  const pendingReasoningPreferencesRef = useRef<Record<string, ReasoningConfiguration>>({});
  const streamTargetsRef = useRef<Record<string, StreamTarget>>({});
  const fallbackAbortRef = useRef<Record<string, AbortController>>({});

  const activeSession = useMemo(
    () => sessions.find((item) => item.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const contextMenuSession = useMemo(
    () => sessions.find((item) => item.id === sessionContextMenu?.sessionId) ?? null,
    [sessionContextMenu, sessions],
  );
  const activeModelProfiles = useMemo(
    () => modelProfiles.filter((profile) => profile.archivedAt === null),
    [modelProfiles],
  );
  const selectedModelProfile = useMemo(
    () => activeModelProfiles.find((profile) => profile.id === selectedModelProfileId) ?? activeModelProfiles[0] ?? null,
    [activeModelProfiles, selectedModelProfileId],
  );
  const descriptorReady = Boolean(
    selectedModelProfile &&
    selectedModelDescriptor &&
    descriptorProfileId === selectedModelProfile.id &&
    !descriptorLoading,
  );
  const reasoningControl = controlForDescriptor(descriptorReady ? selectedModelDescriptor : null);
  const selectedPendingReasoningPreference = selectedModelProfile
    ? pendingReasoningPreferences[selectedModelProfile.id] ?? null
    : null;
  const reasoningPreferenceSaving = Boolean(selectedModelProfile && selectedPendingReasoningPreference);
  const reasoningPreference = selectedModelProfile
    ? effectiveReasoningPreference(
      reasoningControl,
      selectedPendingReasoningPreference ?? selectedModelProfile.reasoningPreference,
    )
    : null;
  const activeCodexCategories = useMemo(
    () => codexCategories.filter((document) => !document.category.archivedAt),
    [codexCategories],
  );
  const activeCodexEntries = useMemo(
    () => codexEntries.filter((entry) => !entry.metadata.archivedAt),
    [codexEntries],
  );
  const proposalMap = useMemo(
    () => new Map(proposals.map((document) => [document.proposal.id, document])),
    [proposals],
  );
  const attachmentMap = useMemo(
    () => new Map(attachments.map((attachment) => [attachment.id, attachment])),
    [attachments],
  );
  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLocaleLowerCase("en-US");
    return sessions.filter((item) => {
      if (sessionFilter === "archived") {
        if (item.status !== "archived") return false;
      } else {
        if (item.status === "archived") return false;
        if (sessionFilter !== "all" && item.kind !== sessionFilter) return false;
      }
      return !query || item.title.toLocaleLowerCase("en-US").includes(query);
    });
  }, [sessionFilter, sessionSearch, sessions]);
  const activeOperation = activeSessionId ? operationsBySession[activeSessionId] ?? null : null;
  const sendState: SendState = activeOperation?.state ?? "idle";
  const backgroundSessionBusy = Boolean(activeSessionId && backgroundActivityBySession[activeSessionId]);
  const modalOpen = Boolean(sessionDialog || toolReviewMessageId || codexDraftResolution);
  const modalIdentity = sessionDialog
    ? `session:${sessionDialog}`
    : toolReviewMessageId
      ? `tool:${toolReviewMessageId}`
      : codexDraftResolution
        ? `resolution:${codexDraftResolution.messageId}`
        : null;
  const sessionReady = Boolean(
    seriesId &&
    activeSessionId &&
    readySessionKey === workshopSessionKey(seriesId, activeSessionId),
  );
  const canSend = Boolean(
    sessionReady &&
    activeSession?.status === "active" &&
    selectedModelProfile &&
    descriptorReady &&
    (composer.trim() || draftAttachments.some((attachment) => attachment.parseStatus === "parsed")) &&
    draftAttachments.every((attachment) => attachment.parseStatus === "parsed") &&
    !backgroundSessionBusy &&
    !reasoningPreferenceSaving &&
    sendState === "idle",
  );

  function closeFloatingSurfaces(options: { restoreSessionFocus?: boolean } = {}) {
    const sessionId = sessionContextMenu?.sessionId ?? null;
    setNewMenuOpen(false);
    setSessionContextMenu(null);
    setContextOpen(false);
    setContextList(null);
    setContextEntryFilter(null);
    setModelMenuOpen(false);
    setRuntimeOptionsOpen(false);
    setMessageMenuId(null);
    if (options.restoreSessionFocus && sessionId) {
      setPendingSessionFocusId(sessionId);
    }
  }

  function replaceSessions(update: (current: WorkshopSession[]) => WorkshopSession[]) {
    const next = update(sessionsRef.current);
    sessionsRef.current = next;
    setSessions(next);
  }

  function setComposerDraft(value: string) {
    composerRef.current = value;
    setComposer(value);
  }

  function updateComposerDraft(value: string) {
    setComposerDraft(value);
    const targetSeriesId = seriesIdRef.current;
    const targetSessionId = activeSessionIdRef.current;
    if (targetSeriesId && targetSessionId) {
      composerDraftsRef.current[workshopSessionKey(targetSeriesId, targetSessionId)] = value;
    }
  }

  function setGeneralPromptDraft(value: string, dirty: boolean) {
    generalSystemPromptDirtyRef.current = dirty;
    setGeneralSystemPrompt(value);
  }

  function currentSeriesRequest(seriesId: string, seriesGeneration: number) {
    return seriesIdRef.current === seriesId && seriesGenerationRef.current === seriesGeneration;
  }

  function closeSessionDialogAndRestoreFocus() {
    const sessionId = sessionDialogReturnFocusId;
    setSessionDialog(null);
    setSessionDialogReturnFocusId(null);
    setGeneralPromptDraft("", false);
    generalSystemPromptTargetIdRef.current = null;
    setGeneralSystemPromptTargetId(null);
    if (sessionId) setPendingSessionFocusId(sessionId);
  }

  function openSessionDialogForContext(kind: Exclude<SessionDialog, null>) {
    if (!contextMenuSession) return;
    setSessionDialogReturnFocusId(contextMenuSession.id);
    if (kind === "prompt") {
      if (contextMenuSession.kind !== "chat" || contextMenuSession.status === "archived") return;
      generalSystemPromptTargetIdRef.current = contextMenuSession.id;
      setGeneralSystemPromptTargetId(contextMenuSession.id);
      setGeneralPromptDraft(contextMenuSession.generalChatSystemPrompt, false);
    }
    setSessionDialog(kind);
    setSessionContextMenu(null);
  }

  function trapModalTab(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = modalFocusableElements(event.currentTarget);
    if (!focusable.length) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    if (!pendingSessionFocusId) return;
    const row = sessionRowsRef.current[pendingSessionFocusId];
    if (!row) return;
    row.focus();
    setPendingSessionFocusId(null);
  }, [editingSessionId, pendingSessionFocusId, sessionDialog, sessionFilter, sessions]);

  useLayoutEffect(() => {
    if (!modalOpen) return;
    if (!modalReturnFocusRef.current && document.activeElement instanceof HTMLElement) {
      modalReturnFocusRef.current = document.activeElement;
    }
    const workspace = document.getElementById("workshop-workspace");
    const previousInert = workspace?.inert ?? false;
    if (workspace) workspace.inert = true;
    const activeDialog = () => sessionDialogRef.current ?? toolReviewDialogRef.current ?? codexResolutionDialogRef.current;
    function handleModalKeyDown(event: globalThis.KeyboardEvent) {
      const dialog = activeDialog();
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (sessionDialogRef.current) closeSessionDialogAndRestoreFocus();
        else if (toolReviewDialogRef.current) setToolReviewMessageId(null);
        else setCodexDraftResolution(null);
        return;
      }
    }
    document.addEventListener("keydown", handleModalKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleModalKeyDown, true);
      if (workspace) workspace.inert = previousInert;
      const returnTarget = modalReturnFocusRef.current;
      modalReturnFocusRef.current = null;
      queueMicrotask(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    };
    // The effect intentionally spans a tool-review-to-resolution transition as one modal interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  useLayoutEffect(() => {
    if (!modalIdentity) return;
    queueMicrotask(() => {
      const dialog = sessionDialogRef.current ?? toolReviewDialogRef.current ?? codexResolutionDialogRef.current;
      if (!dialog) return;
      (modalFocusableElements(dialog)[0] ?? dialog).focus();
    });
  }, [modalIdentity]);

  useEffect(() => {
    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-wr5-floating]")) return;
      closeFloatingSurfaces();
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (sessionDialog || toolReviewMessageId) return;
      closeFloatingSurfaces({ restoreSessionFocus: true });
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    for (const controller of Object.values(fallbackAbortRef.current)) controller.abort();
  }, []);

  function setSessionOperation(sessionId: string, operation: ActiveOperation | null) {
    const next = { ...operationsBySessionRef.current };
    if (operation) next[sessionId] = operation;
    else delete next[sessionId];
    operationsBySessionRef.current = next;
    setOperationsBySession(next);
  }

  function patchSessionOperation(sessionId: string, operationId: string, patch: Partial<ActiveOperation>) {
    const current = operationsBySessionRef.current[sessionId];
    if (!current || current.id !== operationId) return;
    setSessionOperation(sessionId, { ...current, ...patch });
  }

  function setBackgroundSessionActivity(sessionId: string, active: boolean) {
    const next = { ...backgroundActivityBySessionRef.current };
    if (active) next[sessionId] = true;
    else delete next[sessionId];
    backgroundActivityBySessionRef.current = next;
    setBackgroundActivityBySession(next);
  }

  function sessionHasActiveWork(sessionId: string) {
    return Boolean(
      operationsBySessionRef.current[sessionId] ||
      backgroundActivityBySessionRef.current[sessionId]
    );
  }

  function activateSession(sessionId: string | null) {
    const targetSeriesId = seriesIdRef.current;
    const previousSessionId = activeSessionIdRef.current;
    if (
      sessionId === previousSessionId &&
      targetSeriesId &&
      sessionsSeriesIdRef.current === targetSeriesId
    ) {
      onActiveSessionChange?.(sessionId);
      setToolReviewMessageId(null);
      setCodexDraftResolution(null);
      closeFloatingSurfaces();
      return;
    }
    if (targetSeriesId && previousSessionId) {
      composerDraftsRef.current[workshopSessionKey(targetSeriesId, previousSessionId)] = composerRef.current;
    }
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    onActiveSessionChange?.(sessionId);
    setReadySessionKey(null);
    setLoadingSession(Boolean(sessionId));
    setMessages([]);
    setBasket(null);
    setAttachments([]);
    setAgentRuns([]);
    setDraftAttachments([]);
    const nextDraftToken = randomId();
    draftTokenRef.current = nextDraftToken;
    setDraftToken(nextDraftToken);
    setComposerDraft(
      targetSeriesId && sessionId
        ? composerDraftsRef.current[workshopSessionKey(targetSeriesId, sessionId)] ?? ""
        : "",
    );
    setGeneralPromptDraft("", false);
    generalSystemPromptTargetIdRef.current = null;
    setGeneralSystemPromptTargetId(null);
    setSessionDialog(null);
    setSessionDialogReturnFocusId(null);
    setToolReviewMessageId(null);
    setCodexDraftResolution(null);
    setEditingMessageId(null);
    setEditingMessageContent("");
    closeFloatingSurfaces();
  }

  function updateSessionRecord(updated: WorkshopSession) {
    if (sessionsSeriesIdRef.current !== updated.seriesId) return;
    replaceSessions((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  function updateSessionMessages(
    sessionId: string,
    update: (current: WorkshopMessage[]) => WorkshopMessage[],
    targetSeriesId = seriesIdRef.current,
  ) {
    if (!targetSeriesId) return;
    const key = workshopSessionKey(targetSeriesId, sessionId);
    liveMessagesRef.current = {
      ...liveMessagesRef.current,
      [key]: update(liveMessagesRef.current[key] ?? []),
    };
    if (seriesIdRef.current === targetSeriesId && activeSessionIdRef.current === sessionId) setMessages(update);
  }

  function appendSessionMessages(sessionId: string, additions: WorkshopMessage[]) {
    updateSessionMessages(sessionId, (current) => [...current, ...additions]);
  }

  function clearLiveMessages(sessionId: string, targetSeriesId = seriesIdRef.current) {
    if (!targetSeriesId) return;
    const next = { ...liveMessagesRef.current };
    delete next[workshopSessionKey(targetSeriesId, sessionId)];
    liveMessagesRef.current = next;
  }

  async function loadSession(
    targetSeriesId: string,
    sessionId: string,
    seriesGeneration: number,
    sessionLoadGeneration: number,
  ) {
    try {
      const [detail, inbox, categories, detailTypes, entries] = await Promise.all([
        api.workshop.getSession(targetSeriesId, sessionId),
        api.proposals.list(targetSeriesId),
        api.codex.listCategories(targetSeriesId),
        api.codex.listDetailTypes(targetSeriesId),
        api.codex.listEntries(targetSeriesId, { includeArchived: false }),
      ]);
      if (
        !currentSeriesRequest(targetSeriesId, seriesGeneration) ||
        sessionLoadGenerationRef.current !== sessionLoadGeneration ||
        activeSessionIdRef.current !== sessionId
      ) return;
      const live = liveMessagesRef.current[workshopSessionKey(targetSeriesId, sessionId)] ?? [];
      const merged = [...detail.messages];
      for (const message of live) {
        const index = merged.findIndex((item) => item.id === message.id);
        if (index >= 0) merged[index] = message;
        else merged.push(message);
      }
      setMessages(merged.sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
      updateSessionRecord(detail.session);
      setBasket(detail.basket);
      setAttachments(detail.attachments ?? []);
      setAgentRuns(detail.agentRuns?.runs ?? []);
      setProposals(inbox.items);
      setCodexCategories(categories);
      setCodexDetailTypes(detailTypes);
      setCodexEntries(entries);
      if (!(generalSystemPromptDirtyRef.current && generalSystemPromptTargetIdRef.current === sessionId)) {
        generalSystemPromptTargetIdRef.current = sessionId;
        setGeneralSystemPromptTargetId(sessionId);
        setGeneralPromptDraft(detail.session.kind === "chat" ? detail.session.generalChatSystemPrompt : "", false);
      }
      setReadySessionKey(workshopSessionKey(targetSeriesId, sessionId));
    } catch (caught) {
      if (
        currentSeriesRequest(targetSeriesId, seriesGeneration) &&
        sessionLoadGenerationRef.current === sessionLoadGeneration &&
        activeSessionIdRef.current === sessionId
      ) setError(apiErrorMessage(caught));
    } finally {
      if (
        currentSeriesRequest(targetSeriesId, seriesGeneration) &&
        sessionLoadGenerationRef.current === sessionLoadGeneration &&
        activeSessionIdRef.current === sessionId
      ) setLoadingSession(false);
    }
  }

  async function loadWorkshop(targetSeriesId: string, seriesGeneration: number) {
    try {
      const [nextSessions, profiles] = await Promise.all([
        api.workshop.listSessions(targetSeriesId),
        api.ai.listModelProfiles(),
      ]);
      if (!currentSeriesRequest(targetSeriesId, seriesGeneration)) return;
      replaceSessions(() => nextSessions);
      setModelProfiles(profiles);
      const currentProfile = profiles.find((profile) => profile.id === selectedModelProfileId && !profile.archivedAt) ??
        profiles.find((profile) => !profile.archivedAt) ?? null;
      setSelectedModelProfileId(currentProfile?.id ?? null);
      setSelectedModelDescriptor(null);
      setDescriptorProfileId(null);
      const preferredSession = nextSessions.find((item) => item.id === activeSessionIdRef.current) ??
        nextSessions.find((item) => item.status === "active") ?? nextSessions[0] ?? null;
      activateSession(preferredSession?.id ?? null);
    } catch (caught) {
      if (currentSeriesRequest(targetSeriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    } finally {
      if (currentSeriesRequest(targetSeriesId, seriesGeneration)) setLoading(false);
    }
  }

  useEffect(() => {
    if (!seriesId || !activeSessionId || sessionsSeriesIdRef.current !== seriesId) return;
    const seriesGeneration = seriesGenerationRef.current;
    const sessionLoadGeneration = ++sessionLoadGenerationRef.current;
    setReadySessionKey(null);
    setLoadingSession(true);
    setError(null);
    void loadSession(seriesId, activeSessionId, seriesGeneration, sessionLoadGeneration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, seriesId]);

  useEffect(() => {
    draftTokenRef.current = draftToken;
  }, [draftToken]);

  useEffect(() => {
    const previousSeriesId = sessionsSeriesIdRef.current;
    const previousSessionId = activeSessionIdRef.current;
    if (previousSeriesId && previousSessionId) {
      composerDraftsRef.current[workshopSessionKey(previousSeriesId, previousSessionId)] = composerRef.current;
    }
    const seriesGeneration = ++seriesGenerationRef.current;
    seriesIdRef.current = seriesId;
    sessionsSeriesIdRef.current = seriesId;
    ++sessionLoadGenerationRef.current;
    createSessionRequestRef.current = null;
    setCreatingSession(false);
    for (const controller of Object.values(fallbackAbortRef.current)) controller.abort();
    fallbackAbortRef.current = {};
    operationsBySessionRef.current = {};
    setOperationsBySession({});
    backgroundActivityBySessionRef.current = {};
    setBackgroundActivityBySession({});
    streamTargetsRef.current = {};
    liveMessagesRef.current = {};
    sessionsRef.current = [];
    setSessions([]);
    activeSessionIdRef.current = null;
    setActiveSessionId(null);
    onActiveSessionChange?.(null);
    setMessages([]);
    setAttachments([]);
    setDraftAttachments([]);
    setAgentRuns([]);
    setBasket(null);
    setProposals([]);
    setCodexCategories([]);
    setCodexDetailTypes([]);
    setCodexEntries([]);
    setReadySessionKey(null);
    setLoadingSession(false);
    setSessionDialog(null);
    setToolReviewMessageId(null);
    setCodexDraftResolution(null);
    setGeneralPromptDraft("", false);
    generalSystemPromptTargetIdRef.current = null;
    setGeneralSystemPromptTargetId(null);
    setComposerDraft("");
    const nextDraftToken = randomId();
    draftTokenRef.current = nextDraftToken;
    setDraftToken(nextDraftToken);
    setError(null);
    setStatusMessage(null);
    setLoading(Boolean(seriesId));
    if (seriesId) void loadWorkshop(seriesId, seriesGeneration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  useEffect(() => {
    if (!requestedSessionId || requestedSessionId === activeSessionIdRef.current) return;
    if (sessions.some((item) => item.id === requestedSessionId)) activateSession(requestedSessionId);
    // The explicit return target is owned by the app shell and is only applied when it exists in this Series.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSessionId, sessions]);

  useEffect(() => {
    if (!selectedModelProfile) {
      setSelectedModelDescriptor(null);
      setDescriptorProfileId(null);
      setDescriptorLoading(false);
      return;
    }
    let cancelled = false;
    setSelectedModelDescriptor(null);
    setDescriptorProfileId(null);
    setDescriptorLoading(true);
    void api.ai.listProviderModels(selectedModelProfile.id)
      .then((descriptors) => {
        if (cancelled) return;
        setSelectedModelDescriptor(descriptors.find((descriptor) => descriptor.id === selectedModelProfile.model) ?? null);
        setDescriptorProfileId(selectedModelProfile.id);
        setDescriptorLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedModelDescriptor(null);
          setDescriptorProfileId(null);
          setDescriptorLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedModelProfile]);

  async function createSession(kind: WorkshopConversationKind) {
    if (!seriesId || sessionsSeriesIdRef.current !== seriesId || createSessionRequestRef.current) return;
    const seriesGeneration = seriesGenerationRef.current;
    const requestId = randomId();
    createSessionRequestRef.current = { id: requestId, seriesGeneration, seriesId };
    setCreatingSession(true);
    setNewMenuOpen(false);
    setError(null);
    try {
      const created = await api.workshop.createSession(seriesId, {
        kind,
        sceneId: null,
        title: text.defaultSessionTitle,
      });
      if (
        createSessionRequestRef.current?.id !== requestId ||
        !currentSeriesRequest(seriesId, seriesGeneration)
      ) return;
      replaceSessions((current) => [created, ...current]);
      activateSession(created.id);
    } catch (caught) {
      if (
        createSessionRequestRef.current?.id === requestId &&
        currentSeriesRequest(seriesId, seriesGeneration)
      ) setError(apiErrorMessage(caught));
    } finally {
      if (createSessionRequestRef.current?.id === requestId) {
        createSessionRequestRef.current = null;
        if (currentSeriesRequest(seriesId, seriesGeneration)) setCreatingSession(false);
      }
    }
  }

  function openSessionContextMenu(target: WorkshopSession, x: number, y: number) {
    activateSession(target.id);
    const maxX = Math.max(12, globalThis.innerWidth - 248);
    const maxY = Math.max(12, globalThis.innerHeight - 294);
    setSessionContextMenu({ sessionId: target.id, x: Math.max(12, Math.min(x, maxX)), y: Math.max(12, Math.min(y, maxY)) });
    queueMicrotask(() => sessionMenuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
  }

  function handleSessionKeyDown(event: KeyboardEvent<HTMLButtonElement>, target: WorkshopSession) {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    openSessionContextMenu(target, rect.left + 28, rect.top + 28);
  }

  function startLongPress(event: ReactPointerEvent<HTMLButtonElement>, target: WorkshopSession) {
    if (event.pointerType !== "touch") return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const { clientX, clientY } = event;
    longPressOpenedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressOpenedRef.current = true;
      openSessionContextMenu(target, clientX, clientY);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  async function commitSessionRename() {
    if (!seriesId || !editingSessionId) return;
    const seriesGeneration = seriesGenerationRef.current;
    if (cancelSessionRenameRef.current) {
      cancelSessionRenameRef.current = false;
      return;
    }
    const sessionId = editingSessionId;
    const title = editingSessionTitle.trim();
    const current = sessions.find((item) => item.id === sessionId);
    if (!title || !current || title === current.title) {
      setEditingSessionId(null);
      setPendingSessionFocusId(sessionId);
      return;
    }
    try {
      const updated = await api.workshop.updateSession(seriesId, sessionId, { title });
      if (!currentSeriesRequest(seriesId, seriesGeneration)) return;
      updateSessionRecord(updated);
      setEditingSessionId(null);
      setPendingSessionFocusId(sessionId);
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    }
  }

  async function persistGeneralPrompt() {
    const targetId = generalSystemPromptTargetId;
    const target = sessionsRef.current.find((item) => item.id === targetId);
    if (!seriesId || !targetId || target?.kind !== "chat" || target.status !== "active") return;
    const seriesGeneration = seriesGenerationRef.current;
    try {
      const updated = await api.workshop.updateSession(seriesId, targetId, {
        generalChatSystemPrompt: generalSystemPrompt.trim(),
      });
      if (!currentSeriesRequest(seriesId, seriesGeneration)) return;
      updateSessionRecord(updated);
      closeSessionDialogAndRestoreFocus();
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    }
  }

  async function archiveOrRestoreSession(target: WorkshopSession) {
    if (!seriesId || sessionsSeriesIdRef.current !== seriesId || sessionHasActiveWork(target.id)) return;
    const seriesGeneration = seriesGenerationRef.current;
    setBusySessionId(target.id);
    try {
      const updated = target.status === "archived"
        ? await api.workshop.restoreSession(seriesId, target.id)
        : await api.workshop.archiveSession(seriesId, target.id);
      if (!currentSeriesRequest(seriesId, seriesGeneration)) return;
      updateSessionRecord(updated);
      setSessionFilter(updated.status === "archived" ? "archived" : "all");
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    } finally {
      if (currentSeriesRequest(seriesId, seriesGeneration)) {
        setBusySessionId(null);
        closeFloatingSurfaces({ restoreSessionFocus: true });
      }
    }
  }

  async function deleteSession(target: WorkshopSession) {
    if (!seriesId || sessionsSeriesIdRef.current !== seriesId || sessionHasActiveWork(target.id)) return;
    if (!(globalThis.confirm?.(text.labels.deleteSessionConfirmNamed(target.title)) ?? false)) return;
    const seriesGeneration = seriesGenerationRef.current;
    const sessionId = target.id;
    setBusySessionId(sessionId);
    try {
      const result = await api.workshop.deleteSession(seriesId, sessionId);
      if (!currentSeriesRequest(seriesId, seriesGeneration)) return;
      clearLiveMessages(result.deletedId, seriesId);
      const remaining = sessionsRef.current.filter((item) => item.id !== result.deletedId);
      const replacementSessionId = remaining.find((item) => item.status === "active")?.id ?? remaining[0]?.id ?? null;
      replaceSessions(() => remaining);
      activateSession(replacementSessionId);
      if (replacementSessionId) setPendingSessionFocusId(replacementSessionId);
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    } finally {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setBusySessionId(null);
    }
  }

  async function exportSession() {
    const targetId = sessionDialogReturnFocusId;
    const target = sessionsRef.current.find((item) => item.id === targetId);
    if (!seriesId || !target) return;
    const seriesGeneration = seriesGenerationRef.current;
    setBusySessionId(target.id);
    try {
      const markdown = await api.workshop.exportSession(seriesId, target.id, {
        includePromptAudit: includePromptAuditInExport,
        includeReasoning: includeReasoningInExport,
      });
      if (!currentSeriesRequest(seriesId, seriesGeneration)) return;
      const blob = new Blob([markdown.startsWith("\uFEFF") ? markdown : `\uFEFF${markdown}`], { type: "text/markdown;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = workshopExportFileName(target);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      closeSessionDialogAndRestoreFocus();
      setStatusMessage(text.labels.exportReady);
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    } finally {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setBusySessionId(null);
    }
  }

  async function branchFromMessage(source: WorkshopMessage) {
    if (!seriesId || !activeSession || sessionHasActiveWork(activeSession.id)) return;
    const seriesGeneration = seriesGenerationRef.current;
    const sourceSession = activeSession;
    const sourceIndex = messages.findIndex((item) => item.id === source.id);
    if (!isEligibleWorkshopBranchSource(messages, sourceIndex)) return;
    try {
      const result = await api.workshop.branchSession(seriesId, sourceSession.id, {
        sourceMessageId: source.id,
        title: `${sourceSession.title} branch`,
      });
      if (!currentSeriesRequest(seriesId, seriesGeneration)) return;
      replaceSessions((current) => [result.session, ...current]);
      activateSession(result.session.id);
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    }
  }

  async function updateBasket(patch: Partial<WorkshopContextBasket>) {
    if (!seriesId || !activeSession || !basket) return;
    const seriesGeneration = seriesGenerationRef.current;
    const targetSessionId = activeSession.id;
    const updated = await api.workshop.updateContextBasket(seriesId, targetSessionId, patch);
    if (
      currentSeriesRequest(seriesId, seriesGeneration) &&
      activeSessionIdRef.current === targetSessionId
    ) setBasket(updated);
  }

  function linkedCodexEntries(items: WorkshopContextItemRef[]) {
    if (!series) return [];
    const source = selectedScopeTexts(series, items).join("\n\n");
    if (!source.trim()) return [];
    return activeCodexEntries.filter((entry) => (
      entry.metadata.aiContextPolicy === "always" ||
      (entry.metadata.aiContextPolicy === "on-mention" && codexEntryMentionedInText(entry, source))
    ));
  }

  function materializeLinkedCodex(items: WorkshopContextItemRef[]) {
    const linked = linkedCodexEntries(items);
    const linkedIds = new Set(linked.map((entry) => entry.metadata.id));
    const retained = items.filter((item) => !(
      item.kind === "codex-entry" && item.note === LINKED_CODEX_NOTE && !linkedIds.has(item.sourceId)
    ));
    const existingIds = new Set(retained.filter((item) => item.kind === "codex-entry").map((item) => item.sourceId));
    return [
      ...retained,
      ...linked.filter((entry) => !existingIds.has(entry.metadata.id)).map((entry) => ({
        id: randomId(),
        kind: "codex-entry" as const,
        sourceId: entry.metadata.id,
        label: entry.metadata.name,
        pinned: true,
        note: LINKED_CODEX_NOTE,
        createdAt: new Date().toISOString(),
      })),
    ];
  }

  async function toggleContextItem(kind: WorkshopContextItemKind, sourceId: string, label: string) {
    if (!basket) return;
    const existing = basket.items.find((item) => item.kind === kind && item.sourceId === sourceId);
    const next = existing
      ? basket.items.filter((item) => item.id !== existing.id)
      : [...basket.items, {
        id: randomId(),
        kind,
        sourceId,
        label,
        pinned: true,
        note: "",
        createdAt: new Date().toISOString(),
      }];
    try {
      await updateBasket({ items: materializeLinkedCodex(next) });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function clearContext() {
    try {
      await updateBasket({ blockId: null, items: [], sceneId: null, selection: null });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  function contextSelected(kind: WorkshopContextItemKind, sourceId: string) {
    return Boolean(basket?.items.some((item) => item.kind === kind && item.sourceId === sourceId));
  }

  async function uploadAttachment(file: File) {
    if (!seriesId || !activeSession) return;
    const uploadSeriesId = seriesId;
    const seriesGeneration = seriesGenerationRef.current;
    const uploadSessionId = activeSession.id;
    const uploadDraftToken = draftToken;
    const localId = randomId();
    const pending: ComposerAttachment = {
      schemaVersion: 1,
      id: localId,
      seriesId,
      sessionId: uploadSessionId,
      messageId: null,
      draftToken,
      fileName: file.name,
      mediaType: file.type || "application/octet-stream",
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
    try {
      const uploaded = await api.workshop.uploadAttachment(uploadSeriesId, uploadSessionId, {
        base64Content: await fileToBase64(file),
        draftToken,
        fileName: file.name,
        mediaType: pending.mediaType,
        sizeBytes: file.size,
      });
      if (
        currentSeriesRequest(uploadSeriesId, seriesGeneration) &&
        activeSessionIdRef.current === uploadSessionId &&
        draftTokenRef.current === uploadDraftToken
      ) {
        setDraftAttachments((current) => current.map((item) => item.id === localId ? uploaded : item));
        setAttachments((current) => [...current.filter((item) => item.id !== uploaded.id), uploaded]);
      }
    } catch (caught) {
      const message = apiErrorMessage(caught);
      if (
        currentSeriesRequest(uploadSeriesId, seriesGeneration) &&
        activeSessionIdRef.current === uploadSessionId &&
        draftTokenRef.current === uploadDraftToken
      ) {
        setDraftAttachments((current) => current.map((item) => item.id === localId ? {
          ...item,
          parseStatus: "failed",
          parseError: message,
          updatedAt: new Date().toISOString(),
        } : item));
        setError(message);
      }
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    for (const file of files) void uploadAttachment(file);
  }

  async function removeDraftAttachment(attachment: ComposerAttachment) {
    setDraftAttachments((current) => current.filter((item) => item.id !== attachment.id));
    if (!seriesId || attachment.parseStatus === "parsing" || !attachmentMap.has(attachment.id)) return;
    const seriesGeneration = seriesGenerationRef.current;
    try {
      await api.workshop.deleteAttachment(seriesId, attachment.sessionId, attachment.id);
      if (currentSeriesRequest(seriesId, seriesGeneration)) {
        setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      }
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    }
  }

  async function persistReasoningPreference(preference: ReasoningConfiguration) {
    const profile = selectedModelProfile;
    if (!profile || pendingReasoningPreferencesRef.current[profile.id]) return;
    const pending = {
      ...pendingReasoningPreferencesRef.current,
      [profile.id]: preference,
    };
    pendingReasoningPreferencesRef.current = pending;
    setPendingReasoningPreferences(pending);
    try {
      const updated = await api.ai.updateModelProfile(profile.id, { reasoningPreference: preference });
      setModelProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile));
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      const next = { ...pendingReasoningPreferencesRef.current };
      delete next[profile.id];
      pendingReasoningPreferencesRef.current = next;
      setPendingReasoningPreferences(next);
    }
  }

  async function selectModel(profileId: string) {
    setSelectedModelDescriptor(null);
    setDescriptorProfileId(null);
    setDescriptorLoading(true);
    setSelectedModelProfileId(profileId);
    setModelMenuOpen(false);
    setRuntimeOptionsOpen(false);
  }

  function callParameters(): ModelParameters {
    return (reasoningPreference ? { reasoning: reasoningPreference } : {}) as ModelParameters;
  }

  function bindAttachmentsToMessage(message: WorkshopMessage) {
    const ids = new Set(message.attachmentIds);
    if (!ids.size) return;
    setAttachments((current) => current.map((item) => ids.has(item.id) ? { ...item, messageId: message.id } : item));
  }

  function updateSessionFromMessage(message: WorkshopMessage) {
    if (sessionsSeriesIdRef.current !== message.seriesId) return;
    replaceSessions((current) => current.map((item) => item.id === message.sessionId ? {
      ...item,
      lastMessageAt: message.createdAt,
      updatedAt: message.createdAt,
    } : item));
  }

  async function reconcileOperationFailure(
    targetSeriesId: string,
    seriesGeneration: number,
    operation: ActiveOperation,
  ) {
    if (!currentSeriesRequest(targetSeriesId, seriesGeneration)) return;
    const operationState = operationsBySessionRef.current[operation.sessionId];
    const streamedAssistantIds = new Set(
      Object.values(streamTargetsRef.current)
        .filter((target) => target.operationId === operation.id)
        .map((target) => target.assistantMessageId),
    );
    streamTargetsRef.current = Object.fromEntries(
      Object.entries(streamTargetsRef.current).filter(([, target]) => target.operationId !== operation.id),
    );
    try {
      const detail = await api.workshop.getSession(targetSeriesId, operation.sessionId);
      const current = operationsBySessionRef.current[operation.sessionId];
      if (
        !currentSeriesRequest(targetSeriesId, seriesGeneration) ||
        current?.id !== operation.id ||
        current.suppressLateEvents
      ) return;
      liveMessagesRef.current = {
        ...liveMessagesRef.current,
        [workshopSessionKey(targetSeriesId, operation.sessionId)]: detail.messages,
      };
      if (activeSessionIdRef.current === operation.sessionId) {
        setMessages(detail.messages);
        setAttachments(detail.attachments ?? []);
        setAgentRuns(detail.agentRuns?.runs ?? []);
        setBasket(detail.basket);
      }
      updateSessionRecord(detail.session);
    } catch {
      updateSessionMessages(
        operation.sessionId,
        (current) => current.filter((message) => (
          message.id !== operation.localAuthorId &&
          message.id !== operation.localAssistantId &&
          message.id !== operationState?.serverAuthorId &&
          !streamedAssistantIds.has(message.id)
        )),
        targetSeriesId,
      );
    }
  }

  function applyCallResult(
    sessionId: string,
    result: WorkshopCallResult,
    localAuthorId?: string,
    localAssistantId?: string,
  ) {
    updateSessionMessages(sessionId, (current) => {
      let next = localAuthorId ? replaceMessage(current, localAuthorId, result.authorMessage) : current;
      next = replaceMessage(next, localAssistantId ?? result.assistantMessage.id, result.assistantMessage);
      for (const toolMessage of result.toolMessages ?? []) next = replaceMessage(next, toolMessage.id, toolMessage);
      return next.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    });
    clearLiveMessages(sessionId);
    bindAttachmentsToMessage(result.authorMessage);
    updateSessionFromMessage(result.assistantMessage);
    if (result.agentRun && activeSessionIdRef.current === sessionId) {
      setAgentRuns((current) => [
        ...current.filter((item) => item.run.id !== result.agentRun!.run.id),
        result.agentRun!,
      ].sort((left, right) => left.run.createdAt.localeCompare(right.run.createdAt)));
    }
  }

  function eventBelongsToOperation(
    sessionId: string,
    operationId: string,
    event: { operationId?: string },
    allowTerminal = false,
  ) {
    const current = operationsBySessionRef.current[sessionId];
    return Boolean(
      event.operationId === operationId &&
      current?.id === operationId &&
      current.seriesId === seriesIdRef.current &&
      current.seriesGeneration === seriesGenerationRef.current &&
      (allowTerminal || !current.suppressLateEvents),
    );
  }

  function acceptAssistantStart(
    sessionId: string,
    operationId: string,
    event: Extract<WorkshopCallStreamEvent, { type: "assistant-start" | "metadata" }>,
  ) {
    if (!eventBelongsToOperation(sessionId, operationId, event)) return;
    const currentTarget = streamTargetsRef.current[event.assistantMessageId];
    if (currentTarget && event.attempt < currentTarget.attempt) return;
    streamTargetsRef.current[event.assistantMessageId] = {
      assistantMessageId: event.assistantMessageId,
      attempt: event.attempt,
      modelCallId: event.modelCallId,
      operationId,
    };
    updateSessionMessages(sessionId, (current) => {
      const index = current.findIndex((item) => item.id === event.assistantMessageId);
      if (index < 0) return current;
      return current.map((message, messageIndex) => messageIndex === index ? {
        ...message,
        content: event.reset ? "" : message.content,
        reasoningContent: event.reset ? "" : message.reasoningContent,
        contextBundleId: event.contextBundleId,
        modelCallId: event.modelCallId,
      } : message);
    });
    patchSessionOperation(sessionId, operationId, { state: "active" });
  }

  function acceptScopedDelta(
    sessionId: string,
    operationId: string,
    event: Extract<WorkshopCallStreamEvent, { type: "delta" | "reasoning-delta" }>,
  ) {
    if (!eventBelongsToOperation(sessionId, operationId, event)) return;
    const target = streamTargetsRef.current[event.assistantMessageId];
    if (!target || target.modelCallId !== event.modelCallId || target.attempt !== event.attempt) return;
    updateSessionMessages(sessionId, (current) => current.map((message) => {
      if (message.id !== event.assistantMessageId) return message;
      return event.type === "reasoning-delta"
        ? {
          ...message,
          reasoningContent: `${message.reasoningContent}${event.text}`,
          reasoningOutputKind: event.outputKind,
        }
        : { ...message, content: `${message.content}${event.text}` };
    }));
  }

  async function autoNameSession(
    targetSeriesId: string,
    seriesGeneration: number,
    session: WorkshopSession,
    requestText: string,
    sentAttachments: ComposerAttachment[],
    messageCountBeforeSend: number,
  ) {
    if (
      messageCountBeforeSend > 0 ||
      session.title !== text.defaultSessionTitle ||
      !currentSeriesRequest(targetSeriesId, seriesGeneration)
    ) return;
    const title = titleFromChatStart(
      requestText,
      sentAttachments,
      text.labels.attachmentOnlyRequest,
      text.defaultSessionTitle,
    );
    if (title === session.title) return;
    try {
      const currentBeforeRequest = sessionsRef.current.find((item) => item.id === session.id);
      if (currentBeforeRequest?.title !== text.defaultSessionTitle) return;
      const updated = await api.workshop.updateSession(targetSeriesId, session.id, {
        title,
        expectedTitle: text.defaultSessionTitle,
      });
      const currentAfterRequest = sessionsRef.current.find((item) => item.id === session.id);
      if (
        currentSeriesRequest(targetSeriesId, seriesGeneration) &&
        currentAfterRequest?.title === text.defaultSessionTitle
      ) updateSessionRecord(updated);
    } catch {
      // A failed automatic title is non-blocking and never replaces a manual title.
    }
  }

  async function sendMessage() {
    if (!seriesId || !activeSession || !selectedModelProfile || !canSend) return;
    const seriesGeneration = seriesGenerationRef.current;
    const parsedAttachments = draftAttachments.filter((item) => item.parseStatus === "parsed");
    const requestText = composer.trim() || text.labels.attachmentOnlyRequest;
    const localAuthorId = randomId();
    const localAssistantId = randomId();
    const operation: ActiveOperation = {
      id: randomId(),
      kind: "call",
      localAssistantId,
      localAuthorId,
      serverAuthorId: null,
      seriesGeneration,
      seriesId,
      sessionId: activeSession.id,
      requestSettled: false,
      state: "sending",
      streaming: useStreamingResponses,
      suppressLateEvents: false,
    };
    const sendingSession = activeSession;
    const now = new Date().toISOString();
    const mode = activeSession.kind === "agent" ? "agent" as const : "general-chat" as const;
    const localAuthor: WorkshopMessage = {
      schemaVersion: 2,
      id: localAuthorId,
      seriesId,
      sessionId: activeSession.id,
      role: "author",
      mode,
      status: "succeeded",
      content: requestText,
      reasoningContent: "",
      reasoningOutputKind: "none",
      contextBundleId: null,
      modelCallId: null,
      proposalIds: [],
      attachmentIds: parsedAttachments.map((item) => item.id),
      errorCode: null,
      errorMessage: null,
      createdAt: now,
    };
    const localAssistant: WorkshopMessage = {
      ...localAuthor,
      id: localAssistantId,
      role: "assistant",
      status: "pending",
      content: "",
      attachmentIds: [],
    };
    const payload = {
      operationId: operation.id,
      mode,
      userRequest: requestText,
      modelProfileId: selectedModelProfile.id,
      modelOverride: null,
      parameters: callParameters(),
      draftToken: parsedAttachments.length ? draftToken : null,
      attachmentIds: parsedAttachments.map((item) => item.id),
    };
    const messageCountBeforeSend = messages.length;
    setSessionOperation(sendingSession.id, operation);
    setError(null);
    setStatusMessage(null);
    appendSessionMessages(sendingSession.id, [localAuthor, ...(useStreamingResponses ? [localAssistant] : [])]);
    composerDraftsRef.current[workshopSessionKey(seriesId, sendingSession.id)] = "";
    setComposerDraft("");
    setDraftAttachments([]);
    setDraftToken(randomId());
    closeFloatingSurfaces();
    const abortController = new AbortController();
    fallbackAbortRef.current[operation.id] = abortController;
    let terminal = false;
    let firstServerAssistantId: string | null = null;
    try {
      if (useStreamingResponses) {
        await api.workshop.runCallStream(seriesId, sendingSession.id, payload, (event) => {
          if (event.type === "done") {
            if (!eventBelongsToOperation(sendingSession.id, operation.id, { operationId: event.result.operationId }, true)) return;
            terminal = true;
            applyCallResult(sendingSession.id, event.result, operation.localAuthorId ?? undefined, operation.localAssistantId ?? undefined);
            void autoNameSession(
              seriesId,
              seriesGeneration,
              sendingSession,
              requestText,
              parsedAttachments,
              messageCountBeforeSend,
            );
            setSessionOperation(sendingSession.id, null);
            streamTargetsRef.current = Object.fromEntries(
              Object.entries(streamTargetsRef.current).filter(([, target]) => target.operationId !== operation.id),
            );
            return;
          }
          if (!eventBelongsToOperation(sendingSession.id, operation.id, event)) return;
          if (event.type === "author-message") {
            patchSessionOperation(sendingSession.id, operation.id, { serverAuthorId: event.message.id });
            updateSessionMessages(sendingSession.id, (current) => replaceMessage(current, localAuthorId, event.message));
            bindAttachmentsToMessage(event.message);
          } else if (event.type === "assistant-start" || event.type === "metadata") {
            updateSessionMessages(sendingSession.id, (current) => {
              const existing = current.find((message) => message.id === event.assistantMessageId);
              if (existing) return current;
              const pending = {
                ...localAssistant,
                id: event.assistantMessageId,
                contextBundleId: event.contextBundleId,
                modelCallId: event.modelCallId,
                createdAt: new Date().toISOString(),
              };
              if (!firstServerAssistantId) {
                firstServerAssistantId = event.assistantMessageId;
                return replaceMessage(current, localAssistantId, pending);
              }
              return [...current, pending];
            });
            acceptAssistantStart(sendingSession.id, operation.id, event);
          } else if (event.type === "reasoning-delta" || event.type === "delta") {
            acceptScopedDelta(sendingSession.id, operation.id, event);
          } else if (event.type === "assistant-message") {
            updateSessionMessages(sendingSession.id, (current) => replaceMessage(current, event.message.id, event.message));
          } else if (event.type === "error") {
            if (event.assistantMessage) {
              updateSessionMessages(sendingSession.id, (current) => replaceMessage(current, event.assistantMessage!.id, event.assistantMessage!));
            }
            if (activeSessionIdRef.current === sendingSession.id) setError(event.message);
          }
        }, abortController.signal);
        if (!terminal) throw new Error(text.errors.requestFailed);
      } else {
        patchSessionOperation(sendingSession.id, operation.id, { state: "active" });
        const result = await api.workshop.runCall(seriesId, sendingSession.id, payload, abortController.signal);
        const current = operationsBySessionRef.current[sendingSession.id];
        if (result.operationId !== operation.id || current?.id !== operation.id || current.suppressLateEvents) return;
        terminal = true;
        applyCallResult(sendingSession.id, result, operation.localAuthorId ?? undefined, operation.localAssistantId ?? undefined);
        void autoNameSession(
          seriesId,
          seriesGeneration,
          sendingSession,
          requestText,
          parsedAttachments,
          messageCountBeforeSend,
        );
      }
    } catch (caught) {
      const current = operationsBySessionRef.current[sendingSession.id];
      if (!terminal && current?.id === operation.id && !current.suppressLateEvents) {
        if (activeSessionIdRef.current === sendingSession.id) setError(apiErrorMessage(caught));
        await reconcileOperationFailure(seriesId, seriesGeneration, operation);
      }
    } finally {
      const current = operationsBySessionRef.current[sendingSession.id];
      if (current?.id === operation.id && (terminal || current.state !== "stopping")) {
        setSessionOperation(sendingSession.id, null);
      } else if (current?.id === operation.id) {
        patchSessionOperation(sendingSession.id, operation.id, { requestSettled: true });
      }
      delete fallbackAbortRef.current[operation.id];
    }
  }

  async function stopSending() {
    if (!activeOperation || sendState === "stopping") return;
    const operation = activeOperation;
    if (!currentSeriesRequest(operation.seriesId, operation.seriesGeneration)) return;
    patchSessionOperation(operation.sessionId, operation.id, { state: "stopping", suppressLateEvents: true });
    try {
      const cancelled = await api.workshop.cancelCall(operation.seriesId, operation.sessionId, operation.id);
      const current = operationsBySessionRef.current[operation.sessionId];
      if (
        cancelled.operationId === operation.id &&
        current?.id === operation.id &&
        currentSeriesRequest(operation.seriesId, operation.seriesGeneration)
      ) {
        applyCallResult(
          operation.sessionId,
          cancelled.result,
          operation.localAuthorId ?? undefined,
          operation.localAssistantId ?? undefined,
        );
        setSessionOperation(operation.sessionId, null);
        streamTargetsRef.current = Object.fromEntries(
          Object.entries(streamTargetsRef.current).filter(([, target]) => target.operationId !== operation.id),
        );
        if (operation.kind === "resend") {
          const detail = await api.workshop.getSession(operation.seriesId, operation.sessionId);
          if (!currentSeriesRequest(operation.seriesId, operation.seriesGeneration)) return;
          liveMessagesRef.current = {
            ...liveMessagesRef.current,
            [workshopSessionKey(operation.seriesId, operation.sessionId)]: detail.messages,
          };
          if (activeSessionIdRef.current === operation.sessionId) {
            setMessages(detail.messages);
            setAttachments(detail.attachments ?? []);
            setAgentRuns(detail.agentRuns?.runs ?? []);
          }
          updateSessionRecord(detail.session);
        }
      }
    } catch (caught) {
      const current = operationsBySessionRef.current[operation.sessionId];
      if (current?.id === operation.id) {
        if (activeSessionIdRef.current === operation.sessionId) setError(apiErrorMessage(caught));
        patchSessionOperation(operation.sessionId, operation.id, { state: "active", suppressLateEvents: false });
        if (current.requestSettled) {
          await reconcileOperationFailure(operation.seriesId, operation.seriesGeneration, operation);
          const latest = operationsBySessionRef.current[operation.sessionId];
          if (latest?.id === operation.id) setSessionOperation(operation.sessionId, null);
        }
      }
    }
  }

  async function resendMessage(message: WorkshopMessage, content = message.content) {
    if (
      !seriesId ||
      !activeSession ||
      activeSession.kind !== "chat" ||
      !selectedModelProfile ||
      !descriptorReady ||
      reasoningPreferenceSaving ||
      sessionHasActiveWork(activeSession.id)
    ) return;
    const seriesGeneration = seriesGenerationRef.current;
    const nextContent = content.trim();
    if (!nextContent) return;
    const operation: ActiveOperation = {
      id: randomId(),
      kind: "resend",
      localAssistantId: null,
      localAuthorId: null,
      serverAuthorId: null,
      seriesGeneration,
      seriesId,
      sessionId: activeSession.id,
      requestSettled: false,
      state: "sending",
      streaming: false,
      suppressLateEvents: false,
    };
    const sendingSession = activeSession;
    setSessionOperation(sendingSession.id, operation);
    setBusyMessageId(message.id);
    try {
      patchSessionOperation(sendingSession.id, operation.id, { state: "active" });
      const result = await api.workshop.resendMessage(seriesId, sendingSession.id, message.id, {
        content: nextContent,
        modelProfileId: selectedModelProfile.id,
        modelOverride: null,
        operationId: operation.id,
        parameters: callParameters(),
      });
      const currentOperation = operationsBySessionRef.current[sendingSession.id];
      if (
        currentOperation?.id !== operation.id ||
        currentOperation.suppressLateEvents ||
        !currentSeriesRequest(seriesId, seriesGeneration)
      ) return;
      const deleted = new Set(result.deletedMessageIds);
      updateSessionMessages(sendingSession.id, (current) => {
        let next = current.filter((item) => !deleted.has(item.id));
        next = replaceMessage(next, message.id, result.authorMessage);
        next = replaceMessage(next, result.assistantMessage.id, result.assistantMessage);
        for (const toolMessage of result.toolMessages) next = replaceMessage(next, toolMessage.id, toolMessage);
        return next.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      });
      setAttachments((current) => current.filter((item) => !result.deletedAttachmentIds.includes(item.id)));
      setEditingMessageId(null);
      setEditingMessageContent("");
      updateSessionFromMessage(result.assistantMessage);
    } catch (caught) {
      const currentOperation = operationsBySessionRef.current[sendingSession.id];
      if (
        currentOperation?.id === operation.id &&
        !currentOperation.suppressLateEvents &&
        activeSessionIdRef.current === sendingSession.id
      ) setError(apiErrorMessage(caught));
    } finally {
      setBusyMessageId(null);
      const currentOperation = operationsBySessionRef.current[sendingSession.id];
      if (currentOperation?.id === operation.id && currentOperation.state !== "stopping") {
        setSessionOperation(sendingSession.id, null);
      } else if (currentOperation?.id === operation.id) {
        patchSessionOperation(sendingSession.id, operation.id, { requestSettled: true });
      }
    }
  }

  async function deleteTurn(message: WorkshopMessage) {
    if (
      !seriesId ||
      !activeSession ||
      sessionHasActiveWork(activeSession.id) ||
      !globalThis.confirm(text.labels.deleteTurnConfirm)
    ) return;
    const seriesGeneration = seriesGenerationRef.current;
    const targetSessionId = activeSession.id;
    setBusyMessageId(message.id);
    try {
      const result = await api.workshop.deleteMessage(seriesId, targetSessionId, message.id);
      if (!currentSeriesRequest(seriesId, seriesGeneration)) return;
      const deleted = new Set(result.deletedMessageIds);
      updateSessionMessages(
        targetSessionId,
        (current) => current.filter((item) => !deleted.has(item.id)),
        seriesId,
      );
      if (activeSessionIdRef.current === targetSessionId) {
        setAttachments((current) => current.filter((item) => !result.deletedAttachmentIds.includes(item.id)));
      }
      replaceSessions((current) => current.map((item) => item.id === result.session.id ? result.session : item));
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    } finally {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setBusyMessageId(null);
    }
  }

  async function executeCodexToolFromMessage(
    message: WorkshopMessage,
    resolution: {
      detailCreations: Array<{ label: string; name: string; nsfw: boolean }>;
      detailMappings: Array<{ label: string; detailTypeId: string }>;
    } | null = null,
    requireConfirmation = true,
  ) {
    if (!seriesId || !activeSession || sessionHasActiveWork(activeSession.id)) return;
    const targetSeriesId = seriesId;
    const seriesGeneration = seriesGenerationRef.current;
    const targetSessionId = activeSession.id;
    const toolName = codexToolRequestName(message.content);
    if (!toolName) return;
    if (requireConfirmation && !globalThis.confirm(
      toolName === "codex.create_entry" ? text.codexDraft.confirmCreate : text.codexDraft.confirmUpdate,
    )) return;
    setBusyMessageId(message.id);
    setBackgroundSessionActivity(targetSessionId, true);
    setError(null);
    try {
      const result = toolName === "codex.create_entry"
        ? await api.workshop.executeCodexCreateEntryTool(targetSeriesId, targetSessionId, message.id, {
          confirm: true,
          createMissingDetailTypes: Boolean(resolution?.detailCreations.length),
          detailCreations: resolution?.detailCreations ?? [],
          detailMappings: resolution?.detailMappings ?? [],
        })
        : await api.workshop.executeCodexUpdateEntryTool(targetSeriesId, targetSessionId, message.id, {
          confirm: true,
          createMissingDetailTypes: Boolean(resolution?.detailCreations.length),
          detailCreations: resolution?.detailCreations ?? [],
          detailMappings: resolution?.detailMappings ?? [],
        });
      if (!currentSeriesRequest(targetSeriesId, seriesGeneration)) return;
      setCodexDetailTypes((current) => [
        ...current,
        ...result.createdDetailTypes.filter((created) =>
          !current.some((existing) => existing.detailType.id === created.detailType.id),
        ),
      ]);
      setCodexEntries((current) => [result.entry, ...current.filter((entry) => entry.metadata.id !== result.entry.metadata.id)]);
      updateSessionMessages(targetSessionId, (current) => {
        let next = replaceMessage(current, result.message.id, result.message);
        next = replaceMessage(next, result.resultMessage.id, result.resultMessage);
        for (const continuation of result.continuationMessages ?? []) next = replaceMessage(next, continuation.id, continuation);
        return next.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      });
      if (result.agentRun) {
        setAgentRuns((current) => [
          ...current.filter((document) => document.run.id !== result.agentRun!.run.id),
          result.agentRun!,
        ].sort((left, right) => left.run.createdAt.localeCompare(right.run.createdAt)));
      }
      updateSessionFromMessage(result.continuationMessages?.at(-1) ?? result.resultMessage);
      setCodexDraftResolution(null);
      setToolReviewMessageId(null);
      setStatusMessage(
        toolName === "codex.create_entry"
          ? text.codexDraft.created(result.entry.metadata.name)
          : text.codexDraft.updated(result.entry.metadata.name),
      );
    } catch (caught) {
      if (!currentSeriesRequest(targetSeriesId, seriesGeneration)) return;
      const mappingError = codexDraftError(caught);
      if (mappingError) {
        setCodexDraftResolution({
          availableDetailTypes: mappingError.availableDetailTypes,
          choices: Object.fromEntries(mappingError.missingDetailTypes.map((detail) => {
            const recommended = detail.suggestions.find((suggestion) => suggestion.recommended);
            return [detail.label, recommended ? { kind: "map" as const, detailTypeId: recommended.detailTypeId } : undefined];
          })),
          messageId: message.id,
          missingDetailTypes: mappingError.missingDetailTypes,
          planner: mappingError.planner,
          toolName,
        });
        setToolReviewMessageId(null);
      } else {
        setError(apiErrorMessage(caught));
        const sessionLoadGeneration = ++sessionLoadGenerationRef.current;
        setReadySessionKey(null);
        setLoadingSession(true);
        await loadSession(targetSeriesId, targetSessionId, seriesGeneration, sessionLoadGeneration);
      }
    } finally {
      setBackgroundSessionActivity(targetSessionId, false);
      if (currentSeriesRequest(targetSeriesId, seriesGeneration)) setBusyMessageId(null);
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
      if (choice.kind === "map") detailMappings.push({ label: detail.label, detailTypeId: choice.detailTypeId });
      else if (choice.name.trim()) detailCreations.push({ label: detail.label, name: choice.name.trim(), nsfw: choice.nsfw });
      else return;
    }
    await executeCodexToolFromMessage(message, { detailCreations, detailMappings }, false);
  }

  function updateCodexResolutionChoice(label: string, value: string) {
    if (!codexDraftResolution) return;
    const choice = value === "create"
      ? { kind: "create" as const, name: label, nsfw: false }
      : value.startsWith("map:")
        ? { kind: "map" as const, detailTypeId: value.slice(4) }
        : undefined;
    setCodexDraftResolution({
      ...codexDraftResolution,
      choices: { ...codexDraftResolution.choices, [label]: choice },
    });
  }

  function updateCodexCreationChoice(label: string, patch: { name?: string; nsfw?: boolean }) {
    if (!codexDraftResolution) return;
    const choice = codexDraftResolution.choices[label];
    if (!choice || choice.kind !== "create") return;
    setCodexDraftResolution({
      ...codexDraftResolution,
      choices: { ...codexDraftResolution.choices, [label]: { ...choice, ...patch } },
    });
  }

  async function retryAgentRun(document: WorkshopAgentRunDocument) {
    if (!seriesId || !activeSession || sessionHasActiveWork(activeSession.id)) return;
    const seriesGeneration = seriesGenerationRef.current;
    const targetSessionId = activeSession.id;
    setBusyMessageId(document.run.id);
    setBackgroundSessionActivity(targetSessionId, true);
    try {
      const result = await api.workshop.retryAgentRun(seriesId, targetSessionId, document.run.id, {
        baseRevision: document.revision,
      });
      if (!currentSeriesRequest(seriesId, seriesGeneration)) return;
      setAgentRuns((current) => [
        ...current.filter((item) => item.run.id !== result.agentRun.run.id),
        result.agentRun,
      ]);
      updateSessionMessages(targetSessionId, (current) => [result.assistantMessage, ...result.toolMessages].reduce(
        (next, message) => replaceMessage(next, message.id, message),
        current,
      ));
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    } finally {
      setBackgroundSessionActivity(targetSessionId, false);
      if (currentSeriesRequest(seriesId, seriesGeneration)) setBusyMessageId(null);
    }
  }

  async function abandonAgentRun(document: WorkshopAgentRunDocument) {
    if (
      !seriesId ||
      !activeSession ||
      sessionHasActiveWork(activeSession.id) ||
      !globalThis.confirm(text.agentRun.abandonConfirm)
    ) return;
    const seriesGeneration = seriesGenerationRef.current;
    const targetSessionId = activeSession.id;
    setBusyMessageId(document.run.id);
    try {
      const abandoned = await api.workshop.abandonAgentRun(seriesId, targetSessionId, document.run.id, {
        baseRevision: document.revision,
        reason: text.agentRun.abandonedByAuthor,
      });
      if (
        currentSeriesRequest(seriesId, seriesGeneration) &&
        activeSessionIdRef.current === targetSessionId
      ) setAgentRuns((current) => [...current.filter((item) => item.run.id !== abandoned.run.id), abandoned]);
    } catch (caught) {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setError(apiErrorMessage(caught));
    } finally {
      if (currentSeriesRequest(seriesId, seriesGeneration)) setBusyMessageId(null);
    }
  }

  function renderSessionSidebar(selectedSessionId: string | null) {
    const sessionCreationDisabled = creatingSession || loading || !seriesId;
    return (
      <aside aria-label={text.labels.workshopConversations} className="wr5-sessions">
        <header className="wr5-sessions-head">
          <h1>{text.title}</h1>
          <div className="wr5-new-wrap" data-wr5-floating>
            <button
              aria-busy={creatingSession}
              aria-expanded={newMenuOpen}
              aria-label={text.labels.newConversation}
              className="wr5-icon-button"
              disabled={sessionCreationDisabled}
              onClick={() => setNewMenuOpen((current) => !current)}
              type="button"
            ><Icon><path d="M12 5v14M5 12h14" /></Icon></button>
            {newMenuOpen ? <div className="wr5-new-menu is-open" role="menu">
              <button className="wr5-menu-item" disabled={creatingSession} onClick={() => void createSession("chat")} role="menuitem" type="button"><strong>{text.labels.createChatConversation}</strong></button>
              <button className="wr5-menu-item" disabled={creatingSession} onClick={() => void createSession("agent")} role="menuitem" type="button"><strong>{text.labels.createAgentConversation}</strong></button>
            </div> : null}
          </div>
        </header>
        <div className="wr5-session-tools"><label className="wr5-session-search"><Icon><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 4.5 4.5" /></Icon><input aria-label={text.labels.sessionSearch} onChange={(event) => setSessionSearch(event.currentTarget.value)} placeholder={text.labels.sessionSearch} value={sessionSearch} /></label><div aria-label={text.labels.conversationFilters} className="wr5-session-filters">{(["all", "chat", "agent", "archived"] as const).map((filter) => <button className={`wr5-session-filter${sessionFilter === filter ? " is-active" : ""}`} key={filter} onClick={() => setSessionFilter(filter)} type="button">{filter === "all" ? text.labels.allSessions : filter === "chat" ? text.labels.chatSessions : filter === "agent" ? text.labels.agentSessions : text.labels.archivedSessions}</button>)}</div></div>
        <div className="wr5-session-list">{filteredSessions.length ? filteredSessions.map((item) => (
          <div className="wr5-session-row" key={item.id}>
            {editingSessionId === item.id ? <form className="wr5-session-rename" onSubmit={(event) => { event.preventDefault(); void commitSessionRename(); }}><input aria-label={text.labels.sessionRenameLabel} autoFocus onBlur={() => void commitSessionRename()} onChange={(event) => setEditingSessionTitle(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelSessionRenameRef.current = true; setEditingSessionId(null); setPendingSessionFocusId(item.id); } }} value={editingSessionTitle} /></form> : <button
              aria-current={item.id === selectedSessionId ? "true" : undefined}
              className={`wr5-session${item.id === selectedSessionId ? " is-active" : ""}`}
              onClick={() => { if (longPressOpenedRef.current) { longPressOpenedRef.current = false; return; } activateSession(item.id); }}
              onContextMenu={(event) => { event.preventDefault(); openSessionContextMenu(item, event.clientX, event.clientY); }}
              onKeyDown={(event) => handleSessionKeyDown(event, item)}
              onPointerCancel={cancelLongPress}
              onPointerDown={(event) => startLongPress(event, item)}
              onPointerMove={cancelLongPress}
              onPointerUp={cancelLongPress}
              ref={(element) => { sessionRowsRef.current[item.id] = element; }}
              type="button"
            ><span className="wr5-session-mark">{sessionMark(item)}</span><span className="wr5-session-copy"><strong>{item.title}</strong><span>{sessionSecondary(item)}</span></span><time>{formatWorkshopDate(item.lastMessageAt ?? item.updatedAt)}</time></button>}
          </div>
        )) : <p className="wr5-session-empty">{text.labels.sessionSearchEmpty}</p>}</div>
      </aside>
    );
  }

  function renderEmptyConversation(message: string) {
    return <>
      {renderSessionSidebar(null)}
      <main className="wr5-conversation">
        <div className="wr5-thread-scroll"><div className="wr5-empty-state"><p>{message}</p></div></div>
      </main>
    </>;
  }

  function renderPlaceholder() {
    if (loading) return renderEmptyConversation(text.labels.loadingWorkshop);
    if (!activeSession) return renderEmptyConversation(text.labels.noSession);
    if (!series) return renderEmptyConversation(text.labels.noContextSources);
    const currentSession = activeSession;
    const currentSeries = series;

    const latestBranchSource = [...messages].reverse().find((message) =>
      isEligibleWorkshopBranchSource(messages, messages.findIndex((candidate) => candidate.id === message.id)),
    ) ?? null;
    const archived = activeSession.status === "archived";
    const operationLabel = sendState === "sending"
      ? text.labels.sending
      : sendState === "active"
        ? text.labels.stopSending
        : sendState === "stopping"
          ? text.labels.sendStopping
          : text.send;

    function renderContextOption(
      kind: WorkshopContextItemKind,
      sourceId: string,
      label: string,
      secondary?: string,
    ) {
      const selected = contextSelected(kind, sourceId);
      return (
        <button
          className={`wr5-context-option${selected ? " is-selected" : ""}`}
          key={`${kind}:${sourceId}`}
          onClick={() => void toggleContextItem(kind, sourceId, label)}
          type="button"
        >
          <span><strong>{label}</strong>{secondary ? <span>{secondary}</span> : null}</span>
          <em>{selected ? text.labels.inContext : text.insert}</em>
        </button>
      );
    }

    function renderContextList() {
      if (!contextList) return null;
      let title = "";
      let options: ReactNode = null;
      if (contextList === "volumes") {
        title = text.contextMenu.volumes;
        options = currentSeries.books.map((volume) => renderContextOption("volume", volume.id, volume.title));
      } else if (contextList === "chapters") {
        title = text.contextMenu.chapters;
        options = currentSeries.acts.map((chapter) => renderContextOption(
          "chapter",
          chapter.id,
          chapter.title,
          currentSeries.books.find((volume) => volume.id === chapter.bookId)?.title,
        ));
      } else if (contextList === "acts") {
        title = text.contextMenu.acts;
        options = currentSeries.chapters.map((act) => renderContextOption(
          "act",
          act.id,
          act.title,
          currentSeries.acts.find((chapter) => chapter.id === act.actId)?.title,
        ));
      } else if (contextList === "scenes") {
        title = text.contextMenu.scenes;
        options = currentSeries.scenes.map((scene) => renderContextOption(
          "scene",
          scene.metadata.id,
          scene.metadata.title,
          currentSeries.chapters.find((act) => act.id === scene.metadata.chapterId)?.title,
        ));
      } else if (contextList === "details") {
        title = text.contextMenu.entriesByDetail;
        options = codexDetailTypes.map((document) => (
          <button className="wr5-context-option" key={document.detailType.id} onClick={() => {
            setContextEntryFilter({ kind: "detail", id: document.detailType.id, label: document.detailType.name });
            setContextList("entries");
          }} type="button"><strong>{document.detailType.name}</strong><em>›</em></button>
        ));
      } else if (contextList === "categories") {
        title = text.contextMenu.entriesByCategory;
        options = activeCodexCategories.map((document) => (
          <button className="wr5-context-option" key={document.category.id} onClick={() => {
            setContextEntryFilter({ kind: "category", id: document.category.id, label: document.category.name });
            setContextList("entries");
          }} type="button"><strong>{document.category.name}</strong><em>›</em></button>
        ));
      } else {
        title = contextEntryFilter?.label ?? text.contextMenu.codexEntries;
        const entries = activeCodexEntries.filter((entry) => {
          if (!contextEntryFilter) return true;
          return contextEntryFilter.kind === "category"
            ? entry.metadata.categoryId === contextEntryFilter.id
            : Boolean(entry.metadata.details[contextEntryFilter.id]);
        });
        options = entries.map((entry) => renderContextOption(
          "codex-entry",
          entry.metadata.id,
          entry.metadata.name,
          categoryLabel(entry.metadata.categoryId, activeCodexCategories),
        ));
      }
      return (
        <section className="wr5-context-list">
          <button className="wr5-context-back" onClick={() => {
            if (contextList === "entries" && contextEntryFilter) {
              setContextList(contextEntryFilter.kind === "detail" ? "details" : "categories");
              setContextEntryFilter(null);
            } else setContextList(null);
          }} type="button">← <strong>{title}</strong></button>
          <div className="wr5-context-list-body">{options}</div>
        </section>
      );
    }

    function renderContextPopover() {
      if (!contextOpen) return null;
      if (contextList) return (
        <section aria-label={text.labels.chooseContext} className="wr5-popover wr5-context-popover is-open" data-wr5-floating role="dialog">
          {renderContextList()}
        </section>
      );
      return (
        <section aria-label={text.labels.chooseContext} className="wr5-popover wr5-context-popover is-open" data-wr5-floating role="dialog">
          <div className="wr5-context-root">
            <nav aria-label={text.labels.contextTabs} className="wr5-context-tabs" role="tablist">
              {(["story", "structure", "codex", "files"] as const).map((tab) => (
                <button
                  aria-selected={contextTab === tab}
                  className={`wr5-context-tab${contextTab === tab ? " is-active" : ""}`}
                  key={tab}
                  onClick={() => setContextTab(tab)}
                  role="tab"
                  type="button"
                ><span>{tab === "story" ? text.contextMenu.series : tab === "structure" ? text.contextMenu.structureScope : tab === "codex" ? text.contextMenu.codexScope : text.contextMenu.filesScope}</span></button>
              ))}
            </nav>
            <section className="wr5-context-pane" role="tabpanel">
              <header className="wr5-context-pane-head"><button className="wr5-button ghost" onClick={() => void clearContext()} type="button">{text.contextMenu.clear}</button></header>
              <div className="wr5-context-options">
                {contextTab === "story" ? <>
                  {renderContextOption("full-novel", currentSeries.manifest.id, text.contextMenu.fullNovel, text.contextMenu.fullNovelBody)}
                  {renderContextOption("full-outline", currentSeries.manifest.id, text.contextMenu.fullOutline, text.contextMenu.fullOutlineBody)}
                </> : null}
                {contextTab === "structure" ? <>
                  {(["volumes", "chapters", "acts", "scenes"] as const).map((list) => (
                    <button className="wr5-context-option" key={list} onClick={() => setContextList(list)} type="button">
                      <strong>{list === "volumes" ? text.contextMenu.volumes : list === "chapters" ? text.contextMenu.chapters : list === "acts" ? text.contextMenu.acts : text.contextMenu.scenes}</strong><em>›</em>
                    </button>
                  ))}
                </> : null}
                {contextTab === "codex" ? <>
                  <button className="wr5-context-option" onClick={() => setContextList("entries")} type="button"><strong>{text.contextMenu.codexEntries}</strong><em>›</em></button>
                  <button className="wr5-context-option" onClick={() => setContextList("details")} type="button"><strong>{text.contextMenu.entriesByDetail}</strong><em>›</em></button>
                  <button className="wr5-context-option" onClick={() => setContextList("categories")} type="button"><strong>{text.contextMenu.entriesByCategory}</strong><em>›</em></button>
                </> : null}
                {contextTab === "files" ? <>
                  {draftAttachments.map((attachment) => (
                    <button className="wr5-context-option is-selected" key={attachment.id} onClick={() => void removeDraftAttachment(attachment)} type="button"><strong>{attachment.fileName}</strong><em>{text.remove}</em></button>
                  ))}
                  <button className="wr5-context-option" onClick={() => fileInputRef.current?.click()} type="button"><strong>{text.labels.attachFile}</strong><em>+</em></button>
                </> : null}
              </div>
            </section>
          </div>
        </section>
      );
    }

    function renderReasoningControls() {
      if (reasoningControl.kind === "unsupported" || !reasoningPreference) {
        return <p className="wr5-runtime-note">{text.labels.reasoningUnsupported}</p>;
      }
      if (reasoningControl.kind === "toggle") {
        return (
          <label className="wr5-agent-option"><input
            checked={reasoningPreference.mode === "enabled"}
            disabled={reasoningPreferenceSaving || (!reasoningControl.canDisable && reasoningPreference.mode === "enabled")}
            onChange={(event) => void persistReasoningPreference({ mode: event.currentTarget.checked ? "enabled" : "disabled" })}
            type="checkbox"
          /> {text.labels.reasoningEnabled}</label>
        );
      }
      if (reasoningControl.kind === "effort") {
        return (
          <label className="wr5-runtime-field"><span>{text.labels.reasoningEffort}</span><select
            disabled={reasoningPreferenceSaving}
            onChange={(event) => {
              const value = event.currentTarget.value;
              void persistReasoningPreference(value === "disabled" ? { mode: "disabled" } : { mode: "effort", effort: value as Extract<ReasoningConfiguration, { mode: "effort" }>["effort"] });
            }}
            value={reasoningPreference.mode === "disabled" ? "disabled" : reasoningPreference.mode === "effort" ? reasoningPreference.effort : reasoningControl.defaultEffort}
          >
            {reasoningControl.canDisable ? <option value="disabled">{text.labels.reasoningDisabled}</option> : null}
            {reasoningControl.efforts.map((effort) => <option key={effort} value={effort}>{effort}</option>)}
          </select></label>
        );
      }
      const budgetMode = reasoningPreference.mode === "disabled"
        ? "disabled"
        : reasoningPreference.mode === "enabled"
          ? "dynamic"
          : "fixed";
      const currentBudget = reasoningPreference.mode === "budget"
        ? reasoningPreference.budgetTokens
        : reasoningControl.defaultBudgetTokens ?? reasoningControl.minimumTokens;
      return <div className="wr5-runtime-budget">
        <label className="wr5-runtime-field"><span>{text.labels.reasoningBudget}</span><select
          disabled={reasoningPreferenceSaving}
          onChange={(event) => {
            if (event.currentTarget.value === "disabled") void persistReasoningPreference({ mode: "disabled" });
            else if (event.currentTarget.value === "dynamic") void persistReasoningPreference({ mode: "enabled" });
            else void persistReasoningPreference({ mode: "budget", budgetTokens: currentBudget });
          }}
          value={budgetMode}
        >
          {reasoningControl.canDisable ? <option value="disabled">{text.labels.reasoningDisabled}</option> : null}
          {reasoningControl.supportsDynamicBudget ? <option value="dynamic">{text.labels.reasoningDynamic}</option> : null}
          <option value="fixed">{text.labels.reasoningBudgetFixed}</option>
        </select></label>
        {budgetMode === "fixed" ? <label className="wr5-runtime-field"><span>{reasoningControl.minimumTokens}–{reasoningControl.maximumTokens}</span><input
          defaultValue={currentBudget}
          disabled={reasoningPreferenceSaving}
          key={reasoningValue(reasoningPreference)}
          max={reasoningControl.maximumTokens}
          min={reasoningControl.minimumTokens}
          onBlur={(event) => {
            const value = event.currentTarget.valueAsNumber;
            if (!Number.isFinite(value) || value < reasoningControl.minimumTokens || value > reasoningControl.maximumTokens) {
              event.currentTarget.value = String(currentBudget);
              return;
            }
            void persistReasoningPreference({ mode: "budget", budgetTokens: value });
          }}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          type="number"
        /></label> : null}
      </div>;
    }

    function renderMessage(message: WorkshopMessage, index: number) {
      const toolName = message.role === "tool" ? codexToolRequestName(message.content) : null;
      if (toolName) {
        const pending = !message.toolExecution || ["planned", "waiting-confirmation", "interrupted", "failed"].includes(message.toolExecution.status);
        return (
          <article className="wr5-tool-request" key={message.id}>
            <header className="wr5-tool-head"><h3>{toolName === "codex.create_entry" ? text.codexDraft.toolNameCreateEntry : text.codexDraft.toolNameUpdateEntry}</h3><span className={`wr5-badge ${pending ? "amber" : "green"}`}>{pending ? text.labels.requestPending : text.statusLabels.succeeded}</span></header>
            <div className="wr5-tool-body"><p>{text.labels.requestDetails}</p></div>
            {pending && !archived ? <footer className="wr5-tool-actions"><button className="wr5-button primary" onClick={() => setToolReviewMessageId(message.id)} type="button">{text.labels.reviewRequest}</button></footer> : null}
          </article>
        );
      }
      const turn = workshopGeneralChatTurn(messages, index);
      const canResend = Boolean(turn && message.role === "author" && currentSession.kind === "chat" && !archived);
      const canBranch = isEligibleWorkshopBranchSource(messages, index) && !archived;
      const hasActions = canResend || canBranch;
      const messageActionCount = (canResend ? 3 : 0) + (canBranch ? 1 : 0);
      const historyActionsDisabled = sendState !== "idle" || backgroundSessionBusy;
      const collapsed = collapsedReasoningIds.has(message.id);
      return (
        <article className={`wr5-message${message.role === "author" ? " author" : ""}`} data-message-id={message.id} data-status={messageStatus(message)} key={message.id}>
          <div className="wr5-message-avatar">{message.role === "author" ? "YOU" : message.role === "assistant" ? "AI" : message.role.slice(0, 2).toUpperCase()}</div>
          <div className="wr5-message-content">
            <header className="wr5-message-meta"><span className="wr5-message-role"><strong>{message.role === "author" ? "You" : text.roles[message.role]}</strong></span><time>{formatWorkshopDate(message.createdAt)}</time></header>
            {message.reasoningContent ? <details
              className="wr5-reasoning"
              onToggle={(event) => {
                const open = event.currentTarget.open;
                setCollapsedReasoningIds((current) => {
                  const next = new Set(current);
                  if (open) next.delete(message.id); else next.add(message.id);
                  return next;
                });
              }}
              open={!collapsed}
            ><summary>{message.reasoningOutputKind === "summary" ? text.labels.reasoningSummary : text.labels.reasoning}</summary><p>{message.reasoningContent}</p></details> : null}
            {editingMessageId === message.id ? <div className="wr5-message-edit"><textarea aria-label={text.labels.editMessageLabel} onChange={(event) => setEditingMessageContent(event.currentTarget.value)} value={editingMessageContent} /><div><button className="wr5-button ghost" onClick={() => { setEditingMessageId(null); setEditingMessageContent(""); }} type="button">{text.labels.cancelEditMessage}</button><button className="wr5-button primary" disabled={!editingMessageContent.trim() || historyActionsDisabled || reasoningPreferenceSaving} onClick={() => void resendMessage(message, editingMessageContent)} type="button">{text.labels.editAndResend}</button></div></div> : <div className="wr5-prose"><p>{message.content || (message.status === "pending" ? text.labels.streaming : "")}</p></div>}
            {message.attachmentIds.map((attachmentId) => attachmentMap.get(attachmentId)).filter(Boolean).map((attachment) => <span className="wr5-attachment" key={attachment!.id}>{attachment!.fileName}</span>)}
            {message.proposalIds.length ? <div aria-label={text.proposals.cardsLabel} className="wr5-proposals">{message.proposalIds.map((proposalId) => {
              const proposal = proposalMap.get(proposalId);
              return <button className="wr5-button" disabled={!proposal || !onOpenProposal} key={proposalId} onClick={() => onOpenProposal?.(proposalId)} type="button">{proposal ? proposal.proposal.title : text.proposals.unavailable}</button>;
            })}</div> : null}
            {message.status === "failed" ? <p className="wr5-message-error">{message.errorMessage ?? text.labels.assistantFailed}</p> : null}
            {message.status === "cancelled" ? <p className="wr5-message-cancelled">{text.statusLabels.cancelled}</p> : null}
            {hasActions ? <div className="wr5-message-actions" data-wr5-floating>
              <button aria-expanded={messageMenuId === message.id} aria-label={text.labels.messageActionsIcon} className="wr5-icon-button" onClick={(event) => {
                if (messageMenuId === message.id) {
                  setMessageMenuId(null);
                  return;
                }
                const buttonTop = event.currentTarget.getBoundingClientRect().top;
                const threadTop = event.currentTarget.closest(".wr5-thread-scroll")?.getBoundingClientRect().top ?? 0;
                const estimatedMenuHeight = messageActionCount * 44 + 16;
                setMessageMenuPlacement(buttonTop - estimatedMenuHeight < threadTop + 8 ? "below" : "above");
                setMessageMenuId(message.id);
              }} type="button"><Icon><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Icon></button>
              {messageMenuId === message.id ? <div className={`wr5-message-menu opens-${messageMenuPlacement}`} role="menu">
                {canResend ? <><button disabled={historyActionsDisabled || reasoningPreferenceSaving} onClick={() => { setEditingMessageId(message.id); setEditingMessageContent(message.content); setMessageMenuId(null); }} role="menuitem" type="button">{text.labels.editAndResend}</button><button disabled={historyActionsDisabled || reasoningPreferenceSaving} onClick={() => void resendMessage(message)} role="menuitem" type="button">{text.labels.resendMessage}</button></> : null}
                {canBranch ? <button disabled={historyActionsDisabled} onClick={() => void branchFromMessage(message)} role="menuitem" type="button">{text.branch}</button> : null}
                {canResend ? <button className="danger" disabled={busyMessageId === message.id || historyActionsDisabled} onClick={() => void deleteTurn(message)} role="menuitem" type="button">{text.labels.deleteTurn}</button> : null}
              </div> : null}
            </div> : null}
          </div>
        </article>
      );
    }

    const latestAgentRun = agentRuns.at(-1) ?? null;
    return <>
      {renderSessionSidebar(currentSession.id)}
      <main className="wr5-conversation">
        <header className="wr5-conversation-head"><div className="wr5-conversation-title"><div className="wr5-conversation-title-row"><h2>{currentSession.title}</h2><span className={`wr5-badge ${currentSession.kind === "agent" ? "amber" : "blue"}`}>{text.sessionKinds[currentSession.kind]}</span></div><div className="wr5-conversation-meta"><span className="status-dot" /><span>{archived ? text.statusLabels.archived : text.labels.conversationSaved}</span></div></div><div className="wr5-head-actions"><button className="wr5-button" disabled={!latestBranchSource || archived || sendState !== "idle" || backgroundSessionBusy} onClick={() => latestBranchSource && void branchFromMessage(latestBranchSource)} type="button">{text.branch}</button></div></header>
        <div className="wr5-thread-scroll"><section className="wr5-thread">{loadingSession ? <div className="wr5-empty-state"><p>{text.labels.loadingSession}</p></div> : messages.length ? messages.map(renderMessage) : <article className="wr5-empty-state"><p>{text.labels.noMessages}</p></article>}{latestAgentRun && ["failed", "interrupted"].includes(latestAgentRun.run.status) ? <div className="wr5-run-state"><h3>{text.agentRun.status[latestAgentRun.run.status]}</h3>{!archived ? <div className="wr5-run-actions"><button className="wr5-button primary" disabled={busyMessageId === latestAgentRun.run.id || sendState !== "idle" || backgroundSessionBusy} onClick={() => void retryAgentRun(latestAgentRun)} type="button">{text.agentRun.retry}</button><button className="wr5-button danger" disabled={busyMessageId === latestAgentRun.run.id || sendState !== "idle" || backgroundSessionBusy} onClick={() => void abandonAgentRun(latestAgentRun)} type="button">{text.agentRun.abandon}</button></div> : null}</div> : null}</section></div>
        <footer className="wr5-composer-shell"><div className="wr5-composer"><div className="wr5-context-line">{basket?.items.map((item) => <span className={`wr5-context-chip${item.note === LINKED_CODEX_NOTE ? " linked" : ""}`} key={item.id}>{item.label}</span>)}</div><div className="wr5-composer-box"><div className="wr5-composer-toolbar"><div className="wr5-composer-tools">
          <button aria-expanded={contextOpen} className="wr5-composer-tool" disabled={archived || !sessionReady} onClick={() => { setContextOpen((current) => !current); setModelMenuOpen(false); setRuntimeOptionsOpen(false); }} type="button"><Icon><path d="M5 6h14M5 12h14M5 18h8" /></Icon>{text.contextTrigger} <strong>{basket?.items.length ?? 0}</strong></button>
          <button aria-expanded={modelMenuOpen} className="wr5-composer-tool" disabled={archived || !sessionReady} onClick={() => { setModelMenuOpen((current) => !current); setContextOpen(false); setRuntimeOptionsOpen(false); }} type="button"><Icon><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></Icon><span>{selectedModelProfile?.model ?? text.labels.modelProfileMissing}</span></button>
          <button aria-expanded={runtimeOptionsOpen} aria-label={text.labels.runtimeOptions} className="wr5-composer-tool wr5-icon-tool" disabled={!sessionReady || !descriptorReady || archived} onClick={() => { setRuntimeOptionsOpen((current) => !current); setContextOpen(false); setModelMenuOpen(false); }} title={descriptorLoading ? text.labels.modelListLoading : text.labels.runtimeOptions} type="button"><Icon><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></Icon></button>
          <button aria-label={text.labels.providerSettings} className="wr5-composer-tool wr5-icon-tool" disabled={archived} onClick={() => onOpenProviderSettings?.(currentSession.id)} title={text.labels.providerSettings} type="button"><Icon><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.5 1A8 8 0 0 0 14.4 6L14 3h-4l-.4 3a8 8 0 0 0-2 .9l-2.5-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.5-1a8 8 0 0 0 2 .9l.4 3h4l.4-3a8 8 0 0 0 2-.9l2.5 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></Icon></button>
        </div><button className="wr5-composer-tool" disabled={archived || !sessionReady} onClick={() => fileInputRef.current?.click()} type="button"><Icon><path d="M8 12.5l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8" /></Icon>{text.labels.attachFile}</button><input accept=".txt,.md,.doc,.docx,.pdf" aria-label={text.labels.attachmentInput} hidden multiple onChange={handleFiles} ref={fileInputRef} type="file" /></div>
          {draftAttachments.length ? <div className="wr5-draft-attachments">{draftAttachments.map((attachment) => <span className={`wr5-draft-attachment is-${attachment.parseStatus}`} key={attachment.id}>{attachment.fileName} · {attachmentStatusLabel(attachment.parseStatus, text)}<button aria-label={`${text.labels.removeAttachment}: ${attachment.fileName}`} onClick={() => void removeDraftAttachment(attachment)} type="button">×</button></span>)}</div> : null}
          <div className="wr5-composer-body"><textarea aria-label={text.labels.messageInput} disabled={archived || !sessionReady} onChange={(event) => updateComposerDraft(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as { isComposing?: boolean }).isComposing) { event.preventDefault(); if (canSend) void sendMessage(); } }} placeholder={archived ? text.statusLabels.archived : text.inputPlaceholder} value={composer} /><div className="wr5-send-actions"><button className={`wr5-button wr5-merged-send ${sendState === "idle" ? "primary" : sendState === "active" ? "danger" : "is-busy"}`} disabled={sendState === "idle" ? !canSend : sendState === "stopping"} onClick={() => sendState === "idle" ? void sendMessage() : void stopSending()} type="button">{sendState === "sending" || sendState === "stopping" ? <span aria-hidden="true" className="wr5-send-spinner" /> : null}<span>{operationLabel}</span></button></div></div>
        </div>{renderContextPopover()}{modelMenuOpen ? <section aria-label={text.labels.chooseModel} className="wr5-popover wr5-agent-popover is-open" data-wr5-floating role="dialog"><div className="wr5-model-list">{activeModelProfiles.map((profile) => <label className="wr5-model" key={profile.id}><input checked={selectedModelProfile?.id === profile.id} name="wr5-model" onChange={() => void selectModel(profile.id)} type="radio" /><strong>{profile.model}</strong></label>)}</div></section> : null}{runtimeOptionsOpen ? <section aria-label={text.labels.runtimeOptions} className="wr5-popover wr5-agent-popover wr5-runtime-popover is-open" data-wr5-floating role="dialog"><div className="wr5-agent-options"><label className="wr5-agent-option"><input checked={useStreamingResponses} onChange={(event) => setUseStreamingResponses(event.currentTarget.checked)} type="checkbox" /> {text.labels.streamResponsesFull}</label>{renderReasoningControls()}</div></section> : null}</div></footer>
      </main>
    </>;
  }

  return (
    <>
      <section aria-label="Workshop" className="wr5 workspace-view" data-workspace-view="Workshop" hidden id="workshop-workspace">
        {renderPlaceholder()}
      </section>
      {sessionContextMenu && contextMenuSession ? <div className="wr5-session-context-menu" data-wr5-floating ref={sessionMenuRef} role="menu" style={{ left: sessionContextMenu.x, top: sessionContextMenu.y }}>
        {contextMenuSession.status !== "archived" ? <button onClick={() => { cancelSessionRenameRef.current = false; setEditingSessionId(contextMenuSession.id); setEditingSessionTitle(contextMenuSession.title); setSessionContextMenu(null); }} role="menuitem" type="button">{text.labels.sessionRename}</button> : null}
        {contextMenuSession.status !== "archived" && contextMenuSession.kind === "chat" ? <button onClick={() => openSessionDialogForContext("prompt")} role="menuitem" type="button">{text.labels.generalSystemPrompt}</button> : null}
        <button onClick={() => openSessionDialogForContext("export")} role="menuitem" type="button">{text.labels.exportSession}</button>
        <button disabled={busySessionId === contextMenuSession.id || Boolean(operationsBySession[contextMenuSession.id]) || Boolean(backgroundActivityBySession[contextMenuSession.id])} onClick={() => void archiveOrRestoreSession(contextMenuSession)} role="menuitem" type="button">{contextMenuSession.status === "archived" ? text.restore : text.archive}</button>
        <button className="danger" disabled={busySessionId === contextMenuSession.id || Boolean(operationsBySession[contextMenuSession.id]) || Boolean(backgroundActivityBySession[contextMenuSession.id])} onClick={() => void deleteSession(contextMenuSession)} role="menuitem" type="button">{text.labels.deleteSession}</button>
      </div> : null}
      {sessionDialog ? <div className="wr5-modal-backdrop">
        <section aria-label={sessionDialog === "prompt" ? text.labels.generalSystemPromptDialog : text.labels.exportSessionDialog} aria-modal="true" className="wr5-simple-dialog" onKeyDownCapture={trapModalTab} ref={sessionDialogRef} role="dialog" tabIndex={-1}>
          <header><h2 id="wr5-session-dialog-title">{sessionDialog === "prompt" ? text.labels.generalSystemPrompt : text.labels.exportSessionTitle}</h2></header>
          {sessionDialog === "prompt" ? <>
            <p>{text.labels.generalSystemPromptDescription}</p>
            <textarea aria-label={text.labels.generalSystemPrompt} onChange={(event) => setGeneralPromptDraft(event.currentTarget.value, true)} value={generalSystemPrompt} />
          </> : <div className="wr5-dialog-options">
            <label><input checked={includeReasoningInExport} onChange={(event) => setIncludeReasoningInExport(event.currentTarget.checked)} type="checkbox" /> {text.labels.includeReasoningInExport}</label>
            <label><input checked={includePromptAuditInExport} onChange={(event) => setIncludePromptAuditInExport(event.currentTarget.checked)} type="checkbox" /> {text.labels.includePromptAuditInExport}</label>
          </div>}
          <footer>
            <button className="wr5-button ghost" onClick={closeSessionDialogAndRestoreFocus} type="button">{text.labels.cancelSessionDialog}</button>
            <button className="wr5-button primary" onClick={() => sessionDialog === "prompt" ? void persistGeneralPrompt() : void exportSession()} type="button">{sessionDialog === "prompt" ? text.labels.saveGeneralSystemPrompt : text.labels.exportSession}</button>
          </footer>
        </section>
      </div> : null}
      {toolReviewMessageId ? <div className="wr5-review-backdrop is-open" role="presentation">
        <section aria-labelledby="wr5-tool-review-title" aria-modal="true" className="wr5-review-dialog" onKeyDownCapture={trapModalTab} ref={toolReviewDialogRef} role="dialog" tabIndex={-1}>
          <header className="wr5-review-head"><h2 id="wr5-tool-review-title">{text.labels.requestReview}</h2><button aria-label={text.labels.closeRequestReview} className="wr5-icon-button" onClick={() => setToolReviewMessageId(null)} type="button"><Icon><path d="M6 6l12 12M18 6 6 18" /></Icon></button></header>
          <div className="wr5-review-body"><main className="wr5-review-main"><p>{text.labels.requestDetails}</p><pre className="wr5-tool-payload">{messages.find((message) => message.id === toolReviewMessageId)?.content}</pre></main></div>
          <footer className="wr5-review-foot"><span>{text.labels.requestPending}</span><div className="wr5-review-actions"><button className="wr5-button ghost" onClick={() => setToolReviewMessageId(null)} type="button">{text.labels.notNow}</button><button className="wr5-button primary" disabled={busyMessageId === toolReviewMessageId || sendState !== "idle" || backgroundSessionBusy} onClick={() => { const message = messages.find((item) => item.id === toolReviewMessageId); if (message) void executeCodexToolFromMessage(message, null, false); }} type="button">{text.labels.confirmAndRun}</button></div></footer>
        </section>
      </div> : null}
      {codexDraftResolution ? <div className="wr5-review-backdrop is-open" role="presentation">
        <section aria-labelledby="wr5-codex-resolution-title" aria-modal="true" className="wr5-review-dialog" onKeyDownCapture={trapModalTab} ref={codexResolutionDialogRef} role="dialog" tabIndex={-1}>
          <header className="wr5-review-head"><h2 id="wr5-codex-resolution-title">{text.codexDraft.creationTitle}</h2><button aria-label={text.codexDraft.creationCancel} className="wr5-icon-button" onClick={() => setCodexDraftResolution(null)} type="button"><Icon><path d="M6 6l12 12M18 6 6 18" /></Icon></button></header>
          <div className="wr5-review-body"><main className="wr5-review-main"><p>{text.codexDraft.creationBody}</p>{codexDraftResolution.missingDetailTypes.map((detail) => { const choice = codexDraftResolution.choices[detail.label]; return <article className="wr5-mapping" key={detail.label}><header className="wr5-mapping-head"><strong>{detail.label}</strong></header><label className="wr5-field"><span>{text.codexDraft.choiceLabel(detail.label)}</span><select onChange={(event) => updateCodexResolutionChoice(detail.label, event.currentTarget.value)} value={choice?.kind === "map" ? `map:${choice.detailTypeId}` : choice?.kind === "create" ? "create" : ""}><option value="">{text.codexDraft.choicePlaceholder}</option>{codexDraftResolution.availableDetailTypes.map((document) => <option key={document.detailType.id} value={`map:${document.detailType.id}`}>{document.detailType.name}</option>)}<option value="create">{text.codexDraft.createNewType}</option></select></label>{choice?.kind === "create" ? <><label className="wr5-field"><span>{text.codexDraft.newTypeName(detail.label)}</span><input onChange={(event) => updateCodexCreationChoice(detail.label, { name: event.currentTarget.value })} value={choice.name} /></label><label className="wr5-check"><input checked={choice.nsfw} onChange={(event) => updateCodexCreationChoice(detail.label, { nsfw: event.currentTarget.checked })} type="checkbox" /> {text.codexDraft.nsfw}</label></> : null}</article>; })}</main></div>
          <footer className="wr5-review-foot"><span>{codexDraftResolution.planner.message}</span><div className="wr5-review-actions"><button className="wr5-button ghost" onClick={() => setCodexDraftResolution(null)} type="button">{text.codexDraft.creationCancel}</button><button className="wr5-button primary" disabled={codexDraftResolution.missingDetailTypes.some((detail) => { const choice = codexDraftResolution.choices[detail.label]; return !choice || (choice.kind === "create" && !choice.name.trim()); })} onClick={() => void applyResolvedCodexDraft()} type="button">{text.codexDraft.creationApply}</button></div></footer>
        </section>
      </div> : null}
      <div aria-live="polite" className={`wr5-toast${error || statusMessage ? " is-visible" : ""}`} role={error ? "alert" : "status"}>{error ?? statusMessage}</div>
    </>
  );
}
