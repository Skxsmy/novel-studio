// @vitest-environment jsdom

import type { SeriesDetail } from "@novel-studio/contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getReferenceElementSnapshot, getReferenceStyleText } from "../../app/reference-source";
import { api } from "../../api";
import { ReferenceOverviewWorkspace } from "./ReferenceOverviewWorkspace";

const seriesId = "11111111-1111-4111-8111-111111111111";
const volumeId = "22222222-2222-4222-8222-222222222222";
const chapterId = "33333333-3333-4333-8333-333333333333";
const actId = "44444444-4444-4444-8444-444444444444";
const sceneIds = [
  "55555555-5555-4555-8555-555555555551",
  "55555555-5555-4555-8555-555555555552",
  "55555555-5555-4555-8555-555555555553",
] as const;

function scene(
  id: string,
  title: string,
  order: number,
  status: "draft" | "outlined" | "revising",
  updatedAt: string,
  options: { characterCount?: number; divergenceNote?: string; plannedCharacters?: number; planningState?: "aligned" | "review-needed" } = {},
) {
  return {
    characterCount: options.characterCount ?? 0,
    content: title,
    document: { schemaVersion: 1 as const, blocks: [] },
    metadata: {
      actId: chapterId,
      beats: [],
      bookId: volumeId,
      chapterId: actId,
      characterIds: [],
      conflict: "",
      createdAt: "2026-07-01T00:00:00.000Z",
      divergenceNote: options.divergenceNote ?? "",
      durationMinutes: null,
      goal: order === 1 ? "Turn the real discovery into a choice." : "",
      id,
      locationIds: [],
      order,
      outcome: "",
      plannedCharacters: options.plannedCharacters ?? 0,
      planningState: options.planningState ?? "aligned",
      plotThreadIds: [],
      pov: null,
      schemaVersion: 1 as const,
      status,
      storyTime: null,
      summary: "",
      tags: [],
      title,
      updatedAt,
    },
    paragraphCount: 1,
    plainText: title,
    relativePath: `${id}.json`,
    revision: "a".repeat(64),
  };
}

const selectedScene = scene(sceneIds[0], "Real Weather Door", 1, "revising", "2026-07-18T02:00:00.000Z", {
  characterCount: 5_400,
  divergenceNote: "The real plan and draft now disagree.",
  plannedCharacters: 5_500,
  planningState: "review-needed",
});
const draftScene = scene(sceneIds[1], "Drafted Harbor", 2, "draft", "2026-07-17T02:00:00.000Z");
const plannedScene = scene(sceneIds[2], "Outlined Bell", 3, "outlined", "2026-07-16T02:00:00.000Z");

const series = {
  acts: [{ bookId: volumeId, chapterIds: [actId], createdAt: "2026-07-01T00:00:00.000Z", id: chapterId, order: 1, schemaVersion: 1, title: "Chapter One", updatedAt: "2026-07-18T02:00:00.000Z" }],
  books: [{ actIds: [chapterId], createdAt: "2026-07-01T00:00:00.000Z", id: volumeId, order: 1, schemaVersion: 1, seriesId, targetCharacters: 10_000, title: "Real Volume", updatedAt: "2026-07-18T02:00:00.000Z" }],
  chapters: [{ actId: chapterId, createdAt: "2026-07-01T00:00:00.000Z", id: actId, order: 1, sceneIds: [...sceneIds], schemaVersion: 1, title: "Act One", updatedAt: "2026-07-18T02:00:00.000Z" }],
  manifest: { archivedAt: null, bookIds: [volumeId], createdAt: "2026-07-01T00:00:00.000Z", description: "", id: seriesId, language: "zh-CN", schemaVersion: 1, title: "Real Harbor", updatedAt: "2026-07-18T02:00:00.000Z" },
  scenes: [selectedScene, draftScene, plannedScene],
} as SeriesDetail;

beforeEach(() => {
  vi.spyOn(api.proposals, "list").mockResolvedValue({
    diagnostics: [],
    items: [
      { proposal: { status: "pending" } },
      { proposal: { status: "pending" } },
      { proposal: { status: "accepted" } },
    ],
  } as never);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  it("connects real Overview data and actions without fixture project claims", async () => {
    const onOpenPlan = vi.fn();
    const onOpenWrite = vi.fn();
    const { container } = render(<ReferenceOverviewWorkspace
      onOpenPlan={onOpenPlan}
      onOpenWrite={onOpenWrite}
      session={{ activeSeries: series, selectedScene, selectedVolumeId: volumeId }}
    />);
    const root = container.querySelector<HTMLElement>("#overview-workspace")!;

    expect(root.hidden).toBe(false);
    expect(root.textContent).toContain("Real Harbor");
    expect(root.textContent).toContain("Volume · Real Volume");
    expect(root.textContent).toContain("Real Weather Door");
    expect(root.textContent).toContain("Chapter · Chapter One / Act · Act One / Scene · Real Weather Door");
    expect(root.textContent).toContain("1,080 of 1,100 words");
    expect(root.querySelector<HTMLElement>("#ov7-scene-progress")?.style.width).toBe("98%");
    expect(root.querySelector("#ov7-scene-count")?.textContent).toBe("3");
    expect(root.querySelector("#ov7-drafted-count")?.textContent).toBe("1");
    expect(root.querySelector("#ov7-active-count")?.textContent).toBe("1");
    expect(root.querySelector("#ov7-word-progress")?.textContent).toBe("54%");
    expect(root.textContent).not.toContain("The Glass Harbor");
    expect(root.textContent).not.toContain("A Weather Door");

    fireEvent.click(within(root).getByRole("button", { name: "Continue writing" }));
    fireEvent.click(within(root).getByRole("button", { name: "Continue Scene" }));
    fireEvent.click(within(root).getByRole("button", { name: /Drafted Harbor/u }));
    expect(onOpenWrite.mock.calls).toEqual([[sceneIds[0]], [sceneIds[0]], [sceneIds[1]]]);

    fireEvent.click(within(root).getByRole("button", { name: "Open plan" }));
    fireEvent.click(within(root).getByRole("button", { name: "View all in Plan" }));
    fireEvent.click(within(root).getByRole("button", { name: /PlanPlan and draft differ/u }));
    expect(onOpenPlan.mock.calls).toEqual([[null], [null], [sceneIds[0]]]);

    await waitFor(() => expect(root.textContent).toContain("2 author decisions pending."));
    expect(root.textContent).toContain("The real plan and draft now disagree.");
    expect((within(root).getByRole("button", { name: "Continuity warnings are not available yet" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps unavailable Overview capabilities visible and honest", async () => {
    vi.mocked(api.proposals.list).mockRejectedValueOnce(new Error("unavailable"));
    const noTargetSeries = {
      ...series,
      books: [{ ...series.books[0]!, targetCharacters: 0 }],
      scenes: [{
        ...selectedScene,
        metadata: { ...selectedScene.metadata, divergenceNote: "", plannedCharacters: 0, planningState: "aligned" as const },
      }],
    } as SeriesDetail;
    const { container } = render(<ReferenceOverviewWorkspace
      onOpenPlan={vi.fn()}
      onOpenWrite={vi.fn()}
      session={{ activeSeries: noTargetSeries, selectedScene: noTargetSeries.scenes[0]!, selectedVolumeId: volumeId }}
    />);
    const root = container.querySelector<HTMLElement>("#overview-workspace")!;

    expect(root.textContent).toContain("words · No target set");
    expect(root.querySelector("#ov7-word-progress")?.textContent).toBe("—");
    expect((within(root).getByRole("button", { name: /PlanPlan and draft are aligned/u }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(root).getByRole("button", { name: "Continuity warnings are not available yet" }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(within(root).getByRole("alert").textContent).toContain("Proposal queue is currently unavailable"));
  });

  it("does not show the previous Series Proposal count while a new Series is loading", async () => {
    let resolveSecond!: (value: Awaited<ReturnType<typeof api.proposals.list>>) => void;
    const secondQueue = new Promise<Awaited<ReturnType<typeof api.proposals.list>>>((resolve) => {
      resolveSecond = resolve;
    });
    vi.mocked(api.proposals.list)
      .mockResolvedValueOnce({ diagnostics: [], items: [{ proposal: { status: "pending" } }, { proposal: { status: "pending" } }] } as never)
      .mockReturnValueOnce(secondQueue);
    const view = render(<ReferenceOverviewWorkspace
      onOpenPlan={vi.fn()}
      onOpenWrite={vi.fn()}
      session={{ activeSeries: series, selectedScene, selectedVolumeId: volumeId }}
    />);
    await waitFor(() => expect(view.container.textContent).toContain("2 author decisions pending."));

    const nextSeries = {
      ...series,
      manifest: { ...series.manifest, id: "99999999-9999-4999-8999-999999999999", title: "Next Series" },
    };
    view.rerender(<ReferenceOverviewWorkspace
      onOpenPlan={vi.fn()}
      onOpenWrite={vi.fn()}
      session={{ activeSeries: nextSeries, selectedScene, selectedVolumeId: volumeId }}
    />);
    expect(view.container.textContent).toContain("Checking author decisions.");
    expect(view.container.textContent).not.toContain("2 author decisions pending.");

    resolveSecond({ diagnostics: [], items: [] });
    await waitFor(() => expect(view.container.textContent).toContain("No author decisions pending."));
  });
});
