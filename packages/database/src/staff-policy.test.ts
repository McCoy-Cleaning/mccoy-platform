import { describe, expect, it } from "vitest";

import { AdminAuthError } from "@mccoy/security";
import { STAFF_AUDIT_ACTIONS } from "@mccoy/domain";

import {
  assertActiveSuperAdminActor,
  assertStaffProfileAllowsAdminSession,
  decideStaffInviteForExistingEmail,
  messageIfPrivateSchemaMissing,
  shouldAbortSuperAdminBootstrap,
} from "./staff-policy";

describe("decideStaffInviteForExistingEmail", () => {
  it("allows reinstate for blocked staff", () => {
    expect(
      decideStaffInviteForExistingEmail({ status: "blocked", blockedAt: "2026-01-01T00:00:00Z" }),
    ).toBe("reinstate_blocked");
    expect(decideStaffInviteForExistingEmail({ status: "active", blockedAt: "2026-01-01T00:00:00Z" })).toBe(
      "reinstate_blocked",
    );
  });

  it("rejects active or invited (non-blocked) duplicates", () => {
    expect(decideStaffInviteForExistingEmail({ status: "active", blockedAt: null })).toBe(
      "reject_duplicate",
    );
    expect(decideStaffInviteForExistingEmail({ status: "invited", blockedAt: null })).toBe(
      "reject_duplicate",
    );
  });

  it("creates new when no existing profile", () => {
    expect(decideStaffInviteForExistingEmail(null)).toBe("create_new");
  });
});

describe("assertActiveSuperAdminActor (items 25–26)", () => {
  const activeSuper = {
    accountKind: "staff" as const,
    staffRole: "super_admin" as const,
    status: "active" as const,
    blockedAt: null,
  };

  it("rejects non-super_admin session roles", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: "u1",
        sessionStaffRole: "admin",
        actor: { ...activeSuper, staffRole: "admin" },
      }),
    ).toThrow(AdminAuthError);
  });

  it("rejects missing session user (service/anon cannot satisfy this gate)", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: null,
        sessionStaffRole: "super_admin",
        actor: activeSuper,
      }),
    ).toThrow(AdminAuthError);
  });

  it("rejects inactive or blocked super_admin actors", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: "u1",
        sessionStaffRole: "super_admin",
        actor: { ...activeSuper, status: "invited" },
      }),
    ).toThrow(AdminAuthError);
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: "u1",
        sessionStaffRole: "super_admin",
        actor: { ...activeSuper, blockedAt: "2026-01-01T00:00:00Z" },
      }),
    ).toThrow(AdminAuthError);
  });

  it("allows an active super_admin", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: "u1",
        sessionStaffRole: "super_admin",
        actor: activeSuper,
      }),
    ).not.toThrow();
  });
});

describe("assertStaffProfileAllowsAdminSession (item 27)", () => {
  it("rejects blocked staff", () => {
    expect(() =>
      assertStaffProfileAllowsAdminSession({
        accountKind: "staff",
        staffRole: "admin",
        status: "blocked",
        blockedAt: "2026-01-01T00:00:00Z",
      }),
    ).toThrow(/geblokkeerd/i);
  });

  it("allows active staff", () => {
    expect(() =>
      assertStaffProfileAllowsAdminSession({
        accountKind: "staff",
        staffRole: "admin",
        status: "active",
        blockedAt: null,
      }),
    ).not.toThrow();
  });
});

describe("shouldAbortSuperAdminBootstrap (item 28)", () => {
  it("aborts when any super_admin already exists", () => {
    expect(shouldAbortSuperAdminBootstrap(0)).toBe(false);
    expect(shouldAbortSuperAdminBootstrap(1)).toBe(true);
    expect(shouldAbortSuperAdminBootstrap(3)).toBe(true);
  });
});

describe("staff.unblocked audit vocabulary", () => {
  it("includes staff.unblocked", () => {
    expect(STAFF_AUDIT_ACTIONS).toContain("staff.unblocked");
  });
});

describe("messageIfPrivateSchemaMissing", () => {
  it("detects Invalid schema: private", () => {
    const msg = messageIfPrivateSchemaMissing("Invalid schema: private");
    expect(msg).toMatch(/private-schema/i);
    expect(messageIfPrivateSchemaMissing("other")).toBeNull();
  });
});
