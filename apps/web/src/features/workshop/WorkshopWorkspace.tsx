import { useEffect, useMemo, useState } from "react";
import type {
  CodexEntryDocument,
  ContextBundle,
  ModelProfile,
  ProposalDocument,
  PromptTemplate,
  SceneDocument,
  SeriesDetail,
  WorkshopContextBasket,
  WorkshopContextItemRef,
  WorkshopMessage,
  WorkshopSession,
} from "@novel-studio/contracts";
import { ApiError, api } from "../../api";
import { uiText } from "../../app/uiText";
import "./workshop-workspace.css";

export interface WorkshopWorkspaceProps {
  onOpenProposal: (proposalId: string) => void;
  selectedMessageId: string | null;
  selectedScene: SceneDocument | null;
  selectedSessionId: string | null;
  series: SeriesDetail;
}

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

function contextKindLabel(kind: WorkshopContextItemRef["kind"]): string {
  const labels = uiText.workshop.labels;
  if (kind === "scene") return labels.sourceCurrentScene;
  if (kind === "selection") return labels.sourceSelection;
  if (kind === "codex-entry") return labels.sourceCodex;
  if (kind === "scene-section") return labels.sourceSection;
  if (kind === "research-note") return labels.sourceResearch;
  if (kind === "proposal-source") return labels.sourceProposal;
  return labels.sourceNote;
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

export function WorkshopWorkspace({
  onOpenProposal,
  selectedMessageId,
  selectedScene,
  selectedSessionId,
  series,
}: WorkshopWorkspaceProps) {
  const text = uiText.workshop;
  const seriesId = series.manifest.id;
  const defaultScene = selectedScene ?? series.scenes[0] ?? null;
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkshopMessage[]>([]);
  const [proposalDocuments, setProposalDocuments] = useState<ProposalDocument[]>([]);
  const [codexEntries, setCodexEntries] = useState<CodexEntryDocument[]>([]);
  const [basket, setBasket] = useState<WorkshopContextBasket | null>(null);
  const [contextPreview, setContextPreview] = useState<ContextBundle | null>(null);
  const [contextSourceValue, setContextSourceValue] = useState("");
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [composer, setComposer] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [creatingProposalMessageId, setCreatingProposalMessageId] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const proposalMap = useMemo(
    () => new Map(proposalDocuments.map((document) => [document.proposal.id, document])),
    [proposalDocuments],
  );
  const selectedModelProfile = useMemo(
    () => modelProfiles.find((profile) => profile.archivedAt === null) ?? null,
    [modelProfiles],
  );
  const selectedPromptTemplate = useMemo(
    () =>
      newestTemplateForRole(promptTemplates, "continuity-editor") ??
      promptTemplates.find((template) => template.archivedAt === null) ??
      null,
    [promptTemplates],
  );
  const contextScene = useMemo(
    () => (
      basket?.sceneId
        ? series.scenes.find((scene) => scene.metadata.id === basket.sceneId) ?? defaultScene
        : defaultScene
    ),
    [basket?.sceneId, defaultScene, series.scenes],
  );
  const contextSourceOptions = useMemo(() => [
    ...codexEntries
      .filter((entry) => !entry.metadata.archivedAt)
      .map((entry) => ({
        kind: "codex-entry" as const,
        label: `${text.labels.sourceCodex}: ${entry.metadata.name}`,
        sourceId: entry.metadata.id,
        value: `codex-entry:${entry.metadata.id}`,
      })),
    ...proposalDocuments.map((document) => ({
      kind: "proposal-source" as const,
      label: `${text.labels.sourceProposal}: ${document.proposal.title}`,
      sourceId: document.proposal.id,
      value: `proposal-source:${document.proposal.id}`,
    })),
  ], [codexEntries, proposalDocuments, text.labels.sourceCodex, text.labels.sourceProposal]);
  const canCall = Boolean(
    activeSession &&
    activeSession.status === "active" &&
    selectedPromptTemplate &&
    selectedModelProfile &&
    composer.trim() &&
    !isCalling,
  );
  const sceneReferenceText =
    (defaultScene?.plainText || defaultScene?.content || "").trim().slice(0, 280) ||
    text.labels.currentSceneEmpty;

  async function loadShell(preferredSessionId?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const [nextSessions, nextProfiles, nextTemplates] = await Promise.all([
        api.workshop.listSessions(seriesId),
        api.ai.listModelProfiles(),
        api.ai.listPromptTemplates(seriesId),
      ]);
      setSessions(nextSessions);
      setModelProfiles(nextProfiles);
      setPromptTemplates(nextTemplates);
      const nextActive =
        preferredSessionId ??
        (activeSessionId && nextSessions.some((session) => session.id === activeSessionId)
          ? activeSessionId
          : nextSessions.find((session) => session.status === "active")?.id ?? nextSessions[0]?.id ?? null);
      setActiveSessionId(nextActive);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSession(sessionId: string) {
    setIsDetailLoading(true);
    setError(null);
    try {
      const [detail, inbox, nextCodexEntries] = await Promise.all([
        api.workshop.getSession(seriesId, sessionId),
        api.proposals.list(seriesId),
        api.codex.listEntries(seriesId, { includeArchived: false }),
      ]);
      setBasket(detail.basket);
      setMessages(detail.messages);
      setProposalDocuments(inbox.items);
      setCodexEntries(nextCodexEntries);
      setContextSourceValue((current) => current || (
        nextCodexEntries.find((entry) => !entry.metadata.archivedAt)
          ? `codex-entry:${nextCodexEntries.find((entry) => !entry.metadata.archivedAt)!.metadata.id}`
          : inbox.items[0]
            ? `proposal-source:${inbox.items[0].proposal.id}`
            : ""
      ));
      setContextPreview(null);
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
      setContextPreview(null);
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
        sceneId: defaultScene?.metadata.id ?? null,
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
    setContextPreview(null);
  }

  async function addCurrentScene() {
    if (!activeSession || !basket) return;
    const scene = defaultScene;
    if (!scene) {
      setError(text.labels.noScene);
      return;
    }
    setError(null);
    const existing = basket.items.some((item) => item.kind === "scene" && item.sourceId === scene.metadata.id);
    const nextItems = existing
      ? basket.items
      : [
        ...basket.items,
        {
          id: randomId(),
          kind: "scene" as const,
          sourceId: scene.metadata.id,
          label: scene.metadata.title,
          pinned: true,
          note: "",
          createdAt: new Date().toISOString(),
        },
      ];
    try {
      await updateBasket({
        sceneId: scene.metadata.id,
        items: nextItems,
      });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function addSelectedContextSource() {
    if (!activeSession || !basket || !contextSourceValue) return;
    const option = contextSourceOptions.find((item) => item.value === contextSourceValue);
    if (!option) return;
    setError(null);
    const existing = basket.items.some((item) =>
      item.kind === option.kind && item.sourceId === option.sourceId,
    );
    const nextItems = existing
      ? basket.items
      : [
        ...basket.items,
        {
          id: randomId(),
          kind: option.kind,
          sourceId: option.sourceId,
          label: option.label.replace(/^[^:]+:\s*/u, ""),
          pinned: option.kind === "codex-entry",
          note: "",
          createdAt: new Date().toISOString(),
        },
      ];
    try {
      await updateBasket({ items: nextItems });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function togglePin(itemId: string) {
    if (!basket) return;
    try {
      await updateBasket({
        items: basket.items.map((item) =>
          item.id === itemId ? { ...item, pinned: !item.pinned } : item,
        ),
      });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function removeContextItem(itemId: string) {
    if (!basket) return;
    try {
      await updateBasket({ items: basket.items.filter((item) => item.id !== itemId) });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  async function clearBasket() {
    if (!basket) return;
    try {
      await updateBasket({ items: [] });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  function previewPayload() {
    if (!selectedPromptTemplate) throw new Error(text.labels.noPrompt);
    return {
      userRequest: composer.trim() || text.labels.defaultRequest,
      roleId: selectedPromptTemplate.roleId,
      taskKind: "continuity-check" as const,
      promptTemplateId: selectedPromptTemplate.id,
      promptTemplateVersion: selectedPromptTemplate.version,
      modelProfileId: selectedModelProfile?.id ?? null,
    };
  }

  async function previewContext() {
    if (!activeSession) return;
    setIsPreviewing(true);
    setError(null);
    try {
      const preview = await api.workshop.previewContext(seriesId, activeSession.id, previewPayload());
      setContextPreview(preview);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function sendMessage() {
    if (!activeSession || !selectedModelProfile || !selectedPromptTemplate || !composer.trim()) return;
    setIsCalling(true);
    setError(null);
    try {
      await api.workshop.runCall(seriesId, activeSession.id, {
        ...previewPayload(),
        modelProfileId: selectedModelProfile.id,
      });
      setComposer("");
      await loadSession(activeSession.id);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setIsCalling(false);
    }
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

  const includedCount = basket?.items.length ?? 0;
  const pinnedCount = basket?.items.filter((item) => item.pinned).length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">{text.title}</h2>
          <p className="page-subtitle">{text.subtitle}</p>
        </div>
        <span className="pill blue">{text.status}</span>
        <button className="btn" disabled type="button">{text.importThread}</button>
        <button className="btn primary" onClick={createSession} type="button">{text.newSession}</button>
      </div>
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
          <div className="panel-body row-list">
            {isLoading ? <p className="brief-text">{text.labels.loadingWorkshop}</p> : null}
            {!isLoading && sessions.length === 0 ? (
              <div className="unavailable-note">
                <h2>{text.sessionsEmptyTitle}</h2>
                <p>{text.sessionsEmptyBody}</p>
              </div>
            ) : null}
            {sessions.map((session) => (
              <button
                className={`nav-row${session.id === activeSessionId ? " is-active" : ""}`}
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                type="button"
              >
                <span>
                  <span className="row-title">{session.title}</span>
                  <span className="row-meta">
                    {text.statusLabels[session.status]}{session.lastMessageAt ? ` / ${formatDate(session.lastMessageAt)}` : ""}
                  </span>
                </span>
              </button>
            ))}
            <div className="workshop-actions">
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
          </div>
        </aside>

        <section className="panel chat workshop-chat">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.conversationTitle}</div>
              <div className="panel-kicker">{text.conversationKicker}</div>
            </div>
            {selectedModelProfile ? (
              <span className="pill muted">{selectedModelProfile.title}</span>
            ) : (
              <span className="pill amber">{text.labels.modelProfileMissing}</span>
            )}
          </div>
          <div className="message-stack">
            {isDetailLoading ? <p className="brief-text">{text.labels.loadingSession}</p> : null}
            {activeSession && defaultScene ? (
              <article className="workshop-reference">
                <span className="pill blue">{defaultScene.metadata.title}</span>
                <strong>{text.labels.currentSceneReference}</strong>
                <p>{sceneReferenceText}</p>
              </article>
            ) : null}
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
            {messages.map((message) => (
              <article
                className={`message${message.role === "author" ? " user" : ""}${message.status === "failed" ? " is-failed" : ""}${message.id === selectedMessageId ? " is-target" : ""}`}
                key={message.id}
              >
                <div className="message-meta">
                  <span className={message.status === "failed" ? "pill amber" : "pill muted"}>
                    {text.roles[message.role]}
                  </span>
                  <span>{formatDate(message.createdAt)}</span>
                </div>
                <p>{message.content}</p>
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
            ))}
          </div>
          <div className="composer">
            <textarea
              aria-label="Workshop message"
              className="input workshop-composer-input"
              disabled={!activeSession || activeSession.status !== "active"}
              onChange={(event) => setComposer(event.target.value)}
              placeholder={text.inputPlaceholder}
              value={composer}
            />
            <button
              className="btn"
              disabled={!activeSession || isPreviewing || !selectedPromptTemplate}
              onClick={previewContext}
              type="button"
            >
              {isPreviewing ? text.labels.previewing : text.previewContext}
            </button>
            <button className="btn primary" disabled={!canCall} onClick={sendMessage} type="button">
              {isCalling ? text.labels.sending : text.send}
            </button>
          </div>
        </section>

        <aside className="panel no-shadow workshop-context">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.basketTitle}</div>
              <div className="panel-kicker">{text.basketKicker}</div>
            </div>
            <button className="btn compact" disabled={!activeSession || !basket} onClick={addCurrentScene} type="button">
              {text.addCurrentScene}
            </button>
          </div>
          <div className="panel-body stack">
            <div className="proposal-row-pills">
              <span className="pill blue">{includedCount} {text.labels.contextIncluded}</span>
              <span className={pinnedCount ? "pill green" : "pill muted"}>
                {pinnedCount} {text.labels.contextPinned}
              </span>
            </div>
            {contextSourceOptions.length ? (
              <div className="context-source-picker">
                <select
                  aria-label={text.labels.contextSource}
                  className="input"
                  onChange={(event) => setContextSourceValue(event.target.value)}
                  value={contextSourceValue}
                >
                  {contextSourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button
                  className="btn compact"
                  disabled={!activeSession || !basket || !contextSourceValue}
                  onClick={() => void addSelectedContextSource()}
                  type="button"
                >
                  {text.insert}
                </button>
              </div>
            ) : null}
            {!basket || basket.items.length === 0 ? (
              <div className="unavailable-note">
                <h2>{text.basketEmptyTitle}</h2>
                <p>{text.basketEmptyBody}</p>
              </div>
            ) : null}
            {basket?.items.map((item) => (
              <div className="context-row" key={item.id}>
                <span>
                  <strong>{item.label}</strong>
                  <small>{contextKindLabel(item.kind)}</small>
                </span>
                <span className={item.pinned ? "pill green" : "pill muted"}>
                  {item.pinned ? text.labels.pinned : text.labels.included}
                </span>
                <button className="btn compact" onClick={() => togglePin(item.id)} type="button">
                  {item.pinned ? text.unpin : text.pin}
                </button>
                <button className="btn compact" onClick={() => removeContextItem(item.id)} type="button">
                  {text.remove}
                </button>
              </div>
            ))}
            <div className="workshop-actions">
              <button className="btn compact" disabled={!basket || basket.items.length === 0} onClick={clearBasket} type="button">
                {text.clear}
              </button>
              <button className="btn compact" disabled={!activeSession || isPreviewing || !selectedPromptTemplate} onClick={previewContext} type="button">
                {text.previewContext}
              </button>
            </div>
            <div className="review-side-block">
              <strong>{text.labels.contextPreview}</strong>
              {contextPreview ? (
                <>
                  <p>{contextPreview.items.length} {text.labels.contextIncluded}; {contextPreview.excluded.length} {text.labels.contextExcluded}.</p>
                  <div className="context-preview-list">
                    {contextPreview.items.slice(0, 5).map((item) => (
                      <span className="pill muted" key={item.id}>{item.title}</span>
                    ))}
                  </div>
                  {contextPreview.excluded.length ? (
                    <div className="context-excluded-list" aria-label={text.labels.contextExcludedList}>
                      {contextPreview.excluded.slice(0, 6).map((item) => (
                        <div className="context-excluded-row" key={`${item.source.type}:${item.source.id}:${item.reason}`}>
                          <strong>{item.title || item.source.label || item.source.type}</strong>
                          <span>{item.reason}</span>
                          {item.note ? <small>{item.note}</small> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="brief-text">{text.basketEmptyBody}</p>
              )}
            </div>
            <div className="review-side-block">
              <strong>{text.labels.permissions}</strong>
              <div className="permission-row"><span>{text.labels.permissionCodexReads}</span><span className="pill green">{text.labels.readAllowed}</span></div>
              <div className="permission-row"><span>{text.labels.permissionCodexWrites}</span><span className="pill amber">{text.labels.writesReviewOnly}</span></div>
              <div className="permission-row"><span>{text.labels.permissionWriteActions}</span><span className="pill amber">{text.labels.writesReviewOnly}</span></div>
              <div className="permission-row"><span>{text.labels.permissionBulkEdits}</span><span className="pill amber">{text.labels.bulkBlocked}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
