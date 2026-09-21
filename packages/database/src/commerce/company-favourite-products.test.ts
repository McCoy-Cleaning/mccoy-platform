import { describe, expect, it } from "vitest";
import { AdminAuthError } from "@mccoy/security";
import { STAFF_AUDIT_ACTIONS } from "@mccoy/domain";

import {
  assertFavouriteAdminAccess,
  favouriteAdminAccessDecision,
  isProductEligibleToFavourite,
} from "./company-favourite-products";

describe("favouriteAdminAccessDecision", () => {
  it("allows staff and denies customers", () => {
    expect(favouriteAdminAccessDecision("staff")).toEqual({ allowed: true });
    expect(favouriteAdminAccessDecision("customer")).toEqual({
      allowed: false,
      error: "Niet geautoriseerd.",
    });
    expect(favouriteAdminAccessDecision("anonymous")).toEqual({
      allowed: false,
      error: "Niet geautoriseerd.",
    });
  });

  it("throws AdminAuthError so customers cannot invoke admin favourite mutations", () => {
    expect(() => assertFavouriteAdminAccess("customer")).toThrow(AdminAuthError);
    expect(() => assertFavouriteAdminAccess("anonymous")).toThrow(AdminAuthError);
    expect(() => assertFavouriteAdminAccess("staff")).not.toThrow();
  });
});

describe("isProductEligibleToFavourite", () => {
  it("allows only active catalogue products", () => {
    expect(isProductEligibleToFavourite("active")).toBe(true);
    expect(isProductEligibleToFavourite("draft")).toBe(false);
    expect(isProductEligibleToFavourite("archived")).toBe(false);
  });
});

describe("favourite audit vocabulary", () => {
  it("records company-product-list favourite changes", () => {
    expect(STAFF_AUDIT_ACTIONS).toContain("company.favourite_product_added");
    expect(STAFF_AUDIT_ACTIONS).toContain("company.favourite_product_removed");
  });
});
