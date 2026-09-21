import { describe, expect, it } from "vitest";
import { AdminAuthError } from "@mccoy/security";

import {
  assertDirectoryStaffAccess,
  companyInitials,
  companyTypeBadge,
  computeDirectoryKpis,
  directoryAccessDecision,
  directoryPortalPill,
  matchesDirectoryTab,
  normalizeDirectoryTab,
} from "./admin-customers-directory";

describe("normalizeDirectoryTab", () => {
  it("defaults to all and maps legacy tabs", () => {
    expect(normalizeDirectoryTab(undefined)).toBe("all");
    expect(normalizeDirectoryTab("guests")).toBe("all");
    expect(normalizeDirectoryTab("portal")).toBe("service");
    expect(normalizeDirectoryTab("registered")).toBe("service");
    expect(normalizeDirectoryTab("enrolled")).toBe("enrolled");
    expect(normalizeDirectoryTab("awaiting")).toBe("awaiting");
    expect(normalizeDirectoryTab("service")).toBe("service");
  });
});

describe("directoryAccessDecision", () => {
  it("allows staff and denies customers", () => {
    expect(directoryAccessDecision("staff")).toEqual({ allowed: true });
    expect(directoryAccessDecision("customer")).toEqual({
      allowed: false,
      error: "Niet geautoriseerd.",
    });
    expect(directoryAccessDecision("anonymous")).toEqual({
      allowed: false,
      error: "Niet geautoriseerd.",
    });
  });

  it("throws AdminAuthError for non-staff", () => {
    expect(() => assertDirectoryStaffAccess("customer")).toThrow(AdminAuthError);
    expect(() => assertDirectoryStaffAccess("staff")).not.toThrow();
  });
});

describe("directory mappers", () => {
  it("maps company type badges", () => {
    expect(companyTypeBadge("service_client")).toEqual({ id: "service", label: "Service" });
    expect(companyTypeBadge("product_customer")).toEqual({ id: "portal", label: "Portaal" });
  });

  it("maps screenshot portal pills", () => {
    expect(directoryPortalPill("active", "active")).toMatchObject({
      id: "active",
      label: "Actief",
    });
    expect(directoryPortalPill("invited", "active")).toMatchObject({
      id: "invited",
      label: "Uitnodiging verzonden",
    });
    expect(directoryPortalPill("reminder_sent", "active")).toMatchObject({
      id: "invited",
      label: "Uitnodiging verzonden",
    });
    expect(directoryPortalPill("registration_required", "active")).toMatchObject({
      id: "registration_required",
      label: "Registratie vereist",
    });
    expect(directoryPortalPill("active", "blocked")).toMatchObject({
      id: "blocked",
      label: "Geblokkeerd",
    });
    expect(directoryPortalPill("suspended", "active")).toMatchObject({
      id: "blocked",
      label: "Geblokkeerd",
    });
  });

  it("filters directory tabs", () => {
    const service = {
      companyType: "service_client" as const,
      portalPill: directoryPortalPill("active", "active"),
    };
    const enrolled = {
      companyType: "product_customer" as const,
      portalPill: directoryPortalPill("active", "active"),
    };
    const awaiting = {
      companyType: "service_client" as const,
      portalPill: directoryPortalPill("invited", "active"),
    };
    expect(matchesDirectoryTab("all", service)).toBe(true);
    expect(matchesDirectoryTab("service", service)).toBe(true);
    expect(matchesDirectoryTab("service", enrolled)).toBe(false);
    expect(matchesDirectoryTab("enrolled", enrolled)).toBe(true);
    expect(matchesDirectoryTab("awaiting", awaiting)).toBe(true);
    expect(matchesDirectoryTab("awaiting", service)).toBe(false);
  });

  it("builds initials without legal suffixes", () => {
    expect(companyInitials("ABC Facility BV")).toBe("ABC");
    expect(companyInitials("Twentse Glasgroothandel")).toBe("TG");
    expect(companyInitials("  ")).toBe("?");
  });

  it("computes KPI totals from mapped rows", () => {
    const now = new Date().toISOString();
    const kpis = computeDirectoryKpis([
      {
        companyType: "service_client",
        portalPill: directoryPortalPill("active", "active"),
        createdAt: now,
      },
      {
        companyType: "service_client",
        portalPill: directoryPortalPill("registration_required", "active"),
        createdAt: now,
      },
      {
        companyType: "product_customer",
        portalPill: directoryPortalPill("active", "active"),
        createdAt: now,
      },
    ]);
    expect(kpis.totalCustomers).toBe(3);
    expect(kpis.serviceClients).toBe(2);
    expect(kpis.registrationRequired).toBe(1);
    expect(kpis.activePortals).toBe(2);
    expect(kpis.totalCreatedLast7Days).toBe(3);
  });
});
