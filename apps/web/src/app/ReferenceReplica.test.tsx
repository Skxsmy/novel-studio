// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReferenceReplica } from "./ReferenceReplica";
import { getReferenceRuntimeText } from "./reference-source";
import { omitCodexReferenceRuntime, omitWriteReferenceRuntime } from "./useReferenceRuntime";

function signature(element: Element) {
  return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList].map((name) => `.${name}`).join("")}${element.hasAttribute("hidden") ? "[hidden]" : ""}`;
}

afterEach(() => {
  cleanup();
  document.getElementById("ns514-binding-reference-runtime")?.remove();
  document.getElementById("ns514-binding-reference-styles")?.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("NS-514 P3/P4 reference replica", () => {
  it("omits fixture Write behavior when the connected Write workspace owns its interactions", () => {
    const runtime = omitWriteReferenceRuntime(getReferenceRuntimeText());
    expect(runtime).not.toContain('const root = document.getElementById("write-workspace");');
    expect(runtime).not.toContain('document.getElementById("wr6-save-status")');
    expect(runtime).toContain('const trigger = document.getElementById("project-library-button");');
  });

  it("omits fixture Codex data and behavior while preserving navigation and other workspaces", () => {
    const runtime = omitCodexReferenceRuntime(getReferenceRuntimeText());
    expect(runtime).not.toContain("const entries = {");
    expect(runtime).not.toContain('const search = document.getElementById("entry-search");');
    expect(runtime).not.toContain("const categoryLabels = {");
    expect(runtime).toContain('const workspaceButtons = [...document.querySelectorAll(".workspace-button[data-workspace]")];');
    expect(runtime).toContain('const root = document.getElementById("write-workspace");');
    expect(runtime).toContain('const root = document.getElementById("workshop-workspace");');
    expect(runtime).toContain('const trigger = document.getElementById("project-library-button");');
  });

  it("assembles every reference surface without non-reference controls", () => {
    const { container } = render(<ReferenceReplica connectWrite={false} enableRuntime={false} />);
    const prototype = container.querySelector("main.prototype")!;
    expect([...prototype.children].map(signature)).toEqual([
      "header.appbar",
      "div#new-series-dialog.series-dialog-backdrop[hidden]",
      "section#overview-workspace.ov7.workspace-view[hidden]",
      "section#settings-workspace.st7.workspace-view[hidden]",
      "section#plan-workspace.pl6.workspace-view.has-inspector[hidden]",
      "section#write-workspace.wr6.workspace-view.has-outline.has-inspector[hidden]",
      "section#codex-workspace.workbench.workspace-view",
      "section#workshop-workspace.wr5.workspace-view[hidden]",
      "div#wr5-review-backdrop.wr5-review-backdrop",
      "div#wr5-toast.wr5-toast",
    ]);
    expect([...container.children].map(signature)).toEqual([
      "main.prototype",
      "div#schema-backdrop.backdrop",
      "div#create-backdrop.backdrop",
      "div#category-backdrop.backdrop",
      "div#wr6-structure-backdrop.backdrop",
    ]);
    for (const legacySelector of [".project-panel", ".command-bar", ".nav-row", ".app-shell", ".workspace-sidebar"]) {
      expect(container.querySelector(legacySelector)).toBeNull();
    }
    expect(container.querySelectorAll("[data-workspace-view]")).toHaveLength(6);
    expect(container.querySelectorAll(".workspace-button[data-workspace]")).toHaveLength(8);
  });

  it("reproduces declared workspace interactions without calling product APIs", () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<ReferenceReplica connectWrite={false} />);

    const view = (name: string) => container.querySelector<HTMLElement>(`[data-workspace-view='${name}']`)!;
    const workspaceButton = (name: string) => container.querySelector<HTMLButtonElement>(`.workspace-button[data-workspace='${name}']`)!;
    expect(view("Codex").hidden).toBe(false);
    expect(workspaceButton("Codex").getAttribute("aria-current")).toBe("page");
    expect(view("Plan").classList.contains("has-inspector")).toBe(false);
    expect(view("Write").classList.contains("has-outline")).toBe(false);
    expect(view("Write").classList.contains("has-inspector")).toBe(false);

    fireEvent.click(workspaceButton("Overview"));
    expect(view("Overview").hidden).toBe(false);
    expect(view("Codex").hidden).toBe(true);
    expect(container.querySelector("#brand-context")?.textContent).toBe("Project overview");
    expect(container.querySelector<HTMLElement>("#ov7-scene-progress")?.style.width).toBe("98%");
    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-ov7-open='Plan']")!);
    expect(view("Plan").hidden).toBe(false);

    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-pl6-view='outline']")!);
    expect(container.querySelector<HTMLElement>("[data-pl6-pane='outline']")?.hidden).toBe(false);
    expect(container.querySelector<HTMLElement>("[data-pl6-pane='grid']")?.hidden).toBe(true);

    fireEvent.click(workspaceButton("Settings"));
    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-st7-section='embeddings']")!);
    expect(container.querySelector<HTMLElement>("[data-st7-page='embeddings']")?.hidden).toBe(false);
    expect(container.querySelector<HTMLElement>("[data-st7-page='connections']")?.hidden).toBe(true);

    fireEvent.click(workspaceButton("Write"));
    const write = view("Write");
    const outlineToggle = container.querySelector<HTMLButtonElement>("#wr6-toggle-outline")!;
    fireEvent.click(outlineToggle);
    expect(outlineToggle.getAttribute("aria-expanded")).toBe(String(write.classList.contains("has-outline")));
    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-wr6-tab='codex']")!);
    expect(container.querySelector("[data-wr6-tab='codex']")?.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(workspaceButton("Codex"));
    fireEvent.click(container.querySelector<HTMLButtonElement>(".entry-row[data-id='marek']")!);
    expect(container.querySelector("#hero-title")?.textContent).toBe("Marek Sol");
    fireEvent.click(container.querySelector<HTMLButtonElement>("#open-schema")!);
    expect(container.querySelector("#schema-backdrop")?.classList.contains("is-open")).toBe(true);
    fireEvent.click(container.querySelector<HTMLButtonElement>("#schema-backdrop .close-dialog")!);
    expect(container.querySelector("#schema-backdrop")?.classList.contains("is-open")).toBe(false);

    fireEvent.click(workspaceButton("Workshop"));
    fireEvent.click(container.querySelector<HTMLButtonElement>("#wr5-context-button")!);
    expect(container.querySelector("#wr5-context-popover")?.classList.contains("is-open")).toBe(true);
    fireEvent.click(container.querySelector<HTMLButtonElement>("#wr5-review-request")!);
    expect(container.querySelector("#wr5-review-backdrop")?.classList.contains("is-open")).toBe(true);
    fireEvent.click(container.querySelector<HTMLButtonElement>("#wr5-review-close")!);
    expect(container.querySelector("#wr5-review-backdrop")?.classList.contains("is-open")).toBe(false);

    const projectSwitch = container.querySelector<HTMLButtonElement>("#project-library-button")!;
    fireEvent.click(projectSwitch);
    expect(container.querySelector<HTMLElement>("#project-library-menu")?.hidden).toBe(false);
    fireEvent.click(container.querySelector<HTMLButtonElement>("#new-series-button")!);
    fireEvent.change(container.querySelector<HTMLInputElement>("#new-series-name")!, { target: { value: "Signal House" } });
    fireEvent.change(container.querySelector<HTMLInputElement>("#new-series-volume")!, { target: { value: "Northbound" } });
    fireEvent.submit(container.querySelector<HTMLFormElement>("#new-series-form")!);
    act(() => vi.advanceTimersByTime(420));
    expect(container.querySelector("#library-created-list")?.textContent).toContain("Signal House");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
