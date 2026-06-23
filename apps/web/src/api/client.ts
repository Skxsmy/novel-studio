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

  return {
    requestJson,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
