import { describe, expect, it } from "vitest";

import { validateUsersSearch } from "./search";

describe("validateUsersSearch", () => {
  it("defaults and accepts a selected user id without inventing a company", () => {
    expect(validateUsersSearch({})).toEqual({
      q: "",
      companyId: undefined,
      userId: undefined,
      page: 1,
    });
    expect(
      validateUsersSearch({
        q: "Bram",
        page: "2",
        companyId: "11111111-1111-4111-8111-111111111111",
        userId: "m:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222",
      }),
    ).toEqual({
      q: "Bram",
      companyId: "11111111-1111-4111-8111-111111111111",
      userId: "m:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222",
      page: 2,
    });
    expect(validateUsersSearch({ companyId: "not-a-uuid" }).companyId).toBeUndefined();
  });
});
