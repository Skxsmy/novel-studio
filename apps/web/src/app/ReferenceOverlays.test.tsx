// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getReferenceElementSnapshot, getReferenceStyleText } from "./reference-source";
import { ReferenceGlobalOverlays, ReferenceInFrameOverlays } from "./ReferenceOverlays";

afterEach(cleanup);

describe("NS-514 P3 reference overlays", () => {
  it("matches the NS-514 manifest for reference overlays and dialogs", () => {
    const { container } = render(
      <>
        <ReferenceInFrameOverlays />
        <ReferenceGlobalOverlays />
      </>,
    );
    const selectors = [
      "#wr5-review-backdrop",
      "#wr5-toast",
      "#schema-backdrop",
      "#create-backdrop",
      "#category-backdrop",
      "#wr6-structure-backdrop",
    ];
    for (const selector of selectors) {
      const root = container.querySelector<HTMLElement>(selector)!;
      expect(root.innerHTML).toBe(getReferenceElementSnapshot(selector).innerHtml);
    }
    expect(container.querySelector("#wr5-review-backdrop")?.className).toBe("wr5-review-backdrop");
    expect(container.querySelector("#wr5-review-backdrop")?.classList.contains("is-open")).toBe(false);
    expect(container.querySelectorAll("#wr5-review-backdrop button,#wr5-review-backdrop input,#wr5-review-backdrop textarea,#wr5-review-backdrop select")).toHaveLength(7);
    expect(container.querySelectorAll("#schema-backdrop button,#schema-backdrop input,#schema-backdrop textarea,#schema-backdrop select")).toHaveLength(14);
    expect(container.querySelectorAll("#create-backdrop button,#create-backdrop input,#create-backdrop textarea,#create-backdrop select")).toHaveLength(6);
    expect(container.querySelectorAll("#category-backdrop button,#category-backdrop input,#category-backdrop textarea,#category-backdrop select")).toHaveLength(5);
    expect(container.querySelectorAll("#wr6-structure-backdrop button,#wr6-structure-backdrop input,#wr6-structure-backdrop textarea,#wr6-structure-backdrop select")).toHaveLength(4);
    expect(container.textContent).toContain("Appearance · suggested");
    expect(container.textContent).toContain("Physical markers");
    expect(container.querySelector<HTMLInputElement>("#wr5-new-type-name")?.value).toBe("Private vow");
    const css = getReferenceStyleText();
    expect(css).toContain(".wr5-review-backdrop.is-open { display: grid; }");
    expect(css).toContain(".backdrop.is-open { display: grid; }");
    expect(css).toContain(".wr5-review-dialog { width: 100vw; height: 100vh; max-height: 100vh; border: 0; border-radius: 0; }");
  });
});
