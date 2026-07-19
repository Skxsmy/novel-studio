// @vitest-environment jsdom

import type { SeriesSummary } from "@novel-studio/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReferenceSurface } from "../ui/ReferenceSurface";
import { ConnectedProjectLibrary } from "./ConnectedProjectLibrary";
import type { ProjectSessionState } from "./useProjectSession";

const availableSeries: SeriesSummary = {
  archived: false,
  bookCount: 2,
  description: "Existing project",
  directoryName: "existing-project",
  id: "11111111-1111-4111-8111-111111111111",
  sceneCount: 4,
  title: "Existing Series",
  updatedAt: "2026-07-18T00:00:00.000Z",
};

function projectSession(overrides: Partial<ProjectSessionState> = {}) {
  return {
    activeSeries: null,
    createSeries: vi.fn(async () => true),
    errorMessage: null,
    isCreatingSeries: false,
    isOpeningSeries: false,
    openSeries: vi.fn(async () => true),
    seriesList: [availableSeries],
    ...overrides,
  } as ProjectSessionState;
}

function renderProjectLibrary(session: ProjectSessionState) {
  return render(<main className="prototype">
    <ReferenceSurface selector=".appbar" />
    <ReferenceSurface selector="#new-series-dialog" />
    <ConnectedProjectLibrary session={session} />
  </main>);
}

afterEach(() => cleanup());

describe("connected NS-514 project library", () => {
  it("creates a real Series from the reference dialog and keeps it selected through project session state", async () => {
    const session = projectSession();
    const { container } = renderProjectLibrary(session);

    fireEvent.click(container.querySelector("#project-library-button")!);
    fireEvent.click(container.querySelector("#new-series-button")!);
    fireEvent.change(container.querySelector("#new-series-name")!, { target: { value: "Created Series" } });
    fireEvent.change(container.querySelector("#new-series-volume")!, { target: { value: "Opening Volume" } });
    fireEvent.change(container.querySelector("#new-series-description")!, { target: { value: "Real authority" } });
    fireEvent.submit(container.querySelector("#new-series-form")!);

    await waitFor(() => expect(session.createSeries).toHaveBeenCalledWith({
      description: "Real authority",
      firstBookTitle: "Opening Volume",
      title: "Created Series",
    }));
    await waitFor(() => expect(container.querySelector<HTMLElement>("#new-series-dialog")?.hidden).toBe(true));
    expect(container.querySelector<HTMLElement>("#project-library-menu")?.hidden).toBe(false);
    expect(container.querySelector<HTMLInputElement>("#new-series-name")?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>("#new-series-volume")?.value).toBe("Volume 1");
  });

  it("opens an existing real Series from the project menu", async () => {
    const session = projectSession();
    const { container } = renderProjectLibrary(session);

    fireEvent.click(container.querySelector("#project-library-button")!);
    const choice = await screen.findByRole("button", { name: "Open Existing Series" });
    fireEvent.click(choice);

    await waitFor(() => expect(session.openSeries).toHaveBeenCalledWith(availableSeries.id));
  });

  it("keeps the create dialog open and exposes a real failure", async () => {
    const session = projectSession({
      createSeries: vi.fn(async () => false),
      errorMessage: "Series title already exists.",
    });
    const { container } = renderProjectLibrary(session);

    fireEvent.click(container.querySelector("#project-library-button")!);
    fireEvent.click(container.querySelector("#new-series-button")!);
    fireEvent.change(container.querySelector("#new-series-name")!, { target: { value: "Existing Series" } });
    fireEvent.submit(container.querySelector("#new-series-form")!);

    await waitFor(() => expect(container.querySelector("#new-series-error")?.textContent).toContain("already exists"));
    expect(container.querySelector<HTMLElement>("#new-series-dialog")?.hidden).toBe(false);
  });
});
