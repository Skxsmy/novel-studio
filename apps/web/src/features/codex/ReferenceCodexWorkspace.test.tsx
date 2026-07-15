// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getReferenceElementSnapshot, getReferenceStyleText } from "../../app/reference-source";
import { ReferenceCodexWorkspace } from "./ReferenceCodexWorkspace";

afterEach(cleanup);

describe("NS-514 P3 Codex reference workspace", () => {
  it("matches the NS-514 manifest for Codex", () => {
    const { container } = render(<ReferenceCodexWorkspace />);
    const root = container.querySelector<HTMLElement>("#codex-workspace")!;
    expect(root.className).toBe("workbench workspace-view");
    expect(root.hidden).toBe(false);
    expect(root.innerHTML).toBe(getReferenceElementSnapshot("#codex-workspace").innerHtml);
    expect([...root.children].map((child) => `${child.tagName.toLowerCase()}.${child.className}`)).toEqual([
      "aside.rail",
      "section.entry-index",
      "article.detail-workspace",
    ]);
    expect(root.querySelectorAll("button,input,textarea,select")).toHaveLength(58);
    expect(root.querySelector<HTMLElement>(".category.is-active")?.dataset.category).toBe("all");
    expect(root.querySelector<HTMLElement>(".entry-row.is-selected")?.dataset.id).toBe("rin");
    expect(root.querySelector("[data-tab='canon']")?.getAttribute("aria-selected")).toBe("true");
    for (const anchor of ["Rin Vale", "Marek Sol", "Harbor Lock", "West Quay", "Night Watch Captain"]) {
      expect(root.textContent).toContain(anchor);
    }
    const css = getReferenceStyleText();
    expect(css).toContain("@media (max-width: 1180px)");
    expect(css).toContain("@media (max-width: 760px)");
  });
});
