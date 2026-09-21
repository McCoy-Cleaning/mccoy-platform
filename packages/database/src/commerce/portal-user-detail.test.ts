import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@mccoy/domain";

import {
  averageOrderMinor,
  invitationStatusLabelNl,
  orderStatusLabelNl,
  parseUserDetailKey,
  portalUserDetailAccess,
  rightsFromRole,
  roleLabelNl,
  splitPersonName,
} from "./portal-user-detail";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "33333333-3333-4333-8333-333333333333";
const INVITE = "44444444-4444-4444-8444-444444444444";

describe("parseUserDetailKey", () => {
  it("accepts a user uuid, membership key, and invite key", () => {
    expect(parseUserDetailKey(USER_A)).toEqual({ kind: "user", userId: USER_A });
    expect(parseUserDetailKey(`m:${COMPANY_A}:${USER_A}`)).toEqual({
      kind: "user",
      companyId: COMPANY_A,
      userId: USER_A,
    });
    expect(parseUserDetailKey(`i:${INVITE}`)).toEqual({ kind: "invite", invitationId: INVITE });
  });

  it("rejects malformed keys", () => {
    expect(parseUserDetailKey("")).toBeNull();
    expect(parseUserDetailKey("m:not-a-uuid")).toBeNull();
    expect(parseUserDetailKey("i:abc")).toBeNull();
    expect(parseUserDetailKey("sophie")).toBeNull();
  });
});

describe("portalUserDetailAccess", () => {
  it("allows staff for any company", () => {
    expect(portalUserDetailAccess({ actor: { kind: "staff" }, targetCompanyId: COMPANY_B })).toEqual({
      allowed: true,
    });
  });

  it("allows a portal member only for their own company", () => {
    expect(
      portalUserDetailAccess({
        actor: { kind: "customer", companyId: COMPANY_A },
        targetCompanyId: COMPANY_A,
      }),
    ).toEqual({ allowed: true });
    expect(
      portalUserDetailAccess({
        actor: { kind: "customer", companyId: COMPANY_A },
        targetCompanyId: COMPANY_B,
      }),
    ).toEqual({ allowed: false, error: "forbidden" });
  });
});

describe("user detail display helpers", () => {
  it("splits a Dutch name into first and last", () => {
    expect(splitPersonName("Sophie van Dijk")).toEqual({
      firstName: "Sophie",
      lastName: "van Dijk",
    });
    expect(splitPersonName("Eva")).toEqual({ firstName: "Eva", lastName: "" });
  });

  it("maps rights from the existing account role only", () => {
    expect(rightsFromRole("account_user").map((right) => [right.id, right.allowed])).toEqual([
      ["can_order", true],
      ["can_view_favourites", true],
      ["can_manage_team", false],
    ]);
    expect(rightsFromRole("account_admin").find((right) => right.id === "can_manage_team")?.allowed).toBe(
      true,
    );
    expect(roleLabelNl("account_user")).toBe("Gebruiker");
  });

  it("averages existing order totals in integer minor units", () => {
    expect(averageOrderMinor([])).toBeNull();
    expect(averageOrderMinor([{ totalMinor: 1000 }, { totalMinor: 2000 }])).toBe(1500);
    expect(averageOrderMinor([{ totalMinor: 101 }, { totalMinor: 100 }])).toBe(101);
  });

  it("labels invitation status without inventing a new model", () => {
    expect(invitationStatusLabelNl({ invitationStatus: "pending", membershipActive: false })).toBe(
      "Uitnodiging verzonden",
    );
    expect(invitationStatusLabelNl({ invitationStatus: "consumed", membershipActive: true })).toBe(
      "Geaccepteerd",
    );
    expect(invitationStatusLabelNl({ invitationStatus: null, membershipActive: true })).toBe(
      "Geaccepteerd",
    );
  });

  it("has a Dutch label for every order status in the domain enum", () => {
    for (const status of ORDER_STATUSES) {
      expect(orderStatusLabelNl(status), `missing label for ${status}`).not.toBe(status);
    }
    expect(orderStatusLabelNl("pending")).toBe("In afwachting");
    expect(orderStatusLabelNl("confirmed")).toBe("Bevestigd");
    expect(orderStatusLabelNl("completed")).toBe("Afgeleverd");
    expect(orderStatusLabelNl("cancelled")).toBe("Geannuleerd");
    expect(orderStatusLabelNl("")).toBe("—");
  });
});
