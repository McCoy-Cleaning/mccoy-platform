import { describe, expect, it } from "vitest";

import {
  companyInitials,
  csvEscape,
  formatCompanyAddress,
  formatDisplaySaldo,
  formatNlDate,
  kpiTrend,
  panelTypeLabel,
  portalStatusDotClass,
  portalStatusTextClass,
  selectedDirectoryItem,
  toCustomerPanelProps,
  typeBadgeClass,
} from "./directory-view";

describe("directory view helpers", () => {
  it("formats last-order dates as Dutch short dates", () => {
    const formatted = formatNlDate("2024-09-10T12:00:00.000Z");
    expect(formatted.toLowerCase()).toMatch(/10\s+sep\.?\s+2024/);
    expect(formatted).not.toContain(".");
  });

  it("builds initials and formats demo saldo without inventing a ledger", () => {
    expect(companyInitials("ABC Facility BV")).toBe("ABC");
    expect(companyInitials("Fixture Collision BV")).toBe("FC");
    expect(formatDisplaySaldo(0, "none")).toBe("—");
    expect(formatDisplaySaldo(245000, "demo")).toMatch(/2.450/);
  });

  it("computes KPI trend copy", () => {
    expect(kpiTrend(0, 0)).toEqual({ delta: "0%", tone: "neutral" });
    expect(kpiTrend(10, 0)).toEqual({ delta: "nieuw", tone: "up" });
    expect(kpiTrend(12, 10)).toEqual({ delta: "+20%", tone: "up" });
    expect(kpiTrend(8, 10)).toEqual({ delta: "-20%", tone: "down" });
  });

  it("joins address parts and escapes CSV", () => {
    expect(
      formatCompanyAddress({
        addressStreet: "Hoofdstraat",
        addressHouseNumber: "12",
        addressHouseSuffix: "a",
        addressPostalCode: "1234 AB",
        addressCity: "Amsterdam",
      }),
    ).toBe("Hoofdstraat 12 a\n1234 AB Amsterdam");
    expect(csvEscape('ABC, "BV"')).toBe('"ABC, ""BV"""');
  });

  it("neutralizes spreadsheet formulas in customer-controlled export cells", () => {
    expect(csvEscape("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvEscape("+1+1")).toBe("'+1+1");
    expect(csvEscape("-2")).toBe("'-2");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
    // Still quoted when the neutralized value contains CSV delimiters.
    expect(csvEscape('=HYPERLINK("http://evil.test")')).toBe(
      '"\'=HYPERLINK(""http://evil.test"")"',
    );
    expect(csvEscape("ABC Facility BV")).toBe("ABC Facility BV");
  });

  it("maps a selected row id to that company's panel props", () => {
    const abc = {
      companyId: "11111111-1111-4111-8111-111111111111",
      legalName: "ABC Facility BV",
      displayName: "ABC Facility",
      companyType: "service_client",
      typeBadge: { id: "service", label: "Service" },
      customerNumber: "MC-458322",
      invoiceAllowed: true,
      kvkNumber: "12345678",
      vatNumber: "NL123456789B01",
      addressStreet: "Hoofdstraat",
      addressHouseNumber: "12",
      addressHouseSuffix: null,
      addressPostalCode: "1234 AB",
      addressCity: "Amsterdam",
      invitedUserCount: 2,
      pendingInviteEmail: "info@abc-facility.mccoy.test",
    };
    const fixture = {
      companyId: "22222222-2222-4222-8222-222222222222",
      legalName: "Fixture Collision BV",
      displayName: null,
      companyType: "product_customer",
      typeBadge: { id: "portal", label: "Portaal" },
      customerNumber: null,
      invoiceAllowed: false,
      kvkNumber: "44444444",
      vatNumber: null,
      addressStreet: null,
      addressHouseNumber: null,
      addressHouseSuffix: null,
      addressPostalCode: null,
      addressCity: null,
      invitedUserCount: 1,
      pendingInviteEmail: null,
    };

    expect(selectedDirectoryItem([abc, fixture], abc.companyId)?.companyId).toBe(abc.companyId);
    expect(selectedDirectoryItem([abc, fixture], fixture.companyId)?.legalName).toBe(
      "Fixture Collision BV",
    );
    expect(selectedDirectoryItem([abc, fixture], "33333333-3333-4333-8333-333333333333")).toBeNull();
    expect(selectedDirectoryItem([abc, fixture], undefined)).toBeNull();

    expect(toCustomerPanelProps(abc)).toMatchObject({
      companyId: abc.companyId,
      initials: "ABC",
      name: "ABC Facility",
      typeLabel: "Serviceklant",
      customerNumber: "MC-458322",
      invoiceAllowed: true,
      kvkNumber: "12345678",
      vatNumber: "NL123456789B01",
      address: "Hoofdstraat 12\n1234 AB Amsterdam",
      invitedUserCount: 2,
    });
    expect(toCustomerPanelProps(fixture)).toMatchObject({
      companyId: fixture.companyId,
      initials: "FC",
      name: "Fixture Collision BV",
      typeLabel: "Productklant",
      invoiceAllowed: false,
      kvkNumber: "44444444",
      vatNumber: null,
      address: "—",
    });
    expect(panelTypeLabel({ companyType: "service_client" })).toBe("Serviceklant");
  });

  it("maps type badges and portal status dots to the directory mock tones", () => {
    expect(typeBadgeClass("service")).toContain("22d3ee");
    expect(typeBadgeClass("portal")).toContain("8b5cf6");
    expect(portalStatusDotClass("active")).toBe("bg-emerald-400");
    expect(portalStatusDotClass("invited")).toBe("bg-amber-400");
    expect(portalStatusDotClass("required")).toBe("bg-sky-400");
    expect(portalStatusDotClass("blocked")).toBe("bg-rose-500");
    expect(portalStatusTextClass("active")).toBe("text-emerald-200");
    expect(portalStatusTextClass("invited")).toBe("text-amber-200");
  });
});
