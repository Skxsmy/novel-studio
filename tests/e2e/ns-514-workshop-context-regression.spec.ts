import { expect, test } from "./isolated-test.js";
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
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack ?? error.message}`));

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
  const profileResponse = await request.post("/api/v1/ai/model-profiles", {
    data: {
      title: "NS-514 browser Mock model",
      provider: "mock",
      model: "mock-continuity-v1",
    },
  });
  expect(profileResponse.ok()).toBe(true);
  const connectionSettings = page.locator("[data-st7-page='connections']");
  await expect(connectionSettings.getByLabel("Connection name", { exact: true })).toBeEditable();
  await connectionSettings.getByLabel("Provider", { exact: true }).selectOption("ollama");
  await connectionSettings.getByLabel("Connection name", { exact: true }).fill("NS-514 browser Ollama model");
  await connectionSettings.getByRole("button", { name: "Add connection" }).click();
  await expect(page.getByText("Connection saved.", { exact: true })).toBeVisible();
  await connectionSettings.getByRole("button", { name: "New connection" }).click();
  await connectionSettings.getByLabel("Provider", { exact: true }).selectOption("ollama");
  await connectionSettings.getByLabel("Connection name", { exact: true }).fill("NS-514 browser secondary Ollama model");
  await connectionSettings.getByLabel("Model", { exact: true }).fill("qwen2.5");
  await connectionSettings.getByRole("button", { name: "Add connection" }).click();
  await expect(connectionSettings.getByRole("button", { name: /NS-514 browser Ollama model.*llama3\.1/u })).toBeVisible();
  await expect(connectionSettings.getByRole("button", { name: /NS-514 browser secondary Ollama model.*qwen2\.5/u })).toBeVisible();
  await page.getByRole("button", { name: "Return to Workshop" }).click();
  await expect(page.getByRole("heading", { name: "Context chain conversation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "mock-continuity-v1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Model options" })).toBeEnabled();
  await page.getByRole("button", { name: "mock-continuity-v1" }).click();
  const refreshedModelDialog = page.getByRole("dialog", { name: "Choose model" });
  await expect(refreshedModelDialog.getByRole("radio", { name: "mock-continuity-v1" })).toBeVisible();
  await expect(refreshedModelDialog.getByRole("radio", { name: "llama3.1" })).toBeVisible();
  await expect(refreshedModelDialog.getByRole("radio", { name: "qwen2.5" })).toBeVisible();
  await page.keyboard.press("Escape");

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

test("keeps two model connections distinct in compact Settings", async ({ page, request }, testInfo) => {
  const seriesResponse = await request.post("/api/v1/series", {
    data: { title: "NS-514 compact Settings" },
  });
  expect(seriesResponse.ok()).toBe(true);
  const localModelResponse = await request.post("/api/v1/ai/model-profiles", {
    data: { title: "000 Compact local model", provider: "mock", model: "mock-compact-v1" },
  });
  const primaryResponse = await request.post("/api/v1/ai/model-profiles", {
    data: { title: "Compact primary Ollama", provider: "ollama", model: "llama3.1" },
  });
  const secondaryResponse = await request.post("/api/v1/ai/model-profiles", {
    data: { title: "Compact secondary Ollama", provider: "ollama", model: "qwen2.5" },
  });
  expect(localModelResponse.ok()).toBe(true);
  expect(primaryResponse.ok()).toBe(true);
  expect(secondaryResponse.ok()).toBe(true);

  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack ?? error.message}`));
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  const connectionSettings = page.locator("[data-st7-page='connections']");
  const primary = connectionSettings.getByRole("button", { name: /Compact primary Ollama.*llama3\.1/u });
  const secondary = connectionSettings.getByRole("button", { name: /Compact secondary Ollama.*qwen2\.5/u });
  await expect(primary).toBeVisible();
  await expect(secondary).toBeVisible();
  await secondary.click();
  await expect(connectionSettings.getByRole("region", { name: "Edit Compact secondary Ollama" })).toBeVisible();
  await expect(connectionSettings.getByLabel("Model", { exact: true })).toHaveValue("qwen2.5");

  await connectionSettings.getByRole("button", { name: "New connection" }).click();
  await expect(connectionSettings.getByRole("region", { name: "New model connection" })).toBeVisible();
  await expect(connectionSettings.getByRole("button", { name: "Add connection" })).toBeVisible();
  await expect(primary).toBeVisible();
  await expect(secondary).toBeVisible();

  const screenshotPath = testInfo.outputPath("compact-model-connections.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  await testInfo.attach("Compact model connections", { path: screenshotPath, contentType: "image/png" });
  expect(browserErrors).toEqual([]);
});
