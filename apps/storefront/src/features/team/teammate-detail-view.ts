import { formatMoneyMinor } from "@mccoy/domain";

export type TeammateDetailView = {
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
  roleLabel: string;
  statusId: "active" | "invited" | "reminder_scheduled" | "blocked";
  statusLabel: string;
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
  favouriteLists: Array<{ id: string; name: string }>;
  recentOrders: Array<{ id: string; number: string; placedAt: string; statusLabel: string }>;
  notes: Array<{ id: string; author: string; dated: string; at: string; body: string }>;
  canEdit: boolean;
  canResetPassword: boolean;
  canDeactivate: boolean;
  canResendInvite: boolean;
  blocked: boolean;
  callout: string;
};

export function formatNlDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
      .format(date)
      .replace(/\./g, "");
  } catch {
    return "—";
  }
}

export function memberSinceLabel(iso: string | null): string {
  const dated = formatNlDate(iso);
  return dated === "—" ? "Lid van uw team sinds —" : `Lid van uw team sinds ${dated}`;
}

export function yesNoNl(value: boolean): "Ja" | "Nee" {
  return value ? "Ja" : "Nee";
}

export function averageOrderLabel(
  detail: Pick<TeammateDetailView, "averageOrderMinor" | "averageOrderCurrency">,
): string {
  if (detail.averageOrderMinor === null) return "—";
  return formatMoneyMinor(detail.averageOrderMinor, detail.averageOrderCurrency);
}

export function teammateDetailsPath(userId: string): string {
  return `/account/company/users/${userId}`;
}

export function teammateInitials(detail: Pick<TeammateDetailView, "fullName" | "firstName" | "lastName">): string {
  if (detail.firstName && detail.lastName) {
    return `${detail.firstName[0] ?? ""}${detail.lastName[0] ?? ""}`.toUpperCase();
  }
  const parts = detail.fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
