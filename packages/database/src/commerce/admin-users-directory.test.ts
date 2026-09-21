import { describe, expect, it } from "vitest";
import { AdminAuthError } from "@mccoy/security";

import {
  assertPortalUsersStaffAccess,
  buildRegistrationTimeline,
  computePortalUsersKpis,
  portalUserAccountTypeLabel,
  portalUsersAccessDecision,
  portalUserStatusPill,
  resolveLastLogin,
  selectedPortalUser,
} from "./admin-users-directory";

describe("portal users access", () => {
  it("allows staff and denies customers", () => {
    expect(portalUsersAccessDecision("staff")).toEqual({ allowed: true });
    expect(portalUsersAccessDecision("customer")).toEqual({
      allowed: false,
      error: "Niet geautoriseerd.",
    });
    expect(() => assertPortalUsersStaffAccess("customer")).toThrow(AdminAuthError);
    expect(() => assertPortalUsersStaffAccess("staff")).not.toThrow();
  });
});

describe("portal user mappers", () => {
  it("labels account types from membership roles", () => {
    expect(portalUserAccountTypeLabel("account_admin")).toBe("Accountbeheerder");
    expect(portalUserAccountTypeLabel("account_user")).toBe("Besteller");
    expect(portalUserAccountTypeLabel("member")).toBe("Besteller");
  });

  it("maps status pills including reminder and blocked", () => {
    expect(portalUserStatusPill({ membershipStatus: "active", userStatus: "active" })).toMatchObject({
      id: "active",
      label: "Actief",
    });
    expect(portalUserStatusPill({ invitationStatus: "pending" })).toMatchObject({
      id: "invited",
      label: "Uitnodiging verzonden",
    });
    expect(
      portalUserStatusPill({ invitationStatus: "pending", reminderCount: 1 }),
    ).toMatchObject({
      id: "reminder_scheduled",
      label: "Herinnering ingepland",
    });
    expect(portalUserStatusPill({ userStatus: "blocked", membershipStatus: "active" })).toMatchObject({
      id: "blocked",
      label: "Geblokkeerd",
    });
    expect(portalUserStatusPill({ membershipStatus: "suspended" })).toMatchObject({
      id: "blocked",
    });
  });

  it("computes KPI totals from mapped rows", () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 86_400_000).toISOString();
    const older = new Date(now - 10 * 86_400_000).toISOString();
    const kpis = computePortalUsersKpis(
      [
        { statusId: "active", accountType: "account_admin", createdAt: recent },
        { statusId: "active", accountType: "account_user", createdAt: older },
        { statusId: "invited", accountType: "account_user", createdAt: recent },
        { statusId: "reminder_scheduled", accountType: "account_admin", createdAt: recent },
        { statusId: "blocked", accountType: "account_user", createdAt: recent },
      ],
      now,
    );
    expect(kpis.activeUsers).toBe(2);
    expect(kpis.awaitingActivation).toBe(2);
    expect(kpis.accountAdmins).toBe(2);
    expect(kpis.orderers).toBe(3);
    expect(kpis.activeCreatedLast7Days).toBe(1);
    expect(kpis.activeCreatedPrevious7Days).toBe(1);
  });

  it("never falls back to the first user when resolving selection", () => {
    const a = { id: "m:co-a:user-a", name: "Anna" };
    const b = { id: "m:co-b:user-b", name: "Bram" };
    expect(selectedPortalUser([a, b], b.id)?.name).toBe("Bram");
    expect(selectedPortalUser([a, b], "missing")).toBeNull();
    expect(selectedPortalUser([a, b], undefined)).toBeNull();
  });

  it("builds the registration timeline without inventing money events", () => {
    expect(
      buildRegistrationTimeline({
        invitedAt: "2026-09-01T10:00:00.000Z",
        lastReminderAt: null,
        reminderCount: 0,
        activatedAt: null,
        statusId: "invited",
      }).map((step) => step.state),
    ).toEqual(["done", "current", "upcoming"]);

    expect(
      buildRegistrationTimeline({
        invitedAt: "2026-09-01T10:00:00.000Z",
        lastReminderAt: "2026-09-04T10:00:00.000Z",
        reminderCount: 1,
        activatedAt: "2026-09-08T10:00:00.000Z",
        statusId: "active",
      }).map((step) => ({ id: step.id, state: step.state })),
    ).toEqual([
      { id: "invited", state: "done" },
      { id: "reminded", state: "done" },
      { id: "activated", state: "done" },
    ]);
  });

  it("uses dummy last-login only for active users", () => {
    const active = resolveLastLogin({ statusId: "active", seed: "user-a" });
    expect(active.lastLoginSource).toBe("dummy");
    expect(active.lastLoginAt).toMatch(/^\d{4}-/);
    expect(resolveLastLogin({ statusId: "invited", seed: "user-a" })).toEqual({
      lastLoginAt: null,
      lastLoginSource: "none",
    });
  });
});
