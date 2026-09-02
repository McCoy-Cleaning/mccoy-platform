import { describe, expect, it } from "vitest";
import { escapeCsvCell, orderCountsTowardSpend, isGuestOrderRow } from "@mccoy/domain";

describe("commerce invariants smoke", () => {
  it("keeps spend and guest rules stable", () => {
    expect(orderCountsTowardSpend({ paymentStatus: "paid", orderStatus: "completed" })).toBe(true);
    expect(isGuestOrderRow({ customerUserId: null, guestPurchaserId: "g" })).toBe(true);
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
  });
});
