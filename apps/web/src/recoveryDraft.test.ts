import { describe, expect, it } from "vitest";
import {
  clearRecoveryDraft,
  loadRecoveryDraft,
  recoveryDecision,
  saveRecoveryDraft,
  type DraftStorage,
  type RecoveryDraft,
} from "./recoveryDraft.js";

function memoryStorage(): DraftStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const draft: RecoveryDraft = {
  schemaVersion: 1,
  seriesId: "series",
  sceneId: "scene",
  baseRevision: "a".repeat(64),
  title: "雨夜",
  content: "她没有回头。",
  updatedAt: "2026-06-20T00:00:00.000Z",
};

describe("recovery drafts", () => {
  it("round-trips and clears a valid draft", () => {
    const storage = memoryStorage();
    saveRecoveryDraft(storage, draft);
    expect(loadRecoveryDraft(storage, draft.seriesId, draft.sceneId)).toEqual(draft);
    clearRecoveryDraft(storage, draft.seriesId, draft.sceneId);
    expect(loadRecoveryDraft(storage, draft.seriesId, draft.sceneId)).toBeNull();
  });

  it("distinguishes safe and stale drafts without auto-applying either", () => {
    expect(recoveryDecision(draft, draft.baseRevision, "磁盘", "正文")).toBe("available");
    expect(recoveryDecision(draft, "b".repeat(64), "磁盘", "正文")).toBe("stale");
    expect(recoveryDecision(draft, draft.baseRevision, draft.title, draft.content)).toBe("none");
  });

  it("rejects malformed local data", () => {
    const storage = memoryStorage();
    storage.setItem("novel-studio:recovery:v1:series:scene", "{broken");
    expect(loadRecoveryDraft(storage, "series", "scene")).toBeNull();
  });
});
