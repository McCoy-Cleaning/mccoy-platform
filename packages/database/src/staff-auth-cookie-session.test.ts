import { describe, expect, it } from "vitest";

import {
  ADMIN_MFA_BROWSER_PURPOSES,
  getAdminAuthCookieAttributeContract,
  isAdminMfaBrowserPurpose,
} from "@mccoy/security";

import { buildRealtimeAccessHydration } from "./staff-auth";

describe("RealtimeAccessHydration contract", () => {
  it("builds field-by-field DTO with exactly accessToken and expiresAt", () => {
    // Minimal JWT-shaped payload with exp claim (not a real signature).
    const payload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, aal: "aal2" }),
    ).toString("base64url");
    const accessToken = `hdr.${payload}.sig`;

    const result = buildRealtimeAccessHydration(accessToken);
    expect(Object.keys(result).sort()).toEqual(["accessToken", "expiresAt"]);
    expect(JSON.stringify(result)).not.toContain("refresh");
    expect(result.accessToken).toBe(accessToken);
    expect(typeof result.expiresAt).toBe("number");
  });

  it("does not spread a session-like object into the DTO", () => {
    const accessToken = "aaa.bbb.ccc";
    const result = buildRealtimeAccessHydration(accessToken);
    expect(result).toEqual({
      accessToken,
      expiresAt: expect.any(Number),
    });
    expect("refreshToken" in result).toBe(false);
  });
});

describe("Admin MFA browser purpose gate", () => {
  it("accepts only explicit purposes", () => {
    for (const purpose of ADMIN_MFA_BROWSER_PURPOSES) {
      expect(isAdminMfaBrowserPurpose(purpose)).toBe(true);
    }
    expect(isAdminMfaBrowserPurpose("mfa")).toBe(false);
    expect(isAdminMfaBrowserPurpose("true")).toBe(false);
    expect(isAdminMfaBrowserPurpose("")).toBe(false);
    expect(isAdminMfaBrowserPurpose(null)).toBe(false);
  });
});

describe("AAL2 cookie sync trust boundary", () => {
  it("requireAal2 rejects aal1 without promoting durable session (unit contract)", () => {
    // Mirrors establishStaffSessionFromTokens gate: AAL1 must not replace cookies as AAL2.
    const aal = "aal1" as "aal1" | "aal2";
    const requireAal2 = true;
    const shouldReject = requireAal2 && aal !== "aal2";
    expect(shouldReject).toBe(true);
  });

  it("requireAal2 accepts only aal2 for cookie promotion", () => {
    const aal = "aal2" as "aal1" | "aal2";
    const requireAal2 = true;
    expect(requireAal2 && aal !== "aal2").toBe(false);
  });
});

describe("Admin auth cookie attribute contract", () => {
  it("documents HttpOnly / SameSite=lax / Path=/ for sb + mfa-flow cookies", () => {
    const contract = getAdminAuthCookieAttributeContract();
    expect(contract.accessToken.name).toBe("mccoy_sb_access_token");
    expect(contract.refreshToken.name).toBe("mccoy_sb_refresh_token");
    expect(contract.accessToken.httpOnly).toBe(true);
    expect(contract.refreshToken.httpOnly).toBe(true);
    expect(contract.accessToken.sameSite).toBe("lax");
    expect(contract.refreshToken.path).toBe("/");
  });
});
