import { expect, type APIRequestContext, type Page } from "@playwright/test";

export interface SeriesSummary {
  id: string;
  title: string;
}

export interface SeriesDetail {
  manifest: { id: string; title: string };
  books: Array<{ id: string; title: string; actIds: string[] }>;
  scenes: Array<{
    metadata: {
      id: string;
      title: string;
      bookId: string;
      actId: string;
      chapterId: string;
    };
    content: string;
  }>;
}

export interface ActManifest {
  id: string;
  title: string;
  bookId: string;
  chapterIds: string[];
}

export interface ChapterManifest {
  id: string;
  title: string;
  actId: string;
  sceneIds: string[];
}

export async function expectNoBrowserErrors(page: Page, action: () => Promise<void>): Promise<void> {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console.error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  await action();

  expect(failures).toEqual([]);
}

export async function clickAndWaitForPost(
  page: Page,
  urlPart: string,
  click: () => Promise<void>,
): Promise<void> {
  const responsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes(urlPart);
  });
  await click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
}

export async function getJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const response = await request.get(url);
  expect(response.ok()).toBe(true);
  return (await response.json()) as T;
}
