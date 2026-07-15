// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getReferenceElementSnapshot, getReferenceStyleText } from "../../app/reference-source";
import { ReferenceWorkshopWorkspace } from "./ReferenceWorkshopWorkspace";

afterEach(cleanup);

describe("NS-514 P3 Workshop reference workspace", () => {
  it("matches the NS-514 manifest for Workshop", () => {
    const { container } = render(<ReferenceWorkshopWorkspace />);
    const root = container.querySelector<HTMLElement>("#workshop-workspace")!;
    expect(root.className).toBe("wr5 workspace-view");
    expect(root.hidden).toBe(true);
    expect(root.innerHTML).toBe(getReferenceElementSnapshot("#workshop-workspace").innerHtml);
    expect([...root.children].map((child) => `${child.tagName.toLowerCase()}.${child.className}`)).toEqual([
      "aside.wr5-sessions",
      "main.wr5-conversation",
    ]);
    expect(root.querySelectorAll("button,input,textarea,select")).toHaveLength(76);
    expect(root.querySelector<HTMLElement>("[data-wr5-filter='all']")?.classList.contains("is-active")).toBe(true);
    expect(root.querySelector<HTMLElement>(".wr5-session.is-active")?.dataset.wr5Thread).toBe("main");
    for (const anchor of ["Harbor lock continuity", "Pressure logic branch", "lock-notes.docx", "Claude Sonnet 4", "Update Rin Vale"]) {
      expect(root.textContent).toContain(anchor);
    }
    const css = getReferenceStyleText();
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(".wr5 { grid-template-columns: minmax(0,1fr); }");
    expect(css).toContain("@media (max-height: 760px)");
  });
});
