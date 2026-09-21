import { describe, expect, it } from "vitest";

import { hashWebsiteFormClientKey, normalizeWebsiteFormClientIp } from "./website-form-client";

describe("website form client key", () => {
  it("accepts only the first valid forwarded IP", () => {
    expect(normalizeWebsiteFormClientIp("203.0.113.10, 10.0.0.1")).toBe("203.0.113.10");
    expect(normalizeWebsiteFormClientIp("[2001:db8::1]")).toBe("2001:db8::1");
    expect(normalizeWebsiteFormClientIp("spoofed-value")).toBeNull();
  });

  it("stores a stable non-reversible HMAC instead of the raw IP", () => {
    const value = hashWebsiteFormClientKey("203.0.113.10");
    expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(value).not.toContain("203.0.113.10");
  });

  it("fails closed without the dedicated secret in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSecret = process.env.WEBSITE_FORM_ABUSE_SECRET;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.WEBSITE_FORM_ABUSE_SECRET;
      expect(() => hashWebsiteFormClientKey("203.0.113.10")).toThrow(
        /abuse-protection secret is missing or too short/i,
      );
      process.env.WEBSITE_FORM_ABUSE_SECRET = "too-short";
      expect(() => hashWebsiteFormClientKey("203.0.113.10")).toThrow(/too short/i);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousSecret === undefined) delete process.env.WEBSITE_FORM_ABUSE_SECRET;
      else process.env.WEBSITE_FORM_ABUSE_SECRET = previousSecret;
    }
  });
});
