import { describe, expect, it } from "vitest";
import { validateCustomersSearch } from "../types/search";

describe("validateCustomersSearch", () => {
  it("defaults to all and maps legacy tabs onto the directory", () => {
    expect(validateCustomersSearch({})).toEqual({
      tab: "all",
      q: "",
      status: "all",
      portalStatus: "all",
      page: 1,
      companyId: undefined,
    });
    expect(
      validateCustomersSearch({ tab: "guests", q: "Ada", status: "blocked", page: "3" }),
    ).toEqual({
      tab: "all",
      q: "Ada",
      status: "blocked",
      portalStatus: "all",
      page: 3,
      companyId: undefined,
    });
    expect(validateCustomersSearch({ tab: "registered" })).toEqual({
      tab: "service",
      q: "",
      status: "all",
      portalStatus: "all",
      page: 1,
      companyId: undefined,
    });
    expect(validateCustomersSearch({ tab: "portal" })).toEqual({
      tab: "service",
      q: "",
      status: "all",
      portalStatus: "all",
      page: 1,
      companyId: undefined,
    });
    expect(
      validateCustomersSearch({ tab: "enrolled", companyId: "not-a-uuid" }).companyId,
    ).toBeUndefined();
    expect(
      validateCustomersSearch({
        tab: "awaiting",
        companyId: "11111111-1111-4111-8111-111111111111",
      }).companyId,
    ).toBe("11111111-1111-4111-8111-111111111111");
  });
});
