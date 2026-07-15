// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReferenceAppShell } from "./ReferenceAppShell";

const shellCss = readFileSync(resolve(import.meta.dirname, "reference-shell.css"), "utf8");
const referenceTokens = readFileSync(resolve(import.meta.dirname, "../ui/reference-tokens.css"), "utf8");

function signature(element: Element) {
  return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList].map((name) => `.${name}`).join("")}`;
}

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("NS-514 P2 reference shell", () => {
  it("renders only the manifest shell regions in reference order", () => {
    const { container } = render(<ReferenceAppShell />);
    const prototype = container.querySelector("main.prototype");
    expect(prototype).not.toBeNull();
    expect([...prototype!.children].map(signature)).toEqual([
      "header.appbar",
      "div#new-series-dialog.series-dialog-backdrop",
      "section.reference-shell-fixture",
    ]);

    const appbar = container.querySelector(".appbar");
    expect([...appbar!.children].map(signature)).toEqual([
      "div.brand",
      "nav.workspace-switcher",
      "div.appbar-right",
    ]);
    expect(container.querySelector(".project-panel")).toBeNull();
    expect(container.querySelector(".command-bar")).toBeNull();
    expect(container.querySelector(".nav-row")).toBeNull();

    const dialog = container.querySelector("#new-series-dialog .series-dialog");
    expect([...dialog!.children].map(signature)).toEqual([
      "header.series-dialog-head",
      "form#new-series-form.series-dialog-form",
    ]);

    for (const token of [
      "--bg: #e9ede8",
      "--shell: #f6f7f2",
      "--dark: #19211f",
      "--blue: #2f64d6",
      "--topbar-height: 58px",
    ]) {
      expect(referenceTokens).toContain(token);
    }
    for (const selector of [
      ".prototype",
      ".appbar",
      ".workspace-switcher",
      ".project-switch",
      ".library-menu",
      ".series-dialog-backdrop",
      "@media (max-width: 1040px)",
      "@media (max-width: 720px)",
    ]) {
      expect(shellCss).toContain(selector);
    }
  });

  it("preserves the reference default workspace and disabled navigation", () => {
    const { container } = render(<ReferenceAppShell />);
    const navigation = within(screen.getByRole("navigation", { name: "Workspaces" }));
    expect(navigation.getAllByRole("button").map((button) => button.getAttribute("data-workspace"))).toEqual([
      "Overview",
      "Plan",
      "Write",
      "Codex",
      "Workshop",
      "Review",
      "Research",
    ]);
    expect(navigation.getByRole("button", { name: "Codex" }).getAttribute("aria-current")).toBe("page");
    expect((navigation.getByRole("button", { name: "Review" }) as HTMLButtonElement).disabled).toBe(true);
    expect((navigation.getByRole("button", { name: "Research" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Settings" }) as HTMLButtonElement).disabled).toBe(false);
    expect(container.querySelector("[data-workspace-view]")?.getAttribute("data-workspace-view")).toBe("Codex");
    expect(screen.getByText("Story memory").id).toBe("brand-context");

    fireEvent.click(navigation.getByRole("button", { name: "Overview" }));
    expect(navigation.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
    expect(navigation.getByRole("button", { name: "Codex" }).hasAttribute("aria-current")).toBe(false);
    expect(screen.getByText("Project overview").id).toBe("brand-context");

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Library settings").id).toBe("brand-context");
  });

  it("reproduces project menu and New Series dialog interactions", () => {
    vi.useFakeTimers();
    const { container } = render(<ReferenceAppShell />);
    const projectSwitch = container.querySelector<HTMLButtonElement>("#project-library-button")!;
    const menu = container.querySelector<HTMLElement>("#project-library-menu")!;
    const dialog = container.querySelector<HTMLElement>("#new-series-dialog")!;

    expect(menu.hidden).toBe(true);
    fireEvent.click(projectSwitch);
    expect(projectSwitch.getAttribute("aria-expanded")).toBe("true");
    expect(menu.hidden).toBe(false);
    act(() => vi.runOnlyPendingTimers());
    expect(document.activeElement).toBe(container.querySelector("#new-series-button"));

    fireEvent.click(container.querySelector("#new-series-button")!);
    expect(menu.hidden).toBe(true);
    expect(dialog.hidden).toBe(false);
    act(() => vi.runOnlyPendingTimers());
    expect(document.activeElement).toBe(container.querySelector("#new-series-name"));

    fireEvent.submit(container.querySelector("#new-series-form")!);
    expect(screen.getByRole("alert").textContent).toContain("Enter a Series title.");

    fireEvent.change(container.querySelector("#new-series-name")!, { target: { value: "Signal House" } });
    fireEvent.change(container.querySelector("#new-series-volume")!, { target: { value: "Northbound" } });
    fireEvent.submit(container.querySelector("#new-series-form")!);
    expect((container.querySelector("#create-series-button") as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector("#create-series-button")?.textContent).toContain("Creating…");

    act(() => vi.advanceTimersByTime(420));
    expect(dialog.hidden).toBe(true);
    expect(menu.hidden).toBe(false);
    expect(container.querySelector("#library-created-list")?.textContent).toContain("Signal House");
    expect(container.querySelector("#library-created-list")?.textContent).toContain("Volume · Northbound");
    expect(container.querySelector("#library-created-list")?.textContent).toContain("Created");
    expect(container.querySelector<HTMLInputElement>("#new-series-name")?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>("#new-series-volume")?.value).toBe("Volume 1");
  });

  it("keeps reference shell interactions keyboard reachable", () => {
    vi.useFakeTimers();
    const { container } = render(<ReferenceAppShell />);
    const projectSwitch = container.querySelector<HTMLButtonElement>("#project-library-button")!;

    fireEvent.click(projectSwitch);
    act(() => vi.runOnlyPendingTimers());
    fireEvent.keyDown(document, { key: "Escape" });
    expect((container.querySelector("#project-library-menu") as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(projectSwitch);

    fireEvent.click(projectSwitch);
    fireEvent.click(container.querySelector("#new-series-button")!);
    act(() => vi.runOnlyPendingTimers());
    const close = container.querySelector<HTMLButtonElement>("#close-series-dialog")!;
    const create = container.querySelector<HTMLButtonElement>("#create-series-button")!;
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(create);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: "Escape" });
    expect((container.querySelector("#new-series-dialog") as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(projectSwitch);

    fireEvent.click(projectSwitch);
    expect((container.querySelector("#project-library-menu") as HTMLElement).hidden).toBe(false);
    fireEvent.click(document.body);
    expect((container.querySelector("#project-library-menu") as HTMLElement).hidden).toBe(true);
  });
});
