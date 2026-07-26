import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT_ALIGN, type ContentAlign } from "@mccoy/cms-schema";
import {
  CONTENT_ALIGN_TW_SOURCE,
  SECTION_PAGE_RAIL,
  contentAlignJustifyClass,
  sectionInnerAlignRowClass,
  sectionInnerClass,
  sectionInnerColumnClass,
} from "./sectionLayout";

describe("contentAlign class mapping", () => {
  it("maps each align to the exact flex justify class (no off-by-one)", () => {
    expect(contentAlignJustifyClass("left")).toBe("justify-start");
    expect(contentAlignJustifyClass("center")).toBe("justify-center");
    expect(contentAlignJustifyClass("right")).toBe("justify-end");
    expect(contentAlignJustifyClass(DEFAULT_CONTENT_ALIGN)).toBe("justify-center");
    expect(contentAlignJustifyClass()).toBe("justify-center");
  });

  it("builds full-width align rows with exact classes per value", () => {
    const expected: Record<ContentAlign, string> = {
      left: "flex w-full justify-start",
      center: "flex w-full justify-center",
      right: "flex w-full justify-end",
    };
    for (const align of ["left", "center", "right"] as const) {
      expect(sectionInnerAlignRowClass(align)).toBe(expected[align]);
    }
  });

  it("keeps margin-auto fallback mapping exact (left/center/right)", () => {
    expect(sectionInnerClass("left")).toBe(
      "ml-0 mr-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8",
    );
    expect(sectionInnerClass("center")).toBe(
      "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8",
    );
    expect(sectionInnerClass("right")).toBe(
      "ml-auto mr-0 w-full max-w-7xl px-4 sm:px-6 lg:px-8",
    );
    expect(sectionInnerClass()).toBe(sectionInnerClass("center"));
  });

  it("puts gutters on the page rail, not on the alignable column", () => {
    expect(SECTION_PAGE_RAIL).toBe("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8");
    expect(SECTION_PAGE_RAIL).toContain("px-4");
    expect(sectionInnerColumnClass("7xl")).not.toContain("px-");
    expect(sectionInnerColumnClass("3xl")).not.toContain("px-");
    expect(sectionInnerColumnClass("2xl")).not.toContain("px-");
  });

  it("narrow columns use w-fit + max-width so flex justify can shift real content", () => {
    expect(sectionInnerColumnClass("7xl")).toBe("min-w-0 w-fit max-w-full");
    expect(sectionInnerColumnClass("3xl")).toBe("min-w-0 w-fit max-w-3xl");
    expect(sectionInnerColumnClass("2xl")).toBe("min-w-0 w-fit max-w-2xl");
    // Avoid basis-full / w-full on the flex child — that filled the row and
    // made justify-* a no-op when visible copy was only half the rail.
    expect(sectionInnerColumnClass("3xl")).not.toContain("w-full");
    expect(sectionInnerColumnClass("3xl")).not.toContain("basis-full");
  });

  it("keeps a static Tailwind source string covering all align utilities", () => {
    for (const token of [
      "justify-start",
      "justify-center",
      "justify-end",
      "mr-auto",
      "ml-auto",
      "mx-auto",
      "max-w-3xl",
      "w-fit",
    ]) {
      expect(CONTENT_ALIGN_TW_SOURCE).toContain(token);
    }
  });
});
