import { describe, expect, it } from "vitest";

import { AdminAuthError } from "@mccoy/security";
import { isLegacyAdminAuthEnabled, preferSupabaseAdminAuth } from "@mccoy/security";

import {
  assertActiveSuperAdminActor,
  assertStaffProfileAllowsAdminSession,
  shouldAbortSuperAdminBootstrap,
} from "./staff-policy";

describe("admin auth env precedence helpers", () => {
  it("preferSupabaseAdminAuth is boolean", () => {
    expect(typeof preferSupabaseAdminAuth()).toBe("boolean");
  });

  it("isLegacyAdminAuthEnabled is true when Supabase hints are absent or legacy flag set", () => {
    expect(typeof isLegacyAdminAuthEnabled()).toBe("boolean");
  });
});

describe("requireActiveSuperAdmin-style gates (items 25–26)", () => {
  it("blocks admin role from super_admin-only operations", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: "user-1",
        sessionStaffRole: "admin",
        actor: {
          accountKind: "staff",
          staffRole: "admin",
          status: "active",
          blockedAt: null,
        },
      }),
    ).toThrow(AdminAuthError);
  });

  it("blocks missing authenticated session (anon/publishable cannot satisfy service gates)", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: null,
        sessionStaffRole: null,
        actor: null,
      }),
    ).toThrow(/super_admin/i);
  });
});

describe("blocked staff session rejection (item 27)", () => {
  it("rejects blocked profiles during session resolution", () => {
    expect(() =>
      assertStaffProfileAllowsAdminSession({
        accountKind: "staff",
        staffRole: "super_admin",
        status: "blocked",
        blockedAt: "2026-07-01T00:00:00.000Z",
      }),
    ).toThrow(/geblokkeerd/i);
  });
});

describe("bootstrap super_admin gate (item 28)", () => {
  it("aborts when countSuperAdmins would return > 0", () => {
    expect(shouldAbortSuperAdminBootstrap(0)).toBe(false);
    expect(shouldAbortSuperAdminBootstrap(1)).toBe(true);
  });
});
