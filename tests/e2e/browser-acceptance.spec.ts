import { writeFile } from "node:fs/promises";
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

test.describe("已实现能力浏览器验收", () => {
  test("创建系列、维护第二部结构，并完成 M4 最小模型与上下文预览路径", async ({ page, request }, testInfo) => {
    const screenshotRunId = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotManifestPath = testInfo.outputPath(`${screenshotRunId}-screenshot-manifest.json`);
    const screenshotRecords: Array<{
      label: string;
      path: string;
      url: string;
      viewport: ReturnType<typeof page.viewportSize>;
      capturedAt: string;
      projectName: string;
      retry: number;
    }> = [];
    let screenshotIndex = 0;

    async function capture(label: string): Promise<string> {
      screenshotIndex += 1;
      const safeLabel = label.replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "-");
      const path = testInfo.outputPath(`${screenshotRunId}-${String(screenshotIndex).padStart(2, "0")}-${safeLabel}.png`);
      await page.screenshot({ fullPage: true, path });
      screenshotRecords.push({
        label,
        path,
        url: page.url(),
        viewport: page.viewportSize(),
        capturedAt: new Date().toISOString(),
        projectName: testInfo.project.name,
        retry: testInfo.retry,
      });
      await writeFile(screenshotManifestPath, JSON.stringify({
        runId: screenshotRunId,
        testTitle: testInfo.title,
        outputDir: testInfo.outputDir,
        screenshots: screenshotRecords,
      }, null, 2), "utf8");
      await testInfo.attach(label, { path, contentType: "image/png" });
      return path;
    }

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
      await expect(page.getByRole("button", { name: "专注模式" })).toHaveCount(0);
      let seriesList = await getJson<SeriesSummary[]>(request, "/api/v1/series");
      expect(seriesList).toHaveLength(1);
      const seriesId = seriesList[0]!.id;
      const mockProfileResponse = await request.post(`/api/v1/series/${seriesId}/ai/model-profiles`, {
        data: {
          title: "本机验收模型",
          provider: "mock",
          model: "mock-continuity-v1",
          cloudPolicy: "cloud-allowed",
        },
      });
      expect(mockProfileResponse.ok()).toBe(true);

      for (const label of ["概览", "规划", "写作", "设定库", "编辑室", "待确认"]) {
        await expect(page.getByRole("button", { name: new RegExp(label) })).toBeVisible();
      }

      await page.getByRole("button", { name: /规划/ }).click();
      await expect(page.getByRole("heading", { name: /规划|故事板|大纲|追踪表|时间线/ })).toBeVisible();

      await page.getByRole("button", { name: /写作/ }).click();
      await expect(page.getByRole("button", { name: "本章新场景" })).toBeVisible();
      await expect(page.getByRole("button", { name: "新部" })).toBeVisible();
      await expect(page.getByRole("button", { name: "专注模式" })).toBeVisible();

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

      await page.getByRole("button", { name: /设置/ }).click();
      await expect(page.getByRole("heading", { name: "模型与资料权限" })).toBeVisible();
      await expect(page.getByRole("button", { name: "专注模式" })).toHaveCount(0);
      await expect(page.locator(".model-list").getByRole("button", { name: /本机验收模型/ })).toBeVisible();
      await clickAndWaitForPost(page, "/test", async () => {
        await page.getByRole("button", { name: "测试连接" }).click();
      });
      await expect(page.getByText(/连接正常/)).toBeVisible();
      await capture("m4-settings-model-profile");

      await clickAndWaitForPost(page, "/model-profiles", async () => {
        await page.getByRole("button", { name: "添加连接" }).click();
      });
      await expect(page.locator(".model-list").getByRole("button", { name: /DeepSeek 写作模型/ })).toBeVisible();
      await expect(page.getByLabel("服务地址")).toHaveValue("https://api.deepseek.com");
      await expect(page.getByLabel("模型")).toHaveValue("deepseek-v4-flash");
      await expect(page.getByPlaceholder("粘贴 API Key")).toBeVisible();
      await expect(page.getByText(/尚未保存密钥/)).toBeVisible();
      await capture("m4-deepseek-provider-config");

      await page.getByRole("button", { name: "角色与提示词" }).click();
      await expect(page.getByRole("heading", { name: "角色与提示词" })).toBeVisible();
      await expect(page.locator(".prompt-role-list").getByRole("button", { name: /连续性编辑/ })).toBeVisible();
      await page.locator(".prompt-role-list").getByRole("button", { name: /连续性编辑/ }).click();
      await page.locator(".prompt-preview-card").getByLabel("作者要求").fill("检查旧钟声是否提前泄露。");
      await clickAndWaitForPost(page, "/preview", async () => {
        await page.getByRole("button", { name: "预览提示词" }).click();
      });
      await expect(page.getByText("最终提示词")).toBeVisible();
      await expect(page.locator(".prompt-preview-result").getByText(/检查旧钟声是否提前泄露/)).toBeVisible();
      await capture("m4-prompt-template-preview");

      await page.getByRole("button", { name: /写作/ }).click();
      const editor = page.locator(".ProseMirror");
      await editor.click();
      const sceneSave = page.waitForResponse((response) =>
        response.request().method() === "PUT" && response.url().includes("/scenes/"),
      );
      await page.keyboard.insertText("旧钟声贴着雨幕往下坠。林岚没有回头，只把那枚铜钥匙攥得更紧。");
      await sceneSave;
      await expect(page.getByText(/● 已保存/)).toBeVisible();

      await page.getByTitle("场景资料").click();
      await expect(page.getByRole("heading", { name: "场景资料" })).toBeVisible();
      await clickAndWaitForPost(page, "/context/preview", async () => {
        await page.getByRole("button", { name: "生成上下文预览" }).click();
      });
      await expect(page.getByText("纳入资料")).toBeVisible();
      await expect(page.getByText(/项纳入/)).toBeVisible();
      await capture("m4-write-context-preview");

      await page.getByRole("button", { name: "AI 审阅" }).click();
      await expect(page.getByRole("heading", { name: "审稿" })).toBeVisible();
      await expect(page.getByRole("button", { name: "审稿" })).toBeVisible();
      await page.getByLabel("模型").selectOption({ label: "本机验收模型 · mock-continuity-v1" });
      await capture("m4-ai-panel-ready");

      await clickAndWaitForPost(page, "/ai/calls", async () => {
        await page.getByRole("button", { name: "开始" }).click();
      });
      await expect(page.getByText(/这是一段非写入型分析结果/)).toBeVisible();
      await expect(page.getByText(/审稿完成/)).toBeVisible();
      await expect(page.locator(".writing-inspector")).not.toContainText(/来源调用|来源使用|基于版本|调用 ID|用量/);
      await page.getByText(/这是一段非写入型分析结果/).scrollIntoViewIfNeeded();
      await capture("m4-ai-review-result");

      await editor.click();
      await page.keyboard.press("Control+A");
      await page.getByRole("button", { name: "改写" }).click();
      await expect(page.locator(".ai-selection-card").getByText("将改写选区")).toBeVisible();
      const inlineCandidateResponse = page.waitForResponse((response) =>
        response.request().method() === "POST" && response.url().includes("/ai/calls"),
      );
      await page.getByRole("button", { name: "生成" }).click();
      const inlineResponse = await inlineCandidateResponse;
      expect(inlineResponse.ok()).toBe(true);
      await expect(page.locator(".inline-candidate-banner").getByText("候选待确认")).toBeVisible();
      await expect(page.locator(".inline-candidate-banner")).not.toContainText(/来源调用|来源使用|基于版本|调用 ID|用量/);
      await expect(page.getByRole("button", { name: "保留" })).toBeVisible();
      await expect(page.getByRole("button", { name: "撤回" })).toBeVisible();
      await expect(editor).toContainText("MockProvider 候选正文");
      await expect.poll(
        () => page.evaluate(() => window.getSelection()?.toString() ?? ""),
        { timeout: 3_000 },
      ).toContain("MockProvider 候选正文");
      const selectedCandidate = await page.evaluate(() => window.getSelection()?.toString() ?? "");
      expect(selectedCandidate).toContain("MockProvider 候选正文");
      await capture("m4-ai-inline-candidate-selected");

      const acceptSave = page.waitForResponse((response) =>
        response.request().method() === "PUT" && response.url().includes("/scenes/"),
      );
      await page.getByRole("button", { name: "保留" }).click();
      await acceptSave;
      await expect(page.getByText(/● 已保存/)).toBeVisible();
      const savedScene = await getJson<SeriesDetail>(request, `/api/v1/series/${seriesId}`);
      const activeSavedScene = savedScene.scenes.find((scene) => scene.metadata.title === "场景 3");
      expect(activeSavedScene?.content).toContain("MockProvider 候选正文");

      seriesList = await getJson<SeriesSummary[]>(request, "/api/v1/series");
      expect(seriesList.map((series) => series.title)).toContain("浏览器验收故事");
    });
  });
});
