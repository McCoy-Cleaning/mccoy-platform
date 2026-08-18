import { describe, expect, it } from "vitest";

import {
  hasStaffAuthCallbackParams,
  parseStaffAuthCallbackParams,
} from "./staff-auth-callback-params";

describe("parseStaffAuthCallbackParams", () => {
  it("parses token_hash invite links without storing anything", () => {
    const params = parseStaffAuthCallbackParams(
      "https://admin.mccoy.nl/invite?token_hash=abc123hash&type=invite",
    );
    expect(params).toEqual({
      tokenHash: "abc123hash",
      type: "invite",
    });
    expect(hasStaffAuthCallbackParams(params)).toBe(true);
  });

  it("parses implicit hash tokens", () => {
    const params = parseStaffAuthCallbackParams(
      "https://admin.mccoy.nl/invite#access_token=atoken&refresh_token=rtoken&type=recovery",
    );
    expect(params?.accessToken).toBe("atoken");
    expect(params?.refreshToken).toBe("rtoken");
    expect(params?.type).toBe("recovery");
  });

  it("returns null when no auth callback is present", () => {
    expect(parseStaffAuthCallbackParams("https://admin.mccoy.nl/invite")).toBeNull();
    expect(hasStaffAuthCallbackParams(null)).toBe(false);
  });
});
