// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "./MarkdownEditor";

afterEach(cleanup);

describe("MarkdownEditor", () => {
  it("renders Chinese CommonMark structures without flattening their semantics", async () => {
    const { container } = render(
      <MarkdownEditor
        initialValue={[
          "# 雨夜",
          "",
          "林岚说：“别回头。” **这不是请求**。",
          "",
          "> 港口没有钟。",
          "",
          "- 第一声",
          "- 第二声",
          "",
          "[旧地图](https://example.invalid)",
          "",
          "---",
        ].join("\n")}
        onChange={vi.fn()}
        onSelectionChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("雨夜"));
    expect(container.querySelector("strong")?.textContent).toBe("这不是请求");
    expect(container.querySelector("blockquote")?.textContent).toContain("港口没有钟");
    expect([...container.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "第一声",
      "第二声",
    ]);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://example.invalid");
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("opens a 200,000-character Chinese scene within the editor budget", async () => {
    const content = "潮".repeat(200_000);
    const startedAt = Date.now();
    const { container } = render(
      <MarkdownEditor
        initialValue={content}
        onChange={vi.fn()}
        onSelectionChange={vi.fn()}
      />,
    );
    await waitFor(
      () => expect(container.querySelector(".ProseMirror")?.textContent?.length).toBe(200_000),
      { timeout: 5_000 },
    );
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });
});
