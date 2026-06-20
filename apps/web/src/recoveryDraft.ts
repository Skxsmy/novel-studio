export interface RecoveryDraft {
  schemaVersion: 1;
  seriesId: string;
  sceneId: string;
  baseRevision: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type RecoveryDecision = "none" | "available" | "stale";

export function recoveryDraftKey(seriesId: string, sceneId: string): string {
  return `novel-studio:recovery:v1:${seriesId}:${sceneId}`;
}

export function saveRecoveryDraft(storage: DraftStorage, draft: RecoveryDraft): void {
  storage.setItem(recoveryDraftKey(draft.seriesId, draft.sceneId), JSON.stringify(draft));
}

export function clearRecoveryDraft(
  storage: DraftStorage,
  seriesId: string,
  sceneId: string,
): void {
  storage.removeItem(recoveryDraftKey(seriesId, sceneId));
}

export function loadRecoveryDraft(
  storage: DraftStorage,
  seriesId: string,
  sceneId: string,
): RecoveryDraft | null {
  const raw = storage.getItem(recoveryDraftKey(seriesId, sceneId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<RecoveryDraft>;
    if (
      value.schemaVersion !== 1 ||
      value.seriesId !== seriesId ||
      value.sceneId !== sceneId ||
      typeof value.baseRevision !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.baseRevision) ||
      typeof value.title !== "string" ||
      typeof value.content !== "string" ||
      typeof value.updatedAt !== "string"
    ) {
      return null;
    }
    return value as RecoveryDraft;
  } catch {
    return null;
  }
}

export function recoveryDecision(
  draft: RecoveryDraft | null,
  currentRevision: string,
  currentTitle: string,
  currentContent: string,
): RecoveryDecision {
  if (!draft || (draft.title === currentTitle && draft.content === currentContent)) return "none";
  return draft.baseRevision === currentRevision ? "available" : "stale";
}
