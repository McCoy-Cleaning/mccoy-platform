import { formatMoneyMinor } from "@mccoy/domain";

import { formatNlDate, personInitials } from "./users-view";

export type UserDetailRight = {
  id: "can_order" | "can_view_favourites" | "can_manage_team" | "can_manage_quick_orders";
  label: string;
  allowed: boolean;
};

export type UserDetailOrder = {
  id: string;
  number: string;
  placedAt: string;
  statusLabel: string;
  totalMinor: number | null;
  currency: string;
};

export type UserDetailList = {
  id: string;
  name: string;
};

export type UserDetailNote = {
  id: string;
  author: string;
  dated: string;
  at: string;
  body: string;
};

/**
 * Cross-company totals. Rendered in its own block, never mixed into the
 * company-scoped KPI row, so the two scopes can never be read as one number.
 */
export type UserDetailLifetimeActivity = {
  orderCount: number;
  totalSpendMinor: number;
  lastOrderAt: string | null;
  currency: string;
  spansMultipleCompanies: boolean;
};

export const LIFETIME_ACTIVITY_HEADING = "Totale activiteit over alle bedrijven";

/** Makes the scope of the KPI row explicit next to the company it belongs to. */
export function companyScopedStatsCaption(companyName: string): string {
  const name = companyName.trim() || "dit bedrijf";
  return `Deze cijfers gelden alleen voor ${name}.`;
}

export function lifetimeActivityCaption(
  companyName: string,
  spansMultipleCompanies: boolean,
): string {
  const name = companyName.trim() || "dit bedrijf";
  return spansMultipleCompanies
    ? `Alle bestellingen van deze gebruiker samen, ook die voor andere bedrijven dan ${name}.`
    : `Alle bestellingen van deze gebruiker samen. Op dit moment allemaal voor ${name}.`;
}

export function lifetimeSpendLabel(
  activity: Pick<UserDetailLifetimeActivity, "totalSpendMinor" | "currency">,
): string {
  return formatMoneyMinor(activity.totalSpendMinor, activity.currency);
}

export type UserDetailView = {
  id: string;
  userId: string | null;
  invitationId: string | null;
  companyId: string;
  companyName: string;
  companyType: string | null;
  companyTypeLabel: string;
  kvkNumber: string | null;
  vatNumber: string | null;
  invoiceAllowed: boolean | null;
  primaryAdminName: string | null;
  companyUserCount: number | null;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  role: "account_admin" | "account_user";
  roleLabel: "Accountbeheerder" | "Gebruiker";
  statusId: "active" | "invited" | "reminder_scheduled" | "blocked";
  statusLabel: "Actief" | "Uitnodiging verzonden" | "Herinnering ingepland" | "Geblokkeerd";
  invitationStatusLabel: string;
  passwordStatusLabel: string;
  loginMethodLabel: string;
  memberSince: string | null;
  lastLoginAt: string | null;
  signedUpAt: string | null;
  rights: UserDetailRight[];
  orderCount: number;
  favouriteCount: number;
  lastOrderAt: string | null;
  averageOrderMinor: number | null;
  averageOrderCurrency: string;
  favouriteLists: UserDetailList[];
  recentOrders: UserDetailOrder[];
  /** Null when the platform has no cross-company history worth showing. */
  lifetimeActivity: UserDetailLifetimeActivity | null;
  notes: UserDetailNote[];
  canEdit: boolean;
  canResetPassword: boolean;
  canDeactivate: boolean;
  canResendInvite: boolean;
  blocked: boolean;
};

export type PortalUserDetailSource = {
  id: string;
  userId: string | null;
  invitationId: string | null;
  companyId: string;
  companyName: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  role: "account_admin" | "account_user";
  roleLabel: "Accountbeheerder" | "Gebruiker";
  statusId: "active" | "invited" | "reminder_scheduled" | "blocked";
  statusLabel: "Actief" | "Uitnodiging verzonden" | "Herinnering ingepland" | "Geblokkeerd";
  invitationStatusLabel: string;
  memberSince: string | null;
  lastLoginAt: string | null;
  signedUpAt: string | null;
  rights: Array<{ id: string; label: string; allowed: boolean }>;
  orderCount: number;
  favouriteCount: number;
  lastOrderAt: string | null;
  averageOrderMinor: number | null;
  averageOrderCurrency: string;
  favouriteLists: UserDetailList[];
  recentOrders: Array<{
    id: string;
    number: string;
    placedAt: string;
    statusLabel: string;
    totalMinor?: number | null;
    currency?: string;
  }>;
  lifetimeActivity?: UserDetailLifetimeActivity | null;
  notes: UserDetailNote[];
  canEdit: boolean;
  canResetPassword: boolean;
  canDeactivate: boolean;
  canResendInvite: boolean;
  blocked: boolean;
};

export type CompanyLinkSource = {
  companyType?: string | null;
  kvkNumber?: string | null;
  vatNumber?: string | null;
  invoiceAllowed?: boolean | null;
  members?: ReadonlyArray<{
    fullName: string | null;
    email: string;
    role: string;
  }>;
  invitations?: ReadonlyArray<{ status: string }>;
};

export const DUMMY_JOB_TITLE = "Facility coördinator";
export const DUMMY_LOGIN_METHOD = "E-mail en wachtwoord";

const ADMIN_RIGHT_LABELS: Record<UserDetailRight["id"], string> = {
  can_order: "Producten bestellen",
  can_view_favourites: "Favorieten gebruiken",
  can_manage_team: "Team beheren",
  can_manage_quick_orders: "Snelle bestellingen beheren",
};

export function memberSinceLabel(iso: string | null): string {
  const dated = formatNlDate(iso);
  return dated === "—" ? "Lid sinds —" : `Lid sinds ${dated}`;
}

export function yesNoNl(value: boolean): "Ja" | "Nee" {
  return value ? "Ja" : "Nee";
}

export function kpiDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function averageOrderLabel(
  detail: Pick<UserDetailView, "averageOrderMinor" | "averageOrderCurrency">,
): string {
  if (detail.averageOrderMinor === null) return "—";
  return formatMoneyMinor(detail.averageOrderMinor, detail.averageOrderCurrency);
}

export function orderTotalLabel(order: Pick<UserDetailOrder, "totalMinor" | "currency">): string {
  if (order.totalMinor === null) return "—";
  return formatMoneyMinor(order.totalMinor, order.currency);
}

export function userDetailInitials(
  detail: Pick<UserDetailView, "fullName" | "firstName" | "lastName">,
): string {
  if (detail.firstName && detail.lastName) {
    return `${detail.firstName[0] ?? ""}${detail.lastName[0] ?? ""}`.toUpperCase();
  }
  return personInitials(detail.fullName);
}

export function jobTitleValue(jobTitle: string | null): string {
  return jobTitle?.trim() || DUMMY_JOB_TITLE;
}

export function adminCustomerTypeLabel(companyType: string | null | undefined): string {
  if (companyType === "service_client") return "serviceklant";
  if (companyType === "product_customer") return "productklant";
  return "—";
}

export function invoiceAllowedLabel(allowed: boolean | null): "Actief" | "Nee" | "—" {
  if (allowed === null) return "—";
  return allowed ? "Actief" : "Nee";
}

export function passwordStatusLabel(statusId: UserDetailView["statusId"]): string {
  return statusId === "active" ? "Ingesteld" : "Nog niet ingesteld";
}

export function adminRightsFromRole(
  role: UserDetailView["role"],
  source: ReadonlyArray<{ id: string; allowed: boolean }> = [],
): UserDetailRight[] {
  const allowed = (id: UserDetailRight["id"], fallback: boolean) =>
    source.find((right) => right.id === id)?.allowed ?? fallback;
  const manageTeam = allowed("can_manage_team", role === "account_admin");
  return [
    { id: "can_order", label: ADMIN_RIGHT_LABELS.can_order, allowed: allowed("can_order", true) },
    {
      id: "can_view_favourites",
      label: ADMIN_RIGHT_LABELS.can_view_favourites,
      allowed: allowed("can_view_favourites", true),
    },
    { id: "can_manage_team", label: ADMIN_RIGHT_LABELS.can_manage_team, allowed: manageTeam },
    {
      id: "can_manage_quick_orders",
      label: ADMIN_RIGHT_LABELS.can_manage_quick_orders,
      allowed: allowed("can_manage_quick_orders", manageTeam),
    },
  ];
}

export function primaryAdminNameFromCompany(
  source: CompanyLinkSource | null | undefined,
  fallback: { role: UserDetailView["role"]; fullName: string },
): string | null {
  const named = source?.members?.find((member) => member.role === "account_admin");
  if (named) return named.fullName?.trim() || named.email;
  if (fallback.role === "account_admin") return fallback.fullName;
  return null;
}

export function companyUserCountFromCompany(source: CompanyLinkSource | null | undefined): number | null {
  if (!source?.members) return null;
  const pending = (source.invitations ?? []).filter((invite) => invite.status === "pending").length;
  return source.members.length + pending;
}

export function toAdminUserDetailView(
  detail: PortalUserDetailSource,
  company: CompanyLinkSource | null = null,
): UserDetailView {
  return {
    id: detail.id,
    userId: detail.userId,
    invitationId: detail.invitationId,
    companyId: detail.companyId,
    companyName: detail.companyName,
    companyType: company?.companyType ?? null,
    companyTypeLabel: adminCustomerTypeLabel(company?.companyType),
    kvkNumber: company?.kvkNumber ?? null,
    vatNumber: company?.vatNumber ?? null,
    invoiceAllowed: company?.invoiceAllowed ?? null,
    primaryAdminName: primaryAdminNameFromCompany(company, {
      role: detail.role,
      fullName: detail.fullName,
    }),
    companyUserCount: companyUserCountFromCompany(company),
    fullName: detail.fullName,
    firstName: detail.firstName,
    lastName: detail.lastName,
    email: detail.email,
    phone: detail.phone,
    jobTitle: detail.jobTitle?.trim() || DUMMY_JOB_TITLE,
    role: detail.role,
    roleLabel: detail.roleLabel,
    statusId: detail.statusId,
    statusLabel: detail.statusLabel,
    invitationStatusLabel: detail.invitationStatusLabel,
    passwordStatusLabel: passwordStatusLabel(detail.statusId),
    loginMethodLabel: DUMMY_LOGIN_METHOD,
    memberSince: detail.memberSince,
    lastLoginAt: detail.lastLoginAt,
    signedUpAt: detail.signedUpAt,
    rights: adminRightsFromRole(detail.role, detail.rights),
    orderCount: detail.orderCount,
    favouriteCount: detail.favouriteCount,
    lastOrderAt: detail.lastOrderAt,
    averageOrderMinor: detail.averageOrderMinor,
    averageOrderCurrency: detail.averageOrderCurrency,
    favouriteLists: detail.favouriteLists,
    recentOrders: detail.recentOrders.map((order) => ({
      id: order.id,
      number: order.number,
      placedAt: order.placedAt,
      statusLabel: order.statusLabel,
      totalMinor: order.totalMinor ?? null,
      currency: order.currency ?? detail.averageOrderCurrency,
    })),
    lifetimeActivity: detail.lifetimeActivity ?? null,
    notes: detail.notes,
    canEdit: detail.canEdit,
    canResetPassword: detail.canResetPassword,
    canDeactivate: detail.canDeactivate,
    canResendInvite: detail.canResendInvite,
    blocked: detail.blocked,
  };
}
