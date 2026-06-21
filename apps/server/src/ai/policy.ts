import {
  ModelCallErrorSchema,
  type AiProvider,
  type ModelCallError,
  type ModelProfile,
  type SeriesManifest,
} from "@novel-studio/contracts";
import { assertSafeCredentialRef } from "@novel-studio/ai";

const CLOUD_PROVIDERS = new Set<AiProvider>([
  "openai",
  "anthropic",
  "google",
  "openrouter",
]);

export function isCloudRouted(profile: ModelProfile): boolean {
  return profile.cloudPolicy === "cloud-allowed" || CLOUD_PROVIDERS.has(profile.provider);
}

export function providerErrorStatus(error: ModelCallError): number {
  switch (error.code) {
    case "provider-auth-failed":
      return 401;
    case "cloud-disabled":
    case "permission-denied":
      return 403;
    case "provider-rate-limited":
      return 429;
    case "provider-unavailable":
    case "model-unavailable":
      return 503;
    case "structured-output-failed":
    case "provider-error":
      return 502;
    default:
      return 500;
  }
}

export function modelError(
  code: ModelCallError["code"],
  message: string,
  retryable = false,
): ModelCallError {
  return ModelCallErrorSchema.parse({
    code,
    message,
    retryable,
    providerStatus: null,
    rawErrorHash: null,
  });
}

export function ensureCloudAllowed(
  series: SeriesManifest,
  profile: ModelProfile,
): ModelCallError | null {
  if (series.cloudPolicy === "local-only" && isCloudRouted(profile)) {
    return modelError(
      "cloud-disabled",
      "当前作品禁止发送到云端模型。请先在作品设置中允许云端模型，或改用本地模型。",
    );
  }
  return null;
}

export function ensureCredentialBoundary(profile: ModelProfile): ModelCallError | null {
  assertSafeCredentialRef(profile.credentialRef);
  const needsCredential = isCloudRouted(profile) && profile.provider !== "mock";
  if (needsCredential && !profile.credentialRef) {
    return modelError(
      "permission-denied",
      "该模型配置缺少系统凭据引用。不会从文件、日志或请求中读取明文密钥。",
    );
  }
  return null;
}
