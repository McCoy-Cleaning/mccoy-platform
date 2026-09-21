import * as React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/lib/api/admin-users.functions", () => ({
  listAdminPortalUsers: vi.fn(),
}));

vi.mock("@/lib/api/admin-customers.functions", () => ({
  inviteAdminPortalAccountAdmin: vi.fn(),
  inviteAdminPortalAccountUser: vi.fn(),
  resendAdminPortalInvitation: vi.fn(),
  setAdminCustomerBlocked: vi.fn(),
}));

import { listAdminPortalUsers } from "@/lib/api/admin-users.functions";
import { UsersPage } from "../UsersPage";
import type { PortalUserRow } from "../lib/users-view";

const listMock = vi.mocked(listAdminPortalUsers);

function user(overrides: Partial<PortalUserRow> & Pick<PortalUserRow, "id" | "fullName" | "email">): PortalUserRow {
  return {
    kind: "member",
    userId: "11111111-1111-4111-8111-111111111111",
    invitationId: null,
    companyId: "22222222-2222-4222-8222-222222222222",
    companyName: "Schoonmaakbedrijf BV",
    phone: "06-11112222",
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

const anna = user({
  id: "m:co:anna",
  fullName: "Anna de Vries",
  email: "anna@schoon.mccoy.test",
  phone: "06-11111111",
});

const bram = user({
  id: "m:co:bram",
  fullName: "Bram Visser",
  email: "bram@facility.mccoy.test",
  companyId: "44444444-4444-4444-8444-444444444444",
  companyName: "Facility Plus BV",
  accountType: "account_user",
  accountTypeLabel: "Besteller",
  phone: "06-22222222",
  userId: "33333333-3333-4333-8333-333333333333",
});

function directoryOk(items: PortalUserRow[] = [anna, bram]) {
  return {
    ok: true as const,
    items,
    companies: [
      { id: anna.companyId, name: "Schoonmaakbedrijf BV" },
      { id: bram.companyId, name: "Facility Plus BV" },
    ],
    total: items.length,
    page: 1,
    pageSize: 25,
    kpis: {
      activeUsers: 2,
      awaitingActivation: 0,
      accountAdmins: 1,
      orderers: 1,
      activeCreatedLast7Days: 1,
      activeCreatedPrevious7Days: 0,
    },
  };
}

describe("UsersPage selection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    navigateMock.mockReset();
    listMock.mockReset();
    listMock.mockResolvedValue(directoryOk());
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function renderPage(userId?: string) {
    await act(async () => {
      root.render(
        <UsersPage
          search={{ q: "", companyId: undefined, userId, page: 1 }}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("navigates to the details route with the company-scoped directory id", async () => {
    await renderPage(anna.id);
    const button = Array.from(container.querySelectorAll("button")).find(
      (el) => el.textContent === "Bekijk details",
    );
    expect(button).toBeTruthy();
    await act(async () => {
      button?.click();
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/users/$userId",
      params: { userId: anna.id },
      search: { q: "", companyId: undefined, userId: undefined, page: 1 },
    });
    expect(anna.id).not.toBe(anna.userId);
  });

  it("shows user B in the detail panel after clicking that row", async () => {
    await renderPage(anna.id);

    expect(container.textContent).toContain("Anna de Vries");
    const panel = container.querySelector("aside");
    expect(panel?.textContent).toContain("Anna de Vries");
    expect(panel?.textContent).toContain("anna@schoon.mccoy.test");

    const bramRow = container.querySelector('[data-user-id="m:co:bram"]') as HTMLElement | null;
    expect(bramRow).toBeTruthy();

    await act(async () => {
      bramRow?.click();
    });

    const updatedPanel = container.querySelector("aside");
    expect(updatedPanel?.textContent).toContain("Bram Visser");
    expect(updatedPanel?.textContent).toContain("bram@facility.mccoy.test");
    expect(updatedPanel?.textContent).toContain("Facility Plus BV");
    expect(updatedPanel?.textContent).toContain("Besteller");
    expect(updatedPanel?.textContent).not.toContain("anna@schoon.mccoy.test");
    expect(container.textContent).toContain("Volg de registratie en uitnodigingen van deze gebruiker.");
  });

  it("shows a gold crown for account administrators only", async () => {
    await renderPage(anna.id);

    const annaRow = container.querySelector('[data-user-id="m:co:anna"]') as HTMLElement | null;
    const bramRow = container.querySelector('[data-user-id="m:co:bram"]') as HTMLElement | null;
    expect(annaRow?.querySelector('[data-sigil="account-admin-crown"]')).toBeTruthy();
    expect(bramRow?.querySelector('[data-sigil="account-admin-crown"]')).toBeFalsy();

    const panel = container.querySelector("aside");
    expect(panel?.querySelector('[data-sigil="account-admin-crown"]')).toBeTruthy();
    expect(panel?.textContent).toContain("Gebruikersdetails");

    await act(async () => {
      bramRow?.click();
    });

    const updatedPanel = container.querySelector("aside");
    expect(updatedPanel?.querySelector('[data-sigil="account-admin-crown"]')).toBeFalsy();
    expect(updatedPanel?.textContent).toContain("Besteller");
  });

  it("renders blue checks for completed timeline steps and a numbered pending activation", async () => {
    const eva = user({
      id: "i:invite-eva",
      kind: "invite",
      userId: null,
      invitationId: "inv-eva",
      fullName: "Eva Smit",
      email: "eva@facility.mccoy.test",
      accountType: "account_user",
      accountTypeLabel: "Besteller",
      status: { id: "reminder_scheduled", label: "Herinnering ingepland", tone: "reminder" },
      invitedByName: "Maria de Vries",
      invitedAt: "2026-09-01T10:00:00.000Z",
      lastReminderAt: "2026-09-04T09:15:00.000Z",
      reminderCount: 1,
      activatedAt: null,
      canRemind: true,
      canBlock: false,
      canResetInvite: true,
      blocked: false,
    });
    listMock.mockResolvedValue(directoryOk([eva]));
    await renderPage(eva.id);

    const invited = container.querySelector('[data-timeline-step="invited"]');
    const reminded = container.querySelector('[data-timeline-step="reminded"]');
    const activated = container.querySelector('[data-timeline-step="activated"]');
    expect(invited?.getAttribute("data-timeline-state")).toBe("done");
    expect(invited?.querySelector('[data-timeline-marker="check"]')).toBeTruthy();
    expect(invited?.textContent).toContain("door Maria de Vries");
    expect(reminded?.getAttribute("data-timeline-state")).toBe("done");
    expect(reminded?.querySelector('[data-timeline-marker="check"]')).toBeTruthy();
    expect(reminded?.textContent).toContain("Automatisch");
    expect(activated?.getAttribute("data-timeline-state")).toBe("upcoming");
    expect(activated?.querySelector('[data-timeline-marker="number"]')?.textContent).toBe("3");
    expect(activated?.textContent).toContain("In afwachting");
  });

  it("does not render all three steps as pending numbered circles for an active user", async () => {
    await renderPage(anna.id);

    const invited = container.querySelector('[data-timeline-step="invited"]');
    const reminded = container.querySelector('[data-timeline-step="reminded"]');
    const activated = container.querySelector('[data-timeline-step="activated"]');
    expect(invited?.getAttribute("data-timeline-state")).toBe("done");
    expect(invited?.querySelector('[data-timeline-marker="check"]')).toBeTruthy();
    expect(reminded?.getAttribute("data-timeline-state")).toBe("current");
    expect(reminded?.querySelector('[data-timeline-marker="number"]')?.textContent).toBe("2");
    expect(activated?.getAttribute("data-timeline-state")).toBe("done");
    expect(activated?.querySelector('[data-timeline-marker="check"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-timeline-marker="number"]').length).toBe(1);
  });
});
