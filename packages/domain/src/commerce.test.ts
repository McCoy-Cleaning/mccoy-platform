import { describe, expect, it } from "vitest";

import {
  buildCsvRow,
  escapeCsvCell,
  formatMoneyMinor,
  isGuestOrderRow,
  orderCountsTowardSpend,
} from "./commerce";
import { normalizeEmail } from "./staff";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ada@McCoy.NL ")).toBe("ada@mccoy.nl");
  });
});

describe("orderCountsTowardSpend", () => {
  it("counts paid non-cancelled only", () => {
    expect(
      orderCountsTowardSpend({ paymentStatus: "paid", orderStatus: "confirmed" }),
    ).toBe(true);
    expect(
      orderCountsTowardSpend({ paymentStatus: "paid", orderStatus: "cancelled" }),
    ).toBe(false);
    expect(
      orderCountsTowardSpend({ paymentStatus: "unpaid", orderStatus: "confirmed" }),
    ).toBe(false);
    expect(
      orderCountsTowardSpend({ paymentStatus: "failed", orderStatus: "pending" }),
    ).toBe(false);
  });
});

describe("isGuestOrderRow", () => {
  it("requires guest id and no customer user", () => {
    expect(
      isGuestOrderRow({ customerUserId: null, guestPurchaserId: "g1" }),
    ).toBe(true);
    expect(
      isGuestOrderRow({ customerUserId: "u1", guestPurchaserId: "g1" }),
    ).toBe(false);
    expect(
      isGuestOrderRow({ customerUserId: null, guestPurchaserId: null }),
    ).toBe(false);
  });
});

describe("formatMoneyMinor", () => {
  it("formats EUR cents without float drift on input", () => {
    expect(formatMoneyMinor(1999, "EUR")).toMatch(/19[,.]99/);
    expect(formatMoneyMinor(0, "EUR")).toMatch(/0[,.]00/);
  });
});

describe("csv escape", () => {
  it("quotes commas and neutralizes formulas", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("=CMD()")).toBe("'=CMD()");
    expect(buildCsvRow(["a", null, 2])).toBe("a,,2");
  });
});
