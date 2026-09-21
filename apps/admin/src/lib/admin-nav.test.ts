import { describe, expect, it } from "vitest";

import { ADMIN_MOBILE_DOCK, ADMIN_NAV, isAdminNavActive } from "./admin-nav";

describe("ADMIN_NAV", () => {
  it("keeps the previous sidebar destinations, Dutch copy, and existing routes", () => {
    expect(ADMIN_NAV.map((item) => [item.to, item.label, item.hint])).toEqual([
      ["/", "Overzicht", "Start — wat er speelt"],
      ["/website", "Website", "Pagina's, teksten & foto's"],
      ["/inquiries", "Aanvragen", "Berichten van klanten"],
      ["/customers", "Klanten", "Geregistreerd en gastkopers"],
      ["/users", "Gebruikers", "Wie mag er in het beheer"],
      ["/products", "Producten", "Uw catalogus"],
      ["/settings", "Instellingen", "Algemeen en voorkeuren"],
    ]);
  });

  it("keeps the phone dock to five primary destinations", () => {
    expect(ADMIN_MOBILE_DOCK.map((item) => item.to)).toEqual([
      "/",
      "/website",
      "/inquiries",
      "/customers",
      "/products",
    ]);
  });
});

describe("isAdminNavActive", () => {
  it("selects Overzicht only on the exact home path", () => {
    expect(isAdminNavActive("/", "/")).toBe(true);
    expect(isAdminNavActive("/products", "/")).toBe(false);
  });

  it("keeps nested module routes selected", () => {
    expect(isAdminNavActive("/products", "/products")).toBe(true);
    expect(isAdminNavActive("/customers/company/abc", "/customers")).toBe(true);
    expect(isAdminNavActive("/website/home", "/website")).toBe(true);
    expect(isAdminNavActive("/inquiries", "/website")).toBe(false);
  });
});
