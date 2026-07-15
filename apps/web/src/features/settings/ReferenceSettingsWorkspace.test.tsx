// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getReferenceElementSnapshot, getReferenceStyleText } from "../../app/reference-source";
import { ReferenceSettingsWorkspace } from "./ReferenceSettingsWorkspace";

afterEach(cleanup);

describe("NS-514 P3 Settings reference workspace", () => {
  it("matches the NS-514 manifest for Settings", () => {
    const { container } = render(<ReferenceSettingsWorkspace />);
    const root = container.querySelector<HTMLElement>("#settings-workspace")!;
    expect(root.className).toBe("st7 workspace-view");
    expect(root.hidden).toBe(true);
    expect(root.innerHTML).toBe(getReferenceElementSnapshot("#settings-workspace").innerHtml);
    expect([...root.children].map((child) => `${child.tagName.toLowerCase()}${child.id ? `#${child.id}` : ""}.${child.className}`)).toEqual([
      "header.st7-head",
      "div.st7-layout",
      "div#st7-library-dialog.st7-dialog-backdrop",
      "div#st7-toast.st7-toast",
    ]);
    expect(root.querySelectorAll("button,input,textarea,select")).toHaveLength(70);
    expect(root.querySelector<HTMLElement>("[data-st7-section='connections']")?.classList.contains("is-active")).toBe(true);
    expect(root.querySelector("[data-st7-section='connections']")?.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector<HTMLElement>("[data-st7-page='connections']")?.hidden).toBe(false);
    expect([...root.querySelectorAll<HTMLElement>("[data-st7-page]:not([data-st7-page='connections'])")].every((page) => page.hidden)).toBe(true);
    for (const anchor of ["DeepSeek Primary", "Continuity Editor", "D:\\hermes\\novel-studio-library"]) {
      expect(root.textContent).toContain(anchor);
    }
    expect(root.querySelector<HTMLInputElement>("#st7-embedding-model")?.value).toBe("BAAI/bge-small-zh-v1.5");
    const css = getReferenceStyleText();
    expect(css).toContain("@media (max-width: 980px)");
    expect(css).toContain(".st7-layout { grid-template-columns: 190px minmax(0, 1fr); }");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain(".st7-layout { grid-template-columns: 1fr; grid-template-rows: 58px minmax(0, 1fr); }");
  });
});
