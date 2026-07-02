// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { computeNovelCodexPreviewPosition } from "./NovelEditor";

describe("NovelEditor codex preview positioning", () => {
  it("keeps the preview inside the Write boundary", () => {
    const position = computeNovelCodexPreviewPosition({
      anchor: { bottom: 320, left: 760, right: 780, top: 300 },
      boundary: { bottom: 520, left: 40, right: 800, top: 20 },
      previewSize: { height: 180, width: 320 },
      shellSize: { height: 700, width: 900 },
    });

    expect(position.left).toBe(468);
    expect(position.top).toBe(328);
    expect(position.width).toBe(320);
    expect(position.left + position.width).toBeLessThanOrEqual(788);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(508);
  });

  it("moves above the mention when the lower boundary would be exceeded", () => {
    const position = computeNovelCodexPreviewPosition({
      anchor: { bottom: 510, left: 120, right: 180, top: 490 },
      boundary: { bottom: 520, left: 40, right: 800, top: 20 },
      previewSize: { height: 220, width: 320 },
      shellSize: { height: 700, width: 900 },
    });

    expect(position.top).toBe(262);
    expect(position.maxHeight).toBe(246);
  });
});
