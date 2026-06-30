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
  onSelect: (blockId: string) => void;
  onToggleCollapse: (blockId: string) => void;
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
  onSelect,
  onToggleCollapse,
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
  const preview = selectedBlock
    ? previews[selectedBlock.progressionId] ?? { after: "", before: "", hiddenFutureCount: 0, status: "idle" as const }
    : { after: "", before: "", hiddenFutureCount: 0, status: "idle" as const };
  const isBusy = Boolean(selectedBlock && selectedProgression && (busyId === selectedBlock.id || busyId === selectedProgression.progression.id));
  const isCollapsed = Boolean(selectedBlock && collapsedBlockIds.has(selectedBlock.id));

  return (
    <div className="story-change-panel">
      <div className="scene-progression-panel" aria-label={progressionText.aria.progressionList}>
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
            <div className="top-actions">
              <button
                className="btn compact"
                onClick={() => onToggleCollapse(selectedBlock.id)}
                type="button"
              >
                {isCollapsed ? progressionText.actions.expand : progressionText.actions.collapse}
              </button>
              <button
                className="btn compact"
                disabled={isBusy}
                onClick={() => onDelete(selectedBlock)}
                type="button"
              >
                {uiText.actions.delete}
              </button>
            </div>
          </div>
          {isCollapsed ? (
            <p className="mini-note">{selectedDraft.summary || fieldLabel(selectedDraft.fieldSelection, detailTypes)}</p>
          ) : (
            <>
          <div className="progression-readonly-grid">
            <div>
              <span className="mini-label">{progressionText.labels.entry}</span>
              <p>{selectedEntry?.metadata.name ?? progressionText.missingRecord}</p>
            </div>
            <div>
              <span className="mini-label">{progressionText.labels.field}</span>
              <p>{fieldLabel(selectedDraft.fieldSelection, detailTypes)}</p>
            </div>
            <div>
              <span className="mini-label">{progressionText.labels.change}</span>
              <p>{selectedDraft.operation === "replace" ? progressionText.operations.replace : progressionText.operations.add}</p>
            </div>
          </div>
          {selectedDraft.summary ? (
            <div className="progression-readonly-block">
              <span className="mini-label">{progressionText.labels.summary}</span>
              <p>{selectedDraft.summary}</p>
            </div>
          ) : null}
          {selectedDraft.body ? (
            <div className="progression-readonly-block">
              <span className="mini-label">{progressionText.labels.text}</span>
              <p>{selectedDraft.body}</p>
            </div>
          ) : null}
          <div className="progression-preview-grid" aria-label={progressionText.aria.panelPreview}>
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
            </>
          )}
        </section>
      ) : (
        <p className="mini-note">{progressionText.missingRecordBody}</p>
      )}
    </div>
  );
}
