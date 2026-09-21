import { describe, expect, it } from "vitest";

import {
  adminCustomerTypeLabel,
  adminRightsFromRole,
  invoiceAllowedLabel,
  jobTitleValue,
  memberSinceLabel,
  orderTotalLabel,
  passwordStatusLabel,
  toAdminUserDetailView,
  DUMMY_JOB_TITLE,
  DUMMY_LOGIN_METHOD,
  type PortalUserDetailSource,
} from "./user-detail-view";

const SOURCE: PortalUserDetailSource = {
  id: "m:22222222-2222-4222-8222-222222222222:11111111-1111-4111-8111-111111111111",
  userId: "11111111-1111-4111-8111-111111111111",
  invitationId: null,
  companyId: "22222222-2222-4222-8222-222222222222",
  companyName: "ABC Facility",
  fullName: "Sophie van Dijk",
  firstName: "Sophie",
  lastName: "van Dijk",
  email: "sophie@abc.mccoy.test",
  phone: "06-12345678",
  jobTitle: null,
  role: "account_user",
  roleLabel: "Gebruiker",
  statusId: "active",
  statusLabel: "Actief",
  invitationStatusLabel: "Geaccepteerd",
  memberSince: "2024-01-12T10:00:00.000Z",
  lastLoginAt: "2026-09-10T12:00:00.000Z",
  signedUpAt: "2024-01-12T10:00:00.000Z",
  rights: [
    { id: "can_order", label: "Kan producten bestellen", allowed: true },
    { id: "can_view_favourites", label: "Kan favorieten bekijken", allowed: true },
    { id: "can_manage_team", label: "Kan team beheren", allowed: false },
  ],
  orderCount: 2,
  favouriteCount: 3,
  lastOrderAt: "2026-09-01T10:00:00.000Z",
  averageOrderMinor: 1500,
  averageOrderCurrency: "EUR",
  favouriteLists: [{ id: "dummy-sanitair", name: "Sanitair basislijn" }],
  recentOrders: [
    {
      id: "ord-1",
      number: "MC-1001",
      placedAt: "2026-09-01T10:00:00.000Z",
      statusLabel: "Bevestigd",
      totalMinor: 1999,
      currency: "EUR",
    },
  ],
  notes: [],
  canEdit: true,
  canResetPassword: true,
  canDeactivate: true,
  canResendInvite: false,
  blocked: false,
};

describe("admin user detail view helpers", () => {
  it("labels company type and invoice_allowed without inventing invoice legality", () => {
    expect(adminCustomerTypeLabel("service_client")).toBe("serviceklant");
    expect(adminCustomerTypeLabel("product_customer")).toBe("productklant");
    expect(adminCustomerTypeLabel(null)).toBe("—");
    expect(invoiceAllowedLabel(true)).toBe("Actief");
    expect(invoiceAllowedLabel(false)).toBe("Nee");
    expect(invoiceAllowedLabel(null)).toBe("—");
  });

  it("uses dummy job title, password and login copy when those stores are absent", () => {
    expect(jobTitleValue(null)).toBe(DUMMY_JOB_TITLE);
    expect(passwordStatusLabel("active")).toBe("Ingesteld");
    expect(passwordStatusLabel("invited")).toBe("Nog niet ingesteld");
    expect(memberSinceLabel("2024-01-12T10:00:00.000Z")).toMatch(/^Lid sinds /);
  });

  it("maps rights to the mock labels and adds snelle bestellingen", () => {
    const rights = adminRightsFromRole("account_user", SOURCE.rights);
    expect(rights.map((right) => [right.id, right.label, right.allowed])).toEqual([
      ["can_order", "Producten bestellen", true],
      ["can_view_favourites", "Favorieten gebruiken", true],
      ["can_manage_team", "Team beheren", false],
      ["can_manage_quick_orders", "Snelle bestellingen beheren", false],
    ]);
  });

  it("formats existing order totals in integer minor units", () => {
    expect(orderTotalLabel({ totalMinor: 1999, currency: "EUR" })).toMatch(/19/);
    expect(orderTotalLabel({ totalMinor: null, currency: "EUR" })).toBe("—");
  });

  it("merges staff company linkage from the existing company API", () => {
    const view = toAdminUserDetailView(SOURCE, {
      companyType: "service_client",
      kvkNumber: "88000001",
      vatNumber: "NL880000001B01",
      invoiceAllowed: true,
      members: [
        { fullName: "Jan de Vries", email: "jan@abc.mccoy.test", role: "account_admin" },
        { fullName: "Sophie van Dijk", email: SOURCE.email, role: "account_user" },
      ],
      invitations: [{ status: "pending" }],
    });
    expect(view.companyTypeLabel).toBe("serviceklant");
    expect(view.kvkNumber).toBe("88000001");
    expect(view.invoiceAllowed).toBe(true);
    expect(view.primaryAdminName).toBe("Jan de Vries");
    expect(view.companyUserCount).toBe(3);
    expect(view.jobTitle).toBe(DUMMY_JOB_TITLE);
    expect(view.loginMethodLabel).toBe(DUMMY_LOGIN_METHOD);
    expect(view.recentOrders[0]?.totalMinor).toBe(1999);
  });
});
