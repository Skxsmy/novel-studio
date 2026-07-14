import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const routeRoot = new URL("../src/routes/", import.meta.url);

describe("Workshop route ownership", () => {
  it("registers record routes once outside Provider and Agent orchestration", async () => {
    const [orchestrationSource, recordSource] = await Promise.all([
      readFile(new URL("workshop.ts", routeRoot), "utf8"),
      readFile(new URL("workshopRecordRoutes.ts", routeRoot), "utf8"),
    ]);
    const recordPaths = [
      "/api/v1/series/:seriesId/workshop/sessions",
      "/api/v1/series/:seriesId/workshop/sessions/:sessionId/export",
      "/api/v1/series/:seriesId/workshop/sessions/:sessionId/attachments",
      "/api/v1/series/:seriesId/workshop/sessions/:sessionId/messages",
      "/api/v1/series/:seriesId/workshop/sessions/:sessionId/messages/:messageId",
    ];
    for (const path of recordPaths) {
      expect(recordSource).toContain(`"${path}"`);
      expect(orchestrationSource).not.toContain(`"${path}"`);
    }
    expect(orchestrationSource.match(/registerWorkshopRecordRoutes\(app, repository\)/gu)).toHaveLength(1);
    expect(recordSource).not.toMatch(/ProviderRegistry|EmbeddingRouter|WorkshopAgentCoordinator|codexDraft/u);
  });
});
