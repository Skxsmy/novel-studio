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
  "deepseek",
  "openai-compatible",
]);

export function isCloudRouted(profile: ModelProfile): boolean {
  return CLOUD_PROVIDERS.has(profile.provider);
}

export function providerErrorStatus(error: ModelCallError): number {
  switch (error.code) {
    case "provider-auth-failed":
      return 401;
    case "provider-billing-required":
      return 402;
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
      return 502;
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
  if (!isCloudRouted(profile)) return null;
  if (series.cloudPolicy !== "cloud-allowed") {
    return modelError(
      "cloud-disabled",
      "Project cloud policy is Local only. Enable Cloud allowed in Settings before using a cloud provider.",
    );
  }
  if (profile.cloudPolicy !== "cloud-allowed") {
    return modelError(
      "cloud-disabled",
      "Model profile cloud policy is Local only. Set this profile to Cloud allowed before using a cloud provider.",
    );
  }
  return null;
}

export function ensureCredentialBoundary(profile: ModelProfile): ModelCallError | null {
  assertSafeCredentialRef(profile.credentialRef);
  return null;
}
