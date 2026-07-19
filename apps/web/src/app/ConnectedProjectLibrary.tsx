import { useEffect } from "react";

import type { ProjectSessionState } from "./useProjectSession";
import "./connected-project-library.css";

type ProjectLibrarySession = Pick<
  ProjectSessionState,
  | "activeSeries"
  | "createSeries"
  | "errorMessage"
  | "isCreatingSeries"
  | "isOpeningSeries"
  | "openSeries"
  | "seriesList"
>;

export interface ConnectedProjectLibraryProps {
  session: ProjectLibrarySession;
}

function seriesCountLabel(volumeCount: number, sceneCount: number) {
  return `${volumeCount} ${volumeCount === 1 ? "Volume" : "Volumes"} · ${sceneCount} ${sceneCount === 1 ? "Scene" : "Scenes"}`;
}

export function ConnectedProjectLibrary({ session }: ConnectedProjectLibraryProps) {
  useEffect(() => {
    const trigger = document.getElementById("project-library-button") as HTMLButtonElement | null;
    const menu = document.getElementById("project-library-menu") as HTMLElement | null;
    const dialog = document.getElementById("new-series-dialog") as HTMLElement | null;
    const newSeriesButton = document.getElementById("new-series-button") as HTMLButtonElement | null;
    const closeButton = document.getElementById("close-series-dialog") as HTMLButtonElement | null;
    const cancelButton = document.getElementById("cancel-series-dialog") as HTMLButtonElement | null;
    const form = document.getElementById("new-series-form") as HTMLFormElement | null;
    const titleInput = document.getElementById("new-series-name") as HTMLInputElement | null;
    const volumeInput = document.getElementById("new-series-volume") as HTMLInputElement | null;
    const descriptionInput = document.getElementById("new-series-description") as HTMLTextAreaElement | null;
    const error = document.getElementById("new-series-error") as HTMLElement | null;
    const createButton = document.getElementById("create-series-button") as HTMLButtonElement | null;
    const createdList = document.getElementById("library-created-list") as HTMLElement | null;
    const currentStatus = document.querySelector<HTMLElement>(".library-current-status");
    if (
      !trigger || !menu || !dialog || !newSeriesButton || !closeButton || !cancelButton || !form
      || !titleInput || !volumeInput || !descriptionInput || !error || !createButton || !createdList
    ) return;
    const projectTrigger = trigger;
    const projectMenu = menu;
    const projectDialog = dialog;
    const openDialogButton = newSeriesButton;
    const seriesTitleInput = titleInput;
    const seriesError = error;
    const seriesList = createdList;

    const cleanups: Array<() => void> = [];
    const listen = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Document,
      type: K,
      listener: (event: HTMLElementEventMap[K]) => void,
    ) => {
      target.addEventListener(type, listener as EventListener);
      cleanups.push(() => target.removeEventListener(type, listener as EventListener));
    };

    function setMenu(open: boolean) {
      projectMenu.hidden = !open;
      projectTrigger.setAttribute("aria-expanded", String(open));
      if (open) globalThis.setTimeout(() => openDialogButton.focus(), 0);
    }

    function openDialog() {
      setMenu(false);
      projectDialog.hidden = false;
      seriesError.textContent = "";
      globalThis.setTimeout(() => seriesTitleInput.focus(), 0);
    }

    function closeDialog(returnFocus = true) {
      projectDialog.hidden = true;
      seriesError.textContent = "";
      if (returnFocus) projectTrigger.focus();
    }

    function setLibraryError(message: string) {
      let target = projectMenu.querySelector<HTMLElement>("[data-project-library-error]");
      if (!target) {
        target = document.createElement("p");
        target.dataset.projectLibraryError = "true";
        target.className = "library-menu-error";
        target.setAttribute("role", "status");
        seriesList.after(target);
      }
      target.textContent = message;
      target.hidden = !message;
    }

    function renderSeriesList() {
      seriesList.replaceChildren();
      for (const series of session.seriesList.filter(
        (candidate) => !candidate.archived && candidate.id !== session.activeSeries?.manifest.id,
      )) {
        const row = document.createElement("button");
        row.className = "library-created-row library-series-choice";
        row.type = "button";
        row.disabled = session.isOpeningSeries;
        row.setAttribute("aria-label", `Open ${series.title}`);

        const copy = document.createElement("span");
        const title = document.createElement("strong");
        const summary = document.createElement("span");
        const state = document.createElement("em");
        title.textContent = series.title;
        summary.textContent = seriesCountLabel(series.bookCount, series.sceneCount);
        state.textContent = "Open";
        copy.append(title, summary);
        row.append(copy, state);
        row.addEventListener("click", async (event) => {
          event.stopPropagation();
          setLibraryError("");
          row.disabled = true;
          state.textContent = "Opening…";
          const opened = await session.openSeries(series.id);
          if (!document.contains(projectMenu)) return;
          if (opened) {
            setMenu(false);
            return;
          }
          row.disabled = false;
          state.textContent = "Open";
          setLibraryError(session.errorMessage ?? `Failed to open ${series.title}.`);
        });
        seriesList.append(row);
      }
    }

    renderSeriesList();
    if (currentStatus) currentStatus.textContent = session.activeSeries ? "Current" : "None selected";
    createButton.disabled = session.isCreatingSeries;
    createButton.textContent = session.isCreatingSeries ? "Creating…" : "Create Series";
    if (!projectDialog.hidden && session.errorMessage) seriesError.textContent = session.errorMessage;

    listen(projectTrigger, "click", (event) => {
      event.stopPropagation();
      setLibraryError("");
      setMenu(projectMenu.hidden);
    });
    listen(projectMenu, "click", (event) => event.stopPropagation());
    listen(openDialogButton, "click", openDialog);
    listen(closeButton, "click", () => closeDialog());
    listen(cancelButton, "click", () => closeDialog());
    listen(projectDialog, "mousedown", (event) => {
      if (event.target === projectDialog) closeDialog();
    });
    listen(document, "click", () => setMenu(false));
    listen(document, "keydown", (event) => {
      if (event.key === "Escape") {
        if (!projectDialog.hidden) {
          event.preventDefault();
          closeDialog();
        } else if (!projectMenu.hidden) {
          event.preventDefault();
          setMenu(false);
          projectTrigger.focus();
        }
        return;
      }
      if (event.key !== "Tab" || projectDialog.hidden) return;
      const focusable = [
        ...projectDialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled)"),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last && first) {
        event.preventDefault();
        first.focus();
      }
    });
    listen(form, "submit", (event) => {
      event.preventDefault();
      const title = seriesTitleInput.value.trim();
      const firstBookTitle = volumeInput.value.trim();
      if (!title) {
        seriesError.textContent = "Enter a Series title.";
        seriesTitleInput.focus();
        return;
      }
      if (!firstBookTitle) {
        seriesError.textContent = "Enter the first Volume title.";
        volumeInput.focus();
        return;
      }

      seriesError.textContent = "";
      createButton.disabled = true;
      createButton.textContent = "Creating…";
      void session.createSeries({
        description: descriptionInput.value.trim(),
        firstBookTitle,
        title,
      }).then((created) => {
        if (!document.contains(form)) return;
        createButton.disabled = false;
        createButton.textContent = "Create Series";
        if (!created) {
          seriesError.textContent = session.errorMessage ?? "Failed to create the Series.";
          return;
        }
        seriesTitleInput.value = "";
        volumeInput.value = "Volume 1";
        descriptionInput.value = "";
        closeDialog(false);
        setMenu(true);
      });
    });

    return () => {
      for (const cleanup of cleanups) cleanup();
      seriesList.replaceChildren();
      projectMenu.querySelector("[data-project-library-error]")?.remove();
    };
  }, [session]);

  return null;
}
