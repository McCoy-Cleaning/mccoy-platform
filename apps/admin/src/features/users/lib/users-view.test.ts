import { describe, expect, it } from "vitest";

import {
  buildRegistrationTimeline,
  formatNlDate,
  formatNlDateTime,
  isAccountAdmin,
  mapPortalUserKpiCards,
  personInitials,
  portalUserStatusDotClass,
  portalUserStatusTextClass,
  selectedPortalUserRow,
  userDetailsParam,
  type PortalUserRow,
} from "./users-view";

function user(overrides: Partial<PortalUserRow> & Pick<PortalUserRow, "id" | "fullName">): PortalUserRow {
  return {
    kind: "member",
    userId: "11111111-1111-4111-8111-111111111111",
    invitationId: null,
    companyId: "22222222-2222-4222-8222-222222222222",
    companyName: "Schoonmaakbedrijf BV",
    email: "a@example.com",
    phone: "06-12345678",
    accountType: "account_admin",
    accountTypeLabel: "Accountbeheerder",
    status: { id: "active", label: "Actief", tone: "active" },
    lastLoginAt: "2026-09-10T12:00:00.000Z",
    lastLoginSource: "dummy",
    lastOrderAt: null,
    lastOrderSource: "none",
    invitedByName: "McCoy",
    invitedAt: "2026-08-01T10:00:00.000Z",
    invitationExpiresAt: null,
    reminderCount: 0,
    lastReminderAt: null,
    activatedAt: "2026-08-02T10:00:00.000Z",
    canRemind: false,
    canBlock: true,
    canResetInvite: false,
    blocked: false,
    ...overrides,
  };
}

describe("users view helpers", () => {
  it("maps KPI cards without inventing financial rules", () => {
    const cards = mapPortalUserKpiCards({
      activeUsers: 12,
      awaitingActivation: 3,
      accountAdmins: 4,
      orderers: 11,
      activeCreatedLast7Days: 12,
      activeCreatedPrevious7Days: 10,
    });
    expect(cards.map((card) => card.label)).toEqual([
      "Actieve gebruikers",
      "Wacht op activatie",
      "Accountbeheerders",
      "Bestellers",
    ]);
    expect(cards[0]).toMatchObject({
      value: 12,
      trend: "+20%",
      helper: "t.o.v. vorige week",
      tone: "up",
      icon: "users",
    });
    expect(cards[1]).toMatchObject({
      value: 3,
      helper: "openstaande uitnodigingen",
      icon: "clock",
      trend: null,
    });
    expect(cards[2]).toMatchObject({ value: 4, icon: "shield" });
    expect(cards[3]).toMatchObject({ value: 11, icon: "box" });
  });

  it("resolves the clicked user and never falls back to the first row", () => {
    const anna = user({ id: "m:co:anna", fullName: "Anna de Vries", email: "anna@schoon.mccoy.test" });
    const bram = user({
      id: "m:co:bram",
      fullName: "Bram Visser",
      email: "bram@facility.mccoy.test",
      accountType: "account_user",
      accountTypeLabel: "Besteller",
    });
    expect(selectedPortalUserRow([anna, bram], bram.id)?.fullName).toBe("Bram Visser");
    expect(selectedPortalUserRow([anna, bram], "missing")).toBeNull();
    expect(selectedPortalUserRow([anna, bram], undefined)).toBeNull();
  });

  it("builds initials, dates and matching status colors", () => {
    expect(personInitials("Marlieke Aalbers")).toBe("MA");
    expect(formatNlDate(null)).toBe("—");
    expect(formatNlDateTime(null)).toBe("—");
    expect(portalUserStatusDotClass("active")).toBe("bg-emerald-400");
    expect(portalUserStatusDotClass("invited")).toBe("bg-amber-400");
    expect(portalUserStatusDotClass("reminder")).toBe("bg-violet-400");
    expect(portalUserStatusDotClass("blocked")).toBe("bg-rose-500");
    expect(portalUserStatusTextClass("reminder")).toBe("text-violet-400");
    expect(isAccountAdmin("account_admin")).toBe(true);
    expect(isAccountAdmin("account_user")).toBe(false);
  });

  it("marks completed timeline steps done and keeps honest pending states", () => {
    const invitedOnly = buildRegistrationTimeline(
      user({
        id: "i:invite-1",
        fullName: "Bram Visser",
        invitedByName: "Maria de Vries",
        status: { id: "invited", label: "Uitnodiging verzonden", tone: "invited" },
        activatedAt: null,
        lastReminderAt: null,
        reminderCount: 0,
      }),
    );
    expect(invitedOnly.map((step) => step.state)).toEqual(["done", "current", "upcoming"]);
    expect(invitedOnly[0]?.detail).toBe("door Maria de Vries");
    expect(invitedOnly[2]?.detail).toBe("In afwachting");

    const remindedPending = buildRegistrationTimeline(
      user({
        id: "i:invite-2",
        fullName: "Eva Smit",
        invitedByName: "Maria de Vries",
        status: { id: "reminder_scheduled", label: "Herinnering ingepland", tone: "reminder" },
        activatedAt: null,
        lastReminderAt: "2026-09-04T09:15:00.000Z",
        reminderCount: 1,
      }),
    );
    expect(remindedPending.map((step) => ({ id: step.id, state: step.state, detail: step.detail }))).toEqual([
      { id: "invited", state: "done", detail: "door Maria de Vries" },
      { id: "reminded", state: "done", detail: "Automatisch" },
      { id: "activated", state: "upcoming", detail: "In afwachting" },
    ]);

    const activeNoReminder = buildRegistrationTimeline(
      user({
        id: "m:co:anna",
        fullName: "Anna de Vries",
        lastReminderAt: null,
        reminderCount: 0,
      }),
    );
    expect(activeNoReminder.map((step) => step.state)).toEqual(["done", "current", "done"]);
    expect(activeNoReminder[1]?.detail).toBeNull();
    expect(activeNoReminder[2]?.detail).toBeNull();

    const fullyDone = buildRegistrationTimeline(
      user({
        id: "m:co:anna",
        fullName: "Anna de Vries",
        lastReminderAt: "2026-09-04T09:15:00.000Z",
        reminderCount: 1,
      }),
    );
    expect(fullyDone.map((step) => step.state)).toEqual(["done", "done", "done"]);
  });

  it("keeps the company scope in the details route param", () => {
    // A bare user id would make the server guess the membership for a user that
    // belongs to more than one company.
    expect(
      userDetailsParam({
        id: "m:co:anna",
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe("m:co:anna");
    expect(userDetailsParam({ id: "i:invite-eva", userId: null })).toBe("i:invite-eva");
  });
});
