import { describe, expect, it } from "vitest";
import { uiText, WORKSHOP_UI_LOCALE } from "./uiText";

function staticStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(staticStrings);
}

describe("Workshop UI copy boundary", () => {
  it("keeps frozen Workshop chrome inside the explicit English locale boundary", () => {
    expect(WORKSHOP_UI_LOCALE).toBe("en-US");
    expect(staticStrings(uiText.workshop).filter((value) => /[^\x00-\x7F]/u.test(value))).toEqual([]);
  });
});
