import { describe, expect, it } from "vitest";
import { validateCustomersSearch } from "../types/search";

describe("validateCustomersSearch", () => {
  it("defaults to portal and clamps", () => {
    expect(validateCustomersSearch({})).toEqual({
      tab: "portal",
      q: "",
      status: "all",
      portalStatus: "all",
      page: 1,
    });
    expect(validateCustomersSearch({ tab: "guests", q: "Ada", status: "blocked", page: "3" })).toEqual({
      tab: "guests",
      q: "Ada",
      status: "blocked",
      portalStatus: "all",
      page: 3,
    });
    expect(validateCustomersSearch({ tab: "registered" })).toEqual({
      tab: "portal",
      q: "",
      status: "all",
      portalStatus: "all",
      page: 1,
    });
  });
});
