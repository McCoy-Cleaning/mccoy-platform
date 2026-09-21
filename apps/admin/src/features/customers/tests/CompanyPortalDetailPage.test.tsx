import * as React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    search?: unknown;
    className?: string;
  }) => (
    <a href={typeof to === "string" ? to : "/customers"} className={props.className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/admin-auth", () => ({
  useAdminSession: () => ({
    session: { username: "marlieke.a@mccoy.nl", loggedInAt: Date.now() },
    ready: true,
  }),
}));

vi.mock("@/lib/api/admin-customers.functions", () => ({
  getAdminCompanyPortalDetail: vi.fn(),
  inviteAdminPortalAccountAdmin: vi.fn(),
  inviteAdminPortalAccountUser: vi.fn(),
  resendAdminPortalInvitation: vi.fn(),
  setAdminCustomerBlocked: vi.fn(),
  setAdminPortalMembershipStatus: vi.fn(),
  transferAdminAccountAdmin: vi.fn(),
  updateAdminCompany: vi.fn(),
  updateAdminCustomer: vi.fn(),
  listAdminCompanyFavouriteProducts: vi.fn(),
  addAdminCompanyFavouriteProduct: vi.fn(),
  removeAdminCompanyFavouriteProduct: vi.fn(),
  searchAdminActiveProducts: vi.fn(),
}));

import {
  getAdminCompanyPortalDetail,
  listAdminCompanyFavouriteProducts,
  searchAdminActiveProducts,
  updateAdminCompany,
} from "@/lib/api/admin-customers.functions";
import { CompanyPortalDetailPage } from "../CompanyPortalDetailPage";

const getDetailMock = vi.mocked(getAdminCompanyPortalDetail);
const listFavouritesMock = vi.mocked(listAdminCompanyFavouriteProducts);
const searchProductsMock = vi.mocked(searchAdminActiveProducts);
const updateCompanyMock = vi.mocked(updateAdminCompany);

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

function detailOk() {
  return {
    ok: true as const,
    company: {
      id: COMPANY_ID,
      legalName: "ABC Facility BV",
      displayName: "ABC Facility",
      companyType: "service_client" as const,
      partyType: "company" as const,
      status: "active" as const,
      invoiceAllowed: true,
      email: "info@abc-facility.mccoy.test",
      phone: "053-1234567",
      kvkNumber: "88000001",
      vatNumber: "NL880000001B01",
      contactPersonName: "Jan de Vries",
      addressStreet: "Hoofdstraat",
      addressHouseNumber: "12",
      addressHouseSuffix: null,
      addressPostalCode: "1234 AB",
      addressCity: "Amsterdam",
      addressCountry: "NL",
      notes: "Interne afspraak over leveringen.",
      externalCustomerId: "DEMO-10482",
      blockedAt: null,
      createdAt: "2022-01-12T10:00:00.000Z",
      updatedAt: "2026-09-18T12:32:00.000Z",
    },
    portalStatus: "active" as const,
    members: [
      {
        userId: "22222222-2222-4222-8222-222222222222",
        email: "jan@abc-facility.mccoy.test",
        fullName: "Jan de Vries",
        phone: "06-12345678",
        role: "account_admin",
        membershipStatus: "active",
        userStatus: "active",
      },
    ],
    invitations: [],
  };
}

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  mounted = { container, root };
  return container;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
  vi.clearAllMocks();
});

const FAVOURITE_ITEM = {
  id: "fav-1",
  companyId: COMPANY_ID,
  productId: "33333333-3333-4333-8333-333333333333",
  productName: "Microvezel mop",
  productSku: "MC-MOP-240",
  productStatus: "active" as const,
  createdBy: null,
  createdAt: "2026-09-18T12:00:00.000Z",
};

describe("CompanyPortalDetailPage regions", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getDetailMock.mockResolvedValue(detailOk());
    listFavouritesMock.mockResolvedValue({ ok: true, items: [FAVOURITE_ITEM] });
    searchProductsMock.mockResolvedValue({ ok: true, items: [] });
  });

  it("renders title, bedrijfsgegevens, favorieten, gebruikers and snelle acties for a company id", async () => {
    const container = mount(<CompanyPortalDetailPage companyId={COMPANY_ID} />);
    expect(container.textContent).toContain("Bedrijfsprofiel laden");

    await flush();
    await flush();

    expect(getDetailMock).toHaveBeenCalledWith({ data: { companyId: COMPANY_ID } });
    expect(listFavouritesMock).toHaveBeenCalledWith({ data: { companyId: COMPANY_ID } });
    expect(container.textContent).toContain("Klanten");
    expect(container.textContent).toContain("Bedrijven");
    expect(container.textContent).toContain("Bedrijfsprofiel & favorieten");
    expect(container.textContent).toContain(
      "Bekijk en beheer alle gegevens, gebruikers en favoriete producten van dit bedrijf.",
    );
    expect(container.textContent).toContain("ABC Facility");
    expect(container.querySelector("nav[aria-label='Breadcrumb']")?.textContent).toContain("ABC Facility");
    expect(container.textContent).toContain("Snelle acties");
    expect(container.textContent).toContain("Gebruiker uitnodigen");
    expect(container.textContent).toContain("Bedrijf bewerken");
    expect(container.textContent).toContain("Favorieten beheren");
    expect(container.textContent).toContain("Portaalstatus wijzigen");
    expect(container.textContent).toContain("Notitie toevoegen");
    expect(container.querySelector("#bedrijfsgegevens-heading")?.textContent).toBe("Bedrijfsgegevens");
    expect(container.textContent).toContain("KvK-nummer");
    expect(container.textContent).toContain("Facturatie toegestaan");
    expect(container.querySelector("#favorieten-heading")?.textContent).toBe("Favoriete producten");
    expect(container.textContent).toContain("Microvezel mop");
    expect(container.querySelector("#gebruikers-heading")?.textContent).toMatch(
      /Gebruikers van dit bedrijf/,
    );
    expect(container.textContent).toContain("Jan de Vries");
    expect(container.textContent).toContain("E-mailadres");
    expect(container.textContent).not.toContain("Uitnodigingen");
    expect(container.textContent).not.toContain("Klantgegevens");
  });

  it("renders each stored note as its own tile without timestamp prefixes or Intern", async () => {
    getDetailMock.mockResolvedValue({
      ...detailOk(),
      company: {
        ...detailOk().company,
        notes: "[18 sep 2026, 15:43]\ndsfsdfs\n\n[18 sep 2026, 15:43]\ndfsdfdsfsf",
      },
    });
    const container = mount(<CompanyPortalDetailPage companyId={COMPANY_ID} />);
    await flush();
    await flush();

    const heading = container.querySelector("#notities-heading");
    expect(heading?.textContent).toContain("Notities");
    const section = heading?.closest("section");
    expect(section?.textContent).toContain("dsfsdfs");
    expect(section?.textContent).toContain("dfsdfdsfsf");
    expect(section?.textContent).not.toContain("[18 sep 2026, 15:43]");
    expect(section?.textContent).not.toContain("Intern");
    expect(section?.querySelectorAll("li").length).toBe(2);
    expect(section?.querySelectorAll('button[aria-label="Notitie bewerken"]').length).toBe(2);
    expect(section?.querySelectorAll('button[aria-label="Notitie verwijderen"]').length).toBe(2);
  });

  it("saves an edited note through the staff company update", async () => {
    getDetailMock.mockResolvedValue({
      ...detailOk(),
      company: {
        ...detailOk().company,
        notes: "[2026-09-18T10:00:00.000Z|Ada B.]\nEerste\n\n[2026-09-18T11:00:00.000Z|Ben C.]\nTweede",
      },
    });
    updateCompanyMock.mockResolvedValue({ ok: true, company: detailOk().company });
    const container = mount(<CompanyPortalDetailPage companyId={COMPANY_ID} />);
    await flush();
    await flush();

    const editButton = container.querySelector('button[aria-label="Notitie bewerken"]');
    expect(editButton).toBeTruthy();
    act(() => {
      editButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const dialog = document.body;
    expect(dialog.textContent).toContain("Notitie bewerken");
    const textarea = dialog.querySelector("textarea");
    expect(textarea).toBeTruthy();
    act(() => {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      proto?.set?.call(textarea, "Eerste aangepast");
      textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === "Opslaan");
    expect(save).toBeTruthy();
    act(() => {
      save!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    await flush();

    expect(updateCompanyMock).toHaveBeenCalled();
    const payload = updateCompanyMock.mock.calls[0]?.[0] as { data: { notes: string | null } };
    expect(payload.data.notes).toContain("Eerste aangepast");
    expect(payload.data.notes).toContain("Tweede");
    expect(payload.data.notes).not.toContain("\nEerste\n");
  });

  it("shows an error state when the company cannot be loaded", async () => {
    getDetailMock.mockResolvedValue({ ok: false, error: "Bedrijf niet gevonden." });
    const container = mount(<CompanyPortalDetailPage companyId={COMPANY_ID} />);
    await flush();
    expect(container.querySelector("[role='alert']")).toBeTruthy();
    expect(container.textContent).toContain("Bedrijf niet gevonden.");
  });

  it("navigates to gebruiker details with the company-scoped key when Bekijken is clicked", async () => {
    const container = mount(<CompanyPortalDetailPage companyId={COMPANY_ID} />);
    await flush();
    await flush();
    const view = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Bekijken",
    );
    expect(view).toBeTruthy();
    act(() => {
      view!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/users/$userId",
      params: { userId: `m:${COMPANY_ID}:22222222-2222-4222-8222-222222222222` },
      search: { q: "", companyId: undefined, userId: undefined, page: 1 },
    });
  });
});
