import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ResearchDatabaseSummary } from "@novel-studio/contracts";
import { describe, expect, it, vi } from "vitest";
import { WorkshopResearchSources } from "./WorkshopResearchSources";

const seriesId = "11111111-1111-4111-8111-111111111111";
const linkedId = "22222222-2222-4222-8222-222222222222";
const unlinkedId = "33333333-3333-4333-8333-333333333333";

function database(id: string, name: string, linkedSeriesIds: string[] = []): ResearchDatabaseSummary {
  return {
    database: {
      schemaVersion: 1,
      id,
      name,
      description: "",
      linkedSeriesIds,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    },
    revision: "a".repeat(64),
    sourceCount: 2,
  };
}

const databases = [
  database(unlinkedId, "Archive atlas"),
  database(linkedId, "Series lore", [seriesId]),
];

describe("NS-607 Workshop Research source selector", () => {
  it("orders linked databases first without selecting them and returns an explicit selection", () => {
    const onChange = vi.fn();
    render(<WorkshopResearchSources
      activeDatabaseIds={[]}
      currentSeriesId={seriesId}
      databases={databases}
      onChange={onChange}
      support="supported"
    />);

    const options = screen.getAllByRole("checkbox");
    expect(within(options[0]!.closest("label")!).getByText("Series lore")).toBeTruthy();
    expect(options.every((option) => !(option as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(options[0]!);
    expect(onChange).toHaveBeenCalledWith([linkedId]);
  });

  it("restores each session selection from props and keeps unsupported-model messaging honest", () => {
    const onChange = vi.fn();
    const rendered = render(<WorkshopResearchSources
      activeDatabaseIds={[unlinkedId]}
      currentSeriesId={seriesId}
      databases={databases}
      onChange={onChange}
      support="unsupported"
    />);
    expect(screen.getByText(/cannot use native Research tools/i)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Archive atlas/i })).toHaveProperty("checked", true);

    rendered.rerender(<WorkshopResearchSources
      activeDatabaseIds={[linkedId]}
      currentSeriesId={seriesId}
      databases={databases}
      onChange={onChange}
      support="supported"
    />);
    expect(screen.getByRole("checkbox", { name: /Series lore/i })).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: /Archive atlas/i })).toHaveProperty("checked", false);
  });

  it("shows loading, errors, and stale selections without exposing a fake database row", () => {
    const { rerender } = render(<WorkshopResearchSources
      activeDatabaseIds={[]}
      currentSeriesId={seriesId}
      databases={[]}
      loading
      onChange={vi.fn()}
      support="loading"
    />);
    expect(screen.getByText("Loading Research Databases...")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

    rerender(<WorkshopResearchSources
      activeDatabaseIds={[linkedId]}
      currentSeriesId={seriesId}
      databases={[]}
      error="Database authority is damaged."
      onChange={vi.fn()}
      support="unknown"
    />);
    expect(screen.getByRole("alert").textContent).toContain("damaged");
    expect(screen.getByText(/selected database is no longer available/i)).toBeTruthy();
  });
});
