import { describe, expect, it } from "vitest";
import { createReasoningParser, splitReasoningContent } from "../src/workshop/workshopReasoning.js";

describe("Workshop reasoning normalization", () => {
  it("separates tagged reasoning from visible content", () => {
    expect(splitReasoningContent("Before<think>private</think>After")).toEqual({
      content: "BeforeAfter",
      reasoningContent: "private",
    });
  });

  it("preserves reasoning tags split across provider chunks", () => {
    const parser = createReasoningParser();
    const events = [
      ...parser.push("Visible<th"),
      ...parser.push("ink>hidden</thi"),
      ...parser.push("nk>Done"),
      ...parser.finish(),
    ];
    expect(events).toEqual([
      { type: "delta", text: "Visible" },
      { type: "reasoning-delta", text: "hidden" },
      { type: "delta", text: "Done" },
    ]);
  });
});
