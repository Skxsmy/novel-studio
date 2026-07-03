export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface RequestJsonOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
  signal?: AbortSignal;
}

export interface RequestEventStreamOptions extends RequestJsonOptions {
  onEvent: (event: unknown) => void;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "/api/v1";
  const fetchImpl = options.fetchImpl;

  async function requestJson<TResponse>(path: string, options: RequestJsonOptions = {}): Promise<TResponse> {
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const init: RequestInit = {
      headers,
      method: options.method ?? "GET",
    };

    if (options.signal) {
      init.signal = options.signal;
    }

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const response = await (fetchImpl ?? fetch)(`${baseUrl}${path}`, init);
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      throw new ApiError(response.statusText || "Request failed", response.status, payload);
    }

    return payload as TResponse;
  }

  async function requestEventStream(path: string, options: RequestEventStreamOptions): Promise<void> {
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const init: RequestInit = {
      headers,
      method: options.method ?? "GET",
    };
    if (options.signal) {
      init.signal = options.signal;
    }
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const response = await (fetchImpl ?? fetch)(`${baseUrl}${path}`, init);
    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json") ? await response.json() : await response.text();
      throw new ApiError(response.statusText || "Request failed", response.status, payload);
    }
    if (!response.body) {
      throw new ApiError("Response body is not streamable", response.status, await response.text().catch(() => ""));
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";
    const flushBlock = (block: string) => {
      const data = block
        .split(/\r?\n/u)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data) return;
      options.onEvent(JSON.parse(data));
    };

    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
        let boundary = buffer.search(/\r?\n\r?\n/u);
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          const separator = buffer.match(/\r?\n\r?\n/u)?.[0] ?? "\n\n";
          buffer = buffer.slice(boundary + separator.length);
          flushBlock(block);
          boundary = buffer.search(/\r?\n\r?\n/u);
        }
      }
      if (done) break;
    }
    buffer += decoder.decode();
    if (buffer.trim()) flushBlock(buffer);
  }

  return {
    requestEventStream,
    requestJson,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
