/** Commerce Foundation Phase 1 — domain vocabulary (no checkout / Mollie processing). */

export const COMPANY_TYPES = ["product_customer", "service_client"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const COMPANY_STATUSES = ["pending", "active", "blocked"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const COMPANY_MEMBER_ROLES = ["owner", "member"] as const;
export type CompanyMemberRole = (typeof COMPANY_MEMBER_ROLES)[number];

export const ORDER_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILMENT_STATUSES = [
  "unfulfilled",
  "partial",
  "fulfilled",
  "cancelled",
] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export const ORDER_SOURCES = ["storefront", "admin", "import", "fixture"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

/** Audit actions for commerce / customer administration. */
export const COMMERCE_AUDIT_ACTIONS = [
  "customer.invited",
  "customer.blocked",
  "customer.unblocked",
  "customer.profile_updated",
  "customer.company_updated",
  "guest.conversion_invited",
  "guest.linked_existing",
  "order.imported",
  "commerce.fixtures_seeded",
] as const;
export type CommerceAuditAction = (typeof COMMERCE_AUDIT_ACTIONS)[number];

export type MoneyMinor = {
  currency: string;
  amountMinor: number;
};

export type AddressSnapshot = {
  line1?: string;
  line2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  companyName?: string;
  attention?: string;
};

export type Company = {
  id: string;
  legalName: string;
  displayName: string | null;
  kvkNumber: string | null;
  vatNumber: string | null;
  companyType: CompanyType;
  status: CompanyStatus;
  invoiceAllowed: boolean;
  email: string | null;
  phone: string | null;
  blockedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GuestPurchaser = {
  id: string;
  emailNormalized: string;
  emailDisplay: string;
  fullName: string | null;
  companyName: string | null;
  phone: string | null;
  convertedUserId: string | null;
  convertedCompanyId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderSummary = {
  id: string;
  number: string;
  companyId: string | null;
  customerUserId: string | null;
  guestPurchaserId: string | null;
  purchaserEmail: string;
  purchaserName: string | null;
  currency: string;
  totalMinor: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  source: OrderSource;
  placedAt: string;
};

/** Orders that count toward admin "total spend". */
export function orderCountsTowardSpend(input: {
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
}): boolean {
  return input.paymentStatus === "paid" && input.orderStatus !== "cancelled";
}

export function formatMoneyMinor(amountMinor: number, currency = "EUR", locale = "nl-NL"): string {
  const safe = Number.isFinite(amountMinor) ? Math.trunc(amountMinor) : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe / 100);
  } catch {
    return `${(safe / 100).toFixed(2)} ${currency}`;
  }
}

export function isGuestOrderRow(input: {
  customerUserId: string | null;
  guestPurchaserId: string | null;
}): boolean {
  return input.customerUserId == null && input.guestPurchaserId != null;
}

export type GuestConversionEligibility =
  | { eligible: true; reason: "convertible" }
  | { eligible: false; reason: "already_converted" | "missing_email" | "staff_collision" };

export type GuestConversionCollision =
  | { kind: "none" }
  | { kind: "existing_customer"; userId: string; status: string }
  | { kind: "staff"; userId: string }
  | { kind: "ambiguous" };

/**
 * Escape CSV cell; neutralize spreadsheet formula injection.
 */
export function escapeCsvCell(value: string): string {
  const raw = value ?? "";
  const neutralized =
    raw.length > 0 && ["=", "+", "-", "@", "\t", "\r"].includes(raw[0]!)
      ? `'${raw}`
      : raw;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export function buildCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells
    .map((c) => escapeCsvCell(c == null ? "" : String(c)))
    .join(",");
}
