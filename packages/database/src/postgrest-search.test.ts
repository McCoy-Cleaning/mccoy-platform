import { describe, expect, it } from "vitest";

import {
  POSTGREST_SEARCH_MAX_LENGTH,
  clampQueryLimit,
  sanitizePostgrestSearchTerm,
} from "./postgrest-search";

describe("sanitizePostgrestSearchTerm", () => {
  it("strips the comma that would open an extra .or() clause", () => {
    // `.or("name.ilike.%<term>%,sku.ilike.%<term>%")` — a comma in the term
    // would otherwise let the caller append their own filter clause.
    const safe = sanitizePostgrestSearchTerm("abc,name.not.is.null");
    expect(safe).not.toContain(",");
    expect(safe).toBe("abc name.not.is.null");
  });

  it("strips grouping parentheses", () => {
    const safe = sanitizePostgrestSearchTerm("a)and(status.eq.draft");
    expect(safe).not.toMatch(/[()]/);
  });

  it("strips ilike wildcards so a narrow search cannot become a full scan", () => {
    expect(sanitizePostgrestSearchTerm("%")).toBe("");
    expect(sanitizePostgrestSearchTerm("_")).toBe("");
    expect(sanitizePostgrestSearchTerm("*")).toBe("");
    expect(sanitizePostgrestSearchTerm("a%b_c*d")).toBe("a b c d");
  });

  it("strips backslashes so escape sequences cannot be smuggled in", () => {
    expect(sanitizePostgrestSearchTerm("a\\%b")).toBe("a b");
  });

  it("keeps dots so email and domain search still works", () => {
    expect(sanitizePostgrestSearchTerm("jan@example.com")).toBe("jan@example.com");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizePostgrestSearchTerm("  a,,,b  ")).toBe("a b");
  });

  it("caps length", () => {
    const safe = sanitizePostgrestSearchTerm("a".repeat(5000));
    expect(safe).toHaveLength(POSTGREST_SEARCH_MAX_LENGTH);
  });

  it("accepts an explicit shorter cap", () => {
    expect(sanitizePostgrestSearchTerm("abcdef", 3)).toBe("abc");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizePostgrestSearchTerm("   ")).toBe("");
  });
});

describe("clampQueryLimit", () => {
  it("uses the fallback when undefined", () => {
    expect(clampQueryLimit(undefined, 25, 50)).toBe(25);
  });

  it("caps an oversized limit", () => {
    expect(clampQueryLimit(1_000_000, 25, 50)).toBe(50);
  });

  it("floors at one for zero and negative input", () => {
    expect(clampQueryLimit(0, 25, 50)).toBe(1);
    expect(clampQueryLimit(-10, 25, 50)).toBe(1);
  });

  it("truncates fractional input", () => {
    expect(clampQueryLimit(10.9, 25, 50)).toBe(10);
  });

  it("falls back for non-finite input", () => {
    expect(clampQueryLimit(Number.NaN, 25, 50)).toBe(25);
    expect(clampQueryLimit(Number.POSITIVE_INFINITY, 25, 50)).toBe(25);
  });
});
