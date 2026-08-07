import { describe, expect, it } from "vitest";

import { getAdminAuthCookieAttributeContract, isAdminMfaBrowserPurpose } from "./mfa-flow";

describe("security regression — cookie attribute gate", () => {
  it("documents HttpOnly / SameSite=lax / Path=/ / Secure-in-production", () => {
    const c = getAdminAuthCookieAttributeContract();
    for (const part of [c.accessToken, c.refreshToken, c.mfaFlow]) {
      expect(part.httpOnly).toBe(true);
      expect(part.sameSite).toBe("lax");
      expect(part.path).toBe("/");
      expect(part.secureInProduction).toBe(true);
    }
  });

  it("rejects arbitrary MFA purposes", () => {
    expect(isAdminMfaBrowserPurpose("mfa_setup")).toBe(true);
    expect(isAdminMfaBrowserPurpose("?mfa=true")).toBe(false);
  });
});
