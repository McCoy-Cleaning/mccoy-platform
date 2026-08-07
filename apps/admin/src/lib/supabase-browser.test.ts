import { describe, expect, it, beforeEach } from "vitest";

import {
  ADMIN_LEGACY_AUTH_STORAGE_KEYS,
  __getMfaMemoryStorageForTests,
  __resetAdminSupabaseClientsForTests,
  clearMfaBrowserMemory,
  createMemoryAuthStorage,
  getAdminRealtimeAuthConfig,
  purgeAllowlistedLegacyAuthKeys,
} from "./supabase-browser";

describe("admin browser auth storage", () => {
  beforeEach(() => {
    __resetAdminSupabaseClientsForTests();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it("primary realtime auth config disables persist and auto-refresh", () => {
    expect(getAdminRealtimeAuthConfig()).toEqual({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });

  it("memory storage never writes to localStorage", () => {
    const storage = createMemoryAuthStorage();
    storage.setItem("sb-auth", JSON.stringify({ access_token: "tok", refresh_token: "ref" }));
    expect(storage.getItem("sb-auth")).toContain("tok");
    if (typeof window !== "undefined" && window.localStorage) {
      expect(window.localStorage.getItem("sb-auth")).toBeNull();
      expect(window.localStorage.getItem("mccoy-admin-auth")).toBeNull();
    }
  });

  it("purgeAllowlistedLegacyAuthKeys removes only allowlisted keys", () => {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem("mccoy-admin-auth", "jwt");
    window.localStorage.setItem("mccoy_cms_v1", "keep-me");
    purgeAllowlistedLegacyAuthKeys();
    expect(window.localStorage.getItem("mccoy-admin-auth")).toBeNull();
    expect(window.localStorage.getItem("mccoy_cms_v1")).toBe("keep-me");
    expect([...ADMIN_LEGACY_AUTH_STORAGE_KEYS]).toEqual(["mccoy-admin-auth"]);
  });

  it("clearMfaBrowserMemory clears in-memory MFA storage without touching unrelated localStorage", () => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("mccoy_cms_v1", "keep-me");
    }
    const storage = createMemoryAuthStorage();
    storage.setItem("session", "secret");
    storage.clear();
    clearMfaBrowserMemory();
    expect(__getMfaMemoryStorageForTests()).toBeNull();
    if (typeof window !== "undefined" && window.localStorage) {
      expect(window.localStorage.getItem("mccoy_cms_v1")).toBe("keep-me");
    }
  });
});
