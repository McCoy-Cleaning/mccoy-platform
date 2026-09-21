import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isProductionRuntime } from "./env";
import { ensureMonorepoEnvLoaded } from "./load-monorepo-env.server";
import {
  AdminAuthError,
  DEV_FALLBACK_SESSION_SECRET,
  getAdminCredentials,
  isLegacyAdminAuthEnabled,
  mintLegacyAdminSessionToken,
} from "./session";

// Consume the one-shot root `.env` load up front so the per-test env resets below
// are not silently undone by a later lazy load inside the code under test.
ensureMonorepoEnvLoaded();

const TOUCHED = [
  "NODE_ENV",
  "ADMIN_SESSION_SECRET",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_LEGACY_AUTH",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of TOUCHED) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of TOUCHED) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("isProductionRuntime", () => {
  it("is true only for NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    expect(isProductionRuntime()).toBe(true);
    process.env.NODE_ENV = "development";
    expect(isProductionRuntime()).toBe(false);
  });
});

describe("legacy admin credentials fail closed in production", () => {
  it("serves dev defaults outside production", () => {
    process.env.NODE_ENV = "development";
    expect(getAdminCredentials()).toEqual({ username: "admin", password: "mccoy2026" });
  });

  it("refuses the well-known default password in production", () => {
    process.env.NODE_ENV = "production";
    expect(() => getAdminCredentials()).toThrow(AdminAuthError);
  });

  it("allows an explicitly configured production password", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_USERNAME = "Ops";
    process.env.ADMIN_PASSWORD = "a-real-configured-secret";
    expect(getAdminCredentials()).toEqual({
      username: "ops",
      password: "a-real-configured-secret",
    });
  });
});

describe("legacy admin auth is not silently enabled in production", () => {
  it("enables legacy in dev when Supabase staff env is incomplete", () => {
    process.env.NODE_ENV = "development";
    expect(isLegacyAdminAuthEnabled()).toBe(true);
  });

  it("does NOT enable legacy in production just because SUPABASE_SECRET_KEY is missing", () => {
    // Regression: a missing secret used to downgrade a deployed admin to
    // username/password with no MFA.
    process.env.NODE_ENV = "production";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
    expect(isLegacyAdminAuthEnabled()).toBe(false);
  });

  it("still honours an explicit production opt-in", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_LEGACY_AUTH = "true";
    expect(isLegacyAdminAuthEnabled()).toBe(true);
  });
});

describe("session signing secret fails closed in production", () => {
  it("signs with the dev fallback outside production", () => {
    process.env.NODE_ENV = "development";
    expect(mintLegacyAdminSessionToken("admin")).toMatch(/^[\w-]+\.[\w-]+$/);
  });

  it("refuses to mint a session in production without ADMIN_SESSION_SECRET", () => {
    process.env.NODE_ENV = "production";
    expect(() => mintLegacyAdminSessionToken("admin")).toThrow(AdminAuthError);
  });

  it("mints with an explicitly configured production secret", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_SESSION_SECRET = "a-real-configured-session-secret";
    expect(mintLegacyAdminSessionToken("admin")).toMatch(/^[\w-]+\.[\w-]+$/);
  });

  it("keeps the dev fallback value publicly documented as dev-only", () => {
    // If this constant is ever used to sign in production, anyone can forge a
    // session cookie — the production guard above is what prevents that.
    expect(DEV_FALLBACK_SESSION_SECRET).toBe("mccoy-dev-admin-session-secret-change-me");
  });
});