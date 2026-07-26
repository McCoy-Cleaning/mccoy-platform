import { describe, expect, it } from "vitest";
import { checkSemanticPreservation } from "./semantic";

describe("checkSemanticPreservation", () => {
  it("flags missing numbers", () => {
    const result = checkSemanticPreservation({
      source: "Meer dan 25 jaar ervaring",
      target: "More than years of experience",
    });
    expect(result.ok).toBe(false);
    expect(result.warnings.some((w) => w.includes("25"))).toBe(true);
  });

  it("passes when anchors preserved", () => {
    const result = checkSemanticPreservation({
      source: "Meer dan 25 jaar ervaring",
      target: "More than 25 years of experience",
    });
    expect(result.ok).toBe(true);
  });
});
