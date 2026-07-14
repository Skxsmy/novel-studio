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
    const message = error.message.toLowerCase();
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
  }

  return ModelCallErrorSchema.parse({
    code: "unknown",
    message: error instanceof Error ? error.message : "未知 Provider 错误",
    retryable: false,
    providerStatus: null,
    rawErrorHash: hashRawError(error),
  });
}
