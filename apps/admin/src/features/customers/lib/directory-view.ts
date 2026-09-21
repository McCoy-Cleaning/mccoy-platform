import { escapeCsvCell, formatMoneyMinor } from "@mccoy/domain";

import type { CustomersDirectoryTab } from "../types/search";

export const DIRECTORY_TABS: ReadonlyArray<{ id: CustomersDirectoryTab; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "service", label: "Serviceklanten" },
  { id: "enrolled", label: "Geregistreerd" },
  { id: "awaiting", label: "Wachten op activatie" },
];

export function companyInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !/^(bv|b\.v\.|nv|vof|cv)$/i.test(p));
  if (parts.length === 0) return "?";
  const first = parts[0]!;
  // Short all-caps tokens (ABC Facility → ABC) match the directory mock avatar.
  if (first.length >= 2 && first.length <= 4 && /^[A-Za-z]+$/.test(first) && first === first.toUpperCase()) {
    return first;
  }
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function formatNlDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
      .format(d)
      .replace(/\./g, "");
  } catch {
    return "—";
  }
}

export function formatNlNumber(n: number): string {
  try {
    return new Intl.NumberFormat("nl-NL").format(n);
  } catch {
    return String(n);
  }
}

/** Display-only demo saldo. Not a legal ledger. */
export function formatDisplaySaldo(amountMinor: number, source: string): string {
  if (source === "none" && amountMinor === 0) return "—";
  return formatMoneyMinor(amountMinor, "EUR");
}

export function kpiTrend(
  current: number,
  previous: number,
): { delta: string; tone: "up" | "down" | "neutral" } {
  if (previous === 0) {
    if (current === 0) return { delta: "0%", tone: "neutral" };
    return { delta: "nieuw", tone: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { delta: `+${pct}%`, tone: "up" };
  if (pct < 0) return { delta: `${pct}%`, tone: "down" };
  return { delta: "0%", tone: "neutral" };
}

export function formatCompanyAddress(input: {
  addressStreet: string | null;
  addressHouseNumber: string | null;
  addressHouseSuffix: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
}): string {
  const line1 = [input.addressStreet, input.addressHouseNumber, input.addressHouseSuffix]
    .filter((p) => p && p.trim())
    .join(" ");
  const line2 = [input.addressPostalCode, input.addressCity].filter((p) => p && p.trim()).join(" ");
  return [line1, line2].filter(Boolean).join("\n") || "—";
}

export function panelTypeLabel(input: {
  companyType?: string;
  typeBadge?: { id: string };
}): string {
  if (input.companyType === "service_client" || input.typeBadge?.id === "service") {
    return "Serviceklant";
  }
  return "Productklant";
}

export type CustomerPanelSource = {
  companyId: string;
  legalName: string;
  displayName: string | null;
  companyType?: string;
  typeBadge?: { id: string; label: string };
  customerNumber: string | null;
  invoiceAllowed: boolean;
  kvkNumber: string | null;
  vatNumber: string | null;
  addressStreet: string | null;
  addressHouseNumber: string | null;
  addressHouseSuffix: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  invitedUserCount: number;
  pendingInviteEmail: string | null;
};

export type CustomerPanelProps = {
  companyId: string;
  initials: string;
  name: string;
  typeLabel: string;
  customerNumber: string | null;
  invoiceAllowed: boolean;
  kvkNumber: string | null;
  vatNumber: string | null;
  address: string;
  invitedUserCount: number;
  pendingInviteEmail: string | null;
};

/** Resolve the directory row that should drive the side panel. Never falls back to another company. */
export function selectedDirectoryItem<T extends { companyId: string }>(
  items: readonly T[],
  selectedId: string | undefined | null,
): T | null {
  if (!selectedId) return null;
  return items.find((item) => item.companyId === selectedId) ?? null;
}

export function toCustomerPanelProps(source: CustomerPanelSource): CustomerPanelProps {
  const name = source.displayName || source.legalName;
  return {
    companyId: source.companyId,
    initials: companyInitials(name),
    name,
    typeLabel: panelTypeLabel(source),
    customerNumber: source.customerNumber,
    invoiceAllowed: source.invoiceAllowed,
    kvkNumber: source.kvkNumber,
    vatNumber: source.vatNumber,
    address: formatCompanyAddress(source),
    invitedUserCount: source.invitedUserCount,
    pendingInviteEmail: source.pendingInviteEmail,
  };
}

/** Directory type pills: Service = cyan, Portaal = purple. */
export function typeBadgeClass(id: string): string {
  if (id === "service") return "bg-[#22d3ee]/18 text-[#7de8f8]";
  return "bg-[#8b5cf6]/22 text-[#d4c4ff]";
}

/** Colored status dots: Actief green, invited amber, required blue, blocked red. */
export function portalStatusDotClass(tone: string): string {
  if (tone === "active") return "bg-emerald-400";
  if (tone === "invited") return "bg-amber-400";
  if (tone === "blocked") return "bg-rose-500";
  return "bg-sky-400";
}

export function portalStatusTextClass(tone: string): string {
  if (tone === "active") return "text-emerald-200";
  if (tone === "invited") return "text-amber-200";
  if (tone === "blocked") return "text-rose-200";
  return "text-sky-200";
}

/**
 * Company names and contact fields are customer-controlled, so the export must use the
 * shared escaper that also neutralizes spreadsheet formula injection.
 */
export function csvEscape(value: string): string {
  return escapeCsvCell(value);
}

/**
 * The export covers the whole filtered set, so the admin must be told how much of it
 * actually landed in the file. A capped export is reported as capped, never as complete.
 */
export function csvExportSummary(result: {
  rowCount: number;
  total: number;
  truncated: boolean;
  maxRows: number;
}): string {
  if (result.total === 0) {
    return "Geen klanten om te exporteren met de huidige filters.";
  }
  if (result.truncated) {
    return `Export bevat de eerste ${formatNlNumber(result.rowCount)} van ${formatNlNumber(
      result.total,
    )} klanten (maximum ${formatNlNumber(
      result.maxRows,
    )} per export). Verfijn de filters om de rest te exporteren.`;
  }
  return `Export bevat alle ${formatNlNumber(result.rowCount)} gefilterde klanten.`;
}
