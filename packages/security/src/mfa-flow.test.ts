import { describe, expect, it } from "vitest";

import {
  ADMIN_MFA_BROWSER_PURPOSES,
  getAdminAuthCookieAttributeContract,
  isAdminMfaBrowserPurpose,
} from "./mfa-flow";

describe("MFA flow capability contracts", () => {
  it("purposes are a closed enum", () => {
    expect([...ADMIN_MFA_BROWSER_PURPOSES].sort()).toEqual([
      "authenticator_replace",
      "mfa_challenge",
      "mfa_setup",
    ]);
  });

  it("rejects route/query/boolean style purposes", () => {
    for (const bad of ["mfa", "true", "?mfa=true", "/admin/mfa", "setup", ""]) {
      expect(isAdminMfaBrowserPurpose(bad)).toBe(false);
    }
  });

  it("capability cookie contract never embeds refresh token fields", () => {
    const contract = getAdminAuthCookieAttributeContract();
    // MFA-flow capability attributes must not mention refresh tokens (sb refresh cookie is separate).
    expect(JSON.stringify(contract.mfaFlow).toLowerCase()).not.toContain("refresh");
    expect(contract.mfaFlow.name).toBe("mccoy_admin_mfa_flow");
    expect(contract.mfaFlow.httpOnly).toBe(true);
    expect(contract.mfaFlow.maxAgeSec).toBeLessThanOrEqual(15 * 60);
  });
});
