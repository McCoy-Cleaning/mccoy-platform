/**
 * Deterministic acceptance contracts for cookie-only Admin auth.
 * Complements staff-auth-cookie-session / supabase-browser tests.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ADMIN_LEGACY_AUTH_STORAGE_KEYS,
  clearMfaBrowserMemory,
  clearRealtimeBrowserMemory,
  getAdminRealtimeAuthConfig,
  purgeAllowlistedLegacyAuthKeys,
  __resetAdminSupabaseClientsForTests,
} from "./supabase-browser";

const here = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromLib: string): string {
  return readFileSync(join(here, relativeFromLib), "utf8");
}

describe("LOGIN path contracts", () => {
  it("normal supabase login path does not dual-write browser signInWithPassword", () => {
    const src = readSrc("admin-auth.ts");
    // Primary success path: adminSignInWithEmail then purge + return (no second password sign-in).
    const primary = src.slice(
      src.indexOf("if (looksLikeEmail && mode?.supabaseEnabled)"),
      src.indexOf("if (browserPathAvailable(looksLikeEmail))"),
    );
    expect(primary).toContain("adminSignInWithEmail");
    expect(primary).toContain("purgeAllowlistedLegacyAuthKeys");
    expect(primary).not.toContain("signInWithPassword");
  });

  it("browser signInWithPassword exists only in rare fallback helper", () => {
    const src = readSrc("admin-auth.ts");
    expect(src).toContain("async function signInViaBrowserThenEstablish");
    const fallback = src.slice(src.indexOf("async function signInViaBrowserThenEstablish"));
    expect(fallback).toContain("signInWithPassword");
    expect(fallback).toContain("clearMfaBrowserMemory");
    expect(fallback).not.toContain("auth.signOut");
  });
});

describe("REALTIME path contracts", () => {
  it("browser auth refresh remains disabled", () => {
    expect(getAdminRealtimeAuthConfig()).toEqual({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });

  it("notification service hydrates via server and calls realtime.setAuth", () => {
    const src = readSrc("notifications/notification-service.ts");
    expect(src).toContain("adminHydrateRealtimeAccessToken");
    expect(src).toContain("supabase.realtime.setAuth(accessToken)");
    expect(src).toContain("applyRealtimeAccessToken");
    expect(src).not.toContain("auth.setSession");
    expect(src).not.toContain("autoRefreshToken: true");
  });

  it("realtime hydrate server fn documents no refreshToken", () => {
    const src = readSrc("api/admin-auth.functions.ts");
    expect(src).toContain("adminHydrateRealtimeAccessToken");
    expect(src).toContain('setResponseHeader("Cache-Control", "no-store")');
    expect(src).toContain("Access-token-only Realtime hydrate");
  });
});

describe("MFA path contracts", () => {
  it("setSession is only on MFA hydrate helper using MFA client", () => {
    const hydrate = readSrc("hydrate-browser-supabase-session.ts");
    expect(hydrate).toContain("getAdminMfaSupabase");
    expect(hydrate).toContain("auth.setSession");
    expect(hydrate).toContain("ensureMfaBrowserSessionForPurpose");
    expect(hydrate).toContain("clearMfaBrowserMemory");
    expect(hydrate).not.toMatch(/await\s+\w*\.?auth\.signOut\s*\(/);
    expect(hydrate).toContain("destroyMfaBrowserSessionLocally");
  });

  it("MFA page uses requireAal2 and local teardown without signOut", () => {
    const mfa = readFileSync(join(here, "../routes/admin.mfa.tsx"), "utf8");
    expect(mfa).toContain("requireAal2: true");
    expect(mfa).toContain("destroyMfaBrowserSessionLocally");
    expect(mfa).toContain("ensureMfaBrowserSessionForPurpose");
    expect(mfa).not.toMatch(/auth\.signOut\(/);
  });

  it("adminEstablishSession accepts requireAal2 and MFA ensure uses no-store", () => {
    const src = readSrc("api/admin-auth.functions.ts");
    expect(src).toContain("requireAal2: data.requireAal2 === true");
    expect(src).toContain("adminEnsureMfaBrowserSession");
    expect(src).toContain("adminStartMfaBrowserFlow");
    expect(src).toContain("setNoStoreHeaders");
  });
});

describe("LOGOUT path contracts", () => {
  it("signOutAdmin clears Realtime + MFA memory + allowlisted keys + server cookies", () => {
    const src = readSrc("admin-auth.ts");
    const logout = src.slice(src.indexOf("export async function signOutAdmin"));
    expect(logout).toContain("disposeAllAdminNotificationServices");
    expect(logout).toContain("clearRealtimeBrowserMemory");
    expect(logout).toContain("clearMfaBrowserMemory");
    expect(logout).toContain("purgeAllowlistedLegacyAuthKeys");
    expect(logout).toContain("adminSignOut");
    expect(logout).not.toContain("auth.signOut");
  });

  it("logout purge is allowlisted-only and does not wipe unrelated keys", () => {
    __resetAdminSupabaseClientsForTests();
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem("mccoy-admin-auth", "jwt");
    window.localStorage.setItem("mccoy_cms_v1", "draft");
    window.localStorage.setItem("mccoy-admin-sidebar-collapsed", "1");
    clearRealtimeBrowserMemory();
    clearMfaBrowserMemory();
    purgeAllowlistedLegacyAuthKeys();
    expect(window.localStorage.getItem("mccoy-admin-auth")).toBeNull();
    expect(window.localStorage.getItem("mccoy_cms_v1")).toBe("draft");
    expect(window.localStorage.getItem("mccoy-admin-sidebar-collapsed")).toBe("1");
    expect([...ADMIN_LEGACY_AUTH_STORAGE_KEYS]).toEqual(["mccoy-admin-auth"]);
  });
});
