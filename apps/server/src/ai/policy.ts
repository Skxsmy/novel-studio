import {
  ModelCallErrorSchema,
  type ModelCallError,
  type ModelProfile,
} from "@novel-studio/contracts";
import { assertSafeCredentialRef } from "@novel-studio/ai";

export function providerErrorStatus(error: ModelCallError): number {
  switch (error.code) {
    case "provider-auth-failed":
      return 401;
    case "provider-billing-required":
      return 402;
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

export function ensureCredentialBoundary(profile: ModelProfile): ModelCallError | null {
  assertSafeCredentialRef(profile.credentialRef);
  return null;
}
