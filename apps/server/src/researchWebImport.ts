import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import {
  MAX_RESEARCH_SOURCE_BYTES,
  ResearchWebOriginSchema,
  type ResearchWebOrigin,
} from "@novel-studio/contracts";
import { StorageError } from "@novel-studio/storage";

export interface ResolvedWebAddress {
  address: string;
  family: 4 | 6;
}

export interface WebResponse {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
}

export interface ResearchWebImportDependencies {
  resolve(hostname: string): Promise<ResolvedWebAddress[]>;
  request(url: URL, address: ResolvedWebAddress): Promise<WebResponse>;
}

export interface AcquiredResearchWebPage {
  bytes: Buffer;
  origin: ResearchWebOrigin;
}

const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 10_000;
const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv4");

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv6");

function invalid(message: string, details?: Record<string, unknown>): never {
  throw new StorageError(message, "INVALID_DATA", details);
}

function validateSubmittedUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid("Web address is not a valid URL");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    invalid("Web address must be credential-free HTTP or HTTPS");
  }
  if (!url.hostname || url.hostname.endsWith(".")) {
    invalid("Web address hostname is invalid");
  }
  url.hash = "";
  return url;
}

function isPublicAddress(address: ResolvedWebAddress): boolean {
  const family = isIP(address.address);
  if (family !== address.family) return false;
  if (family === 6 && address.address.toLocaleLowerCase("und").startsWith("::ffff:")) {
    const mapped = address.address.slice("::ffff:".length);
    return isIP(mapped) === 4 && !blockedAddresses.check(mapped, "ipv4");
  }
  return !blockedAddresses.check(address.address, family === 4 ? "ipv4" : "ipv6");
}

async function defaultResolve(hostname: string): Promise<ResolvedWebAddress[]> {
  const literalFamily = isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    return [{ address: hostname, family: literalFamily }];
  }
  const resolved = await dnsLookup(hostname, { all: true, verbatim: true });
  return resolved.flatMap((entry) => entry.family === 4 || entry.family === 6
    ? [{ address: entry.address, family: entry.family }]
    : []);
}

async function defaultRequest(url: URL, pinned: ResolvedWebAddress): Promise<WebResponse> {
  return new Promise<WebResponse>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, {
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9",
        "accept-encoding": "identity",
        "user-agent": "NovelStudio/0.1 controlled-research-import",
      },
      lookup: (_hostname, _options, callback) => {
        callback(null, pinned.address, pinned.family);
      },
      method: "GET",
    }, (response) => {
      const contentLength = Number.parseInt(String(response.headers["content-length"] ?? "0"), 10);
      if (Number.isFinite(contentLength) && contentLength > MAX_RESEARCH_SOURCE_BYTES) {
        response.destroy();
        reject(new StorageError("Web response is larger than the supported limit", "INVALID_DATA"));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += bytes.byteLength;
        if (total > MAX_RESEARCH_SOURCE_BYTES) {
          response.destroy(new StorageError("Web response is larger than the supported limit", "INVALID_DATA"));
          return;
        }
        chunks.push(bytes);
      });
      response.on("error", reject);
      response.on("end", () => resolve({
        body: Buffer.concat(chunks),
        headers: response.headers,
        statusCode: response.statusCode ?? 0,
      }));
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new StorageError("Web request timed out", "INVALID_DATA"));
    });
    request.on("error", reject);
    request.end();
  });
}

const defaultDependencies: ResearchWebImportDependencies = {
  resolve: defaultResolve,
  request: defaultRequest,
};

function headerValue(headers: WebResponse["headers"], name: string): string | null {
  const value = headers[name];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function acquireResearchWebPage(
  submittedUrl: string,
  dependencies: ResearchWebImportDependencies = defaultDependencies,
): Promise<AcquiredResearchWebPage> {
  const requested = validateSubmittedUrl(submittedUrl);
  let current = new URL(requested);
  const redirectChain: string[] = [];
  const seen = new Set([current.href]);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let addresses: ResolvedWebAddress[];
    try {
      addresses = await dependencies.resolve(current.hostname);
    } catch {
      invalid("Web address hostname could not be resolved");
    }
    if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) {
      invalid("Web address resolves to a local, private, reserved, or otherwise unsafe network target");
    }
    const response = await dependencies.request(current, addresses[0]!);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      if (redirectCount === MAX_REDIRECTS) invalid("Web address exceeded the redirect limit");
      const location = headerValue(response.headers, "location");
      if (!location) invalid("Web redirect did not include a destination");
      const next = validateSubmittedUrl(new URL(location, current).href);
      if (current.protocol === "https:" && next.protocol !== "https:") {
        invalid("Web redirect attempted to downgrade HTTPS to HTTP");
      }
      if (seen.has(next.href)) invalid("Web address contains a redirect loop");
      seen.add(next.href);
      redirectChain.push(next.href);
      current = next;
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      invalid("Web address returned an unsuccessful response", { statusCode: response.statusCode });
    }
    const mediaType = (headerValue(response.headers, "content-type") ?? "")
      .split(";", 1)[0]!
      .trim()
      .toLocaleLowerCase("und");
    if (mediaType !== "text/html" && mediaType !== "application/xhtml+xml") {
      invalid("Web address did not return supported HTML", { mediaType });
    }
    if (response.body.byteLength === 0 || response.body.byteLength > MAX_RESEARCH_SOURCE_BYTES) {
      invalid("Web response size is outside the supported range");
    }
    return {
      bytes: response.body,
      origin: ResearchWebOriginSchema.parse({
        type: "web",
        requestedUrl: requested.href,
        finalUrl: current.href,
        redirectChain,
        fetchedAt: new Date().toISOString(),
        responseMediaType: mediaType,
      }),
    };
  }
  invalid("Web address could not be acquired");
}
