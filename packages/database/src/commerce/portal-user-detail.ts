/**
 * Gebruikersdetails — staff or same-company portal member.
 * Last login, named favourite lists, and user notes are display-only dummy until those stores exist.
 * Order KPIs use integer minor units from existing orders only.
 */

import { AdminAuthError } from "@mccoy/security";

import { CustomerPortalError } from "../customer-portal/errors";
import { createSupabaseServiceClient } from "../supabase";
import { dummyLastLoginAt, portalUserAccountType, portalUserStatusPill } from "./admin-users-directory";
import { listCompanyFavouriteProducts } from "./company-favourite-products";
import {
  getCompanyById,
  getCustomerLifetimeOrderStats,
  listOrdersForCustomer,
  type CommerceOrder,
} from "./core";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PortalUserDetailKey =
  | { kind: "user"; userId: string; companyId?: string }
  | { kind: "invite"; invitationId: string };

export type PortalUserDetailActor =
  | { kind: "staff" }
  | { kind: "customer"; companyId: string };

export type PortalUserDetailError = "not_found" | "forbidden";

export type PortalUserDetailRight = {
  id: "can_order" | "can_view_favourites" | "can_manage_team";
  label: string;
  allowed: boolean;
};

export type PortalUserDetailOrder = {
  id: string;
  number: string;
  placedAt: string;
  statusLabel: string;
  totalMinor: number;
  currency: string;
};

export type PortalUserDetailList = {
  id: string;
  name: string;
  source: "dummy";
};

export type PortalUserDetailNote = {
  id: string;
  author: string;
  dated: string;
  at: string;
  body: string;
  source: "dummy";
};

/**
 * Every order this user ever placed, for any company — the opposite scope of the
 * company-scoped KPIs on the same page. Staff-only: handing it to a customer actor
 * would tell company A that its colleague also orders for company B.
 */
export type PortalUserLifetimeActivity = {
  orderCount: number;
  totalSpendMinor: number;
  lastOrderAt: string | null;
  currency: string;
  /** True when this user holds order history under more than the displayed company. */
  spansMultipleCompanies: boolean;
};

export type PortalUserDetail = {
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
  lastLoginSource: "dummy" | "none";
  signedUpAt: string | null;
  rights: PortalUserDetailRight[];
  orderCount: number;
  favouriteCount: number;
  lastOrderAt: string | null;
  averageOrderMinor: number | null;
  averageOrderCurrency: string;
  favouriteLists: PortalUserDetailList[];
  recentOrders: PortalUserDetailOrder[];
  /** Null for invites and for customer actors. See `PortalUserLifetimeActivity`. */
  lifetimeActivity: PortalUserLifetimeActivity | null;
  notes: PortalUserDetailNote[];
  canEdit: boolean;
  canResetPassword: boolean;
  canDeactivate: boolean;
  canResendInvite: boolean;
  blocked: boolean;
  callout: string;
};

type NestedRecord = Record<string, unknown>;

function asOne<T extends NestedRecord>(raw: unknown): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return raw as T;
}

export function parseUserDetailKey(raw: string): PortalUserDetailKey | null {
  const value = raw.trim();
  if (!value) return null;
  if (UUID_RE.test(value)) return { kind: "user", userId: value };
  if (value.startsWith("m:")) {
    const parts = value.slice(2).split(":");
    if (parts.length === 2 && UUID_RE.test(parts[0]!) && UUID_RE.test(parts[1]!)) {
      return { kind: "user", companyId: parts[0], userId: parts[1] };
    }
    return null;
  }
  if (value.startsWith("i:") && UUID_RE.test(value.slice(2))) {
    return { kind: "invite", invitationId: value.slice(2) };
  }
  return null;
}

export function portalUserDetailAccess(input: {
  actor: PortalUserDetailActor;
  targetCompanyId: string;
}): { allowed: true } | { allowed: false; error: PortalUserDetailError } {
  if (input.actor.kind === "staff") return { allowed: true };
  if (input.actor.companyId === input.targetCompanyId) return { allowed: true };
  return { allowed: false, error: "forbidden" };
}

export function assertPortalUserDetailAccess(input: {
  actor: PortalUserDetailActor;
  targetCompanyId: string;
}): void {
  const decision = portalUserDetailAccess(input);
  if (decision.allowed) return;
  if (input.actor.kind === "staff") {
    throw new AdminAuthError("Niet geautoriseerd.");
  }
  throw new CustomerPortalError("Deze gebruiker hoort niet bij uw bedrijf.", "CUSTOMER_CROSS_TENANT_DENIED");
}

export function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function roleLabelNl(role: string): "Accountbeheerder" | "Gebruiker" {
  return role === "account_admin" ? "Accountbeheerder" : "Gebruiker";
}

export function rightsFromRole(role: string): PortalUserDetailRight[] {
  const manageTeam = role === "account_admin";
  return [
    { id: "can_order", label: "Kan producten bestellen", allowed: true },
    { id: "can_view_favourites", label: "Kan favorieten bekijken", allowed: true },
    { id: "can_manage_team", label: "Kan team beheren", allowed: manageTeam },
  ];
}

export function invitationStatusLabelNl(input: {
  invitationStatus?: string | null;
  membershipActive: boolean;
}): string {
  if (input.invitationStatus === "pending") return "Uitnodiging verzonden";
  if (input.invitationStatus === "consumed" || input.membershipActive) return "Geaccepteerd";
  if (input.invitationStatus === "expired") return "Verlopen";
  return "—";
}

/** Must cover every `ORDER_STATUSES` member, otherwise raw English leaks into the UI. */
export function orderStatusLabelNl(status: string): string {
  if (status === "pending") return "In afwachting";
  if (status === "placed" || status === "confirmed") return "Bevestigd";
  if (status === "cancelled") return "Geannuleerd";
  if (status === "completed" || status === "fulfilled") return "Afgeleverd";
  if (status === "processing") return "In behandeling";
  return status || "—";
}

export function averageOrderMinor(orders: ReadonlyArray<{ totalMinor: number }>): number | null {
  if (orders.length === 0) return null;
  const sum = orders.reduce((acc, order) => acc + order.totalMinor, 0);
  return Math.round(sum / orders.length);
}

export const DUMMY_FAVOURITE_LISTS: readonly PortalUserDetailList[] = [
  { id: "dummy-sanitair", name: "Sanitair basislijn", source: "dummy" },
  { id: "dummy-kantoor", name: "Kantoor dagelijks", source: "dummy" },
  { id: "dummy-navul", name: "Navulproducten", source: "dummy" },
];

export const DUMMY_TEAM_NOTE: PortalUserDetailNote = {
  id: "dummy-mark",
  author: "Mark de Vries",
  dated: "12 jan 2024, 09:15",
  at: "2024-01-12T08:15:00.000Z",
  body: "Prima contactpersoon voor dagelijkse bestellingen. Stemt voorraad af met het facility-team.",
  source: "dummy",
};

export function displayNameFromParts(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  if (input.fullName?.trim()) return input.fullName.trim();
  const joined = [input.firstName, input.lastName].filter((part) => part && part.trim()).join(" ").trim();
  if (joined) return joined;
  return input.email.split("@")[0]?.trim() || input.email;
}

function memberDirectoryId(companyId: string, userId: string): string {
  return `m:${companyId}:${userId}`;
}

function toRecentOrders(orders: CommerceOrder[]): PortalUserDetailOrder[] {
  return orders.slice(0, 8).map((order) => ({
    id: order.id,
    number: order.number,
    placedAt: order.placedAt,
    statusLabel: orderStatusLabelNl(order.orderStatus),
    totalMinor: order.totalMinor,
    currency: order.currency,
  }));
}

export async function getPortalUserDetail(
  userKey: string,
  actor: PortalUserDetailActor,
): Promise<{ ok: true; detail: PortalUserDetail } | { ok: false; error: PortalUserDetailError }> {
  const parsed = parseUserDetailKey(userKey);
  if (!parsed) return { ok: false, error: "not_found" };

  const supabase = createSupabaseServiceClient();

  if (parsed.kind === "invite") {
    const { data, error } = await supabase
      .schema("private")
      .from("customer_invitations")
      .select(
        "id, company_id, email, intended_role, status, expires_at, invitee_first_name, invitee_last_name, invitee_phone, reminder_count, last_reminder_at, created_at",
      )
      .eq("id", parsed.invitationId)
      .maybeSingle();
    if (error) throw new Error(`getPortalUserDetail invite: ${error.message}`);
    if (!data) return { ok: false, error: "not_found" };
    const companyId = String(data.company_id);
    const company = await getCompanyById(companyId);
    const access = portalUserDetailAccess({ actor, targetCompanyId: companyId });
    if (!access.allowed) return { ok: false, error: "forbidden" };

    const email = String(data.email);
    const fullName = displayNameFromParts({
      firstName: (data.invitee_first_name as string | null) ?? null,
      lastName: (data.invitee_last_name as string | null) ?? null,
      email,
    });
    const names = splitPersonName(fullName);
    const role = portalUserAccountType(String(data.intended_role));
    const status = portalUserStatusPill({
      invitationStatus: String(data.status),
      reminderCount: Number(data.reminder_count ?? 0),
      lastReminderAt: (data.last_reminder_at as string | null) ?? null,
    });
    return {
      ok: true,
      detail: finishDetail({
        id: `i:${parsed.invitationId}`,
        userId: null,
        invitationId: parsed.invitationId,
        companyId,
        companyName: company?.displayName?.trim() || company?.legalName || "Bedrijf",
        fullName,
        firstName: names.firstName,
        lastName: names.lastName,
        email,
        phone: (data.invitee_phone as string | null) ?? null,
        role,
        status,
        invitationStatus: String(data.status),
        memberSince: null,
        signedUpAt: null,
        activated: false,
        canResendInvite: String(data.status) === "pending",
        canDeactivate: false,
        canEdit: false,
        canResetPassword: false,
        orders: [],
        favouriteCount: 0,
        lifetimeActivity: null,
      }),
    };
  }

  let query = supabase
    .from("company_users")
    .select(
      "id, company_id, user_id, role, status, created_at, users!inner(id, email, full_name, phone, status, account_kind, created_at), companies!inner(id, legal_name, display_name, status)",
    )
    .eq("user_id", parsed.userId);

  if (parsed.companyId) query = query.eq("company_id", parsed.companyId);
  if (actor.kind === "customer") query = query.eq("company_id", actor.companyId);

  // A bare user id can match several memberships; order so the resolved company is
  // at least deterministic instead of whatever Postgres returns first.
  const { data: rows, error: memberError } = await query
    .order("created_at", { ascending: true })
    .limit(2);
  if (memberError) throw new Error(`getPortalUserDetail member: ${memberError.message}`);
  const row = rows?.[0];
  if (!row) return { ok: false, error: actor.kind === "customer" ? "forbidden" : "not_found" };

  const users = asOne<{
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    status: string;
    account_kind: string;
    created_at: string;
  }>(row.users);
  const companies = asOne<{
    id: string;
    legal_name: string;
    display_name: string | null;
    status: string;
  }>(row.companies);
  if (!users || users.account_kind !== "customer" || !companies) {
    return { ok: false, error: "not_found" };
  }

  const companyId = String(row.company_id);
  const access = portalUserDetailAccess({ actor, targetCompanyId: companyId });
  if (!access.allowed) return { ok: false, error: "forbidden" };

  const { data: inviteRow } = await supabase
    .schema("private")
    .from("customer_invitations")
    .select("id, status, reminder_count, last_reminder_at, created_at, consumed_at")
    .eq("company_id", companyId)
    .eq("email_normalized", users.email.trim().toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Both are scoped to the membership's company: this page is "user within company X",
  // so global-by-user reads would expose another company's history.
  const [orders, favourites] = await Promise.all([
    listOrdersForCustomer(users.id, { companyId }),
    listCompanyFavouriteProducts(companyId),
  ]);

  const lifetimeActivity =
    actor.kind === "staff" ? await loadLifetimeActivity(users.id, orders) : null;

  const fullName = displayNameFromParts({ fullName: users.full_name, email: users.email });
  const names = splitPersonName(fullName);
  const role = portalUserAccountType(String(row.role));
  const status = portalUserStatusPill({
    userStatus: users.status,
    membershipStatus: String(row.status),
    companyStatus: companies.status,
    invitationStatus: inviteRow?.status as string | undefined,
    reminderCount: Number(inviteRow?.reminder_count ?? 0),
    lastReminderAt: (inviteRow?.last_reminder_at as string | null) ?? null,
  });
  const membershipActive = String(row.status) === "active" && users.status !== "blocked";

  return {
    ok: true,
    detail: finishDetail({
      id: memberDirectoryId(companyId, users.id),
      userId: users.id,
      invitationId: inviteRow?.id ? String(inviteRow.id) : null,
      companyId,
      companyName: companies.display_name?.trim() || companies.legal_name,
      fullName,
      firstName: names.firstName,
      lastName: names.lastName,
      email: users.email,
      phone: users.phone,
      role,
      status,
      invitationStatus: (inviteRow?.status as string | undefined) ?? null,
      memberSince: String(row.created_at),
      signedUpAt: (inviteRow?.consumed_at as string | null) ?? users.created_at,
      activated: membershipActive,
      canResendInvite: inviteRow?.status === "pending",
      canDeactivate: Boolean(users.id),
      canEdit: Boolean(users.id),
      canResetPassword: Boolean(users.id) && users.status !== "blocked",
      orders,
      favouriteCount: favourites.length,
      lifetimeActivity,
    }),
  };
}

async function loadLifetimeActivity(
  userId: string,
  companyScopedOrders: CommerceOrder[],
): Promise<PortalUserLifetimeActivity | null> {
  const lifetime = await getCustomerLifetimeOrderStats(userId);
  if (lifetime.orderCount === 0) return null;
  return {
    orderCount: lifetime.orderCount,
    totalSpendMinor: lifetime.totalSpendMinor,
    lastOrderAt: lifetime.lastOrderAt,
    currency: companyScopedOrders[0]?.currency ?? lifetime.currency,
    spansMultipleCompanies: lifetime.orderCount > companyScopedOrders.length,
  };
}

function finishDetail(input: {
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
  role: "account_admin" | "account_user";
  status: ReturnType<typeof portalUserStatusPill>;
  invitationStatus: string | null;
  memberSince: string | null;
  signedUpAt: string | null;
  activated: boolean;
  canResendInvite: boolean;
  canDeactivate: boolean;
  canEdit: boolean;
  canResetPassword: boolean;
  orders: CommerceOrder[];
  favouriteCount: number;
  lifetimeActivity: PortalUserLifetimeActivity | null;
}): PortalUserDetail {
  const login =
    input.status.id === "active"
      ? { lastLoginAt: dummyLastLoginAt(input.id), lastLoginSource: "dummy" as const }
      : { lastLoginAt: null, lastLoginSource: "none" as const };
  const lastOrder = input.orders[0] ?? null;
  return {
    id: input.id,
    userId: input.userId,
    invitationId: input.invitationId,
    companyId: input.companyId,
    companyName: input.companyName,
    fullName: input.fullName,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    jobTitle: null,
    role: input.role,
    roleLabel: roleLabelNl(input.role),
    statusId: input.status.id,
    statusLabel: input.status.label,
    invitationStatusLabel: invitationStatusLabelNl({
      invitationStatus: input.invitationStatus,
      membershipActive: input.activated,
    }),
    memberSince: input.memberSince,
    lastLoginAt: login.lastLoginAt,
    lastLoginSource: login.lastLoginSource,
    signedUpAt: input.signedUpAt,
    rights: rightsFromRole(input.role),
    orderCount: input.orders.length,
    favouriteCount: input.favouriteCount,
    lastOrderAt: lastOrder?.placedAt ?? null,
    averageOrderMinor: averageOrderMinor(input.orders),
    averageOrderCurrency: lastOrder?.currency ?? "EUR",
    favouriteLists: [...DUMMY_FAVOURITE_LISTS],
    recentOrders: toRecentOrders(input.orders),
    lifetimeActivity: input.lifetimeActivity,
    notes: [DUMMY_TEAM_NOTE],
    canEdit: input.canEdit,
    canResetPassword: input.canResetPassword,
    canDeactivate: input.canDeactivate,
    canResendInvite: input.canResendInvite,
    blocked: input.status.id === "blocked",
    callout: "Deze gebruiker kan producten bestellen voor uw bedrijf.",
  };
}
