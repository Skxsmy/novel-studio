import type {
  CodexDetailTypeDocument,
  CodexEntryDocument,
  CodexProgressionDocument,
  SceneBlock,
} from "@novel-studio/contracts";
import { uiText } from "../../../app/uiText";
import {
  fieldLabel,
  type ProgressionDraft,
  type ProgressionFieldSelection,
  type ProgressionPreview,
  progressionDraftFromDocument,
} from "./storyChangeViewModel";

type ProgressionBlock = Extract<SceneBlock, { kind: "codexProgression" }>;

export interface StoryChangePanelProps {
  blocks: ProgressionBlock[];
  busyId: string | null;
  collapsedBlockIds: Set<string>;
  detailTypes: CodexDetailTypeDocument[];
  drafts: Record<string, ProgressionDraft>;
  entries: CodexEntryDocument[];
  onDelete: (block: ProgressionBlock) => void;
  onSave: (progressionId: string) => void;
  onSelect: (blockId: string) => void;
  onToggleCollapse: (blockId: string) => void;
  onUpdateDraft: (progressionId: string, patch: Partial<ProgressionDraft>) => void;
  previews: Record<string, ProgressionPreview>;
  progressionsById: Map<string, CodexProgressionDocument>;
  selectedBlockId: string | null;
}

const progressionText = uiText.writeProgression;

function draftForBlock(
  block: ProgressionBlock,
  progressionsById: Map<string, CodexProgressionDocument>,
  drafts: Record<string, ProgressionDraft>,
) {
  const progression = progressionsById.get(block.progressionId);
  return drafts[block.progressionId] ?? (progression ? progressionDraftFromDocument(progression) : null);
}

export function StoryChangePanel({
  blocks,
  busyId,
  collapsedBlockIds,
  detailTypes,
  drafts,
  entries,
  onDelete,
  onSave,
  onSelect,
  onToggleCollapse,
  onUpdateDraft,
  previews,
  progressionsById,
  selectedBlockId,
}: StoryChangePanelProps) {
  if (!blocks.length) return <p className="brief-text">{progressionText.panelEmpty}</p>;

  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) ?? blocks[0] ?? null;
  const selectedProgression = selectedBlock ? progressionsById.get(selectedBlock.progressionId) ?? null : null;
  const selectedDraft = selectedBlock ? draftForBlock(selectedBlock, progressionsById, drafts) : null;
  const selectedEntry = selectedDraft
    ? entries.find((entry) => entry.metadata.id === selectedDraft.entryId) ?? null
    : null;
  const detailOptions = selectedEntry
    ? detailTypes.filter((document) => document.detailType.categoryId === selectedEntry.metadata.categoryId)
    : [];
  const preview = selectedBlock
    ? previews[selectedBlock.progressionId] ?? { after: "", before: "", hiddenFutureCount: 0, status: "idle" as const }
    : { after: "", before: "", hiddenFutureCount: 0, status: "idle" as const };
  const isBusy = Boolean(selectedBlock && selectedProgression && (busyId === selectedBlock.id || busyId === selectedProgression.progression.id));
  const isCollapsed = Boolean(selectedBlock && collapsedBlockIds.has(selectedBlock.id));

  return (
    <div className="story-change-panel">
      <div className="scene-progression-panel" aria-label={progressionText.aria.storyChangeList}>
        {blocks.map((block) => {
          const draft = draftForBlock(block, progressionsById, drafts);
          const entry = draft ? entries.find((candidate) => candidate.metadata.id === draft.entryId) ?? null : null;
          const isSelected = block.id === selectedBlock?.id;
          return (
            <button
              className={`scene-progression-panel-row${isSelected ? " is-active" : ""}`}
              key={block.id}
              onClick={() => onSelect(block.id)}
              type="button"
            >
              <div>
                <strong>{entry?.metadata.name ?? progressionText.title}</strong>
                <span>{draft?.summary || (draft ? fieldLabel(draft.fieldSelection, detailTypes) : progressionText.missingRecord)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedBlock && selectedProgression && selectedDraft ? (
        <section className="story-change-detail" aria-label={progressionText.title}>
          <div className="story-change-detail-head">
            <div>
              <strong>{selectedEntry?.metadata.name ?? progressionText.title}</strong>
              <span>{selectedDraft.summary || fieldLabel(selectedDraft.fieldSelection, detailTypes)}</span>
            </div>
            <button
              className="btn compact"
              onClick={() => onToggleCollapse(selectedBlock.id)}
              type="button"
            >
              {isCollapsed ? progressionText.actions.expand : progressionText.actions.collapse}
            </button>
          </div>
          {isCollapsed ? (
            <p className="mini-note">{selectedDraft.summary || fieldLabel(selectedDraft.fieldSelection, detailTypes)}</p>
          ) : (
            <>
          <div className="progression-form-grid">
            <label>
              <span>{progressionText.labels.entry}</span>
              <select
                aria-label={progressionText.aria.selectedEntry}
                className="input"
                onChange={(event) => onUpdateDraft(selectedBlock.progressionId, {
                  entryId: event.target.value,
                  fieldSelection: "description",
                })}
                value={selectedDraft.entryId}
              >
                {entries.map((entry) => (
                  <option key={entry.metadata.id} value={entry.metadata.id}>{entry.metadata.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{progressionText.labels.field}</span>
              <select
                aria-label={progressionText.aria.selectedField}
                className="input"
                onChange={(event) => onUpdateDraft(selectedBlock.progressionId, {
                  fieldSelection: event.target.value as ProgressionFieldSelection,
                })}
                value={selectedDraft.fieldSelection}
              >
                <option value="description">{progressionText.fieldDescription}</option>
                {detailOptions.map((document) => (
                  <option key={document.detailType.id} value={`detail:${document.detailType.id}`}>
                    {document.detailType.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{progressionText.labels.change}</span>
              <select
                aria-label={progressionText.aria.selectedOperation}
                className="input"
                onChange={(event) => onUpdateDraft(selectedBlock.progressionId, {
                  operation: event.target.value as ProgressionDraft["operation"],
                })}
                value={selectedDraft.operation}
              >
                <option value="add">{progressionText.operations.add}</option>
                <option value="replace">{progressionText.operations.replace}</option>
              </select>
            </label>
          </div>
          <label className="progression-field">
            <span>{progressionText.labels.summary}</span>
            <input
              aria-label={progressionText.aria.selectedSummary}
              className="input"
              onChange={(event) => onUpdateDraft(selectedBlock.progressionId, { summary: event.target.value })}
              placeholder={progressionText.placeholders.summary}
              value={selectedDraft.summary}
            />
          </label>
          <label className="progression-field">
            <span>{progressionText.labels.text}</span>
            <textarea
              aria-label={progressionText.aria.selectedText}
              className="input progression-body"
              onChange={(event) => onUpdateDraft(selectedBlock.progressionId, { body: event.target.value })}
              placeholder={progressionText.placeholders.text}
              value={selectedDraft.body}
            />
          </label>
          <div className="progression-preview-grid" aria-label={progressionText.aria.selectedPreview}>
            <div>
              <span className="mini-label">{progressionText.labels.before}</span>
              <p>{preview.status === "failed" ? progressionText.previewUnavailable : preview.before || progressionText.empty}</p>
            </div>
            <div>
              <span className="mini-label">{progressionText.labels.after}</span>
              <p>{preview.status === "loading" ? progressionText.loading : preview.after || progressionText.empty}</p>
            </div>
          </div>
          {preview.hiddenFutureCount ? (
            <p className="mini-note">{progressionText.laterChangesHidden(preview.hiddenFutureCount)}</p>
          ) : null}
          <div className="progression-actions">
            <button
              className="btn compact"
              disabled={isBusy}
              onClick={() => onDelete(selectedBlock)}
              type="button"
            >
              {uiText.actions.delete}
            </button>
            <button
              className="btn compact primary"
              disabled={isBusy || !selectedDraft.entryId}
              onClick={() => onSave(selectedBlock.progressionId)}
              type="button"
            >
              {progressionText.actions.save}
            </button>
          </div>
            </>
          )}
        </section>
      ) : (
        <p className="mini-note">{progressionText.missingRecordBody}</p>
      )}
    </div>
  );
}
