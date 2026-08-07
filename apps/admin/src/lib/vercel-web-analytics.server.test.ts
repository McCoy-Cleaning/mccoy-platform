import { describe, expect, it } from "vitest";

import { __testParseVisitorCount } from "./vercel-web-analytics.server";

describe("parseVisitorCount", () => {
  it("reads a finite non-negative visitors total", () => {
    expect(
      __testParseVisitorCount({
        version: 1,
        data: { visitors: 42, pageviews: 100 },
      }),
    ).toBe(42);
  });

  it("floors fractional values", () => {
    expect(__testParseVisitorCount({ data: { visitors: 3.9 } })).toBe(3);
  });

  it("rejects missing or invalid payloads", () => {
    expect(__testParseVisitorCount(null)).toBeNull();
    expect(__testParseVisitorCount({})).toBeNull();
    expect(__testParseVisitorCount({ data: { visitors: -1 } })).toBeNull();
    expect(__testParseVisitorCount({ data: { visitors: "12" } })).toBeNull();
    expect(__testParseVisitorCount({ data: { visitors: Number.NaN } })).toBeNull();
  });
});
