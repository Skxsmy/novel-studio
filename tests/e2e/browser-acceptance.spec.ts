import { expect, test } from "@playwright/test";
import {
  type ActManifest,
  type ChapterManifest,
  clickAndWaitForPost,
  expectNoBrowserErrors,
  getJson,
  type SeriesDetail,
  type SeriesSummary,
} from "./helpers/browserAcceptance.js";

test.describe("M3 已实现能力浏览器验收", () => {
  test("创建系列、切换工作区、维护第二部结构与场景归属", async ({ page, request }) => {
    await expectNoBrowserErrors(page, async () => {
      const health = await getJson<{ ok: boolean; workspaceRoot: string; libraryRoot: string }>(
        request,
        "/api/v1/health",
      );
      expect(health.ok).toBe(true);
      expect(String(health.workspaceRoot)).toContain("novel-studio");
      expect(String(health.libraryRoot)).toContain("novel-studio-browser-acceptance");

      await page.goto("/");
      await expect(page.getByRole("heading", { name: "小说工作室" })).toBeVisible();

      await page.getByLabel("系列名称").fill("浏览器验收故事");
      await page.getByLabel(/一句话说明/).fill("这是一份隔离作品库中的浏览器验收数据。");
      await clickAndWaitForPost(page, "/api/v1/series", async () => {
        await page.getByRole("button", { name: "进入写作室" }).click();
      });

      await expect(page.getByRole("heading", { name: "浏览器验收故事" })).toBeVisible();
      let seriesList = await getJson<SeriesSummary[]>(request, "/api/v1/series");
      expect(seriesList).toHaveLength(1);
      const seriesId = seriesList[0]!.id;

      for (const label of ["概览", "规划", "写作", "设定库", "编辑室", "待确认"]) {
        await expect(page.getByRole("button", { name: new RegExp(label) })).toBeVisible();
      }

      await page.getByRole("button", { name: /规划/ }).click();
      await expect(page.getByRole("heading", { name: /规划|故事板|大纲|追踪表|时间线/ })).toBeVisible();

      await page.getByRole("button", { name: /写作/ }).click();
      await expect(page.getByRole("button", { name: "本章新场景" })).toBeVisible();
      await expect(page.getByRole("button", { name: "新部" })).toBeVisible();

      await page.getByRole("button", { name: "专注模式" }).click();
      await expect(page.getByRole("button", { name: "退出专注模式" })).toBeVisible();
      await page.getByRole("button", { name: "退出专注模式" }).click();
      await expect(page.getByRole("button", { name: "本章新场景" })).toBeVisible();

      await clickAndWaitForPost(page, "/books", async () => {
        await page.getByRole("button", { name: "新部" }).click();
      });
      await expect(page.getByText("第二部")).toBeVisible();

      let detail = await getJson<SeriesDetail>(request, `/api/v1/series/${seriesId}`);
      expect(detail.books).toHaveLength(2);
      const secondBook = detail.books.find((book) => book.title === "第二部");
      expect(secondBook).toBeTruthy();

      const secondBookPanel = page.locator(".book-drawer-section").filter({ hasText: "第二部" });
      await clickAndWaitForPost(page, "/scenes", async () => {
        await secondBookPanel.getByRole("button", { name: "给这一章添加第一个场景" }).click();
      });
      await expect(page.getByLabel("场景标题")).toHaveValue("场景 2");

      detail = await getJson<SeriesDetail>(request, `/api/v1/series/${seriesId}`);
      const secondBookScene = detail.scenes.find((scene) => scene.metadata.title === "场景 2");
      expect(secondBookScene?.metadata.bookId).toBe(secondBook!.id);

      await clickAndWaitForPost(page, "/acts", async () => {
        await secondBookPanel.getByRole("button", { name: "新幕" }).click();
      });
      await expect(secondBookPanel.getByText("第二幕")).toBeVisible();

      await clickAndWaitForPost(page, "/chapters", async () => {
        await secondBookPanel.locator("div", { hasText: "第二幕" }).getByRole("button", { name: "给这一幕添加第一章" }).click();
      });
      const secondBookActs = await getJson<ActManifest[]>(
        request,
        `/api/v1/series/${seriesId}/books/${secondBook!.id}/acts`,
      );
      const secondAct = secondBookActs.find((act) => act.title === "第二幕");
      expect(secondAct).toBeTruthy();
      const secondActChapters = await getJson<ChapterManifest[]>(
        request,
        `/api/v1/series/${seriesId}/acts/${secondAct!.id}/chapters`,
      );
      const secondChapter = secondActChapters.find((chapter) => chapter.title === "第一章");
      expect(secondAct?.chapterIds).toHaveLength(1);
      expect(secondChapter).toBeTruthy();

      await clickAndWaitForPost(page, "/scenes", async () => {
        await secondBookPanel.locator(".chapter-drawer-block", { hasText: "0 场景" }).getByRole("button", { name: "新场景" }).click();
      });
      await expect(page.getByLabel("场景标题")).toHaveValue("场景 3");

      detail = await getJson<SeriesDetail>(request, `/api/v1/series/${seriesId}`);
      const secondChapterScene = detail.scenes.find((scene) => scene.metadata.title === "场景 3");
      expect(secondChapterScene?.metadata.bookId).toBe(secondBook!.id);
      expect(secondChapterScene?.metadata.actId).toBe(secondAct?.id);
      expect(secondChapterScene?.metadata.chapterId).toBe(secondChapter?.id);

      await page.getByRole("button", { name: /设定库/ }).click();
      await expect(page.getByRole("heading", { name: "设定库" })).toBeVisible();

      await page.getByRole("button", { name: /编辑室/ }).click();
      await expect(page.getByRole("heading", { name: "编辑室" })).toBeVisible();

      await page.getByRole("button", { name: /待确认/ }).click();
      await expect(page.getByRole("heading", { name: "待确认", exact: true })).toBeVisible();

      seriesList = await getJson<SeriesSummary[]>(request, "/api/v1/series");
      expect(seriesList.map((series) => series.title)).toContain("浏览器验收故事");
    });
  });
});
