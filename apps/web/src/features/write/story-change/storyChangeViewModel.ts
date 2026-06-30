import type {
  CodexDetailTypeDocument,
  CodexEffectiveEntry,
  CodexEntryDocument,
  CodexFieldProgressionField,
  CodexProgressionDocument,
} from "@novel-studio/contracts";
import { uiText } from "../../../app/uiText";

const progressionText = uiText.writeProgression;

export type ProgressionFieldSelection = "description" | `detail:${string}`;
export type ProgressionDraft = {
  body: string;
  entryId: string;
  fieldSelection: ProgressionFieldSelection;
  operation: "add" | "replace";
  summary: string;
};
export type ProgressionPreview = {
  after: string;
  before: string;
  hiddenFutureCount: number;
  status: "idle" | "loading" | "ready" | "failed";
};

export function progressionFieldSelection(progression: CodexProgressionDocument["progression"]): ProgressionFieldSelection {
  if (progression.kind !== "field" || progression.field?.kind !== "detail") return "description";
  return `detail:${progression.field.detailTypeId}`;
}

export function progressionDraftFromDocument(document: CodexProgressionDocument): ProgressionDraft {
  return {
    body: document.progression.body,
    entryId: document.progression.entryId ?? "",
    fieldSelection: progressionFieldSelection(document.progression),
    operation: document.progression.operation,
    summary: document.progression.summary,
  };
}

export function fieldFromSelection(selection: ProgressionFieldSelection): CodexFieldProgressionField {
  if (selection === "description") return { kind: "description", detailTypeId: null };
  return { kind: "detail", detailTypeId: selection.slice("detail:".length) };
}

export function fieldLabel(selection: ProgressionFieldSelection, detailTypes: CodexDetailTypeDocument[]) {
  if (selection === "description") return progressionText.fieldDescription;
  const detailTypeId = selection.slice("detail:".length);
  return detailTypes.find((document) => document.detailType.id === detailTypeId)?.detailType.name ??
    progressionText.fieldFallback;
}

export function fieldValueFromEntry(entry: CodexEntryDocument, selection: ProgressionFieldSelection) {
  if (selection === "description") return entry.description;
  return entry.metadata.details[selection.slice("detail:".length)] ?? "";
}

export function fieldValueFromEffective(effective: CodexEffectiveEntry, selection: ProgressionFieldSelection) {
  return fieldValueFromEntry(effective.entry, selection);
}

export function applyProgressionDraft(before: string, draft: ProgressionDraft) {
  const body = draft.body.trim();
  if (draft.operation === "replace") return draft.body;
  if (!body) return before;
  return before ? `${draft.body}\n\n${before}` : draft.body;
}

export function isSceneWriteProgression(document: CodexProgressionDocument, sceneId: string) {
  return document.progression.source.kind === "write-block" &&
    document.progression.source.sceneId === sceneId &&
    document.progression.kind === "field";
}
