import { describe, expect, it } from "vitest";

import {
  averageOrderLabel,
  memberSinceLabel,
  teammateDetailsPath,
  teammateInitials,
  yesNoNl,
} from "./teammate-detail-view";

describe("portal teammate details helpers", () => {
  it("builds the details path for Bekijk details", () => {
    expect(teammateDetailsPath("11111111-1111-4111-8111-111111111111")).toBe(
      "/account/company/users/11111111-1111-4111-8111-111111111111",
    );
  });

  it("formats identity chrome", () => {
    expect(
      teammateInitials({
        fullName: "Sophie van Dijk",
        firstName: "Sophie",
        lastName: "van Dijk",
      }),
    ).toBe("SV");
    expect(memberSinceLabel("2024-01-12T10:00:00.000Z")).toMatch(/Lid van uw team sinds/);
    expect(yesNoNl(false)).toBe("Nee");
    expect(
      averageOrderLabel({ averageOrderMinor: 1500, averageOrderCurrency: "EUR" }),
    ).toMatch(/15[,.]00/);
    expect(averageOrderLabel({ averageOrderMinor: null, averageOrderCurrency: "EUR" })).toBe("—");
  });
});
