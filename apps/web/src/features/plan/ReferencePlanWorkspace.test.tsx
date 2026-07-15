// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getReferenceElementSnapshot, getReferenceStyleText } from "../../app/reference-source";
import { ReferencePlanWorkspace } from "./ReferencePlanWorkspace";

afterEach(cleanup);

describe("NS-514 P3 Plan reference workspace", () => {
  it("matches the NS-514 manifest for Plan", () => {
    const { container } = render(<ReferencePlanWorkspace />);
    const root = container.querySelector<HTMLElement>("#plan-workspace")!;
    expect(root.className).toBe("pl6 workspace-view has-inspector");
    expect(root.hidden).toBe(true);
    expect(root.innerHTML).toBe(getReferenceElementSnapshot("#plan-workspace").innerHtml);
    expect([...root.children].map((child) => `${child.tagName.toLowerCase()}${child.id ? `#${child.id}` : ""}.${child.className}`)).toEqual([
      "header.pl6-toolbar",
      "div.pl6-shell",
      "div#pl6-toast.pl6-toast",
    ]);
    expect(root.querySelectorAll("button,input,textarea,select")).toHaveLength(53);
    expect([...root.querySelectorAll<HTMLElement>("[data-pl6-view]")].map((button) => button.textContent?.trim())).toEqual([
      "Grid",
      "Outline",
      "Matrix",
      "Timeline",
    ]);
    expect(root.querySelector("[data-pl6-view='grid']")?.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector<HTMLElement>(".pl6-card.is-selected")?.dataset.pl6Scene).toBe("weather");
    for (const anchor of ["5 scenes", "The Harbor Opens", "Pressure Door", "Tide Bell", "After the Bell"]) {
      expect(root.textContent).toContain(anchor);
    }
    const css = getReferenceStyleText();
    expect(css).toContain("@media (max-width: 1180px)");
    expect(css).toContain(".pl6-shell, .pl6:not(.has-inspector) .pl6-shell { grid-template-columns: minmax(0,1fr); }");
    expect(css).toContain("@media (max-width: 780px)");
  });
});
