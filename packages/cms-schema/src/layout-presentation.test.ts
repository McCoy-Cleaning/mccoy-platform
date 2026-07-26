import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTENT_ALIGN,
  blockTypeSupportsContentAlign,
  contentAlignMarginClass,
  fixedKeySupportsContentAlign,
  normalizeContentAlign,
  parseContentAlign,
} from "./layout-presentation";

describe("layout-presentation", () => {
  it("defaults invalid align to center", () => {
    expect(normalizeContentAlign(undefined)).toBe(DEFAULT_CONTENT_ALIGN);
    expect(normalizeContentAlign("nope")).toBe("center");
    expect(parseContentAlign("left")).toBe("left");
    expect(parseContentAlign("weird")).toBeUndefined();
  });

  it("marks full-width types as non-alignable", () => {
    expect(blockTypeSupportsContentAlign("hero")).toBe(false);
    expect(blockTypeSupportsContentAlign("spacer")).toBe(false);
    expect(blockTypeSupportsContentAlign("richText")).toBe(true);
    expect(fixedKeySupportsContentAlign("home.hero")).toBe(false);
    expect(fixedKeySupportsContentAlign("home.partners")).toBe(true);
  });

  it("maps align to margin classes with explicit resets", () => {
    expect(contentAlignMarginClass("left")).toBe("ml-0 mr-auto");
    expect(contentAlignMarginClass("center")).toBe("mx-auto");
    expect(contentAlignMarginClass("right")).toBe("ml-auto mr-0");
    expect(contentAlignMarginClass(undefined)).toBe("mx-auto");
    // Guard against off-by-one regressions (left≠center, center≠right).
    expect(contentAlignMarginClass("left")).not.toBe(contentAlignMarginClass("center"));
    expect(contentAlignMarginClass("center")).not.toBe(contentAlignMarginClass("right"));
    expect(contentAlignMarginClass("left")).not.toBe(contentAlignMarginClass("right"));
  });

  it("defaults omitted layout align to center", () => {
    expect(DEFAULT_CONTENT_ALIGN).toBe("center");
    expect(normalizeContentAlign(null)).toBe("center");
    expect(normalizeContentAlign("")).toBe("center");
  });
});
