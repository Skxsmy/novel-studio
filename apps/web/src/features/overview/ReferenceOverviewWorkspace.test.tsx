// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getReferenceElementSnapshot, getReferenceStyleText } from "../../app/reference-source";
import { ReferenceOverviewWorkspace } from "./ReferenceOverviewWorkspace";

afterEach(cleanup);

describe("NS-514 P3 Overview reference workspace", () => {
  it("matches the NS-514 manifest for Overview", () => {
    const { container } = render(
      <ReferenceOverviewWorkspace />,
    );
    const root = container.querySelector<HTMLElement>("#overview-workspace")!;
    const binding = getReferenceElementSnapshot("#overview-workspace");

    expect(root.tagName).toBe("SECTION");
    expect(root.className).toBe("ov7 workspace-view");
    expect(root.hidden).toBe(true);
    expect(root.getAttribute("data-workspace-view")).toBe("Overview");
    expect(root.getAttribute("aria-label")).toBe("Overview workspace");
    expect(root.innerHTML).toBe(binding.innerHtml);
    expect([...root.children].map((child) => `${child.tagName.toLowerCase()}.${child.className}`)).toEqual([
      "header.ov7-head",
      "div.ov7-scroll",
    ]);
    expect(root.querySelectorAll("button")).toHaveLength(9);
    expect(screen.getAllByText("A Weather Door").length).toBeGreaterThan(0);
    expect(root.textContent).toContain("1,080 of 1,100 words");
    expect(root.textContent).toContain("39%");
    expect(root.textContent).toContain("Broken Gauge");
    expect(root.textContent).toContain("Low Water");
    expect(root.querySelector<HTMLElement>("#ov7-scene-progress")?.style.width).toBe("");

    const css = getReferenceStyleText();
    expect(css).toContain("@media (max-width: 980px)");
    expect(css).toContain(".ov7-resume { grid-template-columns: 1fr; gap: 22px; }");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain(".ov7-content { padding: 20px 14px 50px; }");
  });

  it("exposes only the reference Overview workspace action targets", () => {
    const { container } = render(<ReferenceOverviewWorkspace />);
    const root = container.querySelector<HTMLElement>("#overview-workspace")!;
    expect([...root.querySelectorAll<HTMLElement>("[data-ov7-open]")].map((node) => node.dataset.ov7Open)).toEqual([
      "Plan",
      "Plan",
    ]);
    expect([...root.querySelectorAll<HTMLElement>("[data-ov7-write]")].map((node) => node.dataset.ov7Write)).toEqual([
      "A Weather Door",
      "A Weather Door",
      "A Weather Door",
      "Broken Gauge",
      "Low Water",
    ]);
    expect(root.querySelector<HTMLElement>("[data-ov7-plan]")?.dataset.ov7Plan).toBe("weather");
    expect(root.querySelector<HTMLElement>("[data-ov7-codex]")?.dataset.ov7Codex).toBe("rin");
  });
});
