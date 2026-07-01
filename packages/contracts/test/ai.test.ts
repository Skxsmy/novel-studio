import { describe, expect, it } from "vitest";
import {
  CreateModelProfileInputSchema,
  UpdateModelProfileInputSchema,
} from "../src/ai.js";

describe("AI model profile contracts", () => {
  it("keeps credential references out of ordinary profile create and update payloads", () => {
    const baseInput = {
      title: "DeepSeek",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    };

    expect(CreateModelProfileInputSchema.safeParse(baseInput).success).toBe(true);
    expect(UpdateModelProfileInputSchema.safeParse({ title: "DeepSeek Updated" }).success).toBe(true);
    expect(CreateModelProfileInputSchema.safeParse({
      ...baseInput,
      credentialRef: "novel-studio/model-profile/profile-id",
    }).success).toBe(false);
    expect(UpdateModelProfileInputSchema.safeParse({
      credentialRef: null,
      title: "DeepSeek Updated",
    }).success).toBe(false);
  });
});
