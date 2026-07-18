import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

interface CreatedSeries {
  manifest: { id: string; title: string };
}

interface WorkshopSession {
  id: string;
}

interface HealthResponse {
  libraryRoot: string;
}

interface WorkshopSessionDetail {
  messages: Array<{
    content: string;
    contextBundleId: string | null;
    role: string;
  }>;
}

interface ContextBundle {
  id: string;
  items: Array<{
    kind: string;
    manuallySelected: boolean;
    source: { id: string | null; type: string };
    title: string;
  }>;
}

test("selects context in Workshop and proves the sent Context Bundle contains it", async ({ page, request }, testInfo) => {
  const seriesResponse = await request.post("/api/v1/series", {
    data: { title: "NS-514 context chain" },
  });
  expect(seriesResponse.ok()).toBe(true);
  const series = await seriesResponse.json() as CreatedSeries;

  const legacySessionResponse = await request.post(`/api/v1/series/${series.manifest.id}/workshop/sessions`, {
    data: { title: "Legacy Codex creation conversation" },
  });
  expect(legacySessionResponse.ok()).toBe(true);
  const legacySession = await legacySessionResponse.json() as WorkshopSession;

  const sessionResponse = await request.post(`/api/v1/series/${series.manifest.id}/workshop/sessions`, {
    data: { title: "Context chain conversation" },
  });
  expect(sessionResponse.ok()).toBe(true);
  const session = await sessionResponse.json() as WorkshopSession;

  const healthResponse = await request.get("/api/v1/health");
  expect(healthResponse.ok()).toBe(true);
  const health = await healthResponse.json() as HealthResponse;
  const seriesDirectory = (await readdir(health.libraryRoot, { withFileTypes: true }))
    .find((entry) => entry.isDirectory() && entry.name.endsWith(`-${series.manifest.id.slice(0, 8)}`));
  expect(seriesDirectory, "created Series authority directory").toBeTruthy();
  const messageDirectory = path.join(
    health.libraryRoot,
    seriesDirectory!.name,
    "workshop",
    "messages",
  );
  await mkdir(messageDirectory, { recursive: true });
  const legacyMessageId = randomUUID();
  await writeFile(path.join(messageDirectory, `${legacyMessageId}.json`), `${JSON.stringify({
    schemaVersion: 1,
    id: legacyMessageId,
    seriesId: series.manifest.id,
    sessionId: legacySession.id,
    role: "assistant",
    mode: "codex-creation",
    content: "Legacy message with a removed mode.",
    createdAt: "2026-07-18T00:00:00.000Z",
  }, null, 2)}\n`, "utf8");

  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

  await page.goto("/");
  await page.getByRole("button", { name: "Workshop" }).click();
  await expect(page.getByRole("heading", { name: "Context chain conversation" })).toBeVisible();
  const composer = page.getByLabel("Workshop message");
  await expect(composer).toBeEnabled();
  await composer.click();
  await expect(composer).toBeFocused();
  await expect(page.getByRole("button", { name: /Context\s+0/u })).toBeEnabled();
  const attachFile = page.getByRole("button", { name: "Attach file" });
  await expect(attachFile).toBeEnabled();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await attachFile.click();
  await fileChooserPromise;
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Model options" })).toBeDisabled();

  await page.getByRole("button", { name: /No model configured/u }).click();
  const modelDialog = page.getByRole("dialog", { name: "Choose model" });
  await expect(modelDialog).toContainText("No model configured");
  await modelDialog.getByRole("button", { name: "Open Model connections" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Model connections" })).toBeVisible();
  await expect(page.getByLabel("Connection name")).toBeEditable();
  await page.getByRole("button", { name: "Return to Workshop" }).click();
  await expect(page.getByRole("heading", { name: "Context chain conversation" })).toBeVisible();

  const profileResponse = await request.post("/api/v1/ai/model-profiles", {
    data: {
      title: "NS-514 browser Mock model",
      provider: "mock",
      model: "mock-continuity-v1",
    },
  });
  expect(profileResponse.ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Workshop" }).click();
  await expect(page.getByRole("heading", { name: "Context chain conversation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Model options" })).toBeEnabled();

  await page.getByRole("button", { name: /Context\s+0/u }).click();
  const contextDialog = page.getByRole("dialog", { name: "Choose context" });
  await expect(contextDialog).toBeVisible();
  const basketResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "PUT" &&
    response.url().includes(`/workshop/sessions/${session.id}/context-basket`),
  );
  await contextDialog.getByRole("button", { name: /Full Outline/u }).click();
  const basketResponse = await basketResponsePromise;
  expect(basketResponse.ok()).toBe(true);
  await expect(contextDialog.getByRole("button", { name: /Full Outline/u })).toHaveClass(/is-selected/u);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Context\s+1/u })).toBeVisible();

  const userRequest = "Prove that the selected outline reaches this model call.";
  await composer.fill(userRequest);
  const callResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    response.url().includes(`/workshop/sessions/${session.id}/calls/stream`),
  );
  await composer.press("Enter");
  const callResponse = await callResponsePromise;
  expect(callResponse.ok()).toBe(true);
  await callResponse.finished();
  await expect(page.locator(".wr5-prose").filter({ hasText: "MockProvider" })).toBeVisible();

  const savedSessionResponse = await request.get(
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
  );
  expect(savedSessionResponse.ok()).toBe(true);
  const savedSession = await savedSessionResponse.json() as WorkshopSessionDetail;
  const authorMessageIndex = savedSession.messages.findIndex((message) =>
    message.role === "author" && message.content === userRequest,
  );
  expect(authorMessageIndex).toBeGreaterThanOrEqual(0);
  const assistantMessage = savedSession.messages
    .slice(authorMessageIndex + 1)
    .find((message) => message.role === "assistant");
  expect(assistantMessage?.contextBundleId).toBeTruthy();

  const contextBundleResponse = await request.get(
    `/api/v1/series/${series.manifest.id}/context/${assistantMessage!.contextBundleId}`,
  );
  expect(contextBundleResponse.ok()).toBe(true);
  const contextBundle = await contextBundleResponse.json() as ContextBundle;
  expect(contextBundle.id).toBe(assistantMessage!.contextBundleId);
  expect(contextBundle.items).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: "full-outline",
      manuallySelected: true,
      source: expect.objectContaining({ id: series.manifest.id, type: "series" }),
      title: "Full outline",
    }),
  ]));

  const promptAuditResponse = await request.get(
    `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/export?includePromptAudit=true&includeReasoning=false`,
  );
  expect(promptAuditResponse.ok()).toBe(true);
  const promptAudit = await promptAuditResponse.text();
  expect(promptAudit).toContain(`Message contextBundleId: ${contextBundle.id}`);
  expect(promptAudit).toContain("Context Items Sent To Provider:");
  expect(promptAudit).toContain("#### full-outline | Full outline");

  const screenshotPath = testInfo.outputPath("ns-514-workshop-context-chain.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  await testInfo.attach("Workshop context chain", { path: screenshotPath, contentType: "image/png" });
  expect(browserErrors).toEqual([]);
});
