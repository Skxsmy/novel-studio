import { describe, expect, it } from "vitest";
import { formatDetailLines, parseDetailLines } from "./CodexView";
import { knowledgeStanceLabels, progressionChangeLabels } from "./copy";

describe("Codex detail helpers", () => {
  it("round-trips human-readable key and value lines", () => {
    const details = {
      年龄: "28",
      身份: "调查员：兼任档案管理员",
    };
    expect(parseDetailLines(formatDetailLines(details))).toEqual(details);
  });

  it("ignores malformed lines instead of inventing confirmed story fields", () => {
    expect(parseDetailLines("没有分隔符\n: 空字段\n阵营: 中立")).toEqual({
      阵营: "中立",
    });
  });

  it("uses Chinese writing terms for progression and character knowledge labels", () => {
    expect(Object.values(progressionChangeLabels)).toEqual([
      "追加事实",
      "替换此前状态",
    ]);
    expect(Object.values(knowledgeStanceLabels)).toEqual([
      "知道",
      "相信",
      "误解",
    ]);
  });
});
