import { createHash } from "node:crypto";
import {
  ModelCallErrorSchema,
  type ModelCallError,
  type ModelCallErrorCode,
} from "@novel-studio/contracts";

export class ProviderAdapterError extends Error {
  readonly code: ModelCallErrorCode;
  readonly retryable: boolean;
  readonly providerStatus: number | null;
  readonly rawOutput: string;

  constructor(
    code: ModelCallErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      providerStatus?: number | null;
      cause?: unknown;
      rawOutput?: string;
    } = {},
  ) {
    super(message);
    this.name = "ProviderAdapterError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.providerStatus = options.providerStatus ?? null;
    this.rawOutput = options.rawOutput ?? "";
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function hashRawError(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  const text = error instanceof Error
    ? `${error.name}:${error.message}:${error.stack ?? ""}`
    : JSON.stringify(error);
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function errorChainText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && !seen.has(current); depth += 1) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.name, current.message);
      current = current.cause;
      continue;
    }
    if (typeof current === "object") {
      const record = current as { code?: unknown; message?: unknown; cause?: unknown };
      if (typeof record.code === "string") parts.push(record.code);
      if (typeof record.message === "string") parts.push(record.message);
      current = record.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return parts.join(" ").toLocaleLowerCase("und");
}

export function classifyProviderError(error: unknown): ModelCallError {
  if (error instanceof ProviderAdapterError) {
    return ModelCallErrorSchema.parse({
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      providerStatus: error.providerStatus,
      rawErrorHash: hashRawError(error.cause ?? error),
    });
  }

  if (error instanceof Error) {
    const message = errorChainText(error);
    if (message.includes("unauthorized") || message.includes("authentication")) {
      return ModelCallErrorSchema.parse({
        code: "provider-auth-failed",
        message: error.message,
        retryable: false,
        providerStatus: 401,
        rawErrorHash: hashRawError(error),
      });
    }
    if (message.includes("rate limit") || message.includes("too many requests")) {
      return ModelCallErrorSchema.parse({
        code: "provider-rate-limited",
        message: error.message,
        retryable: true,
        providerStatus: 429,
        rawErrorHash: hashRawError(error),
      });
    }
    if (
      /fetch failed|network|socket|econnreset|econnrefused|etimedout|eai_again|enotfound|und_err|connection (?:closed|reset|refused)|other side closed/iu.test(
        message,
      )
    ) {
      return ModelCallErrorSchema.parse({
        code: "provider-unavailable",
        message: "Provider network request failed before a response was received.",
        retryable: true,
        providerStatus: null,
        rawErrorHash: hashRawError(error),
      });
    }
  }

  return ModelCallErrorSchema.parse({
    code: "unknown",
    message: error instanceof Error ? error.message : "未知 Provider 错误",
    retryable: false,
    providerStatus: null,
    rawErrorHash: hashRawError(error),
  });
}
