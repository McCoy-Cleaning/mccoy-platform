import { describe, expect, it } from "vitest";
import { cmsTextOrFallback } from "./cms-text-fallback";

describe("cmsTextOrFallback", () => {
  // Empty CMS value → use locale/static fallback (never short-circuit blank EN past NL/fallback).
  it("uses fallback when CMS value is empty", () => {
    expect(cmsTextOrFallback("", "Hello", "Hallo")).toBe("Hello");
    expect(cmsTextOrFallback(null, "Hello", "Hallo")).toBe("Hello");
    expect(cmsTextOrFallback(undefined, "Hello", "Hallo")).toBe("Hello");
  });

  it("regression: empty localized CMS must not suppress fallback (storefront guard)", () => {
    // Mirrors the removed `content.intro === "" ? "" : cmsTextOrFallback(...)` defect.
    const contentIntro = "";
    const introFallback = "English intro fallback";
    const factory = "Nederlandse fabriekstekst";
    const resolved =
      contentIntro == null || contentIntro === ""
        ? cmsTextOrFallback(contentIntro, introFallback, factory)
        : cmsTextOrFallback(contentIntro, introFallback, factory);
    expect(resolved).toBe(introFallback);
  });

  it("uses fallback when CMS value still matches factory Dutch default", () => {
    expect(cmsTextOrFallback("Hallo", "Hello", "Hallo")).toBe("Hello");
  });

  it("keeps editor-customized CMS copy", () => {
    expect(cmsTextOrFallback("Custom headline", "Hello", "Hallo")).toBe("Custom headline");
  });

  it("treats missing factory default as customized when CMS has a value", () => {
    expect(cmsTextOrFallback("Stored", "Hello")).toBe("Stored");
    expect(cmsTextOrFallback("Stored", "Hello", null)).toBe("Stored");
  });
});
