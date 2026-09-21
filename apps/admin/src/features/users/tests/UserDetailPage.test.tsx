import * as React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    search?: unknown;
    params?: unknown;
    hash?: string;
    className?: string;
  }) => (
    <a href={typeof to === "string" ? to : "/customers"} className={props.className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api/admin-users.functions", () => ({
  getAdminPortalUserDetail: vi.fn(),
  requestAdminPortalUserPasswordReset: vi.fn(),
}));

vi.mock("@/lib/api/admin-customers.functions", () => ({
  getAdminCompanyPortalDetail: vi.fn(),
  resendAdminPortalInvitation: vi.fn(),
  setAdminCustomerBlocked: vi.fn(),
  updateAdminCustomer: vi.fn(),
}));

import { getAdminCompanyPortalDetail } from "@/lib/api/admin-customers.functions";
import { getAdminPortalUserDetail } from "@/lib/api/admin-users.functions";
import { UserDetailPage } from "../UserDetailPage";

const getUserMock = vi.mocked(getAdminPortalUserDetail);
const getCompanyMock = vi.mocked(getAdminCompanyPortalDetail);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";

function userDetail() {
  return {
    id: `m:${COMPANY_ID}:${USER_ID}`,
    userId: USER_ID,
    invitationId: null,
    companyId: COMPANY_ID,
    companyName: "ABC Facility",
    fullName: "Sophie van Dijk",
    firstName: "Sophie",
    lastName: "van Dijk",
    email: "sophie@abc.mccoy.test",
    phone: "06-12345678",
    jobTitle: null,
    role: "account_user" as const,
    roleLabel: "Gebruiker" as const,
    statusId: "active" as const,
    statusLabel: "Actief" as const,
    invitationStatusLabel: "Geaccepteerd",
    memberSince: "2024-01-12T10:00:00.000Z",
    lastLoginAt: "2026-09-10T12:00:00.000Z",
    lastLoginSource: "dummy" as const,
    signedUpAt: "2024-01-12T10:00:00.000Z",
    rights: [
      { id: "can_order", label: "Kan producten bestellen", allowed: true },
      { id: "can_view_favourites", label: "Kan favorieten bekijken", allowed: true },
      { id: "can_manage_team", label: "Kan team beheren", allowed: false },
    ],
    orderCount: 1,
    favouriteCount: 3,
    lastOrderAt: "2026-09-01T10:00:00.000Z",
    averageOrderMinor: 2500,
    averageOrderCurrency: "EUR",
    favouriteLists: [
      { id: "dummy-sanitair", name: "Sanitair basislijn", source: "dummy" as const },
      { id: "dummy-kantoor", name: "Kantoor dagelijks", source: "dummy" as const },
      { id: "dummy-navul", name: "Navulproducten", source: "dummy" as const },
    ],
    recentOrders: [
      {
        id: "ord-1",
        number: "MC-1001",
        placedAt: "2026-09-01T10:00:00.000Z",
        statusLabel: "Bevestigd",
        totalMinor: 2500,
        currency: "EUR",
      },
    ],
    notes: [
      {
        id: "dummy-mark",
        author: "Mark de Vries",
        dated: "12 jan 2024, 09:15",
        at: "2024-01-12T08:15:00.000Z",
        body: "Prima contactpersoon voor dagelijkse bestellingen.",
        source: "dummy" as const,
      },
    ],
    canEdit: true,
    canResetPassword: true,
    canDeactivate: true,
    canResendInvite: false,
    blocked: false,
    callout: "Deze gebruiker kan producten bestellen voor uw bedrijf.",
  };
}

function companyDetail() {
  return {
    ok: true as const,
    company: {
      id: COMPANY_ID,
      legalName: "ABC Facility BV",
      displayName: "ABC Facility",
      companyType: "service_client",
      partyType: "company",
      status: "active",
      invoiceAllowed: true,
      email: "info@abc.mccoy.test",
      phone: "053-1234567",
      kvkNumber: "88000001",
      vatNumber: "NL880000001B01",
      contactPersonName: "Jan de Vries",
      addressStreet: null,
      addressHouseNumber: null,
      addressHouseSuffix: null,
      addressPostalCode: null,
      addressCity: null,
      addressCountry: null,
      notes: null,
      externalCustomerId: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    portalStatus: "active" as const,
    members: [
      {
        userId: "33333333-3333-4333-8333-333333333333",
        email: "jan@abc.mccoy.test",
        fullName: "Jan de Vries",
        phone: null,
        role: "account_admin",
        membershipStatus: "active",
        userStatus: "active",
      },
      {
        userId: USER_ID,
        email: "sophie@abc.mccoy.test",
        fullName: "Sophie van Dijk",
        phone: "06-12345678",
        role: "account_user",
        membershipStatus: "active",
        userStatus: "active",
      },
    ],
    invitations: [],
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("UserDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    getUserMock.mockReset();
    getCompanyMock.mockReset();
    getUserMock.mockResolvedValue({ ok: true as const, detail: userDetail() as never });
    getCompanyMock.mockResolvedValue(companyDetail() as never);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders all Gebruikersdetails regions", async () => {
    await act(async () => {
      root.render(<UserDetailPage userId={USER_ID} />);
    });
    await flush();

    expect(container.textContent).toContain("Klanten");
    expect(container.textContent).toContain("ABC Facility");
    expect(container.textContent).toContain("Gebruikers");
    expect(container.textContent).toContain("Sophie van Dijk");
    expect(container.textContent).toContain("Gebruikersdetails");
    expect(container.textContent).toContain("Beheer de gegevens, status en toegang van deze gebruiker.");
    expect(container.textContent).toContain("SV");
    expect(container.textContent).toContain("Actief");
    expect(container.textContent).toContain("Klanttype: serviceklant");
    expect(container.textContent).toContain("Lid sinds");
    expect(container.querySelector("#snelle-acties-heading")?.textContent).toBe("Snelle acties");
    expect(container.textContent).toContain("Gegevens bewerken");
    expect(container.textContent).toContain("Gebruiker blokkeren");
    expect(container.textContent).toContain("Uitnodiging opnieuw versturen");
    expect(container.textContent).toContain("Wachtwoord reset mail sturen");
    expect(container.querySelector("#persoonsgegevens-heading")?.textContent).toBe("Persoonsgegevens");
    expect(container.textContent).toContain("Voornaam");
    expect(container.textContent).toContain("Achternaam");
    expect(container.textContent).toContain("E-mailadres");
    expect(container.textContent).toContain("Telefoonnummer");
    expect(container.textContent).toContain("Functie");
    expect(container.textContent).toContain("Facility coördinator");
    expect(container.querySelector("#account-toegang-heading")?.textContent).toBe("Account & toegang");
    expect(container.textContent).toContain("Laatste login");
    expect(container.textContent).toContain("Accountstatus");
    expect(container.textContent).toContain("Uitnodigingsstatus");
    expect(container.textContent).toContain("Wachtwoordstatus");
    expect(container.textContent).toContain("Loginmethode");
    expect(container.querySelector("#bedrijfskoppeling-heading")?.textContent).toBe("Bedrijfskoppeling");
    expect(container.textContent).toContain("KVK");
    expect(container.textContent).toContain("88000001");
    expect(container.textContent).toContain("BTW");
    expect(container.textContent).toContain("Factuurstatus");
    expect(container.textContent).toContain("Primaire accountbeheerder");
    expect(container.textContent).toContain("Jan de Vries");
    expect(container.textContent).toContain("Aantal gebruikers in bedrijf");
    expect(container.textContent).toContain("Naar klant");
    expect(container.querySelector("#rechten-heading")?.textContent).toBe("Rechten & status");
    expect(container.textContent).toContain("Producten bestellen");
    expect(container.textContent).toContain("Favorieten gebruiken");
    expect(container.textContent).toContain("Team beheren");
    expect(container.textContent).toContain("Snelle bestellingen beheren");
    expect(container.textContent).toContain("Nee");
    expect(container.querySelector("#bedrijf-favorieten-heading")?.textContent).toBe("Bedrijf favorieten");
    expect(container.textContent).toContain("Deze favorieten zijn door McCoy ingesteld voor dit bedrijf.");
    expect(container.textContent).toContain("Sanitair basislijn");
    expect(container.textContent).toContain("Kantoor dagelijks");
    expect(container.textContent).toContain("Navulproducten");
    expect(container.querySelector("#besteloverzicht-heading")?.textContent).toBe("Besteloverzicht");
    expect(container.textContent).toContain("Totaal bestellingen");
    expect(container.textContent).toContain("Laatste bestelling");
    expect(container.textContent).toContain("Gemiddelde bestelwaarde");
    expect(container.textContent).toContain("Favorieten");
    expect(container.querySelector("#recente-bestellingen-heading")?.textContent).toBe("Recente bestellingen");
    expect(container.textContent).toContain("Bestelnummer");
    expect(container.textContent).toContain("MC-1001");
    expect(container.textContent).toContain("Totaal");
    expect(container.textContent).toContain("Bekijken");
    expect(container.textContent).toContain("Alle bestellingen bekijken");
    expect(container.querySelector("#notities-heading")?.textContent).toBe("Notities intern");
    expect(container.textContent).toContain("Notitie toevoegen");
    expect(container.textContent).toContain("Mark de Vries");
  });
});
