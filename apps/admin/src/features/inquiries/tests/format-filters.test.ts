import { describe, expect, it } from "vitest";
import { formatWhen, relativeWhen } from "../lib/format";
import { KIND_FILTERS, kindMeta } from "../lib/filters";
import {
  COLLAPSE_CHAR_THRESHOLD,
  isFullWidthFormField,
  isHeaderContactFormField,
  shouldCollapseFormField,
  collapseFormFieldPreview,
} from "../lib/form-fields";
import { validateInquiriesSearch } from "../types/search";

describe("formatWhen / relativeWhen", () => {
  it("formats Dutch medium datetime", () => {
    const out = formatWhen("2026-03-15T14:30:00.000Z");
    expect(out).toMatch(/2026/);
    expect(out).not.toBe("2026-03-15T14:30:00.000Z");
  });

  it("returns raw string when date is invalid", () => {
    expect(formatWhen("not-a-date")).toBe("not-a-date");
  });

  it("relativeWhen covers minutes, hours, yesterday, and days", () => {
    const now = Date.parse("2026-08-06T12:00:00.000Z");
    expect(relativeWhen(new Date(now - 30_000).toISOString(), now)).toBe("zojuist");
    expect(relativeWhen(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5 min");
    expect(relativeWhen(new Date(now - 3 * 60 * 60_000).toISOString(), now)).toBe("3 uur");
    expect(relativeWhen(new Date(now - 24 * 60 * 60_000).toISOString(), now)).toBe("Gisteren");
    expect(relativeWhen(new Date(now - 3 * 24 * 60 * 60_000).toISOString(), now)).toBe("3d");
  });
});

describe("KIND_FILTERS / kindMeta", () => {
  it("includes Alles and known form kinds", () => {
    expect(KIND_FILTERS.map((f) => f.id)).toEqual([
      "all",
      "job_application",
      "glass_washing",
      "furniture_cleaning",
      "inquiry",
      "newsletter",
    ]);
  });

  it("kindMeta falls back to Alles entry for unknown", () => {
    const meta = kindMeta("inquiry");
    expect(meta.label).toBe("Algemeen");
    expect(kindMeta("job_application").icon).toBeTruthy();
  });
});

describe("form-field helpers", () => {
  it("marks long-text keys full width", () => {
    expect(isFullWidthFormField("message")).toBe(true);
    expect(isFullWidthFormField("motivation")).toBe(true);
    expect(isFullWidthFormField("email")).toBe(false);
  });

  it("treats email and phone as header contact fields", () => {
    expect(isHeaderContactFormField("email")).toBe(true);
    expect(isHeaderContactFormField("phone")).toBe(true);
    expect(isHeaderContactFormField("name")).toBe(false);
    expect(isHeaderContactFormField("motivation")).toBe(false);
  });

  it("collapses motivation/letter over threshold only", () => {
    const long = "x".repeat(COLLAPSE_CHAR_THRESHOLD + 1);
    expect(shouldCollapseFormField("motivation", long)).toBe(true);
    expect(shouldCollapseFormField("email", long)).toBe(false);
    expect(shouldCollapseFormField("motivation", "kort")).toBe(false);
    expect(collapseFormFieldPreview(long).length).toBeLessThanOrEqual(COLLAPSE_CHAR_THRESHOLD);
  });
});

describe("validateInquiriesSearch", () => {
  it("defaults and clamps search params", () => {
    expect(validateInquiriesSearch({})).toEqual({ kind: "all", scope: "all", q: "" });
    expect(validateInquiriesSearch({ kind: "inquiry", scope: "test", q: "hello" })).toEqual({
      kind: "inquiry",
      scope: "test",
      q: "hello",
    });
    expect(validateInquiriesSearch({ kind: "nope", scope: "BAD SCOPE!", q: "x".repeat(300) })).toEqual(
      {
        kind: "all",
        scope: "all",
        q: "x".repeat(200),
      },
    );
  });
});
