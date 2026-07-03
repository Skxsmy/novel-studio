import { useEffect, useMemo, useState } from "react";
import type { ProposalDocument, ProposalPatch, SeriesDetail } from "@novel-studio/contracts";
import { api } from "../../api";
import { uiText } from "../../app/uiText";
import "./review-workspace.css";

interface ReviewWorkspaceProps {
  onOpenWorkshopMessage: (sessionId: string, messageId: string) => void;
  onOpenProposal: (proposalId: string) => void;
  selectedProposalId: string | null;
  series: SeriesDetail;
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

function formatPatchText(value: string | null) {
  return value?.trim() ? value : "-";
}

function isStructuredPatch(patch: ProposalPatch) {
  return (
    patch.target.kind.startsWith("codex") ||
    patch.target.kind === "detail-type" ||
    patch.target.kind === "timeline-event" ||
    patch.target.kind === "planning" ||
    patch.target.kind === "research-note"
  );
}

function patchFieldLabel(patch: ProposalPatch, index: number) {
  if (patch.target.fieldPath.length > 0) return patch.target.fieldPath.join(" / ");
  return `Patch ${index + 1}`;
}

export function ReviewWorkspace({
  onOpenWorkshopMessage,
  onOpenProposal,
  selectedProposalId,
  series,
}: ReviewWorkspaceProps) {
  const text = uiText.review;
  const [items, setItems] = useState<ProposalDocument[]>([]);
  const [diagnosticCount, setDiagnosticCount] = useState(0);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedProposalId);
  const [editedTextByPatchId, setEditedTextByPatchId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadInbox(nextSelectedId: string | null | undefined = selectedProposalId) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const inbox = await api.proposals.list(series.manifest.id);
      setItems(inbox.items);
      setDiagnosticCount(inbox.diagnostics.length);

      const exactSelection = nextSelectedId
        ? inbox.items.find((item) => item.proposal.id === nextSelectedId) ?? null
        : null;
      const firstPending = inbox.items.find((item) => item.proposal.status === "pending") ?? null;
      setLocalSelectedId(exactSelection?.proposal.id ?? firstPending?.proposal.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load proposals.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInbox(selectedProposalId);
  }, [series.manifest.id]);

  useEffect(() => {
    if (selectedProposalId) setLocalSelectedId(selectedProposalId);
  }, [selectedProposalId]);

  const selected = useMemo(
    () => items.find((item) => item.proposal.id === localSelectedId) ?? null,
    [items, localSelectedId],
  );
  const pendingItems = useMemo(
    () => items.filter((item) => item.proposal.status === "pending"),
    [items],
  );
  const editablePatches = selected?.proposal.patches.filter((patch) => patch.after !== null) ?? [];
  const sourceAvailable = selected?.sourceAvailability.available ?? true;
  const targetAvailable = selected?.targetAvailability.available ?? true;
  const unavailableReason = selected
    ? selected.sourceAvailability.reason || selected.targetAvailability.reason
    : "";
  const isSelectedPending = selected?.proposal.status === "pending";
  const canDecide = Boolean(selected && isSelectedPending && sourceAvailable && targetAvailable);
  const canReject = Boolean(selected && isSelectedPending);
  const canMarkStale = Boolean(selected && isSelectedPending && (!sourceAvailable || !targetAvailable));

  useEffect(() => {
    setEditedTextByPatchId(Object.fromEntries(
      (selected?.proposal.patches ?? [])
        .filter((patch) => patch.after !== null)
        .map((patch) => [patch.id, patch.after ?? ""]),
    ));
  }, [selected?.proposal.id]);

  async function runDecision(action: "accept" | "edit" | "reject" | "stale") {
    if (!selected) return;
    setBusyAction(action);
    setErrorMessage("");
    try {
      if (action === "accept") {
        await api.proposals.accept(series.manifest.id, selected.proposal.id, {
          baseRevision: selected.revision,
          actor: "user",
          note: "",
        });
      } else if (action === "stale") {
        await api.proposals.markStale(series.manifest.id, selected.proposal.id, {
          baseRevision: selected.revision,
          actor: "user",
          note: "",
          staleReason: text.labels.staleReasonDefault,
        });
      } else if (action === "reject") {
        await api.proposals.reject(series.manifest.id, selected.proposal.id, {
          baseRevision: selected.revision,
          actor: "user",
          note: "",
        });
      } else if (editablePatches.length > 0) {
        await api.proposals.editAndAccept(series.manifest.id, selected.proposal.id, {
          baseRevision: selected.revision,
          actor: "user",
          note: "",
          patches: selected.proposal.patches.map((patch) =>
            patch.after !== null
              ? { ...patch, after: editedTextByPatchId[patch.id] ?? patch.after }
              : patch,
          ),
        });
      }
      await loadInbox(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Proposal action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function openSourceMessage() {
    if (!selected?.proposal.source.sourceId || selected.proposal.source.kind !== "workshop-message") return;
    setBusyAction("source-message");
    setErrorMessage("");
    try {
      const source = await api.workshop.getMessageSource(series.manifest.id, selected.proposal.source.sourceId);
      onOpenWorkshopMessage(source.session.id, source.message.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Source message is unavailable.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <div className="page-head review-page-head">
        <div>
          <h2 className="page-title">{text.title}</h2>
          <p className="page-subtitle">{text.subtitle}</p>
        </div>
        <span className="pill amber">{pendingItems.length} {text.statusLabels.pending.toLowerCase()}</span>
      </div>
      {errorMessage ? <p className="alert">{errorMessage}</p> : null}
      <div className="review-workspace">
        <aside className="panel no-shadow review-queue-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.queueTitle}</div>
              <div className="panel-kicker">{text.queueKicker}</div>
            </div>
            <div className="review-queue-actions">
              {diagnosticCount ? <span className="pill amber">{diagnosticCount} {text.labels.diagnostics}</span> : null}
              <button
                className="btn compact"
                disabled={isLoading}
                onClick={() => void loadInbox(localSelectedId)}
                type="button"
              >
                {text.actions.refresh}
              </button>
            </div>
          </div>
          <div className="panel-body review-queue-list">
            {pendingItems.length === 0 ? (
              <div className="unavailable-note">
                <h2>{text.queueEmptyTitle}</h2>
                <p>{text.queueEmptyBody}</p>
              </div>
            ) : pendingItems.map((item) => (
              <button
                aria-pressed={item.proposal.id === selected?.proposal.id}
                className={`proposal-row${item.proposal.id === selected?.proposal.id ? " is-active" : ""}`}
                key={item.proposal.id}
                onClick={() => {
                  setLocalSelectedId(item.proposal.id);
                  onOpenProposal(item.proposal.id);
                }}
                type="button"
              >
                <span className="proposal-row-pills">
                  <span className={statusClass(item.proposal.status)}>
                    {text.statusLabels[item.proposal.status]}
                  </span>
                  <span className="pill blue">{targetKindLabel(item.proposal.target.kind)}</span>
                </span>
                <strong>{item.proposal.title}</strong>
                <span>{item.proposal.target.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel decision-panel review-diff-panel">
          <div className="panel-head review-detail-head">
            <div>
              <div className="panel-title">{selected?.proposal.title ?? text.decisionTitle}</div>
              <div className="panel-kicker">
                {selected ? `${targetKindLabel(selected.proposal.target.kind)} / ${selected.proposal.target.label}` : text.decisionKicker}
              </div>
            </div>
            {selected ? (
              <span className={statusClass(selected.proposal.status)}>
                {text.statusLabels[selected.proposal.status]}
              </span>
            ) : null}
          </div>

          <div className="decision-body">
            {!selected ? (
              <div className="unavailable-note">
                <h2>{text.decisionEmptyTitle}</h2>
                <p>{text.decisionEmptyBody}</p>
              </div>
            ) : (
              <>
                <div className="review-diff-intro">
                  <span className="brief-label">{text.labels.target}</span>
                  <h3>{text.diffTitle}</h3>
                  {selected.proposal.summary ? <p>{selected.proposal.summary}</p> : null}
                </div>

                {!sourceAvailable || !targetAvailable ? (
                  <div className="alert review-warning">
                    <span>{unavailableReason}</span>
                    {selected.proposal.source.kind === "workshop-message" && !sourceAvailable ? (
                      <button className="btn compact" disabled type="button">
                        {text.actions.sourceUnavailable}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {selected.proposal.staleReason ? <p className="alert">{selected.proposal.staleReason}</p> : null}

                <div className="review-patch-list" aria-label="Proposal patches">
                  {selected.proposal.patches.map((patch, index) => (
                    <article className="review-patch" key={patch.id}>
                      <header className="review-patch-header">
                        <span className="pill muted">{text.labels.patch} {index + 1}</span>
                        <span className="pill blue">{targetKindLabel(patch.target.kind)}</span>
                        <span className="review-patch-target">{patch.target.label}</span>
                      </header>
                      {isStructuredPatch(patch) ? (
                        <div className="review-field-diff">
                          <div className="review-field-name">
                            <span className="brief-label">{text.labels.field}</span>
                            <strong>{patchFieldLabel(patch, index)}</strong>
                          </div>
                          <div className="review-diff-columns" aria-label={`${text.labels.patch} ${index + 1}`}>
                            <div className="diff-block">
                              <span className="brief-label">{text.labels.before}</span>
                              <p>{formatPatchText(patch.before)}</p>
                            </div>
                            <div className="diff-block">
                              <span className="brief-label">{text.labels.after}</span>
                              <p>{formatPatchText(patch.after)}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="review-diff-columns" aria-label={`${text.labels.patch} ${index + 1}`}>
                          <div className="diff-block">
                            <span className="brief-label">{text.labels.before}</span>
                            <p>{formatPatchText(patch.before)}</p>
                          </div>
                          <div className="diff-block">
                            <span className="brief-label">{text.labels.after}</span>
                            <p>{formatPatchText(patch.after)}</p>
                          </div>
                        </div>
                      )}
                      {patch.after !== null && isSelectedPending && canDecide ? (
                        <details className="review-edit-details">
                          <summary>{text.labels.editText}</summary>
                          <textarea
                            aria-label={`${text.labels.editText} ${index + 1}`}
                            className="textarea review-edit-textarea"
                            onChange={(event) => setEditedTextByPatchId((current) => ({
                              ...current,
                              [patch.id]: event.target.value,
                            }))}
                            value={editedTextByPatchId[patch.id] ?? patch.after}
                          />
                        </details>
                      ) : null}
                    </article>
                  ))}
                </div>

                <details className="review-source-details">
                  <summary>
                    <span>{text.sourceDetailsTitle}</span>
                    <span>{selected.proposal.source.label}</span>
                  </summary>
                  <div className="review-source-body">
                    <div className="review-source-block">
                      <span className="brief-label">{text.labels.reason}</span>
                      <p>{selected.proposal.reason || selected.proposal.summary || "-"}</p>
                    </div>
                    {selected.proposal.source.kind === "workshop-message" ? (
                      <div className="review-source-block">
                        <span className="brief-label">{text.labels.source}</span>
                        <p>{selected.proposal.source.label}</p>
                        {selected.sourceAvailability.available ? (
                          <button
                            className="btn compact"
                            disabled={busyAction !== null}
                            onClick={() => void openSourceMessage()}
                            type="button"
                          >
                            {text.actions.openSource}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {selected.proposal.evidence.length ? selected.proposal.evidence.map((item) => (
                      <div className="review-source-block" key={`${item.sourceType}:${item.sourceId}`}>
                        <span className="brief-label">{text.labels.evidence}</span>
                        <p>{item.note}</p>
                      </div>
                    )) : (
                      <p className="brief-text">{text.evidenceBody}</p>
                    )}
                  </div>
                </details>
              </>
            )}
          </div>

          {selected ? (
            <div className="decision-actions">
              {isSelectedPending ? (
                <>
                  <button
                    className="btn danger"
                    disabled={!canReject || busyAction !== null}
                    onClick={() => void runDecision("reject")}
                    type="button"
                  >
                    {text.actions.reject}
                  </button>
                  {canMarkStale ? (
                    <button
                      className="btn"
                      disabled={busyAction !== null}
                      onClick={() => void runDecision("stale")}
                      type="button"
                    >
                      {text.actions.markStale}
                    </button>
                  ) : null}
                  {canDecide ? (
                    <>
                      <button
                        className="btn"
                        disabled={editablePatches.length === 0 || busyAction !== null}
                        onClick={() => void runDecision("edit")}
                        type="button"
                      >
                        {text.actions.editAndAccept}
                      </button>
                      <button
                        className="btn success"
                        disabled={busyAction !== null}
                        onClick={() => void runDecision("accept")}
                        type="button"
                      >
                        {text.actions.accept}
                      </button>
                    </>
                  ) : null}
                </>
              ) : (
                <p className="review-state-note">{text.reviewedState}</p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
