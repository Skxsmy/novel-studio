import { describe, expect, it } from "vitest";
import {
  WORKSHOP_TOOL_POLICIES,
  guardWorkshopToolCalls,
  guardWorkshopToolResult,
  workshopToolDefinitionsForStep,
} from "../src/workshop/workshopToolPolicy.js";

function call(name: string, argumentsValue: object = {}) {
  return { id: `call-${name}`, name, arguments: JSON.stringify(argumentsValue) };
}

describe("NS-607 Workshop tool policy", () => {
  it("registers every current Workshop tool with explicit effect and confirmation policy", () => {
    expect(WORKSHOP_TOOL_POLICIES).toEqual([
      expect.objectContaining({ name: "research.list_sources", effect: "read", execution: "automatic-read", confirmation: "none" }),
      expect.objectContaining({ name: "research.search", effect: "read", execution: "automatic-read", confirmation: "none" }),
      expect.objectContaining({ name: "research.open_passage", effect: "read", execution: "automatic-read", confirmation: "none" }),
      expect.objectContaining({ name: "codex.create_entry", effect: "write", execution: "author-confirmed-write", confirmation: "exact-author-confirmation" }),
      expect.objectContaining({ name: "codex.update_entry", effect: "write", execution: "author-confirmed-write", confirmation: "exact-author-confirmation" }),
    ]);
    expect(new Set(WORKSHOP_TOOL_POLICIES.map((policy) => policy.name)).size).toBe(5);
  });

  it("exposes only tools allowed by mode, native capability, and Research state", () => {
    const activeDatabases = [{ id: "0f56cb99-06ea-4b41-a885-e574e9ed7dd3", name: "Ritual references" }];
    const generalChat = workshopToolDefinitionsForStep({
      mode: "general-chat",
      nativeToolCalls: true,
      activeDatabases,
      allowResearchTools: true,
    });
    expect(generalChat.map((tool) => tool.name)).toEqual([
      "research.list_sources",
      "research.search",
      "research.open_passage",
    ]);
    expect(generalChat.find((tool) => tool.name === "research.search")?.description).toContain(
      "Do not search merely because a database is active",
    );

    const agent = workshopToolDefinitionsForStep({
      mode: "agent",
      nativeToolCalls: true,
      activeDatabases,
      allowResearchTools: true,
    });
    expect(agent.map((tool) => tool.name)).toEqual([
      "codex.create_entry",
      "codex.update_entry",
      "research.list_sources",
      "research.search",
      "research.open_passage",
    ]);
    expect(agent.find((tool) => tool.name === "codex.create_entry")?.description).toContain(
      "only when the author explicitly asks",
    );

    expect(workshopToolDefinitionsForStep({
      mode: "agent",
      nativeToolCalls: false,
      activeDatabases,
      allowResearchTools: true,
    })).toEqual([]);
    expect(workshopToolDefinitionsForStep({
      mode: "agent",
      nativeToolCalls: true,
      activeDatabases,
      allowResearchTools: false,
    }).map((tool) => tool.name)).toEqual(["codex.create_entry", "codex.update_entry"]);
  });

  it("routes one read to automatic execution and one write to exact confirmation", () => {
    const available = new Set([
      "research.search",
      "codex.create_entry",
      "codex.update_entry",
    ]);
    expect(guardWorkshopToolCalls({
      mode: "agent",
      calls: [call("research.search", { query: "winter solstice" })],
      availableToolNames: available,
    })).toMatchObject({ action: "execute-read", policy: { effect: "read" } });
    expect(guardWorkshopToolCalls({
      mode: "agent",
      calls: [call("codex.create_entry")],
      availableToolNames: available,
    })).toMatchObject({
      action: "request-confirmation",
      policy: { effect: "write", replay: "never-without-authority-proof" },
    });
  });

  it("rejects mixed, unavailable, and unknown calls before any execution", () => {
    const mixed = guardWorkshopToolCalls({
      mode: "agent",
      calls: [call("research.search"), call("codex.update_entry")],
      availableToolNames: new Set(["research.search", "codex.update_entry"]),
    });
    expect(mixed).toMatchObject({ action: "reject", code: "PARALLEL_TOOL_CALLS_REJECTED" });

    const generalChatWrite = guardWorkshopToolCalls({
      mode: "general-chat",
      calls: [call("codex.create_entry")],
      availableToolNames: new Set(["research.search"]),
    });
    expect(generalChatWrite).toMatchObject({ action: "reject", code: "TOOL_NOT_AVAILABLE" });

    const unknown = guardWorkshopToolCalls({
      mode: "agent",
      calls: [call("series.delete")],
      availableToolNames: new Set(["series.delete"]),
    });
    expect(unknown).toMatchObject({ action: "reject", code: "TOOL_NOT_AVAILABLE" });

    const exhausted = guardWorkshopToolCalls({
      mode: "agent",
      calls: [call("research.search")],
      availableToolNames: new Set(["codex.create_entry"]),
      unavailableToolReasons: new Map([["research.search", {
        code: "BUDGET_EXHAUSTED",
        message: "Use evidence already returned.",
      }]]),
    });
    expect(exhausted).toMatchObject({ action: "reject", code: "BUDGET_EXHAUSTED" });
  });

  it("validates automatic tool result identity and blocks writes from the read continuation", () => {
    expect(guardWorkshopToolResult({
      call: call("research.search"),
      result: { ok: true, tool: "research.search", results: [] },
    })).toEqual({ ok: true });
    expect(guardWorkshopToolResult({
      call: call("research.search"),
      result: { ok: true, tool: "research.open_passage", results: [] },
    })).toMatchObject({ ok: false, code: "TOOL_RESULT_IDENTITY_MISMATCH" });
    expect(guardWorkshopToolResult({
      call: call("codex.update_entry"),
      result: { ok: true, tool: "codex.update_entry" },
    })).toMatchObject({ ok: false, code: "WRITE_RESULT_REQUIRES_CONFIRMATION_PATH" });
  });
});
