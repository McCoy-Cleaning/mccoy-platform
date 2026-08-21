import { describe, expect, it } from "vitest";
import { validateCustomersSearch } from "../types/search";

describe("validateCustomersSearch", () => {
  it("defaults and clamps", () => {
    expect(validateCustomersSearch({})).toEqual({
      tab: "registered",
      q: "",
      status: "all",
      page: 1,
    });
    expect(validateCustomersSearch({ tab: "guests", q: "Ada", status: "blocked", page: "3" })).toEqual({
      tab: "guests",
      q: "Ada",
      status: "blocked",
      page: 3,
    });
  });
});
