import { describe, expect, it } from "vitest";

import {
  isStaffInviteAuthCallback,
  readStaffAuthCallbackTypeFromLocation,
} from "./staff-invite-callback";

describe("readStaffAuthCallbackTypeFromLocation", () => {
  it("reads type from query string", () => {
    expect(
      readStaffAuthCallbackTypeFromLocation({
        search: "?token_hash=abc&type=invite",
        hash: "",
        href: "https://admin.example.com/invite?token_hash=abc&type=invite",
      }),
    ).toBe("invite");
  });

  it("reads type from hash fragment", () => {
    expect(
      readStaffAuthCallbackTypeFromLocation({
        search: "",
        hash: "#access_token=x&type=recovery",
        href: "https://admin.example.com/invite#access_token=x&type=recovery",
      }),
    ).toBe("recovery");
  });
});

describe("isStaffInviteAuthCallback", () => {
  it("detects invite tokens on login path", () => {
    expect(
      isStaffInviteAuthCallback({
        pathname: "/login",
        search: "",
        hash: "#access_token=abc&refresh_token=def&type=invite",
      }),
    ).toBe(true);
  });

  it("does not redirect when already on recover-mfa shell", () => {
    expect(
      isStaffInviteAuthCallback({
        pathname: "/recover-mfa",
        search: "?token_hash=abc&type=recovery",
        hash: "",
      }),
    ).toBe(false);
  });

  it("does not redirect when already on invite shell", () => {
    expect(
      isStaffInviteAuthCallback({
        pathname: "/invite",
        search: "?token_hash=abc&type=invite",
        hash: "",
      }),
    ).toBe(false);
  });
});
