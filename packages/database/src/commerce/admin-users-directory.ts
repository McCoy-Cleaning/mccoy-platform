/**
 * Staff admin Gebruikers directory — customer portal members + pending invitations.
 * Last login is display-only dummy until Auth last_sign_in is wired.
 * Last order is the company's latest order time, not a per-user ledger.
 */

import { AdminAuthError } from "@mccoy/security";

import { createSupabaseServiceClient } from "../supabase";
import {
  assertDirectoryStaffAccess,
  type DirectoryActorKind,
} from "./admin-customers-directory";

export const PORTAL_USER_STATUSES = ["active", "invited", "reminder_scheduled", "blocked"] as const;
export type PortalUserStatusId = (typeof PORTAL_USER_STATUSES)[number];

export type PortalUserAccountType = "account_admin" | "account_user";

export type PortalUserKind = "member" | "invite";

export type PortalUserStatusPill = {
  id: PortalUserStatusId;
  label: "Actief" | "Uitnodiging verzonden" | "Herinnering ingepland" | "Geblokkeerd";
  tone: "active" | "invited" | "reminder" | "blocked";
};

export type AdminPortalUserDirectoryItem = {
  id: string;
  kind: PortalUserKind;
  userId: string | null;
  invitationId: string | null;
  companyId: string;
  companyName: string;
  fullName: string;
  email: string;
  phone: string | null;
  accountType: PortalUserAccountType;
  accountTypeLabel: "Accountbeheerder" | "Besteller";
  status: PortalUserStatusPill;
  lastLoginAt: string | null;
  lastLoginSource: "dummy" | "none";
  lastOrderAt: string | null;
  lastOrderSource: "company" | "none";
  invitedByName: string | null;
  invitedAt: string | null;
  invitationExpiresAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  activatedAt: string | null;
  canRemind: boolean;
  canBlock: boolean;
  canResetInvite: boolean;
  blocked: boolean;
};

export type AdminPortalUsersKpis = {
  activeUsers: number;
  awaitingActivation: number;
  accountAdmins: number;
  orderers: number;
  activeCreatedLast7Days: number;
  activeCreatedPrevious7Days: number;
};

export type AdminPortalUserTimelineStep = {
  id: "invited" | "reminded" | "activated";
  label: string;
  at: string | null;
  state: "done" | "current" | "upcoming";
};

export type AdminPortalUsersDirectoryQuery = {
  q?: string;
  companyId?: string | null;
  userId?: string | null;
  page?: number;
  pageSize?: number;
};

/**
 * How much of a source table this read actually covered. The directory merges
 * memberships and invitations in application code, so a bound has to stay somewhere;
 * it must be reported instead of quietly dropping users out of the list and the KPIs.
 */
export type DirectoryScanBound = {
  /** Rows read into memory. */
  scanned: number;
  /** Rows the filter matches in the database. */
  total: number;
  truncated: boolean;
};

export type AdminPortalUsersTruncation = {
  truncated: boolean;
  memberships: DirectoryScanBound;
  invitations: DirectoryScanBound;
  companies: DirectoryScanBound;
};

export type AdminPortalUsersDirectoryPage = {
  items: AdminPortalUserDirectoryItem[];
  companies: Array<{ id: string; name: string }>;
  total: number;
  page: number;
  pageSize: number;
  kpis: AdminPortalUsersKpis;
  /** Non-null only when at least one source table was capped. */
  truncation: AdminPortalUsersTruncation | null;
};

type NestedRecord = Record<string, unknown>;

type MemberRow = {
  membershipId: string;
  companyId: string;
  userId: string;
  role: string;
  membershipStatus: string;
  createdAt: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  userStatus: string;
  accountKind: string;
  companyName: string;
  companyStatus: string;
};

type InviteRow = {
  id: string;
  companyId: string;
  email: string;
  emailNormalized: string;
  intendedRole: string;
  status: string;
  expiresAt: string;
  consumedAt: string | null;
  invitedByType: string;
  invitedByUserId: string | null;
  inviteeFirstName: string | null;
  inviteeLastName: string | null;
  inviteePhone: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  createdAt: string;
};

function asOne<T extends NestedRecord>(raw: unknown): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return raw as T;
}

function sanitizeIlike(q: string): string {
  return q
    .replace(/[%_,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function pageBounds(
  page = 1,
  pageSize = 25,
): {
  from: number;
  to: number;
  page: number;
  pageSize: number;
} {
  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize, page: safePage, pageSize: safeSize };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayName(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  const joined = [input.firstName, input.lastName].filter((p) => p && p.trim()).join(" ").trim();
  if (input.fullName?.trim()) return input.fullName.trim();
  if (joined) return joined;
  const local = input.email.split("@")[0]?.trim();
  return local || input.email;
}

export function portalUserAccountType(role: string): PortalUserAccountType {
  return role === "account_admin" ? "account_admin" : "account_user";
}

export function portalUserAccountTypeLabel(role: string): "Accountbeheerder" | "Besteller" {
  return portalUserAccountType(role) === "account_admin" ? "Accountbeheerder" : "Besteller";
}

export function portalUserStatusPill(input: {
  userStatus?: string | null;
  membershipStatus?: string | null;
  companyStatus?: string | null;
  invitationStatus?: string | null;
  reminderCount?: number;
  lastReminderAt?: string | null;
}): PortalUserStatusPill {
  if (
    input.userStatus === "blocked" ||
    input.membershipStatus === "suspended" ||
    input.companyStatus === "blocked"
  ) {
    return { id: "blocked", label: "Geblokkeerd", tone: "blocked" };
  }
  if (input.membershipStatus === "active" && (input.userStatus === "active" || !input.userStatus)) {
    return { id: "active", label: "Actief", tone: "active" };
  }
  if ((input.reminderCount ?? 0) > 0 || input.lastReminderAt) {
    return { id: "reminder_scheduled", label: "Herinnering ingepland", tone: "reminder" };
  }
  if (input.invitationStatus === "pending" || input.userStatus === "invited") {
    return { id: "invited", label: "Uitnodiging verzonden", tone: "invited" };
  }
  return { id: "invited", label: "Uitnodiging verzonden", tone: "invited" };
}

export function dummyLastLoginAt(seed: string, now = new Date()): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const daysAgo = hash % 28;
  const hours = hash % 24;
  const minutes = hash % 60;
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export function resolveLastLogin(input: {
  statusId: PortalUserStatusId;
  seed: string;
  now?: Date;
}): { lastLoginAt: string | null; lastLoginSource: "dummy" | "none" } {
  if (input.statusId !== "active") {
    return { lastLoginAt: null, lastLoginSource: "none" };
  }
  return {
    lastLoginAt: dummyLastLoginAt(input.seed, input.now),
    lastLoginSource: "dummy",
  };
}

export function computePortalUsersKpis(
  rows: Array<{
    statusId: PortalUserStatusId;
    accountType: PortalUserAccountType;
    createdAt: string;
  }>,
  now = Date.now(),
): AdminPortalUsersKpis {
  const day = 86_400_000;
  let activeUsers = 0;
  let awaitingActivation = 0;
  let accountAdmins = 0;
  let orderers = 0;
  let activeCreatedLast7Days = 0;
  let activeCreatedPrevious7Days = 0;

  for (const row of rows) {
    if (row.statusId === "active") activeUsers += 1;
    if (row.statusId === "invited" || row.statusId === "reminder_scheduled") awaitingActivation += 1;
    if (row.accountType === "account_admin") accountAdmins += 1;
    else orderers += 1;

    if (row.statusId !== "active") continue;
    const created = Date.parse(row.createdAt);
    if (!Number.isFinite(created)) continue;
    const age = now - created;
    if (age <= 7 * day) activeCreatedLast7Days += 1;
    else if (age <= 14 * day) activeCreatedPrevious7Days += 1;
  }

  return {
    activeUsers,
    awaitingActivation,
    accountAdmins,
    orderers,
    activeCreatedLast7Days,
    activeCreatedPrevious7Days,
  };
}

export function buildRegistrationTimeline(input: {
  invitedAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  activatedAt: string | null;
  statusId: PortalUserStatusId;
}): AdminPortalUserTimelineStep[] {
  const invitedDone = Boolean(input.invitedAt) || input.reminderCount > 0 || Boolean(input.lastReminderAt);
  const remindedDone = Boolean(input.lastReminderAt) || input.reminderCount > 0;
  const activatedDone = input.statusId === "active" || Boolean(input.activatedAt);

  return [
    {
      id: "invited",
      label: "Uitnodiging verzonden",
      at: input.invitedAt,
      state: invitedDone || remindedDone || activatedDone ? "done" : "current",
    },
    {
      id: "reminded",
      label: "Herinnering gestuurd",
      at: input.lastReminderAt,
      state: remindedDone || activatedDone ? "done" : invitedDone ? "current" : "upcoming",
    },
    {
      id: "activated",
      label: "Account geactiveerd",
      at: input.activatedAt,
      state: activatedDone ? "done" : remindedDone ? "current" : "upcoming",
    },
  ];
}

export function selectedPortalUser<T extends { id: string }>(
  items: readonly T[],
  selectedId: string | undefined | null,
): T | null {
  if (!selectedId) return null;
  return items.find((item) => item.id === selectedId) ?? null;
}

function memberDirectoryId(companyId: string, userId: string): string {
  return `m:${companyId}:${userId}`;
}

function inviteDirectoryId(invitationId: string): string {
  return `i:${invitationId}`;
}

/**
 * Upper bound on rows read from any single source table. High enough not to bite at
 * realistic volume, and when it does bite the admin is told rather than shown a list
 * that silently lost users.
 */
export const ADMIN_PORTAL_USERS_SCAN_LIMIT = 20_000;
const ADMIN_PORTAL_USERS_SCAN_BATCH = 1_000;

type RangeReader<T> = (
  from: number,
  to: number,
  withCount: boolean,
) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
}>;

/**
 * Pages through a source table until it is exhausted or the scan limit is reached.
 * The exact row count is taken from the first request so truncation is detectable
 * even when PostgREST's own `max-rows` is smaller than our batch size.
 * The reader must impose a stable total order, otherwise ranges can skip or repeat rows.
 */
async function scanAll<T>(
  label: string,
  read: RangeReader<T>,
  limit = ADMIN_PORTAL_USERS_SCAN_LIMIT,
): Promise<{ rows: T[]; bound: DirectoryScanBound }> {
  const rows: T[] = [];
  let total = 0;
  let sawCount = false;

  for (;;) {
    const remaining = limit - rows.length;
    if (remaining <= 0) break;
    const size = Math.min(ADMIN_PORTAL_USERS_SCAN_BATCH, remaining);
    const { data, error, count } = await read(rows.length, rows.length + size - 1, !sawCount);
    if (error) throw new Error(`${label}: ${error.message}`);
    const batch = data ?? [];
    if (typeof count === "number") {
      total = count;
      sawCount = true;
    }
    rows.push(...batch);
    if (batch.length === 0 || batch.length < size) break;
    if (sawCount && rows.length >= total) break;
  }

  const resolvedTotal = Math.max(total, rows.length);
  return {
    rows,
    bound: {
      scanned: rows.length,
      total: resolvedTotal,
      truncated: rows.length < resolvedTotal,
    },
  };
}

function matchesQuery(item: AdminPortalUserDirectoryItem, q: string): boolean {
  if (!q) return true;
  const hay = `${item.fullName} ${item.email} ${item.companyName}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function toItem(input: {
  id: string;
  kind: PortalUserKind;
  userId: string | null;
  invitationId: string | null;
  companyId: string;
  companyName: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: PortalUserStatusPill;
  lastOrderAt: string | null;
  invitedByName: string | null;
  invitedAt: string | null;
  invitationExpiresAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  activatedAt: string | null;
}): AdminPortalUserDirectoryItem {
  const login = resolveLastLogin({ statusId: input.status.id, seed: input.id });
  const pendingInvite = input.status.id === "invited" || input.status.id === "reminder_scheduled";
  return {
    ...input,
    accountType: portalUserAccountType(input.role),
    accountTypeLabel: portalUserAccountTypeLabel(input.role),
    lastLoginAt: login.lastLoginAt,
    lastLoginSource: login.lastLoginSource,
    lastOrderSource: input.lastOrderAt ? "company" : "none",
    canRemind: pendingInvite && Boolean(input.email),
    canBlock: Boolean(input.userId),
    canResetInvite: pendingInvite && Boolean(input.email),
    blocked: input.status.id === "blocked",
  };
}

export async function listAdminPortalUsersDirectory(
  query: AdminPortalUsersDirectoryQuery = {},
  actor: DirectoryActorKind = "staff",
): Promise<AdminPortalUsersDirectoryPage> {
  assertDirectoryStaffAccess(actor);
  const { from, to, page, pageSize } = pageBounds(query.page, query.pageSize);
  const q = sanitizeIlike(query.q ?? "");
  const companyFilter = query.companyId?.trim() || null;

  const supabase = createSupabaseServiceClient();

  const { rows: memberRows, bound: memberBound } = await scanAll<Record<string, unknown>>(
    "listAdminPortalUsersDirectory members",
    (from, to, withCount) =>
      supabase
        .from("company_users")
        .select(
          "id, company_id, user_id, role, status, created_at, users!inner(id, email, full_name, phone, status, account_kind), companies!inner(id, legal_name, display_name, status)",
          withCount ? { count: "exact" } : undefined,
        )
        .order("id", { ascending: true })
        .range(from, to),
  );

  const members: MemberRow[] = [];
  for (const row of memberRows) {
    const users = asOne<{
      id: string;
      email: string;
      full_name: string | null;
      phone: string | null;
      status: string;
      account_kind: string;
    }>(row.users);
    const companies = asOne<{
      id: string;
      legal_name: string;
      display_name: string | null;
      status: string;
    }>(row.companies);
    if (!users || users.account_kind !== "customer" || !companies) continue;
    members.push({
      membershipId: String(row.id),
      companyId: String(row.company_id),
      userId: String(row.user_id),
      role: String(row.role),
      membershipStatus: String(row.status),
      createdAt: String(row.created_at),
      email: users.email,
      fullName: users.full_name,
      phone: users.phone,
      userStatus: users.status,
      accountKind: users.account_kind,
      companyName: companies.display_name?.trim() || companies.legal_name,
      companyStatus: companies.status,
    });
  }

  const { rows: inviteRows, bound: inviteBound } = await scanAll<Record<string, unknown>>(
    "listAdminPortalUsersDirectory invites",
    (from, to, withCount) =>
      supabase
        .schema("private")
        .from("customer_invitations")
        .select(
          "id, company_id, email, email_normalized, intended_role, status, expires_at, consumed_at, invited_by_type, invited_by_user_id, invitee_first_name, invitee_last_name, invitee_phone, reminder_count, last_reminder_at, created_at",
          withCount ? { count: "exact" } : undefined,
        )
        .in("status", ["pending", "consumed"])
        .order("created_at", { ascending: false })
        // Tiebreaker: `created_at` alone is not a total order, and range paging over a
        // non-deterministic order can skip or duplicate rows between batches.
        .order("id", { ascending: true })
        .range(from, to),
  );

  const invites: InviteRow[] = inviteRows.map((row) => ({
    id: String(row.id),
    companyId: String(row.company_id),
    email: String(row.email),
    emailNormalized: String(row.email_normalized ?? row.email ?? "").toLowerCase(),
    intendedRole: String(row.intended_role),
    status: String(row.status),
    expiresAt: String(row.expires_at),
    consumedAt: (row.consumed_at as string | null) ?? null,
    invitedByType: String(row.invited_by_type ?? "staff"),
    invitedByUserId: (row.invited_by_user_id as string | null) ?? null,
    inviteeFirstName: (row.invitee_first_name as string | null) ?? null,
    inviteeLastName: (row.invitee_last_name as string | null) ?? null,
    inviteePhone: (row.invitee_phone as string | null) ?? null,
    reminderCount: Number(row.reminder_count ?? 0),
    lastReminderAt: (row.last_reminder_at as string | null) ?? null,
    createdAt: String(row.created_at),
  }));

  const inviterIds = [
    ...new Set(invites.map((invite) => invite.invitedByUserId).filter((id): id is string => Boolean(id))),
  ];
  const inviterNameById = new Map<string, string>();
  if (inviterIds.length) {
    const { data: inviters } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", inviterIds);
    for (const user of inviters ?? []) {
      const name = (user.full_name as string | null)?.trim() || String(user.email ?? "");
      if (name) inviterNameById.set(String(user.id), name);
    }
  }

  const companyIds = new Set<string>();
  for (const member of members) companyIds.add(member.companyId);
  for (const invite of invites) companyIds.add(invite.companyId);

  const { rows: companyRows, bound: companyBound } = await scanAll<Record<string, unknown>>(
    "listAdminPortalUsersDirectory companies",
    (from, to, withCount) =>
      supabase
        .from("companies")
        .select(
          "id, legal_name, display_name, status",
          withCount ? { count: "exact" } : undefined,
        )
        .order("legal_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
  );

  const companyNameById = new Map<string, string>();
  const companies: Array<{ id: string; name: string }> = [];
  for (const company of companyRows) {
    const name =
      (company.display_name as string | null)?.trim() || String(company.legal_name ?? "Bedrijf");
    companyNameById.set(String(company.id), name);
    companies.push({ id: String(company.id), name });
  }

  // A capped company scan must not turn a pending invite's company into the literal
  // string "Bedrijf": resolve the referenced ids directly instead.
  const missingCompanyIds = [...companyIds].filter((id) => !companyNameById.has(id));
  for (let i = 0; i < missingCompanyIds.length; i += 200) {
    const chunk = missingCompanyIds.slice(i, i + 200);
    const { data: extra, error: extraError } = await supabase
      .from("companies")
      .select("id, legal_name, display_name")
      .in("id", chunk);
    if (extraError) {
      throw new Error(`listAdminPortalUsersDirectory company names: ${extraError.message}`);
    }
    for (const company of extra ?? []) {
      const name =
        (company.display_name as string | null)?.trim() || String(company.legal_name ?? "");
      if (name) companyNameById.set(String(company.id), name);
    }
  }

  const lastOrderByCompany = new Map<string, string>();
  const companyIdList = [...companyIds];
  if (companyIdList.length) {
    const { data: stats } = await supabase
      .schema("private")
      .rpc("admin_order_stats_for_companies", { p_company_ids: companyIdList });
    for (const row of stats ?? []) {
      if (row.last_order_at) {
        lastOrderByCompany.set(String(row.company_id), String(row.last_order_at));
      }
    }
  }

  const memberByKey = new Map<string, MemberRow>();
  for (const member of members) {
    memberByKey.set(`${member.companyId}:${normalizeEmail(member.email)}`, member);
  }

  const latestInviteByMember = new Map<string, InviteRow>();
  const pendingInviteRows: InviteRow[] = [];
  for (const invite of invites) {
    const key = `${invite.companyId}:${invite.emailNormalized}`;
    const member = memberByKey.get(key);
    if (member) {
      const existing = latestInviteByMember.get(key);
      if (!existing) latestInviteByMember.set(key, invite);
      continue;
    }
    if (invite.status === "pending") pendingInviteRows.push(invite);
  }

  const items: AdminPortalUserDirectoryItem[] = [];

  for (const member of members) {
    const key = `${member.companyId}:${normalizeEmail(member.email)}`;
    const invite = latestInviteByMember.get(key);
    const status = portalUserStatusPill({
      userStatus: member.userStatus,
      membershipStatus: member.membershipStatus,
      companyStatus: member.companyStatus,
      invitationStatus: invite?.status,
      reminderCount: invite?.reminderCount,
      lastReminderAt: invite?.lastReminderAt,
    });
    const invitedByName = invite
      ? inviterNameById.get(invite.invitedByUserId ?? "") ??
        (invite.invitedByType === "staff" ? "McCoy" : "Accountbeheerder")
      : null;
    items.push(
      toItem({
        id: memberDirectoryId(member.companyId, member.userId),
        kind: "member",
        userId: member.userId,
        invitationId: invite?.id ?? null,
        companyId: member.companyId,
        companyName: member.companyName,
        fullName: displayName({ fullName: member.fullName, email: member.email }),
        email: member.email,
        phone: member.phone ?? invite?.inviteePhone ?? null,
        role: member.role,
        status,
        lastOrderAt: lastOrderByCompany.get(member.companyId) ?? null,
        invitedByName,
        invitedAt: invite?.createdAt ?? member.createdAt,
        invitationExpiresAt: invite?.status === "pending" ? invite.expiresAt : null,
        reminderCount: invite?.reminderCount ?? 0,
        lastReminderAt: invite?.lastReminderAt ?? null,
        activatedAt: invite?.consumedAt ?? (status.id === "active" ? member.createdAt : null),
      }),
    );
  }

  for (const invite of pendingInviteRows) {
    const status = portalUserStatusPill({
      invitationStatus: invite.status,
      reminderCount: invite.reminderCount,
      lastReminderAt: invite.lastReminderAt,
    });
    items.push(
      toItem({
        id: inviteDirectoryId(invite.id),
        kind: "invite",
        userId: null,
        invitationId: invite.id,
        companyId: invite.companyId,
        companyName: companyNameById.get(invite.companyId) ?? "Bedrijf",
        fullName: displayName({
          firstName: invite.inviteeFirstName,
          lastName: invite.inviteeLastName,
          email: invite.email,
        }),
        email: invite.email,
        phone: invite.inviteePhone,
        role: invite.intendedRole,
        status,
        lastOrderAt: lastOrderByCompany.get(invite.companyId) ?? null,
        invitedByName:
          inviterNameById.get(invite.invitedByUserId ?? "") ??
          (invite.invitedByType === "staff" ? "McCoy" : "Accountbeheerder"),
        invitedAt: invite.createdAt,
        invitationExpiresAt: invite.expiresAt,
        reminderCount: invite.reminderCount,
        lastReminderAt: invite.lastReminderAt,
        activatedAt: null,
      }),
    );
  }

  items.sort((a, b) => {
    const nameCmp = a.fullName.localeCompare(b.fullName, "nl");
    if (nameCmp !== 0) return nameCmp;
    return a.email.localeCompare(b.email, "nl");
  });

  const kpis = computePortalUsersKpis(
    items.map((item) => ({
      statusId: item.status.id,
      accountType: item.accountType,
      createdAt: item.invitedAt ?? item.activatedAt ?? new Date(0).toISOString(),
    })),
  );

  const filtered = items.filter((item) => {
    if (companyFilter && item.companyId !== companyFilter) return false;
    return matchesQuery(item, q);
  });

  const truncated = memberBound.truncated || inviteBound.truncated || companyBound.truncated;

  return {
    items: filtered.slice(from, to),
    companies,
    total: filtered.length,
    page,
    pageSize,
    kpis,
    truncation: truncated
      ? {
          truncated,
          memberships: memberBound,
          invitations: inviteBound,
          companies: companyBound,
        }
      : null,
  };
}

export function assertPortalUsersStaffAccess(kind: DirectoryActorKind): void {
  assertDirectoryStaffAccess(kind);
}

export function portalUsersAccessDecision(kind: DirectoryActorKind) {
  if (kind === "staff") return { allowed: true as const };
  return { allowed: false as const, error: "Niet geautoriseerd." };
}

/** Re-export so callers can throw the same staff-only error. */
export { AdminAuthError };
