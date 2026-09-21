/** Commerce Foundation Phase 1 — domain vocabulary (no checkout / Mollie processing). */

export const COMPANY_TYPES = ["product_customer", "service_client"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

/** Legal party: B2B company vs private person (existing-customer import / display). */
export const COMPANY_PARTY_TYPES = ["company", "private_person"] as const;
export type CompanyPartyType = (typeof COMPANY_PARTY_TYPES)[number];

export function partyTypeLabelNl(partyType: CompanyPartyType): string {
  switch (partyType) {
    case "company":
      return "Bedrijf";
    case "private_person":
      return "Particulier";
    default:
      return partyType;
  }
}

export const COMPANY_STATUSES = ["pending", "active", "blocked"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const COMPANY_MEMBER_ROLES = ["account_admin", "account_user"] as const;
export type CompanyMemberRole = (typeof COMPANY_MEMBER_ROLES)[number];

export const COMPANY_MEMBER_STATUSES = ["active", "suspended"] as const;
export type CompanyMemberStatus = (typeof COMPANY_MEMBER_STATUSES)[number];

/** Portal onboarding states (derived server-side — not company operational status). */
export const CUSTOMER_PORTAL_STATUSES = [
  "registration_required",
  "invited",
  "reminder_sent",
  "invite_expired",
  "active",
  "suspended",
] as const;
export type CustomerPortalStatus = (typeof CUSTOMER_PORTAL_STATUSES)[number];

export function portalStatusLabelNl(status: CustomerPortalStatus): string {
  switch (status) {
    case "registration_required":
      return "Registratie nodig";
    case "invited":
      return "Uitgenodigd";
    case "reminder_sent":
      return "Herinnering verstuurd";
    case "invite_expired":
      return "Link verlopen";
    case "active":
      return "Actief";
    case "suspended":
      return "Opgeschort";
    default:
      return status;
  }
}

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

/** Catalogue identity lifecycle. Favourites may add only `active` products. */
export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type CatalogueProduct = {
  id: string;
  name: string;
  sku: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
};

/** Company-shared favourite reference. No prices or quantities. */
export type CompanyFavouriteProduct = {
  id: string;
  companyId: string;
  productId: string;
  productName: string;
  productSku: string | null;
  productStatus: ProductStatus;
  createdBy: string | null;
  createdAt: string;
};

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
  "commerce.company_provisioned",
  "commerce.existing_customer_import_completed",
  "commerce.existing_customer_import_failed",
  "commerce.existing_customer_import_auto_invite",
  "commerce.portal_company_deleted",
  "customer.portal_invite_sent",
  "customer.portal_invite_resent",
  "customer.portal_invite_expired",
  "customer.portal_invite_consumed",
  "customer.portal_user_invited",
  "customer.portal_activated",
  "customer.membership_suspended",
  "customer.membership_reactivated",
  "customer.account_admin_transferred",
  "customer.company_portal_suspended",
  "customer.company_portal_reactivated",
  "company.favourite_product_added",
  "company.favourite_product_removed",
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
  partyType: CompanyPartyType;
  status: CompanyStatus;
  invoiceAllowed: boolean;
  email: string | null;
  phone: string | null;
  contactPersonName: string | null;
  addressStreet: string | null;
  addressHouseNumber: string | null;
  addressHouseSuffix: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  blockedAt: string | null;
  notes: string | null;
  externalCustomerId: string | null;
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
