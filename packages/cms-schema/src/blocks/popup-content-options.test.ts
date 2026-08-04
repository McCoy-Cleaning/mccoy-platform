import { describe, expect, it } from "vitest";
import {
  POPUP_CONTENT_BLOCK_TYPES,
  POPUP_CONTENT_EXCLUDED_BLOCK_TYPES,
} from "../button";
import { ALL_BLOCK_TYPES } from "./registry";
import {
  filterPopupContentTypeOptions,
  getPopupContentTypeOption,
  listPopupContentTypeOptions,
} from "./popup-content-options";

describe("listPopupContentTypeOptions", () => {
  it("covers every allow-listed popup content type once", () => {
    const options = listPopupContentTypeOptions();
    expect(options.map((o) => o.type)).toEqual([...POPUP_CONTENT_BLOCK_TYPES]);
    expect(new Set(options.map((o) => o.type)).size).toBe(POPUP_CONTENT_BLOCK_TYPES.length);
  });

  it("matches all block types except CTA and popup", () => {
    const expected = ALL_BLOCK_TYPES.filter(
      (t) => !(POPUP_CONTENT_EXCLUDED_BLOCK_TYPES as readonly string[]).includes(t),
    ).sort();
    expect([...POPUP_CONTENT_BLOCK_TYPES].sort()).toEqual(expected);
    expect(POPUP_CONTENT_EXCLUDED_BLOCK_TYPES).toEqual(["cta", "popup"]);
  });

  it("excludes CTA and popup nesting types only", () => {
    const types = new Set(listPopupContentTypeOptions().map((o) => o.type));
    expect(types.has("cta" as never)).toBe(false);
    expect(types.has("popup" as never)).toBe(false);
    expect(types.has("contactForm")).toBe(true);
    expect(types.has("newsletter")).toBe(true);
    expect(types.has("hero")).toBe(true);
  });

  it("provides Dutch label and description for each option", () => {
    for (const opt of listPopupContentTypeOptions()) {
      expect(opt.label.trim().length).toBeGreaterThan(0);
      expect(opt.description.trim().length).toBeGreaterThan(0);
      expect(opt.category.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("filterPopupContentTypeOptions", () => {
  const options = listPopupContentTypeOptions();

  it("returns all options for empty query", () => {
    expect(filterPopupContentTypeOptions(options, "  ")).toEqual(options);
  });

  it("matches label case-insensitively", () => {
    const filtered = filterPopupContentTypeOptions(options, "galerij");
    expect(filtered.map((o) => o.type)).toEqual(["gallery"]);
  });

  it("matches description blurbs", () => {
    const filtered = filterPopupContentTypeOptions(options, "checklist");
    expect(filtered.some((o) => o.type === "benefits")).toBe(true);
  });
});

describe("getPopupContentTypeOption", () => {
  it("resolves hero from the popup content list", () => {
    const opt = getPopupContentTypeOption("hero");
    expect(opt.type).toBe("hero");
    expect(opt.label).toBe("Hero");
  });

  it("resolves newly allowed section types", () => {
    const opt = getPopupContentTypeOption("video");
    expect(opt.type).toBe("video");
    expect(opt.label.trim().length).toBeGreaterThan(0);
  });
});
