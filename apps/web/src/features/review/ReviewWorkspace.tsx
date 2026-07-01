import { useEffect, useMemo, useState } from "react";
import type {
  ProposalBatchAcceptResult,
  ProposalBatchPreviewResult,
  ProposalDocument,
  SeriesDetail,
} from "@novel-studio/contracts";
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

function formatConfidence(value: number | null) {
  if (value === null) return "-";
  return `${Math.round(value * 100)}%`;
}

function targetKindLabel(kind: ProposalDocument["proposal"]["target"]["kind"]) {
  if (kind.startsWith("scene")) return "Manuscript";
  if (kind.startsWith("codex") || kind === "detail-type") return "Codex";
  if (kind === "planning") return "Planning";
  return "Research";
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
  const [batchPreview, setBatchPreview] = useState<ProposalBatchPreviewResult | null>(null);
  const [batchResult, setBatchResult] = useState<ProposalBatchAcceptResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadInbox(nextSelectedId = selectedProposalId, keepBatchState = false) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const inbox = await api.proposals.list(series.manifest.id);
      setItems(inbox.items);
      setDiagnosticCount(inbox.diagnostics.length);
      const currentExists = nextSelectedId && inbox.items.some((item) => item.proposal.id === nextSelectedId);
      const firstPending = inbox.items.find((item) => item.proposal.status === "pending");
      const fallback = firstPending ?? inbox.items[0] ?? null;
      setLocalSelectedId(currentExists ? nextSelectedId : fallback?.proposal.id ?? null);
      if (!keepBatchState) {
        setBatchPreview(null);
        setBatchResult(null);
      }
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
  const pendingItems = items.filter((item) => item.proposal.status === "pending");
  const editablePatches = selected?.proposal.patches.filter((patch) => patch.after !== null) ?? [];
  const sourceAvailable = selected?.sourceAvailability.available ?? true;
  const targetAvailable = selected?.targetAvailability.available ?? true;
  const isSelectedPending = selected?.proposal.status === "pending";
  const canDecide = Boolean(selected && selected.proposal.status === "pending" && sourceAvailable && targetAvailable);
  const canMarkStale = Boolean(selected && selected.proposal.status === "pending");

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
      await loadInbox(selected.proposal.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Proposal action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runBatchPreview() {
    setBusyAction("batch-preview");
    setErrorMessage("");
    setBatchResult(null);
    try {
      const preview = await api.proposals.batchPreview(series.manifest.id, {
        proposalIds: pendingItems.map((item) => item.proposal.id),
      });
      setBatchPreview(preview);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Batch preview failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runBatchAccept() {
    const reviewedItems = batchPreview?.items
      .filter((item) => item.eligible && item.revision)
      .map((item) => ({ proposalId: item.proposalId, baseRevision: item.revision! })) ?? [];
    if (reviewedItems.length === 0) return;
    setBusyAction("batch-accept");
    setErrorMessage("");
    try {
      const result = await api.proposals.batchAccept(series.manifest.id, {
        items: reviewedItems,
        actor: "user",
        note: "",
      });
      setBatchResult(result);
      setBatchPreview(null);
      await loadInbox(localSelectedId, true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Batch accept failed.");
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

  const previewEligible = batchPreview?.items.filter((item) => item.eligible).length ?? 0;
  const previewSkipped = batchPreview ? batchPreview.items.length - previewEligible : 0;
  const batchBlocked = batchResult?.blocked.length ?? 0;
  const batchFailed = batchResult?.failed.length ?? 0;
  const batchSkipped = batchResult?.skipped.length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">{text.title}</h2>
          <p className="page-subtitle">{text.subtitle}</p>
        </div>
        <span className="pill amber">{pendingItems.length} pending</span>
        <div className="filter-actions">
          <button className="btn" disabled type="button">
            {text.actions.filter}
          </button>
          <button className="btn" disabled={isLoading} onClick={() => void loadInbox(localSelectedId)} type="button">
            {text.actions.refresh}
          </button>
          <button
            className="btn"
            disabled={pendingItems.length === 0 || busyAction !== null}
            onClick={() => void runBatchPreview()}
            type="button"
          >
            {text.actions.batchPreview}
          </button>
          <button
            className="btn primary"
            disabled={!batchPreview || previewEligible === 0 || busyAction !== null}
            onClick={() => void runBatchAccept()}
            type="button"
          >
            {text.actions.batchReview}
          </button>
        </div>
      </div>
      {errorMessage ? <p className="alert">{errorMessage}</p> : null}
      <div className="review-grid">
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.queueTitle}</div>
              <div className="panel-kicker">{text.queueKicker}</div>
            </div>
            {diagnosticCount ? <span className="pill amber">{diagnosticCount} {text.labels.diagnostics}</span> : null}
          </div>
          <div className="panel-body review-groups">
            {items.length === 0 ? (
              <div className="unavailable-note">
                <h2>{text.queueEmptyTitle}</h2>
                <p>{text.queueEmptyBody}</p>
              </div>
            ) : items.map((item) => (
              <div
                className={`proposal-row${item.proposal.id === selected?.proposal.id ? " is-active" : ""}`}
                key={item.proposal.id}
              >
                <div className="proposal-row-pills">
                  <span className={statusClass(item.proposal.status)}>
                    {text.statusLabels[item.proposal.status]}
                  </span>
                  <span className="pill blue">{targetKindLabel(item.proposal.target.kind)}</span>
                </div>
                <div>
                  <strong>{item.proposal.title}</strong>
                  <span>{item.proposal.target.label}</span>
                </div>
                <button
                  className="btn primary compact"
                  onClick={() => {
                    setLocalSelectedId(item.proposal.id);
                    onOpenProposal(item.proposal.id);
                  }}
                  type="button"
                >
                  {text.actions.open}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel decision-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">{selected?.proposal.title ?? text.decisionTitle}</div>
              <div className="panel-kicker">{selected ? selected.proposal.summary : text.decisionKicker}</div>
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
                <div className="review-meta-strip">
                  <div className="review-stat">
                    <strong>{text.statusLabels[selected.proposal.status]}</strong>
                    <span>{text.labels.status}</span>
                  </div>
                  <div className="review-stat">
                    <strong>{selected.proposal.riskLevel}</strong>
                    <span>{text.labels.risk}</span>
                  </div>
                  <div className="review-stat">
                    <strong>{formatConfidence(selected.proposal.confidence)}</strong>
                    <span>{text.labels.confidence}</span>
                  </div>
                  <div className="review-stat">
                    <strong>{selected.proposal.patches.length}</strong>
                    <span>{text.labels.impact}</span>
                  </div>
                </div>
                {!sourceAvailable || !targetAvailable ? (
                  <p className="alert">
                    {selected.sourceAvailability.reason || selected.targetAvailability.reason}
                  </p>
                ) : null}
                {selected.proposal.staleReason ? <p className="alert">{selected.proposal.staleReason}</p> : null}
                <div className="review-patch-list" aria-label="Proposal patches">
                  {selected.proposal.patches.map((patch, index) => (
                    <div className="review-patch" key={patch.id}>
                      <div className="review-patch-header">
                        <span className="pill muted">{text.labels.patch} {index + 1}</span>
                        <span className="pill blue">{targetKindLabel(patch.target.kind)}</span>
                      </div>
                      <div className="diff" aria-label={`${text.labels.patch} ${index + 1}`}>
                        <div className="diff-block">
                          <span className="brief-label">{text.labels.before}</span>
                          <p>{patch.before?.trim() ? patch.before : "-"}</p>
                        </div>
                        <div className="diff-block">
                          <span className="brief-label">{text.labels.after}</span>
                          <p>{patch.after?.trim() ? patch.after : "-"}</p>
                        </div>
                      </div>
                      {patch.after !== null && isSelectedPending ? (
                        <label className="field">
                          <span>{text.labels.editText} {index + 1}</span>
                          <textarea
                            className="textarea review-edit-textarea"
                            onChange={(event) => setEditedTextByPatchId((current) => ({
                              ...current,
                              [patch.id]: event.target.value,
                            }))}
                            value={editedTextByPatchId[patch.id] ?? patch.after}
                          />
                        </label>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {isSelectedPending ? (
            <div className="decision-actions filter-actions">
              <button
                className="btn success"
                disabled={!canDecide || busyAction !== null}
                onClick={() => void runDecision("accept")}
                type="button"
              >
                {text.actions.accept}
              </button>
              <button
                className="btn"
                disabled={!canDecide || editablePatches.length === 0 || busyAction !== null}
                onClick={() => void runDecision("edit")}
                type="button"
              >
                {text.actions.editAndAccept}
              </button>
              <button
                className="btn danger"
                disabled={!selected || selected.proposal.status !== "pending" || busyAction !== null}
                onClick={() => void runDecision("reject")}
                type="button"
              >
                {text.actions.reject}
              </button>
              <button
                className="btn"
                disabled={!canMarkStale || busyAction !== null}
                onClick={() => void runDecision("stale")}
                type="button"
              >
                {text.actions.markStale}
              </button>
            </div>
          ) : null}
        </section>

        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.evidenceTitle}</div>
              <div className="panel-kicker">{selected?.proposal.source.label ?? text.evidenceKicker}</div>
            </div>
          </div>
          <div className="panel-body evidence-stack">
            {selected ? (
              <>
                <div className="review-side-block">
                  <span className="brief-label">{text.labels.source}</span>
                  <p className="brief-text">{selected.proposal.source.label}</p>
                  {selected.proposal.source.kind === "workshop-message" ? (
                    <button
                      className="btn compact"
                      disabled={busyAction !== null || !selected.sourceAvailability.available}
                      onClick={() => void openSourceMessage()}
                      type="button"
                    >
                      {selected.sourceAvailability.available
                        ? text.actions.openSource
                        : text.actions.sourceUnavailable}
                    </button>
                  ) : null}
                </div>
                <div className="review-side-block">
                  <span className="brief-label">{text.labels.reason}</span>
                  <p className="brief-text">{selected.proposal.reason || selected.proposal.summary}</p>
                </div>
                {selected.proposal.evidence.length ? selected.proposal.evidence.map((item) => (
                  <div className="review-side-block" key={`${item.sourceType}:${item.sourceId}`}>
                    <span className="brief-label">{text.labels.evidence}</span>
                    <p className="brief-text">{item.note}</p>
                  </div>
                )) : (
                  <p className="brief-text">{text.evidenceBody}</p>
                )}
              </>
            ) : (
              <p className="brief-text">{text.evidenceBody}</p>
            )}
          </div>
        </aside>

        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.impactTitle}</div>
              <div className="panel-kicker">{text.impactKicker}</div>
            </div>
          </div>
          <div className="panel-body impact-stack">
            <table className="impact-table">
              <tbody>
                <tr>
                  <th>{text.labels.target}</th>
                  <td>{selected?.proposal.target.label ?? "-"}</td>
                </tr>
                <tr>
                  <th>{text.labels.batchEligible}</th>
                  <td>{batchPreview ? previewEligible : "-"}</td>
                </tr>
                <tr>
                  <th>{text.labels.batchSkipped}</th>
                  <td>{batchPreview ? previewSkipped : "-"}</td>
                </tr>
                <tr>
                  <th>{text.labels.batchCompleted}</th>
                  <td>{batchResult ? batchResult.completed.length : "-"}</td>
                </tr>
                <tr>
                  <th>{text.labels.batchBlocked}</th>
                  <td>{batchResult ? batchBlocked : "-"}</td>
                </tr>
                <tr>
                  <th>{text.labels.batchFailed}</th>
                  <td>{batchResult ? batchFailed : "-"}</td>
                </tr>
                <tr>
                  <th>{text.labels.batchResultSkipped}</th>
                  <td>{batchResult ? batchSkipped : "-"}</td>
                </tr>
              </tbody>
            </table>
            {batchPreview?.items.filter((item) => !item.eligible).map((item) => (
              <p className="alert" key={item.proposalId}>{item.reason}</p>
            ))}
            {batchResult?.blocked.map((item) => (
              <p className="alert" key={`blocked:${item.proposalId}`}>{item.reason}</p>
            ))}
            {batchResult?.failed.map((item) => (
              <p className="alert" key={`failed:${item.proposalId}`}>{item.reason}</p>
            ))}
            {batchResult?.skipped.map((item) => (
              <p className="alert" key={`skipped:${item.proposalId}`}>{item.reason}</p>
            ))}
            {!batchPreview && !batchResult ? <p className="brief-text">{text.impactBody}</p> : null}
          </div>
        </aside>
      </div>
    </>
  );
}
