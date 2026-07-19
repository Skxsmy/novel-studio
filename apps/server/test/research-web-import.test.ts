import { describe, expect, it, vi } from "vitest";
import { acquireResearchWebPage, type ResearchWebImportDependencies } from "../src/researchWebImport.js";

const PUBLIC_A = { address: "93.184.216.34", family: 4 as const };
const PUBLIC_B = { address: "2606:4700:4700::1111", family: 6 as const };

function dependencies(
  response: ResearchWebImportDependencies["request"],
  resolve: ResearchWebImportDependencies["resolve"] = async () => [PUBLIC_A],
): ResearchWebImportDependencies {
  return { request: response, resolve };
}

describe("controlled Research web acquisition", () => {
  it("pins each validated redirect hop and records one final HTML snapshot", async () => {
    const resolve = vi.fn(async (hostname: string) => hostname === "example.com" ? [PUBLIC_A] : [PUBLIC_B]);
    const request = vi.fn(async (url: URL, address: typeof PUBLIC_A | typeof PUBLIC_B) => {
      if (url.hostname === "example.com") {
        expect(address).toEqual(PUBLIC_A);
        return { body: Buffer.alloc(0), headers: { location: "https://archive.example.net/page" }, statusCode: 302 };
      }
      expect(address).toEqual(PUBLIC_B);
      return {
        body: Buffer.from("<html><body><p>harbor evidence</p></body></html>"),
        headers: { "content-type": "text/html; charset=utf-8" },
        statusCode: 200,
      };
    });
    const result = await acquireResearchWebPage("https://example.com/start#fragment", { request, resolve });
    expect(result.origin).toMatchObject({
      requestedUrl: "https://example.com/start",
      finalUrl: "https://archive.example.net/page",
      redirectChain: ["https://archive.example.net/page"],
      responseMediaType: "text/html",
    });
    expect(result.bytes.toString("utf8")).toContain("harbor evidence");
    expect(resolve.mock.calls.map((call) => call[0])).toEqual(["example.com", "archive.example.net"]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["loopback", [{ address: "127.0.0.1", family: 4 as const }]],
    ["private", [{ address: "192.168.10.4", family: 4 as const }]],
    ["link-local", [{ address: "169.254.169.254", family: 4 as const }]],
    ["carrier NAT", [{ address: "100.64.0.1", family: 4 as const }]],
    ["IPv6 local", [{ address: "::1", family: 6 as const }]],
    ["IPv4-mapped IPv6 loopback", [{ address: "::ffff:127.0.0.1", family: 6 as const }]],
    ["hex IPv4-mapped IPv6 loopback", [{ address: "::ffff:7f00:1", family: 6 as const }]],
    ["mixed rebinding", [PUBLIC_A, { address: "10.0.0.8", family: 4 as const }]],
  ])("rejects %s DNS targets before opening a request", async (_label, addresses) => {
    const request = vi.fn();
    await expect(acquireResearchWebPage("https://example.com", dependencies(request, async () => addresses)))
      .rejects.toThrow("unsafe network target");
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects credentials, redirect loops, HTTPS downgrade, and non-HTML responses", async () => {
    await expect(acquireResearchWebPage("https://user:secret@example.com", dependencies(vi.fn())))
      .rejects.toThrow("credential-free");

    await expect(acquireResearchWebPage("https://example.com", dependencies(async () => ({
      body: Buffer.alloc(0),
      headers: { location: "https://example.com/" },
      statusCode: 302,
    })))).rejects.toThrow("redirect loop");

    await expect(acquireResearchWebPage("https://example.com", dependencies(async () => ({
      body: Buffer.alloc(0),
      headers: { location: "http://example.net/page" },
      statusCode: 302,
    })))).rejects.toThrow("downgrade");

    await expect(acquireResearchWebPage("https://example.com", dependencies(async () => ({
      body: Buffer.from("binary"),
      headers: { "content-type": "application/octet-stream" },
      statusCode: 200,
    })))).rejects.toThrow("supported HTML");
  });

  it("rejects failed and oversized responses without following page links", async () => {
    const failed = vi.fn(async () => ({ body: Buffer.from("missing"), headers: { "content-type": "text/html" }, statusCode: 404 }));
    await expect(acquireResearchWebPage("https://example.com", dependencies(failed))).rejects.toThrow("unsuccessful");
    expect(failed).toHaveBeenCalledTimes(1);

    const oversized = vi.fn(async () => ({
      body: Buffer.alloc(25 * 1024 * 1024 + 1),
      headers: { "content-type": "text/html" },
      statusCode: 200,
    }));
    await expect(acquireResearchWebPage("https://example.com", dependencies(oversized))).rejects.toThrow("outside the supported range");
    expect(oversized).toHaveBeenCalledTimes(1);
  });
});
